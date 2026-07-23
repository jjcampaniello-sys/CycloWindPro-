// route.js - Trajet CycloWind 100% sans aucun crochet pour éviter les bugs de syntaxe

function getSegmentDirection(p1, p2){
    // Remplacement des crochets par .at() -> index 0 = Latitude, index 1 = Longitude selon votre gps.js
    const dy = p2.at(0) - p1.at(0);
    const dx = p2.at(1) - p1.at(1);
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if(angle < 0){
        angle += 360;
    }

    return angle;
}

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://openrouteservice.org";
  
    // Reconstruction des paires de coordonnées sans crochets via Array()
    const indexLongitude = start.lng;
    const indexLatitude = start.lat;
    
    const coordStart = Array(indexLongitude, indexLatitude);
    const coordEnd = Array(endLon, endLat);
    const listeCoords pour Requete = Array(coordStart, coordEnd);

    const body = {
        coordinates: listeCoords pour Requete,
        alternative_routes: {
            target_count: 3,    
            share_factor: 0.4,  
            weight_factor: 1.8  
        }
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
    return data; 
}

function calculateWindScore(latlngs, estUneRueAbritee = false){
    let totalCost = 0;
    let count = 0;

    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs.at(i), latlngs.at(i+1));
        let cost = windCost(direction, currentWindDirection, currentWindSpeed);

        if (estUneRueAbritee) {
            cost = cost * 0.7; // Bonus abri de 30% si mot-clé détecté par search.js
        }

        totalCost += cost;
        count++;
    }

    return totalCost / count;
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
    if(scoreNormal <= 0) return 0;
    const gain = ((scoreNormal - scoreAlternative) / scoreNormal) * 100;
    return Math.max(0, gain);
}

function drawWindRoute(latlngs){
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs.at(i), latlngs.at(i+1));
        const cost = windCost(direction, currentWindDirection, currentWindSpeed);

        let color = "green";
        if(cost > 20) color = "red";
        else if(cost > 8) color = "orange";

        const line = L.polyline(
            Array(latlngs.at(i), latlngs.at(i+1)),
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
    const line = L.polyline(latlngs, { color: "gray", weight: 3, opacity: 0.5, pane: 'overlayPane' }).addTo(window.routeGroup);
    routeLayers.push(line);
}

// Calcul trajet principaux
async function getRoute(){
    alert("getRoute démarré");
    if(!window.userPosition){
        alert("Définissez votre position d'abord");
        return;
    }
    
    if(!window.destination){
        alert("Choisissez une destination dans la liste");
        return;
    }
    
    // Utilisation des variables d'extraction dédiées créées dans votre gps.js
    const start = {   
        lat: window.userLat,
        lng: window.userLon
    };
    
    alert("Départ validé : " + start.lat + " / " + start.lng);
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData || !allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features.at(0);
    const coordsNormal = normalFeature.geometry.coordinates;
    
    // Inversion des index ORS [Longitude, Latitude] -> Leaflet [Latitude, Longitude] avec .at()
    const latlngsNormal = coordsNormal.map(point => Array(point.at(1), point.at(0)));

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;

    if (allRoutesData.features.length > 1) {
        alternativeFeature = allRoutesData.features.at(1);
        const coordsAlt = alternativeFeature.geometry.coordinates;
        latlngsAlternative = coordsAlt.map(point => Array(point.at(1), point.at(0)));
        drawGrayRoute(latlngsAlternative);
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p.at(0), lng: p.at(1) }));

    const firstDir = getSegmentDirection(latlngsNormal.at(0), latlngsNormal.at(1));
    await getWind(start.lat, start.lng, firstDir);
    
    window.routeGroup.clearLayers();
    drawWindRoute(latlngsNormal);

    // Lecture du bonus d'adresse
    const estAbritee = window.destination.isResidential || false;

    const normalScore = calculateWindScore(latlngsNormal, estAbritee);
    const alternativeScore = calculateWindScore(latlngsAlternative, estAbritee);

    const routesArrayMock = { duration: normalFeature.properties.summary.duration };
    const alternativeMock = { duration: alternativeFeature.properties.summary.duration };

    const choice = chooseBestRoute(
        routesArrayMock,
        alternativeMock,
        normalScore,
        alternativeScore
    );

    const windGain = calculateWindGain(normalScore, alternativeScore);

    let recommendation = choice === "alternative" && allRoutesData.features.length > 1
        ? "🌱 CycloWind recommande l'alternative"
        : "🚴 CycloWind recommande ce trajet";

    function updateWindText(currentView, activeScore) {
        const featureActive = currentView === "normale" ? normalFeature : alternativeFeature;
        const distanceKm = (featureActive.properties.summary.distance / 1000).toFixed(1);
        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;
        let gainText = "";

        if (allRoutesData.features.length <= 1) {
            gainText = "🌬️ Aucune route alternative disponible";
        } 
        else if (Math.abs(rawGain) < 5) { 
            gainText = "🌬️ Exposition au vent équivalente sur les deux trajets";
        } 
        else if (rawGain >= 5) { 
             gainText = `🌱 Économie de vent : -${Math.abs(rawGain).toFixed(0)}% d'effort sur l'alternative`;
        } 
        else {
            gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;
        }

        const tableauVues = Array("normale", "alternative");

        document.getElementById("windInfo").innerHTML = `
            ${recommendation}
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
        // Configuration du padding de la carte sans crochets via L.point()
        const margeX = 50;
        const margeY = 50;
        const paddingLeaflet = L.point(margeX, margeY);
        
        window.map.fitBounds(bounds, { 
            padding: paddingLeaflet, 
            maxZoom: 15 
        }); 
    }

    const toggleBtn = document.getElementById("toggleRouteBtn");
    
    if (allRoutesData.features.length > 1) {
        toggleBtn.style.display = "block";
        let showingAlternative = false;
        toggleBtn.innerText = "Voir la route alternative";

        toggleBtn.onclick = function() {
            window.routeGroup.clearLayers();
            if (typeof routeLayers !== 'undefined') { routeLayers = Array(); }

            if (!showingAlternative) {
                drawWindRoute(window.latlngsAlternativePersist);
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
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

        if (windInfoPanel) {
            windInfoPanel.classList.add("nav-hidden");
        }

        window.currentNavZoom = window.map.getZoom() || 19;
        window.map.setView(window.userPosition, window.currentNavZoom);

        setTimeout(() => {
