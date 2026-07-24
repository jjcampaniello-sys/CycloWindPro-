/* ============================================================
ROUTE.JS
Gestion des itinéraires, vent, obstacles et affichage Leaflet
============================================================ */

/* ============================================================
VARIABLES GLOBALES
============================================================ */
alert("ROUTE.JS EST CHARGE");
window.routeLayers = window.routeLayers || [];
window.routeGroup = window.routeGroup || L.layerGroup();

if (window.map && !window.map.hasLayer(window.routeGroup)) {
window.routeGroup.addTo(window.map);
}

/* ============================================================
OUTILS COORDONNÉES
============================================================ */

/*

* ORS renvoie les coordonnées GeoJSON sous la forme :
*
* [longitude, latitude]
*
* Leaflet utilise :
*
* [latitude, longitude]
*
* Cette fonction effectue donc la conversion.
  */
  function convertGeoJSONCoordinates(coordinates) {

  if (!Array.isArray(coordinates)) {
  return [];
  }

  return coordinates
  .filter(coord => Array.isArray(coord) && coord.length >= 2)
  .map(coord => [
  Number(coord[1]),
  Number(coord[0])
  ]);
  }

/*

* Extrait les coordonnées d'une route ORS.
*
* Compatible avec :
*
* route.geometry.coordinates
*
* lorsque geometry est un objet GeoJSON.
  */
  function getRouteLatLngs(routeObj) {

  if (!routeObj || !routeObj.geometry) {
  console.error("Route ORS sans géométrie :", routeObj);
  return [];
  }

  const geometry = routeObj.geometry;

  /*

  * Cas GeoJSON :
  *
  * {
  * type: "LineString",
  * coordinates: [...]
  * }
    */
    if (
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates)
    ) {
    return convertGeoJSONCoordinates(geometry.coordinates);
    }

  /*

  * Cas éventuel où geometry est directement
  * un tableau de coordonnées.
    */
    if (Array.isArray(geometry)) {
    return convertGeoJSONCoordinates(geometry);
    }

  /*

  * Cas où geometry serait une polyline encodée.
  * Cette partie sert uniquement de compatibilité.
    */
    if (typeof geometry === "string") {

    try {

    ```
     if (
         L.LineUtil &&
         typeof L.LineUtil.decodePolyline === "function"
     ) {
         return L.LineUtil.decodePolyline(geometry);
     }
    ```

    } catch (error) {

    ```
     console.error(
         "Erreur décodage polyline :",
         error
     );
    ```

    }

  }

  console.error(
  "Format de géométrie ORS non reconnu :",
  geometry
  );

  return [];
  }

/*

* Retourne toujours un tableau [lat, lng].
  */
  function normalizeLatLng(point) {

  if (!point) {
  return null;
  }

  if (
  Array.isArray(point) &&
  point.length >= 2
  ) {
  return [
  Number(point[0]),
  Number(point[1])
  ];
  }

  if (
  point.lat !== undefined &&
  point.lng !== undefined
  ) {
  return [
  Number(point.lat),
  Number(point.lng)
  ];
  }

  return null;
  }

/* ============================================================
DIRECTION DU SEGMENT
============================================================ */

function getSegmentDirection(p1, p2) {

```
const point1 = normalizeLatLng(p1);
const point2 = normalizeLatLng(p2);

if (!point1 || !point2) {
    return 0;
}

const dy = point2[0] - point1[0];
const dx = point2[1] - point1[1];

let angle =
    Math.atan2(dy, dx) *
    (180 / Math.PI);

if (angle < 0) {
    angle += 360;
}

/*
 * Correction conservée de ton code original.
 */
angle =
    (angle + 180) % 360;

return angle;
```

}

/* ============================================================
RÉCUPÉRATION DES ROUTES ORS
============================================================ */

