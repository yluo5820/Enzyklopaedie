import type { ReferenceEntity } from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import {
  DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR,
  getHistoricalBasemapFeatureLabel,
  getHistoricalBasemapLayer,
  getHistoricalBasemapManifest,
  isHistoricalBasemapFeatureNamed,
} from './historicalBasemaps';
import {
  generateUniqueReferenceEntitySlug,
  hydrateReferenceEntity,
  parseReferenceEntityMetadata,
} from './referenceEntities';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

type ImportedFeature = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: Record<string, unknown> | null;
};

type SnapshotAccumulator = {
  label: string;
  features: ImportedFeature[];
  parentLabels: Set<string>;
  subjectLabels: Set<string>;
  borderPrecisions: number[];
  sourceFeatureIds: string[];
};

type ImportHistoricalPolitiesResult = {
  cutoffYear: number;
  datasetPresent: boolean;
  importedPolityCount: number;
  createdPolityCount: number;
  updatedPolityCount: number;
  importedSnapshotCount: number;
  skippedAnonymousFeatureCount: number;
};

const BUILT_IN_POLITY_SUMMARY = 'Built-in polity imported from historical-basemaps.';

const normalizePolityKey = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getFirstString = (values: Set<string>) => {
  for (const value of values) {
    if (value.trim()) {
      return value;
    }
  }

  return null;
};

const getMaxBorderPrecision = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
};

const isBuiltInHistoricalPolity = (entity: ReferenceEntity) =>
  entity.kind === 'polity' && entity.metadata?.atlasSource === 'historical-basemaps';

const ensurePolityEntity = async (
  db: DbConnection,
  entityByKey: Map<string, ReferenceEntity>,
  key: string,
  title: string,
  snapshotYear: number
) => {
  const existing = entityByKey.get(key);
  if (existing) {
    return { entity: existing, created: false };
  }

  const now = new Date().toISOString();
  const slug = await generateUniqueReferenceEntitySlug(db, 'polity', title);
  const metadata = {
    atlasSource: 'historical-basemaps',
    builtIn: true,
    polityImportKey: key,
  };

  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'polity',
    title,
    slug,
    BUILT_IN_POLITY_SUMMARY,
    null,
    snapshotYear,
    snapshotYear,
    JSON.stringify(metadata),
    now,
    now
  );

  const entity: ReferenceEntity = {
    id: result.lastID as number,
    kind: 'polity',
    title,
    slug,
    summary: BUILT_IN_POLITY_SUMMARY,
    startYear: snapshotYear,
    endYear: snapshotYear,
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  entityByKey.set(key, entity);
  return { entity, created: true };
};

