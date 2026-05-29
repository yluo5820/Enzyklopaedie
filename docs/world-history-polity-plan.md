# World History Polity Plan

## Objective

The world-history surface should stop treating historical regions as incidental map overlays and start
treating them as first-class built-in historical entities.

The core idea is:

- `polity` is the canonical historical-geographical building block
- `formation` is a user-curated grouping of polities across time and space
- `person` remains a real person linked to one or more polities across time

This replaces the current atlas-facing use of:

- `nation`
- `place`
- `civilization`
- `era`

for the history map.

## Vocabulary

### Polity

`Polity` means the real historical-geographical unit represented by the basemap data.

Examples:

- Roman Empire
- Qing China
- Holy Roman Empire
- Ottoman Empire

Properties:

- built in, not custom-created by the user
- backed by local basemap data
- can have many dated geometry snapshots
- can still have normal entity-like detail: summary, description, notes, topic links, item links

### Formation

`Formation` means a user-curated spatiotemporal grouping of polities.

This intentionally absorbs the current practical roles of both `civilization` and `era`.

Examples:

- Hellenistic World
- Latin Christendom
- Early Modern Europe
- Global Cold War

Properties:

- user-created
- expressed as a collection of polities
- membership can be dated
- may carry a subtype in metadata, for example:
  - `civilization`
  - `era`
  - `tradition`
  - `world-era`

### Person

`Person` remains a real person, but history-facing assignment should now be polity-based rather than
separately nation-based and place-based.

Properties:

- user-created or canonical later
- linked to one or more polities
- membership can be dated
- topics and items can still point to the person

## Why This Model

The basemap data already gives us temporal-spatial units. Those should be the base layer of the atlas,
not anonymous polygons the user clicks around without semantic consequence.

This fixes several problems at once:

- the map has built-in objective units instead of requiring users to invent them
- `nation` and `place` stop competing awkwardly for atlas meaning
- `civilization` and `era` become compositional rather than separate rigid ontologies
- world-history pages can align directly with the actual map layer

## Data Model Direction

The cleanest repo-specific path is to keep `reference_entities` as the user-facing entity spine, but
change its atlas-facing kinds to:

- `person`
- `polity`
- `formation`

Then add supporting atlas tables beneath that.

## Proposed Storage Changes

### 1. Refactor `reference_entities.kind`

Current:

- `person`
- `nation`
- `civilization`
- `era`
- `place`

Planned:

- `person`
- `polity`
- `formation`

Migration intent:

- `nation` -> `polity`
- `place` -> deferred out of the atlas path, or later reintroduced separately as `site`
- `civilization` -> `formation`
- `era` -> `formation`

Notes:

- `place` should not disappear from all future modeling forever, but it should stop being the main atlas
  building block
- battle sites, cities, and other true places can return later as a dedicated `site` layer if needed

### 2. Add `polity_snapshots`

This is the key missing atlas table.

Recommended shape:

- `id`
- `referenceEntityId` -> `reference_entities.id` where `kind = polity`
- `snapshotYear`
- `source`
- `sourceFeatureId`
- `titleAtSnapshot`
- `parentLabel`
- `subjectLabel`
- `borderPrecision`
- `geometry` (GeoJSON)
- `createdAt`
- `updatedAt`

Why:

- one polity should not become one row per year in `reference_entities`
- instead, one polity identity owns many dated map footprints

### 3. Add `formation_memberships`

Recommended shape:

- `id`
- `formationEntityId` -> `reference_entities.id` where `kind = formation`
- `polityEntityId` -> `reference_entities.id` where `kind = polity`
- `startYear`
- `endYear`
- `note`
- `createdAt`

This lets a formation express:

- a civilization
- a regional era
- a world era that ranges across many polities

### 4. Add `person_polity_memberships`

Recommended shape:

- `id`
- `personEntityId` -> `reference_entities.id` where `kind = person`
- `polityEntityId` -> `reference_entities.id` where `kind = polity`
- `startYear`
- `endYear`
- `note`
- `createdAt`

This handles:

- one normal polity affiliation
- alternating or overlapping polity affiliation
- later biographical nuance without inventing fake nation/era fields

### 5. Optional later tables

Not required for the first refactor:

- `polity_aliases`
- `polity_import_overrides`
- `site_snapshots`

