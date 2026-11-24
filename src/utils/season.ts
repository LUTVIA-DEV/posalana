import { assignDailyChores } from './chores.js';
import { normalizeRoll } from './dice.js';

export function getSeasonId(dateStr: string): string {
    // Try to extract only the YYYY-MM-DD part to avoid timezone shifts
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let year: number;
    let month: number;
    let day: number;

    if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
    } else {
        // Fallback for other formats (using UTC methods)
        const d = new Date(dateStr);
        month = d.getUTCMonth() + 1;
        day = d.getUTCDate();
        year = d.getUTCFullYear();
    }

    // Verano: Dec 21 - Mar 20
    // Otoño: Mar 21 - Jun 20
    // Invierno: Jun 21 - Sep 20
    // Primavera: Sep 21 - Dec 20

    if ((month === 12 && day >= 21) || month === 1 || month === 2 || (month === 3 && day <= 20)) {
        // If it's Dec, it belongs to the summer that ends in the NEXT year
        const seasonYear = month === 12 ? year + 1 : year;
        return `${seasonYear}-verano`;
    } else if ((month === 3 && day >= 21) || month === 4 || month === 5 || (month === 6 && day <= 20)) {
        return `${year}-otoño`;
    } else if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day <= 20)) {
        return `${year}-invierno`;
    } else {
        return `${year}-primavera`;
    }
}

