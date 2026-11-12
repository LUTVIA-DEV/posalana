# Revisión del borrador (11/11/2026)

## Imagen
- `npx hyperframes check`: sin errores. Avisos que quedan: superposiciones de tweens sobre `.dado` en `tirada.html`, que el linter mide por selector y no por dado (cada dado tiene un solo giro y un solo rebote), y contraste de SA y LA del wordmark sobre gris, que es la marca tal como la usa la app (excepción de `docs/diseno.md`).
- Snapshots revisados en 0, 3, 7, 11, 16,5, 18,6, 24, 29,5, 34, 38,8, 40,6, 42,5 y 43 s. Arreglado en esta pasada: el reloj del veredicto se cortaba, la etiqueta de exención tapaba el número y el wordmark final rozaba los bordes.
- Defaults evitados: ningún fondo oscuro con cosas flotando, ni brillos, ni degradés. Cada escena entra distinto (caída, barrido, choque, tablero).

## Sonido (medido, no escuchado)
- Música a 120 bpm: los cortes caen en sus tiempos (beats en 0,015 + k·0,5 s).
- Loudness integrado −13,9 LUFS; true peak −1,5 dBTP; sin clipping.
- Los últimos 0,8 s quedan en silencio por el final del tema y el fade-out, con el cierre en pantalla.
