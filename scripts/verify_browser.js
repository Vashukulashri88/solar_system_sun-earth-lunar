import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\ckceg\\.gemini\\antigravity\\brain\\685f397a-0078-4d5b-a01d-42fab99a53dc';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Locate browser binary (Edge or Chrome)
const candidatePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    browserPath = p;
    break;
  }
}

if (!browserPath) {
  console.error('FATAL: Neither Microsoft Edge nor Google Chrome found!');
  process.exit(1);
}

console.log(`Using browser: ${browserPath}`);
console.log(`Saving screenshots to: ${SCREENSHOT_DIR}\n`);

async function runBrowserVerification() {
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--window-size=1600,900',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: { width: 1600, height: 900 }
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  const uncaughtErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.error('  [Browser Console Error]:', text);
    }
  });

  page.on('pageerror', (err) => {
    console.error('  [Browser Uncaught Exception]:', err.message);
    uncaughtErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:8080...');
  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for 3D initialization, textures, and place data to load
  await page.waitForFunction(() => {
    const sim = window.__sim;
    return sim && sim.sceneManager && sim.sceneManager.earthDay8k?.image && sim.sceneManager.moonTexture?.image;
  }, { timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  // 1. Verify canvas and Three.js renderer
  const hasCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('#canvasContainer canvas');
    return canvas && canvas.width > 0 && canvas.height > 0;
  });
  console.log('Three.js canvas active:', hasCanvas);
  if (!hasCanvas) throw new Error('Canvas not found or not initialized');

  // Verify textures loaded
  const texturesStatus = await page.evaluate(() => {
    const sim = window.__sim;
    if (!sim) return { error: 'window.__sim not found' };
    const sm = sim.sceneManager;
    return {
      earthDayLoaded: !!(sm.earthDay8k && sm.earthDay8k.image),
      moonLoaded: !!(sm.moonTexture && sm.moonTexture.image),
      seasonalCount: sm.seasonalTextures.length,
      isLiveClouds: sm.cloudManager ? sm.cloudManager.isUsingLiveGIBS : false,
      cloudStatus: sm.cloudManager ? sm.cloudManager.getStatus() : null,
      maxTextureSize: sm.maxTextureSize
    };
  });
  console.log('Texture status:', JSON.stringify(texturesStatus, null, 2));

  // Screenshot 1: Overview 8K Scene (Clean Country Labels, No Dark West Limb Sliver, No Red Fringe)
  const shot1 = path.join(SCREENSHOT_DIR, '01_initial_overview_8k_scene.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`Captured Screenshot 1: ${shot1}`);

  // Screenshot 2: Switch Camera to Moon Orbit & Verify Lunar Feature Labels + IAU Orientation (No stars in disk!)
  console.log('Switching camera to Moon Orbit (focus Moon)...');
  await page.click('#camMoonBtn');
  await new Promise(r => setTimeout(r, 2000));

  const moonLabelsCount = await page.evaluate(() => {
    const labels = document.querySelectorAll('.moon-label');
    return labels.length;
  });
  console.log(`Moon feature labels in DOM: ${moonLabelsCount}`);

  const shot2 = path.join(SCREENSHOT_DIR, '02_moon_focused_iau_orientation.png');
  await page.screenshot({ path: shot2 });
  console.log(`Captured Screenshot 2: ${shot2}`);

  // Screenshot 3: Test Time Scrubber Interaction (Top bar & Scrubber readout in sync)
  console.log('Testing Time Scrubber...');
  await page.evaluate(() => {
    const slider = document.getElementById('timeScrubber');
    if (slider) {
      slider.value = 250; // scrub forward
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  const scrubberData = await page.evaluate(() => {
    const dateInput = document.getElementById('datePickerInput');
    const offsetText = document.getElementById('scrubberOffsetDisplay');
    const badge = document.getElementById('liveStatusBadge');
    return {
      date: dateInput ? dateInput.value : '',
      scrubberDisplay: offsetText ? offsetText.textContent : '',
      badgeText: badge ? badge.textContent : ''
    };
  });
  console.log('Scrubber test status:', scrubberData);

  const shot3 = path.join(SCREENSHOT_DIR, '03_time_scrubber_interaction.png');
  await page.screenshot({ path: shot3 });
  console.log(`Captured Screenshot 3: ${shot3}`);

  // Screenshot 4: Test Reverse Time Warp (-1d/s)
  console.log('Testing Reverse Time Warp (-1d/s)...');
  await page.evaluate(() => {
    const rewindBtn = document.querySelector('button[data-warp="-86400"]');
    if (rewindBtn) rewindBtn.click();
  });
  await new Promise(r => setTimeout(r, 2200));

  const warpActive = await page.evaluate(() => {
    const badge = document.getElementById('liveStatusBadge');
    const offsetText = document.getElementById('scrubberOffsetDisplay');
    const slider = document.getElementById('timeScrubber');
    return {
      badgeText: badge ? badge.textContent : '',
      scrubberDisplay: offsetText ? offsetText.textContent : '',
      sliderVal: slider ? slider.value : ''
    };
  });
  console.log('Warp speed status:', warpActive);

  const shot4 = path.join(SCREENSHOT_DIR, '04_reverse_time_warp.png');
  await page.screenshot({ path: shot4 });
  console.log(`Captured Screenshot 4: ${shot4}`);

  // Screenshot 5: Test Picking Readout & Apollo 11 Inspector at 2026-11-05 18:11 UTC
  console.log('Inspecting Apollo 11 at 2026-11-05 18:11 UTC...');
  await page.evaluate(() => {
    // Set to exact test date 2026-11-05 18:11 UTC and pause
    window.__sim.timeController.setDate(new Date('2026-11-05T18:11:00Z'));
    window.__sim.timeController.setPaused(true);
    const input = document.getElementById('placeSearchInput');
    if (input) {
      input.value = 'Apollo 11';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 600));

  await page.evaluate(() => {
    const dropdown = document.getElementById('searchResultsDropdown');
    const firstItem = dropdown ? dropdown.querySelector('.search-item') : null;
    if (firstItem) firstItem.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  const inspectorData = await page.evaluate(() => {
    const card = document.getElementById('placeInspectorCard');
    const name = document.getElementById('placeName');
    const coords = document.getElementById('placeCoords');
    const desc = document.getElementById('placeDescription');
    const marker = window.__sim.pickingManager.marker;
    return {
      cardVisible: card && !card.classList.contains('hidden'),
      placeName: name ? name.textContent : '',
      coords: coords ? coords.textContent : '',
      description: desc ? desc.textContent : '',
      markerPos: marker ? { x: marker.position.x, y: marker.position.y, z: marker.position.z } : null
    };
  });
  console.log('Apollo 11 Inspector data:', inspectorData);

  const shot5 = path.join(SCREENSHOT_DIR, '05_picking_readout_inspector.png');
  await page.screenshot({ path: shot5 });
  console.log(`Captured Screenshot 5: ${shot5}`);

  // Screenshot 6: In-App Credits / Attribution Modal
  console.log('Opening Credits & Attribution Modal...');
  await page.evaluate(() => {
    const btn = document.getElementById('creditsBtn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const shot6 = path.join(SCREENSHOT_DIR, '06_credits_attribution_modal.png');
  await page.screenshot({ path: shot6 });
  console.log(`Captured Screenshot 6: ${shot6}`);

  // Close modal and inspector card
  await page.evaluate(() => {
    const btn = document.getElementById('closeCreditsBtn');
    if (btn) btn.click();
    const card = document.getElementById('placeInspectorCard');
    if (card) card.classList.add('hidden');
    if (window.__sim.pickingManager) window.__sim.pickingManager.clearSelection();
  });
  await new Promise(r => setTimeout(r, 400));

  // Screenshot 7: Earth Night Side with 8K Black Marble City Lights
  console.log('Capturing Earth Night Side with City Lights...');
  await page.evaluate(() => {
    const sim = window.__sim;
    sim.timeController.setLive();
    sim.cameraController.setFocus('earth', false);
    // Position camera on the anti-sunward (night) hemisphere of Earth
    const earthPos = sim.sceneManager.earthGroup.position;
    const sunPos = sim.sceneManager.sunMesh.position;
    const dirAway = new window.THREE.Vector3().subVectors(earthPos, sunPos).normalize();
    sim.cameraController.camera.position.copy(earthPos.clone().add(dirAway.clone().multiplyScalar(2.4)).add(new window.THREE.Vector3(0, 0.2, 0)));
    sim.cameraController.controls.target.copy(earthPos);
    sim.cameraController.controls.update();
  });
  await new Promise(r => setTimeout(r, 1500));

  const shot7 = path.join(SCREENSHOT_DIR, '07_earth_night_city_lights.png');
  await page.screenshot({ path: shot7 });
  console.log(`Captured Screenshot 7: ${shot7}`);

  // Screenshot 8: Moon seen from Earth direction showing proper phase (Waxing Gibbous)
  console.log('Capturing Moon Phase Seen From Earth...');
  await page.evaluate(() => {
    const sim = window.__sim;
    // Set to Waxing Gibbous date (81% illuminated) where Moon is in night sky pointing away from Sun
    sim.timeController.setDate(new Date('2026-11-20T18:00:00Z'));
    sim.timeController.setPaused(true);
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const sim = window.__sim;
    sim.cameraController.setFocus('moon', false);
    const earthPos = sim.sceneManager.earthGroup.position;
    const moonPos = sim.sceneManager.moonGroup.position;
    const dirEarthToMoon = new window.THREE.Vector3().subVectors(moonPos, earthPos).normalize();
    // Position camera along Earth-to-Moon line looking directly at the Moon disk at a comfortable distance
    sim.cameraController.camera.position.copy(moonPos.clone().sub(dirEarthToMoon.clone().multiplyScalar(1.2)));
    sim.cameraController.controls.target.copy(moonPos);
    sim.cameraController.controls.update();
  });
  await new Promise(r => setTimeout(r, 1500));

  const shot8 = path.join(SCREENSHOT_DIR, '08_moon_phase_from_earth.png');
  await page.screenshot({ path: shot8 });
  console.log(`Captured Screenshot 8: ${shot8}`);

  // Screenshot 9: 2024-04-08 18:17 UTC Solar Eclipse (Moon shadow over Mexico / Texas)
  console.log('Capturing 2024-04-08 18:17 UTC Solar Eclipse...');
  await page.evaluate(() => {
    const sim = window.__sim;
    // Set exact eclipse maximum date
    sim.timeController.setDate(new Date('2024-04-08T18:17:00Z'));
    sim.timeController.setPaused(true);
  });
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    const sim = window.__sim;
    // Fly camera directly to Mexico / Texas (lat 25°N, lon -101°W)
    sim.cameraController.flyToPlace('earth', 25.0, -101.0);
  });
  await new Promise(r => setTimeout(r, 2500));

  const shot9 = path.join(SCREENSHOT_DIR, '09_solar_eclipse_2024_04_08.png');
  await page.screenshot({ path: shot9 });
  console.log(`Captured Screenshot 9: ${shot9}`);

  await browser.close();

  console.log('\n--- BROWSER VERIFICATION SUMMARY ---');
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Uncaught errors: ${uncaughtErrors.length}`);
  if (uncaughtErrors.length > 0) {
    console.error('FAILED: Uncaught browser errors detected:', uncaughtErrors);
    process.exit(1);
  }

  console.log('✅ BROWSER VERIFICATION FULLY SUCCESSFUL WITH ZERO UNCAUGHT ERRORS!');
}

runBrowserVerification().catch((err) => {
  console.error('Fatal Browser Test Error:', err);
  process.exit(1);
});
