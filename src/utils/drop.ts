import type { Client } from "@libsql/client";
import { normalizeRoll, type Dice } from "./dice.js";

/**
 * «Se cayeron los dados al piso» 🫣: cada día de juego se invalida exactamente un
 * tiro, al azar y con la misma chance para todos («uno seguro»).
 *
 * - El k-ésimo jugador en tirar (contando solo las primeras tiradas de cada uno) se
 *   cae con probabilidad 1 / (N − k + 1). Si llegan a tirar todos los activos, al
 *   último le toca seguro; si no tiran todos, algún día puede no caerse a nadie.
 * - **Usuarios activos (N):** las cuentas que no son de prueba (ni rol `tester` ni
 *   `lomitotester`) que tiraron al menos una vez en los últimos `ACTIVE_DAYS` días,
 *   más quien está tirando y quienes ya tiraron hoy. Así las cuentas abandonadas no
 *   bajan la chance de los que juegan.
 * - El tiro caído se guarda en `dropped_roll` (con `UNIQUE(date)`, que es el claim
 *   atómico: si dos tiran a la vez, solo uno se cae). No entra en `roll`, así que no
 *   cuenta para tareas, Lomito ni estadísticas, y el jugador tiene que tirar de nuevo.
 * - Se ven 3 de los 4 dados: el último (`DROPPED_DIE_INDEX`) es el que rodó abajo de la mesa.
 */

export const ACTIVE_DAYS = 30;
export const DROPPED_DIE_INDEX = 3;

const TEST_USERS_SQL = "(u.role IS NULL OR u.role <> 'tester') AND u.username <> 'lomitotester'";

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
 * Probabilidad de que se caiga el tiro que está por hacer `userId` hoy.
 * Devuelve 0 si hoy ya se cayó alguien.
 */
export async function dropChance(db: Client, userId: string, dateStr: string): Promise<{ chance: number; n: number; k: number }> {
    const already = await db.execute({ sql: "SELECT 1 FROM dropped_roll WHERE date = ? LIMIT 1", args: [dateStr] });
    if (already.rows.length > 0) return { chance: 0, n: 0, k: 0 };

    // Primeras tiradas de hoy de otros jugadores (los re-tiros no suman: hoy nadie se cayó todavía)
    const othersRes = await db.execute({
        sql: `SELECT COUNT(DISTINCT r.user_id) AS c FROM roll r JOIN user u ON u.id = r.user_id
              WHERE r.date = ? AND r.user_id <> ? AND ${TEST_USERS_SQL}`,
        args: [dateStr, userId]
    });
    const k = Number(othersRes.rows[0]?.c ?? 0) + 1;

    // Activos: tiraron en los últimos ACTIVE_DAYS días (tiradas válidas o caídas), más quien tira ahora
    const activeRes = await db.execute({
        sql: `SELECT COUNT(*) AS c FROM (
                SELECT r.user_id FROM roll r JOIN user u ON u.id = r.user_id
                WHERE r.date >= ? AND r.date <= ? AND ${TEST_USERS_SQL}
                UNION
                SELECT d.user_id FROM dropped_roll d JOIN user u ON u.id = d.user_id
                WHERE d.date >= ? AND d.date <= ? AND ${TEST_USERS_SQL}
                UNION
                SELECT ?
              )`,
        args: [daysBefore(dateStr, ACTIVE_DAYS), dateStr, daysBefore(dateStr, ACTIVE_DAYS), dateStr, userId]
    });
    const n = Math.max(Number(activeRes.rows[0]?.c ?? 1), k);

    return { chance: 1 / (n - k + 1), n, k };
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
