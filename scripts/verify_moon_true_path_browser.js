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
    page.on('pageerror', err => console.error('  [Browser Error]:', err.message));

    console.log(`Navigating to http://127.0.0.1:${port}...`);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for simulation initialization
    await page.waitForFunction(() => {
      return window.__sim && window.__sim.sceneManager && window.__sim.sceneManager.moonSunTrajectoryLine;
    }, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Verify UI controls presence
    const uiVerification = await page.evaluate(() => {
      const toggle = document.getElementById('toggleMoonSunPath');
      const spanSelect = document.getElementById('moonSunSpanSelect');
      const scaleSelect = document.getElementById('moonSunScaleSelect');
      const scene = window.__sim.sceneManager;

      return {
        hasToggle: !!toggle,
        toggleChecked: toggle ? toggle.checked : false,
        hasSpanSelect: !!spanSelect,
        spanValue: spanSelect ? spanSelect.value : null,
        hasScaleSelect: !!scaleSelect,
        scaleValue: scaleSelect ? scaleSelect.value : null,
        lineVisible: scene.moonSunTrajectoryLine.visible,
        lineCount: scene.moonSunTrajectoryLine.geometry.drawRange.count
      };
    });

    console.log('UI Verification:', uiVerification);

    // 1. View: System View (±1 Month Span, True Proportional Scale)
    console.log('1. Capturing System View (±1 Month Span)...');
    await page.evaluate(() => {
      document.getElementById('camSystemBtn').click();
      const sb = document.querySelector('.hud-sidebar-right');
      if (sb) sb.scrollTop = 280;

      const sim = window.__sim;
      if (sim && sim.cameraController) {
        const earthPos = sim.sceneManager.earthGroup.position;
        sim.cameraController.camera.position.set(earthPos.x + 8, earthPos.y + 16, earthPos.z + 16);
        sim.cameraController.controls.target.copy(earthPos);
        sim.cameraController.controls.update();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotSystem = path.join(SCREENSHOT_DIR, 'moon_true_path_system_month.png');
    await page.screenshot({ path: shotSystem });
    console.log(`  ✓ Saved: ${shotSystem}`);

    // 2. View: Heliocentric Sun View (Full Year Span, True Proportional)
    console.log('2. Capturing Heliocentric View (Full Year Span, True Proportional)...');
    await page.evaluate(() => {
      document.getElementById('camSunBtn').click();
      const spanSelect = document.getElementById('moonSunSpanSelect');
      spanSelect.value = 'year';
      spanSelect.dispatchEvent(new Event('change'));

      const sim = window.__sim;
      if (sim && sim.cameraController) {
        sim.cameraController.camera.position.set(0, 56, 56);
        sim.cameraController.controls.target.set(0, 0, 0);
        sim.cameraController.controls.update();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotHelioYear = path.join(SCREENSHOT_DIR, 'moon_true_path_heliocentric_year.png');
    await page.screenshot({ path: shotHelioYear });
    console.log(`  ✓ Saved: ${shotHelioYear}`);

    // 3. View: Heliocentric Sun View (Full Year Span, 3x Amplified Wave)
    console.log('3. Capturing Heliocentric View (Full Year Span, 3x Amplified Wave)...');
    await page.evaluate(() => {
      const scaleSelect = document.getElementById('moonSunScaleSelect');
      scaleSelect.value = 'amplified';
      scaleSelect.dispatchEvent(new Event('change'));
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotHelioAmp = path.join(SCREENSHOT_DIR, 'moon_true_path_amplified_heliocentric.png');
    await page.screenshot({ path: shotHelioAmp });
    console.log(`  ✓ Saved: ${shotHelioAmp}`);

    // 4. View: 1:1 Metric Scale Mode
    console.log('4. Capturing 1:1 Metric Scale Mode...');
    await page.evaluate(() => {
      document.getElementById('scaleTrueBtn').click();
      const sim = window.__sim;
      if (sim && sim.cameraController) {
        sim.cameraController.camera.position.set(0, 26000, 26000);
        sim.cameraController.controls.target.set(0, 0, 0);
        sim.cameraController.controls.update();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotMetric = path.join(SCREENSHOT_DIR, 'moon_true_path_metric_true_scale.png');
    await page.screenshot({ path: shotMetric });
    console.log(`  ✓ Saved: ${shotMetric}`);

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
