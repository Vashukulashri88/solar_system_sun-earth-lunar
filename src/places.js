/**
 * Planetary Places and Feature Identification Engine
 * Handles country identification, lunar landing sites/maria/craters/mountains,
 * local solar time calculation, solar/lunar topocentric altitudes, and search.
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export class PlacesManager {
  constructor() {
    this.countries = [];
    this.countryPolygons = [];
    this.moonFeatures = {
      landingSites: [],
      maria: [],
      craters: [],
      mountains: []
    };
    this.isLoaded = false;
  }

  async load() {
    try {
      const [countriesRes, processedRes, moonRes] = await Promise.all([
        fetch('assets/data/countries.geojson'),
        fetch('assets/data/countries_processed.json'),
        fetch('assets/data/moon_features.json')
      ]);

      let processedList = null;
      if (processedRes.ok) {
        processedList = await processedRes.json();
      }

      if (countriesRes.ok) {
        const geojson = await countriesRes.json();
        this.parseCountries(geojson, processedList);
      }

      if (moonRes.ok) {
        this.moonFeatures = await moonRes.json();
      }

      this.isLoaded = true;
      return true;
    } catch (e) {
      console.warn('Could not load place assets from server:', e);
      return false;
    }
  }

  parseCountries(geojson, processedList = null) {
    this.countries = [];
    this.countryPolygons = [];

    const centroidMap = new Map();
    if (Array.isArray(processedList)) {
      for (const item of processedList) {
        if (item.iso && item.iso !== '-99') centroidMap.set(item.iso, { lat: item.lat, lon: item.lon });
        if (item.name) centroidMap.set(item.name.toLowerCase(), { lat: item.lat, lon: item.lon });
      }
    }

    for (const f of geojson.features || []) {
      const props = f.properties || {};
      const name = props.NAME || props.ADMIN || props.SOVEREIGNT || 'Unknown';
      const iso = (props.ISO_A3 && props.ISO_A3 !== '-99') ? props.ISO_A3 : (props.ADM0_A3 && props.ADM0_A3 !== '-99' ? props.ADM0_A3 : '');
      const geom = f.geometry || {};
      const type = geom.type;
      const coords = geom.coordinates || [];

      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      let totalLon = 0, totalLat = 0, ptCount = 0;

      const rings = [];
      function collectRings(c, depth) {
        if (depth === 0) {
          rings.push(c);
          for (const [x, y] of c) {
            if (x < minLon) minLon = x;
            if (x > maxLon) maxLon = x;
            if (y < minLat) minLat = y;
            if (y > maxLat) maxLat = y;
            totalLon += x;
            totalLat += y;
            ptCount++;
          }
        } else {
          for (const sub of c) collectRings(sub, depth - 1);
        }
      }

      if (type === 'Polygon') {
        collectRings(coords, 1);
      } else if (type === 'MultiPolygon') {
        collectRings(coords, 2);
      }

      let centroidLon = ptCount > 0 ? totalLon / ptCount : 0;
      let centroidLat = ptCount > 0 ? totalLat / ptCount : 0;

      // Use verified centroid if available
      const verified = (iso && centroidMap.get(iso)) || centroidMap.get(name.toLowerCase());
      if (verified) {
        centroidLat = verified.lat;
        centroidLon = verified.lon;
      }

      const dLon = Math.max(0.1, maxLon - minLon);
      const dLat = Math.max(0.1, maxLat - minLat);
      const approxArea = dLon * dLat * Math.cos(centroidLat * DEG2RAD);
      const pop = props.POP_EST || 1000000;
      const area = approxArea * 100 + Math.sqrt(pop);

      const country = {
        name,
        iso,
        continent: props.CONTINENT || '',
        centroid: { lat: centroidLat, lon: centroidLon },
        bbox: [minLon, minLat, maxLon, maxLat],
        area,
        rings
      };

      this.countries.push(country);
    }
  }

  /**
   * Fast point-in-polygon test using ray casting
   */
  pointInRing(lon, lat, ring) {
    let inside = false;
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  identifyCountry(lon, lat) {
    if (!this.countries.length) return null;

    // 1. Check exact polygon inclusion
    for (const country of this.countries) {
      const [minX, minY, maxX, maxY] = country.bbox;
      if (lon < minX - 0.5 || lon > maxX + 0.5 || lat < minY - 0.5 || lat > maxY + 0.5) {
        continue;
      }
      for (const ring of country.rings) {
        if (this.pointInRing(lon, lat, ring)) {
          return { country, exact: true };
        }
      }
    }

    // 2. Fallback to nearest country centroid and ocean name
    let nearest = null;
    let minDistKm = Infinity;
    for (const c of this.countries) {
      const d = this.greatCircleDistanceKm(lat, lon, c.centroid.lat, c.centroid.lon, 6371.0);
      if (d < minDistKm) {
        minDistKm = d;
        nearest = c;
      }
    }

    const oceanName = this.getOceanName(lat, lon);
    return {
      country: nearest,
      exact: false,
      oceanName,
      distanceToCoastKm: Math.round(minDistKm)
    };
  }

  getOceanName(lat, lon) {
    if (lat < -60) return 'Southern Ocean';
    if (lat > 66) return 'Arctic Ocean';
    if (lat >= 30 && lat <= 45 && lon >= -6 && lon <= 36) return 'Mediterranean Sea';
    if (lat >= 10 && lat <= 30 && lon >= -98 && lon <= -80) return 'Gulf of Mexico';
    if (lon >= -75 && lon <= 20) {
      return lat >= 0 ? 'North Atlantic Ocean' : 'South Atlantic Ocean';
    }
    if (lon >= 20 && lon <= 105 && lat <= 30) {
      return 'Indian Ocean';
    }
    return lat >= 0 ? 'North Pacific Ocean' : 'South Pacific Ocean';
  }

  greatCircleDistanceKm(lat1, lon1, lat2, lon2, radius = 6371.0) {
    const phi1 = lat1 * DEG2RAD;
    const phi2 = lat2 * DEG2RAD;
    const dPhi = (lat2 - lat1) * DEG2RAD;
    const dLam = (lon2 - lon1) * DEG2RAD;
    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) * Math.sin(dLam / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return radius * c;
  }

  formatLatLon(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    const aLat = Math.abs(lat);
    const aLon = Math.abs(lon);
    const dLat = Math.floor(aLat);
    const mLat = Math.floor((aLat - dLat) * 60);
    const dLon = Math.floor(aLon);
    const mLon = Math.floor((aLon - dLon) * 60);
    return `${dLat}°${mLat.toString().padStart(2, '0')}' ${ns}, ${dLon}°${mLon.toString().padStart(2, '0')}' ${ew}`;
  }

  /**
   * Detailed Earth Location Telemetry
   */
  inspectEarth(lat, lon, state) {
    const match = this.identifyCountry(lon, lat);
    const formattedCoords = this.formatLatLon(lat, lon);

    // True Solar Time at this longitude:
    // Subsolar longitude is where True Solar Time is 12:00:00 (Noon)
    const hourAngleDeg = ((lon - state.subsolar.longitudeDeg) + 540) % 360 - 180;
    const lstHoursDecimal = ((12.0 + hourAngleDeg / 15.0) % 24 + 24) % 24;
    const lstH = Math.floor(lstHoursDecimal);
    const lstM = Math.floor((lstHoursDecimal - lstH) * 60);
    const lstS = Math.floor(((lstHoursDecimal - lstH) * 60 - lstM) * 60);
    const solarTimeStr = `${lstH.toString().padStart(2, '0')}:${lstM.toString().padStart(2, '0')}:${lstS.toString().padStart(2, '0')}`;

    // Topocentric Solar Altitude & Azimuth
    const phi = lat * DEG2RAD;
    const deltaSun = state.subsolar.latitudeDeg * DEG2RAD;
    const hSunRad = hourAngleDeg * DEG2RAD;

    const sinAltSun = Math.sin(phi) * Math.sin(deltaSun) + Math.cos(phi) * Math.cos(deltaSun) * Math.cos(hSunRad);
    const altSunDeg = Math.asin(Math.max(-1, Math.min(1, sinAltSun))) * RAD2DEG;

    let dayNightStatus = 'Night';
    if (altSunDeg > 0) {
      dayNightStatus = `Daylight (Sun +${altSunDeg.toFixed(1)}°)`;
    } else if (altSunDeg > -6) {
      dayNightStatus = `Civil Twilight (Sun ${altSunDeg.toFixed(1)}°)`;
    } else if (altSunDeg > -12) {
      dayNightStatus = `Nautical Twilight (Sun ${altSunDeg.toFixed(1)}°)`;
    } else if (altSunDeg > -18) {
      dayNightStatus = `Astronomical Twilight (Sun ${altSunDeg.toFixed(1)}°)`;
    } else {
      dayNightStatus = `Night (Sun ${altSunDeg.toFixed(1)}°)`;
    }

    // Topocentric Moon Altitude
    const deltaMoon = state.sublunar.latitudeDeg * DEG2RAD;
    const hMoonDeg = ((lon - state.sublunar.longitudeDeg) + 540) % 360 - 180;
    const hMoonRad = hMoonDeg * DEG2RAD;
    const sinAltMoon = Math.sin(phi) * Math.sin(deltaMoon) + Math.cos(phi) * Math.cos(deltaMoon) * Math.cos(hMoonRad);
    const altMoonDeg = Math.asin(Math.max(-1, Math.min(1, sinAltMoon))) * RAD2DEG;

    let moonVisibility = altMoonDeg > 0 ? `Above Horizon (+${altMoonDeg.toFixed(1)}°)` : `Below Horizon (${altMoonDeg.toFixed(1)}°)`;

    let locationTitle = 'Open Waters';
    let locationSubtitle = '';
    if (match && match.exact) {
      locationTitle = match.country.name;
      locationSubtitle = `Country • ${match.country.continent}`;
    } else if (match && match.oceanName) {
      locationTitle = match.oceanName;
      locationSubtitle = `Nearest Coast: ${match.country ? match.country.name : 'Land'} (${match.distanceToCoastKm} km)`;
    }

    return {
      body: 'earth',
      title: locationTitle,
      subtitle: locationSubtitle,
      country: match && match.exact ? match.country.name : null,
      iso: match && match.exact ? match.country.iso : null,
      lat,
      lon,
      formattedCoords,
      solarTime: solarTimeStr,
      dayNightStatus,
      sunAltitudeDeg: altSunDeg,
      moonAltitudeDeg: altMoonDeg,
      moonVisibility
    };
  }

  /**
   * Detailed Moon Location Telemetry
   */
  inspectMoon(lat, lon, state) {
    const formattedCoords = this.formatLatLon(lat, lon);

    // Find nearest landing site
    let nearestLanding = null;
    let minLandingDist = Infinity;
    for (const site of this.moonFeatures.landingSites || []) {
      const d = this.greatCircleDistanceKm(lat, lon, site.lat, site.lon, 1737.4);
      if (d < minLandingDist) {
        minLandingDist = d;
        nearestLanding = site;
      }
    }

    // Find nearest geological feature (maria, craters, mountains)
    let nearestGeol = null;
    let minGeolDist = Infinity;
    const allGeol = [
      ...(this.moonFeatures.maria || []).map(m => ({ ...m, type: 'Mare' })),
      ...(this.moonFeatures.craters || []).map(c => ({ ...c, type: 'Crater' })),
      ...(this.moonFeatures.mountains || []).map(m => ({ ...m, type: 'Mountain Range' }))
    ];

    for (const g of allGeol) {
      const d = this.greatCircleDistanceKm(lat, lon, g.lat, g.lon, 1737.4);
      if (d < minGeolDist) {
        minGeolDist = d;
        nearestGeol = g;
      }
    }

    // Visibility from Earth (Libration Sub-Earth point)
    const subEarthLat = state.moonOrientation ? state.moonOrientation.subEarthLatDeg : 0;
    const subEarthLon = state.moonOrientation ? state.moonOrientation.subEarthLonDeg : 0;
    const distToSubEarthDeg = this.greatCircleDistanceKm(lat, lon, subEarthLat, subEarthLon, 1.0) * RAD2DEG;

    let earthVisibility = 'Near Side (Directly Visible from Earth)';
    if (distToSubEarthDeg > 95) {
      earthVisibility = 'Lunar Far Side (Hidden from Earth)';
    } else if (distToSubEarthDeg > 85) {
      earthVisibility = 'Libration Limb Zone (Occasionally visible with wobble)';
    }

    // Sunlight on Moon: derived from exact astronomical sub-solar selenographic point
    let subSunLat = 0;
    let subSunLon = 0;
    if (state.moonOrientation && typeof state.moonOrientation.subSolarLatDeg === 'number') {
      subSunLat = state.moonOrientation.subSolarLatDeg;
      subSunLon = state.moonOrientation.subSolarLonDeg;
    } else {
      const relElong = (state.moonPhase && typeof state.moonPhase.relativeElongationDeg === 'number')
        ? state.moonPhase.relativeElongationDeg : 0;
      subSunLon = (180.0 - relElong + 540) % 360 - 180;
    }
    const distToSubSunDeg = this.greatCircleDistanceKm(lat, lon, subSunLat, subSunLon, 1.0) * RAD2DEG;
    const inSunlight = distToSubSunDeg < 90;
    const sunlightStatus = inSunlight ? 'Lunar Day (Direct Sunlight)' :
      (distToSubEarthDeg < 90 ? 'Lunar Night (Lit by Earthshine)' : 'Lunar Night (Dark Far Side)');

    let title = nearestGeol ? nearestGeol.name : 'Lunar Highlands';
    let subtitle = nearestGeol ? `${nearestGeol.type} • Selenographic surface` : 'Lunar surface';
    let featureDesc = nearestGeol ? (nearestGeol.description || '') : '';

    if (nearestLanding && minLandingDist < 150) {
      title = nearestLanding.name;
      subtitle = `${nearestLanding.mission} • Landing Site (${Math.round(minLandingDist)} km away)`;
      featureDesc = nearestLanding.description;
    }

    return {
      body: 'moon',
      title,
      subtitle,
      description: featureDesc,
      lat,
      lon,
      formattedCoords,
      nearestLanding: nearestLanding ? `${nearestLanding.name} (${Math.round(minLandingDist)} km)` : null,
      nearestFeature: nearestGeol ? `${nearestGeol.name} (${Math.round(minGeolDist)} km)` : null,
      earthVisibility,
      sunlightStatus
    };
  }

  /**
   * Search across all countries and moon features
   */
  search(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const results = [];

    // Search countries
    for (const c of this.countries) {
      if (c.name.toLowerCase().includes(q) || (c.iso && c.iso.toLowerCase() === q)) {
        results.push({
          body: 'earth',
          name: c.name,
          category: 'Country',
          continent: c.continent,
          lat: c.centroid.lat,
          lon: c.centroid.lon,
          details: `Country in ${c.continent}`
        });
      }
    }

    // Search Moon landing sites
    for (const site of this.moonFeatures.landingSites || []) {
      if (site.name.toLowerCase().includes(q) || site.mission.toLowerCase().includes(q)) {
        results.push({
          body: 'moon',
          name: site.name,
          category: 'Lunar Landing Site',
          lat: site.lat,
          lon: site.lon,
          details: site.description
        });
      }
    }

    // Search Moon maria
    for (const m of this.moonFeatures.maria || []) {
      if (m.name.toLowerCase().includes(q)) {
        results.push({
          body: 'moon',
          name: m.name,
          category: 'Lunar Mare',
          lat: m.lat,
          lon: m.lon,
          details: m.description
        });
      }
    }

    // Search Moon craters
    for (const cr of this.moonFeatures.craters || []) {
      if (cr.name.toLowerCase().includes(q)) {
        results.push({
          body: 'moon',
          name: cr.name,
          category: 'Lunar Crater',
          lat: cr.lat,
          lon: cr.lon,
          details: cr.description
        });
      }
    }

    // Search Moon mountains
    for (const mt of this.moonFeatures.mountains || []) {
      if (mt.name.toLowerCase().includes(q)) {
        results.push({
          body: 'moon',
          name: mt.name,
          category: 'Lunar Mountain',
          lat: mt.lat,
          lon: mt.lon,
          details: mt.description
        });
      }
    }

    return results.slice(0, 10);
  }
}
