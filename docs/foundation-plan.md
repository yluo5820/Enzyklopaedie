# Enzyklopaedie Foundation Plan

## Product Direction

Enzyklopaedie is not just a tracker for books and lectures. The long-term product is a local-first
personal encyclopedia with four major surfaces:

1. A unified knowledge archive for things a person has consumed or studied.
2. A taxonomy and relation system for organizing the archive into a world of subjects.
3. A chronology and map layer for historical and spatial exploration.
4. Progress and exhibition surfaces that show how the encyclopedia develops over time.

## Core Domain Primitives

- `knowledge_items`: the main record for books, lectures, articles, videos, courses, and similar objects.
- `topics`: hierarchical subjects and categories.
- `knowledge_relations`: links between items, topics, places, periods, and future entities.
- `knowledge_tasks`: follow-up work such as read, revisit, summarize, compare, or extract notes.
- `knowledge_reviews`: reflections and judgments after engaging with an item.
- `activity_events`: a log of changes that can power progress dashboards and exhibition pages.
- `places` and `timeline_events`: the first pieces needed for the future world-history interface.

## Phase 1

The first implementation phase should stay narrow:

1. Introduce the new domain model alongside the legacy CRUD model.
2. Create and list knowledge items from one shared workbench page.
3. Record activity events when the archive changes.
4. Use the home page as a dashboard for the new foundation.

## Phase 2

1. Add detail pages for knowledge items.
2. Attach tasks, notes, and reviews.
3. Build topic trees and relation views.
4. Start migrating legacy book and lecture flows into the new model.

## Phase 3

1. Add places and time-aware relations.
2. Rebuild the world-history page on real temporal-spatial data.
3. Add exhibition pages and export/publish flows.

## Architectural Notes

- Keep storage local with SQLite.
- Keep the client/server/shared TypeScript split for now.
- Build feature APIs around product concepts rather than raw tables where possible.
- Prefer additive migration during the rebuild so the prototype remains usable while new flows appear.
