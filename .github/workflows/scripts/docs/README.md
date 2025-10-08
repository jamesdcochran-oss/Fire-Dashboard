# Fire Weather Dashboard

Static dashboard for six Virginia counties. Data is prebuilt by a GitHub Action and served as JSON to the UI.

## Data sources
- **NWS**: FWF (min RH, 20-ft wind) with gridpoints fallback.
- **Ambee**: precip (recent total, last wetting rain ≥ 0.10").
- **WU links**: included in `data/audit.csv` for human QA (no scraping).

## Files
- `.github/workflows/agent.yml` – scheduled builder (every 30 min + manual).
- `scripts/build_data.py` – fetches/combines inputs; outputs:
  - `data/today.json` (County × Date: Local & DOF classes for today+2)
  - `data/audit.csv` (inputs + refs)
- `docs/` – site:
  - `index.html` (snapshot page)
  - `fire_data.json` + `_inline_fire_data.js` (published by Action)

## Secrets
- `AMBEE_API_KEY` (required for precip)
- `KBDI_JSON` (optional), e.g. `{"Amelia":430,"Brunswick":510,...}`

## Run once
Actions → **Fire Agent** → **Run workflow**. Then open your GitHub Pages site.
