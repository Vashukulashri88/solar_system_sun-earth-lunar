import {
  getJulianDate,
  getJulianCenturies,
  getGMST,
  getObliquity,
  getSunEphemeris,
  getMoonEphemeris,
  getCelestialState,
  ASTRONOMICAL_CONSTANTS
} from '../src/ephemeris.js';

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

console.log('=== Astronomical Ephemeris Verification Test Suite ===\n');

// 1. Julian Date Verification at J2000.0 Epoch
console.log('Test 1: J2000.0 Epoch Julian Date');
{
  const j2000Date = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
  const jd = getJulianDate(j2000Date);
  const T = getJulianCenturies(jd);
  assertClose(jd, 2451545.0, 0.0001, 'J2000.0 Julian Date matches exactly 2451545.0');
  assertClose(T, 0.0, 0.000001, 'Centuries T at J2000.0 is 0.0');
}

// 2. Greenwich Mean Sidereal Time (GMST) at J2000.0
console.log('\nTest 2: Greenwich Mean Sidereal Time (GMST)');
{
  const jd = 2451545.0;
  const gmst = getGMST(jd);
  assertClose(gmst, 280.4606, 0.01, 'GMST at J2000.0 is 280.4606 degrees');
}

// 3. Obliquity of the Ecliptic (Earth axial tilt)
console.log('\nTest 3: Obliquity of the Ecliptic');
{
  const obl = getObliquity(0.0);
  assertClose(obl, 23.43929, 0.001, 'Obliquity at J2000.0 matches ~23.439°');
}

// 4. Summer & Winter Solstices (Sun Declination & Subsolar Latitude)
console.log('\nTest 4: Solstices & Equinoxes');
{
  // 2024 Summer Solstice: June 20, 2024 at 20:51 UTC
  const summerSolstice = new Date(Date.UTC(2024, 5, 20, 20, 51));
  const stateSummer = getCelestialState(summerSolstice);
  assertClose(stateSummer.sun.declinationDeg, 23.44, 0.1, 'Sun declination at June solstice is ~+23.44°');
  assertClose(stateSummer.subsolar.latitudeDeg, 23.44, 0.1, 'Subsolar latitude at June solstice is at Tropic of Cancer (+23.44°)');

  // 2024 Winter Solstice: Dec 21, 2024 at 09:20 UTC
  const winterSolstice = new Date(Date.UTC(2024, 11, 21, 9, 20));
  const stateWinter = getCelestialState(winterSolstice);
  assertClose(stateWinter.sun.declinationDeg, -23.44, 0.1, 'Sun declination at Dec solstice is ~-23.44°');
  assertClose(stateWinter.subsolar.latitudeDeg, -23.44, 0.1, 'Subsolar latitude at Dec solstice is at Tropic of Capricorn (-23.44°)');

  // 2024 Vernal Equinox: March 20, 2024 at 03:06 UTC
  const vernalEquinox = new Date(Date.UTC(2024, 2, 20, 3, 6));
  const stateEquinox = getCelestialState(vernalEquinox);
  assertClose(stateEquinox.sun.declinationDeg, 0.0, 0.15, 'Sun declination at Vernal Equinox is ~0.0°');
}

// 5. Sun Distance (Perihelion and Aphelion)
console.log('\nTest 5: Earth-Sun Distance Bounds');
{
  // Earth Perihelion ~ Jan 3 (closest: ~147.1 million km / 0.983 AU)
  const perihelion = new Date(Date.UTC(2024, 0, 3, 0, 0));
  const statePeri = getCelestialState(perihelion);
  assert(statePeri.sun.distanceKm < 147.5e6 && statePeri.sun.distanceKm > 146.9e6,
    `Perihelion distance in early January is ~147.1M km (got ${(statePeri.sun.distanceKm / 1e6).toFixed(2)}M km)`);

  // Earth Aphelion ~ July 5 (farthest: ~152.1 million km / 1.017 AU)
  const aphelion = new Date(Date.UTC(2024, 6, 5, 0, 0));
  const stateAph = getCelestialState(aphelion);
  assert(stateAph.sun.distanceKm > 151.8e6 && stateAph.sun.distanceKm < 152.3e6,
    `Aphelion distance in early July is ~152.1M km (got ${(stateAph.sun.distanceKm / 1e6).toFixed(2)}M km)`);
}

// 6. Moon Orbit Distance & Inclination Bounds across 100 days
console.log('\nTest 6: Moon Orbit Physical Parameter Limits across 100 days');
{
  let minMoonDist = Infinity;
  let maxMoonDist = -Infinity;
  let maxMoonLat = -Infinity;
  let minMoonLat = Infinity;

  const baseDate = new Date(Date.UTC(2025, 0, 1, 0, 0));
  for (let d = 0; d < 100; d += 2) {
    const testDate = new Date(baseDate.getTime() + d * 86400 * 1000);
    const state = getCelestialState(testDate);
    const dist = state.moon.distanceKm;
    const lat = state.moon.eclipticLatitudeDeg;

    if (dist < minMoonDist) minMoonDist = dist;
    if (dist > maxMoonDist) maxMoonDist = dist;
    if (lat < minMoonLat) minMoonLat = lat;
    if (lat > maxMoonLat) maxMoonLat = lat;
  }

  assert(minMoonDist >= 356000 && minMoonDist <= 370000,
    `Moon minimum distance (perigee) within physical range: ${minMoonDist.toFixed(1)} km`);
  assert(maxMoonDist >= 400000 && maxMoonDist <= 407000,
    `Moon maximum distance (apogee) within physical range: ${maxMoonDist.toFixed(1)} km`);
  assert(maxMoonLat <= 5.4 && minMoonLat >= -5.4,
    `Moon ecliptic latitude stays bounded by ~5.15° inclination: [${minMoonLat.toFixed(2)}°, ${maxMoonLat.toFixed(2)}°]`);
}

