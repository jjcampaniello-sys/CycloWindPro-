// ============================================================
// ROUTE.JS - SECTION 1 : VARIABLES GLOBALES & OUTILS COORDONNÉES
// ============================================================

alert("ROUTE.JS EST CHARGE");

window.routeLayers = window.routeLayers || [];
window.routeGroup = window.routeGroup || L.layerGroup();

if (window.map && !window.map.hasLayer(window.routeGroup)) {
    window.routeGroup.addTo(window.map);
}

// OUTILS COORDONNÉES
// ORS renvoie les coordonnées GeoJSON sous la forme : [longitude, latitude]
// Leaflet utilise : [latitude, longitude]
// Cette fonction effectue donc la conversion.
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

// Extrait les coordonnées d'une route ORS.
// Compatible avec : route.geometry.coordinates lorsque geometry est un objet GeoJSON.
function getRouteLatLngs(routeObj) {
    if (!routeObj || !routeObj.geometry) {
        console.error("Route ORS sans géométrie :", routeObj);
        return [];
    }
    
    const geometry = routeObj.geometry;
    
    // Cas GeoJSON : {type: "LineString", coordinates: [...]}
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
        return convertGeoJSONCoordinates(geometry.coordinates);
    }
    
    // Cas éventuel où geometry est directement un tableau de coordonnées.
    if (Array.isArray(geometry)) {
        return convertGeoJSONCoordinates(geometry);
    }
    
    // Cas où geometry serait une polyline encodée (Compatibilité).
    if (typeof geometry === "string") {
        try {
            // Attention : decodePolyline n'est pas standard dans Leaflet natif. 
            // On s'assure que la fonction existe (via plugin ou extension).
            if (L.LineUtil && typeof L.LineUtil.decodePolyline === "function") {
                return L.LineUtil.decodePolyline(geometry);
            } else if (typeof polyline !== 'undefined' && typeof polyline.decode === 'function') {
                // Alternative fréquente via la librairie externe @mapbox/polyline
                return polyline.decode(geometry);
            }
        } catch (error) {
            console.error("Erreur décodage polyline :", error);
        }
    }
    
    console.error("Format de géométrie ORS non reconnu :", geometry);
    return [];
}

// Retourne toujours un tableau [lat, lng].
function normalizeLatLng(point) {
    if (!point) { 
        return null; 
    }
    if (Array.isArray(point) && point.length >= 2) { 
        return [Number(point[0]), Number(point[1])];
    }
    if (point.lat !== undefined && point.lng !== undefined) {
        return [Number(point.lat), Number(point.lng)];
    }
    // Ajout d'une sécurité si l'objet utilise {latitude, longitude}
    if (point.latitude !== undefined && point.longitude !== undefined) {
        return [Number(point.latitude), Number(point.longitude)];
    }
    return null;
}

// ============================================================
// ROUTE.JS - SECTION 2 : DIRECTION DU SEGMENT (BEARING)
// ============================================================

// Calcule le cap géographique (azimut) entre deux points en degrés (0° = Nord, 90° = Est, etc.)
function getSegmentDirection(p1, p2) {
    const point1 = normalizeLatLng(p1);
    const point2 = normalizeLatLng(p2);
    
    if (!point1 || !point2) {
        return 0;
    }

    const lat1 = point1[0] * Math.PI / 180;
    const lat2 = point2[0] * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;

    // Formule mathématique du grand cercle (Great Circle Bearing)
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let brng = Math.atan2(y, x) * (180 / Math.PI);
    
    // Normalisation de l'angle entre 0° et 360°
    return (brng + 360) % 360;
}

// ============================================================
// ROUTE.JS - SECTION 3 : RÉCUPÉRATION DES ROUTES ORS
// ============================================================

