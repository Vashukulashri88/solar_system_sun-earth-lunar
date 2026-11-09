import {
  searchNextSolarEclipse,
  searchPrevSolarEclipse,
  searchNextLunarEclipse,
  searchPrevLunarEclipse,
  searchNextMoonQuarter,
  searchPrevMoonQuarter,
  getSeasons
} from './ephemeris.js';

export const TIME_STEP_PRESETS = {
  MINUTE: 60,
  HOUR: 3600,
  SOLAR_DAY: 86400,
  SIDEREAL_DAY: 86164.0905, // 23h 56m 4.09s
  SYNODIC_MONTH: 29.530589 * 86400, // 29.53 days
  YEAR: 365.2422 * 86400 // 365.24 days
};

export const WARP_PRESETS = [
  { label: '-1yr/s', scale: -31536000 },
  { label: '-1mo/s', scale: -2592000 },
  { label: '-1d/s', scale: -86400 },
  { label: '-1h/s', scale: -3600 },
  { label: '-1m/s', scale: -60 },
  { label: '-1x', scale: -1 },
  { label: '1x (Real)', scale: 1 },
  { label: '+1m/s', scale: 60 },
  { label: '+1h/s', scale: 3600 },
  { label: '+1d/s', scale: 86400 },
  { label: '+1mo/s', scale: 2592000 },
  { label: '+1yr/s', scale: 31536000 }
];

export class TimeController {
  constructor(onChange) {
    this.onChange = onChange;
    this.isLive = true;
    this.simulatedDate = new Date();
    this.timeScale = 1;
    this.isPaused = false;
    this.lastRealTimestamp = performance.now();

    // Range limits 1900-01-01 to 2100-12-31
    this.minDate = new Date('1900-01-01T00:00:00Z');
    this.maxDate = new Date('2100-12-31T23:59:59Z');
  }

  setLive() {
    this.isLive = true;
    this.simulatedDate = new Date();
    this.timeScale = 1;
    this.isPaused = false;
    this.lastRealTimestamp = performance.now();
    if (this.onChange) this.onChange(this.simulatedDate);
  }

  setDate(date) {
    this.isLive = false;
    const clamped = this.clampDate(new Date(date));
    this.simulatedDate = clamped;
    this.lastRealTimestamp = performance.now();
    if (this.onChange) this.onChange(this.simulatedDate);
  }

  setTimeScale(scale) {
    this.timeScale = scale;
    if (scale !== 1) {
      this.isLive = false;
    }
  }

