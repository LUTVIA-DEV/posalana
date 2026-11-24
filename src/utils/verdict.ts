import type { Client } from "@libsql/client";
import { assignDailyChores } from "./chores.js";
import { formatDiceText, normalizeRoll } from "./dice.js";
import { sendDiscordVerdict } from "./discord.js";
import { formatDroppedText, getDropsForDate } from "./drop.js";
import { getSeasonId, getExemptionsForSeason } from "./season.js";

/**
 * Arma el veredicto del día (quién pone, saca, lava, zafa o está exento) y lo
 * publica en Discord. Lo usan tanto la publicación manual del admin como el
 * veredicto automático del cierre.
 */
export async function publishDailyVerdict(
    db: Client,
    dateStr: string,
    options: { automatic?: boolean } = {}
): Promise<{ sent: boolean; playersCount: number }> {
    const seasonId = getSeasonId(dateStr);
    const exemptions = await getExemptionsForSeason(db, seasonId);

    const allRollsRes = await db.execute({
        sql: `
            SELECT r.*, u.username, u.display_name, u.avatar_url
            FROM roll r
            JOIN user u ON r.user_id = u.id
            WHERE r.date = ?
        `,
        args: [dateStr]
    });
    const allRolls = allRollsRes.rows.map(normalizeRoll); // tiro definitivo («va de culo»)

    if (allRolls.length === 0) {
        return { sent: false, playersCount: 0 };
    }

    const { rollChoreMap, sortedRolls } = assignDailyChores(allRolls, exemptions);

    const choresAssigned = {
        lava: [] as string[],
        saca: [] as string[],
        pone: [] as string[],
        zafaron: [] as string[],
        exentos: [] as string[]
    };

    // «Dados al piso» 🫣: caídas del día, para anotarlas al lado de cada nombre
    const drops = await getDropsForDate(db, dateStr);

    for (const roll of sortedRolls) {
        const name = String(roll.display_name || roll.username);
        // Quien cantó «va de culo» lleva su tiro real y el definitivo; a quien se le cayeron
        // los dados, el tiro caído. Por ejemplo: «Ana (6·4·3·1 — 🍑 real: 1·3·4·6 — 🫣 caído: 2·5·3·🕳️)»
        const drop = drops.find(d => String(d.user_id) === String(roll.user_id));
        const notes: string[] = [];
        if (roll.va_de_culo) notes.push(formatDiceText(roll.raw_dice, true, "·"));
        else if (drop) notes.push([roll.die1, roll.die2, roll.die3, roll.die4].join("·"));
        if (drop) notes.push(`🫣 caído: ${formatDroppedText([drop.die1, drop.die2, drop.die3, drop.die4], drop.va_de_culo, "·")}`);
        const displayName = notes.length > 0 ? `${name} (${notes.join(" — ")})` : name;
        const chore = rollChoreMap.get(roll.id);

        if (chore.code === "LA") {
            choresAssigned.lava.push(displayName);
        } else if (chore.code === "SA") {
            choresAssigned.saca.push(displayName);
        } else if (chore.code === "PO") {
            choresAssigned.pone.push(displayName);
        } else {
            const userExemptions = exemptions.filter(e => String(e.user_id) === String(roll.user_id));
            if (userExemptions.length > 0) {
                const exCodes = userExemptions.map(e => e.chore_code).join(", ");
                choresAssigned.exentos.push(`${displayName} (${exCodes})`);
            } else {
                choresAssigned.zafaron.push(displayName);
            }
        }
    }

    // Fecha para el título de Discord (DD/MM/YYYY)
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    const playersCount = new Set(allRolls.map(r => String(r.user_id))).size;

    // A quienes se les cayeron los dados y no volvieron a tirar (los demás ya figuran con su tarea)
    const droppedBy = drops
        .filter(d => !allRolls.some(r => String(r.user_id) === String(d.user_id)))
        .map(d => String(d.display_name || d.username));

    const result = await sendDiscordVerdict(formattedDate, choresAssigned, playersCount, options.automatic ?? false, droppedBy);
    if (result === "error") {
        throw new Error("Discord rechazó el veredicto");
    }

    return { sent: true, playersCount };
}
