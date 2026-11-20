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

## Inteligencia artificial: intérprete y copiloto

`api/ia.js` conecta la app con un modelo de lenguaje a través de [OpenRouter](https://openrouter.ai). Por defecto usa `deepseek/deepseek-v4-flash`; se puede cambiar con la variable `OPENROUTER_MODEL`.

- **Intérprete:** cuando el usuario busca, la IA convierte la frase libre en preferencias (destinos, meses, presupuesto, días, escalas, origen, aerolíneas a evitar) y sugiere ciudades si no nombró destino. El motor de reglas también lee la frase y completa lo que la IA no aporte.
- **Copiloto:** el chat debajo de los resultados conversa sobre los vuelos encontrados, da consejos de viaje y puede cambiar la búsqueda. Recibe únicamente los vuelos de la búsqueda actual, con su fuente (real o simulado), y tiene instrucciones de no inventar vuelos ni precios.

La IA solo interpreta y conversa: los precios siguen viniendo de Aviasales o de la simulación, y el puntaje lo calcula el motor de utilidad. Todo lo que devuelve el modelo se valida contra el catálogo antes de usarse.

Configurá `OPENROUTER_API_KEY` en las variables del servidor de Vercel; nunca la incluyas en archivos del navegador. Sin la clave, o si el modelo falla, la app vuelve automáticamente al motor de reglas. Conviene fijar un límite de gasto en la clave de OpenRouter, porque el endpoint es público.

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
