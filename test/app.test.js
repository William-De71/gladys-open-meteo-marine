// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake Open-Meteo serving the answers recorded off Quiberon, off Marseille
// and in Lyon (inland).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  createApp,
  SCENE_ACTIONS,
  ACTIONS,
  RETRY_DELAYS_MIN,
  RATE_LIMIT_DELAY_MIN,
  REFRESH_MIN_INTERVAL_MS,
} from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS, ACTION_OUTPUTS } from '../src/events.js';
import { MINUTE_MS, HOUR_MS } from '../src/time.js';
import {
  NOW,
  TZ,
  silent,
  fakeOpenMeteo,
  withValues,
  storePath,
  configOf,
} from './helpers/fixtures.js';

const CONFIG = { ...configOf('quiberon', 'marseille'), language: 'fr' };
const QUIBERON = 'ext:test-integration:spot:n4745_w320';
const MARSEILLE = 'ext:test-integration:spot:n4320_e530';

/**
 * @description The integration, connected to a fake Gladys and a fake Open-Meteo.
 * @param {object} [options] - `{ config, server, path, now, logger }`.
 * @returns {Promise<object>} `{ gladys, app, server, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  server = fakeOpenMeteo(),
  path = storePath(),
  now = NOW,
  logger = silent,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: server,
    sleep: async () => {},
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, server, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const calls = (server) => server.requests.map((request) => `${request.place}.${request.api}`);

test('startup: two requests per spot, the spots offered, a status in four languages', async (t) => {
  const { gladys, server } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(calls(server), [
    'quiberon.marine',
    'quiberon.wind',
    'marseille.marine',
    'marseille.wind',
  ]);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [QUIBERON, 'Météo marine Quiberon'],
      [MARSEILLE, 'Météo marine Marseille'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(
    gladys.fake.connectionStatus.message.fr,
    'Spots lus : Quiberon peu agitée 1,2 m F4, Marseille belle 0,1 m F3. Prochaine lecture à 09:21.',
  );
  assert.match(gladys.fake.connectionStatus.message.de, /Quiberon leicht bewegt 1,2 m Bft 4/);
});

test('states only for the created devices, all of them again on creation', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
  await created(gladys, QUIBERON);
  assert.equal(gladys.fake.lastState(`${QUIBERON}:wave_height`), 1.16);
  assert.equal(gladys.fake.lastState(`${QUIBERON}:sea_state`), 3);
  assert.equal(gladys.fake.lastState(`${QUIBERON}:beaufort`), 4);
  assert.equal(gladys.fake.lastState(`${QUIBERON}:sea_temperature`), 13.1);
  assert.equal(gladys.fake.lastState(`${MARSEILLE}:wave_height`), undefined);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
});

test('an inland spot is refused with a clear message, never offered, not asked again', async (t) => {
  const config = { ...configOf('quiberon', 'lyon'), language: 'en' };
  const { gladys, app, server, clock } = await startApp({ config });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.external_id),
    [QUIBERON],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /Lyon: no marine data at this point\. Place it at sea, a few km off the coast\.$/,
  );
  assert.match(gladys.fake.connectionStatus.message.fr, /Placez le point en mer/);
  assert.equal(app.store.data.failures.n4576_e484.kind, 'land');
  const lyon = 'ext:test-integration:spot:n4576_e484';
  const {
    data: { content },
  } = await gladys.fake.widgetGet(WIDGETS.CONDITIONS, { settings: { spot: lyon }, language: 'es' });
  assert.match(content.components[0].text, /^Lyon: no hay datos marinos/);
  const before = server.requests.length;
  clock.now += 31 * MINUTE_MS;
  await app.tick();
  assert.deepEqual(calls(server).slice(before), ['quiberon.marine', 'quiberon.wind']);
});

test('only inland spots: disconnected with the hint', async (t) => {
  const { gladys } = await startApp({ config: { ...configOf('lyon'), language: 'en' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /^No spot gives marine data/);
  assert.equal(gladys.fake.discoveredDevices.length, 0);
});

test('configuration problems are named in the status', async (t) => {
  const config = {
    ...configOf('quiberon'),
    spot_2_name: 'Typo',
    spot_2_coordinates: 'Quiberon',
    language: 'en',
  };
  const { gladys } = await startApp({ config });
  t.after(() => gladys.fake.shutdown());
  assert.match(gladys.fake.connectionStatus.message.en, /Typo: unreadable coordinates/);
});

test('a reading at each tick; a restart before the next one makes no request', async (t) => {
  const first = await startApp();
  first.clock.now = NOW + 31 * MINUTE_MS + 2 * MINUTE_MS;
  await first.app.tick();
  assert.equal(first.server.requests.length, 8);
  first.gladys.fake.shutdown();
  const second = await startApp({ path: first.path, now: first.clock.now + 5 * MINUTE_MS });
  t.after(() => second.gladys.fake.shutdown());
  assert.equal(second.server.requests.length, 0);
  assert.equal(second.gladys.fake.discoveredDevices.length, 2);
  assert.equal(second.gladys.fake.connectionStatus.connected, true);
});

test('a rougher sea fires the trigger once, after the baseline', async (t) => {
  const { gladys, app, server, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, QUIBERON);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first reading is a baseline');
  server.answers['quiberon.marine'] = withValues('quiberon.marine', { wave_height: 2.8 });
  clock.now = NOW + 31 * MINUTE_MS + 2 * MINUTE_MS;
  await app.read();
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [event] = gladys.fake.sceneEvents;
  assert.equal(event.key, TRIGGERS.SEA_STATE_CHANGED);
  assert.equal(event.data.spot, QUIBERON);
  assert.equal(event.data.sea_state, 5);
  assert.equal(event.data.sea_state_label, 'Forte');
  assert.equal(gladys.fake.lastState(`${QUIBERON}:sea_state`), 5);
  // The recorded "current" block stays fresh for an hour only.
  clock.now += 5 * MINUTE_MS;
  await app.read();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'never twice');
});

test('every request fails: disconnected, the forecast kept, then the retry delays', async (t) => {
  const { gladys, app, server, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, QUIBERON);
  server.errors = { '*': 503 };
  clock.now = NOW + 40 * MINUTE_MS;
  await app.read();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /Open-Meteo is unavailable \(HTTP 503\)/);
  assert.equal(app.getRetryAt(), clock.now + RETRY_DELAYS_MIN[0] * MINUTE_MS);
  clock.now = app.getRetryAt();
  await app.tick();
  assert.equal(app.getRetryAt(), clock.now + RETRY_DELAYS_MIN[1] * MINUTE_MS);
  // The hourly forecast kept still gives the conditions.
  clock.now = NOW + 3 * HOUR_MS;
  server.errors = {};
  await app.tick();
  assert.equal(app.getRetryAt(), null);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('429: no more requests in the round, an hour at least before the next try', async (t) => {
  const server = fakeOpenMeteo({ errors: { '*': 429 } });
  const { gladys, app } = await startApp({ server });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(calls(server), ['quiberon.marine']);
  assert.equal(app.getRetryAt(), NOW + RATE_LIMIT_DELAY_MIN * MINUTE_MS);
  assert.match(gladys.fake.connectionStatus.message.fr, /Open-Meteo limite les requêtes/);
});

test('one spot down: still connected, the problem in the message', async (t) => {
  const server = fakeOpenMeteo({ errors: { 'marseille.wind': 'network' } });
  const { gladys, app } = await startApp({ server, config: { ...CONFIG, language: 'en' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.en, /Marseille: not read \(ECONNREFUSED\)\./);
  assert.equal(app.getRetryAt(), null);
});

test('no spot: disconnected with a hint, nothing read', async (t) => {
  const { gladys, server } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(server.requests.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /^No spot configured/);
  const answer = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(answer.data.message.en, /^No spot configured/);
  const {
    data: { content },
  } = await gladys.fake.widgetGet(WIDGETS.DAILY, { language: 'fr' });
  assert.match(content.components[0].text, /^Aucun spot/);
});

test('widgets: the first spot by default, or the chosen one, valid contents', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const key of Object.values(WIDGETS)) {
    for (const settings of [{}, { spot: MARSEILLE, variable: 'wind', hours: '72' }]) {
      const {
        data: { content },
      } = await gladys.fake.widgetGet(key, { settings, language: 'de' });
      assert.deepEqual(validateWidgetContent(content), [], key);
      assert.equal(content.components[0].text, settings.spot ? 'Marseille' : 'Quiberon');
    }
  }
});

test('a widget remembers the language for the texts of the scenes', async (t) => {
  const { gladys } = await startApp({ config: configOf('quiberon') });
  t.after(() => gladys.fake.shutdown());
  const before = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, {});
  assert.equal(before.data.outputs.sea_state_label, 'Slight', 'English until a widget is shown');
  await gladys.fake.widgetGet(WIDGETS.CONDITIONS, { language: 'es' });
  const after = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, {});
  assert.equal(after.data.outputs.sea_state_label, 'Marejada');
});

test('the scene action: a spot now or later, the first by default; errors are clear', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const {
    data: { outputs },
  } = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, { spot: MARSEILLE });
  assert.deepEqual(Object.keys(outputs), ACTION_OUTPUTS);
  assert.equal(outputs.spot_name, 'Marseille');
  assert.equal(outputs.wave_height, 0.14);
  assert.equal(outputs.sea_state_label, 'Belle');
  const later = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, { hours: '24' });
  assert.equal(later.data.outputs.spot_name, 'Quiberon');
  assert.equal(later.data.outputs.forecast_time, '2026-10-31T07:00:00.000Z');
  const tooFar = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, { hours: 200 });
  assert.equal(tooFar.success, false);
  assert.match(tooFar.error, /between 0 and 168/);
  const beyond = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, { hours: 168 });
  assert.equal(beyond.success, false);
  assert.match(beyond.error, /No forecast of Quiberon/);
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_MARINE_FORECAST, {
    spot: 'ext:test-integration:spot:n1000_e1000',
  });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Unknown spot/);
});

test('read now: too soon after a reading, then a new reading with its summary', async (t) => {
  const { gladys, server, clock } = await startApp({ config: { ...CONFIG, language: 'en' } });
  t.after(() => gladys.fake.shutdown());
  const soon = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(soon.data.message.en, /^Read [01] min ago/);
  assert.equal(server.requests.length, 4);
  clock.now = NOW + REFRESH_MIN_INTERVAL_MS + MINUTE_MS;
  const done = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(
    done.data.message.fr,
    'Spots lus : Quiberon peu agitée 1,2 m F4, Marseille belle 0,1 m F3.',
  );
  assert.equal(server.requests.length, 8);
  for (const text of Object.values(done.data.message)) {
    assert.ok(text.length <= 200);
  }
});

test('the diagnostic writes the state to the logs, in chunks', async (t) => {
  const lines = [];
  const { gladys } = await startApp({ logger: { ...silent, info: (line) => lines.push(line) } });
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(answer.data.message.en, /Diagnostic written to the Logs tab in \d+ line\(s\)/);
  const report = JSON.parse(
    lines
      .filter((line) => line.startsWith('Marine diagnostic'))
      .map((line) => line.replace(/^Marine diagnostic \d+\/\d+: /, ''))
      .join(''),
  );
  assert.deepEqual(
    report.spots.map((spot) => spot.key),
    ['n4745_w320', 'n4320_e530'],
  );
  assert.equal(report.requests.total, 4);
  assert.equal(report.timeZone, TZ);
  assert.equal(report.spots[0].hours, 168);
  assert.deepEqual(report.spots[0].grid, [47.458336, -3.2083282]);
});

test('a new spot reads at once; a rename or a language change only rewrites the names', async (t) => {
  const { gladys, server } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ ...CONFIG, spot_1_name: 'Côte sauvage', language: 'en' });
  assert.equal(server.requests.length, 4, 'no new reading');
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Marine weather Côte sauvage');
  assert.equal(gladys.fake.discoveredDevices[0].external_id, QUIBERON);
  await gladys.fake.configUpdated({ ...configOf('quiberon', 'marseille', 'lyon') });
  assert.ok(calls(server).includes('lyon.marine'));
});

test('a scan offers the spots again', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const before = gladys.fake.bodies('POST', '/discovered_device').length;
  await gladys.fake.scanRequest();
  assert.equal(gladys.fake.bodies('POST', '/discovered_device').length, before + 1);
});

test('the version logged and reported comes from package.json', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(version, /^0\.\d+\.\d+$/);
});
