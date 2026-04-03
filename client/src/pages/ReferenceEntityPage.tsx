import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  ReferenceEntityKind,
  UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createReferenceEntityRelation,
  deleteReferenceEntity,
  deleteReferenceEntityRelation,
  fetchReferenceEntities,
  fetchReferenceEntity,
  fetchReferenceEntityOutgoingRelations,
  fetchReferenceEntityRelations,
  updateReferenceEntity,
} from '../api';
import './ReferenceEntityPage.css';

const kindOptions: ReferenceEntityKind[] = ['person', 'nation', 'civilization', 'era', 'place'];
const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  nation: 'Nation',
  civilization: 'Civilization',
  era: 'Era',
  place: 'Place',
};

type EntityStructurePreset = {
  helperText: string;
  modes: Array<{
    id: string;
    label: string;
    description: string;
    allowedRelationTypes: KnowledgeRelationType[];
    defaultRelationType: KnowledgeRelationType;
    notePlaceholder: string;
    targetPrompt: string;
    targetKinds: ReferenceEntityKind[];
  }>;
};

type RelationDirection = 'incoming' | 'outgoing';

type StructureEntry = {
  key: string;
  relationId: number;
  title: string;
  href: string | null;
  kindLabel?: string;
  relationLabel: string;
  note?: string;
  createdAtLabel: string;
  canDelete: boolean;
};

type StructureGroup = {
  key: string;
  title: string;
  hint: string;
  empty: string;
  entries: StructureEntry[];
};

