# Local Testing Guide

## Start The Full App

From the repo root:

```bash
npm start
```

Expected services:

- Vite client on `http://localhost:5173`
- Express API on `http://localhost:3001`
- shared package watcher rebuilding `shared/dist`

## Automated Checks

From the repo root:

```bash
npm test
```

This runs:

1. `shared` unit tests
2. `server` TypeScript build
3. `server` API tests against a temporary SQLite database
4. `client` TypeScript + Vite production build

If this passes, the repo is in a reasonable baseline state.

## Focused Server API Tests

If you only want to verify the new foundation layer:

```bash
npm run test --prefix server
```

That test currently covers:

- creating an item
- resolving explicit and fallback item creators through canonical `created_by` person relations
- fetching it back with parsed metadata
- updating it
- verifying the activity feed records both create and update events
- creating, updating, filtering, and deleting atlas entities
- Wikidata authority search/import for people
- map-backed polity import and read-only route guards
- formation memberships and atlas relation flows
- person polity and subject membership flows
- world-history search, basemap, and polity import routes

## Suggested Manual Pass

### 1. Home Dashboard

- Open `/`
- Confirm the dashboard loads without errors
- If there are no items yet, the activity section should show an empty state

### 2. Item Workbench

- Open `/knowledge`
- Add one item with:
  - kind: `book`
  - title: `Test Entry`
  - creator: `Codex`
  - status: `active`
- Confirm it appears in the list immediately
- Open the item and confirm the creator appears as canonical provenance when a person record is selected or resolved
- Confirm the counts update
- Remove it again and confirm it disappears

### 3. Activity Feed

- After creating an item, go back to `/`
- Confirm the recent activity feed shows an entry for the item creation

### 4. Item Detail

- From `/knowledge`, open an item
- Attach an existing topic or create a new topic under a chosen subject
- Confirm the assigned topic chips link through to `/topics/:id`
- Add one relation to a reference entity such as a person, polity, or formation and confirm it appears as a linked card
- Add one note and confirm it appears immediately
- Add one task, move it to `done`, and confirm the status updates
- Add one review and confirm it appears at the top of the review list
- Return to `/` and confirm those actions appear in the recent activity feed

### 5. Subject Tree

- Open `/topics`
- Confirm `Ontology` appears as the root node in the tree
- Click a subject node and confirm its subject page opens
- Create a child subject from the subject page and confirm it appears in the child subject list
- Create a topic inside that subject and confirm it appears in the contained-topic list

### 6. Topic Pages

- Open a topic from a subject page
- Confirm the topic page shows its subject lineage
- Confirm child topics can be created from that page
- Link the topic to a reference entity and confirm it appears in the topic’s reference context section
- Confirm items assigned to the topic appear in the contained item list

### 7. People

- Open `/entities`
- Confirm the page is focused on people
- Search Wikidata for a person, import one result, and confirm the created entity opens with dates, summary, image/source metadata, and description populated when available
- Confirm states/empires are not available as custom creations from this page
- Create a `person`, add one subject membership, then place that person inside a polity
- Confirm linked items and linked topics/subjects appear on the entity page when relations exist
- Add an entity-to-entity link such as `part_of` or `related_to` and confirm it appears on both pages

### 8. World History

- Open `/world-history`
- Confirm the map loads without an external tile key
- Drag the timeline and confirm the basemap snapshot changes
- Search a canonical record and pin it
- Click a named basemap region and confirm the snapshot panel updates
- Confirm the selected region resolves to a read-only map-backed polity when imported snapshots are present
- Confirm people placed in the selected polity appear in the current or historical people sections
- Use the subject filter and confirm unrelated placed people are hidden from the people overlay
- If `data/historical-basemaps` is present, confirm built-in polity resolution works for selected regions

## Notes

- The world-history page now uses `maplibre-gl`, local basemap assets, and server atlas routes.
- The atlas model is still `person / polity / formation`, with polities seeded from map data rather than created freeform.
- The `/topics` surface is the `subject` layer.
- The `/topics/:id` surface is the actual topic layer where items live.
