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

    const url = "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson";

    const body = {
    coordinates: [
        [start.lng, start.lat],
        [endLon, endLat]
    ],    
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
 //  console.log("Routes ORS reçues :", data);
    const coords = data.features[0].geometry.coordinates;

    return {
        geometry: {
            coordinates: coords
        },
        duration: data.features[0].properties.summary.duration
    };
}

function calculateWindScore(latlngs){
    let totalCost = 0;
    let count = 0;

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

        totalCost += cost;
        count++;
    }

    return totalCost / count;
}

function chooseBestRoute(normalRoute, alternativeRoute, normalScore, alternativeScore){
    const normalTime = normalRoute.duration;
    const alternativeTime = alternativeRoute.duration;

    // avantage vent
    const windGain = normalScore - alternativeScore;

    // l'alternative est intéressante si :
    // - elle améliore fortement le vent
    // - et ajoute moins de 20% de temps

    if(windGain > 3 && alternativeTime < normalTime * 1.2){
        return "alternative";
    }

    return "normal";
}
function calculateWindGain(scoreNormal, scoreAlternative){

    if(scoreNormal <= 0){
        return 0;
    }

    const gain =
    ((scoreNormal - scoreAlternative) / scoreNormal) * 100;

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
                weight: 6
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
            weight: 5
        }
    ).addTo(window.routeGroup);

    routeLayers.push(line);
}

// Calcul trajet
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
    lat: window.userPosition[0],
    lng: window.userPosition[1]
};
// 🔥 AJOUT ICI
//const firstDir = getSegmentDirection(latlngs[0], latlngs[1]);
//await getWind(start.lat, start.lng, firstDir);

    //await getWind(start.lat, start.lng, 0);
    
    alert(
"Départ : " + start.lat + " / " + start.lng
);
    const endLat = window.destination.lat;
    const endLon = window.destination.lon;
    
    const alternative = await getAlternativeRoute(start, endLat, endLon);
    
   // console.log("Route alternative :", alternative);

    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU5N2JkNDJjYTM5MzRjYTFhODQ1MTE2YjViNmQ2ZGJjIiwiaCI6Im11cm11cjY0In0=";
    const orsUrl = "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson";

    const body = {
    coordinates: [
        [start.lng, start.lat],
        [endLon, endLat]
    ],
};

    const response = await fetch(orsUrl, {
        method: "POST",
        headers: {
            "Authorization": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    //console.log("Routes ORS reçues :", data);
    const coords = data.features[0].geometry.coordinates;

    const routes = [{
        geometry: {
            coordinates: coords
        }
    }];
    
    const latlngs = coords.map(point => [point[1], point[0]]);   

    window.currentRoute = latlngs.map(p => ({
        lat: p[0],
        lng: p[1]
    }));

    const altCoords = alternative.geometry.coordinates;
    const altLatlngs = altCoords.map(point => [point[1], point[0]]);

//const latlngs = coords.map(point => [point[1], point[0]]);

   // const latlngs = coords.map(point => [point[1], point[0]]);

// ✅ ICI c’est bon
const firstDir = getSegmentDirection(latlngs[0], latlngs[1]);

await getWind(start.lat, start.lng, firstDir);

// puis
//drawWindRoute(latlngs);
    
    drawWindRoute(latlngs);

    const normalScore = calculateWindScore(latlngs);
    const alternativeScore = calculateWindScore(altLatlngs);

    const choice = chooseBestRoute(
        routes[0],
        alternative,
        normalScore,
        alternativeScore
    );
const windGain = calculateWindGain(
    normalScore,
    alternativeScore
);

let recommendation =
    choice === "alternative"
    ? "🌱 CycloWind recommande l'alternative"
    : "🚴 CycloWind recommande ce trajet";

// ✅ AFFICHAGE PROPRE (UN SEUL BLOC)
document.getElementById("windInfo").innerHTML = `
    ${recommendation}
    <br>
    🌬️ Impact vent : ${alternativeScore.toFixed(1)}
    <br>
    📉 Gain estimé : ${windGain.toFixed(0)} %
`;

    const routeData = {
        coords: latlngs,
        wind: normalScore,
        altWind: alternativeScore,
        recommendation: recommendation
    };

    window.drawWindRoute = drawWindRoute;
};
