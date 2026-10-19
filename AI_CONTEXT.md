# 🤖 Contexto para Agentes de IA

Si sos un agente de Inteligencia Artificial (AI) leyendo este repositorio, este archivo contiene las **reglas de negocio y arquitectónicas fundamentales** de POSALANA. 
**CRÍTICO:** Si realizás cambios estructurales o modificás la lógica del juego, DEBÉS actualizar este archivo y el `README.md` para mantener la consistencia.

## 1. Lógica del Juego (Core Business Logic)
- **Tirada Diaria:** Los usuarios tiran 4 dados (d6) una vez por día en la ruta `/api/roll`.
- **Días de Juego (desde 19/10/2026):** Se juega **martes, miércoles y jueves** (`PLAY_DAYS` en `src/utils/schedule.ts`). Lunes, viernes, sábados y domingos `getRollWindowStatus` devuelve `no-play`: `/api/roll` responde 403, el inicio muestra «Hoy no se juega» con la próxima tirada (`getNextPlayDay`) y el veredicto automático no corre. El admin puede habilitar una **tirada especial** en una fecha (campo de `/admin`, clave `special_roll_date` en `settings`): ese día se juega con el horario normal. El usuario `tester` queda exceptuado.
- **Horario de Tirada (desde 13/10/2026):** Solo se puede tirar de **10:00 a 12:30** (GMT-3). Lo valida `/api/roll` (403 fuera de horario; el usuario `tester` queda exceptuado) y el inicio muestra el botón solo con la ventana abierta (el hero `#hero-container` también se refresca por polling). La lógica vive en `src/utils/schedule.ts`; el horario es configurable desde `/admin` (claves `roll_window_start` / `roll_window_end` en `settings`, con defaults en el código).
- **Veredicto Automático:** Al cierre de la tirada se publica solo el veredicto final en Discord (`maybeSendAutoVerdict`). Se dispara desde el middleware en la primera request posterior al cierre (el polling de 8s del inicio lo hace salir casi en el momento) y desde una tarea programada de Coolify a las 16:00 UTC (13:00 de Argentina) que llama a `/api/cron/verdict` con `CRON_SECRET`, como red de seguridad. Es idempotente: hace un "claim" atómico sobre `settings.auto_verdict_last_date` y guarda la hora de envío en `auto_verdict_last_at`; si Discord falla, libera el claim para reintentar. **Si ese día nadie tiró (ej. lunes, viernes y fines de semana, que no se juega) no se envía ningún mensaje**: queda registrado como `sin tiradas`. Se puede desactivar desde `/admin` (`auto_verdict_enabled`).
- **Aviso de Horario Nuevo:** `ScheduleNotice.astro` es un pop-up que se muestra en el inicio una vez por día (localStorage) hasta `SCHEDULE_NOTICE_UNTIL` (18/10/2026). Pasada esa fecha deja de montarse solo; se puede borrar junto con la constante.
- **Asignación de Tareas:** Se comparan los dados secuencialmente (primer dado, luego segundo, tercero y cuarto de menor a mayor). El que saca el tiro más bajo tiene la peor suerte y le toca la peor tarea (Lava - LA). El siguiente "Saca" (SA), el siguiente "Pone" (PO), y los demás se salvan ("Nada" o "NA" con emoji 🎉).
- **Cláusula Lomito:** Si dos usuarios sacan **exactamente los mismos 4 dados en el mismo orden**, se activa la "Cláusula Lomito". 
  - La UI debe mostrar el emoji de sanguche (`🥪`) en el Navbar y un banner festivo en el Index y en el Historial.
  - El contador de "Días sin Lomito" se reinicia.
  - El usuario especial `lomitotester` sirve exclusivamente para probar esta cláusula duplicando la tirada del administrador.
  - **Easter egg (no documentado en el README a propósito):** 7 clicks en menos de 3 segundos sobre el badge "días sin lomito" del Navbar (`[data-lomito-badge]`, desktop y mobile) desatan una lluvia de 🥪/🍟 a pantalla completa (Web Animations API, respeta `prefers-reduced-motion`).
