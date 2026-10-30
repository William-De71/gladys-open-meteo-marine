// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, the Douglas and Beaufort scales, compass
// points, widget contents, scene summaries, messages of the Configuration
// screen. Vocabulary of the Gladys interface (appareil / Gerät / dispositivo,
// scène / Szene / escena) and of the marine forecasts of each language:
// the WMO sea state names as Météo-France, the DWD and AEMET write them
// (peu agitée, leicht bewegt, marejada), the Beaufort names likewise.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const DOUGLAS = {
  en: [
    'Calm (glassy)',
    'Calm (rippled)',
    'Smooth',
    'Slight',
    'Moderate',
    'Rough',
    'Very rough',
    'High',
    'Very high',
    'Phenomenal',
  ],
  fr: [
    'Calme',
    'Calme (ridée)',
    'Belle',
    'Peu agitée',
    'Agitée',
    'Forte',
    'Très forte',
    'Grosse',
    'Très grosse',
    'Énorme',
  ],
  de: [
    'Spiegelglatt',
    'Ruhig',
    'Schwach bewegt',
    'Leicht bewegt',
    'Mäßig bewegt',
    'Grob',
    'Sehr grob',
    'Hoch',
    'Sehr hoch',
    'Extrem schwer',
  ],
  es: [
    'Calma',
    'Rizada',
    'Marejadilla',
    'Marejada',
    'Fuerte marejada',
    'Gruesa',
    'Muy gruesa',
    'Arbolada',
    'Montañosa',
    'Enorme',
  ],
};

const BEAUFORT = {
  en: [
    'Calm',
    'Light air',
    'Light breeze',
    'Gentle breeze',
    'Moderate breeze',
    'Fresh breeze',
    'Strong breeze',
    'Near gale',
    'Gale',
    'Strong gale',
    'Storm',
    'Violent storm',
    'Hurricane',
  ],
  fr: [
    'Calme',
    'Très légère brise',
    'Légère brise',
    'Petite brise',
    'Jolie brise',
    'Bonne brise',
    'Vent frais',
    'Grand frais',
    'Coup de vent',
    'Fort coup de vent',
    'Tempête',
    'Violente tempête',
    'Ouragan',
  ],
  de: [
    'Windstille',
    'Leiser Zug',
    'Leichte Brise',
    'Schwache Brise',
    'Mäßige Brise',
    'Frische Brise',
    'Starker Wind',
    'Steifer Wind',
    'Stürmischer Wind',
    'Sturm',
    'Schwerer Sturm',
    'Orkanartiger Sturm',
    'Orkan',
  ],
  es: [
    'Calma',
    'Ventolina',
    'Flojito',
    'Flojo',
    'Bonancible',
    'Fresquito',
    'Fresco',
    'Frescachón',
    'Temporal',
    'Temporal fuerte',
    'Temporal duro',
    'Temporal muy duro',
    'Temporal huracanado',
  ],
};

const COMPASS = {
  en: 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split(' '),
  fr: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO'.split(' '),
  de: 'N NNO NO ONO O OSO SO SSO S SSW SW WSW W WNW NW NNW'.split(' '),
  es: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO'.split(' '),
};

