/**
 * Procedural Texture Generator
 * Generates photorealistic, high-resolution textures for Earth, Moon, Sun, and Starfield
 * using HTML5 2D Canvas. Enables 100% offline, zero-CORS, instant loading.
 */

// Simple seeded pseudo-random number generator for reproducible procedural terrain
function createPRNG(seed = 12345) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 2D Simplex/Perlin-like smooth value noise generator
function createNoise2D(seed = 42) {
  const prng = createPRNG(seed);
  const size = 256;
  const p = new Uint8Array(size * 2);
  const perm = new Uint8Array(size);
  for (let i = 0; i < size; i++) perm[i] = i;
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < size * 2; i++) {
    p[i] = perm[i & (size - 1)];
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  return function noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const a = p[X] + Y;
    const aa = p[a];
    const ab = p[a + 1];
    const b = p[X + 1] + Y;
    const ba = p[b];
    const bb = p[b + 1];

    const res = lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
    return (res + 1) * 0.5; // [0, 1]
  };
}

/**
 * Procedural Fractal Brownian Motion (fBm)
 */
function fbm(noise, x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
  let total = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return total / maxValue;
}

/**
 * Checks if geographic coordinates (lat [-90, 90], lon [-180, 180]) are over land.
 * Uses analytical spherical bounding shapes representing major Earth landmasses.
 */
function getLandElevation(lat, lon, noise) {
  // Antarctica
  if (lat < -62) {
    return 1.2 + 0.3 * Math.sin(lon * 0.05);
  }

  // Greenland
  if (lat > 60 && lat < 83 && lon > -73 && lon < -15) {
    return 1.1;
  }

  let landScore = 0;

  // North America
  if (lat > 15 && lat < 72 && lon > -168 && lon < -52) {
    const centerDist = Math.hypot((lat - 48) / 25, (lon - (-100)) / 40);
    if (centerDist < 1.0) landScore = Math.max(landScore, 1.0 - centerDist);
    // Alaska / Canada
    if (lat > 50 && lon < -120) landScore = Math.max(landScore, 0.7);
    // Florida / Mexico / Central America
    if (lat > 14 && lat < 30 && lon > -105 && lon < -80) landScore = Math.max(landScore, 0.6);
  }

  // South America
  if (lat > -55 && lat < 12 && lon > -82 && lon < -34) {
    const centerDist = Math.hypot((lat - (-18)) / 32, (lon - (-60)) / 22);
    if (centerDist < 1.0) landScore = Math.max(landScore, 1.0 - centerDist);
  }

  // Eurasia (Europe + Asia)
  if (lat > 5 && lat < 78 && lon > -10 && lon < 180) {
    // Europe
    if (lat > 36 && lat < 70 && lon < 50) {
      const dist = Math.hypot((lat - 52) / 18, (lon - 20) / 30);
      if (dist < 1.0) landScore = Math.max(landScore, 0.85 * (1.0 - dist));
      // Scandinavia
      if (lat > 55 && lat < 71 && lon > 4 && lon < 32) landScore = Math.max(landScore, 0.75);
      // Mediterranean coast limit
      if (lat < 36) landScore = 0;
    }
    // Asia / Russia / China / India
    if (lon >= 40) {
      const distSiberia = Math.hypot((lat - 58) / 20, (lon - 95) / 55);
      if (distSiberia < 1.0) landScore = Math.max(landScore, 1.0 - distSiberia);
      // India
      if (lat > 7 && lat < 30 && lon > 68 && lon < 90) {
        const distIndia = Math.hypot((lat - 20) / 12, (lon - 78) / 10);
        if (distIndia < 1.0) landScore = Math.max(landScore, 0.85);
      }
      // SE Asia / Indonesia / Japan
      if (lat > 30 && lat < 45 && lon > 130 && lon < 145) landScore = Math.max(landScore, 0.7); // Japan
    }
  }

  // Africa
  if (lat > -35 && lat < 37 && lon > -18 && lon < 52) {
    const centerDist = Math.hypot((lat - 4) / 34, (lon - 20) / 25);
    if (centerDist < 1.0) landScore = Math.max(landScore, 1.0 - centerDist);
    // Horn of Africa & Sahara
    if (lat > 12 && lat < 33 && lon > -15 && lon < 35) landScore = Math.max(landScore, 0.9);
  }

  // Australia
  if (lat > -44 && lat < -10 && lon > 112 && lon < 154) {
    const centerDist = Math.hypot((lat - (-26)) / 15, (lon - 134) / 18);
    if (centerDist < 1.0) landScore = Math.max(landScore, 1.0 - centerDist);
  }

  // Add fine-grain fractal coastal noise
  const nx = (lon + 180) / 360 * 18;
  const ny = (lat + 90) / 180 * 9;
  const detail = fbm(noise, nx, ny, 5, 2.1, 0.5) - 0.48;

  const totalElevation = landScore + detail * 0.9;
  return totalElevation;
}

