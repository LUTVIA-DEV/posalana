/**
 * «Va de culo» 🍑: antes de tirar, el jugador puede cantarla y cada dado se lee
 * por su cara opuesta (7 − x: el 1 es 6, el 2 es 5, el 3 es 4…). No cambia las
 * probabilidades, es folclore de generala.
 *
 * En la base quedan los dados reales (`die1`…`die4`) y el flag (`va_de_culo`).
 * El tiro definitivo se recalcula siempre con `normalizeRoll`: es lo único que
 * cuenta para la asignación de tareas, la Cláusula Lomito y las estadísticas.
 */

export type Dice = [number, number, number, number];

/** Cara opuesta de un dado de seis caras. */
export const flipDie = (value: number) => 7 - value;

/** Tiro definitivo a partir de los dados reales y el flag. */
export function finalDice(raw: Dice, vaDeCulo: boolean): Dice {
    return vaDeCulo ? (raw.map(flipDie) as Dice) : raw;
}

/**
 * Normaliza una fila de `roll` (con o sin datos del usuario): `die1`…`die4`
 * pasan a ser el tiro definitivo, `raw_dice` guarda el real y `va_de_culo`
 * queda como booleano. Así todo lo que ya leía `die1`…`die4` usa el definitivo.
 */
export function normalizeRoll<T extends Record<string, any>>(row: T) {
    const raw: Dice = [Number(row.die1), Number(row.die2), Number(row.die3), Number(row.die4)];
    const vaDeCulo = Number(row.va_de_culo ?? 0) === 1;
    const [die1, die2, die3, die4] = finalDice(raw, vaDeCulo);
    return { ...row, die1, die2, die3, die4, raw_dice: raw, va_de_culo: vaDeCulo };
}

export type NormalizedRoll = ReturnType<typeof normalizeRoll>;

/**
 * Expresiones SQL del tiro definitivo, para las consultas que agrupan o comparan
 * dados en la base (por ejemplo, el contador de «días sin lomito»).
 */
export const FINAL_DICE_SQL = [1, 2, 3, 4]
    .map(n => `CASE WHEN va_de_culo = 1 THEN 7 - die${n} ELSE die${n} END`)
    .join(", ");

/**
 * Texto del tiro en una sola línea (veredicto de Discord), primero el definitivo y después el real:
 * «1 - 3 - 4 - 6» o «6 - 4 - 3 - 1 — real: 1 - 3 - 4 - 6 🍑» (el 🍑 siempre a la derecha).
 */
export function formatDiceText(raw: Dice, vaDeCulo: boolean, sep = " - "): string {
    const real = raw.join(sep);
    return vaDeCulo ? `${finalDice(raw, true).join(sep)} — real: ${real} 🍑` : real;
}
