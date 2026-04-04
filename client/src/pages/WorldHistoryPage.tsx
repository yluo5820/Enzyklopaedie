import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, {
  GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  CanonicalHistoricalEntity,
  CanonicalHistoricalSearchMatch,
  HistoricalBasemapLayerResponse,
  HistoricalBasemapManifestResponse,
  ReferenceEntity,
} from '@enzyklopaedie/shared';
import {
  deleteHistoricalAtlasEntity,
  fetchHistoricalBasemapLayer,
  fetchHistoricalBasemapManifest,
  fetchHistoricalAtlasGeometry,
  fetchHistoricalAtlasEntities,
  fetchReferenceEntities,
  promoteHistoricalAtlasEntity,
  saveHistoricalAtlasEntity,
  searchHistoricalAtlas,
  type HistoricalAtlasKind,
} from '../api';
import './WorldHistoryPage.css';

const kindLabels: Record<HistoricalAtlasKind, string> = {
  all: 'All types',
  battle: 'Battles',
  civilization: 'Civilizations',
  era: 'Eras',
  nation: 'Nations & polities',
  person: 'People',
  place: 'Places',
  region: 'Regions',
  ruler: 'Rulers',
};

const atlasKindOptions: HistoricalAtlasKind[] = [
  'all',
  'nation',
  'civilization',
  'era',
  'region',
  'place',
  'battle',
  'ruler',
  'person',
];

const referenceEntityKindLabels: Record<ReferenceEntity['kind'], string> = {
  civilization: 'Civilization',
  era: 'Era',
  nation: 'Nation',
  person: 'Person',
  place: 'Place',
};

const DEFAULT_YEAR = 1862;
const DEFAULT_MIN_YEAR = -1200;
const DEFAULT_MAX_YEAR = 2025;
const DEFAULT_BASEMAP_CUTOFF_YEAR = -500;
const MATCHABLE_ATLAS_ENTITY_KINDS = new Set(['nation', 'civilization', 'region', 'place']);
const MATCHABLE_REFERENCE_ENTITY_KINDS = new Set(['nation', 'civilization', 'place']);

type CanonicalHistoricalEntityWithCoordinates = CanonicalHistoricalEntity & {
  latitude: number;
  longitude: number;
};

type GeoJsonLike = Record<string, any>;
type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: Array<Record<string, unknown>>;
};
type BasemapFeatureProperties = {
  atlasFeatureId: string;
  atlasLabel: string;
  atlasParent?: string | null;
  atlasSubject?: string | null;
  atlasBorderPrecision?: number | null;
  NAME?: string | null;
  SUBJECTO?: string | null;
  PARTOF?: string | null;
  BORDERPRECISION?: number | null;
};
type BasemapFeature = {
  type: 'Feature';
  properties?: BasemapFeatureProperties;
  geometry?: Record<string, unknown> | null;
};
const EMPTY_FEATURE_COLLECTION: FeatureCollectionLike = {
  type: 'FeatureCollection',
  features: [],
};

const LOCAL_ATLAS_MAP_STYLE = {
  version: 8,
  name: 'Local Historical Atlas',
  sources: {},
  layers: [
    {
      id: 'atlas-ocean',
      type: 'background',
      paint: {
        'background-color': '#e4d4b8',
      },
    },
  ],
};

