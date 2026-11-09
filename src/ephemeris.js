import * as Astronomy from '../vendor/astronomy.js';
export { Astronomy };

export const ASTRONOMICAL_CONSTANTS = {
  AU_KM: 149597870.7,             // 1 Astronomical Unit in km
  EARTH_RADIUS_KM: 6371.0,         // Earth mean volumetric radius in km
  MOON_RADIUS_KM: 1737.4,          // Moon mean radius in km
  SUN_RADIUS_KM: 696340.0,         // Sun radius in km
  MOON_SEMI_MAJOR_AXIS_KM: 384400, // Mean Moon distance in km
  EARTH_OBLIQUITY_J2000_DEG: 23.4392911, // Earth axial tilt at J2000.0
  MOON_ORBIT_INCLINATION_DEG: 5.145396,  // Moon inclination to ecliptic
  SPEED_OF_LIGHT_KM_S: 299792.458
};

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Normalizes an angle in degrees to [0, 360).
 */
export function normalizeDeg(deg) {
  let val = deg % 360;
  if (val < 0) val += 360;
  return val;
}

/**
 * Normalizes an angle in degrees to [-180, 180).
 */
export function normalizeDeg180(deg) {
  let val = normalizeDeg(deg);
  if (val >= 180) val -= 360;
  return val;
}

/**
 * Normalizes an angle in radians to [0, 2*PI).
 */
export function normalizeRad(rad) {
  const TWO_PI = Math.PI * 2;
  let val = rad % TWO_PI;
  if (val < 0) val += TWO_PI;
  return val;
}

/**
 * Calculates Julian Ephemeris Date (JD) from a UTC Date.
 * Meeus Chapter 7.
 * @param {Date} date
 * @returns {number} Julian Date
 */
export function getJulianDate(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const min = date.getUTCMinutes();
  const sec = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;

  const dayFraction = day + (hour + min / 60 + sec / 3600) / 24;

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  const jd = Math.floor(365.25 * (y + 4716)) +
             Math.floor(30.6001 * (m + 1)) +
             dayFraction + B - 1524.5;
  return jd;
}

/**
 * Calculates Julian Centuries since J2000.0 (JD 2451545.0)
 * @param {number} jd
 * @returns {number} T
 */
export function getJulianCenturies(jd) {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in degrees.
 * Meeus Chapter 12.
 * @param {number} jd - Julian Date
 * @returns {number} GMST in degrees [0, 360)
 */
export function getGMST(jd) {
  const T = getJulianCenturies(jd);
  // IAU formula for GMST
  const gmst = 280.46061837 +
               360.98564736629 * (jd - 2451545.0) +
               0.000387933 * T * T -
               (T * T * T) / 38710000.0;
  return normalizeDeg(gmst);
}

/**
 * True Obliquity of the Ecliptic in degrees.
 * Meeus Chapter 22.
 * @param {number} T - Julian centuries since J2000
 * @returns {number} Obliquity in degrees
 */
export function getObliquity(T) {
  return 23.43929111 -
         (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600.0;
}

/**
 * Computes Sun's Geocentric Ephemeris.
 * Meeus Chapter 25.
 * @param {number} T - Julian centuries
 * @returns {Object} Sun ephemeris data
 */
export function getSunEphemeris(T) {
  // Geometric mean longitude of the Sun (deg)
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

  // Mean anomaly of the Sun (deg)
  const M = normalizeDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const M_rad = M * DEG2RAD;

  // Eccentricity of Earth's orbit
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

  // Sun's equation of the center (deg)
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M_rad) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad) +
            0.000289 * Math.sin(3 * M_rad);

  // Sun's true geometric longitude (deg)
  const sunTrueLong = normalizeDeg(L0 + C);

  // Sun's true anomaly (deg)
  const nu = normalizeDeg(M + C);
  const nu_rad = nu * DEG2RAD;

  // Distance from Earth to Sun in AU
  const distanceAU = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu_rad));
  const distanceKm = distanceAU * ASTRONOMICAL_CONSTANTS.AU_KM;

  // Obliquity of ecliptic
  const eps = getObliquity(T);
  const eps_rad = eps * DEG2RAD;
  const long_rad = sunTrueLong * DEG2RAD;

  // Right Ascension and Declination (Equatorial)
  const sinAlpha = Math.cos(eps_rad) * Math.sin(long_rad);
  const cosAlpha = Math.cos(long_rad);
  let alpha = Math.atan2(sinAlpha, cosAlpha) * RAD2DEG;
  alpha = normalizeDeg(alpha);

  const sinDelta = Math.sin(eps_rad) * Math.sin(long_rad);
  const delta = Math.asin(sinDelta) * RAD2DEG;

  // Geocentric Cartesian Ecliptic Coordinates (km)
  // X points to vernal equinox, Y in ecliptic plane (90 deg), Z normal to ecliptic
  const geocentricEcliptic = {
    x: distanceKm * Math.cos(long_rad),
    y: distanceKm * Math.sin(long_rad),
    z: 0.0
  };

  // Heliocentric Earth coordinates are negative of Geocentric Sun coordinates
  const heliocentricEarth = {
    x: -geocentricEcliptic.x,
    y: -geocentricEcliptic.y,
    z: -geocentricEcliptic.z
  };

  return {
    meanLongitudeDeg: L0,
    meanAnomalyDeg: M,
    eccentricity: e,
    equationOfCenterDeg: C,
    trueLongitudeDeg: sunTrueLong,
    distanceAU,
    distanceKm,
    obliquityDeg: eps,
    rightAscensionDeg: alpha,
    declinationDeg: delta,
    geocentricEclipticKm: geocentricEcliptic,
    heliocentricEarthKm: heliocentricEarth
  };
}

