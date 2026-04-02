# Enzyklopaedie Domain Model

## Canonical Vocabulary

The project should use four main layers:

1. `Subject`
2. `Topic`
3. `Entity`
4. `Item`

This replaces the looser earlier language around `topics`, `knowledge items`, and generic relations.

## Layer Responsibilities

### Subject

`Subject` is the pure synchronic taxonomy of knowledge.

- A subject has a parent subject and child subjects.
- The root of the entire hierarchy is `Ontology`.
- A subject does not carry space or time as part of its definition.
- A subject contains topics, not items directly in the long-term model.

Examples:

- Ontology
- Philosophy
- Metaphysics
- Logic

### Topic

`Topic` is a contextualized field of understanding under a subject.

- A topic belongs to one primary subject.
- A topic may have parent and child topics.
- A topic may be restricted by entities such as an era, nation, civilization, person, or place.
- A topic contains items.

Examples:

- Ancient Greek Metaphysics
- French Philosophy
- Roman Political Thought in Late Antiquity

In other words, subjects are logical taxonomy, while topics are practical, situated domains of study.

### Entity

`Entity` is a worldly being, polity, period, or location.

Current kinds:

- `person`
- `nation`
- `civilization`
- `era`
- `place`

Entities can have their own pages, descriptions, and same-layer relations, but they are not part of the
subject hierarchy.

Useful same-layer entity relations include:

- `contains`
- `part_of`
- `during`
- `located_in`
- `related_to`
- `influenced_by`

### Item

`Item` is the ultimate individual substance of the system.

- Operationally, the system now has two item forms: `book` and `lecture`.
- Older distinctions such as article, essay, video, podcast, or course should normalize into one of those two forms.
- Items are the concrete units the user actually read, watched, heard, or studied.
- The system mainly sorts, organizes, and displays items.

## Core Semantic Rules

### Item Aboutness

An item should not have to choose between being "about a subject" and "about an entity".

The clean model is:

- an item belongs to one or more topics
- a topic belongs to a subject
- a topic may be linked to entities

This allows an item to be:

- logically organized through the subject tree
- historically or spatially contextualized through topic-linked entities

### Provenance Versus Subject Matter

These must stay separate.

- `provenance`: who created the item, and in what era, nation, civilization, or place they belong
- `subject matter`: what the item is about

Example:

- a modern American scholar can write an item about Late Antiquity
- the author's era and nation describe the item's provenance
- Late Antiquity describes the item's subject matter

In the implementation, formal provenance should be expressed through relations such as `created_by`.
Free-text creator fields are only a legacy/import fallback.

The app should not automatically collapse those into one field.

## Entity Semantics

### Person

- contains authored items
- may have topics about the person
- may later have influence relations to other people

### Nation

- contains authors associated with the nation
- may have topics about the nation
- may later have influence or inheritance relations to other nations

### Era

- contains authors associated with the era
- may have topics about the era
- may later have before/after relations

### Civilization

Civilization should be treated as a higher-order spatiotemporal continuum.

- may contain nations
- may contain eras
- may contain subcivilizations
- may have topics about the civilization

Civilization should not become the most primitive historical concept in the data model. It is more
interpretive than a nation or an era, so explicit membership should be preferred over hard inference.

## Containment Model

Only dedicated pages should expose a layer's contained objects directly.

- Subject page: child subjects and contained topics
- Topic page: child topics and contained items
- Entity page: contained authors, nations, eras, subcivilizations, topics, or authored items depending on kind
- Item page: creator and topic backlinks

Reverse links should be queried, not stored as literal nested structures.

## Current Implementation Mapping

The current application now matches the core four-layer model more closely:

- `topics` table and `/topics` UI are the `subject` layer
- `study_topics` table and `/study-topics/:id` UI are the real `topic` layer
- `knowledge_items` are the `item` layer
- `reference_entities` are the `entity` layer

Current limitations:

- entity pages do not yet expose the full containment model back out to topics and items
- topic-to-entity contextualization now exists for actual topics, but the entity containment model is still relation-based rather than fully typed

Current strengths:

- person pages can now show authored works through `created_by` item links
- entity pages can now show topics and subjects that point to them
- entity pages can now carry explicit structural links to other entities, including `contains`

## Migration Direction

1. Keep current `topics` data, but reinterpret it as `subjects`.
2. Relabel the current UI from `Topic` to `Subject`.
3. Introduce a new real `topics` layer between subjects and items.
4. Move item assignment from direct subject links to topic links.
5. Let topics carry the main historical and spatial contextualization through linked entities.
6. Rework entity pages to expose contained items and topics based on the new structure.

Status:
- steps 1 through 4 are implemented
- steps 5 and 6 remain open

## Naming Notes

Preferred user-facing terms:

- `Items`
- `Subjects`
- `Entities`
- `Topics`

Preferred implementation strategy for now:

- keep existing filenames and database tables stable until the topic layer is introduced
- change user-facing wording first
- do deeper schema cleanup only after the design feels right in practice
