import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SPOTS,
  parseCoordinates,
  spotKeyOf,
  isSpotKey,
  cleanName,
  coordinatesText,
} from '../src/spots.js';

test('coordinates typed the usual ways', () => {
  const quiberon = { latitude: 47.45, longitude: -3.2 };
  assert.deepEqual(parseCoordinates('47.45, -3.2'), quiberon);
  assert.deepEqual(parseCoordinates(' 47.45 -3.2 '), quiberon);
  assert.deepEqual(parseCoordinates('47.45;-3.2'), quiberon);
  assert.deepEqual(parseCoordinates('47,45 -3,2'), quiberon);
  assert.deepEqual(parseCoordinates('47,45; -3,2'), quiberon);
  assert.deepEqual(parseCoordinates('-33.8688, 151.2093'), {
    latitude: -33.8688,
    longitude: 151.2093,
  });
});

test('unreadable or impossible coordinates are refused', () => {
  for (const raw of [
    '',
    'Quiberon',
    '47.45',
    '91, 0',
    '0, 181',
    '47,45,-3,2',
    null,
    47.45,
    '1e2, 3',
  ]) {
    assert.equal(parseCoordinates(raw), null, String(raw));
  }
});

test('the key of a spot: the coordinates at two decimals, hemispheres as letters', () => {
  assert.equal(spotKeyOf(47.45, -3.2), 'n4745_w320');
  assert.equal(spotKeyOf(47.4512, -3.1987), 'n4745_w320', 'a nudge of a few metres keeps it');
  assert.equal(spotKeyOf(43.2, 5.3), 'n4320_e530');
  assert.equal(spotKeyOf(-33.8688, 151.2093), 's3387_e15121');
  assert.equal(spotKeyOf(0, 0), 'n0_e0');
  assert.equal(spotKeyOf(-0.001, -0.001), 'n0_e0', 'no negative zero');
  assert.equal(spotKeyOf(10, -180), spotKeyOf(10, 180), 'the same meridian');
  assert.ok(isSpotKey('n4745_w320'));
  assert.ok(!isSpotKey('N4745_W320'));
  assert.ok(!isSpotKey('47.45,-3.2'));
  assert.equal(MAX_SPOTS, 5);
});

test('names and coordinates for people', () => {
  assert.equal(cleanName('  Pointe   du  Raz '), 'Pointe du Raz');
  assert.equal(cleanName('x'.repeat(50)).length, 40);
  assert.equal(cleanName(undefined), '');
  assert.equal(coordinatesText({ latitude: 47.45, longitude: -3.2 }), '47.45° N, 3.20° W');
  assert.equal(coordinatesText({ latitude: -33.87, longitude: 151.21 }), '33.87° S, 151.21° E');
});
