
console.log("🔧 Fire Dashboard loaded");

function renderFallbackCard(county) {
  const container = document.getElementById("dashboard");
  if (!container) return;
  const card = document.createElement("div");
  card.className = "card fallback";
  card.innerHTML = `
    <h3>🟦 ${county.name}</h3>
    <p><strong>Class:</strong> N/A</p>
    <p><strong>Wx:</strong> Data unavailable</p>
    <p><strong>Hotspots:</strong> N/A</p>`;
  container.appendChild(card);
}

function renderCountyCard(county, weather, hotspots) {
  const container = document.getElementById("dashboard");
  if (!container) return;
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3>${weather.emoji} ${county.name}</h3>
    <p><strong>Class:</strong> ${weather.label}</p>
    <p><strong>Wx:</strong> ${weather.temp}°F · ${weather.rh}% RH · ${weather.wind} mph ${weather.dir}</p>
    <p><strong>Hotspots:</strong> ${hotspots}</p>`;
  container.appendChild(card);
}

const counties = [
  { "name": "Amelia", "lat": 37.342, "lon": -77.980 },
  { "name": "Nottoway", "lat": 37.142, "lon": -78.089 },
  { "name": "Dinwiddie", "lat": 37.077, "lon": -77.587 },
  { "name": "Prince George", "lat": 37.221, "lon": -77.288 },
  { "name": "Brunswick", "lat": 36.758, "lon": -77.847 },
  { "name": "Greensville", "lat": 36.686, "lon": -77.542 }
];

window.onload = () => {
  const container = document.getElementById("dashboard");
  if (!container) {
    console.error("⚠️ Dashboard container not found.");
    return;
  }

  counties.forEach(county => {
    try {
      // Simulate dummy fallback for now
      renderCountyCard(county, {
        emoji: '🟨',
        label: 'HIGH',
        temp: 88,
        rh: 22,
        wind: 15,
        dir: 'N'
      }, Math.floor(Math.random() * 3));
    } catch (e) {
      console.error(`⚠️ Failed rendering for county: ${county.name}`, e);
      renderFallbackCard(county);
    }
  });
};
