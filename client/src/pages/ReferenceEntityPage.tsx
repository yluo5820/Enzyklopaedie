import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  FormationSubtype,
  FormationMembershipDetail,
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  PersonPolityMembershipDetail,
  PolitySnapshot,
  ReferenceEntity,
  ReferenceEntityKind,
  UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  createFormationMembership,
  createPersonPolityMembership,
  createReferenceEntityRelation,
  deleteFormationMembership,
  deletePersonPolityMembership,
  deleteReferenceEntity,
  deleteReferenceEntityRelation,
  fetchReferenceEntities,
  fetchReferenceEntity,
  fetchReferenceEntityFormationMemberships,
  fetchReferenceEntityPersonPolityMemberships,
  fetchReferenceEntityOutgoingRelations,
  fetchReferenceEntityPolitySnapshots,
  fetchReferenceEntityRelations,
  updateReferenceEntity,
} from '../api';
import './ReferenceEntityPage.css';

const primaryKindOptions: ReferenceEntityKind[] = ['person', 'polity', 'formation'];

const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  polity: 'Polity',
  formation: 'Formation',
};
const formationSubtypeLabels: Record<FormationSubtype, string> = {
  civilization: 'Civilization',
  era: 'Era',
  tradition: 'Tradition',
  world_frame: 'World Frame',
  other: 'Other',
};
const formationSubtypeOptions: FormationSubtype[] = [
  'civilization',
  'era',
  'tradition',
  'world_frame',
  'other',
];

type FormationSubtypeUi = {
  workspaceLabel: string;
  membershipEyebrow: string;
  membershipCountLabel: string;
  membershipMetaEmpty: string;
  membershipHint: string;
  membershipSectionTitle: string;
  membershipSectionHint: string;
  membershipComposerLabel: string;
  membershipComposerButton: string;
  membershipComposerEmpty: string;
  broaderTitle: string;
  broaderHint: string;
  helperText: string;
  broaderModeLabel: string;
  broaderModeDescription: string;
  parallelModeLabel: string;
  parallelModeDescription: string;
};