const TEXTS = {
  // devices
  deviceName: {
    en: 'Marine weather {spot}',
    fr: 'Météo marine {spot}',
    de: 'Seewetter {spot}',
    es: 'Tiempo marino {spot}',
  },
  feature_wave_height: {
    en: 'Wave height',
    fr: 'Hauteur des vagues',
    de: 'Wellenhöhe',
    es: 'Altura de las olas',
  },
  feature_wave_period: {
    en: 'Wave period',
    fr: 'Période des vagues',
    de: 'Wellenperiode',
    es: 'Periodo de las olas',
  },
  feature_wave_direction: {
    en: 'Wave direction',
    fr: 'Direction des vagues',
    de: 'Wellenrichtung',
    es: 'Dirección de las olas',
  },
  feature_swell_height: {
    en: 'Swell height',
    fr: 'Hauteur de la houle',
    de: 'Dünungshöhe',
    es: 'Altura del mar de fondo',
  },
  feature_swell_period: {
    en: 'Swell period',
    fr: 'Période de la houle',
    de: 'Dünungsperiode',
    es: 'Periodo del mar de fondo',
  },
  feature_swell_direction: {
    en: 'Swell direction',
    fr: 'Direction de la houle',
    de: 'Dünungsrichtung',
    es: 'Dirección del mar de fondo',
  },
  feature_wind_wave_height: {
    en: 'Wind sea height',
    fr: 'Hauteur de la mer du vent',
    de: 'Windseehöhe',
    es: 'Altura del mar de viento',
  },
  feature_sea_temperature: {
    en: 'Water temperature',
    fr: 'Température de l’eau',
    de: 'Wassertemperatur',
    es: 'Temperatura del agua',
  },
  feature_current_speed: {
    en: 'Current speed',
    fr: 'Vitesse du courant',
    de: 'Strömungsgeschwindigkeit',
    es: 'Velocidad de la corriente',
  },
  feature_sea_level: {
    en: 'Sea level',
    fr: 'Niveau de la mer',
    de: 'Meeresspiegel',
    es: 'Nivel del mar',
  },
  feature_wind_speed: { en: 'Mean wind', fr: 'Vent moyen', de: 'Mittelwind', es: 'Viento medio' },
  feature_wind_gusts: { en: 'Wind gusts', fr: 'Rafales', de: 'Böen', es: 'Rachas' },
  feature_wind_direction: {
    en: 'Wind direction',
    fr: 'Direction du vent',
    de: 'Windrichtung',
    es: 'Dirección del viento',
  },
  feature_beaufort: {
    en: 'Beaufort force',
    fr: 'Force Beaufort',
    de: 'Windstärke (Beaufort)',
    es: 'Fuerza Beaufort',
  },
  feature_sea_state: {
    en: 'Sea state (Douglas)',
    fr: 'État de la mer (Douglas)',
    de: 'Seegang (Douglas)',
    es: 'Estado del mar (Douglas)',
  },

  // units of the wind (widgets, scene texts)
  unit_kmh: { en: 'km/h', fr: 'km/h', de: 'km/h', es: 'km/h' },
  unit_kn: { en: 'kn', fr: 'nd', de: 'kn', es: 'kn' },
  unit_ms: { en: 'm/s', fr: 'm/s', de: 'm/s', es: 'm/s' },
  unknown: { en: 'unknown', fr: 'inconnu', de: 'unbekannt', es: 'desconocido' },
  now: { en: 'now', fr: 'maintenant', de: 'jetzt', es: 'ahora' },
  forceShort: { en: 'F{force}', fr: 'F{force}', de: 'Bft {force}', es: 'F{force}' },
  scaleValue: {
    en: '{level} – {label}',
    fr: '{level} – {label}',
    de: '{level} – {label}',
    es: '{level} – {label}',
  },

  // scene summaries
  summary: {
    en: '{spot}, {when}: waves {height} m every {period} s from {direction}, swell {swell} m, sea {state}. Wind {wind} {unit} from {windDirection} (force {force}), gusts {gusts} {unit}. Water {water} °C.',
    fr: '{spot}, {when} : vagues de {height} m toutes les {period} s de secteur {direction}, houle {swell} m, mer {state}. Vent de secteur {windDirection} {wind} {unit} (force {force}), rafales {gusts} {unit}. Eau à {water} °C.',
    de: '{spot}, {when}: Wellen {height} m alle {period} s aus {direction}, Dünung {swell} m, Seegang {state}. Wind {wind} {unit} aus {windDirection} (Stärke {force}), Böen {gusts} {unit}. Wasser {water} °C.',
    es: '{spot}, {when}: olas de {height} m cada {period} s de componente {direction}, mar de fondo {swell} m, mar {state}. Viento de componente {windDirection} {wind} {unit} (fuerza {force}), rachas {gusts} {unit}. Agua a {water} °C.',
  },
  summarySeaState: {
    en: 'Sea state at {spot}: {label} ({state}), waves {height} m (before: {previous}).',
    fr: 'État de la mer à {spot} : {label} ({state}), vagues de {height} m (avant : {previous}).',
    de: 'Seegang bei {spot}: {label} ({state}), Wellen {height} m (vorher: {previous}).',
    es: 'Estado del mar en {spot}: {label} ({state}), olas de {height} m (antes: {previous}).',
  },
  summaryBeaufort: {
    en: 'Wind at {spot}: force {force} ({label}), {wind} {unit}, gusts {gusts} {unit} (before: force {previous}).',
    fr: 'Vent à {spot} : force {force} ({label}), {wind} {unit}, rafales {gusts} {unit} (avant : force {previous}).',
    de: 'Wind bei {spot}: Stärke {force} ({label}), {wind} {unit}, Böen {gusts} {unit} (vorher: Stärke {previous}).',
    es: 'Viento en {spot}: fuerza {force} ({label}), {wind} {unit}, rachas {gusts} {unit} (antes: fuerza {previous}).',
  },
  summaryStrongWind: {
    en: 'Strong wind forecast at {spot}: force {force} ({label}) from {time}, gusts up to {gusts} {unit}.',
    fr: 'Vent fort prévu à {spot} : force {force} ({label}) à partir de {time}, rafales jusqu’à {gusts} {unit}.',
    de: 'Starkwind erwartet bei {spot}: Stärke {force} ({label}) ab {time}, Böen bis {gusts} {unit}.',
    es: 'Viento fuerte previsto en {spot}: fuerza {force} ({label}) desde {time}, rachas de hasta {gusts} {unit}.',
  },

  // connection status and configuration actions
  statusConnected: {
    en: 'Spots read: {spots}. Next reading at {next}.',
    fr: 'Spots lus : {spots}. Prochaine lecture à {next}.',
    de: 'Spots gelesen: {spots}. Nächste Abfrage um {next}.',
    es: 'Spots leídos: {spots}. Próxima lectura a las {next}.',
  },
  statusSpotProblem: {
    en: '{spot}: {detail}',
    fr: '{spot} : {detail}',
    de: '{spot}: {detail}',
    es: '{spot}: {detail}',
  },
  problem_land: {
    en: 'no marine data at this point. Place it at sea, a few km off the coast.',
    fr: 'pas de données marines à cet endroit. Placez le point en mer, à quelques km de la côte.',
    de: 'keine Meeresdaten an diesem Punkt. Setzen Sie ihn aufs Meer, einige km vor die Küste.',
    es: 'no hay datos marinos en este punto. Colóquelo en el mar, a unos km de la costa.',
  },
  problem_missing: {
    en: 'coordinates missing.',
    fr: 'coordonnées manquantes.',
    de: 'Koordinaten fehlen.',
    es: 'faltan las coordenadas.',
  },
  problem_coordinates: {
    en: 'unreadable coordinates, type “latitude, longitude” such as 47.45, -3.20.',
    fr: 'coordonnées illisibles, tapez « latitude, longitude » comme 47.45, -3.20.',
    de: 'Koordinaten unlesbar, geben Sie „Breite, Länge“ ein, etwa 47.45, -3.20.',
    es: 'coordenadas ilegibles, escriba «latitud, longitud» como 47.45, -3.20.',
  },
  problem_duplicate: {
    en: 'same place as another spot, left out.',
    fr: 'même endroit qu’un autre spot, ignoré.',
    de: 'gleicher Ort wie ein anderer Spot, ignoriert.',
    es: 'mismo lugar que otro spot, ignorado.',
  },
  problem_error: {
    en: 'not read ({detail}).',
    fr: 'non lu ({detail}).',
    de: 'nicht gelesen ({detail}).',
    es: 'no leído ({detail}).',
  },
  statusRateLimited: {
    en: 'Open-Meteo limits the requests (HTTP 429). Next try in {minutes} min.',
    fr: 'Open-Meteo limite les requêtes (HTTP 429). Nouvel essai dans {minutes} min.',
    de: 'Open-Meteo begrenzt die Anfragen (HTTP 429). Neuer Versuch in {minutes} Min.',
    es: 'Open-Meteo limita las solicitudes (HTTP 429). Nuevo intento en {minutes} min.',
  },
  statusServer: {
    en: 'Open-Meteo is unavailable (HTTP {status}). Next try in {minutes} min.',
    fr: 'Open-Meteo est indisponible (HTTP {status}). Nouvel essai dans {minutes} min.',
    de: 'Open-Meteo ist nicht verfügbar (HTTP {status}). Neuer Versuch in {minutes} Min.',
    es: 'Open-Meteo no está disponible (HTTP {status}). Nuevo intento en {minutes} min.',
  },
  statusRefused: {
    en: 'Open-Meteo refused the request: {detail}. Next try in {minutes} min.',
    fr: 'Open-Meteo a refusé la requête : {detail}. Nouvel essai dans {minutes} min.',
    de: 'Open-Meteo hat die Anfrage abgelehnt: {detail}. Neuer Versuch in {minutes} Min.',
    es: 'Open-Meteo rechazó la solicitud: {detail}. Nuevo intento en {minutes} min.',
  },
  statusUnreachable: {
    en: 'Open-Meteo unreachable ({detail}). Next try in {minutes} min.',
    fr: 'Open-Meteo injoignable ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Open-Meteo nicht erreichbar ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'Open-Meteo inaccesible ({detail}). Nuevo intento en {minutes} min.',
  },
  statusInvalid: {
    en: 'Unexpected answer from Open-Meteo. Next try in {minutes} min.',
    fr: 'Réponse inattendue d’Open-Meteo. Nouvel essai dans {minutes} min.',
    de: 'Unerwartete Antwort von Open-Meteo. Neuer Versuch in {minutes} Min.',
    es: 'Respuesta inesperada de Open-Meteo. Nuevo intento en {minutes} min.',
  },
  statusNoSea: {
    en: 'No spot gives marine data: place each point at sea, a few km off the coast.',
    fr: 'Aucun spot ne donne de données marines : placez chaque point en mer, à quelques km de la côte.',
    de: 'Kein Spot liefert Meeresdaten: Setzen Sie jeden Punkt aufs Meer, einige km vor die Küste.',
    es: 'Ningún spot da datos marinos: coloque cada punto en el mar, a unos km de la costa.',
  },
  noSpots: {
    en: 'No spot configured: type the name and the coordinates of a spot at sea in the configuration.',
    fr: 'Aucun spot configuré : saisissez le nom et les coordonnées d’un spot en mer dans la configuration.',
    de: 'Kein Spot eingerichtet: Geben Sie Name und Koordinaten eines Spots auf dem Meer in der Konfiguration ein.',
    es: 'Ningún spot configurado: escriba el nombre y las coordenadas de un spot en el mar en la configuración.',
  },
  refreshTooSoon: {
    en: 'Read {minutes} min ago: the models change slowly, the next reading comes on its own.',
    fr: 'Lu il y a {minutes} min : les modèles évoluent lentement, la prochaine lecture viendra seule.',
    de: 'Vor {minutes} Min. gelesen: Die Modelle ändern sich langsam, die nächste Abfrage kommt von selbst.',
    es: 'Leído hace {minutes} min: los modelos cambian despacio, la próxima lectura llegará sola.',
  },
  refreshDone: {
    en: 'Spots read: {spots}.',
    fr: 'Spots lus : {spots}.',
    de: 'Spots gelesen: {spots}.',
    es: 'Spots leídos: {spots}.',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab in {count} line(s).',
    fr: 'Diagnostic écrit dans l’onglet Journaux en {count} ligne(s).',
    de: 'Diagnose in {count} Zeile(n) in den Tab Protokolle geschrieben.',
    es: 'Diagnóstico escrito en la pestaña Registros en {count} línea(s).',
  },

  // widgets
  widgetNoSpot: {
    en: 'No spot yet: type one in the configuration of Open-Meteo Marine, then add its device in the Discover tab.',
    fr: 'Aucun spot : saisissez-en un dans la configuration d’Open-Meteo Marine, puis ajoutez son appareil dans l’onglet Découverte.',
    de: 'Noch kein Spot: Geben Sie einen in der Konfiguration von Open-Meteo Marine ein und fügen Sie sein Gerät im Tab Entdecken hinzu.',
    es: 'Ningún spot: escriba uno en la configuración de Open-Meteo Marine y añada su dispositivo en la pestaña Descubrir.',
  },
  widgetNotRead: {
    en: 'Not read yet: the first reading takes a few seconds.',
    fr: 'Pas encore lu : la première lecture prend quelques secondes.',
    de: 'Noch nicht gelesen: Die erste Abfrage dauert einige Sekunden.',
    es: 'Aún no leído: la primera lectura tarda unos segundos.',
  },
  widgetWarning: {
    en: 'Model forecast, not fit for the safety of navigation: read the official marine forecast before going to sea.',
    fr: 'Prévision de modèle, inadaptée à la sécurité de la navigation : consultez le bulletin météo marine officiel avant de sortir.',
    de: 'Modellvorhersage, nicht für die Sicherheit der Navigation geeignet: Lesen Sie vor dem Auslaufen den amtlichen Seewetterbericht.',
    es: 'Previsión de modelo, no apta para la seguridad de la navegación: consulte el boletín marino oficial antes de salir.',
  },
  tileWaves: { en: 'Waves', fr: 'Vagues', de: 'Wellen', es: 'Olas' },
  tilePeriod: { en: 'Period', fr: 'Période', de: 'Periode', es: 'Periodo' },
  tileSwell: {
    en: 'Swell {direction}',
    fr: 'Houle {direction}',
    de: 'Dünung {direction}',
    es: 'Mar de fondo {direction}',
  },
  tileWater: { en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' },
  tileWind: {
    en: 'Wind {direction}',
    fr: 'Vent {direction}',
    de: 'Wind {direction}',
    es: 'Viento {direction}',
  },
  tileGusts: { en: 'Gusts', fr: 'Rafales', de: 'Böen', es: 'Rachas' },
  widgetSeaState: { en: 'Sea state', fr: 'État de la mer', de: 'Seegang', es: 'Estado del mar' },
  widgetBeaufort: { en: 'Beaufort', fr: 'Beaufort', de: 'Beaufort', es: 'Beaufort' },
  widgetSwell: { en: 'Swell', fr: 'Houle', de: 'Dünung', es: 'Mar de fondo' },
  widgetSwellValue: {
    en: '{height} m · {period} s · {direction}',
    fr: '{height} m · {period} s · {direction}',
    de: '{height} m · {period} s · {direction}',
    es: '{height} m · {period} s · {direction}',
  },
  widgetCurrent: { en: 'Current', fr: 'Courant', de: 'Strömung', es: 'Corriente' },
  widgetUpdated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  widgetSource: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  widgetMaxWaves: { en: 'Highest waves', fr: 'Vagues max', de: 'Höchste Wellen', es: 'Olas máx.' },
  widgetMaxWind: { en: 'Strongest wind', fr: 'Vent max', de: 'Stärkster Wind', es: 'Viento máx.' },
  widgetMaxValue: {
    en: '{value} {unit} · {time}',
    fr: '{value} {unit} · {time}',
    de: '{value} {unit} · {time}',
    es: '{value} {unit} · {time}',
  },
  chartWaves: {
    en: 'Waves and swell (m)',
    fr: 'Vagues et houle (m)',
    de: 'Wellen und Dünung (m)',
    es: 'Olas y mar de fondo (m)',
  },
  chartWind: {
    en: 'Wind ({unit})',
    fr: 'Vent ({unit})',
    de: 'Wind ({unit})',
    es: 'Viento ({unit})',
  },
  seriesWaves: { en: 'Waves', fr: 'Vagues', de: 'Wellen', es: 'Olas' },
  seriesSwell: { en: 'Swell', fr: 'Houle', de: 'Dünung', es: 'Mar de fondo' },
  seriesWindWaves: { en: 'Wind sea', fr: 'Mer du vent', de: 'Windsee', es: 'Mar de viento' },
  seriesWind: { en: 'Mean wind', fr: 'Vent moyen', de: 'Mittelwind', es: 'Viento medio' },
  seriesGusts: { en: 'Gusts', fr: 'Rafales', de: 'Böen', es: 'Rachas' },
  dayLine: {
    en: 'Swell {swell} m · {period} s · wind {wind} {unit}',
    fr: 'Houle {swell} m · {period} s · vent {wind} {unit}',
    de: 'Dünung {swell} m · {period} s · Wind {wind} {unit}',
    es: 'Fondo {swell} m · {period} s · viento {wind} {unit}',
  },
  dayTitle: {
    en: '{day} · waves {height} m',
    fr: '{day} · vagues {height} m',
    de: '{day} · Wellen {height} m',
    es: '{day} · olas {height} m',
  },
  sourceValue: {
    en: 'Open-Meteo.com (CC BY 4.0)',
    fr: 'Open-Meteo.com (CC BY 4.0)',
    de: 'Open-Meteo.com (CC BY 4.0)',
    es: 'Open-Meteo.com (CC BY 4.0)',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

const pick = (table, language) => table[language] ?? table.en;

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { spot: 'Quiberon' }); // -> 'Météo marine Quiberon'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description Name of a Douglas sea state.
 * @param {number|null} level - 0 to 9.
 * @param {string} language - The language.
 * @returns {string} The name, "unknown" without a level.
 */
function douglasLabel(level, language) {
  return Number.isInteger(level) && level >= 0 && level <= 9
    ? pick(DOUGLAS, language)[level]
    : t('unknown', language);
}

/**
 * @description Name of a Beaufort force.
 * @param {number|null} force - 0 to 12.
 * @param {string} language - The language.
 * @returns {string} The name, "unknown" without a force.
 */
function beaufortLabel(force, language) {
  return Number.isInteger(force) && force >= 0 && force <= 12
    ? pick(BEAUFORT, language)[force]
    : t('unknown', language);
}

/**
 * @description The compass point of a 16-point sector.
 * @param {number|null} sector - 0 (N) to 15.
 * @param {string} language - The language.
 * @returns {string} "WSW", "OSO"…, '?' without a sector.
 */
function compassLabel(sector, language) {
  return Number.isInteger(sector) && sector >= 0 && sector <= 15
    ? pick(COMPASS, language)[sector]
    : '?';
}

/**
 * @description A number written the way of a language ("1,2" in French).
 * @param {number|null} value - The number.
 * @param {string} language - The language.
 * @param {number} [digits] - Decimals at most.
 * @returns {string} The text, '?' without a value.
 */
function formatNumber(value, language, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '?';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * @description A time of day ("15:42").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description A day and a time, the short way ("Sat 18:00").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function dayTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description A day, the short way ("Sat 31 Oct").
 * @param {number} instant - An instant of that day, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone of the day.
 * @returns {string} The text.
 */
function shortDay(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(instant));
}

export {
  LANGUAGES,
  TEXTS,
  DOUGLAS,
  BEAUFORT,
  COMPASS,
  isLanguage,
  t,
  all,
  douglasLabel,
  beaufortLabel,
  compassLabel,
  formatNumber,
  shortTime,
  dayTime,
  shortDay,
};