/**
 * Computes Moon's Geocentric Ephemeris based on Brown's Lunar Theory / Meeus Ch. 47.
 * @param {number} T - Julian centuries
 * @returns {Object} Moon ephemeris data
 */
export function getMoonEphemeris(T) {
  // Fundamental arguments of lunar motion (all in degrees)
  // Moon's mean longitude
  const Lp = normalizeDeg(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841.0);

  // Mean elongation of the Moon
  const D = normalizeDeg(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868.0);

  // Sun's mean anomaly
  const M = normalizeDeg(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000.0);

  // Moon's mean anomaly
  const Mp = normalizeDeg(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T * T * T) / 69699.0);

  // Moon's argument of latitude (distance from ascending node)
  const F = normalizeDeg(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - (T * T * T) / 3526000.0);

  // Longitude of the ascending node
  const Omega = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000.0);

  // Convert to radians for trigonometric functions
  const D_r = D * DEG2RAD;
  const M_r = M * DEG2RAD;
  const Mp_r = Mp * DEG2RAD;
  const F_r = F * DEG2RAD;

  // Major periodic perturbations in Moon's longitude (degrees)
  let deltaL =
    6.288774 * Math.sin(Mp_r) +
    1.274027 * Math.sin(2 * D_r - Mp_r) +
    0.658314 * Math.sin(2 * D_r) +
    0.213618 * Math.sin(2 * Mp_r) -
    0.185116 * Math.sin(M_r) -
    0.114332 * Math.sin(2 * F_r) +
    0.058793 * Math.sin(2 * D_r - 2 * Mp_r) +
    0.057066 * Math.sin(2 * D_r - M_r - Mp_r) +
    0.053322 * Math.sin(2 * D_r + Mp_r) +
    0.045758 * Math.sin(2 * D_r - M_r) -
    0.040923 * Math.sin(M_r - Mp_r) -
    0.034720 * Math.sin(D_r) -
    0.030383 * Math.sin(M_r + Mp_r) +
    0.015327 * Math.sin(2 * D_r - 2 * F_r) -
    0.012528 * Math.sin(Mp_r + 2 * F_r) +
    0.010980 * Math.sin(Mp_r - 2 * F_r) +
    0.010675 * Math.sin(4 * D_r - Mp_r) +
    0.010034 * Math.sin(3 * Mp_r);

  // Major periodic perturbations in Moon's latitude (degrees)
  let deltaB =
    5.128122 * Math.sin(F_r) +
    0.280602 * Math.sin(Mp_r + F_r) +
    0.277693 * Math.sin(Mp_r - F_r) +
    0.173237 * Math.sin(2 * D_r - F_r) +
    0.055413 * Math.sin(2 * D_r - Mp_r + F_r) +
    0.046271 * Math.sin(2 * D_r - Mp_r - F_r) +
    0.032573 * Math.sin(2 * D_r + F_r) +
    0.017198 * Math.sin(2 * Mp_r + F_r) +
    0.009266 * Math.sin(2 * D_r + Mp_r - F_r) +
    0.008822 * Math.sin(2 * Mp_r - F_r) +
    0.008216 * Math.sin(2 * D_r - M_r - F_r);

  // Major periodic perturbations in Moon's distance (km)
  let deltaR =
    -20905.355 * Math.cos(Mp_r) -
    3699.111 * Math.cos(2 * D_r - Mp_r) -
    2955.968 * Math.cos(2 * D_r) -
    569.925 * Math.cos(2 * Mp_r) +
    246.158 * Math.cos(2 * D_r - 2 * Mp_r) -
    204.586 * Math.cos(2 * D_r - M_r - Mp_r) -
    170.733 * Math.cos(2 * D_r + Mp_r) -
    152.138 * Math.cos(2 * D_r - M_r) -
    129.620 * Math.cos(2 * F_r) +
    108.743 * Math.cos(D_r) +
    104.755 * Math.cos(M_r - Mp_r) +
    79.661 * Math.cos(M_r + Mp_r);

  // Geocentric Ecliptic Longitude & Latitude (degrees)
  const eclipticLong = normalizeDeg(Lp + deltaL);
  const eclipticLat = deltaB; // Can be negative or positive around ecliptic plane (-5.3 to +5.3 deg)
  const distanceKm = 385000.56 + deltaR;

  // Convert Ecliptic to Cartesian (Ecliptic frame)
  const longRad = eclipticLong * DEG2RAD;
  const latRad = eclipticLat * DEG2RAD;

  const geocentricEcliptic = {
    x: distanceKm * Math.cos(latRad) * Math.cos(longRad),
    y: distanceKm * Math.cos(latRad) * Math.sin(longRad),
    z: distanceKm * Math.sin(latRad)
  };

  // Convert to Equatorial coordinates using Obliquity
  const eps = getObliquity(T);
  const epsRad = eps * DEG2RAD;

  const sinDeltaM = Math.sin(latRad) * Math.cos(epsRad) +
                    Math.cos(latRad) * Math.sin(epsRad) * Math.sin(longRad);
  const declination = Math.asin(sinDeltaM) * RAD2DEG;

  const yEq = Math.sin(longRad) * Math.cos(epsRad) - Math.tan(latRad) * Math.sin(epsRad);
  const xEq = Math.cos(longRad);
  let rightAscension = Math.atan2(yEq, xEq) * RAD2DEG;
  rightAscension = normalizeDeg(rightAscension);

  return {
    meanLongitudeDeg: Lp,
    elongationDeg: D,
    meanAnomalyDeg: Mp,
    argumentOfLatitudeDeg: F,
    ascendingNodeDeg: Omega,
    eclipticLongitudeDeg: eclipticLong,
    eclipticLatitudeDeg: eclipticLat,
    distanceKm,
    rightAscensionDeg: rightAscension,
    declinationDeg: declination,
    geocentricEclipticKm: geocentricEcliptic
  };
}

