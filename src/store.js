// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/open-meteo-marine.json
// (the only writable place of the container):
//   - `forecasts`  the last forecast of each spot (marine.js), `{ [key]:
//                  forecast }`: a restart neither asks Open-Meteo again before
//                  the next reading is due, nor loses the widgets;
//   - `failures`   the spots Open-Meteo has no marine data for, `{ [key]:
//                  { kind, at } }`, so they are not asked again at each start;
//   - `fetchedAt`  when the last reading round ran;
//   - `seen`       what the scene triggers already announced per spot (sea
//                  state, Beaufort force, strong wind forecast), so a restart
//                  never fires twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/open-meteo-marine.json';
const EMPTY = () => ({ forecasts: {}, failures: {}, seen: {}, fetchedAt: null });

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        store.data = { ...EMPTY(), ...(raw && typeof raw === 'object' ? raw : {}) };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
        store.data = EMPTY();
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
