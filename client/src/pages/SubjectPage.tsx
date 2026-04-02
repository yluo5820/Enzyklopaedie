import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type { StudyTopicSummary, TopicSummary } from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  createStudyTopic,
  deleteStudyTopic,
  fetchStudyTopics,
  fetchTopic,
  fetchTopics,
  updateTopic,
} from '../api';
import './SubjectPage.css';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const orderStudyTopics = (studyTopics: StudyTopicSummary[]) => {
  const children = new Map<number | null, StudyTopicSummary[]>();

  for (const topic of studyTopics) {
    const key = topic.parentTopicId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(topic);
    children.set(key, branch);
  }

  for (const branch of children.values()) {
    branch.sort((left, right) => left.name.localeCompare(right.name));
  }

  const ordered: Array<{ topic: StudyTopicSummary; depth: number }> = [];
  const visit = (parentTopicId: number | null, depth: number) => {
    for (const topic of children.get(parentTopicId) ?? []) {
      ordered.push({ topic, depth });
      visit(topic.id, depth + 1);
    }
  };

  visit(null, 0);
  return ordered;
};

const SubjectPage: React.FC = () => {
  const { id } = useParams();
  const subjectId = Number(id);

  const [subject, setSubject] = useState<TopicSummary | null>(null);
  const [subjects, setSubjects] = useState<TopicSummary[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [showSubjectEditor, setShowSubjectEditor] = useState(false);
  const [showStudyTopicCreator, setShowStudyTopicCreator] = useState(false);
  const [creatingStudyTopic, setCreatingStudyTopic] = useState(false);
  const [deletingStudyTopicId, setDeletingStudyTopicId] = useState<number | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    description: '',
    name: '',
  });
  const [studyTopicForm, setStudyTopicForm] = useState({
    name: '',
    parentTopicId: '',
  });

  useEffect(() => {
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      setError('Invalid subject.');
      setLoading(false);
      return;
    }

    const loadSubjectPage = async () => {
      try {
        const [fetchedSubject, fetchedSubjects, fetchedStudyTopics] = await Promise.all([
          fetchTopic(subjectId),
          fetchTopics(),
          fetchStudyTopics(subjectId),
        ]);

        setSubject(fetchedSubject);
        setSubjects(fetchedSubjects);
        setStudyTopics(fetchedStudyTopics);
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load subject page.');
      } finally {
        setLoading(false);
      }
    };

    loadSubjectPage();
  }, [subjectId]);

  const subjectMap = useMemo(() => new Map(subjects.map((entry) => [entry.id, entry])), [subjects]);
  const parentSubject = useMemo(
    () => (subject?.parentTopicId ? subjectMap.get(subject.parentTopicId) ?? null : null),
    [subject?.parentTopicId, subjectMap]
  );
  const childSubjects = useMemo(
    () =>
      subjects
        .filter((entry) => entry.parentTopicId === subject?.id)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [subject?.id, subjects]
  );
  const lineage = useMemo(() => {
    if (!subject) return [];

    const path: TopicSummary[] = [subject];
    let currentParentId = subject.parentTopicId;
    let guard = 0;

    while (currentParentId && guard < 16) {
      const parent = subjectMap.get(currentParentId);
      if (!parent) break;
      path.unshift(parent);
      currentParentId = parent.parentTopicId;
      guard += 1;
    }

    return path;
  }, [subject, subjectMap]);
  const orderedStudyTopics = useMemo(() => orderStudyTopics(studyTopics), [studyTopics]);

  useEffect(() => {
    if (!subject) return;

    setSubjectForm({
      description: subject.description ?? '',
      name: subject.name,
    });
  }, [subject]);

  const isRootSubject = subject?.slug === 'ontology';
  const canDeleteStudyTopic = (entry: StudyTopicSummary) => entry.childTopicCount === 0 && entry.itemCount === 0;

  const handleSaveSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject || !subjectForm.name.trim()) return;

    setSavingSubject(true);
    setError(null);

    try {
      const updatedSubject = await updateTopic(subject.id, {
        description: subjectForm.description.trim() || undefined,
        ...(isRootSubject ? {} : { name: subjectForm.name.trim() }),
      });

      startTransition(() => {
        setSubject(updatedSubject);
        setSubjects((current) =>
          current.map((entry) => (entry.id === updatedSubject.id ? updatedSubject : entry))
        );
      });
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleCreateStudyTopic = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject || !studyTopicForm.name.trim()) return;

    setCreatingStudyTopic(true);
    setError(null);

    try {
      const createdStudyTopic = await createStudyTopic({
        subjectId: subject.id,
        name: studyTopicForm.name.trim(),
        parentTopicId: studyTopicForm.parentTopicId ? Number(studyTopicForm.parentTopicId) : undefined,
      });
      const studyTopicAlreadyPresent = studyTopics.some((entry) => entry.id === createdStudyTopic.id);

      startTransition(() => {
        setStudyTopics((current) => {
          const alreadyPresent = current.some((entry) => entry.id === createdStudyTopic.id);
          const updated = current.map((entry) =>
            entry.id === createdStudyTopic.parentTopicId && !alreadyPresent
              ? { ...entry, childTopicCount: entry.childTopicCount + 1 }
              : entry
          );

          return alreadyPresent ? updated : [...updated, createdStudyTopic];
        });
        setSubject((current) =>
          current && current.id === subject.id && !studyTopicAlreadyPresent
            ? { ...current, topicCount: current.topicCount + 1 }
            : current
        );
      });

      setStudyTopicForm((current) => ({
        ...current,
        name: '',
        parentTopicId: '',
      }));
      setShowStudyTopicCreator(false);
    } catch (createError) {
      console.error(createError);
      setError('Failed to create topic.');
    } finally {
      setCreatingStudyTopic(false);
    }
  };

  const handleDeleteStudyTopic = async (studyTopic: StudyTopicSummary) => {
    if (!canDeleteStudyTopic(studyTopic)) return;

    const confirmed = window.confirm(`Remove "${studyTopic.name}" from this subject?`);
    if (!confirmed) return;

    setDeletingStudyTopicId(studyTopic.id);
    setError(null);

    try {
      await deleteStudyTopic(studyTopic.id);

      startTransition(() => {
        setStudyTopics((current) =>
          current
            .filter((entry) => entry.id !== studyTopic.id)
            .map((entry) =>
              entry.id === studyTopic.parentTopicId
                ? { ...entry, childTopicCount: Math.max(0, entry.childTopicCount - 1) }
                : entry
            )
        );
        setSubject((current) =>
          current ? { ...current, topicCount: Math.max(0, current.topicCount - 1) } : current
        );
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to remove topic.');
    } finally {
      setDeletingStudyTopicId(null);
    }
  };

  if (loading) {
    return (
      <div className="topic-page">
        <div className="topic-page-empty">Loading subject page...</div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="topic-page">
        <div className="topic-page-empty">{error || 'Subject not found.'}</div>
      </div>
    );
  }

  return (
    <div className="topic-page">
      <Link to="/topics" className="topic-page-back">
        Back to Subject Tree
      </Link>

      <section className="topic-page-hero">
        <div className="topic-page-hero-main">
          <span className="topic-page-eyebrow">Subject Page</span>
          <h1>{subject.name}</h1>
          <p>
            {subject.description ||
              'A subject is part of the synchronic taxonomy rooted at Ontology. It contains contextual topics, and those topics contain the concrete items.'}
          </p>
          <div className="topic-page-lineage">
            {lineage.map((entry, index) => (
              <React.Fragment key={entry.id}>
                <Link to={`/topics/${entry.id}`}>{entry.name}</Link>
                {index < lineage.length - 1 ? <span>/</span> : null}
              </React.Fragment>
            ))}
          </div>
          <div className="topic-page-hero-meta">
            <span>Updated {formatDate(subject.updatedAt)}</span>
            {parentSubject ? (
              <Link to={`/topics/${parentSubject.id}`}>Parent: {parentSubject.name}</Link>
            ) : (
              <span>Root subject</span>
            )}
            <span>{childSubjects.length} child subject{childSubjects.length === 1 ? '' : 's'} in tree</span>
          </div>
          <div className="topic-page-hero-actions">
            <button
              type="button"
              className="topic-page-secondary-button"
              onClick={() => setShowSubjectEditor((current) => !current)}
            >
              {showSubjectEditor ? 'Close subject editor' : 'Edit subject'}
            </button>
          </div>
          {showSubjectEditor ? (
            <form className="topic-page-form topic-page-inline-panel" onSubmit={handleSaveSubject}>
              <div className="topic-page-form-row">
                <input
                  value={subjectForm.name}
                  onChange={(event) =>
                    setSubjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  disabled={isRootSubject}
                  placeholder="Subject name"
                />
              </div>
              <textarea
                value={subjectForm.description}
                onChange={(event) =>
                  setSubjectForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Subject description"
              />
              <button type="submit" disabled={savingSubject}>
                {savingSubject ? 'Saving...' : 'Save subject'}
              </button>
              {isRootSubject ? (
                <div className="topic-page-note">
                  <strong>Ontology stays the root.</strong>
                  <span>The title is fixed, but you can still revise the description here.</span>
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      </section>

      {error ? <div className="topic-page-error">{error}</div> : null}

      <div className="topic-page-main">
          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Contained Topics</span>
                <h2>
                  Topics inside this subject
                  <span className="topic-page-count-badge">{orderedStudyTopics.length}</span>
                </h2>
                <p className="topic-page-section-copy">{subject.knowledgeItemCount} items through these topics.</p>
              </div>
              <button
                type="button"
                className="topic-page-secondary-button"
                onClick={() => setShowStudyTopicCreator((current) => !current)}
              >
                {showStudyTopicCreator ? 'Close' : 'Add topic'}
              </button>
            </div>

            {showStudyTopicCreator ? (
              <form className="topic-page-form topic-page-inline-panel" onSubmit={handleCreateStudyTopic}>
                <div className="topic-page-form-row topic-page-form-row-split">
                  <input
                    value={studyTopicForm.name}
                    onChange={(event) =>
                      setStudyTopicForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Name the topic"
                  />
                  <select
                    value={studyTopicForm.parentTopicId}
                    onChange={(event) =>
                      setStudyTopicForm((current) => ({
                        ...current,
                        parentTopicId: event.target.value,
                      }))
                    }
                  >
                    <option value="">No parent topic</option>
                    {orderedStudyTopics.map(({ topic, depth }) => (
                      <option key={topic.id} value={topic.id}>
                        {`${'  '.repeat(depth)}${topic.name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={creatingStudyTopic}>
                  {creatingStudyTopic ? 'Creating...' : 'Create topic'}
                </button>
              </form>
            ) : null}

            {orderedStudyTopics.length === 0 ? (
              <div className="topic-page-empty">
                No topics yet. Create the first contextual topic under this subject.
              </div>
            ) : (
              <div className="topic-page-card-grid">
                {orderedStudyTopics.map(({ topic, depth }) => (
                  <article key={topic.id} className="topic-page-card">
                    <Link to={`/study-topics/${topic.id}`} className="topic-page-card-link">
                      <strong>{topic.name}</strong>
                    </Link>
                    <div className="topic-page-card-meta">
                      {depth > 0 ? <span>Depth {depth + 1}</span> : <span>Top-level topic</span>}
                      <span>{topic.itemCount} items</span>
                      <span>{topic.childTopicCount} child topics</span>
                    </div>
                    {topic.summary || topic.description ? <p>{topic.summary || topic.description}</p> : null}
                    <div className="topic-page-card-actions">
                      <Link to={`/study-topics/${topic.id}`} className="topic-page-card-button">
                        Open topic
                      </Link>
                      <button
                        type="button"
                        className="topic-page-danger-button"
                        onClick={() => handleDeleteStudyTopic(topic)}
                        disabled={!canDeleteStudyTopic(topic) || deletingStudyTopicId === topic.id}
                        title={
                          canDeleteStudyTopic(topic)
                            ? 'Remove this empty leaf topic'
                            : 'Only empty leaf topics with no items can be removed here'
                        }
                      >
                        {deletingStudyTopicId === topic.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
      </div>
    </div>
  );
};

export default SubjectPage;
