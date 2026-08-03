# Luz Verde, Luz Roja

PWA infantil de "Luz Verde, Luz Roja" para iPad. El iPad se coloca en un soporte
estable, usa su cámara trasera para seguir a **un solo** jugador y el niño avanza
**caminando despacio** hacia él. En luz roja hay que quedarse como estatua.

Todo el procesamiento ocurre en el dispositivo: no hay backend, no se graba
video y no se envía ninguna imagen a ningún servidor.

- **Detección de pose:** MediaPipe Pose Landmarker (modelo `lite`), servido
  desde el propio origen.
- **Stack:** React 19 + TypeScript + Vite 8 + `vite-plugin-pwa`. Zustand solo
  para los ajustes.
- **Idioma:** todo en español. La voz usa `SpeechSynthesis` del dispositivo, sin
  TTS remoto.

---

## Instalación y ejecución

Requiere Node 22 o superior.

```bash
npm install
npm run dev          # http://localhost:5173
```

Otros comandos:

| Comando                  | Qué hace                                                |
| ------------------------ | ------------------------------------------------------- |
| `npm run dev`            | Servidor de desarrollo                                  |
| `npm run dev:host`       | Igual, accesible desde otros equipos de la red          |
| `npm run build`          | Typecheck + build de producción en `dist/`              |
| `npm run preview`        | Sirve `dist/` como en producción                        |
| `npm test`               | Pruebas unitarias (Vitest)                              |
| `npm run test:e2e`       | Pruebas de flujo (Playwright, cámara y pose simuladas)  |
| `npm run typecheck`      | Solo TypeScript                                         |
| `npm run verify:offline` | Comprueba que el juego arranca sin conexión             |

---

## Probar desde un iPad en la misma red local

La cámara requiere un **contexto seguro**: `https://` o `localhost`. Un
`http://192.168.x.x` **no** sirve: Safari no pedirá permiso de cámara. Hay dos
caminos.

### Opción A — túnel HTTPS (la más rápida)

```bash
npm run dev
# en otra terminal
npx localtunnel --port 5173      # o: cloudflared tunnel --url http://localhost:5173
```

Abre en Safari, en el iPad, la URL `https://…` que imprime el túnel.

### Opción B — HTTPS local con certificado propio

```bash
brew install mkcert && mkcert -install
mkcert 192.168.1.50               # pon aquí la IP de tu Mac
npm i -D @vitejs/plugin-basic-ssl  # o pasa los certificados a server.https
```

Después instala el certificado raíz de mkcert en el iPad (Ajustes → General →
VPN y gestión de dispositivos, y actívalo en Ajustes → General → Información →
Ajustes de confianza en certificados).

### Colocación física

1. iPad **horizontal**, en un soporte estable, a la altura del pecho del niño.
2. Deja **3–5 metros** libres delante.
3. El niño empieza al fondo, con el cuerpo completo dentro del encuadre.
4. Luz uniforme; evita una ventana con sol justo detrás del niño.

---

## Instalar la PWA en el iPad

1. Abre el juego en **Safari** (Chrome en iOS no puede instalar PWAs).
2. Toca **Compartir** → **Añadir a pantalla de inicio**.
3. Ábrelo desde el icono nuevo: arranca a pantalla completa.

La primera carga necesita internet para descargar el runtime wasm (~12 MB) y el
modelo de pose (~5,8 MB). El service worker los guarda en caché y a partir de
entonces el juego funciona **sin conexión**. La app incluye estas instrucciones
en el botón "📲 Instalar" de la pantalla de inicio.

> Safari no permite bloquear la orientación desde la web. Si el iPad se gira a
> vertical, el juego se pausa y pide volver a horizontal.

---

## Ajustar el umbral de movimiento

El puntaje de movimiento es **relativo al tamaño del cuerpo en pantalla**, no a
píxeles, así que la sensibilidad no cambia cuando el niño se acerca al iPad.

```text
bodyScale = distancia promedio hombro–cadera
puntaje   = suma ponderada( |landmark_actual − landmark_referencia| / bodyScale )
```

Se pondera más el centro del torso, las caderas y las rodillas; menos los
hombros; y se **ignoran** manos, muñecas, pies y cabeza. `0` = inmóvil, `1` = se
movió el equivalente a un torso entero.

Para restar un corazón hacen falta **todas** estas condiciones a la vez:

1. la mediana de los últimos 5 puntajes supera el umbral,
2. eso ocurre en 3 análisis consecutivos (4 en sensibilidad baja),
3. la confianza de la pose supera `MIN_PENALTY_CONFIDENCE`,
4. el jugador seleccionado sigue visible.

Y una fase roja **nunca** puede quitar más de un corazón.

### Desde la app

Ajustes → Sensibilidad: **Baja** (0,16), **Normal** (0,10), **Alta** (0,06).
Números más bajos = más estricto.

### Desde el código

