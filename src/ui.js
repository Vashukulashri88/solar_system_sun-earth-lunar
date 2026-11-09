export class UserInterface {
  constructor(container, timeController, sceneManager, cameraController, placesManager = null, labelsManager = null, pickingManager = null) {
    this.container = container;
    this.time = timeController;
    this.scene = sceneManager;
    this.camera = cameraController;
    this.places = placesManager;
    this.labels = labelsManager;
    this.picking = pickingManager;

    this.inspectedPlace = null;

    this.createDom();
    this.attachEvents();
    this.attachKeyboardShortcuts();
  }

  createDom() {
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'astronomy-hud';
    this.hudElement.innerHTML = `
      <!-- TOP NAVIGATION BAR -->
      <header class="hud-header glass-panel">
        <div class="logo-title">
          <span class="icon">🪐</span>
          <div>
            <h1>ORBITAL EPHEMERIS ENGINE</h1>
            <p class="subtitle">REAL-TIME EARTH • SUN • MOON DYNAMICS</p>
          </div>
        </div>

        <!-- SEARCH BAR (EARTH COUNTRIES & MOON FEATURES) -->
        <div class="search-container">
          <input type="text" id="placeSearchInput" class="search-input" placeholder="🔍 Search country or moon feature (e.g. Japan, Apollo 11, Tycho)..." autocomplete="off" />
          <div id="searchResultsDropdown" class="search-dropdown hidden"></div>
        </div>

        <div class="status-indicator">
          <span id="liveStatusBadge" class="badge live-badge">● LIVE SYNC</span>
          <span id="cloudStatusBadge" class="badge" title="NASA GIBS Cloud Status">☁️ GIBS LIVE</span>
          <button id="creditsBtn" class="badge btn-credits" title="Astronomical Data Sources & Attributions">ℹ️ CREDITS</button>
          <span id="utcClock" class="clock-display">UTC --:--:--</span>
        </div>
      </header>

      <!-- LEFT SIDEBAR: ASTRONOMICAL TELEMETRY & PLACE INSPECTOR -->
      <aside class="hud-sidebar-left">
        <!-- PLACE INSPECTOR CARD -->
        <div id="placeInspectorCard" class="card glass-panel place-inspector hidden">
          <div class="card-title">
            <span id="placeInspectorHeader">📍 LOCATION INSPECTOR</span>
            <button id="closeInspectorBtn" class="btn-close" title="Close Inspector">✕</button>
          </div>
          <div class="place-inspector-body">
            <div class="place-header">
              <div id="placeName" class="place-title">--</div>
              <div id="placeSubtitle" class="place-subtitle">--</div>
              <div id="placeCoords" class="place-coords">--</div>
            </div>

            <!-- Earth specific telemetry -->
            <div id="earthInspectorFields" class="telemetry-grid">
              <div class="tel-item">
                <span class="label">True Solar Time:</span>
                <span id="placeSolarTime" class="value">--:--:--</span>
              </div>
              <div class="tel-item">
                <span class="label">Sun Elevation:</span>
                <span id="placeSunAlt" class="value">--°</span>
              </div>
              <div class="tel-item full-width">
                <span class="label">Day/Night State:</span>
                <span id="placeDayNight" class="value">--</span>
              </div>
              <div class="tel-item full-width">
                <span class="label">Moon in Sky:</span>
                <span id="placeMoonAlt" class="value">--</span>
              </div>
            </div>

            <!-- Moon specific telemetry -->
            <div id="moonInspectorFields" class="telemetry-grid hidden">
              <div class="tel-item full-width">
                <span class="label">Earth Visibility:</span>
                <span id="placeEarthVis" class="value">--</span>
              </div>
              <div class="tel-item full-width">
                <span class="label">Sunlight:</span>
                <span id="placeMoonSun" class="value">--</span>
              </div>
              <div class="tel-item full-width" id="placeNearestLandingWrap">
                <span class="label">Nearest Mission:</span>
                <span id="placeNearestLanding" class="value">--</span>
              </div>
              <div class="tel-item full-width" id="placeDescWrap">
                <span class="label">Details:</span>
                <span id="placeDescription" class="value" style="font-size: 10px; font-weight: normal; line-height: 1.3;">--</span>
              </div>
            </div>

            <div style="margin-top: 8px;">
              <button id="flyToInspectedBtn" class="btn btn-primary" style="width: 100%;">✈️ Focus Camera Here</button>
            </div>
          </div>
        </div>

        <!-- ECLIPSE MONITOR CARD -->
        <div id="eclipseCard" class="card glass-panel eclipse-monitor">
          <div class="card-title">
            <span>🛡️ ECLIPSE DETECTION</span>
            <span id="eclipseBadge" class="badge">NONE</span>
          </div>
          <div id="eclipseDetails" class="telemetry-row">
            <span>Angular Alignment:</span>
            <span id="eclipseSeparation" class="value">--°</span>
          </div>
        </div>

        <!-- TIME & CHRONOMETRY CARD -->
        <div class="card glass-panel">
          <div class="card-title">⏱️ CHRONOMETRY</div>
          <div class="telemetry-grid">
            <div class="tel-item">
              <span class="label">Julian Date (JD):</span>
              <span id="julianDateVal" class="value">--</span>
            </div>
            <div class="tel-item">
              <span class="label">Centuries (T):</span>
              <span id="julianCenturiesVal" class="value">--</span>
            </div>
            <div class="tel-item">
              <span class="label">Sidereal Time (GMST):</span>
              <span id="gmstVal" class="value">--°</span>
            </div>
            <div class="tel-item">
              <span class="label">Axial Tilt (Obliquity):</span>
              <span id="obliquityVal" class="value">23.439°</span>
            </div>
          </div>
        </div>

        <!-- SUN TELEMETRY CARD -->
        <div class="card glass-panel">
          <div class="card-title">☀️ SUN TELEMETRY</div>
          <div class="telemetry-grid">
            <div class="tel-item">
              <span class="label">Distance:</span>
              <span id="sunDistKm" class="value">-- km</span>
            </div>
            <div class="tel-item">
              <span class="label">Distance (AU):</span>
              <span id="sunDistAu" class="value">-- AU</span>
            </div>
            <div class="tel-item">
              <span class="label">Subsolar Latitude:</span>
              <span id="sunDec" class="value">--°</span>
            </div>
            <div class="tel-item">
              <span class="label">Subsolar Longitude:</span>
              <span id="subsolarLon" class="value">--°</span>
            </div>
            <div class="tel-item full-width">
              <span class="label">Right Ascension / Dec:</span>
              <span id="sunRaDec" class="value">-- / --</span>
            </div>
          </div>
        </div>

        <!-- MOON TELEMETRY CARD -->
        <div class="card glass-panel">
          <div class="card-title">🌙 MOON TELEMETRY</div>
          <div class="moon-phase-hero">
            <div id="moonPhaseIcon" class="phase-icon">🌓</div>
            <div>
              <div id="moonPhaseName" class="phase-name">Waxing Gibbous</div>
              <div id="moonPhasePercent" class="phase-percent">78% Illuminated</div>
            </div>
          </div>
          <div class="telemetry-grid">
            <div class="tel-item">
              <span class="label">Distance:</span>
              <span id="moonDistKm" class="value">-- km</span>
            </div>
            <div class="tel-item">
              <span class="label">Ecliptic Inclination:</span>
              <span id="moonLatDeg" class="value">--°</span>
            </div>
            <div class="tel-item">
              <span class="label">Sublunar Latitude:</span>
              <span id="moonDec" class="value">--°</span>
            </div>
            <div class="tel-item">
              <span class="label">Sublunar Longitude:</span>
              <span id="sublunarLon" class="value">--°</span>
            </div>
            <div class="tel-item full-width">
              <span class="label">Ascending Node (Ω):</span>
              <span id="moonNodeDeg" class="value">--°</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- RIGHT SIDEBAR: CONTROLS & PRESETS -->
      <aside class="hud-sidebar-right">
        <!-- CAMERA VIEWPORTS -->
        <div class="card glass-panel">
          <div class="card-title">🎥 CAMERA TARGET</div>
          <div class="button-group-grid">
            <button id="camEarthBtn" class="btn active" title="Focus Earth Orbit [Key: 1]">🌍 Earth</button>
            <button id="camMoonBtn" class="btn" title="Focus Lunar Orbit [Key: 2]">🌙 Moon</button>
            <button id="camSystemBtn" class="btn" title="Focus Earth-Moon System [Key: 3]">🪐 System</button>
            <button id="camSunBtn" class="btn" title="Heliocentric View [Key: 4]">☀️ Sun</button>
            <button id="camEarthriseBtn" class="btn full-width" title="View from Moon Surface looking at Earth [Key: 5]">🚀 Apollo Earthrise</button>
            <button id="camMyLocationBtn" class="btn full-width" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.15);" title="Focus My Local Country on Earth [Key: 0]">📍 My Location (India / Local)</button>
          </div>
        </div>

        <!-- SCALE MODES -->
        <div class="card glass-panel">
          <div class="card-title">📐 SCALE SYSTEM</div>
          <div class="button-group-toggle">
            <button id="scaleVisualBtn" class="btn active" title="Enhanced planet scales for clear visibility of phases & terminator">Visual Exploration</button>
            <button id="scaleTrueBtn" class="btn" title="100% true physical kilometer distances & radii">1:1 Metric Scale</button>
          </div>
          <p id="scaleDescription" class="hint-text">Visual scale enlarges bodies proportionally for optimal viewing of day/night and phases while preserving true orbital mechanics.</p>
        </div>

        <!-- ASTRONOMICAL PRESETS -->
        <div class="card glass-panel">
          <div class="card-title">🌌 ASTRONOMICAL EVENTS</div>
          <select id="presetSelect" class="hud-select">
            <option value="now">⚡ Current Real-Time (Live Sync)</option>
            <option value="eclipse2024">🌑 Total Solar Eclipse (Apr 8, 2024)</option>
            <option value="eclipse2017">🌑 Total Solar Eclipse (Aug 21, 2017)</option>
            <option value="annular2023">💍 Annular Eclipse 'Ring of Fire' (Oct 14, 2023)</option>
            <option value="lunar2022">🩸 Total Lunar Blood Moon (Nov 8, 2022)</option>
            <option value="lunar2025">🩸 Total Lunar Eclipse (Mar 14, 2025)</option>
            <option value="summerSolstice">☀️ Summer Solstice (Jun 20, 2024)</option>
            <option value="winterSolstice">❄️ Winter Solstice (Dec 21, 2024)</option>
            <option value="vernalEquinox">🌱 Vernal Equinox (Mar 20, 2024)</option>
            <option value="perihelion">🔥 Perihelion: Closest to Sun (Jan 3)</option>
            <option value="aphelion">🧊 Aphelion: Farthest from Sun (Jul 5)</option>
          </select>
        </div>

        <!-- VISUAL DISPLAY TOGGLES -->
        <div class="card glass-panel">
          <div class="card-title">👁️ VISUAL LAYERS</div>
          <div class="toggles-grid">
            <label class="toggle-item">
              <input type="checkbox" id="toggleCountryLabels" checked>
              <span>🌍 Country Labels (Earth) [C]</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleMoonLabels" checked>
              <span>🌙 Moon Features & Landings [M]</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleGraticule">
              <span>🌐 Lat/Lon Graticule Grid [G]</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleSeasonal" checked>
              <span>🍃 Seasonal Blue Marble (12 Mo)</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleLiveClouds" checked>
              <span>☁️ NASA Daily GIBS Clouds</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleStars" checked>
              <span>✨ Yale Stars & Milky Way</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleOrbits" checked>
              <span>Orbit Paths & Nodes</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleShadows" checked>
              <span>Shadow Umbra Cones</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleGrid" checked>
              <span>Ecliptic Grid & Equinox</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleAxis" checked>
              <span>Earth Axis & Equator</span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" id="toggleAtmosphere" checked>
              <span>Atmospheric Glow</span>
            </label>
          </div>
        </div>
      </aside>

      <!-- BOTTOM CONTROL BAR: TIME CONTROL & TIME TRAVEL -->
      <footer class="hud-footer glass-panel">
        <div class="time-transport">
          <button id="liveBtn" class="btn btn-primary" title="Sync with current real-world UTC time [Key: L]">⚡ LIVE</button>
          <button id="playPauseBtn" class="btn btn-icon" title="Play / Pause [Key: Space]">⏸️</button>

          <!-- SIGNED TIME WARP SELECTOR (REVERSE & FORWARD) -->
          <div class="time-warp-buttons">
            <button class="btn btn-warp rewind" data-warp="-31557600" title="Rewind 1 Year / second">-1yr/s</button>
            <button class="btn btn-warp rewind" data-warp="-2592000" title="Rewind 1 Month / second">-1mo/s</button>
            <button class="btn btn-warp rewind" data-warp="-86400" title="Rewind 1 Day / second">-1d/s</button>
            <button class="btn btn-warp rewind" data-warp="-3600" title="Rewind 1 Hour / second">-1h/s</button>
            <button class="btn btn-warp rewind" data-warp="-60" title="Rewind 1 Minute / second">-1m/s</button>
            <button class="btn btn-warp rewind" data-warp="-1" title="Reverse Real-Time">-1x</button>
            <button class="btn btn-warp active" data-warp="1" title="Normal Real-Time">1x</button>
            <button class="btn btn-warp" data-warp="60" title="1 Minute / second">1m/s</button>
            <button class="btn btn-warp" data-warp="3600" title="1 Hour / second">1h/s</button>
            <button class="btn btn-warp" data-warp="86400" title="1 Day / second">1d/s</button>
            <button class="btn btn-warp" data-warp="2592000" title="1 Month / second">1mo/s</button>
            <button class="btn btn-warp" data-warp="31557600" title="1 Year / second">1yr/s</button>
          </div>

          <!-- STEPPING CONTROLS -->
          <div class="step-buttons">
            <button id="stepBackDayBtn" class="btn" title="Back 1 Day [Key: Left Arrow]">◀ -1d</button>
            <button id="stepForwardDayBtn" class="btn" title="Forward 1 Day [Key: Right Arrow]">+1d ▶</button>
            <button id="stepBackMonthBtn" class="btn" title="Back 1 Lunar Month">◀ -1mo</button>
            <button id="stepForwardMonthBtn" class="btn" title="Forward 1 Lunar Month">+1mo ▶</button>
          </div>

          <!-- DATE PICKER & GO -->
          <div class="date-picker-wrap">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">Local:</span>
            <input type="datetime-local" id="datePickerInput" class="date-input" title="Set simulation date & local time">
            <button id="jumpDateBtn" class="btn">Go</button>
          </div>
        </div>

        <!-- TIMELINE SCRUBBER ROW -->
        <div class="timeline-scrubber-row">
          <span class="scrubber-label">Timeline Scrubber:</span>
          <div class="scrubber-span-selector">
            <button class="btn btn-span" data-span="day" title="Scrub ±1 Day range">±1 Day</button>
            <button class="btn btn-span active" data-span="month" title="Scrub ±1 Month range">±1 Month</button>
            <button class="btn btn-span" data-span="year" title="Scrub ±1 Year range">±1 Year</button>
          </div>
          <input type="range" id="timeScrubber" class="scrubber-slider" min="-1000" max="1000" value="0" step="1" title="Drag to scrub backward or forward in time">
          <span id="scrubberOffsetDisplay" class="scrubber-offset-text">0.0 d (Now)</span>
          <button id="scrubberResetBtn" class="btn btn-sm" title="Center scrubber slider at current time">Reset</button>
        </div>

        <!-- ASTRONOMICAL EVENT QUICK-JUMP ROW -->
        <div class="event-jumps-row">
          <span style="font-size: 10px; color: #94a3b8; display: flex; align-items: center; margin-right: 4px;">Astronomical Search:</span>
          <button id="prevSolarEclipseBtn" class="btn btn-event" title="Find Previous Solar Eclipse">◀ Prev Solar Eclipse</button>
          <button id="nextSolarEclipseBtn" class="btn btn-event" title="Find Next Solar Eclipse">Next Solar Eclipse ▶</button>
          <button id="prevLunarEclipseBtn" class="btn btn-event" title="Find Previous Lunar Eclipse">◀ Prev Lunar Eclipse</button>
          <button id="nextLunarEclipseBtn" class="btn btn-event" title="Find Next Lunar Eclipse">Next Lunar Eclipse ▶</button>
          <button id="prevMoonPhaseBtn" class="btn btn-event" title="Find Previous New / Full Moon">◀ Prev New/Full Moon</button>
          <button id="nextMoonPhaseBtn" class="btn btn-event" title="Find Next New / Full Moon">Next New/Full Moon ▶</button>
          <button id="nextSeasonBtn" class="btn btn-event" title="Find Next Equinox or Solstice">Next Equinox / Solstice ▶</button>
        </div>
      </footer>

      <!-- ATTRIBUTION & CREDITS MODAL -->
      <div id="creditsModal" class="modal-backdrop hidden">
        <div class="modal-card glass-panel">
          <div class="modal-header">
            <h2>📜 Astronomical Data Sources & Attribution</h2>
            <button id="closeCreditsBtn" class="btn-close" title="Close Credits">✕</button>
          </div>
          <div class="modal-body credits-content">
            <div class="credit-section">
              <h3>🔭 NASA (National Aeronautics and Space Administration)</h3>
              <p>• <strong>NASA Visible Earth / Blue Marble Next Generation:</strong> 12 Monthly 8K (8192×4096) true-color Earth topography and bathymetry composites downsampled from NASA 21600×10800 master imagery.</p>
              <p>• <strong>NASA Earthdata GIBS (Global Imagery Browse Services):</strong> Daily live MODIS Terra satellite corrected reflectance cloud layers with automated N-1/N-2 date fallback and permanent ice masking.</p>
              <p>• <strong>NASA Black Marble & LROC WAC:</strong> High-resolution Earth city lights nightmap and Lunar Reconnaissance Orbiter Camera global lunar mosaic.</p>
            </div>
            <div class="credit-section">
              <h3>🪐 Solar System Scope</h3>
              <p>• <strong>Planetary Surface Textures:</strong> 8K Earth daymap, nightmap, cloud composite, and Moon textures licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.</p>
              <p>• Source: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope Textures</a>.</p>
            </div>
            <div class="credit-section">
              <h3>🌐 Natural Earth</h3>
              <p>• <strong>Cultural Vectors:</strong> Admin 0 Sovereign country boundaries, ISO codes, and geographic polygons in GeoJSON format. Public Domain.</p>
            </div>
            <div class="credit-section">
              <h3>📐 IAU (International Astronomical Union) & USGS</h3>
              <p>• <strong>IAU/IAG WGCCRE Cartographic Model:</strong> Exact Moon north pole RA/Dec, prime meridian rotation angle $W$, and physical libration parameters.</p>
              <p>• <strong>USGS Astrogeology Science Center:</strong> Lunar maria, impact craters, mountain ranges, and Apollo/Luna/Chang'e landing sites coordinates.</p>
            </div>
            <div class="credit-section">
              <h3>⚙️ Astronomy Engine & Algorithms</h3>
              <p>• <strong>Astronomy Engine (Don Cross):</strong> VSOP87 planetary theory, ELP/MPP02 lunar theory, IAU 2006 precession & nutation, GAST, and topocentric observation angles under MIT License.</p>
              <p>• <strong>Jean Meeus:</strong> Astronomical Algorithms (Second Edition).</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.hudElement);
  }

  attachEvents() {
    // Credits Modal
    const creditsBtn = document.getElementById('creditsBtn');
    const creditsModal = document.getElementById('creditsModal');
    const closeCreditsBtn = document.getElementById('closeCreditsBtn');

    if (creditsBtn && creditsModal) {
      creditsBtn.addEventListener('click', () => {
        creditsModal.classList.remove('hidden');
      });
    }
    if (closeCreditsBtn && creditsModal) {
      closeCreditsBtn.addEventListener('click', () => {
        creditsModal.classList.add('hidden');
      });
    }
    if (creditsModal) {
      creditsModal.addEventListener('click', (e) => {
        if (e.target === creditsModal) {
          creditsModal.classList.add('hidden');
        }
      });
    }

    // Time Controls
    const liveBtn = document.getElementById('liveBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const warpBtns = document.querySelectorAll('.btn-warp');
    const stepBackDay = document.getElementById('stepBackDayBtn');
    const stepFwdDay = document.getElementById('stepForwardDayBtn');
    const stepBackMo = document.getElementById('stepBackMonthBtn');
    const stepFwdMo = document.getElementById('stepForwardMonthBtn');
    const dateInput = document.getElementById('datePickerInput');
    const jumpDateBtn = document.getElementById('jumpDateBtn');
    const presetSelect = document.getElementById('presetSelect');

    liveBtn.addEventListener('click', () => {
      this.time.setLive();
      this.updateWarpActiveBtn(1);
    });

    playPauseBtn.addEventListener('click', () => {
      this.time.togglePause();
      playPauseBtn.innerText = this.time.isPaused ? '▶️' : '⏸️';
    });

    warpBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const warp = parseFloat(btn.getAttribute('data-warp'));
        this.time.setTimeScale(warp);
        this.updateWarpActiveBtn(warp);
      });
    });

    stepBackDay.addEventListener('click', () => this.time.step(-86400));
    stepFwdDay.addEventListener('click', () => this.time.step(86400));
    stepBackMo.addEventListener('click', () => this.time.step(-29.53059 * 86400));
    stepFwdMo.addEventListener('click', () => this.time.step(29.53059 * 86400));

    jumpDateBtn.addEventListener('click', () => {
      if (dateInput.value) {
        this.time.setDate(new Date(dateInput.value));
      }
    });

    // Timeline Scrubber
    const scrubber = document.getElementById('timeScrubber');
    const scrubberDisplay = document.getElementById('scrubberOffsetDisplay');
    const scrubberReset = document.getElementById('scrubberResetBtn');
    const spanButtons = document.querySelectorAll('.btn-span');

    this.scrubberSpan = 'month';
    this.scrubberAnchorDate = null;
    this.isScrubbing = false;

    this.spanDurations = {
      day: 86400,
      month: 30 * 86400,
      year: 365.25 * 86400
    };

    spanButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        spanButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.scrubberSpan = btn.getAttribute('data-span');
        this.scrubberAnchorDate = null;
      });
    });

    if (scrubber) {
      const onScrubStart = () => {
        this.isScrubbing = true;
        this.scrubberAnchorDate = new Date(this.time.simulatedDate.getTime());
      };

      const onScrub = () => {
        if (!this.scrubberAnchorDate) {
          this.scrubberAnchorDate = new Date(Date.now());
        }
        const val = parseFloat(scrubber.value); // -1000 to +1000
        const totalSpan = this.spanDurations[this.scrubberSpan] || (30 * 86400);
        const offsetSec = (val / 1000) * totalSpan;
        const targetMs = this.scrubberAnchorDate.getTime() + offsetSec * 1000;
        this.time.setDate(new Date(targetMs));

        if (scrubberDisplay) {
          const abs = Math.abs(offsetSec);
          const sign = offsetSec >= 0 ? '+' : '-';
          if (abs < 3600) {
            scrubberDisplay.innerText = `${sign}${(abs / 60).toFixed(1)} m`;
          } else if (abs < 86400) {
            scrubberDisplay.innerText = `${sign}${(abs / 3600).toFixed(1)} h`;
          } else if (abs < 86400 * 60) {
            scrubberDisplay.innerText = `${sign}${(abs / 86400).toFixed(1)} d`;
          } else {
            scrubberDisplay.innerText = `${sign}${(abs / (86400 * 365.25)).toFixed(2)} yr`;
          }
        }
      };

      const onScrubEnd = () => {
        this.isScrubbing = false;
      };

      scrubber.addEventListener('pointerdown', onScrubStart);
      scrubber.addEventListener('input', onScrub);
      scrubber.addEventListener('change', onScrub);
      scrubber.addEventListener('pointerup', onScrubEnd);
    }

    if (scrubberReset) {
      scrubberReset.addEventListener('click', () => {
        if (scrubber) scrubber.value = 0;
        this.scrubberAnchorDate = null;
        this.isScrubbing = false;
        this.time.setLive();
        if (scrubberDisplay) scrubberDisplay.innerText = '0.0 d (Live)';
      });
    }

    // Preset Astronomical Events
    presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      switch (val) {
        case 'now':
          this.time.setLive();
          this.camera.setFocus('earth');
          break;
        case 'eclipse2024':
          this.time.setDate(new Date('2024-04-08T18:17:00Z'));
          this.camera.setFocus('system');
          break;
        case 'eclipse2017':
          this.time.setDate(new Date('2017-08-21T18:26:00Z'));
          this.camera.setFocus('system');
          break;
        case 'annular2023':
          this.time.setDate(new Date('2023-10-14T17:59:00Z'));
          this.camera.setFocus('system');
          break;
        case 'lunar2022':
          this.time.setDate(new Date('2022-11-08T11:00:00Z'));
          this.camera.setFocus('system');
          break;
        case 'lunar2025':
          this.time.setDate(new Date('2025-03-14T06:59:00Z'));
          this.camera.setFocus('system');
          break;
        case 'summerSolstice':
          this.time.setDate(new Date('2024-06-20T20:51:00Z'));
          this.camera.setFocus('earth');
          break;
        case 'winterSolstice':
          this.time.setDate(new Date('2024-12-21T09:20:00Z'));
          this.camera.setFocus('earth');
          break;
        case 'vernalEquinox':
          this.time.setDate(new Date('2024-03-20T03:06:00Z'));
          this.camera.setFocus('earth');
          break;
        case 'perihelion':
          this.time.setDate(new Date('2024-01-03T00:38:00Z'));
          this.camera.setFocus('sun');
          break;
        case 'aphelion':
          this.time.setDate(new Date('2024-07-05T05:06:00Z'));
          this.camera.setFocus('sun');
          break;
      }
    });

    // Astronomical Event Quick Jump Buttons
    document.getElementById('prevSolarEclipseBtn').addEventListener('click', () => {
      this.time.jumpPrevSolarEclipse();
    });
    document.getElementById('nextSolarEclipseBtn').addEventListener('click', () => {
      this.time.jumpNextSolarEclipse();
    });
    document.getElementById('prevLunarEclipseBtn').addEventListener('click', () => {
      this.time.jumpPrevLunarEclipse();
    });
    document.getElementById('nextLunarEclipseBtn').addEventListener('click', () => {
      this.time.jumpNextLunarEclipse();
    });
    document.getElementById('prevMoonPhaseBtn').addEventListener('click', () => {
      this.time.jumpPrevMoonQuarter();
    });
    document.getElementById('nextMoonPhaseBtn').addEventListener('click', () => {
      this.time.jumpNextMoonQuarter();
    });
    document.getElementById('nextSeasonBtn').addEventListener('click', () => {
      this.time.jumpNextEquinoxOrSolstice();
    });

    // Camera Focus Buttons
    const camButtons = {
      camEarthBtn: 'earth',
      camMoonBtn: 'moon',
      camSystemBtn: 'system',
      camSunBtn: 'sun',
      camEarthriseBtn: 'earthrise',
      camMyLocationBtn: 'my_location'
    };
    Object.keys(camButtons).forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        Object.keys(camButtons).forEach(bId => {
          const b = document.getElementById(bId);
          if (b) b.classList.remove('active');
        });
        btn.classList.add('active');
        this.camera.setFocus(camButtons[id]);
        if (camButtons[id] === 'my_location' && this.places) {
          const userLoc = (this.camera.getUserLocation && this.camera.getUserLocation()) || { name: 'India', lat: 20.59, lon: 78.96 };
          const state = this.scene.lastCelestialState || {};
          const p = this.places.inspectEarth(userLoc.lat, userLoc.lon, state);
          if (p) this.showPlaceInspector(p);
        }
      });
    });

    // Scale Mode
    const scaleVisualBtn = document.getElementById('scaleVisualBtn');
    const scaleTrueBtn = document.getElementById('scaleTrueBtn');
    const scaleDesc = document.getElementById('scaleDescription');

    scaleVisualBtn.addEventListener('click', () => {
      scaleVisualBtn.classList.add('active');
      scaleTrueBtn.classList.remove('active');
      this.scene.scaleMode = 'visual';
      scaleDesc.innerText = 'Visual scale enlarges bodies proportionally for optimal viewing of day/night and phases while preserving true orbital mechanics.';
      this.camera.setFocus(this.camera.targetMode, false);
    });

    scaleTrueBtn.addEventListener('click', () => {
      scaleTrueBtn.classList.add('active');
      scaleVisualBtn.classList.remove('active');
      this.scene.scaleMode = 'true';
      scaleDesc.innerText = '1:1 True metric scale: Earth radius 6,371 km, Moon 1,737 km, Moon distance 384,400 km, Sun distance ~150M km.';
      this.camera.setFocus(this.camera.targetMode, false);
    });

    // Visual Layer Toggles
    const toggleCountryLabels = document.getElementById('toggleCountryLabels');
    const toggleMoonLabels = document.getElementById('toggleMoonLabels');
    const toggleGraticule = document.getElementById('toggleGraticule');
    const toggleSeasonal = document.getElementById('toggleSeasonal');
    const toggleLiveClouds = document.getElementById('toggleLiveClouds');
    const toggleStars = document.getElementById('toggleStars');
    const toggleOrbits = document.getElementById('toggleOrbits');
    const toggleShadows = document.getElementById('toggleShadows');
    const toggleGrid = document.getElementById('toggleGrid');
    const toggleAxis = document.getElementById('toggleAxis');
    const toggleAtmosphere = document.getElementById('toggleAtmosphere');

    if (toggleCountryLabels) {
      toggleCountryLabels.addEventListener('change', () => {
        if (this.labels) this.labels.showEarthLabels = toggleCountryLabels.checked;
      });
    }

    if (toggleMoonLabels) {
      toggleMoonLabels.addEventListener('change', () => {
        if (this.labels) this.labels.showMoonLabels = toggleMoonLabels.checked;
      });
    }

    if (toggleGraticule) {
      toggleGraticule.addEventListener('change', () => {
        if (this.labels) this.labels.setGraticuleVisible(toggleGraticule.checked);
      });
    }

    if (toggleSeasonal) {
      toggleSeasonal.addEventListener('change', () => {
        this.scene.useSeasonalTextures = toggleSeasonal.checked;
      });
    }

    if (toggleLiveClouds) {
      toggleLiveClouds.addEventListener('change', () => {
        this.scene.showClouds = toggleLiveClouds.checked;
      });
    }

    if (toggleStars) {
      toggleStars.addEventListener('change', () => {
        this.scene.showStars = toggleStars.checked;
      });
    }

    toggleOrbits.addEventListener('change', () => this.scene.showOrbits = toggleOrbits.checked);
    toggleShadows.addEventListener('change', () => this.scene.showShadows = toggleShadows.checked);
    toggleGrid.addEventListener('change', () => this.scene.showGrid = toggleGrid.checked);
    toggleAxis.addEventListener('change', () => this.scene.showLabels = toggleAxis.checked);
    toggleAtmosphere.addEventListener('change', () => this.scene.showAtmosphere = toggleAtmosphere.checked);

    // Search input & dropdown
    this.attachSearchEvents();

    // Inspector close button and Fly button
    const closeInspector = document.getElementById('closeInspectorBtn');
    if (closeInspector) {
      closeInspector.addEventListener('click', () => {
        document.getElementById('placeInspectorCard').classList.add('hidden');
        if (this.picking) this.picking.selectedPlace = null;
      });
    }

    const flyBtn = document.getElementById('flyToInspectedBtn');
    if (flyBtn) {
      flyBtn.addEventListener('click', () => {
        if (this.inspectedPlace && this.camera) {
          this.camera.flyToPlace(this.inspectedPlace.body, this.inspectedPlace.lat, this.inspectedPlace.lon);
        }
      });
    }
  }

  attachSearchEvents() {
    const input = document.getElementById('placeSearchInput');
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const q = input.value;
      if (!q || !q.trim() || !this.places) {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
        return;
      }

      const results = this.places.search(q);
      if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-item"><span class="search-item-title">No places found</span></div>`;
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = results.map((r, i) => `
        <div class="search-item" data-index="${i}">
          <div class="search-item-title">
            <span>${r.name}</span>
            <span class="search-item-badge">${r.category}</span>
          </div>
          <div class="search-item-sub">${r.details} (${r.lat.toFixed(1)}°, ${r.lon.toFixed(1)}°)</div>
        </div>
      `).join('');
      dropdown.classList.remove('hidden');

      dropdown.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-index'), 10);
          const chosen = results[idx];
          if (!chosen) return;

          dropdown.classList.add('hidden');
          input.value = chosen.name;

          const state = this.scene.lastCelestialState || {};
          let info = null;
          if (chosen.body === 'earth') {
            info = this.places.inspectEarth(chosen.lat, chosen.lon, state);
          } else {
            info = this.places.inspectMoon(chosen.lat, chosen.lon, state);
          }

          if (this.picking) {
            this.picking.selectPlaceByCoords(chosen.body, chosen.lat, chosen.lon, info);
          }
          if (this.camera) {
            this.camera.flyToPlace(chosen.body, chosen.lat, chosen.lon);
          }
          this.showPlaceInspector(info);
        });
      });
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  attachKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when user is typing in search or date input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.time.togglePause();
          document.getElementById('playPauseBtn').innerText = this.time.isPaused ? '▶️' : '⏸️';
          break;
        case 'KeyL':
          this.time.setLive();
          this.updateWarpActiveBtn(1);
          break;
        case 'KeyG': {
          const gToggle = document.getElementById('toggleGraticule');
          if (gToggle) {
            gToggle.checked = !gToggle.checked;
            if (this.labels) this.labels.setGraticuleVisible(gToggle.checked);
          }
          break;
        }
        case 'KeyC': {
          const cToggle = document.getElementById('toggleCountryLabels');
          if (cToggle) {
            cToggle.checked = !cToggle.checked;
            if (this.labels) this.labels.showEarthLabels = cToggle.checked;
          }
          break;
        }
        case 'KeyM': {
          const mToggle = document.getElementById('toggleMoonLabels');
          if (mToggle) {
            mToggle.checked = !mToggle.checked;
            if (this.labels) this.labels.showMoonLabels = mToggle.checked;
          }
          break;
        }
        case 'ArrowLeft':
          e.preventDefault();
          this.time.step(e.shiftKey ? -3600 : -86400);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.time.step(e.shiftKey ? 3600 : 86400);
          break;
        case 'BracketLeft':
          this.adjustWarpStep(-1);
          break;
        case 'BracketRight':
          this.adjustWarpStep(1);
          break;
        case 'Digit1':
          this.camera.setFocus('earth');
          this.updateActiveCamBtn('camEarthBtn');
          break;
        case 'Digit2':
          this.camera.setFocus('moon');
          this.updateActiveCamBtn('camMoonBtn');
          break;
        case 'Digit3':
          this.camera.setFocus('system');
          this.updateActiveCamBtn('camSystemBtn');
          break;
        case 'Digit4':
          this.camera.setFocus('sun');
          this.updateActiveCamBtn('camSunBtn');
          break;
        case 'Digit5':
          this.camera.setFocus('earthrise');
          this.updateActiveCamBtn('camEarthriseBtn');
          break;
        case 'Digit0':
          this.camera.setFocus('my_location');
          this.updateActiveCamBtn('camMyLocationBtn');
          if (this.places) {
            const userLoc = (this.camera.getUserLocation && this.camera.getUserLocation()) || { name: 'India', lat: 20.59, lon: 78.96 };
            const state = this.scene.lastCelestialState || {};
            const p = this.places.inspectEarth(userLoc.lat, userLoc.lon, state);
            if (p) this.showPlaceInspector(p);
          }
          break;
      }
    });
  }

  adjustWarpStep(direction) {
    const warpSpeeds = [-31557600, -2592000, -86400, -3600, -60, -1, 1, 60, 3600, 86400, 2592000, 31557600];
    let curr = this.time.timeScale;
    let idx = warpSpeeds.indexOf(curr);
    if (idx === -1) {
      idx = warpSpeeds.findIndex(w => w >= curr);
      if (idx === -1) idx = warpSpeeds.length - 1;
    }
    const nextIdx = Math.max(0, Math.min(warpSpeeds.length - 1, idx + direction));
    const nextWarp = warpSpeeds[nextIdx];
    this.time.setTimeScale(nextWarp);
    this.updateWarpActiveBtn(nextWarp);
  }

  updateActiveCamBtn(activeId) {
    const camButtons = ['camEarthBtn', 'camMoonBtn', 'camSystemBtn', 'camSunBtn', 'camEarthriseBtn', 'camMyLocationBtn'];
    camButtons.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === activeId);
    });
  }

  updateWarpActiveBtn(activeWarp) {
    document.querySelectorAll('.btn-warp').forEach(b => {
      const w = parseFloat(b.getAttribute('data-warp'));
      b.classList.toggle('active', w === activeWarp);
    });
  }

  showPlaceInspector(info) {
    if (!info) return;
    this.inspectedPlace = info;

    const card = document.getElementById('placeInspectorCard');
    const headerTitle = document.getElementById('placeInspectorHeader');
    const nameEl = document.getElementById('placeName');
    const subEl = document.getElementById('placeSubtitle');
    const coordsEl = document.getElementById('placeCoords');
    const earthFields = document.getElementById('earthInspectorFields');
    const moonFields = document.getElementById('moonInspectorFields');

    nameEl.innerText = info.title;
    subEl.innerText = info.subtitle;
    coordsEl.innerText = info.formattedCoords;

    if (info.body === 'earth') {
      headerTitle.innerText = '🌍 EARTH LOCATION';
      earthFields.classList.remove('hidden');
      moonFields.classList.add('hidden');

      document.getElementById('placeSolarTime').innerText = info.solarTime;
      document.getElementById('placeSunAlt').innerText = `${info.sunAltitudeDeg >= 0 ? '+' : ''}${info.sunAltitudeDeg.toFixed(1)}°`;
      document.getElementById('placeDayNight').innerText = info.dayNightStatus;
      document.getElementById('placeMoonAlt').innerText = info.moonVisibility;
    } else {
      headerTitle.innerText = '🌙 LUNAR FEATURE';
      earthFields.classList.add('hidden');
      moonFields.classList.remove('hidden');

      document.getElementById('placeEarthVis').innerText = info.earthVisibility;
      document.getElementById('placeMoonSun').innerText = info.sunlightStatus;

      const nearestLandingWrap = document.getElementById('placeNearestLandingWrap');
      if (info.nearestLanding) {
        nearestLandingWrap.classList.remove('hidden');
        document.getElementById('placeNearestLanding').innerText = info.nearestLanding;
      } else {
        nearestLandingWrap.classList.add('hidden');
      }

      const descWrap = document.getElementById('placeDescWrap');
      if (info.description) {
        descWrap.classList.remove('hidden');
        document.getElementById('placeDescription').innerText = info.description;
      } else {
        descWrap.classList.add('hidden');
      }
    }

    card.classList.remove('hidden');
  }

  /**
   * Updates all HUD telemetry elements with live state values
   * @param {Object} state - Celestial state from ephemeris.js
   */
  updateTelemetry(state) {
    const d = state.date;
    const utcStr = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    let localClockStr = '';
    try {
      const localTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      localClockStr = `  •  ${localTime} (${tzName})`;
    } catch (e) {
      // fallback
    }
    const utcClockEl = document.getElementById('utcClock');
    if (utcClockEl) utcClockEl.innerText = `${utcStr}${localClockStr}`;

    const liveBadge = document.getElementById('liveStatusBadge');
    if (liveBadge && this.time.getLiveStatus) {
      const liveStatus = this.time.getLiveStatus();
      liveBadge.className = liveStatus.isLive ? 'badge live-badge' : 'badge sim-badge';
      liveBadge.innerText = liveStatus.text;
      liveBadge.title = liveStatus.subtext;
    }

    // Sync Date Picker input when user is not actively editing it (formatted in local time for datetime-local)
    const dateInput = document.getElementById('datePickerInput');
    if (dateInput && document.activeElement !== dateInput) {
      const yr = d.getFullYear().toString().padStart(4, '0');
      const mo = (d.getMonth() + 1).toString().padStart(2, '0');
      const da = d.getDate().toString().padStart(2, '0');
      const hr = d.getHours().toString().padStart(2, '0');
      const mn = d.getMinutes().toString().padStart(2, '0');
      dateInput.value = `${yr}-${mo}-${da}T${hr}:${mn}`;
    }

    // Sync scrubber slider thumb and readout with simulated offset from Now
    if (!this.isScrubbing) {
      const scrubber = document.getElementById('timeScrubber');
      const scrubberDisplay = document.getElementById('scrubberOffsetDisplay');
      const liveStatus = this.time.getLiveStatus ? this.time.getLiveStatus() : { isLive: false, deltaStr: '' };

      if (liveStatus.isLive) {
        if (scrubber && scrubber.value !== '0') scrubber.value = 0;
        if (scrubberDisplay && scrubberDisplay.innerText !== '0.0 d (Live)') {
          scrubberDisplay.innerText = '0.0 d (Live)';
        }
      } else {
        const offsetSec = (d.getTime() - Date.now()) / 1000;
        const totalSpan = (this.spanDurations && this.spanDurations[this.scrubberSpan]) || (30 * 86400);
        const sliderVal = Math.max(-1000, Math.min(1000, (offsetSec / totalSpan) * 1000));
        if (scrubber) scrubber.value = sliderVal;
        if (scrubberDisplay) {
          scrubberDisplay.innerText = liveStatus.deltaStr;
        }
      }
    }

    // NASA Daily Clouds Status Badge
    const cloudBadge = document.getElementById('cloudStatusBadge');
    if (cloudBadge && this.scene && this.scene.cloudManager) {
      const status = this.scene.cloudManager.getStatus();
      if (this.scene.cloudManager.isUsingLiveGIBS) {
        cloudBadge.className = 'badge live-badge';
        cloudBadge.innerText = status.dateStr ? `☁️ GIBS ${status.dateStr}` : '☁️ GIBS LIVE';
        cloudBadge.title = status.message || `NASA GIBS Satellite Cloud Layer (${status.dateStr})`;
      } else {
        cloudBadge.className = 'badge';
        cloudBadge.innerText = '☁️ 8K COMPOSITE';
        cloudBadge.title = status.message || '8K NASA Cloud Composite (Fallback)';
      }
    }

    // Chronometry
    document.getElementById('julianDateVal').innerText = state.julianDate.toFixed(4);
    document.getElementById('julianCenturiesVal').innerText = state.julianCenturies.toFixed(6);
    document.getElementById('gmstVal').innerText = `${state.gmstDeg.toFixed(2)}° (${this.degToHms(state.gmstDeg)})`;
    document.getElementById('obliquityVal').innerText = `${state.obliquityDeg.toFixed(4)}°`;

    // Sun Telemetry
    document.getElementById('sunDistKm').innerText = `${(state.sun.distanceKm / 1e6).toFixed(3)}M km`;
    document.getElementById('sunDistAu').innerText = `${state.sun.distanceAU.toFixed(5)} AU`;
    document.getElementById('sunDec').innerText = `${state.subsolar.latitudeDeg.toFixed(2)}°`;
    document.getElementById('subsolarLon').innerText = `${state.subsolar.longitudeDeg.toFixed(2)}°`;
    document.getElementById('sunRaDec').innerText = `RA ${state.sun.rightAscensionDeg.toFixed(1)}° | Dec ${state.sun.declinationDeg.toFixed(1)}°`;

    // Moon Telemetry
    document.getElementById('moonDistKm').innerText = `${Math.round(state.moon.distanceKm).toLocaleString()} km`;
    document.getElementById('moonLatDeg').innerText = `${state.moon.eclipticLatitudeDeg.toFixed(2)}°`;
    document.getElementById('moonDec').innerText = `${state.sublunar.latitudeDeg.toFixed(2)}°`;
    document.getElementById('sublunarLon').innerText = `${state.sublunar.longitudeDeg.toFixed(2)}°`;
    document.getElementById('moonNodeDeg').innerText = `${state.moon.ascendingNodeDeg.toFixed(1)}°`;

    // Moon Phase
    const phaseIcons = {
      'New Moon': '🌑',
      'Waxing Crescent': '🌒',
      'First Quarter': '🌓',
      'Waxing Gibbous': '🌔',
      'Full Moon': '🌕',
      'Waning Gibbous': '🌖',
      'Last Quarter': '🌗',
      'Waning Crescent': '🌘'
    };
    document.getElementById('moonPhaseIcon').innerText = phaseIcons[state.moonPhase.phaseName] || '🌕';
    document.getElementById('moonPhaseName').innerText = state.moonPhase.phaseName;
    document.getElementById('moonPhasePercent').innerText = `${state.moonPhase.phasePercent}% Illuminated`;

    // Eclipse Monitor
    const eclipseCard = document.getElementById('eclipseCard');
    const eclipseBadge = document.getElementById('eclipseBadge');
    const eclipseSep = document.getElementById('eclipseSeparation');

    eclipseSep.innerText = `${state.eclipse.angularSeparationDeg.toFixed(2)}°`;

    if (state.eclipse.isSolarEclipse) {
      eclipseCard.className = 'card glass-panel eclipse-monitor active-solar';
      eclipseBadge.className = 'badge solar-badge';
      eclipseBadge.innerText = `🚨 ${state.eclipse.solarEclipseType.toUpperCase()}`;
    } else if (state.eclipse.isLunarEclipse) {
      eclipseCard.className = 'card glass-panel eclipse-monitor active-lunar';
      eclipseBadge.className = 'badge lunar-badge';
      eclipseBadge.innerText = `🩸 ${state.eclipse.lunarEclipseType.toUpperCase()}`;
    } else {
      eclipseCard.className = 'card glass-panel eclipse-monitor';
      eclipseBadge.className = 'badge';
      eclipseBadge.innerText = 'NO ECLIPSE';
    }

    // If a place is currently inspected on Earth, keep its local solar time & altitudes updating in real time
    if (this.inspectedPlace && this.inspectedPlace.body === 'earth' && this.places) {
      const refreshed = this.places.inspectEarth(this.inspectedPlace.lat, this.inspectedPlace.lon, state);
      document.getElementById('placeSolarTime').innerText = refreshed.solarTime;
      document.getElementById('placeSunAlt').innerText = `${refreshed.sunAltitudeDeg >= 0 ? '+' : ''}${refreshed.sunAltitudeDeg.toFixed(1)}°`;
      document.getElementById('placeDayNight').innerText = refreshed.dayNightStatus;
      document.getElementById('placeMoonAlt').innerText = refreshed.moonVisibility;
    }
  }

  degToHms(deg) {
    const hours = (deg / 15) % 24;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
}
