# 🌌 Real-Time Earth • Sun • Moon Ephemeris Simulator (v2.0)

A physically rigorous, interactive 3D WebGL astronomical simulation of the **Earth, Sun, and Moon** system, powered by **astronomy-engine** and real-world high-resolution planetary data from **NASA** and **Solar System Scope**.

---

## 🌟 Key Features

### 1. 100% Real Ephemeris & Astronomical Engine
- **Astronomy-Engine Integration**: Complete celestial mechanics utilizing full VSOP87 and ELP2000-82 ephemerides, IAU 2000 precession/nutation, Earth orientation, and IAU lunar rotational model.
- **Physical Libration in Latitude & Longitude**: True lunar wobble calculated from `Astronomy.Libration()`, allowing observation of limb features cycling in and out of Earth view.
- **Solar & Lunar Eclipse Searches**: Bidirectional historical search algorithm (`searchNextSolarEclipse`, `searchPrevSolarEclipse`, `searchNextLunarEclipse`, `searchPrevLunarEclipse`).
- **Greenwich Apparent Sidereal Time (GAST)**: Exact Earth axial rotation angle accounting for nutation and equation of the equinoxes.

### 2. 8K Graphics & Real Assets
- **8K Earth Maps**: 8192×4096 day map, night lights (NASA Black Marble), specular water map, and 8K cloud composite (Solar System Scope, CC-BY 4.0).
- **12 Monthly Seasonal Textures**: 5400×2700 NASA Blue Marble Next Generation textures that update dynamically based on the simulated month.
- **Live Daily NASA GIBS Clouds**: Real-time cloud imagery pulled directly from NASA's Global Imagery Browse Services (MODIS Terra Corrected Reflectance) matching the simulated date, with seamless fallback to the 8K composite.
- **8K Lunar Topography**: 8192×4096 LROC WAC global lunar texture.
- **Lommel-Seeliger & Earthshine Lunar Shader**: Physically based lunar regolith backscattering and night-side Earthshine.
- **Yale Bright Star Catalog**: 9,101 stars mapped from Harvard/Yale BSC5P with exact Right Ascension, Declination, visual magnitude, and B-V spectral color temperatures.

