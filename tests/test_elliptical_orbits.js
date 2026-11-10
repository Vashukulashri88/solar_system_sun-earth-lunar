/**
 * Verification Test Suite for Real Sampled Elliptical Orbits and Apsides Markers
 */

import assert from 'assert';
import * as THREE from 'three';
import { SolarSystemScene } from '../src/scene.js';
import { getCelestialState, ASTRONOMICAL_CONSTANTS } from '../src/ephemeris.js';

console.log('=== Elliptical Orbit Paths & Apsides Verification Suite ===\n');

// Mock a lightweight container for headless SolarSystemScene testing
const mockContainer = {
  clientWidth: 1280,
  clientHeight: 720,
  appendChild: () => {},
  removeChild: () => {},
  addEventListener: () => {}
};

// Test 1: Instantiation of Elliptical Orbits and Apsides Markers
console.log('Test 1: Scene Initialization of Elliptical Orbits & Markers');
const scene = new SolarSystemScene(mockContainer);

assert(scene.earthOrbitLine instanceof THREE.Line, 'earthOrbitLine is a THREE.Line');
assert(scene.moonOrbitLine instanceof THREE.Line, 'moonOrbitLine is a THREE.Line');
assert(scene.perihelionMarker instanceof THREE.Group, 'perihelionMarker is a THREE.Group');
assert(scene.aphelionMarker instanceof THREE.Group, 'aphelionMarker is a THREE.Group');
assert(scene.perigeeMarker instanceof THREE.Group, 'perigeeMarker is a THREE.Group');
assert(scene.apogeeMarker instanceof THREE.Group, 'apogeeMarker is a THREE.Group');

console.log('  ✓ PASS: Scene creates earthOrbitLine, moonOrbitLine, and all 4 apsides markers');

// Test 2: Earth Sampled Keplerian Orbit Physical Properties
console.log('\nTest 2: Earth Keplerian Orbit Physical Ellipticity (Visual Scale)');
const date = new Date('2026-03-20T12:00:00Z');
const state = getCelestialState(date);
scene.update(state, 0);

const earthPosAttr = scene.earthOrbitLine.geometry.attributes.position;
const earthPointsCount = earthPosAttr.count;
assert(earthPointsCount === 257, `earthOrbitLine has 257 vertices (256 segments) (got ${earthPointsCount})`);

let minSunDist = Infinity;
let maxSunDist = -Infinity;
let sumX = 0, sumZ = 0;

for (let i = 0; i < earthPointsCount - 1; i++) {
  const x = earthPosAttr.getX(i);
  const y = earthPosAttr.getY(i);
  const z = earthPosAttr.getZ(i);

  const d = Math.sqrt(x * x + y * y + z * z);
  if (d < minSunDist) minSunDist = d;
  if (d > maxSunDist) maxSunDist = d;

  sumX += x;
  sumZ += z;

  // Ecliptic Y should be essentially flat for Earth
  assert(Math.abs(y) < 1e-3, `Earth ecliptic Y is ~0 (got ${y})`);
}

// Convert visual units (where 1 AU = 32.0 units) to AU
const perihelionAU = minSunDist / 32.0;
const aphelionAU = maxSunDist / 32.0;
const semiMajorAxis = (perihelionAU + aphelionAU) / 2.0;
const eccentricity = (aphelionAU - perihelionAU) / (perihelionAU + aphelionAU);

console.log(`  → Perihelion: ${(perihelionAU * ASTRONOMICAL_CONSTANTS.AU_KM / 1e6).toFixed(3)}M km (${perihelionAU.toFixed(4)} AU)`);
console.log(`  → Aphelion: ${(aphelionAU * ASTRONOMICAL_CONSTANTS.AU_KM / 1e6).toFixed(3)}M km (${aphelionAU.toFixed(4)} AU)`);
console.log(`  → Calculated Orbit Eccentricity: ${eccentricity.toFixed(5)}`);

assert(Math.abs(semiMajorAxis - 1.0) < 0.005, `Semi-major axis is ~1.0 AU (got ${semiMajorAxis.toFixed(4)})`);
assert(Math.abs(eccentricity - 0.0167) < 0.002, `Earth orbital eccentricity matches ~0.0167 (got ${eccentricity.toFixed(5)})`);
assert(perihelionAU >= 0.980 && perihelionAU <= 0.985, `Perihelion distance is in physical bounds [0.980, 0.985] AU`);
assert(aphelionAU >= 1.014 && aphelionAU <= 1.019, `Aphelion distance is in physical bounds [1.014, 1.019] AU`);

