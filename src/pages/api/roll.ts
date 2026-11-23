import type { APIContext } from "astro";
import db from "../../db/index.js";
import { finalDice, normalizeRoll, type Dice } from "../../utils/dice.js";
import { sendDiscordDrop, sendDiscordRoll } from "../../utils/discord.js";
import { devUnlimitedRolls } from "../../utils/dev.js";
import { canDrop, claimDrop, getOrDrawDropTarget } from "../../utils/drop.js";
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
    // En local, con DEV_UNLIMITED_ROLLS=1, no hay fecha, horario ni tirada única.
    const unlimited = devUnlimitedRolls();

    if (context.locals.user?.role !== 'tester' && !unlimited) {
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
        if (!unlimited) {
            return new Response("Ya tiraste los dados hoy", { status: 400 });
        }
        // Modo desarrollo: la tirada nueva reemplaza la de hoy
        await db.execute({ sql: "DELETE FROM roll WHERE user_id = ? AND date = ?", args: [userId, dateStr] });
    }

    // «Va de culo» 🍑: se canta antes de tirar (viene en el pedido) y el servidor da vuelta los dados.
    let vaDeCulo = false;
    // Solo en local (DEV_UNLIMITED_ROLLS=1): forzar que este tiro se caiga al piso
    let forceDrop = false;
    try {
        const form = await context.request.formData();
        vaDeCulo = form.get("va_de_culo") === "1";
        forceDrop = unlimited && form.get("forzar_caida") === "1";
    } catch {
        // Pedido sin formulario: tirada normal
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
                SELECT r.die1, r.die2, r.die3, r.die4, r.va_de_culo
                FROM roll r 
                JOIN user u ON r.user_id = u.id 
                WHERE u.role = 'admin' AND r.date = ? 
                LIMIT 1
            `,
            args: [dateStr]
        });
        if (adminRollRes.rows.length > 0) {
            // Copia el tiro definitivo del admin; si el tester canta «va de culo», guarda el real que da lo mismo
            const admin = normalizeRoll(adminRollRes.rows[0]);
            [d1, d2, d3, d4] = finalDice([admin.die1, admin.die2, admin.die3, admin.die4], vaDeCulo);
        } else {
            return new Response("El admin debe tirar primero para poder testear la cláusula lomito.", { status: 400 });
        }
    }

    const displayName = context.locals.user?.display_name || context.locals.user?.username || "Usuario";

    // «Se cayeron los dados al piso» 🫣: un tiro por día se invalida al azar y hay que tirar de nuevo
    if (context.locals.user && canDrop(context.locals.user)) {
        let drops = false;
        if (forceDrop) {
            await db.execute({ sql: "DELETE FROM dropped_roll WHERE date = ?", args: [dateStr] });
            drops = true;
        } else {
            // El sorteo previo del día (secreto) dice a quién se le caen los dados en su primera tirada
            const target = await getOrDrawDropTarget(db, dateStr);
            drops = target === String(userId);
        }
        if (drops) {
            const raw: Dice = [d1, d2, d3, d4];
            if (await claimDrop(db, { userId, dateStr, timeStr, raw, vaDeCulo })) {
                sendDiscordDrop(displayName, raw, vaDeCulo).catch(err => {
                    console.error("Error sending Discord drop:", err);
                });
                return context.redirect("/?caida=1");
            }
        }
    }

    await db.execute({
        sql: "INSERT INTO roll (id, user_id, date, time, die1, die2, die3, die4, va_de_culo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, userId, dateStr, timeStr, d1, d2, d3, d4, vaDeCulo ? 1 : 0]
    });

    // Dados reales (los que se guardaron) y tiro definitivo, que es el que cuenta
    const rawDice: Dice = [d1, d2, d3, d4];
    const [f1, f2, f3, f4] = finalDice(rawDice, vaDeCulo);

    // Fetch all rolls of today to check if this roll triggered the Cláusula Lomito
    const allRollsRes = await db.execute({
        sql: `
            SELECT r.id, r.user_id, r.die1, r.die2, r.die3, r.die4, r.va_de_culo, u.display_name, u.username, u.avatar_url 
            FROM roll r 
            JOIN user u ON r.user_id = u.id 
            WHERE r.date = ?
        `,
        args: [dateStr]
    });
    const allRolls = allRollsRes.rows.map(normalizeRoll);

    // Check if the current roll specifically triggered the Lomito Clause (i.e. matches another roll from today in the exact same order)
    const currentRollMatchesOther = allRolls.some((r: any) => 
        String(r.user_id) !== String(userId) &&
        r.die1 === f1 &&
        r.die2 === f2 &&
        r.die3 === f3 &&
        r.die4 === f4
    );

    let discordLomitoActivated = false;
    let discordLomitoPlayers: string[] = [];
    if (currentRollMatchesOther) {
        discordLomitoActivated = true;
        const matchingRolls = allRolls.filter((r: any) => 
            r.die1 === f1 &&
            r.die2 === f2 &&
            r.die3 === f3 &&
            r.die4 === f4
        );
        for (const r of matchingRolls) {
            const name = r.display_name || r.username || "Usuario";
            if (!discordLomitoPlayers.includes(name)) {
                discordLomitoPlayers.push(name);
            }
        }
    }

    // Send Discord notification asynchronously (don't block the redirect)
    sendDiscordRoll(displayName, rawDice, vaDeCulo, discordLomitoActivated, discordLomitoPlayers).catch(err => {
        console.error("Error trigger sending Discord roll:", err);
    });

	return context.redirect("/");
}
