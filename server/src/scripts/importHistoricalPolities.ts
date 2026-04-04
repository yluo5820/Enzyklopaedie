import { closeDb, getDb, initializeDatabase } from '../db';
import {
  DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR,
} from '../lib/historicalBasemaps';
import { importHistoricalPolities } from '../lib/importHistoricalPolities';

const run = async () => {
  await initializeDatabase();
  const db = await getDb();

  try {
    const result = await importHistoricalPolities(db, DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR);

    if (!result.datasetPresent) {
      console.error(
        'Historical basemaps were not found. Clone the dataset into data/historical-basemaps or set HISTORICAL_BASEMAPS_PATH.'
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      [
        `Imported ${result.importedPolityCount} polities`,
        `created ${result.createdPolityCount}`,
        `updated ${result.updatedPolityCount}`,
        `snapshots ${result.importedSnapshotCount}`,
        `skipped anonymous features ${result.skippedAnonymousFeatureCount}`,
      ].join(' | ')
    );
  } finally {
    await closeDb();
  }
};

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
