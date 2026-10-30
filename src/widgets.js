// -----------------------------------------------------------------------------
// Dashboard widgets of the Open-Meteo Marine integration.
//
//   - `conditions`  a spot now: tiles for the waves, their period, the swell,
//                   the water and the wind; the sea state, the Beaufort force,
//                   the gusts, the swell and the current as a status list;
//                   the "not for navigation" warning as a body text;
//   - `forecast`    the next 48 or 72 hours as a chart: waves, swell and wind
//                   sea (m), or mean wind and gusts (in the chosen unit);
//   - `daily`       the next seven days as a card list: highest waves, swell
//                   and its period, strongest wind, the sea state as a badge.
//
// The contents come from the forecast kept by the integration: a widget never
// costs a request to Open-Meteo. Colors are semantic. Every text exists in the
// four languages (the content is cached per language). Content budget of a
// card: 8 components, 1 main one, 6 tiles, 2 texts, 1 status, 4 buttons. The
// source "Open-Meteo.com (CC BY 4.0)" is shown on every widget, as the
// licence of the data asks.
// -----------------------------------------------------------------------------

import {
  t,
  douglasLabel,
  beaufortLabel,
  compassLabel,
  formatNumber,
  shortTime,
  dayTime,
  shortDay,
} from './i18n.js';
import { douglasOf, beaufortOf, hoursFrom, sectorOf, windIn } from './marine.js';

const WIDGETS = { CONDITIONS: 'conditions', FORECAST: 'forecast', DAILY: 'daily' };
const CHART_VARIABLES = ['waves', 'wind'];
const CHART_HOURS = [48, 72];
// The models are updated a few times a day: ten minutes of cache, nudged
// after each reading.
const TTL = { data: 600, message: 300 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of a Douglas sea state.
 * @param {number|null} state - 0 to 9.
 * @returns {string} A semantic color.
 */
function seaStateColor(state) {
  if (!Number.isInteger(state)) {
    return 'neutral';
  }
  if (state <= 2) {
    return 'success';
  }
  if (state === 3) {
    return 'info';
  }
  return state === 4 ? 'warning' : 'danger';
}

/**
 * @description The color of a Beaufort force.
 * @param {number|null} force - 0 to 12.
 * @returns {string} A semantic color.
 */
function beaufortColor(force) {
  if (!Number.isInteger(force)) {
    return 'neutral';
  }
  if (force <= 4) {
    return 'success';
  }
  return force <= 6 ? 'warning' : 'danger';
}

/**
 * @description The source row of every widget.
 * @param {string} language - The language.
 * @returns {object} The status item.
 */
const sourceItem = (language) => ({
  label: t('widgetSource', language),
  value: t('sourceValue', language),
  color: 'neutral',
});

/**
 * @description The heading of a spot.
 * @param {object} spot - The spot.
 * @returns {object} The component.
 */
const heading = (spot) => ({ type: 'text', variant: 'heading', text: clip(spot.name, 40) });

/**
 * @description A tile.
 * @param {string} label - The label.
 * @param {number|null} value - The value.
 * @param {string} unit - The unit.
 * @param {string} icon - A Feather icon.
 * @param {string} [color] - A semantic color.
 * @returns {object} The component.
 */
const tile = (label, value, unit, icon, color = 'neutral') => ({
  type: 'value',
  label: clip(label, 24),
  value: value ?? '-',
  ...(value === null || value === undefined ? {} : { unit }),
  icon,
  color,
});

const round = (value, digits) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10 ** digits) / 10 ** digits
    : null;

