const loading = document.getElementById('loading');

var map = L.map('map');

let marker = null;
let userMarker = null;

const popup = document.getElementById('popup')

let viewAll = false;


//var är vi?
map.locate({
    setView: true,
    maxZoom: 12,
    enableHighAccuracy: true,
    timeout: 5000

});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);



/**
 * hittat vart avnänderan befinner sig, sätt ut markör för var vi är, kalla fornlämnings findern och hämtar adressinformation
 * @param {*} e.latlng - användarens latitude och longitude
 */
map.on('locationfound', function (e) {
    const latlng = e.latlng;
    const userIcon = L.icon({
        iconUrl: '/here.png',
        iconSize: [38, 38]
    })

    userMarker = L.marker(latlng, { icon: userIcon })
        .addTo(map)

    findFL(latlng.lat, latlng.lng);
    findUserLocation(latlng.lat, latlng.lng);
});

map.on('locationerror', function (e) {
    alert("Platsåtkomst nekad. Gå till inställningar -> webbläsare -> Plats och välj 'Fråga' eller 'Tillåt'.")
});

/**
 * userLocation knappen, gröna knappen längst upp till höger. Ladda, tar bort sök/klickmarkörer, dölj popup, Hitta användarens position och centrera där
 * 
 */
document.getElementById('userLocation').addEventListener('click', () => {
    loading.style.display = 'flex';
    //rensa marker från sökt plats  
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    popup.classList.remove('visible');
    map.locate({
        setView: true,
        maxZoom: 19,
        enableHighAccuracy: true,

    });
});

/**
 * ViewAll knappen, ögon knappen längst upp till höger. Toggle visa fornlämningar eller inte, uppdatera ikonen, laddar om fornlämningar, rensar markörer och döljer popup
 */
document.getElementById('viewAll').addEventListener('click', () => {

    if (viewAll) {
        loading.style.display = 'flex';
        viewAll = false
        document.getElementById('viewAllWebp').srcset = "./eyeopen.webp";
        document.getElementById('viewAllImg').src = "./eyeopen.png";
        if (!marker) {
            findFL(userMarker._latlng.lat, userMarker._latlng.lng)
        } else {
            findFL(marker._latlng.lat, marker._latlng.lng);
        }
    } else {
        viewAll = true
        document.getElementById('viewAllWebp').srcset = "./eyeclosed.webp";
        document.getElementById('viewAllImg').src = "./eyeclosed.png";

        if (window.flMarkers) {
            window.flMarkers.forEach(m => map.removeLayer(m));
        }
        window.flMarkers = [];
    }


    popup.classList.remove('visible');

});

/**
 * tar vad användaren sökt på, kör nominatim med flNameet för att hitta platsen - använder nomanitams angivna latitude och longitude för att ställa kartan på den platsen, visar popup med infon och startar sökning efter fornlämningar.
 * @param {*} location - användarens sökning
 */
