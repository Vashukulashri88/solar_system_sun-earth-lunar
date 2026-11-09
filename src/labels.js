import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * Manages 2D HUD labels, selected place pins, and 3D lat/lon graticules for Earth and Moon.
 */
export class LabelsManager {
  constructor(scene, camera, domContainer) {
    this.scene = scene;
    this.camera = camera;
    this.container = domContainer;

    this.showEarthLabels = true;
    this.showMoonLabels = true;
    this.showGraticule = false;

    // Overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'labels-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.overflow = 'hidden';
    this.overlay.style.zIndex = '10';
    this.container.appendChild(this.overlay);

    this.earthLabelElements = [];
    this.moonLabelElements = [];
    this.targetPin = null;

    this.createGraticules();
  }

  createGraticules() {
    this.graticuleGroup = new THREE.Group();
    this.scene.add(this.graticuleGroup);

    // Earth Graticule Lines (unit sphere radius 1.002)
    const earthLinesGeom = this.generateGraticuleGeometry(1.003, [
      -66.56, -23.44, 0, 23.44, 66.56 // Specials: Circles, Tropics, Equator
    ]);
    const earthLinesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    this.earthGraticuleMesh = new THREE.LineSegments(earthLinesGeom, earthLinesMat);

    // Moon Graticule Lines (unit radius 0.273)
    const moonLinesGeom = this.generateGraticuleGeometry(0.2735, [0]);
    const moonLinesMat = new THREE.LineBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    this.moonGraticuleMesh = new THREE.LineSegments(moonLinesGeom, moonLinesMat);

    this.graticuleGroup.add(this.earthGraticuleMesh);
    this.graticuleGroup.add(this.moonGraticuleMesh);
    this.graticuleGroup.visible = this.showGraticule;
  }

