import * as THREE from 'three';

/**
 * Cloud Manager with NASA GIBS Live Daily Satellite Cloud Imagery
 * and High-Resolution 8K NASA Cloud Composite Fallback.
 * Features:
 * - Multi-resolution GIBS tiles (Level 1: 2048x1024, Level 2: 4096x2048)
 * - Concurrency-limited tile fetch pool with rotating subdomains (gibs-a/b/c)
 * - Permanent ice masking (Antarctica, Greenland, High Arctic) and chromatic desert filtering
 * - Robust fallback: yesterday (N-1) / N-2 for incomplete today data, and static 8K for pre-MODIS / future
 */
export class CloudManager {
  constructor(fallbackUrl = 'assets/textures/8k_earth_clouds.jpg', options = {}) {
    this.fallbackUrl = fallbackUrl;
    this.zoomLevel = options.zoomLevel !== undefined ? options.zoomLevel : 2; // Level 2: 2560x1280 (2048-4096 wide, 2:1 equirectangular)
    this.concurrencyLimit = options.concurrencyLimit || 6;
    this.textureLoader = new THREE.TextureLoader();

    // Default static 8K NASA cloud composite
    if (typeof document !== 'undefined') {
      this.textureLoader = new THREE.TextureLoader();
      this.fallbackTexture = this.textureLoader.load(this.fallbackUrl);
      this.fallbackTexture.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.textureLoader = null;
      this.fallbackTexture = new THREE.Texture();
    }
    this.cloudTexture = this.fallbackTexture;

    this.cache = new Map(); // Date string YYYY-MM-DD -> Canvas
    this.currentDateStr = null;
    this.isLoading = false;
    this.isLive = false;
    this.lastStatus = {
      isLiveDaily: false,
      dateStr: null,
      message: '8K NASA Cloud Composite (Master)'
    };
  }

  get isUsingLiveGIBS() {
    return this.isLive;
  }

  getTexture() {
    return this.cloudTexture;
  }

  getStatus() {
    return this.lastStatus;
  }

  formatDateStr(date) {
    const y = date.getUTCFullYear().toString();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Updates clouds for the given simulated date.
   */
  updateForDate(date) {
    if (!date) return;
    const nowUtc = new Date();
    const modisLaunch = new Date('2000-02-24T00:00:00Z');

    // Future dates or dates before MODIS launch use static 8K composite
    if (date < modisLaunch || date > nowUtc) {
      const msg = '8K NASA Cloud Composite (Static - Outside MODIS Satellite Range [2000-02-24 to Present])';
      this.applyFallback(msg);
      return;
    }

    const requestedDateStr = this.formatDateStr(date);
    const todayStr = this.formatDateStr(nowUtc);

    // If today is requested, MODIS Terra imagery for the current UTC day is typically
    // incomplete or not yet processed. Fall back to yesterday (N-1) for reliable complete imagery.
    let targetDateStr = requestedDateStr;
    if (requestedDateStr === todayStr) {
      const yesterday = new Date(nowUtc.getTime() - 86400000);
      targetDateStr = this.formatDateStr(yesterday);
    }

    if (this.currentDateStr === targetDateStr && this.isLive) return;
    this.currentDateStr = targetDateStr;

    // Check cache
    if (this.cache.has(targetDateStr)) {
      const cachedCanvas = this.cache.get(targetDateStr);
      this.applyCanvas(cachedCanvas, targetDateStr);
      return;
    }

    this.fetchGIBSDailyClouds(targetDateStr, date);
  }

  fetchGIBSDailyClouds(dateStr, originalDate, retryCount = 0) {
    if (this.isLoading) return;
    this.isLoading = true;

    // NASA GIBS EPSG:4326 250m TileMatrixSet Matrix Dimensions:
    // Level 0: 2 cols x 1 row (1024x512)
    // Level 1: 3 cols x 2 rows (1536x1024)
    // Level 2: 5 cols x 3 rows (2560x1280 equirectangular, discarding bottom out-of-bounds padding)
    // Level 3: 10 cols x 5 rows (5120x2560)
    const MATRIX_CONFIG = {
      0: { cols: 2, rows: 1 },
      1: { cols: 3, rows: 2 },
      2: { cols: 5, rows: 3 },
      3: { cols: 10, rows: 5 }
    };

    const level = this.zoomLevel !== undefined ? this.zoomLevel : 2;
    const cfg = MATRIX_CONFIG[level] || MATRIX_CONFIG[2];
    const rows = cfg.rows;
    const cols = cfg.cols;
    const tileSize = 512;
    const canvasWidth = cols * tileSize;
    // Exactly 2:1 equirectangular aspect ratio (+90 to -90 deg lat across 360 deg lon).
    // For Level 2 (0.140625 deg/px), 180 deg lat is exactly 1280 px (row 2 bottom out-of-bounds padding clipped).
    const canvasHeight = Math.round(canvasWidth / 2);

    const subdomains = ['gibs-a', 'gibs-b', 'gibs-c'];
    const tasks = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sub = subdomains[(r * cols + c) % subdomains.length];
        const url = `https://${sub}.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/250m/${level}/${r}/${c}.jpg`;
        tasks.push({ r, c, url });
      }
    }

