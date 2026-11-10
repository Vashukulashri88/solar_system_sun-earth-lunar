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
import { ASTRONOMICAL_CONSTANTS, Astronomy } from './ephemeris.js';

const EARTH_ORBIT_SEGMENTS = 256;
const MOON_ORBIT_SEGMENTS = 192;
const MOON_SUN_MAX_POINTS = 5000;

export class SolarSystemScene {
  constructor(container) {
    this.container = container;
    this.scaleMode = 'visual'; // 'visual' | 'true'
    this.showOrbits = true;
    this.showMoonSunPath = true;
    this.moonSunPathSpan = 'month'; // 'month' (±1 month) | 'year' (full year)
    this.moonSunPathScale = 'true'; // 'true' (1x true proportional) | 'amplified' (3x amplified wave)
    this.showApsides = true;
    this.showShadows = true;
    this.showGrid = true;
    this.showLabels = true;
    this.showAtmosphere = true;
    this.showClouds = true;
    this.showStars = true;
    this.useSeasonalTextures = true;
    this.activeMonthIndex = -1;
    this.lastCelestialState = null;
    this.lastOrbitSampleTime = null;
    this.lastOrbitScaleMode = null;
    this.lastMoonSunSampleTime = null;
    this.lastMoonSunScaleMode = null;
    this.lastMoonSunSpan = null;
    this.lastMoonSunScale = null;

    this.maxTextureSize = getMaxTextureSize();

    this.initTextures();
    this.initThree();
    this.createStarfield();
    this.createSun();
    this.createEarth();
    this.createMoon();
    this.createOrbitsAndGuides();
    this.setupLighting();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize.bind(this));
    }
  }

  loadSafeTexture(url, colorSpace = null) {
    if (typeof document === 'undefined') {
      const dummyTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
      if (colorSpace) dummyTex.colorSpace = colorSpace;
      return dummyTex;
    }
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

    const w = (this.container && this.container.clientWidth) || 1280;
    const h = (this.container && this.container.clientHeight) || 720;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100000);
    this.camera.position.set(0, 15, 35);

    if (typeof document !== 'undefined') {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.container.appendChild(this.renderer.domElement);
    }
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
    this.sunTexture = sunCanvas ? new THREE.CanvasTexture(sunCanvas) : new THREE.DataTexture(new Uint8Array(4), 1, 1);
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
    // Earth Orbit Path around Sun (true sampled Keplerian ellipse)
    const earthOrbitGeom = new THREE.BufferGeometry();
    const earthPosAttr = new THREE.BufferAttribute(new Float32Array((EARTH_ORBIT_SEGMENTS + 1) * 3), 3);
    earthOrbitGeom.setAttribute('position', earthPosAttr);
    this.earthOrbitLine = new THREE.Line(
      earthOrbitGeom,
      new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.55
      })
    );
    this.scene.add(this.earthOrbitLine);

    // Moon Orbit Path around Earth (true sampled perturbed inclined ellipse)
    const moonOrbitGeom = new THREE.BufferGeometry();
    const moonPosAttr = new THREE.BufferAttribute(new Float32Array((MOON_ORBIT_SEGMENTS + 1) * 3), 3);
    moonOrbitGeom.setAttribute('position', moonPosAttr);
    this.moonOrbitLine = new THREE.Line(
      moonOrbitGeom,
      new THREE.LineBasicMaterial({
        color: 0xa5b4fc,
        transparent: true,
        opacity: 0.70
      })
    );
    this.scene.add(this.moonOrbitLine);

    // Moon Heliocentric Trajectory Line around Sun (gentle wavy line through space)
    const moonSunGeom = new THREE.BufferGeometry();
    const moonSunPosAttr = new THREE.BufferAttribute(new Float32Array(MOON_SUN_MAX_POINTS * 3), 3);
    moonSunGeom.setAttribute('position', moonSunPosAttr);
    this.moonSunTrajectoryLine = new THREE.Line(
      moonSunGeom,
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85
      })
    );
    this.scene.add(this.moonSunTrajectoryLine);

    // Current Moon position marker along the heliocentric path
    const dotGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false
    });
    this.moonTruePositionMarker = new THREE.Mesh(dotGeom, dotMat);
    this.scene.add(this.moonTruePositionMarker);

    // Apsides Visual Markers & Labels (Perihelion, Aphelion, Perigee, Apogee)
    this.createApsidesMarkers();

    // Populate initial real trajectories
    this.updateOrbitGeometries(new Date());
    this.updateMoonSunTrajectory(new Date());

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

  createApsidesMarkers() {
    this.perihelionMarker = this.createApsisMarker(0xf59e0b, 0.35, 'PERIHELION', 'Earth Closest to Sun (~147.1M km)', { w: 6.2, h: 2.07 }, 2.0);
    this.aphelionMarker = this.createApsisMarker(0x38bdf8, 0.35, 'APHELION', 'Earth Farthest from Sun (~152.1M km)', { w: 6.2, h: 2.07 }, 2.0);
    this.perigeeMarker = this.createApsisMarker(0x34d399, 0.16, 'PERIGEE', 'Moon Closest to Earth (~363k km)', { w: 2.5, h: 0.85 }, 0.9);
    this.apogeeMarker = this.createApsisMarker(0xa78bfa, 0.16, 'APOGEE', 'Moon Farthest from Earth (~405k km)', { w: 2.5, h: 0.85 }, 0.9);

    this.scene.add(this.perihelionMarker);
    this.scene.add(this.aphelionMarker);
    this.scene.add(this.perigeeMarker);
    this.scene.add(this.apogeeMarker);

    this.lastPerigeeRel = new THREE.Vector3();
    this.lastApogeeRel = new THREE.Vector3();
  }

  createApsisMarker(colorHex, radius, title, subtitle, spriteScale = { w: 3.2, h: 1.07 }, yOffset = 1.2) {
    const group = new THREE.Group();

    // Central glowing sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshBasicMaterial({ color: colorHex, depthTest: true, depthWrite: false, transparent: true, opacity: 0.95 })
    );
    group.add(sphere);

    // Flat ring in ecliptic plane
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.4, radius * 2.2, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, depthTest: true, depthWrite: false, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Billboard Text Sprite
    if (typeof document !== 'undefined') {
      const sprite = this.createApsisLabelSprite(title, subtitle, colorHex, spriteScale);
      sprite.position.y = radius + yOffset;
      group.add(sprite);
      group.userData.sprite = sprite;
    }

    group.userData.baseRadius = radius;
    group.userData.title = title;
    group.userData.colorHex = colorHex;
    return group;
  }

  createApsisLabelSprite(title, subtitle, colorHex, spriteScale = { w: 3.2, h: 1.07 }) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const colorHexStr = '#' + colorHex.toString(16).padStart(6, '0');

    // Rounded pill background
    const r = 16, w = 376, h = 96, x = 4, y = 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = colorHexStr;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = colorHexStr;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, y + 40);

    // Subtitle
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, canvas.width / 2, y + 74);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(spriteScale.w, spriteScale.h, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  updateApsisSubtitle(markerGroup, title, subtitle, colorHex) {
    if (typeof document === 'undefined') return;
    if (!markerGroup || !markerGroup.userData || !markerGroup.userData.sprite) return;
    const sprite = markerGroup.userData.sprite;
    if (!sprite.material || !sprite.material.map || !sprite.material.map.image) return;
    const canvas = sprite.material.map.image;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const colorHexStr = '#' + colorHex.toString(16).padStart(6, '0');
    const r = 16, w = 376, h = 96, x = 4, y = 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = colorHexStr;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorHexStr;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, y + 40);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, canvas.width / 2, y + 74);

    sprite.material.map.needsUpdate = true;
  }

  /**
   * Samples actual orbital positions from Astronomy Engine over a full revolution
   * centered on the simulated date to trace the real Keplerian / perturbed ellipses.
   * @param {Date} date - Center date of the simulated epoch
   */
  updateOrbitGeometries(date = new Date()) {
    const isVisual = (this.scaleMode === 'visual');
    const t0 = date.getTime();

    // 1. SAMPLE EARTH HELIOCENTRIC ORBIT PATH (1 Keplerian year centered on current epoch)
    const earthPeriodMs = 365.256363 * 86400000;
    const earthPosAttr = this.earthOrbitLine.geometry.attributes.position;
    const earthArray = earthPosAttr.array;
    const earthScaleFactor = isVisual ? 32.0 : (ASTRONOMICAL_CONSTANTS.AU_KM / 10000.0);

    let minEarthDist = Infinity;
    let maxEarthDist = -Infinity;
    let perihelionX = 0, perihelionY = 0, perihelionZ = 0;
    let aphelionX = 0, aphelionY = 0, aphelionZ = 0;

    for (let i = 0; i <= EARTH_ORBIT_SEGMENTS; i++) {
      let x, y, z;
      if (i === EARTH_ORBIT_SEGMENTS) {
        // Seamlessly close the loop
        x = earthArray[0];
        y = earthArray[1];
        z = earthArray[2];
      } else {
        const dt = (i / EARTH_ORBIT_SEGMENTS - 0.5) * earthPeriodMs;
        const sampleDate = new Date(t0 + dt);
        const hv = Astronomy.HelioVector(Astronomy.Body.Earth, sampleDate);
        const ecl = Astronomy.Ecliptic(hv);
        x = earthScaleFactor * ecl.vec.x;
        y = earthScaleFactor * ecl.vec.z;
        z = -earthScaleFactor * ecl.vec.y;

        const distAU = Math.sqrt(ecl.vec.x * ecl.vec.x + ecl.vec.y * ecl.vec.y + ecl.vec.z * ecl.vec.z);
        if (distAU < minEarthDist) {
          minEarthDist = distAU;
          perihelionX = x;
          perihelionY = y;
          perihelionZ = z;
        }
        if (distAU > maxEarthDist) {
          maxEarthDist = distAU;
          aphelionX = x;
          aphelionY = y;
          aphelionZ = z;
        }
      }
      earthArray[i * 3] = x;
      earthArray[i * 3 + 1] = y;
      earthArray[i * 3 + 2] = z;
    }
    earthPosAttr.needsUpdate = true;
    this.earthOrbitLine.geometry.computeBoundingSphere();

    // Position Earth Apsis Markers
    if (this.perihelionMarker) {
      this.perihelionMarker.position.set(perihelionX, perihelionY, perihelionZ);
      const mScale = isVisual ? 1.0 : 200.0;
      this.perihelionMarker.scale.set(mScale, mScale, mScale);
      const pKm = (minEarthDist * ASTRONOMICAL_CONSTANTS.AU_KM / 1e6).toFixed(1);
      this.updateApsisSubtitle(this.perihelionMarker, 'PERIHELION', `Earth Closest: ${pKm}M km (${minEarthDist.toFixed(4)} AU)`, 0xf59e0b);
    }
    if (this.aphelionMarker) {
      this.aphelionMarker.position.set(aphelionX, aphelionY, aphelionZ);
      const mScale = isVisual ? 1.0 : 200.0;
      this.aphelionMarker.scale.set(mScale, mScale, mScale);
      const aKm = (maxEarthDist * ASTRONOMICAL_CONSTANTS.AU_KM / 1e6).toFixed(1);
      this.updateApsisSubtitle(this.aphelionMarker, 'APHELION', `Earth Farthest: ${aKm}M km (${maxEarthDist.toFixed(4)} AU)`, 0x38bdf8);
    }

    // 2. SAMPLE MOON GEOCENTRIC ORBIT PATH (~27.32 days centered on current epoch)
    const moonPeriodMs = 27.321661 * 86400000;
    const moonPosAttr = this.moonOrbitLine.geometry.attributes.position;
    const moonArray = moonPosAttr.array;
    const moonFactor = isVisual
      ? (7.5 / ASTRONOMICAL_CONSTANTS.MOON_SEMI_MAJOR_AXIS_KM) * ASTRONOMICAL_CONSTANTS.AU_KM
      : (ASTRONOMICAL_CONSTANTS.AU_KM / 10000.0);

    let minMoonDist = Infinity;
    let maxMoonDist = -Infinity;
    let perigeeRelX = 0, perigeeRelY = 0, perigeeRelZ = 0;
    let apogeeRelX = 0, apogeeRelY = 0, apogeeRelZ = 0;

    for (let j = 0; j <= MOON_ORBIT_SEGMENTS; j++) {
      let relX, relY, relZ;
      if (j === MOON_ORBIT_SEGMENTS) {
        relX = moonArray[0];
        relY = moonArray[1];
        relZ = moonArray[2];
      } else {
        const dt = (j / MOON_ORBIT_SEGMENTS - 0.5) * moonPeriodMs;
        const sampleDate = new Date(t0 + dt);
        const gv = Astronomy.GeoVector(Astronomy.Body.Moon, sampleDate, false);
        const mecl = Astronomy.Ecliptic(gv);
        relX = moonFactor * mecl.vec.x;
        relY = moonFactor * mecl.vec.z;
        relZ = -moonFactor * mecl.vec.y;

        const distKm = Math.sqrt(mecl.vec.x * mecl.vec.x + mecl.vec.y * mecl.vec.y + mecl.vec.z * mecl.vec.z) * ASTRONOMICAL_CONSTANTS.AU_KM;
        if (distKm < minMoonDist) {
          minMoonDist = distKm;
          perigeeRelX = relX;
          perigeeRelY = relY;
          perigeeRelZ = relZ;
        }
        if (distKm > maxMoonDist) {
          maxMoonDist = distKm;
          apogeeRelX = relX;
          apogeeRelY = relY;
          apogeeRelZ = relZ;
        }
      }
      moonArray[j * 3] = relX;
      moonArray[j * 3 + 1] = relY;
      moonArray[j * 3 + 2] = relZ;
    }
    moonPosAttr.needsUpdate = true;
    this.moonOrbitLine.geometry.computeBoundingSphere();

    // Cache Lunar Apsis Relative Vectors
    this.lastPerigeeRel.set(perigeeRelX, perigeeRelY, perigeeRelZ);
    this.lastApogeeRel.set(apogeeRelX, apogeeRelY, apogeeRelZ);

    if (this.perigeeMarker) {
      const mScale = isVisual ? 1.0 : 2.5;
      this.perigeeMarker.scale.set(mScale, mScale, mScale);
      this.updateApsisSubtitle(this.perigeeMarker, 'PERIGEE', `Moon Closest: ${Math.round(minMoonDist).toLocaleString()} km`, 0x34d399);
    }
    if (this.apogeeMarker) {
      const mScale = isVisual ? 1.0 : 2.5;
      this.apogeeMarker.scale.set(mScale, mScale, mScale);
      this.updateApsisSubtitle(this.apogeeMarker, 'APOGEE', `Moon Farthest: ${Math.round(maxMoonDist).toLocaleString()} km`, 0xa78bfa);
    }
  }

  /**
   * Samples Moon heliocentric positions relative to the Sun over a configurable span
   * centered on the simulated date to trace the gentle wavy prograde path through space.
   * @param {Date} date - Center date of the simulated epoch
   */
  updateMoonSunTrajectory(date = new Date()) {
    if (!this.moonSunTrajectoryLine) return;
    const isVisual = (this.scaleMode === 'visual');
    const t0 = date.getTime();

    let spanDays;
    let stepHours;
    if (this.moonSunPathSpan === 'year') {
      spanDays = 365.256363;
      stepHours = 2.0; // ~4384 points
    } else {
      // Default ±1 month (~60 days)
      spanDays = 60.0;
      stepHours = 1.0; // 1441 points
    }

    const spanMs = spanDays * 86400000;
    const stepMs = stepHours * 3600000;
    const totalPoints = Math.min(MOON_SUN_MAX_POINTS, Math.floor(spanMs / stepMs) + 1);

    const posAttr = this.moonSunTrajectoryLine.geometry.attributes.position;
    const array = posAttr.array;

    const earthScaleFactor = isVisual ? 32.0 : (ASTRONOMICAL_CONSTANTS.AU_KM / 10000.0);
    const isAmplified = isVisual && (this.moonSunPathScale === 'amplified');
    const multiplier = isAmplified ? 3.0 : 1.0;

    const halfSpanMs = spanMs / 2.0;

    for (let i = 0; i < totalPoints; i++) {
      const sampleMs = t0 - halfSpanMs + (i * stepMs);
      const sampleDate = new Date(sampleMs);

      let x, y, z;
      if (isAmplified) {
        // Earth heliocentric + amplified Moon geocentric offset (strictly prograde, zero retrograde loops)
        const he = Astronomy.HelioVector(Astronomy.Body.Earth, sampleDate);
        const gm = Astronomy.GeoVector(Astronomy.Body.Moon, sampleDate, false);
        const eecl = Astronomy.Ecliptic(he);
        const gmecl = Astronomy.Ecliptic(gm);

        const cx = eecl.vec.x + multiplier * gmecl.vec.x;
        const cy = eecl.vec.y + multiplier * gmecl.vec.y;
        const cz = eecl.vec.z + multiplier * gmecl.vec.z;

        x = earthScaleFactor * cx;
        y = earthScaleFactor * cz;
        z = -earthScaleFactor * cy;
      } else {
        // True physical heliocentric trajectory (strictly concave toward Sun everywhere, 1:389 proportions)
        const hm = Astronomy.HelioVector(Astronomy.Body.Moon, sampleDate);
        const mecl = Astronomy.Ecliptic(hm);

        x = earthScaleFactor * mecl.vec.x;
        y = earthScaleFactor * mecl.vec.z;
        z = -earthScaleFactor * mecl.vec.y;
      }

      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }

    posAttr.needsUpdate = true;
    this.moonSunTrajectoryLine.geometry.setDrawRange(0, totalPoints);
    this.moonSunTrajectoryLine.geometry.computeBoundingSphere();
  }

  /**
   * Updates all 3D scene objects with real astronomical ephemeris state
   * @param {Object} state - Celestial state from ephemeris.js
   * @param {number} timeSeconds - Elapsed seconds for animations
   */
  update(state, timeSeconds = 0) {
    const isVisual = (this.scaleMode === 'visual');

    // Dynamically sample real orbital trajectories when needed (or on scale mode change)
    const timeMs = state.date ? state.date.getTime() : Date.now();
    const scaleChanged = (this.lastOrbitScaleMode !== this.scaleMode);
    const timeDeltaHours = this.lastOrbitSampleTime ? Math.abs(timeMs - this.lastOrbitSampleTime) / 3600000 : Infinity;

    if (scaleChanged || timeDeltaHours > 3 || !this.lastOrbitSampleTime) {
      this.updateOrbitGeometries(state.date || new Date());
      this.lastOrbitSampleTime = timeMs;
      this.lastOrbitScaleMode = this.scaleMode;
    }

    const moonSunDeltaHours = this.lastMoonSunSampleTime ? Math.abs(timeMs - this.lastMoonSunSampleTime) / 3600000 : Infinity;
    const moonSunConfigChanged = (this.lastMoonSunScaleMode !== this.scaleMode) ||
                                 (this.lastMoonSunSpan !== this.moonSunPathSpan) ||
                                 (this.lastMoonSunScale !== this.moonSunPathScale);

    if (!this.lastMoonSunSampleTime || moonSunConfigChanged || moonSunDeltaHours > 6.0) {
      this.updateMoonSunTrajectory(state.date || new Date());
      this.lastMoonSunSampleTime = timeMs;
      this.lastMoonSunScaleMode = this.scaleMode;
      this.lastMoonSunSpan = this.moonSunPathSpan;
      this.lastMoonSunScale = this.moonSunPathScale;
    }

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

      // Earth Orbit Line is in world heliocentric coordinates (centered at Sun)
      this.earthOrbitLine.scale.set(1.0, 1.0, 1.0);
      this.earthOrbitLine.position.set(0, 0, 0);
      this.earthOrbitLine.rotation.set(0, 0, 0);

      // Moon Orbit Line vertices are relative to Earth in ecliptic frame
      this.moonOrbitLine.scale.set(1.0, 1.0, 1.0);
      this.moonOrbitLine.position.copy(earthPos);
      this.moonOrbitLine.rotation.set(0, 0, 0);

      // Position Line of Nodes
      this.lineOfNodes.position.copy(earthPos);
      this.lineOfNodes.rotation.y = state.moon.ascendingNodeDeg * (Math.PI / 180);
      this.lineOfNodes.scale.set(1.0, 1.0, 1.0);

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

      this.earthOrbitLine.scale.set(1.0, 1.0, 1.0);
      this.earthOrbitLine.position.set(0, 0, 0);
      this.earthOrbitLine.rotation.set(0, 0, 0);

      this.moonOrbitLine.scale.set(1.0, 1.0, 1.0);
      this.moonOrbitLine.position.copy(earthPos);
      this.moonOrbitLine.rotation.set(0, 0, 0);

      this.lineOfNodes.position.copy(earthPos);
      this.lineOfNodes.rotation.y = state.moon.ascendingNodeDeg * (Math.PI / 180);
      const nodeScale = (moonDistUnits / 7.5);
      this.lineOfNodes.scale.set(nodeScale, nodeScale, nodeScale);
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

    // Update Lunar Apsis Markers world positions (follow Earth through space)
    if (this.perigeeMarker && this.lastPerigeeRel) {
      this.perigeeMarker.position.set(
        earthPos.x + this.lastPerigeeRel.x,
        earthPos.y + this.lastPerigeeRel.y,
        earthPos.z + this.lastPerigeeRel.z
      );
    }
    if (this.apogeeMarker && this.lastApogeeRel) {
      this.apogeeMarker.position.set(
        earthPos.x + this.lastApogeeRel.x,
        earthPos.y + this.lastApogeeRel.y,
        earthPos.z + this.lastApogeeRel.z
      );
    }

    // Visibility toggles
    this.earthOrbitLine.visible = this.showOrbits;
    this.moonOrbitLine.visible = this.showOrbits;
    this.lineOfNodes.visible = this.showOrbits;

    const showMoonSun = this.showOrbits && (this.showMoonSunPath !== false);
    if (this.moonSunTrajectoryLine) {
      this.moonSunTrajectoryLine.visible = showMoonSun;
    }
    if (this.moonTruePositionMarker) {
      this.moonTruePositionMarker.visible = showMoonSun;
      const markerScale = isVisual ? 1.0 : 25.0;
      this.moonTruePositionMarker.scale.set(markerScale, markerScale, markerScale);

      const isAmplified = isVisual && (this.moonSunPathScale === 'amplified');
      const earthScaleFactor = isVisual ? 32.0 : (ASTRONOMICAL_CONSTANTS.AU_KM / 10000.0);
      const curDate = state.date || new Date();

      if (isAmplified) {
        const he = Astronomy.HelioVector(Astronomy.Body.Earth, curDate);
        const gm = Astronomy.GeoVector(Astronomy.Body.Moon, curDate, false);
        const eecl = Astronomy.Ecliptic(he);
        const gmecl = Astronomy.Ecliptic(gm);
        this.moonTruePositionMarker.position.set(
          earthScaleFactor * (eecl.vec.x + 3.0 * gmecl.vec.x),
          earthScaleFactor * (eecl.vec.z + 3.0 * gmecl.vec.z),
          -earthScaleFactor * (eecl.vec.y + 3.0 * gmecl.vec.y)
        );
      } else {
        const hm = Astronomy.HelioVector(Astronomy.Body.Moon, curDate);
        const mecl = Astronomy.Ecliptic(hm);
        this.moonTruePositionMarker.position.set(
          earthScaleFactor * mecl.vec.x,
          earthScaleFactor * mecl.vec.z,
          -earthScaleFactor * mecl.vec.y
        );
      }
    }

    const showApsides = this.showOrbits && (this.showApsides !== false);
    if (this.perihelionMarker) this.perihelionMarker.visible = showApsides;
    if (this.aphelionMarker) this.aphelionMarker.visible = showApsides;
    if (this.perigeeMarker) this.perigeeMarker.visible = showApsides;
    if (this.apogeeMarker) this.apogeeMarker.visible = showApsides;
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
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