Todo vive en [`src/game/gameConfig.ts`](src/game/gameConfig.ts):

| Constante                     | Efecto al subirlo                            |
| ----------------------------- | -------------------------------------------- |
| `MOVEMENT_THRESHOLD`          | Más permisivo (perdona más movimiento)       |
| `MOVEMENT_CONSECUTIVE_FRAMES` | Más lento en reaccionar, menos falsos avisos |
| `MOVEMENT_HISTORY_SIZE`       | Más suavizado, más retraso                   |
| `RED_GRACE_MS`                | Más tiempo para frenar al entrar en rojo     |
| `MIN_PENALTY_CONFIDENCE`      | Exige ver mejor al jugador para penalizar    |
| `PLAYER_MATCH_THRESHOLD`      | Más exigente al reconocer al mismo jugador   |

**Cómo calibrar en la práctica:** abre el juego con `?debug=true`, entra en luz
roja y observa la línea `movimiento`. Pide al niño que se quede quieto y anota la
mediana (es su ruido de fondo, normalmente 0,02–0,05). Luego pídele que dé un
paso y mira el pico. Pon el umbral entre esos dos valores.

---

## Modo desarrollador

Añade `?debug=true` a la URL. Muestra estado de la máquina, corazones, tiempo,
FPS de cámara, FPS y milisegundos de inferencia, frames descartados, puntaje de
movimiento y su mediana, umbral, análisis consecutivos, confianza de pose,
similitud con el jugador seguido, número de poses en el frame, y los landmarks
dibujados sobre la cámara.

La temperatura **no** aparece: iPadOS no la expone al navegador y no queremos
inventarla.

---

## Arquitectura

```text
src/
  app/App.tsx              elige la pantalla según la fase; monta la cámara UNA vez
  game/
    gameMachine.ts         máquina de estados pura: (estado, evento) -> (estado, efectos)
    gameTypes.ts           tipos compartidos, sin DOM
    gameConfig.ts          todas las constantes ajustables
    movementScoring.ts     puntaje normalizado + MovementTracker
    playerTracking.ts      identidad del jugador por geometría (sin rostro)
    calibration.ts         requisitos para poder empezar
    settingsStore.ts       ajustes del adulto (localStorage)
  camera/
    CameraController.ts    getUserMedia, cámara trasera, 640x480
    PoseDetector.ts        MediaPipe Pose Landmarker local
    frameScheduler.ts      un frame a la vez, descarta atrasados, auto-throttle
    testHarness.ts         costura para pruebas E2E (?e2e=1)
  audio/
    audioManifest.ts       catálogo de señales
    AudioEngine.ts         tonos con Web Audio + voz con SpeechSynthesis
  hooks/
    useGameEngine.ts       orquestador: conecta cámara, pose, audio y máquina
    useOrientation.ts      horizontal / vertical
    useWakeLock.ts         mantiene la pantalla encendida
    useDocumentVisible.ts  primer plano / segundo plano
  components/              una pantalla por fase + HUD + overlays
```

La regla de oro: **toda la lógica de decisión es pura** y vive en `src/game/`.
`useGameEngine` solo conecta cables y ejecuta los efectos que la máquina pide
(`SAY`, `CAPTURE_REFERENCE_POSE`, `SET_INFERENCE_FPS`, …). Por eso el juego
completo se puede probar sin cámara.

Un detalle que no es accidental: el elemento `<video>` vive en **un solo lugar**
del árbol (`CameraStage`) y solo cambia de tamaño con CSS. Si cambiara de padre,
React lo remontaría y Safari perdería el stream.

### Máquina de estados

```text
IDLE → REQUESTING_CAMERA → CALIBRATING → LOCKING_PLAYER → COUNTDOWN
     → GREEN → RED_GRACE_PERIOD → RED_DETECTION → GREEN …
                                        ├→ MOVEMENT_WARNING → GREEN
                                        └→ FINISHED

En cualquier momento: PLAYER_LOST, PAUSED, CAMERA_ERROR,
                      PERMISSION_DENIED, UNSUPPORTED_DEVICE
```

### Rendimiento y calor

- Cámara 640×480 a 30 FPS; la inferencia siempre va **por debajo**.
- Inferencia: 12 FPS calibrando, **4 FPS en luz verde**, 11 FPS en luz roja,
  0 fuera de partida.
- Un solo frame en proceso a la vez; los que llegan mientras tanto se
  **descartan**, nunca se encolan.
- Sin segmentación, sin manos, sin rostro, sin grabación.
- Los landmarks solo se dibujan en calibración o con `?debug=true`.
- Vista de cámara oculta durante la partida (configurable).
- Si la inferencia tarda de forma sostenida más de 120 ms, la frecuencia baja
  sola a 2/3.

---

## Pruebas

```bash
npm test          # 64 pruebas unitarias
npm run test:e2e  # 10 pruebas de flujo
```

