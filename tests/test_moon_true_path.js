/**
 * Verification Test Suite for Moon's True Heliocentric Trajectory Around the Sun
 * Validates:
 * 1. Physical Concavity toward Sun (no inflection points, always concave)
 * 2. Strict Prograde Motion (zero retrograde loops, no cusps)
 * 3. Exact correspondence to Astronomy Engine HelioVector(Moon)
 * 4. Configurable Span (±1 Month vs Full Year)
 * 5. Scale Modes (Visual 1:389 proportional & Amplified, 1:1 Metric Scale)
 * 6. UI Visibility and Marker Synchronization
 */

import assert from 'assert';
import * as THREE from 'three';
import { SolarSystemScene } from '../src/scene.js';
import { getCelestialState, ASTRONOMICAL_CONSTANTS, Astronomy } from '../src/ephemeris.js';

console.log('=== Moon True Heliocentric Trajectory Verification Suite ===\n');

// Mock container for headless Three.js SolarSystemScene
const mockContainer = {
  clientWidth: 1280,
  clientHeight: 720,
  appendChild: () => {},
  removeChild: () => {},
  addEventListener: () => {}
};

// Test 1: Instantiation & Properties
console.log('Test 1: Scene Initialization of Moon Trajectory & Marker');
const scene = new SolarSystemScene(mockContainer);

assert(scene.moonSunTrajectoryLine instanceof THREE.Line, 'moonSunTrajectoryLine is a THREE.Line');
assert(scene.moonTruePositionMarker instanceof THREE.Mesh, 'moonTruePositionMarker is a THREE.Mesh');
assert(scene.showMoonSunPath === true, 'showMoonSunPath defaults to true');
assert(scene.moonSunPathSpan === 'month', 'moonSunPathSpan defaults to month');
assert(scene.moonSunPathScale === 'true', 'moonSunPathScale defaults to true (proportional)');

const maxPoints = scene.moonSunTrajectoryLine.geometry.attributes.position.count;
assert(maxPoints === 5000, `Buffer capacity is 5000 points (got ${maxPoints})`);
console.log('  ✓ PASS: Scene creates moonSunTrajectoryLine, position marker, and default settings');

// Test 2: Match Astronomy Engine HelioVector(Moon) within tolerance
console.log('\nTest 2: Sampled Points Match Astronomy Engine HelioVector(Moon)');
const testDate = new Date('2026-06-21T00:00:00Z');
const state = getCelestialState(testDate);
scene.update(state, 0);

const posAttr = scene.moonSunTrajectoryLine.geometry.attributes.position;
const drawCount = scene.moonSunTrajectoryLine.geometry.drawRange.count;
assert(drawCount > 1000, `Trajectory has dense sampling (got ${drawCount} points for month span)`);

// Check center point (index = Math.floor(drawCount / 2)) against Astronomy Engine
const centerIdx = Math.floor(drawCount / 2);
const lineX = posAttr.getX(centerIdx);
const lineY = posAttr.getY(centerIdx);
const lineZ = posAttr.getZ(centerIdx);

// Compute expected from Astronomy.HelioVector(Moon, testDate)
const expectedHm = Astronomy.HelioVector(Astronomy.Body.Moon, testDate);
const expectedEcl = Astronomy.Ecliptic(expectedHm);
const expectedX = 32.0 * expectedEcl.vec.x;
const expectedY = 32.0 * expectedEcl.vec.z;
const expectedZ = -32.0 * expectedEcl.vec.y;

const diffX = Math.abs(lineX - expectedX);
const diffY = Math.abs(lineY - expectedY);
const diffZ = Math.abs(lineZ - expectedZ);

assert(diffX < 1e-4, `X coordinate matches astronomy-engine (diff: ${diffX.toExponential(3)})`);
assert(diffY < 1e-4, `Y coordinate matches astronomy-engine (diff: ${diffY.toExponential(3)})`);
assert(diffZ < 1e-4, `Z coordinate matches astronomy-engine (diff: ${diffZ.toExponential(3)})`);
console.log(`  → Center point distance diff: ${Math.hypot(diffX, diffY, diffZ).toExponential(3)} units`);
console.log('  ✓ PASS: Sampled trajectory points match astronomy-engine within numerical tolerance');

// Test 3: Trajectory is Strictly Prograde (No Retrograde Loops) for Real Proportions
console.log('\nTest 3: Strict Prograde Motion (Zero Retrograde Loops) for Real Proportions');
scene.moonSunPathSpan = 'year';
scene.moonSunPathScale = 'true';
scene.updateMoonSunTrajectory(testDate);