async function getAlternativeRoute(
start,
endLat,
endLon
) {

```
const apiKey =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";

const url =
    "https://api.openrouteservice.org/v2/directions/cycling-regular";


const body = {

    format: "geojson",

    coordinates: [
        [
            start.lng,
            start.lat
        ],
        [
            endLon,
            endLat
        ]
    ],

    alternative_routes: {

        target_count: 3,

        share_factor: 0.4,

        weight_factor: 1.8

    },

    extra_info: [
        "waytype",
        "surface"
    ]

};


try {

    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers: {

                    "Authorization": apiKey,

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(body)

            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();

        console.error(
            "Erreur HTTP ORS :",
            response.status,
            errorText
        );

        throw new Error(
            "Erreur API ORS : HTTP " +
            response.status
        );

    }


    const data =
        await response.json();
alert("DONNÉES ORS COMPLÈTES :", JSON.stringify(data, null, 2));
    alert(
        "Réponse complète ORS :",
        data
    );


    if (
        !data ||
        !data.routes ||
        !data.routes.length
    ) {

        console.error(
            "Aucune route retournée par ORS :",
            data
        );

        return null;

    }


    return data;


} catch (error) {

    console.error(
        "Erreur récupération routes ORS :",
        error
    );

    alert(
        "Impossible de récupérer les itinéraires."
    );

    return null;

}
```

}

/* ============================================================
EXTRACTION DES OBSTACLES / ABRIS
============================================================ */

function extractSegments(routeObj) {

```
const forestSegments =
    new Set();

const residentialSegments =
    new Set();


if (
    !routeObj ||
    !routeObj.segments ||
    !routeObj.segments.length
) {

    console.warn(
        "Aucun segment ORS disponible."
    );

    return {
        forestSegments,
        residentialSegments
    };

}


routeObj.segments.forEach(
    segment => {

        if (
            !segment.extras
        ) {
            return;
        }


        const extras =
            segment.extras;


        /*
         * WAYTYPE
         */
        if (
            extras.waytype &&
            Array.isArray(
                extras.waytype.values
            )
        ) {

            extras.waytype.values.forEach(
                value => {

                    const from =
                        Number(value[0]);

                    const to =
                        Number(value[1]);

                    const type =
                        Number(value[2]);


                    /*
                     * Codes utilisés dans
                     * ton code original.
                     */
                    if (
                        type === 3 ||
                        type === 10
                    ) {

                        for (
                            let i = from;
                            i <= to;
                            i++
                        ) {

                            forestSegments.add(i);

                        }

                    }


                    if (
                        type === 1 ||
                        type === 2
                    ) {

                        for (
                            let i = from;
                            i <= to;
                            i++
                        ) {

                            residentialSegments.add(i);

                        }

                    }

                }
            );

        }


        /*
         * SURFACE
         */
        if (
            extras.surface &&
            Array.isArray(
                extras.surface.values
            )
        ) {

            extras.surface.values.forEach(
                value => {

                    const from =
                        Number(value[0]);

                    const to =
                        Number(value[1]);

                    const surfaceType =
                        Number(value[2]);


                    /*
                     * Conservation de ta
                     * logique originale.
                     */
                    if (
                        surfaceType >= 5
                    ) {

                        for (
                            let i = from;
                            i <= to;
                            i++
                        ) {

                            forestSegments.add(i);

                        }

                    }

                }
            );

        }

    }
);


return {
    forestSegments,
    residentialSegments
};
```

}

/* ============================================================
CALCUL DU SCORE VENT + OBSTACLES
============================================================ */

function calculateWindScore(
latlngs,
routeObj
) {

```
if (
    !latlngs ||
    latlngs.length < 2
) {

    return 0;

}


const {
    forestSegments,
    residentialSegments
} =
    extractSegments(routeObj);


let totalCost = 0;

let count = 0;


for (
    let i = 0;
    i < latlngs.length - 1;
    i++
) {

    const direction =
        getSegmentDirection(
            latlngs[i],
            latlngs[i + 1]
        );


    let cost =
        windCost(
            direction,
            window.currentWindDirection,
            window.currentWindSpeed
        );


    /*
     * BONUS ABRI FORÊT
     */
    if (
        forestSegments.has(i)
    ) {

        cost =
            cost * 0.5;

    }

    /*
     * BONUS ABRI ZONE RÉSIDENTIELLE
     */
    else if (
        residentialSegments.has(i)
    ) {

        cost =
            cost * 0.7;

    }


    totalCost += cost;

    count++;

}


return count > 0
    ? totalCost / count
    : 0;
```

}

/* ============================================================
CHOIX DE LA MEILLEURE ROUTE
============================================================ */

