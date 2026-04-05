# Enzyklopaedie

Enzyklopaedie is a local-first personal encyclopedia for what you learn. The current rebuild is moving
away from isolated CRUD pages toward a unified knowledge model that can support taxonomy, chronology,
tasks, reviews, progress tracking, and exhibition pages.

The current canonical domain vocabulary is:

- `Items`
- `Subjects`
- `Topics`
- `Entities`

See [docs/domain-model.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/domain-model.md) for the working design.

## Stack

- `client/`: React + Vite
- `server/`: Express + SQLite
- `shared/`: shared TypeScript types and domain helpers

## Run The App

From the repo root:

```bash
npm start
```

That command now:

1. builds `shared/`
2. watches `shared/`
3. starts the client dev server
4. starts the server dev server

Open:

- app: `http://localhost:5173`
- API: `http://localhost:3001/api`

## Environment

Optional client env vars:

- `client/.env.local`
- Book search in the item workbench uses Open Library and the Library of Congress and does not require a user API key

`client/.env.local` is ignored by git.

World History currently uses:

- `maplibre-gl` in the client
- local canonical atlas routes from the server
- a locally cloned `historical-basemaps` dataset if present at `data/historical-basemaps`

If the basemap dataset is not present, the world-history page still loads but the local polygon basemap
layer will be unavailable.

To seed built-in `polity` entities and yearly snapshots from that dataset, run:

```bash
npm run import:historical-polities --prefix server
```

## Testing

Run the baseline verification suite from the repo root:

```bash
npm test
```

That currently does four things:

1. runs shared unit tests
2. builds the server
3. runs server API tests against a temporary SQLite database
4. builds the client

The current automated coverage is intentionally focused on the new foundation:

- shared domain helpers
- item create/update API flow
- atlas entity create/update/delete API flow
- formation membership and atlas relation flow
- world-history basemap and importer flow
- activity event recording for knowledge changes

For a focused server-only pass, run:

```bash
npm run test --prefix server
```

## Manual Smoke Test

After `npm start`, use this path:

1. Open `http://localhost:5173`
2. Check the home dashboard loads
3. Open `Items` and add an item
4. Open `Entities` and confirm the atlas loads with `person`, `polity`, and `formation`
5. Create a new formation, open it, update it, and delete it again
6. Open `Subjects` and confirm the tree loads with `Ontology` as the root
7. Open a subject page from the tree, create a child subject, and create a topic inside that subject
8. Open the new topic page, link it to an entity, and confirm it shows child topics and contained items
9. Open an item, attach or create a topic, then link it to an entity such as a person, polity, or formation
10. Open that entity page and confirm the linked topic and item appear in its context sections
11. Add an entity-to-entity structural link such as a formation containing a polity or a formation belonging to a broader formation
12. Add a note, a task, and a review on the item page
13. Return to `Home` and confirm recent activity entries appear
14. Open `World History` and confirm the map, basemap snapshot, and timeline render
15. If `data/historical-basemaps` is present, confirm local boundary snapshots and built-in polity resolution load too

## Working Notes

- Domain model: [docs/domain-model.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/domain-model.md)
- Foundation plan: [docs/foundation-plan.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/foundation-plan.md)
- World history polity plan: [docs/world-history-polity-plan.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/world-history-polity-plan.md)
- Local testing guide: [docs/local-testing.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/local-testing.md)
