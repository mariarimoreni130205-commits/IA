# Radar de Vuelos

Rediseño funcional de la aplicación académica, basado en el concepto visual aprobado: verde profundo, marfil y lima, fotografías generadas con IA, búsqueda conversacional, recomendaciones y alertas.

## Abrir la aplicación

La aplicación y el globo 3D se abren desde un servidor HTTP. No hace falta instalar dependencias para el servidor local. Abrir `index.html` como archivo mantiene la demo básica, pero los módulos 3D requieren HTTP.

Para usar el servidor local con la integración de precios:

```sh
npm run dev
```

Abrí la dirección que imprime la terminal: `http://127.0.0.1:4173`.

## Funciones

- Pedido en lenguaje natural y preguntas de aclaración.
- Ranking por utilidad: precio, escalas, origen, estadía, duración del vuelo y fechas.
- Ajustes conversacionales y explicaciones de las recomendaciones.
- Ordenamiento por coincidencia, precio o duración.
- Detalle de cada vuelo y favoritos.
- Búsquedas guardadas con un precio objetivo, pausa y revisión manual.
- Alertas locales y evolución del precio cuando existen observaciones comparables.
- Simulación de precios exclusivamente para datos demostrativos.
- Diseño adaptable a celular, navegación por teclado y soporte de movimiento reducido.
- Globo 3D con texturas terrestres, 36 vuelos simulados continuos, giro con arrastre o un dedo, zoom con dos dedos o botones, y controles de pausa y restablecimiento.
- Ciudades seleccionables, fichas de 32 aeropuertos con país y código IATA, y acceso a búsqueda conservando preferencias.
- Aviones seleccionables con origen, destino, progreso y tiempo de la animación; pulsos de despegue y aterrizaje.
- Tres rutas destacadas que enfocan la cámara. La sección está inmediatamente antes de “Tu radar sigue buscando”.

El motor original de interpretación, utilidad y diálogo se conserva en `engine.js`. El agente usa reglas; no se añadió un modelo de lenguaje generativo. Las salidas y las escalas solicitadas se respetan como restricciones. Las fechas cercanas y las diferencias respecto del presupuesto se explican en los resultados.

## Datos reales y demostrativos

La pantalla inicial muestra tres vuelos ilustrativos. Los puntajes se calculan con la función de utilidad; no son porcentajes de certeza. La demo identifica sus precios como simulados. Las imágenes son ilustrativas y se generaron con IA.

La integración original está en `api/vuelos.js`. En Vercel, configurá `TRAVELPAYOUTS_TOKEN` como variable del servidor y desplegá el proyecto para consultar Aviasales. Para el servidor local, proporcioná la misma variable en su entorno. Nunca incluyas la clave en archivos del navegador.

Los precios del proveedor son datos previamente encontrados, sujetos a disponibilidad. Si no hay clave o la consulta falla, se utiliza un respaldo simulado identificado en pantalla. `api/vuelos.js` conserva el formato de función de Vercel.

La vista privada publicada con Sites es una demo estática; la integración de servidor está incluida en el proyecto local y en el paquete para Vercel.

### Configuración de Vercel

Al importar el repositorio `Nacho234/marina`, seleccioná `radar-web` como **Root Directory**. `vercel.json` fija **Framework Preset: Other**, omite instalación y compilación, y sirve la carpeta actual. Vercel publica `api/vuelos.js` como función de servidor. La configuración evita que Vercel interprete `app.js`, que utiliza el DOM, como un servidor Node. `server.mjs` es solamente el servidor local.

Si el proyecto ya se importó, el siguiente despliegue usa esta configuración del repositorio. La raíz debe seguir siendo `radar-web`.

## Persistencia y alertas

Los favoritos, búsquedas y alertas se guardan en `localStorage` bajo `radar-vuelos-v2`. Se importan búsquedas y alertas de la clave `rv` de la versión anterior cuando corresponde.

El monitoreo funciona cada dos minutos mientras la pestaña está visible. No envía emails ni notificaciones del sistema, y se detiene al cerrar la app. La evolución de precios se dibuja únicamente con observaciones del mismo vuelo y la misma fuente; el panel inicial contiene un ejemplo expresamente identificado.

## Archivos

```text
index.html          Interfaz semántica
styles.css          Diseño y estilos adaptables
app.js              Interacciones, favoritos y alertas
engine.js           Motor de interpretación, utilidad y conversación
api/vuelos.js       Consulta de Aviasales desde servidor
server.mjs          Servidor local sin dependencias
assets/             Fotografías WebP y favicon
tests/              Pruebas de comportamiento del motor
```

## Verificación

```sh
npm run check
npm test
```

Se verificaron en navegador: búsqueda, aclaraciones, ajustes de preferencias, detalle del vuelo, guardado, creación y lectura de alertas, persistencia tras recargar, estados vacíos y vista móvil. La API real se verificó con respuestas simuladas; no se utilizó una credencial de Travelpayouts.

## Hero de avión

La cabecera implementa el concepto aprobado con tres renders independientes en `assets/hero/`: paisaje, avión transparente y nubes. El paisaje y el texto quedan fijos dentro de la sección; únicamente el avión flota suavemente y una capa de nubes se desplaza dentro del encuadre del paisaje. Es una composición de renders con profundidad, no un modelo 3D navegable; el globo de la sección inferior sí usa Three.js.

