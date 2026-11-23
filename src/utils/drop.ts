import type { Client } from "@libsql/client";
import { normalizeRoll, type Dice } from "./dice.js";

/**
 * «Se cayeron los dados al piso» 🫣: a veces a alguien se le va un dado abajo de la
 * mesa y tiene que tirar de nuevo. Se decide en el momento de la tirada.
 *
 * - **Chance fija:** en la primera tirada del día de cada jugador hay una chance `p` de
 *   que se caigan los dados, la misma para todos: no depende del jugador, de su
 *   asistencia ni del orden de llegada.
 * - **Máximo uno por día:** cuando ya se cayó uno, el resto del día queda a salvo (eso le
 *   da un poco más de riesgo a los que tiran temprano, y está aceptado).
 * - **Cuánto vale p:** `p = 1 − (1 − DAILY_TARGET)^(1/n)`, para que con la asistencia
 *   habitual haya al menos una caída en el día con chance `DAILY_TARGET` (90 %). `n` es
 *   la mediana de jugadores distintos por día en los últimos `ATTENDANCE_DAYS` días de
 *   juego (sin historial, los activos de los últimos `ACTIVE_DAYS` días), y `p` queda
 *   acotada entre `P_MIN` y `P_MAX`.
 * - Las cuentas de prueba (rol `tester` y `lomitotester`) no se cuentan ni se caen.
 * - El tiro caído se guarda en `dropped_roll` (con `UNIQUE(date)`, que es el claim
 *   atómico del tope: si dos se caen a la vez, solo uno queda). No entra en `roll`, así
 *   que no cuenta para tareas, Lomito ni estadísticas, y el jugador tira de nuevo.
 * - Se ven 3 de los 4 dados: el último (`DROPPED_DIE_INDEX`) es el que rodó abajo de la mesa.
 */

export const DAILY_TARGET = 0.9;
export const P_MIN = 0.05;
export const P_MAX = 0.5;
export const ACTIVE_DAYS = 30;
export const ATTENDANCE_DAYS = 20;
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

function median(values: number[]) {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Asistencia habitual (n): mediana de jugadores distintos por día en los últimos
 * días de juego, sin contar hoy. Sin historial, los activos de los últimos 30 días.
 */
export async function typicalAttendance(db: Client, dateStr: string): Promise<number> {
    const res = await db.execute({
        sql: `SELECT date, COUNT(DISTINCT user_id) AS c FROM (
                SELECT r.date, r.user_id FROM roll r JOIN user u ON u.id = r.user_id WHERE r.date < ? AND ${TEST_USERS_SQL}
                UNION
                SELECT d.date, d.user_id FROM dropped_roll d JOIN user u ON u.id = d.user_id WHERE d.date < ? AND ${TEST_USERS_SQL}
              ) GROUP BY date ORDER BY date DESC LIMIT ?`,
        args: [dateStr, dateStr, ATTENDANCE_DAYS]
    });
    const counts = res.rows.map(r => Number(r.c));
    if (counts.length > 0) return Math.max(1, median(counts));

    const activeRes = await db.execute({
        sql: `SELECT COUNT(DISTINCT r.user_id) AS c FROM roll r JOIN user u ON u.id = r.user_id
              WHERE r.date >= ? AND ${TEST_USERS_SQL}`,
        args: [daysBefore(dateStr, ACTIVE_DAYS)]
    });
    return Math.max(1, Number(activeRes.rows[0]?.c ?? 1));
}

/** Chance por tirada para que con `n` jugadores haya al menos una caída con chance `DAILY_TARGET`. */
export function dropProbability(n: number): number {
    const p = 1 - Math.pow(1 - DAILY_TARGET, 1 / Math.max(1, n));
    return Math.min(P_MAX, Math.max(P_MIN, p));
}

/** ¿Ya se cayó alguien hoy? (el tope es uno por día) */
export async function hasDropToday(db: Client, dateStr: string): Promise<boolean> {
    const res = await db.execute({ sql: "SELECT 1 FROM dropped_roll WHERE date = ? LIMIT 1", args: [dateStr] });
    return res.rows.length > 0;
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
