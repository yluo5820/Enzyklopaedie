import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type {
  FormationSubtype,
  KnowledgeItem,
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  ReferenceEntityKind,
  SubjectSummary as TopicSummary,
  TopicSummary as StudyTopicSummary,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  assignTopicToKnowledgeItem,
  createTopicRelation as createStudyTopicRelation,
  deleteTopicRelation as deleteStudyTopicRelation,
  fetchKnowledgeItems,
  fetchReferenceEntities,
  fetchSubject as fetchTopic,
  fetchSubjects as fetchTopics,
  fetchTopic as fetchStudyTopic,
  fetchTopicKnowledgeItems as fetchStudyTopicKnowledgeItems,
  fetchTopicRelations as fetchStudyTopicRelations,
  fetchTopics as fetchStudyTopics,
  removeTopicFromKnowledgeItem,
  updateTopic as updateStudyTopic,
} from '../api';
import './TopicPage.css';

type StudyTopicRelationPreset = {
  allowedRelationTypes: KnowledgeRelationType[];
  defaultRelationType: KnowledgeRelationType;
  helperText: string;
  notePlaceholder: string;
  targetPrompt: string;
};

const relationKindOrder: ReferenceEntityKind[] = [
  'person',
  'polity',
  'formation',
];

const atlasKindOrder: ReferenceEntityKind[] = ['formation', 'polity', 'person'];

const entityKindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  polity: 'Polity',
  formation: 'Formation',
};

const formationSubtypeLabels: Record<FormationSubtype, string> = {
  civilization: 'Civilization',
  era: 'Era',
  tradition: 'Tradition',
  world_frame: 'World Frame',
  other: 'Formation',
};

