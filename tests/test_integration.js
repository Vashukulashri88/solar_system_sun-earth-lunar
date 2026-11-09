import * as THREE from '../vendor/three.module.js';
import * as Astronomy from '../vendor/astronomy.js';
import { getCelestialState, getMoonOrientationBasis } from '../src/ephemeris.js';
import { createEarthMaterial, createAtmosphereHaloMaterial, createSunMaterial, createSunCoronaMaterial } from '../src/shaders.js';

console.log('=== Headless 3D Scene Integration Test ===\n');

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

// 1. Verify Three.js classes and math utilities
console.log('Test 1: Three.js core imports');
{
  assert(typeof THREE.Scene === 'function', 'THREE.Scene is available');
  assert(typeof THREE.PerspectiveCamera === 'function', 'THREE.PerspectiveCamera is available');
  assert(typeof THREE.DirectionalLight === 'function', 'THREE.DirectionalLight is available');
  assert(typeof THREE.PointLight === 'function', 'THREE.PointLight is available');
  assert(typeof THREE.SphereGeometry === 'function', 'THREE.SphereGeometry is available');
  assert(typeof THREE.ConeGeometry === 'function', 'THREE.ConeGeometry is available');
  assert(typeof THREE.ShaderMaterial === 'function', 'THREE.ShaderMaterial is available');
}

// 2. Verify Shader Material Uniforms
console.log('\nTest 2: Shader Material Uniform definitions');
{
  const dummyTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const earthMat = createEarthMaterial(dummyTex, dummyTex, dummyTex);
  assert(earthMat.uniforms.sunWorldPosition !== undefined, 'Earth material has sunWorldPosition uniform');
  assert(earthMat.uniforms.moonWorldPosition !== undefined, 'Earth material has moonWorldPosition uniform');
  assert(earthMat.uniforms.moonRadiusWorld !== undefined, 'Earth material has moonRadiusWorld uniform');

  const atmoMat = createAtmosphereHaloMaterial();
  assert(atmoMat.uniforms.sunWorldPosition !== undefined, 'Atmosphere material has sunWorldPosition uniform');
}

// 3. Verify Umbra Cone Geometry orientation
console.log('\nTest 3: Umbra Cone vertex orientation (base at z=0, apex at z=height)');
{
  const umbraGeom = new THREE.ConeGeometry(1.0, 15, 16, 1, true);
  umbraGeom.rotateX(Math.PI / 2);
  umbraGeom.translate(0, 0, 7.5);

  let tipZ = 0, baseZ = 0;
  const pos = umbraGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.hypot(x, y) < 0.001) tipZ = z;
    else baseZ = z;
  }
  assert(Math.abs(baseZ - 0.0) < 0.001, `Base of umbra cone is anchored at Earth center z=0 (got ${baseZ})`);
  assert(Math.abs(tipZ - 15.0) < 0.001, `Tip of umbra cone points away along +Z at z=15 (got ${tipZ})`);
}

// 4. Verify Lunar Orbit orientation with Line of Nodes
console.log('\nTest 4: Lunar Orbit plane Euler YXZ inclination');
{
  const euler = new THREE.Euler(5.145 * Math.PI / 180, 45 * Math.PI / 180, 0, 'YXZ');
  const ascendingNode = new THREE.Vector3(1, 0, 0).applyEuler(euler);
  assert(Math.abs(ascendingNode.y) < 1e-6, `Ascending node lies exactly in Ecliptic plane y=0 (got ${ascendingNode.y})`);

  const maxInclination = new THREE.Vector3(0, 0, -1).applyEuler(euler);
  const latDeg = Math.asin(maxInclination.y) * 180 / Math.PI;
  assert(Math.abs(latDeg - 5.145) < 1e-4, `Max orbital inclination matches 5.145° (got ${latDeg.toFixed(4)}°)`);
}

// 5. Verify Lunar Near-Side Tidal Alignment with IAU Cartographic Basis
console.log('\nTest 5: Lunar Near-Side Facing Earth with IAU Basis Orientation');
{
  const testDate = new Date('2026-11-09T12:00:00Z');
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, testDate, false);
  const moonEcl = Astronomy.Ecliptic(moonGeo);
  const moonScenePos = new THREE.Vector3(moonEcl.vec.x, moonEcl.vec.z, -moonEcl.vec.y);
  const earthPos = new THREE.Vector3(0, 0, 0);

  const orient = getMoonOrientationBasis(testDate);
  const vX = new THREE.Vector3(orient.basisX.x, orient.basisX.y, orient.basisX.z);
  const vY = new THREE.Vector3(orient.basisY.x, orient.basisY.y, orient.basisY.z);
  const vZ = new THREE.Vector3(orient.basisZ.x, orient.basisZ.y, orient.basisZ.z);
  const rotMat = new THREE.Matrix4().makeBasis(vX, vY, vZ);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8));
  moonMesh.quaternion.setFromRotationMatrix(rotMat);
  moonMesh.position.copy(moonScenePos);

  const localFacingEarth = moonMesh.worldToLocal(earthPos.clone()).normalize();
  // Near-side prime meridian (+X) faces Earth within ~8° optical/physical libration
  assert(localFacingEarth.x > 0.985, `Local +X (lon 0, lunar near-side) faces Earth within libration envelope (got x=${localFacingEarth.x.toFixed(4)})`);
  assert(Math.abs(localFacingEarth.z) < 0.15, `Local Z (lon libration) is bounded within libration envelope (got z=${localFacingEarth.z.toFixed(4)})`);
}

console.log(`\n===========================================`);
console.log(`INTEGRATION TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log(`===========================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
}
