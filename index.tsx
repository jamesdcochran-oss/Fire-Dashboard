// pages/index.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import styles from '../styles/Home.module.css';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

const counties = [
  { name: "Amelia", lat: 37.342, lon: -77.980 },
  { name: "Nottoway", lat: 37.142, lon: -78.089 },
  { name: "Dinwiddie", lat: 37.077, lon: -77.587 },
  { name: "Prince George", lat: 37.221, lon: -77.288 },
  { name: "Brunswick", lat: 36.758, lon: -77.847 },
  { name: "Greensville", lat: 36.686, lon: -77.542 }
];

type Wx = {
  tempF: number | null;
  rh: number | null;
  wind: string;
  short: string;
};

export default function Home() {
  const [weather, setWeather] = useState<Record<string, Wx | null>>({});
  const [unit, setUnit] = useState<'F' | 'C'>('F');

  useEffect(() => {
    async function fetchData() {
      const results: Record<string, Wx | null> = {};
      for (const c of counties) {
        try {
          const meta = await fetch(`https://api.weather.gov/points/${c.lat},${c.lon}`).then(r => r.json());
          const hourlyUrl = meta.properties.forecastHourly;
          const data = await fetch(hourlyUrl).then(r => r.json());
          const p = data.properties.periods[0];
          results[c.name] = {
            tempF: p.temperature ?? null,
            rh: p.relativeHumidity?.value ?? null,
            wind: `${p.windSpeed} ${p.windDirection}`,
            short: p.shortForecast
          };
        } catch (e) {
          results[c.name] = null;
        }
      }
      setWeather(results);
    }
    fetchData();
  }, []);

  return (
    <>
      <Head>
        <title>Five Forks Fire Dashboard</title>
      </Head>

      <header className={styles.header}>
        <h1>🔥 Five Forks Fire Weather</h1>
        <button onClick={() => setUnit(unit === 'F' ? 'C' : 'F')}>Toggle °{unit}</button>
      </header>

      <main className={styles.main}>
        <section className={styles.cards}>
          {counties.map((c) => {
            const wx = weather[c.name];
            const temp = unit === 'C' && wx?.tempF != null
              ? Math.round(((wx.tempF - 32) * 5) / 9)
              : wx?.tempF;
            return (
              <div key={c.name} className={styles.card}>
                <strong>{c.name}</strong>
                {wx ? (
                  <>
                    <p>{temp}°{unit} · {wx.rh ?? '—'}% RH · {wx.wind}</p>
                    <p>{wx.short}</p>
                  </>
                ) : (
                  <p>Weather unavailable</p>
                )}
              </div>
            );
          })}
        </section>

        <section className={styles.mapWrap}>
          <Map />
        </section>
      </main>

      <footer className={styles.footer}>
        Data: NOAA & NASA FIRMS · Updates hourly
      </footer>
    </>
  );
}
