#!/usr/bin/env python3
from __future__ import annotations
import os, json, csv, re, pathlib, datetime as dt, requests
from dateutil import tz

LOCAL_TZ = tz.gettz("America/New_York")
OUT_DIR = pathlib.Path("data"); OUT_DIR.mkdir(exist_ok=True)
HORIZON_DAYS = 3  # today + 2

COUNTY_CFG = {
    "Amelia":       {"wfo":"AKQ","zone_id":"VAZ075","lat":37.34,"lon":-77.98},
    "Brunswick":    {"wfo":"AKQ","zone_id":"VAZ089","lat":36.77,"lon":-77.88},
    "Dinwiddie":    {"wfo":"AKQ","zone_id":"VAZ073","lat":37.08,"lon":-77.58},
    "Greensville":  {"wfo":"AKQ","zone_id":"VAZ090","lat":36.68,"lon":-77.54},
    "Nottoway":     {"wfo":"AKQ","zone_id":"VAZ076","lat":37.13,"lon":-78.04},
    "Prince George":{"wfo":"AKQ","zone_id":"VAZ070","lat":37.20,"lon":-77.29},
}

WU_LINKS = {
  "Amelia":[
    "https://www.wunderground.com/weather/us/va/jetersville",
    "https://www.wunderground.com/weather/us/va/amelia-court-house"],
  "Nottoway":[
    "https://www.wunderground.com/weather/us/va/burkeville",
    "https://www.wunderground.com/weather/us/va/blackstone"],
  "Brunswick":[
    "https://www.wunderground.com/weather/us/va/ebony",
    "https://www.wunderground.com/weather/us/va/brodnax"],
  "Greensville":[
    "https://www.wunderground.com/weather/us/va/emporia"],
  "Dinwiddie":[
    "https://www.wunderground.com/weather/us/va/dinwiddie",
    "https://www.wunderground.com/weather/us/va/carson",
    "https://www.wunderground.com/weather/us/va/sutherland"],
  "Prince George":[
    "https://www.wunderground.com/weather/us/va/prince-george"]
}

RULES = {
    "wetting_rain_in": 0.10,
    "recent_days": 3,
    "thirty_rule_temp_c": 30.0,
    "thirty_rule_wind_mph": 30.0,
    "thirty_rule_rh_pct": 30.0,
    "kbdi_buckets": [(0,300),(301,500),(501,650),(651,800)],
    "kbdi_add":      [0,        1,         2,        3],
}

def today_local(): return dt.datetime.now(tz=LOCAL_TZ).date()
def days_list(n=3): return [str(today_local() + dt.timedelta(days=i)) for i in range(n)]

def fetch_latest_fwf(wfo:str)->str|None:
    try:
        r = requests.get(f"https://api.weather.gov/products/types/FWF/locations/{wfo}", timeout=30); r.raise_for_status()
        prods = r.json().get("products", [])
        if not prods: return None
        pid = prods[0]["productId"]
        r2 = requests.get(f"https://api.weather.gov/products/{pid}", timeout=30); r2.raise_for_status()
        return r2.json().get("productText")
    except Exception: return None

def parse_fwf_min_rh_20ft_wind(text:str, zone_id:str, dates)->dict:
    out = {d: {"min_rh": None, "wind_mph": None} for d in dates}
    if not text: return out
    sect = text
    m = re.search(rf"{re.escape(zone_id)}\.\.\.(.*?)\n\n[A-Z]{{3,}}\.\.\.|$", text, re.S|re.M)
    if m: sect = m.group(1)
    rh = re.findall(r"\bMIN(?:IMUM)?\s+RH\D+?(\d{1,2})\s*%", sect, flags=re.I)
    wd = re.findall(r"(?:20\s*FT|20-FT|20FT)\s*WIND\D+?(\d{1,2})\s*mph", sect, flags=re.I)
    for i,d in enumerate(dates):
        if i < len(rh): out[d]["min_rh"] = int(rh[i])
        if i < len(wd): out[d]["wind_mph"] = int(wd[i])
    return out

def fallback_grid(lat:float, lon:float, dates):
    out = {d: {"min_rh": None, "wind_mph": None} for d in dates}
    try:
        p = requests.get(f"https://api.weather.gov/points/{lat},{lon}", timeout=30).json()["properties"]
        office, gx, gy = p["gridId"], p["gridX"], p["gridY"]
        rrh = requests.get(f"https://api.weather.gov/gridpoints/{office}/{gx},{gy}/relativeHumidity", timeout=30).json()
        rw  = requests.get(f"https://api.weather.gov/gridpoints/{office}/{gx},{gy}/windSpeed", timeout=30).json()
        by_rh, by_w = {}, {}
        for v in rrh["properties"]["values"]:
            d = v["validTime"].split("/")[0][:10]
            by_rh.setdefault(d, []).append(v["value"])
        for v in rw["properties"]["values"]:
            d = v["validTime"].split("/")[0][:10]
            by_w.setdefault(d, []).append(v["value"])
        for d in dates:
            if d in by_rh: out[d]["min_rh"] = int(round(min(by_rh[d])))
            if d in by_w:
                kmh = max(by_w[d] or [0]) or 0
                out[d]["wind_mph"] = int(round(kmh*0.621371))
    except Exception: pass
    return out