/**
 * @description The conditions widget.
 * @param {object} input - Input.
 * @param {object} input.spot - The spot.
 * @param {object} input.conditions - conditionsAt(now).
 * @param {number} input.updatedAt - When the forecast was read, in ms.
 * @param {string} input.language - The language.
 * @param {string} input.windUnit - `kmh`, `kn` or `ms`.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildConditionsWidget({ spot, conditions: c, updatedAt, language, windUnit, timeZone }) {
  const unit = t(`unit_${windUnit}`, language);
  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  const compass = (value) => compassLabel(sectorOf(value), language);
  const components = [
    heading(spot),
    tile(
      t('tileWaves', language),
      round(c.waveHeight, 1),
      'm',
      'activity',
      seaStateColor(c.douglas),
    ),
    tile(t('tilePeriod', language), round(c.wavePeriod, 0), 's', 'clock'),
    tile(
      t('tileSwell', language, { direction: compass(c.swellDirection) }),
      round(c.swellHeight, 1),
      'm',
      'trending-up',
    ),
    tile(t('tileWater', language), round(c.seaTemperature, 1), '°C', 'droplet'),
    tile(
      t('tileWind', language, { direction: compass(c.windDirection) }),
      windIn(c.windSpeed, windUnit),
      unit,
      'wind',
      beaufortColor(c.beaufort),
    ),
    { type: 'text', variant: 'body', text: t('widgetWarning', language) },
  ];
  const items = [
    {
      label: t('widgetSeaState', language),
      value: clip(
        t('scaleValue', language, {
          level: c.douglas ?? '?',
          label: douglasLabel(c.douglas, language),
        }),
        40,
      ),
      color: seaStateColor(c.douglas),
    },
    {
      label: t('widgetBeaufort', language),
      value: clip(
        t('scaleValue', language, {
          level: c.beaufort ?? '?',
          label: beaufortLabel(c.beaufort, language),
        }),
        40,
      ),
      color: beaufortColor(c.beaufort),
    },
    {
      label: t('tileGusts', language),
      value: `${fmt(windIn(c.windGusts, windUnit))} ${unit}`,
      color: 'neutral',
    },
    {
      label: t('widgetSwell', language),
      value: t('widgetSwellValue', language, {
        height: fmt(c.swellHeight),
        period: fmt(c.swellPeriod, 0),
        direction: compass(c.swellDirection),
      }),
      color: 'neutral',
    },
  ];
  if (c.currentSpeed !== null && c.currentSpeed !== undefined) {
    items.push({
      label: t('widgetCurrent', language),
      value: `${fmt(c.currentSpeed)} km/h · ${compass(c.currentDirection)}`,
      color: 'neutral',
    });
  }
  items.push(
    {
      label: t('widgetUpdated', language),
      value: shortTime(updatedAt, language, timeZone),
      color: 'neutral',
    },
    sourceItem(language),
  );
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description The forecast chart widget.
 * @param {object} input - Input.
 * @param {object} input.spot - The spot.
 * @param {object} input.forecast - The forecast.
 * @param {number} input.now - The instant, in ms.
 * @param {string} input.variable - `waves` or `wind`.
 * @param {number} input.hours - 48 or 72.
 * @param {string} input.language - The language.
 * @param {string} input.windUnit - `kmh`, `kn` or `ms`.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildForecastWidget({
  spot,
  forecast,
  now,
  variable,
  hours,
  language,
  windUnit,
  timeZone,
}) {
  const entries = hoursFrom(forecast, now, hours);
  const unit = t(`unit_${windUnit}`, language);
  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  const series = (key, name, convert) => ({
    name: clip(t(name, language), 24),
    points: entries
      .filter((entry) => entry[key] !== null)
      .map((entry) => ({ t: new Date(entry.at).toISOString(), v: convert(entry[key]) })),
  });
  const wind = variable === 'wind';
  const all = wind
    ? [
        series('windSpeed', 'seriesWind', (v) => windIn(v, windUnit)),
        series('windGusts', 'seriesGusts', (v) => windIn(v, windUnit)),
      ]
    : [
        series('waveHeight', 'seriesWaves', (v) => round(v, 2)),
        series('swellHeight', 'seriesSwell', (v) => round(v, 2)),
        series('windWaveHeight', 'seriesWindWaves', (v) => round(v, 2)),
      ];
  const kept = all.filter((serie) => serie.points.length > 0);
  const components = [heading(spot)];
  if (kept.length === 0) {
    components.push({ type: 'text', variant: 'body', text: t('widgetNotRead', language) });
    components.push({ type: 'status', items: [sourceItem(language)] });
    return { ttl_seconds: TTL.data, components };
  }
  components.push({
    type: 'chart',
    chart_type: 'line',
    title: clip(wind ? t('chartWind', language, { unit }) : t('chartWaves', language), 40),
    unit: wind ? unit : 'm',
    series: kept,
  });
  const peak = (key) =>
    entries
      .filter((entry) => entry[key] !== null)
      .reduce((best, entry) => (best && best[key] >= entry[key] ? best : entry), null);
  const items = [];
  const waves = peak('waveHeight');
  if (waves) {
    items.push({
      label: t('widgetMaxWaves', language),
      value: clip(
        t('widgetMaxValue', language, {
          value: fmt(waves.waveHeight),
          unit: 'm',
          time: dayTime(waves.at, language, timeZone),
        }),
        40,
      ),
      color: seaStateColor(douglasOf(waves.waveHeight)),
    });
  }
  const strongest = peak('windSpeed');
  if (strongest) {
    const force = beaufortOf(strongest.windSpeed);
    items.push({
      label: t('widgetMaxWind', language),
      value: clip(
        `${t('widgetMaxValue', language, {
          value: fmt(windIn(strongest.windSpeed, windUnit)),
          unit,
          time: dayTime(strongest.at, language, timeZone),
        })} · ${t('forceShort', language, { force })}`,
        40,
      ),
      color: beaufortColor(force),
    });
  }
  items.push(sourceItem(language));
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description The seven-day list widget.
 * @param {object} input - Input.
 * @param {object} input.spot - The spot.
 * @param {object} input.forecast - The forecast.
 * @param {number} input.now - The instant, in ms.
 * @param {string} input.language - The language.
 * @param {string} input.windUnit - `kmh`, `kn` or `ms`.
 * @param {string} [input.timeZone] - IANA timezone of the update time.
 * @returns {object} The content.
 */
