alert("getRoute lancé");
// Direction segment route
function getSegmentDirection(p1, p2){
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if(angle < 0){
        angle += 360;
    }

    return angle;
}

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://api.openrouteservice.org/v2/directions/cycling-regular";
  
    const body = {
        coordinates: [
            [start.lng, start.lat],
            [endLon, endLat]
        ],
        alternative_routes: {
            target_count: 3,    
            share_factor: 0.4,  
            weight_factor: 1.8  
        },
    extra_info: ["waytype", "surface"]   
};

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
     // ✅ CORRIGÉ POUR LE FORMAT STANDARD : On affiche le résumé de la première route calculée
    if (data && data.routes && data.routes[0]) {
        alert("API Réponse Ok ! Résumé route : " + JSON.stringify(data.routes[0].summary));
    } else {
        alert("Erreur : L'API n'a pas renvoyé de tableau 'routes'. " + JSON.stringify(data));
    }
    return data; 
}
function extractSegments(routeObj){
    const forestSegments = new Set();
    const residentialSegments = new Set();

     // 🔥 CORRECTIF : Dans le format standard, les extras sont stockés dans le premier segment
    if (!routeObj || !routeObj.segments || !routeObj.segments[0] || !routeObj.segments[0].extras) {
    alert("Pas d'extras disponibles");
    return {forestSegments, residentialSegments};
}

const extras = routeObj.segments[0].extras;
 
     if(extras.waytype && extras.waytype.values){
        extras.waytype.values.forEach(v => {

            const from = v[0];
            const to = v[1];
            const type = v[2];

            // 🌳 chemins nature / forêt
          if(type === 3 || type === 10){
                for(let i = from; i <= to; i++){
                    forestSegments.add(i);
                }
            }

            // 🏠 zones résidentielles
            if(type === 1 || type === 2){
                for(let i = from; i <= to; i++){
                    residentialSegments.add(i);
                }
            }
        });
    }
    // Analyse secondaire via les revêtements (surface) pour renforcer la détection des bois
    if(extras.surface && extras.surface.values){
        extras.surface.values.forEach(v => {
            const from = v[0];
            const to = v[1];
            const surfaceType = v[2];
            // Codes >= 5 = Terre, gravier, herbe (Zones vertes arborées naturelles)
            if(surfaceType >= 5){
                for(let i = from; i <= to; i++){
                    forestSegments.add(i);
                }
            }
        });
    }
// ✅ DEBUG ICI
const debugDiv = document.getElementById("debug");

if (debugDiv) {
    debugDiv.innerHTML = `
        🌲 Segments forêt: ${forestSegments.size}<br>
        🏠 Segments résidentiel: ${residentialSegments.size}
    `;
}
    return {forestSegments, residentialSegments};
}
function calculateWindScore(latlngs, routeObj){

    const {forestSegments, residentialSegments} = extractSegments(routesObj);

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

function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore){
    const normalTime = normalRoute.summary.duration;
    const alternativeTime = alternativeRoute.summary.duration;

    const windGain = normalScore - alternativeScore;

    if(windGain > 3 && alternativeTime < normalTime * 1.2){
        return "alternative";
    }

    return "normal";
}

function calculateWindGain(scoreNormal, scoreAlternative){
    if(scoreNormal <= 0){
        return 0;
    }
    const gain = ((scoreNormal - scoreAlternative) / scoreNormal) * 100;
    return Math.max(0, gain);
}

