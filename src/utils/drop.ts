import type { Client } from "@libsql/client";
import { normalizeRoll, type Dice } from "./dice.js";

/**
 * «Se cayeron los dados al piso» 🫣: un día de juego, a un jugador se le caen los
 * dados en su primera tirada y tiene que tirar de nuevo. Es 100 % azar y el orden en
 * que se tira no importa.
 *
 * - **Sorteo previo:** con la primera tirada del día (de quien sea) se elige en secreto
 *   al jugador que se va a caer, entre los habituales, con peso igual a su asistencia
 *   en los últimos `ATTENDANCE_DAYS` días de juego. Queda guardado en `settings`
 *   (`drop_target:AAAA-MM-DD`) con un `INSERT OR IGNORE`, que es el claim atómico: el
 *   primero que llega sortea y los demás leen ese mismo resultado.
 * - **La caída:** cuando el elegido hace su primera tirada del día, se le caen los
 *   dados, a la hora que sea. Si ese día no tira, no hay caída. Como el sorteo no mira
 *   el orden, la chance por tirada es la misma tire primero o último; ponderar por
 *   asistencia hace que haya caída más días (Σa² / Σa) que un sorteo uniforme.
 * - **Sin historial:** sorteo uniforme entre los activos de los últimos `ACTIVE_DAYS`
 *   días (o entre todas las cuentas que juegan, si nadie tiró todavía).
 * - **Secreto:** el elegido no se muestra en ningún lado antes de que tire (ni la UI, ni
 *   Discord, ni las respuestas de la API); solo lo lee `/api/roll`.
 * - Las cuentas de prueba (rol `tester` y `lomitotester`) no se cuentan ni se caen.
 * - El tiro caído se guarda en `dropped_roll` (con `UNIQUE(date)`: nunca se caen dos el
 *   mismo día). No entra en `roll`, así que no cuenta para tareas, Lomito ni
 *   estadísticas, y el jugador tira de nuevo como una tirada normal.
 * - Se ven 3 de los 4 dados: el último (`DROPPED_DIE_INDEX`) es el que rodó abajo de la mesa.
 */

export const ACTIVE_DAYS = 30;
export const ATTENDANCE_DAYS = 20;
export const DROPPED_DIE_INDEX = 3;

const TEST_USERS_SQL = "(u.role IS NULL OR u.role <> 'tester') AND u.username <> 'lomitotester'";
const NO_TARGET = "-";

/** ¿Este usuario entra en el sorteo? Las cuentas de prueba nunca se caen. */
export function canDrop(user: { role?: string | null; username?: string | null }) {
    return user.role !== "tester" && user.username !== "lomitotester";
}

/** Fecha `AAAA-MM-DD` de `days` días antes de `dateStr`. */
function daysBefore(dateStr: string, days: number) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

/**
 * Peso de cada jugador para el sorteo: cuántos de los últimos `ATTENDANCE_DAYS`
 * días de juego tiró (tirada válida o caída). Sin historial, peso 1 para los activos.
 */
export async function dropWeights(db: Client, dateStr: string): Promise<Map<string, number>> {
    const daysRes = await db.execute({
        sql: `SELECT DISTINCT date FROM (
                SELECT r.date FROM roll r JOIN user u ON u.id = r.user_id WHERE r.date < ? AND ${TEST_USERS_SQL}
                UNION
                SELECT d.date FROM dropped_roll d JOIN user u ON u.id = d.user_id WHERE d.date < ? AND ${TEST_USERS_SQL}
              ) ORDER BY date DESC LIMIT ?`,
        args: [dateStr, dateStr, ATTENDANCE_DAYS]
    });
    const days = daysRes.rows.map(r => String(r.date));
    const weights = new Map<string, number>();

    if (days.length > 0) {
        const marks = days.map(() => "?").join(", ");
        const res = await db.execute({
            sql: `SELECT user_id, COUNT(DISTINCT date) AS c FROM (
                    SELECT r.user_id, r.date FROM roll r JOIN user u ON u.id = r.user_id WHERE r.date IN (${marks}) AND ${TEST_USERS_SQL}
                    UNION
                    SELECT d.user_id, d.date FROM dropped_roll d JOIN user u ON u.id = d.user_id WHERE d.date IN (${marks}) AND ${TEST_USERS_SQL}
                  ) GROUP BY user_id`,
            args: [...days, ...days]
        });
        res.rows.forEach(r => weights.set(String(r.user_id), Number(r.c)));
        return weights;
    }

    // Sin historial: uniforme entre los activos (o entre todas las cuentas que juegan)
    const activeRes = await db.execute({
        sql: `SELECT DISTINCT r.user_id FROM roll r JOIN user u ON u.id = r.user_id
              WHERE r.date >= ? AND ${TEST_USERS_SQL}`,
        args: [daysBefore(dateStr, ACTIVE_DAYS)]
    });
    const ids = activeRes.rows.length > 0
        ? activeRes.rows.map(r => String(r.user_id))
        : (await db.execute(`SELECT u.id FROM user u WHERE ${TEST_USERS_SQL}`)).rows.map(r => String(r.id));
    ids.forEach(id => weights.set(id, 1));
    return weights;
}