async function getAlternativeRoute(start, endLat, endLon) {
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const url = "https://api.openrouteservice.org/v2/directions/cycling-regular";
    
    // Sécurisation des coordonnées de départ au cas où l'objet Leaflet varie
    const startLng = start.lng !== undefined ? start.lng : start[1];
    const startLat = start.lat !== undefined ? start.lat : start[0];

    const body = {
        format: "geojson",
        coordinates: [
            [Number(startLng), Number(startLat)],
            [Number(endLon), Number(endLat)]
        ],
        alternative_routes: {
            target_count: 3, 
            share_factor: 0.4, 
            weight_factor: 1.8
        },
        extra_info: ["waytype", "surface"]
    };

    try {
        console.log("Envoi de la requête ORS avec le body :", body);

        const response = await fetch(url, {
            method: "POST", 
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body) // Correction : Remplacement du ";" par ":"
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erreur HTTP ORS :", response.status, errorText); // Correction : "errorTex" -> "errorText"
            throw new Error("Erreur API ORS : HTTP " + response.status);
        }

        const data = await response.json();
        
        // Remplacement des alert() bloquants par des logs détaillés en console
        console.log("DONNÉES ORS COMPLÈTES :", data);
        
        if (!data || !data.routes || !data.routes.length) {
            console.error("Aucune route retournée par ORS :", data);
            return null;
        }
        
        return data;

    } catch (error) {
        console.error("Erreur récupération routes ORS :", error);
        alert("Impossible de récupérer les itinéraires.");
        return null;
    }
}


// ============================================================
// ROUTE.JS - SECTION 4 : EXTRACTION DES OBSTACLES / ABRIS
// ============================================================

function extractSegments(routeObj) {
    const forestSegments = new Set();
    const residentialSegments = new Set();

    if (!routeObj) {
        console.warn("Aucun objet route ORS disponible.");
        return { forestSegments, residentialSegments };
    }

    // Sécurité : ORS place généralement les 'extras' à la racine de la route (routeObj.extras),
    // mais parfois dans les segments selon la version de l'API. On vérifie les deux emplacements.
    let extrasSources = [];
    if (routeObj.extras) {
        extrasSources.push(routeObj.extras);
    }
    if (routeObj.segments && Array.isArray(routeObj.segments)) {
        routeObj.segments.forEach(seg => {
            if (seg.extras) extrasSources.push(seg.extras);
        });
    }

    if (extrasSources.length === 0) {
        console.warn("Aucune donnée 'extras' (waytype/surface) trouvée dans la route ORS.");
        return { forestSegments, residentialSegments };
    }

    // Traitement de toutes les sources d'extras trouvées
    extrasSources.forEach(extras => {
        // 1. TRAITEMENT DE WAYTYPE
        if (extras.waytype && Array.isArray(extras.waytype.values)) {
            extras.waytype.values.forEach(value => {
                const from = Number(value[0]);
                const to = Number(value[1]);
                const type = Number(value[2]);

                // Codes ORS originaux : 3 (StateRoad), 10 (Path/Forest) ou autres selon votre logique
                if (type === 3 || type === 10) {
                    for (let i = from; i <= to; i++) {
                        forestSegments.add(i);
                    }
                }
                // Codes ORS originaux : 1 (Street), 2 (Residential)
                if (type === 1 || type === 2) {
                    for (let i = from; i <= to; i++) {
                        residentialSegments.add(i);
                    }
                }
            });
        }

        // 2. TRAITEMENT DE SURFACE
        if (extras.surface && Array.isArray(extras.surface.values)) {
            extras.surface.values.forEach(value => {
                const from = Number(value[0]);
                const to = Number(value[1]);
                const surfaceType = Number(value[2]);

                // Conservation de votre logique originale (Surfaces non asphaltées / chemins de forêt)
                if (surfaceType >= 5) {
                    for (let i = from; i <= to; i++) {
                        forestSegments.add(i);
                    }
                }
            });
        }
    });

    return { forestSegments, residentialSegments };
}

// ============================================================
// ROUTE.JS - SECTION 5 : CALCUL DU SCORE VENT + OBSTACLES
// ============================================================