async function findLocation(location) {

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${location}&format=json`);
        const data = await response.json();

        if (data) {
            const latitude = parseFloat(data[0].lat);
            const longitude = parseFloat(data[0].lon);

            const markIcon = L.icon({
                iconUrl: '/here2.png',
                iconSize: [38, 38]
            })

            map.setView([latitude, longitude], 12);

            marker = L.marker([latitude, longitude], { icon: markIcon })
                .addTo(map)

            //.bindPopup(`<b>${data[0].display_name}</b>`)
            //.openPopup();
            console.log(data[0])
            console.log(marker)
            popup.classList.add('visible');;
            popup.innerHTML = `
            <button id="closePopup" onclick="closePopup()"><b>✖</b></button>
            <h1>${data[0].name}</h1>
            <ul>
            <li>${data[0].display_name} - ${data[0].addresstype}</li>
            </ul>
            `
            findFL(latitude, longitude)
        } else {
            alert('Hittade inte platsen, var mer specifik!');
        }
    } catch (error) {
        console.error('Error fetching location:', error);
        loading.style.display = 'none';
    }
}

/**
 * enter för sökfältet, tar input värdet och kallar findlocation med den angivna platsen
 */
document.getElementById('inputLocation').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const location = this.value;
        findLocation(location);
    }
});
/** 
 * Placera en markör där man klickar på kartan. Laddar, tar bort markörer, skapar ny markör, söker fornlämningar nära den platsen
 * 
*/

map.on("click", function (e) {
    loading.style.display = 'flex';
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    const markIcon = L.icon({
        iconUrl: '/here2.png',
        iconSize: [38, 38]
    })

    marker = L.marker([e.latlng.lat, e.latlng.lng], { icon: markIcon })
        .addTo(map)

    findFL(e.latlng.lat, e.latlng.lng);
    findUserLocation(e.latlng.lat, e.latlng.lng);
});

/**
 * Hämtar information för angivna platsen, och visar den i popup
 * @param {*} lat - latitude
 * @param {*} lng - longitude
 */
async function findUserLocation(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        popup.classList.add('visible');;
        popup.innerHTML = `
            <button id="closePopup" onclick="closePopup()"><b>✖</b></button>
            <h1>${data.name}</h1>
            <ul>
            <li>${data.display_name} - ${data.addresstype}</li>
            </ul>
            `
    } catch (error) {
        console.error('Error fetching location:', error);
        loading.style.display = 'none';
    }

}

/**
 * Hämtar fornlämningar i ett område runt positionen, tar ut koordinater, namn, beskrivning och länk, skapar markörer baserat på vad det är.
 * @param {*} lat -latitude
 * @param {*} lng -longitude
 */
function findFL(lat, lng) {

    //definiera området runt (boundingbox)
    const north = lat + 0.025;
    const west = lng - 0.05;
    const south = lat - 0.025;
    const east = lng + 0.05;

    const boundingbox = `"${west} ${south} ${east} ${north}"`;
    const boundingboxEncoded = encodeURIComponent(`/WGS84 ${boundingbox}`);

    fetch(`https://kulturarvsdata.se/ksamsok/api?method=search&hitsPerPage=10000&query=boundingBox=${boundingboxEncoded} AND text=fornlämning`, {
        headers: { 'Accept': 'application/json' }
    })
        .then(resp => resp.json())
        .then(data => {
            console.log(data)

            if (window.flMarkers) {
                window.flMarkers.forEach(m => map.removeLayer(m));
            }
            window.flMarkers = [];

            let records = data.result.records || [];


            //https://www.w3.org/TR/json-ld11/
            //https://www.youtube.com/watch?v=0YgJLXgZCj4
            records.forEach((rec, i) => {
                let graph = rec.record["@graph"] || [];

                // leta efter koordinater och om det är synligt ovan jord
                let coordsValue;


                for (let node of graph) {
                    if (node["ksam:coordinates"]) {
                        coordsValue = node["ksam:coordinates"];

                    }
                    if (node["ksam:desc"]) {
                        let descValue = node["ksam:desc"];

                        // Se till att det är strings alltid så att includes fungerar
                        let descText = descValue;

                        if (descValue != null && typeof descValue === "object") {
                            descText = descValue["@value"];
                        }

                    }

                }

                if (!coordsValue) {
                    return;
                } // hoppa över fornlämningen om det saknas coordinater

                // ta strängen 
                let xml = coordsValue["@value"];
                // plocka ut alla nummer-par med regex (lon,lat)
                let coords = [];
                let regex = /([\d.]+),([\d.]+)/g;
                let match;
                while (match = regex.exec(xml)) {
                    let lon = parseFloat(match[1]);
                    let lat = parseFloat(match[2]);
                    coords.push([lat, lon]);
                }

                //https://stackoverflow.com/questions/23636870/javascript-extract-coordinates-from-a-string
                //https://stackoverflow.com/questions/5004913/parse-out-all-long-lat-from-a-string
                //https://stackoverflow.com/questions/52595325/javascript-split-coordinates-from-a-string

                // medelpunkt
                let sumLat = 0, sumLon = 0;
                coords.forEach(c => {
                    sumLat += c[0];
                    sumLon += c[1];
                });
                let center = [sumLat / coords.length, sumLon / coords.length];

                // namnet på fornlämningen
                let flName = ""
                for (let node of graph) {
                    if (node["ksam:name"]) {
                        flName = node["ksam:name"]["@value"]
                        break;
                    }
                }
                //console.log(flName)

                //beskrivning av fornlämningen
                let flDesc = "";

                for (let node of graph) {
                    if (node["ksam:desc"]) {
                        let tempDesc = node["ksam:desc"]["@value"] || node["ksam:desc"] || "";



                        flDesc += "<li>" + tempDesc + "</li>"
                    }
                }

                let flUrl = ""
                for (let node of graph) {
                    if (node["ksam:url"]) {
                        flUrl = node["ksam:url"]
                        break;
                    }
                }

                // fallback om ingen bra beskrivning hittades
                if (flDesc === "<li></li>" || flDesc === "<li>Synlig ovan mark</li>") {
                    flDesc = "Platsen är ej undersökt eller saknar beskrivning.";
                }
                //console.log(flDesc)

                let icon = "?"

                if (flDesc != "Platsen är ej undersökt eller saknar beskrivning.") {
                    if (flName === "Stensättning" || flName === "Hägnad" || flName === "Röjningsröse" || flName === "Röse") {
                        icon = "🪨"
                    }
                    else if (flName === "Gravfält" || flName === "Grav" || flName === "Grav markerad av sten/block") {
                        icon = "💀"
                    }
                    else if (flName === "Hög") {
                        icon = "⛰️"
                    }
                    else if (flName === "Boplats" || flName === "Lägenhetsbebyggelse" || flName === "Bytomt/gårdstomt" || flName === "Grav- och boplatsområde" || flName === "Boplatsområde" || flName === "Hammare/smedja") {
                        icon = "🛖"
                    }
                    else if (flName === "Fossil åker" || flName === "Fossilåker") {
                        icon = "🦴"
                    }
                    else if (flName === "Gränsmärke") {
                        icon = "🔺"
                    }
                    else if (flName === "Färdväg") {
                        icon = "🛣️"
                    }
                    else if (flName === "Hällristning" || flName === "Runristning") {
                        icon = "🎨"
                    }
                    else if (flName === "Fartygs-/båtlämning" || flName === "") {
                        icon = "🛥️"
                    }
                    else if (flName === "Kyrka" || flName === "Kyrka/kapell") {
                        icon = "⛪"
                    }
                    else {
                        icon = "❗"
                    }
                }
                // gör flMarker
                let flMarker = L.marker(center, {
                    icon: L.divIcon({
                        html: icon,
                        className: 'flmarker',
                        iconSize: [26, 26]
                    })
                }).addTo(map);

                flMarker.on('click', function () {
                    popup.classList.add('visible');
                    popup.innerHTML = `
                    <button id="closePopup" onclick="closePopup()"><b>✖</b></button>
                    <h1>${flName}</h1>
                    <ul>${flDesc}</ul>
                    <a href="${flUrl}" target="_blank">länk</a>
                    <p id="coordinater">${center[0]}, ${center[1]}</p>
                `;

                });

                window.flMarkers = window.flMarkers || [];
                window.flMarkers.push(flMarker);
                loading.style.display = 'none';
            });

        })
        .catch(error => console.log(error));
    loading.style.display = 'none';
}

