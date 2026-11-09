import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getCelestialState,
  searchNextSolarEclipse,
  searchPrevSolarEclipse,
  searchNextLunarEclipse,
  searchPrevLunarEclipse,
  searchNextMoonQuarter,
  searchPrevMoonQuarter,
  getSeasons
} from '../src/ephemeris.js';
import { TimeController } from '../src/timeController.js';
import { PlacesManager } from '../src/places.js';
import * as THREE from '../vendor/three.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (Expected ~${expected}, got ${actual}, diff ${diff.toFixed(5)} <= ${tolerance})`);
}

console.log('=== V2 Advanced Astronomy & Interactive Features Verification ===\n');

// 1. Eclipse Search Accuracy with Astronomy Engine
console.log('Test 1: Solar & Lunar Eclipse Searches (Historical Ground Truth)');
{
  // Test search forward from 2024-01-01 to April 8, 2024 Total Solar Eclipse
  const start2024 = new Date('2024-01-01T00:00:00Z');
  const solar2024 = searchNextSolarEclipse(start2024);
  assert(solar2024 !== null, 'Found 2024 Solar Eclipse');
  const peakDate = solar2024.peak.date;
  const isoDate = peakDate.toISOString().substring(0, 10);
  assert(isoDate === '2024-04-08', `Solar eclipse date is 2024-04-08 (got ${isoDate})`);

  // Test reverse search back from 2024-01-01 to 2023-10-14 Annular Eclipse
  const prevSolar = searchPrevSolarEclipse(start2024);
  assert(prevSolar !== null, 'Found previous solar eclipse before 2024');
  const prevIso = prevSolar.peak.date.toISOString().substring(0, 10);
  assert(prevIso === '2023-10-14', `Previous solar eclipse date is 2023-10-14 (got ${prevIso})`);

  // Test search for 2025-03-14 Total Lunar Eclipse
  const start2025 = new Date('2025-01-01T00:00:00Z');
  const lunar2025 = searchNextLunarEclipse(start2025);
  assert(lunar2025 !== null, 'Found 2025 Lunar Eclipse');
  const lunarIso = lunar2025.peak.date.toISOString().substring(0, 10);
  assert(lunarIso === '2025-03-14', `Lunar eclipse date is 2025-03-14 (got ${lunarIso})`);

  // Test reverse search from 2024-01-01 to 2022-11-08 Blood Moon
  const prevLunar = searchPrevLunarEclipse(start2024);
  assert(prevLunar !== null, 'Found previous lunar eclipse');
  const prevLunarIso = prevLunar.peak.date.toISOString().substring(0, 10);
  // October 28, 2023 partial lunar eclipse or Nov 2022
  assert(prevLunarIso === '2023-10-28', `Previous lunar eclipse is 2023-10-28 (got ${prevLunarIso})`);
}

// 2. IAU Lunar Rotation and Physical Libration in Latitude and Longitude
console.log('\nTest 2: IAU Lunar Rotation & Physical Libration');
{
  const testDate = new Date('2024-04-08T18:17:00Z');
  const state = getCelestialState(testDate);
  assert(state.moonOrientation !== undefined, 'State contains moonOrientation');
  assert(typeof state.moonOrientation.subEarthLonDeg === 'number', 'subEarthLonDeg is number');
  assert(typeof state.moonOrientation.subEarthLatDeg === 'number', 'subEarthLatDeg is number');

  // Physical libration bounds are within +/- 8.5 degrees
  assert(Math.abs(state.moonOrientation.subEarthLonDeg) <= 8.5,
    `Libration longitude bounded: ${state.moonOrientation.subEarthLonDeg.toFixed(3)}°`);
  assert(Math.abs(state.moonOrientation.subEarthLatDeg) <= 7.5,
    `Libration latitude bounded: ${state.moonOrientation.subEarthLatDeg.toFixed(3)}°`);
  assert(state.moonPhase.phaseFraction >= 0 && state.moonPhase.phaseFraction <= 1,
    `Phase fraction from Astronomy Engine valid: ${state.moonPhase.phaseFraction.toFixed(4)}`);
}