function chooseBestRoute(
normalRoute,
alternativeRoute,
normalScore,
alternativeScore
) {

```
const normalTime =
    Number(
        normalRoute.summary?.duration || 0
    );

const alternativeTime =
    Number(
        alternativeRoute.summary?.duration || 0
    );


const windGain =
    normalScore -
    alternativeScore;


if (
    windGain > 3 &&
    alternativeTime <
    normalTime * 1.2
) {

    return "alternative";

}


return "normal";
```

}

/* ============================================================
CALCUL DU GAIN DE VENT
============================================================ */

function calculateWindGain(
scoreNormal,
scoreAlternative
) {

```
if (
    scoreNormal <= 0
) {

    return 0;

}


const gain =
    (
        (
            scoreNormal -
            scoreAlternative
        ) /
        scoreNormal
    ) *
    100;


return Math.max(
    0,
    gain
);
```

}

/* ============================================================
COULEUR SELON L'EXPOSITION AU VENT
============================================================ */

function getWindColor(
cost
) {

```
if (
    cost > 20
) {

    return "red";

}

if (
    cost > 8
) {

    return "orange";

}

return "green";
```

}

/* ============================================================
DESSIN DE LA ROUTE COLORÉE
============================================================ */

function drawWindRoute(
latlngs,
routeObj = null
) {

```
if (
    !latlngs ||
    latlngs.length < 2
) {

    return;

}


const {
    forestSegments,
    residentialSegments
} =
    extractSegments(routeObj);


for (
    let i = 0;
    i < latlngs.length - 1;
    i++
) {

    const direction =
        getSegmentDirection(
            latlngs[i],
            latlngs[i + 1]
        );


    let cost =
        windCost(
            direction,
            window.currentWindDirection,
            window.currentWindSpeed
        );


    /*
     * Le dessin utilise maintenant
     * le même effet d'abri que le score.
     */
    if (
        forestSegments.has(i)
    ) {

        cost =
            cost * 0.5;

    }

    else if (
        residentialSegments.has(i)
    ) {

        cost =
            cost * 0.7;

    }


    const color =
        getWindColor(cost);


    const line =
        L.polyline(
            [
                latlngs[i],
                latlngs[i + 1]
            ],
            {

                color: color,

                weight: 5,

                opacity: 0.85,

                pane:
                    "overlayPane"

            }
        );


    line.addTo(
        window.routeGroup
    );


    window.routeLayers.push(
        line
    );

}
```

}

/* ============================================================
DESSIN ROUTE GRISE
============================================================ */

function drawGrayRoute(
latlngs
) {

```
if (
    !latlngs ||
    latlngs.length < 2
) {

    return;

}


const line =
    L.polyline(
        latlngs,
        {

            color: "gray",

            weight: 4,

            opacity: 0.55,

            pane:
                "overlayPane"

        }
    );


line.addTo(
    window.routeGroup
);


window.routeLayers.push(
    line
);
```

}

/* ============================================================
NETTOYAGE DES ROUTES
============================================================ */

function clearRouteLayers() {

```
if (
    window.routeGroup
) {

    window.routeGroup.clearLayers();

}


window.routeLayers = [];
```

}

/* ============================================================
AFFICHAGE DES INFORMATIONS
============================================================ */

function updateWindText(
currentView,
activeScore,
normalRouteObj,
alternativeRouteObj,
normalScore,
alternativeScore,
hasAlternative
) {

```
const routeActive =
    currentView === "normale"
        ? normalRouteObj
        : alternativeRouteObj;


if (
    !routeActive
) {

    return;

}


const distanceKm =
    (
        Number(
            routeActive.summary?.distance || 0
        ) / 1000
    ).toFixed(1);


let rawGain = 0;


if (
    normalScore > 0
) {

    rawGain =
        (
            (
                normalScore -
                alternativeScore
            ) /
            normalScore
        ) *
        100;

}


let gainText = "";

let dynamiqueRecommendation = "";


if (
    !hasAlternative
) {

    gainText =
        "🌬️ Aucune route alternative disponible";

    dynamiqueRecommendation =
        "🚴 Seul trajet trouvé";

}

else if (
    Math.abs(rawGain) < 5
) {

    gainText =
        "🌬️ Exposition au vent équivalente sur les deux trajets";

    dynamiqueRecommendation =
        currentView === "alternative"
            ? "🚴 Trajet équivalent, mais route initiale plus directe"
            : "🚴 CycloWind recommande ce trajet initial";

}

else if (
    rawGain >= 5
) {

    gainText =
        `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;

    dynamiqueRecommendation =
        currentView === "alternative"
            ? "🌱 Route assez protégée"
            : "💡 Voir l'Alternative abritée";

}

