import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type { StudyTopicSummary, TopicSummary } from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import { createStudyTopic, fetchStudyTopics, fetchTopic, fetchTopics } from '../api';
import './TopicPage.css';

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

const TopicPage: React.FC = () => {
  const { id } = useParams();
  const subjectId = Number(id);

  const [subject, setSubject] = useState<TopicSummary | null>(null);
  const [subjects, setSubjects] = useState<TopicSummary[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingStudyTopic, setCreatingStudyTopic] = useState(false);
  const [studyTopicForm, setStudyTopicForm] = useState({
    name: '',
    parentTopicId: '',
    description: '',
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
        description: studyTopicForm.description.trim() || undefined,
      });

      startTransition(() => {
        setStudyTopics((current) =>
          current.some((entry) => entry.id === createdStudyTopic.id)
            ? current
            : [...current, createdStudyTopic]
        );
        setSubject((current) =>
          current && current.id === subject.id
            ? { ...current, topicCount: current.topicCount + 1 }
            : current
        );
      });

      setStudyTopicForm((current) => ({
        ...current,
        name: '',
        parentTopicId: '',
        description: '',
      }));
    } catch (createError) {
      console.error(createError);
      setError('Failed to create topic.');
    } finally {
      setCreatingStudyTopic(false);
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
        <div>
          <span className="topic-page-eyebrow">Subject Page</span>
          <h1>{subject.name}</h1>
          <p>
            {subject.description ||
              'A subject is part of the synchronic taxonomy rooted at Ontology. It contains contextual topics, and those topics contain the concrete items.'}
          </p>
        </div>
        <div className="topic-page-stats">
          <div className="topic-page-stat">
            <strong>{subject.topicCount}</strong>
            <span>Contained topics</span>
          </div>
          <div className="topic-page-stat">
            <strong>{subject.childTopicCount}</strong>
            <span>Child subjects</span>
          </div>
          <div className="topic-page-stat">
            <strong>{subject.knowledgeItemCount}</strong>
            <span>Items through topics</span>
          </div>
          <div className="topic-page-stat">
            <strong>{formatDate(subject.updatedAt)}</strong>
            <span>Last updated</span>
          </div>
        </div>
      </section>

      {error ? <div className="topic-page-error">{error}</div> : null}

      <div className="topic-page-grid">
        <aside className="topic-page-panel topic-page-sidebar">
          <span className="topic-page-eyebrow">Lineage</span>
          <h2>Where this subject sits</h2>
          <div className="topic-page-lineage">
            {lineage.map((entry, index) => (
              <React.Fragment key={entry.id}>
                <Link to={`/topics/${entry.id}`}>{entry.name}</Link>
                {index < lineage.length - 1 ? <span>/</span> : null}
              </React.Fragment>
            ))}
          </div>

          <div className="topic-page-side-section">
            <h3>Parent subject</h3>
            {parentSubject ? (
              <Link to={`/topics/${parentSubject.id}`} className="topic-page-side-card">
                <strong>{parentSubject.name}</strong>
                <span>{parentSubject.topicCount} contained topics</span>
              </Link>
            ) : (
              <div className="topic-page-empty">Ontology is the root subject and has no parent.</div>
            )}
          </div>

          <div className="topic-page-side-section">
            <h3>Subject structure</h3>
            <div className="topic-page-note">
              <strong>Edit this in the subject tree.</strong>
              <span>
                Add child subjects, rename branches, and remove empty leaf subjects from the main
                tree editor so the hierarchy stays visible while you work.
              </span>
              <Link to="/topics" className="topic-page-lineage-link">
                Open Subject Tree Editor
              </Link>
            </div>
          </div>

          <div className="topic-page-side-section">
            <h3>Create topic in this subject</h3>
            <form className="topic-page-form" onSubmit={handleCreateStudyTopic}>
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
              <textarea
                value={studyTopicForm.description}
                onChange={(event) =>
                  setStudyTopicForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional description"
              />
              <button type="submit" disabled={creatingStudyTopic}>
                {creatingStudyTopic ? 'Creating...' : 'Create topic'}
              </button>
            </form>
          </div>
        </aside>

        <div className="topic-page-main">
          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Branches</span>
                <h2>Child subjects</h2>
              </div>
            </div>

            {childSubjects.length === 0 ? (
              <div className="topic-page-empty">No child subjects yet.</div>
            ) : (
              <div className="topic-page-card-grid">
                {childSubjects.map((childSubject) => (
                  <Link key={childSubject.id} to={`/topics/${childSubject.id}`} className="topic-page-card">
                    <strong>{childSubject.name}</strong>
                    <span>{childSubject.topicCount} contained topics</span>
                    <span>{childSubject.childTopicCount} child subjects</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Contained Topics</span>
                <h2>Topics inside this subject</h2>
              </div>
            </div>

            {orderedStudyTopics.length === 0 ? (
              <div className="topic-page-empty">
                No topics yet. Create the first contextual topic under this subject.
              </div>
            ) : (
              <div className="topic-page-card-grid">
                {orderedStudyTopics.map(({ topic, depth }) => (
                  <Link key={topic.id} to={`/study-topics/${topic.id}`} className="topic-page-card">
                    <strong>{`${'  '.repeat(depth)}${topic.name}`}</strong>
                    <span>{topic.itemCount} contained items</span>
                    <span>{topic.childTopicCount} child topics</span>
                    {topic.summary || topic.description ? (
                      <span>{topic.summary || topic.description}</span>
                    ) : null}
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