function calculateWindScore(latlngs, routeObj) {
    if (!latlngs || latlngs.length < 2) {
        return 0;
    }

    // Récupération des index de points protégés
    const { forestSegments, residentialSegments } = extractSegments(routeObj);
    
    let totalWeightedCost = 0;
    let totalDistance = 0;

    for (let i = 0; i < latlngs.length - 1; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[i + 1];

        // 1. Calcul de la direction et du coût de base du vent sur ce segment
        const direction = getSegmentDirection(p1, p2);
        let cost = windCost(direction, window.currentWindDirection, window.currentWindSpeed);

        // 2. Application des coefficients d'abri (Vérification basée sur l'index du point de départ du segment)
        if (forestSegments.has(i)) {
            cost = cost * 0.5; // -50% de force du vent en forêt
        } else if (residentialSegments.has(i)) {
            cost = cost * 0.7; // -30% de force du vent en ville
        }

        // 3. Calcul de la distance du segment (Pondération)
        // On utilise la fonction native de Leaflet si disponible, sinon approximation plane
        let distance = 1; 
        if (window.L && typeof L.latLng === "function") {
            distance = L.latLng(p1).distanceTo(L.latLng(p2)); // Distance en mètres
        } else {
            // Sauvegarde mathématique simple (Pythagore) au cas où Leaflet ne serait pas instancié
            const dy = p2[0] - p1[0];
            const dx = p2[1] - p1[1];
            distance = Math.sqrt(dx * dx + dy * dy);
        }

        // Cumul pondéré
        totalWeightedCost += (cost * distance);
        totalDistance += distance;
    }

    // Retourne le coût moyen pondéré par kilomètre/mètre. Si la distance est nulle, retourne 0.
    return totalDistance > 0 ? (totalWeightedCost / totalDistance) : 0;
}

// ============================================================
// ROUTE.JS - SECTION 6 : CHOIX DE LA MEILLEURE ROUTE
// ============================================================

function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore) {
    // Sécurisation de l'accès au summary selon la structure GeoJSON de l'API ORS
    const getDuration = (routeObj) => {
        if (!routeObj) return 0;
        // Chemin standard ORS GeoJSON : route.properties.summary.duration
        if (routeObj.properties && routeObj.properties.summary) {
            return Number(routeObj.properties.summary.duration || 0);
        }
        // Chemin alternatif : route.summary.duration
        if (routeObj.summary) {
            return Number(routeObj.summary.duration || 0);
        }
        // Chemin de secours via les segments : route.segments[0].summary.duration
        if (routeObj.segments && routeObj.segments[0] && routeObj.segments[0].summary) {
            return Number(routeObj.segments[0].summary.duration || 0);
        }
        return 0;
    };

    const normalTime = getDuration(normalRoute);
    const alternativeTime = getDuration(alternativeRoute);
    
    // Calcul de la différence de gêne due au vent
    const windGain = normalScore - alternativeScore;
    
    console.log("Arbitrage itinéraire :", {
        normalTime: Math.round(normalTime / 60) + " min",
        alternativeTime: Math.round(alternativeTime / 60) + " min",
        windGain: windGain.toFixed(2),
        seuilAcceptable: Math.round((normalTime * 1.2) / 60) + " min"
    });

    // Si l'alternative réduit significativement le coût du vent (gain > 3)
    // ET que le temps de parcours ne dépasse pas 120% du trajet normal
    if (windGain > 3 && alternativeTime < (normalTime * 1.2)) {
        console.log("Résultat : L'itinéraire ALTERNATIF est privilégié (mieux abrité).");
        return "alternative";
    }
    
    console.log("Résultat : L'itinéraire NORMAL est conservé (plus rapide ou vent similaire).");
    return "normal";
}

// ============================================================
// ROUTE.JS - SECTION 7 : CALCUL DU GAIN DE VENT (POURCENTAGE)
// ============================================================

function calculateWindGain(scoreNormal, scoreAlternative) {
    const normal = Number(scoreNormal || 0);
    const alternative = Number(scoreAlternative || 0);

    // Si le score de base est nul ou négatif, aucun gain n'est calculable.
    if (normal <= 0) {
        return 0;
    }

    // Calcul du pourcentage de réduction de la gêne du vent
    const gain = ((normal - alternative) / normal) * 100;
    
    // On s'assure que le gain n'est pas négatif (si l'alternative est moins bonne)
    // et on arrondit à 1 chiffre après la virgule pour l'affichage.
    const finalGain = Math.max(0, gain);
    
    return Number(finalGain.toFixed(1));
}

