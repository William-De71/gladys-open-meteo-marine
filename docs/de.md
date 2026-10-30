# Open-Meteo Marine

## Überblick

Diese Integration bringt das **Seewetter von [Open-Meteo](https://open-meteo.com)** für bis zu fünf Spots Ihrer Wahl nach Gladys, weltweit: ein Surfspot, ein Hafen, ein Segelrevier, ein Kitestrand. Für jeden Spot erhalten Sie die **Wellen** (signifikante Höhe, Periode, Richtung), die **Dünung** und die **Windsee**, die **Wassertemperatur**, die **Strömung**, den **Meeresspiegel** mit den Gezeiten, den **Wind** und seine Böen sowie die von der Integration berechnete **Beaufort-Stärke** und den **Seegang (Douglas)**. Jeder Spot wird zu einem Gerät für das Dashboard und für Szenen.

Open-Meteo erstellt diese Daten aus den Wellen-, Ozean- und Wettermodellen nationaler Wetterdienste (Météo-France, EZMW, DWD, NOAA…). Weder Konto noch Schlüssel sind nötig: Die kostenlose API ist für **nicht kommerzielle Nutzung**, weniger als 10.000 Aufrufe pro Tag. [Wetterdaten von Open-Meteo.com](https://open-meteo.com/), unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Diese Community-Integration ist nicht mit Open-Meteo verbunden.

> **Es sind Modellvorhersagen, keine Beobachtungen, und sie sind nicht für die Sicherheit der Navigation geeignet.** Die Genauigkeit in Küstennähe ist begrenzt. Lesen Sie vor dem Auslaufen den amtlichen Seewetterbericht des DWD.

Es ist eine **Cloud**-Integration: Sie liest jeden Spot alle 15 oder 30 Minuten mit zwei Anfragen (Meeresdaten, dann Wind) und speichert die 7-Tage-Vorhersagen in `/data`, sodass ein Neustart keine Anfrage kostet.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys aus.
- Die Koordinaten Ihrer Spots, **auf dem Meer**.

## Konfiguration

| Feld                      | Was eingeben                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Spot 1 … 5: Name          | Der im Gerät und in den Widgets angezeigte Name, zum Beispiel „Sylt“. Optional.               |
| Spot 1 … 5: Breite, Länge | Dezimalgrad, `54.90, 8.25` (Dezimalkomma geht mit Leerzeichen: `54,90 8,25`). Spot 1 Pflicht. |
| Abfrageintervall          | 15 oder 30 Minuten (Standard 30): Die Modelle werden einige Male am Tag aktualisiert.         |
| Windeinheit               | Knoten (Standard), km/h oder m/s, in den Widgets und Szenentexten.                            |
| Sprache der Texte         | Gerätenamen und Szenen-Zusammenfassungen. Automatisch: die Sprache Ihres Dashboards.          |

**Setzen Sie den Punkt aufs Meer**, einige km vor die Küste, wo die Wellen ankommen: Rechtsklick auf das Meer in Google Maps (oder OpenStreetMap) und die Koordinaten kopieren. Open-Meteo nimmt die nächstgelegene Meereszelle seiner Wellenmodelle, 5 bis 25 km breit, daher funktioniert meist auch ein Punkt am Strand. Ein Punkt im Binnenland hat keine Meeresdaten: Die Integration lehnt ihn ab und meldet es oben auf der Seite.

Speichern: Der Status oben auf der Seite zeigt jeden Spot, seinen aktuellen Seegang und die Zeit der nächsten Abfrage. **Jetzt lesen** liest sofort erneut, auch einen als Landpunkt abgelehnten Spot (nicht erneut innerhalb von fünf Minuten, wenn die Daten frisch sind). **Diagnose** schreibt den Zustand der Integration in den Tab Protokolle.

## Verwendung

### Geräte

Erstellen Sie im Tab **Entdecken** das Gerät „Seewetter …“ jedes Spots. Es enthält 15 Funktionen:

| Funktion                         | Einheit    | Hinweis                                                 |
| -------------------------------- | ---------- | ------------------------------------------------------- |
| Wellenhöhe, -periode, -richtung  | m, s, Grad | signifikante Höhe; Richtung, aus der die Wellen kommen  |
| Dünungshöhe, -periode, -richtung | m, s, Grad | weit entfernt entstandene Wellen                        |
| Windseehöhe                      | m          | vom örtlichen Wind erzeugte Wellen                      |
| Wassertemperatur                 | °C         | an der Oberfläche; nicht in der Raumtemperatur          |
| Strömungsgeschwindigkeit         | km/h       | nicht in jedem Meer verfügbar                           |
| Meeresspiegel                    | m          | über dem globalen mittleren Meeresspiegel, mit Gezeiten |
| Mittelwind, Böen, Windrichtung   | km/h, Grad | in 10 m; Gladys kennt keine Knoten-Einheit              |
| Beaufort-Stärke                  | 0 … 12     | aus dem Mittelwind (WMO-Grenzen in Knoten)              |
| Seegang (Douglas)                | 0 … 9      | aus der signifikanten Wellenhöhe                        |

Seegang (Douglas): 0 spiegelglatt, 1 ruhig bis 0,1 m, 2 schwach bewegt bis 0,5 m, 3 leicht bewegt bis 1,25 m, 4 mäßig bewegt bis 2,5 m, 5 grob bis 4 m, 6 sehr grob bis 6 m, 7 hoch bis 9 m, 8 sehr hoch bis 14 m, 9 extrem schwer.

Die Werte stammen aus der letzten Abfrage, solange sie weniger als eine Stunde alt ist (Modelldaten im 15-Minuten-Takt), danach aus der stündlichen Vorhersage der aktuellen Stunde. Ein Wert, den Open-Meteo nicht liefert, wird nicht veröffentlicht. Ein umbenannter Spot behält sein Gerät; in andere Gewässer verschoben (etwa 1 km oder mehr) entsteht ein neues Gerät.

### Dashboard-Widgets

![Das Widget Bedingungen auf See vor Quiberon, die 72-Stunden-Verläufe von Wellen und Wind und die Liste See, nächste 7 Tage (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-open-meteo-marine/main/docs/assets/widgets.de.png)

- **Bedingungen auf See**: Kacheln für die Wellen, ihre Periode, die Dünung (und woher sie kommt), das Wasser und den Wind; Seegang, Beaufort-Stärke, Böen, Dünung und Strömung; der Navigationshinweis.
- **Seewetter-Verlauf**: die nächsten 48 oder 72 Stunden der Wellen, der Dünung und der Windsee (in Metern) oder des Mittelwinds und der Böen; die höchsten Wellen und der stärkste Wind mit ihrer Zeit.
- **See, nächste 7 Tage**: Tag für Tag die höchsten Wellen, die Dünung und ihre Periode, der stärkste Wind mit seiner Beaufort-Stärke und der Seegang als farbiges Abzeichen.

Wählen Sie den Spot in den Einstellungen des Widgets (leer: der erste). Jedes Widget nennt seine Quelle, Open-Meteo.com (CC BY 4.0).

### Szenen

Drei Auslöser, ein Ereignis pro Übergang. Die erste Abfrage eines Spots dient als Referenz und löst nichts aus. Ein Wert innerhalb von 5 % einer Grenze behält seine Stufe: Kleine Modellschwankungen lösen nichts aus.

- **Open-Meteo Marine: Seegang geändert**: Der Seegang (Douglas) eines Spots ändert sich. Filtern nach Spot und neuem Seegang (zum Beispiel „grob“ und mehr).
- **Open-Meteo Marine: Windstärke geändert**: Die Stärke des Mittelwinds ändert sich. Filtern nach Spot und neuer Stärke.
- **Open-Meteo Marine: Starkwind erwartet**: In den nächsten 24 Stunden erreicht die Vorhersage Stärke 7 (steifer Wind) oder mehr, die Schwelle der Starkwindwarnungen, oder eine höhere Stärke als bereits gemeldet. Erneut gemeldet wird erst, nachdem die Vorhersage wieder unter Stärke 7 lag.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Höhen, Perioden, Wind in km/h und Knoten…).

Die Aktion **Open-Meteo Marine: Seewetter lesen** liefert See und Wind eines Spots jetzt oder in 1 bis 168 Stunden: Wellen, Dünung, Windsee, Wasser, Wind, Böen, Beaufort-Stärke, Seegang und eine Zusammenfassung. Sie liest die gespeicherte Vorhersage und stellt keine Anfrage.

Beispiele:

- Wenn der Seegang am Hafen „grob“ oder mehr erreicht → `{{triggerEvent.data.summary}}` an den Skipper senden.
- Wenn Starkwind erwartet wird → benachrichtigen und die Gartenmöbel hereinholen.
- Jeden Samstag um 7:00 → Seewetter in 3 Stunden lesen; liegt die Dünung über 1 m mit einer Periode über 10 s, „Surf ist an“ senden.

### Transport

Nur Cloud: Die Daten kommen von `marine-api.open-meteo.com` und `api.open-meteo.com`. Nur die Koordinaten der Spots verlassen Ihr Netzwerk, mit einem User-Agent, der die Integration nennt.

## Fehlerbehebung

- **„keine Meeresdaten an diesem Punkt“**: Der Punkt liegt an Land oder in einem See oder engen Ästuar, den die Wellenmodelle nicht abdecken. Verschieben Sie ihn einige km aufs Meer, speichern Sie und drücken Sie **Jetzt lesen**.
- **„Koordinaten unlesbar“**: Geben Sie `Breite, Länge` in Dezimalgrad ein, die Breite zuerst: `54.90, 8.25`. Grad-Minuten (54°54'N) werden nicht gelesen.
- **Strömung oder Meeresspiegel bleiben leer**: Open-Meteo hat für dieses Meer keinen Wert. Das ist normal.
- **Die Werte weichen von der Boje oder dem amtlichen Bericht ab**: Es sind Modelldaten auf einem Raster von 5 bis 25 km; in Küstennähe sind sie ungenauer.
- **„Open-Meteo begrenzt die Anfragen (HTTP 429)“**: Das kostenlose Kontingent wird pro IP-Adresse gezählt. Die Integration wartet mindestens eine Stunde. Wählen Sie 30 Minuten und prüfen Sie, dass keine andere Software in Ihrem Netzwerk Open-Meteo häufig aufruft.
- **„Open-Meteo ist nicht verfügbar“** oder **„nicht erreichbar“**: Die Integration versucht es nach 5, 10, 20 und 40 Minuten erneut; bis dahin folgen die Geräte der bereits gespeicherten stündlichen Vorhersage.
- **Ein Problem melden**: Drücken Sie **Diagnose** und kopieren Sie die Zeilen, die mit „Marine diagnostic“ beginnen, aus dem Tab Protokolle in ein GitHub-Issue oder eine Antwort im Forum. Geben Sie die Versionen von Gladys und der Integration an.