/**
 * Computes the complete celestial state for Earth, Sun, and Moon at a given UTC Date.
 * @param {Date} date
 * @returns {Object} Comprehensive celestial state
 */
export function getMoonOrientationBasis(date = new Date()) {
  const time = Astronomy.MakeTime(date);
  const axis = Astronomy.RotationAxis(Astronomy.Body.Moon, date);
  const lib = Astronomy.Libration(date);

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;
  const raRad = axis.ra * 15 * DEG2RAD;
  const decRad = axis.dec * DEG2RAD;
  const wRad = (axis.spin % 360) * DEG2RAD;

  // Transforms vector from IAU lunar body coordinates to ICRF:
  // v_icrf = Rz(-(ra + pi/2)) * Rx(-(pi/2 - dec)) * Rz(-W) * v_body
  function bodyToIcrf(vb) {
    const cW = Math.cos(wRad), sW = Math.sin(wRad);
    const x1 = cW * vb.x - sW * vb.y;
    const y1 = sW * vb.x + cW * vb.y;
    const z1 = vb.z;

    const phi = Math.PI / 2 - decRad;
    const cPhi = Math.cos(phi), sPhi = Math.sin(phi);
    const x2 = x1;
    const y2 = cPhi * y1 - sPhi * z1;
    const z2 = sPhi * y1 + cPhi * z1;

    const psi = raRad + Math.PI / 2;
    const cPsi = Math.cos(psi), sPsi = Math.sin(psi);
    const x3 = cPsi * x2 - sPsi * y2;
    const y3 = sPsi * x2 + cPsi * y2;
    const z3 = z2;

    return new Astronomy.Vector(x3, y3, z3, time);
  }

  // Transforms ICRF vector into Scene coordinates (true ecliptic of date, Y up, -Z towards solstices):
  function icrfToScene(v_icrf) {
    const ecl = Astronomy.Ecliptic(v_icrf);
    return {
      x: ecl.vec.x,
      y: ecl.vec.z,
      z: -ecl.vec.y
    };
  }

  // Three.js Moon Sphere mesh convention:
  // Local +X = Prime Meridian (lon 0, lat 0)
  // Local +Y = Lunar North Pole (lat +90)
  // Local -Z = Lunar East (+90 deg lon)
  const basisX = icrfToScene(bodyToIcrf({ x: 1, y: 0, z: 0 }));
  const basisY = icrfToScene(bodyToIcrf({ x: 0, y: 0, z: 1 }));
  const basisZ = icrfToScene(bodyToIcrf({ x: 0, y: -1, z: 0 }));

  // Position angle of lunar North Pole as seen from Earth (projected onto plane of sky):
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, date, false);
  const mDist = Math.hypot(moonGeo.x, moonGeo.y, moonGeo.z);
  const toMoonICRF = { x: moonGeo.x / mDist, y: moonGeo.y / mDist, z: moonGeo.z / mDist };

  // Celestial North in ICRF: (0, 0, 1)
  const dotN = toMoonICRF.z;
  let skyN = { x: -dotN * toMoonICRF.x, y: -dotN * toMoonICRF.y, z: 1 - dotN * toMoonICRF.z };
  const skyNLen = Math.hypot(skyN.x, skyN.y, skyN.z);
  skyN.x /= skyNLen; skyN.y /= skyNLen; skyN.z /= skyNLen;

  // Sky East: skyN x (-toMoonICRF)
  const skyE = {
    x: skyN.y * (-toMoonICRF.z) - skyN.z * (-toMoonICRF.y),
    y: skyN.z * (-toMoonICRF.x) - skyN.x * (-toMoonICRF.z),
    z: skyN.x * (-toMoonICRF.y) - skyN.y * (-toMoonICRF.x)
  };
  const skyELen = Math.hypot(skyE.x, skyE.y, skyE.z);
  skyE.x /= skyELen; skyE.y /= skyELen; skyE.z /= skyELen;

  const pole = axis.north;
  const dotP = pole.x * toMoonICRF.x + pole.y * toMoonICRF.y + pole.z * toMoonICRF.z;
  const skyP = {
    x: pole.x - dotP * toMoonICRF.x,
    y: pole.y - dotP * toMoonICRF.y,
    z: pole.z - dotP * toMoonICRF.z
  };

  const compN = skyP.x * skyN.x + skyP.y * skyN.y + skyP.z * skyN.z;
  const compE = skyP.x * skyE.x + skyP.y * skyE.y + skyP.z * skyE.z;
  const positionAngleDeg = Math.atan2(compE, compN) * RAD2DEG;

  // Subsolar point on Moon in selenographic coordinates
  // Vector from Moon to Sun in ICRF is -HelioVector(Moon)
  const hMoon = Astronomy.HelioVector(Astronomy.Body.Moon, date);
  const toSunICRF = { x: -hMoon.x, y: -hMoon.y, z: -hMoon.z };

  // Inverse: transform ICRF vector into Moon body coordinates
  const psi = raRad + Math.PI / 2;
  const cPsi = Math.cos(psi), sPsi = Math.sin(psi);
  const x2 = cPsi * toSunICRF.x + sPsi * toSunICRF.y;
  const y2 = -sPsi * toSunICRF.x + cPsi * toSunICRF.y;
  const z2 = toSunICRF.z;

  const phi = Math.PI / 2 - decRad;
  const cPhi = Math.cos(phi), sPhi = Math.sin(phi);
  const x1 = x2;
  const y1 = cPhi * y2 + sPhi * z2;
  const z1 = -sPhi * y2 + cPhi * z2;

  const cW = Math.cos(wRad), sW = Math.sin(wRad);
  const xb = cW * x1 + sW * y1;
  const yb = -sW * x1 + cW * y1;
  const zb = z1;

  const distToSunBody = Math.hypot(xb, yb, zb);
  const subSolarLatDeg = Math.asin(Math.max(-1, Math.min(1, zb / distToSunBody))) * RAD2DEG;
  const subSolarLonDeg = Math.atan2(yb, xb) * RAD2DEG;

  return {
    basisX,
    basisY,
    basisZ,
    subEarthLatDeg: lib.elat,
    subEarthLonDeg: lib.elon,
    subSolarLatDeg,
    subSolarLonDeg,
    positionAngleDeg,
    poleRaDeg: normalizeDeg(axis.ra * 15.0),
    poleDecDeg: axis.dec,
    spinDeg: axis.spin
  };
}

