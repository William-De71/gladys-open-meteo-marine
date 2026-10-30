# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- Marine weather spots of Open-Meteo as devices: up to five spots typed as a name and "latitude, longitude" at sea, each with the significant wave height, period and direction, the swell height, period and direction, the wind sea height, the water temperature, the ocean current, the sea level (tides included), the mean wind, gusts and wind direction, the Beaufort force and the Douglas sea state.
- A spot on land, where Open-Meteo has no marine data, is refused with a clear message in four languages.
- Scene triggers: sea state changed, Beaufort force changed (filtered by spot and level) and strong wind forecast (force 7 or more in the next 24 hours).
- Scene action "read the marine forecast" of a spot, now or up to 168 hours ahead, with 19 outputs and a ready-made summary.
- Dashboard widgets: sea conditions now, a 48 or 72-hour chart of the waves or of the wind, and the next seven days.
- Wind in knots, km/h or m/s in the widgets and scene texts.
- Cloud transport: two requests per spot every 15 or 30 minutes, retries with back-off on 429 and server errors, forecasts kept in `/data`.
- Configuration actions: read now, and a diagnostic written to the Logs tab.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.