const formationSubtypeUi: Record<FormationSubtype, FormationSubtypeUi> = {
  civilization: {
    workspaceLabel: 'Civilization',
    membershipEyebrow: 'Civilizational Scope',
    membershipCountLabel: 'member polities',
    membershipMetaEmpty: 'No member polities yet.',
    membershipHint: 'Built-in polities explicitly included in this civilization.',
    membershipSectionTitle: 'Member polities',
    membershipSectionHint: 'Built-in polities explicitly assigned to this civilization.',
    membershipComposerLabel: 'Manage scope',
    membershipComposerButton: 'Add polity',
    membershipComposerEmpty: 'No member polities have been recorded for this civilization yet.',
    broaderTitle: 'Broader formations',
    broaderHint: 'How this civilization sits inside larger historical groupings.',
    helperText:
      'Civilizations collect polities across a continuing historical tradition. Use explicit polity memberships below, then add broader or parallel formation links here when useful.',
    broaderModeLabel: 'Broader Formation',
    broaderModeDescription: 'Place this civilization inside a larger historical formation.',
    parallelModeLabel: 'Parallel Formation',
    parallelModeDescription: 'Link a related or influencing civilization or formation.',
  },
  era: {
    workspaceLabel: 'Era',
    membershipEyebrow: 'Era Scope',
    membershipCountLabel: 'polities in scope',
    membershipMetaEmpty: 'No polities are in scope yet.',
    membershipHint: 'Built-in polities explicitly placed inside this era frame.',
    membershipSectionTitle: 'Polities in scope',
    membershipSectionHint: 'Built-in polities explicitly treated as falling inside this era.',
    membershipComposerLabel: 'Manage scope',
    membershipComposerButton: 'Add polity to era',
    membershipComposerEmpty: 'No polities are in scope for this era yet.',
    broaderTitle: 'Broader frames',
    broaderHint: 'How this era sits inside larger historical frames.',
    helperText:
      'Eras define a bounded historical frame. Use explicit polity memberships below to say where this era applies, then add broader or parallel formation links here when useful.',
    broaderModeLabel: 'Broader Frame',
    broaderModeDescription: 'Place this era inside a larger historical frame.',
    parallelModeLabel: 'Parallel Frame',
    parallelModeDescription: 'Link a related or overlapping era or formation.',
  },
  tradition: {
    workspaceLabel: 'Tradition',
    membershipEyebrow: 'Tradition Scope',
    membershipCountLabel: 'member polities',
    membershipMetaEmpty: 'No member polities yet.',
    membershipHint: 'Built-in polities explicitly included in this tradition.',
    membershipSectionTitle: 'Member polities',
    membershipSectionHint: 'Built-in polities explicitly assigned to this tradition.',
    membershipComposerLabel: 'Manage scope',
    membershipComposerButton: 'Add polity',
    membershipComposerEmpty: 'No member polities have been recorded for this tradition yet.',
    broaderTitle: 'Broader formations',
    broaderHint: 'How this tradition sits inside larger historical groupings.',
    helperText:
      'Traditions collect polities across a continuing line of thought or practice. Use explicit polity memberships below, then add broader or parallel formation links here when useful.',
    broaderModeLabel: 'Broader Formation',
    broaderModeDescription: 'Place this tradition inside a larger historical formation.',
    parallelModeLabel: 'Parallel Formation',
    parallelModeDescription: 'Link a related or influencing tradition or formation.',
  },
  world_frame: {
    workspaceLabel: 'World Frame',
    membershipEyebrow: 'World Scope',
    membershipCountLabel: 'polities in scope',
    membershipMetaEmpty: 'No polities are in scope yet.',
    membershipHint: 'Built-in polities explicitly included in this world frame.',
    membershipSectionTitle: 'Polities in scope',
    membershipSectionHint: 'Built-in polities explicitly treated as falling inside this world frame.',
    membershipComposerLabel: 'Manage scope',
    membershipComposerButton: 'Add polity to frame',
    membershipComposerEmpty: 'No polities are in scope for this world frame yet.',
    broaderTitle: 'Broader frames',
    broaderHint: 'How this world frame sits inside larger historical groupings.',
    helperText:
      'World frames collect polities across a synchronizing historical frame. Use explicit polity memberships below to define that scope, then add broader or parallel links here when useful.',
    broaderModeLabel: 'Broader Frame',
    broaderModeDescription: 'Place this world frame inside a larger historical frame.',
    parallelModeLabel: 'Parallel Frame',
    parallelModeDescription: 'Link a related or overlapping world frame or formation.',
  },
  other: {
    workspaceLabel: 'Formation',
    membershipEyebrow: 'Membership',
    membershipCountLabel: 'member polities',
    membershipMetaEmpty: 'No polity memberships yet.',
    membershipHint: 'Built-in polities explicitly assigned to this formation.',
    membershipSectionTitle: 'Member polities',
    membershipSectionHint: 'Built-in polities explicitly assigned to this formation.',
    membershipComposerLabel: 'Manage polities',
    membershipComposerButton: 'Add polity',
    membershipComposerEmpty: 'No polity memberships have been recorded for this formation yet.',
    broaderTitle: 'Broader formations',
    broaderHint: 'How this formation sits inside larger historical groupings.',
    helperText:
      'Formations collect polities across time and space. Use explicit polity memberships below, then add broader or parallel formation links here when useful.',
    broaderModeLabel: 'Broader Formation',
    broaderModeDescription: 'Place this formation inside a larger historical formation.',
    parallelModeLabel: 'Parallel Formation',
    parallelModeDescription: 'Link a related or influencing formation.',
  },
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
      'Use structure modes here for broader formations and influence links. Direct polity membership is managed in its own section.',
    modes: [
      {
        id: 'formation',
        label: 'Formation',
        description: 'Place the person inside a broader historical formation.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader formation',
        targetPrompt: 'Choose a formation',
        targetKinds: ['formation'],
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
      'Polities are atlas-backed historical-geographical units. Use structure modes here for broader formations, sub-polities, and peer links.',
    modes: [
      {
        id: 'formation',
        label: 'Formation',
        description: 'Place the polity inside a broader historical formation.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader formation',
        targetPrompt: 'Choose a formation',
        targetKinds: ['formation'],
      },
      {
        id: 'sub-polity',
        label: 'Sub-polity',
        description: 'Record a contained polity or political subdivision.',
        allowedRelationTypes: ['contains'],
        defaultRelationType: 'contains',
        notePlaceholder: 'Optional note about this contained polity',
        targetPrompt: 'Choose another polity',
        targetKinds: ['polity'],
      },
      {
        id: 'peer-link',
        label: 'Peer Link',
        description: 'Record influence or affinity with another polity.',
        allowedRelationTypes: ['influenced_by', 'related_to'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this peer relation',
        targetPrompt: 'Choose another polity or formation',
        targetKinds: ['polity', 'formation'],
      },
    ],
  },
  formation: {
    helperText:
      'Formations collect polities across time and space. Use explicit polity memberships below, then add broader or parallel formation links here when useful.',
    modes: [
      {
        id: 'broader-formation',
        label: 'Broader Formation',
        description: 'Place this formation inside a larger historical formation.',
        allowedRelationTypes: ['part_of'],
        defaultRelationType: 'part_of',
        notePlaceholder: 'Optional note about this broader historical frame',
        targetPrompt: 'Choose another formation',
        targetKinds: ['formation'],
      },
      {
        id: 'parallel-formation',
        label: 'Parallel Formation',
        description: 'Link a related or influencing formation.',
        allowedRelationTypes: ['related_to', 'influenced_by'],
        defaultRelationType: 'related_to',
        notePlaceholder: 'Optional note about this parallel formation',
        targetPrompt: 'Choose another formation',
        targetKinds: ['formation'],
      },
    ],
  },
};

const getFormationSubtypeUi = (subtype?: FormationSubtype | null) =>
  formationSubtypeUi[subtype ?? 'other'];

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

const isMembershipVisibleInYear = (
  membership: Pick<FormationMembershipDetail | PersonPolityMembershipDetail, 'startYear' | 'endYear'>,
  year: number
) => {
  if (membership.startYear !== undefined && membership.endYear !== undefined) {
    return year >= membership.startYear && year <= membership.endYear;
  }
  if (membership.startYear !== undefined) {
    return year >= membership.startYear;
  }
  if (membership.endYear !== undefined) {
    return year <= membership.endYear;
  }
  return true;
};

const resolveAtlasFocusYear = (
  availableYears: number[],
  entity?: Pick<ReferenceEntity, 'startYear' | 'endYear'> | null
) => {
  if (availableYears.length === 0) return null;

  const targetYear = entity?.endYear ?? entity?.startYear ?? availableYears[availableYears.length - 1];

  return availableYears.reduce((closest, year) =>
    Math.abs(year - targetYear) < Math.abs(closest - targetYear) ? year : closest
  );
};

const toFormState = (entity: ReferenceEntity) => ({
  kind: entity.kind,
  formationSubtype: entity.formationSubtype ?? ('civilization' as FormationSubtype),
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

const isPolityLikeKind = (kind: ReferenceEntityKind) => kind === 'polity';
const isBuiltInPolityReferenceEntity = (entity: Pick<ReferenceEntity, 'kind' | 'metadata'>) =>
  entity.kind === 'polity' &&
  entity.metadata?.atlasSource === 'historical-basemaps' &&
  entity.metadata?.builtIn === true;

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
  if (kind === 'formation') return 'Formation framing';
  if (kind === 'polity') return 'Polity framing';
  return 'Atlas framing';
};

const getEntityStructureLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'formation') return 'Formation structure';
  if (kind === 'polity') return 'Polity structure';
  return 'Formation and influence links';
};

const getKindPriority = (kindOrder: ReferenceEntityKind[]) =>
  kindOrder.reduce<Record<ReferenceEntityKind, number>>((accumulator, kind, index) => {
    accumulator[kind] = index;
    return accumulator;
  }, { person: 99, polity: 99, formation: 99 });

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
  const [politySnapshots, setPolitySnapshots] = useState<PolitySnapshot[]>([]);
  const [formationPolitySnapshotCache, setFormationPolitySnapshotCache] = useState<
    Record<number, PolitySnapshot[]>
  >({});
  const [formationMemberships, setFormationMemberships] = useState<FormationMembershipDetail[]>([]);
  const [personPolityMemberships, setPersonPolityMemberships] = useState<PersonPolityMembershipDetail[]>([]);
  const [atlasFocusYear, setAtlasFocusYear] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    kind: 'person' as ReferenceEntityKind,
    formationSubtype: 'civilization' as FormationSubtype,
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
  const [formationMembershipForm, setFormationMembershipForm] = useState({
    polityEntityId: '',
    startYear: '',
    endYear: '',
    note: '',
  });
  const [personPolityMembershipForm, setPersonPolityMembershipForm] = useState({
    polityEntityId: '',
    startYear: '',
    endYear: '',
    note: '',
  });
  const [structureModeId, setStructureModeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showStructureComposer, setShowStructureComposer] = useState(false);
  const [showFormationMembershipComposer, setShowFormationMembershipComposer] = useState(false);
  const [showPersonPolityMembershipComposer, setShowPersonPolityMembershipComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [savingFormationMembership, setSavingFormationMembership] = useState(false);
  const [savingPersonPolityMembership, setSavingPersonPolityMembership] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [politySnapshotsError, setPolitySnapshotsError] = useState<string | null>(null);
  const [formationMembershipsError, setFormationMembershipsError] = useState<string | null>(null);
  const [personPolityMembershipsError, setPersonPolityMembershipsError] = useState<string | null>(null);
  const [formationPolitySnapshotsError, setFormationPolitySnapshotsError] = useState<string | null>(null);

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
        const [
          fetchedPolitySnapshots,
          fetchedFormationMemberships,
          fetchedPersonPolityMemberships,
        ] = await Promise.all([
          fetchedEntity.kind === 'polity'
            ? fetchReferenceEntityPolitySnapshots(entityId)
            : Promise.resolve([]),
          fetchedEntity.kind === 'polity' || fetchedEntity.kind === 'formation'
            ? fetchReferenceEntityFormationMemberships(entityId)
            : Promise.resolve([]),
          fetchedEntity.kind === 'person' || fetchedEntity.kind === 'polity'
            ? fetchReferenceEntityPersonPolityMemberships(entityId)
            : Promise.resolve([]),
        ]);

        setEntity(fetchedEntity);
        setAllEntities(fetchedEntities);
        setIncomingRelations(fetchedIncomingRelations);
        setOutgoingRelations(fetchedOutgoingRelations);
        setPolitySnapshots(fetchedPolitySnapshots);
        setFormationPolitySnapshotCache({});
        setFormationMemberships(fetchedFormationMemberships);
        setPersonPolityMemberships(fetchedPersonPolityMemberships);
        setPolitySnapshotsError(null);
        setFormationMembershipsError(null);
        setPersonPolityMembershipsError(null);
        setFormationPolitySnapshotsError(null);
        setFormState(toFormState(fetchedEntity));
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load reference entity.');
        setPolitySnapshots([]);
        setFormationPolitySnapshotCache({});
        setFormationMemberships([]);
        setPersonPolityMemberships([]);
        setPolitySnapshotsError('Failed to load atlas snapshots.');
        setFormationMembershipsError('Failed to load formation memberships.');
        setPersonPolityMembershipsError('Failed to load person polity memberships.');
        setFormationPolitySnapshotsError('Failed to load member polity snapshots.');
      } finally {
        setLoading(false);
      }
    };

    loadEntity();
  }, [entityId]);

  const isBuiltInPolity = entity ? isBuiltInPolityReferenceEntity(entity) : false;
  const editableKindOptions = useMemo(() => {
    if (!entity) return primaryKindOptions;
    if (isBuiltInPolity) return ['polity'] as ReferenceEntityKind[];

    return primaryKindOptions;
  }, [entity, isBuiltInPolity]);
  const metadataEntries = useMemo(
    () => (entity?.metadata ? Object.entries(entity.metadata) : []),
    [entity?.metadata]
  );
  const externalLink =
    typeof entity?.metadata?.link === 'string' && entity.metadata.link
      ? entity.metadata.link
      : typeof entity?.metadata?.atlasSourceUrl === 'string' && entity.metadata.atlasSourceUrl
        ? entity.metadata.atlasSourceUrl
      : null;
  const entityImageUrl =
    typeof entity?.metadata?.atlasImageUrl === 'string' && entity.metadata.atlasImageUrl
      ? entity.metadata.atlasImageUrl
      : null;
  const displayMetadataEntries = useMemo(
    () =>
      metadataEntries.filter(
        ([key]) =>
          key !== 'link' &&
          key !== 'atlasSourceUrl' &&
          key !== 'atlasImageUrl' &&
          key !== 'builtIn' &&
          key !== 'atlasSource' &&
          key !== 'polityImportKey' &&
          key !== 'importedSnapshotCount'
      ),
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
  const formationUi = useMemo(
    () => getFormationSubtypeUi(entity?.kind === 'formation' ? entity.formationSubtype : undefined),
    [entity?.formationSubtype, entity?.kind]
  );
  const structurePreset = useMemo(() => {
    if (!entity) return entityStructurePresets.person;
    if (entity.kind !== 'formation') return entityStructurePresets[entity.kind];

    return {
      helperText: formationUi.helperText,
      modes: [
        {
          id: 'broader-formation',
          label: formationUi.broaderModeLabel,
          description: formationUi.broaderModeDescription,
          allowedRelationTypes: ['part_of'],
          defaultRelationType: 'part_of',
          notePlaceholder: 'Optional note about this broader historical frame',
          targetPrompt: 'Choose another formation',
          targetKinds: ['formation'],
        },
        {
          id: 'parallel-formation',
          label: formationUi.parallelModeLabel,
          description: formationUi.parallelModeDescription,
          allowedRelationTypes: ['related_to', 'influenced_by'],
          defaultRelationType: 'related_to',
          notePlaceholder: 'Optional note about this parallel formation',
          targetPrompt: 'Choose another formation',
          targetKinds: ['formation'],
        },
      ],
    } satisfies EntityStructurePreset;
  }, [entity, formationUi]);
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
  const selectablePolities = useMemo(
    () =>
      [...allEntities]
        .filter((candidate) => candidate.id !== entity?.id && candidate.kind === 'polity')
        .sort((left, right) => left.title.localeCompare(right.title) || left.id - right.id),
    [allEntities, entity?.id]
  );
  const formationMembershipPolityEntries = useMemo(
    () =>
      formationMemberships.filter(
        (membership) => typeof membership.polityEntityId === 'number'
      ),
    [formationMemberships]
  );
  const polityFormationEntries = useMemo(
    () =>
      formationMemberships.filter(
        (membership) => typeof membership.formationEntityId === 'number'
      ),
    [formationMemberships]
  );
  useEffect(() => {
    if (entity?.kind !== 'formation') {
      setFormationPolitySnapshotCache({});
      setFormationPolitySnapshotsError(null);
      return;
    }

    const polityIds = formationMembershipPolityEntries
      .map((membership) => membership.polityEntityId)
      .filter((value): value is number => Number.isInteger(value) && value > 0);
    const missingIds = polityIds.filter((polityId) => !formationPolitySnapshotCache[polityId]);

    if (missingIds.length === 0) {
      setFormationPolitySnapshotsError(null);
      return;
    }

    let cancelled = false;

    const loadSnapshots = async () => {
      try {
        const entries = await Promise.all(
          missingIds.map(async (polityId) => [polityId, await fetchReferenceEntityPolitySnapshots(polityId)] as const)
        );
        if (cancelled) return;

        setFormationPolitySnapshotCache((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
        setFormationPolitySnapshotsError(null);
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError);
          setFormationPolitySnapshotsError('Failed to load member polity snapshots.');
        }
      }
    };

    void loadSnapshots();

    return () => {
      cancelled = true;
    };
  }, [entity?.kind, formationMembershipPolityEntries, formationPolitySnapshotCache]);
  const personMembershipPolityEntries = useMemo(
    () =>
      personPolityMemberships.filter(
        (membership) => typeof membership.polityEntityId === 'number'
      ),
    [personPolityMemberships]
  );
  const polityPersonMembershipEntries = useMemo(
    () =>
      personPolityMemberships.filter(
        (membership) => typeof membership.personEntityId === 'number'
      ),
    [personPolityMemberships]
  );

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
    const subjectCoverage = subjectRelations.map((relation) =>
      createContextEntry(relation, {
        sourceLabel: 'subject',
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
          'subject-links',
          'Subject links',
          'Subject-level links that still point here.',
          'No subject links point here yet.',
          subjectCoverage
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
        'subject-links',
        'Subject links',
        'Subject-level links that still point here.',
        'No subject links point here yet.',
        subjectCoverage
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
    const influencedBy = outgoingInfluencedBy;
    const influences = incomingInfluencedBy;
    const peerLinks = [...outgoingRelatedTo, ...incomingRelatedTo];

    const usedEntryKeys = new Set<string>(
      [
        ...containedScope,
        ...broaderContainers,
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
          'formation-links',
          'Formation links',
          'Broader formations explicitly linked to this person.',
          'No broader formations are linked yet.',
          broaderContainers
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
          `Formation links for this ${entity.kind}.`,
          'No broader formation links yet.',
          broaderContainers
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          'Peer polities linked through influence or affinity.',
          'No peer links recorded yet.',
          [...peerLinks, ...influencedBy, ...influences]
        ),
      ]);
    }

    if (entity?.kind === 'formation') {
      return finalizeGroups([
        buildStructureGroup(
          'broader-formations',
          'Broader formations',
          'Larger historical formations that this formation belongs to.',
          'No broader formations recorded yet.',
          broaderContainers
        ),
        buildStructureGroup(
          'peer-links',
          'Peer links',
          'Related or influencing formations and adjacent atlas links.',
          'No peer links recorded yet.',
          [...peerLinks, ...influencedBy, ...influences]
        ),
      ]);
    }
    return finalizeGroups([]);
  }, [entity?.kind, incomingEntityRelations, outgoingStructureRelations]);
  const topicContextCount = topicRelations.length + subjectRelations.length;
  const structureLinkCount = outgoingStructureRelations.length + incomingEntityRelations.length;
  const politySnapshotYears = useMemo(
    () => politySnapshots.map((snapshot) => snapshot.snapshotYear).sort((left, right) => left - right),
    [politySnapshots]
  );
  const formationSnapshotYears = useMemo(
    () =>
      [...new Set(
        Object.values(formationPolitySnapshotCache)
          .flat()
          .map((snapshot) => snapshot.snapshotYear)
      )].sort((left, right) => left - right),
    [formationPolitySnapshotCache]
  );
  useEffect(() => {
    const availableYears =
      entity?.kind === 'polity'
        ? politySnapshotYears
        : entity?.kind === 'formation'
          ? formationSnapshotYears
          : [];

    if (availableYears.length === 0) {
      if (atlasFocusYear !== null) {
        setAtlasFocusYear(null);
      }
      return;
    }

    if (atlasFocusYear !== null && availableYears.includes(atlasFocusYear)) {
      return;
    }

    setAtlasFocusYear(resolveAtlasFocusYear(availableYears, entity));
  }, [atlasFocusYear, entity, formationSnapshotYears, politySnapshotYears]);
  const focusedPolitySnapshot = useMemo(() => {
    if (entity?.kind !== 'polity' || atlasFocusYear === null) return null;
    return politySnapshots.find((snapshot) => snapshot.snapshotYear === atlasFocusYear) ?? null;
  }, [atlasFocusYear, entity?.kind, politySnapshots]);
  const focusedFormationVisibleMemberships = useMemo(() => {
    if (entity?.kind !== 'formation' || atlasFocusYear === null) return [];

    return formationMembershipPolityEntries
      .map((membership) => ({
        membership,
        snapshot:
          (formationPolitySnapshotCache[membership.polityEntityId] ?? []).find(
            (snapshot) => snapshot.snapshotYear === atlasFocusYear
          ) ?? null,
      }))
      .filter(
        (entry) => entry.snapshot && isMembershipVisibleInYear(entry.membership, atlasFocusYear)
      );
  }, [atlasFocusYear, entity?.kind, formationMembershipPolityEntries, formationPolitySnapshotCache]);
  const focusedFormationHistoricalMemberships = useMemo(() => {
    if (entity?.kind !== 'formation' || atlasFocusYear === null) return [];

    return formationMembershipPolityEntries
      .map((membership) => ({
        membership,
        snapshot:
          (formationPolitySnapshotCache[membership.polityEntityId] ?? []).find(
            (snapshot) => snapshot.snapshotYear === atlasFocusYear
          ) ?? null,
      }))
      .filter(
        (entry) => entry.snapshot && !isMembershipVisibleInYear(entry.membership, atlasFocusYear)
      );
  }, [atlasFocusYear, entity?.kind, formationMembershipPolityEntries, formationPolitySnapshotCache]);
  const focusedFormationMissingSnapshotMemberships = useMemo(() => {
    if (entity?.kind !== 'formation' || atlasFocusYear === null) return [];

    return formationMembershipPolityEntries.filter(
      (membership) =>
        !(formationPolitySnapshotCache[membership.polityEntityId] ?? []).some(
          (snapshot) => snapshot.snapshotYear === atlasFocusYear
        )
    );
  }, [atlasFocusYear, entity?.kind, formationMembershipPolityEntries, formationPolitySnapshotCache]);
  const atlasHref = useMemo(() => {
    if (entity?.kind === 'formation' && atlasFocusYear !== null) {
      return `/world-history?year=${atlasFocusYear}&formation=${entity.id}`;
    }
    if (entity?.kind === 'polity' && atlasFocusYear !== null) {
      return `/world-history?year=${atlasFocusYear}`;
    }
    return '/world-history';
  }, [atlasFocusYear, entity]);
  const overviewCards = useMemo<OverviewCard[]>(() => {
    if (!entity) return [];

    const chronologyCard: OverviewCard = {
      key: 'chronology',
      eyebrow: 'Chronology',
      value: formatTimespan(entity),
      meta:
        entity.kind === 'formation' && entity.formationSubtype
          ? formationSubtypeLabels[entity.formationSubtype]
          : isBuiltInPolity
            ? 'Built-in atlas record'
            : 'Native atlas record',
      hint: 'The main time span currently recorded for this entity.',
    };

    if (entity.kind === 'person') {
      const formationLinks = getGroupByKey(structureGroups, 'formation-links');
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
          key: 'polities',
          eyebrow: 'Polities',
          value: `${personMembershipPolityEntries.length} memberships`,
          meta: personMembershipPolityEntries.length
            ? personMembershipPolityEntries
                .slice(0, 2)
                .map((membership) => membership.polityTitle || 'Untitled polity')
                .join(' · ')
            : formationLinks?.entries.length
              ? `${formationLinks.entries.length} formation links`
              : 'No polity memberships yet.',
          hint: 'Direct polity memberships attached to this person.',
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
      const firstSnapshotYear = politySnapshotYears[0];
      const lastSnapshotYear = politySnapshotYears[politySnapshotYears.length - 1];
      const snapshotRange =
        politySnapshotYears.length === 0
          ? 'No imported atlas snapshots yet.'
          : politySnapshotYears.length === 1
            ? `${formatYear(firstSnapshotYear)}`
            : `${formatYear(firstSnapshotYear)} - ${formatYear(lastSnapshotYear)}`;

      return [
        chronologyCard,
        {
          key: 'atlas-snapshots',
          eyebrow: 'Atlas Snapshots',
          value: `${politySnapshots.length} snapshots`,
          meta: snapshotRange,
          hint: 'Year-specific geometries imported from the historical basemap dataset.',
        },
        {
          key: 'atlas-focus',
          eyebrow: 'Atlas Focus',
          value: atlasFocusYear !== null ? formatYear(atlasFocusYear) ?? 'No focus year' : 'No focus year',
          meta: focusedPolitySnapshot
            ? `${focusedPolitySnapshot.titleAtSnapshot}${focusedPolitySnapshot.parentLabel ? ` · ${focusedPolitySnapshot.parentLabel}` : ''}`
            : 'Choose a snapshot year below to inspect one imported atlas state.',
          hint: 'The currently focused atlas snapshot year for this polity.',
        },
        {
          key: 'people',
          eyebrow: 'People Here',
          value: `${polityPersonMembershipEntries.length} memberships`,
          meta: polityPersonMembershipEntries.length
            ? polityPersonMembershipEntries
                .slice(0, 2)
                .map((membership) => membership.personTitle || 'Untitled person')
                .join(' · ')
            : containedScope?.entries.length
              ? `${containedScope.entries.length} contained scope links`
              : 'No people assigned yet.',
          hint: `People explicitly placed inside this ${entity.kind}.`,
        },
        {
          key: 'placed-in',
          eyebrow: 'Placed In',
          value: `${placedIn?.entries.length ?? 0} links`,
          meta: getGroupPreview(placedIn, 'No broader formation links yet.'),
          hint: `Broader formation links for this ${entity.kind}.`,
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

    if (entity.kind === 'formation') {
      const broaderFormations = getGroupByKey(structureGroups, 'broader-formations');

      return [
        chronologyCard,
        {
          key: 'membership',
          eyebrow: formationUi.membershipEyebrow,
          value: `${formationMembershipPolityEntries.length} ${formationUi.membershipCountLabel}`,
          meta: formationMembershipPolityEntries.length
            ? formationMembershipPolityEntries
                .slice(0, 2)
                .map((membership) => membership.polityTitle || 'Untitled polity')
                .join(' · ')
            : formationUi.membershipMetaEmpty,
          hint: formationUi.membershipHint,
        },
        {
          key: 'atlas-focus',
          eyebrow: 'Atlas Focus',
          value: atlasFocusYear !== null ? formatYear(atlasFocusYear) ?? 'No focus year' : 'No focus year',
          meta:
            atlasFocusYear === null
              ? 'Choose a member snapshot year below to inspect this formation in atlas time.'
              : `${focusedFormationVisibleMemberships.length} visible now · ${focusedFormationHistoricalMemberships.length} broader history`,
          hint: 'The currently focused atlas year for this formation.',
        },
        {
          key: 'broader-formations',
          eyebrow: formationUi.broaderTitle,
          value: `${broaderFormations?.entries.length ?? 0} links`,
          meta: getGroupPreview(broaderFormations, 'No broader formation links yet.'),
          hint: formationUi.broaderHint,
        },
        {
          key: 'coverage',
          eyebrow: 'Coverage',
          value: `${topicContextCount} topics`,
          meta: `${itemRelations.length} linked items`,
          hint: 'How many topics and items currently use this formation in the atlas.',
        },
      ];
    }
    return [chronologyCard];
  }, [
    authoredWorks.length,
    entity,
    itemRelations.length,
    formationMembershipPolityEntries,
    isBuiltInPolity,
    personMembershipPolityEntries,
    politySnapshotYears,
    politySnapshots.length,
    atlasFocusYear,
    focusedFormationHistoricalMemberships.length,
    focusedFormationVisibleMemberships.length,
    focusedPolitySnapshot,
    polityPersonMembershipEntries,
    relatedItems.length,
    structureGroups,
    topicContextCount,
    formationUi,
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
      formationSubtype: formState.kind === 'formation' ? formState.formationSubtype : null,
      summary: formState.summary.trim(),
      description: formState.description.trim(),
    };

    if (!isBuiltInPolity) {
      payload.kind = formState.kind;
      payload.title = formState.title.trim();
      payload.startYear = parseYearInput(formState.startYear);
      payload.endYear = parseYearInput(formState.endYear);
    }

    try {
      const updatedEntity = await updateReferenceEntity(entity.id, payload);
      setEntity(updatedEntity);
      setFormState(toFormState(updatedEntity));
      if (updatedEntity.kind !== 'polity') {
        setPolitySnapshots([]);
      }
      if (updatedEntity.kind !== 'formation' && updatedEntity.kind !== 'polity') {
        setFormationMemberships([]);
      }
      if (updatedEntity.kind !== 'person' && updatedEntity.kind !== 'polity') {
        setPersonPolityMemberships([]);
      }
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

  const handleCreateFormationMembership = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entity || entity.kind !== 'formation' || !formationMembershipForm.polityEntityId) return;

    setSavingFormationMembership(true);
    setError(null);

    try {
      const membership = await createFormationMembership(entity.id, {
        polityEntityId: Number(formationMembershipForm.polityEntityId),
        startYear: parseYearInput(formationMembershipForm.startYear) ?? undefined,
        endYear: parseYearInput(formationMembershipForm.endYear) ?? undefined,
        note: formationMembershipForm.note.trim() || undefined,
      });

      startTransition(() => {
        setFormationMemberships((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === membership.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = membership;
            return next;
          }
          return [...current, membership];
        });
      });

      setFormationMembershipForm({
        polityEntityId: '',
        startYear: '',
        endYear: '',
        note: '',
      });
    } catch (membershipError) {
      console.error(membershipError);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Failed to create formation membership.'
      );
    } finally {
      setSavingFormationMembership(false);
    }
  };

  const handleCreatePersonPolityMembership = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entity || entity.kind !== 'person' || !personPolityMembershipForm.polityEntityId) return;

    setSavingPersonPolityMembership(true);
    setError(null);

    try {
      const membership = await createPersonPolityMembership(entity.id, {
        polityEntityId: Number(personPolityMembershipForm.polityEntityId),
        startYear: parseYearInput(personPolityMembershipForm.startYear) ?? undefined,
        endYear: parseYearInput(personPolityMembershipForm.endYear) ?? undefined,
        note: personPolityMembershipForm.note.trim() || undefined,
      });

      startTransition(() => {
        setPersonPolityMemberships((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === membership.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = membership;
            return next;
          }
          return [...current, membership];
        });
      });

      setPersonPolityMembershipForm({
        polityEntityId: '',
        startYear: '',
        endYear: '',
        note: '',
      });
    } catch (membershipError) {
      console.error(membershipError);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Failed to create person polity membership.'
      );
    } finally {
      setSavingPersonPolityMembership(false);
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

  const handleDeleteFormationMembership = async (membershipId: number) => {
    if (!entity || entity.kind !== 'formation') return;

    try {
      await deleteFormationMembership(entity.id, membershipId);
      startTransition(() => {
        setFormationMemberships((current) =>
          current.filter((membership) => membership.id !== membershipId)
        );
      });
    } catch (membershipError) {
      console.error(membershipError);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Failed to delete formation membership.'
      );
    }
  };

  const handleDeletePersonPolityMembership = async (
    membership: PersonPolityMembershipDetail
  ) => {
    try {
      await deletePersonPolityMembership(membership.personEntityId, membership.id);
      startTransition(() => {
        setPersonPolityMemberships((current) =>
          current.filter((entry) => entry.id !== membership.id)
        );
      });
    } catch (membershipError) {
      console.error(membershipError);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Failed to delete person polity membership.'
      );
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
              (entity.kind === 'formation'
                ? `${formationUi.workspaceLabel} records collect built-in polities into one historical frame inside the atlas.`
                : 'This page holds the encyclopedic record for one person, polity, or formation in the atlas.')}
          </p>
          <div className="reference-entity-hero-meta">
            <span>{formatTimespan(entity)}</span>
            {entity.kind === 'formation' && entity.formationSubtype ? (
              <span>{formationSubtypeLabels[entity.formationSubtype]}</span>
            ) : null}
            {entity.kind === 'polity' ? <span>{politySnapshots.length} atlas snapshots</span> : null}
            <span>
              {authoredWorks.length || itemRelations.length}{' '}
              {entity.kind === 'person' ? 'item links' : 'linked items'}
            </span>
            <span>{topicContextCount} topic links</span>
            <span>{structureLinkCount} entity links</span>
            <span>Updated {formatDate(entity.updatedAt)}</span>
            {isBuiltInPolity ? (
              <span>Built-in atlas record</span>
            ) : (
              <span>Primary atlas record</span>
            )}
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
                    <select
                      id="kind"
                      name="kind"
                      value={formState.kind}
                      onChange={handleChange}
                      disabled={isBuiltInPolity}
                    >
                      {editableKindOptions.map((kind) => (
                        <option key={kind} value={kind}>
                          {kindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formState.kind === 'formation' ? (
                    <div className="reference-entity-field">
                      <label htmlFor="formationSubtype">Formation Type</label>
                      <select
                        id="formationSubtype"
                        name="formationSubtype"
                        value={formState.formationSubtype}
                        onChange={handleChange}
                      >
                        {formationSubtypeOptions.map((subtype) => (
                          <option key={subtype} value={subtype}>
                            {formationSubtypeLabels[subtype]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="reference-entity-field">
                    <label htmlFor="title">Title</label>
                    <input
                      id="title"
                      name="title"
                      value={formState.title}
                      onChange={handleChange}
                      required
                      disabled={isBuiltInPolity}
                    />
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
                      disabled={isBuiltInPolity}
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
                      disabled={isBuiltInPolity}
                    />
                  </div>
                </div>

                {isBuiltInPolity ? (
                  <div className="reference-entity-note">
                    <strong>Built-in atlas identity</strong>
                    <span>
                      This polity keeps its name and chronology from the historical basemap import. Use this page
                      to enrich its summary, description, links, and contextual notes.
                    </span>
                  </div>
                ) : null}

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
                  {!isBuiltInPolity ? (
                    <button
                      type="button"
                      className="reference-entity-danger"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Removing...' : 'Remove entity'}
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          ) : null}
        </div>
        {entityImageUrl ? (
          <figure className="reference-entity-hero-media">
            <img src={entityImageUrl} alt={entity.title} />
          </figure>
        ) : null}
      </section>

      {error ? <div className="reference-entity-error">{error}</div> : null}

      <div className="reference-entity-main">
          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Atlas Context</span>
                <h2>
                  {getAtlasSectionLabel(entity.kind)}
                  <EntityHint text="Topics and subject links that currently point to this entity." />
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

          {entity.kind === 'person' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Membership</span>
                  <h2>
                    Polity memberships
                    <EntityHint text="Direct polity memberships place this person inside built-in atlas polities. Use the structure section for broader formations and influence links." />
                    <span className="reference-entity-count-badge">{personMembershipPolityEntries.length}</span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="reference-entity-secondary-button"
                  onClick={() => setShowPersonPolityMembershipComposer((current) => !current)}
                >
                  {showPersonPolityMembershipComposer ? 'Close' : 'Manage polities'}
                </button>
              </div>

              {showPersonPolityMembershipComposer ? (
                <section className="reference-entity-inline-panel">
                  <form className="reference-entity-form" onSubmit={handleCreatePersonPolityMembership}>
                    <div className="reference-entity-grid-inline">
                      <div className="reference-entity-field">
                        <label htmlFor="person-polity-membership-polity">Polity</label>
                        <select
                          id="person-polity-membership-polity"
                          value={personPolityMembershipForm.polityEntityId}
                          onChange={(event) =>
                            setPersonPolityMembershipForm((current) => ({
                              ...current,
                              polityEntityId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choose a polity</option>
                          {selectablePolities.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="reference-entity-field">
                        <label htmlFor="person-polity-membership-start">Start Year</label>
                        <input
                          id="person-polity-membership-start"
                          type="number"
                          value={personPolityMembershipForm.startYear}
                          onChange={(event) =>
                            setPersonPolityMembershipForm((current) => ({
                              ...current,
                              startYear: event.target.value,
                            }))
                          }
                          placeholder="-323"
                        />
                      </div>
                      <div className="reference-entity-field">
                        <label htmlFor="person-polity-membership-end">End Year</label>
                        <input
                          id="person-polity-membership-end"
                          type="number"
                          value={personPolityMembershipForm.endYear}
                          onChange={(event) =>
                            setPersonPolityMembershipForm((current) => ({
                              ...current,
                              endYear: event.target.value,
                            }))
                          }
                          placeholder="1453"
                        />
                      </div>
                    </div>

                    <div className="reference-entity-field">
                      <label htmlFor="person-polity-membership-note">Note</label>
                      <input
                        id="person-polity-membership-note"
                        value={personPolityMembershipForm.note}
                        onChange={(event) =>
                          setPersonPolityMembershipForm((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        placeholder="Optional note about this polity membership"
                      />
                    </div>

                    <div className="reference-entity-inline-actions">
                      <button
                        type="submit"
                        disabled={savingPersonPolityMembership || !personPolityMembershipForm.polityEntityId}
                      >
                        {savingPersonPolityMembership ? 'Adding…' : 'Add polity'}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {personPolityMembershipsError ? (
                <div className="reference-entity-error">{personPolityMembershipsError}</div>
              ) : personMembershipPolityEntries.length === 0 ? (
                <div className="reference-entity-empty">
                  No polity memberships have been recorded for this person yet.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  {personMembershipPolityEntries.map((membership) => (
                    <article key={membership.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>Polity</span>
                            {membership.startYear !== undefined || membership.endYear !== undefined ? (
                              <span>
                                {`${membership.startYear !== undefined ? formatYear(membership.startYear) : 'Open'} - ${membership.endYear !== undefined ? formatYear(membership.endYear) : 'Open'}`}
                              </span>
                            ) : null}
                          </div>
                          {membership.politySlug ? (
                            <Link to={`/entities/${membership.polityEntityId}`} className="reference-entity-card-link">
                              <h3>{membership.polityTitle || 'Untitled polity'}</h3>
                            </Link>
                          ) : (
                            <h3>{membership.polityTitle || 'Untitled polity'}</h3>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeletePersonPolityMembership(membership)}>
                          Delete
                        </button>
                      </div>
                      {membership.note ? <p>{membership.note}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {entity.kind === 'formation' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Atlas Focus</span>
                  <h2>
                    Formation at a year
                    <EntityHint text="Inspect which member polities are visible at one atlas year without leaving this page." />
                    <span className="reference-entity-count-badge">{formationSnapshotYears.length}</span>
                  </h2>
                </div>
                <Link to={atlasHref} className="reference-entity-secondary-button">
                  Open on atlas
                </Link>
              </div>

              {formationPolitySnapshotsError ? (
                <div className="reference-entity-error">{formationPolitySnapshotsError}</div>
              ) : formationSnapshotYears.length === 0 ? (
                <div className="reference-entity-empty">
                  No member polity snapshots are loaded for this formation yet.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  <div className="reference-entity-year-strip">
                    {formationSnapshotYears.map((snapshotYear) => (
                      <button
                        key={snapshotYear}
                        type="button"
                        className={`reference-entity-year-chip${atlasFocusYear === snapshotYear ? ' is-active' : ''}`}
                        onClick={() => setAtlasFocusYear(snapshotYear)}
                      >
                        {formatYear(snapshotYear)}
                      </button>
                    ))}
                  </div>
                  <article className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{atlasFocusYear !== null ? formatYear(atlasFocusYear) : 'No focus year'}</span>
                          <span>{focusedFormationVisibleMemberships.length} visible</span>
                          {focusedFormationHistoricalMemberships.length > 0 ? (
                            <span>{focusedFormationHistoricalMemberships.length} broader history</span>
                          ) : null}
                          {focusedFormationMissingSnapshotMemberships.length > 0 ? (
                            <span>{focusedFormationMissingSnapshotMemberships.length} without snapshot</span>
                          ) : null}
                        </div>
                        <h3>{entity.title}</h3>
                      </div>
                    </div>
                    {focusedFormationVisibleMemberships.length === 0 ? (
                      <div className="reference-entity-empty">
                        No member polities are visible at this atlas year.
                      </div>
                    ) : (
                      <div className="reference-entity-card-grid">
                        {focusedFormationVisibleMemberships.map(({ membership, snapshot }) => (
                          <div key={`focused-formation-${membership.id}`}>
                            <strong>{membership.polityTitle || snapshot?.titleAtSnapshot || 'Untitled polity'}</strong>
                            <span>
                              {membership.startYear !== undefined || membership.endYear !== undefined
                                ? `${membership.startYear !== undefined ? formatYear(membership.startYear) : 'Open'} - ${membership.endYear !== undefined ? formatYear(membership.endYear) : 'Open'}`
                                : 'Visible in formation at this year'}
                            </span>
                            <span>{snapshot?.parentLabel || 'Standalone polity'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}
            </section>
          ) : null}

          {entity.kind === 'formation' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">{formationUi.membershipEyebrow}</span>
                  <h2>
                    {formationUi.membershipSectionTitle}
                    <EntityHint text={formationUi.membershipSectionHint} />
                    <span className="reference-entity-count-badge">{formationMembershipPolityEntries.length}</span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="reference-entity-secondary-button"
                  onClick={() => setShowFormationMembershipComposer((current) => !current)}
                >
                  {showFormationMembershipComposer ? 'Close' : formationUi.membershipComposerLabel}
                </button>
              </div>

              {showFormationMembershipComposer ? (
                <section className="reference-entity-inline-panel">
                  <form className="reference-entity-form" onSubmit={handleCreateFormationMembership}>
                    <div className="reference-entity-grid-inline">
                      <div className="reference-entity-field">
                        <label htmlFor="formation-membership-polity">Polity</label>
                        <select
                          id="formation-membership-polity"
                          value={formationMembershipForm.polityEntityId}
                          onChange={(event) =>
                            setFormationMembershipForm((current) => ({
                              ...current,
                              polityEntityId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choose a polity</option>
                          {selectablePolities.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="reference-entity-field">
                        <label htmlFor="formation-membership-start">Start Year</label>
                        <input
                          id="formation-membership-start"
                          type="number"
                          value={formationMembershipForm.startYear}
                          onChange={(event) =>
                            setFormationMembershipForm((current) => ({
                              ...current,
                              startYear: event.target.value,
                            }))
                          }
                          placeholder="-323"
                        />
                      </div>
                      <div className="reference-entity-field">
                        <label htmlFor="formation-membership-end">End Year</label>
                        <input
                          id="formation-membership-end"
                          type="number"
                          value={formationMembershipForm.endYear}
                          onChange={(event) =>
                            setFormationMembershipForm((current) => ({
                              ...current,
                              endYear: event.target.value,
                            }))
                          }
                          placeholder="1453"
                        />
                      </div>
                    </div>

                    <div className="reference-entity-field">
                      <label htmlFor="formation-membership-note">Note</label>
                      <input
                        id="formation-membership-note"
                        value={formationMembershipForm.note}
                        onChange={(event) =>
                          setFormationMembershipForm((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        placeholder="Optional note about this membership"
                      />
                    </div>

                    <div className="reference-entity-inline-actions">
                      <button
                        type="submit"
                        disabled={savingFormationMembership || !formationMembershipForm.polityEntityId}
                      >
                        {savingFormationMembership ? 'Adding…' : formationUi.membershipComposerButton}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {formationMembershipsError ? (
                <div className="reference-entity-error">{formationMembershipsError}</div>
              ) : formationMembershipPolityEntries.length === 0 ? (
                <div className="reference-entity-empty">
                  {formationUi.membershipComposerEmpty}
                </div>
              ) : (
                <div className="reference-entity-stack">
                  {formationMembershipPolityEntries.map((membership) => (
                    <article key={membership.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>Polity</span>
                            {membership.startYear !== undefined || membership.endYear !== undefined ? (
                              <span>
                                {membership.startYear !== undefined || membership.endYear !== undefined
                                  ? `${membership.startYear !== undefined ? formatYear(membership.startYear) : 'Open'} - ${membership.endYear !== undefined ? formatYear(membership.endYear) : 'Open'}`
                                  : 'Undated'}
                              </span>
                            ) : null}
                          </div>
                          {membership.politySlug ? (
                            <Link to={`/entities/${membership.polityEntityId}`} className="reference-entity-card-link">
                              <h3>{membership.polityTitle || 'Untitled polity'}</h3>
                            </Link>
                          ) : (
                            <h3>{membership.polityTitle || 'Untitled polity'}</h3>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeleteFormationMembership(membership.id)}>
                          Delete
                        </button>
                      </div>
                      {membership.note ? <p>{membership.note}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {entity.kind === 'polity' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Membership</span>
                  <h2>
                    People in this polity
                    <EntityHint text="People explicitly assigned to this polity through person memberships." />
                    <span className="reference-entity-count-badge">{polityPersonMembershipEntries.length}</span>
                  </h2>
                </div>
              </div>

              {personPolityMembershipsError ? (
                <div className="reference-entity-error">{personPolityMembershipsError}</div>
              ) : polityPersonMembershipEntries.length === 0 ? (
                <div className="reference-entity-empty">
                  No people have been placed inside this polity yet.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  {polityPersonMembershipEntries.map((membership) => (
                    <article key={membership.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>Person</span>
                            {membership.startYear !== undefined || membership.endYear !== undefined ? (
                              <span>
                                {`${membership.startYear !== undefined ? formatYear(membership.startYear) : 'Open'} - ${membership.endYear !== undefined ? formatYear(membership.endYear) : 'Open'}`}
                              </span>
                            ) : null}
                          </div>
                          {membership.personSlug ? (
                            <Link to={`/entities/${membership.personEntityId}`} className="reference-entity-card-link">
                              <h3>{membership.personTitle || 'Untitled person'}</h3>
                            </Link>
                          ) : (
                            <h3>{membership.personTitle || 'Untitled person'}</h3>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeletePersonPolityMembership(membership)}>
                          Delete
                        </button>
                      </div>
                      {membership.note ? <p>{membership.note}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {entity.kind === 'polity' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Membership</span>
                  <h2>
                    Included in formations
                    <EntityHint text="Formations that explicitly include this polity." />
                    <span className="reference-entity-count-badge">{polityFormationEntries.length}</span>
                  </h2>
                </div>
              </div>

              {formationMembershipsError ? (
                <div className="reference-entity-error">{formationMembershipsError}</div>
              ) : polityFormationEntries.length === 0 ? (
                <div className="reference-entity-empty">
                  This polity is not yet included in any formation.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  {polityFormationEntries.map((membership) => (
                    <article key={membership.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>Formation</span>
                            {membership.startYear !== undefined || membership.endYear !== undefined ? (
                              <span>
                                {`${membership.startYear !== undefined ? formatYear(membership.startYear) : 'Open'} - ${membership.endYear !== undefined ? formatYear(membership.endYear) : 'Open'}`}
                              </span>
                            ) : null}
                          </div>
                          {membership.formationSlug ? (
                            <Link to={`/entities/${membership.formationEntityId}`} className="reference-entity-card-link">
                              <h3>{membership.formationTitle || 'Untitled formation'}</h3>
                            </Link>
                          ) : (
                            <h3>{membership.formationTitle || 'Untitled formation'}</h3>
                          )}
                        </div>
                        <span>{formatDate(membership.createdAt)}</span>
                      </div>
                      {membership.note ? <p>{membership.note}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

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

          {entity.kind === 'polity' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Atlas Focus</span>
                  <h2>
                    Snapshot at a year
                    <EntityHint text="Inspect one imported atlas snapshot directly from the polity page." />
                    <span className="reference-entity-count-badge">{politySnapshotYears.length}</span>
                  </h2>
                </div>
                <Link to={atlasHref} className="reference-entity-secondary-button">
                  Open on atlas
                </Link>
              </div>

              {politySnapshotsError ? (
                <div className="reference-entity-error">{politySnapshotsError}</div>
              ) : politySnapshotYears.length === 0 ? (
                <div className="reference-entity-empty">
                  No atlas snapshots have been imported for this polity yet.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  <div className="reference-entity-year-strip">
                    {politySnapshotYears.map((snapshotYear) => (
                      <button
                        key={snapshotYear}
                        type="button"
                        className={`reference-entity-year-chip${atlasFocusYear === snapshotYear ? ' is-active' : ''}`}
                        onClick={() => setAtlasFocusYear(snapshotYear)}
                      >
                        {formatYear(snapshotYear)}
                      </button>
                    ))}
                  </div>
                  {focusedPolitySnapshot ? (
                    <article className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatYear(focusedPolitySnapshot.snapshotYear)}</span>
                            <span>{focusedPolitySnapshot.source}</span>
                            {focusedPolitySnapshot.borderPrecision !== undefined ? (
                              <span>border {focusedPolitySnapshot.borderPrecision}</span>
                            ) : null}
                          </div>
                          <h3>{focusedPolitySnapshot.titleAtSnapshot}</h3>
                        </div>
                      </div>
                      <div className="reference-entity-card-grid">
                        <div>
                          <strong>Part of</strong>
                          <span>{focusedPolitySnapshot.parentLabel || 'Standalone polity'}</span>
                        </div>
                        <div>
                          <strong>Subject</strong>
                          <span>{focusedPolitySnapshot.subjectLabel || 'No subject note'}</span>
                        </div>
                        <div>
                          <strong>Updated</strong>
                          <span>{formatDate(focusedPolitySnapshot.updatedAt)}</span>
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {entity.kind === 'polity' ? (
            <section className="reference-entity-panel">
              <div className="reference-entity-section-head">
                <div>
                  <span className="reference-entity-eyebrow">Snapshots</span>
                  <h2>
                    Atlas snapshots
                    <EntityHint text="Year-specific basemap geometries imported for this built-in polity." />
                    <span className="reference-entity-count-badge">{politySnapshots.length}</span>
                  </h2>
                </div>
              </div>

              {politySnapshotsError ? (
                <div className="reference-entity-error">{politySnapshotsError}</div>
              ) : politySnapshots.length === 0 ? (
                <div className="reference-entity-empty">
                  No atlas snapshots have been imported for this polity yet.
                </div>
              ) : (
                <div className="reference-entity-stack">
                  {politySnapshots.map((snapshot) => (
                    <article key={snapshot.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatYear(snapshot.snapshotYear)}</span>
                            <span>{snapshot.source}</span>
                            {snapshot.borderPrecision !== undefined ? (
                              <span>border {snapshot.borderPrecision}</span>
                            ) : null}
                          </div>
                          <h3>{snapshot.titleAtSnapshot}</h3>
                        </div>
                        <span>{formatDate(snapshot.updatedAt)}</span>
                      </div>
                      <div className="reference-entity-card-grid">
                        <div>
                          <strong>Part of</strong>
                          <span>{snapshot.parentLabel || 'Standalone polity'}</span>
                        </div>
                        <div>
                          <strong>Subject</strong>
                          <span>{snapshot.subjectLabel || 'No subject note'}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

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