else {

    gainText =
        `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;

    dynamiqueRecommendation =
        currentView === "alternative"
            ? "⚠️ Route alternative plus exposée"
            : "🚴 Trajet initial bien plus abrité";

}


const windInfo =
    document.getElementById(
        "windInfo"
    );


if (
    windInfo
) {

    windInfo.innerHTML = `

        <strong>
            ${dynamiqueRecommendation}
        </strong>

        <br>

        📍 Vue :
        Route ${currentView}

        <br>

        📏 Distance :
        ${distanceKm} km

        <br>

        ${gainText}

        <br>

        📊 Indice effort vent :
        ${Number(activeScore).toFixed(1)}

    `;

    windInfo.style.display =
        "block";

}
```

}

/* ============================================================
AFFICHAGE / MISE À JOUR DU TOGGLE
============================================================ */

function setupRouteToggle(
normalRouteObj,
alternativeRouteObj,
normalScore,
alternativeScore,
hasAlternative
) {

```
const toggleBtn =
    document.getElementById(
        "toggleRouteBtn"
    );


if (
    !toggleBtn
) {

    console.warn(
        "toggleRouteBtn introuvable."
    );

    return;

}


if (
    !hasAlternative
) {

    toggleBtn.style.display =
        "none";

    toggleBtn.onclick =
        null;

    return;

}


toggleBtn.style.display =
    "block";


let showingAlternative =
    false;


toggleBtn.innerText =
    "Voir la route alternative";


toggleBtn.onclick =
    function () {

        clearRouteLayers();


        if (
            !showingAlternative
        ) {

            drawWindRoute(
                window.latlngsAlternativePersist,
                alternativeRouteObj
            );


            drawGrayRoute(
                window.latlngsNormalPersist
            );


            toggleBtn.innerText =
                "Voir la route normale";


            updateWindText(
                "alternative",
                alternativeScore,
                normalRouteObj,
                alternativeRouteObj,
                normalScore,
                alternativeScore,
                true
            );


            showingAlternative =
                true;

        }

        else {

            drawWindRoute(
                window.latlngsNormalPersist,
                normalRouteObj
            );


            drawGrayRoute(
                window.latlngsAlternativePersist
            );


            toggleBtn.innerText =
                "Voir la route alternative";


            updateWindText(
                "normale",
                normalScore,
                normalRouteObj,
                alternativeRouteObj,
                normalScore,
                alternativeScore,
                true
            );


            showingAlternative =
                false;

        }

    };
```

}

