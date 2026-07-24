/// Analyse du vent
function windDirectionText(deg){

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


    const index =
    Math.round(deg / 45) % 8;


    return directions[index];

}

function windEffect(rideDirection, windDirection) {

    let angle = Math.abs(rideDirection - windDirection);

    if (angle > 180) {
        angle = 360 - angle;
    }

    if (angle < 45) {
        return "💨 Vent de face";
    }

    if (angle > 135) {
        return "🚴 Vent favorable";
    }

    return "↔️ Vent latéral";
}


// Coût du vent
function windCost(roadDirection, windDirection, windSpeed) {

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

        currentWindSpeed = data.current.wind_speed_10m;
        currentWindDirection = data.current.wind_direction_10m;


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



// Légende
//function addWindLegend() {

 //   if (windLegend) {
 //       map.removeControl(windLegend);
 //   }


//    windLegend = L.control({
 //       position:"bottomleft"
//    });


  //  windLegend.onAdd = function() {

     //   const div = L.DomUtil.create("div");


     //   div.style.background="white";
      //  div.style.padding="10px";
     //   div.style.borderRadius="10px";
    //    div.style.fontSize="16px";


     //   div.innerHTML =
        `
    //    🟢 Vent favorable<br>
    //    🟠 Vent latéral<br>
    //    🔴 Vent de face
   //     `;


    //    return div;
   // };


   // windLegend.addTo(map);
//}

// Récupération météo
async function getWind(lat, lon, rideDirection) {

    try {

        const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m%2Cwind_direction_10m`;

        const response = await fetch(url);
        const data = await response.json();

        currentWindSpeed = data.current.wind_speed_10m;
        currentWindDirection = data.current.wind_direction_10m;


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



// Légende
//function addWindLegend() {

 //   if (windLegend) {
 //       map.removeControl(windLegend);
 //   }


//    windLegend = L.control({
 //       position:"bottomleft"
//    });


  //  windLegend.onAdd = function() {

     //   const div = L.DomUtil.create("div");


     //   div.style.background="white";
      //  div.style.padding="10px";
     //   div.style.borderRadius="10px";
    //    div.style.fontSize="16px";


     //   div.innerHTML =
        `
    //    🟢 Vent favorable<br>
    //    🟠 Vent latéral<br>
    //    🔴 Vent de face
   //     `;


    //    return div;
   // };


   // windLegend.addTo(map);
//}
/ Direction segment route

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
