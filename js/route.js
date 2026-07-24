alert("getRoute lancé");
// Direction segment route
function getSegmentDirection(p1, p2){
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

     if(angle < 0){
        angle += 360;
      }  
          // 🔥 LE CORRECTIF CHIRURGICAL : On retourne l'angle de la rue à 180°
    // pour compenser l'inversion géométrique d'OpenRouteService
    angle = (angle + 180) % 360;

    return angle;
}
//========================================================================================================
async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://api.openrouteservice.org/v2/directions/cycling-regular";
  
    const body = {
        format: "geojson",
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

function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore){
    const normalTime = normalRoute.duration;
    const alternativeTime = alternativeRoute.duration;

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
    
    // ✅ CORRECTIF 1 : Utilisation du tableau officiel .routes à la place de .features
    if (!allRoutesData || !allRoutesData.routes || allRoutesData.routes.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalRouteObj = allRoutesData.routes[0];
    
    // ✅ DECODAGE LEAFLET : Traduit instantanément le texte crypté en tableau [Latitude, Longitude]
    const latlngsNormal = L.LineUtil.decodePolyline(normalRouteObj.geometry);

    let latlngsAlternative = latlngsNormal; 
    let alternativeRouteObj = normalRouteObj;

    window.routeGroup.clearLayers();

    // ✅ RECADRAGE DES ACCOLADES : Tout le bloc alternatif est maintenant bien rangé au bon endroit
    if (allRoutesData.routes.length > 1) {
        alternativeRouteObj = allRoutesData.routes[1];
        // ✅ Décodage également de la route alternative en [Latitude, Longitude]
        latlngsAlternative = L.LineUtil.decodePolyline(alternativeRouteObj.geometry);
        
        // Trace l'alternative grise en fond
        drawGrayRoute(latlngsAlternative);
    } else {
        console.log("L'API n'a pas pu générer de route alternative viable pour ce trajet.");
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    
    // ✅ NETTOYAGE : Les points étant déjà [Lat, Lng], on les stocke directement sans ré-inverser
                               //window.currentRoute = latlngsNormal.map(p => ({ lat: p[0], lng: p[1] }));

    window.currentRoute = latlngsNormal.map(p => L.latLng(p));
    
    const firstDir = getSegmentDirection(latlngsNormal[0], latlngsNormal[1]);
    await getWind(start.lat, start.lng, firstDir);
    
    // Dessine la route principale en couleur (elle gère sa propre inversion)
    drawWindRoute(latlngsNormal);

    // ✅ CORRECTIF 3 : Transmission des objets de routes officiels aux calculs de scores d'abris
    const normalScore = calculateWindScore(latlngsNormal, normalRouteObj);
    const alternativeScore = calculateWindScore(latlngsAlternative, alternativeRouteObj);

    // ✅ CORRECTIF 4 : Extraction du temps via le sous-objet .summary officiel du format standard
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
        ? "🌱 CycloWind recommande l'alternative"
        : "🚴 CycloWind recommande ce trajet";

//==============================================================================================================================
     // --- CONFIGURATION DE L'AFFICHAGE DYNAMIQUE ---
    function updateWindText(currentView, activeScore) {
        // ✅ CORRIGÉ : Utilisation des nouveaux objets de routes valides
        const routeActive = currentView === "normale" ? normalRouteObj : alternativeRouteObj;
        
        // ✅ CORRIGÉ : Accès direct à summary.distance sans passer par .properties
        const distanceKm = (routeActive.summary.distance / 1000).toFixed(1);

        // --- CALCUL DE LA DIFFÉRENCE RÉELLE ---
        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;

        let gainText = "";
        let dynamiqueRecommendation = "";
               
        if (allRoutesData.routes.length <= 1) {
            gainText = "🌬️ Aucune route alternative disponible";
            dynamiqueRecommendation = "🚴 Seul trajet trouvé";
        } 
        else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente sur les deux trajets";
            dynamiqueRecommendation = currentView === "alternative" 
                ? "🚴 Trajet équivalent, mais route initiale plus directe"
                : "🚴 CycloWind recommande ce trajet initial";
        } 
        else if (rawGain >= 5) { 
             gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;
             dynamiqueRecommendation = currentView === "alternative"
                ? "🌱  Route assez protégée"
                : "💡 voir l'Alternative abritée";
        } 
        else {
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

    // --- INITIALISATION DE L'AFFICHAGE ET DE LA CARTE ---
    updateWindText("normale", normalScore);

    if (latlngsNormal && latlngsNormal.length > 0) {
        const bounds = L.latLngBounds(latlngsNormal);
        // ✅ CORRECTIF : Utilisation de L.point(50, 50) pour empêcher le système de casser vos crochets
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
                drawGrayRoute(window.latlngsNormalPersist); // Maintient la principale en gris
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
                drawWindRoute(window.latlngsNormalPersist);
                drawGrayRoute(window.latlngsAlternativePersist); // Remet l'alternative en gris
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
