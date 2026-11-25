'use strict';

(() => {
  /* ============================================================
     Constants
     ============================================================ */

  const DEFAULT_PLACE = {
    name: 'Round Rock',
    admin1: 'Texas',
    country: 'United States',
    country_code: 'US',
    latitude: 30.50826,
    longitude: -97.6789
  };

  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
  const CACHE_KEY = 'aer.cache.v1';
  const PLACE_KEY = 'aer.place.v1';
  const UNIT_KEY = 'aer.unit.v1';
  const REFRESH_MS = 10 * 60 * 1000;
  const CACHE_MAX_MS = 24 * 60 * 60 * 1000;
  const LOCALE = navigator.language || 'en-US';
  const HOUR12 = detectHourCycle();
  const REDUCED_MQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
  const WEATHER_GROUPS = new Set(['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm']);
  const DEBUG_THEME = normalizeTheme(new URLSearchParams(location.search).get('theme'));
  const DEBUG_PHASE = normalizePhase(new URLSearchParams(location.search).get('phase'));

  const WMO = {
    0: { group: 'clear', label: 'clear' },
    1: { group: 'clear', label: 'mainly clear' },
    2: { group: 'partly', label: 'partly cloudy' },
    3: { group: 'cloudy', label: 'overcast' },
    45: { group: 'fog', label: 'fog' },
    48: { group: 'fog', label: 'freezing fog' },
    51: { group: 'drizzle', label: 'light drizzle' },
    53: { group: 'drizzle', label: 'drizzle' },
    55: { group: 'drizzle', label: 'heavy drizzle' },
    56: { group: 'drizzle', label: 'freezing drizzle' },
    57: { group: 'drizzle', label: 'freezing drizzle' },
    61: { group: 'rain', label: 'light rain' },
    63: { group: 'rain', label: 'rain' },
    65: { group: 'rain', label: 'heavy rain' },
    66: { group: 'rain', label: 'freezing rain' },
    67: { group: 'rain', label: 'freezing rain' },
    71: { group: 'snow', label: 'light snow' },
    73: { group: 'snow', label: 'snow' },
    75: { group: 'snow', label: 'heavy snow' },
    77: { group: 'snow', label: 'snow grains' },
    80: { group: 'rain', label: 'light showers' },
    81: { group: 'rain', label: 'showers' },
    82: { group: 'rain', label: 'heavy showers' },
    85: { group: 'snow', label: 'snow showers' },
    86: { group: 'snow', label: 'heavy snow showers' },
    95: { group: 'storm', label: 'thunderstorms' },
    96: { group: 'storm', label: 'storms with hail' },
    99: { group: 'storm', label: 'severe storms' }
  };

  const SMALL_LABEL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  for (const entry of Object.values(WMO)) {
    entry.label = entry.label.split(' ').map((word, index) => {
      if (index > 0 && SMALL_LABEL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  const PALETTES = {
    clearDay: { zenith: '#092E56', mid: '#0B5E8C', horizon: '#3EA6BE', glow: '#FFD27A', glowAlpha: .48 },
    golden:   { zenith: '#211A46', mid: '#6D3C61', horizon: '#D77A5E', glow: '#FFC77D', glowAlpha: .58 },
    clearNight:{ zenith: '#040713', mid: '#0A1230', horizon: '#19345E', glow: '#9CB8FF', glowAlpha: .32 },
    cloudDay: { zenith: '#26323D', mid: '#4A5C69', horizon: '#8497A4', glow: '#DCE6ED', glowAlpha: .24 },
    cloudNight:{ zenith: '#0E161E', mid: '#1B2834', horizon: '#364A5A', glow: '#90A8BC', glowAlpha: .2 },
    rainDay:  { zenith: '#071A2A', mid: '#0C3448', horizon: '#256174', glow: '#8FC6D6', glowAlpha: .26 },
    rainNight:{ zenith: '#040D17', mid: '#0A1D2C', horizon: '#173B4D', glow: '#5B91A8', glowAlpha: .2 },
    storm:    { zenith: '#0A0914', mid: '#1A192D', horizon: '#2D2B45', glow: '#A5A1DC', glowAlpha: .18 },
    snowDay:  { zenith: '#1B2F3F', mid: '#3D6075', horizon: '#80A8B9', glow: '#E2F1F8', glowAlpha: .32 },
    snowNight:{ zenith: '#0B1723', mid: '#192B3A', horizon: '#35576A', glow: '#9BC0D2', glowAlpha: .26 },
    fogDay:   { zenith: '#303A43', mid: '#56646E', horizon: '#93A1AB', glow: '#E1E9EE', glowAlpha: .28 },
    fogNight: { zenith: '#111A21', mid: '#222E38', horizon: '#43525E', glow: '#A3B5C1', glowAlpha: .23 }
  };

  const SUGGESTED_CITIES = ['Austin', 'New York', 'London', 'Reykjavík'];

  /* ============================================================
     State
     ============================================================ */

  const state = {
    place: null,
    unit: 'f',
    weather: null,
    air: null,
    fetchedAt: 0,
    hourlyStart: 0,
    chartHours: [],
    chartGeom: null,
    previewIndex: null,
    pinned: false,
    hoverIndex: null,
    sceneKey: '',
    skyActive: 0,
    livePhase: null,
    lightningActive: false,
    loading: false,
    fromCache: false,
    abort: null,
    searchAbort: null,
    searchResults: [],
    searchActive: -1,
    searchToken: 0,
    previewClearTimer: null,
    statusTimer: null,
    refreshTimer: null,
    clockTimer: null,
    lightningTimer: null,
    cursorRAF: null,
    resizeRAF: null
  };

  const pointer = { nx: 0, ny: 0, x: -1000, y: -1000, visible: false };
  const celestialPosition = { xPct: 50, yPct: 30, isMoon: false, visible: false };
  const els = {};

  /* ============================================================
     Utilities
     ============================================================ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const num = (value) => Number.isFinite(value) ? value : null;
  const hexToRgba = (hex, alpha) => {
    const value = hex.replace('#', '');
    const int = parseInt(value, 16);
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
  };

  function detectHourCycle() {
    try {
      const parts = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', timeZone: 'UTC' })
        .formatToParts(new Date(Date.UTC(2026, 0, 1, 13)));
      return parts.some(part => part.type === 'dayPeriod');
    } catch {
      return true;
    }
  }

  function normalizeTheme(value) {
    return WEATHER_GROUPS.has(value) ? value : null;
  }

  function normalizePhase(value) {
    return ['day', 'golden', 'night'].includes(value) ? value : null;
  }

  function parseLocal(iso) {
    if (!iso || typeof iso !== 'string') return NaN;
    const [date, time = '00:00'] = iso.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return NaN;
    return Date.UTC(year, month - 1, day, hour, minute);
  }

  function dateKey(value) {
    if (typeof value === 'string') return value.slice(0, 10);
    const d = new Date(value);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  function formatTimeIso(iso, options = {}) {
    const ms = parseLocal(iso);
    if (!Number.isFinite(ms)) return '—';
    const showMinutes = options.minutes !== false;
    const fmtOptions = {
      hour: HOUR12 ? 'numeric' : '2-digit',
      hour12: HOUR12,
      timeZone: 'UTC'
    };
    if (showMinutes || !HOUR12) fmtOptions.minute = '2-digit';
    try {
      return new Intl.DateTimeFormat(LOCALE, fmtOptions).format(new Date(ms));
    } catch {
      return iso.slice(11, 16);
    }
  }

  function formatWeekday(iso) {
    const ms = parseLocal(iso);
    if (!Number.isFinite(ms)) return '—';
    try {
      return new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(new Date(ms));
    } catch {
      return '—';
    }
  }

  function formatClock(now = new Date()) {
    const timezone = state.weather && state.weather.timezone;
    try {
      return new Intl.DateTimeFormat(LOCALE, {
        timeZone: timezone || undefined,
        hour: HOUR12 ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: HOUR12
      }).format(now);
    } catch {
      return new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' }).format(now);
    }
  }

  function sameTimezone() {
    if (!state.weather || !state.weather.timezone) return true;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone === state.weather.timezone;
    } catch {
      return true;
    }
  }

  function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  function previewMoment(iso, includeDay = true) {
    const time = formatTimeIso(iso, { minutes: true });
    if (!includeDay || !state.weather || !state.weather.current) return time;
    const currentDate = state.weather.current.time.slice(0, 10);
    const targetDate = iso.slice(0, 10);
    if (targetDate === currentDate) return time;
    const diff = Math.round((parseLocal(targetDate) - parseLocal(currentDate)) / 86400000);
    if (diff === 1) return `Tomorrow ${time}`;
    if (diff === -1) return `Yesterday ${time}`;
    return `${formatWeekday(iso)} ${time}`;
  }

  function unitSymbol() {
    return state.unit === 'f' ? 'F' : 'C';
  }

  function tempValue(celsius) {
    if (!Number.isFinite(celsius)) return null;
    return Math.round(state.unit === 'f' ? (celsius * 9) / 5 + 32 : celsius);
  }

  function tempText(celsius) {
    const value = tempValue(celsius);
    return value == null ? '—' : `${value}°`;
  }

  function tempDelta(celsiusDelta) {
    if (!Number.isFinite(celsiusDelta)) return null;
    return Math.round(state.unit === 'f' ? (celsiusDelta * 9) / 5 : celsiusDelta);
  }

  function windSpeedText(ms) {
    if (!Number.isFinite(ms)) return '—';
    return String(Math.round(state.unit === 'f' ? ms * 2.236936 : ms));
  }

  function windSpeedUnit() {
    return state.unit === 'f' ? 'mph' : 'm/s';
  }

  function visibilityText(meters) {
    if (!Number.isFinite(meters)) return '—';
    if (state.unit === 'f') {
      const miles = meters / 1609.344;
      return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
    }
    const km = meters / 1000;
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }

  function directionLabel(degrees) {
    if (!Number.isFinite(degrees)) return '—';
    const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return labels[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16];
  }

  function windMood(ms) {
    if (!Number.isFinite(ms)) return 'light';
    if (ms < 2.5) return 'light';
    if (ms < 6) return 'gentle';
    if (ms < 11) return 'fresh';
    return 'strong';
  }

  function uvCategory(value) {
    if (!Number.isFinite(value)) return '';
    if (value < 3) return 'Low';
    if (value < 6) return 'Moderate';
    if (value < 8) return 'High';
    if (value < 11) return 'Very High';
    return 'Extreme';
  }

  function aqiCategory(value) {
    if (!Number.isFinite(value)) return { label: '', tone: 'good' };
    if (value <= 50) return { label: 'Good', tone: 'good' };
    if (value <= 100) return { label: 'Moderate', tone: 'warn' };
    if (value <= 150) return { label: 'Sensitive', tone: 'warn' };
    if (value <= 200) return { label: 'Unhealthy', tone: 'bad' };
    return { label: 'Very Poor', tone: 'bad' };
  }

  function weatherFor(code) {
    return WMO[code] || WMO[0];
  }

  function groupFor(code) {
    return weatherFor(code).group;
  }

  function iconFor(code, isDay = 1) {
    const group = groupFor(code);
    if (group === 'clear') return isDay ? 'sun' : 'moon';
    if (group === 'partly') return isDay ? 'partly' : 'partly-night';
    if (group === 'cloudy') return 'cloud';
    if (group === 'fog') return 'fog';
    if (group === 'drizzle') return 'drizzle';
    if (group === 'rain') return 'rain';
    if (group === 'snow') return 'snow';
    if (group === 'storm') return 'storm';
    return 'cloud';
  }

  function paletteFor(group, phase) {
    const night = phase === 'night';
    if (group === 'storm') return PALETTES.storm;
    if (group === 'snow') return night ? PALETTES.snowNight : PALETTES.snowDay;
    if (group === 'fog') return night ? PALETTES.fogNight : PALETTES.fogDay;
    if (group === 'rain' || group === 'drizzle') return night ? PALETTES.rainNight : PALETTES.rainDay;
    if (group === 'cloudy') return night ? PALETTES.cloudNight : PALETTES.cloudDay;
    if (night) return PALETTES.clearNight;
    if (phase === 'golden') return PALETTES.golden;
    return PALETTES.clearDay;
  }

  function isPrecipGroup(group) {
    return group === 'rain' || group === 'drizzle' || group === 'snow' || group === 'storm';
  }

  function precipWord(group, temperature) {
    if (group === 'snow' || (Number.isFinite(temperature) && temperature <= 0.5)) return 'Snow';
    if (group === 'storm') return 'Storms';
    if (group === 'drizzle') return 'Drizzle';
    return 'Rain';
  }

  function placesEqual(a, b) {
    if (!a || !b) return false;
    return Math.abs(Number(a.latitude) - Number(b.latitude)) < .001 &&
      Math.abs(Number(a.longitude) - Number(b.longitude)) < .001;
  }

  function normalizePlace(place) {
    if (!place) return null;
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      name: String(place.name || 'My location').slice(0, 80),
      admin1: String(place.admin1 || '').slice(0, 80),
      country: String(place.country || '').slice(0, 80),
      country_code: String(place.country_code || '').slice(0, 3).toUpperCase(),
      latitude,
      longitude
    };
  }

  function readJson(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage can be full or disabled; the app still works without it */
    }
  }

  function placeFromUrl() {
    const params = new URLSearchParams(location.search);
    const latParam = params.get('lat');
    const lonParam = params.get('lon');
    if (latParam == null || lonParam == null || latParam.trim() === '' || lonParam.trim() === '') return null;
    const latitude = Number(latParam);
    const longitude = Number(lonParam);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return normalizePlace({
      latitude,
      longitude,
      name: params.get('name') || 'My location',
      admin1: params.get('region') || '',
      country: params.get('country') || '',
      country_code: params.get('cc') || ''
    });
  }

  function resolveInitialPlace() {
    return placeFromUrl() || normalizePlace(readJson(PLACE_KEY)) || normalizePlace(DEFAULT_PLACE);
  }

  function resolveInitialUnit(place) {
    try {
      const saved = localStorage.getItem(UNIT_KEY);
      if (saved === 'f' || saved === 'c') return saved;
    } catch {
      /* storage can be disabled */
    }
    return place && place.country_code === 'US' ? 'f' : 'c';
  }

  function updateUrl() {
    if (!state.place) return;
    try {
      const url = new URL(location.href);
      url.searchParams.set('lat', state.place.latitude.toFixed(5));
      url.searchParams.set('lon', state.place.longitude.toFixed(5));
      url.searchParams.set('name', state.place.name);
      if (state.place.admin1) url.searchParams.set('region', state.place.admin1);
      else url.searchParams.delete('region');
      if (state.place.country) url.searchParams.set('country', state.place.country);
      else url.searchParams.delete('country');
      if (state.place.country_code) url.searchParams.set('cc', state.place.country_code);
      else url.searchParams.delete('cc');
      history.replaceState(null, '', url);
    } catch {
      /* ignore URL restrictions, e.g. some file:// contexts */
    }
  }

  function persistPlace() {
    if (state.place) writeJson(PLACE_KEY, state.place);
  }

  function announce(message) {
    if (!els.liveRegion) return;
    els.liveRegion.textContent = '';
    window.setTimeout(() => {
      els.liveRegion.textContent = message;
    }, 30);
  }

  function setStatus(message, options = {}) {
    if (!els.status) return;
    els.status.textContent = message || '';
    if (state.statusTimer) window.clearTimeout(state.statusTimer);
    if (message && !options.sticky) {
      state.statusTimer = window.setTimeout(() => {
        if (els.status.textContent === message) els.status.textContent = '';
      }, options.duration || 5500);
    }
  }

  /* ============================================================
     DOM cache
     ============================================================ */

  function cacheDom() {
    const ids = [
      'placeName', 'placeRegion', 'localTime', 'localLabel', 'temperatureBlock', 'temperature',
      'conditionIcon', 'conditionIconUse', 'condition', 'feels', 'todayRange', 'skyNote',
      'windArrow', 'windValue', 'windUnit', 'windDir', 'humidityValue', 'uvValue', 'uvLabel',
      'uvMarker', 'airFact', 'airLabel', 'airIconUse', 'airValue', 'airCategory', 'airFoot',
      'pressureText', 'pressureSub', 'visibilityText', 'visibilitySub', 'dewText', 'solarFigure',
      'solarLabel', 'daylightLeft', 'sunrise', 'sunset', 'solarTrack', 'solarTicks',
      'solarMarker', 'scrubHint', 'backToNow', 'previewLabel', 'chart', 'chartSvg',
      'chartEmpty', 'chartCrosshair', 'chartCursor', 'chartTooltip', 'tooltipTime',
      'tooltipTemp', 'tooltipCondition', 'tooltipMeta', 'nowcast', 'nowcastLabel',
      'nowcastTicks', 'nowcastMeta', 'weekList', 'refreshButton', 'updatedAt', 'status',
      'coords', 'locateButton', 'searchTrigger', 'searchDialog', 'searchClose', 'searchInput',
      'searchResults', 'searchEmpty', 'searchSuggestions', 'suggestions', 'searchLocate',
      'searchPulse', 'liveRegion', 'chartTable', 'skyFlash', 'skyCelestial', 'skyBolt',
      'boltPath', 'boltBranch', 'cursorGlow', 'atmosphere', 'skyLayerA', 'skyLayerB'
    ];
    for (const id of ids) els[id] = document.getElementById(id);
    els.skyLayers = Array.from(document.querySelectorAll('[data-sky]'));
    els.unitButtons = Array.from(document.querySelectorAll('.unit-toggle button'));
    els.chartCaption = els.chartTable ? els.chartTable.querySelector('caption') : null;
    if (!els.skyLayerA && els.skyLayers[0]) els.skyLayerA = els.skyLayers[0];
    if (!els.skyLayerB && els.skyLayers[1]) els.skyLayerB = els.skyLayers[1];
  }

  /* ============================================================
     Sky
     ============================================================ */

  function skyBackground(palette, glowX) {
    const alpha = palette.glowAlpha || .35;
    return [
      `radial-gradient(ellipse 62% 52% at ${glowX}% 94%, ${hexToRgba(palette.glow, alpha)} 0%, ${hexToRgba(palette.glow, alpha * .35)} 34%, transparent 70%)`,
      `radial-gradient(ellipse 125% 72% at 50% 106%, ${hexToRgba(palette.horizon, .38)} 0%, ${hexToRgba(palette.horizon, .08)} 54%, transparent 80%)`,
      `linear-gradient(180deg, ${palette.zenith} 0%, ${palette.mid} 54%, ${palette.horizon} 100%)`
    ].join(', ');
  }

  function paintSky(palette, glowX, options = {}) {
    if (!els.skyLayers || els.skyLayers.length < 2) return;
    const background = skyBackground(palette, glowX);
    if (options.immediate) {
      state.skyActive = 0;
      els.skyLayers[0].style.background = background;
      els.skyLayers[0].style.opacity = '1';
      els.skyLayers[0].style.zIndex = '1';
      els.skyLayers[1].style.background = background;
      els.skyLayers[1].style.opacity = '0';
      els.skyLayers[1].style.zIndex = '0';
      return;
    }

    const outgoing = els.skyLayers[state.skyActive];
    const incomingIndex = state.skyActive === 0 ? 1 : 0;
    const incoming = els.skyLayers[incomingIndex];
    const duration = options.fast ? '700ms' : '1600ms';
    incoming.style.transitionDuration = duration;
    outgoing.style.transitionDuration = duration;
    incoming.style.background = background;
    incoming.style.zIndex = '2';
    outgoing.style.zIndex = '1';
    // Force the incoming layer's current opacity to be committed before fading it in.
    void incoming.offsetWidth;
    incoming.style.opacity = '1';
    outgoing.style.opacity = '0';
    state.skyActive = incomingIndex;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', palette.zenith);
  }

  function introScene() {
    const palette = {
      zenith: '#050A12',
      mid: '#0B1620',
      horizon: '#1A3039',
      glow: '#7C98B0',
      glowAlpha: .28
    };
    paintSky(palette, 50, { immediate: true });
  }

  function applyScene(hour, options = {}) {
    const solar = getSolarInfo(hour.iso);
    let phase = solar.phase;
    let group = groupFor(hour.code);
    if (DEBUG_PHASE) phase = DEBUG_PHASE;
    if (DEBUG_THEME) group = DEBUG_THEME;

    const palette = paletteFor(group, phase);
    const glowX = clamp(14 + solar.progress * 72, 10, 90);
    const key = `${group}|${phase}|${Math.round(glowX)}|${palette.zenith}`;
    document.body.dataset.weather = group;
    document.body.dataset.phase = phase === 'night' ? 'night' : 'day';
    document.documentElement.style.setProperty('--glow-x', `${glowX}%`);

    if (key !== state.sceneKey) {
      paintSky(palette, glowX, { fast: Boolean(options.fast) });
      state.sceneKey = key;
    }

    particles.setTarget(particleTargets(group, phase, hour), { windSpeed: hour.windSpeed });
    updateCelestial(hour, group, phase);
    const storm = group === 'storm';
    if (storm !== state.lightningActive) {
      state.lightningActive = storm;
      scheduleLightning(storm);
    }
    return { group, phase, solar, palette, glowX };
  }

  function particleTargets(group, phase, hour) {
    const cloudCover = clamp((hour.cloudCover || 0) / 100, 0, 1);
    const targets = { rain: 0, snow: 0, stars: 0, clouds: .08, cloudDark: 0, fog: 0 };
    if (group === 'clear') {
      targets.clouds = .05 + cloudCover * .16;
      targets.cloudDark = 0;
      targets.stars = phase === 'night' ? clamp(1 - cloudCover * .85, .3, 1) : 0;
    } else if (group === 'partly') {
      targets.clouds = .34 + cloudCover * .36;
      targets.cloudDark = .06;
      targets.stars = phase === 'night' ? clamp(1 - cloudCover * .85, .12, .75) : 0;
    } else if (group === 'cloudy') {
      targets.clouds = .98;
      targets.cloudDark = .42;
      targets.stars = phase === 'night' ? .06 : 0;
    } else if (group === 'fog') {
      targets.clouds = .28;
      targets.cloudDark = .08;
      targets.fog = .95;
    } else if (group === 'drizzle') {
      targets.clouds = .82;
      targets.cloudDark = .66;
      targets.rain = .48;
    } else if (group === 'rain') {
      targets.clouds = 1;
      targets.cloudDark = .84;
      targets.rain = .75 + clamp((hour.precip || 0) / 8, 0, .25);
    } else if (group === 'snow') {
      targets.clouds = .74;
      targets.cloudDark = .18;
      targets.snow = .86;
    } else if (group === 'storm') {
      targets.clouds = 1;
      targets.cloudDark = 1;
      targets.rain = 1;
    }
    return targets;
  }

  function updateCelestial(hour, group, phase) {
    if (!els.skyCelestial) return;
    const solar = getSolarInfo(hour.iso);
    const visualPhase = phase || solar.phase;
    const moon = visualPhase === 'night';
    const compact = window.innerWidth <= 940;
    const progress = clamp(solar.progress, 0, 1);
    const x = (compact ? 13 : 9) + progress * (compact ? 74 : 82);
    const horizonTop = compact ? 28 : 37;
    const peak = compact ? 24 : 27;
    const y = horizonTop - Math.sin(progress * Math.PI) * peak;

    els.skyCelestial.style.left = `${x}%`;
    els.skyCelestial.style.top = `${y}%`;
    els.skyCelestial.classList.toggle('is-moon', moon);
    els.skyCelestial.classList.toggle('is-sun', !moon);
    els.skyCelestial.classList.toggle('is-golden', visualPhase === 'golden');

    const baseOpacity = {
      clear: .98,
      partly: .9,
      cloudy: .62,
      fog: .34,
      drizzle: .5,
      rain: .46,
      snow: .62,
      storm: .36
    }[group] ?? .9;
    const cloudDim = 1 - clamp((hour.cloudCover || 0) / 100, 0, 1) * .18;
    els.skyCelestial.style.opacity = String(baseOpacity * cloudDim);

    celestialPosition.xPct = x;
    celestialPosition.yPct = y;
    celestialPosition.isMoon = moon;
    celestialPosition.visible = true;
  }

  function strikeLightning() {
    if (!els.skyFlash || REDUCED_MQ.matches || SAVE_DATA) return;
    els.skyFlash.classList.remove('is-flashing');
    void els.skyFlash.offsetWidth;
    els.skyFlash.classList.add('is-flashing');

    if (!els.skyBolt || !els.boltPath || !els.boltBranch || Math.random() < .35) return;
    const points = [];
    let x = 90;
    for (let i = 0; i <= 6; i += 1) {
      if (i > 0) x = clamp(x + (Math.random() - .5) * 54, 20, 160);
      points.push([x, (420 / 6) * i]);
    }
    const main = `M ${points.map(point => `${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' L ')}`;
    els.boltPath.setAttribute('d', main);

    const branchStart = points[3];
    const branchMid = [
      clamp(branchStart[0] + (Math.random() > .5 ? 1 : -1) * (28 + Math.random() * 44), 10, 170),
      branchStart[1] + 34 + Math.random() * 50
    ];
    const branchEnd = [
      clamp(branchMid[0] + (Math.random() - .5) * 38, 10, 170),
      branchMid[1] + 26 + Math.random() * 46
    ];
    els.boltBranch.setAttribute('d',
      `M ${branchStart[0].toFixed(1)} ${branchStart[1].toFixed(1)} L ${branchMid[0].toFixed(1)} ${branchMid[1].toFixed(1)} L ${branchEnd[0].toFixed(1)} ${branchEnd[1].toFixed(1)}`
    );

    els.skyBolt.style.left = `${18 + Math.random() * 64}%`;
    els.skyBolt.style.top = `${4 + Math.random() * 9}%`;
    els.skyBolt.style.height = `${24 + Math.random() * 20}vh`;
    els.skyBolt.classList.remove('is-striking');
    void els.skyBolt.offsetWidth;
    els.skyBolt.classList.add('is-striking');
  }

  function scheduleLightning(active) {
    if (state.lightningTimer) window.clearTimeout(state.lightningTimer);
    state.lightningTimer = null;
    if (!active || REDUCED_MQ.matches || SAVE_DATA) return;
    const next = 7500 + Math.random() * 7500;
    state.lightningTimer = window.setTimeout(() => {
      if (document.body.dataset.weather !== 'storm') return;
      strikeLightning();
      scheduleLightning(active);
    }, next);
  }

  /* ============================================================
     Solar geometry
     ============================================================ */

  function sunEntries() {
    if (!state.weather || !state.weather.daily) return [];
    const daily = state.weather.daily;
    return daily.time.map((time, index) => ({
      date: time,
      sunrise: daily.sunrise ? daily.sunrise[index] : null,
      sunset: daily.sunset ? daily.sunset[index] : null
    })).filter(entry => entry.sunrise || entry.sunset);
  }

  function getSolarInfo(iso) {
    const fallbackHour = Number((iso || '').slice(11, 13));
    const fallbackNight = Number.isFinite(fallbackHour) && (fallbackHour < 6 || fallbackHour >= 18);
    const entries = sunEntries();
    if (!entries.length) {
      return { phase: fallbackNight ? 'night' : 'day', progress: fallbackNight ? .5 : .5, day: null, rise: null, set: null, nextRise: null };
    }

    const t = parseLocal(iso);
    const day = entries.find(entry => entry.date === iso.slice(0, 10)) || entries[0];
    const rise = parseLocal(day.sunrise);
    const set = parseLocal(day.sunset);
    const allSunrises = entries.map(entry => parseLocal(entry.sunrise)).filter(Number.isFinite).sort((a, b) => a - b);
    const allSunsets = entries.map(entry => parseLocal(entry.sunset)).filter(Number.isFinite).sort((a, b) => a - b);
    const nextRise = allSunrises.find(value => value > t) || t + 12 * 60 * 60 * 1000;
    const previousSunset = [...allSunsets].reverse().find(value => value <= t) || t - 12 * 60 * 60 * 1000;

    if (!Number.isFinite(t) || !Number.isFinite(rise) || !Number.isFinite(set)) {
      return { phase: fallbackNight ? 'night' : 'day', progress: fallbackNight ? .5 : .5, day, rise, set, nextRise };
    }

    const minute = 60 * 1000;
    const dawnStart = rise - 30 * minute;
    const morningEnd = rise + 45 * minute;
    const eveningStart = set - 45 * minute;
    const duskEnd = set + 30 * minute;

    let phase;
    if (t < dawnStart || t > duskEnd) phase = 'night';
    else if ((t >= dawnStart && t <= morningEnd) || (t >= eveningStart && t <= duskEnd)) phase = 'golden';
    else phase = 'day';

    let progress;
    if (phase === 'night') {
      const nightLength = Math.max(1, nextRise - previousSunset);
      progress = (t - previousSunset) / nightLength;
    } else {
      progress = (t - rise) / Math.max(1, set - rise);
    }

    return {
      phase,
      progress: clamp(progress, 0, 1),
      day,
      rise,
      set,
      nextRise,
      previousSunset
    };
  }

  function renderSolar(hour) {
    const solar = getSolarInfo(hour.iso);
    const night = solar.phase === 'night';
    const displayDay = solar.day;
    els.solarLabel.textContent = night ? 'Moon Path' : 'Sun Path';
    els.solarFigure.classList.toggle('is-night', night);

    if (displayDay) {
      els.sunrise.textContent = formatTimeIso(displayDay.sunrise, { minutes: true });
      els.sunset.textContent = formatTimeIso(displayDay.sunset, { minutes: true });
    } else {
      els.sunrise.textContent = '—';
      els.sunset.textContent = '—';
    }

    const t = parseLocal(hour.iso);
    if (night) {
      els.daylightLeft.textContent = `Sunrise in ${formatDuration(solar.nextRise - t)}`;
    } else {
      const left = Math.max(0, solar.set - t);
      els.daylightLeft.textContent = `${formatDuration(left)} of daylight`;
    }

    // Place the marker on the arc.
    try {
      const length = els.solarTrack.getTotalLength();
      const point = els.solarTrack.getPointAtLength(length * solar.progress);
      els.solarMarker.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
    } catch {
      /* SVG geometry is available after layout; it will correct on the next render */
    }
  }

  function buildSolarTicks() {
    if (!els.solarTrack || !els.solarTicks) return;
    els.solarTicks.innerHTML = '';
    try {
      const length = els.solarTrack.getTotalLength();
      for (let i = 0; i <= 12; i += 1) {
        const point = els.solarTrack.getPointAtLength((length * i) / 12);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', point.x.toFixed(2));
        circle.setAttribute('cy', point.y.toFixed(2));
        circle.setAttribute('r', i % 3 === 0 ? '1.35' : '.8');
        els.solarTicks.appendChild(circle);
      }
    } catch {
      /* Keep the arc usable even if geometry is temporarily unavailable. */
    }
  }

  /* ============================================================
     Data
     ============================================================ */

  function forecastParams(place) {
    return new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
        'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover',
        'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
      ].join(','),
      hourly: [
        'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
        'precipitation_probability', 'precipitation', 'weather_code', 'cloud_cover',
        'visibility', 'uv_index', 'wind_speed_10m', 'wind_direction_10m', 'is_day',
        'dew_point_2m', 'pressure_msl'
      ].join(','),
      daily: [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
        'daylight_duration', 'uv_index_max', 'precipitation_probability_max',
        'precipitation_sum', 'wind_speed_10m_max', 'wind_direction_10m_dominant'
      ].join(','),
      minutely_15: 'precipitation,weather_code',
      timezone: 'auto',
      past_days: '1',
      forecast_days: '7',
      temperature_unit: 'celsius',
      wind_speed_unit: 'ms',
      precipitation_unit: 'mm'
    });
  }

  async function fetchWeather(place, options = {}) {
    const isPlaceChange = Boolean(options.isPlaceChange);
    const isRefresh = Boolean(options.isRefresh);
    if (state.abort) state.abort.abort();
    const controller = new AbortController();
    state.abort = controller;
    state.loading = true;
    els.refreshButton.classList.add('is-refreshing');

    if (isPlaceChange) {
      setStatus(`Finding ${place.name}`);
    } else if (!state.weather) {
      els.updatedAt.textContent = 'Reading the sky';
      setStatus('Reading the sky');
    }

    const airPromise = fetchAir(place, controller.signal).catch(() => null);
    try {
      const response = await fetch(`${FORECAST_URL}?${forecastParams(place).toString()}`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Forecast request failed (${response.status})`);
      const weather = await response.json();
      if (controller.signal.aborted) return;
      if (!weather.current || !weather.hourly || !weather.daily) {
        throw new Error('The forecast response was incomplete');
      }

      const wasSamePlace = placesEqual(state.place, place);
      state.place = place;
      state.weather = weather;
      state.fetchedAt = Date.now();
      state.fromCache = false;
      state.loading = false;
      state.air = wasSamePlace ? state.air : null;
      if (!wasSamePlace) state.air = null;

      persistPlace();
      updateUrl();
      updatePlaceLabels();
      resetPreview();
      renderAll({ animate: isPlaceChange || isRefresh });
      saveCache();
      setStatus(isRefresh && !wasSamePlace ? '' : '');
      airPromise.then(air => {
        if (controller.signal.aborted || !air) return;
        state.air = air;
        saveCache();
        if (state.previewIndex == null && state.weather && state.chartHours[0]) {
          updateFacts(state.chartHours[0], false);
        }
      });
    } catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') return;
      console.error('[aer] weather fetch failed', error);
      const cache = readCacheForPlace(place);
      if (isPlaceChange) {
        setStatus(`Couldn’t reach ${place.name}`, { sticky: true });
        announce(`Could not load weather for ${place.name}. Still showing ${state.place ? state.place.name : 'the last location'}.`);
      } else if (state.weather) {
        setStatus('Couldn’t refresh · Last sky', { sticky: true });
      } else if (cache) {
        state.place = place;
        state.weather = cache.weather;
        state.air = cache.air;
        state.fetchedAt = cache.fetchedAt;
        state.fromCache = true;
        updatePlaceLabels();
        resetPreview();
        renderAll({ fromCache: true });
        setStatus('Offline · Last sky', { sticky: true });
        updateUrl();
      } else {
        showErrorState();
      }
    } finally {
      if (state.abort === controller) {
        state.loading = false;
        els.refreshButton.classList.remove('is-refreshing');
        if (!state.weather) setStatus('Weather unavailable', { sticky: true });
      }
    }
  }

  async function fetchAir(place, signal) {
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'us_aqi,european_aqi,pm2_5,pm10,ozone',
      timezone: 'auto'
    });
    const response = await fetch(`${AIR_URL}?${params.toString()}`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Air quality request failed (${response.status})`);
    return response.json();
  }

  function buildChartHours() {
    const data = state.weather;
    if (!data || !data.current || !data.hourly) return [];
    const { current, hourly } = data;
    const prefix = current.time.slice(0, 13);
    let start = hourly.time.findIndex(time => time.slice(0, 13) === prefix);
    if (start < 0) start = hourly.time.findIndex(time => time >= current.time);
    if (start < 0) start = 0;
    state.hourlyStart = start;

    const read = (field, index, fallback = null) => {
      const array = hourly[field];
      if (!Array.isArray(array)) return fallback;
      const value = array[index];
      return Number.isFinite(value) ? value : fallback;
    };

    const hours = [];
    for (let i = 0; i < 24; i += 1) {
      const index = start + i;
      if (index >= hourly.time.length) break;
      const isNow = i === 0;
      hours.push({
        iso: isNow ? current.time : hourly.time[index],
        isNow,
        temp: isNow ? current.temperature_2m : read('temperature_2m', index),
        apparent: isNow ? current.apparent_temperature : read('apparent_temperature', index),
        code: isNow ? current.weather_code : read('weather_code', index, 0),
        precipProb: isNow ? read('precipitation_probability', index, 0) : read('precipitation_probability', index, 0),
        precip: isNow ? current.precipitation : read('precipitation', index, 0),
        cloudCover: isNow ? current.cloud_cover : read('cloud_cover', index, 0),
        windSpeed: isNow ? current.wind_speed_10m : read('wind_speed_10m', index, 0),
        windDir: isNow ? current.wind_direction_10m : read('wind_direction_10m', index, 0),
        humidity: isNow ? current.relative_humidity_2m : read('relative_humidity_2m', index, null),
        uv: read('uv_index', index, 0),
        visibility: read('visibility', index, null),
        dew: read('dew_point_2m', index, null),
        pressure: isNow ? current.pressure_msl : read('pressure_msl', index, null),
        isDay: isNow ? current.is_day : read('is_day', index, 1)
      });
    }
    return hours;
  }

  function dayForIso(iso) {
    if (!state.weather || !state.weather.daily) return null;
    const daily = state.weather.daily;
    const date = iso.slice(0, 10);
    let index = daily.time.indexOf(date);
    if (index < 0) index = daily.time.findIndex(time => time >= date);
    if (index < 0) index = daily.time.length - 1;
    if (index < 0) return null;
    return {
      date: daily.time[index],
      code: daily.weather_code[index],
      max: daily.temperature_2m_max[index],
      min: daily.temperature_2m_min[index],
      sunrise: daily.sunrise ? daily.sunrise[index] : null,
      sunset: daily.sunset ? daily.sunset[index] : null,
      precipProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[index] : null
    };
  }

  function todayIndex() {
    if (!state.weather || !state.weather.daily) return 0;
    const currentDate = state.weather.current.time.slice(0, 10);
    const daily = state.weather.daily;
    let index = daily.time.indexOf(currentDate);
    if (index < 0) index = daily.time.findIndex(time => time >= currentDate);
    return index < 0 ? 0 : index;
  }

  /* ============================================================
     Rendering
     ============================================================ */

  function updatePlaceLabels() {
    if (!state.place) return;
    els.placeName.textContent = state.place.name;
    const region = state.place.admin1 && state.place.admin1 !== state.place.name ? state.place.admin1 : '';
    const country = state.place.country && state.place.country !== state.place.name ? state.place.country : '';
    els.placeRegion.textContent = region || country || '';
    els.placeRegion.hidden = !els.placeRegion.textContent;
    document.title = `${state.place.name} — Aer`;
    const lat = Math.abs(state.place.latitude).toFixed(2);
    const lon = Math.abs(state.place.longitude).toFixed(2);
    els.coords.textContent = `${lat}°${state.place.latitude >= 0 ? 'N' : 'S'} · ${lon}°${state.place.longitude >= 0 ? 'E' : 'W'}`;
    els.placeName.title = [state.place.name, state.place.admin1, state.place.country].filter(Boolean).join(', ');
  }

  function renderAll(options = {}) {
    if (!state.weather || !state.weather.current) return;
    state.chartHours = buildChartHours();
    if (!state.chartHours.length) {
      showErrorState();
      return;
    }
    updateLocalClock();
    const current = state.chartHours[0];
    renderConditions(current, { isPreview: false, animate: Boolean(options.animate) });
    const liveIso = liveLocalIso();
    const sceneHour = liveIso ? { ...current, iso: liveIso } : current;
    renderSolar(sceneHour);
    drawChart();
    renderWeek();
    renderChartTable();
    renderNowcast(current);
    applyScene(sceneHour, { fast: false });
    state.livePhase = getSolarInfo(sceneHour.iso).phase;
    els.updatedAt.textContent = `Updated ${formatTimeIso(state.weather.current.time, { minutes: true })}`;
    els.chart.dataset.empty = 'false';
    els.backToNow.hidden = true;
    els.scrubHint.hidden = false;
    els.chart.classList.remove('is-pinned', 'is-scrubbing');
    hideChartOverlay();
    document.body.classList.remove('is-booting');
    if (state.weather.current) {
      const temp = tempText(current.temp);
      document.title = `${temp} ${state.place.name} — Aer`;
    }
    announce(`${state.place.name}: ${weatherFor(current.code).label}, ${tempText(current.temp)}. ${buildNowNote()}`);
  }

  function renderConditions(hour, options = {}) {
    if (!hour) return;
    const temp = tempText(hour.temp);
    const temperatureChanged = els.temperature.textContent !== temp;
    if (temperatureChanged) {
      els.temperature.textContent = temp;
      if (options.animate && !REDUCED_MQ.matches) {
        els.temperatureBlock.classList.remove('is-rolling');
        void els.temperatureBlock.offsetWidth;
        els.temperatureBlock.classList.add('is-rolling');
      }
    }
    els.temperatureBlock.setAttribute('aria-label', `${tempValue(hour.temp)} degrees ${unitSymbol() === 'F' ? 'Fahrenheit' : 'Celsius'}`);

    els.condition.textContent = weatherFor(hour.code).label;
    if (els.conditionIconUse) {
      els.conditionIconUse.setAttribute('href', `#i-${iconFor(hour.code, hour.isDay)}`);
    }
    const feels = tempValue(hour.apparent);
    els.feels.textContent = feels == null ? '—' : `Feels like ${feels}°`;

    const day = dayForIso(hour.iso);
    if (day && Number.isFinite(day.max) && Number.isFinite(day.min)) {
      els.todayRange.textContent = `H ${tempValue(day.max)}°  L ${tempValue(day.min)}°`;
      els.todayRange.hidden = false;
    } else {
      els.todayRange.textContent = '';
      els.todayRange.hidden = true;
    }

    updateFacts(hour, options.isPreview);
    updateFineprint(hour, options.isPreview);
    els.skyNote.textContent = options.isPreview ? buildPreviewNote(hour) : buildNowNote();
    updateLocalLabel();
    updateClockInDom();
  }

  function updateFacts(hour, isPreview) {
    const speed = windSpeedText(hour.windSpeed);
    els.windValue.textContent = speed;
    els.windUnit.textContent = windSpeedUnit();
    els.windDir.textContent = `From ${directionLabel(hour.windDir)}`;
    els.windArrow.style.setProperty('--wind-rot', `${(Number(hour.windDir) || 0) + 90}deg`);
    els.humidityValue.textContent = Number.isFinite(hour.humidity) ? `${Math.round(hour.humidity)}%` : '—';
    els.uvValue.textContent = Number.isFinite(hour.uv) ? String(Math.round(hour.uv)) : '—';
    els.uvLabel.textContent = Number.isFinite(hour.uv) ? uvCategory(hour.uv) : '';
    if (els.uvMarker) {
      els.uvMarker.style.opacity = Number.isFinite(hour.uv) ? '1' : '0';
      els.uvMarker.style.left = `${clamp((Number(hour.uv) || 0) / 11, 0, 1) * 100}%`;
    }

    const aqi = state.air && state.air.current
      ? (Number.isFinite(state.air.current.us_aqi) ? state.air.current.us_aqi : state.air.current.european_aqi)
      : null;

    if (!isPreview && Number.isFinite(aqi)) {
      const category = aqiCategory(aqi);
      els.airLabel.textContent = 'Air Quality';
      els.airIconUse.setAttribute('href', '#i-leaf');
      els.airValue.textContent = String(Math.round(aqi));
      els.airCategory.textContent = category.label;
      els.airFoot.textContent = 'US AQI';
      els.airFact.classList.add('has-dot');
      els.airFact.style.setProperty('--air-tone', `var(--${category.tone === 'good' ? 'good' : category.tone === 'warn' ? 'warn' : 'bad'})`);
    } else {
      els.airLabel.textContent = 'Precipitation';
      els.airIconUse.setAttribute('href', '#i-droplet');
      els.airValue.textContent = `${Math.round(hour.precipProb || 0)}%`;
      els.airCategory.textContent = 'Chance';
      els.airFoot.textContent = isPreview ? 'Next hour' : 'Chance';
      els.airFact.classList.remove('has-dot');
      els.airFact.style.removeProperty('--air-tone');
    }
  }

  function pressureTrend(hour, isPreview) {
    if (isPreview || !state.weather || !state.weather.hourly || !Array.isArray(state.weather.hourly.pressure_msl)) return '';
    const index = state.hourlyStart;
    const now = state.weather.hourly.pressure_msl[index];
    const before = state.weather.hourly.pressure_msl[index - 3];
    if (!Number.isFinite(now) || !Number.isFinite(before)) return '';
    const change = now - before;
    if (change > 1) return 'rising';
    if (change < -1) return 'falling';
    return 'steady';
  }

  function visibilityMood(meters) {
    if (!Number.isFinite(meters)) return '—';
    if (meters >= 16000) return 'Clear';
    if (meters >= 8000) return 'Good';
    if (meters >= 2000) return 'Moderate';
    return 'Low';
  }

  function updateFineprint(hour, isPreview) {
    const pressure = hour.pressure;
    const trend = pressureTrend(hour, isPreview);
    els.pressureText.textContent = Number.isFinite(pressure) ? `${Math.round(pressure)} hPa` : '—';
    els.pressureSub.textContent = trend
      ? `${trend.charAt(0).toUpperCase()}${trend.slice(1)}`
      : isPreview ? '—' : 'Steady';
    els.visibilityText.textContent = visibilityText(hour.visibility);
    els.visibilitySub.textContent = visibilityMood(hour.visibility);
    els.dewText.textContent = Number.isFinite(hour.dew) ? `Dew point ${tempText(hour.dew)}` : '—';
  }

  function updateLocalClock() {
    els.localTime.textContent = formatClock();
    updateLocalLabel();
  }

  function liveLocalIso() {
    if (!state.weather) return null;
    const offset = Number.isFinite(state.weather.utc_offset_seconds) ? state.weather.utc_offset_seconds : 0;
    const local = new Date(Date.now() + offset * 1000);
    const pad = value => String(value).padStart(2, '0');
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  }

  function updateLiveSolar() {
    if (!state.weather || !state.chartHours.length || state.previewIndex != null) return;
    if (document.visibilityState !== 'visible') return;
    const iso = liveLocalIso();
    if (!iso) return;
    const current = state.chartHours[0];
    const liveHour = { ...current, iso };
    renderSolar(liveHour);
    const solar = getSolarInfo(iso);
    updateCelestial(liveHour, groupFor(current.code), solar.phase);
    if (state.livePhase && solar.phase !== state.livePhase) {
      state.livePhase = solar.phase;
      applyScene(liveHour, { fast: false });
    }
  }

  function updateLocalLabel() {
    if (!els.localLabel) return;
    els.localLabel.hidden = sameTimezone();
  }

  function updateClockInDom() {
    if (!els.localTime) return;
    els.localTime.textContent = formatClock();
  }

  function yesterdayDelta() {
    if (!state.weather || !state.weather.hourly) return null;
    const index = state.hourlyStart - 24;
    const previous = state.weather.hourly.temperature_2m ? state.weather.hourly.temperature_2m[index] : null;
    const current = state.weather.current ? state.weather.current.temperature_2m : null;
    if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
    const delta = tempDelta(current - previous);
    if (delta == null || Math.abs(delta) < 2) return null;
    return `${Math.abs(delta)}° ${delta > 0 ? 'warmer' : 'colder'} than this hour yesterday.`;
  }

  function nowcastWindow(minutes = 90) {
    const data = state.weather;
    if (!data || !data.minutely_15) return [];
    const nowIso = data.current.time;
    const nowMs = parseLocal(nowIso);
    const times = data.minutely_15.time || [];
    const precip = data.minutely_15.precipitation || [];
    const entries = [];
    for (let i = 0; i < times.length; i += 1) {
      const t = parseLocal(times[i]);
      if (!Number.isFinite(t)) continue;
      if (t < nowMs - 15 * 60 * 1000) continue;
      if (t > nowMs + minutes * 60 * 1000) break;
      entries.push({ iso: times[i], precip: Number.isFinite(precip[i]) ? precip[i] : 0 });
    }
    return entries;
  }

  function nextWetHourly() {
    if (!state.weather || !state.weather.hourly) return null;
    const hourly = state.weather.hourly;
    const current = state.weather.current;
    for (let i = 0; i < hourly.time.length; i += 1) {
      if (hourly.time[i] < current.time) continue;
      const diff = parseLocal(hourly.time[i]) - parseLocal(current.time);
      if (diff > 8 * 60 * 60 * 1000) break;
      const probability = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
      if (probability >= 40) {
        return { iso: hourly.time[i], probability };
      }
    }
    return null;
  }

  function buildNowNote() {
    const data = state.weather;
    if (!data || !data.current) return 'Connecting to the weather service.';
    const group = groupFor(data.current.weather_code);
    const currentWet = (data.current.precipitation || 0) > .02;
    const word = precipWord(group, data.current.temperature_2m);
    const window = nowcastWindow(90);
    let primary = '';

    if (currentWet) {
      const firstDry = window.find(entry => entry.precip <= .02 && parseLocal(entry.iso) > parseLocal(data.current.time));
      if (firstDry) {
        primary = `${word} eases by ${formatTimeIso(firstDry.iso, { minutes: true })}.`;
      } else {
        primary = `${word} holds through the next hour.`;
      }
    } else {
      const firstWet = window.find(entry => entry.precip > .03);
      if (firstWet) {
        const minutes = Math.max(5, Math.round((parseLocal(firstWet.iso) - parseLocal(data.current.time)) / 60000 / 5) * 5);
        primary = minutes >= 45 ? `${word} within the hour.` : `${word} in ${minutes} min.`;
      } else {
        const likely = nextWetHourly();
        if (likely) {
          primary = `Dry until ${formatTimeIso(likely.iso, { minutes: true })}.`;
        } else {
          primary = conditionSentence(group, data.current, data.current.is_day);
        }
      }
    }

    const delta = yesterdayDelta();
    if (primary && delta) return `${primary} ${delta}`;
    return primary || delta || 'Conditions are steady.';
  }

  function conditionSentence(group, current, isDay) {
    const night = !isDay;
    if (group === 'clear') {
      return night ? 'Clear skies through the night.' : 'Clear and bright.';
    }
    if (group === 'partly') {
      return night ? 'A few clouds under a bright moon.' : 'A few clouds and a light wind.';
    }
    if (group === 'cloudy') return night ? 'Cloud cover holds overnight.' : 'Cloud cover holds.';
    if (group === 'fog') return 'Fog holds with low visibility.';
    if (group === 'drizzle') return 'Light drizzle at times.';
    if (group === 'snow') return 'Snow continues at times.';
    if (group === 'storm') return 'Thunderstorms nearby.';
    if (group === 'rain') return 'Rain continues at times.';
    return 'Conditions are steady.';
  }

  function buildPreviewNote(hour) {
    const label = weatherFor(hour.code).label;
    const temp = tempText(hour.temp);
    const moment = formatTimeIso(hour.iso, { minutes: true });
    const mood = windMood(hour.windSpeed);
    const direction = directionLabel(hour.windDir);
    const precipitation = Math.round(hour.precipProb || 0);
    const base = `At ${moment}: ${label}, ${temp}, with a ${mood} ${direction} wind.`;
    if (precipitation >= 30) return `${base} ${precipitation}% chance of precipitation.`;
    return base;
  }

  function renderNowcast(hour) {
    if (!state.weather || hour !== state.chartHours[0]) {
      els.nowcast.hidden = true;
      return;
    }
    const data = state.weather;
    const window = nowcastWindow(60).filter(entry => parseLocal(entry.iso) >= parseLocal(data.current.time));
    const currentWet = (data.current.precipitation || 0) > .02;
    const firstWet = window.find(entry => entry.precip > .03);
    if (!currentWet && !firstWet) {
      els.nowcast.hidden = true;
      return;
    }

    const group = groupFor(data.current.weather_code);
    const word = precipWord(group, data.current.temperature_2m);
    const ticks = window.slice(0, 4);
    els.nowcast.hidden = false;
    els.nowcastLabel.textContent = currentWet ? `${word} now` : `${word} soon`;
    els.nowcastTicks.innerHTML = '';
    for (const entry of ticks) {
      const wet = entry.precip > .03;
      const bar = document.createElement('span');
      bar.className = `nowcast__tick${wet ? ' is-wet' : ''}`;
      bar.style.setProperty('--h', `${wet ? 7 + Math.min(8, Math.round(entry.precip * 8)) : 3}px`);
      bar.title = `${formatTimeIso(entry.iso, { minutes: true })} · ${entry.precip.toFixed(2)} mm`;
      els.nowcastTicks.appendChild(bar);
    }
    if (currentWet) {
      const firstDry = window.find(entry => entry.precip <= .02 && parseLocal(entry.iso) > parseLocal(data.current.time));
      els.nowcastMeta.textContent = firstDry ? `Eases ${formatTimeIso(firstDry.iso, { minutes: true })}` : 'Next 60 min';
    } else if (firstWet) {
      els.nowcastMeta.textContent = `Begins ${formatTimeIso(firstWet.iso, { minutes: true })}`;
    } else {
      els.nowcastMeta.textContent = 'Next 60 min';
    }
  }

  /* ============================================================
     Chart
     ============================================================ */

  function smoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function drawChart() {
    if (!state.chartHours.length || !els.chart) return;
    const width = els.chart.clientWidth;
    const height = els.chart.clientHeight;
    if (width < 30 || height < 30) return;
    state.chartNeedsDraw = false;

    const padX = 5;
    const top = 18;
    const bottom = 27;
    const axisWidth = width < 520 ? 28 : 34;
    const plotRight = width - axisWidth;
    const plotBottom = height - bottom;
    const plotTop = top;
    const plotHeight = Math.max(10, plotBottom - plotTop);
    const hours = state.chartHours;
    const temps = hours.map(hour => hour.temp).filter(Number.isFinite);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const spread = Math.max(2, maxTemp - minTemp);
    const yMin = minTemp - spread * .24;
    const yMax = maxTemp + spread * .24;
    const step = hours.length > 1 ? (plotRight - padX) / (hours.length - 1) : 0;

    const points = hours.map((hour, index) => ({
      x: padX + step * index,
      y: plotTop + (1 - ((hour.temp - yMin) / (yMax - yMin))) * plotHeight,
      hour
    }));

    const line = smoothPath(points);
    const area = points.length
      ? `${line} L ${points[points.length - 1].x.toFixed(2)} ${plotBottom} L ${points[0].x.toFixed(2)} ${plotBottom} Z`
      : '';

    const labelStep = width < 500 ? 6 : 3;
    let labels = '';
    for (let i = 0; i < hours.length; i += labelStep) {
      const isFirst = i === 0;
      const isLast = i === hours.length - 1;
      const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
      const x = points[i].x + (isFirst ? 1 : isLast ? -1 : 0);
      const label = isFirst ? 'Now' : formatTimeIso(hours[i].iso, { minutes: false });
      labels += `<text class="chart-label${isFirst ? ' chart-label--now' : ''}" x="${x.toFixed(1)}" y="${height - 7}" text-anchor="${anchor}">${label}</text>`;
    }
    if ((hours.length - 1) % labelStep !== 0) {
      const i = hours.length - 1;
      labels += `<text class="chart-label" x="${(points[i].x - 1).toFixed(1)}" y="${height - 7}" text-anchor="end">${formatTimeIso(hours[i].iso, { minutes: false })}</text>`;
    }

    let precip = '';
    for (let i = 0; i < hours.length; i += 1) {
      const probability = clamp(Number(hours[i].precipProb) || 0, 0, 100);
      if (probability <= 1) continue;
      const barHeight = Math.max(1, (probability / 100) * 19);
      const barWidth = Math.max(2.5, step * .3);
      const x = clamp(points[i].x - barWidth / 2, padX, plotRight - barWidth);
      precip += `<rect class="chart-precip${probability >= 50 ? ' chart-precip--likely' : ''}" x="${x.toFixed(1)}" y="${(plotBottom - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="1"></rect>`;
    }

    let dots = '';
    for (let i = 0; i < points.length; i += 3) {
      dots += `<circle class="chart-dot" cx="${points[i].x.toFixed(1)}" cy="${points[i].y.toFixed(1)}" r="1.45"></circle>`;
    }

    const gridRatios = [0.25, 0.5, 0.75];
    const grid = gridRatios
      .map(ratio => `<line class="chart-grid" x1="${padX}" x2="${plotRight}" y1="${(plotTop + plotHeight * ratio).toFixed(1)}" y2="${(plotTop + plotHeight * ratio).toFixed(1)}"></line>`)
      .join('');

    const axisSeen = new Set();
    const axisLabels = [];
    for (const ratio of gridRatios) {
      const y = plotTop + plotHeight * ratio;
      const displayValue = tempValue(yMax - (yMax - yMin) * ratio);
      if (displayValue == null || axisSeen.has(displayValue)) continue;
      axisSeen.add(displayValue);
      axisLabels.push({ y, label: `${displayValue}°` });
    }
    const axis = `
      <line class="chart-axis-line" x1="${plotRight}" x2="${plotRight}" y1="${plotTop}" y2="${plotBottom}"></line>
      ${axisLabels.map(item => `
        <line class="chart-axis-tick" x1="${plotRight}" x2="${plotRight + 4}" y1="${item.y.toFixed(1)}" y2="${item.y.toFixed(1)}"></line>
        <text class="chart-axis-label" x="${width - 3}" y="${(item.y + 3.2).toFixed(1)}" text-anchor="end">${item.label}</text>
      `).join('')}
    `;

    const nowTemp = tempText(hours[0].temp);
    const badgeW = Math.max(30, 11 + nowTemp.length * 6.4);
    const badgeH = 17;
    let badgeX = points[0].x + 8;
    let badgeY = points[0].y - badgeH - 6;
    if (badgeY < plotTop) badgeY = points[0].y + 7;
    if (badgeX + badgeW > plotRight - 2) badgeX = points[0].x - badgeW - 8;
    const badgeCX = badgeX + badgeW / 2;
    const badgeCY = badgeY + badgeH / 2;
    const nowBadge = `
      <g class="chart-now-badge">
        <rect x="${badgeX.toFixed(1)}" y="${badgeY.toFixed(1)}" width="${badgeW.toFixed(1)}" height="${badgeH}" rx="8.5"></rect>
        <text x="${badgeCX.toFixed(1)}" y="${(badgeCY + 3.4).toFixed(1)}" text-anchor="middle">${nowTemp}</text>
      </g>
    `;

    els.chartSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    els.chartSvg.innerHTML = `
      <defs>
        <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".17"></stop>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${grid}
      ${axis}
      ${precip}
      <path d="${area}" fill="url(#chartAreaGradient)"></path>
      <path d="${line}" class="chart-line"></path>
      <line class="chart-now-line" x1="${points[0].x.toFixed(1)}" x2="${points[0].x.toFixed(1)}" y1="${plotTop - 5}" y2="${plotBottom}"></line>
      ${dots}
      <circle class="chart-now-dot" cx="${points[0].x.toFixed(1)}" cy="${points[0].y.toFixed(1)}" r="2.6"></circle>
      ${nowBadge}
      ${labels}
    `;

    state.chartGeom = { width, height, points, plotBottom, padX, plotRight, axisWidth };
    els.chart.dataset.empty = 'false';

    const minLabel = tempText(minTemp);
    const maxLabel = tempText(maxTemp);
    const nowLabel = weatherFor(state.chartHours[0].code).label;
    els.chart.setAttribute('aria-label', `24 hour forecast for ${state.place.name}. Low ${minLabel}, high ${maxLabel}. Now ${nowLabel}, ${tempText(state.chartHours[0].temp)}. Drag to preview the sky, or use the arrow keys while focused.`);

    if (state.previewIndex != null) {
      positionChartOverlay(state.previewIndex);
    }
  }

  function indexFromPointer(clientX) {
    if (!state.chartGeom || !state.chartGeom.points.length) return null;
    const rect = els.chart.getBoundingClientRect();
    const relative = clamp(clientX - rect.left, 0, state.chartGeom.width);
    let nearest = 0;
    let distance = Infinity;
    state.chartGeom.points.forEach((point, index) => {
      const d = Math.abs(point.x - relative);
      if (d < distance) {
        distance = d;
        nearest = index;
      }
    });
    return nearest;
  }

  function showChartOverlay(index, options = {}) {
    if (!state.chartGeom || !state.chartGeom.points[index]) return;
    const point = state.chartGeom.points[index];
    const hour = point.hour;
    const width = state.chartGeom.width;
    const height = state.chartGeom.height;
    els.chartCrosshair.hidden = false;
    els.chartCursor.hidden = false;
    els.chartCrosshair.style.left = `${point.x}px`;
    els.chartCursor.style.left = `${point.x}px`;
    els.chartCursor.style.top = `${point.y}px`;
    if (options.tooltip !== false) {
      const left = clamp(point.x, 68, width - 68);
      const top = clamp(point.y - 12, 106, height - 8);
      els.chartTooltip.style.left = `${left}px`;
      els.chartTooltip.style.top = `${top}px`;
      els.tooltipTime.textContent = hour.isNow ? 'Now' : previewMoment(hour.iso);
      els.tooltipTemp.textContent = tempText(hour.temp);
      els.tooltipCondition.textContent = weatherFor(hour.code).label;
      els.tooltipMeta.textContent = `${Math.round(hour.precipProb || 0)}% rain · ${windSpeedText(hour.windSpeed)} ${windSpeedUnit()}`;
      els.chartTooltip.hidden = false;
    }
  }

  function positionChartOverlay(index) {
    showChartOverlay(index, { tooltip: true });
  }

  function hideChartOverlay() {
    if (!els.chartCrosshair) return;
    els.chartCrosshair.hidden = true;
    els.chartCursor.hidden = true;
    els.chartTooltip.hidden = true;
    state.hoverIndex = null;
  }

  /* ============================================================
     Week
     ============================================================ */

  function renderWeek() {
    if (!state.weather || !state.weather.daily) return;
    const daily = state.weather.daily;
    const start = todayIndex();
    const days = daily.time.slice(start, start + 7).map((time, offset) => {
      const index = start + offset;
      return {
        time,
        code: daily.weather_code[index],
        max: daily.temperature_2m_max[index],
        min: daily.temperature_2m_min[index],
        precip: daily.precipitation_probability_max ? daily.precipitation_probability_max[index] : null
      };
    });
    if (!days.length) {
      els.weekList.innerHTML = '';
      return;
    }

    const allMin = Math.min(...days.map(day => day.min).filter(Number.isFinite));
    const allMax = Math.max(...days.map(day => day.max).filter(Number.isFinite));
    const scaleMin = allMin - 1;
    const scaleMax = allMax + 1;
    const scale = Math.max(1, scaleMax - scaleMin);

    els.weekList.innerHTML = '';
    days.forEach((day, index) => {
      const li = document.createElement('li');
      li.className = `day-row${index === 0 ? ' is-today' : ''}`;
      const dayLabel = index === 0 ? 'Today' : formatWeekday(day.time);
      const low = tempValue(day.min);
      const high = tempValue(day.max);
      const left = ((day.min - scaleMin) / scale) * 100;
      const right = ((day.max - scaleMin) / scale) * 100;
      const widthPercent = Math.max(6, right - left);
      const precip = Number.isFinite(day.precip) && day.precip >= 5 ? `${Math.round(day.precip)}%` : '—';
      const condition = weatherFor(day.code).label;

      li.setAttribute('aria-label', `${index === 0 ? 'Today' : formatWeekday(day.time)}: ${condition}. Low ${low} degrees, high ${high} degrees. ${precip} chance of precipitation.`);
      li.innerHTML = `
        <span class="day-row__day">${dayLabel}</span>
        <span class="day-row__icon"><svg class="wx-icon" aria-hidden="true"><use href="#i-${iconFor(day.code, 1)}"></use></svg></span>
        <span class="day-row__precip">${precip}</span>
        <span class="day-row__range" aria-hidden="true">
          <span class="range__track"></span>
          <span class="range__edge" style="left:${left.toFixed(1)}%"></span>
          <span class="range__edge" style="left:${Math.min(100, left + widthPercent).toFixed(1)}%"></span>
          <span class="range__fill" style="left:${left.toFixed(1)}%;width:${widthPercent.toFixed(1)}%"></span>
        </span>
        <span class="day-row__temps"><span class="day-row__lo">${low}°</span><span class="day-row__hi">${high}°</span></span>
      `;
      els.weekList.appendChild(li);
    });
  }

  function renderChartTable() {
    if (!state.chartHours.length || !els.chartTable) return;
    const tbody = els.chartTable.querySelector('tbody');
    if (!tbody) return;
    if (els.chartCaption) els.chartCaption.textContent = `24 hour forecast for ${state.place.name}`;
    tbody.innerHTML = '';
    for (const hour of state.chartHours) {
      const tr = document.createElement('tr');
      const values = [
        hour.isNow ? 'Now' : formatTimeIso(hour.iso, { minutes: true }),
        tempText(hour.temp),
        weatherFor(hour.code).label,
        `${Math.round(hour.precipProb || 0)}%`
      ];
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  /* ============================================================
     Preview / chart interaction
     ============================================================ */

  function setPreview(index, options = {}) {
    if (!state.chartHours.length) return;
    const safeIndex = clamp(Number(index), 0, state.chartHours.length - 1);
    if (!Number.isFinite(safeIndex)) return;
    if (options.pin) {
      state.pinned = true;
    } else if (options.scrub) {
      state.pinned = false;
    }
    if (state.previewClearTimer) {
      window.clearTimeout(state.previewClearTimer);
      state.previewClearTimer = null;
    }
    state.previewIndex = safeIndex;
    const hour = state.chartHours[safeIndex];
    els.backToNow.hidden = false;
    els.scrubHint.hidden = true;
    els.previewLabel.textContent = hour.isNow ? 'Viewing Now' : `Viewing ${previewMoment(hour.iso)}`;
    els.chart.classList.toggle('is-pinned', state.pinned);
    els.nowcast.hidden = true;
    renderConditions(hour, { isPreview: true, animate: false });
    renderSolar(hour);
    applyScene(hour, { fast: true });
    positionChartOverlay(safeIndex);
    if (options.pin) {
      announce(`${hour.isNow ? 'Now' : previewMoment(hour.iso)}: ${weatherFor(hour.code).label}, ${tempText(hour.temp)}, ${Math.round(hour.precipProb || 0)} percent chance of precipitation.`);
    }
  }

  function clearPreview(options = {}) {
    if (state.previewClearTimer) {
      window.clearTimeout(state.previewClearTimer);
      state.previewClearTimer = null;
    }
    const wasPreviewing = state.previewIndex != null;
    state.previewIndex = null;
    state.pinned = false;
    state.hoverIndex = null;
    els.backToNow.hidden = true;
    els.scrubHint.hidden = false;
    els.chart.classList.remove('is-pinned', 'is-scrubbing');
    hideChartOverlay();
    if (state.chartHours.length) {
      const current = state.chartHours[0];
      const liveIso = liveLocalIso();
      const sceneHour = liveIso ? { ...current, iso: liveIso } : current;
      renderConditions(current, { isPreview: false, animate: false });
      renderSolar(sceneHour);
      applyScene(sceneHour, { fast: false });
      state.livePhase = getSolarInfo(sceneHour.iso).phase;
      renderNowcast(current);
    }
    if (wasPreviewing && !options.silent) announce('Showing current conditions.');
  }

  function schedulePreviewClear(minutes = 450) {
    if (state.previewClearTimer) window.clearTimeout(state.previewClearTimer);
    state.previewClearTimer = window.setTimeout(() => {
      state.previewClearTimer = null;
      if (!state.pinned) clearPreview();
    }, minutes);
  }

  function resetPreview() {
    if (state.previewClearTimer) {
      window.clearTimeout(state.previewClearTimer);
      state.previewClearTimer = null;
    }
    state.previewIndex = null;
    state.pinned = false;
    els.backToNow.hidden = true;
    els.scrubHint.hidden = false;
    els.chart.classList.remove('is-pinned', 'is-scrubbing');
    hideChartOverlay();
  }

  function handleChartKeydown(event) {
    if (!state.chartHours.length) return;
    const current = state.previewIndex == null ? 0 : state.previewIndex;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = clamp(current + 1, 0, state.chartHours.length - 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = clamp(current - 1, 0, state.chartHours.length - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = state.chartHours.length - 1;
    else if (event.key === 'Escape') {
      clearPreview();
      return;
    }
    if (next == null) return;
    event.preventDefault();
    setPreview(next, { pin: true });
  }

  function setupChartEvents() {
    let drag = null;
    els.chart.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!state.chartHours.length) return;
      event.preventDefault();
      drag = { startX: event.clientX, startY: event.clientY, moved: false, pointerId: event.pointerId };
      els.chart.setPointerCapture(event.pointerId);
      els.chart.classList.add('is-scrubbing');
      const index = indexFromPointer(event.clientX);
      if (index != null) setPreview(index, { scrub: true });
    });

    els.chart.addEventListener('pointermove', event => {
      if (!state.chartHours.length) return;
      const index = indexFromPointer(event.clientX);
      if (index == null) return;
      if (drag) {
        if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) drag.moved = true;
        if (state.previewIndex !== index) setPreview(index, { scrub: true });
      } else if (state.previewIndex == null) {
        state.hoverIndex = index;
        showChartOverlay(index, { tooltip: true });
      }
    });

    const finishDrag = (event) => {
      if (!drag) return;
      const moved = drag.moved;
      const pointerId = drag.pointerId;
      drag = null;
      els.chart.classList.remove('is-scrubbing');
      try { els.chart.releasePointerCapture(pointerId); } catch { /* noop */ }
      if (!state.chartHours.length) return;
      if (moved) {
        schedulePreviewClear(450);
      } else if (state.previewIndex != null) {
        setPreview(state.previewIndex, { pin: true });
      }
    };

    els.chart.addEventListener('pointerup', finishDrag);
    els.chart.addEventListener('pointercancel', () => {
      drag = null;
      els.chart.classList.remove('is-scrubbing');
      schedulePreviewClear(0);
    });
    els.chart.addEventListener('pointerleave', () => {
      if (drag) return;
      if (state.previewIndex == null) hideChartOverlay();
    });
    els.chart.addEventListener('keydown', handleChartKeydown);
    els.chart.addEventListener('blur', () => {
      if (state.previewIndex == null && state.hoverIndex == null) hideChartOverlay();
    });
  }

  /* ============================================================
     Particles
     ============================================================ */

  const particles = (() => {
    const canvas = document.getElementById('atmosphere');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = false;
    let raf = null;
    let lastTime = 0;
    let wind = 0;
    let amounts = { rain: 0, snow: 0, stars: 0, clouds: 0, cloudDark: 0, fog: 0 };
    let targets = { rain: 0, snow: 0, stars: 0, clouds: 0, cloudDark: 0, fog: 0 };
    let rainDrops = [];
    let snowFlakes = [];
    let starField = [];
    let cloudField = [];
    let cloudSprites = [];
    let darkCloudSprites = [];
    let fogSprites = [];
    let modeDisabled = false;

    function random(min, max) { return min + Math.random() * (max - min); }

    function makeCloudSprite(seed, dark = false) {
      const sprite = document.createElement('canvas');
      sprite.width = 700;
      sprite.height = 260;
      const c = sprite.getContext('2d');
      const blobs = [
        { x: .25, y: .58, r: .28, a: .14 },
        { x: .46, y: .44, r: .3, a: .15 },
        { x: .66, y: .55, r: .3, a: .13 },
        { x: .53, y: .66, r: .38, a: .11 },
        { x: .82, y: .65, r: .2, a: .1 }
      ];
      for (const blob of blobs) {
        const cx = sprite.width * blob.x;
        const cy = sprite.height * blob.y;
        const radius = sprite.width * blob.r;
        const gradient = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
        if (dark) {
          gradient.addColorStop(0, `rgba(96, 115, 136, ${blob.a * (seed ? 1.15 : .98)})`);
          gradient.addColorStop(.48, `rgba(69, 87, 107, ${blob.a * .72})`);
          gradient.addColorStop(1, 'rgba(48, 64, 82, 0)');
        } else {
          gradient.addColorStop(0, `rgba(220, 229, 224, ${blob.a * (seed ? 1.08 : .9)})`);
          gradient.addColorStop(.45, `rgba(204, 218, 214, ${blob.a * .55})`);
          gradient.addColorStop(1, 'rgba(190, 206, 204, 0)');
        }
        c.save();
        c.translate(cx, cy);
        c.scale(1, .54);
        c.beginPath();
        c.arc(0, 0, radius, 0, Math.PI * 2);
        c.fillStyle = gradient;
        c.fill();
        c.restore();
      }
      return sprite;
    }

    function makeFogSprite(seed) {
      const sprite = document.createElement('canvas');
      sprite.width = 1100;
      sprite.height = 300;
      const c = sprite.getContext('2d');
      for (let i = 0; i < 4; i += 1) {
        const cx = sprite.width * (.18 + i * .22 + (seed ? .03 : 0));
        const cy = sprite.height * (.48 + (i % 2) * .1);
        const radius = sprite.width * (.28 + (i % 2) * .06);
        const gradient = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(222, 227, 218, .09)');
        gradient.addColorStop(.5, 'rgba(208, 218, 214, .05)');
        gradient.addColorStop(1, 'rgba(202, 214, 212, 0)');
        c.save();
        c.translate(cx, cy);
        c.scale(1.5, .25);
        c.beginPath();
        c.arc(0, 0, radius, 0, Math.PI * 2);
        c.fillStyle = gradient;
        c.fill();
        c.restore();
      }
      return sprite;
    }

    function createSprites() {
      if (cloudSprites.length) return;
      cloudSprites = [makeCloudSprite(0), makeCloudSprite(1), makeCloudSprite(2)];
      darkCloudSprites = [makeCloudSprite(0, true), makeCloudSprite(1, true), makeCloudSprite(2, true)];
      fogSprites = [makeFogSprite(0), makeFogSprite(1)];
    }

    function seedScene() {
      const rainCount = Math.round(clamp(width / 6, 120, 260));
      rainDrops = Array.from({ length: rainCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: random(8, 20),
        speed: random(460, 1020),
        alpha: random(.16, .4),
        width: random(.5, 1.15)
      }));
      const snowCount = Math.round(clamp(width / 14, 45, 110));
      snowFlakes = Array.from({ length: snowCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: random(.7, 2.25),
        speed: random(10, 38),
        sway: random(0, Math.PI * 2),
        swaySpeed: random(.25, .8),
        alpha: random(.25, .72)
      }));
      starField = Array.from({ length: Math.round(clamp(width / 11, 80, 150)) }, () => ({
        x: Math.random() * width,
        y: random(.02, .67) * height,
        r: random(.4, 1.35),
        phase: random(0, Math.PI * 2),
        speed: random(.25, 1.5),
        alpha: random(.25, .9),
        bright: Math.random() > .88
      }));
      cloudField = Array.from({ length: 10 }, (_, index) => ({
        sprite: index % cloudSprites.length,
        x: Math.random() * width,
        y: random(.05, .52) * height,
        scale: random(.45, 1.05),
        speed: random(5, 14),
        depth: random(.35, 1),
        alpha: random(.56, .94)
      }));
    }

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createSprites();
      seedScene();
      if (!running && !modeDisabled) start();
    }

    function ease(current, target, dt, speed) {
      return current + (target - current) * (1 - Math.exp(-dt * speed));
    }

    function allIdle() {
      return amounts.rain < .003 && amounts.snow < .003 && amounts.stars < .003 && amounts.clouds < .003 && amounts.cloudDark < .003 && amounts.fog < .003 &&
        targets.rain < .003 && targets.snow < .003 && targets.stars < .003 && targets.clouds < .003 && targets.cloudDark < .003 && targets.fog < .003;
    }

    function drawClouds(time) {
      if (amounts.clouds < .003) return;
      const dark = clamp(amounts.cloudDark, 0, 1);
      const light = 1 - dark;
      for (const cloud of cloudField) {
        const lightSprite = cloudSprites[cloud.sprite];
        const darkSprite = darkCloudSprites[cloud.sprite];
        const sprite = dark > .5 ? (darkSprite || lightSprite) : (lightSprite || darkSprite);
        if (!sprite) continue;
        const w = sprite.width * cloud.scale;
        const h = sprite.height * cloud.scale;
        const drift = cloud.x + time * cloud.speed * cloud.depth * .001;
        const wrappedX = ((drift % (width + w * 1.4)) + width + w * 1.4) % (width + w * 1.4) - w * .8;
        const parallax = pointer.nx * 9 * cloud.depth;
        const baseAlpha = amounts.clouds * cloud.alpha;
        if (lightSprite && light > .01) {
          ctx.globalAlpha = baseAlpha * light;
          ctx.drawImage(lightSprite, wrappedX + parallax * .7, cloud.y, w, h);
        }
        if (darkSprite && dark > .01) {
          ctx.globalAlpha = baseAlpha * dark;
          ctx.drawImage(darkSprite, wrappedX + parallax, cloud.y, w, h);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawFog(time) {
      if (amounts.fog < .003) return;
      for (let i = 0; i < fogSprites.length; i += 1) {
        const sprite = fogSprites[i];
        const w = width * (1.25 + i * .16);
        const h = sprite.height * .9;
        const drift = (time * (2.2 + i * .7) * .001 + i * 240) % (w * .7);
        ctx.globalAlpha = amounts.fog * (i === 0 ? .68 : .42);
        ctx.drawImage(sprite, -w * .15 + drift * .12, height * (.47 + i * .1), w, h);
      }
      ctx.globalAlpha = 1;
    }

    function drawStars(time) {
      if (amounts.stars < .003) return;
      const moonVisible = celestialPosition.isMoon && celestialPosition.visible;
      const moonX = (celestialPosition.xPct / 100) * width;
      const moonY = (celestialPosition.yPct / 100) * height;
      const moonRadius = Math.max(34, Math.min(width, height) * .075);
      for (const star of starField) {
        if (moonVisible) {
          const dx = star.x - moonX;
          const dy = star.y - moonY;
          if (dx * dx + dy * dy < (moonRadius + 6) * (moonRadius + 6)) continue;
        }
        const twinkle = .52 + .48 * Math.sin(time * .001 * star.speed + star.phase);
        ctx.globalAlpha = amounts.stars * star.alpha * twinkle;
        ctx.fillStyle = '#EAF1EF';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
        if (star.bright && amounts.stars > .3) {
          ctx.globalAlpha = amounts.stars * star.alpha * twinkle * .28;
          ctx.fillRect(star.x - 2.2, star.y - .35, 4.4, .7);
          ctx.fillRect(star.x - .35, star.y - 2.2, .7, 4.4);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawRain(dt) {
      if (amounts.rain < .003) return;
      const slant = clamp(wind / 26, -.38, .38);
      for (const drop of rainDrops) {
        drop.y += drop.speed * dt;
        drop.x += drop.speed * slant * dt;
        if (drop.y > height + 22) {
          drop.y = -random(0, 90);
          drop.x = Math.random() * width;
        }
        if (drop.x < -24) drop.x = width + 24;
        if (drop.x > width + 24) drop.x = -24;
      }

      ctx.strokeStyle = `rgba(188, 220, 244, ${.12 + amounts.rain * .2})`;
      ctx.lineWidth = .75;
      ctx.beginPath();
      for (const drop of rainDrops) {
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.length * slant, drop.y + drop.length);
      }
      ctx.stroke();

      ctx.strokeStyle = `rgba(222, 241, 255, ${.16 + amounts.rain * .26})`;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      for (let i = 0; i < rainDrops.length; i += 3) {
        const drop = rainDrops[i];
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.length * slant, drop.y + drop.length);
      }
      ctx.stroke();
    }

    function drawSnow(dt, time) {
      if (amounts.snow < .003) return;
      for (const flake of snowFlakes) {
        flake.y += flake.speed * dt;
        flake.x += Math.sin(time * .001 * flake.swaySpeed + flake.sway) * .18 + wind * dt * .08;
        if (flake.y > height + 6) {
          flake.y = -6;
          flake.x = Math.random() * width;
        }
        if (flake.x < -6) flake.x = width + 6;
        if (flake.x > width + 6) flake.x = -6;
        ctx.globalAlpha = amounts.snow * flake.alpha * .65;
        ctx.fillStyle = '#EEF5F2';
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function draw(time, dt) {
      ctx.clearRect(0, 0, width, height);
      drawStars(time);
      drawClouds(time);
      drawFog(time);
      drawRain(dt);
      drawSnow(dt, time);
    }

    function loop(timestamp) {
      if (!running) return;
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min(.05, (timestamp - lastTime) / 1000 || .016);
      lastTime = timestamp;
      amounts.rain = ease(amounts.rain, targets.rain, dt, 2.2);
      amounts.snow = ease(amounts.snow, targets.snow, dt, 2.2);
      amounts.stars = ease(amounts.stars, targets.stars, dt, 1.1);
      amounts.clouds = ease(amounts.clouds, targets.clouds, dt, 1.2);
      amounts.cloudDark = ease(amounts.cloudDark, targets.cloudDark, dt, 1.1);
      amounts.fog = ease(amounts.fog, targets.fog, dt, .9);
      draw(timestamp, dt);
      if (allIdle()) {
        running = false;
        raf = null;
        if (ctx) ctx.clearRect(0, 0, width, height);
        return;
      }
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (!ctx || modeDisabled) return;
      if (REDUCED_MQ.matches || SAVE_DATA) {
        modeDisabled = true;
        canvas.style.display = 'none';
        return;
      }
      if (!width || !height) resize();
      if (!running) {
        running = true;
        lastTime = 0;
        raf = window.requestAnimationFrame(loop);
      }
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
      if (ctx) ctx.clearRect(0, 0, width, height);
    }

    function setTarget(next, options = {}) {
      targets = { ...targets, ...next };
      wind = Number.isFinite(options.windSpeed) ? options.windSpeed : wind;
      if (REDUCED_MQ.matches || SAVE_DATA) return;
      start();
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        if (!REDUCED_MQ.matches && !SAVE_DATA) start();
      } else {
        stop();
      }
    }

    function onMotionChange() {
      if (REDUCED_MQ.matches) {
        stop();
        if (canvas) canvas.style.display = 'none';
      } else {
        if (canvas) canvas.style.display = '';
        start();
      }
    }

    window.addEventListener('resize', () => {
      if (state.resizeRAF) window.cancelAnimationFrame(state.resizeRAF);
      state.resizeRAF = window.requestAnimationFrame(() => {
        state.resizeRAF = null;
        resize();
        drawChart();
      });
    });
    document.addEventListener('visibilitychange', onVisibility);
    if (REDUCED_MQ.addEventListener) REDUCED_MQ.addEventListener('change', onMotionChange);
    if (canvas && (REDUCED_MQ.matches || SAVE_DATA)) {
      modeDisabled = true;
      canvas.style.display = 'none';
    } else {
      resize();
    }

    return { setTarget, start, stop };
  })();

  /* ============================================================
     Cursor light
     ============================================================ */

  function initCursor() {
    if (!els.cursorGlow || REDUCED_MQ.matches || window.matchMedia('(hover: none)').matches) return;
    let x = window.innerWidth * .5;
    let y = window.innerHeight * .5;
    let targetX = x;
    let targetY = y;
    let visible = false;

    window.addEventListener('pointermove', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.ny = (event.clientY / window.innerHeight) * 2 - 1;
      if (!visible) {
        x = targetX;
        y = targetY;
        visible = true;
        els.cursorGlow.classList.add('is-visible');
      }
    });
    window.addEventListener('pointerout', event => {
      if (event.relatedTarget) return;
      visible = false;
      els.cursorGlow.classList.remove('is-visible');
    });

    function loop() {
      x += (targetX - x) * .08;
      y += (targetY - y) * .08;
      els.cursorGlow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      state.cursorRAF = window.requestAnimationFrame(loop);
    }
    state.cursorRAF = window.requestAnimationFrame(loop);
  }

  /* ============================================================
     Search
     ============================================================ */

  function setupSearch() {
    if (!els.searchDialog) return;
    for (const button of document.querySelectorAll('.suggestion')) {
      button.addEventListener('click', () => {
        els.searchInput.value = button.dataset.city || button.textContent;
        els.searchInput.focus();
        runSearch(els.searchInput.value);
      });
    }

    els.searchTrigger.addEventListener('click', openSearch);
    els.searchClose.addEventListener('click', closeSearch);
    els.searchDialog.addEventListener('click', event => {
      if (event.target === els.searchDialog) closeSearch();
    });
    els.searchDialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeSearch();
    });
    els.searchDialog.addEventListener('close', () => {
      document.documentElement.classList.remove('has-dialog');
      els.searchInput.value = '';
      clearSearchResults();
      els.searchInput.setAttribute('aria-expanded', 'false');
      els.searchTrigger.focus({ preventScroll: true });
    });

    els.searchInput.addEventListener('input', () => {
      const value = els.searchInput.value.trim();
      if (value.length < 2) {
        if (state.searchAbort) state.searchAbort.abort();
        state.searchToken += 1;
        clearSearchResults();
        els.searchEmpty.hidden = true;
        els.searchSuggestions.hidden = false;
        els.searchPulse.hidden = true;
        els.searchInput.setAttribute('aria-expanded', 'false');
        return;
      }
      window.clearTimeout(els.searchInput._debounce);
      els.searchInput._debounce = window.setTimeout(() => runSearch(value), 280);
    });

    els.searchInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!state.searchResults.length) return;
        setActiveSearch((state.searchActive + 1) % state.searchResults.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!state.searchResults.length) return;
        setActiveSearch((state.searchActive - 1 + state.searchResults.length) % state.searchResults.length);
      } else if (event.key === 'Enter') {
        if (state.searchResults.length) {
          event.preventDefault();
          chooseSearchResult(state.searchActive >= 0 ? state.searchActive : 0);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
      }
    });

    els.searchLocate.addEventListener('click', () => {
      closeSearch();
      locatePlace();
    });
  }

  function buildSuggestions() {
    if (!els.suggestions) return;
    els.suggestions.innerHTML = '';
    for (const city of SUGGESTED_CITIES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion';
      button.dataset.city = city;
      button.textContent = city;
      els.suggestions.appendChild(button);
    }
  }

  function openSearch() {
    if (!els.searchDialog || els.searchDialog.open) return;
    els.searchDialog.showModal();
    document.documentElement.classList.add('has-dialog');
    els.searchInput.value = '';
    clearSearchResults();
    els.searchEmpty.hidden = true;
    els.searchSuggestions.hidden = false;
    els.searchPulse.hidden = true;
    els.searchInput.setAttribute('aria-expanded', 'false');
    els.searchEmpty.textContent = 'No place by that name. Try a nearby city.';
    window.requestAnimationFrame(() => els.searchInput.focus({ preventScroll: true }));
  }

  function closeSearch() {
    if (!els.searchDialog || !els.searchDialog.open) return;
    if (state.searchAbort) state.searchAbort.abort();
    els.searchDialog.close();
  }

  async function runSearch(query) {
    const value = String(query || '').trim();
    if (value.length < 2) return;
    if (state.searchAbort) state.searchAbort.abort();
    state.searchToken += 1;
    const token = state.searchToken;
    const controller = new AbortController();
    state.searchAbort = controller;
    els.searchPulse.hidden = false;
    els.searchInput.setAttribute('aria-expanded', 'true');
    els.searchEmpty.hidden = true;

    try {
      const params = new URLSearchParams({
        name: value,
        count: '7',
        language: 'en',
        format: 'json'
      });
      const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
      const json = await response.json();
      if (token !== state.searchToken) return;
      const results = Array.isArray(json.results) ? json.results.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [];
      state.searchResults = results;
      state.searchActive = results.length ? 0 : -1;
      els.searchPulse.hidden = true;
      renderSearchResults();
      if (!results.length) els.searchEmpty.textContent = 'No place by that name. Try a nearby city.';
      els.searchSuggestions.hidden = results.length > 0;
      els.searchEmpty.hidden = results.length > 0;
      els.searchInput.setAttribute('aria-expanded', results.length ? 'true' : 'false');
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (token !== state.searchToken) return;
      state.searchResults = [];
      state.searchActive = -1;
      els.searchPulse.hidden = true;
      clearSearchResults();
      els.searchSuggestions.hidden = false;
      els.searchEmpty.hidden = false;
      els.searchEmpty.textContent = 'Search is quiet right now. Try again in a moment.';
      els.searchInput.setAttribute('aria-expanded', 'false');
    }
  }

  function clearSearchResults() {
    state.searchResults = [];
    state.searchActive = -1;
    if (els.searchResults) els.searchResults.innerHTML = '';
    if (els.searchInput) els.searchInput.removeAttribute('aria-activedescendant');
  }

  function renderSearchResults() {
    els.searchResults.innerHTML = '';
    state.searchResults.forEach((result, index) => {
      const li = document.createElement('li');
      li.className = `search-result${index === state.searchActive ? ' is-active' : ''}`;
      li.id = `search-result-${index}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', index === state.searchActive ? 'true' : 'false');

      const left = document.createElement('div');
      const place = document.createElement('div');
      place.className = 'search-result__place';
      place.textContent = result.name;
      const meta = document.createElement('div');
      meta.className = 'search-result__meta';
      const region = result.admin1 && result.admin1 !== result.name ? result.admin1 : '';
      meta.textContent = [region, result.country].filter(Boolean).join(' · ');
      left.append(place, meta);

      const arrow = document.createElement('span');
      arrow.className = 'search-result__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.innerHTML = '<svg class="icon"><use href="#i-arrow"></use></svg>';

      li.append(left, arrow);
      li.addEventListener('click', () => chooseSearchResult(index));
      li.addEventListener('pointermove', () => setActiveSearch(index));
      els.searchResults.appendChild(li);
    });
    if (state.searchResults.length) {
      setActiveSearch(state.searchActive);
    } else {
      els.searchResults.innerHTML = '';
      els.searchInput.removeAttribute('aria-activedescendant');
    }
  }

  function setActiveSearch(index) {
    if (!state.searchResults.length) return;
    const safe = clamp(index, 0, state.searchResults.length - 1);
    state.searchActive = safe;
    const nodes = Array.from(els.searchResults.children);
    nodes.forEach((node, i) => {
      const active = i === safe;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) node.scrollIntoView({ block: 'nearest' });
    });
    if (nodes[safe]) els.searchInput.setAttribute('aria-activedescendant', nodes[safe].id);
  }

  function chooseSearchResult(index) {
    const result = state.searchResults[index];
    if (!result) return;
    const place = normalizePlace({
      name: result.name,
      admin1: result.admin1 || '',
      country: result.country || '',
      country_code: result.country_code || '',
      latitude: result.latitude,
      longitude: result.longitude
    });
    if (!place) return;
    closeSearch();
    loadNewPlace(place);
  }

  async function loadNewPlace(place) {
    if (!place) return;
    if (placesEqual(state.place, place)) {
      setStatus('Already here');
      return;
    }
    await fetchWeather(place, { isPlaceChange: true });
  }

  /* ============================================================
     Geolocation
     ============================================================ */

  function locatePlace() {
    if (!navigator.geolocation) {
      setStatus('Location unavailable', { sticky: true });
      return;
    }
    els.locateButton.classList.add('is-locating');
    els.locateButton.disabled = true;
    setStatus('Locating');
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      let place = normalizePlace({
        name: 'My location',
        admin1: '',
        country: '',
        country_code: '',
        latitude,
        longitude
      });
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 6000);
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          localityLanguage: 'en'
        });
        const response = await fetch(`${REVERSE_URL}?${params.toString()}`, { signal: controller.signal });
        window.clearTimeout(timeout);
        if (response.ok) {
          const json = await response.json();
          place = normalizePlace({
            name: json.city || json.locality || json.principalSubdivision || 'My location',
            admin1: json.principalSubdivision || '',
            country: json.countryName || '',
            country_code: json.countryCode || '',
            latitude,
            longitude
          });
          setStatus('');
        }
      } catch {
        setStatus('');
      }
      els.locateButton.classList.remove('is-locating');
      els.locateButton.disabled = false;
      if (place) loadNewPlace(place);
    }, error => {
      els.locateButton.classList.remove('is-locating');
      els.locateButton.disabled = false;
      const message = error.code === 1 ? 'Location permission denied' : 'Location unavailable';
      setStatus(message, { sticky: true });
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 });
  }

  /* ============================================================
     Units & events
     ============================================================ */

  function initUnits() {
    state.unit = resolveInitialUnit(state.place);
    updateUnitButtons();
    for (const button of els.unitButtons) {
      button.addEventListener('click', () => setUnit(button.dataset.unit));
    }
  }

  function updateUnitButtons() {
    for (const button of els.unitButtons) {
      const active = button.dataset.unit === state.unit;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function setUnit(unit) {
    if (unit !== 'f' && unit !== 'c') return;
    if (state.unit === unit) return;
    state.unit = unit;
    try { localStorage.setItem(UNIT_KEY, unit); } catch { /* storage can be disabled */ }
    updateUnitButtons();
    if (!state.weather || !state.chartHours.length) return;
    const hour = state.previewIndex != null ? state.chartHours[state.previewIndex] : state.chartHours[0];
    renderConditions(hour, { isPreview: state.previewIndex != null, animate: true });
    renderWeek();
    drawChart();
    renderChartTable();
    if (state.previewIndex != null) {
      positionChartOverlay(state.previewIndex);
    } else if (state.hoverIndex != null) {
      showChartOverlay(state.hoverIndex);
    }
    if (state.place) document.title = `${tempText(hour.temp)} ${state.place.name} — Aer`;
    announce(`Units set to degrees ${unit === 'f' ? 'Fahrenheit' : 'Celsius'}.`);
  }

  function setupEvents() {
    els.refreshButton.addEventListener('click', () => {
      if (!state.loading && state.place) fetchWeather(state.place, { isRefresh: true });
    });
    els.locateButton.addEventListener('click', locatePlace);
    els.backToNow.addEventListener('click', () => {
      clearPreview();
      els.chart.focus({ preventScroll: true });
    });

    document.addEventListener('keydown', event => {
      const target = event.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === 'Escape' && state.previewIndex != null && !els.searchDialog.open) {
        event.preventDefault();
        clearPreview();
      }
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateLocalClock();
        updateLiveSolar();
        if (state.weather && Date.now() - state.fetchedAt > REFRESH_MS) {
          fetchWeather(state.place, { isRefresh: true });
        }
      }
    });

    window.addEventListener('resize', () => {
      if (!state.chartHours.length) return;
      const hour = state.previewIndex != null ? state.chartHours[state.previewIndex] : state.chartHours[0];
      updateCelestial(hour, groupFor(hour.code), getSolarInfo(hour.iso).phase);
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        state.chartNeedsDraw = true;
        window.requestAnimationFrame(() => drawChart());
      });
      observer.observe(els.chart);
    } else {
      window.addEventListener('resize', () => {
        state.chartNeedsDraw = true;
        drawChart();
      });
    }

    REDUCED_MQ.addEventListener?.('change', () => {
      if (REDUCED_MQ.matches) {
        if (state.cursorRAF) window.cancelAnimationFrame(state.cursorRAF);
        if (els.cursorGlow) els.cursorGlow.classList.remove('is-visible');
        if (state.lightningTimer) window.clearTimeout(state.lightningTimer);
        state.lightningTimer = null;
        if (els.skyFlash) els.skyFlash.classList.remove('is-flashing');
      } else if (document.body.dataset.weather === 'storm') {
        scheduleLightning(true);
      }
    });
  }

  /* ============================================================
     Cache & error states
     ============================================================ */

  function saveCache() {
    if (!state.weather || !state.place) return;
    writeJson(CACHE_KEY, {
      place: state.place,
      weather: state.weather,
      air: state.air,
      fetchedAt: state.fetchedAt
    });
  }

  function readCacheForPlace(place) {
    const cache = readJson(CACHE_KEY);
    if (!cache || !cache.weather || !cache.place) return null;
    if (!placesEqual(cache.place, place)) return null;
    if (!Number.isFinite(cache.fetchedAt) || Date.now() - cache.fetchedAt > CACHE_MAX_MS) return null;
    return cache;
  }

  function showErrorState() {
    document.body.classList.remove('is-booting');
    els.temperature.textContent = '—';
    els.condition.textContent = 'Sky Unavailable';
    if (els.conditionIconUse) els.conditionIconUse.setAttribute('href', '#i-cloud');
    els.feels.textContent = '—';
    els.todayRange.textContent = '';
    els.todayRange.hidden = true;
    els.skyNote.textContent = 'We couldn’t reach the weather service. Check your connection, then try again.';
    for (const id of ['windValue', 'humidityValue', 'uvValue', 'airValue']) {
      if (els[id]) els[id].textContent = '—';
    }
    if (els.uvLabel) els.uvLabel.textContent = '';
    if (els.uvMarker) els.uvMarker.style.opacity = '0';
    if (els.airCategory) els.airCategory.textContent = '';
    if (els.airLabel) els.airLabel.textContent = 'Air Quality';
    if (els.airIconUse) els.airIconUse.setAttribute('href', '#i-leaf');
    if (els.airFoot) els.airFoot.textContent = 'US AQI';
    if (els.airFact) els.airFact.classList.remove('has-dot');
    els.windUnit.textContent = '';
    els.windDir.textContent = '';
    els.pressureText.textContent = '—';
    if (els.pressureSub) els.pressureSub.textContent = '—';
    els.visibilityText.textContent = '—';
    if (els.visibilitySub) els.visibilitySub.textContent = '—';
    els.dewText.textContent = '—';
    els.sunrise.textContent = '—';
    els.sunset.textContent = '—';
    els.daylightLeft.textContent = '—';
    els.weekList.innerHTML = '';
    els.nowcast.hidden = true;
    if (els.skyCelestial) els.skyCelestial.style.opacity = '0';
    celestialPosition.visible = false;
    els.chartSvg.innerHTML = '';
    els.chart.dataset.empty = 'true';
    els.chartEmpty.textContent = 'No signal';
    els.updatedAt.textContent = 'Weather unavailable';
    setStatus('Weather unavailable', { sticky: true });
    hideChartOverlay();
    announce('Weather is unavailable. Check your connection and try again.');
  }

  /* ============================================================
     Boot
     ============================================================ */

  function updateKeyboardHints() {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    if (isMac) return;
    const keys = document.querySelectorAll('.kbd-hint kbd');
    if (keys[0]) keys[0].textContent = 'ctrl';
  }

  function boot() {
    cacheDom();
    state.place = resolveInitialPlace();
    state.unit = resolveInitialUnit(state.place);
    updateUnitButtons();
    updatePlaceLabels();
    updateKeyboardHints();
    buildSolarTicks();
    buildSuggestions();
    initCursor();
    setupChartEvents();
    setupSearch();
    setupEvents();
    initUnits();

    introScene();
    updateLocalClock();
    state.clockTimer = window.setInterval(updateLocalClock, 15000);
    window.setInterval(updateLiveSolar, 60000);

    const cached = readCacheForPlace(state.place);
    if (cached) {
      state.weather = cached.weather;
      state.air = cached.air;
      state.fetchedAt = cached.fetchedAt;
      state.fromCache = true;
      resetPreview();
      renderAll({ fromCache: true });
      setStatus('Cached · Checking the sky');
    } else {
      setStatus('Reading the sky');
      els.updatedAt.textContent = 'Reading the sky';
    }

    // Give the initial sky a quiet pulse of stars while the API answers.
    particles.setTarget({ rain: 0, snow: 0, stars: .35, clouds: .12, fog: 0 }, { windSpeed: 2 });

    fetchWeather(state.place, { initial: true }).then(() => {
      if (state.weather) {
        renderChartTable();
        if (state.chartHours[0]) {
          // The chart may have laid out after the first draw; make sure the SVG matches.
          window.requestAnimationFrame(() => drawChart());
        }
      }
    });

    state.refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (state.weather && Date.now() - state.fetchedAt > REFRESH_MS && !state.loading) {
        fetchWeather(state.place, { isRefresh: true });
      }
    }, 60000);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.searchDialog.open) {
        closeSearch();
      }
    });
  }

  boot();
})();
