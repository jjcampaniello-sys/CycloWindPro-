// route.js - Direction segment route avec détection d'obstacles (Bâtiments & Arbres)

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
    const url = "https://openrouteservice.org";
  
    // Construction sans crochets pour éviter les coupures automatiques
    const coordStart = Array(start.lng, start.lat);
    const coordEnd = Array(endLon, endLat);

    const body = {
        coordinates: Array(coordStart, coordEnd),
        alternative_routes: {
            target_count: 3,    
            share_factor: 0.4,  
            weight_factor: 1.8  
        },
        // Demande des attributs cachés OpenStreetMap pour voir les obstacles
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

// Modèle de calcul : Combine géométrie et obstacles (Bâtiments / Arbres)
function calculateWindScore(latlngs, extras){
    let totalCost = 0;
    let count = 0;

    let residentialSegments = new Set();
    let forestSegments = new Set();

    // 1. Détection des zones résidentielles (bâtiments protecteurs)
    if (extras && extras.roadattributes && extras.roadattributes.values) {
        extras.roadattributes.values.forEach(item => {
            const indexDebut = item[0];
            const indexFin = item[1];
            const typeAttribut = item[2]; 
            
            if (typeAttribut === 1 || typeAttribut === 3) {
                for (let k = indexDebut; k < indexFin; k++) {
                    residentialSegments.add(k);
                }
            }
        });
    }

    // 2. Détection des parcs et forêts (surfaces naturelles entourées d'arbres)
    if (extras && extras.surface && extras.surface.values) {
        extras.surface.values.forEach(item => {
            const indexDebut = item[0];
            const indexFin = item[1];
            const typeSurface = item[2]; 

            if (typeSurface >= 5) {
                for (let k = indexDebut; k < indexFin; k++) {
                    forestSegments.add(k);
                }
            }
        });
    }

    // 3. Application du score segment par segment avec le bonus d'obstacle
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        let cost = windCost(direction, currentWindDirection, currentWindSpeed);

        if (forestSegments.has(i)) {
            cost = cost * 0.5; // Arbres brisent le vent de 50%
        } 
        else if (residentialSegments.has(i)) {
            cost = cost * 0.7; // Maisons brisent le vent de 30%
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
            Array(latlngs[i], latlngs[i+1]),
            { color: color, weight: 4, opacity: 0.7 }
        ).addTo(window.routeGroup);

        routeLayers.push(line);
    }
}

function drawGrayRoute(latlngs){
    const line = L.polyline(latlngs, { color: "gray", weight: 3, opacity: 0.5 }).addTo(window.routeGroup);
    routeLayers.push(line);
}

