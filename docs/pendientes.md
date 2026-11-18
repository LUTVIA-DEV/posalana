# Pendientes

Lo que quedó abierto después de la mudanza al VPS (19/10/2026). Cuando algo se resuelve, se borra de acá.

Por ahora no hay decisiones pendientes.

## Para tener en cuenta

- **Respaldo de la base:** el script `/opt/backup-vps.sh` del VPS corre todos los días a las 03:00 y sube una copia comprimida de la base a Dropbox (`db/posalana-<fecha>.db.gz`).
- **Infraestructura vieja dada de baja (18/11/2026):** se borraron la base de Turso, el proyecto `posalana` de Vercel y las cuentas de los dos servicios. `posalana.vercel.app` ya no redirige a `posalana.lutvia.com` (da 404), así que los links viejos, por ejemplo en mensajes de Discord, dejaron de funcionar. No quedó un volcado final de Turso; la copia de referencia es la del VPS.
- **Sistema de diseño:** el CSS de `lutvia-ds` está copiado en `src/styles/lutvia/` (v2.0.0). Cuando salga una versión nueva, se copian `css/lutvia.css` y `css/tailwind.css` del tag nuevo (ver `docs/diseno.md`).
- **Tarea `veredicto-automatico` de Coolify** (16:00 UTC): quedó como respaldo del veredicto automático, que ahora sale solo al cierre. Se puede dejar.