/* ============================================================
FONCTION PRINCIPALE GETROUTE
============================================================ */
alert("GETROUTE EST DEFINI");
async function getRoute() {

```
try {

    console.log(
        "getRoute() lancé"
    );


    /*
     * Vérification carte.
     */
    if (
        !window.map
    ) {

        alert(
            "La carte n'est pas disponible."
        );

        return;

    }


    /*
     * Vérification position.
     */
    if (
        !window.userPosition
    ) {

        alert(
            "Définissez votre position d'abord."
        );

        return;

    }


    /*
     * Vérification destination.
     */
    if (
        !window.destination
    ) {

        alert(
            "Choisissez une destination dans la liste."
        );

        return;

    }


    const start = {

        lat:
            Number(
                window.userPosition[0]
            ),

        lng:
            Number(
                window.userPosition[1]
            )

    };


    const endLat =
        Number(
            window.destination.lat
        );


    const endLon =
        Number(
            window.destination.lon
        );


    /*
     * Récupération ORS.
     */
    const allRoutesData =
        await getAlternativeRoute(
            start,
            endLat,
            endLon
        );


    if (
        !allRoutesData ||
        !allRoutesData.routes ||
        !allRoutesData.routes.length
    ) {

        alert(
            "Aucun itinéraire trouvé."
        );

        return;

    }


    /*
     * Route principale.
     */
    const normalRouteObj =
        allRoutesData.routes[0];


    /*
     * Conversion GeoJSON -> [lat, lng].
     */
    const latlngsNormal =
        getRouteLatLngs(
            normalRouteObj
        );


    if (
        latlngsNormal.length < 2
    ) {

        console.error(
            "Impossible d'extraire la géométrie de la route normale.",
            normalRouteObj
        );

        alert(
            "La géométrie de la route est invalide."
        );

        return;

    }


    /*
     * Route alternative.
     */
    let alternativeRouteObj =
        normalRouteObj;


    let latlngsAlternative =
        latlngsNormal;


    const hasAlternative =
        allRoutesData.routes.length > 1;


    if (
        hasAlternative
    ) {

        alternativeRouteObj =
            allRoutesData.routes[1];


        latlngsAlternative =
            getRouteLatLngs(
                alternativeRouteObj
            );


        if (
            latlngsAlternative.length < 2
        ) {

            console.warn(
                "La route alternative est invalide. Retour à la route normale."
            );

            alternativeRouteObj =
                normalRouteObj;

            latlngsAlternative =
                latlngsNormal;

        }

    }


    /*
     * Sauvegarde globale.
     */
    window.latlngsNormalPersist =
        latlngsNormal;


    window.latlngsAlternativePersist =
        latlngsAlternative;


    window.currentRoute =
        latlngsNormal.map(
            point =>
                L.latLng(
                    point[0],
                    point[1]
                )
        );


    /*
     * Nettoyage anciennes routes.
     */
    clearRouteLayers();


    /*
     * Calcul direction premier segment.
     */
    const firstDir =
        getSegmentDirection(
            latlngsNormal[0],
            latlngsNormal[1]
        );


    /*
     * Récupération du vent.
     */
    await getWind(
        start.lat,
        start.lng,
        firstDir
    );


    /*
     * Calcul des scores.
     */
    const normalScore =
        calculateWindScore(
            latlngsNormal,
            normalRouteObj
        );


    const alternativeScore =
        hasAlternative
            ? calculateWindScore(
                latlngsAlternative,
                alternativeRouteObj
            )
            : normalScore;


    /*
     * Choix de la meilleure route.
     */
    const choice =
        hasAlternative
            ? chooseBestRoute(
                normalRouteObj,
                alternativeRouteObj,
                normalScore,
                alternativeScore
            )
            : "normal";


    const windGain =
        hasAlternative
            ? calculateWindGain(
                normalScore,
                alternativeScore
            )
            : 0;


    console.log(
        "Score route normale :",
        normalScore
    );


    console.log(
        "Score route alternative :",
        alternativeScore
    );


    console.log(
        "Meilleure route :",
        choice
    );


    console.log(
        "Gain vent :",
        windGain
    );


    /*
     * Affichage initial.
     *
     * La route normale est colorée.
     * L'alternative est grise.
     */
    drawWindRoute(
        latlngsNormal,
        normalRouteObj
    );


    if (
        hasAlternative
    ) {

        drawGrayRoute(
            latlngsAlternative
        );

    }


    /*
     * Mise à jour informations.
     */
    updateWindText(
        "normale",
        normalScore,
        normalRouteObj,
        alternativeRouteObj,
        normalScore,
        alternativeScore,
        hasAlternative
    );


    /*
     * Configuration toggle.
     */
    setupRouteToggle(
        normalRouteObj,
        alternativeRouteObj,
        normalScore,
        alternativeScore,
        hasAlternative
    );


    /*
     * Zoom automatique.
     */
    const bounds =
        L.latLngBounds(
            latlngsNormal
        );


    if (
        hasAlternative
    ) {

        bounds.extend(
            L.latLngBounds(
                latlngsAlternative
            )
        );

    }


    window.map.fitBounds(
        bounds,
        {

            padding:
                L.point(
                    50,
                    50
                ),

            maxZoom:
                15

        }
    );


    /*
     * Exposition de la fonction.
     */
    window.drawWindRoute =
        drawWindRoute;


    console.log(
        "getRoute() terminé correctement."
    );


} catch (error) {

    console.error(
        "ERREUR CRITIQUE DANS getRoute() :",
        error
    );


    alert(
        "Une erreur est survenue lors du calcul du trajet. Consultez la console du navigateur."
    );

}
```

}

/* ============================================================
NAVIGATION
============================================================ */

