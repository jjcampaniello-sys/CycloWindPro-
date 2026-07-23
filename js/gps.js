// gps.js

let currentHeading = 0;
let gpsWatchId = null;
let isFirstLoad = true;

window.isNavigating = false;


function startGPS(){
    if(!navigator.geolocation){
        alert("GPS non disponible");
        return;
    }

    gpsWatchId = navigator.geolocation.watchPosition(
        onPositionUpdate,
        function(error){
            alert("Erreur GPS : " + error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}

function startCompass(){
    window.addEventListener("deviceorientation", function(event){
        if(event.alpha !== null){
            currentHeading = 360 - event.alpha;
            updateBikeArrow();
        }
    }, true);
}

function onPositionUpdate(position){
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // Stockage dans les variables globales pour route.js
    window.userLat = lat;
    window.userLon = lon;
    window.userPosition = Array(lat, lon);
    
    console.log("Position stockée :", lat, lon);

    if(!window.map){
        console.error("map NON prête");
        return;
    }

    updateBikeArrowPosition(lat, lon);

    if (isFirstLoad) {
        window.map.setView([lat, lon], 19);
        isFirstLoad = false;
    }

     // 2. 🔥 SUIVI EN NAVIGATION RECENTRÉ MAIS SANS FORCER LE ZOOM
    if (window.isNavigating) {
        // On récupère le zoom actuel de l'écran choisi par l'utilisateur. 
        // Si aucun itinéraire n'est encore lancé, on utilise 19 par défaut.
        const zoomActuel = window.map.getZoom();
        window.currentNavZoom = zoomActuel || 19;

        // On recentre sur le cycliste en respectant STRICTEMENT le zoom qu'il a choisi à l'écran !
        window.map.setView([lat, lon], window.currentNavZoom, { animate: false });
        window.map.panBy([0, -5], { animate: false });
    }
}

function updateBikeArrowPosition(lat, lon){
    if(!window.bikeArrow){
        // Utilisation de variables d'affichage sécurisées
        const dimensionsIcone = Array(40, 40);
        const ancrageIcone = Array(20, 20);

        window.bikeArrow = L.marker([lat, lon], {
            icon: L.divIcon({
                className: "bike-icon",
                html: `<div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">➤</div>`,
                iconSize: dimensionsIcone,
                iconAnchor: ancrageIcone
            })
        }).addTo(window.map);
    } else {
        window.bikeArrow.setLatLng([lat, lon]);
        updateBikeArrow();
    }
}

function updateBikeArrow(){
    if(!window.bikeArrow) return;
    
    const dimensionsIcone = Array(40, 40);
    const ancrageIcone = Array(20, 20);

    const icon = L.divIcon({
        className: "bike-icon",
        html: `<div style="transform:rotate(${currentHeading}deg); font-size:32px; color:blue;">➤</div>`,
        iconSize: dimensionsIcone,
                iconAnchor: ancrageIcone
    });

    window.bikeArrow.setIcon(icon);
}
