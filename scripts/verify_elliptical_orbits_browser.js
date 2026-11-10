import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SCREENSHOT_DIR = path.join(projectRoot, 'screenshots');
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

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(projectRoot, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500);
          res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
        } else {
          res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
          res.end(content);
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`Test server running on port ${port}...`);
      resolve({ server, port });
    });
  });
}

async function runVerification() {
  const { server, port } = await startServer();

  console.log(`Launching headless browser: ${browserPath}...`);
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--window-size=1600,900'
    ],
    defaultViewport: { width: 1600, height: 900 }
  });

  try {
    const page = await browser.newPage();
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));
    page.on('pageerror', err => console.error('  [Browser Error]:', err.message));

    console.log(`Navigating to http://127.0.0.1:${port}...`);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for simulation initialization
    await page.waitForFunction(() => {
      return window.__sim && window.__sim.sceneManager && window.__sim.sceneManager.earthOrbitLine;
    }, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Verify orbits state in live browser page
    const orbitInfo = await page.evaluate(() => {
      const scene = window.__sim.sceneManager;
      const earthGeom = scene.earthOrbitLine.geometry;
      const moonGeom = scene.moonOrbitLine.geometry;

      const earthPts = earthGeom.attributes.position.count;
      const moonPts = moonGeom.attributes.position.count;

      const periPos = scene.perihelionMarker.position;
      const aphPos = scene.aphelionMarker.position;
      const perigeePos = scene.perigeeMarker.position;
      const apogeePos = scene.apogeeMarker.position;

      return {
        earthPointsCount: earthPts,
        moonPointsCount: moonPts,
        earthVisible: scene.earthOrbitLine.visible,
        moonVisible: scene.moonOrbitLine.visible,
        perihelionDist: Math.sqrt(periPos.x**2 + periPos.y**2 + periPos.z**2),
        aphelionDist: Math.sqrt(aphPos.x**2 + aphPos.y**2 + aphPos.z**2),
        perigeeWorldPos: { x: perigeePos.x, y: perigeePos.y, z: perigeePos.z },
        apogeeWorldPos: { x: apogeePos.x, y: apogeePos.y, z: apogeePos.z }
      };
    });

    console.log('Orbital verification in live browser:');
    console.log(`  - Earth Orbit Vertices: ${orbitInfo.earthPointsCount}`);
    console.log(`  - Moon Orbit Vertices: ${orbitInfo.moonPointsCount}`);
    console.log(`  - Perihelion distance: ${orbitInfo.perihelionDist.toFixed(3)} units`);
    console.log(`  - Aphelion distance: ${orbitInfo.aphelionDist.toFixed(3)} units`);
    console.log(`  - Perihelion/Aphelion Difference: ${(orbitInfo.aphelionDist - orbitInfo.perihelionDist).toFixed(3)} units`);

    // 1. Focus on Sun and elevate camera to frame entire Earth Keplerian elliptical orbit
    await page.evaluate(() => {
      document.getElementById('camSunBtn').click();
      const sim = window.__sim;
      if (sim && sim.cameraController) {
        sim.cameraController.camera.position.set(0, 52, 60);
        sim.cameraController.controls.target.set(0, 0, 0);
        sim.cameraController.controls.update();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotHeliocentric = path.join(SCREENSHOT_DIR, 'heliocentric_earth_orbit_elliptical.png');
    await page.screenshot({ path: shotHeliocentric });
    console.log(`  ✓ Saved Heliocentric full Earth orbit screenshot: ${shotHeliocentric}`);

    // 2. Click System Camera Target button to capture the Earth-Moon system
    await page.evaluate(() => {
      document.getElementById('camSystemBtn').click();
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotSystem = path.join(SCREENSHOT_DIR, 'system_elliptical_orbit.png');
    await page.screenshot({ path: shotSystem });
    console.log(`  ✓ Saved system orbit screenshot: ${shotSystem}`);

    // 3. Elevate angle to clearly showcase Moon's 5.15° inclined perturbed ellipse around Earth
    await page.evaluate(() => {
      const sim = window.__sim;
      if (sim && sim.cameraController) {
        sim.cameraController.setFocus('system', false);
        const earthPos = sim.sceneManager.earthGroup.position;
        sim.cameraController.camera.position.set(earthPos.x + 10, earthPos.y + 14, earthPos.z + 18);
        sim.cameraController.controls.target.copy(earthPos);
        sim.cameraController.controls.update();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotEarth = path.join(SCREENSHOT_DIR, 'earth_moon_elliptical_orbit.png');
    await page.screenshot({ path: shotEarth });
    console.log(`  ✓ Saved Earth-Moon inclined orbit screenshot: ${shotEarth}`);

    // 4. Test toggle apsides in UI
    const toggleApsidesChecked = await page.evaluate(() => {
      const toggle = document.getElementById('toggleApsides');
      return toggle ? toggle.checked : null;
    });
    console.log(`  - UI Toggle Apsides checkbox present: ${toggleApsidesChecked}`);

    console.log('\n=== HEADLESS BROWSER VERIFICATION COMPLETED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
    server.close();
  }
}

runVerification().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
