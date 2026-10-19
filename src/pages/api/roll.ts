import type { APIContext } from "astro";
import db from "../../db/index.js";
import { assignDailyChores } from "../../utils/chores.js";
import { sendDiscordRoll } from "../../utils/discord.js";
import { getArgentinaNow, getNextPlayDay, getRollSchedule, getRollWindowStatus } from "../../utils/schedule.js";

function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

export async function POST(context: APIContext): Promise<Response> {
	if (!context.locals.session) {
		return new Response("No autorizado", { status: 401 });
	}

    // Fecha y hora en Argentina (GMT-3)
    const { dateStr, timeStr, minutes } = getArgentinaNow();

    const userId = context.locals.user!.id;

    // Solo se puede tirar los días de juego y dentro del horario oficial (el tester
    // queda afuera de esta regla para poder probar la Cláusula Lomito cuando quiera).
    if (context.locals.user?.role !== 'tester') {
        const schedule = await getRollSchedule(db);
        const status = getRollWindowStatus(schedule, minutes, dateStr);
        if (status === "no-play") {
            const next = getNextPlayDay(schedule, dateStr);
            return new Response(`Hoy no se juega. La próxima tirada es ${next.label}, de ${schedule.start} a ${schedule.end}.`, { status: 403 });
        }
        if (status === "before") {
            return new Response(`Todavía no abrió la tirada: los dados se habilitan a las ${schedule.start}.`, { status: 403 });
        }
        if (status === "closed") {
            const next = getNextPlayDay(schedule, dateStr);
            return new Response(`La tirada de hoy cerró a las ${schedule.end}. Volvé ${next.label} a las ${schedule.start}.`, { status: 403 });
        }
    }

    // Check if already rolled
    const existing = await db.execute({
        sql: "SELECT id FROM roll WHERE user_id = ? AND date = ?",
        args: [userId, dateStr]
    });

    if (existing.rows.length > 0) {
        return new Response("Ya tiraste los dados hoy", { status: 400 });
    }

    let d1 = rollDie();
    let d2 = rollDie();
    let d3 = rollDie();
    let d4 = rollDie();
    const id = Math.random().toString(36).substring(2, 15);

    if (context.locals.user?.username === 'lomitotester') {
        // Fetch admin's roll for today
        const adminRollRes = await db.execute({
            sql: `
                SELECT r.die1, r.die2, r.die3, r.die4 
                FROM roll r 
                JOIN user u ON r.user_id = u.id 
                WHERE u.role = 'admin' AND r.date = ? 
                LIMIT 1
            `,
            args: [dateStr]
        });
        if (adminRollRes.rows.length > 0) {
            d1 = adminRollRes.rows[0].die1 as number;
            d2 = adminRollRes.rows[0].die2 as number;
            d3 = adminRollRes.rows[0].die3 as number;
            d4 = adminRollRes.rows[0].die4 as number;
        } else {
            return new Response("El admin debe tirar primero para poder testear la cláusula lomito.", { status: 400 });
        }
    }

    await db.execute({
        sql: "INSERT INTO roll (id, user_id, date, time, die1, die2, die3, die4) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, userId, dateStr, timeStr, d1, d2, d3, d4]
    });

    // Fetch all rolls of today to check if this roll triggered the Cláusula Lomito
    const allRollsRes = await db.execute({
        sql: `
            SELECT r.id, r.user_id, r.die1, r.die2, r.die3, r.die4, u.display_name, u.username, u.avatar_url 
            FROM roll r 
            JOIN user u ON r.user_id = u.id 
            WHERE r.date = ?
        `,
        args: [dateStr]
    });
    const allRolls = allRollsRes.rows;

    // Check if the current roll specifically triggered the Lomito Clause (i.e. matches another roll from today in the exact same order)
    const currentRollMatchesOther = allRolls.some((r: any) => 
        String(r.user_id) !== String(userId) &&
        Number(r.die1) === d1 &&
        Number(r.die2) === d2 &&
        Number(r.die3) === d3 &&
        Number(r.die4) === d4
    );

    let discordLomitoActivated = false;
    let discordLomitoPlayers: string[] = [];
    if (currentRollMatchesOther) {
        discordLomitoActivated = true;
        const matchingRolls = allRolls.filter((r: any) => 
            Number(r.die1) === d1 &&
            Number(r.die2) === d2 &&
            Number(r.die3) === d3 &&
            Number(r.die4) === d4
        );
        for (const r of matchingRolls) {
            const name = r.display_name || r.username || "Usuario";
            if (!discordLomitoPlayers.includes(name)) {
                discordLomitoPlayers.push(name);
            }
        }
    }

    // Send Discord notification asynchronously (don't block the redirect)
    const displayName = context.locals.user?.display_name || context.locals.user?.username || "Usuario";
    sendDiscordRoll(displayName, [d1, d2, d3, d4], discordLomitoActivated, discordLomitoPlayers).catch(err => {
        console.error("Error trigger sending Discord roll:", err);
    });

	return context.redirect("/");
}
