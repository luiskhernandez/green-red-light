# PRD: Luz Verde, Luz Roja

## 1. Resumen

Construir una Progressive Web App infantil inspirada en el juego “Luz Verde, Luz Roja”.

La aplicación se ejecutará inicialmente en un iPad colocado sobre un soporte estable. Usará la cámara trasera para detectar a un único jugador, normalmente un niño, y seguirá únicamente a esa persona durante toda la partida.

La primera versión estará diseñada exclusivamente para avanzar caminando lentamente. No debe incentivar correr.

La experiencia completa debe funcionar desde una sola pantalla y requerir la menor intervención posible de un adulto.

---

## 2. Objetivo del MVP

Validar que una aplicación web puede:

1. Detectar a un jugador frente a la cámara.
2. Seleccionarlo como jugador principal.
3. Ignorar a otras personas que entren en la imagen.
4. Detectar movimiento durante la luz roja.
5. Mostrar claramente los estados verde y rojo.
6. Ejecutar una partida corta y divertida.
7. Funcionar de manera razonable en Safari sobre iPad.
8. Evitar sobrecalentamiento excesivo reduciendo el procesamiento.

El MVP no necesita medir con precisión la distancia recorrida.

---

## 3. Experiencia deseada

El adulto abre la aplicación en el iPad.

La aplicación solicita permiso para usar la cámara.

Después muestra una pantalla de preparación que busca una persona frente a la cámara.

Cuando detecta un cuerpo completo, dibuja una silueta o un marco alrededor del jugador y muestra:

> Jugador encontrado

El jugador debe permanecer quieto durante aproximadamente dos segundos para confirmar la selección.

Una vez confirmado, la aplicación deja de buscar nuevas personas y sigue únicamente al jugador seleccionado.

Luego aparece una cuenta regresiva:

```text
5
4
3
2
1
```

Después comienza automáticamente la partida.

Durante la luz verde, el jugador puede caminar lentamente hacia el iPad.

Durante la luz roja, debe detenerse.

Cuando la aplicación detecte movimiento durante la luz roja, mostrará una advertencia amigable, restará un corazón y continuará la partida.

La partida termina cuando:

* Se completa el tiempo definido.
* El adulto pulsa el botón “Llegó”.
* El jugador pierde sus tres corazones.

---

## 4. Público objetivo

Jugador principal:

* Niño pequeño.
* Juega acompañado por un adulto.
* Puede comprender colores, sonidos e instrucciones simples.
* Puede emocionarse y tratar de correr.

Operador secundario:

* Padre, madre o cuidador.
* Coloca el iPad.
* Inicia la partida.
* Puede detenerla en cualquier momento.
* Confirma manualmente cuándo el niño llegó a la meta.

---

## 5. Regla principal de seguridad

La aplicación debe repetir visual y auditivamente:

> Camina despacio. No corras.

La interfaz no debe usar palabras como:

* Eliminado.
* Perdiste.
* Castigo.
* Disparo.
* Muerte.

Cuando detecte movimiento, debe utilizar mensajes positivos:

* “¡Te vi moverte!”
* “Congélate.”
* “Inténtalo otra vez.”
* “Quédate como estatua.”

La aplicación debe incluir un botón permanente y visible para detener el juego.

---

## 6. Alcance del MVP

### Incluido

* PWA responsive optimizada para iPad.
* Uso de cámara trasera.
* Detección de pose humana.
* Selección de un único jugador.
* Cuenta regresiva de 5 a 1.
* Estados de luz verde y luz roja.
* Duraciones aleatorias.
* Detección de movimiento durante la luz roja.
* Tres corazones.
* Sonidos e instrucciones habladas.
* Botón manual de llegada.
* Pantalla de resultados.
* Modo de calibración.
* Funcionamiento local después de cargar la aplicación.
* Pantalla completa.
* Bloqueo de orientación horizontal cuando sea posible.
* Configuración de sensibilidad.
* Configuración de duración de partida.

### Excluido

* Multijugador.
* Inicio de sesión.
* Backend.
* Base de datos.
* Reconocimiento facial.
* Identificación biométrica.
* Medición precisa de distancia.
* Comunicación entre iPhone e iPad.
* Clasificaciones.
* Compras.
* Publicidad.
* Integración con Arduino.
* Cámara de profundidad.
* Seguimiento de manos o expresiones faciales.

