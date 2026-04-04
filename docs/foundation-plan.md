# Enzyklopaedie Foundation Plan

## Product Direction

Enzyklopaedie is a local-first personal encyclopedia for learned material. The system should eventually
organize and present four layers together:

1. `Items`: the concrete works a person studied.
2. `Subjects`: the synchronic logical taxonomy of knowledge, rooted at `Ontology`.
3. `Topics`: contextualized domains of study that sit between subjects and items.
4. `Entities`: people, nations, eras, civilizations, and places that give topics and items their
   historical or spatial setting.

The detailed version of this model lives in [domain-model.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/domain-model.md).

## Build Order

### Phase 1

1. Introduce unified `items`.
2. Introduce unified `entities`.
3. Build activity, notes, tasks, and reviews.

### Phase 2

1. Reinterpret the current `topics` layer as `subjects`.
2. Relabel the current UI to match that vocabulary.
3. Preserve the `Ontology` root as the start of the subject hierarchy.

### Phase 3

1. Introduce a real `topics` layer beneath subjects.
2. Move item classification from direct subject attachment to topic attachment.
3. Let topics carry the main time/place/entity context.

Status:
- implemented in the current foundation slice

### Phase 4

1. Add stronger containment views on entity pages.
2. Rebuild the world-history surface on real temporal-spatial data.
3. Add exhibition and publishing layers.

### Phase 5

1. Refactor atlas-facing entities from `nation / civilization / era / place` toward:
   - `person`
   - `polity`
   - `formation`
2. Treat imported historical basemap regions as built-in `polity` seeds.
3. Add dated `polity_snapshots` and membership tables for:
   - `formation -> polity`
   - `person -> polity`
4. Move the world-history map from loose overlays to first-class polity records.

Detailed atlas refactor notes live in [world-history-polity-plan.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/world-history-polity-plan.md).

## Architectural Notes

- Keep storage local with SQLite.
- Keep the client/server/shared TypeScript split.
- Prefer additive migration over destructive rewrites.
- Change user-facing naming before changing storage when the design is still being tested.
