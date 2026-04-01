# Enzyklopaedie

Enzyklopaedie is a local-first personal encyclopedia for what you learn. The current rebuild is moving
away from isolated CRUD pages toward a unified knowledge model that can support taxonomy, chronology,
tasks, reviews, progress tracking, and exhibition pages.

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
- `VITE_MAPTILER_API_KEY=...` for the world history page
- `VITE_GOOGLE_BOOKS_API_KEY=...` for Google Books search in the add-book flow

`client/.env.local` is ignored by git.

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
- knowledge item create/update API flow
- unified reference entity create/update/delete API flow
- activity event recording for knowledge changes

For a focused server-only pass, run:

```bash
npm run test --prefix server
```

## Manual Smoke Test

After `npm start`, use this path:

1. Open `http://localhost:5173`
2. Check the home dashboard loads
3. Open `Knowledge` and add a knowledge item
4. Open `Entities` and confirm the reference atlas loads with imported legacy entities like `Unknown Author`
5. Create a new entity, open it, update it, and delete it again
6. Open `Topics` and confirm the tree loads with `Ontology` as the root
7. Open a topic page from the tree and create a child topic
8. Open a knowledge item and attach or create a topic, then add a note, a task, and a review
9. Return to `Home` and confirm recent activity entries appear
10. Open `World History` and confirm the map and timeline render if a MapTiler key is present

## Working Notes

- Foundation plan: [docs/foundation-plan.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/foundation-plan.md)
- Local testing guide: [docs/local-testing.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/local-testing.md)
