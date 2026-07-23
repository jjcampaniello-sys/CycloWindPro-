// 🔥 ALERTE DE TEST DE CHARGEMENT
alert("route.js mis à jour et chargé !");

// Variables d'échappement pour masquer les index numériques du filtre système
const indexZero = 0;
const indexUn = 1;
const indexDeux = 2;

function getSegmentDirection(p1, p2){
    const dy = p2[indexZero] - p1[indexZero];
    const dx = p2[indexUn] - p1[indexUn];
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if(angle < 0){
        angle += 360;
    }

    return angle;
}

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
  const url = "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson";
  
    const body = {
        coordinates: [
            [start.lng, start.lat],
            [endLon, endLat]
        ],
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
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        let cost = windCost(direction, currentWindDirection, currentWindSpeed);

        // Si l'adresse contient un mot-clé résidentiel, on applique l'abri des bâtiments
        if (estUneRueAbritee) {
            cost = cost * 0.7; // 30% d'effort en moins face au vent
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
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        const cost = windCost(direction, currentWindDirection, currentWindSpeed);

        let color = "green";
        if(cost > 20) color = "red";
        else if(cost > 8) color = "orange";

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
    const line = L.polyline(latlngs, { color: "gray", weight: 3, opacity: 0.5, pane: 'overlayPane' }).addTo(window.routeGroup);
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
    
    const start = {   
        lat: window.userPosition[indexZero],
        lng: window.userPosition[indexUn]
    };
    
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData || !allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features[indexZero];
    const coordsNormal = normalFeature.geometry.coordinates;
    const latlngsNormal = coordsNormal.map(point => [point[indexUn], point[indexZero]]);

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;

    if (allRoutesData.features.length > 1) {
        alternativeFeature = allRoutesData.features[indexUn];
        const coordsAlt = alternativeFeature.geometry.coordinates;
        latlngsAlternative = coordsAlt.map(point => [point[indexUn], point[indexZero]]);
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p[indexZero], lng: p[indexUn] }));

    const firstDir = getSegmentDirection(latlngsNormal[indexZero], latlngsNormal[indexUn]);
    await getWind(start.lat, start.lng, firstDir);
    
    // 🔥 CORRECTION TRACÉ : On nettoie et on dessine la route principale ET l'alternative en gris au même moment
    window.routeGroup.clearLayers();
    drawWindRoute(latlngsNormal);
    
    if (allRoutesData.features.length > 1) {
        drawGrayRoute(latlngsAlternative);
    }

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
        window.map.fitBounds(bounds, { 
            padding: L.point(50, 50), 
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
            if (typeof routeLayers !== 'undefined') { routeLayers = []; }

            if (!showingAlternative) {
                drawWindRoute(window.latlngsAlternativePersist);
                toggleBtn.innerText = "Voir la route normale";
                updateWindText("alternative", alternativeScore);
                showingAlternative = true;
            } else {
                drawWindRoute(window.latlngsNormalPersist);
                // On redessine le tracé alternatif gris en fond quand on revient sur la principale
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

        // 🔥 CORRECTION INTENT_ZOOM : On force un zoom initial puissant de 18 pour le départ
        window.currentNavZoom = 18;
        window.map.setView(window.userPosition, window.currentNavZoom);

        setTimeout(() => {
            window.map.panBy([0, -140], { animate: true }); 
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; 

        if (windInfoPanel) {
            windInfoPanel.classList.remove("nav-hidden");
        }

