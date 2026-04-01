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
  Topic,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  assignTopicToKnowledgeItem,
  createKnowledgeNote,
  createKnowledgeRelation,
  createKnowledgeReview,
  createKnowledgeTask,
  createTopic,
  deleteKnowledgeNote,
  deleteKnowledgeRelation,
  deleteKnowledgeReview,
  deleteKnowledgeTask,
  fetchKnowledgeItem,
  fetchKnowledgeItems,
  fetchKnowledgeItemTopics,
  fetchKnowledgeNotes,
  fetchKnowledgeRelations,
  fetchKnowledgeReviews,
  fetchKnowledgeTasks,
  fetchReferenceEntities,
  fetchTopics,
  removeTopicFromKnowledgeItem,
  updateKnowledgeItem,
  updateKnowledgeTask,
} from '../api';
import './KnowledgeDetailPage.css';

const itemStatusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];
const taskStatusOptions: KnowledgeTaskStatus[] = ['todo', 'doing', 'done', 'archived'];
const relationTypeOptions: KnowledgeRelationType[] = [
  'created_by',
  'related_to',
  'about',
  'references',
  'influenced_by',
  'part_of',
  'located_in',
  'during',
];

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

const formatReferenceTimespan = (entity: ReferenceEntity) => {
  const start = formatYear(entity.startYear);
  const end = formatYear(entity.endYear);

  if (start && end) return `${start} - ${end}`;
  return start || end || null;
};

const buildRelationHref = (relation: KnowledgeRelationDetail) => {
  if (relation.toEntityType === 'knowledge_item') return `/knowledge/${relation.toEntityId}`;
  if (relation.toEntityType === 'reference_entity') return `/entities/${relation.toEntityId}`;
  if (relation.toEntityType === 'topic') return `/topics/${relation.toEntityId}`;
  return null;
};

const orderTopics = (topics: Topic[]) => {
  const children = new Map<number | null, Topic[]>();

  for (const topic of topics) {
    const key = topic.parentTopicId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(topic);
    children.set(key, branch);
  }

  for (const branch of children.values()) {
    branch.sort((left, right) => left.name.localeCompare(right.name));
  }

  const ordered: Array<{ topic: Topic; depth: number }> = [];
  const visit = (parentTopicId: number | null, depth: number) => {
    for (const topic of children.get(parentTopicId) ?? []) {
      ordered.push({ topic, depth });
      visit(topic.id, depth + 1);
    }
  };

  visit(null, 0);
  return ordered;
};

const buildTopicPath = (topic: Topic, topicMap: Map<number, Topic>) => {
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

  return parts.join(' / ');
};

