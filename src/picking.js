import * as THREE from 'three';

const RAD2DEG = 180 / Math.PI;

export class PickingManager {
  constructor(domElement, camera, sceneManager, placesManager, onSelect) {
    this.domElement = domElement;
    this.camera = camera;
    this.sceneManager = sceneManager;
    this.placesManager = placesManager;
    this.onSelect = onSelect;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.pointerDownPos = { x: 0, y: 0 };

    this.selectedMarker = this.createSelectionMarker();
    this.sceneManager.scene.add(this.selectedMarker);
    this.selectedPlace = null;

    this.attachEvents();
  }

  createSelectionMarker() {
    const group = new THREE.Group();

    // Glowing pulsing ring
    const ringGeom = new THREE.RingGeometry(0.04, 0.055, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    group.add(ringMesh);

    // Inner bright dot
    const dotGeom = new THREE.CircleGeometry(0.015, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    group.add(dotMesh);

    group.visible = false;
    return group;
  }

  attachEvents() {
    this.domElement.addEventListener('pointerdown', (e) => {
      this.isDragging = false;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    this.domElement.addEventListener('pointermove', (e) => {
      const dx = Math.abs(e.clientX - this.pointerDownPos.x);
      const dy = Math.abs(e.clientY - this.pointerDownPos.y);
      if (dx > 4 || dy > 4) {
        this.isDragging = true;
      }
    });

    this.domElement.addEventListener('pointerup', (e) => {
      if (this.isDragging) return; // Ignore drag/orbit events
      this.handleClick(e);
    });
  }

  handleClick(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const earthMesh = this.sceneManager.earthMesh;
    const moonMesh = this.sceneManager.moonMesh;

    const targets = [earthMesh, moonMesh].filter(Boolean);
    const intersects = this.raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const isEarth = hit.object === earthMesh;
      const targetMesh = hit.object;

      // Convert intersection point to local mesh space
      const localPt = targetMesh.worldToLocal(hit.point.clone());
      const radius = localPt.length();

      // SphereGeometry UV/spherical mapping:
      // lat: arcsin(y / R)
      // lon: atan2(-z, x)
      const lat = Math.asin(Math.max(-1, Math.min(1, localPt.y / radius))) * RAD2DEG;
      const lon = Math.atan2(-localPt.z, localPt.x) * RAD2DEG;

      const state = this.sceneManager.lastCelestialState || {};

      let placeInfo = null;
      if (isEarth) {
        placeInfo = this.placesManager.inspectEarth(lat, lon, state);
      } else {
        placeInfo = this.placesManager.inspectMoon(lat, lon, state);
      }

      this.selectedPlace = {
        body: isEarth ? 'earth' : 'moon',
        lat,
        lon,
        info: placeInfo
      };

      if (this.onSelect) {
        this.onSelect(placeInfo);
      }
    }
  }

  selectPlaceByCoords(body, lat, lon, info) {
    this.selectedPlace = {
      body,
      lat,
      lon,
      info
    };
    if (this.onSelect) {
      this.onSelect(info);
    }
  }

  clearSelection() {
    this.selectedPlace = null;
    if (this.selectedMarker) this.selectedMarker.visible = false;
  }

  update(nowSeconds) {
    if (!this.selectedPlace) {
      this.selectedMarker.visible = false;
      return;
    }

    const { body, lat, lon } = this.selectedPlace;
    const isEarth = body === 'earth';
    const mesh = isEarth ? this.sceneManager.earthMesh : this.sceneManager.moonMesh;
    const parentGroup = isEarth ? this.sceneManager.earthGroup : this.sceneManager.moonGroup;
    const baseRadius = isEarth ? this.sceneManager.earthRadius : this.sceneManager.moonRadius;
    const scale = mesh.scale.x;
    const radius = baseRadius * scale * 1.006;

    const phi = lat * (Math.PI / 180);
    const lam = lon * (Math.PI / 180);
    const localPt = new THREE.Vector3(
      Math.cos(phi) * Math.cos(lam),
      Math.sin(phi),
      -Math.cos(phi) * Math.sin(lam)
    );

    const quat = mesh.getWorldQuaternion(new THREE.Quaternion());
    const normal = localPt.clone().applyQuaternion(quat).normalize();
    const worldPos = normal.clone().multiplyScalar(radius).add(parentGroup.position);

    this.selectedMarker.position.copy(worldPos);
    this.selectedMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    // Pulse animation
    const pulse = 1.0 + 0.15 * Math.sin(nowSeconds * 4.0);
    const markerScale = isEarth ? (scale * 0.8 * pulse) : (scale * 0.4 * pulse);
    this.selectedMarker.scale.set(markerScale, markerScale, markerScale);
    this.selectedMarker.visible = true;
  }
}