const getStudyTopicRelationPreset = (
  targetEntityKind?: ReferenceEntityKind
): StudyTopicRelationPreset => {
  if (targetEntityKind === 'person') {
    return {
      allowedRelationTypes: ['about', 'influenced_by', 'related_to'],
      defaultRelationType: 'about',
      helperText:
        'Use people here when a topic centers on a thinker, school founder, or historically decisive figure.',
      notePlaceholder: 'Optional note about this person in the topic context',
      targetPrompt: 'Choose a person',
    };
  }

  if (targetEntityKind === 'polity') {
    return {
      allowedRelationTypes: ['located_in', 'about', 'related_to'],
      defaultRelationType: 'located_in',
      helperText:
        'Use polities to localize the topic in geography or political space. Choose about only when the polity is itself the object of study.',
      notePlaceholder: 'Optional note about this polity frame',
      targetPrompt: 'Choose a polity',
    };
  }

  if (targetEntityKind === 'formation') {
    return {
      allowedRelationTypes: ['part_of', 'about', 'related_to'],
      defaultRelationType: 'part_of',
      helperText:
        'Use formations as the broad spatial-temporal horizon around the topic, or as the explicit object of study.',
      notePlaceholder: 'Optional note about this formation frame',
      targetPrompt: 'Choose a formation',
    };
  }

  return {
    allowedRelationTypes: ['about', 'during', 'located_in', 'part_of', 'related_to'],
    defaultRelationType: 'about',
    helperText:
      'Choose the reference entity first. The relation verbs will narrow once the topic’s historical or geographic frame is clear.',
    notePlaceholder: 'Optional note about why this entity matters here',
    targetPrompt: 'Choose a person, polity, or formation',
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const PageHint = ({ text }: { text: string }) => (
  <span className="topic-page-help" tabIndex={0} aria-label={text}>
    <span aria-hidden="true" className="topic-page-help-icon">
      i
    </span>
    <span role="tooltip" className="topic-page-help-tooltip">
      {text}
    </span>
  </span>
);

const formatRelationType = (value: KnowledgeRelationType) => value.replace(/_/g, ' ');

const formatYear = (value?: number) => {
  if (value === undefined) return null;
  if (value < 0) return `${Math.abs(value)} BCE`;
  if (value > 0) return `${value} CE`;
  return 'Year 0';
};

const formatReferenceTimespan = (entity: ReferenceEntity) => {
  const start = formatYear(entity.startYear);
  const end = formatYear(entity.endYear);

  if (start && end) return `${start} - ${end}`;
  return start || end || null;
};

const formatEntityFrameLabel = (entity: ReferenceEntity) => {
  if (entity.kind === 'formation' && entity.formationSubtype) {
    return formationSubtypeLabels[entity.formationSubtype];
  }

  return entityKindLabels[entity.kind];
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
    return earliest === latest
      ? formatYear(earliest)
      : `${formatYear(earliest)} - ${formatYear(latest)}`;
  }

  if (earliest !== undefined) return `From ${formatYear(earliest)}`;
  if (latest !== undefined) return `Until ${formatYear(latest)}`;
  return null;
};

type FramedEntityGroup = {
  entity: ReferenceEntity;
  relationTypes: KnowledgeRelationType[];
  note?: string;
};

const TopicLineage = ({
  studyTopic,
  topicMap,
  subject,
}: {
  studyTopic: StudyTopicSummary;
  topicMap: Map<number, StudyTopicSummary>;
  subject: TopicSummary | null;
}) => {
  const path: Array<{ id: number; name: string; href: string }> = [];

  if (subject) {
    path.push({ id: subject.id, name: subject.name, href: `/subjects/${subject.id}` });
  }

  const ancestors: StudyTopicSummary[] = [];
  let currentParentId = studyTopic.parentTopicId;
  let guard = 0;

  while (currentParentId && guard < 16) {
    const parent = topicMap.get(currentParentId);
    if (!parent) break;
    ancestors.unshift(parent);
    currentParentId = parent.parentTopicId;
    guard += 1;
  }

  for (const ancestor of ancestors) {
    path.push({ id: ancestor.id, name: ancestor.name, href: `/topics/${ancestor.id}` });
  }

  path.push({ id: studyTopic.id, name: studyTopic.name, href: `/topics/${studyTopic.id}` });

  return (
    <div className="topic-page-lineage">
      {path.map((entry, index) => (
        <React.Fragment key={`${entry.href}-${entry.id}`}>
          <Link to={entry.href}>{entry.name}</Link>
          {index < path.length - 1 ? <span>/</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
};

const TopicPage: React.FC = () => {
  const { id } = useParams();
  const studyTopicId = Number(id);

  const [studyTopic, setStudyTopic] = useState<StudyTopicSummary | null>(null);
  const [subject, setSubject] = useState<TopicSummary | null>(null);
  const [siblingTopics, setSiblingTopics] = useState<StudyTopicSummary[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [allKnowledgeItems, setAllKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTopicEditor, setShowTopicEditor] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [showItemManager, setShowItemManager] = useState(false);
  const [loadingItemOptions, setLoadingItemOptions] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [itemManagerQuery, setItemManagerQuery] = useState('');
  const [showRelationComposer, setShowRelationComposer] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [topicForm, setTopicForm] = useState({
    description: '',
    name: '',
    summary: '',
  });
  const [relationForm, setRelationForm] = useState({
    toEntityId: '',
    relationType: 'about' as KnowledgeRelationType,
    note: '',
  });
  const deferredItemManagerQuery = useDeferredValue(itemManagerQuery);

  useEffect(() => {
    if (!Number.isInteger(studyTopicId) || studyTopicId <= 0) {
      setError('Invalid topic.');
      setLoading(false);
      return;
    }

    const loadTopicPage = async () => {
      try {
        const fetchedStudyTopic = await fetchStudyTopic(studyTopicId);
        const [
          fetchedSubjects,
          fetchedSiblingTopics,
          fetchedKnowledgeItems,
          fetchedReferenceEntities,
          fetchedRelations,
        ] = await Promise.all([
          fetchTopics(),
          fetchStudyTopics(fetchedStudyTopic.subjectId),
          fetchStudyTopicKnowledgeItems(studyTopicId),
          fetchReferenceEntities(),
          fetchStudyTopicRelations(studyTopicId),
        ]);

        setStudyTopic(fetchedStudyTopic);
        setSiblingTopics(fetchedSiblingTopics);
        setKnowledgeItems(fetchedKnowledgeItems);
        setReferenceEntities(fetchedReferenceEntities);
        setRelations(fetchedRelations);

        const fetchedSubject =
          fetchedSubjects.find((entry) => entry.id === fetchedStudyTopic.subjectId) ??
          (await fetchTopic(fetchedStudyTopic.subjectId));
        setSubject(fetchedSubject);
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load topic page.');
      } finally {
        setLoading(false);
      }
    };

    loadTopicPage();
  }, [studyTopicId]);

  const topicMap = useMemo(
    () => new Map(siblingTopics.map((entry) => [entry.id, entry])),
    [siblingTopics]
  );
  const parentTopic = useMemo(
    () => (studyTopic?.parentTopicId ? topicMap.get(studyTopic.parentTopicId) ?? null : null),
    [studyTopic?.parentTopicId, topicMap]
  );
  const childTopics = useMemo(
    () =>
      siblingTopics
        .filter((entry) => entry.parentTopicId === studyTopic?.id)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [studyTopic?.id, siblingTopics]
  );
  const assignedItemIds = useMemo(() => new Set(knowledgeItems.map((item) => item.id)), [knowledgeItems]);
  const availableKnowledgeItems = useMemo(
    () =>
      [...allKnowledgeItems]
        .filter((item) => !assignedItemIds.has(item.id))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [allKnowledgeItems, assignedItemIds]
  );
  const visibleAvailableKnowledgeItems = useMemo(() => {
    const query = deferredItemManagerQuery.trim().toLowerCase();
    if (!query) return availableKnowledgeItems;

    return availableKnowledgeItems.filter((item) =>
      [item.title, item.creator, item.sourceName, item.summary]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [availableKnowledgeItems, deferredItemManagerQuery]);
  const relationTargets = useMemo(
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
  const selectedRelationTarget = useMemo(
    () => relationTargets.find((entity) => String(entity.id) === relationForm.toEntityId) ?? null,
    [relationForm.toEntityId, relationTargets]
  );
  const relationPreset = useMemo(
    () => getStudyTopicRelationPreset(selectedRelationTarget?.kind),
    [selectedRelationTarget?.kind]
  );
  const relationCountsByKind = useMemo(() => {
    const counts = new Map<string, number>();
    for (const relation of relations) {
      const kind = relation.toEntityKind ?? 'other';
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return counts;
  }, [relations]);
  const framedEntityGroups = useMemo(() => {
    const grouped = new Map<number, FramedEntityGroup>();

    for (const relation of relations) {
      const entity = referenceEntityMap.get(relation.toEntityId);
      if (!entity) continue;

      const current = grouped.get(entity.id);
      if (current) {
        if (!current.relationTypes.includes(relation.relationType)) {
          current.relationTypes.push(relation.relationType);
        }
        if (!current.note && relation.note) {
          current.note = relation.note;
        }
        continue;
      }

      grouped.set(entity.id, {
        entity,
        relationTypes: [relation.relationType],
        note: relation.note,
      });
    }

    return [...grouped.values()].sort((left, right) => {
      const kindDifference =
        atlasKindOrder.indexOf(left.entity.kind) - atlasKindOrder.indexOf(right.entity.kind);
      if (kindDifference !== 0) return kindDifference;

      const titleDifference = left.entity.title.localeCompare(right.entity.title);
      if (titleDifference !== 0) return titleDifference;

      return left.entity.id - right.entity.id;
    });
  }, [referenceEntityMap, relations]);
  const formationFrameGroups = useMemo(
    () => framedEntityGroups.filter((entry) => entry.entity.kind === 'formation'),
    [framedEntityGroups]
  );
  const polityFrameGroups = useMemo(
    () => framedEntityGroups.filter((entry) => entry.entity.kind === 'polity'),
    [framedEntityGroups]
  );
  const personFrameGroups = useMemo(
    () => framedEntityGroups.filter((entry) => entry.entity.kind === 'person'),
    [framedEntityGroups]
  );
  const topicAtlasHorizon = useMemo(
    () => formatAtlasHorizon(framedEntityGroups.map((entry) => entry.entity)),
    [framedEntityGroups]
  );
  const formationSubtypeSummary = useMemo(() => {
    const counts = new Map<string, number>();

    for (const entry of formationFrameGroups) {
      const label =
        entry.entity.formationSubtype
          ? formationSubtypeLabels[entry.entity.formationSubtype]
          : formationSubtypeLabels.other;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`)
      .join(', ');
  }, [formationFrameGroups]);

  useEffect(() => {
    if (!studyTopic) return;

    setTopicForm({
      description: studyTopic.description ?? '',
      name: studyTopic.name,
      summary: studyTopic.summary ?? '',
    });
  }, [studyTopic]);

  useEffect(() => {
    if (!showItemManager || allKnowledgeItems.length > 0) return;

    let cancelled = false;

    const loadKnowledgeItems = async () => {
      setLoadingItemOptions(true);
      try {
        const fetchedKnowledgeItems = await fetchKnowledgeItems();
        if (!cancelled) {
          setAllKnowledgeItems(fetchedKnowledgeItems);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError('Failed to load items for this topic.');
        }
      } finally {
        if (!cancelled) {
          setLoadingItemOptions(false);
        }
      }
    };

    void loadKnowledgeItems();

    return () => {
      cancelled = true;
    };
  }, [allKnowledgeItems.length, showItemManager]);

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

  const handleSaveTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studyTopic || !topicForm.name.trim()) return;

    setSavingTopic(true);
    setError(null);

    try {
      const updatedTopic = await updateStudyTopic(studyTopic.id, {
        name: topicForm.name.trim(),
        summary: topicForm.summary.trim() || undefined,
        description: topicForm.description.trim() || undefined,
      });

      startTransition(() => {
        setStudyTopic(updatedTopic);
        setSiblingTopics((current) =>
          current.map((entry) => (entry.id === updatedTopic.id ? updatedTopic : entry))
        );
      });
      setShowTopicEditor(false);
    } catch (topicError) {
      console.error(topicError);
      setError(topicError instanceof Error ? topicError.message : 'Failed to save topic.');
    } finally {
      setSavingTopic(false);
    }
  };

  const handleCreateRelation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studyTopic || !relationForm.toEntityId) return;

    setSavingRelation(true);
    setError(null);

    try {
      const relation = await createStudyTopicRelation(studyTopic.id, {
        toEntityType: 'reference_entity',
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
        toEntityId: '',
        relationType: relationPreset.defaultRelationType,
        note: '',
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to connect topic to reference entity.');
    } finally {
      setSavingRelation(false);
    }
  };

  const handleDeleteRelation = async (relationId: number) => {
    if (!studyTopic) return;

    try {
      await deleteStudyTopicRelation(studyTopic.id, relationId);
      startTransition(() => {
        setRelations((current) => current.filter((relation) => relation.id !== relationId));
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to delete topic relation.');
    }
  };

  const handleAssignKnowledgeItem = async (knowledgeItem: KnowledgeItem) => {
    if (!studyTopic || assignedItemIds.has(knowledgeItem.id)) return;

    setAddingItemId(knowledgeItem.id);
    setError(null);

    try {
      await assignTopicToKnowledgeItem(knowledgeItem.id, studyTopic.id);

      startTransition(() => {
        setKnowledgeItems((current) =>
          current.some((entry) => entry.id === knowledgeItem.id)
            ? current
            : [...current, knowledgeItem].sort(
                (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
              )
        );
        setStudyTopic((current) =>
          current ? { ...current, itemCount: current.itemCount + 1 } : current
        );
        setSiblingTopics((current) =>
          current.map((entry) =>
            entry.id === studyTopic.id ? { ...entry, itemCount: entry.itemCount + 1 } : entry
          )
        );
      });
    } catch (assignmentError) {
      console.error(assignmentError);
      setError('Failed to assign item to this topic.');
    } finally {
      setAddingItemId(null);
    }
  };

  const handleRemoveKnowledgeItem = async (knowledgeItem: KnowledgeItem) => {
    if (!studyTopic) return;

    setRemovingItemId(knowledgeItem.id);
    setError(null);

    try {
      await removeTopicFromKnowledgeItem(knowledgeItem.id, studyTopic.id);

      startTransition(() => {
        setKnowledgeItems((current) => current.filter((entry) => entry.id !== knowledgeItem.id));
        setStudyTopic((current) =>
          current ? { ...current, itemCount: Math.max(0, current.itemCount - 1) } : current
        );
        setSiblingTopics((current) =>
          current.map((entry) =>
            entry.id === studyTopic.id ? { ...entry, itemCount: Math.max(0, entry.itemCount - 1) } : entry
          )
        );
      });
    } catch (removeError) {
      console.error(removeError);
      setError('Failed to remove item from this topic.');
    } finally {
      setRemovingItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="topic-page">
        <div className="topic-page-empty">Loading topic page...</div>
      </div>
    );
  }

  if (!studyTopic) {
    return (
      <div className="topic-page">
        <div className="topic-page-empty">{error || 'Topic not found.'}</div>
      </div>
    );
  }

  return (
    <div className="topic-page">
      <Link to={`/subjects/${studyTopic.subjectId}`} className="topic-page-back">
        Back to Subject
      </Link>

      <section className="topic-page-hero">
        <div className="topic-page-hero-main">
          <span className="topic-page-eyebrow">Topic Page</span>
          <h1>{studyTopic.name}</h1>
          <p>
            {studyTopic.summary ||
              studyTopic.description ||
              'A topic is the contextual layer beneath a subject. It is where items actually live.'}
          </p>
          <TopicLineage studyTopic={studyTopic} topicMap={topicMap} subject={subject} />
          <div className="topic-page-hero-meta">
            <Link to={`/subjects/${studyTopic.subjectId}`}>Subject: {subject?.name || studyTopic.subjectName}</Link>
            {parentTopic ? (
              <Link to={`/topics/${parentTopic.id}`}>Parent: {parentTopic.name}</Link>
            ) : (
              <span>Top-level topic in this subject</span>
            )}
            <span>{studyTopic.childTopicCount} child topic{studyTopic.childTopicCount === 1 ? '' : 's'}</span>
            <span>{studyTopic.itemCount} item{studyTopic.itemCount === 1 ? '' : 's'}</span>
            <span>{relations.length} linked entit{relations.length === 1 ? 'y' : 'ies'}</span>
            <span>Updated {formatDate(studyTopic.updatedAt)}</span>
          </div>
          <div className="topic-page-hero-actions">
            <button
              type="button"
              className="topic-page-secondary-button"
              onClick={() => setShowTopicEditor((current) => !current)}
            >
              {showTopicEditor ? 'Close topic editor' : 'Edit topic'}
            </button>
          </div>
          {showTopicEditor ? (
            <form className="topic-page-form topic-page-inline-panel" onSubmit={handleSaveTopic}>
              <div className="topic-page-form-row">
                <input
                  value={topicForm.name}
                  onChange={(event) =>
                    setTopicForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Topic name"
                />
              </div>
              <input
                value={topicForm.summary}
                onChange={(event) =>
                  setTopicForm((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                placeholder="Short topic summary"
              />
              <textarea
                value={topicForm.description}
                onChange={(event) =>
                  setTopicForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Longer description for the topic page"
              />
              <button type="submit" disabled={savingTopic}>
                {savingTopic ? 'Saving...' : 'Save topic'}
              </button>
            </form>
          ) : null}
          <div className="topic-page-overview-grid">
            <article className="topic-page-overview-card">
              <div className="topic-page-overview-label">
                <span className="topic-page-eyebrow">Placement</span>
                <PageHint text="Where this topic sits inside the current subject branch." />
              </div>
              <strong>{parentTopic ? parentTopic.name : 'Top-level topic'}</strong>
              <span className="topic-page-overview-meta">
                {parentTopic ? 'Nested branch' : 'Starts under the subject'}
              </span>
            </article>
            <article className="topic-page-overview-card">
              <div className="topic-page-overview-label">
                <span className="topic-page-eyebrow">Study Material</span>
                <PageHint text="Concrete items currently assigned to this topic." />
              </div>
              <strong>{knowledgeItems.length} item{knowledgeItems.length === 1 ? '' : 's'}</strong>
              <span className="topic-page-overview-meta">Assigned here</span>
            </article>
            <article className="topic-page-overview-card">
              <div className="topic-page-overview-label">
                <span className="topic-page-eyebrow">Subtopics</span>
                <PageHint text="Child topics already growing beneath this one." />
              </div>
              <strong>{childTopics.length} child topic{childTopics.length === 1 ? '' : 's'}</strong>
              <span className="topic-page-overview-meta">Branches below</span>
            </article>
            <article className="topic-page-overview-card">
              <div className="topic-page-overview-label">
                <span className="topic-page-eyebrow">Historical Frame</span>
                <PageHint text="People, polities, and formations linked to contextualize the topic." />
              </div>
              <strong>{relations.length} linked entit{relations.length === 1 ? 'y' : 'ies'}</strong>
              <span className="topic-page-overview-meta">
                {relations.length > 0
                  ? topicAtlasHorizon ||
                    [...relationCountsByKind.entries()]
                      .map(([kind, count]) => `${count} ${kind}`)
                      .join(', ')
                  : 'Not linked yet'}
              </span>
            </article>
          </div>
        </div>
      </section>

      {error ? <div className="topic-page-error">{error}</div> : null}

      <div className="topic-page-main">
          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Study Material</span>
                <h2>
                  Items in this topic
                  <PageHint text="The concrete reading and viewing cluster assigned to this topic." />
                  <span className="topic-page-count-badge">{knowledgeItems.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="topic-page-secondary-button"
                onClick={() => setShowItemManager((current) => !current)}
              >
                {showItemManager ? 'Close' : 'Manage items'}
              </button>
            </div>

            {showItemManager ? (
              <div className="topic-page-inline-panel topic-page-manager-stack">
                <section className="topic-page-manager-section">
                  <div className="topic-page-subsection-head">
                    <h3>
                      Assigned here
                      <PageHint text="Items already placed in this topic. Remove them here if the fit is wrong." />
                    </h3>
                    <span className="topic-page-count-badge">{knowledgeItems.length}</span>
                  </div>
                  {knowledgeItems.length === 0 ? (
                    <div className="topic-page-empty">No items are assigned to this topic yet.</div>
                  ) : (
                    <div className="topic-page-manager-list">
                      {knowledgeItems.map((knowledgeItem) => (
                        <article key={`assigned-${knowledgeItem.id}`} className="topic-page-manager-row">
                          <div className="topic-page-manager-copy">
                            <Link to={`/knowledge/${knowledgeItem.id}`} className="topic-page-item-link">
                              <strong>{knowledgeItem.title}</strong>
                            </Link>
                            <div className="topic-page-item-meta">
                              {knowledgeItem.creator ? <span>{knowledgeItem.creator}</span> : null}
                              {knowledgeItem.publishedYear ? <span>{knowledgeItem.publishedYear}</span> : null}
                              <span>{knowledgeItem.kind}</span>
                              <span>{knowledgeItem.status}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="topic-page-danger-button"
                            onClick={() => void handleRemoveKnowledgeItem(knowledgeItem)}
                            disabled={removingItemId === knowledgeItem.id}
                          >
                            {removingItemId === knowledgeItem.id ? 'Removing...' : 'Remove'}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="topic-page-manager-section">
                  <div className="topic-page-subsection-head">
                    <h3>
                      Add existing item
                      <PageHint text="Search the current item catalog and place an existing item into this topic." />
                    </h3>
                    <span className="topic-page-count-badge">{visibleAvailableKnowledgeItems.length}</span>
                  </div>
                  <input
                    value={itemManagerQuery}
                    onChange={(event) => setItemManagerQuery(event.target.value)}
                    placeholder="Search existing items by title, creator, source, or summary"
                  />
                  {loadingItemOptions ? (
                    <div className="topic-page-empty">Loading the item catalog...</div>
                  ) : visibleAvailableKnowledgeItems.length === 0 ? (
                    <div className="topic-page-empty">
                      {availableKnowledgeItems.length === 0
                        ? 'Everything in the current item catalog is already assigned here.'
                        : 'No unassigned items match the current search.'}
                    </div>
                  ) : (
                    <div className="topic-page-manager-list">
                      {visibleAvailableKnowledgeItems.slice(0, 12).map((knowledgeItem) => (
                        <article key={`candidate-${knowledgeItem.id}`} className="topic-page-manager-row">
                          <div className="topic-page-manager-copy">
                            <Link to={`/knowledge/${knowledgeItem.id}`} className="topic-page-item-link">
                              <strong>{knowledgeItem.title}</strong>
                            </Link>
                            <div className="topic-page-item-meta">
                              {knowledgeItem.creator ? <span>{knowledgeItem.creator}</span> : null}
                              {knowledgeItem.publishedYear ? <span>{knowledgeItem.publishedYear}</span> : null}
                              <span>{knowledgeItem.kind}</span>
                              <span>{knowledgeItem.status}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="topic-page-card-button"
                            onClick={() => void handleAssignKnowledgeItem(knowledgeItem)}
                            disabled={addingItemId !== null}
                          >
                            {addingItemId === knowledgeItem.id ? 'Adding...' : 'Add'}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}

            {knowledgeItems.length === 0 ? (
              <div className="topic-page-empty">No items are assigned to this topic yet.</div>
            ) : (
              <div className="topic-page-item-list">
                {knowledgeItems.map((knowledgeItem) => (
                  <Link key={knowledgeItem.id} to={`/knowledge/${knowledgeItem.id}`} className="topic-page-item-card">
                    <div className="topic-page-item-top">
                      <div className="topic-page-item-badges">
                        <span>{knowledgeItem.kind}</span>
                        <span>{knowledgeItem.status}</span>
                      </div>
                      <strong>{knowledgeItem.title}</strong>
                    </div>
                    <div className="topic-page-item-meta">
                      {knowledgeItem.creator ? <span>{knowledgeItem.creator}</span> : null}
                      {knowledgeItem.publishedYear ? <span>{knowledgeItem.publishedYear}</span> : null}
                      <span>Updated {formatDate(knowledgeItem.updatedAt)}</span>
                    </div>
                    {knowledgeItem.summary ? <p>{knowledgeItem.summary}</p> : null}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Historical Frame</span>
                <h2>
                  Context composition
                  <PageHint text="Add people, polities, or formations to make the topic historically or geographically specific." />
                  <span className="topic-page-count-badge">{relations.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className="topic-page-secondary-button"
                onClick={() => setShowRelationComposer((current) => !current)}
              >
                {showRelationComposer ? 'Close' : 'Link entity'}
              </button>
            </div>

            <div className="topic-page-overview-grid topic-page-atlas-overview-grid">
              <article className="topic-page-overview-card">
                <div className="topic-page-overview-label">
                  <span className="topic-page-eyebrow">Formations</span>
                  <PageHint text="The broader civilizational or era frames currently shaping this topic." />
                </div>
                <strong>{formationFrameGroups.length || 'None'}</strong>
                <span className="topic-page-overview-meta">
                  {formationFrameGroups.length > 0 ? formationSubtypeSummary : 'No formation frame yet'}
                </span>
              </article>
              <article className="topic-page-overview-card">
                <div className="topic-page-overview-label">
                  <span className="topic-page-eyebrow">Polity Scope</span>
                  <PageHint text="Named built-in or curated polities that localize the topic historically or geographically." />
                </div>
                <strong>{polityFrameGroups.length || 'None'}</strong>
                <span className="topic-page-overview-meta">
                  {polityFrameGroups.length > 0
                    ? polityFrameGroups.slice(0, 2).map((entry) => entry.entity.title).join(', ')
                    : 'No polity scope yet'}
                </span>
              </article>
              <article className="topic-page-overview-card">
                <div className="topic-page-overview-label">
                  <span className="topic-page-eyebrow">People</span>
                  <PageHint text="People linked because the topic centers on them or depends on them historically." />
                </div>
                <strong>{personFrameGroups.length || 'None'}</strong>
                <span className="topic-page-overview-meta">
                  {personFrameGroups.length > 0
                    ? personFrameGroups.slice(0, 2).map((entry) => entry.entity.title).join(', ')
                    : 'No people linked yet'}
                </span>
              </article>
              <article className="topic-page-overview-card">
                <div className="topic-page-overview-label">
                  <span className="topic-page-eyebrow">Time Horizon</span>
                  <PageHint text="The earliest and latest dates implied by the currently linked atlas entities." />
                </div>
                <strong>{topicAtlasHorizon || 'Open'}</strong>
                <span className="topic-page-overview-meta">
                  {topicAtlasHorizon ? 'Derived from linked entities' : 'No dated atlas frame yet'}
                </span>
              </article>
            </div>

            {framedEntityGroups.length > 0 ? (
              <div className="topic-page-subsection-stack topic-page-atlas-subsection-stack">
                {formationFrameGroups.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        Formation frame
                        <PageHint text="The larger civilizational or era structures currently framing the topic." />
                      </h3>
                      <span className="topic-page-count-badge">{formationFrameGroups.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {formationFrameGroups.map((entry) => (
                        <article key={`formation-frame-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>{formatEntityFrameLabel(entry.entity)}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                            {entry.relationTypes.map((relationType) => (
                              <span key={`${entry.entity.id}-${relationType}`}>
                                {formatRelationType(relationType)}
                              </span>
                            ))}
                          </div>
                          {entry.entity.summary || entry.note ? <p>{entry.entity.summary || entry.note}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {polityFrameGroups.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        Polity scope
                        <PageHint text="Named polities that place the topic into a more specific historical-geographic setting." />
                      </h3>
                      <span className="topic-page-count-badge">{polityFrameGroups.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {polityFrameGroups.map((entry) => (
                        <article key={`polity-frame-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>{formatEntityFrameLabel(entry.entity)}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                            {entry.relationTypes.map((relationType) => (
                              <span key={`${entry.entity.id}-${relationType}`}>
                                {formatRelationType(relationType)}
                              </span>
                            ))}
                          </div>
                          {entry.entity.summary || entry.note ? <p>{entry.entity.summary || entry.note}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {personFrameGroups.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        People in frame
                        <PageHint text="People linked because the topic centers on them or depends on them historically." />
                      </h3>
                      <span className="topic-page-count-badge">{personFrameGroups.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {personFrameGroups.map((entry) => (
                        <article key={`person-frame-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>{formatEntityFrameLabel(entry.entity)}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                            {entry.relationTypes.map((relationType) => (
                              <span key={`${entry.entity.id}-${relationType}`}>
                                {formatRelationType(relationType)}
                              </span>
                            ))}
                          </div>
                          {entry.entity.summary || entry.note ? <p>{entry.entity.summary || entry.note}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {showRelationComposer ? (
              <form className="topic-page-form topic-page-inline-panel" onSubmit={handleCreateRelation}>
                <div className="topic-page-form-row topic-page-form-row-split">
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
                    {relationTargets.map((entity) => {
                      const timespan = formatReferenceTimespan(entity);

                      return (
                        <option key={entity.id} value={entity.id}>
                          {entity.title}
                          {timespan ? ` (${entity.kind}, ${timespan})` : ` (${entity.kind})`}
                        </option>
                      );
                    })}
                  </select>
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
                <div className="topic-page-inline-meta">
                  <PageHint text={relationPreset.helperText} />
                  <span>Relation guidance</span>
                </div>
                <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                  {savingRelation ? 'Linking...' : 'Link entity'}
                </button>
              </form>
            ) : null}

            {relations.length === 0 ? (
              <div className="topic-page-empty">No linked reference entities yet.</div>
            ) : (
              <div className="topic-page-item-list">
                {relations.map((relation) => (
                  <article key={relation.id} className="topic-page-item-card">
                    <div className="topic-page-item-top">
                      <div className="topic-page-item-badges">
                        <span>{formatRelationType(relation.relationType)}</span>
                        {relation.toEntityKind ? <span>{relation.toEntityKind}</span> : null}
                      </div>
                      <Link to={`/entities/${relation.toEntityId}`} className="topic-page-item-link">
                        <strong>{relation.toEntityTitle || `Entity #${relation.toEntityId}`}</strong>
                      </Link>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                    <div className="topic-page-item-actions">
                      <span>Linked {formatDate(relation.createdAt)}</span>
                      <button type="button" onClick={() => handleDeleteRelation(relation.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Branches</span>
                <h2>
                  Child topics
                  <PageHint text="Browse the narrower branches that already exist under this topic. Branch creation stays on the subject page." />
                  <span className="topic-page-count-badge">{childTopics.length}</span>
                </h2>
              </div>
            </div>

            {childTopics.length === 0 ? (
              <div className="topic-page-empty">No child topics yet.</div>
            ) : (
              <div className="topic-page-card-grid">
                {childTopics.map((childTopic) => (
                  <Link key={childTopic.id} to={`/topics/${childTopic.id}`} className="topic-page-card">
                    <strong>{childTopic.name}</strong>
                    <div className="topic-page-card-meta">
                      <span>{childTopic.itemCount} contained items</span>
                      <span>{childTopic.childTopicCount} child topics</span>
                    </div>
                    {childTopic.summary || childTopic.description ? <p>{childTopic.summary || childTopic.description}</p> : null}
                  </Link>
                ))}
              </div>
            )}
          </section>
      </div>
    </div>
  );
};

export default TopicPage;
