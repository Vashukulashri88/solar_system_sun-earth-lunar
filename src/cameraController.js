import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, domElement, sceneManager) {
    this.camera = camera;
    this.domElement = domElement;
    this.sceneManager = sceneManager;

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 150000;

    this.targetMode = 'earth'; // 'earth' | 'moon' | 'system' | 'sun' | 'earthrise'
    this.focusedPlace = null;
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.startCamPos = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.destCamPos = new THREE.Vector3();
    this.destTarget = new THREE.Vector3();

    this.controls.addEventListener('start', () => {
      this.focusedPlace = null;
    });

    this.setFocus('earth', false);
  }

  setFocus(mode, smooth = true) {
    this.focusedPlace = null;
    this.targetMode = mode;
    const isTrueScale = (this.sceneManager.scaleMode === 'true');
    const earthPos = this.sceneManager.earthGroup.position;
    const moonPos = this.sceneManager.moonGroup.position;
    const sunPos = this.sceneManager.sunGroup.position;

    let target = new THREE.Vector3();
    let camOffset = new THREE.Vector3();

    switch (mode) {
      case 'earth':
        target.copy(earthPos);
        camOffset.set(0, isTrueScale ? 1.5 : 2.5, isTrueScale ? 3.0 : 4.5);
        break;

      case 'moon':
        target.copy(moonPos);
        camOffset.set(0, isTrueScale ? 0.5 : 0.8, isTrueScale ? 1.2 : 1.8);
        break;

      case 'system':
        // Midpoint between Earth and Moon
        target.addVectors(earthPos, moonPos).multiplyScalar(0.5);
        camOffset.set(0, isTrueScale ? 50 : 12, isTrueScale ? 100 : 22);
        break;

      case 'sun':
        target.copy(sunPos);
        // Sun radius in true scale is 69.63 units; camOffset must be outside the photosphere
        camOffset.set(0, isTrueScale ? 160 : 18, isTrueScale ? 360 : 45);
        break;

      case 'earthrise': {
        // On the Moon surface looking directly towards Earth
        target.copy(earthPos);
        const moonToEarth = new THREE.Vector3().subVectors(earthPos, moonPos).normalize();
        const moonR = isTrueScale ? 0.175 : 0.28;
        const moonSurfacePos = moonPos.clone().add(moonToEarth.clone().multiplyScalar(moonR));
        this.camera.position.copy(moonSurfacePos);
        this.controls.target.copy(earthPos);
        this.controls.update();
        return;
      }

      case 'my_location': {
        const userLoc = this.getUserLocation();
        this.flyToPlace('earth', userLoc.lat, userLoc.lon);
        return;
      }

      default:
        target.copy(earthPos);
        camOffset.set(0, 2.5, 4.5);
    }

    const desiredCamPos = target.clone().add(camOffset);

    if (smooth) {
      this.isTransitioning = true;
      this.transitionProgress = 0;
      this.startCamPos.copy(this.camera.position);
      this.startTarget.copy(this.controls.target);
      this.destCamPos.copy(desiredCamPos);
      this.destTarget.copy(target);
    } else {
      this.controls.target.copy(target);
      this.camera.position.copy(desiredCamPos);
      this.controls.update();
    }
  }

  flyToPlace(body, lat, lon) {
    this.targetMode = body;
    this.focusedPlace = { body, lat, lon };
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.startCamPos.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
  }

  getUserLocation() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const offsetMin = -new Date().getTimezoneOffset();
      if (tz.includes('Kolkata') || tz.includes('Calcutta') || offsetMin === 330) {
        return { name: 'India', lat: 20.59, lon: 78.96 };
      }
      const approxLon = (offsetMin / 60) * 15;
      return { name: 'Local Location', lat: 20.0, lon: approxLon };
    } catch (e) {
      return { name: 'India', lat: 20.59, lon: 78.96 };
    }
  }

  update(delta = 0.016) {
    const isTrueScale = (this.sceneManager.scaleMode === 'true');
    const earthPos = this.sceneManager.earthGroup.position;
    const moonPos = this.sceneManager.moonGroup.position;
    const sunPos = this.sceneManager.sunGroup.position;

    if (this.focusedPlace) {
      const { body, lat, lon } = this.focusedPlace;
      const isEarth = (body === 'earth');
      const mesh = isEarth ? this.sceneManager.earthMesh : this.sceneManager.moonMesh;
      const parentGroup = isEarth ? this.sceneManager.earthGroup : this.sceneManager.moonGroup;
      const viewDist = isEarth ? (isTrueScale ? 3.0 : 2.4) : (isTrueScale ? 0.9 : 0.8);

      const phi = lat * (Math.PI / 180);
      const lam = lon * (Math.PI / 180);
      const localPt = new THREE.Vector3(
        Math.cos(phi) * Math.cos(lam),
        Math.sin(phi),
        -Math.cos(phi) * Math.sin(lam)
      );

      const quat = mesh ? mesh.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
      const normal = localPt.clone().applyQuaternion(quat).normalize();
      const currentTarget = parentGroup.position.clone();
      const desiredCamPos = currentTarget.clone().add(normal.multiplyScalar(viewDist));

      if (this.isTransitioning) {
        this.transitionProgress += delta * 2.5;
        if (this.transitionProgress >= 1.0) {
          this.transitionProgress = 1.0;
          this.isTransitioning = false;
        }
        const t = this.transitionProgress;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        this.camera.position.lerpVectors(this.startCamPos, desiredCamPos, ease);
        this.controls.target.lerpVectors(this.startTarget, currentTarget, ease);
      } else {
        this.controls.target.copy(currentTarget);
        this.camera.position.copy(desiredCamPos);
      }
      this.controls.update();
      return;
    }

    if (this.isTransitioning) {
      this.transitionProgress += delta * 2.0;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.isTransitioning = false;
      }

      // Smooth cubic easing
      const t = this.transitionProgress;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.startCamPos, this.destCamPos, ease);
      this.controls.target.lerpVectors(this.startTarget, this.destTarget, ease);
    } else {
      // Dynamic camera tracking when bodies move
      let currentTarget = new THREE.Vector3();
      switch (this.targetMode) {
        case 'earth':
          currentTarget.copy(earthPos);
          break;
        case 'moon':
          currentTarget.copy(moonPos);
          break;
        case 'system':
          currentTarget.addVectors(earthPos, moonPos).multiplyScalar(0.5);
          break;
        case 'sun':
          currentTarget.copy(sunPos);
          break;
        case 'earthrise': {
          // Keep attached to moving lunar surface looking at Earth
          const moonToEarth = new THREE.Vector3().subVectors(earthPos, moonPos).normalize();
          const moonR = isTrueScale ? 0.175 : 0.28;
          const moonSurfacePos = moonPos.clone().add(moonToEarth.clone().multiplyScalar(moonR));
          this.camera.position.copy(moonSurfacePos);
          this.controls.target.copy(earthPos);
          break;
        }
      }

      if (this.targetMode !== 'earthrise') {
        const offset = this.camera.position.clone().sub(this.controls.target);
        this.controls.target.copy(currentTarget);
        this.camera.position.copy(currentTarget).add(offset);
      }
    }

    this.controls.update();
  }
}
