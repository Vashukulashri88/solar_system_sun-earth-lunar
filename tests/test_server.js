import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(projectRoot, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    }
  });
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}...`);

  const urlsToTest = [
    '/',
    '/index.html',
    '/src/ephemeris.js',
    '/src/textures.js',
    '/src/shaders.js',
    '/src/scene.js',
    '/src/cameraController.js',
    '/src/timeController.js',
    '/src/ui.js',
    '/src/main.js',
    '/src/places.js',
    '/src/labels.js',
    '/src/picking.js',
    '/src/clouds.js',
    '/styles/main.css',
    '/vendor/three.module.js',
    '/vendor/three.core.js',
    '/vendor/jsm/controls/OrbitControls.js',
    '/vendor/astronomy.js',
    '/assets/data/countries.geojson',
    '/assets/data/moon_features.json',
    '/assets/data/bsc5p_radec_min.json',
    '/assets/textures/8k_earth_daymap.jpg',
    '/assets/textures/seasonal/earth_month_01.jpg'
  ];

  let failed = 0;

  for (const urlPath of urlsToTest) {
    await new Promise((resolve) => {
      http.get(`http://localhost:${port}${urlPath}`, (res) => {
        if (res.statusCode === 200) {
          console.log(`  ✓ HTTP 200: ${urlPath} (${res.headers['content-type']})`);
        } else {
          console.error(`  ✗ HTTP ${res.statusCode}: ${urlPath}`);
          failed++;
        }
        res.resume();
        resolve();
      }).on('error', (e) => {
        console.error(`  ✗ Error fetching ${urlPath}:`, e.message);
        failed++;
        resolve();
      });
    });
  }

  server.close(() => {
    if (failed === 0) {
      console.log(`\nALL ${urlsToTest.length} STATIC ASSET ENDPOINTS SERVED WITH HTTP 200 OK!`);
      process.exit(0);
    } else {
      console.error(`\n${failed} ASSETS FAILED TO SERVE.`);
      process.exit(1);
    }
  });
});
