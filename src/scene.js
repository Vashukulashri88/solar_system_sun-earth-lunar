import * as THREE from 'three';
import {
  createSunCanvas,
  getMaxTextureSize,
  clampTextureSize
} from './textures.js';
import {
  createEarthMaterial,
  createAtmosphereHaloMaterial,
  createMoonMaterial,
  createSunMaterial,
  createSunCoronaMaterial
} from './shaders.js';
import { CloudManager } from './clouds.js';
import { ASTRONOMICAL_CONSTANTS } from './ephemeris.js';

export class SolarSystemScene {
  constructor(container) {
    this.container = container;
    this.scaleMode = 'visual'; // 'visual' | 'true'
    this.showOrbits = true;
    this.showShadows = true;
    this.showGrid = true;
    this.showLabels = true;
    this.showAtmosphere = true;
    this.showClouds = true;
    this.showStars = true;
    this.useSeasonalTextures = true;
    this.activeMonthIndex = -1;
    this.lastCelestialState = null;

    this.maxTextureSize = getMaxTextureSize();

    this.initTextures();
    this.initThree();
    this.createStarfield();
    this.createSun();
    this.createEarth();
    this.createMoon();
    this.createOrbitsAndGuides();
    this.setupLighting();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  loadSafeTexture(url, colorSpace = null) {
    const tex = this.textureLoader.load(url, (loaded) => {
      clampTextureSize(loaded, this.maxTextureSize);
    });
    if (colorSpace) tex.colorSpace = colorSpace;
    return tex;
  }

  initTextures() {
    this.textureLoader = new THREE.TextureLoader();

    // 8K Earth Day Map & 12 Seasonal Blue Marble Textures
    this.earthDay8k = this.loadSafeTexture('assets/textures/8k_earth_daymap.jpg', THREE.SRGBColorSpace);

    this.seasonalTextures = [];
    for (let m = 1; m <= 12; m++) {
      const mStr = m.toString().padStart(2, '0');
      const tex = this.loadSafeTexture(`assets/textures/seasonal/earth_month_${mStr}.jpg`, THREE.SRGBColorSpace);
      this.seasonalTextures.push(tex);
    }

    // 8K Earth Night Map (Black Marble)
    this.earthNightTexture = this.loadSafeTexture('assets/textures/8k_earth_nightmap.jpg', THREE.SRGBColorSpace);

    // 8K Specular Map
    this.earthSpecTexture = this.loadSafeTexture('assets/textures/8k_earth_specular_map.png');

    // NASA Live Daily GIBS Clouds with 8K Composite Fallback
    this.cloudManager = new CloudManager('assets/textures/8k_earth_clouds.jpg', { zoomLevel: 2 });
    this.earthCloudTexture = this.cloudManager.getTexture();

    // 8K Moon Map (LROC WAC)
    this.moonTexture = this.loadSafeTexture('assets/textures/8k_moon.jpg', THREE.SRGBColorSpace);

    // 8K Milky Way Starfield
    this.starfieldTexture = this.loadSafeTexture('assets/textures/8k_stars_milky_way.jpg', THREE.SRGBColorSpace);
  }

  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100000
    );
    this.camera.position.set(0, 15, 35);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  createStarfield() {
    const geometry = new THREE.SphereGeometry(45000, 48, 32);
    const material = new THREE.MeshBasicMaterial({
      map: this.starfieldTexture,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.starfieldMesh = new THREE.Mesh(geometry, material);
    this.starfieldMesh.renderOrder = -1000;
    this.scene.add(this.starfieldMesh);

    this.loadYaleStars();
  }

  async loadYaleStars() {
    try {
      const res = await fetch('assets/data/bsc5p_radec_min.json');
      if (!res.ok) return;
      const stars = await res.json();
      const positions = new Float32Array(stars.length * 3);
      const colors = new Float32Array(stars.length * 3);
      const radius = 44000;

      stars.forEach((s, i) => {
        const ra = s.r;
        const dec = s.d;
        positions[i * 3] = radius * Math.cos(dec) * Math.cos(ra);
        positions[i * 3 + 1] = radius * Math.sin(dec);
        positions[i * 3 + 2] = -radius * Math.cos(dec) * Math.sin(ra);
        const col = s.K || { r: 1.0, g: 0.95, b: 0.9 };
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      });

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 2.2,
        vertexColors: true,
        transparent: false,
        depthWrite: false,
        depthTest: true,
        sizeAttenuation: false
      });

      this.yaleStarsMesh = new THREE.Points(geom, mat);
      this.yaleStarsMesh.renderOrder = -999;
      this.scene.add(this.yaleStarsMesh);
    } catch (e) {
      // In headless test environments fetch may not be available
    }
  }