  reverseDirection() {
    this.setTimeScale(-this.timeScale);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.lastRealTimestamp = performance.now();
      if (this.isLive) {
        this.simulatedDate = new Date();
      }
    }
    if (this.onChange) this.onChange(this.simulatedDate);
  }

  setPaused(paused) {
    this.isPaused = !!paused;
    if (!this.isPaused) {
      this.lastRealTimestamp = performance.now();
      if (this.isLive) {
        this.simulatedDate = new Date();
      }
    }
    if (this.onChange) this.onChange(this.simulatedDate);
    return this.isPaused;
  }

  step(seconds) {
    this.isLive = false;
    const newTime = this.simulatedDate.getTime() + seconds * 1000;
    this.simulatedDate = this.clampDate(new Date(newTime));
    if (this.onChange) this.onChange(this.simulatedDate);
  }

  clampDate(date) {
    if (date < this.minDate) return new Date(this.minDate);
    if (date > this.maxDate) return new Date(this.maxDate);
    return date;
  }

  /**
   * Astronomical Event Jump Helpers
   */
  jumpNextSolarEclipse() {
    const e = searchNextSolarEclipse(new Date(this.simulatedDate.getTime() + 1000));
    if (e && e.peak && e.peak.date) {
      this.setDate(e.peak.date);
      return e;
    }
    return null;
  }

  jumpPrevSolarEclipse() {
    const e = searchPrevSolarEclipse(new Date(this.simulatedDate.getTime() - 1000));
    if (e && e.peak && e.peak.date) {
      this.setDate(e.peak.date);
      return e;
    }
    return null;
  }

  jumpNextLunarEclipse() {
    const e = searchNextLunarEclipse(new Date(this.simulatedDate.getTime() + 1000));
    if (e && e.peak && e.peak.date) {
      this.setDate(e.peak.date);
      return e;
    }
    return null;
  }

  jumpPrevLunarEclipse() {
    const e = searchPrevLunarEclipse(new Date(this.simulatedDate.getTime() - 1000));
    if (e && e.peak && e.peak.date) {
      this.setDate(e.peak.date);
      return e;
    }
    return null;
  }

  jumpNextMoonQuarter(targetQuarter = null) {
    const q = searchNextMoonQuarter(new Date(this.simulatedDate.getTime() + 1000), targetQuarter);
    if (q && q.time && q.time.date) {
      this.setDate(q.time.date);
      return q;
    }
    return null;
  }

  jumpPrevMoonQuarter(targetQuarter = null) {
    const q = searchPrevMoonQuarter(new Date(this.simulatedDate.getTime() - 1000), targetQuarter);
    if (q && q.time && q.time.date) {
      this.setDate(q.time.date);
      return q;
    }
    return null;
  }

  jumpNextNewMoon() {
    return this.jumpNextMoonQuarter(0);
  }

  jumpPrevNewMoon() {
    return this.jumpPrevMoonQuarter(0);
  }

  jumpNextFullMoon() {
    return this.jumpNextMoonQuarter(2);
  }

  jumpPrevFullMoon() {
    return this.jumpPrevMoonQuarter(2);
  }

  jumpNextEquinoxOrSolstice() {
    return this.jumpNextEquinoxSolstice();
  }

  jumpPrevEquinoxOrSolstice() {
    return this.jumpPrevEquinoxSolstice();
  }

  jumpNextEquinoxSolstice() {
    const year = this.simulatedDate.getUTCFullYear();
    const curTime = this.simulatedDate.getTime();
    const candidateYears = [year, year + 1];

    for (const y of candidateYears) {
      const s = getSeasons(y);
      const events = [
        s.mar_equinox.date,
        s.jun_solstice.date,
        s.sep_equinox.date,
        s.dec_solstice.date
      ].sort((a, b) => a - b);

      for (const ev of events) {
        if (ev.getTime() > curTime + 5000) {
          this.setDate(ev);
          return ev;
        }
      }
    }
    return null;
  }

  jumpPrevEquinoxSolstice() {
    const year = this.simulatedDate.getUTCFullYear();
    const curTime = this.simulatedDate.getTime();
    const candidateYears = [year, year - 1];

    for (const y of candidateYears) {
      const s = getSeasons(y);
      const events = [
        s.dec_solstice.date,
        s.sep_equinox.date,
        s.jun_solstice.date,
        s.mar_equinox.date
      ].sort((a, b) => b - a);

      for (const ev of events) {
        if (ev.getTime() < curTime - 5000) {
          this.setDate(ev);
          return ev;
        }
      }
    }
    return null;
  }

  getLiveStatus() {
    const offsetMs = this.simulatedDate.getTime() - Date.now();
    const absSec = Math.abs(offsetMs) / 1000;
    const isClose = absSec < 4;

    if (this.isLive && isClose && this.timeScale === 1 && !this.isPaused) {
      return {
        isLive: true,
        text: '● LIVE SYNC',
        subtext: 'Real UTC',
        deltaStr: '0.0 d (Live)'
      };
    }

    const sign = offsetMs >= 0 ? '+' : '-';
    let deltaStr = '';

    if (absSec < 60) {
      deltaStr = `${sign}${Math.round(absSec)}s`;
    } else if (absSec < 3600) {
      deltaStr = `${sign}${Math.round(absSec / 60)}m`;
    } else if (absSec < 86400) {
      deltaStr = `${sign}${(absSec / 3600).toFixed(1)}h`;
    } else if (absSec < 86400 * 365) {
      deltaStr = `${sign}${(absSec / 86400).toFixed(1)}d`;
    } else {
      deltaStr = `${sign}${(absSec / (86400 * 365.25)).toFixed(2)}yr`;
    }

    if (this.isPaused && isClose) {
      return {
        isLive: false,
        text: 'PAUSED (0s)',
        subtext: 'Time Paused',
        deltaStr: '0s (Paused)'
      };
    }

    const label = this.isPaused ? 'PAUSED' : 'SIMULATED';
    return {
      isLive: false,
      text: `${label} (${deltaStr})`,
      subtext: `${deltaStr} from now`,
      deltaStr: `${deltaStr} (${this.isPaused ? 'Paused' : 'Simulated'})`
    };
  }

  update(now = performance.now()) {
    const deltaRealSeconds = Math.min((now - this.lastRealTimestamp) / 1000, 0.5);
    this.lastRealTimestamp = now;

    if (this.isPaused) return this.simulatedDate;

    if (this.isLive) {
      this.simulatedDate = new Date();
    } else {
      const deltaSimMs = deltaRealSeconds * this.timeScale * 1000;
      const newMs = this.simulatedDate.getTime() + deltaSimMs;
      this.simulatedDate = this.clampDate(new Date(newMs));
    }

    if (this.onChange) this.onChange(this.simulatedDate);
    return this.simulatedDate;
  }
}