function startNavigation() {

```
const btn =
    document.getElementById(
        "startNavBtn"
    );


if (
    !btn
) {

    return;

}


const windInfoPanel =
    document.querySelector(
        ".wind-container-right"
    ) ||
    document.getElementById(
        "windInfo"
    );


if (
    !window.userPosition
) {

    alert(
        "Position GPS non détectée. Impossible de démarrer."
    );

    return;

}


if (
    !window.isNavigating
) {

    window.isNavigating =
        true;


    btn.innerText =
        "Arrêter";


    btn.style.backgroundColor =
        "#e74c3c";


    if (
        windInfoPanel
    ) {

        windInfoPanel.classList.add(
            "nav-hidden"
        );

    }


    window.currentNavZoom =
        17;


    window.map.setView(
        window.userPosition,
        window.currentNavZoom
    );


    setTimeout(
        function () {

            window.map.panBy(
                [
                    0,
                    -140
                ],
                {
                    animate:
                        true
                }
            );

        },
        250
    );

}

else {

    window.isNavigating =
        false;


    btn.innerText =
        "Démarrer";


    btn.style.backgroundColor =
        "#2ecc71";


    if (
        windInfoPanel
    ) {

        windInfoPanel.classList.remove(
            "nav-hidden"
        );

    }


    if (
        window.latlngsNormalPersist
    ) {

        window.map.fitBounds(
            L.latLngBounds(
                window.latlngsNormalPersist
            )
        );

    }

}
```

}

/* ============================================================
EXPORT GLOBAL
============================================================ */

window.getRoute =
getRoute;

window.getAlternativeRoute =
getAlternativeRoute;

window.calculateWindScore =
calculateWindScore;

window.drawWindRoute =
drawWindRoute;

window.drawGrayRoute =
drawGrayRoute;

window.startNavigation =
startNavigation;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
     // ✅ ALERT DE DEBUG SÉCURISÉE : Reconstruite pour s'adapter au format .routes standard
    if (data && data.routes && data.routes[0]) {
        alert("API Réponse Ok ! Résumé route : " + JSON.stringify(data.routes[0].summary));
    } else {
        alert("Erreur API ORS : " + JSON.stringify(data));
    }
    return data; 
}
//================================================================================================================
// Extraction des obstacles (Adaptée pour lire les segments de l'API standard)
 alert("segment extract");
function extractSegments(routeObj){
    const forestSegments = new Set();
    const residentialSegments = new Set();
// Sécurité : Si l'API n'a pas renvoyé le bloc d'obstacles du premier segment, on s'arrête proprement
    if(!routeObj || !routeObj.segments || !routeObj.segments[0] || !routeObj.segments[0].extras) {
        alert("Pas d'extras disponibles sur cette route");
        return {forestSegments, residentialSegments};
    }

    const extras = routeObj.segments[0].extras;
 
    if(extras.waytype && extras.waytype.values){
        extras.waytype.values.forEach(v => {
            const from = v[0];
            const to = v[1];
            const type = v[2];

            // Codes ORS officiels : 3 (Path) et 10 (Track) = Pistes forestières et parcs (arbres)
            if(type === 3 || type === 10){
                for(let i = from; i <= to; i++){
                    forestSegments.add(i);
                }
            }

            // Codes ORS officiels : 1 (StateRoad) et 2 (Street) = Rues de villes (maisons)
            if(type === 1 || type === 2){
                for(let i = from; i <= to; i++){
                    residentialSegments.add(i);
                }
            }
        });
    }
 // Analyse secondaire via les revêtements (surface)
    if(extras.surface && extras.surface.values){
        extras.surface.values.forEach(v => {
            const from = v[0];
            const to = v[1];
            const surfaceType = v[2];
            // Codes >= 5 = Terre, gravier, herbe (Zones vertes boisées naturelles)
            if(surfaceType >= 5){
                for(let i = from; i <= to; i++){
                    forestSegments.add(i);
                }
            }
        });
    }

    return {forestSegments, residentialSegments};
} 
//===============================================================================================
 alert("Calcul wind score");
