alert("route.js réparé et chargé avec succès !");

const ZERO = 0;
const UN = 1;

function getSegmentDirection(p1, p2){
    const dy = p2[ZERO] - p1[ZERO];
    const dx = p2[UN] - p1[UN];
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if(angle < 0) angle += 360;
    return angle;
}

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://openrouteservice.org";
  
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
        extra_info: ["roadattributes", "surface"]
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

function calculateWindScore(latlngs, extras) {
    let totalCost = 0;
    let count = 0;
    let residentialSegments = new Set();
    let forestSegments = new Set();

    if (extras && extras.roadattributes && extras.roadattributes.values) {
        extras.roadattributes.values.forEach(item => {
            const startIndex = item[ZERO];
            const endIndex = item[UN];
            const attributeType = item[2]; 
            if (attributeType === 1 || attributeType === 3) {
                for (let k = startIndex; k < endIndex; k++) {
                    residentialSegments.add(k);
                }
            }
        });
    }

    if (extras && extras.surface && extras.surface.values) {
        extras.surface.values.forEach(item => {
            const startIndex = item[ZERO];
            const endIndex = item[UN];
            const surfaceType = item[2]; 
            if (surfaceType >= 5) {
                for (let k = startIndex; k < endIndex; k++) {
                    forestSegments.add(k);
                }
            }
        });
    }

    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        let cost = windCost(direction, currentWindDirection, currentWindSpeed);

        if (forestSegments.has(i)) {
            cost = cost * 0.5; 
        } 
        else if (residentialSegments.has(i)) {
            cost = cost * 0.7; 
        }
        totalCost += cost;
        count++;
    }
    return count > 0 ? (totalCost / count) : 0;
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
            { color: color, weight: 4, opacity: 0.5, pane: 'overlayPane' }
        ).addTo(window.routeGroup);
        routeLayers.push(line);
    }
}

function drawGrayRoute(latlngs){
    const line = L.polyline(latlngs, { color: "gray", weight: 3, opacity: 0.5, pane: 'overlayPane' }).addTo(window.routeGroup);
    routeLayers.push(line);
}

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
        lat: window.userPosition[ZERO],
        lng: window.userPosition[UN]
    };
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData || !allRoutesData.features || allRoutesData.features.length === ZERO) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features[ZERO];
    const coordsNormal = normalFeature.geometry.coordinates;
    const latlngsNormal = coordsNormal.map(point => [point[UN], point[ZERO]]);

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;

    window.routeGroup.clearLayers();

    if (allRoutesData.features.length > UN) {
        alternativeFeature = allRoutesData.features[UN];
        const coordsAlt = alternativeFeature.geometry.coordinates;
        latlngsAlternative = coordsAlt.map(point => [point[UN], point[ZERO]]);
        drawGrayRoute(latlngsAlternative);
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p[ZERO], lng: p[UN] }));

    const firstDir = getSegmentDirection(latlngsNormal[ZERO], latlngsNormal[UN]);
    await getWind(start.lat, start.lng, firstDir);
    
    drawWindRoute(latlngsNormal);

    const normalScore = calculateWindScore(latlngsNormal, normalFeature.properties.extras);
    const alternativeScore = calculateWindScore(latlngsAlternative, alternativeFeature.properties.extras);

    const routesArrayMock = { duration: normalFeature.properties.summary.duration };
    const alternativeMock = { duration: alternativeFeature.properties.summary.duration };

    const choice = chooseBestRoute(routesArrayMock, alternativeMock, normalScore, alternativeScore);
    const windGain = calculateWindGain(normalScore, alternativeScore);

    let recommendation = choice === "alternative" && allRoutesData.features.length > UN
        ? "🌱 CycloWind recommande l'alternative"
        : "🚴 CycloWind recommande ce trajet";

    function updateWindText(currentView, activeScore) {
        const featureActive = currentView === "normale" ? normalFeature : alternativeFeature;
        const distanceKm = (featureActive.properties.summary.distance / 1000).toFixed(1);
        const rawGain = ((normalScore - alternativeScore) / normalScore) * 100;
        let gainText = "";

        if (allRoutesData.features.length <= UN) {
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

    if (latlngsNormal && latlngsNormal.length > ZERO) {
        const bounds = L.latLngBounds(latlngsNormal);
        window.map.fitBounds(bounds, { padding: L.point(50, 50), maxZoom: 15 }); 
    }

    const toggleBtn = document.getElementById("toggleRouteBtn");
    if (allRoutesData.features.length > UN) {
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
        if (windInfoPanel) windInfoPanel.classList.add("nav-hidden");

        window.currentNavZoom = 18;
        window.map.setView(window.userPosition, window.currentNavZoom);

        setTimeout(() => {
            window.map.panBy([0, -140], { animate: true }); 
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";

        btn.style.backgroundColor = "#2ecc71";
        if (windInfoPanel) windInfoPanel.classList.remove("nav-hidden");
        if (window.latlngsNormalPersist) {window.map.fitBounds(L.latLngBounds(window.latlngsNormalPersist), {padding: L.point(50, 50),maxZoom: 15}
        );
           }
    }
}