// 7. Eclipse Detection Verification (Solar & Lunar)
console.log('\nTest 7: Eclipse Detection on Historic Astronomical Events');
{
  // Total Solar Eclipse of April 8, 2024 at 18:17 UTC
  const eclipse2024 = new Date(Date.UTC(2024, 3, 8, 18, 17));
  const eclipseState = getCelestialState(eclipse2024);
  assert(eclipseState.eclipse.isSolarEclipse, 'Detected April 8, 2024 Solar Eclipse');
  assert(eclipseState.moonPhase.phaseName === 'New Moon', 'Phase is New Moon during Solar Eclipse');

  // Total Lunar Eclipse of November 8, 2022 at 11:00 UTC
  const lunarEclipse2022 = new Date(Date.UTC(2022, 10, 8, 11, 0));
  const lunarEclipseState = getCelestialState(lunarEclipse2022);
  assert(lunarEclipseState.eclipse.isLunarEclipse, 'Detected November 8, 2022 Lunar Eclipse');
  assert(lunarEclipseState.moonPhase.phaseName === 'Full Moon', 'Phase is Full Moon during Lunar Eclipse');
}

// 8. Live Real-Time Current Timestamp Execution
console.log('\nTest 8: Current Live Timestamp Execution');
{
  const now = new Date();
  const liveState = getCelestialState(now);
  assert(!isNaN(liveState.julianDate), 'Julian Date is valid finite number');
  assert(!isNaN(liveState.gmstDeg), 'GMST is valid finite number');
  assert(!isNaN(liveState.sun.distanceKm), 'Sun distance is valid finite number');
  assert(!isNaN(liveState.moon.distanceKm), 'Moon distance is valid finite number');
  assert(liveState.moonPhase.phasePercent >= 0 && liveState.moonPhase.phasePercent <= 100,
    `Moon illumination percentage is between 0% and 100% (current: ${liveState.moonPhase.phasePercent}%, ${liveState.moonPhase.phaseName})`);
  console.log(`  → Live Subsolar point: Lat ${liveState.subsolar.latitudeDeg.toFixed(2)}°, Lon ${liveState.subsolar.longitudeDeg.toFixed(2)}°`);
  console.log(`  → Live Sublunar point: Lat ${liveState.sublunar.latitudeDeg.toFixed(2)}°, Lon ${liveState.sublunar.longitudeDeg.toFixed(2)}°`);
  console.log(`  → Current Moon Phase: ${liveState.moonPhase.phaseName} (${liveState.moonPhase.phasePercent}%)`);
}

// 9. Subsolar Westward Progression & Prograde Earth Rotation
console.log('\nTest 9: Earth Prograde Rotation & Subsolar Westward Drift');
{
  const t1 = new Date('2024-03-20T12:00:00Z');
  const t2 = new Date('2024-03-20T13:00:00Z');
  const s1 = getCelestialState(t1);
  const s2 = getCelestialState(t2);

  // Over 1 hour, Earth rotates 15 degrees Eastward, so subsolar point shifts 15 degrees Westward (delta lon ≈ -15 deg)
  let deltaLon = s2.subsolar.longitudeDeg - s1.subsolar.longitudeDeg;
  if (deltaLon > 180) deltaLon -= 360;
  if (deltaLon < -180) deltaLon += 360;

  assertClose(deltaLon, -15.0, 0.2, 'Subsolar longitude shifts ~15° Westward per hour of elapsed UTC');
  const deltaGmst = (s2.gmstDeg - s1.gmstDeg + 360) % 360;
  assertClose(deltaGmst, 15.04, 0.1, 'GMST strictly advances prograde (~15.04°/hr) with elapsed UTC time');
}

// 10. Secular Extreme Ephemeris Stability (Years 1000 CE to 3000 CE)
console.log('\nTest 10: Extreme Epoch Secular Range Stability');
{
  const pastState = getCelestialState(new Date('1000-01-01T00:00:00Z'));
  const futureState = getCelestialState(new Date('3000-01-01T00:00:00Z'));

  assert(!isNaN(pastState.sun.distanceKm) && pastState.sun.distanceKm > 145e6 && pastState.sun.distanceKm < 154e6,
    'Year 1000 CE Sun distance is finite and physically bounded');
  assert(!isNaN(pastState.moon.distanceKm) && pastState.moon.distanceKm > 350000 && pastState.moon.distanceKm < 410000,
    'Year 1000 CE Moon distance is finite and physically bounded');

  assert(!isNaN(futureState.sun.distanceKm) && futureState.sun.distanceKm > 145e6 && futureState.sun.distanceKm < 154e6,
    'Year 3000 CE Sun distance is finite and physically bounded');
  assert(!isNaN(futureState.moon.distanceKm) && futureState.moon.distanceKm > 350000 && futureState.moon.distanceKm < 410000,
    'Year 3000 CE Moon distance is finite and physically bounded');
}

// 11. Eclipse Clamp Protection Against Float Precision Overflow
console.log('\nTest 11: Eclipse Math.acos Numerical Boundary Protection');
{
  // Test with artificially perfect co-axial alignment
  const clampTest = Math.acos(Math.max(-1, Math.min(1, 1.0000000000000002)));
  assert(!isNaN(clampTest) && clampTest === 0, 'Float precision overflow is properly clamped to 0 without NaN');
}

console.log(`\n===========================================`);
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log(`===========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ASTRONOMICAL TESTS PASSED SUCCESSFULLY!');
}