// ============================================================
// ROUTE.JS - SECTION 8 : COULEUR SELON L'EXPOSITION AU VENT
// ============================================================

function getWindColor(cost) {
    const numericCost = Number(cost || 0);

    // Exposition critique (Vent de face violent, aucune protection)
    if (numericCost > 20) {
        return "#e74c3c"; // Un rouge moderne (au lieu de "red")
    }
    
    // Exposition modérée (Vent latéral ou partiel)
    if (numericCost > 8) {
        return "#f39c12"; // Un orange plus doux (au lieu de "orange")
    }
    
    // Exposition faible ou favorable (Route abritée ou vent arrière)
    return "#2ecc71"; // Un vert émeraude agréable (au lieu de "green")
}

// ============================================================
// ROUTE.JS - SECTION 9 : DESSIN DE LA ROUTE COLORÉE (OPTIMISÉ)
// ============================================================

function drawWindRoute(latlngs, routeObj = null) {
    if (!latlngs || latlngs.length < 2) {
        return;
    }

    const { forestSegments, residentialSegments } = extractSegments(routeObj);
    
    let currentBatchColor = null;
    let currentBatchCoords = [];

    // Fonction interne pour vider le lot de coordonnées en créant une unique ligne sur la carte
    const flushBatch = () => {
        if (currentBatchCoords.length >= 2) {
            const line = L.polyline(currentBatchCoords, {
                color: currentBatchColor,
                weight: 6,       // Légèrement plus épais pour une meilleure visibilité cycliste
                opacity: 0.85,
                pane: "overlayPane"
            });
            line.addTo(window.routeGroup);
            window.routeLayers.push(line);
        }
    };

    for (let i = 0; i < latlngs.length - 1; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[i + 1];

        const direction = getSegmentDirection(p1, p2);
        let cost = windCost(direction, window.currentWindDirection, window.currentWindSpeed);

        // Application des protections identiques au calcul du score
        if (forestSegments.has(i)) {
            cost = cost * 0.5;
        } else if (residentialSegments.has(i)) {
            cost = cost * 0.7;
        }

        const color = getWindColor(cost);

        // Si la couleur change ou s'il s'agit du premier point
        if (color !== currentBatchColor) {
            // On dessine le morceau précédent avant de changer de couleur
            if (currentBatchCoords.length > 0) {
                currentBatchCoords.push(p1); // On ferme la liaison avec le point actuel
                flushBatch();
            }
            // On initialise le nouveau groupe de couleur
            currentBatchColor = color;
            currentBatchCoords = [p1];
        }

        currentBatchCoords.push(p2);
    }

    // Ne pas oublier de dessiner le tout dernier morceau restant
    flushBatch();
}

// ============================================================
// ROUTE.JS - SECTION 10 : DESSIN DE LA ROUTE GRISE (ALTERNATIVE)
// ============================================================

function drawGrayRoute(latlngs) {
    if (!latlngs || latlngs.length < 2) {
        return;
    }
    
    // Une seule polyline pour tout le tracé : performance optimale d'origine.
    const line = L.polyline(latlngs, {
        color: "#95a5a6", // Un gris moderne (au lieu de "gray")
        weight: 4,
        opacity: 0.55,
        pane: "overlayPane"
    });
    
    line.addTo(window.routeGroup);
    window.routeLayers.push(line);
}

// ============================================================
// ROUTE.JS - SECTION 11 : NETTOYAGE DES ROUTES
// ============================================================

function clearRouteLayers() {
    // Sécurité : On vérifie que routeGroup existe et possède bien la méthode clearLayers
    if (window.routeGroup && typeof window.routeGroup.clearLayers === "function") {
        window.routeGroup.clearLayers();
    }
    
    // Réinitialisation du tableau de stockage global
    window.routeLayers = [];
    
    console.log("Carte nettoyée : anciens tracés d'itinéraires supprimés.");
}

