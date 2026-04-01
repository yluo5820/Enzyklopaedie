import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './WorldHistoryPage.css';

type Period = {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
  bounds: [[number, number], [number, number]];
  summary: string;
};

const periods: Period[] = [
  {
    id: 'classical',
    name: 'Classical Antiquity',
    start: -500,
    end: 500,
    color: '#9c6b3f',
    bounds: [[-10, 28], [45, 46]],
    summary: 'City-states, empires, and early trade networks across the Mediterranean basin.',
  },
  {
    id: 'medieval',
    name: 'Medieval Crossroads',
    start: 500,
    end: 1400,
    color: '#7b5a44',
    bounds: [[-10, 18], [90, 58]],
    summary: 'Caravan routes and scholarly hubs stitch together Europe, Africa, and Asia.',
  },
  {
    id: 'discovery',
    name: 'Age of Discovery',
    start: 1400,
    end: 1700,
    color: '#a0703a',
    bounds: [[-85, -10], [25, 55]],
    summary: 'Maritime powers widen the map, charting new coastlines and ocean routes.',
  },
  {
    id: 'industrial',
    name: 'Industrial Expansion',
    start: 1700,
    end: 1900,
    color: '#6a4f3b',
    bounds: [[-10, 15], [120, 60]],
    summary: 'Mechanization accelerates exchange, industry, and global migration.',
  },
  {
    id: 'modern',
    name: 'Modern Era',
    start: 1900,
    end: 2025,
    color: '#385c65',
    bounds: [[-170, -55], [170, 75]],
    summary: 'A connected world of shifting borders, ideas, and digital networks.',
  },
];

const formatYear = (year: number) => {
  if (year < 0) {
    return `${Math.abs(year)} BCE`;
  }
  return `${year} CE`;
};

const getActivePeriod = (year: number) => {
  const match = periods.find((period) => year >= period.start && year <= period.end);
  return match ?? periods[0];
};

const buildPeriodGeoJson = () => ({
  type: 'FeatureCollection',
  features: periods.map((period) => {
    const [west, south] = period.bounds[0];
    const [east, north] = period.bounds[1];
    return {
      type: 'Feature',
      properties: {
        id: period.id,
        name: period.name,
        start: period.start,
        end: period.end,
        color: period.color,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    };
  }),
});

const WorldHistoryPage: React.FC = () => {
  const [year, setYear] = useState(465);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptilersdk.Map | null>(null);
  const lastPeriodRef = useRef<string | null>(null);
  const yearRef = useRef<number>(year);

  const maptilerApiKey = (import.meta.env as { VITE_MAPTILER_API_KEY?: string })
    .VITE_MAPTILER_API_KEY;

  const activePeriod = useMemo(() => getActivePeriod(year), [year]);
  const periodGeoJson = useMemo(() => buildPeriodGeoJson(), []);

  const yearBounds = useMemo(() => {
    const minYear = Math.min(...periods.map((period) => period.start));
    const maxYear = Math.max(...periods.map((period) => period.end));
    return { minYear, maxYear, span: maxYear - minYear };
  }, []);

  const ticks = useMemo(() => {
    const tickCount = 6;
    return Array.from({ length: tickCount }, (_, index) => {
      const value = yearBounds.minYear + (yearBounds.span / (tickCount - 1)) * index;
      return Math.round(value);
    });
  }, [yearBounds]);

  const segments = useMemo(
    () =>
      periods.map((period) => ({
        ...period,
        span: period.end - period.start,
        midYear: Math.round((period.start + period.end) / 2),
      })),
    []
  );

  const syncMapToYear = (targetYear: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('periods-fill')) return;

    const filter = [
      'all',
      ['<=', ['get', 'start'], targetYear],
      ['>=', ['get', 'end'], targetYear],
    ] as any;

    map.setFilter('periods-fill', filter);
    map.setFilter('periods-outline', filter);
    map.setFilter('periods-label', filter);

    const period = getActivePeriod(targetYear);
    if (period && lastPeriodRef.current !== period.id) {
      lastPeriodRef.current = period.id;
      map.fitBounds(period.bounds, { padding: 90, duration: 900, maxZoom: 4.8 });
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !maptilerApiKey) return;

    maptilersdk.config.apiKey = maptilerApiKey;

    const map = new maptilersdk.Map({
      container: mapContainerRef.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [15, 28],
      zoom: 1.6,
      minZoom: 1,
      maxZoom: 6,
    });

    map.addControl(new maptilersdk.NavigationControl({ visualizePitch: false }), 'top-right');

    map.on('load', () => {
      map.addSource('periods', {
        type: 'geojson',
        data: periodGeoJson as any,
      });

      map.addLayer({
        id: 'periods-fill',
        type: 'fill',
        source: 'periods',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'periods-outline',
        type: 'line',
        source: 'periods',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
        },
      });

      map.addLayer({
        id: 'periods-label',
        type: 'symbol',
        source: 'periods',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#3e2f22',
          'text-halo-color': '#fdf6ea',
          'text-halo-width': 1,
        },
      });

      syncMapToYear(yearRef.current);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      lastPeriodRef.current = null;
    };
  }, [maptilerApiKey, periodGeoJson]);

  useEffect(() => {
    yearRef.current = year;
    syncMapToYear(year);
  }, [year]);

  return (
    <div className="world-history-page">
      <div className="world-history-frame">
        <header className="world-history-header">
          <div className="world-history-title">
            <span className="world-history-eyebrow">World History</span>
            <h1>World History Atlas</h1>
            <p>
              Drag through time and watch each era focus the map. This layout mirrors the historic atlas
              timeline experience, ready for real datasets.
            </p>
          </div>
          <div className="world-history-meta">
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Year</span>
              <span className="world-history-meta-value">{formatYear(year)}</span>
            </div>
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Active Period</span>
              <span className="world-history-meta-value">{activePeriod.name}</span>
              <span className="world-history-hint">
                {formatYear(activePeriod.start)} to {formatYear(activePeriod.end)}
              </span>
            </div>
          </div>
        </header>

        <section className="world-history-map">
          <div ref={mapContainerRef} className="world-history-map__canvas" />
          {!maptilerApiKey && (
            <div className="world-history-map__overlay">
              <strong>MapTiler API key required</strong>
              <span>Add <code>VITE_MAPTILER_API_KEY</code> in <code>client/.env.local</code> to load the map.</span>
            </div>
          )}
        </section>

        <section className="world-history-timeline">
          <div className="world-history-range">
            <input
              type="range"
              min={yearBounds.minYear}
              max={yearBounds.maxYear}
              step={1}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
            <div className="world-history-ticks">
              {ticks.map((tick) => (
                <span key={tick}>{formatYear(tick)}</span>
              ))}
            </div>
          </div>
          <div className="world-history-segments">
            {segments.map((period) => (
              <button
                key={period.id}
                type="button"
                className={`timeline-segment ${activePeriod.id === period.id ? 'is-active' : ''}`}
                onClick={() => setYear(period.midYear)}
                style={{
                  flex: period.span,
                  ['--segment-color' as string]: period.color,
                }}
              >
                <div className="timeline-segment-name">{period.name}</div>
                <div className="timeline-segment-range">
                  {formatYear(period.start)} - {formatYear(period.end)}
                </div>
                <div className="world-history-hint">{period.summary}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorldHistoryPage;