/**
 * Computes the complete celestial state for Earth, Sun, and Moon at a given UTC Date.
 * @param {Date} date
 * @returns {Object} Comprehensive celestial state
 */
export function getCelestialState(date = new Date()) {
  const jd = getJulianDate(date);
  const T = getJulianCenturies(jd);
  const astroTime = Astronomy.MakeTime(date);
  const et = Astronomy.e_tilt ? Astronomy.e_tilt(astroTime) : null;
  const obliquity = et ? et.tobl : getObliquity(T);

  // Astronomy Engine High-Precision Calculations
  const obs = new Astronomy.Observer(0, 0, 0); // Geocentric observer
  const sunEq = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
  const moonEq = Astronomy.Equator(Astronomy.Body.Moon, date, obs, true, true);
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, date, false);
  const moonEcl = Astronomy.Ecliptic(moonGeo);

  // Greenwich Apparent Sidereal Time (GAST)
  const gastHours = Astronomy.SiderealTime(date);
  const gastDeg = normalizeDeg(gastHours * 15.0);

  // Sun ephemeris
  const sunDistanceAU = sunEq.dist;
  const sunDistanceKm = sunDistanceAU * ASTRONOMICAL_CONSTANTS.AU_KM;
  const sunRA_deg = normalizeDeg(sunEq.ra * 15.0);
  const sunDec_deg = sunEq.dec;
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, date, false);
  const sunEcl = Astronomy.Ecliptic(sunGeo);
  const sunTrueLongDeg = normalizeDeg(sunEcl.elon);

  // Moon ephemeris
  const moonDistanceAU = moonEq.dist;
  const moonDistanceKm = moonDistanceAU * ASTRONOMICAL_CONSTANTS.AU_KM;
  const moonRA_deg = normalizeDeg(moonEq.ra * 15.0);
  const moonDec_deg = moonEq.dec;
  const moonEclipticLongDeg = normalizeDeg(moonEcl.elon);
  const moonEclipticLatDeg = moonEcl.elat;

  // Ascending node and mean longitude (for orbital ring visual orientation)
  const Omega = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
  const Lprime = normalizeDeg(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841 - (T * T * T * T) / 65194000);

  // Subsolar Point on Earth
  const subsolarLat = sunDec_deg;
  const subsolarLon = normalizeDeg180(sunRA_deg - gastDeg);

  // Sublunar Point on Earth
  const sublunarLat = moonDec_deg;
  const sublunarLon = normalizeDeg180(moonRA_deg - gastDeg);

  // Moon Physical Libration & Orientation (IAU model)
  const moonOrient = getMoonOrientationBasis(date);

  // Moon Phase & Illumination
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const phaseAngle = Astronomy.MoonPhase(date); // Relative elongation [0, 360)
  const relativeElongation = phaseAngle;
  const illuminatedFraction = illum.phase_fraction;

  // Determine Phase Name
  let phaseName = 'New Moon';
  if (relativeElongation < 10 || relativeElongation >= 350) {
    phaseName = 'New Moon';
  } else if (relativeElongation < 80) {
    phaseName = 'Waxing Crescent';
  } else if (relativeElongation <= 100) {
    phaseName = 'First Quarter';
  } else if (relativeElongation < 170) {
    phaseName = 'Waxing Gibbous';
  } else if (relativeElongation <= 190) {
    phaseName = 'Full Moon';
  } else if (relativeElongation < 260) {
    phaseName = 'Waning Gibbous';
  } else if (relativeElongation <= 280) {
    phaseName = 'Last Quarter';
  } else {
    phaseName = 'Waning Crescent';
  }

  // Eclipse Geometry
  const sunAngularRadius = (ASTRONOMICAL_CONSTANTS.SUN_RADIUS_KM / sunDistanceKm) * RAD2DEG;
  const moonAngularRadius = (ASTRONOMICAL_CONSTANTS.MOON_RADIUS_KM / moonDistanceKm) * RAD2DEG;

  // Angular separation between centers of Sun and Moon as seen from geocenter
  const dotSep = Math.sin(sunDec_deg * DEG2RAD) * Math.sin(moonDec_deg * DEG2RAD) +
                 Math.cos(sunDec_deg * DEG2RAD) * Math.cos(moonDec_deg * DEG2RAD) *
                 Math.cos((sunRA_deg - moonRA_deg) * DEG2RAD);
  const angularSeparationDeg = Math.acos(Math.max(-1, Math.min(1, dotSep))) * RAD2DEG;

  let eclipseStatus = {
    isSolarEclipse: false,
    solarEclipseType: 'None',
    isLunarEclipse: false,
    lunarEclipseType: 'None',
    angularSeparationDeg,
    relativeElongationDeg: relativeElongation
  };

  // Check Solar Eclipse condition (near New Moon)
  if (relativeElongation < 18 || relativeElongation > 342) {
    if (angularSeparationDeg < (sunAngularRadius + moonAngularRadius + 1.25)) {
      eclipseStatus.isSolarEclipse = true;
      if (angularSeparationDeg < Math.abs(sunAngularRadius - moonAngularRadius) + 0.15) {
        eclipseStatus.solarEclipseType = moonAngularRadius >= sunAngularRadius ? 'Total Solar Eclipse' : 'Annular Solar Eclipse';
      } else {
        eclipseStatus.solarEclipseType = 'Partial Solar Eclipse';
      }
    }
  }

  // Check Lunar Eclipse condition (near Full Moon)
  if (Math.abs(relativeElongation - 180) < 18) {
    const sunParallax = (ASTRONOMICAL_CONSTANTS.EARTH_RADIUS_KM / sunDistanceKm) * RAD2DEG;
    const moonParallax = (ASTRONOMICAL_CONSTANTS.EARTH_RADIUS_KM / moonDistanceKm) * RAD2DEG;
    const umbraRadiusDeg = sunParallax + moonParallax - sunAngularRadius;
    const penumbraRadiusDeg = sunParallax + moonParallax + sunAngularRadius;

    const shadowOppositeSunRA = normalizeDeg(sunRA_deg + 180);
    const shadowOppositeSunDec = -sunDec_deg;

    const dotShadow = Math.sin(shadowOppositeSunDec * DEG2RAD) * Math.sin(moonDec_deg * DEG2RAD) +
                      Math.cos(shadowOppositeSunDec * DEG2RAD) * Math.cos(moonDec_deg * DEG2RAD) *
                      Math.cos((shadowOppositeSunRA - moonRA_deg) * DEG2RAD);
    const moonToShadowDistDeg = Math.acos(Math.max(-1, Math.min(1, dotShadow))) * RAD2DEG;

    if (moonToShadowDistDeg < (penumbraRadiusDeg + moonAngularRadius)) {
      eclipseStatus.isLunarEclipse = true;
      if (moonToShadowDistDeg < (umbraRadiusDeg - moonAngularRadius)) {
        eclipseStatus.lunarEclipseType = 'Total Lunar Eclipse';
      } else if (moonToShadowDistDeg < (umbraRadiusDeg + moonAngularRadius)) {
        eclipseStatus.lunarEclipseType = 'Partial Lunar Eclipse';
      } else {
        eclipseStatus.lunarEclipseType = 'Penumbral Lunar Eclipse';
      }
    }
  }

  return {
    date,
    julianDate: jd,
    julianCenturies: T,
    gmstDeg: gastDeg,
    gastDeg: gastDeg,
    obliquityDeg: obliquity,
    sun: {
      distanceKm: sunDistanceKm,
      distanceAU: sunDistanceAU,
      trueLongitudeDeg: sunTrueLongDeg,
      rightAscensionDeg: sunRA_deg,
      declinationDeg: sunDec_deg,
      vector: { x: sunGeo.x, y: sunGeo.y, z: sunGeo.z }
    },
    moon: {
      distanceKm: moonDistanceKm,
      distanceAU: moonDistanceAU,
      eclipticLongitudeDeg: moonEclipticLongDeg,
      eclipticLatitudeDeg: moonEclipticLatDeg,
      rightAscensionDeg: moonRA_deg,
      declinationDeg: moonDec_deg,
      meanLongitudeDeg: Lprime,
      ascendingNodeDeg: Omega,
      vector: { x: moonGeo.x, y: moonGeo.y, z: moonGeo.z }
    },
    subsolar: {
      latitudeDeg: subsolarLat,
      longitudeDeg: subsolarLon
    },
    sublunar: {
      latitudeDeg: sublunarLat,
      longitudeDeg: sublunarLon
    },
    moonOrientation: {
      poleRaDeg: moonOrient.poleRaDeg,
      poleDecDeg: moonOrient.poleDecDeg,
      spinDeg: moonOrient.spinDeg,
      subEarthLonDeg: moonOrient.subEarthLonDeg, // physical libration in longitude
      subEarthLatDeg: moonOrient.subEarthLatDeg, // physical libration in latitude
      subSolarLatDeg: moonOrient.subSolarLatDeg, // subsolar selenographic latitude
      subSolarLonDeg: moonOrient.subSolarLonDeg, // subsolar selenographic longitude
      librationLonDeg: moonOrient.subEarthLonDeg,
      librationLatDeg: moonOrient.subEarthLatDeg,
      positionAngleDeg: moonOrient.positionAngleDeg,
      basisX: moonOrient.basisX,
      basisY: moonOrient.basisY,
      basisZ: moonOrient.basisZ
    },
    moonPhase: {
      relativeElongationDeg: relativeElongation,
      illuminatedFraction,
      phaseFraction: illuminatedFraction,
      phasePercent: Math.round(illuminatedFraction * 100),
      phaseName,
      mag: illum.mag
    },
    eclipse: eclipseStatus
  };
}

