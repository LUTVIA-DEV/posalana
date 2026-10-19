# Diseño de POSALANA

POSALANA sigue las reglas mínimas de la marca de [LUTVIA-DEV/lutvia-ds](https://github.com/LUTVIA-DEV/lutvia-ds) (v2.0.0). El CSS del sistema está copiado en `src/styles/lutvia/` (el repo es privado y el build no puede descargarlo como dependencia); para actualizar, se copia `css/lutvia.css` y `css/tailwind.css` del tag nuevo. Todo lo demás lo decide el proyecto y queda documentado acá. Las piezas propias tienen ficha en [`componentes/`](componentes/).

## Lo que viene del sistema

- **Colores:** los seis de la marca y el blanco, más sus tintas y opacidades. `src/styles/global.css` importa `./lutvia/tailwind.css` y define los nombres de siempre sobre los tokens: `primary` → `lutvia-rosa`, `secondary` → `lutvia-cyan`, `accent` → `lutvia-violeta`, `background` → `lutvia-gris` y `foreground` → `lutvia-oscuro`. No se agregan colores fuera de la paleta. Fuera del CSS (favicon y embeds de Discord), los colores se leen de los tokens con `src/utils/tokens.ts`.
- **Tipografía:** Montserrat, de 400 a 900, también en horas y fechas, con `tabular-nums` (nada de `font-mono`).
- **Accesibilidad mínima:** todo se usa con teclado y con foco visible. Con `prefers-reduced-motion: reduce`, `global.css` apaga animaciones y transiciones.

## Decisiones de POSALANA

| Qué | Cómo |
|---|---|
| Radios | `rounded-chico` (10px) en filas, campos, botones y bloques chicos; `rounded-bloque` (14px) en contenedores; `rounded-pildora` en acciones, etiquetas y círculos; `rounded-3xl` (24px) en las tarjetas. Se definen en el `@theme` de `global.css` |
| Wordmark | POSALANA por sílabas (PO rosa, SA cyan, LA violeta, NA oscuro) en la cabecera, y gigante y translúcido en el pie |
| Tarjetas | Blancas, de 24px, con sombra, sobre la página gris |
| Sombras | De Tailwind (`shadow-sm` a `shadow-2xl`) y de color (cyan, rosa o violeta del 10 al 50 %), incluido el brillo cyan del botón de tirar |
| Matices | Opacidades de los colores (del 2 al 25 %) en fondos, bordes y degradés: filas del ranking, escalones del podio, chips, avatares, bloques y celdas |
| Desenfoques y velos | Círculos de color desenfocados en tarjetas, pie y diálogos; `backdrop-blur` en la cabecera, el tooltip y los velos. Velos blancos (50–80 %), oscuros (40–90 %) y grises (80 %) |
| Texto chico | De 7 a 10 px en etiquetas, chips, cabeceras de tabla, íconos chicos y ayudas de formulario |
| Animaciones | Entrada, giro y sacudida de dados, flotación, pulso, rebote, brillo que cruza el botón de tirar, giro del logo, confetti y lluvia de lomitos |
| Hovers | Tarjetas y botones suben de 2 a 5 px; dados, avatares, íconos y fotos crecen del 5 al 10 % o giran; el logo gira por sílabas |
| Botones | Cyan con relleno para las acciones (tirar, entrar, guardar, publicar, la burbuja del veredicto); el de tirar es el único grande y con brillo |
| Foco de campos | Anillo cyan o violeta al 30–50 % |
| Emojis | Uno por tarea (🍽️ 🗑️ 🧽 🎉; en la portada, 🍴 y 🧹 para Pone y Saca), 🥪 y 🍟 para Lomito, y los de los avisos (⏰ 🎲 😢 ✅ ❌ ⚠️) |
| Caracteres como íconos | «?» en el puesto vacante del podio, «•» como separador y «∞» en el contador de Lomito |

## Excepciones de contraste

La regla de contraste del sistema (WCAG AA: 4.5:1 en texto normal y 3:1 en texto grande e indicadores) rige en todo POSALANA, salvo estos usos, que son parte de la identidad del juego y quedan como **excepción propia del proyecto** (decisión del 2026-10-14). Una pieza nueva no suma excepciones: usa estas mismas o cumple la regla.

| Uso | Contraste | Condición |
|---|---|---|
| Texto en colores vivos sobre blanco: eyebrows, enlaces, nombre de la tarea, totales, palabras destacadas, chip de Lomito, badge de Admin, títulos y textos de Lomito | Cyan 2.00 · violeta 3.04 · rosa 4.22 | Siempre un color de la paleta; el texto largo de lectura va en `foreground` |
| Texto gris (`background`) sobre relleno cyan, rosa o violeta: botones (incluido «Tirar los dados»), etiquetas de tarea, círculo de la fecha, burbuja del veredicto | 1.71 · 2.60 · 3.61 | Solo en botones, etiquetas e íconos de una línea |
| Texto e íconos en gris oscuro por opacidad (`foreground/20` a `/60`): texto secundario, ayudas, dados que no deciden, íconos de los campos | 1.43 a 3.45 (`/70` ya da 4.51) | El texto corrido de lectura va en `/60` o más |
| Dado que decide en cyan sobre blanco (te salvás, Saca o sin estado) | 2.00 | El valor y la tarea también se ven en el resto de la fila |