---

## 7. Flujo principal

### Estado 1: Inicio

Mostrar:

* Nombre del juego.
* Botón “Empezar”.
* Mensaje “Necesitas espacio para caminar”.
* Botón de configuración.
* Aviso “Juega acompañado por un adulto”.

Al tocar “Empezar”, solicitar acceso a la cámara.

---

### Estado 2: Preparar el espacio

Mostrar la imagen de la cámara.

Superponer una guía visual para indicar dónde debe ubicarse el jugador.

Instrucciones:

> Coloca el iPad en un lugar estable.

> Asegúrate de que podamos ver tu cuerpo completo.

> Deja espacio para caminar y detenerte.

Requisitos para continuar:

* Una persona visible.
* Cabeza, hombros, cadera y piernas detectables.
* Confianza mínima de detección.
* Jugador dentro de una zona central.
* Jugador visible durante al menos dos segundos continuos.

---

### Estado 3: Seleccionar jugador

Cuando se detecte una persona, dibujar un borde alrededor de ella.

Mostrar:

> Jugador encontrado. Quédate quieto.

Durante dos segundos, registrar una firma visual basada en:

* Posición relativa de hombros.
* Posición relativa de caderas.
* Altura aproximada del cuerpo.
* Tamaño del bounding box.
* Centro horizontal del cuerpo.

Después mostrar:

> ¡Listo! Te seguiré a ti.

Desde ese momento, ignorar otras poses que no coincidan razonablemente con el jugador seleccionado.

No utilizar reconocimiento facial.

---

### Estado 4: Cuenta regresiva

Ocultar la vista completa de la cámara o reducirla a una pequeña ventana de diagnóstico.

Mostrar números grandes:

```text
5
4
3
2
1
```

Reproducir una voz o sonido por cada número.

Antes del número cinco, reproducir:

> Recuerda: camina despacio. No corras.

Al terminar la cuenta regresiva, iniciar la partida.

---

### Estado 5: Luz verde

La pantalla debe mostrar:

* Fondo verde.
* Texto grande “LUZ VERDE”.
* Animación suave.
* Sonido o voz “Luz verde”.
* Corazones restantes.
* Botón de detener.
* Botón “Llegó”.

Durante luz verde:

* El jugador puede moverse.
* No se aplican penalizaciones.
* El detector de pose puede ejecutarse a frecuencia reducida.
* Se debe mantener el seguimiento del jugador seleccionado.
* No es necesario analizar movimiento fino.

Duración inicial recomendada:

* Entre 2,5 y 5 segundos.
* Valor seleccionado aleatoriamente.

La duración no debe mostrarse al jugador.

---

### Estado 6: Transición a luz roja

Antes de analizar movimiento, reproducir:

> Luz roja.

Cambiar inmediatamente el fondo a rojo.

Aplicar un periodo de gracia configurable de aproximadamente 600 milisegundos.

Durante ese periodo no se penaliza el movimiento, permitiendo que el niño termine de detenerse.

---

### Estado 7: Luz roja

La pantalla debe mostrar:

* Fondo rojo.
* Texto grande “LUZ ROJA”.
* Ícono de estatua o pausa.
* Corazones restantes.
* Botón de detener.

Al comenzar la fase roja:

1. Esperar el periodo de gracia.
2. Capturar una pose de referencia.
3. Comparar poses nuevas con la pose de referencia.
4. Analizar principalmente hombros, caderas y rodillas.
5. Ignorar inicialmente manos, muñecas, pies y cabeza.
6. Normalizar el movimiento según el tamaño del cuerpo en pantalla.
7. Exigir movimiento durante varios frames consecutivos antes de penalizar.

Duración inicial recomendada:

* Entre 1,5 y 3 segundos.
* Valor seleccionado aleatoriamente.

---

### Estado 8: Movimiento detectado

Una penalización solo debe activarse cuando:

* La puntuación de movimiento supere el umbral configurado.
* El movimiento se mantenga durante al menos tres análisis consecutivos.
* El jugador principal siga siendo visible.
* La detección tenga suficiente confianza.

Al detectar movimiento:

* Reproducir un sonido amable.
* Mostrar “¡Te vi moverte!”.
* Restar un corazón.
* No penalizar nuevamente durante la misma luz roja.
* Esperar aproximadamente un segundo.
* Continuar con una nueva luz verde.