function calculateWindScore(latlngs, routeObj){

    // ✅ LIAISON SÉCURISÉE : On transmet le routeObj officiel à la fonction d'extraction précédente
    const {forestSegments, residentialSegments} = extractSegments(routeObj);

    let totalCost = 0;
    let count = 0;

    for(let i = 0; i < latlngs.length - 1; i++){

        const direction = getSegmentDirection(
            latlngs[i],
            latlngs[i+1]
        );

        let cost = windCost(
            direction,
            currentWindDirection,
            currentWindSpeed
        );

        // 🌳 BONUS ABRI
       if (forestSegments.has(i)) {
    cost = cost * 0.5;
}
else if (residentialSegments.has(i)) {
    cost = cost * 0.7;
}
        totalCost += cost;
        count++;
    }

    return count > 0 ? totalCost / count : 0;
}
 alert("Choose Route");
function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore){
    const normalTime = normalRoute.summary.duration;
    const alternativeTime = alternativeRoute.summary.duration;

    const windGain = normalScore - alternativeScore;

    if(windGain > 3 && alternativeTime < normalTime * 1.2){
        return "alternative";
    }

    return "normal";
}
 alert("Calcul wind gain");
function calculateWindGain(scoreNormal, scoreAlternative){
    if(scoreNormal <= 0){
        return 0;
    }
    const gain = ((scoreNormal - scoreAlternative) / scoreNormal) * 100;
    return Math.max(0, gain);
}
 alert("Draw color route");
