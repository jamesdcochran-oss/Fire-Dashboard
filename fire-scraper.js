
const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

(async () => {
  const url = 'https://dof.virginia.gov/wildland-prescribed-fire/fire-danger/daily-fire-danger-rating/';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Simulated match — adjust as needed once real table format is confirmed
  const text = $('body').text();
  const matchWake = text.match(/Wakefield.*?Class\s(\d)/i);
  const matchFarm = text.match(/Farmville.*?Class\s(\d)/i);

  const levels = {
    1: { label: "LOW", emoji: "🔵" },
    2: { label: "MODERATE", emoji: "🟢" },
    3: { label: "HIGH", emoji: "🟡" },
    4: { label: "VERY HIGH", emoji: "🟠" },
    5: { label: "EXTREME", emoji: "🔴" }
  };

  const out = {
    wakefield: matchWake ? { level: +matchWake[1], ...levels[+matchWake[1]] } : null,
    farmville: matchFarm ? { level: +matchFarm[1], ...levels[+matchFarm[1]] } : null,
    updated: new Date().toISOString()
  };

  fs.writeFileSync('fire-danger.json', JSON.stringify(out, null, 2));
})();