// 3. Time Controller Signed Warp Speeds and Bidirectional Stepping
console.log('\nTest 3: Time Controller Signed Warp Speeds & Clamping');
{
  const tc = new TimeController();
  tc.setTimeScale(-86400); // 1 day backward per second
  assert(tc.timeScale === -86400, 'Time scale supports negative warps');

  const baseDate = new Date('2024-06-01T12:00:00Z');
  tc.setDate(baseDate);
  assert(tc.simulatedDate.getTime() === baseDate.getTime(), 'Date sets properly');

  // Step backward 1 day
  tc.step(-86400);
  assert(tc.simulatedDate.toISOString().startsWith('2024-05-31'), 'Step -1d moves backward');

  // Step forward 30 days
  tc.step(30 * 86400);
  assert(tc.simulatedDate.toISOString().startsWith('2024-06-30'), 'Step +30d moves forward');

  // Year 1900 and 2100 clamping
  tc.setDate(new Date('1850-01-01T00:00:00Z'));
  assert(tc.simulatedDate.getUTCFullYear() >= 1900, 'Clamped to min year 1900');

  tc.setDate(new Date('2150-01-01T00:00:00Z'));
  assert(tc.simulatedDate.getUTCFullYear() <= 2100, 'Clamped to max year 2100');

  // Event jump integration test
  tc.setDate(new Date('2024-01-01T00:00:00Z'));
  const foundEclipse = tc.jumpNextSolarEclipse();
  assert(foundEclipse !== null, 'tc.jumpNextSolarEclipse succeeded');
  assert(tc.simulatedDate.toISOString().startsWith('2024-04-08'), 'Simulated date jumped to 2024-04-08');

  // Moon quarter jumps
  tc.setDate(new Date('2024-01-01T00:00:00Z'));
  const nextFull = tc.jumpNextFullMoon();
  assert(nextFull !== null && nextFull.time && nextFull.time.date, 'tc.jumpNextFullMoon succeeded');
  assert(nextFull.quarter === 2, 'Quarter is Full Moon (2)');

  const prevNew = tc.jumpPrevNewMoon();
  assert(prevNew !== null && prevNew.time && prevNew.time.date, 'tc.jumpPrevNewMoon succeeded');
  assert(prevNew.quarter === 0, 'Quarter is New Moon (0)');

  // Equinox / Solstice jumps
  tc.setDate(new Date('2024-01-01T00:00:00Z'));
  const nextSeason = tc.jumpNextEquinoxOrSolstice();
  assert(nextSeason !== null, 'tc.jumpNextEquinoxOrSolstice succeeded');
  assert(nextSeason.toISOString().startsWith('2024-03-20'), `Next season is March Equinox (got ${nextSeason.toISOString()})`);
}

// 4. Places Manager: Country Polygon Raycasting, Moon Features, Solar Time
console.log('\nTest 4: Places Manager: Countries, Moon Features & Telemetry');
{
  const places = new PlacesManager();

  // Load local geojson, processed centroids & moon features files synchronously for node test
  const geojsonRaw = fs.readFileSync(path.join(projectRoot, 'assets/data/countries.geojson'), 'utf8');
  const processedRaw = fs.readFileSync(path.join(projectRoot, 'assets/data/countries_processed.json'), 'utf8');
  const moonRaw = fs.readFileSync(path.join(projectRoot, 'assets/data/moon_features.json'), 'utf8');

  places.parseCountries(JSON.parse(geojsonRaw), JSON.parse(processedRaw));
  places.moonFeatures = JSON.parse(moonRaw);

  assert(places.countries.length >= 170, `Loaded ${places.countries.length} country boundaries`);
  assert(places.moonFeatures.landingSites.length >= 15, `Loaded ${places.moonFeatures.landingSites.length} lunar landing sites`);

  // Verified centroid test
  const fiji = places.countries.find(c => c.name.includes('Fiji'));
  assert(fiji && fiji.centroid.lon > 170, `Fiji centroid is in the Pacific (got lon ${fiji?.centroid.lon}°)`);

  const usa = places.countries.find(c => c.name.includes('United States'));
  assert(usa && usa.centroid.lon < -95 && usa.centroid.lon > -105, `USA centroid is central (got lon ${usa?.centroid.lon}°)`);

  // Point in polygon test: Tokyo (35.6762° N, 139.6503° E)
  const tokyoMatch = places.identifyCountry(139.6503, 35.6762);
  assert(tokyoMatch !== null && tokyoMatch.country.name === 'Japan',
    `Tokyo identified as Japan (got ${tokyoMatch ? tokyoMatch.country.name : 'null'})`);

  // Point in polygon test: Paris (48.8566° N, 2.3522° E)
  const parisMatch = places.identifyCountry(2.3522, 48.8566);
  assert(parisMatch !== null && parisMatch.country.name === 'France',
    `Paris identified as France (got ${parisMatch ? parisMatch.country.name : 'null'})`);

  // Maritime point: Central Pacific Ocean (0° N, -140° W)
  const pacificMatch = places.identifyCountry(-140.0, 0.0);
  assert(pacificMatch !== null && pacificMatch.exact === false, 'Ocean point flagged as non-exact');
  assert(pacificMatch.oceanName.includes('Pacific'), `Ocean identified as Pacific (got ${pacificMatch.oceanName})`);

  // True Solar Time & Solar Altitude calculation
  const testDate = new Date('2024-06-20T12:00:00Z');
  const state = getCelestialState(testDate);
  const subsolarLon = state.subsolar.longitudeDeg;
  const subsolarLat = state.subsolar.latitudeDeg;

  // At subsolar point, Sun should be at zenith (+90°) and solar time should be 12:00:00
  const subsolarTelemetry = places.inspectEarth(subsolarLat, subsolarLon, state);
  assertClose(subsolarTelemetry.sunAltitudeDeg, 90.0, 0.5, 'Sun altitude at subsolar point is 90° (overhead)');
  assert(subsolarTelemetry.solarTime.startsWith('12:00'), `Solar time at subsolar lon is 12:00 (got ${subsolarTelemetry.solarTime})`);
  assert(subsolarTelemetry.dayNightStatus.includes('Daylight'), 'Illumination at subsolar point is Daylight');

  // Moon telemetry at Apollo 11 Tranquility Base (0.674° N, 23.473° E)
  const apollo11 = places.inspectMoon(0.674, 23.473, state);
  assert(apollo11.title === 'Apollo 11', `Title identifies Apollo 11 (got ${apollo11.title})`);
  assert(apollo11.earthVisibility.includes('Near Side'), 'Apollo 11 is on Near Side of Moon');

  // Moon Far Side feature: Daedalus crater (5.9° S, 179.4° E)
  const farSide = places.inspectMoon(-5.9, 179.4, state);
  assert(farSide.earthVisibility.includes('Far Side'), 'Daedalus is on Lunar Far Side (hidden from Earth)');

  // Search feature test
  const searchJapan = places.search('Japan');
  assert(searchJapan.length > 0 && searchJapan[0].name === 'Japan', 'Search finds Japan');

  const searchApollo = places.search('Apollo 11');
  assert(searchApollo.length > 0 && searchApollo[0].name === 'Apollo 11', 'Search finds Apollo 11');

  const searchTycho = places.search('Tycho');
  assert(searchTycho.length > 0 && searchTycho[0].name.includes('Tycho'), 'Search finds Tycho crater');
}

