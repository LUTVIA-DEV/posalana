/**
 * Herramientas de desarrollo. Solo para probar en local: en producción la
 * variable no está definida y todo queda como siempre.
 *
 * `DEV_UNLIMITED_ROLLS=1` deja tirar los dados cualquier día, a cualquier hora y
 * las veces que quieras: cada tirada nueva reemplaza la tuya de hoy.
 */
export const devUnlimitedRolls = () => process.env.DEV_UNLIMITED_ROLLS === "1";