// ============================================================
// ROUTE.JS - SECTION 12 : AFFICHAGE DES INFORMATIONS (CORRIGÉ)
// ============================================================

function updateWindText(currentView, activeScore, normalRouteObj, alternativeRouteObj, normalScore, alternativeScore, hasAlternative) {
    const routeActive = currentView === "normale" ? normalRouteObj : alternativeRouteObj;
    
    if (!routeActive) {
        console.warn("Impossible de mettre à jour le texte : aucun objet route actif.");
        return;
    }

    // Sécurisation de l'accès à la distance selon la structure de l'API ORS GeoJSON
    let rawDistance = 0;
    if (routeActive.properties && routeActive.properties.summary) {
        rawDistance = routeActive.properties.summary.distance;
    } else if (routeActive.summary) {
        rawDistance = routeActive.summary.distance;
    }
    const distanceKm = (Number(rawDistance || 0) / 1000).toFixed(1);

    // Utilisation de la fonction globale de calcul de gain développée en Section 7
    // Si l'alternative est moins bonne, le gain vaut 0. On calcule aussi la perte si nécessaire.
    let rawGain = 0;
    if (normalScore > 0) {
        rawGain = ((normalScore - alternativeScore) / normalScore) * 100;
    }

    let gainText = "";
    let dynamiqueRecommendation = "";

    if (!hasAlternative) {
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
            ? "🌱 Route assez protégée"
            : "💡 Voir l'Alternative abritée";
    }
    else {
        // Cas où rawGain est négatif (l'alternative est moins bonne que la normale)
        gainText = `⚠️ Attention : +${Math.abs(rawGain).toFixed(0)}% d'effort vent sur l'alternative`;
        dynamiqueRecommendation = currentView === "alternative"
            ? "⚠️ Route alternative plus exposée"
            : "🚴 Trajet initial bien plus abrité";
    }

    const windInfo = document.getElementById("windInfo");
    if (windInfo) {
        // Correction : Fermeture correcte du template literal avec ` au lieu de laisser la chaîne ouverte
        windInfo.innerHTML = `
            <strong>${dynamiqueRecommendation}</strong>
            <br>
            📍 Vue : Route ${currentView}
            <br>
            📏 Distance : ${distanceKm} km
            <br>
            ${gainText}
            <br>
            📊 Indice effort vent : ${Number(activeScore).toFixed(1)}
        `; // Chaîne correctement fermée ici
        
        windInfo.style.display = "block";
    }
}

// ============================================================
// ROUTE.JS - SECTION 13 : AFFICHAGE / MISE À JOUR DU TOGGLE
// ============================================================

function setupRouteToggle(normalRouteObj, alternativeRouteObj, normalScore, alternativeScore, hasAlternative) {
    const toggleBtn = document.getElementById("toggleRouteBtn");
    if (!toggleBtn) {
        console.warn("toggleRouteBtn introuvable.");
        return;
    }
    
    // Si aucune route alternative n'existe, on cache le bouton et on nettoie l'événement
    if (!hasAlternative) {
        toggleBtn.style.display = "none";
        toggleBtn.onclick = null;
        return;
    }
    
    toggleBtn.style.display = "block";
    toggleBtn.innerText = "Voir la route alternative"; // Correction du point-virgule manquant
    
    // État local persistant pour ce bouton spécifique
    let showingAlternative = false;
    
    toggleBtn.onclick = function () {
        clearRouteLayers();
        
        if (!showingAlternative) {
            // Affichage de l'alternative en couleur et de la normale en gris
            drawWindRoute(window.latlngsAlternativePersist, alternativeRouteObj);
            drawGrayRoute(window.latlngsNormalPersist);
            
            toggleBtn.innerText = "Voir la route normale";
            
            updateWindText(
                "alternative",
                alternativeScore, 
                normalRouteObj, 
                alternativeRouteObj, 
                normalScore, 
                alternativeScore, 
                true
            );
            showingAlternative = true;
        }
        else {
            // Affichage de la normale en couleur et de l'alternative en gris
            drawWindRoute(window.latlngsNormalPersist, normalRouteObj);
            drawGrayRoute(window.latlngsAlternativePersist);
            
            toggleBtn.innerText = "Voir la route alternative";
           
            updateWindText(
                "normale",
                normalScore,
                normalRouteObj,
                alternativeRouteObj,
                normalScore,
                alternativeScore,
                true
            );
            showingAlternative = false;
        }
    };
}

