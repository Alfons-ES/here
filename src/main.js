const loading = document.getElementById('loading');

var map = L.map('map');

let marker = null;
let userMarker = null;

const popup = document.getElementById('popup')

let viewAll = false;


//var är vi?
map.locate({
    setView: true,
    maxZoom: 14,
    enableHighAccuracy: true,

});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


//hittat vart avnänderan befinner sig, sätt ut markör för var vi är, kalla fornlämnings findern
map.on('locationfound', function (e) {
    loading.style.display = 'none';
    const latlng = e.latlng;
    const userIcon = L.icon({
        iconUrl: '/here.png',
        iconSize: [38, 38]
    })
    if (userMarker) {
        userMarker.setLatLng(latlng);
    } else {
        userMarker = L.marker(latlng, { icon: userIcon })
            .addTo(map)
    }
    findFL(latlng.lat, latlng.lng);

});

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
        maxZoom: 14,
        enableHighAccuracy: true,

    });
});

document.getElementById('viewAll').addEventListener('click', () => {
    loading.style.display = 'flex';
    if (viewAll) {
        viewAll = false
    } else {
        viewAll = true
    }

    //
    if (!marker) {
        map.locate({
            enableHighAccuracy: true,
        });
    } else {
        findFL(marker._latlng.lat, marker._latlng.lng);
    }
    popup.classList.remove('visible');

});
/**
 * tar vad användaren sökt på, kör nominatim med flNameet för att hitta platsen - använder nomanitams angivna latitude och longitude för att ställa kartan på den platsen.
 * @param {*} location - användarens sökning
 */
async function findLocation(location) {

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${location}&format=json`);
        const data = await response.json();

        if (data) {
            const latitude = parseFloat(data[0].lat);
            const longitude = parseFloat(data[0].lon);

            map.setView([latitude, longitude], 12);

            marker = L.marker([latitude, longitude])
                .addTo(map)
            //.bindPopup(`<b>${data[0].display_name}</b>`)
            //.openPopup();
            console.log(data[0])
            console.log(marker)
            popup.classList.add('visible');;
            popup.innerHTML = `
            <button id="closePopup"><b>✖</b></button>
            <h1>${data[0].name}</h1>
            <p>${data[0].display_name}</p>
            <p>${data[0].addresstype}</p>
            `
            findFL(latitude, longitude)
        } else {
            alert('Hittade inte platsen, var mer specifik!');
        }
    } catch (error) {
        console.error('Error fetching location:', error);
    }
}


document.getElementById('popup').addEventListener('click', () => {
    popup.classList.remove('visible');
});

document.getElementById('inputLocation').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const location = this.value;
        findLocation(location);
    }
});


function findFL(lat, lng) {


    //definiera området runt
    const north = lat + 0.045;
    const west = lng - 0.088;
    const south = lat - 0.090;
    const east = lng + 0.088;

    const boundingbox = `"${west} ${south} ${east} ${north}"`;
    const boundingboxEncoded = encodeURIComponent(`/WGS84 ${boundingbox}`);

    fetch(`https://kulturarvsdata.se/ksamsok/api?method=search&hitsPerPage=99&query=boundingBox=${boundingboxEncoded} AND text=fornlämning`, {
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

            records.forEach((rec, i) => {
                let graph = rec.record["@graph"] || [];

                // leta efter koordinater och om det är synligt ovan jord
                let coordsValue;
                let synlig = false;

                for (let node of graph) {
                    if (node["ksam:coordinates"]) {
                        coordsValue = node["ksam:coordinates"];

                    }
                    if (node["ksam:desc"]) {
                        let descValue = node["ksam:desc"];

                        // Hantera strängarna
                        let descText = (typeof descValue === "string")
                            ? descValue
                            : (descValue && descValue["@value"])
                                ? descValue["@value"]
                                : "";

                        // Kolla synlighet
                        if (descText.includes("Synlig ovan mark") ||
                            descText.includes("Synlig ovan jord") ||
                            descText === "Synlig ovan mark") {
                            synlig = true;
                        }
                    }

                }
                if (synlig === false && viewAll === false) {
                    return;
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

                        if (tempDesc.trim() === "" ||
                            tempDesc.includes("Beskrivningen är inte") ||
                            tempDesc.includes("Okänd")) {
                            // hoppa över
                            continue;
                        }

                        flDesc += "<li>" + tempDesc + "</li>"
                        flDesc += "<br>"
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
                if (flDesc === "<li></li><br>" || flDesc === "<li>Synlig ovan mark</li><br>") {
                    flDesc = "Platsen är ej undersökt eller saknar beskrivning.";
                }
                //console.log(flDesc)

                let icon = "?"
                if (flDesc != "Platsen är ej undersökt") {
                    if (flName === "Stensättning" || flName === "Hägnad" || flName === "Röjningsröse" || flName === "Röse") {
                        icon = "🪨"
                    }
                    else if (flName === "Gravfält") {
                        icon = "💀"
                    }
                    else if (flName === "Hög") {
                        icon = "⛰️"
                    }
                    else if (flName === "Boplats" || flName === "Lägenhetsbebyggelse" || flName === "Bytomt/gårdstomt" || flName === "Grav- och boplatsområde" || flName === "Boplatsområde") {
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
                    <button id="closePopup"><b>✖</b></button>
                    <h1>${flName}</h1>
                    <ul>${flDesc}</ul>
                    <a href="${flUrl}" target="_blank">länk</a>
                    <p id="coordinater">${center[0]}, ${center[1]}</p>
                `;

                });

                window.flMarkers = window.flMarkers || [];
                window.flMarkers.push(flMarker);
            });

        })
        .catch(error => console.log(error));
    loading.style.display = 'none';
}