    let loadedCount = 0;
    let hasFailed = false;
    let activeWorkers = 0;
    let taskIndex = 0;

    const loadedImages = new Map(); // key "r,c" -> Image

    const onAllLoaded = () => {
      this.isLoading = false;
      try {
        if (typeof document === 'undefined') {
          this.applyFallback();
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const img = loadedImages.get(`${r},${c}`);
            if (img) {
              ctx.drawImage(img, c * tileSize, r * tileSize, tileSize, tileSize);
            }
          }
        }

        // Extract clouds:
        // - Neutral white/grey reflectance = clouds
        // - Mask permanent ice (Antarctica, Greenland, high Arctic)
        // - Reject colored terrain & deserts (diff > 16)
        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;

        for (let y = 0; y < canvasHeight; y++) {
          const lat = 90 - (y / canvasHeight) * 180;
          const isAntarctica = lat < -60;
          const isHighArctic = lat > 80;

          for (let x = 0; x < canvasWidth; x++) {
            const lon = (x / canvasWidth) * 360 - 180;
            const isGreenland = lat >= 60 && lat <= 83 && lon >= -73 && lon <= -18;
            const isSalarDeUyuni = lat >= -21.5 && lat <= -19.5 && lon >= -68.5 && lon <= -66.5;
            const isPermanentIce = isAntarctica || isHighArctic || isGreenland || isSalarDeUyuni;

            const idx = (y * canvasWidth + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3.0;
            const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));

            let alpha = 0;
            if (!isPermanentIce && diff < 16 && brightness > 115) {
              // High reflectance neutral white clouds
              alpha = Math.max(0, Math.min(255, ((brightness - 115) / 90.0 - (diff / 20.0)) * 255.0));
            }

            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = Math.round(alpha);
          }
        }
        ctx.putImageData(imgData, 0, 0);

        this.cache.set(dateStr, canvas);
        if (this.cache.size > 15) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }

        this.applyCanvas(canvas, dateStr);
      } catch (err) {
        console.warn('GIBS cloud processing error, using fallback:', err);
        this.applyFallback();
      }
    };

    const tryNext = () => {
      if (hasFailed) return;
      if (loadedCount === tasks.length) {
        onAllLoaded();
        return;
      }

      while (activeWorkers < this.concurrencyLimit && taskIndex < tasks.length) {
        const currentTask = tasks[taskIndex++];
        activeWorkers++;

        if (typeof Image === 'undefined') {
          hasFailed = true;
          this.isLoading = false;
          this.applyFallback();
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          activeWorkers--;
          loadedCount++;
          loadedImages.set(`${currentTask.r},${currentTask.c}`, img);
          tryNext();
        };

        img.onerror = () => {
          activeWorkers--;
          if (!hasFailed) {
            hasFailed = true;
            this.isLoading = false;
            // Attempt N-1 / N-2 fallback up to 2 retries
            const curDate = new Date(dateStr + 'T12:00:00Z');
            const prevDate = new Date(curDate.getTime() - 86400000);
            const prevDateStr = this.formatDateStr(prevDate);
            if (retryCount < 2 && prevDateStr !== dateStr && !this.cache.has(prevDateStr)) {
              console.warn(`GIBS date ${dateStr} failed, attempting previous day ${prevDateStr} (attempt ${retryCount + 1}/2)`);
              this.fetchGIBSDailyClouds(prevDateStr, originalDate, retryCount + 1);
            } else {
              this.applyFallback('8K NASA Cloud Composite (Fallback - Daily GIBS tiles unavailable)');
            }
          }
        };

        img.src = currentTask.url;
      }
    };

    // Timeout safety: 10s
    setTimeout(() => {
      if (loadedCount < tasks.length && !hasFailed) {
        hasFailed = true;
        this.isLoading = false;
        this.applyFallback();
      }
    }, 10000);

    tryNext();
  }

  applyCanvas(canvas, dateStr) {
    if (!this.canvasTexture) {
      this.canvasTexture = new THREE.CanvasTexture(canvas);
      this.canvasTexture.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.canvasTexture.image = canvas;
      this.canvasTexture.needsUpdate = true;
    }
    this.cloudTexture = this.canvasTexture;
    this.isLive = true;
    this.lastStatus = {
      isLiveDaily: true,
      dateStr,
      message: `NASA GIBS Satellite Cloud Layer (${dateStr})`
    };
  }

  applyFallback(customMessage = null) {
    this.cloudTexture = this.fallbackTexture;
    this.isLive = false;
    this.lastStatus = {
      isLiveDaily: false,
      dateStr: null,
      message: customMessage || '8K NASA Cloud Composite (Fallback)'
    };
  }
}
