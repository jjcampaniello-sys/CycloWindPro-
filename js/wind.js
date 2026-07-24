/* ============================================================
WINDS.JS
Gestion de la météo et affichage du vent sur Leaflet
============================================================ */

/* ============================================================
VARIABLES GLOBALES
============================================================ */

window.currentWindSpeed =
0;

window.currentWindDirection =
0;

window.windControl =
null;

/* ============================================================
CONVERSION DIRECTION -> TEXTE
============================================================ */

function windDirectionText(
deg
) {

const directions = [

    "N",

    "NE",

    "E",

    "SE",

    "S",

    "SO",

    "O",

    "NO"

];


const normalizedDeg =
    (
        Number(deg) + 360
    ) % 360;


const index =
    Math.round(
        normalizedDeg / 45
    ) % 8;


return directions[index];


}

/* ============================================================
EFFET DU VENT SUR LE TRAJET
============================================================ */

function windEffect(
rideDirection,
windDirection
) {


let angle =
    Math.abs(
        Number(rideDirection) -
        Number(windDirection)
    );


if (
    angle > 180
) {

    angle =
        360 - angle;

}


if (
    angle < 45
) {

    return "💨 Vent de face";

}


if (
    angle > 135
) {

    return "🚴 Vent favorable";

}


return "↔️ Vent latéral";


}

/* ============================================================
COÛT DU VENT
============================================================ */

function windCost(
roadDirection,
windDirection,
windSpeed
) {


/*
 * Si les données météo ne sont pas disponibles,
 * on retourne un coût neutre.
 */
if (
    windDirection === undefined ||
    windDirection === null ||
    windSpeed === undefined ||
    windSpeed === null
) {

    return 0;

}


let angle =
    Math.abs(
        Number(roadDirection) -
        Number(windDirection)
    );


if (
    angle > 180
) {

    angle =
        360 - angle;

}


/*
 * Vent de face.
 */
if (
    angle < 45
) {

    return (
        Number(windSpeed) * 2
    );

}


/*
 * Vent latéral.
 */
if (
    angle < 135
) {

    return (
        Number(windSpeed) * 0.5
    );

}


/*
 * Vent favorable.
 */
return 0;
```

}

/* ============================================================
CRÉATION DU CONTRÔLE VENT
============================================================ */

function createWindControl(
rideDirection
) {

/*
 * Suppression du contrôle précédent.
 */
if (
    window.windControl &&
    window.map
) {

    try {

        window.map.removeControl(
            window.windControl
        );

    } catch (error) {

        console.warn(
            "Impossible de supprimer l'ancien contrôle vent.",
            error
        );

    }

}


/*
 * Vérification de la carte.
 */
if (
    !window.map
) {

    console.warn(
        "Carte Leaflet indisponible."
    );

    return;

}


/*
 * Création du nouveau contrôle.
 */
window.windControl =
    L.control(
        {
            position:
                "topright"
        }
    );


window.windControl.onAdd =
    function() {

        const div =
            L.DomUtil.create(
                "div",
                "wind-box"
            );


        /*
         * Empêche les clics sur
         * le contrôle de perturber
         * la carte.
         */
        L.DomEvent.disableClickPropagation(
            div
        );


        const speed =
            Number(
                window.currentWindSpeed || 0
            );


        const direction =
            Number(
                window.currentWindDirection || 0
            );


        div.innerHTML = `

            <div
                class="wind-arrow"
                style="
                    transform:
                    rotate(${direction + 180}deg)
                "
            >
                ➤
            </div>

            <div>

                <strong>
                    ${Math.round(speed)} km/h
                </strong>

                <br>

                Vent :
                ${windDirectionText(direction)}

                <br>

                ${windEffect(
                    rideDirection,
                    direction
                )}

            </div>

        `;


        return div;

    };


window.windControl.addTo(
    window.map
);


}

/* ============================================================
RÉCUPÉRATION DE LA MÉTÉO
============================================================ */

async function getWind(
lat,
lon,
rideDirection
) {


try {

    console.log(
        "Récupération du vent...",
        {
            lat,
            lon,
            rideDirection
        }
    );


    const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&current=wind_speed_10m%2Cwind_direction_10m`;


    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "Erreur météo HTTP : " +
            response.status
        );

    }


    const data =
        await response.json();


    console.log(
        "Réponse Open-Meteo :",
        data
    );


    /*
     * Vérification des données.
     */
    if (
        !data ||
        !data.current
    ) {

        throw new Error(
            "Réponse météo invalide."
        );

    }


    /*
     * Mise à jour globale.
     */
    window.currentWindSpeed =
        Number(
            data.current.wind_speed_10m
        );


    window.currentWindDirection =
        Number(
            data.current.wind_direction_10m
        );


    console.log(
        "Vent actuel :",
        window.currentWindSpeed,
        "km/h",
        window.currentWindDirection,
        "°"
    );


    /*
     * Création / remplacement
     * du panneau Leaflet.
     */
    createWindControl(
        rideDirection
    );


    return {

        speed:
            window.currentWindSpeed,

        direction:
            window.currentWindDirection

    };


} catch (error) {

    console.error(
        "Erreur récupération du vent :",
        error
    );


    /*
     * On conserve des valeurs neutres
     * pour éviter de casser le calcul
     * des routes.
     */
    window.currentWindSpeed =
        0;


    window.currentWindDirection =
        0;


    /*
     * On affiche quand même le panneau
     * avec une information neutre.
     */
    try {

        createWindControl(
            rideDirection
        );

    } catch (
        controlError
    ) {

        console.error(
            "Erreur création contrôle vent :",
            controlError
        );

    }


    alert(
        "Erreur récupération du vent."
    );


    return {

        speed:
            0,

        direction:
            0

    };

}


}

