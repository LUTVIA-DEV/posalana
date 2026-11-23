import type { Client } from "@libsql/client";
import { normalizeRoll, type Dice } from "./dice.js";

/**
 * «Se cayeron los dados al piso» 🫣: a veces a alguien se le va un dado abajo de la
 * mesa y tiene que tirar de nuevo. Se decide en el momento de la tirada.
 *
 * - **Chance fija e independiente:** en la primera tirada del día de cada jugador hay una
 *   chance `p` de que se caigan los dados, la misma para todos: no depende del jugador,
 *   de su asistencia ni del orden de llegada. No hay tope por día: se pueden caer varios
 *   o ninguno. A un mismo jugador no se le caen dos veces el mismo día (el re-tiro no sortea).
 * - **Cuánto vale p:** si el admin la fijó (`settings.drop_probability`, en %), esa. Si no,
 *   `p = 1 − (1 − DAILY_TARGET)^(1/n)`, para que con la asistencia habitual haya al menos
 *   una caída en el día con chance `DAILY_TARGET` (90 %). `n` es la mediana de jugadores
 *   distintos por día en los últimos `ATTENDANCE_DAYS` días de juego (sin historial, los
 *   activos de los últimos `ACTIVE_DAYS` días). Siempre queda entre `P_MIN` y `P_MAX`.
 * - Las cuentas de prueba (rol `tester` y `lomitotester`) no se cuentan ni se caen.
 * - Los tiros caídos se guardan en `dropped_roll` (`UNIQUE(user_id, date)`). No entran en
 *   `roll`, así que no cuentan para tareas, Lomito ni estadísticas, y el jugador tira de nuevo.
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

/** Clave de `settings` donde el admin puede fijar p (en %); sin la clave, p es automática. */
export const DROP_PROBABILITY_KEY = "drop_probability";

/** p automática (sin lo que fije el admin), con la asistencia habitual. */
export async function defaultDropProbability(db: Client, dateStr: string): Promise<number> {
    return dropProbability(await typicalAttendance(db, dateStr));
}

/** p de hoy: la que fijó el admin (acotada) o la automática. */
export async function getDropProbability(db: Client, dateStr: string): Promise<number> {
    const res = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [DROP_PROBABILITY_KEY] });
    const pct = Number(res.rows[0]?.value);
    if (res.rows.length > 0 && Number.isFinite(pct)) return Math.min(P_MAX, Math.max(P_MIN, pct / 100));
    return defaultDropProbability(db, dateStr);
}

/** ¿A este jugador ya se le cayeron los dados hoy? (no le pasa dos veces el mismo día) */
export async function hasUserDropToday(db: Client, userId: string, dateStr: string): Promise<boolean> {
    const res = await db.execute({ sql: "SELECT 1 FROM dropped_roll WHERE user_id = ? AND date = ? LIMIT 1", args: [userId, dateStr] });
    return res.rows.length > 0;
}

/**
 * Registra la caída. Devuelve `true` si se guardó (el `UNIQUE(user_id, date)` impide
 * que al mismo jugador se le caigan dos veces el mismo día).
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

/** Caídas de un día (puede haber varias o ninguna), normalizadas y con el nombre del jugador. */
export async function getDropsForDate(db: Client, dateStr: string) {
    const res = await db.execute({
        sql: `SELECT d.*, u.username, u.display_name, u.avatar_url FROM dropped_roll d
              JOIN user u ON u.id = d.user_id WHERE d.date = ? ORDER BY d.time, d.id`,
        args: [dateStr]
    });
    return res.rows.map(normalizeRoll);
}

/** Caídas entre dos fechas (inclusive), agrupadas por fecha. */
export async function getDropsBetween(db: Client, from: string, to: string) {
    const res = await db.execute({
        sql: `SELECT d.*, u.username, u.display_name FROM dropped_roll d
              JOIN user u ON u.id = d.user_id WHERE d.date >= ? AND d.date <= ? ORDER BY d.time, d.id`,
        args: [from, to]
    });
    const byDate = new Map<string, ReturnType<typeof normalizeRoll>[]>();
    for (const row of res.rows.map(normalizeRoll)) {
        const date = String(row.date);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(row);
    }
    return byDate;
}

/** «Ana», «Ana y Beto», «Ana, Beto y Carla». */
export function joinNames(names: string[]) {
    return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