const entityStructurePresets: Record<ReferenceEntityKind, EntityStructurePreset> = {
  person: {
    helperText:
      'Use structure modes here for provenance and setting: where this person belongs, when they belong, and who influenced them.',
    modes: [
      {
        id: 'homeland',
        label: 'Homeland',
        description: 'Place the person in a nation or place.',
        allowedRelationTypes: ['located_in'],
        defaultRelationType: 'located_in',
        notePlaceholder: 'Optional note about this homeland or place',
        targetPrompt: 'Choose a nation or place',
        targetKinds: ['nation', 'place'],
      },
      {
        id: 'era',
        label: 'Era',
        description: 'Attach the era this person belongs to.',
        allowedRelationTypes: ['during'],
        defaultRelationType: 'during',
        notePlaceholder: 'Optional note about this historical period',
        targetPrompt: 'Choose an era',
        targetKinds: ['era'],
      },
      {
        id: 'civilization',
        label: 'Civilization',
        description: 'Place the person inside a broader civilizational horizon.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this civilizational frame',
        targetPrompt: 'Choose a civilization',
        targetKinds: ['civilization'],
      },
      {
        id: 'influence',
        label: 'Influence',
        description: 'Record another person who influenced this figure.',
        allowedRelationTypes: ['influenced_by', 'related_to'],
        defaultRelationType: 'influenced_by',
        notePlaceholder: 'Optional note about this influence',
        targetPrompt: 'Choose another person',
        targetKinds: ['person'],
      },
    ],
  },
  nation: {
    helperText:
      'Use structure modes here to place the nation in a civilization, era, or geography, or to record sub-polities and peer links.',
    modes: [
      {
        id: 'civilization',
        label: 'Civilization',
        description: 'Place the nation inside a broader civilization.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this civilizational membership',
        targetPrompt: 'Choose a civilization',
        targetKinds: ['civilization'],
      },
      {
        id: 'era',
        label: 'Era',
        description: 'Attach the period in which this polity belongs.',
        allowedRelationTypes: ['during'],
        defaultRelationType: 'during',
        notePlaceholder: 'Optional note about this historical period',
        targetPrompt: 'Choose an era',
        targetKinds: ['era'],
      },
      {
        id: 'geography',
        label: 'Geography',
        description: 'Place the nation inside a larger geographic container.',
        allowedRelationTypes: ['located_in'],
        defaultRelationType: 'located_in',
        notePlaceholder: 'Optional note about this geography',
        targetPrompt: 'Choose a place',
        targetKinds: ['place'],
      },
      {
        id: 'sub-polity',
        label: 'Sub-polity',
        description: 'Record a contained polity or political subdivision.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this contained polity',
        targetPrompt: 'Choose another nation',
        targetKinds: ['nation'],
      },
      {
        id: 'peer-link',
        label: 'Peer Link',
        description: 'Record influence or affinity with another polity.',
        allowedRelationTypes: ['influenced_by', 'related_to'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this peer relation',
        targetPrompt: 'Choose another nation or civilization',
        targetKinds: ['nation', 'civilization'],
      },
    ],
  },
  civilization: {
    helperText:
      'Civilizations usually contain nations and eras. Use the modes here to build that scope deliberately.',
    modes: [
      {
        id: 'member-nation',
        label: 'Member Nation',
        description: 'Add a nation contained within this civilization.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this member nation',
        targetPrompt: 'Choose a nation',
        targetKinds: ['nation'],
      },
      {
        id: 'era-span',
        label: 'Era Span',
        description: 'Add an era that belongs inside this civilization.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this era span',
        targetPrompt: 'Choose an era',
        targetKinds: ['era'],
      },
      {
        id: 'super-civilization',
        label: 'Super-civilization',
        description: 'Nest this civilization inside a broader one when useful.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader frame',
        targetPrompt: 'Choose another civilization',
        targetKinds: ['civilization'],
      },
      {
        id: 'geography',
        label: 'Geography',
        description: 'Anchor the civilization to a place.',
        allowedRelationTypes: ['located_in'],
        defaultRelationType: 'located_in',
        notePlaceholder: 'Optional note about this geography',
        targetPrompt: 'Choose a place',
        targetKinds: ['place'],
      },
    ],
  },
  era: {
    helperText:
      'Eras work best as chronological containers. Use the modes here to build period hierarchy and parallels deliberately.',
    modes: [
      {
        id: 'sub-era',
        label: 'Sub-era',
        description: 'Add a narrower period contained within this one.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this sub-era',
        targetPrompt: 'Choose another era',
        targetKinds: ['era'],
      },
      {
        id: 'broader-era',
        label: 'Broader Era',
        description: 'Place this era inside a larger period.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader period',
        targetPrompt: 'Choose another era',
        targetKinds: ['era'],
      },
      {
        id: 'parallel-period',
        label: 'Parallel Period',
        description: 'Link a related or influencing period.',
        allowedRelationTypes: ['related_to', 'influenced_by'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this parallel period',
        targetPrompt: 'Choose another era',
        targetKinds: ['era'],
      },
    ],
  },
  place: {
    helperText:
      'Places usually nest inside other places, and they can also host nations or civilizations when geography matters.',
    modes: [
      {
        id: 'contained-place',
        label: 'Contained Place',
        description: 'Add a smaller place inside this one.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this contained place',
        targetPrompt: 'Choose another place',
        targetKinds: ['place'],
      },
      {
        id: 'broader-place',
        label: 'Broader Place',
        description: 'Place this location inside a larger geography.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this larger geography',
        targetPrompt: 'Choose another place',
        targetKinds: ['place'],
      },
      {
        id: 'hosted-polity',
        label: 'Hosted Polity',
        description: 'Attach a nation or civilization hosted by this geography.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this hosted polity',
        targetPrompt: 'Choose a nation or civilization',
        targetKinds: ['nation', 'civilization'],
      },
    ],
  },
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const formatYear = (value?: number) => {
  if (value === undefined) return null;
  if (value < 0) return `${Math.abs(value)} BCE`;
  if (value > 0) return `${value} CE`;
  return 'Year 0';
};

const formatTimespan = (entity: ReferenceEntity) => {
  const start = formatYear(entity.startYear);
  const end = formatYear(entity.endYear);

  if (start && end) return `${start} - ${end}`;
  return start || end || 'No chronology yet';
};

const formatRelationType = (value: KnowledgeRelationType) => value.replace(/_/g, ' ');

const formatIncomingRelationType = (value: KnowledgeRelationType) =>
  value === 'contains' ? 'contained by' : formatRelationType(value);

const parseYearInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
};

const toFormState = (entity: ReferenceEntity) => ({
  kind: entity.kind,
  title: entity.title,
  summary: entity.summary || '',
  description: entity.description || '',
  startYear: entity.startYear === undefined ? '' : String(entity.startYear),
  endYear: entity.endYear === undefined ? '' : String(entity.endYear),
});

const formatMetadataValue = (value: unknown) => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const EntityHint = ({ text }: { text: string }) => (
  <span className="reference-entity-help" tabIndex={0} aria-label={text}>
    <span aria-hidden="true" className="reference-entity-help-icon">
      i
    </span>
    <span role="tooltip" className="reference-entity-help-tooltip">
      {text}
    </span>
  </span>
);

const buildRelationHref = (relation: KnowledgeRelationDetail, direction: 'incoming' | 'outgoing') => {
  const entityType = direction === 'incoming' ? relation.fromEntityType : relation.toEntityType;
  const entityId = direction === 'incoming' ? relation.fromEntityId : relation.toEntityId;

  if (entityType === 'knowledge_item') return `/knowledge/${entityId}`;
  if (entityType === 'topic') return `/topics/${entityId}`;
  if (entityType === 'subject') return `/subjects/${entityId}`;
  if (entityType === 'reference_entity') return `/entities/${entityId}`;
  return null;
};

const getRelationCounterpartyTitle = (
  relation: KnowledgeRelationDetail,
  direction: RelationDirection
) => {
  if (direction === 'incoming') return relation.fromEntityTitle || `Entity #${relation.fromEntityId}`;
  return relation.toEntityTitle || `Entity #${relation.toEntityId}`;
};

const getRelationCounterpartyKind = (
  relation: KnowledgeRelationDetail,
  direction: RelationDirection
) => {
  if (direction === 'incoming') return relation.fromEntityKind;
  return relation.toEntityKind;
};

const createStructureEntry = (
  relation: KnowledgeRelationDetail,
  direction: RelationDirection,
  relationLabel?: string
): StructureEntry => ({
  key: `${direction}-${relation.id}`,
  relationId: relation.id,
  title: getRelationCounterpartyTitle(relation, direction),
  href: buildRelationHref(relation, direction),
  kindLabel: getRelationCounterpartyKind(relation, direction),
  relationLabel:
    relationLabel ??
    (direction === 'incoming'
      ? formatIncomingRelationType(relation.relationType)
      : formatRelationType(relation.relationType)),
  note: relation.note,
  createdAtLabel: formatDate(relation.createdAt),
  canDelete: direction === 'outgoing',
});

const sortStructureEntries = (entries: StructureEntry[]) =>
  [...entries].sort(
    (left, right) =>
      left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) ||
      left.relationId - right.relationId
  );

const buildStructureGroup = (
  key: string,
  title: string,
  hint: string,
  empty: string,
  entries: StructureEntry[]
): StructureGroup => ({
  key,
  title,
  hint,
  empty,
  entries: sortStructureEntries(entries),
});

const getTopicSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Topics about this person';
  if (kind === 'nation') return 'Topics about this nation';
  if (kind === 'civilization') return 'Topics about this civilization';
  if (kind === 'era') return 'Topics about this era';
  return 'Topics about this place';
};

const getItemSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Authored works';
  return 'Linked items';
};

const getEntityStructureLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'civilization') return 'Civilizational structure';
  if (kind === 'nation') return 'National structure';
  if (kind === 'era') return 'Era structure';
  if (kind === 'place') return 'Place structure';
  return 'Affiliations and influences';
};

const getKindPriority = (kindOrder: ReferenceEntityKind[]) =>
  kindOrder.reduce<Record<ReferenceEntityKind, number>>((accumulator, kind, index) => {
    accumulator[kind] = index;
    return accumulator;
  }, { person: 99, nation: 99, civilization: 99, era: 99, place: 99 });

const ReferenceEntityPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entityId = Number(id);

  const [entity, setEntity] = useState<ReferenceEntity | null>(null);
  const [allEntities, setAllEntities] = useState<ReferenceEntity[]>([]);
  const [incomingRelations, setIncomingRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [outgoingRelations, setOutgoingRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [formState, setFormState] = useState({
    kind: 'person' as ReferenceEntityKind,
    title: '',
    summary: '',
    description: '',
    startYear: '',
    endYear: '',
  });
  const [relationForm, setRelationForm] = useState({
    toEntityId: '',
    relationType: 'contains' as KnowledgeRelationType,
    note: '',
  });
  const [structureModeId, setStructureModeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showStructureComposer, setShowStructureComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(entityId) || entityId <= 0) {
      setError('Invalid reference entity.');
      setLoading(false);
      return;
    }

    const loadEntity = async () => {
      try {
        const [fetchedEntity, fetchedEntities, fetchedIncomingRelations, fetchedOutgoingRelations] =
          await Promise.all([
            fetchReferenceEntity(entityId),
            fetchReferenceEntities(),
            fetchReferenceEntityRelations(entityId),
            fetchReferenceEntityOutgoingRelations(entityId),
          ]);

        setEntity(fetchedEntity);
        setAllEntities(fetchedEntities);
        setIncomingRelations(fetchedIncomingRelations);
        setOutgoingRelations(fetchedOutgoingRelations);
        setFormState(toFormState(fetchedEntity));
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load reference entity.');
      } finally {
        setLoading(false);
      }
    };

    loadEntity();
  }, [entityId]);

  const legacySource = typeof entity?.metadata?.legacySource === 'string' ? entity.metadata.legacySource : null;
  const metadataEntries = useMemo(
    () => (entity?.metadata ? Object.entries(entity.metadata) : []),
    [entity?.metadata]
  );
  const externalLink =
    typeof entity?.metadata?.link === 'string' && entity.metadata.link
      ? entity.metadata.link
      : null;
  const displayMetadataEntries = useMemo(
    () => metadataEntries.filter(([key]) => key !== 'legacySource' && key !== 'link'),
    [metadataEntries]
  );

  const itemRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'knowledge_item'),
    [incomingRelations]
  );
  const authoredWorks = useMemo(
    () => itemRelations.filter((relation) => relation.relationType === 'created_by'),
    [itemRelations]
  );
  const relatedItems = useMemo(
    () => itemRelations.filter((relation) => relation.relationType !== 'created_by'),
    [itemRelations]
  );
  const topicRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'topic'),
    [incomingRelations]
  );
  const subjectRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'subject'),
    [incomingRelations]
  );
  const incomingEntityRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'reference_entity'),
    [incomingRelations]
  );
  const structurePreset = entity ? entityStructurePresets[entity.kind] : entityStructurePresets.person;
  const activeStructureMode =
    structurePreset.modes.find((mode) => mode.id === structureModeId) ?? structurePreset.modes[0];
  const selectableEntities = useMemo(() => {
    const kindPriority = getKindPriority(activeStructureMode.targetKinds);

    return [...allEntities]
      .filter(
        (candidate) =>
          candidate.id !== entity?.id && activeStructureMode.targetKinds.includes(candidate.kind)
      )
      .sort((left, right) => {
        const leftPriority = kindPriority[left.kind] ?? 99;
        const rightPriority = kindPriority[right.kind] ?? 99;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const titleComparison = left.title.localeCompare(right.title);
        if (titleComparison !== 0) return titleComparison;

        return left.id - right.id;
      });
  }, [activeStructureMode, allEntities, entity?.id]);

  const outgoingStructureRelations = useMemo(
    () => outgoingRelations.filter((relation) => relation.toEntityType === 'reference_entity'),
    [outgoingRelations]
  );
  const structureGroups = useMemo(() => {
    const outgoingContains = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'contains')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'contains'));
    const incomingContains = incomingEntityRelations
      .filter((relation) => relation.relationType === 'contains')
      .map((relation) => createStructureEntry(relation, 'incoming', 'contains this'));
    const outgoingPartOf = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'part_of')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'part of'));
    const incomingPartOf = incomingEntityRelations
      .filter((relation) => relation.relationType === 'part_of')
      .map((relation) => createStructureEntry(relation, 'incoming', 'member here'));
    const outgoingLocatedIn = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'located_in')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'located in'));
    const incomingLocatedIn = incomingEntityRelations
      .filter((relation) => relation.relationType === 'located_in')
      .map((relation) => createStructureEntry(relation, 'incoming', 'located here'));
    const outgoingDuring = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'during')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'during'));
    const incomingDuring = incomingEntityRelations
      .filter((relation) => relation.relationType === 'during')
      .map((relation) => createStructureEntry(relation, 'incoming', 'during this era'));
    const outgoingInfluencedBy = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'influenced_by')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'influenced by'));
    const incomingInfluencedBy = incomingEntityRelations
      .filter((relation) => relation.relationType === 'influenced_by')
      .map((relation) => createStructureEntry(relation, 'incoming', 'influences this'));
    const outgoingRelatedTo = outgoingStructureRelations
      .filter((relation) => relation.relationType === 'related_to')
      .map((relation) => createStructureEntry(relation, 'outgoing', 'related to'));
    const incomingRelatedTo = incomingEntityRelations
      .filter((relation) => relation.relationType === 'related_to')
      .map((relation) => createStructureEntry(relation, 'incoming', 'related here'));

    const containedScope = [...outgoingContains, ...incomingPartOf];
    const broaderContainers = [...outgoingPartOf, ...incomingContains];
    const locationWithin = outgoingLocatedIn;
    const hostedHere = incomingLocatedIn;
    const periodPlacement = outgoingDuring;
    const inThisEra = incomingDuring;
    const influencedBy = outgoingInfluencedBy;
    const influences = incomingInfluencedBy;
    const peerLinks = [...outgoingRelatedTo, ...incomingRelatedTo];

    const usedEntryKeys = new Set<string>(
      [
        ...containedScope,
        ...broaderContainers,
        ...locationWithin,
        ...hostedHere,
        ...periodPlacement,
        ...inThisEra,
        ...influencedBy,
        ...influences,
        ...peerLinks,
      ].map((entry) => entry.key)
    );

    const otherLinks = sortStructureEntries(
      [
        ...outgoingStructureRelations.map((relation) => createStructureEntry(relation, 'outgoing')),
        ...incomingEntityRelations.map((relation) => createStructureEntry(relation, 'incoming')),
      ].filter((entry) => !usedEntryKeys.has(entry.key))
    );

    const finalizeGroups = (groups: StructureGroup[]) =>
      (
        otherLinks.length > 0
          ? [
              ...groups,
              buildStructureGroup(
                'other-links',
                'Other atlas links',
                'Any remaining entity links that do not fit the main structure buckets yet.',
                'No additional atlas links yet.',
                otherLinks
              ),
            ]
          : groups
      ).filter((group) => group.entries.length > 0);

    if (entity?.kind === 'person') {
      return finalizeGroups([
        buildStructureGroup(
          'belongs-in',
          'Belongs in',
          'Homeland, era, place, and civilization links for this person.',
          'No homeland, era, or civilization links yet.',
          [...locationWithin, ...periodPlacement, ...broaderContainers]
        ),
        buildStructureGroup(
          'influenced-by',
          'Influenced by',
          'Figures or traditions recorded as shaping this person.',
          'No influences recorded yet.',
          influencedBy
        ),
        buildStructureGroup(
          'influences',
          'Influences',
          'Figures or traditions that currently point back to this person.',
          'No reverse influence links yet.',
          influences
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          'Sideways intellectual or historical links to other people.',
          'No peer links recorded yet.',
          peerLinks
        ),
      ]);
    }

    if (entity?.kind === 'nation') {
      return finalizeGroups([
        buildStructureGroup(
          'contained-scope',
          'Contained scope',
          'Sub-polities or member entities that sit inside this nation.',
          'No contained scope recorded yet.',
          containedScope
        ),
        buildStructureGroup(
          'placed-in',
          'Placed in',
          'Civilization, era, and larger geography links for this nation.',
          'No broader civilization, geography, or era links yet.',
          [...broaderContainers, ...locationWithin, ...periodPlacement]
        ),
        buildStructureGroup(
          'located-here',
          'Located here',
          'People or other entities that are placed inside this nation.',
          'Nothing is located here yet.',
          hostedHere
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          'Peer nations or civilizations linked through influence or affinity.',
          'No peer links recorded yet.',
          [...peerLinks, ...influencedBy, ...influences]
        ),
      ]);
    }

    if (entity?.kind === 'civilization') {
      return finalizeGroups([
        buildStructureGroup(
          'contained-scope',
          'Contained scope',
          'Member nations, eras, or sub-civilizations inside this civilization.',
          'No contained scope recorded yet.',
          containedScope
        ),
        buildStructureGroup(
          'placed-in',
          'Placed in',
          'Broader civilization or geography links for this civilization.',
          'No broader placement links yet.',
          [...broaderContainers, ...locationWithin]
        ),
        buildStructureGroup(
          'historical-links',
          'Historical links',
          'Era links and entities that are recorded as belonging in this civilizational horizon.',
          'No historical links recorded yet.',
          [...periodPlacement, ...inThisEra]
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          'Civilizations linked through influence or historical affinity.',
          'No peer links recorded yet.',
          [...peerLinks, ...influencedBy, ...influences]
        ),
      ]);
    }

    if (entity?.kind === 'era') {
      return finalizeGroups([
        buildStructureGroup(
          'contained-periods',
          'Contained periods',
          'Sub-eras or member entities recorded within this era.',
          'No contained periods recorded yet.',
          containedScope
        ),
        buildStructureGroup(
          'broader-periods',
          'Broader periods',
          'Larger eras that this period belongs to.',
          'No broader periods recorded yet.',
          broaderContainers
        ),
        buildStructureGroup(
          'in-this-era',
          'In this era',
          'Entities explicitly placed during this era.',
          'No entities are placed in this era yet.',
          inThisEra
        ),
        buildStructureGroup(
          'parallel-links',
          'Parallel links',
          'Parallel or influencing era links.',
          'No parallel links recorded yet.',
          [...peerLinks, ...influencedBy, ...influences]
        ),
      ]);
    }

    return finalizeGroups([
      buildStructureGroup(
        'contained-places',
        'Contained places',
        'Places or hosted entities recorded inside this geography.',
        'No contained places recorded yet.',
        containedScope
      ),
      buildStructureGroup(
        'broader-geography',
        'Broader geography',
        'Larger places that contain this one.',
        'No broader geography recorded yet.',
        broaderContainers
      ),
      buildStructureGroup(
        'located-here',
        'Located here',
        'Entities that are placed in this geography.',
        'Nothing is located here yet.',
        hostedHere
      ),
      buildStructureGroup(
        'period-links',
        'Period links',
        'Era links associated with this place.',
        'No period links recorded yet.',
        [...periodPlacement, ...inThisEra]
      ),
    ]);
  }, [entity?.kind, incomingEntityRelations, outgoingStructureRelations]);
  const topicContextCount = topicRelations.length + subjectRelations.length;
  const structureLinkCount = outgoingStructureRelations.length + incomingEntityRelations.length;
  const itemLinkSummary =
    entity?.kind === 'person'
      ? `${authoredWorks.length} authored${relatedItems.length ? `, ${relatedItems.length} other` : ''}`
      : `${itemRelations.length} linked`;

  useEffect(() => {
    if (!structurePreset.modes.some((mode) => mode.id === structureModeId)) {
      setStructureModeId(structurePreset.modes[0]?.id ?? '');
    }
  }, [structureModeId, structurePreset]);

  useEffect(() => {
    if (!entity) return;

    setRelationForm((current) => {
      const nextRelationType = activeStructureMode.allowedRelationTypes.includes(current.relationType)
        ? current.relationType
        : activeStructureMode.defaultRelationType;
      const hasSelectedTarget = selectableEntities.some(
        (candidate) => String(candidate.id) === current.toEntityId
      );
      const nextTargetId = hasSelectedTarget ? current.toEntityId : '';

      if (
        nextRelationType === current.relationType &&
        nextTargetId === current.toEntityId
      ) {
        return current;
      }

      return {
        ...current,
        relationType: nextRelationType,
        toEntityId: nextTargetId,
      };
    });
  }, [activeStructureMode, entity, selectableEntities]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entity || !formState.title.trim()) return;

    setSaving(true);
    setError(null);

    const payload: UpdateReferenceEntity = {
      kind: formState.kind,
      title: formState.title.trim(),
      summary: formState.summary.trim(),
      description: formState.description.trim(),
      startYear: parseYearInput(formState.startYear),
      endYear: parseYearInput(formState.endYear),
    };

    try {
      const updatedEntity = await updateReferenceEntity(entity.id, payload);
      setEntity(updatedEntity);
      setFormState(toFormState(updatedEntity));
      startTransition(() => {
        setAllEntities((current) =>
          current.map((existing) => (existing.id === updatedEntity.id ? updatedEntity : existing))
        );
      });
    } catch (saveError) {
      console.error(saveError);
      setError('Failed to update reference entity.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRelation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entity || !relationForm.toEntityId) return;

    setSavingRelation(true);
    setError(null);

    try {
      const relation = await createReferenceEntityRelation(entity.id, {
        toEntityId: Number(relationForm.toEntityId),
        relationType: relationForm.relationType,
        note: relationForm.note.trim() || undefined,
      });

      startTransition(() => {
        setOutgoingRelations((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === relation.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = relation;
            return next;
          }

          return [relation, ...current];
        });
      });

      setRelationForm({
        toEntityId: '',
        relationType: activeStructureMode.defaultRelationType,
        note: '',
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to create entity relation.');
    } finally {
      setSavingRelation(false);
    }
  };

  const handleDeleteRelation = async (relationId: number) => {
    if (!entity) return;

    try {
      await deleteReferenceEntityRelation(entity.id, relationId);
      startTransition(() => {
        setOutgoingRelations((current) => current.filter((relation) => relation.id !== relationId));
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to delete entity relation.');
    }
  };

  const handleDelete = async () => {
    if (!entity || deleting) return;
    if (!window.confirm(`Remove "${entity.title}" from the reference atlas?`)) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteReferenceEntity(entity.id);
      navigate('/entities');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete reference entity.');
      setDeleting(false);
    }
  };

  const renderStructureGroup = (group: StructureGroup) => (
    <div key={group.key} className="reference-entity-subsection">
      <div className="reference-entity-subsection-head">
        <h3>{group.title}</h3>
        <div className="reference-entity-inline-meta">
          <EntityHint text={group.hint} />
          <span>{group.entries.length}</span>
        </div>
      </div>
      <div className="reference-entity-stack">
        {group.entries.map((entry) => (
          <article key={entry.key} className="reference-entity-card">
            <div className="reference-entity-card-top">
              <div>
                <div className="reference-entity-badges">
                  <span>{entry.relationLabel}</span>
                  {entry.kindLabel ? <span>{entry.kindLabel}</span> : null}
                </div>
                {entry.href ? (
                  <Link to={entry.href} className="reference-entity-card-link">
                    <h3>{entry.title}</h3>
                  </Link>
                ) : (
                  <h3>{entry.title}</h3>
                )}
              </div>
              {entry.canDelete ? (
                <button type="button" onClick={() => handleDeleteRelation(entry.relationId)}>
                  Delete
                </button>
              ) : (
                <span>{entry.createdAtLabel}</span>
              )}
            </div>
            {entry.note ? <p>{entry.note}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="reference-entity-page">
        <div className="reference-entity-empty">Loading reference entity...</div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="reference-entity-page">
        <div className="reference-entity-empty">{error || 'Reference entity not found.'}</div>
      </div>
    );
  }

  return (
    <div className="reference-entity-page">
      <Link to="/entities" className="reference-entity-back">
        Back to Reference Atlas
      </Link>

      <section className="reference-entity-hero">
        <div className="reference-entity-hero-main">
          <span className="reference-entity-eyebrow">{kindLabels[entity.kind]}</span>
          <h1>{entity.title}</h1>
          <p>
            {entity.summary ||
              'This page holds the encyclopedic record for one person, nation, civilization, era, or place.'}
          </p>
          <div className="reference-entity-hero-meta">
            <span>{formatTimespan(entity)}</span>
            <span>
              {authoredWorks.length || itemRelations.length}{' '}
              {entity.kind === 'person' ? 'item links' : 'linked items'}
            </span>
            <span>{topicContextCount} topic links</span>
            <span>{structureLinkCount} entity links</span>
            <span>Updated {formatDate(entity.updatedAt)}</span>
            {legacySource ? <span>Imported from legacy {legacySource}</span> : <span>Native entity record</span>}
          </div>
          <div className="reference-entity-hero-actions">
            <button
              type="button"
              className="reference-entity-secondary-button"
              onClick={() => setShowEditor((current) => !current)}
            >
              {showEditor ? 'Close editor' : 'Edit entity'}
            </button>
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noreferrer"
                className="reference-entity-secondary-button reference-entity-link-button"
              >
                Open source link
              </a>
            ) : null}
          </div>
          <div className="reference-entity-overview-grid">
            <article className="reference-entity-overview-card">
              <div className="reference-entity-overview-label">
                <span className="reference-entity-eyebrow">Chronology</span>
                <EntityHint text="The main time span recorded for this entity." />
              </div>
              <strong>{formatTimespan(entity)}</strong>
              <span className="reference-entity-overview-meta">
                {legacySource ? `Imported from ${legacySource}` : 'Native atlas record'}
              </span>
            </article>
            <article className="reference-entity-overview-card">
              <div className="reference-entity-overview-label">
                <span className="reference-entity-eyebrow">Atlas Context</span>
                <EntityHint text="Subjects and topics that point to this entity as part of their conceptual or historical framing." />
              </div>
              <strong>{topicContextCount} links</strong>
              <span className="reference-entity-overview-meta">
                {topicRelations.length} topic, {subjectRelations.length} legacy subject
              </span>
            </article>
            <article className="reference-entity-overview-card">
              <div className="reference-entity-overview-label">
                <span className="reference-entity-eyebrow">Item Context</span>
                <EntityHint text={entity.kind === 'person' ? 'Items linked through authorship and other person-level connections.' : 'Items that point to this entity.'} />
              </div>
              <strong>{itemRelations.length} items</strong>
              <span className="reference-entity-overview-meta">{itemLinkSummary}</span>
            </article>
            <article className="reference-entity-overview-card">
              <div className="reference-entity-overview-label">
                <span className="reference-entity-eyebrow">Structure</span>
                <EntityHint text="Entity-to-entity containment, placement, and affiliation links." />
              </div>
              <strong>{structureLinkCount} links</strong>
              <span className="reference-entity-overview-meta">
                {outgoingStructureRelations.length} outgoing, {incomingEntityRelations.length} incoming
              </span>
            </article>
          </div>
          {showEditor ? (
            <section className="reference-entity-inline-panel">
              <form className="reference-entity-form" onSubmit={handleSubmit}>
                <div className="reference-entity-grid-inline">
                  <div className="reference-entity-field">
                    <label htmlFor="kind">Kind</label>
                    <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                      {kindOptions.map((kind) => (
                        <option key={kind} value={kind}>
                          {kindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="reference-entity-field">
                    <label htmlFor="title">Title</label>
                    <input id="title" name="title" value={formState.title} onChange={handleChange} required />
                  </div>
                </div>

                <div className="reference-entity-grid-inline">
                  <div className="reference-entity-field">
                    <label htmlFor="startYear">Start Year</label>
                    <input
                      id="startYear"
                      name="startYear"
                      type="number"
                      value={formState.startYear}
                      onChange={handleChange}
                      placeholder="-500 for BCE"
                    />
                  </div>

                  <div className="reference-entity-field">
                    <label htmlFor="endYear">End Year</label>
                    <input
                      id="endYear"
                      name="endYear"
                      type="number"
                      value={formState.endYear}
                      onChange={handleChange}
                      placeholder="1453"
                    />
                  </div>
                </div>

                <div className="reference-entity-field">
                  <label htmlFor="summary">Summary</label>
                  <textarea id="summary" name="summary" value={formState.summary} onChange={handleChange} />
                </div>

                <div className="reference-entity-field">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formState.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="reference-entity-inline-actions">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="reference-entity-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Removing...' : 'Remove entity'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      </section>

      {error ? <div className="reference-entity-error">{error}</div> : null}

      <div className="reference-entity-main">
          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Atlas Context</span>
                <h2>
                  {getTopicSectionLabel(entity.kind)}
                  <EntityHint text="Topics and legacy subject links that currently point to this entity." />
                  <span className="reference-entity-count-badge">{topicRelations.length + subjectRelations.length}</span>
                </h2>
              </div>
            </div>

            {topicRelations.length === 0 && subjectRelations.length === 0 ? (
              <div className="reference-entity-empty">No topics point here yet.</div>
            ) : (
              <div className="reference-entity-stack">
                {topicRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>topic</span>
                        </div>
                        <Link
                          to={buildRelationHref(relation, 'incoming') as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Topic #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
                {subjectRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>legacy subject</span>
                        </div>
                        <Link
                          to={buildRelationHref(relation, 'incoming') as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Subject #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Item Context</span>
                <h2>
                  {getItemSectionLabel(entity.kind)}
                  <EntityHint text={entity.kind === 'person' ? 'Works and item links that point to this person.' : 'Items that currently point to this entity.'} />
                  <span className="reference-entity-count-badge">{itemRelations.length}</span>
                </h2>
              </div>
            </div>

            {entity.kind === 'person' ? (
              authoredWorks.length === 0 ? (
                <div className="reference-entity-empty">No authored works point to this person yet.</div>
              ) : (
                <div className="reference-entity-stack">
                  {authoredWorks.map((relation) => (
                    <article key={relation.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatRelationType(relation.relationType)}</span>
                            {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                          </div>
                          <Link
                            to={buildRelationHref(relation, 'incoming') as string}
                            className="reference-entity-card-link"
                          >
                            <h3>{relation.fromEntityTitle || `Item #${relation.fromEntityId}`}</h3>
                          </Link>
                        </div>
                        <span>{formatDate(relation.createdAt)}</span>
                      </div>
                      {relation.note ? <p>{relation.note}</p> : null}
                    </article>
                  ))}
                </div>
              )
            ) : itemRelations.length === 0 ? (
              <div className="reference-entity-empty">No items point to this entity yet.</div>
            ) : (
              <div className="reference-entity-stack">
                {itemRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                        </div>
                        <Link
                          to={buildRelationHref(relation, 'incoming') as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Item #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
              </div>
            )}

            {entity.kind === 'person' && relatedItems.length > 0 ? (
              <div className="reference-entity-subsection">
                <h3>Other item links</h3>
                <div className="reference-entity-stack">
                  {relatedItems.map((relation) => (
                    <article key={relation.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatRelationType(relation.relationType)}</span>
                            {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                          </div>
                          <Link
                            to={buildRelationHref(relation, 'incoming') as string}
                            className="reference-entity-card-link"
                          >
                            <h3>{relation.fromEntityTitle || `Item #${relation.fromEntityId}`}</h3>
                          </Link>
                        </div>
                        <span>{formatDate(relation.createdAt)}</span>
                      </div>
                      {relation.note ? <p>{relation.note}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Structure</span>
                <h2>
                  {getEntityStructureLabel(entity.kind)}
                  <EntityHint text={structurePreset.helperText} />
                  <span className="reference-entity-count-badge">
                    {outgoingStructureRelations.length + incomingEntityRelations.length}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                className="reference-entity-secondary-button"
                onClick={() => setShowStructureComposer((current) => !current)}
              >
                {showStructureComposer ? 'Close' : 'Add entity link'}
              </button>
            </div>

            {showStructureComposer ? (
              <section className="reference-entity-inline-panel">
                <div className="reference-entity-mode-list">
                  {structurePreset.modes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={
                        activeStructureMode.id === mode.id
                          ? 'reference-entity-mode is-active'
                          : 'reference-entity-mode'
                      }
                      onClick={() => {
                        setStructureModeId(mode.id);
                        setRelationForm({
                          toEntityId: '',
                          relationType: mode.defaultRelationType,
                          note: '',
                        });
                      }}
                    >
                      <div className="reference-entity-mode-head">
                        <strong>{mode.label}</strong>
                        <EntityHint text={mode.description} />
                      </div>
                      <div className="reference-entity-badges">
                        {mode.targetKinds.map((kind) => (
                          <span key={`${mode.id}-${kind}`}>{kind}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                <form className="reference-entity-form" onSubmit={handleCreateRelation}>
                  <div className="reference-entity-grid-inline">
                    <div className="reference-entity-field">
                      <label htmlFor="entity-relation-type">Relation</label>
                      <select
                        id="entity-relation-type"
                        value={relationForm.relationType}
                        onChange={(event) =>
                          setRelationForm((current) => ({
                            ...current,
                            relationType: event.target.value as KnowledgeRelationType,
                          }))
                        }
                      >
                        {activeStructureMode.allowedRelationTypes.map((relationType) => (
                          <option key={relationType} value={relationType}>
                            {formatRelationType(relationType)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="reference-entity-field">
                      <label htmlFor="entity-relation-target">Target entity</label>
                      <select
                        id="entity-relation-target"
                        value={relationForm.toEntityId}
                        onChange={(event) =>
                          setRelationForm((current) => ({
                            ...current,
                            toEntityId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{activeStructureMode.targetPrompt}</option>
                        {selectableEntities.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title} ({candidate.kind})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="reference-entity-field">
                    <label htmlFor="entity-relation-note">Note</label>
                    <input
                      id="entity-relation-note"
                      value={relationForm.note}
                      onChange={(event) =>
                        setRelationForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      placeholder={activeStructureMode.notePlaceholder}
                    />
                  </div>
                  <div className="reference-entity-inline-meta">
                    <EntityHint text={activeStructureMode.description} />
                    <span>{activeStructureMode.label} guidance</span>
                  </div>
                  <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                    {savingRelation ? 'Linking...' : 'Add entity link'}
                  </button>
                </form>
              </section>
            ) : null}

            {outgoingStructureRelations.length === 0 && incomingEntityRelations.length === 0 ? (
              <div className="reference-entity-empty">
                No entity-to-entity links have been recorded yet.
              </div>
            ) : (
              <div className="reference-entity-stack">{structureGroups.map(renderStructureGroup)}</div>
            )}
          </section>

          {displayMetadataEntries.length > 0 ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Metadata</span>
                  <h2>
                    Attached fields
                    <span className="reference-entity-count-badge">{displayMetadataEntries.length}</span>
                  </h2>
                </div>
              </div>
              <div className="reference-entity-stack">
                {displayMetadataEntries.map(([key, value]) => (
                  <article key={key} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <h3>{key}</h3>
                      </div>
                    </div>
                    <p>{formatMetadataValue(value)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
      </div>
    </div>
  );
};

export default ReferenceEntityPage;