export const importHistoricalPolities = async (
  db: DbConnection,
  cutoffYear = DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR
): Promise<ImportHistoricalPolitiesResult> => {
  const manifest = await getHistoricalBasemapManifest(cutoffYear);

  if (!manifest.datasetPresent || manifest.availableYears.length === 0) {
    return {
      cutoffYear,
      datasetPresent: false,
      importedPolityCount: 0,
      createdPolityCount: 0,
      updatedPolityCount: 0,
      importedSnapshotCount: 0,
      skippedAnonymousFeatureCount: 0,
    };
  }

  const existingRows = await db.all<ReferenceEntityRow[]>(
    `SELECT * FROM reference_entities WHERE kind = 'polity' ORDER BY lower(title) ASC, createdAt ASC`
  );
  const entityByKey = new Map(
    existingRows
      .map(hydrateReferenceEntity)
      .map((entity) => [normalizePolityKey(entity.title), entity] as const)
  );

  const touchedPolityIds = new Map<number, { minYear: number; maxYear: number; title: string }>();
  const createdPolityIds = new Set<number>();
  const updatedPolityIds = new Set<number>();
  const snapshotCountsByPolityId = new Map<number, number>();
  let importedSnapshotCount = 0;
  let skippedAnonymousFeatureCount = 0;

  await db.exec('BEGIN');

  try {
    await db.run(`DELETE FROM polity_snapshots WHERE source = 'historical-basemaps'`);

    for (const yearEntry of manifest.availableYears) {
      const layer = await getHistoricalBasemapLayer(yearEntry.year, cutoffYear);
      const features = Array.isArray((layer?.geojson as { features?: unknown })?.features)
        ? (((layer?.geojson as { features: ImportedFeature[] }).features) ?? [])
        : [];

      const groupedByPolity = new Map<string, SnapshotAccumulator>();

      for (const feature of features) {
        if (!isHistoricalBasemapFeatureNamed(feature)) {
          skippedAnonymousFeatureCount += 1;
          continue;
        }

        const label = getHistoricalBasemapFeatureLabel(feature);
        if (!label) {
          skippedAnonymousFeatureCount += 1;
          continue;
        }

        const key = normalizePolityKey(label);
        if (!key) {
          skippedAnonymousFeatureCount += 1;
          continue;
        }

        const properties = feature.properties ?? {};
        const accumulator =
          groupedByPolity.get(key) ??
          {
            label,
            features: [],
            parentLabels: new Set<string>(),
            subjectLabels: new Set<string>(),
            borderPrecisions: [],
            sourceFeatureIds: [],
          };

        accumulator.features.push(feature);

        if (typeof properties.atlasParent === 'string' && properties.atlasParent.trim()) {
          accumulator.parentLabels.add(properties.atlasParent.trim());
        }
        if (typeof properties.atlasSubject === 'string' && properties.atlasSubject.trim()) {
          accumulator.subjectLabels.add(properties.atlasSubject.trim());
        }
        if (typeof properties.atlasBorderPrecision === 'number') {
          accumulator.borderPrecisions.push(properties.atlasBorderPrecision);
        }
        if (typeof properties.atlasFeatureId === 'string' && properties.atlasFeatureId.trim()) {
          accumulator.sourceFeatureIds.push(properties.atlasFeatureId.trim());
        }

        groupedByPolity.set(key, accumulator);
      }

      for (const [key, group] of groupedByPolity.entries()) {
        const ensured = await ensurePolityEntity(db, entityByKey, key, group.label, yearEntry.year);
        if (ensured.created) {
          createdPolityIds.add(ensured.entity.id);
        } else {
          updatedPolityIds.add(ensured.entity.id);
        }

        importedSnapshotCount += 1;
        snapshotCountsByPolityId.set(
          ensured.entity.id,
          (snapshotCountsByPolityId.get(ensured.entity.id) ?? 0) + 1
        );

        const currentRange = touchedPolityIds.get(ensured.entity.id);
        if (!currentRange) {
          touchedPolityIds.set(ensured.entity.id, {
            minYear: yearEntry.year,
            maxYear: yearEntry.year,
            title: ensured.entity.title,
          });
        } else {
          currentRange.minYear = Math.min(currentRange.minYear, yearEntry.year);
          currentRange.maxYear = Math.max(currentRange.maxYear, yearEntry.year);
        }

        const now = new Date().toISOString();
        const parentLabel = getFirstString(group.parentLabels);
        const subjectLabel = getFirstString(group.subjectLabels);
        const borderPrecision = getMaxBorderPrecision(group.borderPrecisions);
        const geometry = {
          type: 'FeatureCollection',
          features: group.features,
        };
        const metadata = {
          atlasSource: 'historical-basemaps',
          builtIn: true,
          featureCount: group.features.length,
          sourceFeatureIds: group.sourceFeatureIds,
          importKey: key,
          availableParentLabels: [...group.parentLabels],
          availableSubjectLabels: [...group.subjectLabels],
        };

        await db.run(
          `INSERT INTO polity_snapshots
            (referenceEntityId, snapshotYear, source, titleAtSnapshot, parentLabel, subjectLabel,
             borderPrecision, geometry, metadata, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(referenceEntityId, snapshotYear, source) DO UPDATE SET
             titleAtSnapshot = excluded.titleAtSnapshot,
             parentLabel = excluded.parentLabel,
             subjectLabel = excluded.subjectLabel,
             borderPrecision = excluded.borderPrecision,
             geometry = excluded.geometry,
             metadata = excluded.metadata,
             updatedAt = excluded.updatedAt`,
          ensured.entity.id,
          yearEntry.year,
          'historical-basemaps',
          group.label,
          parentLabel,
          subjectLabel,
          borderPrecision,
          JSON.stringify(geometry),
          JSON.stringify(metadata),
          now,
          now
        );
      }
    }

    for (const [entityId, range] of touchedPolityIds.entries()) {
      const existing = entityByKey.get(normalizePolityKey(range.title));
      const currentMetadata = existing ? { ...(existing.metadata ?? {}) } : {};
        const metadata = {
          ...currentMetadata,
          atlasSource: 'historical-basemaps',
          builtIn: true,
          importedSnapshotCount: snapshotCountsByPolityId.get(entityId) ?? 0,
        };

      await db.run(
        `UPDATE reference_entities
         SET startYear = ?,
             endYear = ?,
             summary = COALESCE(summary, ?),
             metadata = ?,
             updatedAt = ?
         WHERE id = ?`,
        range.minYear,
        range.maxYear,
        BUILT_IN_POLITY_SUMMARY,
        JSON.stringify(metadata),
        new Date().toISOString(),
        entityId
      );
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  return {
    cutoffYear,
    datasetPresent: true,
    importedPolityCount: touchedPolityIds.size,
    createdPolityCount: createdPolityIds.size,
    updatedPolityCount: [...updatedPolityIds].filter((id) => !createdPolityIds.has(id)).length,
    importedSnapshotCount,
    skippedAnonymousFeatureCount,
  };
};
