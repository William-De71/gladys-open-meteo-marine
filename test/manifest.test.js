// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { TRIGGERS, ACTION_OUTPUTS, STRONG_WIND_FROM } from '../src/events.js';
import { SCENE_ACTIONS, ACTIONS, MAX_ACTION_HOURS } from '../src/app.js';
import { WIDGETS, CHART_VARIABLES, CHART_HOURS } from '../src/widgets.js';
import {
  AUTO_LANGUAGE,
  INTERVALS,
  DEFAULT_INTERVAL,
  WIND_UNITS,
  DEFAULT_WIND_UNIT,
} from '../src/config.js';
import { MAX_SPOTS } from '../src/spots.js';
import { MARINE_URL, FORECAST_URL } from '../src/open-meteo.js';
import { LANGUAGES, DOUGLAS, BEAUFORT } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const lock = read('../package-lock.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Open-Meteo Marine');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\.\d+\.\d+$/);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(lock.name, pkg.name);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/william-de71/gladys-open-meteo-marine:${pkg.version}`,
  );
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-open-meteo-marine/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-open-meteo-marine');
});

test('declares the cloud transport only: the APIs of Open-Meteo', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.equal(MARINE_URL, 'https://marine-api.open-meteo.com/v1/marine');
  assert.equal(FORECAST_URL, 'https://api.open-meteo.com/v1/forecast');
});

test('requires Gladys 5.3.0 (catalog keywords); worldwide; no permission at all', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['environment', 'leisure']);
  assert.equal(manifest.countries, undefined, 'the seas of the whole world');
  for (const key of ['location', 'network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('trigger filters: the device, and the levels of the scales', () => {
  const triggers = byKey(manifest.scene_triggers);
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String(i + from));
  for (const trigger of manifest.scene_triggers) {
    const spot = byKey(trigger.fields).get('spot');
    assert.equal(spot.source, 'devices', trigger.key);
    assert.equal(spot.required, false);
  }
  const seaState = byKey(triggers.get(TRIGGERS.SEA_STATE_CHANGED).fields).get('sea_state');
  assert.deepEqual(values(seaState), range(0, 9));
  assert.equal(seaState.options[3].label.fr, `3 – ${DOUGLAS.fr[3]}`);
  const force = byKey(triggers.get(TRIGGERS.BEAUFORT_CHANGED).fields).get('beaufort');
  assert.deepEqual(values(force), range(0, 12));
  assert.equal(force.options[7].label.de, `7 – ${BEAUFORT.de[7]}`);
  const strong = byKey(triggers.get(TRIGGERS.STRONG_WIND_FORECAST).fields).get('beaufort');
  assert.deepEqual(values(strong), range(STRONG_WIND_FROM, 12));
});

test('the scene action: an optional spot, hours ahead with a default, the outputs of the code', () => {
  const action = byKey(manifest.scene_actions).get(SCENE_ACTIONS.GET_MARINE_FORECAST);
  assert.deepEqual(
    action.outputs.map((output) => output.key),
    ACTION_OUTPUTS,
  );
  const fields = byKey(action.fields);
  assert.equal(fields.get('spot').source, 'devices');
  assert.equal(fields.get('spot').required, false);
  const hours = fields.get('hours');
  assert.equal(hours.type, 'number');
  assert.equal(hours.required, false);
  assert.deepEqual([hours.default, hours.min, hours.max], [0, 0, MAX_ACTION_HOURS]);
});

test('widget settings: a device, the chart and its duration', () => {
  for (const widget of manifest.widgets) {
    const spot = byKey(widget.settings).get('spot');
    assert.equal(spot.source, 'devices', widget.key);
  }
  const forecast = byKey(byKey(manifest.widgets).get(WIDGETS.FORECAST).settings);
  assert.deepEqual(values(forecast.get('variable')), CHART_VARIABLES);
  assert.deepEqual(values(forecast.get('hours')).map(Number), CHART_HOURS);
});

test('five spots typed as text (decimal numbers are not safe in every core), no secret', () => {
  const config = byKey(manifest.config_schema);
  for (let slot = 1; slot <= MAX_SPOTS; slot += 1) {
    assert.equal(config.get(`spot_${slot}_name`).type, 'string');
    assert.equal(config.get(`spot_${slot}_coordinates`).type, 'string');
  }
  assert.equal(config.get('spot_1_coordinates').required, true);
  assert.equal(config.get('spot_2_coordinates').required, false);
  assert.equal(config.get(`spot_${MAX_SPOTS + 1}_name`), undefined);
  assert.match(config.get('spots').description.fr, /EN MER/);
  for (const field of manifest.config_schema) {
    assert.ok(!['text', 'password', 'number', 'secret'].includes(field.type), field.key);
    assert.equal(field.display_if, undefined, field.key);
  }
});

test('options: interval, wind unit and language, as the code reads them', () => {
  const config = byKey(manifest.config_schema);
  assert.deepEqual(values(config.get('interval')).map(Number), INTERVALS);
  assert.equal(Number(config.get('interval').default), DEFAULT_INTERVAL);
  assert.deepEqual([...values(config.get('wind_unit'))].sort(), [...WIND_UNITS].sort());
  assert.equal(config.get('wind_unit').default, DEFAULT_WIND_UNIT);
  assert.deepEqual(values(config.get('language')), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(config.get('language').default, AUTO_LANGUAGE);
});

test('attribution and warning: CC BY 4.0, not for navigation, in every language', () => {
  const intro = byKey(manifest.config_schema).get('intro');
  for (const language of LANGUAGES) {
    assert.match(intro.description[language], /Open-Meteo\.com/);
    assert.match(intro.description[language], /CC BY 4\.0/);
  }
  assert.ok(intro.links.some((link) => link.url === 'https://open-meteo.com/'));
  assert.match(intro.description.fr, /inadaptées à la sécurité de la navigation/);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  for (const widget of manifest.widgets) {
    assert.ok((widget.settings ?? []).length <= 10);
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('catalog of Gladys 5.3.0: search keywords within the store bounds', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'never the name itself');
});
