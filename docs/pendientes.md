# Pendientes

Lo que quedó abierto después de la mudanza al VPS (19/10/2026). Cuando algo se resuelve, se borra de acá.

## Decisiones

| Qué | Por qué importa | Cómo se resuelve |
|---|---|---|
| **Respaldo externo de la base** | La base vive en un solo archivo en el VPS (`/data/posalana.db`, volumen `cll3jybiz9exp4891rowd0r7-posalana-data`). Si se pierde el servidor, se pierden los datos. La única copia afuera es Turso, congelada al 19/10. El foro tiene el mismo pendiente | Una cuenta de Backblaze B2 o S3 (bucket y clave de solo escritura) y una tarea diaria de Coolify con `sqlite3 .backup` que suba la copia. Se puede compartir con el respaldo del foro |
| **Rol de `lomitotester` en producción** | En producción tiene rol `user`, así que no queda exceptuado del horario ni de los días de juego, aunque el panel dice «salvo lomitotester». En una base nueva el código lo crea con rol `tester` | Decidir si debe ser `tester`. Si sí: `UPDATE user SET role = 'tester' WHERE username = 'lomitotester'` en la base del VPS |
| **Contraseña de `lomitotester`** | `src/db/index.ts` crea la cuenta con la contraseña `lomitotester`, y el repo es público. Si la cuenta de producción tiene esa contraseña, cualquiera puede entrar como Lomito | Cambiarle la contraseña en producción desde `/reset`, y sacar la contraseña fija del código (por ejemplo, leerla de una variable de entorno) |

## Con fecha

| Cuándo | Qué |
|---|---|
| Después del **20/10/2026** | Borrar en Coolify la tarea `aviso-mudanza-20-10` y la variable `AVISO_DISCORD`. No vuelven a enviar nada (el comando controla la fecha), pero sobran |
| Después del **20/10/2026** | Borrar el archivo local `.env.turso`: tiene el token de Turso (vence a los 7 días) y el **webhook real de Discord** |
| Desde el **~18/11/2026**, con el respaldo externo andando | Borrar la base de Turso. En Vercel, borrar las variables `DATABASE_URL`, `DATABASE_AUTH_TOKEN` y `DISCORD_WEBHOOK_URL` del proyecto `posalana` |
| Cuando ya nadie use el link viejo | Decidir si se borra el proyecto de Vercel. Hoy solo sirve el redirect de `posalana.vercel.app` a `posalana.lutvia.com`; si se borra, los links viejos (por ejemplo, en mensajes de Discord) dejan de funcionar |

## Para tener en cuenta

- **Sistema de diseño:** el CSS de `lutvia-ds` está copiado en `src/styles/lutvia/` (v2.0.0). Cuando salga una versión nueva, se copian `css/lutvia.css` y `css/tailwind.css` del tag nuevo (ver `docs/diseno.md`).
- **Tarea `veredicto-automatico` de Coolify** (16:00 UTC): quedó como respaldo del veredicto automático, que ahora sale solo al cierre. Se puede dejar.