These only become necessary once identity reconciliation becomes messy enough to need manual correction.

## Import Strategy

The polity set should be built before normal runtime, not synthesized ad hoc when the page loads.

### Import source

- local clone of `data/historical-basemaps`

### Import rule

Only import named regions that are plausible polity-like units.

Do not import anonymous/generated labels such as:

- `Region 1`
- `Region 27`

Those should be filtered out both:

- in preprocessing
- in runtime basemap browsing

### First importer pass

Create a preprocessing script, for example:

- `server/scripts/importHistoricalPolities.ts`

Responsibilities:

1. Read `index.json`
2. Walk all available yearly GeoJSON files from the chosen cutoff onward
3. Ignore generated labels
4. Normalize labels into provisional polity identities
5. Create or update a `reference_entities(kind = polity)` row for each polity
6. Insert dated rows into `polity_snapshots`
7. Record source metadata like `parent`, `subject`, `borderPrecision`, and `sourceFeatureId`

### Grouping rule

Use a conservative grouping key first:

- normalized visible label

with optional secondary fields for disambiguation:

- parent label
- subject label

Do not attempt aggressive merge heuristics in V1.

It is better to have a few duplicate polities that can later be reconciled than to collapse distinct
historical units into one bad identity.

## Canonical Enrichment

Polity descriptions and broader metadata should be prepared ahead of time rather than fetched only in the
browser.

### Second importer pass

Create a second script, for example:

- `server/scripts/enrichHistoricalPolitiesFromWikidata.ts`

Responsibilities:

1. Take imported polity rows
2. Search Wikidata by title
3. Store candidate authority ids and summaries
4. Save image, date span, and source url when available
5. Mark ambiguous matches for later manual review

The enrichment step should be idempotent and rerunnable.

## UI Migration Plan

### Step 1

Keep the current world-history page, but change the basemap side so:

- anonymous `Region N` entries do not appear
- selected basemap regions reconcile to imported `polity` records, not only name matches against atlas
  entities

### Step 2

Refactor `/entities` from five kinds into three:

- `person`
- `polity`
- `formation`

### Step 3

Refactor the entity detail page:

- `person`
  - polity memberships
  - authored works
  - topics about the person
- `polity`
  - dated snapshots
  - formations containing the polity
  - topics and items about the polity
- `formation`
  - membership list of polities
  - optional subtype
  - topics and items about the formation

### Step 4

Remove manual creation of atlas-facing `polity`.

Users should:

- search/select built-in polities
- not create free-form new polities

### Step 5

Keep manual creation for:

- `person`
- `formation`

## Runtime World-History Behavior

Once this refactor is in place, the world-history page should behave like this:

1. Basemap loads a dated snapshot
2. Clicking a named region resolves to a built-in `polity`
3. The side panel opens the polity record
4. Users can then:
   - link topics/items to that polity
   - place a person into that polity
   - include that polity inside one or more formations

This makes the map the canonical entrance into atlas entities instead of a separate visual toy.

## Current Status

Completed:

1. The vocabulary is frozen around `person / polity / formation`.
2. `polity_snapshots` and `formation_memberships` are in the active schema.
3. Anonymous basemap regions are filtered out of the world-history UI.
4. The historical-basemaps importer seeds built-in `polity` records and snapshots.
5. The atlas UI now centers on the three active kinds.
6. The old `nation / civilization / era / place` local atlas kinds have been removed from the active UI and model.
7. `person_polity_memberships` place people inside built-in polities with optional year bounds.
8. Person memberships project back onto the world-history map and polity/entity pages.
9. Subject memberships let the atlas filter visible people by study context.
10. Item creators canonicalize into `created_by` relations to person entities, with free-text creator values retained as an import/display fallback.

Still open:

1. make duplicate imported polity identities easier to reconcile when conservative label grouping splits a historical unit
2. decide whether a later dedicated `site` layer is needed for cities, battle sites, and other true places
3. add exhibition and publishing layers after the atlas workflows settle

## Next Implementation Slice

The next meaningful implementation step after this branch is:

1. review real imported basemap data for duplicated or overly broad polity identities
2. add a lightweight reconciliation workflow only if the data shows enough duplication to justify it
3. start the exhibition/publishing layer once the canonical atlas model is stable in day-to-day use

That keeps the branch focused on the canonical atlas V1 instead of stretching it into later publishing work.