Nunca restar más de un corazón durante una sola fase roja.

---

### Estado 9: Jugador perdido

Si la pose del jugador deja de detectarse durante menos de un segundo:

* No hacer nada.
* Mantener la última identidad conocida.

Si desaparece durante más de un segundo:

* Pausar la partida.
* Mostrar “No puedo verte”.
* Mostrar nuevamente la cámara.
* Pedirle que vuelva a la zona de juego.

Cuando reaparezca una pose compatible con el jugador seleccionado:

* Pedir que permanezca quieto.
* Reanudar sin reiniciar la partida.

No seleccionar automáticamente a otra persona.

---

### Estado 10: Final de partida

La partida termina por uno de estos motivos:

#### Llegó a la meta

El adulto pulsa “Llegó”.

Mostrar:

> ¡Llegaste!

Reproducir una celebración.

#### Tiempo completado

Mostrar:

> ¡Partida completada!

#### Sin corazones

Mostrar:

> Probemos otra vez caminando más despacio.

No mostrar una pantalla de derrota.

Opciones finales:

* Jugar otra vez.
* Cambiar sensibilidad.
* Volver al inicio.

---

## 8. Máquina de estados

```text
IDLE
  ↓
REQUESTING_CAMERA
  ↓
CALIBRATING
  ↓
LOCKING_PLAYER
  ↓
COUNTDOWN
  ↓
GREEN
  ↓
RED_GRACE_PERIOD
  ↓
RED_DETECTION
  ├── MOVEMENT_WARNING
  ├── PLAYER_LOST
  ├── GREEN
  └── FINISHED
```

Estados adicionales:

```text
PAUSED
CAMERA_ERROR
PERMISSION_DENIED
UNSUPPORTED_DEVICE
```

La lógica del juego debe implementarse como una máquina de estados explícita y no como una colección de booleanos dispersos.

---

## 9. Seguimiento del jugador

El sistema debe detectar como máximo una pose activa para la lógica del juego.

Cuando existan varias personas:

1. Buscar primero la pose más parecida al jugador seleccionado.
2. Comparar centro corporal, tamaño y proporciones.
3. Dar preferencia a la pose más cercana a su posición anterior.
4. Ignorar poses nuevas que aparezcan lejos de la posición esperada.
5. Pausar si no existe coincidencia suficientemente confiable.

La identidad del jugador solo necesita mantenerse durante una partida.

No guardar imágenes ni datos biométricos.

No enviar video a servidores.

Todo el procesamiento debe ocurrir localmente en el dispositivo.

---

## 10. Algoritmo inicial de movimiento

Usar landmarks de:

* Hombro izquierdo.
* Hombro derecho.
* Cadera izquierda.
* Cadera derecha.
* Rodilla izquierda.
* Rodilla derecha.

Calcular el centro del torso:

```text
torsoCenter = promedio de hombros y caderas
```

Calcular una escala corporal:

```text
bodyScale = distancia promedio entre hombros y caderas
```

Para cada landmark relevante, calcular la distancia respecto a la pose capturada al comenzar la luz roja.

Normalizar las distancias:

```text
normalizedMovement = landmarkDistance / bodyScale
```

Construir un puntaje combinado de movimiento.

Dar mayor peso a:

* Centro del torso.
* Caderas.
* Rodillas.

Dar menor peso a:

* Hombros.

Ignorar landmarks con baja confianza.

No penalizar por un único frame.

Mantener un pequeño historial de movimiento y utilizar promedio o mediana para reducir ruido.

---

## 11. Optimización térmica y de rendimiento

La aplicación debe priorizar estabilidad y bajo consumo.

Configuración inicial:

* Cámara a 640×480 o resolución cercana.
* Captura a 30 FPS.
* Inferencia de pose a 8–12 FPS.
* Una sola persona.
* Sin segmentación de fondo.
* Sin detección de manos.
* Sin detección facial.
* Sin grabación.
* Sin envío de video.
* Sin renderizar landmarks durante la partida.
* Preview completo solo durante calibración.

Durante luz verde:

* Reducir inferencia a aproximadamente 3–5 FPS.
* Utilizarla únicamente para mantener la identidad del jugador.

Durante luz roja:

* Analizar aproximadamente 10–12 FPS.