### 3. Place Identification & Inspection
- **Earth Country Identification**: Click anywhere on Earth to inspect the sovereign country (via GeoJSON point-in-polygon raycasting) or named ocean.
- **Local Chronometry & True Solar Time**: Computes local true solar time (HH:MM:SS), topocentric solar altitude, daylight/twilight state (Civil, Nautical, Astronomical), and Moon visibility.
- **Moon Surface Exploration**: Identifies historic lunar landing sites (Apollo 11–17, Luna, Surveyor, Chang'e 3–6, Chandrayaan-3, SLIM), major maria, craters, and mountain ranges, with Earth-visibility (Near Side vs Far Side) and sunlight telemetry.
- **Instant Search & Fly-To**: Search any country or lunar site to smoothly fly the camera directly over the location.

### 4. Interactive Time Travel & Controls
- **Signed Time Warp**: Seamlessly travel forward or backward in time from -1 year/s to +1 year/s, pause, or sync with live UTC.
- **Quick-Jump Buttons**: Jump directly to the next or previous solar eclipse, lunar eclipse, new/full moon, or solstice/equinox.
- **Fine Stepping**: Step backward or forward by seconds, hours, days, or lunar months.

### 2. High-Fidelity 3D Visuals & Shaders
- **Earth Day/Night Terminator Shader**: Custom GLSL shader with smooth twilight scattering (civil, nautical, astronomical twilight), specular sun glints on oceans, and glowing golden city lights (Black Marble) on the night hemisphere.
- **Atmospheric Glow**: Rayleigh scattering limb fresnel halo around Earth.
- **Moon Surface**: Photorealistic lunar topography featuring near-side Maria (Oceanus Procellarum, Mare Imbrium, Mare Tranquillitatis) and highland Tycho crater ray structures.
- **Sun & Corona**: Solar photosphere with limb darkening and glowing corona sprite.
- **Deep Space Skybox**: Milky Way galactic plane with nebula dust lanes and 3,500 pinpoint stars with realistic spectral colors.
- **Shadow Cones**: 3D geometric visualization of Earth and Moon **Umbra cones** illustrating eclipses in real time.

### 3. Dual Scale Modes
- **Visual Exploration Scale**: Planetary radii and distances are balanced for simultaneous inspection of Earth's terminator, Moon's craters, and orbital geometries while maintaining exact angular relationships and phases.
- **1:1 Metric Scale**: True physical metric scale (Earth $R=6,371$ km, Moon $R=1,737$ km, Moon distance $\sim 384,400$ km, Sun distance $\sim 150,000,000$ km).

### 4. Interactive Time & Camera Controls
- **Live Now**: 1-click synchronization to the current millisecond system clock.
- **Time Warp**: 1x (real-time), 60x (1 min/s), 3,600x (1 hr/s), 86,400x (1 day/s), 1 week/s, 1 month/s.
- **Step Controls**: Step forward/back by 1 day or 1 lunar month.
- **Astronomical Event Presets**:
  - Total Solar Eclipse: April 8, 2024
  - Total Solar Eclipse: August 21, 2017
  - Annular Solar Eclipse: October 14, 2023
  - Total Lunar Blood Moon: November 8, 2022
  - Total Lunar Eclipse: March 14, 2025
  - Summer & Winter Solstices
  - Vernal Equinox
  - Perihelion & Aphelion
- **Camera Views**: Earth Orbit, Lunar Orbit, Earth-Moon System, Heliocentric Sun, and Apollo 8 "Earthrise" Surface View.

---

## 🚀 Getting Started

### 1. Run Automated Ephemeris Verification Tests
```bash
npm test
```
All 61 comprehensive tests run and verify:
- Julian Date at J2000.0 epoch & secular stability across 2,000 years (Years 1000 CE to 3000 CE)
- Greenwich Mean Sidereal Time prograde rotation rate (~15.04°/hr)
- Prograde Earth rotation and westward subsolar drift (~15°/hr)
- Obliquity of the Ecliptic (23.439°)
- Solstice and Equinox declination angles
- Perihelion & Aphelion orbital distances
- Moon inclination (5.145° bounds) and perigee/apogee distance limits
- Historical Solar & Lunar Eclipse detection and numerical float clamp protection
- 3D scene integration, world-space shader uniform links, and lunar near-side tidal locking
- 100% static asset resolution and serving across all client scripts, styles, and vendor modules

### 2. Start the Local Server
```bash
npm start
```
Or:
```bash
node server.js
```
Open **`http://localhost:8080`** in any modern web browser (Chrome, Edge, Firefox, Safari).

---

## 📁 Project Architecture

```
earth-sun-moon-orbit-sim/
├── index.html               # Main WebGL viewport & HTML structure
├── package.json             # NPM metadata and test/start scripts
├── server.js                # Zero-dependency local HTTP static server
├── README.md                # Documentation & astronomical references
├── src/
│   ├── ephemeris.js         # Core astronomical calculations (Meeus & IAU)
│   ├── scene.js             # Three.js 3D solar system scene & updates
│   ├── shaders.js           # GLSL shaders (Earth day/night, atmo, Sun)
│   ├── textures.js          # Procedural canvas texture synthesis
│   ├── cameraController.js  # Camera navigation & focus tracking
│   ├── timeController.js    # Time warp & simulation clock
│   ├── ui.js                # Telemetry HUD & UI event wiring
│   └── main.js              # Application entry point & render loop
├── styles/
│   └── main.css             # Glassmorphism cockpit HUD stylesheet
├── tests/
│   └── test_ephemeris.js    # Comprehensive automated test suite
└── vendor/
    ├── three.module.js      # Bundled Three.js ES module
    └── jsm/controls/
        └── OrbitControls.js # Bundled OrbitControls
```
