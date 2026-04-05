# Enzyklopaedie Foundation Plan

## Product Direction

Enzyklopaedie is a local-first personal encyclopedia for learned material. The system should eventually
organize and present four layers together:

1. `Items`: the concrete works a person studied.
2. `Subjects`: the synchronic logical taxonomy of knowledge, rooted at `Ontology`.
3. `Topics`: contextualized domains of study that sit between subjects and items.
4. `Entities`: people, polities, and formations that give topics and items their historical or
   spatial setting.

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
3. Move atlas-facing entities to:
   - `person`
   - `polity`
   - `formation`
4. Treat imported historical basemap regions as built-in `polity` seeds.
5. Add dated `polity_snapshots` and `formation_memberships`.

Status:
- implemented in the current atlas branch

### Phase 5

1. Add person-to-polity membership.
2. Make the world-history map open directly into built-in polity records and formation composition.
3. Add exhibition and publishing layers.

Detailed atlas refactor notes live in [world-history-polity-plan.md](/Users/yluo/Downloads/Projects/Enzyklopaedie/docs/world-history-polity-plan.md).

## Architectural Notes

- Keep storage local with SQLite.
- Keep the client/server/shared TypeScript split.
- Prefer real model cleanup once the structure is validated, rather than keeping long-lived compatibility scaffolding.