- **Exenciones (Exemptions):** Quien tenga la mayor cantidad de puntos en una tarea en la temporada `S-1`, queda exento de ella durante toda la temporada `S`.
  - **Cálculo Automático:** Se resuelven dinámicamente comparando los puntajes de la temporada anterior. Si hay empates, todos los empatados se eximen.
  - **Caso Base de Parada Segura:** Si una temporada no tiene tiradas ni puntos cargados a mano, se considera inactiva (`[]`), deteniendo la recursividad histórica para prevenir bucles infinitos en Node.js.
  - **Sobrescritura Manual (Overrides):** Si hay registros en la tabla `exemption` para la temporada actual, se ignoran las automáticas y se aplican las manuales.

## 2. Arquitectura y Tecnologías
- **Frontend/Backend:** Astro con SSR activado. NO es un sitio estático puro.
- **Hosting (desde el 19/10/2026):** VPS del foro de Lutvia (Contabo) con Coolify, en `https://posalana.lutvia.com`. Astro corre con `@astrojs/node` en modo standalone, desde el `Dockerfile` (contenedor en UTC). El proyecto de Coolify es **POSALANA** (app `cll3jybiz9exp4891rowd0r7`), separado del foro. La dirección anterior redirige (308) al dominio nuevo.
- **Base de Datos:** SQLite en un archivo (`DATABASE_URL=file:/data/posalana.db`), en el volumen de Docker `cll3jybiz9exp4891rowd0r7-posalana-data`, en modo WAL y con índice por `roll(date)`. Se accede con `@libsql/client`. Antes estaba en Turso; `scripts/exportar-turso.mjs` es el que hizo la copia.
- **Autenticación:** Sistema propio basado en cookies en Astro, contraseñas hasheadas con `bcryptjs`.
- **Estilos:** Tailwind CSS (versión v4).
- **Componentes Compartidos:**
  - `StatsTable.astro`: Renderiza tablas de estadísticas unificadas (Temporada Actual, Anterior y Año) con parámetros opcionales de color (`theme`) e interactividad (`sortable`).
  - `VerdictFab.astro`: Burbuja flotante (estilo WhatsApp) que se monta en `Layout.astro` solo para usuarios `admin`. Abre un panel de confirmación y llama a `/api/admin/publish-verdict`. Sus eventos se delegan en `document` una única vez para sobrevivir a los swaps del `ClientRouter`.
- **Actualización en Tiempo Real (Short Polling):**
  - Implementado en `index.astro` mediante consultas periódicas cada 8 segundos al servidor.
  - **Ahorro de recursos (Page Visibility API):** Si la pestaña se minimiza o pasa a segundo plano, el polling se suspende automáticamente para evitar consultas innecesarias a la base. Al volver a enfocar la página, se reanuda inmediatamente.
  - **Reemplazo Atómico:** Compara e inyecta únicamente los nodos `#ranking-container` y `#lomito-container` usando `DOMParser` para evitar refrescar la página. Si se detecta un nuevo Lomito, dispara confetti automáticamente.
- **Notificaciones de Discord:**
  - Requiere configurar `DISCORD_WEBHOOK_URL` en las variables de entorno.
  - **Tirada Automática:** Llama asíncronamente a `sendDiscordRoll` en la API de tirada para publicar la tirada (en formato numérico) y un CTA al sitio.
  - **Veredicto:** La asignación final consolidada de tareas del día se arma en `src/utils/verdict.ts` (`publishDailyVerdict`), compartido entre el veredicto automático del cierre y el manual (`/api/admin/publish-verdict`).
 El mensaje destaca la cantidad de jugadores distintos que tiraron ese día. El bot usa `public/bot-avatar.png` como `avatar_url`.