  generateGraticuleGeometry(radius, specialLats = [0]) {
    const pts = [];

    // Parallels of latitude every 30 degrees + special latitudes
    const latitudes = [-60, -30, 30, 60, ...specialLats];
    for (const lat of latitudes) {
      const phi = lat * DEG2RAD;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const segs = 64;
      for (let i = 0; i < segs; i++) {
        const u0 = (i / segs) * Math.PI * 2;
        const u1 = ((i + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(radius * cosPhi * Math.cos(u0), radius * sinPhi, -radius * cosPhi * Math.sin(u0)),
          new THREE.Vector3(radius * cosPhi * Math.cos(u1), radius * sinPhi, -radius * cosPhi * Math.sin(u1))
        );
      }
    }

    // Meridians of longitude every 30 degrees
    for (let lon = -180; lon < 180; lon += 30) {
      const lam = lon * DEG2RAD;
      const cosLam = Math.cos(lam);
      const sinLam = Math.sin(lam);
      const segs = 32;
      for (let i = 0; i < segs; i++) {
        const v0 = (-90 + (i / segs) * 180) * DEG2RAD;
        const v1 = (-90 + ((i + 1) / segs) * 180) * DEG2RAD;
        pts.push(
          new THREE.Vector3(radius * Math.cos(v0) * cosLam, radius * Math.sin(v0), -radius * Math.cos(v0) * sinLam),
          new THREE.Vector3(radius * Math.cos(v1) * cosLam, radius * Math.sin(v1), -radius * Math.cos(v1) * sinLam)
        );
      }
    }

    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  setGraticuleVisible(visible) {
    this.showGraticule = visible;
    if (this.graticuleGroup) this.graticuleGroup.visible = visible;
  }

  initLabels(placesManager) {
    this.overlay.innerHTML = '';
    this.earthLabelElements = [];
    this.moonLabelElements = [];

    // 1. Earth: Countries sorted by area descending (priority)
    const sortedCountries = [...placesManager.countries].sort((a, b) => (b.area || 0) - (a.area || 0));
    for (const country of sortedCountries) {
      const el = document.createElement('div');
      el.className = 'scene-label country-label';
      el.textContent = country.name;
      this.overlay.appendChild(el);
      this.earthLabelElements.push({
        element: el,
        country,
        lat: country.centroid.lat,
        lon: country.centroid.lon
      });
    }

    // 2. Moon: Landing Sites & Maria & Major Craters
    const moonFeat = placesManager.moonFeatures;

    // Landing sites (high priority)
    for (const site of moonFeat.landingSites || []) {
      const el = document.createElement('div');
      el.className = 'scene-label moon-label moon-landing-label';
      el.innerHTML = `<span class="badge-icon">🚀</span>${site.name}`;
      this.overlay.appendChild(el);
      this.moonLabelElements.push({
        element: el,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        isLanding: true
      });
    }

    // Maria (Seas)
    for (const m of moonFeat.maria || []) {
      const el = document.createElement('div');
      el.className = 'scene-label moon-label moon-mare-label';
      el.innerHTML = `<span class="badge-icon">🌊</span>${m.name}`;
      this.overlay.appendChild(el);
      this.moonLabelElements.push({
        element: el,
        name: m.name,
        lat: m.lat,
        lon: m.lon,
        isMare: true
      });
    }

    // Major Craters
    for (const cr of moonFeat.craters || []) {
      const el = document.createElement('div');
      el.className = 'scene-label moon-label moon-crater-label';
      el.innerHTML = `<span class="badge-icon">⭕</span>${cr.name}`;
      this.overlay.appendChild(el);
      this.moonLabelElements.push({
        element: el,
        name: cr.name,
        lat: cr.lat,
        lon: cr.lon,
        isCrater: true
      });
    }
  }

  /**
   * Updates 2D label projections every frame
   */
  update(sceneManager) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    const earthMesh = sceneManager.earthMesh;
    const moonMesh = sceneManager.moonMesh;

    // Update Graticule positioning attached to earth/moon mesh
    if (this.showGraticule) {
      this.earthGraticuleMesh.position.copy(sceneManager.earthGroup.position);
      this.earthGraticuleMesh.quaternion.copy(earthMesh.getWorldQuaternion(new THREE.Quaternion()));
      this.earthGraticuleMesh.scale.copy(earthMesh.scale);

      this.moonGraticuleMesh.position.copy(sceneManager.moonGroup.position);
      this.moonGraticuleMesh.quaternion.copy(moonMesh.getWorldQuaternion(new THREE.Quaternion()));
      this.moonGraticuleMesh.scale.copy(moonMesh.scale);
    }

    const camPos = this.camera.position;
    const earthPos = sceneManager.earthGroup.position;
    const moonPos = sceneManager.moonGroup.position;

    const distToEarth = camPos.distanceTo(earthPos);
    const distToMoon = camPos.distanceTo(moonPos);

    const activeTarget = (sceneManager.cameraController ? sceneManager.cameraController.targetMode : null) ||
                         (distToMoon < 2.0 ? 'moon' : (distToEarth < 4.0 ? 'earth' : null));
    const isEarthTarget = activeTarget === 'earth';
    const isMoonTarget = activeTarget === 'moon';

    // 1. Project Earth Country Labels with priority decluttering and collision avoidance
    // Never display Earth country labels when actively focusing or inspecting the Moon
    const shouldShowEarthLabels = this.showEarthLabels && isEarthTarget && distToEarth < 45;
    if (shouldShowEarthLabels) {
      const earthRadius = sceneManager.earthRadius * earthMesh.scale.x;
      const earthQuat = earthMesh.getWorldQuaternion(new THREE.Quaternion());
      const minAreaThreshold = Math.max(0, (distToEarth - 2.0) * 120);
      const placedBoxes = [];

      for (const item of this.earthLabelElements) {
        if (item.country.area && item.country.area < minAreaThreshold) {
          item.element.style.display = 'none';
          continue;
        }

        // Compute local vector on unit sphere
        const phi = item.lat * DEG2RAD;
        const lam = item.lon * DEG2RAD;
        const localPos = new THREE.Vector3(
          Math.cos(phi) * Math.cos(lam),
          Math.sin(phi),
          -Math.cos(phi) * Math.sin(lam)
        );

        // Transform to world space
        const worldPos = localPos.clone().applyQuaternion(earthQuat).multiplyScalar(earthRadius * 1.01).add(earthPos);

        // Check if facing camera (hide on limb and far side)
        const normal = localPos.clone().applyQuaternion(earthQuat).normalize();
        const toCam = new THREE.Vector3().subVectors(camPos, worldPos).normalize();
        const facingDot = normal.dot(toCam);

        if (facingDot > 0.30) {
          // Project to 2D screen
          const projected = worldPos.clone().project(this.camera);
          if (projected.z > 0 && projected.z < 1) {
            const x = (projected.x * 0.5 + 0.5) * width;
            const y = (-projected.y * 0.5 + 0.5) * height;

            // Collision avoidance box
            const nameLen = item.country.name.length;
            const boxW = Math.max(50, nameLen * 7.5 + 18);
            const boxH = 22;
            const padX = 8;
            const padY = 5;
            const box = {
              left: x - boxW / 2 - padX,
              right: x + boxW / 2 + padX,
              top: y - boxH / 2 - padY,
              bottom: y + boxH / 2 + padY
            };

            let overlap = false;
            for (const b of placedBoxes) {
              if (box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top) {
                overlap = true;
                break;
              }
            }

            if (!overlap) {
              placedBoxes.push(box);
              item.element.style.display = 'block';
              item.element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
              item.element.style.opacity = Math.min(1.0, (facingDot - 0.30) * 3.5).toFixed(2);
              continue;
            }
          }
        }
        item.element.style.display = 'none';
      }
    } else {
      for (const item of this.earthLabelElements) {
        item.element.style.display = 'none';
      }
    }

    // 2. Project Moon Labels with collision avoidance
    // Never display Moon labels when actively focusing or inspecting Earth
    const shouldShowMoonLabels = this.showMoonLabels && isMoonTarget && distToMoon < 25;
    if (shouldShowMoonLabels) {
      const moonRadius = sceneManager.moonRadius * moonMesh.scale.x;
      const moonQuat = moonMesh.getWorldQuaternion(new THREE.Quaternion());
      const placedMoonBoxes = [];

      for (const item of this.moonLabelElements) {
        const phi = item.lat * DEG2RAD;
        const lam = item.lon * DEG2RAD;
        const localPos = new THREE.Vector3(
          Math.cos(phi) * Math.cos(lam),
          Math.sin(phi),
          -Math.cos(phi) * Math.sin(lam)
        );

        const worldPos = localPos.clone().applyQuaternion(moonQuat).multiplyScalar(moonRadius * 1.01).add(moonPos);
        const normal = localPos.clone().applyQuaternion(moonQuat).normalize();
        const toCam = new THREE.Vector3().subVectors(camPos, worldPos).normalize();
        const facingDot = normal.dot(toCam);

        if (facingDot > 0.20) {
          const projected = worldPos.clone().project(this.camera);
          if (projected.z > 0 && projected.z < 1) {
            const x = (projected.x * 0.5 + 0.5) * width;
            const y = (-projected.y * 0.5 + 0.5) * height;

            const nameLen = (item.name || '').length;
            const boxW = Math.max(45, nameLen * 7.5 + 24);
            const boxH = 22;
            const padX = 6;
            const padY = 4;
            const box = {
              left: x - boxW / 2 - padX,
              right: x + boxW / 2 + padX,
              top: y - boxH / 2 - padY,
              bottom: y + boxH / 2 + padY
            };

            let overlap = false;
            for (const b of placedMoonBoxes) {
              if (box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top) {
                overlap = true;
                break;
              }
            }

            if (!overlap) {
              placedMoonBoxes.push(box);
              item.element.style.display = 'block';
              item.element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
              item.element.style.opacity = Math.min(1.0, (facingDot - 0.20) * 3.5).toFixed(2);
              continue;
            }
          }
        }
        item.element.style.display = 'none';
      }
    } else {
      for (const item of this.moonLabelElements) {
        item.element.style.display = 'none';
      }
    }
  }
}
