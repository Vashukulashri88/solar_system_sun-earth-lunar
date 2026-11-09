# 🌌 Real-Time Earth • Sun • Moon Ephemeris Simulator (v2.0)

A physically rigorous, interactive 3D WebGL astronomical simulation of the **Earth, Sun, and Moon** system, powered by **astronomy-engine** and real-world high-resolution planetary data from **NASA**, **USGS/IAU**, and **Solar System Scope**.

Synchronized in real time with the current UTC and local clock, providing true celestial mechanics, prograde Earth rotation, physical lunar libration, daily NASA satellite clouds, and complete surface place identification.

---

## 📖 Table of Contents
1. [Quick Start](#-quick-start)
2. [How to Use the Simulation](#-how-to-use-the-simulation)
   - [Mouse & Viewport Controls](#1-mouse--viewport-controls)
   - [Camera Views & Focus Modes](#2-camera-views--focus-modes)
   - [Time Travel, Warping & Scrubber](#3-time-travel-warping--timeline-scrubber)
   - [Place Identification & Surface Inspector](#4-place-identification--surface-inspector)
   - [Scale Modes](#5-scale-modes)
   - [Visual Layers & Toggles](#6-visual-layers--toggles)
   - [Keyboard Shortcuts](#7-keyboard-shortcuts)
3. [Key Astronomical & Graphical Features](#-key-astronomical--graphical-features)
4. [Project Structure](#-project-structure)
5. [Testing & Verification](#-testing--verification)
6. [Attribution & Credits](#-attribution--credits)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or newer recommended)
- Any modern web browser (Chrome, Edge, Firefox, Safari) with WebGL support

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Vashukulashri88/solar_system_sun-earth-lunar.git
   cd solar_system_sun-earth-lunar
   ```

2. **Install dependencies (Three.js, Astronomy Engine, Puppeteer for tests):**
   ```bash
   npm install
   ```

3. **Run automated verification tests:**
   ```bash
   npm test
   ```

4. **Start the local server:**
   ```bash
   npm start
   ```

5. Open **`http://localhost:8080`** in your browser.

---

## 🎮 How to Use the Simulation

### 1. Mouse & Viewport Controls
- **Rotate / Orbit View**: Left-click and drag across the viewport.
- **Pan / Shift**: Right-click and drag (or two-finger drag on trackpads).
- **Zoom In / Out**: Scroll the mouse wheel (or pinch-to-zoom).
- **Inspect Place**: Left-click directly on any country on Earth or crater/landing site on the Moon to open the **Surface Inspector Card**.

---

### 2. Camera Views & Focus Modes
In the upper-right **Camera Target** panel (or use number keys `1`–`5`, `0`):
- **🌍 Earth (`1`)**: Centers the camera on Earth. Observe day/night twilight terminators, seasonal snow cover, and Black Marble night city lights.
- **🌙 Moon (`2`)**: Centers on the Moon with photorealistic LRO topography, crater rays, and Apollo landing sites.
- **🪐 System (`3`)**: Wide orbital view of the Earth-Moon binary system with orbit trails and nodes.
- **☀️ Sun (`4`)**: Centers on the Sun to view the Earth-Moon system revolving along the ecliptic plane.
- **🚀 Apollo Earthrise (`5`)**: Positions the camera on the lunar surface facing back toward Earth, replicating the iconic Apollo 8 view.
- **📍 My Location (`0`)**: Automatically centers on your local region (e.g. India) and opens the Inspector card displaying your local true solar time, sun altitude, and day/night state.

---

### 3. Time Travel, Warping & Timeline Scrubber
Located in the bottom control bar:
- **⚡ Live Sync Button**: Click `⚡ LIVE` to snap the simulation back to the current real-time clock.
- **⏸️ Pause / Play**: Click the pause button (or press `Space`) to freeze time.
- **⏩ Time Warp Buttons**:
  - Reverse: `-1yr/s`, `-1mo/s`, `-1d/s`, `-1h/s`, `-1m/s`, `-1x`
  - Forward: `1x`, `1m/s`, `1h/s`, `1d/s`, `1mo/s`, `1yr/s`
  - Keyboard: Press `[` to slow down / reverse warp, `]` to speed up forward warp.
- **🎛️ Timeline Scrubber**:
  - Drag the blue slider thumb backward or forward to smoothly scrub through time and watch Earth rotate, the day/night line move, and the Moon wobble in real time.
  - Choose span range: **±1 Day**, **±1 Month**, or **±1 Year**.
  - Click **Reset** to return the scrubber thumb to zero offset.
- **📅 Date/Time Picker**:
  - Select any custom date and time in the input box and click **Go**.
- **🔭 Astronomical Event Search**:
  - **◀ Prev Solar Eclipse / Next Solar Eclipse ▶**: Jumps to the exact peak of the nearest solar eclipse.
  - **◀ Prev Lunar Eclipse / Next Lunar Eclipse ▶**: Jumps to the nearest total or partial lunar eclipse.
  - **◀ Prev New/Full Moon / Next New/Full Moon ▶**: Jumps to exact lunar syzygy quarters.
  - **Next Equinox / Solstice ▶**: Advances to the exact moment of the next seasonal equinox or solstice.

---

### 4. Place Identification & Surface Inspector
- **Interactive Clicking**:
  - **On Earth**: Reveals country name, continent, exact latitude/longitude, **True Local Solar Time**, topocentric solar elevation (e.g., `-60.2°` during night), day/night/twilight status, and Moon visibility.
  - **On the Moon**: Reveals crater/mare names, lunar landing missions (Apollo 11–17, Luna, Chang'e, Chandrayaan-3, SLIM), selenographic coordinates, Earth visibility (near side vs far side), and sunlight/earthshine illumination status.
- **🔍 Universal Search Bar**:
  - Type in the top search box (e.g., `India`, `United States`, `Apollo 11`, `Tycho`, `Mare Tranquillitatis`) and select the autocomplete result.
  - The camera smoothly flies to and centers directly on the chosen location.

---

### 5. Scale Modes
Toggle between two scale perspectives in the right sidebar:
- **Visual Exploration Scale (Default)**: Planet sizes and orbital distances are scaled proportionally for simultaneous inspection of Earth's terminator, the Moon's surface, and orbits while preserving exact physical angles, lighting, and phases.
- **1:1 Metric Scale**: True physical metric scale (Earth $R=6,371$ km, Moon $R=1,737$ km, Moon distance $\sim 384,400$ km, Sun distance $\sim 149.6 \times 10^6$ km).

---

### 6. Visual Layers & Toggles
Customize your view using the checkboxes in the **Visual Layers** panel:
- **Country Labels (Earth) (`C`)**: Decluttered, prioritized sovereign country labels.
- **Moon Features & Landings (`M`)**: Apollo landing sites, maria, and crater labels.
- **Lat/Lon Graticule Grid (`G`)**: Equirectangular coordinate grid overlay on Earth and the Moon.
- **Seasonal Blue Marble (12 Mo)**: Dynamically swaps between 12 monthly 8K NASA maps to show seasonal snowlines and vegetation.
- **NASA Daily GIBS Clouds**: Streams live MODIS satellite cloud imagery for the simulated date with ice/salt masking.
- **Yale Stars & Milky Way**: Pinpoint catalog stars with accurate spectral colors.
- **Orbit Paths & Nodes**: Renders ecliptic orbital paths, ascending/descending nodes, and line of nodes.
- **Shadow Umbra Cones**: 3D geometric shadow cones visualizing solar and lunar eclipse geometry.
- **Earth Axis & Equator**: Visualizes axial tilt ($23.44^\circ$) and the celestial equator.
- **Atmospheric Glow**: Rayleigh scattering limb halo around Earth.

---

### 7. Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Pause / Resume simulation time |
| `1` | Focus camera on **Earth** |
| `2` | Focus camera on **Moon** |
| `3` | Focus camera on **System** |
| `4` | Focus camera on **Sun** |
| `5` | Focus camera on **Apollo Earthrise** |
| `0` | Focus camera on **My Location (India / Local)** |
| `[` | Decrease warp speed / step in reverse |
| `]` | Increase warp speed / step forward |
| `N` | Return immediately to Live Real-Time clock |
| `C` | Toggle Earth country labels |
| `M` | Toggle Moon feature labels |
| `G` | Toggle Lat/Lon graticule grid |

---

## 🌟 Key Astronomical & Graphical Features

1. **Rigorous Ephemeris**: Powered by `astronomy-engine`, accounting for $\Delta T$, nutation, and aberration with accuracy to $\sim 1$ arcminute.
2. **IAU Lunar Orientation & Libration**: Computes physical and optical libration in both latitude and longitude, accurately orienting the lunar face and pole.
3. **Earth GAST Precession**: Axial rotation aligned to Greenwich Apparent Sidereal Time with zero secular drift across 1950–2090.
4. **Day/Night Terminator GLSL Shaders**: Rayleigh twilight scattering (civil, nautical, astronomical), ocean specular sun glints, and Black Marble night city lights.
5. **Solar Eclipse Projections**: Dynamically casts the Moon's shadow umbra and penumbra directly onto Earth's continents and clouds.

---

## 📁 Project Structure

```
solar_system_sun-earth-lunar/
├── index.html               # Main WebGL viewport & HTML structure
├── package.json             # NPM dependencies & test/start scripts
├── server.js                # Zero-dependency local HTTP server
├── README.md                # Comprehensive user guide & documentation
├── assets/
│   ├── data/
│   │   ├── countries.geojson           # Natural Earth 177 country boundaries
│   │   ├── countries_processed.json    # Verified geographical centroids
│   │   ├── moon_features.json          # IAU lunar features & landing sites
│   │   └── bsc5p_radec_min.json        # Yale Bright Star Catalog (~9,000 stars)
│   └── textures/
│       ├── 8k_earth_daymap.jpg         # 8K Earth day albedo texture
│       ├── 8k_earth_nightmap.jpg       # 8K NASA Black Marble city lights
│       ├── 8k_earth_specular_map.png   # 8K Ocean/water specular map
│       ├── 8k_earth_clouds.jpg         # 8K NASA master cloud composite
│       ├── 8k_moon.jpg                 # 8K NASA LRO lunar topography
│       ├── 8k_stars_milky_way.jpg      # 8K Deep-space Milky Way background
│       └── seasonal/                   # 12 monthly 8K NASA Blue Marble textures
├── scripts/
│   ├── download_assets.py              # Automated asset downloader
│   ├── verify_browser.js               # Headless Edge automated browser test
│   └── verify_india_night.js           # India nighttime synchronization test
├── src/
│   ├── main.js              # Application entry point & render loop
│   ├── scene.js             # Three.js 3D solar system scene & hierarchy
│   ├── ephemeris.js         # Astronomy Engine wrapper & ephemeris adapter
│   ├── shaders.js           # GLSL shaders (Day/Night, terminator, halo, Sun)
│   ├── textures.js          # Texture loaders & canvas synthesis fallbacks
│   ├── clouds.js            # Live NASA GIBS daily satellite cloud manager
│   ├── places.js            # Country & lunar feature identification engine
│   ├── picking.js           # Raycasting click/hover surface picker
│   ├── labels.js            # Decluttered HTML label overlay engine
│   ├── cameraController.js  # Smooth orbit navigation & focus tracking
│   ├── timeController.js    # Simulation clock, time warp & scrubber
│   └── ui.js                # Telemetry cockpit HUD & UI wiring
├── styles/
│   └── main.css             # Glassmorphism cockpit HUD stylesheet
├── tests/
│   ├── test_ephemeris.js    # 30 tests for orbital mathematics & bounds
│   ├── test_integration.js  # 17 tests for 3D scene hierarchy & materials
│   ├── test_v2_features.js  # 108 tests for seasonal alignment & eclipses
│   ├── test_round2_review.js# 31 tests for IAU libration & GIBS mapping
│   └── test_server.js       # 24 HTTP static asset endpoint checks
└── vendor/
    ├── astronomy.browser.js # Bundled Astronomy Engine (browser)
    ├── astronomy.js         # Bundled Astronomy Engine (Node.js)
    ├── three.module.js      # Three.js ES module
    ├── three.core.js        # Three.js core bundle
    └── jsm/controls/
        └── OrbitControls.js # Three.js OrbitControls
```

---

## 🧪 Testing & Verification

Run the full automated test suite (210 passing tests):
```bash
npm test
```

### What is verified:
- **Astronomical Math**: Julian Date, GAST rate, obliquity, solstice/equinox angles, perihelion/aphelion distances, and eclipse syzygy.
- **IAU Lunar Motion**: Sub-Earth libration within $0.024^\circ$ across 1969–2050 against JPL Horizons references.
- **Frame Precession**: Zero secular subsolar drift from 1950 through 2090.
- **Headless Browser Execution**: Runs automated test in Microsoft Edge / Chrome with zero uncaught errors.
- **Static Asset Serving**: All 24 core assets and 8K textures return HTTP 200 OK.

---

## 📜 Attribution & Credits

- **NASA Earth Observatory**: Blue Marble Next Generation 12-month global textures and Black Marble night lights.
- **NASA GIBS / EOSDIS**: Real-time MODIS Terra Corrected Reflectance daily satellite cloud imagery.
- **NASA / GSFC / SVS / LROC**: Lunar Reconnaissance Orbiter topographic surface maps and elevation data.
- **Solar System Scope**: 8K Earth day, night, cloud, and Milky Way textures ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- **Natural Earth**: Sovereign country boundaries and cultural vector polygons (Public Domain).
- **IAU / USGS Gazetteer of Planetary Nomenclature**: Lunar feature names, coordinates, and crater catalogs.
- **Astronomy Engine**: Don Cross ([MIT License](https://github.com/cosinekitty/astronomy)).
- **Three.js**: Ricardo Cabello (Mr.doob) and contributors ([MIT License](https://threejs.org/)).
