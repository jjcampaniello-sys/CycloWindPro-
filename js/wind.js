// Analyse du vent
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