**Unitarias** (`src/**/*.test.ts`): transiciones de la máquina, pérdida de
corazones, máximo un corazón por fase roja, periodo de gracia, puntaje
normalizado (incluida la prueba de que el mismo movimiento puntúa igual de lejos
que de cerca), filtrado de ruido, brazos ignorados, pérdida y recuperación del
jugador, un adulto entrando al fondo, y requisitos de calibración.

**De flujo** (`tests/`): partida completa, cuenta regresiva 5→1, penalización en
luz roja, un solo corazón por fase roja, jugador perdido y recuperado, app en
segundo plano, botón detener, aviso de dos personas y ajustes. Usan `?e2e=1` +
`window.__LVLR_E2E__` para inyectar poses sintéticas (ver `tests/harness.ts`),
así que no necesitan cámara ni descargar el modelo. `tests/screens.spec.ts`
además guarda una captura de cada pantalla en `test-results/screens/`.

**Sin conexión:**

```bash
npm run build
npm run preview -- --port 4188
npm run verify:offline http://127.0.0.1:4188/
```

Ese script arranca Chromium con cámara falsa, juega una vez con red, luego corta
la red y comprueba que el juego vuelve a arrancar y a detectar poses.

### Pruebas manuales pendientes (necesitan un niño y un iPad de verdad)

Niño quieto en rojo · niño caminando en verde · niño que sigue caminando al
empezar el rojo · movimiento pequeño de brazos · balanceo natural · adulto que
entra al fondo · adulto que cruza delante · jugador que sale parcialmente del
cuadro · mala iluminación · iPad cerca y lejos · sesión de diez minutos seguidos
(calor) · app añadida a la pantalla de inicio.

---

## Despliegue en GitHub Pages

`.github/workflows/deploy.yml` corre typecheck + unitarias + E2E y, si todo pasa,
publica `dist/` en Pages con `BASE_PATH=/<nombre-del-repo>/`.

Para activarlo una sola vez: **Settings → Pages → Source: GitHub Actions**.

Para desplegar en otra ruta:

```bash
BASE_PATH=/mi-ruta/ npm run build
```

---

## Decisiones tomadas

- **Un jugador**, seguido por geometría (proporciones, tamaño y proximidad).
  Nunca por rostro ni biometría, y la identidad no sobrevive a la partida.
- **Audio sintetizado** en vez de archivos: tonos con Web Audio y voz con el
  `SpeechSynthesis` del dispositivo. Así no hay dependencia de un TTS remoto ni
  binarios que descargar. Si quieres locuciones grabadas, pon los archivos en
  `public/audio/` y rellena `file` en `src/audio/audioManifest.ts`.
- **Modelo y wasm servidos desde el propio origen** (`public/`), no desde un CDN,
  para que el service worker los pueda cachear y el juego funcione sin conexión.
  Cuesta ~18 MB en el repositorio.
- El modelo y el wasm **no se precachean**: se guardan la primera vez que se
  usan, para que la primera carga no descargue 18 MB de golpe.
- **Nunca hay pantalla de derrota.** Sin corazones, el mensaje es "Probemos otra
  vez caminando más despacio". No se usa "eliminado", "perdiste", "disparo" ni
  nada parecido.
- Al reanudar tras perder al jugador o volver del segundo plano, siempre se entra
  con una **luz verde nueva**: es lo más justo y evita continuar una luz roja a
  medias.

---

## Limitaciones conocidas

1. **La cámara exige HTTPS.** En `http://` por IP local, Safari no pide permiso.
   Usa un túnel o mkcert (arriba).
2. **No se puede bloquear la orientación** desde Safari. El juego detecta el giro
   y pausa, pero no lo impide.
3. **`Screen Wake Lock` no está en todas las versiones de Safari.** Si falta, la
   pantalla puede apagarse en partidas largas; sube el tiempo de bloqueo del iPad
   en Ajustes.
4. **Sin medición real de distancia.** El "avance" se infiere del tamaño del
   cuerpo en pantalla. Por eso la llegada la confirma el adulto con "Llegó".
5. **La identidad del jugador es geométrica.** Dos personas de talla parecida,
   muy juntas y a la misma distancia, pueden confundirse. Cuando la coincidencia
   no es suficientemente clara, el juego pausa en vez de adoptar a otra persona.
6. **La voz depende del iPad.** Si no hay voz en español instalada se usa la que
   haya; los tonos siempre suenan.
7. **Ropa muy holgada, poca luz o contraluz** degradan la detección de pose.
   Aparece "No te veo bien" en la calibración.
8. **El modelo `lite` es el menos preciso** de los tres de MediaPipe. Se eligió a
   propósito, por temperatura y batería.
9. **Los tiempos son de reloj de pared.** Si iPadOS congela la pestaña, la
   partida se pausa al volver, pero no compensa el tiempo perdido.
10. **Sin multijugador, sin backend, sin puntuaciones guardadas.** Fuera del
    alcance de esta versión.
