# SPEC — Trailer POSALANA (guion B «PO · SA · LA · NA»)

GOAL:    que un compañero de trabajo que nunca jugó entienda en 45 s cómo se reparten Lava, Saca y Pone, se ría con el Lomito y quiera entrar a posalana.lutvia.com.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    44 s x 30 = 1320 frames. Grilla de 120 bpm: 1 tiempo = 0,5 s = 15 frames; 1 compás = 2 s. Se ajusta al tempo real de la música elegida.
LOOK:    campos de color plenos de lutvia-ds, nada fuera de la paleta:
         rosa #ea2a58 (PO), cyan #00cccc (SA), violeta #cc66ff (LA), oscuro #3c3c3b (NA), amarillo #ffcc00 (Lomito), gris #ededed (piso), blanco #ffffff (tarjetas y dados).
         Texto: blanco sobre rosa, violeta y oscuro; oscuro sobre cyan, amarillo, gris y blanco.
         Montserrat 900 para las sílabas (420–560 px, tracking −4 %) y titulares (96–140 px, −2 %); 700 para bajadas (44–64 px); cifras con tabular-nums.
         Tarjetas blancas de 24 px de radio con sombra 0 18px 40px rgba(60,60,59,.16), como en la app. Sin grano ni viñeta: es una app plana.
OBJECTS: dados blancos de radio 22 % con puntos oscuros (el dado que decide toma el color de la tarea, como en la app);
         avatares circulares con la inicial del jugador; fila del ranking; reloj en cifras; mensaje del bot con public/bot-avatar.png; wordmark por sílabas.
         Jugadores inventados: Tano, Rulo, Mica, Juli.
MOTION:  entradas: power4.out 8–10 frames; golpes en el tiempo: tl.set (0 frames) más un rebote back.out(2.2) de 8 frames en escala 1.12→1;
         movimientos: power3.inOut 15 frames; dados rodando: cara nueva cada 2 frames y sacudida de ±14° durante 1,5–2 s.
SHOTS:
  1. 0–4 s · Hook: PO / SA / LA / NA a pantalla completa, una por tiempo; en el compás 2 las cuatro sílabas se juntan en el wordmark sobre gris con «Pone · Saca · Lava · Nada».
  2. 4–8 s · Los jugadores: cuatro avatares caen uno por tiempo con su nombre; «4 compañeros» pasa a «4 dados · 1 tiro por día» y cada uno recibe sus cuatro dados.
  3. 8–12 s · Horario: campo cyan; LUN–VIE en fichas, se encienden MAR MIÉ JUE; «10:00 a 12:30» en cifras gigantes.
  4. 12–17 s · La tirada: tarjeta blanca con cuatro filas; los dados ruedan y caen; las filas se reordenan de menor a mayor. «Gana el que saca más… pierde el más bajo».
  5. 17–25 s · El reparto: cuatro campos de 2 s, cada uno entra con un barrido en el tiempo fuerte: LA violeta (Juli lava 🧽), SA cyan (Tano saca 🗑️), PO rosa (Mica pone 🍽️), NA oscuro (Rulo se salva 🎉).
  6. 25–30,5 s · Lomito: «¿Y si dos sacan lo mismo?»; dos filas idénticas 3·3·5·2 chocan; corte a campo amarillo «CLÁUSULA LOMITO 🥪» con lluvia de lomitos y «Días sin Lomito» a 0.
  7. 30,5–35 s · Temporada: barras de «Lavó» por jugador; Juli junta más y recibe «🛡️ Exento»: no lava la temporada siguiente.
  8. 35–39,5 s · Veredicto: el reloj pasa de 12:29 a 12:30 y entra el mensaje del bot con las cuatro tareas, una línea por tiempo.
  9. 39,5–44 s · Cierre: el wordmark golpea por sílabas, «Que decidan los dados» y posalana.lutvia.com; se sostiene 2,5 s.
SOUND:   tema rítmico y enérgico (~120 bpm) que manda; pocos efectos: dados rodando en 4 y 6, un golpe en el Lomito.
BANNED:  fondo oscuro con cosas flotando, brillos, partículas decorativas, degradés, vidrio, todo centrado y apareciendo a la vez, texto que se mueve mientras se lee, logo chico en una esquina, tres tarjetas en fila, colores fuera de lutvia-ds, nombres reales o datos de producción.
QA:      0 s (PO a pantalla completa), 3 s (wordmark), 14,5 s (dados cayendo), 16,5 s (orden), 18 s (LA), 24 s (NA), 28 s (Lomito), 34 s (exento), 38 s (veredicto), 43 s (cierre).
