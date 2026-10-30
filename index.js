// -----------------------------------------------------------------------------
// Entry point of the Open-Meteo Marine external integration.
//
// Brings the marine weather of Open-Meteo (free API, no account, no key) into
// Gladys for up to five spots at sea:
//   - devices: one per spot, with the waves, the swell, the wind sea, the
//     water temperature, the current, the sea level, the wind, the Beaufort
//     force and the Douglas sea state (see src/device.js);
//   - scene triggers: sea state changed, Beaufort force changed, strong wind
//     forecast;
//   - scene action: read the marine forecast of a spot;
//   - dashboard widgets: conditions now, 48/72-hour chart, next seven days.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Open-Meteo Marine integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