El desplazamiento de la página es normal: no hay escenas fijadas ni transiciones asociadas al scroll. Las animaciones CSS se pausan cuando el hero queda fuera de pantalla, al ocultar la pestaña o con el control de pausa; se respeta `prefers-reduced-motion`. El buscador sigue siendo HTML accesible y lleva a las aclaraciones o resultados al enviar. `navigation.js` convierte la navegación móvil en un menú hamburguesa que se cierra al elegir una sección, tocar afuera o presionar Escape.

## Visita de Torre Urbana

La experiencia combina una fachada fotorealista generada y una toma de video de
la suite creada en Google Flow. Es una composición interactiva de imagen y video,
no un edificio 3D navegable. El hotel, las habitaciones y la ciudad son ficticios.
Hay nueve pisos y tres ventanas por piso: cada habitación tiene su propia entrada,
aunque todas reutilizan el mismo diseño y recorrido interior.

`hotel-motion.js` define las 27 ventanas sobre la fotografía y calcula las
transformaciones de perspectiva. El acercamiento apunta a la ventana elegida,
encuadra allí el primer fotograma del interior y lo lleva hasta ocupar la pantalla.
Al llegar, comienza la toma continua de la suite. La vuelta reproduce los mismos
fotogramas en orden inverso y deshace el acercamiento hacia la ventana seleccionada.
No se encadenan clips independientes ni se busca una ventana fija para todos.
La perspectiva es una ilusión 2.5D: no existe libertad para caminar por la escena.

`hotel.js` controla selección, pausa, carga y regreso. El movimiento del exterior
se actualiza con `requestAnimationFrame` y tiempo transcurrido; no tiene un bucle
activo cuando está detenido. Se pausa al ocultar la pestaña o salir de pantalla.
Los controles de piso/habitación funcionan con teclado y ofrecen blancos táctiles
de al menos 44 px. Movimiento reducido evita el hover automático y acorta el zoom.

El recorrido original de Flow tiene 358 fotogramas a 24 FPS (aproximadamente 15 s),
generados a 720p y reescalados en Flow a 1080p. No son 60 FPS nativos. El MP4 web
contiene ida y vuelta; la versión móvil tiene 960 × 540 y pesa aproximadamente 9 MB.
El acercamiento del navegador sigue la frecuencia de pantalla y el rendimiento
del equipo. Los medios se precargan al acercarse al hotel, sin una llamada a Flow
por visitante. No se necesita una cuenta de Flow para usar la página.

`hotel-playback.js` convierte los tiempos entre ida y vuelta; `tour.json` registra
los límites exactos por fotograma. `server.mjs` admite HTTP Range para adelantar o
retroceder dentro del MP4. Vercel sirve los medios como archivos estáticos.
Las pruebas comprueban la proyección de cada ventana, la coincidencia del portal
con el video en escritorio/celular y los tiempos del regreso. Créditos y origen
de los recursos en `assets/hotel/CREDITS.md`.

## Mundo 3D

`globe.js` carga Three.js y la escena al acercarse la sección al área visible. `globe-scene.js` dibuja una Tierra texturada, una capa de nubes, una atmósfera suave y aviones modelados con geometría procedural. Los vuelos siguen arcos geográficos entre coordenadas de aeropuertos; todos son simulados, sin conexión a datos de tráfico aéreo.

Arrastrar con el mouse o con un dedo gira el mundo; las flechas del teclado también lo permiten. Inicio restablece la vista y espacio pausa/reanuda la animación. El movimiento automático se pausa durante la interacción. La preferencia de movimiento reducido inicia la animación en pausa. El render se detiene cuando el globo queda fuera de pantalla o la pestaña se oculta.

Los modelos se dibujan por instancias, la resolución de render se limita y las texturas y el motor se sirven desde archivos locales. Requiere WebGL 2; si no está disponible, la sección muestra un estado alternativo y la búsqueda de vuelos sigue funcionando.

Three.js 0.187.0: licencia MIT en `assets/vendor/LICENSE`. Texturas de Solar System Scope bajo CC BY 4.0; fuentes, conversiones y créditos en `assets/earth/CREDITS.md`.


### Exploración de ciudades y vuelos

`airport-data.js` comparte el catálogo entre el globo, el buscador y la función de servidor. Nombres, códigos y coordenadas proceden de [OurAirports](https://ourairports.com/data/), mediante [datasets/airport-codes](https://github.com/datasets/airport-codes) (datos de dominio público; consulta del 18 de noviembre de 2026). Los nombres de las ciudades se presentan en español.

`globe-ui.js` muestra etiquetas únicamente en la cara visible del planeta, evita superposiciones y permite elegir las 32 ciudades o las 36 rutas con selectores accesibles. Las fichas se muestran junto al globo en escritorio y como panel inferior en pantallas pequeñas. Buscar un destino cierra la ficha y ejecuta el buscador conservando las preferencias. Si coincide con el origen, se elige la otra salida disponible.

`globe-aircraft.js` contiene el modelo original, simétrico, con fuselaje redondeado, alas continuas, motores y cola. Los aviones tienen velocidades de crucero diferentes y más ágiles; la parametrización por longitud del arco mantiene estable la velocidad de cada avión. La orientación sigue la tangente y se suaviza. Tras aterrizar permanecen ocultos antes del siguiente despegue; no se trasladan visiblemente al origen. Los segundos que muestra la ficha describen la animación, nunca la duración de un vuelo real.

La selección distingue un clic de un arrastre y descarta los objetos tapados por la Tierra. La rueda del mouse conserva el desplazamiento de la página. Se revisaron visualmente escritorio y anchos de 390 y 320 píxeles; el gesto de pellizco utiliza OrbitControls y requiere comprobación en un dispositivo táctil físico.
