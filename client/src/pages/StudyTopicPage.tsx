import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  StudyTopicSummary,
  TopicSummary,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  createStudyTopicRelation,
  createStudyTopic,
  deleteStudyTopicRelation,
  fetchReferenceEntities,
  fetchStudyTopic,
  fetchStudyTopicKnowledgeItems,
  fetchStudyTopicRelations,
  fetchStudyTopics,
  fetchTopic,
  fetchTopics,
} from '../api';
import './TopicPage.css';

const relationTypeOptions: KnowledgeRelationType[] = ['about', 'related_to', 'during', 'located_in', 'part_of'];

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
    path.push({ id: subject.id, name: subject.name, href: `/topics/${subject.id}` });
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
    path.push({ id: ancestor.id, name: ancestor.name, href: `/study-topics/${ancestor.id}` });
  }

  path.push({ id: studyTopic.id, name: studyTopic.name, href: `/study-topics/${studyTopic.id}` });

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

const StudyTopicPage: React.FC = () => {
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
  const [creatingChildTopic, setCreatingChildTopic] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [childTopicForm, setChildTopicForm] = useState({
    name: '',
    description: '',
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
    () => [...referenceEntities].sort((left, right) => left.title.localeCompare(right.title)),
    [referenceEntities]
  );

  const handleCreateChildTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studyTopic || !childTopicForm.name.trim()) return;

    setCreatingChildTopic(true);
    setError(null);

    try {
      const createdTopic = await createStudyTopic({
        subjectId: studyTopic.subjectId,
        parentTopicId: studyTopic.id,
        name: childTopicForm.name.trim(),
        description: childTopicForm.description.trim() || undefined,
      });

      startTransition(() => {
        setSiblingTopics((current) =>
          current.some((entry) => entry.id === createdTopic.id) ? current : [...current, createdTopic]
        );
        setStudyTopic((current) =>
          current && current.id === studyTopic.id
            ? { ...current, childTopicCount: current.childTopicCount + 1 }
            : current
        );
      });

      setChildTopicForm({
        name: '',
        description: '',
      });
    } catch (createError) {
      console.error(createError);
      setError('Failed to create child topic.');
    } finally {
      setCreatingChildTopic(false);
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
        relationType: 'about',
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
      <Link to={`/topics/${studyTopic.subjectId}`} className="topic-page-back">
        Back to Subject
      </Link>

      <section className="topic-page-hero">
        <div>
          <span className="topic-page-eyebrow">Topic Page</span>
          <h1>{studyTopic.name}</h1>
          <p>
            {studyTopic.summary ||
              studyTopic.description ||
              'A topic is the contextual layer beneath a subject. It is where items actually live.'}
          </p>
        </div>
        <div className="topic-page-stats">
          <div className="topic-page-stat">
            <strong>{studyTopic.itemCount}</strong>
            <span>Contained items</span>
          </div>
          <div className="topic-page-stat">
            <strong>{studyTopic.childTopicCount}</strong>
            <span>Child topics</span>
          </div>
          <div className="topic-page-stat">
            <strong>{subject?.name || studyTopic.subjectName}</strong>
            <span>Subject</span>
          </div>
          <div className="topic-page-stat">
            <strong>{formatDate(studyTopic.updatedAt)}</strong>
            <span>Last updated</span>
          </div>
        </div>
      </section>

      {error ? <div className="topic-page-error">{error}</div> : null}

      <div className="topic-page-grid">
        <aside className="topic-page-panel topic-page-sidebar">
          <span className="topic-page-eyebrow">Lineage</span>
          <h2>Where this topic sits</h2>
          <TopicLineage studyTopic={studyTopic} topicMap={topicMap} subject={subject} />

          <div className="topic-page-side-section">
            <h3>Subject</h3>
            <Link to={`/topics/${studyTopic.subjectId}`} className="topic-page-side-card">
              <strong>{subject?.name || studyTopic.subjectName}</strong>
              <span>{subject?.topicCount ?? siblingTopics.length} contained topics</span>
            </Link>
          </div>

          <div className="topic-page-side-section">
            <h3>Parent topic</h3>
            {parentTopic ? (
              <Link to={`/study-topics/${parentTopic.id}`} className="topic-page-side-card">
                <strong>{parentTopic.name}</strong>
                <span>{parentTopic.itemCount} contained items</span>
              </Link>
            ) : (
              <div className="topic-page-empty">This is a top-level topic inside its subject.</div>
            )}
          </div>

          <div className="topic-page-side-section">
            <h3>Create child topic</h3>
            <form className="topic-page-form" onSubmit={handleCreateChildTopic}>
              <input
                value={childTopicForm.name}
                onChange={(event) =>
                  setChildTopicForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Name the next topic"
              />
              <textarea
                value={childTopicForm.description}
                onChange={(event) =>
                  setChildTopicForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional description"
              />
              <button type="submit" disabled={creatingChildTopic}>
                {creatingChildTopic ? 'Creating...' : 'Create child topic'}
              </button>
            </form>
          </div>
        </aside>

        <div className="topic-page-main">
          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Branches</span>
                <h2>Child topics</h2>
              </div>
            </div>

            {childTopics.length === 0 ? (
              <div className="topic-page-empty">No child topics yet.</div>
            ) : (
              <div className="topic-page-card-grid">
                {childTopics.map((childTopic) => (
                  <Link key={childTopic.id} to={`/study-topics/${childTopic.id}`} className="topic-page-card">
                    <strong>{childTopic.name}</strong>
                    <span>{childTopic.itemCount} contained items</span>
                    <span>{childTopic.childTopicCount} child topics</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Contained Items</span>
                <h2>Items in this topic</h2>
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
                <span className="topic-page-eyebrow">Reference Atlas</span>
                <h2>Reference context</h2>
              </div>
            </div>

            <form className="topic-page-form" onSubmit={handleCreateRelation}>
              <select
                value={relationForm.relationType}
                onChange={(event) =>
                  setRelationForm((current) => ({
                    ...current,
                    relationType: event.target.value as KnowledgeRelationType,
                  }))
                }
              >
                {relationTypeOptions.map((relationType) => (
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
                <option value="">Choose a person, nation, civilization, era, or place</option>
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
              <input
                value={relationForm.note}
                onChange={(event) =>
                  setRelationForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Optional note about why this entity matters here"
              />
              <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                {savingRelation ? 'Linking...' : 'Link entity'}
              </button>
            </form>

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
        </div>
      </div>
    </div>
  );
};

export default StudyTopicPage;
