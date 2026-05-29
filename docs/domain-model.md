# Enzyklopaedie Domain Model

## Canonical Vocabulary

The app currently uses four core layers:

1. `Subject`
2. `Topic`
3. `Entity`
4. `Item`

This is the active model, not a migration target.

## Layer Responsibilities

### Subject

`Subject` is the synchronic taxonomy of knowledge.

- Subjects form a parent/child tree.
- The root of the tree is `Ontology`.
- Subjects do not carry time or geography themselves.
- Subjects contain topics.

Examples:

- Ontology
- Philosophy
- Metaphysics
- Logic

### Topic

`Topic` is a contextualized study domain under a subject.

- A topic belongs to one primary subject.
- A topic may have parent and child topics.
- A topic contains items.
- A topic may link to entities that provide historical or geographic framing.

Examples:

- Ancient Greek Metaphysics
- French Philosophy
- Roman Political Thought

Subjects are the logical tree. Topics are the usable study surfaces inside that tree.

### Entity

`Entity` is the atlas-facing world layer.

Active entity kinds:

- `person`
- `polity`
- `formation`

What they mean:

- `person`: an individual figure
- `polity`: a read-only historical-geographical unit backed by map data
- `formation`: a user-curated grouping of polities across time and space

Entities are not part of the subject hierarchy. They are linked into topics and items.

### Item

`Item` is the concrete unit the user studied.

- The app currently supports two forms: `book` and `lecture`
- Items belong to topics
- Items can link to entities for provenance and context

## Core Semantic Rules

### Item Aboutness

Items do not attach directly to subjects.

The active model is:

- an item belongs to one or more topics
- a topic belongs to a subject
- a topic may link to entities

This keeps:

- logical organization in the subject tree
- contextual framing in topics and entities

### Provenance Versus Subject Matter

These stay separate.

- `provenance`: who created the item
- `subject matter`: what the item is about

Formal provenance should be expressed through relations such as `created_by`.
Free-text creator fields are only an import fallback.

## Entity Semantics

### Person

- can be the `created_by` target for items
- can be linked from topics as a figure of study or influence
- can belong to polities or formations
- can carry person-to-person influence links

### Polity

- is a built-in atlas unit, not a freeform user-created geography
- can have many dated map snapshots
- can belong to formations
- can contain sub-polities through explicit structure links

### Formation

- is user-curated
- groups polities through explicit memberships
- can model civilizational spans, regional periods, or broader historical continuities
- can relate to other formations through `part_of`, `related_to`, or `influenced_by`

## Containment Model

Dedicated pages expose each layer’s contained objects.

- Subject page: contained topics
- Topic page: contained items and linked entities
- Entity page:
  - person: authored works, topic coverage, affiliations
  - polity: snapshots, memberships, topic/item coverage
  - formation: polity memberships, topic/item coverage, broader formation links
- Item page: assigned topics plus entity/context links

Reverse links should be queried, not stored as literal nested structures.

## Current Implementation Mapping

Current storage and routes:

- `topics` table and `/subjects` UI are the subject layer
- `study_topics` table and `/topics/:id` UI are the topic layer
- `knowledge_items` are the item layer
- `reference_entities` hold editable people, formations, and compatibility mirrors for built-in polities
- `world_history_polities` hold read-only map-backed polity identities
- `world_history_polity_snapshots` hold year-specific map geometry for those identities
- `polity_snapshots` currently mirror year-specific atlas geometry for compatibility
- `formation_memberships` hold formation-to-polity membership

## World History Overlay

The world-history surface has two separate layers:

- local map-backed polities from `historical-basemaps`
- canonical authority records from Wikidata for people, future enrichment, and non-polity atlas concepts

Canonical records can still come in external kinds such as:

- `nation`
- `civilization`
- `era`
- `place`
- `region`

Those are external authority categories. Locally, map-backed polities are the source of truth:

- `nation` and many `place`/`region` records can only link to an existing map-backed `polity`
- `civilization` and `era` can still reconcile into `formation` while that modeling remains under review

## Naming Notes

Preferred user-facing terms:

- `Items`
- `Subjects`
- `Topics`
- `Entities`

Preferred atlas-facing terms:

- `People`
- `Map-backed states and empires`
- `Formations`