/* ============================================================
EXPORT GLOBAL
============================================================ */

window.windDirectionText =
windDirectionText;

window.windEffect =
windEffect;

window.windCost =
windCost;

window.getWind =
getWind;
    }

    if (angle > 135) {
        return "🚴 Vent favorable";
    }

    return "↔️ Vent latéral";
}


// Coût du vent
function windCost(roadDirection, windDirection, windSpeed) {
// Si les données météo ne sont pas encore arrivées, on renvoie un coût neutre pour ne pas crasher
    if (windDirection === undefined || windSpeed === undefined) return 0;
    
    let angle = Math.abs(roadDirection - windDirection);

    if (angle > 180) {
        angle = 360 - angle;
    }

    if (angle < 45) {
        return windSpeed * 2;
    }

    if (angle < 135) {
        return windSpeed * 0.5;
    }

    return 0;
}


// Récupération météo
async function getWind(lat, lon, rideDirection) {

    try {

        const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m%2Cwind_direction_10m`;

        const response = await fetch(url);
        const data = await response.json();

      // Enregistrement sécurisé dans les variables partagées de l'application
        window.currentWindSpeed = data.current.wind_speed_10m;
        window.currentWindDirection = data.current.wind_direction_10m;


        if (windControl) {
            map.removeControl(windControl);
        }


        windControl = L.control({
            position: "topright"
        });


        windControl.onAdd = function() {

            const div = L.DomUtil.create(
                "div",
                "wind-box"
            );


            div.innerHTML = `
            <div class="wind-arrow"
            style="transform:rotate(${currentWindDirection + 180}deg)">
            ➤
            </div>

            <div>
            ${Math.round(currentWindSpeed)} km/h<br>
Vent ${windDirectionText(currentWindDirection)}<br>
            ${windEffect(
                rideDirection,
                currentWindDirection
            )}
            </div>
            `;


            return div;
        };


        windControl.addTo(map);


    }
    catch(error) {

        console.log(error);
        alert("Erreur récupération du vent");
    }
}

