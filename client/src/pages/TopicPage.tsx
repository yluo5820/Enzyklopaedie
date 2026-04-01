import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  TopicSummary,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  createTopic,
  createTopicRelation,
  deleteTopicRelation,
  fetchReferenceEntities,
  fetchTopic,
  fetchTopicKnowledgeItems,
  fetchTopicRelations,
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

const TopicPage: React.FC = () => {
  const { id } = useParams();
  const topicId = Number(id);

  const [topic, setTopic] = useState<TopicSummary | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
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
    if (!Number.isInteger(topicId) || topicId <= 0) {
      setError('Invalid topic.');
      setLoading(false);
      return;
    }

    const loadTopicPage = async () => {
      try {
        const [fetchedTopic, fetchedTopics, fetchedKnowledgeItems, fetchedReferenceEntities, fetchedRelations] = await Promise.all([
          fetchTopic(topicId),
          fetchTopics(),
          fetchTopicKnowledgeItems(topicId),
          fetchReferenceEntities(),
          fetchTopicRelations(topicId),
        ]);

        setTopic(fetchedTopic);
        setTopics(fetchedTopics);
        setKnowledgeItems(fetchedKnowledgeItems);
        setReferenceEntities(fetchedReferenceEntities);
        setRelations(fetchedRelations);
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load topic page.');
      } finally {
        setLoading(false);
      }
    };

    loadTopicPage();
  }, [topicId]);

  const topicMap = useMemo(() => new Map(topics.map((entry) => [entry.id, entry])), [topics]);
  const childTopics = useMemo(
    () => topics.filter((entry) => entry.parentTopicId === topic?.id).sort((left, right) => left.name.localeCompare(right.name)),
    [topic?.id, topics]
  );
  const parentTopic = useMemo(
    () => (topic?.parentTopicId ? topicMap.get(topic.parentTopicId) ?? null : null),
    [topic?.parentTopicId, topicMap]
  );
  const relationTargets = useMemo(
    () => [...referenceEntities].sort((left, right) => left.title.localeCompare(right.title)),
    [referenceEntities]
  );
  const lineage = useMemo(() => {
    if (!topic) return [];

    const path: TopicSummary[] = [topic];
    let currentParentId = topic.parentTopicId;
    let guard = 0;

    while (currentParentId && guard < 16) {
      const parent = topicMap.get(currentParentId);
      if (!parent) break;
      path.unshift(parent);
      currentParentId = parent.parentTopicId;
      guard += 1;
    }

    return path;
  }, [topic, topicMap]);

  const handleCreateChildTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topic || !childTopicForm.name.trim()) return;

    setCreatingChildTopic(true);
    setError(null);

    try {
      const createdTopic = await createTopic({
        name: childTopicForm.name.trim(),
        parentTopicId: topic.id,
        description: childTopicForm.description.trim() || undefined,
      });

      const nextTopic: TopicSummary = {
        ...createdTopic,
        knowledgeItemCount: 0,
        childTopicCount: 0,
      };

      startTransition(() => {
        setTopics((current) =>
          current.some((entry) => entry.id === nextTopic.id) ? current : [...current, nextTopic]
        );
        setTopic((current) =>
          current && current.id === topic.id
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
    if (!topic || !relationForm.toEntityId) return;

    setSavingRelation(true);
    setError(null);

    try {
      const relation = await createTopicRelation(topic.id, {
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
    if (!topic) return;

    try {
      await deleteTopicRelation(topic.id, relationId);
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

  if (!topic) {
    return (
      <div className="topic-page">
        <div className="topic-page-empty">{error || 'Topic not found.'}</div>
      </div>
    );
  }

  return (
    <div className="topic-page">
      <Link to="/topics" className="topic-page-back">
        Back to Topic Tree
      </Link>

      <section className="topic-page-hero">
        <div>
          <span className="topic-page-eyebrow">Topic Page</span>
          <h1>{topic.name}</h1>
          <p>
            {topic.description ||
              'This topic page is the curated home for one discipline or sub-discipline in the encyclopedia.'}
          </p>
        </div>
        <div className="topic-page-stats">
          <div className="topic-page-stat">
            <strong>{topic.knowledgeItemCount}</strong>
            <span>Direct knowledge items</span>
          </div>
          <div className="topic-page-stat">
            <strong>{topic.childTopicCount}</strong>
            <span>Child topics</span>
          </div>
          <div className="topic-page-stat">
            <strong>{formatDate(topic.updatedAt)}</strong>
            <span>Last updated</span>
          </div>
        </div>
      </section>

      {error ? <div className="topic-page-error">{error}</div> : null}

      <div className="topic-page-grid">
        <aside className="topic-page-panel topic-page-sidebar">
          <span className="topic-page-eyebrow">Lineage</span>
          <h2>Where this sits</h2>
          <div className="topic-page-lineage">
            {lineage.map((entry, index) => (
              <React.Fragment key={entry.id}>
                <Link to={`/topics/${entry.id}`}>{entry.name}</Link>
                {index < lineage.length - 1 ? <span>/</span> : null}
              </React.Fragment>
            ))}
          </div>

          <div className="topic-page-side-section">
            <h3>Parent</h3>
            {parentTopic ? (
              <Link to={`/topics/${parentTopic.id}`} className="topic-page-side-card">
                <strong>{parentTopic.name}</strong>
                <span>{parentTopic.knowledgeItemCount} direct items</span>
              </Link>
            ) : (
              <div className="topic-page-empty">Ontology is the root and has no parent.</div>
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
                placeholder="Name the next branch"
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
                  <Link key={childTopic.id} to={`/topics/${childTopic.id}`} className="topic-page-card">
                    <strong>{childTopic.name}</strong>
                    <span>{childTopic.knowledgeItemCount} direct items</span>
                    <span>{childTopic.childTopicCount} child topics</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Reference Atlas</span>
                <h2>Linked entities</h2>
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

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Knowledge</span>
                <h2>Attached items</h2>
              </div>
            </div>

            {knowledgeItems.length === 0 ? (
              <div className="topic-page-empty">No knowledge items are attached directly to this topic yet.</div>
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
        </div>
      </div>
    </div>
  );
};

export default TopicPage;