// Closed loop verification
const pFirst = new THREE.Vector3(earthPosAttr.getX(0), earthPosAttr.getY(0), earthPosAttr.getZ(0));
const pLast = new THREE.Vector3(earthPosAttr.getX(earthPointsCount - 1), earthPosAttr.getY(earthPointsCount - 1), earthPosAttr.getZ(earthPointsCount - 1));
assert(pFirst.distanceTo(pLast) < 1e-5, 'Earth orbit line forms a closed loop');
console.log('  ✓ PASS: Earth orbit line forms a true Keplerian ellipse with eccentricity ~0.0167 and closed loop');

// Test 3: Moon Sampled Perturbed Elliptical Orbit & Inclination
console.log('\nTest 3: Moon Perturbed Inclined Orbit Physical Properties (Visual Scale)');
const moonPosAttr = scene.moonOrbitLine.geometry.attributes.position;
const moonPointsCount = moonPosAttr.count;
assert(moonPointsCount === 193, `moonOrbitLine has 193 vertices (192 segments) (got ${moonPointsCount})`);

let minMoonDist = Infinity;
let maxMoonDist = -Infinity;
let maxLatDeg = -Infinity;

for (let j = 0; j < moonPointsCount - 1; j++) {
  const relX = moonPosAttr.getX(j);
  const relY = moonPosAttr.getY(j);
  const relZ = moonPosAttr.getZ(j);

  const d = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
  if (d < minMoonDist) minMoonDist = d;
  if (d > maxMoonDist) maxMoonDist = d;

  const latDeg = Math.asin(relY / d) * 180 / Math.PI;
  if (Math.abs(latDeg) > maxLatDeg) maxLatDeg = Math.abs(latDeg);
}

// Convert visual units (where 384,400 km = 7.5 units) to km
const perigeeKm = (minMoonDist / 7.5) * ASTRONOMICAL_CONSTANTS.MOON_SEMI_MAJOR_AXIS_KM;
const apogeeKm = (maxMoonDist / 7.5) * ASTRONOMICAL_CONSTANTS.MOON_SEMI_MAJOR_AXIS_KM;
const lunarEccentricity = (apogeeKm - perigeeKm) / (apogeeKm + perigeeKm);

console.log(`  → Lunar Perigee: ${perigeeKm.toFixed(1)} km`);
console.log(`  → Lunar Apogee: ${apogeeKm.toFixed(1)} km`);
console.log(`  → Lunar Orbit Eccentricity: ${lunarEccentricity.toFixed(5)}`);
console.log(`  → Max Spatial Inclination to Ecliptic: ${maxLatDeg.toFixed(3)}°`);

assert(perigeeKm >= 356000 && perigeeKm <= 372000, `Perigee distance is in physical bounds [356,000, 372,000] km (got ${perigeeKm.toFixed(0)})`);
assert(apogeeKm >= 403000 && apogeeKm <= 408000, `Apogee distance is in physical bounds [403,000, 408,000] km (got ${apogeeKm.toFixed(0)})`);
assert(Math.abs(lunarEccentricity - 0.055) < 0.015, `Lunar eccentricity matches ~0.055 (got ${lunarEccentricity.toFixed(4)})`);
assert(Math.abs(maxLatDeg - 5.145) < 0.35, `Max inclination matches ~5.145° (got ${maxLatDeg.toFixed(3)}°)`);

// Closed loop verification
const mFirst = new THREE.Vector3(moonPosAttr.getX(0), moonPosAttr.getY(0), moonPosAttr.getZ(0));
const mLast = new THREE.Vector3(moonPosAttr.getX(moonPointsCount - 1), moonPosAttr.getY(moonPointsCount - 1), moonPosAttr.getZ(moonPointsCount - 1));
assert(mFirst.distanceTo(mLast) < 1e-5, 'Moon orbit line forms a closed loop');
console.log('  ✓ PASS: Moon orbit line forms a true inclined perturbed ellipse with eccentricity ~0.055 and 5.15° tilt');

// Test 4: Apsides Markers Position Alignment
console.log('\nTest 4: Apsides Markers Alignment with Orbital Trajectories');
const periPos = scene.perihelionMarker.position;
const periDist = periPos.length();
assert(Math.abs(periDist - minSunDist) < 0.05, `Perihelion marker sits at min distance ${minSunDist.toFixed(3)} (got ${periDist.toFixed(3)})`);

const aphPos = scene.aphelionMarker.position;
const aphDist = aphPos.length();
assert(Math.abs(aphDist - maxSunDist) < 0.05, `Aphelion marker sits at max distance ${maxSunDist.toFixed(3)} (got ${aphDist.toFixed(3)})`);

const earthPos = scene.earthGroup.position;
const perigeeDistToEarth = scene.perigeeMarker.position.distanceTo(earthPos);
assert(Math.abs(perigeeDistToEarth - minMoonDist) < 0.05, `Perigee marker sits at min distance to Earth ${minMoonDist.toFixed(3)} (got ${perigeeDistToEarth.toFixed(3)})`);

