import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
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
  createTopicRelation as createStudyTopicRelation,
  deleteTopicRelation as deleteStudyTopicRelation,
  fetchReferenceEntities,
  fetchSubject as fetchTopic,
  fetchSubjects as fetchTopics,
  fetchTopic as fetchStudyTopic,
  fetchTopicKnowledgeItems as fetchStudyTopicKnowledgeItems,
  fetchTopicRelations as fetchStudyTopicRelations,
  fetchTopics as fetchStudyTopics,
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
  'era',
  'nation',
  'civilization',
  'place',
];

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

  if (targetEntityKind === 'era') {
    return {
      allowedRelationTypes: ['during', 'about', 'related_to'],
      defaultRelationType: 'during',
      helperText:
        'Use eras to temporalize the topic. Choose during when the topic belongs to a period, or about when the period is itself the explicit object.',
      notePlaceholder: 'Optional note about the period context',
      targetPrompt: 'Choose an era',
    };
  }

  if (targetEntityKind === 'nation' || targetEntityKind === 'place') {
    return {
      allowedRelationTypes: ['located_in', 'about', 'related_to'],
      defaultRelationType: 'located_in',
      helperText:
        'Use nations and places to localize the topic in geography or political space. Choose about only when the entity is itself the object of study.',
      notePlaceholder: 'Optional note about this place or polity',
      targetPrompt: targetEntityKind === 'nation' ? 'Choose a nation' : 'Choose a place',
    };
  }

  if (targetEntityKind === 'civilization') {
    return {
      allowedRelationTypes: ['part_of', 'about', 'related_to'],
      defaultRelationType: 'part_of',
      helperText:
        'Use civilizations as the broad spatial-temporal horizon around the topic, or as the explicit civilizational subject.',
      notePlaceholder: 'Optional note about this civilizational frame',
      targetPrompt: 'Choose a civilization',
    };
  }

  return {
    allowedRelationTypes: ['about', 'during', 'located_in', 'part_of', 'related_to'],
    defaultRelationType: 'about',
    helperText:
      'Choose the reference entity first. The relation verbs will narrow once the topic’s historical or geographic frame is clear.',
    notePlaceholder: 'Optional note about why this entity matters here',
    targetPrompt: 'Choose a person, era, nation, civilization, or place',
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

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
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTopicEditor, setShowTopicEditor] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
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

  useEffect(() => {
    if (!studyTopic) return;

    setTopicForm({
      description: studyTopic.description ?? '',
      name: studyTopic.name,
      summary: studyTopic.summary ?? '',
    });
  }, [studyTopic]);

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
              <span className="topic-page-eyebrow">Placement</span>
              <strong>{parentTopic ? parentTopic.name : 'Top-level topic'}</strong>
              <p>{parentTopic ? 'This topic lives inside a larger branch.' : 'This topic begins a branch directly under the subject.'}</p>
            </article>
            <article className="topic-page-overview-card">
              <span className="topic-page-eyebrow">Study Material</span>
              <strong>{knowledgeItems.length} item{knowledgeItems.length === 1 ? '' : 's'}</strong>
              <p>These are the concrete works currently placed in this topic.</p>
            </article>
            <article className="topic-page-overview-card">
              <span className="topic-page-eyebrow">Subtopics</span>
              <strong>{childTopics.length} child topic{childTopics.length === 1 ? '' : 's'}</strong>
              <p>Browse the narrower branches already growing beneath this topic.</p>
            </article>
            <article className="topic-page-overview-card">
              <span className="topic-page-eyebrow">Historical Frame</span>
              <strong>{relations.length} linked entit{relations.length === 1 ? 'y' : 'ies'}</strong>
              <p>
                {relations.length > 0
                  ? [...relationCountsByKind.entries()]
                      .map(([kind, count]) => `${count} ${kind}`)
                      .join(', ')
                  : 'No people, eras, nations, civilizations, or places are linked yet.'}
              </p>
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
                  <span className="topic-page-count-badge">{knowledgeItems.length}</span>
                </h2>
                <p className="topic-page-copy">
                  This is the concrete reading and viewing list that gives the topic its substance.
                </p>
              </div>
            </div>

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
                  <span className="topic-page-count-badge">{relations.length}</span>
                </h2>
                <p className="topic-page-copy">
                  This is where a topic becomes historically or geographically specific. Keep the branch conceptual; use entities to add era, place, polity, civilization, or person.
                </p>
              </div>
              <button
                type="button"
                className="topic-page-secondary-button"
                onClick={() => setShowRelationComposer((current) => !current)}
              >
                {showRelationComposer ? 'Close' : 'Link entity'}
              </button>
            </div>

            {showRelationComposer ? (
              <form className="topic-page-form topic-page-inline-panel" onSubmit={handleCreateRelation}>
                <div className="topic-page-note">
                  <strong>Current guidance</strong>
                  <span>{relationPreset.helperText}</span>
                </div>
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
                  <span className="topic-page-count-badge">{childTopics.length}</span>
                </h2>
                <p className="topic-page-copy">
                  Topic branching is managed from the subject page. Use this section to navigate the
                  subtopics that already live under the current topic.
                </p>
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