function buildDailyWidget({ spot, forecast, now, language, windUnit, timeZone }) {
  const unit = t(`unit_${windUnit}`, language);
  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  // The days of the spot (its own timezone): today and the next six.
  const days = (forecast?.daily ?? [])
    .filter((day) => day.at + 24 * 3600 * 1000 > now && day.waveHeightMax !== null)
    .slice(0, 7);
  const components = [heading(spot)];
  if (days.length === 0) {
    components.push({ type: 'text', variant: 'body', text: t('widgetNotRead', language) });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: days.map((day) => {
        const state = douglasOf(day.waveHeightMax);
        const force = beaufortOf(day.windSpeedMax);
        return {
          title: clip(
            t('dayTitle', language, {
              // Noon of the day, in the spot's timezone, names the right day.
              day: shortDay(day.at + 12 * 3600 * 1000, language, forecast.timezone),
              height: fmt(day.waveHeightMax),
            }),
            60,
          ),
          subtitle: clip(
            `${t('dayLine', language, {
              swell: fmt(day.swellHeightMax),
              period: fmt(day.swellPeriodMax, 0),
              wind: fmt(windIn(day.windSpeedMax, windUnit)),
              unit,
            })} ${force === null ? '' : t('forceShort', language, { force })}`.trim(),
            60,
          ),
          badge: { text: clip(douglasLabel(state, language), 16), color: seaStateColor(state) },
        };
      }),
    });
  }
  components.push({
    type: 'status',
    items: [
      {
        label: t('widgetUpdated', language),
        value: shortTime(forecast.fetchedAt, language, timeZone),
        color: 'neutral',
      },
      sourceItem(language),
    ],
  });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description Read the settings of a widget.
 * @param {object} [settings] - The settings.
 * @returns {{ spot: string|null, variable: string, hours: number }} The device
 * external id chosen (or null), the chart variable and its hours.
 */
function readWidgetSettings(settings = {}) {
  const hours = Number(settings?.hours);
  return {
    spot: typeof settings?.spot === 'string' && settings.spot ? settings.spot : null,
    variable: CHART_VARIABLES.includes(settings?.variable) ? settings.variable : 'waves',
    hours: CHART_HOURS.includes(hours) ? hours : 48,
  };
}

export {
  WIDGETS,
  CHART_VARIABLES,
  CHART_HOURS,
  TTL,
  clip,
  messageContent,
  seaStateColor,
  beaufortColor,
  buildConditionsWidget,
  buildForecastWidget,
  buildDailyWidget,
  readWidgetSettings,
};