/**
 * Creates high-detail Canvas texture for Earth Day Map
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function createEarthDayCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const noise = createNoise2D(777);

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180; // +90 (North) to -90 (South)
    const latRad = lat * (Math.PI / 180);

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180; // -180 to +180

      const elev = getLandElevation(lat, lon, noise);
      const idx = (y * width + x) * 4;

      if (elev <= 0.28) {
        // Ocean
        const depth = Math.max(0, Math.min(1, 1.0 - (elev / 0.28)));
        // Coastal shelf turquoise to deep royal navy blue
        const r = Math.floor(10 + 15 * (1 - depth));
        const g = Math.floor(40 + 60 * (1 - depth));
        const b = Math.floor(95 + 75 * (1 - depth));
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      } else {
        // Land
        // Biome logic based on latitude and moisture
        const absLat = Math.abs(lat);
        let r, g, b;

        if (absLat > 68 || (lat < -60)) {
          // Polar ice caps & glaciers
          const iceTint = 240 + Math.floor(15 * Math.sin(lon));
          r = iceTint; g = iceTint + 5; b = 255;
        } else if (absLat > 50) {
          // Subarctic Taiga / Tundra
          r = 55 + Math.floor(25 * elev);
          g = 80 + Math.floor(35 * elev);
          b = 45 + Math.floor(15 * elev);
        } else if ((lat > 15 && lat < 33 && lon > -15 && lon < 60) || // Sahara / Arabia
                   (lat > -32 && lat < -18 && lon > 115 && lon < 145)) { // Australian Outback
          // Arid desert
          r = 205 + Math.floor(30 * (elev - 0.3));
          g = 170 + Math.floor(25 * (elev - 0.3));
          b = 115 + Math.floor(20 * (elev - 0.3));
        } else if (absLat < 15) {
          // Tropical Rainforests
          r = 30 + Math.floor(20 * elev);
          g = 95 + Math.floor(35 * elev);
          b = 35 + Math.floor(15 * elev);
        } else {
          // Temperate Forest / Grassland / Mountains
          if (elev > 0.75) {
            // Mountain peaks (brown/rock/snow)
            r = 130 + Math.floor(40 * elev);
            g = 120 + Math.floor(35 * elev);
            b = 105 + Math.floor(30 * elev);
          } else {
            // Plains & woodlands
            r = 65 + Math.floor(45 * elev);
            g = 125 + Math.floor(40 * elev);
            b = 55 + Math.floor(25 * elev);
          }
        }

        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Creates high-detail Canvas texture for Earth Night City Lights
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function createEarthNightCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fill with pitch black
  ctx.fillStyle = '#020204';
  ctx.fillRect(0, 0, width, height);

  const noise = createNoise2D(888);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Major urban density clusters [lat, lon, radiusDeg, intensity]
  const clusters = [
    // US & Canada
    [40.7, -74.0, 7.5, 1.0],   // New York / Boston / DC Corridor
    [34.0, -118.2, 5.5, 0.95], // Los Angeles / SoCal
    [41.8, -87.6, 5.0, 0.9],   // Chicago / Great Lakes
    [37.7, -122.4, 4.0, 0.9],  // SF Bay Area
    [29.7, -95.3, 4.5, 0.85],  // Houston / Texas Triangle
    [45.5, -73.5, 3.5, 0.8],   // Montreal / Toronto
    // Europe
    [51.5, -0.1, 8.0, 1.0],    // London / Benelux / Rhine-Ruhr
    [48.8, 2.3, 5.0, 0.95],    // Paris
    [45.4, 9.2, 4.5, 0.9],     // Po Valley / Northern Italy
    [52.5, 13.4, 4.0, 0.85],   // Berlin
    [40.4, -3.7, 3.5, 0.8],    // Madrid
    [55.7, 37.6, 5.0, 0.9],    // Moscow
    // Asia
    [35.6, 139.6, 9.0, 1.0],   // Greater Tokyo / Kanto
    [31.2, 121.4, 8.5, 1.0],   // Shanghai / Yangtze Delta
    [23.1, 113.2, 8.0, 1.0],   // Pearl River Delta / Hong Kong
    [39.9, 116.4, 6.0, 0.95],  // Beijing
    [37.5, 126.9, 5.5, 0.95],  // Seoul
    [28.6, 77.2, 7.0, 0.95],   // Delhi NCR / Indo-Gangetic Plain
    [19.0, 72.8, 6.0, 0.9],    // Mumbai
    [13.0, 80.2, 4.5, 0.85],   // Chennai / Bangalore
    [1.3, 103.8, 4.0, 0.95],   // Singapore / Malacca Strait
    [13.7, 100.5, 4.0, 0.85],  // Bangkok
    // Middle East & Africa
    [30.0, 31.2, 6.5, 0.95],   // Cairo & Nile River Ribbon
    [25.2, 55.2, 4.0, 0.9],    // Dubai / UAE / Persian Gulf
    [-26.2, 28.0, 4.0, 0.8],   // Johannesburg
    [6.5, 3.3, 4.0, 0.8],      // Lagos
    // South America & Australia
    [-23.5, -46.6, 6.0, 0.9],  // Sao Paulo / Rio de Janeiro
    [-34.6, -58.3, 4.5, 0.85], // Buenos Aires
    [-33.8, 151.2, 4.0, 0.85], // Sydney / Melbourne
  ];

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;
      const elev = getLandElevation(lat, lon, noise);
      if (elev <= 0.28) continue; // Only light up land

      let brightness = 0;

      // Sum cluster contributions
      for (let c = 0; c < clusters.length; c++) {
        const [clat, clon, radius, intens] = clusters[c];
        const dLat = (lat - clat);
        let dLon = Math.abs(lon - clon);
        if (dLon > 180) dLon = 360 - dLon;
        const dist = Math.hypot(dLat, dLon);

        if (dist < radius) {
          const falloff = 1.0 - (dist / radius);
          brightness += falloff * falloff * intens;
        }
      }

      // Add regional background web of roads and towns
      const fineNoise = fbm(noise, (lon + 180) * 0.4, (lat + 90) * 0.4, 4);
      if (fineNoise > 0.62 && Math.abs(lat) < 55) {
        brightness += (fineNoise - 0.62) * 1.5;
      }

      if (brightness > 0.02) {
        const idx = (y * width + x) * 4;
        const b = Math.min(1.0, brightness);
        // Warm incandescent amber / golden glow
        data[idx] = Math.floor(Math.min(255, b * 255 * 1.05));
        data[idx + 1] = Math.floor(Math.min(255, b * 200 * 0.95));
        data[idx + 2] = Math.floor(Math.min(255, b * 110 * 0.8));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Creates Earth Specular Reflection Map (white for oceans, black for land)
 */