export function formatSeasonName(seasonId: string): string {
    const parts = seasonId.split('-');
    if (parts.length !== 2) return seasonId;
    const year = parts[0];
    const season = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${season} ${year}`;
}

export function getPreviousSeasons(seasonId: string, count: number): string[] {
    const seasonsOrder = ['verano', 'otoño', 'invierno', 'primavera'];
    const parts = seasonId.split('-');
    if (parts.length !== 2) return [seasonId];
    
    let year = parseInt(parts[0]);
    let seasonName = parts[1];
    
    let currentIndex = seasonsOrder.indexOf(seasonName);
    if (currentIndex === -1) return [seasonId];
    
    const result: string[] = [seasonId];
    
    for (let i = 0; i < count; i++) {
        currentIndex--;
        if (currentIndex < 0) {
            currentIndex = 3;
            year--;
        }
        const prevSeasonName = seasonsOrder[currentIndex];
        result.push(`${year}-${prevSeasonName}`);
    }
    
    return result;
}

const SEASONS_ORDER = ['verano', 'otoño', 'invierno', 'primavera'];

// Numeric key to sort season ids chronologically (e.g. "2026-otoño" -> 20261)
function seasonSortKey(seasonId: string): number {
    const [year, name] = seasonId.split('-');
    return parseInt(year, 10) * 10 + SEASONS_ORDER.indexOf(name);
}

// Date range covered by a season, formatted as DD/MM/YYYY
export function getSeasonDateRange(seasonId: string): { start: string; end: string } {
    const [yearStr, name] = seasonId.split('-');
    const year = parseInt(yearStr, 10);
    const ranges: Record<string, [string, string]> = {
        verano: [`21/12/${year - 1}`, `20/03/${year}`],
        otoño: [`21/03/${year}`, `20/06/${year}`],
        invierno: [`21/06/${year}`, `20/09/${year}`],
        primavera: [`21/09/${year}`, `20/12/${year}`],
    };
    const [start, end] = ranges[name] || ['', ''];
    return { start, end };
}

// All finished seasons (before the current one) that have rolls or manual points, newest first
export async function getPastSeasonsWithData(db: any, currentSeasonId: string): Promise<string[]> {
    const rollDatesRes = await db.execute("SELECT DISTINCT date FROM roll");
    const manualSeasonsRes = await db.execute("SELECT DISTINCT season_id FROM manual_points");

    const seasons = new Set<string>();
    for (const r of rollDatesRes.rows) seasons.add(getSeasonId(r.date as string));
    for (const r of manualSeasonsRes.rows) seasons.add(r.season_id as string);

    const currentKey = seasonSortKey(currentSeasonId);
    return Array.from(seasons)
        .filter(s => SEASONS_ORDER.includes(s.split('-')[1]) && seasonSortKey(s) < currentKey)
        .sort((a, b) => seasonSortKey(b) - seasonSortKey(a));
}

// Keep a cache of computed exemptions to prevent infinite loops and redundant work
const exemptionsCache = new Map<string, any[]>();

export async function getExemptionsForSeason(db: any, seasonId: string): Promise<any[]> {
    if (exemptionsCache.has(seasonId)) {
        return exemptionsCache.get(seasonId)!;
    }

    // Check if there are manual exemptions in the database for this season.
    const manualExemptionsRes = await db.execute({
        sql: `
            SELECT e.user_id, e.chore_code, u.username, u.display_name, u.avatar_url 
            FROM exemption e
            JOIN user u ON e.user_id = u.id
            WHERE e.season_id = ?
        `,
        args: [seasonId]
    });
    
    if (manualExemptionsRes.rows.length > 0) {
        const result = manualExemptionsRes.rows.map((r: any) => ({
            user_id: r.user_id,
            chore_code: r.chore_code,
            username: r.username,
            display_name: r.display_name,
            avatar_url: r.avatar_url
        }));
        exemptionsCache.set(seasonId, result);
        return result;
    }

    // If no manual exemptions, calculate them automatically based on the previous season's scores!
    const prevSeasonId = getPreviousSeasons(seasonId, 1)[1];
    if (!prevSeasonId || prevSeasonId === seasonId) {
        exemptionsCache.set(seasonId, []);
        return [];
    }

    // Calculate stats for the previous season
    const prevStats = await calculateSeasonPointsInternal(db, prevSeasonId);
    if (prevStats.length === 0) {
        exemptionsCache.set(seasonId, []);
        return [];
    }

    // For each chore (LA, SA, PO), find the player with the highest score in the previous season.
    const computedExemptions: any[] = [];
    const chores = ["LA", "SA", "PO"];
    for (const chore of chores) {
        let maxScore = 0;
        let maxPlayers: any[] = [];
        for (const stat of prevStats) {
            const score = stat.scores[chore] || 0;
            if (score > maxScore) {
                maxScore = score;
                maxPlayers = [stat];
            } else if (score === maxScore && score > 0) {
                maxPlayers.push(stat);
            }
        }
        
        for (const player of maxPlayers) {
            computedExemptions.push({
                user_id: player.id,
                chore_code: chore,
                username: player.username,
                display_name: player.display_name,
                avatar_url: player.avatar_url
            });
        }
    }

    exemptionsCache.set(seasonId, computedExemptions);
    return computedExemptions;
}

export async function calculateSeasonPoints(db: any, seasonId: string) {
    return calculateSeasonPointsInternal(db, seasonId);
}

async function calculateSeasonPointsInternal(db: any, seasonId: string): Promise<any[]> {
    // 1. Get all rolls that belong to the season
    const rollsRes = await db.execute("SELECT r.*, r.rowid AS roll_seq, u.username, u.display_name, u.avatar_url FROM roll r JOIN user u ON r.user_id = u.id");
    const allRolls = rollsRes.rows
        .filter((r: any) => getSeasonId(r.date as string) === seasonId)
        .map(normalizeRoll); // las estadísticas cuentan el tiro definitivo («va de culo»)

    // 2. Get manual points for this season
    const manualPointsRes = await db.execute({
        sql: "SELECT user_id, chore_code, points FROM manual_points WHERE season_id = ?",
        args: [seasonId]
    });
    const manualPoints = manualPointsRes.rows;

    // Base case: If there are no rolls and no manual points, this season is inactive.
    // We return early to prevent infinite recursion into past empty seasons.
    if (allRolls.length === 0 && manualPoints.length === 0) {
        return [];
    }

    // 3. Get exemptions for this season
    const exemptions = await getExemptionsForSeason(db, seasonId);

    // 4. Group rolls by date
    const rollsByDate = new Map<string, any[]>();
    for (const roll of allRolls) {
        if (!rollsByDate.has(roll.date as string)) rollsByDate.set(roll.date as string, []);
        rollsByDate.get(roll.date as string)!.push(roll);
    }

    // 5. Calculate points
    const userStats = new Map<string, any>();
    
    const initUser = (userId: string, username: string = "Desconocido", display_name: string = "Desconocido", avatar_url: string = "") => {
        if (!userStats.has(userId)) {
            userStats.set(userId, { id: userId, username, display_name, avatar_url, scores: { LA: 0, SA: 0, PO: 0 } });
        }
    };

    for (const [date, dailyRolls] of rollsByDate.entries()) {
        for (const roll of dailyRolls) {
            initUser(roll.user_id as string, roll.username as string, roll.display_name as string, roll.avatar_url as string);
        }

        const { rollChoreMap } = assignDailyChores(dailyRolls, exemptions);
        
        for (const [rollId, chore] of rollChoreMap.entries()) {
            if (chore.code !== "NA") {
                const roll = dailyRolls.find((r: any) => r.id === rollId);
                if (roll) userStats.get(roll.user_id).scores[chore.code]++;
            }
        }
    }

    // Apply manual points (accumulate instead of overwriting)
    for (const mp of manualPoints) {
        if (!userStats.has(mp.user_id as string)) {
            const uRes = await db.execute({ sql: "SELECT username, display_name, avatar_url FROM user WHERE id = ?", args: [mp.user_id] });
            const u = uRes.rows[0];
            initUser(mp.user_id as string, u?.username as string, u?.display_name as string, u?.avatar_url as string);
        }
        userStats.get(mp.user_id as string).scores[mp.chore_code as string] += mp.points;
    }

    return Array.from(userStats.values());
}

export async function calculateYearPoints(db: any, year: string) {
    const seasons = [`${year}-verano`, `${year}-otoño`, `${year}-invierno`, `${year}-primavera`];
    const userStats = new Map<string, any>();
    
    for (const seasonId of seasons) {
        const seasonStats = await calculateSeasonPoints(db, seasonId);
        for (const stat of seasonStats) {
            if (!userStats.has(stat.id)) {
                userStats.set(stat.id, {
                    id: stat.id,
                    username: stat.username,
                    display_name: stat.display_name,
                    avatar_url: stat.avatar_url,
                    scores: { LA: 0, SA: 0, PO: 0 }
                });
            }
            const user = userStats.get(stat.id);
            user.scores.LA += stat.scores.LA;
            user.scores.SA += stat.scores.SA;
            user.scores.PO += stat.scores.PO;
        }
    }
    
    return Array.from(userStats.values());
}
