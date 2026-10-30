# Open-Meteo Marine

## Presentación

Esta integración trae a Gladys el **tiempo marino de [Open-Meteo](https://open-meteo.com)** en hasta cinco spots a su elección, en cualquier lugar del mundo: un pico de surf, un puerto, una zona de navegación, una playa de kitesurf. Para cada spot obtiene las **olas** (altura significativa, periodo, dirección), el **mar de fondo** y el **mar de viento**, la **temperatura del agua**, la **corriente**, el **nivel del mar** con la marea, el **viento** y sus rachas, además de la **fuerza Beaufort** y el **estado del mar (Douglas)** calculados por la integración. Cada spot se convierte en un dispositivo para mostrar en un panel y usar en escenas.

Open-Meteo elabora estos datos a partir de los modelos de oleaje, océano y tiempo de los servicios meteorológicos nacionales (Météo-France, ECMWF, DWD, NOAA…). No hace falta cuenta ni clave: la API gratuita es para **uso no comercial**, menos de 10 000 llamadas al día. [Datos meteorológicos de Open-Meteo.com](https://open-meteo.com/), bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Esta integración comunitaria no está afiliada a Open-Meteo.

> **Son previsiones de modelo, no observaciones, y no son aptas para la seguridad de la navegación.** La precisión cerca de la costa es limitada. Antes de salir, consulte el boletín marino oficial de AEMET.

Es una integración **en la nube**: lee cada spot cada 15 o 30 minutos con dos solicitudes (datos marinos y luego viento) y guarda las previsiones de 7 días en `/data`, así que un reinicio no cuesta ninguna solicitud.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior.
- Acceso a Internet desde Gladys.
- Las coordenadas de sus spots, **en el mar**.

## Configuración

| Campo                         | Qué escribir                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Spot 1 … 5: nombre            | El nombre mostrado en el dispositivo y los widgets, por ejemplo «Tarifa». Opcional.                            |
| Spot 1 … 5: latitud, longitud | Grados decimales, `36.00, -5.62` (la coma decimal funciona con un espacio: `36,00 -5,62`). Spot 1 obligatorio. |
| Intervalo de lectura          | 15 o 30 minutos (30 por defecto): los modelos se actualizan unas pocas veces al día.                           |
| Unidad del viento             | Nudos (por defecto), km/h o m/s, en los widgets y los textos de escenas.                                       |
| Idioma de los textos          | Nombres de dispositivos y resúmenes de escenas. Automático: el idioma de su panel.                             |

**Coloque el punto en el mar**, a unos km de la costa, donde llegan las olas: clic derecho sobre el mar en Google Maps (u OpenStreetMap) y copie las coordenadas. Open-Meteo toma la celda marina más cercana de sus modelos de oleaje, de 5 a 25 km, así que un punto en la playa suele funcionar también. Un punto tierra adentro no tiene datos marinos: la integración lo rechaza y lo indica arriba de la página.

Guarde: el estado arriba de la página muestra cada spot, su estado del mar actual y la hora de la próxima lectura. **Leer ahora** vuelve a leer al instante, incluido un spot rechazado por estar en tierra (no de nuevo en cinco minutos si los datos son recientes). **Diagnóstico** escribe el estado de la integración en la pestaña Registros.

## Uso

### Dispositivos

En la pestaña **Descubrir**, cree el dispositivo «Tiempo marino …» de cada spot. Contiene 15 funcionalidades:

| Funcionalidad                               | Unidad       | Nota                                                       |
| ------------------------------------------- | ------------ | ---------------------------------------------------------- |
| Altura, periodo, dirección de las olas      | m, s, grados | altura significativa; dirección de la que vienen           |
| Altura, periodo, dirección del mar de fondo | m, s, grados | olas nacidas lejos                                         |
| Altura del mar de viento                    | m            | olas levantadas por el viento local                        |
| Temperatura del agua                        | °C           | en superficie; fuera de la temperatura de las habitaciones |
| Velocidad de la corriente                   | km/h         | no disponible en todos los mares                           |
| Nivel del mar                               | m            | sobre el nivel medio global del mar, marea incluida        |
| Viento medio, rachas, dirección del viento  | km/h, grados | a 10 m; Gladys no tiene unidad en nudos                    |
| Fuerza Beaufort                             | 0 … 12       | según el viento medio (límites de la OMM en nudos)         |
| Estado del mar (Douglas)                    | 0 … 9        | según la altura significativa de las olas                  |

Estado del mar (Douglas): 0 calma, 1 rizada hasta 0,1 m, 2 marejadilla hasta 0,5 m, 3 marejada hasta 1,25 m, 4 fuerte marejada hasta 2,5 m, 5 gruesa hasta 4 m, 6 muy gruesa hasta 6 m, 7 arbolada hasta 9 m, 8 montañosa hasta 14 m, 9 enorme.

Los valores son los de la última lectura mientras tenga menos de una hora (datos de modelo cada 15 minutos), después la previsión horaria de la hora en curso. Un valor que Open-Meteo no da no se publica. Cambiar el nombre de un spot conserva su dispositivo; moverlo a otras aguas (alrededor de 1 km o más) crea un dispositivo nuevo.

### Widgets del panel

![El widget Condiciones del mar frente a Quiberon, los gráficos de 72 horas de las olas y del viento, y la lista Mar, próximos 7 días (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-open-meteo-marine/main/docs/assets/widgets.es.png)

- **Condiciones del mar**: mosaicos de las olas, su periodo, el mar de fondo (y de dónde viene), el agua y el viento; el estado del mar, la fuerza Beaufort, las rachas, el mar de fondo y la corriente; el aviso de navegación.
- **Gráfico marino**: las próximas 48 o 72 horas de las olas, el mar de fondo y el mar de viento (en metros), o del viento medio y las rachas; las olas más altas y el viento más fuerte con su hora.
- **Mar, próximos 7 días**: día a día, las olas máximas, el mar de fondo y su periodo, el viento máximo con su fuerza Beaufort y el estado del mar como insignia de color.

Elija el spot en los ajustes del widget (vacío: el primero). Cada widget cita su fuente, Open-Meteo.com (CC BY 4.0).

### Escenas

Tres activadores, un evento por transición. La primera lectura de un spot sirve de referencia y no dispara nada. Un valor a menos del 5 % de un umbral conserva su nivel: los pequeños movimientos del modelo no disparan nada.

- **Open-Meteo Marine: estado del mar cambiado**: el estado del mar (Douglas) de un spot cambia. Filtre por spot y por nuevo estado («gruesa» o más, por ejemplo).
- **Open-Meteo Marine: fuerza Beaufort cambiada**: la fuerza del viento medio cambia. Filtre por spot y por nueva fuerza.
- **Open-Meteo Marine: viento fuerte previsto**: en las próximas 24 horas la previsión alcanza fuerza 7 (frescachón) o más, umbral de los avisos costeros, o una fuerza mayor que la ya anunciada. Solo se vuelve a anunciar después de que la previsión haya bajado de fuerza 7.

Cada uno da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (alturas, periodos, viento en km/h y nudos…).

La acción **Open-Meteo Marine: leer el tiempo marino** devuelve el mar y el viento de un spot ahora o dentro de 1 a 168 horas: olas, mar de fondo, mar de viento, agua, viento, rachas, fuerza Beaufort, estado del mar y un resumen. Lee la previsión guardada y no hace ninguna solicitud.

Ejemplos:

- Cuando el estado del mar llega a «gruesa» o más en el puerto → enviar `{{triggerEvent.data.summary}}` al patrón.
- Cuando se prevé viento fuerte → avisar y recoger los muebles del jardín.
- Cada sábado a las 7:00 → leer el tiempo marino dentro de 3 horas; si el mar de fondo supera 1 m con un periodo de más de 10 s, enviar «¡Hay olas!».

### Transporte

Solo nube: los datos vienen de `marine-api.open-meteo.com` y `api.open-meteo.com`. Solo las coordenadas de los spots salen de su red, con un user agent que nombra la integración.

## Solución de problemas

- **«no hay datos marinos en este punto»**: el punto está en tierra, o en un lago o un estuario estrecho que los modelos de oleaje no cubren. Muévalo unos km mar adentro, guarde y pulse **Leer ahora**.
- **«coordenadas ilegibles»**: escriba `latitud, longitud` en grados decimales, la latitud primero: `36.00, -5.62`. Los grados y minutos (36°00'N) no se leen.
- **La corriente o el nivel del mar quedan vacíos**: Open-Meteo no tiene valor para este mar. Es normal.
- **Los valores difieren de la boya o del boletín oficial**: son datos de modelo en una malla de 5 a 25 km; cerca de la costa son menos precisos.
- **«Open-Meteo limita las solicitudes (HTTP 429)»**: la cuota gratuita se cuenta por dirección IP. La integración espera al menos una hora. Elija 30 minutos y compruebe que ningún otro programa de su red llame mucho a Open-Meteo.
- **«Open-Meteo no está disponible»** o **«inaccesible»**: la integración vuelve a intentarlo tras 5, 10, 20 y 40 minutos; mientras tanto, los dispositivos siguen la previsión horaria ya guardada.
- **Para informar de un problema**: pulse **Diagnóstico** y copie las líneas que empiezan por «Marine diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro. Indique las versiones de Gladys y de la integración.
