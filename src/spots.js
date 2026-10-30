// -----------------------------------------------------------------------------
// The spots: places at sea whose marine weather is followed.
//
// A spot is typed by the user in the configuration: a name and "latitude,
// longitude" (a text field: a `number` field cannot take a decimal coordinate
// in every version of the Gladys core, see the community feedback).
//
// The key of a spot builds the external ids of its device, kept for ever. It
// comes from the coordinates rounded to two decimals (about 1 km), never from
// the name: renaming a spot keeps its device, nudging the point by a few
// hundred metres usually keeps it too, and moving it to another bay makes a
// new device (other waters, other history). Two decimals are well below the
// grid of the wave models (5 to 25 km), so no precision is lost: the
// coordinates sent to Open-Meteo are the typed ones anyway.
//
//   47.4512, -3.1987  ->  n4745_w320
// -----------------------------------------------------------------------------

const MAX_SPOTS = 5;
const NAME_MAX = 40;
const KEY_PATTERN = /^[ns]\d{1,4}_[ew]\d{1,5}$/;

const validLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const validLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

/**
 * @description Read "latitude, longitude" as typed by a user: "47.4512, -3.1987",
 * "47.4512 -3.1987", "47.4512;-3.1987" or, with decimal commas, "47,4512 -3,1987".
 * @param {unknown} raw - The typed text.
 * @returns {{ latitude: number, longitude: number }|null} The coordinates, null when unreadable.
 * @example
 * parseCoordinates('47.45, -3.2'); // -> { latitude: 47.45, longitude: -3.2 }
 */
function parseCoordinates(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const dotted = /^(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
  const comma = /^(-?\d{1,3},\d+)\s*[; ]\s*(-?\d{1,3},\d+)$/.exec(text);
  const match = dotted ?? comma;
  if (!match) {
    return null;
  }
  const latitude = Number(match[1].replace(',', '.'));
  const longitude = Number(match[2].replace(',', '.'));
  if (!validLatitude(latitude) || !validLongitude(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

/**
 * @description The eternal key of a spot, from its coordinates.
 * @param {number} latitude - Degrees.
 * @param {number} longitude - Degrees.
 * @returns {string} `n4745_w320`.
 * @example
 * spotKeyOf(43.2, 5.3); // -> 'n4320_e530'
 */
function spotKeyOf(latitude, longitude) {
  const lat = Math.round(latitude * 100);
  // -180 and 180 are the same meridian.
  let lon = Math.round(longitude * 100);
  if (lon === -18000) {
    lon = 18000;
  }
  return `${lat < 0 ? 's' : 'n'}${Math.abs(lat)}_${lon < 0 ? 'w' : 'e'}${Math.abs(lon)}`;
}

/**
 * @description Whether a text is a spot key.
 * @param {unknown} value - The value.
 * @returns {boolean} True for `n4745_w320`.
 */
const isSpotKey = (value) => typeof value === 'string' && KEY_PATTERN.test(value);

/**
 * @description Clean a spot name.
 * @param {unknown} raw - The typed name.
 * @returns {string} The name, spaces squeezed, 40 characters at most ('' when empty).
 */
function cleanName(raw) {
  const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return text.length > NAME_MAX ? text.slice(0, NAME_MAX).trim() : text;
}

/**
 * @description Coordinates written for a person: "47.45° N, 3.20° W".
 * @param {object} spot - `{ latitude, longitude }`.
 * @returns {string} The text.
 */
function coordinatesText({ latitude, longitude }) {
  const part = (value, positive, negative) =>
    `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;
  return `${part(latitude, 'N', 'S')}, ${part(longitude, 'E', 'W')}`;
}

export { MAX_SPOTS, NAME_MAX, parseCoordinates, spotKeyOf, isSpotKey, cleanName, coordinatesText };