function drawWindRoute(latlngs){
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(
            latlngs[i],
            latlngs[i+1]
        );

        const cost = windCost(
            direction,
            currentWindDirection,
            currentWindSpeed
        );

        let color;
        if(cost > 20){
            color = "red";
        }
        else if(cost > 8){
            color = "orange";
        }
        else{
            color = "green";
        }
// 🔥 CORRECTIF : On extrait proprement la Latitude [0] et la Longitude [1] 
        // de chaque point pour créer un format [Lat, Lng] que Leaflet comprend à 100%
        const pointA = [latlngs[i][0], latlngs[i][1]];
        const pointB = [latlngs[i+1][0], latlngs[i+1][1]];
        
         const line = L.polyline(
            [pointA, pointB], // On passe les points corrigés [Lat, Lng]
            {
                color: color,
                weight: 4,       // 🔥 CORRECTION : Ligne plus fine (au lieu de 6)
                opacity: 0.5,    // 🔥 AJOUT : Légère transparence pour voir les écritures en dessous
                pane: 'overlayPane' // Force le tracé dans la couche des superpositions de Leaflet
            }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}

function drawGrayRoute(latlngs){
    // 🔥 CORRECTIF : On inverse chaque coordonnée pour passer du format API [Lon, Lat] 
    // au format attendu par Leaflet [Lat, Lon]
    const latlngsCorriges = latlngs.map(point => [point[1], point[0]]);
    
    const line = L.polyline(
        latlngsCorriges,
        {
            color: "gray",
            weight: 3,       // 🔥 CORRECTION : Alternative encore plus discrète (au lieu de 5)
            opacity: 0.5,    // 🔥 AJOUT : Transparence à 50%
            pane: 'overlayPane'
        }
    ).addTo(window.routeGroup);

    routeLayers.push(line);
}

// Calcul trajet principaux
async function getRoute(){
    
    if(!window.userPosition){
        alert("Définissez votre position d'abord");
        return;
    }
    
    if(!window.destination){
        alert("Choisissez une destination dans la liste");
        return;
    }
    
    // 🔥 Sécurisation des index : Index 0 = Latitude, Index 1 = Longitude selon votre gps.js
    const start = {   
        lat: window.userPosition[0],
        lng: window.userPosition[1]
    };
    
       const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
  // AllRoutesData contient désormais un tableau nommé "routes"
    if (!allRoutesData || !allRoutesData.routes || allRoutesData.routes.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalRouteObj = allRoutesData.routes[0];
    // Dans le format standard, les coordonnées sont déjà rangées dans l'ordre [Latitude, Longitude]
    const coordsNormal = normalRouteObj.geometry.coordinates;
    // ✅ CORRECTIF 1 : Inversion indispensable [1] = Latitude, [0] = Longitude pour Leaflet
    const latlngsNormal = coordsNormal.map(point => [point[1], point[0]]);

    let latlngsAlternative = latlngsNormal; 
    let alternativeRouteObj = normalRouteObj;

    if (allRoutesData.routes.length > 1) {
        alternativeRouteObj = allRoutesData.routes[1];
        const coordsAlt = alternativeRouteObj.geometry.coordinates;
        // ✅ CORRECTIF 1 (bis) : Inversion également sur la route alternative
        latlngsAlternative = coordsAlt.map(point => [point[1], point[0]]);
        drawGrayRoute(latlngsAlternative);
    } else {
        console.log("L'API n'a pas pu générer de route alternative viable pour ce trajet.");
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p[0], lng: p[1] }));

    const firstDir = getSegmentDirection(latlngsNormal[0], latlngsNormal[1]);
    await getWind(start.lat, start.lng, firstDir);
    
    drawWindRoute(latlngsNormal);

// On remplace les anciens appels par ceux-ci :
    const normalScore = calculateWindScore(latlngsNormal, normalRouteObj);
    const alternativeScore = calculateWindScore(latlngsAlternative, alternativeRouteObj);

    // ✅ CORRECTIF 2 : Nettoyage des variables fantômes, accès direct via summary.duration
    const routesArrayMock = { duration: normalRouteObj.summary.duration };
    const alternativeMock = { duration: alternativeRouteObj.summary.duration };

    const choice = chooseBestRoute(
        routesArrayMock,
        alternativeMock,
        normalScore,
        alternativeScore
    );

    const windGain = calculateWindGain(normalScore, alternativeScore);

    let recommendation = choice === "alternative" && allRoutesData.routes.length > 1
        ? "🌱 CycloWind recommande l'alternative (Mieux abritée)"
        : "🚴 CycloWind recommande ce trajet (Plus abrité ou rapide)" ;

    // --- CONFIGURATION DE L'AFFICHAGE DYNAMIQUE ---
           function updateWindText(currentView, activeScore) {
       // ✅ CORRIGÉ 1 : Remplacement par les nouveaux objets de routes valides
        const routeActive = currentView === "normale" ? normalRouteObj : alternativeRouteObj;
        
        // ✅ CORRIGÉ 2 : Accès direct à summary.distance sans passer par .properties
        const distanceKm = (routeActive.summary.distance / 1000).toFixed(1);

        // --- CALCUL DE LA DIFFÉRENCE RÉELLE ---
        // (Score Normal - Score Alternatif) / Score Normal * 100
        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;

        let gainText = "";
        let dynamiqueRecommendation = "";
               
        if (allRoutesData.routes.length <= 1) {
            // Cas 1 : L'API n'a pas trouvé d'autre rue physique
            gainText = "🌬️ Aucune route alternative disponible";
            dynamiqueRecommendation = "🚴 Seul trajet trouvé";
        } 
        // 🔥 AJUSTEMENT ICI : Si l'écart est inférieur à 5% (en plus ou en moins), les routes sont jugées ÉGALES
        else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente sur les deux trajets";
            dynamiqueRecommendation = currentView === "alternative" 
                ? "🚴 Trajet équivalent, mais route initiale plus directe"
                : "🚴 CycloWind recommande ce trajet initial";
        } 
        else if (rawGain >= 5) { 
            // Cas 3 : L'alternative est MEILLEURE (Gain positif)
             gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;
            dynamiqueRecommendation = currentView === "alternative"
            ? "🌱  Route assez protégée"
                : "💡 voir l'Alternative abritée";
        } 
        else {
            // Cas 4 : L'alternative est MOINS BONNE (Gain négatif)
            // On utilise Math.abs() pour transformer le chiffre négatif (ex: -15) en positif (ex: 15)
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;
            dynamiqueRecommendation = currentView === "alternative" 
            ? "⚠️ Route alternative plus exposée"
                : "🚴 Trajet initial bien plus abrité";
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



    updateWindText("normale", normalScore);

    if (latlngsNormal && latlngsNormal.length > 0) {
        const bounds = L.latLngBounds(latlngsNormal);
        window.map.fitBounds(bounds, { padding: [50, 50] }); 
    }

    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (allRoutesData.routes.length > 1) {
        toggleBtn.style.display = "block";
        let showingAlternative = false;
        toggleBtn.innerText = "Voir la route alternative";

               toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = []; }

            if (!showingAlternative) {
                // L'utilisateur veut voir l'alternative
                drawWindRoute(window.latlngsAlternativePersist);
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
                // L'utilisateur revient à la route normale
                drawWindRoute(window.latlngsNormalPersist);
                toggleBtn.innerText = "Voir la route alternative";
                updateWindText("normale", normalScore);
                showingAlternative = false;
            }
        };
    } else {
        toggleBtn.style.display = "none";
    }

    window.drawWindRoute = drawWindRoute;
}