def get_rain_from_ambee(lat:float, lon:float):
    key = os.environ.get("AMBEE_API_KEY")
    out = {"last_wet_date": None, "last_wet_amt": None, "recent_total": None, "source": None}
    if not key: return out
    try:
        end = today_local(); start = end - dt.timedelta(days=RULES["recent_days"])
        url = f"https://api.ambeedata.com/weather/history/by-lat-lng?lat={lat}&lng={lon}&from={start}T00:00:00Z&to={end}T23:59:59Z"
        r = requests.get(url, headers={"x-api-key": key, "Content-type":"application/json"}, timeout=30)
        if not r.ok: return out
        rows = r.json().get("data") or r.json().get("stations") or r.json().get("result") or []
        day = {}
        for row in rows:
            p = row.get("precipitation") or row.get("precip") or row.get("rain") or 0
            try:
                p = float(p); p_in = p/25.4 if p>3 else p
            except: p_in = 0.0
            t = (row.get("time") or row.get("date") or row.get("datetime") or str(end))[:10]
            day[t] = day.get(t,0.0) + p_in
        recent = round(sum(day.values()),2) if day else None
        last_wet, last_amt = None, None
        for d,val in sorted(day.items(), reverse=True):
            if val >= RULES["wetting_rain_in"]:
                last_wet, last_amt = d, round(val,2); break
        return {"last_wet_date": last_wet, "last_wet_amt": last_amt, "recent_total": recent, "source":"Ambee"}
    except Exception: return out

def load_json(path): 
    p = pathlib.Path(path)
    if p.exists():
        try: return json.loads(p.read_text())
        except: return {}
    return {}

def kbdi_bump(kbdi:int):
    buckets, add = RULES["kbdi_buckets"], RULES["kbdi_add"]
    for i,(lo,hi) in enumerate(buckets):
        if lo<=kbdi<=hi: return add[i]
    return add[-1]

def compute_class(min_rh, wind_mph, temp_c, kbdi, rain_recent):
    c = 1
    if min_rh is None: min_rh = 50
    if   min_rh <= 15: c=5
    elif min_rh <= 25: c=4
    elif min_rh <= 35: c=3
    elif min_rh <= 45: c=2
    else: c=1
    if wind_mph is None: wind_mph = 8
    if   wind_mph >=25: c=max(c,4)
    elif wind_mph >=15: c=max(c,3)
    elif wind_mph >=10: c=max(c,2)
    if (temp_c is not None and wind_mph is not None and min_rh is not None and
        temp_c>=30.0 and wind_mph>=30.0 and min_rh<=30.0):
        c = max(c,4)
    if kbdi is None: kbdi=350
    c = min(5, max(1, c + kbdi_bump(int(kbdi))))
    if rain_recent is not None and rain_recent >= 0.25:
        c = max(1, c-1)
    return int(c)

def main():
    dates = days_list(HORIZON_DAYS)
    kbdi_map = json.loads(os.environ.get("KBDI_JSON","{}")) or load_json("data/kbdi.json")
    dof_over = load_json("data/dof_overrides.json")

    result = {d:{} for d in dates}
    audit = [["date","county","wfo","zone_id","lat","lon","min_rh","wind_mph","temp_c","kbdi","rain_recent","last_wet_date","last_wet_amt","local_class","dof_class","source_fwf","wu_links"]]

    wfos = sorted({c["wfo"] for c in COUNTY_CFG.values()})
    fwf_texts = {w: fetch_latest_fwf(w) for w in wfos}

    for county,cfg in COUNTY_CFG.items():
        wfo, zone, lat, lon = cfg["wfo"], cfg["zone_id"], cfg["lat"], cfg["lon"]
        parsed = parse_fwf_min_rh_20ft_wind(fwf_texts.get(wfo), zone, dates)
        if any(parsed[d]["min_rh"] is None or parsed[d]["wind_mph"] is None for d in dates):
            gp = fallback_grid(lat, lon, dates)
            for d in dates:
                parsed[d]["min_rh"] = parsed[d]["min_rh"] or gp[d]["min_rh"]
                parsed[d]["wind_mph"] = parsed[d]["wind_mph"] or gp[d]["wind_mph"]

        rain = get_rain_from_ambee(lat, lon)
        kbdi = kbdi_map.get(county, 350)
        wu_refs = ";".join(WU_LINKS.get(county, []))

        for d in dates:
            temp_c = None  # add temp feed if desired
            local_cls = compute_class(parsed[d]["min_rh"], parsed[d]["wind_mph"], temp_c, kbdi, rain["recent_total"])
            dof_cls = dof_over.get(d, {}).get(county, local_cls)
            result[d][county] = {"local_class": local_cls, "dof_class": dof_cls}
            audit.append([d, county, wfo, zone, lat, lon,
                          parsed[d]["min_rh"], parsed[d]["wind_mph"], temp_c, kbdi,
                          rain["recent_total"], rain["last_wet_date"], rain["last_wet_amt"],
                          local_cls, dof_cls,
                          "FWF+GRID" if fwf_texts.get(wfo) else "GRIDONLY",
                          wu_refs])

    (OUT_DIR/"today.json").write_text(json.dumps(result, indent=2))
    with (OUT_DIR/"audit.csv").open("w", newline="") as f:
        csv.writer(f).writerows(audit)

if __name__ == "__main__":
    main()
