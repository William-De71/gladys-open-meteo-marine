// The client of Open-Meteo: the queries, the user agent, the error kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MARINE_URL,
  FORECAST_URL,
  USER_AGENT,
  marineUrl,
  windUrl,
  retryAfterOf,
  createOpenMeteoClient,
} from '../src/open-meteo.js';
import { NOW, SPOTS, fakeOpenMeteo, fixture } from './helpers/fixtures.js';

const client = (server) =>
  createOpenMeteoClient({ fetch: server, now: () => NOW, sleep: async () => {} });

test('the marine query: current, hourly and daily variables, sea cell, unix times', () => {
  const url = new URL(marineUrl(SPOTS.quiberon));
  assert.equal(`${url.origin}${url.pathname}`, MARINE_URL);
  const query = Object.fromEntries(url.searchParams);
  assert.equal(query.latitude, '47.4500');
  assert.equal(query.longitude, '-3.2000');
  assert.equal(query.timezone, 'auto');
  assert.equal(query.timeformat, 'unixtime');
  assert.equal(query.forecast_days, '7');
  assert.equal(query.cell_selection, 'sea');
  assert.ok(query.current.split(',').includes('sea_level_height_msl'));
  assert.ok(!query.current.includes('wave_peak_period'), 'always null: never asked');
  assert.ok(query.hourly.split(',').includes('swell_wave_period'));
  assert.ok(query.daily.split(',').includes('swell_wave_height_max'));
});

test('the wind query: the forecast API at 10 m, in km/h', () => {
  const url = new URL(windUrl(SPOTS.marseille));
  assert.equal(`${url.origin}${url.pathname}`, FORECAST_URL);
  assert.equal(url.searchParams.get('current'), 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
  assert.equal(url.searchParams.get('wind_speed_unit'), null, 'km/h, the default');
  assert.ok(url.searchParams.get('daily').includes('wind_gusts_10m_max'));
});

test('answers, one request at a time, with a user agent naming the project', async () => {
  const server = fakeOpenMeteo();
  const api = client(server);
  const [marine, wind] = await Promise.all([api.marine(SPOTS.quiberon), api.wind(SPOTS.quiberon)]);
  assert.deepEqual(marine, fixture('quiberon.marine'));
  assert.deepEqual(wind, fixture('quiberon.wind'));
  assert.deepEqual(
    server.requests.map((request) => request.api),
    ['marine', 'wind'],
  );
  assert.match(USER_AGENT, /^gladys-open-meteo-marine\/0\.\d+\.\d+ \(\+https:\/\/github\.com\//);
  assert.equal(server.requests[0].headers['user-agent'], USER_AGENT);
  assert.equal(api.requests.total, 2);
  assert.deepEqual(api.requests.today, { date: '2026-10-30', count: 2 });
});

test('error kinds: 429, 5xx, 400 with its reason, network, not JSON', async () => {
  const cases = [
    [429, 'rate_limited', /Minutely API request limit/],
    [503, 'server', /HTTP 503/],
    ['network', 'unreachable', /ECONNREFUSED/],
    ['html', 'invalid', /not a JSON object/],
  ];
  for (const [error, kind, message] of cases) {
    const api = client(fakeOpenMeteo({ errors: { '*': error } }));
    await assert.rejects(api.marine(SPOTS.quiberon), (err) => {
      assert.equal(err.kind, kind, String(error));
      assert.match(err.message, message);
      return true;
    });
    assert.equal(api.requests.failed, 1);
  }
  const refused = client(fakeOpenMeteo());
  await assert.rejects(refused.marine({ latitude: 89, longitude: 0 }), (err) => {
    assert.equal(err.kind, 'refused');
    assert.equal(err.status, 400);
    assert.match(err.message, /Latitude must be in range/);
    return true;
  });
});

test('a failed request does not block the next ones', async () => {
  const server = fakeOpenMeteo({ errors: { 'quiberon.marine': 500 } });
  const api = client(server);
  await assert.rejects(api.marine(SPOTS.quiberon));
  assert.ok(await api.wind(SPOTS.quiberon));
});

test('Retry-After in seconds', () => {
  assert.equal(retryAfterOf('60'), 60);
  assert.equal(retryAfterOf(null), null);
  assert.equal(retryAfterOf(''), null);
  assert.equal(retryAfterOf('soon'), null);
});