Procesar como máximo un frame simultáneamente.

Si un frame nuevo llega mientras el anterior continúa procesándose, descartar el frame nuevo o el más antiguo.

No acumular una cola de frames.

Mostrar una advertencia de rendimiento solo en modo desarrollo.

---

## 12. Configuración

Crear un panel simple para adultos.

### Sensibilidad

* Baja.
* Normal.
* Alta.

La opción predeterminada será “Normal”.

### Duración

* Corta: aproximadamente 30 segundos.
* Normal: aproximadamente 60 segundos.
* Larga: aproximadamente 90 segundos.

La opción predeterminada será “Corta”.

### Volumen

* Silencio.
* Bajo.
* Alto.

### Vista de cámara

* Oculta durante la partida.
* Miniatura.
* Visible.

Predeterminado: oculta.

### Modo desarrollador

Activado mediante parámetro URL o gesto oculto.

Debe mostrar:

* FPS de cámara.
* FPS de inferencia.
* Puntaje de movimiento.
* Confianza de pose.
* Landmarks.
* Jugador seleccionado.
* Estado actual.
* Temperatura no disponible directamente, por lo que no debe inventarse.

---

## 13. Diseño visual

La aplicación debe verse como un juego infantil independiente y no copiar elementos visuales de ninguna serie.

Características:

* Botones grandes.
* Tipografía redondeada y legible.
* Alto contraste.
* Animaciones suaves.
* Pocos elementos simultáneos.
* Sin texto pequeño.
* Sin menús complejos.

### Luz verde

* Fondo predominantemente verde.
* Personaje o semáforo sonriente.
* Animación ligera de avance.

### Luz roja

* Fondo predominantemente rojo.
* Personaje haciendo señal de pausa.
* Animación mínima para no distraer.

### Cuenta regresiva

* Número ocupando gran parte de la pantalla.
* Sonido sincronizado.
* Cambio visual por cada número.

---

## 14. Audio

Crear sonidos o utilizar archivos locales para:

* “Jugador encontrado”.
* “Quédate quieto”.
* “Camina despacio. No corras”.
* Números del 5 al 1.
* “Luz verde”.
* “Luz roja”.
* “¡Te vi moverte!”.
* “No puedo verte”.
* “¡Llegaste!”.
* Celebración.

Los sonidos deben estar precargados antes de comenzar la cuenta regresiva.

La aplicación debe poder funcionar sin Text-to-Speech remoto.

---

## 15. PWA

La aplicación debe:

* Poder instalarse en la pantalla de inicio.
* Tener manifest.
* Tener íconos.
* Usar service worker.
* Funcionar en pantalla completa cuando sea instalada.
* Mantener disponibles los recursos estáticos sin conexión.
* Mostrar instrucciones para instalarla en iPad.
* Solicitar cámara únicamente después de una interacción del usuario.
* Detectar cuando Safari niegue el permiso.
* Explicar cómo habilitarlo nuevamente.

El juego puede requerir conexión en la primera carga, pero después debe poder ejecutarse localmente siempre que el modelo de pose esté almacenado en caché.

---

## 16. Stack sugerido

* React.
* TypeScript.
* Vite.
* PWA plugin para Vite.
* MediaPipe Pose Landmarker o equivalente compatible con navegador.
* Zustand o reducer para estado local.
* Web Audio API o archivos de audio HTML.
* CSS Modules, Tailwind o CSS simple.
* Vitest para lógica.
* Playwright para flujo básico.

No agregar backend.

No agregar autenticación.

No agregar una biblioteca pesada de componentes.

---

## 17. Arquitectura sugerida

```text
src/
  app/
    App.tsx
    routes.ts

  game/
    gameMachine.ts
    gameConfig.ts
    gameTypes.ts
    movementScoring.ts
    playerTracking.ts

  camera/
    CameraController.ts
    PoseDetector.ts
    frameScheduler.ts

  hooks/
    useCamera.ts
    usePoseDetector.ts
    useGameMachine.ts
    useAudio.ts
    useWakeLock.ts

  components/
    StartScreen.tsx
    CalibrationScreen.tsx
    CountdownScreen.tsx
    GameScreen.tsx
    ResultScreen.tsx
    CameraPreview.tsx
    Hearts.tsx
    StopButton.tsx
    DebugOverlay.tsx

  audio/
    audioManifest.ts

  styles/
    globals.css
```