/** Elige un jugador al azar con probabilidad proporcional a su peso. */
function weightedPick(weights: Map<string, number>): string | null {
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const [id, w] of weights) {
        r -= w;
        if (r < 0) return id;
    }
    return [...weights.keys()].pop() ?? null;
}

/**
 * Jugador al que hoy se le van a caer los dados (o `null` si no hay a quién). La
 * primera llamada del día sortea y lo guarda; las demás leen el mismo resultado.
 * **Es secreto:** solo para la lógica de `/api/roll`, nunca para mostrar.
 */
export async function getOrDrawDropTarget(db: Client, dateStr: string): Promise<string | null> {
    const key = `drop_target:${dateStr}`;
    const read = async () => {
        const res = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
        return res.rows.length > 0 ? String(res.rows[0].value) : undefined;
    };

    let value = await read();
    if (value === undefined) {
        const chosen = weightedPick(await dropWeights(db, dateStr)) ?? NO_TARGET;
        await db.execute({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", args: [key, chosen] });
        // Limpia los sorteos de días anteriores
        await db.execute({ sql: "DELETE FROM settings WHERE key LIKE 'drop_target:%' AND key < ?", args: [key] });
        value = await read();
    }
    return value && value !== NO_TARGET ? value : null;
}

/**
 * Intenta registrar la caída de hoy. Devuelve `true` solo si este tiro se quedó con
 * el lugar (el `UNIQUE(date)` impide que se caigan dos el mismo día).
 */
export async function claimDrop(
    db: Client,
    data: { userId: string; dateStr: string; timeStr: string; raw: Dice; vaDeCulo: boolean }
): Promise<boolean> {
    const id = Math.random().toString(36).substring(2, 15);
    const res = await db.execute({
        sql: `INSERT OR IGNORE INTO dropped_roll (id, user_id, date, time, die1, die2, die3, die4, va_de_culo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, data.userId, data.dateStr, data.timeStr, ...data.raw, data.vaDeCulo ? 1 : 0]
    });
    return res.rowsAffected === 1;
}

/** Caída de un día (o `null`), normalizada como cualquier tiro y con el nombre del jugador. */
export async function getDropForDate(db: Client, dateStr: string) {
    const res = await db.execute({
        sql: `SELECT d.*, u.username, u.display_name, u.avatar_url FROM dropped_roll d
              JOIN user u ON u.id = d.user_id WHERE d.date = ? LIMIT 1`,
        args: [dateStr]
    });
    return res.rows.length > 0 ? normalizeRoll(res.rows[0]) : null;
}

/** Caídas entre dos fechas (inclusive), indexadas por fecha. */
export async function getDropsBetween(db: Client, from: string, to: string) {
    const res = await db.execute({
        sql: `SELECT d.*, u.username, u.display_name FROM dropped_roll d
              JOIN user u ON u.id = d.user_id WHERE d.date >= ? AND d.date <= ?`,
        args: [from, to]
    });
    return new Map(res.rows.map(r => [String(r.date), normalizeRoll(r)]));
}