  createSun() {
    this.sunGroup = new THREE.Group();
    this.scene.add(this.sunGroup);

    const sunCanvas = createSunCanvas(1024, 512);
    this.sunTexture = new THREE.CanvasTexture(sunCanvas);
    this.sunMaterial = createSunMaterial(this.sunTexture);

    // Sun Sphere
    this.sunRadius = 4.5;
    this.sunGeometry = new THREE.SphereGeometry(this.sunRadius, 48, 48);
    this.sunMesh = new THREE.Mesh(this.sunGeometry, this.sunMaterial);
    this.sunGroup.add(this.sunMesh);

    // Sun Corona Glow Sprite
    const coronaMaterial = createSunCoronaMaterial();
    this.coronaSprite = new THREE.Sprite(coronaMaterial);
    this.coronaSprite.scale.set(22, 22, 1);
    this.sunGroup.add(this.coronaSprite);
  }

  createEarth() {
    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    // Earth Sphere with Day/Night custom shader using 8K/Seasonal textures
    this.earthRadius = 1.0;
    this.earthGeometry = new THREE.SphereGeometry(this.earthRadius, 64, 64);
    this.earthMaterial = createEarthMaterial(
      this.seasonalTextures[0] || this.earthDay8k,
      this.earthNightTexture,
      this.earthSpecTexture
    );

    // Tilt group for Earth's axial tilt (obliquity 23.439°)
    this.earthTiltGroup = new THREE.Group();
    this.earthGroup.add(this.earthTiltGroup);

    // Earth mesh spins inside tilt group
    this.earthMesh = new THREE.Mesh(this.earthGeometry, this.earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.receiveShadow = true;
    this.earthTiltGroup.add(this.earthMesh);

    // Earth Clouds Sphere (elevated)
    const cloudGeometry = new THREE.SphereGeometry(this.earthRadius * 1.012, 64, 64);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: this.earthCloudTexture,
      alphaMap: this.earthCloudTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      roughness: 1.0,
      depthWrite: false
    });
    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.earthTiltGroup.add(this.cloudMesh);

    // Atmospheric Halo Mesh (1.018 earth radius ~115 km physical exosphere)
    const atmoGeometry = new THREE.SphereGeometry(this.earthRadius * 1.018, 64, 64);
    this.atmoHaloMaterial = createAtmosphereHaloMaterial();
    this.atmoHaloMesh = new THREE.Mesh(atmoGeometry, this.atmoHaloMaterial);
    this.earthTiltGroup.add(this.atmoHaloMesh);

    // Axis indicator arrow (North Pole pointing towards Polaris)
    const axisDir = new THREE.Vector3(0, 1, 0);
    const axisLength = 1.6;
    this.axisHelper = new THREE.ArrowHelper(axisDir, new THREE.Vector3(0, 0, 0), axisLength, 0x38bdf8, 0.2, 0.1);
    this.axisHelper.line.material.linewidth = 2;
    this.earthTiltGroup.add(this.axisHelper);