Separar claramente:

* Cámara.
* Detección de pose.
* Seguimiento del jugador.
* Cálculo de movimiento.
* Máquina de estados.
* Presentación.

La lógica del juego debe poder probarse sin cámara real.

---

## 18. Manejo de errores

### Cámara denegada

Mostrar instrucciones claras para habilitarla en Safari.

### Cámara no disponible

Mostrar:

> No encontramos una cámara disponible.

### Modelo no cargado

Permitir reintentar.

### Rendimiento insuficiente

Reducir automáticamente la frecuencia de inferencia.

### Jugador parcialmente visible

Pedir que se aleje o cambie la posición del iPad.

### Más de una persona durante calibración

Mostrar:

> Solo debe haber un jugador frente a la cámara.

### Cambio de orientación

Pausar y pedir volver a posición horizontal.

### Aplicación en segundo plano

Pausar inmediatamente la partida.

---

## 19. Criterios de aceptación

### Inicio

* El usuario puede iniciar el juego con un solo botón.
* La cámara no se solicita antes de una interacción.
* Existe un mensaje de seguridad sobre caminar.

### Calibración

* La app identifica cuando existe una persona visible.
* No continúa si el cuerpo está demasiado cortado.
* Confirma al jugador después de permanecer estable.
* No requiere reconocimiento facial.

### Seguimiento

* Una persona que entra posteriormente no reemplaza automáticamente al jugador.
* Si se pierde al jugador, la partida se pausa.
* El sistema intenta recuperar al mismo jugador.

### Cuenta regresiva

* Muestra exactamente 5, 4, 3, 2 y 1.
* Cada número tiene audio o señal sonora.
* La partida empieza automáticamente después del 1.

### Juego

* Luz verde y luz roja se distinguen claramente.
* Sus duraciones varían.
* Existe periodo de gracia al cambiar a rojo.
* Un solo episodio rojo puede quitar como máximo un corazón.
* El jugador comienza con tres corazones.
* El botón “Llegó” finaliza la partida.
* El botón de detener siempre está disponible.

### Rendimiento

* No se acumulan frames pendientes.
* La pose se procesa a una frecuencia menor que la cámara.
* El video no se envía fuera del dispositivo.
* El preview puede ocultarse durante la partida.
* El modelo se ejecuta únicamente para una persona.

### PWA

* Puede instalarse en el iPad.
* Los archivos esenciales quedan almacenados localmente.
* Puede abrirse en modo standalone.
* El juego se recupera correctamente al volver del segundo plano.

---

## 20. Pruebas mínimas

### Pruebas unitarias

* Transiciones de la máquina de estados.
* Pérdida de corazones.
* Una penalización máxima por fase roja.
* Cálculo normalizado de movimiento.
* Periodo de gracia.
* Pérdida y recuperación del jugador.
* Finalización manual.

### Pruebas manuales

* Niño quieto durante luz roja.
* Niño caminando durante luz verde.
* Niño continúa caminando al comenzar rojo.
* Movimiento pequeño de brazos.
* Balanceo natural.
* Adulto entra en el fondo.
* Adulto cruza frente a la cámara.
* Jugador sale parcialmente del cuadro.
* Mala iluminación.
* iPad cerca y lejos.
* Aplicación ejecutándose durante diez minutos.
* Aplicación añadida a pantalla de inicio.

---

## 21. Decisiones para el MVP

Usar estas decisiones sin pedir confirmación:

* Un jugador.
* iPad como cámara y pantalla.
* Orientación horizontal.
* Cámara trasera.
* Tres corazones.
* Cuenta regresiva de cinco segundos.
* Partidas de 30 segundos por defecto.
* Luz verde entre 2,5 y 5 segundos.
* Luz roja entre 1,5 y 3 segundos.
* Periodo de gracia de 600 milisegundos.
* Inferencia aproximada de 10 FPS durante rojo.
* Vista de cámara oculta durante el juego.
* Botón manual para indicar que llegó.
* Audio en español.
* Procesamiento completamente local.
* Estética infantil original.
* Caminar despacio como única modalidad.

---

# Prompt de implementación one-shot

Construye una Progressive Web App completa llamada “Luz Verde, Luz Roja”, optimizada para Safari en iPad y pensada para que un niño juegue caminando lentamente.