/**
 * Searches next global solar eclipse after date.
 */
export function searchNextSolarEclipse(date) {
  return Astronomy.SearchGlobalSolarEclipse(date);
}

/**
 * Searches previous global solar eclipse before date.
 */
export function searchPrevSolarEclipse(date) {
  let probe = new Date(date.getTime() - 220 * 86400000);
  let cur = Astronomy.SearchGlobalSolarEclipse(probe);
  let best = cur;
  while (cur.peak.date < date) {
    best = cur;
    cur = Astronomy.NextGlobalSolarEclipse(cur.peak);
  }
  return best;
}

/**
 * Searches next lunar eclipse after date.
 */
export function searchNextLunarEclipse(date) {
  return Astronomy.SearchLunarEclipse(date);
}

/**
 * Searches previous lunar eclipse before date.
 */
export function searchPrevLunarEclipse(date) {
  let probe = new Date(date.getTime() - 220 * 86400000);
  let cur = Astronomy.SearchLunarEclipse(probe);
  let best = cur;
  while (cur.peak.date < date) {
    best = cur;
    cur = Astronomy.NextLunarEclipse(cur.peak);
  }
  return best;
}

/**
 * Searches next moon quarter after date (0: New, 1: First, 2: Full, 3: Third).
 * If targetQuarter is provided, searches until that quarter is matched.
 */
export function searchNextMoonQuarter(date, targetQuarter = null) {
  let q = Astronomy.SearchMoonQuarter(date);
  if (targetQuarter === null) return q;
  while (q.quarter !== targetQuarter) {
    q = Astronomy.NextMoonQuarter(q);
  }
  return q;
}

/**
 * Searches previous moon quarter before date.
 */
export function searchPrevMoonQuarter(date, targetQuarter = null) {
  let probe = new Date(date.getTime() - 35 * 86400000);
  let q = Astronomy.SearchMoonQuarter(probe);
  let best = null;
  while (q.time.date < date) {
    if (targetQuarter === null || q.quarter === targetQuarter) {
      best = q;
    }
    q = Astronomy.NextMoonQuarter(q);
  }
  return best;
}

/**
 * Computes equinoxes and solstices for a calendar year.
 */
export function getSeasons(year) {
  return Astronomy.Seasons(year);
}