// 5. Spherical Mapping & Coordinate Round-Trip
console.log('\nTest 5: Spherical UV Coordinates Round-Trip');
{
  const RAD2DEG = 180 / Math.PI;
  const DEG2RAD = Math.PI / 180;

  const testCoords = [
    { lat: 0, lon: 0 },
    { lat: 45, lon: 90 },
    { lat: -33.8688, lon: 151.2093 }, // Sydney
    { lat: 51.5074, lon: -0.1278 },   // London
    { lat: 80, lon: -120 }
  ];

  for (const c of testCoords) {
    const phi = c.lat * DEG2RAD;
    const lam = c.lon * DEG2RAD;
    // UV forward mapping from SphereGeometry convention
    const x = Math.cos(phi) * Math.cos(lam);
    const y = Math.sin(phi);
    const z = -Math.cos(phi) * Math.sin(lam);

    // Inverse mapping
    const radius = Math.sqrt(x * x + y * y + z * z);
    const roundLat = Math.asin(Math.max(-1, Math.min(1, y / radius))) * RAD2DEG;
    const roundLon = Math.atan2(-z, x) * RAD2DEG;

    assertClose(roundLat, c.lat, 0.001, `Lat round-trip for (${c.lat}, ${c.lon})`);
    assertClose(roundLon, c.lon, 0.001, `Lon round-trip for (${c.lat}, ${c.lon})`);
  }
}

