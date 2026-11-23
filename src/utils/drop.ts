import type { Client } from "@libsql/client";
import { normalizeRoll, type Dice } from "./dice.js";
import { timeToMinutes } from "./schedule.js";

/**
 * «Se cayeron los dados al piso» 🫣: cada día de juego se invalida un tiro, al azar
 * entre los que tiran, y casi seguro que pasa todos los días (≥ 99 % en la simulación).
 *
 * - **Sorteo por orden de llegada:** el k-ésimo jugador en tirar (contando solo las
 *   primeras tiradas de cada uno) se cae con probabilidad 1 / (N − k + 1). Con N
 *   tiradas, cada una de las primeras N tiene la misma chance (1/N) y la N-ésima se cae seguro.
 * - **N = asistencia habitual:** cuántos jugadores distintos suelen tirar, sacado de los
 *   últimos `ATTENDANCE_DAYS` días con tiradas: el percentil `ATTENDANCE_PERCENTILE`
 *   (bajo, para que casi siempre lleguen N tiradas). Sin historial suficiente se usa la
 *   cantidad de activos de los últimos `ACTIVE_DAYS` días.
 * - **Red de seguridad:** desde `SAFETY_MINUTES` antes del cierre (`roll_window_end`),
 *   si todavía no se cayó nadie, la próxima primera tirada se cae seguro.
 * - Las cuentas de prueba (rol `tester` y `lomitotester`) no se cuentan ni se caen.
 * - El tiro caído se guarda en `dropped_roll` (con `UNIQUE(date)`, que es el claim
 *   atómico: si dos tiran a la vez, solo uno se cae). No entra en `roll`, así que no
 *   cuenta para tareas, Lomito ni estadísticas, y el jugador tiene que tirar de nuevo.
 * - Se ven 3 de los 4 dados: el último (`DROPPED_DIE_INDEX`) es el que rodó abajo de la mesa.
 */

export const ACTIVE_DAYS = 30;
export const ATTENDANCE_DAYS = 20;
export const ATTENDANCE_PERCENTILE = 0.1;
export const MIN_ATTENDANCE_SAMPLES = 5;
export const SAFETY_MINUTES = 30;
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

/** Percentil `p` (0–1) de una lista de números, por el elemento más cercano. */
function percentile(values: number[], p: number) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/**
 * Asistencia habitual (N): percentil bajo de jugadores distintos por día en los
 * últimos días con tiradas, sin contar hoy.
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
    if (counts.length >= MIN_ATTENDANCE_SAMPLES) return Math.max(1, percentile(counts, ATTENDANCE_PERCENTILE));

    // Poco historial: activos de los últimos ACTIVE_DAYS días
    const activeRes = await db.execute({
        sql: `SELECT COUNT(*) AS c FROM (
                SELECT r.user_id FROM roll r JOIN user u ON u.id = r.user_id WHERE r.date >= ? AND r.date < ? AND ${TEST_USERS_SQL}
                UNION
                SELECT d.user_id FROM dropped_roll d JOIN user u ON u.id = d.user_id WHERE d.date >= ? AND d.date < ? AND ${TEST_USERS_SQL}
              )`,
        args: [daysBefore(dateStr, ACTIVE_DAYS), dateStr, daysBefore(dateStr, ACTIVE_DAYS), dateStr]
    });
    return Math.max(1, Number(activeRes.rows[0]?.c ?? 1));
}

/**
 * Probabilidad de que se caiga el tiro que está por hacer `userId` hoy, a los
 * `minutes` minutos del día, con el cierre de la tirada en `windowEnd` («HH:MM»).
 * Devuelve 0 si hoy ya se cayó alguien.
 */
export async function dropChance(
    db: Client,
    userId: string,
    dateStr: string,
    minutes: number,
    windowEnd: string
): Promise<{ chance: number; n: number; k: number; safety: boolean }> {
    const already = await db.execute({ sql: "SELECT 1 FROM dropped_roll WHERE date = ? LIMIT 1", args: [dateStr] });
    if (already.rows.length > 0) return { chance: 0, n: 0, k: 0, safety: false };

    // Primeras tiradas de hoy de otros jugadores (los re-tiros no suman: hoy nadie se cayó todavía)
    const othersRes = await db.execute({
        sql: `SELECT COUNT(DISTINCT r.user_id) AS c FROM roll r JOIN user u ON u.id = r.user_id
              WHERE r.date = ? AND r.user_id <> ? AND ${TEST_USERS_SQL}`,
        args: [dateStr, userId]
    });
    const k = Number(othersRes.rows[0]?.c ?? 0) + 1;
    const n = Math.max(await typicalAttendance(db, dateStr), k);

    // Red de seguridad: en la última media hora de la tirada, si nadie se cayó todavía, este se cae seguro
    // (fuera de la ventana no aplica: ahí solo se tira en local con DEV_UNLIMITED_ROLLS)
    const end = timeToMinutes(windowEnd);
    const safety = minutes >= end - SAFETY_MINUTES && minutes <= end;
    return { chance: safety ? 1 : 1 / (n - k + 1), n, k, safety };
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
