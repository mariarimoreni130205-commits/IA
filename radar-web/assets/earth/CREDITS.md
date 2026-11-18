# Earth textures

Creator: Solar System Scope / INOVE.
Source: https://www.solarsystemscope.com/textures/
License: Creative Commons Attribution 4.0 International.
License URL: https://creativecommons.org/licenses/by/4.0/

- earth_day_4096.jpg: the resized 4096 px day map distributed in the Three.js examples at https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_day_4096.jpg (credited to Solar System Scope in webgpu_tsl_earth.html).
- earth_surface_4096.jpg: the combined bump/roughness/cloud map from Three.js (earth_bump_roughness_clouds_4096.jpg), resized and merged from Solar System Scope's maps by Three.js. Renamed without pixel changes; Radar uses its red channel for relief.
- earth_clouds_2048.jpg: Solar System Scope's 2k_earth_clouds.jpg, renamed without pixel changes, used as an opacity mask.

These maps depict Earth and are based on geographic imagery. The flight routes, departure times, aircraft positions, and cloud movement in Radar are artistic simulations; they do not represent live traffic or weather.

Three.js 0.187.0 is bundled locally under the MIT License, included in ../vendor/LICENSE. OrbitControls' import path is adjusted to use the adjacent local module. The aircraft geometry is original procedural geometry created for this project.