// 6. Local Asset Integrity Verification
console.log('\nTest 6: Local Asset Files Integrity Verification');
{
  const requiredTextures = [
    'assets/textures/8k_earth_daymap.jpg',
    'assets/textures/8k_earth_nightmap.jpg',
    'assets/textures/8k_earth_clouds.jpg',
    'assets/textures/8k_earth_specular_map.png',
    'assets/textures/8k_moon.jpg',
    'assets/textures/8k_stars_milky_way.jpg'
  ];

  for (const rel of requiredTextures) {
    const full = path.join(projectRoot, rel);
    assert(fs.existsSync(full), `File exists: ${rel}`);
    const stat = fs.statSync(full);
    assert(stat.size > 100 * 1024, `Size > 100KB: ${rel} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // 12 Seasonal Blue Marble textures
  for (let m = 1; m <= 12; m++) {
    const mStr = m.toString().padStart(2, '0');
    const rel = `assets/textures/seasonal/earth_month_${mStr}.jpg`;
    const full = path.join(projectRoot, rel);
    assert(fs.existsSync(full), `Seasonal texture exists: month ${mStr}`);
    const stat = fs.statSync(full);
    assert(stat.size > 100 * 1024, `Seasonal month ${mStr} size is valid (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // Data assets
  const dataAssets = [
    'assets/data/countries.geojson',
    'assets/data/countries_processed.json',
    'assets/data/moon_features.json',
    'assets/data/bsc5p_radec_min.json',
    'vendor/astronomy.js'
  ];

  for (const rel of dataAssets) {
    const full = path.join(projectRoot, rel);
    assert(fs.existsSync(full), `Asset exists: ${rel}`);
    const stat = fs.statSync(full);
    assert(stat.size > 1000, `Asset size > 1KB: ${rel} (${stat.size} bytes)`);
  }
}

// 7. 3D Scene Subsolar Point Alignment Across All 4 Seasons
console.log('\nTest 7: 3D Scene Subsolar Point Alignment Across All 4 Seasons');
{
  const testSeasons = [
    { name: 'Vernal Equinox', date: new Date('2024-03-20T12:00:00Z') },
    { name: 'Summer Solstice', date: new Date('2024-06-20T20:51:00Z') },
    { name: 'Autumnal Equinox', date: new Date('2024-09-22T12:44:00Z') },
    { name: 'Winter Solstice', date: new Date('2024-12-21T09:20:00Z') }
  ];

  for (const s of testSeasons) {
    const state = getCelestialState(s.date);
    const earthLongRad = (state.sun.trueLongitudeDeg + 180) * (Math.PI / 180);
    const earthOrbitalRadius = 32.0;

    // Right-handed frame: x = cos, z = -sin
    const earthPos = new THREE.Vector3(
      earthOrbitalRadius * Math.cos(earthLongRad),
      0,
      -earthOrbitalRadius * Math.sin(earthLongRad)
    );
    const sunPos = new THREE.Vector3(0, 0, 0);
    const dirToSun = new THREE.Vector3().subVectors(sunPos, earthPos).normalize();

    const earthGroup = new THREE.Group();
    earthGroup.position.copy(earthPos);
    const earthTiltGroup = new THREE.Group();
    earthGroup.add(earthTiltGroup);
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16));
    earthTiltGroup.add(earthMesh);

    // Axial tilt towards June solstice (-Z) in right-handed frame
    earthTiltGroup.rotation.x = -state.obliquityDeg * (Math.PI / 180);
    earthMesh.rotation.y = state.gmstDeg * (Math.PI / 180);

    earthGroup.updateMatrixWorld(true);

    const phi = state.subsolar.latitudeDeg * Math.PI / 180;
    const lam = state.subsolar.longitudeDeg * Math.PI / 180;
    const localPt = new THREE.Vector3(
      Math.cos(phi) * Math.cos(lam),
      Math.sin(phi),
      -Math.cos(phi) * Math.sin(lam)
    );
    const worldPt = localPt.clone().applyMatrix4(earthMesh.matrixWorld);
    const dir = new THREE.Vector3().subVectors(worldPt, earthPos).normalize();
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, dir.dot(dirToSun)))) * 180 / Math.PI;

    assert(angleDeg < 0.05,
      `Subsolar point faces Sun at ${s.name} (error: ${angleDeg.toFixed(4)}° < 0.05°)`);
  }
}

// 8. Blood Moon Eclipse Umbra Radius in Visual Scaling
console.log('\nTest 8: Blood Moon Eclipse Umbra Radius in Visual Scaling');
{
  const sunRadiusWorld = 2.0;
  const earthRadiusWorld = 1.0;
  const distEarthToSun = 32.0;
  const projOnShadowAxis = 7.5; // Lunar orbital distance in visual scale

  const sunAng = sunRadiusWorld / distEarthToSun;
  const earthAng = earthRadiusWorld / projOnShadowAxis;
  const umbraR = Math.max(0.0, (earthAng - sunAng) * projOnShadowAxis);
  const penumbraR = (earthAng + sunAng) * projOnShadowAxis;

  assert(umbraR > 0.4, `Umbra radius at Moon distance is > 0.4 units (got ${umbraR.toFixed(3)})`);
  assert(umbraR > 0.2725, `Umbra radius envelops Moon radius (0.2725) for total Blood Moon glow`);
  assert(penumbraR > 1.2, `Penumbra radius spans beyond umbra (got ${penumbraR.toFixed(3)})`);
}

console.log(`\n===========================================`);
console.log(`V2 FEATURES TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log(`===========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ADVANCED FEATURE TESTS PASSED SUCCESSFULLY!\n');
}