// ============================================================
// ROUTE.JS - SECTION FINALE : ORCHESTRATION ET CALCUL GLOBAL
// ============================================================

async function getRoute() {
    console.log("getRoute() : Initialisation du calcul d'itinéraire...");
    
    try {
        // 1. VÉRIFICATIONS DE SÉCURITÉ DE L'ENVIRONNEMENT
        if (!window.map) {
            alert("La carte n'est pas disponible.");
            return;
        }
        if (!window.userPosition || !Array.isArray(window.userPosition) || window.userPosition.length < 2) {
            alert("Définissez votre position de départ d'abord.");
            return;
        }
        if (!window.destination || !window.destination.lat || !window.destination.lon) {
            alert("Choisissez une destination valide dans la liste.");
            return;
        }

        // Configuration des points de départ et d'arrivée
        const start = {
            lat: Number(window.userPosition[0]),
            lng: Number(window.userPosition[1])
        };
        const endLat = Number(window.destination.lat);
        const endLon = Number(window.destination.lon);

        // 2. APPEL API OPENROUTESERVICE
        const allRoutesData = await getAlternativeRoute(start, endLat, endLon);
        if (!allRoutesData || !allRoutesData.routes || !allRoutesData.routes.length) {
            alert("Aucun itinéraire trouvé.");
            return;
        }

        // 3. EXTRACTION DE LA ROUTE PRINCIPALE (INDEX 0)
        const normalRouteObj = allRoutesData.routes[0];
        const latlngsNormal = getRouteLatLngs(normalRouteObj);
        
        if (latlngsNormal.length < 2) {
            console.error("Impossible d'extraire la géométrie de la route normale.", normalRouteObj);
            alert("La géométrie de la route initiale est invalide.");
            return;
        }

        // 4. EXTRACTION DE LA ROUTE ALTERNATIVE (INDEX 1) SI ELLE EXISTE
        let alternativeRouteObj = normalRouteObj;
        let latlngsAlternative = latlngsNormal;
        let hasAlternative = allRoutesData.routes.length > 1;

        if (hasAlternative) {
            alternativeRouteObj = allRoutesData.routes[1];
            latlngsAlternative = getRouteLatLngs(alternativeRouteObj);
            
            // Si la route alternative renvoyée est corrompue, on se rabat sur la normale
            if (latlngsAlternative.length < 2) {
                console.warn("La route alternative extraite est invalide. Repli sur la route normale.");
                alternativeRouteObj = normalRouteObj;
                latlngsAlternative = latlngsNormal;
                hasAlternative = false;
            }
        }

        // 5. SAUVEGARDE ET PERSISTANCE POUR LE TOGGLE INTERACTIF
        window.latlngsNormalPersist = latlngsNormal;
        window.latlngsAlternativePersist = latlngsAlternative;
        window.currentRoute = latlngsNormal.map(point => L.latLng(point[0], point[1]));

        // Nettoyage complet des anciens tracés sur la carte
        clearRouteLayers();

        // 6. GESTION DE LA MÉTÉO (BASÉE SUR LE PREMIER SEGMENT)
        const firstDir = getSegmentDirection(latlngsNormal[0], latlngsNormal[1]);
        await getWind(start.lat, start.lng, firstDir);

        // 7. CALCULS DES SCORES D'EFFORT FACE AU VENT
        const normalScore = calculateWindScore(latlngsNormal, normalRouteObj);
        const alternativeScore = hasAlternative
            ? calculateWindScore(latlngsAlternative, alternativeRouteObj)
            : normalScore;

        // 8. ARBITRAGE DU SYSTÈME (ALGORITHME DE CHOIX)
        const choice = hasAlternative
            ? chooseBestRoute(normalRouteObj, alternativeRouteObj, normalScore, alternativeScore)
            : "normal";

        const windGain = hasAlternative
            ? calculateWindGain(normalScore, alternativeScore)
            : 0;

        console.log("=== BILAN CYCLOWIND ===");
        console.log("Score route normale :", normalScore.toFixed(2));
        console.log("Score route alternative :", alternativeScore.toFixed(2));
        console.log("Meilleure route recommandée :", choice);
        console.log("Gain d'effort estimé :", windGain + "%");

        // 9. DESSIN INITIAL DES CALQUES SUR LA CARTE
        // Par défaut, on affiche la route normale colorée selon le vent et l'alternative en arrière-plan gris
        drawWindRoute(latlngsNormal, normalRouteObj);
        if (hasAlternative) {
            drawGrayRoute(latlngsAlternative);
        }

        // 10. MISE À JOUR DES COMPOSANTS DE L'INTERFACE UTILISATEUR
        updateWindText(
            "normale",
            normalScore,
            normalRouteObj,
            alternativeRouteObj,
            normalScore,
            alternativeScore,
            hasAlternative
        );

        // Initialisation ou rafraîchissement du bouton de bascule
        setupRouteToggle(normalRouteObj, alternativeRouteObj, normalScore, alternativeScore, hasAlternative);

        // 11. RECADRAGE DYNAMIQUE DU ZOOM (FIT BOUNDS)
        const bounds = L.latLngBounds(latlngsNormal);
        if (hasAlternative) {
            bounds.extend(L.latLngBounds(latlngsAlternative));
        }
        
        window.map.fitBounds(bounds, {
            padding:, // Remplacement de L.point par la notation de tableau standard de Leaflet
            maxZoom: 15
        });

        console.log("getRoute() : Itinéraire tracé et affiché avec succès.");

    } catch (error) {
        console.error("ERREUR CRITIQUE DANS getRoute() :", error);
        alert("Une erreur est survenue lors du calcul du trajet. Consultez la console du navigateur.");
    }
}