const yearDrawCount = scene.moonSunTrajectoryLine.geometry.drawRange.count;
assert(yearDrawCount > 4000, `Year span has >4000 samples (got ${yearDrawCount})`);

let retrogradeCount = 0;
let minDeltaTheta = Infinity;

for (let i = 1; i < yearDrawCount; i++) {
  const x0 = posAttr.getX(i - 1);
  const z0 = posAttr.getZ(i - 1);
  const x1 = posAttr.getX(i);
  const z1 = posAttr.getZ(i);

  // In ecliptic plane: X is ecl.vec.x, -Z is ecl.vec.y
  const theta0 = Math.atan2(-z0, x0);
  const theta1 = Math.atan2(-z1, x1);

  let dTheta = theta1 - theta0;
  if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  if (dTheta > Math.PI) dTheta -= 2 * Math.PI;

  if (dTheta <= 0) {
    retrogradeCount++;
  }
  if (dTheta < minDeltaTheta) {
    minDeltaTheta = dTheta;
  }
}

console.log(`  → Total trajectory points evaluated across full year: ${yearDrawCount}`);
console.log(`  → Minimum angular advance per 2h step: ${(minDeltaTheta * 180 / Math.PI).toFixed(4)}°`);
console.log(`  → Retrograde steps detected: ${retrogradeCount}`);

assert(retrogradeCount === 0, `Path has ZERO retrograde loops (got ${retrogradeCount})`);
assert(minDeltaTheta > 0, `Path continuously advances prograde around the Sun`);
console.log('  ✓ PASS: Moon true path has zero retrograde loops and moves strictly prograde everywhere');

// Test 4: Trajectory is Always Concave Toward the Sun (No Inflections, Inward Acceleration Dominates)
console.log('\nTest 4: Curvature Concavity Toward the Sun (Never Concave Outward)');
let nonCcwTurns = 0;

for (let i = 1; i < yearDrawCount - 1; i++) {
  const x0 = posAttr.getX(i - 1);
  const y0 = -posAttr.getZ(i - 1); // Ecliptic Y

  const x1 = posAttr.getX(i);
  const y1 = -posAttr.getZ(i);

  const x2 = posAttr.getX(i + 1);
  const y2 = -posAttr.getZ(i + 1);

  const v1x = x1 - x0;
  const v1y = y1 - y0;
  const v2x = x2 - x1;
  const v2y = y2 - y1;

  // 2D Cross product: v1 x v2 > 0 implies counter-clockwise turn (concave toward the center)
  const cross = v1x * v2y - v1y * v2x;
  if (cross <= 0) {
    nonCcwTurns++;
  }
}

console.log(`  → Non-counter-clockwise inflection turns detected: ${nonCcwTurns}`);
assert(nonCcwTurns === 0, `Trajectory is strictly concave toward the Sun with ZERO inflection points (got ${nonCcwTurns})`);
console.log('  ✓ PASS: Trajectory is everywhere concave toward the Sun (Solar gravity 2.2x Earth gravity)');

// Test 5: Amplified Wave Mode (Preserves No-Loop Prograde Shape)
console.log('\nTest 5: Amplified Wave Mode (3x Amplification)');
scene.moonSunPathScale = 'amplified';
scene.updateMoonSunTrajectory(testDate);

let ampRetrogrades = 0;
for (let i = 1; i < yearDrawCount; i++) {
  const x0 = posAttr.getX(i - 1);
  const z0 = posAttr.getZ(i - 1);
  const x1 = posAttr.getX(i);
  const z1 = posAttr.getZ(i);

  const theta0 = Math.atan2(-z0, x0);
  const theta1 = Math.atan2(-z1, x1);

  let dTheta = theta1 - theta0;
  if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  if (dTheta > Math.PI) dTheta -= 2 * Math.PI;

  if (dTheta <= 0) {
    ampRetrogrades++;
  }
}

assert(ampRetrogrades === 0, `Amplified wave mode preserves zero retrograde loops (got ${ampRetrogrades})`);
console.log('  ✓ PASS: Amplified wave remains strictly prograde without fake retrograde loops');

// Test 6: Span Switching Updates Buffer Draw Range
console.log('\nTest 6: Span Switching (Month vs Year)');
scene.moonSunPathSpan = 'month';
scene.updateMoonSunTrajectory(testDate);
const monthPoints = scene.moonSunTrajectoryLine.geometry.drawRange.count;
assert(monthPoints === 1441, `Month span produces 1441 points (got ${monthPoints})`);