## 3. UI y Estética (Mandatorio)
- **Sistema de diseño de Lutvia:** POSALANA sigue las reglas mínimas de [LUTVIA-DEV/lutvia-ds](https://github.com/LUTVIA-DEV/lutvia-ds) 2.0.0, con su CSS copiado en `src/styles/lutvia/` (el repo del DS es privado: no se instala como dependencia porque el build no puede descargarlo): colores, contraste, tipografía, logo y dos mínimos de accesibilidad. `src/styles/global.css` importa `./lutvia/tailwind.css` y define en su `@theme` `primary`/`secondary`/`accent`/`background`/`foreground` sobre los tokens `--lutvia-*`. **No se agregan colores fuera de la paleta** (nada de `emerald`, `red`, grises o hex nuevos; tintas y opacidades sí). Montserrat en todo, también en cifras (`tabular-nums`, nunca `font-mono`). Fuera del CSS, los colores salen de `src/utils/tokens.ts` (favicon en `src/pages/favicon.svg.ts` y embeds de Discord).
  - El resto del diseño lo decide POSALANA y está en `docs/diseno.md`: radios propios (`rounded-chico` 10px, `rounded-bloque` 14px, `rounded-pildora`; tarjetas en `rounded-3xl`), tarjetas con sombra, matices, desenfoques, animaciones y hovers. No se "corrige" para parecerse a otro producto.
  - Contraste WCAG AA en todo, salvo las **excepciones de contraste** de POSALANA listadas en `docs/diseno.md` (texto en colores vivos, texto gris sobre rellenos de color, grises por opacidad y dado cyan). No se agregan excepciones nuevas.
  - Con `prefers-reduced-motion`, `global.css` apaga animaciones y transiciones (mínimo del sistema). Todo se usa con teclado y foco visible.
  - Las piezas propias (dados, fila del ranking, banner de Lomito) tienen ficha en `docs/componentes/`.
- **Paginación del Historial:** Agrupado por semana calendario (lunes a domingo). Funciona del lado del cliente sin recargar el navegador (`window.history.pushState` y evento `popstate`), con fallback SSR clásico y ancla `#historial-seccion` para auto-scroll.
- **Selector de Temporadas Anteriores:** En `history.astro`, la tarjeta "Temporadas Anteriores" (al lado de "Temporada Actual", mismo diseño: título en una fila y temporada debajo) lista todas las temporadas cerradas con tiradas o puntos manuales (`getPastSeasonsWithData`), por defecto la más reciente. Cada temporada muestra su tabla y sus exenciones (`getExemptionsForSeason`). Todo se renderiza en SSR y un dropdown propio (listbox accesible con teclado, no `<select>` nativo) solo alterna cuál se ve (sin recargar).
- **Ordenamiento Interactivo:** La "Tabla Global del Año" permite ordenamiento en cliente al hacer clic en sus cabeceras, actualizando iconos de FontAwesome (`fa-sort`, `fa-sort-up`, `fa-sort-down`) en tiempo real.
- **Formato de Fechas:** Toda fecha visible se muestra como día, mes y año (`DD/MM/YYYY`) con `formatDate` de `src/utils/date.ts`. En la base, las URLs (`?week=`) y las comparaciones internas se siguen usando `YYYY-MM-DD`.
- **Página 404:** `src/pages/404.astro` muestra un "tiro inválido" 4 · 👻 · 4 (el dado del medio es un fantasma) con botón para volver al inicio y un "Tirar de nuevo" que solo re-anima los dados (cliente, sin requests).
- **Responsividad:** Mobile-first obligatorio. En móviles, los dados detallados (`DiceDisplay`) se ocultan inteligentemente en el timeline para mantener el ancho.

## 4. Modo Administrador
- El usuario inicial con rol de `admin` es `ldoliri`.
- Existe una ruta protegida `/admin` que permite:
  - Configurar variables globales (Último Lomito manual, horario de tirada y veredicto automático on/off, con el estado de la ventana y del veredicto de hoy).
  - Ver el registro de cambios de contraseña (tabla `password_reset_log`; el reset en `/reset` es libre, sin clave maestra).
  - Borrar usuarios, anular tiradas y cambiar roles.
  - Cargar puntos manualmente (temporadas pasadas).
  - **Gestión de Exenciones:** Crear (con soporte para temporadas personalizadas) y borrar exenciones manuales que sobrescriben las automáticas.
  - **Fotos de Perfil:** El administrador puede cambiar o eliminar (volviendo al avatar por defecto de Dicebear) las fotos de perfil de todos los usuarios directamente haciendo clic en su avatar en el padrón.
  - **Acción Rápida de Discord:** Permite disparar de forma manual (antes del cierre o como reenvío) la publicación del veredicto del día (quién lava, quién saca, quién pone) directamente al canal de Discord.
 Además está disponible desde cualquier página mediante la burbuja flotante `VerdictFab`.
---
**Nota para la IA:** No asumas lógicas estándar de e-commerce o blogs. Este es un juego cerrado entre amigos. Mantené el tono lúdico y respetá estrictamente las variables de los dados.
