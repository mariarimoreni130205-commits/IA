# Radar de Vuelos

La aplicación actualizada está en `radar-web/`. Abrí `index.html` o `radar-web/index.html` con el navegador para probarla.

Para ejecutarla con su servidor local, entrá en `radar-web` y ejecutá `npm run dev`.

El README dentro de `radar-web` explica el motor, el modo de demostración, las alertas y la integración original con Aviasales/Vercel.

El diseño anterior está respaldado en el archivo `marina-antes-del-rediseno.zip` de la carpeta de entregables de Codex.

## Desplegar en Vercel

Importá este repositorio y elegí **Root Directory: `radar-web`**. El archivo `radar-web/vercel.json` configura el proyecto como **Other**: HTML, CSS y JavaScript estáticos, sin instalación ni compilación, con `api/vuelos.js` como función de servidor.

No elijas el preset Node: `app.js` es el código del navegador y necesita el DOM. `server.mjs` se usa solamente para desarrollo local. Para precios reales, agregá `TRAVELPAYOUTS_TOKEN` en las variables del servidor; sin ella funciona la demo identificada en pantalla.