export function createEarthSpecularCanvas(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const noise = createNoise2D(777);

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;
      const elev = getLandElevation(lat, lon, noise);
      const idx = (y * width + x) * 4;

      const val = elev <= 0.28 ? 255 : (Math.abs(lat) > 65 ? 60 : 0);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Creates Earth Atmospheric Cloud Texture with realistic storm swirls
 */
export function createEarthCloudCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const noise = createNoise2D(999);

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;
    const absLat = Math.abs(lat);

    // Weather bands: high clouds at ITCZ equator (lat ~0) and mid-latitudes (40-60 deg)
    const itcz = Math.exp(-Math.pow(lat / 8, 2));
    const midLat = Math.exp(-Math.pow((absLat - 48) / 14, 2));
    const bandFactor = 0.35 + 0.65 * (itcz + midLat);

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;

      // Cloud swirl distortion
      const nx = (lon + 180) / 360 * 10;
      const ny = (lat + 90) / 180 * 6;
      const cloudVal = fbm(noise, nx, ny, 6, 2.0, 0.52);

      const density = Math.max(0, (cloudVal - 0.44) * 2.2) * bandFactor;
      const alpha = Math.min(255, Math.floor(density * 240));

      const idx = (y * width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Creates Moon Texture with Maria, Highlands, and Tycho crater rays
 */
export function createMoonCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const noise = createNoise2D(333);

  // Near side lunar maria definitions: [lat, lon, radiusDeg, depth]
  const maria = [
    [33, -20, 24, 0.85],   // Mare Imbrium
    [18, -57, 30, 0.8],    // Oceanus Procellarum
    [28, 18, 16, 0.75],    // Mare Serenitatis
    [8, 31, 15, 0.75],     // Mare Tranquillitatis
    [17, 59, 13, 0.7],     // Mare Crisium
    [-3, 48, 14, 0.65],    // Mare Fecunditatis
    [-19, -15, 17, 0.7],   // Mare Nubium
    [-13, -34, 15, 0.65],  // Mare Humorum
  ];

  // Bright crater ray origins [lat, lon, rayCount, lengthDeg]
  const rayCraters = [
    [-43.3, -11.2, 16, 65], // Tycho (spectacular ray system)
    [9.6, -20.1, 10, 35],   // Copernicus
    [8.1, -38.0, 8, 25],    // Kepler
  ];

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;

      // Base anorthosite highland brightness
      const nx = (lon + 180) / 360 * 12;
      const ny = (lat + 90) / 180 * 6;
      const baseCraterNoise = fbm(noise, nx, ny, 6, 2.0, 0.5);
      let albedo = 0.55 + 0.25 * baseCraterNoise;

      // Dark basaltic maria (mostly near-side, lon between -90 and +90)
      let mariaDarkening = 0;
      for (let m = 0; m < maria.length; m++) {
        const [mlat, mlon, mrad, mdepth] = maria[m];
        const dist = Math.hypot(lat - mlat, lon - mlon);
        if (dist < mrad) {
          const falloff = 1.0 - (dist / mrad);
          mariaDarkening = Math.max(mariaDarkening, falloff * mdepth);
        }
      }
      albedo -= mariaDarkening * 0.32;

      // Tycho crater rays
      for (let r = 0; r < rayCraters.length; r++) {
        const [clat, clon, rays, rayLen] = rayCraters[r];
        const dLat = lat - clat;
        const dLon = lon - clon;
        const dist = Math.hypot(dLat, dLon);
        if (dist < rayLen) {
          const angle = Math.atan2(dLat, dLon);
          const rayIntensity = Math.pow(Math.max(0, Math.cos(angle * rays * 0.5)), 6);
          const falloff = 1.0 - (dist / rayLen);
          albedo += rayIntensity * falloff * 0.28;
        }
      }

      // Far side is heavily cratered highland (higher albedo)
      if (Math.abs(lon) > 90) {
        albedo += 0.08 * (Math.abs(lon) - 90) / 90;
      }

      albedo = Math.max(0.12, Math.min(1.0, albedo));
      const val = Math.floor(albedo * 255);

      const idx = (y * width + x) * 4;
      data[idx] = val;
      data[idx + 1] = Math.floor(val * 0.98); // Slight subtle warm grey
      data[idx + 2] = Math.floor(val * 0.96);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Creates Sun Photosphere Texture with granulation convection cells and sunspots
 */
export function createSunCanvas(width = 1024, height = 512) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const noise = createNoise2D(555);

  for (let y = 0; y < height; y++) {
    const ny = (y / height) * 14;
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * 28;

      // High-frequency convective granulation cells
      const gran = fbm(noise, nx, ny, 5, 2.2, 0.5);

      // Limb darkening in texture representation
      const lat = (y / height - 0.5) * Math.PI;
      const limb = Math.cos(lat);

      const r = Math.min(255, Math.floor(255 * (0.85 + 0.15 * gran)));
      const g = Math.min(255, Math.floor(190 * (0.8 + 0.2 * gran) * (0.7 + 0.3 * limb)));
      const b = Math.min(255, Math.floor(40 * (0.6 + 0.4 * gran) * (0.5 + 0.5 * limb)));

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add realistic Sunspots
  ctx.fillStyle = '#220800';
  const spots = [
    [width * 0.45, height * 0.42, 12],
    [width * 0.47, height * 0.43, 7],
    [width * 0.68, height * 0.55, 10],
    [width * 0.22, height * 0.48, 8],
  ];
  for (const [sx, sy, sr] of spots) {
    const grad = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr);
    grad.addColorStop(0, '#100500');
    grad.addColorStop(0.5, '#401800');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Creates Milky Way Starfield Skybox Equirectangular Texture
 */
export function createStarfieldCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Space background
  ctx.fillStyle = '#010206';
  ctx.fillRect(0, 0, width, height);

  // Milky Way band diffuse glow
  const noise = createNoise2D(101);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const lat = 90 - (y / height) * 180;

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * 360 - 180;

      // Milky Way plane tilted ~63 degrees to celestial equator
      const mwAngle = (lon + 30) * (Math.PI / 180);
      const mwPlane = 32 * Math.sin(mwAngle);
      const distFromMW = Math.abs(lat - mwPlane);

      if (distFromMW < 35) {
        const falloff = 1.0 - (distFromMW / 35);
        const nx = (lon + 180) / 360 * 8;
        const ny = (lat + 90) / 180 * 8;
        const dust = fbm(noise, nx, ny, 4, 2.0, 0.5);

        const glow = Math.pow(falloff, 2.5) * dust * 55;
        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, data[idx] + Math.floor(glow * 0.9));
        data[idx + 1] = Math.min(255, data[idx + 1] + Math.floor(glow * 0.95));
        data[idx + 2] = Math.min(255, data[idx + 2] + Math.floor(glow * 1.2)); // bluish-violet nebular hue
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Scatter 3,500 realistic pinpoint stars with accurate spectral colors
  const prng = createPRNG(4242);
  const starColors = ['#ffffff', '#fff7eb', '#ffe3c2', '#dbe7ff', '#b9d4ff'];

  for (let i = 0; i < 3500; i++) {
    const sx = prng() * width;
    const sy = prng() * height;
    const mag = prng();
    const radius = mag > 0.98 ? 1.8 : (mag > 0.85 ? 1.2 : 0.7);
    const color = starColors[Math.floor(prng() * starColors.length)];

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + 0.7 * mag;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  return canvas;
}

/**
 * Returns the maximum WebGL texture dimension supported by the current hardware/browser.
 * Defaults to 8192 if running headlessly or if WebGL is unavailable.
 */
export function getMaxTextureSize() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 8192;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      return gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
    }
  } catch (e) {
    // fallback
  }
  return 8192;
}

/**
 * Clamps and downscales a Three.js Texture or HTML Image/Canvas to MAX_TEXTURE_SIZE
 * to prevent GPU out-of-memory or WebGL texture dimensions errors on constrained devices.
 */
export function clampTextureSize(texture, maxDimension = null) {
  if (!texture) return texture;
  const maxDim = maxDimension || getMaxTextureSize();
  const img = texture.image;
  if (!img) return texture;

  const width = img.naturalWidth || img.videoWidth || img.width;
  const height = img.naturalHeight || img.videoHeight || img.height;

  if (width > maxDim || height > maxDim) {
    if (typeof document !== 'undefined') {
      const scale = Math.min(maxDim / width, maxDim / height);
      const targetW = Math.max(1, Math.floor(width * scale));
      const targetH = Math.max(1, Math.floor(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      texture.image = canvas;
      texture.needsUpdate = true;
    }
  }
  return texture;
}