// ============================================================
// ROUTE.JS - COMPOSANT NAVIGATION INTERACTIVE
// ============================================================

function startNavigation() {
    const btn = document.getElementById("startNavBtn");
    if (!btn) {
        return;
    }
    
    const windInfoPanel = document.querySelector(".wind-container-right") || document.getElementById("windInfo");
    
    if (!window.userPosition) {
        alert("Position GPS non détectée. Impossible de démarrer la navigation.");
        return;
    }
    
    // ÉTAT : ACTIVATION DE LA NAVIGATION
    if (!window.isNavigating) {
        window.isNavigating = true;
        btn.innerText = "Arrêter";
        btn.style.backgroundColor = "#e74c3c"; // Rouge pour l'arrêt
        
        if (windInfoPanel) {
            windInfoPanel.classList.add("nav-hidden");
        }
        
        window.currentNavZoom = 17;
        
        // Centrage de la carte sur la position de l'utilisateur avec le zoom de navigation
        window.map.setView(window.userPosition, window.currentNavZoom, { animate: true });
        
        // Décalage fluide pour libérer de l'espace visuel en bas de l'écran (Utile sur smartphone)
        setTimeout(function () {
            if (window.map && window.isNavigating) {
                window.map.panBy([0, -100], { animate: true }); // Ajusté à -100px pour éviter les trop grands sauts
            }
        }, 300);
    }
    // ÉTAT : DÉSACTIVATION DE LA NAVIGATION
    else {
        window.isNavigating = false;
        btn.innerText = "Démarrer";
        btn.style.backgroundColor = "#2ecc71"; // Vert pour le départ
        
        if (windInfoPanel) {
            windInfoPanel.classList.remove("nav-hidden");
        }
        
        // Recadrage global de la carte pour réafficher l'ensemble de l'itinéraire enregistré
        if (window.latlngsNormalPersist && window.latlngsNormalPersist.length >= 2) {
            window.map.fitBounds(L.latLngBounds(window.latlngsNormalPersist), {
                padding: [30, 30]
            });
        }
    } // Correction : Fermeture propre du bloc conditionnel
}

// EXPOSITION AU CONTEXTE GLOBAL
window.startNavigation = startNavigation;