const formatYear = (year?: number) => {
  if (year === undefined) return 'Undated';
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year} CE`;
};

const formatTimespan = (entity: Pick<CanonicalHistoricalEntity, 'startYear' | 'endYear'>) => {
  if (entity.startYear !== undefined && entity.endYear !== undefined) {
    return `${formatYear(entity.startYear)} - ${formatYear(entity.endYear)}`;
  }
  if (entity.startYear !== undefined) {
    return `From ${formatYear(entity.startYear)}`;
  }
  if (entity.endYear !== undefined) {
    return `Until ${formatYear(entity.endYear)}`;
  }
  return 'No date range recorded';
};

const isVisibleInYear = (entity: Pick<CanonicalHistoricalEntity, 'startYear' | 'endYear'>, year: number) => {
  if (entity.startYear !== undefined && entity.endYear !== undefined) {
    return year >= entity.startYear && year <= entity.endYear;
  }
  if (entity.startYear !== undefined) {
    return year >= entity.startYear;
  }
  if (entity.endYear !== undefined) {
    return year <= entity.endYear;
  }
  return true;
};

const hasCoordinates = (
  entity: Pick<CanonicalHistoricalEntity, 'latitude' | 'longitude'>
): entity is CanonicalHistoricalEntityWithCoordinates =>
  typeof entity.latitude === 'number' && typeof entity.longitude === 'number';

const hasBoundaryGeometry = (entity: CanonicalHistoricalEntity) =>
  Boolean(entity.metadata?.hasGeoshape && entity.metadata?.geoshapeTitle);

const collectGeoJsonCoordinates = (value: unknown, accumulator: Array<[number, number]>) => {
  if (!Array.isArray(value)) return;

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    accumulator.push([value[0], value[1]]);
    return;
  }

  for (const entry of value) {
    collectGeoJsonCoordinates(entry, accumulator);
  }
};

const getGeoJsonBounds = (geojson: GeoJsonLike) => {
  const coordinates: Array<[number, number]> = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray((node as { features?: unknown }).features)) {
      for (const feature of (node as { features: unknown[] }).features) {
        visit(feature);
      }
      return;
    }

    if ((node as { geometry?: unknown }).geometry) {
      visit((node as { geometry: unknown }).geometry);
      return;
    }

    if (Array.isArray((node as { geometries?: unknown }).geometries)) {
      for (const geometry of (node as { geometries: unknown[] }).geometries) {
        visit(geometry);
      }
      return;
    }

    if ((node as { coordinates?: unknown }).coordinates) {
      collectGeoJsonCoordinates((node as { coordinates: unknown }).coordinates, coordinates);
    }
  };

  visit(geojson);

  if (coordinates.length === 0) return null;

  return {
    west: Math.min(...coordinates.map(([lng]) => lng)),
    east: Math.max(...coordinates.map(([lng]) => lng)),
    south: Math.min(...coordinates.map(([, lat]) => lat)),
    north: Math.max(...coordinates.map(([, lat]) => lat)),
  };
};

const buildAtlasGeoJson = (entities: CanonicalHistoricalEntity[]) => ({
  type: 'FeatureCollection',
  features: entities
    .filter(hasCoordinates)
    .map((entity) => ({
      type: 'Feature',
      properties: {
        id: entity.id,
        kind: entity.kind,
        title: entity.title,
      },
      geometry: {
        type: 'Point',
        coordinates: [entity.longitude, entity.latitude],
      },
    })),
});

const getAtlasYearBounds = (entities: CanonicalHistoricalEntity[]) => {
  const years = entities.flatMap((entity) =>
    [entity.startYear, entity.endYear].filter((value): value is number => value !== undefined)
  );

  if (years.length === 0) {
    return null;
  }

  return {
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
  };
};

const getBasemapLabel = (feature?: BasemapFeature | null) =>
  feature?.properties?.atlasLabel ??
  feature?.properties?.NAME ??
  feature?.properties?.SUBJECTO ??
  feature?.properties?.PARTOF ??
  'Unnamed region';

const isGeneratedRegionLabel = (value: string) => /^Region \d+$/.test(value);

const normalizeSearchText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const normalizeEntityLabel = (value?: string | null) =>
  value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? '';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const WorldHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [atlasEntities, setAtlasEntities] = useState<CanonicalHistoricalEntity[]>([]);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [searchKind, setSearchKind] = useState<HistoricalAtlasKind>(() => {
    const requestedKind = searchParams.get('kind');
    return atlasKindOptions.includes(requestedKind as HistoricalAtlasKind)
      ? (requestedKind as HistoricalAtlasKind)
      : 'all';
  });
  const [searchResults, setSearchResults] = useState<CanonicalHistoricalSearchMatch[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [isLoadingAtlas, setIsLoadingAtlas] = useState(true);
  const [isLoadingReferenceEntities, setIsLoadingReferenceEntities] = useState(true);
  const [isLoadingBasemapManifest, setIsLoadingBasemapManifest] = useState(true);
  const [isLoadingBasemapLayer, setIsLoadingBasemapLayer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [referenceEntitiesError, setReferenceEntitiesError] = useState<string | null>(null);
  const [basemapError, setBasemapError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingSaveAuthorityId, setPendingSaveAuthorityId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingPromoteId, setPendingPromoteId] = useState<number | null>(null);
  const [historicalBasemapManifest, setHistoricalBasemapManifest] =
    useState<HistoricalBasemapManifestResponse | null>(null);
  const [historicalBasemapLayer, setHistoricalBasemapLayer] =
    useState<HistoricalBasemapLayerResponse | null>(null);
  const [selectedGeometry, setSelectedGeometry] = useState<GeoJsonLike | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [selectedAtlasEntityId, setSelectedAtlasEntityId] = useState<number | null>(() => {
    const parsed = Number(searchParams.get('selected'));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [selectedBasemapFeatureId, setSelectedBasemapFeatureId] = useState<string | null>(null);
  const [hoveredBasemapFeatureId, setHoveredBasemapFeatureId] = useState<string | null>(null);
  const [basemapQuery, setBasemapQuery] = useState('');
  const [year, setYear] = useState(() => {
    const parsed = Number(searchParams.get('year'));
    return Number.isInteger(parsed) ? parsed : DEFAULT_YEAR;
  });
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const basemapPopupRef = useRef<maplibregl.Popup | null>(null);

  const atlasYearBounds = useMemo(() => getAtlasYearBounds(atlasEntities), [atlasEntities]);
  const yearBounds = useMemo(() => {
    if (historicalBasemapManifest?.datasetPresent && historicalBasemapManifest.availableYears.length > 0) {
      return {
        minYear: historicalBasemapManifest.minYear,
        maxYear: Math.max(
          historicalBasemapManifest.maxYear,
          atlasYearBounds?.maxYear ?? historicalBasemapManifest.maxYear
        ),
      };
    }

    if (atlasYearBounds) {
      return {
        minYear: Math.min(atlasYearBounds.minYear, DEFAULT_MIN_YEAR),
        maxYear: Math.max(atlasYearBounds.maxYear, DEFAULT_MAX_YEAR),
      };
    }

    return {
      minYear: DEFAULT_MIN_YEAR,
      maxYear: DEFAULT_MAX_YEAR,
    };
  }, [atlasYearBounds, historicalBasemapManifest]);

  useEffect(() => {
    setYear((currentYear) =>
      Math.min(Math.max(currentYear, yearBounds.minYear), yearBounds.maxYear)
    );
  }, [yearBounds.maxYear, yearBounds.minYear]);

  const ticks = useMemo(() => {
    const tickCount = 6;
    const span = Math.max(yearBounds.maxYear - yearBounds.minYear, 1);
    return Array.from({ length: tickCount }, (_, index) => {
      const value = yearBounds.minYear + (span / (tickCount - 1)) * index;
      return Math.round(value);
    });
  }, [yearBounds.maxYear, yearBounds.minYear]);

  const visibleAtlasEntities = useMemo(
    () => atlasEntities.filter((entity) => isVisibleInYear(entity, year)),
    [atlasEntities, year]
  );

  const mappableAtlasEntities = useMemo<CanonicalHistoricalEntityWithCoordinates[]>(
    () => visibleAtlasEntities.filter(hasCoordinates),
    [visibleAtlasEntities]
  );

  const savedAuthorityIds = useMemo(
    () => new Set(atlasEntities.map((entity) => `${entity.authority}:${entity.authorityId}`)),
    [atlasEntities]
  );

  const selectedAtlasEntity = useMemo(
    () =>
      atlasEntities.find((entity) => entity.id === selectedAtlasEntityId) ??
      visibleAtlasEntities[0] ??
      atlasEntities[0] ??
      null,
    [atlasEntities, selectedAtlasEntityId, visibleAtlasEntities]
  );

  const selectedVisibleAtlasEntity = useMemo<CanonicalHistoricalEntityWithCoordinates | null>(
    () =>
      selectedAtlasEntity && isVisibleInYear(selectedAtlasEntity, year) && hasCoordinates(selectedAtlasEntity)
        ? selectedAtlasEntity
        : null,
    [selectedAtlasEntity, year]
  );

  const topVisibleKinds = useMemo(() => {
    const counts = visibleAtlasEntities.reduce<Record<string, number>>((accumulator, entity) => {
      accumulator[entity.kind] = (accumulator[entity.kind] ?? 0) + 1;
      return accumulator;
    }, {});

    return atlasKindOptions
      .filter((kind) => kind !== 'all' && counts[kind] > 0)
      .map((kind) => `${kindLabels[kind]} ${counts[kind]}`);
  }, [visibleAtlasEntities]);

  const visibleTimelineEntities = useMemo(
    () =>
      [...visibleAtlasEntities].sort((left, right) => {
        const leftYear = left.startYear ?? left.endYear ?? Number.POSITIVE_INFINITY;
        const rightYear = right.startYear ?? right.endYear ?? Number.POSITIVE_INFINITY;
        return leftYear - rightYear || left.title.localeCompare(right.title);
      }),
    [visibleAtlasEntities]
  );

  const activeBasemapYear = useMemo(() => {
    const availableYears = historicalBasemapManifest?.availableYears ?? [];
    if (availableYears.length === 0) {
      return null;
    }

    let resolved = availableYears[0];
    for (const entry of availableYears) {
      if (entry.year <= year) {
        resolved = entry;
        continue;
      }
      break;
    }

    return resolved;
  }, [historicalBasemapManifest, year]);

  const activeBasemapFeatures = useMemo<BasemapFeature[]>(
    () =>
      Array.isArray((historicalBasemapLayer?.geojson as { features?: unknown })?.features)
        ? ((historicalBasemapLayer?.geojson as { features: BasemapFeature[] }).features ?? [])
        : [],
    [historicalBasemapLayer]
  );

  const selectedBasemapFeature = useMemo(
    () =>
      activeBasemapFeatures.find(
        (feature) => feature.properties?.atlasFeatureId === selectedBasemapFeatureId
      ) ?? null,
    [activeBasemapFeatures, selectedBasemapFeatureId]
  );

  const hoveredBasemapFeature = useMemo(
    () =>
      activeBasemapFeatures.find(
        (feature) => feature.properties?.atlasFeatureId === hoveredBasemapFeatureId
      ) ?? null,
    [activeBasemapFeatures, hoveredBasemapFeatureId]
  );

  const searchableBasemapFeatures = useMemo(() => {
    const seen = new Set<string>();

    return activeBasemapFeatures
      .filter((feature) => {
        const label = getBasemapLabel(feature);
        if (!label || isGeneratedRegionLabel(label)) {
          return false;
        }

        const key = `${label}::${feature.properties?.atlasParent ?? ''}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        const leftLabel = getBasemapLabel(left);
        const rightLabel = getBasemapLabel(right);
        return leftLabel.localeCompare(rightLabel);
      });
  }, [activeBasemapFeatures]);

  const filteredBasemapFeatures = useMemo(() => {
    const normalizedQuery = normalizeSearchText(basemapQuery);
    if (!normalizedQuery) {
      return searchableBasemapFeatures.slice(0, 18);
    }

    return searchableBasemapFeatures
      .map((feature) => {
        const label = normalizeSearchText(getBasemapLabel(feature));
        const parent = normalizeSearchText(feature.properties?.atlasParent);
        const subject = normalizeSearchText(feature.properties?.atlasSubject);
        let score = 0;

        if (label === normalizedQuery) score += 100;
        else if (label.startsWith(normalizedQuery)) score += 60;
        else if (label.includes(normalizedQuery)) score += 30;

        if (parent.startsWith(normalizedQuery)) score += 16;
        else if (parent.includes(normalizedQuery)) score += 8;

        if (subject.startsWith(normalizedQuery)) score += 12;
        else if (subject.includes(normalizedQuery)) score += 6;

        return { feature, score };
      })
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          getBasemapLabel(left.feature).localeCompare(getBasemapLabel(right.feature))
      )
      .slice(0, 18)
      .map((entry) => entry.feature);
  }, [basemapQuery, searchableBasemapFeatures]);

  const selectedBasemapLabel = useMemo(
    () => normalizeEntityLabel(getBasemapLabel(selectedBasemapFeature)),
    [selectedBasemapFeature]
  );

  const matchedAtlasEntities = useMemo(() => {
    if (!selectedBasemapFeature || !selectedBasemapLabel) {
      return [];
    }

    return atlasEntities
      .filter(
        (entity) =>
          MATCHABLE_ATLAS_ENTITY_KINDS.has(entity.kind) &&
          normalizeEntityLabel(entity.title) === selectedBasemapLabel
      )
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [atlasEntities, selectedBasemapFeature, selectedBasemapLabel]);

  const matchedAtlasReferenceEntityIds = useMemo(
    () =>
      new Set(
        matchedAtlasEntities
          .map((entity) => entity.referenceEntityId)
          .filter((value): value is number => typeof value === 'number')
      ),
    [matchedAtlasEntities]
  );

  const matchedReferenceEntities = useMemo(() => {
    if (!selectedBasemapFeature || !selectedBasemapLabel) {
      return [];
    }

    return referenceEntities
      .filter(
        (entity) =>
          MATCHABLE_REFERENCE_ENTITY_KINDS.has(entity.kind) &&
          normalizeEntityLabel(entity.title) === selectedBasemapLabel &&
          !matchedAtlasReferenceEntityIds.has(entity.id)
      )
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [
    matchedAtlasReferenceEntityIds,
    referenceEntities,
    selectedBasemapFeature,
    selectedBasemapLabel,
  ]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (query.trim()) nextParams.set('q', query.trim());
    else nextParams.delete('q');

    if (searchKind !== 'all') nextParams.set('kind', searchKind);
    else nextParams.delete('kind');

    nextParams.set('year', String(year));

    if (selectedAtlasEntityId) nextParams.set('selected', String(selectedAtlasEntityId));
    else nextParams.delete('selected');

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [query, searchKind, year, selectedAtlasEntityId, searchParams, setSearchParams]);

  useEffect(() => {
    const loadHistoricalBasemapManifest = async () => {
      setIsLoadingBasemapManifest(true);
      setBasemapError(null);

      try {
        const manifest = await fetchHistoricalBasemapManifest(DEFAULT_BASEMAP_CUTOFF_YEAR);
        setHistoricalBasemapManifest(manifest);
      } catch (error) {
        setHistoricalBasemapManifest(null);
        setBasemapError(
          error instanceof Error ? error.message : 'Failed to load the historical basemap index.'
        );
      } finally {
        setIsLoadingBasemapManifest(false);
      }
    };

    void loadHistoricalBasemapManifest();
  }, []);

  useEffect(() => {
    const loadAtlas = async () => {
      setIsLoadingAtlas(true);
      setAtlasError(null);
      try {
        const entities = await fetchHistoricalAtlasEntities();
        setAtlasEntities(entities);
        if (entities[0]) {
          setSelectedAtlasEntityId((current) => current ?? entities[0].id);
        }
      } catch (error) {
        setAtlasError(error instanceof Error ? error.message : 'Failed to load the atlas shelf.');
      } finally {
        setIsLoadingAtlas(false);
      }
    };

    void loadAtlas();
  }, []);

  useEffect(() => {
    const loadReferenceEntities = async () => {
      setIsLoadingReferenceEntities(true);
      setReferenceEntitiesError(null);

      try {
        const entities = await fetchReferenceEntities();
        setReferenceEntities(entities);
      } catch (error) {
        setReferenceEntities([]);
        setReferenceEntitiesError(
          error instanceof Error ? error.message : 'Failed to load local encyclopedia entities.'
        );
      } finally {
        setIsLoadingReferenceEntities(false);
      }
    };

    void loadReferenceEntities();
  }, []);

  useEffect(() => {
    const loadHistoricalBasemapLayer = async () => {
      if (!activeBasemapYear) {
        setHistoricalBasemapLayer(null);
        return;
      }

      setIsLoadingBasemapLayer(true);
      setBasemapError(null);
      try {
        const layer = await fetchHistoricalBasemapLayer(
          activeBasemapYear.year,
          DEFAULT_BASEMAP_CUTOFF_YEAR
        );
        setHistoricalBasemapLayer(layer);
      } catch (error) {
        setHistoricalBasemapLayer(null);
        setBasemapError(
          error instanceof Error ? error.message : 'Failed to load the historical basemap layer.'
        );
      } finally {
        setIsLoadingBasemapLayer(false);
      }
    };

    void loadHistoricalBasemapLayer();
  }, [activeBasemapYear]);

  useEffect(() => {
    if (!selectedBasemapFeatureId) return;

    const stillPresent = activeBasemapFeatures.some(
      (feature) => feature.properties?.atlasFeatureId === selectedBasemapFeatureId
    );
    if (!stillPresent) {
      setSelectedBasemapFeatureId(null);
    }
  }, [activeBasemapFeatures, selectedBasemapFeatureId]);

  useEffect(() => {
    if (!hoveredBasemapFeatureId) return;

    const stillPresent = activeBasemapFeatures.some(
      (feature) => feature.properties?.atlasFeatureId === hoveredBasemapFeatureId
    );
    if (!stillPresent) {
      setHoveredBasemapFeatureId(null);
    }
  }, [activeBasemapFeatures, hoveredBasemapFeatureId]);

  useEffect(() => {
    if (!query.trim()) return;

    void runSearch();
    // Seed once from URL-backed initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadGeometry = async () => {
      if (!selectedAtlasEntity || !hasBoundaryGeometry(selectedAtlasEntity)) {
        setSelectedGeometry(null);
        setGeometryError(null);
        return;
      }

      try {
        setGeometryError(null);
        const geometry = await fetchHistoricalAtlasGeometry(selectedAtlasEntity.id);
        setSelectedGeometry(geometry.geojson);
      } catch (error) {
        setSelectedGeometry(null);
        setGeometryError(
          error instanceof Error ? error.message : 'Failed to load boundary geometry.'
        );
      }
    };

    void loadGeometry();
  }, [selectedAtlasEntity]);

  const runSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError('Enter a name, region, ruler, battle, or period to search.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setStatusMessage(null);

    try {
      const results = await searchHistoricalAtlas(trimmedQuery, searchKind, 12);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching authority records came back for that search.');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Failed to search the history atlas.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveAtlasEntity = async (match: CanonicalHistoricalSearchMatch) => {
    setPendingSaveAuthorityId(match.authorityId);
    setStatusMessage(null);

    try {
      const saved = await saveHistoricalAtlasEntity(match);
      setAtlasEntities((current) => {
        const remaining = current.filter(
          (entity) => !(entity.authority === saved.authority && entity.authorityId === saved.authorityId)
        );
        return [...remaining, saved].sort((left, right) => left.title.localeCompare(right.title));
      });
      setSelectedAtlasEntityId(saved.id);
      setStatusMessage(`Saved "${saved.title}" to the atlas shelf.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save atlas entity.');
    } finally {
      setPendingSaveAuthorityId(null);
    }
  };

  const handleDeleteAtlasEntity = async (entity: CanonicalHistoricalEntity) => {
    setPendingDeleteId(entity.id);
    setStatusMessage(null);

    try {
      await deleteHistoricalAtlasEntity(entity.id);
      setAtlasEntities((current) => current.filter((entry) => entry.id !== entity.id));
      setSelectedAtlasEntityId((current) => (current === entity.id ? null : current));
      setStatusMessage(`Removed "${entity.title}" from the atlas shelf.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to remove atlas entity.');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handlePromoteToEntity = async (entity: CanonicalHistoricalEntity) => {
    setPendingPromoteId(entity.id);
    setStatusMessage(null);

    try {
      const promoted = await promoteHistoricalAtlasEntity(entity.id);
      setAtlasEntities((current) =>
        current.map((entry) => (entry.id === promoted.atlasEntity.id ? promoted.atlasEntity : entry))
      );
      navigate(`/entities/${promoted.referenceEntity.id}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create a local entity.');
    } finally {
      setPendingPromoteId(null);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let disposed = false;
    let localMap: MapLibreMap | null = null;

    const loadMap = async () => {
      try {
        if (disposed || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: LOCAL_ATLAS_MAP_STYLE as any,
          center: [10, 28],
          zoom: 1.9,
          minZoom: 1,
          maxZoom: 8,
        });

        localMap = map;
        mapRef.current = map;
        setMapError(null);

        map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');

        map.on('error', () => {
          setMapError('The local atlas map failed to render.');
        });

        map.on('load', () => {
          mapLoadedRef.current = true;

          map.addSource('atlas-historical-basemap', {
            type: 'geojson',
            data: EMPTY_FEATURE_COLLECTION as any,
          });

          map.addSource('atlas-entities', {
            type: 'geojson',
            data: buildAtlasGeoJson([]) as any,
          });

          map.addSource('atlas-selected-geometry', {
            type: 'geojson',
            data: EMPTY_FEATURE_COLLECTION as any,
          });

        map.addSource('atlas-selected-basemap-feature', {
          type: 'geojson',
          data: EMPTY_FEATURE_COLLECTION as any,
        });

        map.addSource('atlas-hovered-basemap-feature', {
          type: 'geojson',
          data: EMPTY_FEATURE_COLLECTION as any,
        });

          map.addLayer({
            id: 'atlas-historical-basemap-fill',
            type: 'fill',
            source: 'atlas-historical-basemap',
            paint: {
              'fill-color': '#a8855c',
              'fill-opacity': 0.28,
            },
          });

          map.addLayer({
            id: 'atlas-historical-basemap-outline',
            type: 'line',
            source: 'atlas-historical-basemap',
            paint: {
              'line-color': '#54381f',
              'line-width': 1.25,
              'line-opacity': 0.9,
            },
          });

          map.addLayer({
            id: 'atlas-selected-basemap-feature-fill',
            type: 'fill',
            source: 'atlas-selected-basemap-feature',
            paint: {
              'fill-color': '#b64b2f',
              'fill-opacity': 0.18,
            },
          });

        map.addLayer({
          id: 'atlas-selected-basemap-feature-outline',
          type: 'line',
          source: 'atlas-selected-basemap-feature',
            paint: {
              'line-color': '#8d3118',
              'line-width': 2.2,
              'line-opacity': 0.96,
          },
        });

        map.addLayer({
          id: 'atlas-hovered-basemap-feature-fill',
          type: 'fill',
          source: 'atlas-hovered-basemap-feature',
          paint: {
            'fill-color': '#f5f0dd',
            'fill-opacity': 0.12,
          },
        });

        map.addLayer({
          id: 'atlas-hovered-basemap-feature-outline',
          type: 'line',
          source: 'atlas-hovered-basemap-feature',
          paint: {
            'line-color': '#f8f1e5',
            'line-width': 1.4,
            'line-opacity': 0.95,
          },
        });

          map.addLayer({
            id: 'atlas-entities-points',
            type: 'circle',
            source: 'atlas-entities',
            paint: {
              'circle-radius': 6,
              'circle-color': [
                'match',
                ['get', 'kind'],
                'battle',
                '#a0462d',
                'ruler',
                '#8c4f1f',
                'person',
                '#a0762b',
                'nation',
                '#376b6d',
                'civilization',
                '#91593a',
                'era',
                '#6d5f88',
                'region',
                '#5a6d48',
                '#2f5b86',
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#f9f0df',
              'circle-opacity': 0.94,
            },
          });

          map.addLayer({
            id: 'atlas-entities-selected',
            type: 'circle',
            source: 'atlas-entities',
            paint: {
              'circle-radius': 11,
              'circle-color': 'rgba(255, 255, 255, 0)',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#3a2a1b',
            },
            filter: ['==', ['get', 'id'], -1],
          });

          map.addLayer({
            id: 'atlas-selected-geometry-fill',
            type: 'fill',
            source: 'atlas-selected-geometry',
            paint: {
              'fill-color': '#8d5d35',
              'fill-opacity': 0.18,
            },
          });

          map.addLayer({
            id: 'atlas-selected-geometry-outline',
            type: 'line',
            source: 'atlas-selected-geometry',
            paint: {
              'line-color': '#5b3822',
              'line-width': 2,
              'line-opacity': 0.82,
            },
          });

          map.on('click', 'atlas-entities-points', (event) => {
            const feature = event.features?.[0];
            const id = feature?.properties?.id;
            const parsedId = typeof id === 'number' ? id : Number(id);
            if (Number.isInteger(parsedId) && parsedId > 0) {
              setSelectedAtlasEntityId(parsedId);
            }
          });

          map.on('mouseenter', 'atlas-entities-points', () => {
            map.getCanvas().style.cursor = 'pointer';
          });

          map.on('mouseleave', 'atlas-entities-points', () => {
            map.getCanvas().style.cursor = '';
          });

        map.on('click', 'atlas-historical-basemap-fill', (event) => {
          const feature = event.features?.[0] as BasemapFeature | undefined;
          const featureId = feature?.properties?.atlasFeatureId;
          if (typeof featureId === 'string' && featureId) {
            setSelectedBasemapFeatureId(featureId);
          }
        });

        map.on('mouseenter', 'atlas-historical-basemap-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mousemove', 'atlas-historical-basemap-fill', (event) => {
          const feature = event.features?.[0] as BasemapFeature | undefined;
          const featureId = feature?.properties?.atlasFeatureId;
          if (typeof featureId === 'string' && featureId) {
            setHoveredBasemapFeatureId(featureId);
          } else {
            setHoveredBasemapFeatureId(null);
          }

          if (!feature) return;

          const label = getBasemapLabel(feature);
          const parent = feature.properties?.atlasParent;
          const subject = feature.properties?.atlasSubject;
          const precision = feature.properties?.atlasBorderPrecision;

          if (!basemapPopupRef.current) {
            basemapPopupRef.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 14,
              className: 'world-history-map-popup',
            });
          }

          const detail = parent || subject || 'Standalone region';
          basemapPopupRef.current
            .setLngLat(event.lngLat)
            .setHTML(
              `<div class="world-history-map-popup__content">
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(detail)}</span>
                <span>Border precision: ${escapeHtml(String(precision ?? 'Unknown'))}</span>
              </div>`
            )
            .addTo(map);
        });

        map.on('mouseleave', 'atlas-historical-basemap-fill', () => {
          map.getCanvas().style.cursor = '';
          setHoveredBasemapFeatureId(null);
          basemapPopupRef.current?.remove();
        });
      });
      } catch (error) {
        setMapError(error instanceof Error ? error.message : 'Failed to initialize the atlas map.');
      }
    };

    void loadMap();

    return () => {
      disposed = true;
      mapLoadedRef.current = false;
      basemapPopupRef.current?.remove();
      localMap?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const basemapSource = map.getSource('atlas-historical-basemap') as GeoJSONSource | undefined;
    const selectedBasemapSource = map.getSource('atlas-selected-basemap-feature') as GeoJSONSource | undefined;
    const hoveredBasemapSource = map.getSource('atlas-hovered-basemap-feature') as GeoJSONSource | undefined;
    const source = map.getSource('atlas-entities') as GeoJSONSource | undefined;
    const geometrySource = map.getSource('atlas-selected-geometry') as GeoJSONSource | undefined;
    if (!basemapSource || !selectedBasemapSource || !hoveredBasemapSource || !source || !geometrySource) return;

    basemapSource.setData((historicalBasemapLayer?.geojson ?? EMPTY_FEATURE_COLLECTION) as any);
    selectedBasemapSource.setData(
      selectedBasemapFeature
        ? ({
            type: 'FeatureCollection',
            features: [selectedBasemapFeature],
          } as any)
        : (EMPTY_FEATURE_COLLECTION as any)
    );
    hoveredBasemapSource.setData(
      hoveredBasemapFeature && hoveredBasemapFeature.properties?.atlasFeatureId !== selectedBasemapFeatureId
        ? ({
            type: 'FeatureCollection',
            features: [hoveredBasemapFeature],
          } as any)
        : (EMPTY_FEATURE_COLLECTION as any)
    );
    source.setData(buildAtlasGeoJson(visibleAtlasEntities) as any);
    geometrySource.setData(
      (selectedGeometry ?? EMPTY_FEATURE_COLLECTION) as any
    );

    const selectedId =
      selectedVisibleAtlasEntity && hasCoordinates(selectedVisibleAtlasEntity)
        ? selectedVisibleAtlasEntity.id
        : -1;
    if (map.getLayer('atlas-entities-selected')) {
      map.setFilter('atlas-entities-selected', ['==', ['get', 'id'], selectedId] as any);
    }

    if (selectedGeometry) {
      const bounds = getGeoJsonBounds(selectedGeometry);
      if (bounds) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: 70, duration: 900, maxZoom: 5.2 }
        );
        return;
      }
    }

    if (selectedBasemapFeature) {
      const bounds = getGeoJsonBounds({
        type: 'FeatureCollection',
        features: [selectedBasemapFeature],
      });
      if (bounds) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: 70, duration: 900, maxZoom: 5.2 }
        );
        return;
      }
    }

    if (selectedVisibleAtlasEntity) {
      map.flyTo({
        center: [selectedVisibleAtlasEntity.longitude, selectedVisibleAtlasEntity.latitude],
        zoom: 4.5,
        duration: 900,
      });
      return;
    }

    if (mappableAtlasEntities.length === 1) {
      map.flyTo({
        center: [mappableAtlasEntities[0].longitude, mappableAtlasEntities[0].latitude],
        zoom: 3.8,
        duration: 900,
      });
      return;
    }

    if (mappableAtlasEntities.length > 1) {
      const west = Math.min(...mappableAtlasEntities.map((entity) => entity.longitude));
      const east = Math.max(...mappableAtlasEntities.map((entity) => entity.longitude));
      const south = Math.min(...mappableAtlasEntities.map((entity) => entity.latitude));
      const north = Math.max(...mappableAtlasEntities.map((entity) => entity.latitude));
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 80, duration: 900, maxZoom: 4.8 }
      );
    }
  }, [
    historicalBasemapLayer,
    hoveredBasemapFeature,
    mappableAtlasEntities,
    selectedBasemapFeature,
    selectedBasemapFeatureId,
    selectedGeometry,
    selectedVisibleAtlasEntity,
    visibleAtlasEntities,
  ]);

  return (
    <div className="world-history-page">
      <div className="world-history-frame">
        <header className="world-history-header">
          <div className="world-history-title">
            <span className="world-history-eyebrow">World History</span>
            <h1>Canonical Atlas</h1>
            <p>
              Read local historical boundaries as the base layer, then pin canonical records on top so the
              map starts behaving like an atlas instead of a static demo.
            </p>
          </div>

          <div className="world-history-meta">
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Year</span>
              <span className="world-history-meta-value">{formatYear(year)}</span>
            </div>
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Boundary snapshot</span>
              <span className="world-history-meta-value">
                {activeBasemapYear ? formatYear(activeBasemapYear.year) : 'Unavailable'}
              </span>
              <span className="world-history-hint">
                {historicalBasemapManifest?.datasetPresent
                  ? `${activeBasemapYear?.countryCount ?? 0} regions from historical-basemaps`
                  : 'Clone the local historical-basemaps dataset to enable polygon layers.'}
              </span>
            </div>
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Visible atlas entities</span>
              <span className="world-history-meta-value">{visibleAtlasEntities.length}</span>
              {topVisibleKinds[0] && <span className="world-history-hint">{topVisibleKinds.join(' · ')}</span>}
            </div>
            <div className="world-history-meta-card">
              <span className="world-history-meta-label">Mapped right now</span>
              <span className="world-history-meta-value">{mappableAtlasEntities.length}</span>
              <span className="world-history-hint">
                Overlay source: pinned authority records from Wikidata.
                {historicalBasemapLayer ? ` Snapshot regions: ${historicalBasemapLayer.featureCount}.` : ''}
              </span>
            </div>
          </div>
        </header>

        <div className="world-history-layout">
          <aside className="world-history-sidebar">
            <section className="world-history-panel">
              <div className="world-history-panel__header">
                <div>
                  <span className="world-history-panel__eyebrow">Search</span>
                  <h2>Bring in canonical history</h2>
                </div>
              </div>

              <div className="world-history-search">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void runSearch();
                    }
                  }}
                  placeholder="Hegel, Roman Empire, Battle of Actium..."
                />

                <div className="world-history-search__controls">
                  <select value={searchKind} onChange={(event) => setSearchKind(event.target.value as HistoricalAtlasKind)}>
                    {atlasKindOptions.map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabels[kind]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void runSearch()} disabled={isSearching}>
                    {isSearching ? 'Searching…' : 'Search authority'}
                  </button>
                </div>
              </div>

              {searchError && <div className="world-history-feedback is-error">{searchError}</div>}
              {statusMessage && <div className="world-history-feedback">{statusMessage}</div>}

              <div className="world-history-results">
                {searchResults.length === 0 ? (
                  <div className="world-history-empty">
                    Search first, then pin the records that should live in your atlas shelf.
                  </div>
                ) : (
                  searchResults.map((result) => {
                    const saveKey = `${result.authority}:${result.authorityId}`;
                    const isSaved = savedAuthorityIds.has(saveKey);
                    return (
                      <article key={saveKey} className="world-history-result-card">
                        <div className="world-history-result-card__head">
                          <div>
                            <span className="world-history-kind-chip">{kindLabels[result.kind]}</span>
                            <h3>{result.title}</h3>
                          </div>
                          {result.imageUrl && (
                            <img
                              src={result.imageUrl}
                              alt=""
                              className="world-history-result-card__thumb"
                            />
                          )}
                        </div>
                        <p>{result.summary || 'No authority summary was returned for this record.'}</p>
                        <div className="world-history-result-card__meta">
                          <span>{formatTimespan(result)}</span>
                          <span>{hasCoordinates(result) ? 'Mapped point available' : 'No coordinates yet'}</span>
                          <span>{result.metadata?.hasGeoshape ? 'Boundary available' : 'Point only'}</span>
                        </div>
                        <div className="world-history-result-card__actions">
                          <button
                            type="button"
                            className="is-primary"
                            onClick={() => void handleSaveAtlasEntity(result)}
                            disabled={isSaved || pendingSaveAuthorityId === result.authorityId}
                          >
                            {isSaved
                              ? 'Pinned'
                              : pendingSaveAuthorityId === result.authorityId
                                ? 'Pinning…'
                                : 'Pin to atlas'}
                          </button>
                          {result.sourceUrl && (
                            <a href={result.sourceUrl} target="_blank" rel="noreferrer">
                              Source
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </aside>

          <section className="world-history-main">
            <section className="world-history-map">
              <div ref={mapContainerRef} className="world-history-map__canvas" />
              {mapError && (
                <div className="world-history-map__overlay">
                  <strong>Map unavailable</strong>
                  <span>
                    {mapError}
                  </span>
                </div>
              )}
            </section>

            {basemapError ? (
              <div className="world-history-feedback is-error">{basemapError}</div>
            ) : null}

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
              <div className="world-history-timeline__meta">
                <span>
                  Basemap snaps to the nearest available year from {formatYear(DEFAULT_BASEMAP_CUTOFF_YEAR)} onward.
                </span>
                <strong>
                  {isLoadingBasemapManifest || isLoadingBasemapLayer
                    ? 'Loading boundary snapshot…'
                    : activeBasemapYear
                      ? `Showing ${formatYear(activeBasemapYear.year)}`
                      : 'No basemap snapshot loaded'}
                </strong>
              </div>
            </section>

            <div className="world-history-details-grid">
              <section className="world-history-panel">
                <div className="world-history-panel__header">
                  <div>
                    <span className="world-history-panel__eyebrow">Selected</span>
                    <h2>{selectedAtlasEntity ? selectedAtlasEntity.title : 'No atlas entity selected'}</h2>
                  </div>
                </div>

                {!selectedAtlasEntity ? (
                  <div className="world-history-empty">Pin an authority record and select it to inspect it here.</div>
                ) : (
                  <div className="world-history-selected-card">
                    <div className="world-history-selected-card__head">
                      <div>
                        <span className="world-history-kind-chip">{kindLabels[selectedAtlasEntity.kind]}</span>
                        <p className="world-history-selected-card__timespan">
                          {formatTimespan(selectedAtlasEntity)}
                        </p>
                      </div>
                      {selectedAtlasEntity.imageUrl && (
                        <img
                          src={selectedAtlasEntity.imageUrl}
                          alt=""
                          className="world-history-selected-card__thumb"
                        />
                      )}
                    </div>

                    <p>{selectedAtlasEntity.summary || 'No authority summary is stored for this atlas entity yet.'}</p>

                    <div className="world-history-selected-card__facts">
                      <div>
                        <span className="world-history-panel__eyebrow">Map state</span>
                        <strong>
                          {hasCoordinates(selectedAtlasEntity)
                            ? `${selectedAtlasEntity.latitude.toFixed(2)}, ${selectedAtlasEntity.longitude.toFixed(2)}`
                            : 'No coordinates yet'}
                        </strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Visible at {formatYear(year)}</span>
                        <strong>{isVisibleInYear(selectedAtlasEntity, year) ? 'Yes' : 'No'}</strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Local encyclopedia</span>
                        <strong>{selectedAtlasEntity.referenceEntityId ? 'Linked' : 'Not linked yet'}</strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Boundary layer</span>
                        <strong>{hasBoundaryGeometry(selectedAtlasEntity) ? 'Available' : 'Point only'}</strong>
                      </div>
                    </div>

                    <div className="world-history-selected-card__actions">
                      {selectedAtlasEntity.referenceEntityId ? (
                        <button
                          type="button"
                          className="is-primary"
                          onClick={() => navigate(`/entities/${selectedAtlasEntity.referenceEntityId}`)}
                        >
                          Open linked entity
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="is-primary"
                          onClick={() => void handlePromoteToEntity(selectedAtlasEntity)}
                          disabled={pendingPromoteId === selectedAtlasEntity.id}
                        >
                          {pendingPromoteId === selectedAtlasEntity.id ? 'Opening…' : 'Create local entity'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="is-destructive"
                        onClick={() => void handleDeleteAtlasEntity(selectedAtlasEntity)}
                        disabled={pendingDeleteId === selectedAtlasEntity.id}
                      >
                        {pendingDeleteId === selectedAtlasEntity.id ? 'Removing…' : 'Remove from atlas'}
                      </button>
                      {selectedAtlasEntity.sourceUrl && (
                        <a href={selectedAtlasEntity.sourceUrl} target="_blank" rel="noreferrer">
                          Authority record
                        </a>
                      )}
                    </div>
                    {geometryError ? (
                      <div className="world-history-feedback is-error">{geometryError}</div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="world-history-panel">
                <div className="world-history-panel__header">
                  <div>
                    <span className="world-history-panel__eyebrow">Snapshot</span>
                    <h2>{selectedBasemapFeature ? getBasemapLabel(selectedBasemapFeature) : 'Select a region'}</h2>
                  </div>
                  {selectedBasemapFeature ? (
                    <button
                      type="button"
                      className="world-history-clear-button"
                      onClick={() => setSelectedBasemapFeatureId(null)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {!selectedBasemapFeature ? (
                  <div className="world-history-empty">
                    Click a boundary on the active historical basemap to inspect the region for this snapshot year.
                  </div>
                ) : (
                  <div className="world-history-selected-card">
                    <div className="world-history-selected-card__facts">
                      <div>
                        <span className="world-history-panel__eyebrow">Snapshot year</span>
                        <strong>{activeBasemapYear ? formatYear(activeBasemapYear.year) : 'Unavailable'}</strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Part of</span>
                        <strong>{selectedBasemapFeature.properties?.atlasParent || 'Standalone region'}</strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Subject</span>
                        <strong>{selectedBasemapFeature.properties?.atlasSubject || 'No subject note'}</strong>
                      </div>
                      <div>
                        <span className="world-history-panel__eyebrow">Border precision</span>
                        <strong>
                          {selectedBasemapFeature.properties?.atlasBorderPrecision ?? 'Unknown'}
                        </strong>
                      </div>
                    </div>
                    <div className="world-history-reconciliation">
                      <div className="world-history-reconciliation__header">
                        <div>
                          <span className="world-history-panel__eyebrow">Reconciliation</span>
                          <strong>Known matches for this region</strong>
                        </div>
                        <span className="world-history-count-chip">
                          {matchedAtlasEntities.length + matchedReferenceEntities.length}
                        </span>
                      </div>

                      {isLoadingReferenceEntities ? (
                        <div className="world-history-empty">
                          Checking the local encyclopedia for matching region records…
                        </div>
                      ) : referenceEntitiesError ? (
                        <div className="world-history-feedback is-error">{referenceEntitiesError}</div>
                      ) : matchedAtlasEntities.length === 0 && matchedReferenceEntities.length === 0 ? (
                        <div className="world-history-empty">
                          No pinned atlas record or local encyclopedia entity matches this region name yet.
                        </div>
                      ) : (
                        <div className="world-history-reconciliation__groups">
                          {matchedAtlasEntities.length > 0 ? (
                            <div className="world-history-reconciliation__group">
                              <div className="world-history-reconciliation__group-header">
                                <span className="world-history-panel__eyebrow">Atlas shelf</span>
                                <span className="world-history-count-chip">{matchedAtlasEntities.length}</span>
                              </div>
                              <div className="world-history-reconciliation__list">
                                {matchedAtlasEntities.map((entity) => (
                                  <article
                                    key={`atlas-match-${entity.id}`}
                                    className="world-history-reconciliation-card"
                                  >
                                    <div className="world-history-reconciliation-card__head">
                                      <div className="world-history-shelf-card__chips">
                                        <span className="world-history-kind-chip">
                                          {kindLabels[entity.kind]}
                                        </span>
                                        {entity.referenceEntityId ? (
                                          <span className="world-history-linked-chip">Linked</span>
                                        ) : null}
                                        {hasBoundaryGeometry(entity) ? (
                                          <span className="world-history-boundary-chip">Boundary</span>
                                        ) : null}
                                      </div>
                                      <strong>{entity.title}</strong>
                                    </div>
                                    <span className="world-history-hint">{formatTimespan(entity)}</span>
                                    <div className="world-history-reconciliation-card__actions">
                                      <button
                                        type="button"
                                        className="is-primary"
                                        onClick={() => setSelectedAtlasEntityId(entity.id)}
                                      >
                                        Focus atlas record
                                      </button>
                                      {entity.referenceEntityId ? (
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/entities/${entity.referenceEntityId}`)}
                                        >
                                          Open linked entity
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => void handlePromoteToEntity(entity)}
                                          disabled={pendingPromoteId === entity.id}
                                        >
                                          {pendingPromoteId === entity.id ? 'Creating…' : 'Create local entity'}
                                        </button>
                                      )}
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {matchedReferenceEntities.length > 0 ? (
                            <div className="world-history-reconciliation__group">
                              <div className="world-history-reconciliation__group-header">
                                <span className="world-history-panel__eyebrow">Local encyclopedia</span>
                                <span className="world-history-count-chip">{matchedReferenceEntities.length}</span>
                              </div>
                              <div className="world-history-reconciliation__list">
                                {matchedReferenceEntities.map((entity) => (
                                  <article
                                    key={`reference-match-${entity.id}`}
                                    className="world-history-reconciliation-card"
                                  >
                                    <div className="world-history-reconciliation-card__head">
                                      <div className="world-history-shelf-card__chips">
                                        <span className="world-history-kind-chip">
                                          {referenceEntityKindLabels[entity.kind]}
                                        </span>
                                      </div>
                                      <strong>{entity.title}</strong>
                                    </div>
                                    <span className="world-history-hint">
                                      {entity.startYear !== undefined || entity.endYear !== undefined
                                        ? formatTimespan(entity)
                                        : 'No local date range recorded'}
                                    </span>
                                    <div className="world-history-reconciliation-card__actions">
                                      <button
                                        type="button"
                                        className="is-primary"
                                        onClick={() => navigate(`/entities/${entity.id}`)}
                                      >
                                        Open local entity
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <p>
                      This region comes from the local historical-basemaps snapshot, not from your pinned authority
                      shelf. Use it as the geographic frame for the current year.
                    </p>
                  </div>
                )}
              </section>

              <section className="world-history-panel">
                <div className="world-history-panel__header">
                  <div>
                    <span className="world-history-panel__eyebrow">Jump</span>
                    <h2>Regions in this snapshot</h2>
                  </div>
                  <span className="world-history-count-chip">{searchableBasemapFeatures.length}</span>
                </div>

                <div className="world-history-region-search">
                  <input
                    type="text"
                    value={basemapQuery}
                    onChange={(event) => setBasemapQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredBasemapFeatures[0]) {
                        event.preventDefault();
                        setSelectedBasemapFeatureId(
                          filteredBasemapFeatures[0].properties?.atlasFeatureId ?? null
                        );
                      }
                    }}
                    placeholder={`Search ${activeBasemapYear ? formatYear(activeBasemapYear.year) : 'snapshot'} regions`}
                  />
                  <span className="world-history-hint">
                    Search works against the currently active basemap year only.
                  </span>
                </div>

                {filteredBasemapFeatures.length === 0 ? (
                  <div className="world-history-empty">
                    No named regions in this snapshot match that search.
                  </div>
                ) : (
                  <div className="world-history-region-results">
                    {filteredBasemapFeatures.map((feature) => {
                      const featureId = feature.properties?.atlasFeatureId;
                      const isSelected = featureId === selectedBasemapFeatureId;
                      return (
                        <button
                          key={featureId}
                          type="button"
                          className={`world-history-region-result ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedBasemapFeatureId(featureId ?? null)}
                        >
                          <strong>{getBasemapLabel(feature)}</strong>
                          <span>
                            {feature.properties?.atlasParent || feature.properties?.atlasSubject || 'Standalone region'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="world-history-panel">
                <div className="world-history-panel__header">
                  <div>
                    <span className="world-history-panel__eyebrow">Shelf</span>
                    <h2>Atlas entities</h2>
                  </div>
                  <span className="world-history-count-chip">{atlasEntities.length}</span>
                </div>

                {isLoadingAtlas ? (
                  <div className="world-history-empty">Loading your atlas shelf…</div>
                ) : atlasError ? (
                  <div className="world-history-feedback is-error">{atlasError}</div>
                ) : atlasEntities.length === 0 ? (
                  <div className="world-history-empty">
                    Your atlas shelf is empty. Search on the left and pin canonical records here first.
                  </div>
                ) : (
                  <div className="world-history-shelf">
                    {atlasEntities.map((entity) => {
                      const isSelected = entity.id === selectedAtlasEntity?.id;
                      const isVisible = isVisibleInYear(entity, year);
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          className={`world-history-shelf-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedAtlasEntityId(entity.id)}
                        >
                          <div className="world-history-shelf-card__head">
                            <div className="world-history-shelf-card__chips">
                              <span className="world-history-kind-chip">{kindLabels[entity.kind]}</span>
                              {hasBoundaryGeometry(entity) ? (
                                <span className="world-history-boundary-chip">Boundary</span>
                              ) : null}
                            </div>
                            <span className={`world-history-visibility-dot ${isVisible ? 'is-visible' : ''}`} />
                          </div>
                          <strong>{entity.title}</strong>
                          <span>{formatTimespan(entity)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="world-history-panel">
                <div className="world-history-panel__header">
                  <div>
                    <span className="world-history-panel__eyebrow">Timeline</span>
                    <h2>Visible in {formatYear(year)}</h2>
                  </div>
                  <span className="world-history-count-chip">{visibleTimelineEntities.length}</span>
                </div>

                {visibleTimelineEntities.length === 0 ? (
                  <div className="world-history-empty">
                    No pinned atlas entities are visible at this year yet.
                  </div>
                ) : (
                  <div className="world-history-shelf">
                    {visibleTimelineEntities.map((entity) => {
                      const isSelected = entity.id === selectedAtlasEntity?.id;
                      return (
                        <button
                          key={`visible-${entity.id}`}
                          type="button"
                          className={`world-history-shelf-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedAtlasEntityId(entity.id)}
                        >
                          <div className="world-history-shelf-card__head">
                            <div className="world-history-shelf-card__chips">
                              <span className="world-history-kind-chip">{kindLabels[entity.kind]}</span>
                              {hasBoundaryGeometry(entity) ? (
                                <span className="world-history-boundary-chip">Boundary</span>
                              ) : null}
                              {entity.referenceEntityId ? (
                                <span className="world-history-linked-chip">Linked</span>
                              ) : null}
                            </div>
                          </div>
                          <strong>{entity.title}</strong>
                          <span>{formatTimespan(entity)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorldHistoryPage;