const KnowledgeDetailPage: React.FC = () => {
  const { id } = useParams();
  const knowledgeItemId = Number(id);

  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [itemTopics, setItemTopics] = useState<Topic[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [tasks, setTasks] = useState<KnowledgeTask[]>([]);
  const [reviews, setReviews] = useState<KnowledgeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [savingTopicAssignment, setSavingTopicAssignment] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [newTopicForm, setNewTopicForm] = useState({
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

  useEffect(() => {
    if (!Number.isInteger(knowledgeItemId) || knowledgeItemId <= 0) {
      setError('Invalid knowledge item.');
      setLoading(false);
      return;
    }

    const loadDetail = async () => {
      try {
        const [
          fetchedItem,
          fetchedItems,
          fetchedReferenceEntities,
          fetchedTopics,
          fetchedItemTopics,
          fetchedRelations,
          fetchedNotes,
          fetchedTasks,
          fetchedReviews,
        ] = await Promise.all([
          fetchKnowledgeItem(knowledgeItemId),
          fetchKnowledgeItems(),
          fetchReferenceEntities(),
          fetchTopics(),
          fetchKnowledgeItemTopics(knowledgeItemId),
          fetchKnowledgeRelations(knowledgeItemId),
          fetchKnowledgeNotes(knowledgeItemId),
          fetchKnowledgeTasks(knowledgeItemId),
          fetchKnowledgeReviews(knowledgeItemId),
        ]);

        setItem(fetchedItem);
        setKnowledgeItems(fetchedItems);
        setReferenceEntities(fetchedReferenceEntities);
        setAllTopics(fetchedTopics);
        setItemTopics(fetchedItemTopics);
        setRelations(fetchedRelations);
        setNotes(fetchedNotes);
        setTasks(fetchedTasks);
        setReviews(fetchedReviews);
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load the knowledge item detail.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [knowledgeItemId]);

  const topicMap = useMemo(() => new Map(allTopics.map((topic) => [topic.id, topic])), [allTopics]);
  const orderedTopics = useMemo(() => orderTopics(allTopics), [allTopics]);
  const assignedTopicIds = useMemo(() => new Set(itemTopics.map((topic) => topic.id)), [itemTopics]);
  const assignableTopics = useMemo(
    () => orderedTopics.filter(({ topic }) => !assignedTopicIds.has(topic.id)),
    [assignedTopicIds, orderedTopics]
  );
  const relationTargets = useMemo(
    () => knowledgeItems.filter((candidate) => candidate.id !== item?.id),
    [item?.id, knowledgeItems]
  );
  const relationReferenceTargets = useMemo(
    () => [...referenceEntities].sort((left, right) => left.title.localeCompare(right.title)),
    [referenceEntities]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'done').length,
    [tasks]
  );

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
      setError('Failed to update knowledge item status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAttachTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !selectedTopicId) return;

    setSavingTopicAssignment(true);
    setError(null);

    try {
      const assignedTopic = await assignTopicToKnowledgeItem(item.id, Number(selectedTopicId));
      startTransition(() => {
        setItemTopics((current) =>
          current.some((topic) => topic.id === assignedTopic.id) ? current : [...current, assignedTopic]
        );
      });
      setSelectedTopicId('');
    } catch (topicError) {
      console.error(topicError);
      setError('Failed to attach topic.');
    } finally {
      setSavingTopicAssignment(false);
    }
  };

  const handleCreateTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || !newTopicForm.name.trim()) return;

    setCreatingTopic(true);
    setError(null);

    try {
      const createdTopic = await createTopic({
        name: newTopicForm.name.trim(),
        parentTopicId: newTopicForm.parentTopicId ? Number(newTopicForm.parentTopicId) : undefined,
        description: newTopicForm.description.trim() || undefined,
      });

      startTransition(() => {
        setAllTopics((current) => [...current, createdTopic]);
      });

      const assignedTopic = await assignTopicToKnowledgeItem(item.id, createdTopic.id);
      startTransition(() => {
        setItemTopics((current) =>
          current.some((topic) => topic.id === assignedTopic.id) ? current : [...current, assignedTopic]
        );
      });

      setNewTopicForm({
        name: '',
        parentTopicId: '',
        description: '',
      });
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
      await removeTopicFromKnowledgeItem(item.id, topicId);
      startTransition(() => {
        setItemTopics((current) => current.filter((topic) => topic.id !== topicId));
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
        relationType: 'related_to',
        note: '',
      });
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
        <div className="knowledge-detail-empty">Loading knowledge item...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="knowledge-detail-page">
        <div className="knowledge-detail-empty">
          {error || 'This knowledge item could not be found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="knowledge-detail-page">
      <Link to="/knowledge" className="knowledge-detail-back">
        Back to Knowledge Workbench
      </Link>

      <section className="knowledge-detail-hero">
        <div className="knowledge-detail-title">
          <div className="knowledge-detail-badges">
            <span className="knowledge-detail-badge">{item.kind}</span>
            <span className="knowledge-detail-badge knowledge-detail-status">{item.status}</span>
          </div>
          <h1>{item.title}</h1>
          <div className="knowledge-detail-meta">
            {item.creator ? <span>{item.creator}</span> : null}
            {item.sourceName ? <span>{item.sourceName}</span> : null}
            {item.publishedYear ? <span>{item.publishedYear}</span> : null}
            <span>Updated {formatDate(item.updatedAt)}</span>
          </div>
          {item.summary ? <p>{item.summary}</p> : null}
        </div>

        <div className="knowledge-detail-stats">
          <div className="knowledge-detail-stat">
            <strong>{itemTopics.length}</strong>
            <span>Topics</span>
          </div>
          <div className="knowledge-detail-stat">
            <strong>{relations.length}</strong>
            <span>Relations</span>
          </div>
          <div className="knowledge-detail-stat">
            <strong>{notes.length}</strong>
            <span>Notes</span>
          </div>
          <div className="knowledge-detail-stat">
            <strong>{completedTasks}/{tasks.length}</strong>
            <span>Tasks done</span>
          </div>
          <div className="knowledge-detail-stat">
            <strong>{reviews.length}</strong>
            <span>Reviews</span>
          </div>
        </div>
      </section>

      {error ? <div className="knowledge-detail-error">{error}</div> : null}

      <div className="knowledge-detail-grid">
        <aside className="knowledge-detail-panel knowledge-detail-sidebar">
          <span className="knowledge-detail-eyebrow">Overview</span>
          <h2>Working context</h2>

          <div className="knowledge-detail-field">
            <label htmlFor="item-status">Status</label>
            <select
              id="item-status"
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
          </div>

          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="knowledge-detail-link">
              Open source
            </a>
          ) : null}

          <div className="knowledge-detail-overview">
            {item.description ? (
              <p>{item.description}</p>
            ) : (
              <p>
                This workspace now covers taxonomy and cross-links as well as notes, tasks, and reviews.
                The next layers can grow from these topic placements and item relations.
              </p>
            )}
            <dl>
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
            </dl>
          </div>
        </aside>

        <div className="knowledge-detail-main">
          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Taxonomy</span>
                <h2>Topic placement</h2>
              </div>
            </div>

            <div className="knowledge-detail-chips">
              {itemTopics.length === 0 ? (
                <div className="knowledge-detail-empty">This item is not classified yet.</div>
              ) : (
                itemTopics.map((topic) => (
                  <div key={topic.id} className="knowledge-detail-chip">
                    <Link to={`/topics/${topic.id}`}>{buildTopicPath(topic, topicMap)}</Link>
                    <button type="button" onClick={() => handleRemoveTopic(topic.id)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <form className="knowledge-detail-form knowledge-detail-form-row" onSubmit={handleAttachTopic}>
              <select
                value={selectedTopicId}
                onChange={(event) => setSelectedTopicId(event.target.value)}
                disabled={savingTopicAssignment || assignableTopics.length === 0}
              >
                <option value="">Attach an existing topic</option>
                {assignableTopics.map(({ topic, depth }) => (
                  <option key={topic.id} value={topic.id}>
                    {`${'  '.repeat(depth)}${topic.name}`}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={savingTopicAssignment || !selectedTopicId}>
                {savingTopicAssignment ? 'Attaching...' : 'Attach topic'}
              </button>
            </form>

            <form className="knowledge-detail-form" onSubmit={handleCreateTopic}>
              <input
                value={newTopicForm.name}
                onChange={(event) =>
                  setNewTopicForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Create a new topic"
              />
              <div className="knowledge-detail-inline-fields knowledge-detail-inline-fields-relations">
                <label>
                  Parent topic
                  <select
                    value={newTopicForm.parentTopicId}
                    onChange={(event) =>
                      setNewTopicForm((current) => ({
                        ...current,
                        parentTopicId: event.target.value,
                      }))
                    }
                  >
                    <option value="">No parent</option>
                    {orderedTopics.map(({ topic, depth }) => (
                      <option key={topic.id} value={topic.id}>
                        {`${'  '.repeat(depth)}${topic.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input
                    value={newTopicForm.description}
                    onChange={(event) =>
                      setNewTopicForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional topic note"
                  />
                </label>
              </div>
              <button type="submit" disabled={creatingTopic}>
                {creatingTopic ? 'Creating topic...' : 'Create and attach topic'}
              </button>
            </form>
          </section>

          <section className="knowledge-detail-panel">
            <div className="knowledge-detail-section-head">
              <div>
                <span className="knowledge-detail-eyebrow">Relations</span>
                <h2>Connections to items and entities</h2>
              </div>
            </div>

            <form className="knowledge-detail-form" onSubmit={handleRelationSubmit}>
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
                      }))
                    }
                  >
                    <option value="reference_entity">Reference entity</option>
                    <option value="knowledge_item">Knowledge item</option>
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
                    {relationTypeOptions.map((relationType) => (
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
                    <option value="">
                      {relationForm.toEntityType === 'reference_entity'
                        ? 'Choose a person, nation, civilization, era, or place'
                        : 'Choose another knowledge item'}
                    </option>
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
                placeholder="Optional note about the connection"
              />
              <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                {savingRelation ? 'Linking...' : 'Add relation'}
              </button>
            </form>

            {relations.length === 0 ? (
              <div className="knowledge-detail-empty">No connections yet.</div>
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
                <h2>Working notes</h2>
              </div>
            </div>

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
                <h2>Follow-up work</h2>
              </div>
            </div>

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
                <h2>Reflections and verdicts</h2>
              </div>
            </div>

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
    </div>
  );
};

export default KnowledgeDetailPage;
