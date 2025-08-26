
const counties = [
  { name: "Amelia", lat: 37.342, lon: -77.980 },
  { name: "Nottoway", lat: 37.142, lon: -78.089 },
  { name: "Dinwiddie", lat: 37.077, lon: -77.587 },
  { name: "Prince George", lat: 37.221, lon: -77.288 },
  { name: "Brunswick", lat: 36.758, lon: -77.847 },
  { name: "Greensville", lat: 36.686, lon: -77.542 }
];

const classEmojis = ["🟩", "🟦", "🟨", "🟧", "🟥"];
const classLabels = ["LOW", "MODERATE", "HIGH", "VERY HIGH", "EXTREME"];

const cardsContainer = document.getElementById('cards');
const map = L.map('map').setView([37.1, -77.7], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function computeClass(rh, wind) {
  if (rh <= 20 && wind >= 20) return 5;
  if (rh <= 30 && wind >= 15) return 4;
  if (rh <= 40 && wind >= 10) return 3;
  if (rh <= 50) return 2;
  return 1;
}

function addCountyCard(data) {
  const { name, lat, lon, classNum, temp, rh, wind, windDir, hotspots } = data;
  const emoji = classEmojis[classNum - 1];
  const label = classLabels[classNum - 1];

  const card = document.createElement('div');
  card.className = "card";
  card.innerHTML = `
    <div class="county-name">${emoji} ${name}</div>
    <div class="metrics">
      <div class="metric">Class ${classNum} — ${label}</div>
      <div class="metric">🌡️ Temp: ${temp}°F</div>
      <div class="metric">💧 RH: ${rh}%</div>
      <div class="metric">💨 Wind: ${wind} mph ${windDir}</div>
      <div class="metric">🔥 Hotspots: ${hotspots}</div>
    </div>
  `;
  cardsContainer.appendChild(card);

  L.circleMarker([lat, lon], {
    radius: 10,
    fillColor: "red",
    fillOpacity: 0.7,
    color: "#000",
    weight: 1
  }).addTo(map).bindPopup(\`
    <strong>${name}</strong><br/>
    Class ${classNum} — ${label}<br/>
    Temp: ${temp}°F<br/>
    RH: ${rh}%<br/>
    Wind: ${wind} mph ${windDir}<br/>
    Hotspots: ${hotspots}
  \`);
}

async function fetchWeather(county) {
  try {
    const pointsResp = await fetch(`https://api.weather.gov/points/${county.lat},${county.lon}`);
    const pointsData = await pointsResp.json();
    const gridId = pointsData.properties.gridId;
    const gridX = pointsData.properties.gridX;
    const gridY = pointsData.properties.gridY;

    const gridResp = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`);
    const gridData = await gridResp.json();
    const period = gridData.properties.periods[0];

    const temp = period.temperature;
    const rh = period.relativeHumidity.value || 100;
    const windParts = (period.windSpeed || '0 mph').split(' ');
    const wind = parseInt(windParts[0]) || 0;
    const windDir = period.windDirection || "N";

    return { temp, rh, wind, windDir };
  } catch (e) {
    return { temp: "N/A", rh: "N/A", wind: "N/A", windDir: "N/A" };
  }
}

async function fetchFIRMS() {
  const url = "https://firms.modaps.eosdis.nasa.gov/geojson/country/USA/VIIRS_NOAA20_24h.geojson";
  const resp = await fetch(url);
  return await resp.json();
}

async function loadDashboard() {
  const firms = await fetchFIRMS();
  const features = firms.features;

  for (let county of counties) {
    const wx = await fetchWeather(county);

    let hotspotCount = features.filter(f => {
      const d = turf.distance(
        turf.point([county.lon, county.lat]),
        turf.point(f.geometry.coordinates),
        { units: "kilometers" }
      );
      return d <= 15;
    }).length;

    const classNum = typeof wx.rh === "number" && typeof wx.wind === "number"
      ? computeClass(wx.rh, wx.wind) : 1;

    addCountyCard({
      ...county,
      ...wx,
      hotspots: hotspotCount,
      classNum
    });
  }
}

// Initial load and refresh every hour
loadDashboard();
setInterval(() => location.reload(), 3600000); // 1 hour