scene.moonSunPathSpan = 'year';
scene.updateMoonSunTrajectory(testDate);
const yearPoints = scene.moonSunTrajectoryLine.geometry.drawRange.count;
assert(yearPoints === 4384, `Year span produces 4384 points (got ${yearPoints})`);
console.log('  ✓ PASS: Dynamic drawRange correctly adapts between ±1 month and full year');

// Test 7: 1:1 Metric Scale Mode
console.log('\nTest 7: 1:1 Metric Scale Mode');
scene.scaleMode = 'true';
scene.update(state, 0);

const trueDrawCount = scene.moonSunTrajectoryLine.geometry.drawRange.count;
const trueP0 = new THREE.Vector3(posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0));
const trueDist0 = trueP0.length();

// In true scale: 1 unit = 10,000 km. Heliocentric distance is ~149,600,000 km / 10,000 = ~14,960 units
console.log(`  → True scale Moon heliocentric distance in 10,000 km units: ${trueDist0.toFixed(2)}`);
// Check trajectory point at midIdx matches Astronomy Engine at midDate
const midIdx = Math.floor(trueDrawCount / 2);
const midPt = new THREE.Vector3(posAttr.getX(midIdx), posAttr.getY(midIdx), posAttr.getZ(midIdx));
const spanMs = 365.256363 * 86400000;
const stepMs = 2.0 * 3600000;
const midDate = new Date(testDate.getTime() - (spanMs / 2) + midIdx * stepMs);
const hmExpectedMid = Astronomy.HelioVector(Astronomy.Body.Moon, midDate);
const meclExpectedMid = Astronomy.Ecliptic(hmExpectedMid);
const sfTrue = ASTRONOMICAL_CONSTANTS.AU_KM / 10000.0;
const expectedMidPt = new THREE.Vector3(
  sfTrue * meclExpectedMid.vec.x,
  sfTrue * meclExpectedMid.vec.z,
  -sfTrue * meclExpectedMid.vec.y
);
const trajDiff = midPt.distanceTo(expectedMidPt);
console.log(`  → Trajectory mid point offset from Astronomy Engine: ${trajDiff.toExponential(3)} units`);
assert(trajDiff < 1e-3, `Trajectory point matches astronomy-engine in true scale`);

// Check marker position matches Moon at testDate
const markerPos = scene.moonTruePositionMarker.position;
const hmExpectedNow = Astronomy.HelioVector(Astronomy.Body.Moon, testDate);
const meclExpectedNow = Astronomy.Ecliptic(hmExpectedNow);
const expectedMarkerPos = new THREE.Vector3(
  sfTrue * meclExpectedNow.vec.x,
  sfTrue * meclExpectedNow.vec.z,
  -sfTrue * meclExpectedNow.vec.y
);
const markerDiff = markerPos.distanceTo(expectedMarkerPos);
console.log(`  → Marker offset from exact Astronomy Engine position: ${markerDiff.toExponential(3)} units`);
assert(markerDiff < 1e-3, `Marker sits accurately at Moon heliocentric position (diff ${markerDiff.toExponential(3)})`);

// Marker is adjacent to the sampled trajectory (within 1 time step)
const distToTraj = markerPos.distanceTo(midPt);
assert(distToTraj < 15.0, `Marker is close to midpoint on trajectory (diff ${distToTraj.toFixed(2)} units < 15)`);
console.log('  ✓ PASS: 1:1 metric scale correctly scales trajectory and marker to physical kilometers');

// Test 8: Visibility Toggles
console.log('\nTest 8: Visibility Toggles');
scene.scaleMode = 'visual';
scene.showMoonSunPath = false;
scene.update(state, 0);
assert(scene.moonSunTrajectoryLine.visible === false, 'moonSunTrajectoryLine is hidden when showMoonSunPath is false');
assert(scene.moonTruePositionMarker.visible === false, 'moonTruePositionMarker is hidden when showMoonSunPath is false');

scene.showMoonSunPath = true;
scene.showOrbits = false;
scene.update(state, 0);
assert(scene.moonSunTrajectoryLine.visible === false, 'moonSunTrajectoryLine is hidden when showOrbits is false');
assert(scene.moonTruePositionMarker.visible === false, 'moonTruePositionMarker is hidden when showOrbits is false');

scene.showOrbits = true;
scene.update(state, 0);
assert(scene.moonSunTrajectoryLine.visible === true, 'moonSunTrajectoryLine is visible when both toggles are true');
assert(scene.moonTruePositionMarker.visible === true, 'moonTruePositionMarker is visible when both toggles are true');
console.log('  ✓ PASS: Visibility toggles operate as expected for Moon true path and marker');

console.log('\n===========================================');
console.log('ALL MOON TRUE PATH TESTS PASSED SUCCESSFULLY!');
console.log('===========================================');
