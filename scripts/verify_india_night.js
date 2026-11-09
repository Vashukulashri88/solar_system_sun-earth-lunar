import puppeteer from 'puppeteer-core';
import fs from 'fs';

const candidatePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = candidatePaths.find(p => fs.existsSync(p));
if (!browserPath) {
  console.error('No browser executable found!');
  process.exit(1);
}

async function verify() {
  console.log('Launching browser...');
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

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => console.log('  [Browser]:', msg.type(), msg.text()));
  page.on('pageerror', err => {
    console.error('  [PageError]:', err);
    errors.push(err.toString());
  });

  console.log('Navigating to http://localhost:8080...');
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForSelector('#utcClock', { timeout: 10000 });

  // 1. Verify Clock Display (UTC + Local)
  const clockText = await page.$eval('#utcClock', el => el.innerText);
  console.log('Top Clock:', clockText);
  if (!clockText.includes('UTC') || !clockText.includes(':')) {
    throw new Error('Clock display does not contain UTC time!');
  }

  // 2. Verify Date Picker has local hours
  const dateInputVal = await page.$eval('#datePickerInput', el => el.value);
  console.log('Date Picker Value:', dateInputVal);
  const now = new Date();
  const localHr = now.getHours().toString().padStart(2, '0');
  if (!dateInputVal.includes(`T${localHr}:`)) {
    console.warn(`Warning: dateInputVal ${dateInputVal} does not match local hour ${localHr}`);
  } else {
    console.log(`✓ Date picker matches local hour: ${localHr}`);
  }

  // 3. Click 'My Location (India / Local)' button
  console.log('Clicking #camMyLocationBtn...');
  await page.click('#camMyLocationBtn');
  await new Promise(r => setTimeout(r, 2500));

  // 4. Verify Place Inspector Card
  const inspectorVisible = await page.$eval('#placeInspectorCard', el => !el.classList.contains('hidden'));
  const placeTitle = await page.$eval('#placeName', el => el.innerText);
  const solarTime = await page.$eval('#placeSolarTime', el => el.innerText);
  const sunAlt = await page.$eval('#placeSunAlt', el => el.innerText);
  const dayNight = await page.$eval('#placeDayNight', el => el.innerText);

  console.log('\n--- Location Inspector State ---');
  console.log('Inspector Visible:', inspectorVisible);
  console.log('Place Title:', placeTitle);
  console.log('True Solar Time:', solarTime);
  console.log('Sun Elevation:', sunAlt);
  console.log('Day/Night State:', dayNight);

  if (!inspectorVisible) throw new Error('Inspector card did not open after clicking My Location!');
  if (placeTitle !== 'India') throw new Error(`Expected India, got: ${placeTitle}`);
  if (!dayNight.includes('Night')) throw new Error(`Expected Night state for India at live time, got: ${dayNight}`);

  // 5. Verify Sun Mesh / Corona occlusion in scene
  const sunOcclusion = await page.evaluate(() => {
    const app = window.__sim;
    if (!app || !app.sceneManager) return null;
    const sm = app.sceneManager;
    return {
      sunMeshVisible: sm.sunMesh ? sm.sunMesh.visible : null,
      coronaVisible: sm.coronaSprite ? sm.coronaSprite.visible : null,
      cameraTargetMode: app.cameraController ? app.cameraController.targetMode : null
    };
  });
  console.log('Sun Occlusion Info:', sunOcclusion);
  if (!sunOcclusion) throw new Error('Could not access window.__sim!');
  if (sunOcclusion.sunMeshVisible !== false || sunOcclusion.coronaVisible !== false) {
    throw new Error(`Expected Sun and Corona to be occluded when looking at India at night, got: ${JSON.stringify(sunOcclusion)}`);
  }

  // Take screenshot of India at night
  const screenshotPath = 'C:\\Users\\ckceg\\.gemini\\antigravity\\scratch\\earth-sun-moon-orbit-sim\\india_night_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`\nScreenshot captured at: ${screenshotPath}`);

  if (errors.length > 0) {
    console.error('Page errors encountered:', errors);
    throw new Error('Page had runtime errors!');
  }

  console.log('\nSUCCESS: All India Night verifications passed cleanly!');
  await browser.close();
}

verify().catch(err => {
  console.error('FATAL VERIFICATION FAILURE:', err);
  process.exit(1);
});
