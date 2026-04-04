import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  HistoricalBasemapLayerResponse,
  HistoricalBasemapManifestResponse,
  HistoricalBasemapYear,
} from '@enzyklopaedie/shared';

type HistoricalBasemapIndexYear = {
  year: number;
  filename: string;
  countries?: string[];
};

type HistoricalBasemapIndex = {
  years: HistoricalBasemapIndexYear[];
};

type GeoJsonFeature = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: Record<string, unknown> | null;
};

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features?: GeoJsonFeature[];
};

const DEFAULT_HISTORICAL_BASEMAPS_PATH = path.join(__dirname, '../../../data/historical-basemaps');
export const DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR = -500;

const historicalBasemapsRoot =
  process.env.HISTORICAL_BASEMAPS_PATH || DEFAULT_HISTORICAL_BASEMAPS_PATH;
const historicalBasemapsIndexPath = path.join(historicalBasemapsRoot, 'index.json');
const historicalBasemapsGeojsonDir = path.join(historicalBasemapsRoot, 'geojson');

let cachedIndex: HistoricalBasemapIndex | null = null;
const cachedLayers = new Map<number, Record<string, unknown>>();

const exists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readIndex = async () => {
  if (cachedIndex) {
    return cachedIndex;
  }

  const raw = await fs.readFile(historicalBasemapsIndexPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<HistoricalBasemapIndex>;
  const years = Array.isArray(parsed.years) ? parsed.years : [];

  cachedIndex = {
    years: years
      .filter(
        (entry): entry is HistoricalBasemapIndexYear =>
          typeof entry?.year === 'number' && typeof entry?.filename === 'string'
      )
      .sort((left, right) => left.year - right.year),
  };

  return cachedIndex;
};

const mapIndexYearsToManifest = (
  years: HistoricalBasemapIndexYear[]
): HistoricalBasemapYear[] =>
  years.map((entry) => ({
    year: entry.year,
    filename: entry.filename,
    countryCount: Array.isArray(entry.countries) ? entry.countries.length : 0,
  }));

const normalizeHistoricalBasemapGeojson = (
  year: number,
  geojson: Record<string, unknown>
): Record<string, unknown> => {
  if (geojson.type !== 'FeatureCollection' || !Array.isArray((geojson as GeoJsonFeatureCollection).features)) {
    return geojson;
  }

  const featureCollection = geojson as GeoJsonFeatureCollection;
  return {
    ...featureCollection,
    features: (featureCollection.features ?? []).map((feature, index) => {
      const properties = feature.properties ?? {};
      const atlasLabel =
        (typeof properties.NAME === 'string' && properties.NAME.trim()) ||
        (typeof properties.SUBJECTO === 'string' && properties.SUBJECTO.trim()) ||
        (typeof properties.PARTOF === 'string' && properties.PARTOF.trim()) ||
        `Region ${index + 1}`;

      return {
        ...feature,
        properties: {
          ...properties,
          atlasFeatureId: `${year}-${index}`,
          atlasLabel,
          atlasParent:
            typeof properties.PARTOF === 'string' && properties.PARTOF.trim()
              ? properties.PARTOF.trim()
              : null,
          atlasSubject:
            typeof properties.SUBJECTO === 'string' && properties.SUBJECTO.trim()
              ? properties.SUBJECTO.trim()
              : null,
          atlasBorderPrecision:
            typeof properties.BORDERPRECISION === 'number' ? properties.BORDERPRECISION : null,
        },
      };
    }),
  };
};

const resolveHistoricalBasemapEntry = (
  years: HistoricalBasemapYear[],
  requestedYear: number
) => {
  if (years.length === 0) {
    return null;
  }

  let resolved = years[0];
  for (const entry of years) {
    if (entry.year <= requestedYear) {
      resolved = entry;
      continue;
    }
    break;
  }

  return resolved;
};

export const getHistoricalBasemapManifest = async (
  cutoffYear = DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR
): Promise<HistoricalBasemapManifestResponse> => {
  const datasetPresent =
    (await exists(historicalBasemapsIndexPath)) && (await exists(historicalBasemapsGeojsonDir));

  if (!datasetPresent) {
    return {
      source: 'historical-basemaps',
      title: 'Historical Basemaps',
      license: 'GPL-3.0',
      cutoffYear,
      minYear: cutoffYear,
      maxYear: cutoffYear,
      datasetPresent: false,
      availableYears: [],
    };
  }

  const index = await readIndex();
  const availableYears = mapIndexYearsToManifest(
    index.years.filter((entry) => entry.year >= cutoffYear)
  );

  return {
    source: 'historical-basemaps',
    title: 'Historical Basemaps',
    license: 'GPL-3.0',
    cutoffYear,
    minYear: availableYears[0]?.year ?? cutoffYear,
    maxYear: availableYears[availableYears.length - 1]?.year ?? cutoffYear,
    datasetPresent: true,
    availableYears,
  };
};

export const getHistoricalBasemapLayer = async (
  requestedYear: number,
  cutoffYear = DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR
): Promise<HistoricalBasemapLayerResponse | null> => {
  const manifest = await getHistoricalBasemapManifest(cutoffYear);
  if (!manifest.datasetPresent || manifest.availableYears.length === 0) {
    return null;
  }

  const resolved = resolveHistoricalBasemapEntry(manifest.availableYears, requestedYear);
  if (!resolved) {
    return null;
  }

  let geojson = cachedLayers.get(resolved.year);
  if (!geojson) {
    const raw = await fs.readFile(
      path.join(historicalBasemapsGeojsonDir, resolved.filename),
      'utf8'
    );
    geojson = normalizeHistoricalBasemapGeojson(
      resolved.year,
      JSON.parse(raw) as Record<string, unknown>
    );
    cachedLayers.set(resolved.year, geojson);
  }

  const featureCount = Array.isArray((geojson as { features?: unknown }).features)
    ? (geojson as { features: unknown[] }).features.length
    : 0;

  return {
    source: 'historical-basemaps',
    requestedYear,
    resolvedYear: resolved.year,
    filename: resolved.filename,
    featureCount,
    geojson,
  };
};
