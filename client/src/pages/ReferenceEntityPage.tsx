import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  ReferenceEntityKind,
  UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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

const kindOptions: ReferenceEntityKind[] = ['person', 'polity', 'nation', 'civilization', 'era', 'place'];
const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  polity: 'Polity',
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

type ContextEntry = {
  key: string;
  title: string;
  href: string | null;
  badges: string[];
  note?: string;
  createdAtLabel: string;
};

type ContextGroup = {
  key: string;
  title: string;
  hint: string;
  empty: string;
  entries: ContextEntry[];
};

type OverviewCard = {
  key: string;
  eyebrow: string;
  value: string;
  meta: string;
  hint: string;
};

const entityStructurePresets: Record<ReferenceEntityKind, EntityStructurePreset> = {
  person: {
    helperText:
      'Use structure modes here for provenance and setting: where this person belongs, when they belong, and who influenced them.',
    modes: [
      {
        id: 'homeland',
        label: 'Homeland',
        description: 'Place the person in a polity, nation, or place.',
        allowedRelationTypes: ['located_in'],
        defaultRelationType: 'located_in',
        notePlaceholder: 'Optional note about this homeland or place',
        targetPrompt: 'Choose a polity, nation, or place',
        targetKinds: ['polity', 'nation', 'place'],
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
  polity: {
    helperText:
      'Polities are atlas-backed historical-geographical units. Use structure modes here to place the polity in formations, eras, or broader geography.',
    modes: [
      {
        id: 'formation',
        label: 'Formation',
        description: 'Place the polity inside a broader civilization or formation.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader formation',
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
        description: 'Place the polity inside a larger geographic container.',
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
        targetPrompt: 'Choose another polity',
        targetKinds: ['polity', 'nation'],
      },
      {
        id: 'peer-link',
        label: 'Peer Link',
        description: 'Record influence or affinity with another polity.',
        allowedRelationTypes: ['influenced_by', 'related_to'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this peer relation',
        targetPrompt: 'Choose another polity or civilization',
        targetKinds: ['polity', 'nation', 'civilization'],
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
        targetPrompt: 'Choose another polity or nation',
        targetKinds: ['polity', 'nation'],
      },
      {
        id: 'peer-link',
        label: 'Peer Link',
        description: 'Record influence or affinity with another polity.',
        allowedRelationTypes: ['influenced_by', 'related_to'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this peer relation',
        targetPrompt: 'Choose another polity, nation, or civilization',
        targetKinds: ['polity', 'nation', 'civilization'],
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
        description: 'Add a polity or nation contained within this civilization.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this member polity',
        targetPrompt: 'Choose a polity or nation',
        targetKinds: ['polity', 'nation'],
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
      'Places usually nest inside other places, and they can also host polities, nations, or civilizations when geography matters.',
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
        description: 'Attach a polity, nation, or civilization hosted by this geography.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this hosted polity',
        targetPrompt: 'Choose a polity, nation, or civilization',
        targetKinds: ['polity', 'nation', 'civilization'],
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

const isPolityLikeKind = (kind: ReferenceEntityKind) => kind === 'nation' || kind === 'polity';

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

const createContextEntry = (
  relation: KnowledgeRelationDetail,
  options?: {
    relationLabel?: string;
    sourceLabel?: string;
    extraBadges?: string[];
  }
): ContextEntry => {
  const badges = [
    options?.relationLabel ?? formatRelationType(relation.relationType),
    options?.sourceLabel,
    ...(options?.extraBadges ?? []),
  ].filter(Boolean) as string[];

  return {
    key: `incoming-${relation.id}`,
    title: relation.fromEntityTitle || `${relation.fromEntityType} #${relation.fromEntityId}`,
    href: buildRelationHref(relation, 'incoming'),
    badges,
    note: relation.note,
    createdAtLabel: formatDate(relation.createdAt),
  };
};

const sortContextEntries = (entries: ContextEntry[]) =>
  [...entries].sort(
    (left, right) =>
      left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) ||
      left.key.localeCompare(right.key)
  );

const buildContextGroup = (
  key: string,
  title: string,
  hint: string,
  empty: string,
  entries: ContextEntry[]
): ContextGroup => ({
  key,
  title,
  hint,
  empty,
  entries: sortContextEntries(entries),
});

const getGroupByKey = <T extends { key: string }>(groups: T[], key: string) =>
  groups.find((group) => group.key === key);

const getGroupPreview = (
  group: { entries: Array<{ title: string }> } | undefined,
  fallback: string,
  limit = 2
) => {
  if (!group || group.entries.length === 0) return fallback;

  const preview = group.entries.slice(0, limit).map((entry) => entry.title).join(' · ');
  if (group.entries.length > limit) return `${preview} +${group.entries.length - limit}`;
  return preview;
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

const getItemSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Authored works';
  return 'Linked items';
};

const getAtlasSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Biographical coverage';
  if (kind === 'era') return 'Historical framing';
  if (kind === 'polity') return 'Polity framing';
  if (kind === 'nation') return 'National framing';
  if (kind === 'civilization') return 'Civilizational framing';
  return 'Geographic framing';
};

const getEntityStructureLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'civilization') return 'Civilizational structure';
  if (kind === 'polity') return 'Polity structure';
  if (kind === 'nation') return 'National structure';
  if (kind === 'era') return 'Era structure';
  if (kind === 'place') return 'Place structure';
  return 'Affiliations and influences';
};

const getKindPriority = (kindOrder: ReferenceEntityKind[]) =>
  kindOrder.reduce<Record<ReferenceEntityKind, number>>((accumulator, kind, index) => {
    accumulator[kind] = index;
    return accumulator;
  }, { person: 99, polity: 99, nation: 99, civilization: 99, era: 99, place: 99 });

const ReferenceEntityPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const entityId = Number(id);
  const returnTo =
    typeof location.state === 'object' &&
    location.state !== null &&
    'returnTo' in location.state &&
    typeof (location.state as { returnTo?: unknown }).returnTo === 'string'
      ? (location.state as { returnTo: string }).returnTo
      : '/entities?view=list';

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
  const atlasContextGroups = useMemo(() => {
    const topicalCoverage = topicRelations
      .filter((relation) => relation.relationType === 'about')
      .map((relation) =>
        createContextEntry(relation, {
          sourceLabel: 'topic',
        })
      );
    const contextualCoverage = topicRelations
      .filter((relation) => relation.relationType !== 'about')
      .map((relation) =>
        createContextEntry(relation, {
          sourceLabel: 'topic',
        })
      );
    const legacyCoverage = subjectRelations.map((relation) =>
      createContextEntry(relation, {
        sourceLabel: 'legacy subject',
      })
    );

    if (entity?.kind === 'person') {
      return [
        buildContextGroup(
          'topic-coverage',
          'Topics about this person',
          'Study topics that explicitly treat this person as a subject.',
          'No topics explicitly point to this person yet.',
          [...topicalCoverage, ...contextualCoverage]
        ),
        buildContextGroup(
          'legacy-subjects',
          'Legacy subject links',
          'Older subject-level links that still point here.',
          'No legacy subject links remain here.',
          legacyCoverage
        ),
      ].filter((group) => group.entries.length > 0);
    }

    return [
      buildContextGroup(
        'topic-coverage',
        `Topics about this ${entity?.kind ?? 'entity'}`,
        'Study topics that directly treat this entity as the main historical or geographic subject.',
        `No topics explicitly point to this ${entity?.kind ?? 'entity'} yet.`,
        topicalCoverage
      ),
      buildContextGroup(
        'contextual-coverage',
        'Contextual topic links',
        'Topics that use this entity as part of their framing rather than as the main subject.',
        'No contextual topic links yet.',
        contextualCoverage
      ),
      buildContextGroup(
        'legacy-subjects',
        'Legacy subject links',
        'Older subject-level links that still point here.',
        'No legacy subject links remain here.',
        legacyCoverage
      ),
    ].filter((group) => group.entries.length > 0);
  }, [entity?.kind, subjectRelations, topicRelations]);
  const itemContextGroups = useMemo(() => {
    if (entity?.kind === 'person') {
      return [
        buildContextGroup(
          'authored-works',
          'Authored works',
          'Items that name this person as the creator.',
          'No authored works point to this person yet.',
          authoredWorks.map((relation) =>
            createContextEntry(relation, {
              extraBadges: relation.fromEntityKind ? [relation.fromEntityKind] : undefined,
            })
          )
        ),
        buildContextGroup(
          'other-item-links',
          'Referenced in items',
          'Other item links that point to this person without using authorship.',
          'No other item links yet.',
          relatedItems.map((relation) =>
            createContextEntry(relation, {
              extraBadges: relation.fromEntityKind ? [relation.fromEntityKind] : undefined,
            })
          )
        ),
      ].filter((group) => group.entries.length > 0);
    }

    const directItems = itemRelations
      .filter((relation) => relation.relationType === 'about')
      .map((relation) =>
        createContextEntry(relation, {
          extraBadges: relation.fromEntityKind ? [relation.fromEntityKind] : undefined,
        })
      );
    const contextualItems = itemRelations
      .filter((relation) => relation.relationType !== 'about')
      .map((relation) =>
        createContextEntry(relation, {
          extraBadges: relation.fromEntityKind ? [relation.fromEntityKind] : undefined,
        })
      );

    return [
      buildContextGroup(
        'direct-items',
        `Items about this ${entity?.kind}`,
        'Items that directly treat this entity as their main subject.',
        `No items explicitly point to this ${entity?.kind} yet.`,
        directItems
      ),
      buildContextGroup(
        'contextual-items',
        'Items using this frame',
        'Items that use this entity as historical, geographic, or contextual framing.',
        'No contextual item links yet.',
        contextualItems
      ),
    ].filter((group) => group.entries.length > 0);
  }, [authoredWorks, entity?.kind, itemRelations, relatedItems]);
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

    if (entity?.kind && isPolityLikeKind(entity.kind)) {
      return finalizeGroups([
        buildStructureGroup(
          'contained-scope',
          'Contained scope',
          `Sub-polities or member entities that sit inside this ${entity.kind}.`,
          'No contained scope recorded yet.',
          containedScope
        ),
        buildStructureGroup(
          'placed-in',
          'Placed in',
          `Civilization, era, and larger geography links for this ${entity.kind}.`,
          'No broader civilization, geography, or era links yet.',
          [...broaderContainers, ...locationWithin, ...periodPlacement]
        ),
        buildStructureGroup(
          'located-here',
          'Located here',
          `People or other entities that are placed inside this ${entity.kind}.`,
          'Nothing is located here yet.',
          hostedHere
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          `Peer ${entity.kind === 'polity' ? 'polities' : 'nations'} or civilizations linked through influence or affinity.`,
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
  const overviewCards = useMemo<OverviewCard[]>(() => {
    if (!entity) return [];

    const chronologyCard: OverviewCard = {
      key: 'chronology',
      eyebrow: 'Chronology',
      value: formatTimespan(entity),
      meta: legacySource ? `Imported from ${legacySource}` : 'Native atlas record',
      hint: 'The main time span currently recorded for this entity.',
    };

    if (entity.kind === 'person') {
      const belongsIn = getGroupByKey(structureGroups, 'belongs-in');
      const influencedByGroup = getGroupByKey(structureGroups, 'influenced-by');
      const influencesGroup = getGroupByKey(structureGroups, 'influences');
      const peerLinksGroup = getGroupByKey(structureGroups, 'peer-links');
      const influenceCount =
        (influencedByGroup?.entries.length ?? 0) +
        (influencesGroup?.entries.length ?? 0) +
        (peerLinksGroup?.entries.length ?? 0);

      return [
        chronologyCard,
        {
          key: 'belongs-in',
          eyebrow: 'Belongs In',
          value: `${belongsIn?.entries.length ?? 0} links`,
          meta: getGroupPreview(belongsIn, 'No homeland, era, or civilization links yet.'),
          hint: 'Homeland, era, place, and civilization links that situate this person.',
        },
        {
          key: 'works',
          eyebrow: 'Works',
          value: `${authoredWorks.length} authored`,
          meta:
            relatedItems.length > 0
              ? `${relatedItems.length} other item references`
              : 'Only authored works are linked so far.',
          hint: 'Items that point to this person, especially through authorship.',
        },
        {
          key: 'influence-web',
          eyebrow: 'Influence Web',
          value: `${influenceCount} links`,
          meta: getGroupPreview(influencedByGroup ?? peerLinksGroup, 'No influence links yet.'),
          hint: 'Influence and peer links around this person.',
        },
      ];
    }

    if (isPolityLikeKind(entity.kind)) {
      const containedScope = getGroupByKey(structureGroups, 'contained-scope');
      const placedIn = getGroupByKey(structureGroups, 'placed-in');

      return [
        chronologyCard,
        {
          key: 'contained-scope',
          eyebrow: 'Contained Scope',
          value: `${containedScope?.entries.length ?? 0} links`,
          meta: getGroupPreview(containedScope, 'No contained scope recorded yet.'),
          hint: `Sub-polities or member entities recorded inside this ${entity.kind}.`,
        },
        {
          key: 'placed-in',
          eyebrow: 'Placed In',
          value: `${placedIn?.entries.length ?? 0} links`,
          meta: getGroupPreview(placedIn, 'No broader geography, civilization, or era links yet.'),
          hint: `Broader civilization, geography, and era links for this ${entity.kind}.`,
        },
        {
          key: 'coverage',
          eyebrow: 'Coverage',
          value: `${topicContextCount} topics`,
          meta: `${itemRelations.length} linked items`,
          hint: `How many topics and items currently use this ${entity.kind} in the atlas.`,
        },
      ];
    }

    if (entity.kind === 'civilization') {
      const containedScope = getGroupByKey(structureGroups, 'contained-scope');
      const historicalLinks = getGroupByKey(structureGroups, 'historical-links');

      return [
        chronologyCard,
        {
          key: 'contained-scope',
          eyebrow: 'Contained Scope',
          value: `${containedScope?.entries.length ?? 0} links`,
          meta: getGroupPreview(containedScope, 'No member nations or eras yet.'),
          hint: 'Member nations, eras, or sub-civilizations inside this civilization.',
        },
        {
          key: 'historical-links',
          eyebrow: 'Historical Links',
          value: `${historicalLinks?.entries.length ?? 0} links`,
          meta: getGroupPreview(historicalLinks, 'No historical links yet.'),
          hint: 'Era links and entities associated with this civilizational horizon.',
        },
        {
          key: 'coverage',
          eyebrow: 'Coverage',
          value: `${topicContextCount} topics`,
          meta: `${itemRelations.length} linked items`,
          hint: 'How many topics and items currently use this civilization in the atlas.',
        },
      ];
    }

    if (entity.kind === 'era') {
      const containedPeriods = getGroupByKey(structureGroups, 'contained-periods');
      const inThisEra = getGroupByKey(structureGroups, 'in-this-era');

      return [
        chronologyCard,
        {
          key: 'contained-periods',
          eyebrow: 'Contained Periods',
          value: `${containedPeriods?.entries.length ?? 0} links`,
          meta: getGroupPreview(containedPeriods, 'No sub-eras recorded yet.'),
          hint: 'Sub-eras or member entities recorded within this period.',
        },
        {
          key: 'in-this-era',
          eyebrow: 'In This Era',
          value: `${inThisEra?.entries.length ?? 0} links`,
          meta: getGroupPreview(inThisEra, 'No entities are placed in this era yet.'),
          hint: 'Entities that are explicitly placed during this era.',
        },
        {
          key: 'coverage',
          eyebrow: 'Coverage',
          value: `${topicContextCount} topics`,
          meta: `${itemRelations.length} linked items`,
          hint: 'How many topics and items currently use this era in the atlas.',
        },
      ];
    }

    const containedPlaces = getGroupByKey(structureGroups, 'contained-places');
    const locatedHere = getGroupByKey(structureGroups, 'located-here');

    return [
      chronologyCard,
      {
        key: 'contained-places',
        eyebrow: 'Contained Places',
        value: `${containedPlaces?.entries.length ?? 0} links`,
        meta: getGroupPreview(containedPlaces, 'No contained places recorded yet.'),
        hint: 'Places or hosted entities recorded inside this geography.',
      },
      {
        key: 'located-here',
        eyebrow: 'Located Here',
        value: `${locatedHere?.entries.length ?? 0} links`,
        meta: getGroupPreview(locatedHere, 'Nothing is located here yet.'),
        hint: 'Entities that are placed inside this geography.',
      },
      {
        key: 'coverage',
        eyebrow: 'Coverage',
        value: `${topicContextCount} topics`,
        meta: `${itemRelations.length} linked items`,
        hint: 'How many topics and items currently use this place in the atlas.',
      },
    ];
  }, [
    authoredWorks.length,
    entity,
    itemRelations.length,
    legacySource,
    relatedItems.length,
    structureGroups,
    topicContextCount,
  ]);

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

  const renderContextGroup = (group: ContextGroup) => (
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
                  {entry.badges.map((badge) => (
                    <span key={`${entry.key}-${badge}`}>{badge}</span>
                  ))}
                </div>
                {entry.href ? (
                  <Link to={entry.href} className="reference-entity-card-link">
                    <h3>{entry.title}</h3>
                  </Link>
                ) : (
                  <h3>{entry.title}</h3>
                )}
              </div>
              <span>{entry.createdAtLabel}</span>
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
      <Link to={returnTo} className="reference-entity-back">
        Back to Reference Atlas
      </Link>

      <section className="reference-entity-hero">
        <div className="reference-entity-hero-main">
          <span className="reference-entity-eyebrow">{kindLabels[entity.kind]}</span>
          <h1>{entity.title}</h1>
          <p>
            {entity.summary ||
              'This page holds the encyclopedic record for one person, polity, nation, civilization, era, or place.'}
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
            {overviewCards.map((card) => (
              <article key={card.key} className="reference-entity-overview-card">
                <div className="reference-entity-overview-label">
                  <span className="reference-entity-eyebrow">{card.eyebrow}</span>
                  <EntityHint text={card.hint} />
                </div>
                <strong>{card.value}</strong>
                <span className="reference-entity-overview-meta">{card.meta}</span>
              </article>
            ))}
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
                  {getAtlasSectionLabel(entity.kind)}
                  <EntityHint text="Topics and legacy subject links that currently point to this entity." />
                  <span className="reference-entity-count-badge">{topicRelations.length + subjectRelations.length}</span>
                </h2>
              </div>
            </div>

            {atlasContextGroups.length === 0 ? (
              <div className="reference-entity-empty">No topics point here yet.</div>
            ) : (
              <div className="reference-entity-stack">{atlasContextGroups.map(renderContextGroup)}</div>
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

            {itemContextGroups.length === 0 ? (
              <div className="reference-entity-empty">
                {entity.kind === 'person'
                  ? 'No items point to this person yet.'
                  : 'No items point to this entity yet.'}
              </div>
            ) : (
              <div className="reference-entity-stack">
                {itemContextGroups.map(renderContextGroup)}
              </div>
            )}
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
