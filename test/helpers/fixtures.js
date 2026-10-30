// A fake Open-Meteo for the tests, served through the `fetch` option of the
// integration. Real answers recorded on 2026-10-30 at 07:47 UTC (byte for
// byte, `timeformat=unixtime`, the exact queries of src/open-meteo.js):
//   - quiberon.*  47.45, -3.20: off Quiberon, the Atlantic (Bay of Biscay);
//   - marseille.* 43.20, 5.30: off Marseille, the Mediterranean;
//   - lyon.*      45.76, 4.84: Lyon, inland: every marine value is null.
// `*.marine.json` comes from marine-api.open-meteo.com, `*.wind.json` from
// api.open-meteo.com. Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

const HOUR = 3600 * 1000;
// 2026-10-30 08:50 in Paris: five minutes after the "current" block (07:45 UTC).
const NOW = Date.parse('2026-10-30T07:50:00Z');
const TZ = 'Europe/Paris';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A recorded answer.
 * @param {string} name - `quiberon.marine`.
 * @returns {object} Its JSON.
 */
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));

const SPOTS = {
  quiberon: { key: 'n4745_w320', name: 'Quiberon', latitude: 47.45, longitude: -3.2 },
  marseille: { key: 'n4320_e530', name: 'Marseille', latitude: 43.2, longitude: 5.3 },
  lyon: { key: 'n4576_e484', name: 'Lyon', latitude: 45.76, longitude: 4.84 },
};

/**
 * @description The recorded place of a request, from its coordinates.
 * @param {URL} url - The URL.
 * @returns {string|null} `quiberon`, `marseille`, `lyon` or null.
 */
function placeOf(url) {
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const found = Object.entries(SPOTS).find(
    ([, spot]) => spot.latitude === latitude && spot.longitude === longitude,
  );
  return found ? found[0] : null;
}

/**
 * @description A fake Open-Meteo server.
 * @param {object} [options] - Options.
 * @param {object} [options.errors] - `{ 'quiberon.marine': 429 | 500 | 400 | 'network' | 'html', '*': … }`.
 * @param {object} [options.answers] - Answers replacing the recorded ones, `{ 'quiberon.wind': json }`.
 * @returns {Function} A fetch function, with `requests`, `errors` and `answers` to change.
 */
function fakeOpenMeteo({ errors = {}, answers = {} } = {}) {
  const requests = [];
  const fake = async (raw, init = {}) => {
    const url = new URL(raw);
    const api = url.hostname.startsWith('marine-api') ? 'marine' : 'wind';
    const place = placeOf(url);
    const name = `${place}.${api}`;
    requests.push({ url: raw, api, place, headers: init.headers ?? {} });
    const error = fake.errors[name] ?? fake.errors[`*.${api}`] ?? fake.errors['*'];
    if (error === 'network') {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (error === 'html') {
      return new Response('<html>oops</html>', { status: 200 });
    }
    if (error === 429) {
      return Response.json(
        {
          error: true,
          reason: 'Minutely API request limit exceeded. Please try again in one minute.',
        },
        { status: 429 },
      );
    }
    if (error) {
      return Response.json({ error: true, reason: 'Something went wrong' }, { status: error });
    }
    if (!place) {
      return Response.json(
        { error: true, reason: 'Latitude must be in range of -90 to 90°.' },
        { status: 400 },
      );
    }
    return Response.json(fake.answers[name] ?? fixture(name));
  };
  fake.requests = requests;
  fake.errors = { ...errors };
  fake.answers = { ...answers };
  return fake;
}

/**
 * @description A copy of a recorded answer with some current values changed.
 * @param {string} name - `quiberon.marine`.
 * @param {object} current - Values of the `current` block.
 * @param {object} [hourly] - `{ variable: (value, index) => value }` for the hourly block.
 * @returns {object} The answer.
 */
function withValues(name, current = {}, hourly = {}) {
  const answer = fixture(name);
  Object.assign(answer.current, current);
  for (const [key, map] of Object.entries(hourly)) {
    answer.hourly[key] = answer.hourly[key].map(map);
  }
  return answer;
}

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () =>
  join(mkdtempSync(join(tmpdir(), 'open-meteo-marine-')), 'open-meteo-marine.json');

// A Gladys client only used for its external ids (selector `test-integration`).
const fakeGladys = createFakeGladys({});

/**
 * @description A config with recorded spots.
 * @param {...string} names - `quiberon`, `marseille`, `lyon`.
 * @returns {object} The raw config.
 */
function configOf(...names) {
  return Object.fromEntries(
    names.flatMap((name, index) => [
      [`spot_${index + 1}_name`, SPOTS[name].name],
      [`spot_${index + 1}_coordinates`, `${SPOTS[name].latitude}, ${SPOTS[name].longitude}`],
    ]),
  );
}

export {
  HOUR,
  NOW,
  TZ,
  SPOTS,
  silent,
  fixture,
  fakeOpenMeteo,
  withValues,
  storePath,
  fakeGladys,
  configOf,
};
