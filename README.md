# 🎲 POSALANA

**PO**ne, **SA**ca, **LA**va, **NA**da. 
La forma definitiva, justa y basada puramente en el azar para dividir las tareas de la casa después de comer.

![Astro](https://img.shields.io/badge/Astro-0C1120?style=for-the-badge&logo=astro&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)

---

## 🌟 Características Principales

*   **Autenticación Integrada:** Registro e inicio de sesión seguro usando [Lucia Auth](https://lucia-auth.com/).
*   **Tirada Diaria Única y con Horario:** Se juega martes, miércoles y jueves (el admin puede habilitar una tirada especial otro día). Cada usuario solo puede tirar los dados una vez por día y solo dentro del horario oficial (por defecto de **10:00 a 12:30**, configurable desde el panel admin). El sistema bloquea intentos múltiples y fuera de hora.
*   **⏰ Veredicto Automático:** Al cierre de la tirada (12:30) el veredicto final se publica solo en Discord, sin que nadie tenga que apretar nada. Los días en que nadie tiró no se manda ningún mensaje.
*   **Ranking Automático:** Calcula matemáticamente quién saca el número más bajo y asigna automáticamente la peor tarea (Lava), la intermedia (Saca) y la más leve (Pone).
*   **🥪 Cláusula Lomito:** Si dos personas sacan **exactamente los mismos dados en el mismo orden** en el mismo día, se activa el cartel festivo de *Lomito* y el contador de "Días sin Lomito" se reinicia a cero.
*   **Historial con Paginación Semanal:** Muestra las tiradas agrupadas por semana calendario (lunes a domingo) con navegación interactiva fluida (client-side) que previene recargas completas, mantiene el scroll y actualiza la URL y el historial del navegador automáticamente.
*   **Estadísticas y Ordenamiento Interactivo:** Muestra las estadísticas de la temporada actual, anterior y global del año usando el componente `StatsTable`. La tabla del año permite ordenar filas interactivamente por cualquier columna (Jugador, PO, SA, LA, Total).
*   **Temporadas Anteriores:** La tarjeta "Temporadas Anteriores" del historial tiene un selector con todas las temporadas cerradas (por defecto la más reciente) para ver sus resultados finales y sus exenciones sin recargar la página.
*   **Exenciones de Tarea Automáticas:** Las personas con más puntos en una tarea durante la temporada anterior quedan automáticamente eximidas de realizarla en la temporada actual, con soporte para empates, anulaciones manuales y base cases seguros contra loops infinitos.
*   **Panel de Administración (Admin Dashboard):** Permite configurar variables, promover administradores, eliminar cuentas, anular tiradas accidentales, cargar puntos manuales históricos y gestionar exenciones (crear/borrar).
*   **Gestión Rápida de Avatares:** El administrador puede cambiar o eliminar las fotos de perfil de todos los usuarios directamente haciendo clic sobre su avatar en el padrón, comprimiendo la imagen en el navegador antes de subirla.
*   **🔄 Actualización en Tiempo Real:** El ranking de la página de inicio se actualiza automáticamente cada 8 segundos sin necesidad de refrescar la página. Utiliza la *Page Visibility API* para pausar automáticamente las consultas al servidor si el usuario cambia de pestaña, minimizando las consultas a la base.
*   **👾 Notificaciones de Discord:** Integración automática mediante Webhooks de Discord que notifica al instante cada tirada de dados realizada. El veredicto oficial sale automáticamente al cierre de la tirada y, además, el administrador tiene una burbuja flotante visible en todas las páginas para publicarlo o reenviarlo a mano de tareas del día (que incluye la cantidad de jugadores que tiraron).

## 🛠️ Tecnologías Utilizadas

*   **Framework:** [Astro](https://astro.build/) con SSR, sobre el adaptador de Node (modo standalone).
*   **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) con el sistema de diseño de Lutvia ([LUTVIA-DEV/lutvia-ds](https://github.com/LUTVIA-DEV/lutvia-ds) v2.0.0, copiado en `src/styles/lutvia/`). Las decisiones de diseño están en [`docs/diseno.md`](docs/diseno.md) y las piezas propias del juego en [`docs/componentes/`](docs/componentes/).
*   **Base de Datos:** SQLite en un archivo local, a través de `@libsql/client`.
*   **Despliegue:** VPS propio con Coolify y Docker (`Dockerfile` en la raíz).

---

## 🤖 Para Agentes de IA y LLMs

Si sos una IA asignada a este proyecto, leé inmediatamente el archivo [`AI_CONTEXT.md`](AI_CONTEXT.md) en la raíz del proyecto. Contiene reglas arquitectónicas críticas y lógica de negocio (como la Cláusula Lomito). 
**Importante:** Cualquier cambio estructural o de lógica del juego debe quedar reflejado actualizando el `README.md` y el `AI_CONTEXT.md`.

---

## 🚀 Correr el Proyecto Localmente

Si querés descargar el código y probarlo en tu compu, seguí estos pasos:

1. **Clonar el repositorio y entrar a la carpeta:**
   ```bash
   git clone https://github.com/tu-usuario/posalana.git
   cd posalana
   ```

2. **Instalar las dependencias:**
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno:**
   Creá un archivo `.env` en la raíz del proyecto. Si querés usar una base de datos local SQLite para probar, podés dejarlo así:
   ```env
   DATABASE_URL="file:sqlite.db"
   ```

4. **Levantar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

La aplicación va a estar disponible en `http://localhost:4321`. La base de datos `sqlite.db` se va a crear automáticamente cuando la página intente hacer la primera consulta.

---

## ☁️ Despliegue en Producción (VPS con Coolify)

POSALANA corre en el VPS del foro de Lutvia, con [Coolify](https://coolify.io/), en **https://posalana.lutvia.com** desde el 19/10/2026. La dirección anterior redirige sola al dominio nuevo.

- **Cómo se construye:** Coolify toma el repo `LUTVIA-DEV/posalana` (rama `main`) y construye el `Dockerfile`: Astro con el adaptador de Node en modo standalone, en el puerto 4321.
- **Base de datos:** un archivo SQLite en `/data/posalana.db`, dentro de un volumen persistente de Docker. No hace falta ningún servicio aparte.
- **Variables de entorno** (en Coolify → POSALANA → posalana → Environment Variables):
  - `SITE_URL`: `https://posalana.lutvia.com`, para los enlaces y el avatar del bot en Discord.
  - `DISCORD_WEBHOOK_URL`: el webhook del canal de Discord.
  - `CRON_SECRET`: un texto secreto que protege `/api/cron/verdict`.
  - `DATABASE_URL` ya viene en el `Dockerfile` (`file:/data/posalana.db`).
- **Veredicto automático:** sale solo a la hora del cierre: el servidor lo revisa cada minuto. Una tarea programada de Coolify llama además a `/api/cron/verdict` a las 16:00 UTC (13:00 de Argentina), como respaldo.
- **Pendientes de la mudanza y del proyecto:** en [`docs/pendientes.md`](docs/pendientes.md).

## 📜 Reglas del Juego

Las reglas oficiales de POSALANA están publicadas dentro de la misma aplicación, actualizadas por última vez el **13 de Octubre de 2026**. Podés consultarlas en la pestaña "Reglas" en el menú principal de navegación.

---
*Hecho con ❤️ y algo de suerte en los dados.*
