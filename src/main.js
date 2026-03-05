const loading = document.getElementById('loading');

var map = L.map('map');

let marker = null;
let userMarker = null;

const popup = document.getElementById('popup')

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
    findFL(latlng);

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
/**
 * tar vad användaren sökt på, kör nominatim med namnet för att hitta platsen - använder nomanitams angivna latitude och longitude för att ställa kartan på den platsen.
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

            popup.classList.add('visible');;
            popup.innerHTML = `
            <button id="closePopup"><b>✖</b></button>
            <h1>${data[0].name}</h1>
            <p>${data[0].display_name}</p>
            <p>${data[0].addresstype}</p>
            `
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


function findFL(latlng) {

    console.log(latlng)
    fetch("https://kulturarvsdata.se/ksamsok/api?method=search&hitsPerPage=25&query=boundingBox=/WGS84%20%2214.901%2059.259%2014.991%2059.349%22%20AND%20text=fornlämning", {
        headers: { 'Accept': 'application/json' }
    })
        .then(resp => resp.json())
        .then(data => {
            console.log(data)

            window.flMarkers = [];

            let records = data.result.records || [];

            records.forEach((rec, i) => {
                let graph = rec.record["@graph"] || [];

                // leta efter koordinater
                let coordsValue;
                for (let node of graph) {
                    if (node["ksam:coordinates"]) {
                        coordsValue = node["ksam:coordinates"];
                        break;
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

                // medelpunkt
                let sumLat = 0, sumLon = 0;
                coords.forEach(c => {
                    sumLat += c[0];
                    sumLon += c[1];
                });
                let center = [sumLat / coords.length, sumLon / coords.length];

                // namnet på fornlämningen
                let namn = ""
                for (let node of graph) {
                    if (node["ksam:name"]) {
                        namn = node["ksam:name"]["@value"]
                        break;
                    }
                }

                // gör flMarker
                let flMarker = L.marker(center, {
                    icon: L.divIcon({
                        html: "✖",
                        className: "",
                        iconSize: [20, 20]
                    })
                }).addTo(map);

                flMarker.on('click', function () {
                    popup.classList.add('visible');
                    popup.innerHTML = `
                    <button id="closePopup"><b>✖</b></button>
                    <h1>${namn}</h1>
                    <p></p>
                    <p id="coordinater">${center[0]}, ${center[1]}</p>
                `;

                });

                window.flMarkers = window.flMarkers || [];
                window.flMarkers.push(flMarker);
            });

        })
        .catch(error => console.log(error));
}