function drawWindRoute(latlngs){
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        const cost = windCost(direction, currentWindDirection, currentWindSpeed);

        let color = "green";
        if(cost > 20) color = "red";
        else if(cost > 8) color = "orange";

        // ✅ PLUS BESOIN D'INVERSER : Les points [Lat, Lng] fournis par decodePolyline sont parfaits
        const line = L.polyline(
            [latlngs[i], latlngs[i+1]],
            {
                color: color,
                weight: 4,       
                opacity: 0.5,    
                pane: 'overlayPane' 
            }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}
 alert("draw gray route");
function drawGrayRoute(latlngs){
    // ✅ PLUS BESOIN DE .map() : Le tableau est déjà prêt à 100% pour Leaflet
    const line = L.polyline(
        latlngs,
        {
            color: "gray",
            weight: 3,       
            opacity: 0.5,    
            pane: 'overlayPane'
        }
    ).addTo(window.routeGroup);

    routeLayers.push(line);
}

//===================================================================================================================
// Calcul trajet principaux
// Calcul trajet principaux (Première partie corrigée et unifiée)
 alert("Definir destination");
async function getRoute(){
    if(!window.userPosition){
        alert("Définissez votre position d'abord");
        return;
    }
    if(!window.destination){
        alert("Choisissez une destination dans la liste");
        return;
    }
    
    const start = {   
        lat: window.userPosition[0],
        lng: window.userPosition[1]
    };
    
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    alert("getAlternative route appelé");

    if (!allRoutesData || !allRoutesData.routes || allRoutesData.routes.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalRouteObj = allRoutesData.routes[0];
    const latlngsNormal = L.LineUtil.decodePolyline(normalRouteObj.geometry);

    let latlngsAlternative = latlngsNormal; 
    let alternativeRouteObj = normalRouteObj;

    window.routeGroup.clearLayers();

    if (allRoutesData.routes.length > 1) {
        alternativeRouteObj = allRoutesData.routes[1];
        latlngsAlternative = L.LineUtil.decodePolyline(alternativeRouteObj.geometry);
        drawGrayRoute(latlngsAlternative);
        alert("Draw gray route");
    } else {
        alert("L'API n'a pas pu générer de route alternative viable pour ce trajet.");
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => L.latLng(p));
    
    const pA = latlngsNormal[0];
    const pB = latlngsNormal[1];

    const ptA = [
        pA.lat !== undefined ? pA.lat : pA[0],
        pA.lng !== undefined ? pA.lng : pA[1]
    ];
    const ptB = [
        pB.lat !== undefined ? pB.lat : pB[0],
        pB.lng !== undefined ? pB.lng : pB[1]
    ];
    
    const firstDir = getSegmentDirection(ptA, ptB);
    await getWind(start.lat, start.lng, firstDir);
    
    drawWindRoute(latlngsNormal);
    alert("Draw color route");

    const normalScore = calculateWindScore(latlngsNormal, normalRouteObj);
    const alternativeScore = calculateWindScore(latlngsAlternative, alternativeRouteObj);

    const routesArrayMock = { duration: normalRouteObj.summary.duration };
    const alternativeMock = { duration: alternativeRouteObj.summary.duration };

    const choice = chooseBestRoute(routesArrayMock, alternativeMock, normalScore, alternativeScore);
    const windGain = calculateWindGain(normalScore, alternativeScore);

    // ==============================================================================================================================
    // --- CONFIGURATION DE L'AFFICHAGE DYNAMIQUE (La contradiction est supprimée, la logique est isolée ici) ---
    function updateWindText(currentView, activeScore) {
        const routeActive = currentView === "normale" ? normalRouteObj : alternativeRouteObj;
        const distanceKm = (routeActive.summary.distance / 1000).toFixed(1);
        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;

        let gainText = "";
        let dynamiqueRecommendation = "";
               
        if (allRoutesData.routes.length <= 1) {
            gainText = "🌬️ Aucune route alternative disponible";
            dynamiqueRecommendation = "🚴 Seul trajet trouvé";
        } 
        else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente sur les deux trajets";
            dynamiqueRecommendation = currentView === "alternative" ? "🚴 Trajet équivalent, mais route initiale plus directe" : "🚴 CycloWind recommande ce trajet initial";
        } 
        else if (rawGain >= 5) { 
             gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;
             dynamiqueRecommendation = currentView === "alternative" ? "🌱 Route assez protégée" : "💡 Voir l'Alternative abritée";
        } 
        else {
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;
            dynamiqueRecommendation = currentView === "alternative" ? "⚠️ Route alternative plus exposée" : "🚴 Trajet initial bien plus abrité";
        }

        document.getElementById("windInfo").innerHTML = `
           <strong>${dynamiqueRecommendation}</strong>
            <br>
            📍 Vue : Route ${currentView}
            <br>
            📏 Distance : ${distanceKm} km
            <br>
            ${gainText}
            <br>
            📊 Indice effort vent : ${activeScore.toFixed(1)}
        `;
    }

    // --- INITIALISATION DE L'AFFICHAGE ET DE LA CARTE ---
    updateWindText("normale", normalScore);

    if (latlngsNormal && latlngsNormal.length > 0) {
        const bounds = L.latLngBounds(latlngsNormal);
        const paddingLeaflet = L.point(50, 50);
        window.map.fitBounds(bounds, { padding: paddingLeaflet, maxZoom: 15 }); 
    }

    // --- LOGIQUE DU BOUTON TOGGLE ---
    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (allRoutesData.routes.length > 1) {
        toggleBtn.style.display = "block";
        let showingAlternative = false;
        toggleBtn.innerText = "Voir la route alternative";

        toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = []; }

            if (!showingAlternative) {
                drawWindRoute(window.latlngsAlternativePersist);
                drawGrayRoute(window.latlngsNormalPersist); 
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
                drawWindRoute(window.latlngsNormalPersist);
                drawGrayRoute(window.latlngsAlternativePersist); 
                toggleBtn.innerText = "Voir la route alternative";
                updateWindText("normale", normalScore);
                showingAlternative = false;
            }
        };
    } else {
        toggleBtn.style.display = "none";
    }

    window.drawWindRoute = drawWindRoute;
} // <- ✅ ICI ! Cette accolade ferme officiellement et proprement la fonction getRoute() au bon endroit !

//==============================================================================================================================================
// 🔥 VERSION INFAILLIBLE : Plus aucune accolade en fin de fonction pour stopper les crashs !
function startNavigation() {
    const btn = document.getElementById("startNavBtn");
    if (!btn) return;

    let windInfoPanel = document.querySelector(".wind-container-right") || document.getElementById("windInfo");

    if (!window.userPosition) {
        alert("Position GPS non détectée. Impossible de démarrer.");
        return;
    }

    if (!window.isNavigating) {
        window.isNavigating = true;
        btn.innerText = "Arrêter";
        btn.style.backgroundColor = "#e74c3c";
        
        if (windInfoPanel) windInfoPanel.classList.add("nav-hidden");
        
        window.currentNavZoom = 17;
        window.map.setView(window.userPosition, window.currentNavZoom);

        setTimeout(function() { window.map.panBy([0, -140], { animate: true }); }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71";

        if (windInfoPanel) windInfoPanel.classList.remove("nav-hidden");
        
        // Écriture en une seule ligne : Leaflet applique le fitBounds de secours sans aucune coupure
        if (window.latlngsNormalPersist) window.map.fitBounds(L.latLngBounds(window.latlngsNormalPersist));
    }
}