const apogeeDistToEarth = scene.apogeeMarker.position.distanceTo(earthPos);
assert(Math.abs(apogeeDistToEarth - maxMoonDist) < 0.05, `Apogee marker sits at max distance to Earth ${maxMoonDist.toFixed(3)} (got ${apogeeDistToEarth.toFixed(3)})`);

console.log('  ✓ PASS: Perihelion, Aphelion, Perigee, and Apogee markers sit accurately at orbit extrema');

// Test 5: Visibility Toggles
console.log('\nTest 5: Orbit and Apsides Visibility Toggles');
scene.showOrbits = false;
scene.update(state, 0);
assert(!scene.earthOrbitLine.visible, 'earthOrbitLine is hidden when showOrbits is false');
assert(!scene.moonOrbitLine.visible, 'moonOrbitLine is hidden when showOrbits is false');
assert(!scene.perihelionMarker.visible, 'perihelionMarker is hidden when showOrbits is false');
assert(!scene.aphelionMarker.visible, 'aphelionMarker is hidden when showOrbits is false');
assert(!scene.perigeeMarker.visible, 'perigeeMarker is hidden when showOrbits is false');
assert(!scene.apogeeMarker.visible, 'apogeeMarker is hidden when showOrbits is false');

scene.showOrbits = true;
scene.showApsides = false;
scene.update(state, 0);
assert(scene.earthOrbitLine.visible, 'earthOrbitLine is visible');
assert(!scene.perihelionMarker.visible, 'perihelionMarker is hidden when showApsides is false');
assert(!scene.aphelionMarker.visible, 'aphelionMarker is hidden when showApsides is false');
assert(!scene.perigeeMarker.visible, 'perigeeMarker is hidden when showApsides is false');
assert(!scene.apogeeMarker.visible, 'apogeeMarker is hidden when showApsides is false');

scene.showApsides = true;
scene.update(state, 0);
assert(scene.perihelionMarker.visible, 'perihelionMarker is visible when both are true');
assert(scene.aphelionMarker.visible, 'aphelionMarker is visible when both are true');
assert(scene.perigeeMarker.visible, 'perigeeMarker is visible when both are true');
assert(scene.apogeeMarker.visible, 'apogeeMarker is visible when both are true');
console.log('  ✓ PASS: Visibility toggles work as expected for all orbits and apsides');

// Test 6: 1:1 Metric Scale Mode Switch
console.log('\nTest 6: 1:1 Metric True Scale Mode');
scene.scaleMode = 'true';
scene.update(state, 0);

const trueEarthAttr = scene.earthOrbitLine.geometry.attributes.position;
const trueMinDist = Math.sqrt(trueEarthAttr.getX(0)**2 + trueEarthAttr.getY(0)**2 + trueEarthAttr.getZ(0)**2);
// In true scale, distance in units = km / 10,000 -> ~14,700 to 15,200 units
assert(trueMinDist > 14000 && trueMinDist < 16000, `True scale Earth orbit size is in 10,000 km units (got ${trueMinDist.toFixed(1)})`);

const trueMoonAttr = scene.moonOrbitLine.geometry.attributes.position;
const trueMoonDist0 = Math.sqrt(trueMoonAttr.getX(0)**2 + trueMoonAttr.getY(0)**2 + trueMoonAttr.getZ(0)**2);
assert(trueMoonDist0 > 35 && trueMoonDist0 < 42, `True scale Moon orbit size is in 10,000 km units (got ${trueMoonDist0.toFixed(1)})`);

const truePerigeeDist = scene.perigeeMarker.position.distanceTo(scene.earthGroup.position);
assert(truePerigeeDist > 35 && truePerigeeDist < 38, `True scale Perigee distance to Earth matches physical distance (got ${truePerigeeDist.toFixed(1)})`);

console.log('  ✓ PASS: True scale mode scales both Earth and Moon trajectories to physical kilometers');

// Test 7: Apsides Material Depth Test & Depth Write Configurations
console.log('\nTest 7: Apsides Material Depth Configuration');
const sphereMat = scene.perihelionMarker.children[0].material;
assert(sphereMat.depthTest === true, 'Apsis sphere material has depthTest enabled');
assert(sphereMat.depthWrite === false, 'Apsis sphere material has depthWrite disabled');

const ringMat = scene.perihelionMarker.children[1].material;
assert(ringMat.depthTest === true, 'Apsis ring material has depthTest enabled');
assert(ringMat.depthWrite === false, 'Apsis ring material has depthWrite disabled');
console.log('  ✓ PASS: Apsides materials use correct depthTest=true and depthWrite=false');

console.log('\n===========================================');
console.log('ALL ELLIPTICAL ORBIT TESTS PASSED SUCCESSFULLY!');
console.log('===========================================');
