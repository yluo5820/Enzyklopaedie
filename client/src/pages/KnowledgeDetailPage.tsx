import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeItemStatus,
  KnowledgeNote,
  KnowledgeReview,
  KnowledgeTask,
  KnowledgeTaskStatus,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  createKnowledgeNote,
  createKnowledgeReview,
  createKnowledgeTask,
  deleteKnowledgeNote,
  deleteKnowledgeReview,
  deleteKnowledgeTask,
  fetchKnowledgeItem,
  fetchKnowledgeNotes,
  fetchKnowledgeReviews,
  fetchKnowledgeTasks,
  updateKnowledgeItem,
  updateKnowledgeTask,
} from '../api';
import './KnowledgeDetailPage.css';

const itemStatusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];
const taskStatusOptions: KnowledgeTaskStatus[] = ['todo', 'doing', 'done', 'archived'];

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

const KnowledgeDetailPage: React.FC = () => {
  const { id } = useParams();
  const knowledgeItemId = Number(id);

  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [tasks, setTasks] = useState<KnowledgeTask[]>([]);
  const [reviews, setReviews] = useState<KnowledgeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
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
        const [fetchedItem, fetchedNotes, fetchedTasks, fetchedReviews] = await Promise.all([
          fetchKnowledgeItem(knowledgeItemId),
          fetchKnowledgeNotes(knowledgeItemId),
          fetchKnowledgeTasks(knowledgeItemId),
          fetchKnowledgeReviews(knowledgeItemId),
        ]);

        setItem(fetchedItem);
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
                This is the first item-level workspace. Use it to accumulate notes, track follow-up work,
                and leave reviews as the encyclopedia grows.
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
