import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeRelationEntityType,
  KnowledgeItemStatus,
  KnowledgeNote,
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  KnowledgeReview,
  KnowledgeTask,
  KnowledgeTaskStatus,
  ReferenceEntity,
  SubjectSummary as TopicSummary,
  TopicSummary as StudyTopicSummary,
  UpdateKnowledgeItem,
} from '@enzyklopaedie/shared';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  assignTopicToKnowledgeItem as assignStudyTopicToKnowledgeItem,
  createKnowledgeNote,
  createKnowledgeRelation,
  createKnowledgeReview,
  createKnowledgeTask,
  createTopic as createStudyTopic,
  deleteKnowledgeNote,
  deleteKnowledgeRelation,
  deleteKnowledgeReview,
  deleteKnowledgeTask,
  fetchKnowledgeItem,
  fetchKnowledgeItems,
  fetchKnowledgeItemTopics as fetchKnowledgeItemStudyTopics,
  fetchKnowledgeNotes,
  fetchKnowledgeRelations,
  fetchKnowledgeReviews,
  fetchKnowledgeTasks,
  fetchReferenceEntities,
  fetchSubjects as fetchTopics,
  fetchTopicRelations,
  fetchTopics as fetchStudyTopics,
  removeTopicFromKnowledgeItem as removeStudyTopicFromKnowledgeItem,
  updateKnowledgeItem,
  updateKnowledgeTask,
} from '../api';
import './ItemDetailPage.css';

const itemStatusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];
const taskStatusOptions: KnowledgeTaskStatus[] = ['todo', 'doing', 'done', 'archived'];

type ItemDetailLocationState = {
  returnTo?: string;
};

type ItemRecordFormKind = 'book' | 'lecture';
type ItemRelationPreset = {
  allowedRelationTypes: KnowledgeRelationType[];
  defaultRelationType: KnowledgeRelationType;
  helperText: string;
  notePlaceholder: string;
  targetPrompt: string;
};
type ItemRecordPreset = {
  creatorLabel: string;
  extraFieldLabel: string;
  extraFieldName: 'pageCount' | 'durationMinutes';
  extraFieldPlaceholder: string;
  helperText: string;
  sourceLabel: string;
  sourcePlaceholder: string;
  yearLabel: string;
};

const itemRecordPresets: Record<ItemRecordFormKind, ItemRecordPreset> = {
  book: {
    creatorLabel: 'Author',
    extraFieldLabel: 'Pages',
    extraFieldName: 'pageCount',
    extraFieldPlaceholder: '320',
    helperText:
      'Edit the bibliographic record for written material here. Formal provenance should live in created_by relations; the creator text field is only a legacy/import fallback.',
    sourceLabel: 'Publisher / Journal / Collection',
    sourcePlaceholder: 'Publisher, journal, archive...',
    yearLabel: 'Published Year',
  },
  lecture: {
    creatorLabel: 'Speaker / Lecturer / Creator',
    extraFieldLabel: 'Duration (minutes)',
    extraFieldName: 'durationMinutes',
    extraFieldPlaceholder: '90',
    helperText:
      'Edit the media record here. Formal provenance should live in created_by relations; the creator text field is only a legacy/import fallback.',
    sourceLabel: 'Platform / Channel / Series',
    sourcePlaceholder: 'Channel, platform, course series...',
    yearLabel: 'Release Year',
  },
};

const relationKindOrder: ReferenceEntity['kind'][] = [
  'person',
  'polity',
  'formation',
];

const atlasKindOrder: ReferenceEntity['kind'][] = ['formation', 'polity', 'person'];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const formatRelationType = (value: KnowledgeRelationType) => value.replace(/_/g, ' ');
const formatEntityType = (value: KnowledgeRelationEntityType) => value.replace(/_/g, ' ');

const formatYear = (value?: number) => {
  if (value === undefined) return null;
  if (value < 0) return `${Math.abs(value)} BCE`;
  if (value > 0) return `${value} CE`;
  return 'Year 0';
};

const readNumericMetadata = (item: KnowledgeItem, key: 'pageCount' | 'durationMinutes') => {
  const value = item.metadata?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getItemFormKind = (item: Pick<KnowledgeItem, 'kind'>): ItemRecordFormKind =>
  item.kind === 'book' ? 'book' : 'lecture';
const getItemFormLabel = (item: KnowledgeItem) =>
  item.kind === 'book' ? 'Written work' : 'Lecture / media';

const getItemRelationPreset = (
  itemFormKind: ItemRecordFormKind,
  targetType: KnowledgeRelationEntityType,
  targetEntityKind?: ReferenceEntity['kind']
): ItemRelationPreset => {
  if (targetType === 'knowledge_item') {
    return {
      allowedRelationTypes: ['references', 'related_to', 'influenced_by', 'part_of'],
      defaultRelationType: itemFormKind === 'book' ? 'references' : 'related_to',
      helperText:
        itemFormKind === 'book'
          ? 'Use item-to-item links for citations, comparisons, or conceptual continuations between works.'
          : 'Use item-to-item links for companion lectures, cited resources, or closely related media.',
      notePlaceholder: 'Optional note about how these items connect',
      targetPrompt: 'Choose another item',
    };
  }

  if (targetEntityKind === 'person') {
    return {
      allowedRelationTypes: ['created_by', 'influenced_by', 'related_to'],
      defaultRelationType: 'created_by',
      helperText:
        itemFormKind === 'book'
          ? 'People usually enter through provenance. Use created_by for the author, or influenced_by for a key figure behind the work.'
          : 'People usually enter through provenance. Use created_by for the speaker or creator, or influenced_by for a figure behind the resource.',
      notePlaceholder: 'Optional note about authorship or influence',
      targetPrompt: 'Choose a person',
    };
  }

  if (targetEntityKind === 'polity') {
    return {
      allowedRelationTypes: ['located_in', 'about', 'related_to'],
      defaultRelationType: 'located_in',
      helperText:
        'Use polities for geographic or political setting. Choose about only when the polity is itself the subject matter.',
      notePlaceholder: 'Optional note about this location or polity',
      targetPrompt: 'Choose a polity',
    };
  }

  if (targetEntityKind === 'formation') {
    return {
      allowedRelationTypes: ['about', 'related_to', 'influenced_by'],
      defaultRelationType: 'about',
      helperText:
        'Formations usually enter as higher-order historical context or as an explicit subject of study.',
      notePlaceholder: 'Optional note about this formation context',
      targetPrompt: 'Choose a formation',
    };
  }

  return {
    allowedRelationTypes: ['created_by', 'about', 'during', 'located_in', 'related_to', 'influenced_by'],
    defaultRelationType: 'created_by',
    helperText:
      'Choose the entity first. The relation options will narrow once the target is specific.',
    notePlaceholder: 'Optional note about this context',
    targetPrompt: 'Choose a person, polity, or formation',
  };
};

const getItemRecordDetail = (item: KnowledgeItem) => {
  const pageCount = readNumericMetadata(item, 'pageCount');
  if (pageCount) return `${pageCount} pages`;

  const durationMinutes = readNumericMetadata(item, 'durationMinutes');
  if (durationMinutes) return `${durationMinutes} min`;

  return null;
};

const toRecordFormState = (item: KnowledgeItem) => ({
  title: item.title,
  creator: item.creator || '',
  sourceName: item.sourceName || '',
  sourceUrl: item.sourceUrl || '',
  summary: item.summary || '',
  publishedYear: item.publishedYear === undefined ? '' : String(item.publishedYear),
  pageCount: readNumericMetadata(item, 'pageCount')?.toString() || '',
  durationMinutes: readNumericMetadata(item, 'durationMinutes')?.toString() || '',
});

const parseIntegerInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
};

