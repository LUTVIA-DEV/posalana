# Trailer de POSALANA

Trailer animado de 44 s (1920×1080, 30 fps) hecho con [HyperFrames](https://hyperframes.heygen.com): HTML y GSAP que se renderizan a MP4. Guion B «PO · SA · LA · NA»: las sílabas a pantalla completa explican el juego cortadas al ritmo de la música. Los guiones descartados están en `STORYLINES.md` y la ficha técnica en `SPEC.md`.

## Cómo se usa

```bash
cd trailer
npx hyperframes preview      # Studio en el navegador, para ver y editar
npx hyperframes check        # chequeo de la composición
npx hyperframes render -q delivery -o renders/posalana-trailer.mp4
```

Los renders quedan en `trailer/renders/` y no se suben al repo (`.gitignore`).

## Estructura

- `index.html`: la composición raíz; monta las nueve escenas y el audio.
- `compositions/`: una escena por archivo (`hook`, `jugadores`, `horario`, `tirada`, `reparto`, `lomito`, `temporada`, `veredicto`, `cierre`).
- `assets/`: el avatar del bot (copia de `public/bot-avatar.png`), la música y los efectos.

## Reglas

- Solo la paleta de lutvia-ds (`src/styles/lutvia/lutvia.css`) y Montserrat.
- Jugadores inventados (Tano, Rulo, Mica y Juli): nada de nombres reales ni datos de producción.

## Créditos de audio

- **Música:** tema funk-pop de 120 bpm del catálogo de música de HeyGen, estirado a 44 s (`assets/audio/musica.m4a`).
- **Dados** (`assets/audio/dados.mp3`): «Dice C.m4a» de Phorgador, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Fuente: https://freesound.org/people/Phorgador/sounds/678198
- **Pop** (`assets/audio/pop.mp3`): «Pop, High, A (H1).wav» de InspectorJ, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Fuente: https://freesound.org/people/InspectorJ/sounds/411642
- **Golpe y whoosh** (`golpe.mp3`, `whoosh.mp3`): de la biblioteca de efectos incluida en HyperFrames.

Los dos efectos CC BY piden crédito donde se publique el video (por ejemplo, en la descripción).
