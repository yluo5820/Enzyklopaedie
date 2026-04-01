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

## Focused Knowledge API Tests

If you only want to verify the new foundation layer:

```bash
npm run test --prefix server
```

That test currently covers:

- creating a knowledge item
- fetching it back with parsed metadata
- updating it
- verifying the activity feed records both create and update events

## Suggested Manual Pass

### 1. Home Dashboard

- Open `/`
- Confirm the dashboard loads without errors
- If there are no knowledge items yet, the activity section should show an empty state

### 2. Knowledge Workbench

- Open `/knowledge`
- Add one item with:
  - kind: `book`
  - title: `Test Entry`
  - creator: `Codex`
  - status: `active`
- Confirm it appears in the list immediately
- Confirm the counts update
- Remove it again and confirm it disappears

### 3. Activity Feed

- After creating a knowledge item, go back to `/`
- Confirm the recent activity feed shows an entry for the item creation

### 4. Knowledge Item Detail

- From `/knowledge`, open a knowledge item
- Attach an existing topic or create a new child topic and confirm it appears in the topic list
- Create a relation to another knowledge item and confirm it appears in the relation list
- Add one note and confirm it appears immediately
- Add one task, move it to `done`, and confirm the status updates
- Add one review and confirm it appears at the top of the review list
- Return to `/` and confirm those actions appear in the recent activity feed

### 5. Legacy Library Flow

- Open `/books`
- Click `Add Item`
- Choose `Book`
- Choose `Custom` and verify the original form still works
- Reopen and choose `Search`
- Search for a title and confirm results appear
- Select one or more results and confirm they are added to the library

### 6. World History Prototype

- Open `/world-history`
- Confirm the map loads if `VITE_MAPTILER_API_KEY` exists in `client/.env.local`
- Drag the timeline and confirm the highlighted period changes

## Notes

- The world history page is still a prototype. It has a working map renderer and timeline interaction,
  but not yet real historical spatial data.
- The knowledge workbench is the first slice of the rebuild and should be treated as the new product
  direction, while the older CRUD pages remain as legacy surfaces for now.