// 🔥 AJOUT DE LA FONCTION DE NAVIGATION SÉCURISÉE EN PIXELS (Pour Apple & Android)
function startNavigation() {
    const btn = document.getElementById("startNavBtn");
    if (!btn) return;

    // 🔥 CORRECTIF : On cible d'abord le conteneur global droit s'il existe, sinon l'ID windInfo directement
    let windInfoPanel = document.querySelector(".wind-container-right");
    if (!windInfoPanel) {
        windInfoPanel = document.getElementById("windInfo");
    }

    if (!window.userPosition) {
        alert("Position GPS non détectée. Impossible de démarrer.");
        return;
    }

    if (!window.isNavigating) {
        window.isNavigating = true;
        btn.innerText = "Arrêter";
        btn.style.backgroundColor = "#e74c3c"; // Rouge
        
 // 🔥 MODIFICATION : On AJOUTE la classe pour faire DISPARAÎTRE l'encadré de suite au clic
        if (windInfoPanel) {
            windInfoPanel.classList.add("nav-hidden");
        }
        
        // 🔥 INITIALISATION DU ZOOM MÉMOIRE : 17 au premier clic
        window.currentNavZoom = 18;
        window.map.setView(window.userPosition, window.currentNavZoom);

        // 2. Glissement physique de l'écran en pixels pour remonter la flèche bleue
        setTimeout(() => {
            window.map.panBy([0, -140], { animate: true });
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; // Vert

         // 🔥 MODIFICATION : On RETIRE la classe pour faire RÉAPPARAÎTRE l'encadré au clic sur Arrêter
        if (windInfoPanel) {
            windInfoPanel.classList.remove("nav-hidden");
        }

        if (window.latlngsNormalPersist) {
            window.map.fitBounds(L.latLngBounds(window.latlngsNormalPersist), { 
                padding: [50, 50] 
            });
        }
    }
}