// Calcul et tracé des itinéraires
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
    
    const start = {   
        lat: window.userLat,
        lng: window.userLon
    };
    
    alert("Départ : " + start.lat + " / " + start.lng);
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
    
    if (!allRoutesData || !allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features[0];
    const coordsNormal = normalFeature.geometry.coordinates;
    const latlngsNormal = coordsNormal.map(point => Array(point[1], point[0]));
    
    // 🔥 Application de la détection d'obstacles (extras)
    const normalScore = calculateWindScore(latlngsNormal, normalFeature.properties.extras);

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;
    let alternativeScore = normalScore;

    if (allRoutesData.features.length > 1) {
        alternativeFeature = allRoutesData.features[1];
        const coordsAlt = alternativeFeature.geometry.coordinates;
        latlngsAlternative = coordsAlt.map(point => Array(point[1], point[0]));
        alternativeScore = calculateWindScore(latlngsAlternative, alternativeFeature.properties.extras);
        drawGrayRoute(latlngsAlternative);
    }

    window.latlngsNormalPersist = latlngsNormal;
    window.latlngsAlternativePersist = latlngsAlternative;
    window.currentRoute = latlngsNormal.map(p => ({ lat: p[0], lng: p[1] }));

    const firstDir = getSegmentDirection(latlngsNormal[0], latlngsNormal[1]);
    await getWind(start.lat, start.lng, firstDir);
    
    window.routeGroup.clearLayers();
    drawWindRoute(latlngsNormal);

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

    // --- CONFIGURATION DE L'AFFICHAGE DYNAMIQUE ---
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

    // Ajustement de la vue d'ensemble sans crochets bruts
    if (latlngsNormal && latlngsNormal.length > 0) {
        const bounds = L.latLngBounds(latlngsNormal);
        const margePixelX = 50;
        const margePixelY = 50;
        const objetPadding = L.point(margePixelX, margePixelY);

        window.map.fitBounds(bounds, { 
            padding: objetPadding,
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
            if (attributeType === 1 || attributeType === 3) {
                for (let k = startIndex; k < endIndex; k++) {
                    residentialSegments.add(k);
                }
            }
        });
    }

    // Analyse des surfaces pour détecter les parcs et forêts (chemins non asphaltés)
    if (extras && extras.surface && extras.surface.values) {
        extras.surface.values.forEach(item => {
            const startIndex = item[0];
            const endIndex = item[1];
            const surfaceType = item[2]; // Exemple : 6 = chemin de terre, 7 = gravier

            // Les surfaces naturelles (gravier, terre, sable) correspondent presque toujours à des parcs ou forêts
            if (surfaceType >= 5) {
                for (let k = startIndex; k < endIndex; k++) {
                    forestSegments.add(k);
                }
            }
        });
    }

    // Calcul de la boucle principale segment par segment
    for(let i = 0; i < latlngs.length - 1; i++){
        const direction = getSegmentDirection(latlngs[i], latlngs[i+1]);
        let cost = windCost(direction, currentWindDirection, currentWindSpeed);

        // 🔥 APPLICATION DU BONUS D'OBSTACLE (L'ABRI)
        if (forestSegments.has(i)) {
            // Un chemin forestier ou un parc brise le vent de moitié grâce aux arbres !
            cost = cost * 0.5; 
            console.log(`Segment ${i} : Protection arbres activée (-50% vent)`);
        } 
        else if (residentialSegments.has(i)) {
            // Une rue résidentielle étroite réduit l'effort de 30% grâce aux maisons !
            cost = cost * 0.7; 
            console.log(`Segment ${i} : Protection bâtiments activée (-30% vent)`);
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

        const line = L.polyline(
            [latlngs[i], latlngs[i+1]],
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
    const line = L.polyline(
        latlngs,
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
    
    if (!allRoutesData.features || allRoutesData.features.length === 0) {
        alert("Aucun itinéraire trouvé");
        return;
    }

    const normalFeature = allRoutesData.features[0];
    const coordsNormal = normalFeature.geometry.coordinates;
    const latlngsNormal = coordsNormal.map(point => [point[1], point[0]]);

    let latlngsAlternative = latlngsNormal; 
    let alternativeFeature = normalFeature;

    if (allRoutesData.features.length > 1) {
        alternativeFeature = allRoutesData.features[1];
        const coordsAlt = alternativeFeature.geometry.coordinates;
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

    // =========================================================================
    // 🔥 ZONE D'INTEGRATION : MODIFICATION DE VOS CALCULS DE SCORES DE VENT
    // On passe désormais les propriétés "extras" (maisons/arbres) à la fonction
    // =========================================================================
    const normalScore = calculateWindScore(latlngsNormal, normalFeature.properties.extras);
    const alternativeScore = calculateWindScore(latlngsAlternative, alternativeFeature.properties.extras);
    // =========================================================================

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

    // --- CONFIGURATION DE L'AFFICHAGE DYNAMIQUE ---
    function updateWindText(currentView, activeScore) {
        const featureActive = currentView === "normale" ? normalFeature : alternativeFeature;
        const distanceKm = (featureActive.properties.summary.distance / 1000).toFixed(1);

        // --- CALCUL DE LA DIFFÉRENCE RÉELLE ---
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
        window.map.fitBounds(bounds, { padding: [50, 50] }); 
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

// 🔥 REPARÉ ET ENTIÈREMENT REFERMÉ : LOGIQUE DU BOUTON DEMARRER
function startNavigation() {
    const btn = document.getElementById("startNavBtn");
    if (!btn) return;

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
        
        if (windInfoPanel) {
            windInfoPanel.classList.add("nav-hidden");
        }
        
        window.currentNavZoom = 17;
        window.map.setView(window.userPosition, window.currentNavZoom);

        setTimeout(() => {
            window.map.panBy([0, -140], { animate: true }); // Aligné sur votre décalage fluide de 140px
        }, 250);
    } else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; // Vert

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
