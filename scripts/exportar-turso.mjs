// Copia la base de Turso a un archivo SQLite local, para la mudanza al VPS.
// Lee TURSO_URL y TURSO_TOKEN de .env.turso (alcanza con un token de solo lectura).
// Uso: node scripts/exportar-turso.mjs [destino.db]   (por defecto: posalana-export.db)
// No muestra las credenciales. Al final compara la cantidad de filas de cada tabla.
import { createClient } from "@libsql/client";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
    readFileSync(".env.turso", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
if (!env.TURSO_URL || !env.TURSO_TOKEN) {
    console.error("Faltan TURSO_URL o TURSO_TOKEN en .env.turso");
    process.exit(1);
}

const destino = resolve(process.argv[2] || "posalana-export.db");
if (existsSync(destino)) rmSync(destino);

const origen = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });
const local = createClient({ url: "file:" + destino });

// Tablas e índices tal como están en Turso (sin los internos de SQLite ni de libsql)
const esquema = await origen.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END"
);
const tablas = esquema.rows.filter((r) => r.type === "table").map((r) => String(r.name));
for (const r of esquema.rows.filter((r) => r.type === "table")) await local.execute(String(r.sql));

const resumen = [];
for (const tabla of tablas) {
    const filas = await origen.execute(`SELECT * FROM "${tabla}"`);
    const columnas = filas.columns;
    const lote = filas.rows.map((fila) => ({
        sql: `INSERT INTO "${tabla}" (${columnas.map((c) => `"${c}"`).join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
        args: columnas.map((c) => fila[c]),
    }));
    if (lote.length) await local.batch(lote, "write");
    const enLocal = (await local.execute(`SELECT COUNT(*) AS n FROM "${tabla}"`)).rows[0].n;
    resumen.push({ tabla, turso: filas.rows.length, local: Number(enLocal) });
}

// Índices después de los datos
for (const r of esquema.rows.filter((r) => r.type !== "table")) await local.execute(String(r.sql));

console.table(resumen);
const iguales = resumen.every((r) => r.turso === r.local);
console.log(iguales ? `OK: ${destino}` : "ATENCIÓN: hay tablas con distinta cantidad de filas");
process.exit(iguales ? 0 : 1);