Lee y cumple todo el PRD incluido arriba.

Implementa el proyecto completo usando React, TypeScript y Vite. Configúralo como PWA instalable. Usa detección de pose local en el navegador mediante MediaPipe Pose Landmarker o una alternativa equivalente que funcione en Safari para iPad.

No agregues backend, autenticación, base de datos ni servicios externos.

La aplicación debe utilizar la cámara trasera del iPad. Al empezar, solicita permiso para la cámara y muestra una fase de calibración. Detecta a una persona con el cuerpo suficientemente visible, pide que permanezca quieta durante aproximadamente dos segundos y selecciónala como el jugador principal.

Después de seleccionar al jugador, la aplicación debe intentar mantener su identidad mediante posición, tamaño corporal, proporciones y proximidad respecto a la pose anterior. Si aparece otra persona, no debe reemplazar automáticamente al jugador seleccionado.

Luego muestra una cuenta regresiva grande y audible de 5 a 1. Después comienza automáticamente una partida de Luz Verde, Luz Roja.

Durante luz verde, permite movimiento. Durante luz roja, espera un periodo de gracia de 600 milisegundos, captura una pose de referencia y detecta movimiento utilizando hombros, caderas y rodillas. Normaliza el movimiento según el tamaño del cuerpo para que la sensibilidad no dependa de la distancia a la cámara.

No penalices por un solo frame. Exige movimiento sobre el umbral durante varios análisis consecutivos. Una fase roja solo puede retirar un corazón.

El jugador comienza con tres corazones. Cuando detectes movimiento, muestra un mensaje infantil como “¡Te vi moverte!”, resta un corazón y continúa la partida. Nunca utilices lenguaje violento ni una pantalla de eliminación.

Incluye un botón grande llamado “Llegó” para que el adulto pueda finalizar manualmente la partida cuando el niño llegue a la meta. Incluye también un botón permanente para detener el juego.

Optimiza la aplicación para reducir consumo y calentamiento:

* Captura video aproximadamente a 640×480 y 30 FPS.
* Ejecuta pose a aproximadamente 8–12 FPS.
* Reduce la frecuencia durante luz verde.
* Procesa un solo frame a la vez.
* Descarta frames atrasados.
* Detecta una sola persona para la lógica principal.
* No ejecutes segmentación, manos ni rostro.
* No grabes video.
* No envíes imágenes a ningún servidor.
* No muestres el preview de cámara durante la partida, salvo que el usuario lo habilite.
* Carga y almacena localmente el modelo necesario.

Implementa la lógica como una máquina de estados explícita.

Crea pantallas para:

* Inicio.
* Preparación del espacio.
* Detección y selección del jugador.
* Cuenta regresiva.
* Juego.
* Jugador perdido.
* Resultado.
* Configuración.
* Error de cámara.

Incluye configuración para sensibilidad, duración, volumen y visibilidad del preview.

Incluye un modo desarrollador activable mediante `?debug=true` que muestre FPS de cámara, FPS de inferencia, confianza de pose, puntuación de movimiento, estado actual, landmarks y bounding box del jugador seleccionado.

La interfaz debe tener botones grandes, alto contraste, orientación horizontal y una estética infantil original. Debe mostrar claramente “Camina despacio. No corras” antes de cada partida.

Añade recursos de audio locales o placeholders claramente identificados para la cuenta regresiva, luz verde, luz roja, jugador perdido, movimiento detectado y celebración.

Implementa manejo de errores para permisos denegados, cámara no disponible, modelo no cargado, orientación incorrecta, aplicación en segundo plano y rendimiento insuficiente.

Añade pruebas unitarias para la máquina de estados y el algoritmo de movimiento. Añade al menos una prueba de flujo con Playwright usando mocks de cámara y pose.

Entrega:

1. Todos los archivos del proyecto.
2. Código funcional, no pseudocódigo.
3. README con instalación y ejecución.
4. Instrucciones para probar desde un iPad dentro de la misma red local.
5. Instrucciones para instalar la PWA.
6. Explicación breve de cómo ajustar el umbral de movimiento.
7. Lista de limitaciones conocidas.
8. Ningún TODO crítico que impida jugar una partida completa.

Cuando exista una decisión menor no especificada, elige la implementación más sencilla y mantenible. No agregues funcionalidades fuera del alcance.
