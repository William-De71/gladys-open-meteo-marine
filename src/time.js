// -----------------------------------------------------------------------------
// Time helpers and the reading pace.
//
// The integration reads each spot every 15 or 30 minutes (configuration),
// each instance at its own offset (a stable jitter of up to two minutes): a
// thousand Gladys instances never call Open-Meteo at the same second. The
// times shown in the widgets are in the timezone of the Gladys instance (TZ,
// injected by the supervisor); the days of the seven-day list are the local
// days of the spot (the timezone Open-Meteo gives for it).
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const JITTER_SECONDS = 120;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description A stable jitter, in ms, from a seed (the spots): the same
 * instance always reads at the same offset.
 * @param {string} seed - The seed.
 * @returns {number} 0 to JITTER_SECONDS seconds, in ms.
 */
function jitterOf(seed) {
  let hash = 0;
  for (const char of String(seed ?? '')) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return (hash % JITTER_SECONDS) * 1000;
}

export { MINUTE_MS, HOUR_MS, JITTER_SECONDS, defaultTimeZone, jitterOf };