    // Equator ring indicator
    const equatorGeom = new THREE.BufferGeometry();
    const equatorPts = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      equatorPts.push(new THREE.Vector3(Math.cos(theta) * 1.02, 0, Math.sin(theta) * 1.02));
    }
    equatorGeom.setFromPoints(equatorPts);
    this.equatorLine = new THREE.Line(equatorGeom, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 }));
    this.earthTiltGroup.add(this.equatorLine);
  }

  createMoon() {
    this.moonGroup = new THREE.Group();
    this.scene.add(this.moonGroup);

    this.moonRadius = 0.2725;
    this.moonGeometry = new THREE.SphereGeometry(this.moonRadius, 64, 64);
    this.moonMaterial = createMoonMaterial(this.moonTexture);

    this.moonMesh = new THREE.Mesh(this.moonGeometry, this.moonMaterial);
    this.moonMesh.castShadow = true;
    this.moonMesh.receiveShadow = true;
    this.moonGroup.add(this.moonMesh);
  }

  setupLighting() {
    // Ambient space light for non-illuminated sides
    this.ambientLight = new THREE.AmbientLight(0x0c1220, 0.2);
    this.scene.add(this.ambientLight);

    // Omnidirectional solar radiance from the Sun
    this.sunPointLight = new THREE.PointLight(0xfffaed, 2.5, 0, 0.02);
    this.sunGroup.add(this.sunPointLight);

    // Directional sunlight coming from the Sun towards Earth and Moon for sharp shadows
    this.sunLight = new THREE.DirectionalLight(0xfffbf0, 2.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.bias = -0.0005;

    // Set shadow camera bounds to encapsulate Earth-Moon system
    const d = 18;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;

    this.scene.add(this.sunLight);
    this.sunLight.target = this.earthGroup;
  }

  createOrbitsAndGuides() {
    // Earth Orbit Path around Sun
    const earthOrbitGeom = new THREE.BufferGeometry();
    const pts = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)));
    }
    earthOrbitGeom.setFromPoints(pts);
    this.earthOrbitLine = new THREE.Line(
      earthOrbitGeom,
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 })
    );
    this.scene.add(this.earthOrbitLine);

    // Moon Orbit Path around Earth
    const moonOrbitGeom = new THREE.BufferGeometry();
    const moonPts = [];
    for (let i = 0; i <= 96; i++) {
      const theta = (i / 96) * Math.PI * 2;
      moonPts.push(new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)));
    }
    moonOrbitGeom.setFromPoints(moonPts);
    this.moonOrbitLine = new THREE.Line(
      moonOrbitGeom,
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 })
    );
    this.scene.add(this.moonOrbitLine);

    // Ecliptic Plane Grid
    this.eclipticGrid = new THREE.GridHelper(60, 30, 0x1e3a8a, 0x0f172a);
    this.eclipticGrid.position.y = 0;
    this.scene.add(this.eclipticGrid);

    // Line of Nodes Guide between Earth and Moon
    const nodeGeom = new THREE.BufferGeometry();
    nodeGeom.setFromPoints([new THREE.Vector3(-15, 0, 0), new THREE.Vector3(15, 0, 0)]);
    this.lineOfNodes = new THREE.Line(
      nodeGeom,
      new THREE.LineDashedMaterial({ color: 0xeab308, dashSize: 0.5, gapSize: 0.25, transparent: true, opacity: 0.7 })
    );
    this.lineOfNodes.computeLineDistances();
    this.scene.add(this.lineOfNodes);

    // Vernal Equinox Direction Arrow (+X axis)
    const eqDir = new THREE.Vector3(1, 0, 0);
    this.vernalEquinoxArrow = new THREE.ArrowHelper(eqDir, new THREE.Vector3(0, 0, 0), 25, 0x10b981, 1.2, 0.6);
    this.scene.add(this.vernalEquinoxArrow);

    // Umbra Shadow Cone Geometry (Earth Umbra: base starts behind Earth surface, tip points away)
    const umbraGeom = new THREE.ConeGeometry(1.0, 15, 32, 1, true);
    umbraGeom.rotateX(Math.PI / 2);
    umbraGeom.translate(0, 0, 7.5 + 1.05);
    const umbraMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      side: THREE.FrontSide,
      depthWrite: false
    });
    this.earthUmbraCone = new THREE.Mesh(umbraGeom, umbraMat);
    this.earthGroup.add(this.earthUmbraCone);

    // Moon Umbra Shadow Cone (base starts behind Moon surface, tip points away)
    const moonUmbraGeom = new THREE.ConeGeometry(0.27, 8, 24, 1, true);
    moonUmbraGeom.rotateX(Math.PI / 2);
    moonUmbraGeom.translate(0, 0, 4 + 0.30);
    this.moonUmbraCone = new THREE.Mesh(moonUmbraGeom, umbraMat);
    this.moonGroup.add(this.moonUmbraCone);
  }

  /**
   * Updates all 3D scene objects with real astronomical ephemeris state
   * @param {Object} state - Celestial state from ephemeris.js
   * @param {number} timeSeconds - Elapsed seconds for animations
   */
  update(state, timeSeconds = 0) {
    const isVisual = (this.scaleMode === 'visual');

    // Sun Shader Time Uniform
    if (this.sunMaterial.uniforms) {
      this.sunMaterial.uniforms.uTime.value = timeSeconds;
    }

    // Set Radii and Distances according to scale mode
    let earthPos, moonPos, sunPos;
    let earthScale, moonScale, sunScale;

    if (isVisual) {
      // VISUAL EXPLORATION SCALE
      // Fixed Sun at origin (0, 0, 0)
      sunPos = new THREE.Vector3(0, 0, 0);
      sunScale = 4.5;
      earthScale = 1.0;
      moonScale = 0.2725;

      // Earth orbital distance ~32 units (scaled with true eccentricity)
      const rEarthAU = state.sun.distanceAU; // ~0.983 to 1.017
      const earthOrbitalRadius = 32.0 * rEarthAU;

      // Earth heliocentric position in right-handed Ecliptic X-Z plane
      // True longitude of Sun is geometric geocentric; Earth is at sunTrueLong + 180 deg
      const earthLongRad = (state.sun.trueLongitudeDeg + 180) * (Math.PI / 180);
      earthPos = new THREE.Vector3(
        earthOrbitalRadius * Math.cos(earthLongRad),
        0,
        -earthOrbitalRadius * Math.sin(earthLongRad)
      );

      // Moon distance ~7.5 units from Earth (scaled with true lunar eccentricity)
      const moonDistRatio = state.moon.distanceKm / ASTRONOMICAL_CONSTANTS.MOON_SEMI_MAJOR_AXIS_KM; // ~0.92 to 1.06
      const moonOrbitalRadius = 7.5 * moonDistRatio;

      // Moon Geocentric position with true 5.145° inclination and longitude
      const moonLongRad = state.moon.eclipticLongitudeDeg * (Math.PI / 180);
      const moonLatRad = state.moon.eclipticLatitudeDeg * (Math.PI / 180);

      const moonRelX = moonOrbitalRadius * Math.cos(moonLatRad) * Math.cos(moonLongRad);
      const moonRelY = moonOrbitalRadius * Math.sin(moonLatRad); // Height above ecliptic
      const moonRelZ = -moonOrbitalRadius * Math.cos(moonLatRad) * Math.sin(moonLongRad);

      moonPos = new THREE.Vector3(
        earthPos.x + moonRelX,
        earthPos.y + moonRelY,
        earthPos.z + moonRelZ
      );

      // Scale Earth Orbit Line to match current orbit
      this.earthOrbitLine.scale.set(32.0, 32.0, 32.0);
      this.earthOrbitLine.position.set(0, 0, 0);

      // Scale Moon Orbit Line around Earth
      this.moonOrbitLine.scale.set(moonOrbitalRadius, moonOrbitalRadius, moonOrbitalRadius);
      this.moonOrbitLine.position.copy(earthPos);

      // Rotate Moon Orbit Line according to Ascending Node (Omega) and Inclination (5.145°)
      this.moonOrbitLine.rotation.order = 'YXZ';
      this.moonOrbitLine.rotation.set(5.145 * (Math.PI / 180), state.moon.ascendingNodeDeg * (Math.PI / 180), 0);

      // Position Line of Nodes
      this.lineOfNodes.position.copy(earthPos);
      this.lineOfNodes.rotation.y = state.moon.ascendingNodeDeg * (Math.PI / 180);

    } else {
      // 100% TRUE PHYSICAL SCALE (1 unit = 10,000 km)
      sunPos = new THREE.Vector3(0, 0, 0);
      sunScale = ASTRONOMICAL_CONSTANTS.SUN_RADIUS_KM / 10000; // 69.63 units
      earthScale = ASTRONOMICAL_CONSTANTS.EARTH_RADIUS_KM / 10000; // 0.6371 units
      moonScale = ASTRONOMICAL_CONSTANTS.MOON_RADIUS_KM / 10000; // 0.1737 units

      const earthDistUnits = state.sun.distanceKm / 10000; // ~14,960 units
      const earthLongRad = (state.sun.trueLongitudeDeg + 180) * (Math.PI / 180);
      earthPos = new THREE.Vector3(
        earthDistUnits * Math.cos(earthLongRad),
        0,
        -earthDistUnits * Math.sin(earthLongRad)
      );

      const moonDistUnits = state.moon.distanceKm / 10000; // ~38.4 units
      const moonLongRad = state.moon.eclipticLongitudeDeg * (Math.PI / 180);
      const moonLatRad = state.moon.eclipticLatitudeDeg * (Math.PI / 180);

      moonPos = new THREE.Vector3(
        earthPos.x + moonDistUnits * Math.cos(moonLatRad) * Math.cos(moonLongRad),
        earthPos.y + moonDistUnits * Math.sin(moonLatRad),
        earthPos.z - moonDistUnits * Math.cos(moonLatRad) * Math.sin(moonLongRad)
      );

      this.earthOrbitLine.scale.set(earthDistUnits, earthDistUnits, earthDistUnits);
      this.earthOrbitLine.position.set(0, 0, 0);

      this.moonOrbitLine.scale.set(moonDistUnits, moonDistUnits, moonDistUnits);
      this.moonOrbitLine.position.copy(earthPos);
      this.moonOrbitLine.rotation.order = 'YXZ';
      this.moonOrbitLine.rotation.set(5.145 * (Math.PI / 180), state.moon.ascendingNodeDeg * (Math.PI / 180), 0);

      this.lineOfNodes.position.copy(earthPos);
      this.lineOfNodes.rotation.y = state.moon.ascendingNodeDeg * (Math.PI / 180);
    }

    // Update Mesh Positions and Scales
    this.sunGroup.position.copy(sunPos);

    const camDistToEarth = this.camera ? this.camera.position.distanceTo(earthPos) : 20;
    const camToSun = new THREE.Vector3().subVectors(sunPos, this.camera ? this.camera.position : new THREE.Vector3(0, 0, 0));
    const camToEarth = new THREE.Vector3().subVectors(earthPos, this.camera ? this.camera.position : new THREE.Vector3(0, 0, 0));
    const dCamEarth = camToEarth.length();
    const dCamSun = camToSun.length();
    const angleCam = camToEarth.clone().normalize().angleTo(camToSun.clone().normalize());
    const earthAngRadius = Math.asin(Math.min(1.0, (this.earthRadius * earthScale * 1.05) / Math.max(1.05, dCamEarth)));

    // When Earth is between the camera and the Sun (viewing night hemisphere)
    const isOccludedByEarth = (dCamSun > dCamEarth) && (camDistToEarth < 25.0) && (angleCam < (earthAngRadius + 0.22));

    if (isOccludedByEarth) {
      this.sunMesh.visible = false;
      this.coronaSprite.visible = false;
    } else {
      this.sunMesh.visible = true;
      this.coronaSprite.visible = true;
      if (isVisual && camDistToEarth < 12.0) {
        const scaleClose = Math.min(sunScale, 1.0);
        this.sunMesh.scale.set(scaleClose / 4.5, scaleClose / 4.5, scaleClose / 4.5);
        this.coronaSprite.scale.set(scaleClose * 3.0, scaleClose * 3.0, 1);
      } else {
        this.sunMesh.scale.set(sunScale / 4.5, sunScale / 4.5, sunScale / 4.5);
        this.coronaSprite.scale.set(sunScale * 4.5, sunScale * 4.5, 1);
      }
    }

    this.earthGroup.position.copy(earthPos);
    this.earthMesh.scale.set(earthScale, earthScale, earthScale);
    this.cloudMesh.scale.set(earthScale, earthScale, earthScale);
    this.atmoHaloMesh.scale.set(earthScale, earthScale, earthScale);

    this.moonGroup.position.copy(moonPos);
    this.moonMesh.scale.set(moonScale / 0.2725, moonScale / 0.2725, moonScale / 0.2725);

    // Directional Sunlight Position & Target for realistic shadows
    this.sunLight.position.copy(sunPos);
    this.sunLight.target.position.copy(earthPos);

    // Adjust shadow camera far plane and frustum for active scale
    if (isVisual) {
      if (this.sunLight.shadow.camera.far !== 200) {
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -18;
        this.sunLight.shadow.camera.right = 18;
        this.sunLight.shadow.camera.top = 18;
        this.sunLight.shadow.camera.bottom = -18;
        this.sunLight.shadow.camera.updateProjectionMatrix();
      }
    } else {
      if (this.sunLight.shadow.camera.far !== 30000) {
        this.sunLight.shadow.camera.far = 30000;
        this.sunLight.shadow.camera.left = -80;
        this.sunLight.shadow.camera.right = 80;
        this.sunLight.shadow.camera.top = 80;
        this.sunLight.shadow.camera.bottom = -80;
        this.sunLight.shadow.camera.updateProjectionMatrix();
      }
    }

    // EARTH ROTATION & AXIAL TILT (OBLIQUITY)
    // Axial tilt is ~23.439° towards June solstice (90° ecliptic longitude, i.e., -Z in right-handed frame)
    const obliquityRad = state.obliquityDeg * (Math.PI / 180);
    this.earthTiltGroup.rotation.set(0, 0, 0);
    // Tilt Earth axis around X (towards -Z):
    this.earthTiltGroup.rotation.x = -obliquityRad;

    // Earth axial rotation from Apparent Sidereal Time (GAST)
    const gmstRad = state.gmstDeg * (Math.PI / 180);
    this.earthMesh.rotation.y = gmstRad;

    // Seasonal Earth Blue Marble Swap
    if (this.useSeasonalTextures && state.date) {
      const mIdx = state.date.getUTCMonth();
      if (this.activeMonthIndex !== mIdx && this.seasonalTextures[mIdx]) {
        this.activeMonthIndex = mIdx;
        if (this.earthMaterial.uniforms) {
          this.earthMaterial.uniforms.dayTexture.value = this.seasonalTextures[mIdx];
        }
      }
    } else if (!this.useSeasonalTextures && this.earthDay8k) {
      if (this.earthMaterial.uniforms) {
        this.earthMaterial.uniforms.dayTexture.value = this.earthDay8k;
      }
    }

    // Atmospheric clouds with live NASA GIBS daily updates & slow dynamic drift
    if (this.cloudManager && state.date) {
      this.cloudManager.updateForDate(state.date);
      if (this.cloudMesh.material) {
        const tex = this.cloudManager.getTexture();
        this.cloudMesh.material.map = tex;
        this.cloudMesh.material.alphaMap = tex;
      }
    }
    this.cloudMesh.rotation.y = gmstRad + (timeSeconds * 0.005);

    // Update Earth and Atmosphere Shader Uniforms (World Space)
    if (this.earthMaterial.uniforms) {
      this.earthMaterial.uniforms.sunWorldPosition.value.copy(sunPos);
      this.earthMaterial.uniforms.sunRadiusWorld.value = isVisual ? 1.15 : sunScale;
      this.earthMaterial.uniforms.moonWorldPosition.value.copy(moonPos);
      this.earthMaterial.uniforms.moonRadiusWorld.value = isVisual ? 0.2725 : moonScale;
    }
    if (this.atmoHaloMaterial.uniforms) {
      this.atmoHaloMaterial.uniforms.sunWorldPosition.value.copy(sunPos);
    }

    // MOON PHYSICAL LIBRATION & IAU ORIENTATION (IAU WGCCRE Cartographic Model)
    // Full quaternion/matrix derived from lunar pole RA/Dec, spin W, and ICRF-to-scene frame transformation
    if (state.moonOrientation && state.moonOrientation.basisX) {
      const bx = state.moonOrientation.basisX;
      const by = state.moonOrientation.basisY;
      const bz = state.moonOrientation.basisZ;
      const vX = new THREE.Vector3(bx.x, bx.y, bx.z);
      const vY = new THREE.Vector3(by.x, by.y, by.z);
      const vZ = new THREE.Vector3(bz.x, bz.y, bz.z);
      const rotMat = new THREE.Matrix4().makeBasis(vX, vY, vZ);
      this.moonMesh.quaternion.setFromRotationMatrix(rotMat);
    } else {
      this.moonMesh.lookAt(earthPos);
      this.moonMesh.rotateY(-Math.PI / 2);
    }

    // Moon Material Uniforms: Lommel-Seeliger scattering, Earthshine, and Blood Moon eclipse
    if (this.moonMaterial && this.moonMaterial.uniforms) {
      this.moonMaterial.uniforms.sunWorldPosition.value.copy(sunPos);
      this.moonMaterial.uniforms.earthWorldPosition.value.copy(earthPos);
      this.moonMaterial.uniforms.earthRadiusWorld.value = isVisual ? 1.0 : earthScale;
      this.moonMaterial.uniforms.sunRadiusWorld.value = isVisual ? 2.0 : sunScale;
      this.moonMaterial.uniforms.earthPhaseFactor.value = 1.0 - (state.moonPhase ? state.moonPhase.illuminatedFraction : 0.5);
    }

    this.lastCelestialState = state;

    // SHADOW CONES (Umbra & Penumbra)
    // Earth Umbra cone points directly away from Sun:
    const earthShadowDir = new THREE.Vector3().subVectors(earthPos, sunPos).normalize();
    this.earthUmbraCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), earthShadowDir);

    // Moon Umbra cone points directly away from Sun:
    const moonShadowDir = new THREE.Vector3().subVectors(moonPos, sunPos).normalize();
    this.moonUmbraCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moonShadowDir);

    // camDistToEarth already declared above
    const camDistToMoon = this.camera ? this.camera.position.distanceTo(moonPos) : 20;
    const isFocusEarth = this.cameraController ? (this.cameraController.targetMode === 'earth') : false;
    const isFocusMoon = this.cameraController ? (this.cameraController.targetMode === 'moon') : false;

    if (isVisual) {
      this.earthUmbraCone.scale.set(1.0, 1.0, 1.0);
      const distMoonToEarth = moonPos.distanceTo(earthPos);
      const maxMoonConeLen = Math.max(0.1, distMoonToEarth - 1.05);
      this.moonUmbraCone.scale.set(1.0, 1.0, maxMoonConeLen / 8.0);
    } else {
      this.earthUmbraCone.scale.set(earthScale, earthScale, (1400000 / 10000) / 15);
      this.moonUmbraCone.scale.set(moonScale / 0.27, moonScale / 0.27, (374000 / 10000) / 8);
    }

    // Visibility toggles
    this.earthOrbitLine.visible = this.showOrbits;
    this.moonOrbitLine.visible = this.showOrbits;
    this.lineOfNodes.visible = this.showOrbits;
    this.eclipticGrid.visible = this.showGrid;
    this.vernalEquinoxArrow.visible = this.showGrid;
    this.axisHelper.visible = this.showLabels;
    this.equatorLine.visible = this.showLabels;
    this.earthUmbraCone.visible = this.showShadows && !isFocusMoon && (camDistToMoon > 3.0);
    this.moonUmbraCone.visible = this.showShadows && !isFocusEarth && (camDistToEarth > 8.0);
    this.atmoHaloMesh.visible = this.showAtmosphere;
    this.cloudMesh.visible = this.showClouds;

    // Keep celestial starfield centered on camera so stars remain in far background
    if (this.starfieldMesh) {
      this.starfieldMesh.position.copy(this.camera.position);
      this.starfieldMesh.visible = this.showStars;
    }
    if (this.yaleStarsMesh) {
      this.yaleStarsMesh.position.copy(this.camera.position);
      this.yaleStarsMesh.visible = this.showStars;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
