
console.log("🔥 Five Forks Fire Weather Dashboard Loaded");

// NOAA Weather API Fallback Fetch
async function fetchWeather(county) {
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${county.lat},${county.lon}`);
    const pointData = await pointRes.json();
    const hourlyUrl = pointData.properties.forecastHourly;
    const forecastRes = await fetch(hourlyUrl);
    const forecastData = await forecastRes.json();
    const now = forecastData.properties.periods[0];

    return {
      emoji: '🌤️',
      label: now.shortForecast || 'N/A',
      temp: now.temperature,
      rh: now.relativeHumidity?.value || 'N/A',
      wind: now.windSpeed,
      dir: now.windDirection
    };
  } catch (error) {
    console.warn(`⚠️ NOAA data fallback for ${county.name}`);
    return {
      emoji: '❓',
      label: 'N/A',
      temp: 'N/A',
      rh: 'N/A',
      wind: 'N/A',
      dir: 'N/A'
    };
  }
}

// NASA FIRMS GeoJSON fetch with fallback
async function fetchHotspots() {
  try {
    const res = await fetch("https://firms.modaps.eosdis.nasa.gov/active_fire/c6.1/geojson/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.geojson");
    return await res.json();
  } catch (error) {
    console.warn("⚠️ FIRMS data fallback");
    return { type: "FeatureCollection", features: [] };
  }
}

function renderCard(county, weather, hotspotsCount) {
  const container = document.getElementById("cards");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3>${weather.emoji} ${county.name}</h3>
    <p><strong>Class:</strong> ${weather.label}</p>
    <p><strong>Wx:</strong> ${weather.temp}°F · ${weather.rh}% RH · ${weather.wind} ${weather.dir}</p>
    <p><strong>Hotspots:</strong> ${hotspotsCount}</p>`;
  container.appendChild(card);
}

function showHotspotsOnMap(geojson) {
  const map = L.map('map').setView([37.1, -77.5], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.geoJSON(geojson, {
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 5,
        fillColor: "#ff3b30",
        color: "#ff3b30",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).bindPopup("🔥 Fire detected")
  }).addTo(map);
}

const counties = [
  { name: "Amelia", lat: 37.342, lon: -77.980 },
  { name: "Nottoway", lat: 37.142, lon: -78.089 },
  { name: "Dinwiddie", lat: 37.077, lon: -77.587 },
  { name: "Prince George", lat: 37.221, lon: -77.288 }
];

async function refreshData() {
  document.getElementById("cards").innerHTML = "";
  const fireData = await fetchHotspots();

  for (const county of counties) {
    const weather = await fetchWeather(county);
    const hotspots = fireData.features.filter(f =>
      turf.booleanPointInPolygon(turf.point([f.geometry.coordinates[0], f.geometry.coordinates[1]]),
      turf.circle([county.lon, county.lat], 20, { units: 'kilometers' }))
    );
    renderCard(county, weather, hotspots.length);
  }

  showHotspotsOnMap(fireData);
}

window.onload = () => {
  refreshData();
  setInterval(refreshData, 3600000); // every hour
};