const formatReferenceTimespan = (entity: ReferenceEntity) => {
  const start = formatYear(entity.startYear);
  const end = formatYear(entity.endYear);

  if (start && end) return `${start} - ${end}`;
  return start || end || null;
};

const formatAtlasHorizon = (entities: ReferenceEntity[]) => {
  const datedEntities = entities.filter(
    (entity) => entity.startYear !== undefined || entity.endYear !== undefined
  );
  if (datedEntities.length === 0) return null;

  const starts = datedEntities
    .map((entity) => entity.startYear)
    .filter((value): value is number => value !== undefined);
  const ends = datedEntities
    .map((entity) => entity.endYear)
    .filter((value): value is number => value !== undefined);

  const earliest = starts.length > 0 ? Math.min(...starts) : undefined;
  const latest = ends.length > 0 ? Math.max(...ends) : undefined;

  if (earliest !== undefined && latest !== undefined) {
    return earliest === latest ? formatYear(earliest) : `${formatYear(earliest)} - ${formatYear(latest)}`;
  }

  if (earliest !== undefined) return `From ${formatYear(earliest)}`;
  if (latest !== undefined) return `Until ${formatYear(latest)}`;
  return null;
};

const resolveAtlasFocusYear = (entity: ReferenceEntity) =>
  entity.endYear ?? entity.startYear ?? 1862;

const buildAtlasHref = (entity: ReferenceEntity) => {
  const year = resolveAtlasFocusYear(entity);

  if (entity.kind === 'formation') {
    return `/world-history?year=${year}&formation=${entity.id}`;
  }

  if (entity.kind === 'polity') {
    return `/world-history?year=${year}&polity=${entity.id}`;
  }

  return null;
};

type ItemAtlasFrameGroup = {
  entity: ReferenceEntity;
  sourceKinds: Array<'direct' | 'topic'>;
  directRelationTypes: KnowledgeRelationType[];
  topicRelationTypes: KnowledgeRelationType[];
  topicTitles: string[];
};

const buildRelationHref = (relation: KnowledgeRelationDetail) => {
  if (relation.toEntityType === 'knowledge_item') return `/knowledge/${relation.toEntityId}`;
  if (relation.toEntityType === 'reference_entity') return `/entities/${relation.toEntityId}`;
  if (relation.toEntityType === 'subject') return `/subjects/${relation.toEntityId}`;
  if (relation.toEntityType === 'topic') return `/topics/${relation.toEntityId}`;
  return null;
};

const orderSubjects = (subjects: TopicSummary[]) => {
  const children = new Map<number | null, TopicSummary[]>();

  for (const subject of subjects) {
    const key = subject.parentSubjectId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(subject);
    children.set(key, branch);
  }

  for (const branch of children.values()) {
    branch.sort((left, right) => left.name.localeCompare(right.name));
  }

  const ordered: Array<{ subject: TopicSummary; depth: number }> = [];
  const visit = (parentSubjectId: number | null, depth: number) => {
    for (const subject of children.get(parentSubjectId) ?? []) {
      ordered.push({ subject, depth });
      visit(subject.id, depth + 1);
    }
  };

  visit(null, 0);
  return ordered;
};

const orderStudyTopics = (subjects: TopicSummary[], studyTopics: StudyTopicSummary[]) => {
  const orderedSubjects = orderSubjects(subjects);
  const groupedTopics = new Map<number, StudyTopicSummary[]>();

  for (const studyTopic of studyTopics) {
    const branch = groupedTopics.get(studyTopic.subjectId) ?? [];
    branch.push(studyTopic);
    groupedTopics.set(studyTopic.subjectId, branch);
  }

  return orderedSubjects.flatMap(({ subject }) => {
    const subjectTopics = groupedTopics.get(subject.id) ?? [];
    const children = new Map<number | null, StudyTopicSummary[]>();

    for (const studyTopic of subjectTopics) {
      const key = studyTopic.parentTopicId ?? null;
      const branch = children.get(key) ?? [];
      branch.push(studyTopic);
      children.set(key, branch);
    }

    for (const branch of children.values()) {
      branch.sort((left, right) => left.name.localeCompare(right.name));
    }

    const ordered: Array<{ topic: StudyTopicSummary; depth: number; subject: TopicSummary }> = [];
    const visit = (parentTopicId: number | null, depth: number) => {
      for (const topic of children.get(parentTopicId) ?? []) {
        ordered.push({ topic, depth, subject });
        visit(topic.id, depth + 1);
      }
    };

    visit(null, 0);
    return ordered;
  });
};

const buildSubjectPath = (subject: TopicSummary, subjectMap: Map<number, TopicSummary>) => {
  const parts = [subject.name];
  let currentParentId = subject.parentSubjectId;
  let guard = 0;

  while (currentParentId && guard < 12) {
    const parent = subjectMap.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentSubjectId;
    guard += 1;
  }

  return parts.join(' / ');
};

const buildStudyTopicPath = (
  topic: StudyTopicSummary,
  topicMap: Map<number, StudyTopicSummary>,
  subjectMap: Map<number, TopicSummary>
) => {
  const parts = [topic.name];
  let currentParentId = topic.parentTopicId;
  let guard = 0;

  while (currentParentId && guard < 12) {
    const parent = topicMap.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentTopicId;
    guard += 1;
  }

  const subject = subjectMap.get(topic.subjectId);
  if (subject) {
    parts.unshift(buildSubjectPath(subject, subjectMap));
  }

  return parts.join(' / ');
};

const ItemDetailPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const knowledgeItemId = Number(id);
  const returnTo =
    (location.state as ItemDetailLocationState | null)?.returnTo === '/knowledge?view=list'
      ? '/knowledge?view=list'
      : '/knowledge';

  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [subjects, setSubjects] = useState<TopicSummary[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopicSummary[]>([]);
  const [itemStudyTopics, setItemStudyTopics] = useState<StudyTopicSummary[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [topicRelationsById, setTopicRelationsById] = useState<Record<number, KnowledgeRelationDetail[]>>({});
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [tasks, setTasks] = useState<KnowledgeTask[]>([]);
  const [reviews, setReviews] = useState<KnowledgeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atlasContextError, setAtlasContextError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [savingTopicAssignment, setSavingTopicAssignment] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [showRecordEditor, setShowRecordEditor] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [showRelationComposer, setShowRelationComposer] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showReviewComposer, setShowReviewComposer] = useState(false);
  const [selectedStudyTopicId, setSelectedStudyTopicId] = useState('');
  const [newStudyTopicForm, setNewStudyTopicForm] = useState({
    subjectId: '',
    name: '',
    parentTopicId: '',
    description: '',
  });
  const [relationForm, setRelationForm] = useState({
    toEntityType: 'reference_entity' as KnowledgeRelationEntityType,
    toEntityId: '',
    relationType: 'related_to' as KnowledgeRelationType,
    note: '',
  });
  const [noteContent, setNoteContent] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    details: '',
    dueAt: '',
  });
  const [reviewForm, setReviewForm] = useState({
    score: '',
    summary: '',
    body: '',
  });
  const [recordForm, setRecordForm] = useState({
    title: '',
    creator: '',
    sourceName: '',
    sourceUrl: '',
    summary: '',
    publishedYear: '',
    pageCount: '',
    durationMinutes: '',
  });

  useEffect(() => {
    if (!Number.isInteger(knowledgeItemId) || knowledgeItemId <= 0) {
      setError('Invalid item.');
      setLoading(false);
      return;
    }

    const loadDetail = async () => {
      try {
        const [
          fetchedItem,
          fetchedItems,
          fetchedReferenceEntities,
          fetchedSubjects,
          fetchedStudyTopics,
          fetchedItemStudyTopics,
          fetchedRelations,
          fetchedNotes,
          fetchedTasks,
          fetchedReviews,
        ] = await Promise.all([
          fetchKnowledgeItem(knowledgeItemId),
          fetchKnowledgeItems(),
          fetchReferenceEntities(),
          fetchTopics(),
          fetchStudyTopics(),
          fetchKnowledgeItemStudyTopics(knowledgeItemId),
          fetchKnowledgeRelations(knowledgeItemId),
          fetchKnowledgeNotes(knowledgeItemId),
          fetchKnowledgeTasks(knowledgeItemId),
          fetchKnowledgeReviews(knowledgeItemId),
        ]);

        setItem(fetchedItem);
        setKnowledgeItems(fetchedItems);
        setReferenceEntities(fetchedReferenceEntities);
        setSubjects(fetchedSubjects);
        setStudyTopics(fetchedStudyTopics);
        setItemStudyTopics(fetchedItemStudyTopics);
        setRelations(fetchedRelations);
        setNotes(fetchedNotes);
        setTasks(fetchedTasks);
        setReviews(fetchedReviews);
        setRecordForm(toRecordFormState(fetchedItem));
        setNewStudyTopicForm((current) => ({
          ...current,
          subjectId: current.subjectId
            ? current.subjectId
            : fetchedSubjects.length === 0
              ? ''
              : String(fetchedSubjects[0].id),
        }));
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load the item detail.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [knowledgeItemId]);

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const studyTopicMap = useMemo(
    () => new Map(studyTopics.map((studyTopic) => [studyTopic.id, studyTopic])),
    [studyTopics]
  );
  const orderedSubjects = useMemo(() => orderSubjects(subjects), [subjects]);
  const orderedStudyTopics = useMemo(() => orderStudyTopics(subjects, studyTopics), [subjects, studyTopics]);
  const assignedStudyTopicIds = useMemo(
    () => new Set(itemStudyTopics.map((topic) => topic.id)),
    [itemStudyTopics]
  );
  const assignableStudyTopics = useMemo(
    () => orderedStudyTopics.filter(({ topic }) => !assignedStudyTopicIds.has(topic.id)),
    [assignedStudyTopicIds, orderedStudyTopics]
  );
  const parentTopicOptions = useMemo(() => {
    const selectedSubjectId = Number(newStudyTopicForm.subjectId);
    if (!selectedSubjectId) return [];
    return orderedStudyTopics.filter(({ topic }) => topic.subjectId === selectedSubjectId);
  }, [newStudyTopicForm.subjectId, orderedStudyTopics]);
  const selectedCreateSubject = useMemo(
    () =>
      newStudyTopicForm.subjectId
        ? subjectMap.get(Number(newStudyTopicForm.subjectId)) ?? null
        : null,
    [newStudyTopicForm.subjectId, subjectMap]
  );
  const relationTargets = useMemo(
    () => knowledgeItems.filter((candidate) => candidate.id !== item?.id),
    [item?.id, knowledgeItems]
  );
  const relationReferenceTargets = useMemo(
    () =>
      [...referenceEntities].sort((left, right) => {
        const leftKindIndex = relationKindOrder.indexOf(left.kind);
        const rightKindIndex = relationKindOrder.indexOf(right.kind);
        if (leftKindIndex !== rightKindIndex) return leftKindIndex - rightKindIndex;

        const titleComparison = left.title.localeCompare(right.title);
        if (titleComparison !== 0) return titleComparison;

        return left.id - right.id;
      }),
    [referenceEntities]
  );
  const referenceEntityMap = useMemo(
    () => new Map(referenceEntities.map((entity) => [entity.id, entity])),
    [referenceEntities]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'done').length,
    [tasks]
  );
  const creatorDisplay = useMemo(() => {
    const creatorTitles = relations
      .filter(
        (relation) =>
          relation.relationType === 'created_by' &&
          relation.toEntityType === 'reference_entity' &&
          relation.toEntityKind === 'person' &&
          relation.toEntityTitle
      )
      .map((relation) => relation.toEntityTitle as string);

    if (creatorTitles.length > 0) {
      return creatorTitles.join(', ');
    }

    return item?.creator || null;
  }, [item?.creator, relations]);
  const itemFormKind = item ? getItemFormKind(item) : 'book';
  const recordPreset = itemRecordPresets[itemFormKind];
  const recordExtraFieldValue =
    recordPreset.extraFieldName === 'pageCount' ? recordForm.pageCount : recordForm.durationMinutes;
  const selectedRelationReferenceTarget = useMemo(
    () =>
      relationForm.toEntityType === 'reference_entity'
        ? relationReferenceTargets.find((candidate) => String(candidate.id) === relationForm.toEntityId) ?? null
        : null,
    [relationForm.toEntityId, relationForm.toEntityType, relationReferenceTargets]
  );
  const relationPreset = useMemo(
    () =>
      getItemRelationPreset(
        itemFormKind,
        relationForm.toEntityType,
        selectedRelationReferenceTarget?.kind
      ),
    [itemFormKind, relationForm.toEntityType, selectedRelationReferenceTarget?.kind]
  );
  const itemAtlasFrameGroups = useMemo(() => {
    const grouped = new Map<number, ItemAtlasFrameGroup>();

    const registerEntity = (
      entity: ReferenceEntity,
      sourceKind: 'direct' | 'topic',
      relationType: KnowledgeRelationType,
      topicTitle?: string
    ) => {
      const current = grouped.get(entity.id);
      if (current) {
        if (!current.sourceKinds.includes(sourceKind)) current.sourceKinds.push(sourceKind);
        const relationBucket =
          sourceKind === 'direct' ? current.directRelationTypes : current.topicRelationTypes;
        if (!relationBucket.includes(relationType)) {
          relationBucket.push(relationType);
        }
        if (topicTitle && !current.topicTitles.includes(topicTitle)) {
          current.topicTitles.push(topicTitle);
        }
        return;
      }

      grouped.set(entity.id, {
        entity,
        sourceKinds: [sourceKind],
        directRelationTypes: sourceKind === 'direct' ? [relationType] : [],
        topicRelationTypes: sourceKind === 'topic' ? [relationType] : [],
        topicTitles: topicTitle ? [topicTitle] : [],
      });
    };

    for (const relation of relations) {
      if (relation.toEntityType !== 'reference_entity') continue;
      const entity = referenceEntityMap.get(relation.toEntityId);
      if (!entity) continue;
      registerEntity(entity, 'direct', relation.relationType);
    }

    for (const topic of itemStudyTopics) {
      const topicRelations = topicRelationsById[topic.id] ?? [];
      for (const relation of topicRelations) {
        if (relation.toEntityType !== 'reference_entity') continue;
        const entity = referenceEntityMap.get(relation.toEntityId);
        if (!entity) continue;
        registerEntity(entity, 'topic', relation.relationType, topic.name);
      }
    }

    return [...grouped.values()].sort((left, right) => {
      const kindDifference =
        atlasKindOrder.indexOf(left.entity.kind) - atlasKindOrder.indexOf(right.entity.kind);
      if (kindDifference !== 0) return kindDifference;

      const titleDifference = left.entity.title.localeCompare(right.entity.title);
      if (titleDifference !== 0) return titleDifference;

      return left.entity.id - right.entity.id;
    });
  }, [itemStudyTopics, referenceEntityMap, relations, topicRelationsById]);
  const itemAtlasHorizon = useMemo(
    () => formatAtlasHorizon(itemAtlasFrameGroups.map((entry) => entry.entity)),
    [itemAtlasFrameGroups]
  );
  const formationAtlasFrameGroups = useMemo(
    () => itemAtlasFrameGroups.filter((entry) => entry.entity.kind === 'formation'),
    [itemAtlasFrameGroups]
  );
  const polityAtlasFrameGroups = useMemo(
    () => itemAtlasFrameGroups.filter((entry) => entry.entity.kind === 'polity'),
    [itemAtlasFrameGroups]
  );
  const personAtlasFrameGroups = useMemo(
    () => itemAtlasFrameGroups.filter((entry) => entry.entity.kind === 'person'),
    [itemAtlasFrameGroups]
  );
  const topicDrivenAtlasFrameCount = useMemo(
    () => itemAtlasFrameGroups.filter((entry) => entry.sourceKinds.includes('topic')).length,
    [itemAtlasFrameGroups]
  );
  const directAtlasFrameCount = useMemo(
    () => itemAtlasFrameGroups.filter((entry) => entry.sourceKinds.includes('direct')).length,
    [itemAtlasFrameGroups]
  );

  useEffect(() => {
    setRelationForm((current) => {
      const nextRelationType = relationPreset.allowedRelationTypes.includes(current.relationType)
        ? current.relationType
        : relationPreset.defaultRelationType;

      if (nextRelationType === current.relationType) {
        return current;
      }

      return {
        ...current,
        relationType: nextRelationType,
      };
    });
  }, [relationPreset]);

  useEffect(() => {
    if (itemStudyTopics.length === 0) {
      setTopicRelationsById({});
      setAtlasContextError(null);
      return;
    }

    let cancelled = false;

    const loadTopicAtlasContext = async () => {
      try {
        setAtlasContextError(null);
        const entries = await Promise.all(
          itemStudyTopics.map(async (topic) => [topic.id, await fetchTopicRelations(topic.id)] as const)
        );

        if (!cancelled) {
          setTopicRelationsById(Object.fromEntries(entries));
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setTopicRelationsById({});
          setAtlasContextError('Failed to load atlas context from the assigned topics.');
        }
      }
    };

    void loadTopicAtlasContext();

    return () => {
      cancelled = true;
    };
  }, [itemStudyTopics]);

  const handleItemStatusChange = async (nextStatus: KnowledgeItemStatus) => {
    if (!item || nextStatus === item.status) return;

    const previousItem = item;
    const optimisticItem = {
      ...item,
      status: nextStatus,
    };

    setStatusSaving(true);
    setError(null);
    setItem(optimisticItem);

    try {
      const updatedItem = await updateKnowledgeItem(item.id, { status: nextStatus });
      setItem(updatedItem);
    } catch (statusError) {
      console.error(statusError);
      setItem(previousItem);
      setError('Failed to update item status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleRecordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !recordForm.title.trim()) return;

    setSavingRecord(true);
    setError(null);

    const nextMetadata = { ...(item.metadata ?? {}) };
    delete nextMetadata.pageCount;
    delete nextMetadata.durationMinutes;

    const pageCount = parseIntegerInput(recordForm.pageCount);
    const durationMinutes = parseIntegerInput(recordForm.durationMinutes);
    if (itemFormKind === 'book' && pageCount !== null) {
      nextMetadata.pageCount = pageCount;
    }
    if (itemFormKind === 'lecture' && durationMinutes !== null) {
      nextMetadata.durationMinutes = durationMinutes;
    }

    const payload = {
      title: recordForm.title.trim(),
      creator: recordForm.creator.trim(),
      sourceName: recordForm.sourceName.trim(),
      sourceUrl: recordForm.sourceUrl.trim(),
      summary: recordForm.summary.trim(),
      publishedYear: parseIntegerInput(recordForm.publishedYear),
      metadata: nextMetadata,
    } as UpdateKnowledgeItem;

    try {
      const updatedItem = await updateKnowledgeItem(item.id, payload);
      setItem(updatedItem);
      setRecordForm(toRecordFormState(updatedItem));
      setShowRecordEditor(false);
    } catch (recordError) {
      console.error(recordError);
      setError('Failed to update the item record.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleAttachTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !selectedStudyTopicId) return;

    setSavingTopicAssignment(true);
    setError(null);

    try {
      const assignedTopic = await assignStudyTopicToKnowledgeItem(item.id, Number(selectedStudyTopicId));
      startTransition(() => {
        setItemStudyTopics((current) =>
          current.some((topic) => topic.id === assignedTopic.id) ? current : [...current, assignedTopic]
        );
      });
      setSelectedStudyTopicId('');
      setShowTopicManager(false);
    } catch (topicError) {
      console.error(topicError);
      setError('Failed to attach topic.');
    } finally {
      setSavingTopicAssignment(false);
    }
  };

  const handleCreateTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !newStudyTopicForm.name.trim() || !newStudyTopicForm.subjectId) return;

    setCreatingTopic(true);
    setError(null);

    try {
      const createdTopic = await createStudyTopic({
        subjectId: Number(newStudyTopicForm.subjectId),
        name: newStudyTopicForm.name.trim(),
        parentTopicId: newStudyTopicForm.parentTopicId
          ? Number(newStudyTopicForm.parentTopicId)
          : undefined,
        description: newStudyTopicForm.description.trim() || undefined,
      });

      startTransition(() => {
        setStudyTopics((current) =>
          current.some((topic) => topic.id === createdTopic.id) ? current : [...current, createdTopic]
        );
      });

      const assignedTopic = await assignStudyTopicToKnowledgeItem(item.id, createdTopic.id);
      startTransition(() => {
        setItemStudyTopics((current) =>
          current.some((topic) => topic.id === assignedTopic.id) ? current : [...current, assignedTopic]
        );
      });

      setNewStudyTopicForm((current) => ({
        ...current,
        name: '',
        parentTopicId: '',
        description: '',
      }));
      setShowTopicManager(false);
    } catch (topicError) {
      console.error(topicError);
      setError('Failed to create and attach topic.');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleRemoveTopic = async (topicId: number) => {
    if (!item) return;

    try {
      await removeStudyTopicFromKnowledgeItem(item.id, topicId);
      startTransition(() => {
        setItemStudyTopics((current) => current.filter((topic) => topic.id !== topicId));
      });
    } catch (topicError) {
      console.error(topicError);
      setError('Failed to remove topic.');
    }
  };

  const handleRelationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !relationForm.toEntityId) return;

    setSavingRelation(true);
    setError(null);

    try {
      const relation = await createKnowledgeRelation(item.id, {
        toEntityType: relationForm.toEntityType,
        toEntityId: Number(relationForm.toEntityId),
        relationType: relationForm.relationType,
        note: relationForm.note.trim() || undefined,
      });

      startTransition(() => {
        setRelations((current) => {
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
        toEntityType: relationForm.toEntityType,
        toEntityId: '',
        relationType: relationPreset.defaultRelationType,
        note: '',
      });
      setShowRelationComposer(false);
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to create relation.');
    } finally {
      setSavingRelation(false);
    }
  };

  const handleDeleteRelation = async (relationId: number) => {
    if (!item) return;

    try {
      await deleteKnowledgeRelation(item.id, relationId);
      startTransition(() => {
        setRelations((current) => current.filter((relation) => relation.id !== relationId));
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to delete relation.');
    }
  };

  const handleNoteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteContent.trim() || !item) return;

    setSavingNote(true);
    setError(null);

    try {
      const createdNote = await createKnowledgeNote(item.id, {
        content: noteContent.trim(),
      });
      startTransition(() => {
        setNotes((current) => [createdNote, ...current]);
      });
      setNoteContent('');
      setShowNoteComposer(false);
    } catch (noteError) {
      console.error(noteError);
      setError('Failed to save note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!item) return;

    try {
      await deleteKnowledgeNote(item.id, noteId);
      startTransition(() => {
        setNotes((current) => current.filter((note) => note.id !== noteId));
      });
    } catch (noteError) {
      console.error(noteError);
      setError('Failed to delete note.');
    }
  };

  const handleTaskSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskForm.title.trim() || !item) return;

    setSavingTask(true);
    setError(null);

    try {
      const createdTask = await createKnowledgeTask(item.id, {
        title: taskForm.title.trim(),
        details: taskForm.details.trim() || undefined,
        dueAt: taskForm.dueAt || undefined,
        status: 'todo',
      });
      startTransition(() => {
        setTasks((current) => [...current, createdTask]);
      });
      setTaskForm({
        title: '',
        details: '',
        dueAt: '',
      });
      setShowTaskComposer(false);
    } catch (taskError) {
      console.error(taskError);
      setError('Failed to create task.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleTaskStatusChange = async (task: KnowledgeTask, nextStatus: KnowledgeTaskStatus) => {
    if (!item || nextStatus === task.status) return;

    setError(null);

    try {
      const updatedTask = await updateKnowledgeTask(item.id, task.id, {
        status: nextStatus,
      });

      startTransition(() => {
        setTasks((current) =>
          current.map((existingTask) => (existingTask.id === task.id ? updatedTask : existingTask))
        );
      });
    } catch (taskError) {
      console.error(taskError);
      setError('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!item) return;

    try {
      await deleteKnowledgeTask(item.id, taskId);
      startTransition(() => {
        setTasks((current) => current.filter((task) => task.id !== taskId));
      });
    } catch (taskError) {
      console.error(taskError);
      setError('Failed to delete task.');
    }
  };

  const handleReviewSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item) return;

    const parsedScore = reviewForm.score ? Number(reviewForm.score) : undefined;
    const hasContent =
      parsedScore !== undefined ||
      Boolean(reviewForm.summary.trim()) ||
      Boolean(reviewForm.body.trim());

    if (!hasContent) return;

    setSavingReview(true);
    setError(null);

    try {
      const createdReview = await createKnowledgeReview(item.id, {
        score: parsedScore,
        summary: reviewForm.summary.trim() || undefined,
        body: reviewForm.body.trim() || undefined,
      });
      startTransition(() => {
        setReviews((current) => [createdReview, ...current]);
      });
      setReviewForm({
        score: '',
        summary: '',
        body: '',
      });
      setShowReviewComposer(false);
    } catch (reviewError) {
      console.error(reviewError);
      setError('Failed to save review.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!item) return;

    try {
      await deleteKnowledgeReview(item.id, reviewId);
      startTransition(() => {
        setReviews((current) => current.filter((review) => review.id !== reviewId));
      });
    } catch (reviewError) {
      console.error(reviewError);
      setError('Failed to delete review.');
    }
  };

  if (loading) {
    return (
      <div className="knowledge-detail-page">
        <div className="knowledge-detail-empty">Loading item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="knowledge-detail-page">
        <div className="knowledge-detail-empty">
          {error || 'This item could not be found.'}
        </div>
      </div>
    );
  }

  const itemRecordDetail = getItemRecordDetail(item);

  return (
    <div className="knowledge-detail-page">
      <Link to={returnTo} className="knowledge-detail-back">
        Back to Item Workbench
      </Link>

      <section className="knowledge-detail-hero">
        <div className="knowledge-detail-hero-main">
          <div className="knowledge-detail-hero-summary">
            {item.coverImageUrl ? (
              <div className="knowledge-detail-cover-frame">
                <img
                  src={item.coverImageUrl}
                  alt={`Cover for ${item.title}`}
                  className="knowledge-detail-cover"
                />
              </div>
            ) : null}

            <div className="knowledge-detail-hero-copy">
              <div className="knowledge-detail-badges">
                <span className="knowledge-detail-badge">{item.kind}</span>
                <span className="knowledge-detail-badge knowledge-detail-status">{item.status}</span>
              </div>
              <div className="knowledge-detail-title">
                <h1>{item.title}</h1>
                <div className="knowledge-detail-meta">
                  {creatorDisplay ? <span>{creatorDisplay}</span> : null}
                  {item.sourceName ? <span>{item.sourceName}</span> : null}
                  {item.publishedYear ? <span>{item.publishedYear}</span> : null}
                  {itemRecordDetail ? <span>{itemRecordDetail}</span> : null}
                  <span>Updated {formatDate(item.updatedAt)}</span>
                </div>
              </div>
              {item.summary ? <p>{item.summary}</p> : null}
            </div>
          </div>
        </div>

        <div className="knowledge-detail-hero-actions">
          <label className="knowledge-detail-inline-label knowledge-detail-inline-label-compact">
            Status
            <select
              value={item.status}
              onChange={(event) => handleItemStatusChange(event.target.value as KnowledgeItemStatus)}
              disabled={statusSaving}
            >
              {itemStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="knowledge-detail-hero-action-row">
            {item.sourceUrl ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="knowledge-detail-secondary-link">
                Open source
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <div className="knowledge-detail-error">{error}</div> : null}

      <div className="knowledge-detail-main">
        <section className="knowledge-detail-panel">
          <div className="knowledge-detail-section-head">
            <div>
              <span className="knowledge-detail-eyebrow">Record</span>
              <h2>Item record</h2>
            </div>
            <button
              type="button"
              className="knowledge-detail-secondary-button"
              onClick={() => setShowRecordEditor((current) => !current)}
            >
              {showRecordEditor ? 'Hide editor' : 'Edit record'}
            </button>
          </div>

          {item.description ? <p className="knowledge-detail-copy">{item.description}</p> : null}

          <div className="knowledge-detail-overview">
            <dl className="knowledge-detail-fact-grid">
              <div>
                <dt>Created</dt>
                <dd>{formatDate(item.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(item.updatedAt)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{item.kind}</dd>
              </div>
              <div>
                <dt>Form</dt>
                <dd>{getItemFormLabel(item)}</dd>
              </div>
              {itemRecordDetail ? (
                <div>
                  <dt>Record detail</dt>
                  <dd>{itemRecordDetail}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {showRecordEditor ? (
            <div className="knowledge-detail-inline-panel">
              <p className="knowledge-detail-copy">{recordPreset.helperText}</p>

              <form className="knowledge-detail-form" onSubmit={handleRecordSubmit}>
                <label className="knowledge-detail-inline-label">
                  Title
                  <input
                    value={recordForm.title}
                    onChange={(event) =>
                      setRecordForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <div className="knowledge-detail-inline-fields knowledge-detail-inline-fields-wide">
                  <label className="knowledge-detail-inline-label">
                    {recordPreset.creatorLabel} Text Fallback
                    <input
                      value={recordForm.creator}
                      onChange={(event) =>
                        setRecordForm((current) => ({
                          ...current,
                          creator: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="knowledge-detail-inline-label">
                    {recordPreset.sourceLabel}
                    <input
                      value={recordForm.sourceName}
                      onChange={(event) =>
                        setRecordForm((current) => ({
                          ...current,
                          sourceName: event.target.value,
                        }))
                      }
                      placeholder={recordPreset.sourcePlaceholder}
                    />
                  </label>
                </div>

                <div className="knowledge-detail-inline-fields knowledge-detail-inline-fields-wide">
                  <label className="knowledge-detail-inline-label">
                    Source URL
                    <input
                      type="url"
                      value={recordForm.sourceUrl}
                      onChange={(event) =>
                        setRecordForm((current) => ({
                          ...current,
                          sourceUrl: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="knowledge-detail-inline-label">
                    {recordPreset.yearLabel}
                    <input
                      type="number"
                      value={recordForm.publishedYear}
                      onChange={(event) =>
                        setRecordForm((current) => ({
                          ...current,
                          publishedYear: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="knowledge-detail-inline-label">
                  {recordPreset.extraFieldLabel}
                  <input
                    type="number"
                    value={recordExtraFieldValue}
                    onChange={(event) =>
                      setRecordForm((current) => ({
                        ...current,
                        pageCount:
                          recordPreset.extraFieldName === 'pageCount'
                            ? event.target.value
                            : current.pageCount,
                        durationMinutes:
                          recordPreset.extraFieldName === 'durationMinutes'
                            ? event.target.value
                            : current.durationMinutes,
                      }))
                    }
                    placeholder={recordPreset.extraFieldPlaceholder}
                  />
                </label>

                <label className="knowledge-detail-inline-label">
                  Summary
                  <textarea
                    value={recordForm.summary}
                    onChange={(event) =>
                      setRecordForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="A short record-level description"
                  />
                </label>

                <button type="submit" disabled={savingRecord}>
                  {savingRecord ? 'Saving record...' : 'Save record'}
                </button>
              </form>
            </div>
          ) : null}
        </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Topic Spine</span>
                <h2>
                  Topic placement
                  <span className="knowledge-detail-count-badge">{itemStudyTopics.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="knowledge-detail-secondary-button"
                onClick={() => setShowTopicManager((current) => !current)}
              >
                {showTopicManager ? 'Hide topic tools' : 'Manage topics'}
              </button>
            </div>

            <div className="knowledge-detail-chips">
              {itemStudyTopics.length === 0 ? (
                <div className="knowledge-detail-empty">
                  This item is not assigned to a topic yet.
                </div>
              ) : (
                itemStudyTopics.map((topic) => (
                  <div key={topic.id} className="knowledge-detail-chip">
                    <Link to={`/topics/${topic.id}`}>
                      {buildStudyTopicPath(topic, studyTopicMap, subjectMap)}
                    </Link>
                    {showTopicManager ? (
                      <button type="button" onClick={() => handleRemoveTopic(topic.id)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {showTopicManager ? (
              <div className="knowledge-detail-inline-panel">
                <form className="knowledge-detail-form knowledge-detail-form-row" onSubmit={handleAttachTopic}>
                  <select
                    value={selectedStudyTopicId}
                    onChange={(event) => setSelectedStudyTopicId(event.target.value)}
                    disabled={savingTopicAssignment || assignableStudyTopics.length === 0}
                  >
                    <option value="">Attach an existing topic</option>
                    {assignableStudyTopics.map(({ topic }) => (
                      <option key={topic.id} value={topic.id}>
                        {buildStudyTopicPath(topic, studyTopicMap, subjectMap)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={savingTopicAssignment || !selectedStudyTopicId}>
                    {savingTopicAssignment ? 'Attaching...' : 'Attach topic'}
                  </button>
                </form>

                <form className="knowledge-detail-form" onSubmit={handleCreateTopic}>
                  <input
                    value={newStudyTopicForm.name}
                    onChange={(event) =>
                      setNewStudyTopicForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Create a new topic in the right subject branch"
                  />
                  <div className="knowledge-detail-inline-fields knowledge-detail-inline-fields-relations">
                    <label>
                      Subject
                      <select
                        value={newStudyTopicForm.subjectId}
                        onChange={(event) =>
                          setNewStudyTopicForm((current) => ({
                            ...current,
                            subjectId: event.target.value,
                            parentTopicId: '',
                          }))
                        }
                      >
                        <option value="">Choose a subject</option>
                        {orderedSubjects.map(({ subject, depth }) => (
                          <option key={subject.id} value={subject.id}>
                            {`${'  '.repeat(depth)}${subject.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Parent topic
                      <select
                        value={newStudyTopicForm.parentTopicId}
                        onChange={(event) =>
                          setNewStudyTopicForm((current) => ({
                            ...current,
                            parentTopicId: event.target.value,
                          }))
                        }
                        disabled={!selectedCreateSubject}
                      >
                        <option value="">No parent topic</option>
                        {parentTopicOptions.map(({ topic, depth }) => (
                          <option key={topic.id} value={topic.id}>
                            {`${'  '.repeat(depth)}${topic.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Description
                      <input
                        value={newStudyTopicForm.description}
                        onChange={(event) =>
                          setNewStudyTopicForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Optional topic note"
                      />
                    </label>
                  </div>
                  <button type="submit" disabled={creatingTopic || !newStudyTopicForm.subjectId}>
                    {creatingTopic ? 'Creating topic...' : 'Create and attach topic'}
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Relations</span>
                <h2>
                  Context links
                  <span className="knowledge-detail-count-badge">{relations.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="knowledge-detail-secondary-button"
                onClick={() => setShowRelationComposer((current) => !current)}
              >
                {showRelationComposer ? 'Hide relation form' : 'Add relation'}
              </button>
            </div>

            {atlasContextError ? <div className="knowledge-detail-error">{atlasContextError}</div> : null}

            <div className="knowledge-detail-overview">
              <dl className="knowledge-detail-fact-grid knowledge-detail-atlas-fact-grid">
                <div>
                  <dt>Historical horizon</dt>
                  <dd>{itemAtlasHorizon || 'Open'}</dd>
                </div>
                <div>
                  <dt>Formations in frame</dt>
                  <dd>{formationAtlasFrameGroups.length || 'None'}</dd>
                </div>
                <div>
                  <dt>Polity scope</dt>
                  <dd>{polityAtlasFrameGroups.length || 'None'}</dd>
                </div>
                <div>
                  <dt>People in frame</dt>
                  <dd>{personAtlasFrameGroups.length || 'None'}</dd>
                </div>
                <div>
                  <dt>Inherited through topics</dt>
                  <dd>{topicDrivenAtlasFrameCount}</dd>
                </div>
                <div>
                  <dt>Direct on this item</dt>
                  <dd>{directAtlasFrameCount}</dd>
                </div>
              </dl>
            </div>

            {itemAtlasFrameGroups.length > 0 ? (
              <div className="knowledge-detail-stack knowledge-detail-atlas-stack">
                {itemAtlasFrameGroups.map((entry) => (
                  <article key={`atlas-frame-${entry.entity.id}`} className="knowledge-detail-card">
                    <div className="knowledge-detail-card-top">
                      <div>
                        <div className="knowledge-detail-meta">
                          <span>{entry.entity.kind}</span>
                          {entry.sourceKinds.includes('direct') ? <span>direct</span> : null}
                          {entry.sourceKinds.includes('topic') ? <span>through topics</span> : null}
                          {formatReferenceTimespan(entry.entity) ? (
                            <span>{formatReferenceTimespan(entry.entity)}</span>
                          ) : null}
                        </div>
                        <Link to={`/entities/${entry.entity.id}`} className="knowledge-detail-card-link">
                          <h3>{entry.entity.title}</h3>
                        </Link>
                      </div>
                      <div className="knowledge-detail-card-actions">
                        <Link to={`/entities/${entry.entity.id}`} className="knowledge-detail-secondary-link">
                          Open entity
                        </Link>
                        {buildAtlasHref(entry.entity) ? (
                          <Link to={buildAtlasHref(entry.entity)!} className="knowledge-detail-secondary-link">
                            Open on atlas
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="knowledge-detail-meta">
                      {entry.directRelationTypes.map((relationType) => (
                        <span key={`direct-${entry.entity.id}-${relationType}`}>
                          direct: {formatRelationType(relationType)}
                        </span>
                      ))}
                      {entry.topicRelationTypes.map((relationType) => (
                        <span key={`topic-${entry.entity.id}-${relationType}`}>
                          topic: {formatRelationType(relationType)}
                        </span>
                      ))}
                    </div>
                    {entry.entity.summary ? <p>{entry.entity.summary}</p> : null}
                    {entry.topicTitles.length > 0 ? (
                      <div className="knowledge-detail-meta">
                        <span>Through topics: {entry.topicTitles.join(', ')}</span>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}

            {showRelationComposer ? (
              <div className="knowledge-detail-inline-panel">
                <form className="knowledge-detail-form" onSubmit={handleRelationSubmit}>
                  <div className="knowledge-detail-note">
                    <strong>Current guidance</strong>
                    <span>{relationPreset.helperText}</span>
                  </div>
                  <div className="knowledge-detail-inline-fields knowledge-detail-inline-fields-wide">
                    <label>
                      Target type
                      <select
                        value={relationForm.toEntityType}
                        onChange={(event) =>
                          setRelationForm((current) => ({
                            ...current,
                            toEntityType: event.target.value as KnowledgeRelationEntityType,
                            toEntityId: '',
                            relationType: relationPreset.defaultRelationType,
                          }))
                        }
                      >
                        <option value="reference_entity">Reference entity</option>
                        <option value="knowledge_item">Item</option>
                      </select>
                    </label>
                    <label>
                      Relation
                      <select
                        value={relationForm.relationType}
                        onChange={(event) =>
                          setRelationForm((current) => ({
                            ...current,
                            relationType: event.target.value as KnowledgeRelationType,
                          }))
                        }
                      >
                        {relationPreset.allowedRelationTypes.map((relationType) => (
                          <option key={relationType} value={relationType}>
                            {formatRelationType(relationType)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {relationForm.toEntityType === 'reference_entity' ? 'Target entity' : 'Target item'}
                      <select
                        value={relationForm.toEntityId}
                        onChange={(event) =>
                          setRelationForm((current) => ({
                            ...current,
                            toEntityId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{relationPreset.targetPrompt}</option>
                        {relationForm.toEntityType === 'reference_entity'
                          ? relationReferenceTargets.map((candidate) => {
                              const timespan = formatReferenceTimespan(candidate);

                              return (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.title}
                                  {timespan ? ` (${candidate.kind}, ${timespan})` : ` (${candidate.kind})`}
                                </option>
                              );
                            })
                          : relationTargets.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.title}
                              </option>
                            ))}
                      </select>
                    </label>
                  </div>
                  <input
                    value={relationForm.note}
                    onChange={(event) =>
                      setRelationForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder={relationPreset.notePlaceholder}
                  />
                  <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                    {savingRelation ? 'Linking...' : 'Add relation'}
                  </button>
                </form>
              </div>
            ) : null}

            {relations.length === 0 ? (
              itemAtlasFrameGroups.length === 0 ? (
                <div className="knowledge-detail-empty">No connections yet.</div>
              ) : null
            ) : (
              <div className="knowledge-detail-stack">
                {relations.map((relation) => (
                  <article key={relation.id} className="knowledge-detail-card">
                    <div className="knowledge-detail-card-top">
                      <div>
                        <div className="knowledge-detail-meta">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>{formatEntityType(relation.toEntityType)}</span>
                          {relation.toEntityKind ? <span>{relation.toEntityKind}</span> : null}
                          <span>{formatDateTime(relation.createdAt)}</span>
                        </div>
                        {buildRelationHref(relation) ? (
                          <Link to={buildRelationHref(relation) as string} className="knowledge-detail-card-link">
                            <h3>{relation.toEntityTitle || `Item #${relation.toEntityId}`}</h3>
                          </Link>
                        ) : (
                          <h3>{relation.toEntityTitle || `Item #${relation.toEntityId}`}</h3>
                        )}
                      </div>
                      <button type="button" onClick={() => handleDeleteRelation(relation.id)}>
                        Delete
                      </button>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Notes</span>
                <h2>
                  Working notes
                  <span className="knowledge-detail-count-badge">{notes.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="knowledge-detail-secondary-button"
                onClick={() => setShowNoteComposer((current) => !current)}
              >
                {showNoteComposer ? 'Hide note form' : 'Add note'}
              </button>
            </div>

            {showNoteComposer ? (
              <div className="knowledge-detail-inline-panel">
                <form className="knowledge-detail-form" onSubmit={handleNoteSubmit}>
                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Capture an observation, excerpt, or connection."
                  />
                  <button type="submit" disabled={savingNote}>
                    {savingNote ? 'Saving note...' : 'Add note'}
                  </button>
                </form>
              </div>
            ) : null}

            {notes.length === 0 ? (
              <div className="knowledge-detail-empty">No notes yet.</div>
            ) : (
              <div className="knowledge-detail-stack">
                {notes.map((note) => (
                  <article key={note.id} className="knowledge-detail-card">
                    <div className="knowledge-detail-card-top">
                      <span>{formatDateTime(note.updatedAt)}</span>
                      <button type="button" onClick={() => handleDeleteNote(note.id)}>
                        Delete
                      </button>
                    </div>
                    <p>{note.content}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Tasks</span>
                <h2>
                  Follow-up work
                  <span className="knowledge-detail-count-badge">
                    {completedTasks}/{tasks.length} done
                  </span>
                </h2>
              </div>
              <button
                type="button"
                className="knowledge-detail-secondary-button"
                onClick={() => setShowTaskComposer((current) => !current)}
              >
                {showTaskComposer ? 'Hide task form' : 'Add task'}
              </button>
            </div>

            {showTaskComposer ? (
              <div className="knowledge-detail-inline-panel">
                <form className="knowledge-detail-form" onSubmit={handleTaskSubmit}>
                  <input
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Write a short task title"
                  />
                  <textarea
                    value={taskForm.details}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        details: event.target.value,
                      }))
                    }
                    placeholder="Optional detail or next action"
                  />
                  <div className="knowledge-detail-inline-fields">
                    <label>
                      Due date
                      <input
                        type="date"
                        value={taskForm.dueAt}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            dueAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <button type="submit" disabled={savingTask}>
                    {savingTask ? 'Saving task...' : 'Add task'}
                  </button>
                </form>
              </div>
            ) : null}

            {tasks.length === 0 ? (
              <div className="knowledge-detail-empty">No follow-up work yet.</div>
            ) : (
              <div className="knowledge-detail-stack">
                {tasks.map((task) => (
                  <article key={task.id} className="knowledge-detail-card">
                    <div className="knowledge-detail-card-top">
                      <div>
                        <h3>{task.title}</h3>
                        <div className="knowledge-detail-meta">
                          <span>{task.status}</span>
                          {task.dueAt ? <span>Due {formatDate(task.dueAt)}</span> : null}
                          {task.completedAt ? <span>Done {formatDate(task.completedAt)}</span> : null}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDeleteTask(task.id)}>
                        Delete
                      </button>
                    </div>
                    {task.details ? <p>{task.details}</p> : null}
                    <select
                      value={task.status}
                      onChange={(event) =>
                        handleTaskStatusChange(task, event.target.value as KnowledgeTaskStatus)
                      }
                    >
                      {taskStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Reviews</span>
                <h2>
                  Reflections and verdicts
                  <span className="knowledge-detail-count-badge">{reviews.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="knowledge-detail-secondary-button"
                onClick={() => setShowReviewComposer((current) => !current)}
              >
                {showReviewComposer ? 'Hide review form' : 'Add review'}
              </button>
            </div>

            {showReviewComposer ? (
              <div className="knowledge-detail-inline-panel">
                <form className="knowledge-detail-form" onSubmit={handleReviewSubmit}>
                  <label className="knowledge-detail-inline-label">
                    Score
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={reviewForm.score}
                      onChange={(event) =>
                        setReviewForm((current) => ({
                          ...current,
                          score: event.target.value,
                        }))
                      }
                      placeholder="1-5"
                    />
                  </label>
                  <input
                    value={reviewForm.summary}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Short verdict"
                  />
                  <textarea
                    value={reviewForm.body}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="What was valuable, weak, surprising, or worth revisiting?"
                  />
                  <button type="submit" disabled={savingReview}>
                    {savingReview ? 'Saving review...' : 'Add review'}
                  </button>
                </form>
              </div>
            ) : null}

            {reviews.length === 0 ? (
              <div className="knowledge-detail-empty">No reviews yet.</div>
            ) : (
              <div className="knowledge-detail-stack">
                {reviews.map((review) => (
                  <article key={review.id} className="knowledge-detail-card">
                    <div className="knowledge-detail-card-top">
                      <div>
                        <div className="knowledge-detail-meta">
                          {review.score ? (
                            <span className="knowledge-detail-score">{review.score}/5</span>
                          ) : null}
                          <span>{formatDateTime(review.updatedAt)}</span>
                        </div>
                        {review.summary ? <h3>{review.summary}</h3> : null}
                      </div>
                      <button type="button" onClick={() => handleDeleteReview(review.id)}>
                        Delete
                      </button>
                    </div>
                    {review.body ? <p>{review.body}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>
      </div>
    </div>
  );
};

export default ItemDetailPage;
