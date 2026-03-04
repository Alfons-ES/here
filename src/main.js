const loading = document.getElementById('loading');

var map = L.map('map');

let marker = null;
let userMarker = null;

//var är vi?
map.locate({
    setView: true,
    maxZoom: 14,
    enableHighAccuracy: true,
    watch: true
});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


//sätt ut markör för var vi är.
map.on('locationfound', function (e) {
    loading.style.display = 'none';
    const latlng = e.latlng;
    const userIcon = L.icon({
        iconUrl: '../public/here.png',
        iconSize: [38, 38]
    })
    if (userMarker) {
        userMarker.setLatLng(latlng);
    } else {
        userMarker = L.marker(latlng, { icon: userIcon })
            .addTo(map)

    }
});

document.getElementById('userLocation').addEventListener('click', () => {
    loading.style.display = 'flex';
    //rensa marker från sökt plats  
    map.removeLayer(marker);
    marker = null;
    map.closePopup();

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
                .bindPopup(`<b>${data[0].display_name}</b>`)
                .openPopup();
        } else {
            alert('Hittade inte platsen, var mer specifik!');
        }
    } catch (error) {
        console.error('Error fetching location:', error);
    }
}


document.getElementById('inputLocation').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const location = this.value;
        findLocation(location);
    }
});
