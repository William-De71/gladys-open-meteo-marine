# Open-Meteo Marine

## Présentation

Cette intégration apporte dans Gladys la **météo marine d’[Open-Meteo](https://open-meteo.com)** sur cinq spots au plus, n’importe où dans le monde : un spot de surf, un port, une zone de navigation, une plage de kitesurf. Pour chaque spot, vous obtenez les **vagues** (hauteur significative, période, direction), la **houle** et la **mer du vent**, la **température de l’eau**, le **courant**, le **niveau de la mer** avec la marée, le **vent** et ses rafales, ainsi que la **force Beaufort** et l’**état de la mer (Douglas)** calculés par l’intégration. Chaque spot devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Open-Meteo construit ces données à partir des modèles de vagues, d’océan et de météo des services météorologiques nationaux (Météo-France, CEPMMT, DWD, NOAA…). Ni compte ni clé : l’API gratuite est réservée à un **usage non commercial**, moins de 10 000 appels par jour. [Données météo par Open-Meteo.com](https://open-meteo.com/), sous licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cette intégration communautaire n’est pas affiliée à Open-Meteo.

> **Ce sont des prévisions de modèle, pas des observations, et elles sont inadaptées à la sécurité de la navigation.** La précision près des côtes est limitée. Avant de sortir, consultez le bulletin météo marine officiel de Météo-France.

C’est une intégration **cloud** : elle lit chaque spot toutes les 15 ou 30 minutes avec deux requêtes (données marines, puis vent) et garde les prévisions sur 7 jours dans `/data`, si bien qu’un redémarrage ne coûte aucune requête.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys.
- Les coordonnées de vos spots, **en mer**.

## Configuration

| Champ                            | Quoi saisir                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Spot 1 … 5 : nom                 | Le nom affiché dans l’appareil et les widgets, par exemple « Quiberon ». Facultatif.                         |
| Spot 1 … 5 : latitude, longitude | Degrés décimaux, `47.45, -3.20` (la virgule décimale marche avec une espace : `47,45 -3,20`). Spot 1 requis. |
| Intervalle de lecture            | 15 ou 30 minutes (30 par défaut) : les modèles sont mis à jour quelques fois par jour.                       |
| Unité du vent                    | Nœuds (par défaut), km/h ou m/s, dans les widgets et les textes des scènes.                                  |
| Langue des textes                | Noms d’appareils et résumés des scènes. Automatique : la langue de votre tableau de bord.                    |

**Placez le point en mer**, à quelques km de la côte, là où arrivent les vagues : clic droit sur la mer dans Google Maps (ou OpenStreetMap), puis copiez les coordonnées. Open-Meteo prend la maille en mer la plus proche de ses modèles de vagues, larges de 5 à 25 km : un point sur la plage marche donc en général aussi. Un point à l’intérieur des terres n’a pas de données marines : l’intégration le refuse et l’indique en haut de la page.

Enregistrez : l’état en haut de la page affiche chaque spot, son état de la mer actuel et l’heure de la prochaine lecture. **Lire maintenant** relit tout de suite, y compris un spot refusé car à terre (pas de nouvelle lecture dans les cinq minutes si les données sont fraîches). **Diagnostic** écrit l’état de l’intégration dans l’onglet Journaux.

## Utilisation

### Appareils

Dans l’onglet **Découverte**, créez l’appareil « Météo marine … » de chaque spot. Il contient 15 fonctionnalités :

| Fonctionnalité                          | Unité        | Remarque                                                   |
| --------------------------------------- | ------------ | ---------------------------------------------------------- |
| Hauteur, période, direction des vagues  | m, s, degrés | hauteur significative ; direction d’où viennent les vagues |
| Hauteur, période, direction de la houle | m, s, degrés | vagues nées au loin                                        |
| Hauteur de la mer du vent               | m            | vagues levées par le vent local                            |
| Température de l’eau                    | °C           | en surface ; hors de la température des pièces             |
| Vitesse du courant                      | km/h         | pas disponible dans toutes les mers                        |
| Niveau de la mer                        | m            | au-dessus du niveau moyen mondial, marée comprise          |
| Vent moyen, rafales, direction du vent  | km/h, degrés | à 10 m ; Gladys n’a pas d’unité en nœuds                   |
| Force Beaufort                          | 0 … 12       | d’après le vent moyen (bornes de l’OMM en nœuds)           |
| État de la mer (Douglas)                | 0 … 9        | d’après la hauteur significative des vagues                |

État de la mer (Douglas) : 0 calme, 1 calme (ridée) jusqu’à 0,1 m, 2 belle jusqu’à 0,5 m, 3 peu agitée jusqu’à 1,25 m, 4 agitée jusqu’à 2,5 m, 5 forte jusqu’à 4 m, 6 très forte jusqu’à 6 m, 7 grosse jusqu’à 9 m, 8 très grosse jusqu’à 14 m, 9 énorme.

Les valeurs sont celles de la dernière lecture tant qu’elle a moins d’une heure (données de modèle au pas de 15 minutes), puis la prévision horaire de l’heure en cours. Une valeur qu’Open-Meteo ne donne pas n’est pas publiée. Renommer un spot garde son appareil ; le déplacer vers d’autres eaux (environ 1 km ou plus) crée un nouvel appareil.

### Widgets du tableau de bord

![Le widget Conditions en mer au large de Quiberon, les courbes sur 72 heures des vagues et du vent, et la liste Mer sur 7 jours (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-open-meteo-marine/main/docs/assets/widgets.fr.png)

- **Conditions en mer** : tuiles pour les vagues, leur période, la houle (et d’où elle vient), l’eau et le vent ; l’état de la mer, la force Beaufort, les rafales, la houle et le courant ; l’avertissement de navigation.
- **Courbe météo marine** : les 48 ou 72 prochaines heures des vagues, de la houle et de la mer du vent (en mètres), ou du vent moyen et des rafales ; les plus hautes vagues et le vent le plus fort avec leur heure.
- **Mer sur 7 jours** : jour par jour, les vagues max, la houle et sa période, le vent max et sa force Beaufort, et l’état de la mer en badge coloré.

Choisissez le spot dans les réglages du widget (vide : le premier). Chaque widget cite sa source, Open-Meteo.com (CC BY 4.0).

### Scènes

Trois déclencheurs, un événement par transition. La première lecture d’un spot sert de référence et ne déclenche rien. Une valeur à moins de 5 % d’un seuil garde son niveau : les petits mouvements du modèle ne déclenchent rien.

- **Open-Meteo Marine : état de la mer changé** : l’état de la mer (Douglas) d’un spot change. Filtrez par spot et par nouvel état (« forte » et au-delà, par exemple).
- **Open-Meteo Marine : force Beaufort changée** : la force du vent moyen change. Filtrez par spot et par nouvelle force.
- **Open-Meteo Marine : vent fort prévu** : dans les 24 prochaines heures, la prévision atteint la force 7 (grand frais) ou plus, seuil des avis de grand frais, ou une force plus haute que celle déjà annoncée. Il n’est annoncé de nouveau qu’après que la prévision est repassée sous la force 7.

Chacun donne une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (hauteurs, périodes, vent en km/h et en nœuds…).

L’action **Open-Meteo Marine : lire la météo marine** renvoie la mer et le vent d’un spot maintenant, ou dans 1 à 168 heures : vagues, houle, mer du vent, eau, vent, rafales, force Beaufort, état de la mer et un résumé. Elle lit la prévision gardée et ne fait aucune requête.

Exemples :

- Quand l’état de la mer devient « forte » ou plus au port → envoyer `{{triggerEvent.data.summary}}` au skipper.
- Quand un vent fort est prévu → prévenir, et rentrer le salon de jardin.
- Chaque samedi à 7 h → lire la météo marine dans 3 heures ; si la houle dépasse 1 m avec une période de plus de 10 s, envoyer « Ça rentre ! ».

### Transport

Cloud uniquement : les données viennent de `marine-api.open-meteo.com` et `api.open-meteo.com`. Seules les coordonnées des spots quittent votre réseau, avec un user agent qui nomme l’intégration.

## Dépannage

- **« pas de données marines à cet endroit »** : le point est à terre, ou dans un lac ou un estuaire étroit que les modèles de vagues ne couvrent pas. Déplacez-le de quelques km vers le large, enregistrez, puis appuyez sur **Lire maintenant**.
- **« coordonnées illisibles »** : saisissez `latitude, longitude` en degrés décimaux, la latitude d’abord : `47.45, -3.20`. Les degrés-minutes (47°27'N) ne sont pas lus.
- **Le courant ou le niveau de la mer reste vide** : Open-Meteo n’a pas de valeur pour cette mer. C’est normal.
- **Les valeurs diffèrent de la bouée ou du bulletin officiel** : ce sont des données de modèle sur une grille de 5 à 25 km ; près des côtes, elles sont moins précises.
- **« Open-Meteo limite les requêtes (HTTP 429) »** : le quota gratuit est compté par adresse IP. L’intégration attend au moins une heure. Choisissez 30 minutes et vérifiez qu’aucun autre logiciel de votre réseau n’appelle beaucoup Open-Meteo.
- **« Open-Meteo est indisponible »** ou **« injoignable »** : l’intégration réessaie après 5, 10, 20 et 40 minutes ; en attendant, les appareils suivent la prévision horaire déjà gardée.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « Marine diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum. Indiquez les versions de Gladys et de l’intégration.
