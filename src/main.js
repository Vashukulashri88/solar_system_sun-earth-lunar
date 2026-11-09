import * as THREE from 'three';
import { SolarSystemScene } from './scene.js';
import { CameraController } from './cameraController.js';
import { TimeController } from './timeController.js';
import { UserInterface } from './ui.js';
import { getCelestialState } from './ephemeris.js';
import { PlacesManager } from './places.js';
import { LabelsManager } from './labels.js';
import { PickingManager } from './picking.js';

window.THREE = THREE;

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvasContainer');

  // 1. Initialize Scene & 3D Objects
  const sceneManager = new SolarSystemScene(container);

  // 2. Initialize Camera & Controls
  const cameraController = new CameraController(
    sceneManager.camera,
    sceneManager.renderer.domElement,
    sceneManager
  );
  sceneManager.cameraController = cameraController;

  // 3. Initialize Time Controller
  const timeController = new TimeController();

  // 4. Initialize Places, 2D HUD Labels, and 3D Picking
  const placesManager = new PlacesManager();
  const labelsManager = new LabelsManager(
    sceneManager.scene,
    sceneManager.camera,
    container
  );

  let ui = null;

  const pickingManager = new PickingManager(
    sceneManager.renderer.domElement,
    sceneManager.camera,
    sceneManager,
    placesManager,
    (placeInfo) => {
      if (ui) ui.showPlaceInspector(placeInfo);
    }
  );

  // 5. Initialize User Interface
  ui = new UserInterface(
    document.body,
    timeController,
    sceneManager,
    cameraController,
    placesManager,
    labelsManager,
    pickingManager
  );

  // Load place geo-data & lunar features, then populate labels
  placesManager.load().then((success) => {
    if (success) {
      labelsManager.initLabels(placesManager);
      if (cameraController.targetMode === 'my_location' || cameraController.targetMode === 'earth') {
        const userLoc = cameraController.getUserLocation();
        const state = getCelestialState(timeController.simulatedDate);
        const info = placesManager.inspectEarth(userLoc.lat, userLoc.lon, state);
        if (info) {
          pickingManager.selectPlaceByCoords('earth', userLoc.lat, userLoc.lon, info);
          ui.showPlaceInspector(info);
        }
      }
    }
  });

  // Expose for testing & verification
  window.__sim = {
    sceneManager,
    cameraController,
    timeController,
    placesManager,
    labelsManager,
    pickingManager,
    ui
  };

  // 6. Main Animation Loop
  let lastTime = performance.now();
  let elapsedTotalSeconds = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    elapsedTotalSeconds += delta;

    // Advance simulated time
    const simulatedDate = timeController.update(now);

    // Compute live real astronomical coordinates & ephemerides
    const celestialState = getCelestialState(simulatedDate);

    // Update 3D planetary positions, rotations, lighting & shaders
    sceneManager.update(celestialState, elapsedTotalSeconds);

    // Update camera tracking
    cameraController.update(delta);

    // Update 3D picking marker animation & location tracking
    pickingManager.update(elapsedTotalSeconds);

    // Update 2D projected labels & graticules
    labelsManager.update(sceneManager);

    // Update HUD telemetry
    ui.updateTelemetry(celestialState);

    // Render 3D frame
    sceneManager.render();
  }

  requestAnimationFrame(animate);
});
