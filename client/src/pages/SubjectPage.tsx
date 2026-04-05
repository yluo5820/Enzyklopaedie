import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  FormationSubtype,
  KnowledgeRelationDetail,
  ReferenceEntity,
  SubjectSummary as TopicSummary,
  TopicSummary as StudyTopicSummary,
} from '@enzyklopaedie/shared';
import { Link, useParams } from 'react-router-dom';
import {
  createTopic as createStudyTopic,
  deleteTopic as deleteStudyTopic,
  fetchReferenceEntities,
  fetchSubject as fetchTopic,
  fetchSubjects as fetchTopics,
  fetchTopicRelations,
  fetchTopics as fetchStudyTopics,
  updateSubject as updateTopic,
} from '../api';
import './SubjectPage.css';

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

const formationSubtypeLabels: Record<FormationSubtype, string> = {
  civilization: 'Civilization',
  era: 'Era',
  tradition: 'Tradition',
  world_frame: 'World Frame',
  other: 'Formation',
};

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

type SubjectAtlasEntityAggregate = {
  entity: ReferenceEntity;
  topicCount: number;
  topicIds: Set<number>;
  relationCount: number;
};

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

const buildTopicPath = (
  topic: StudyTopicSummary,
  topicMap: Map<number, StudyTopicSummary>
) => {
  const parts = [topic.name];
  let currentParentId = topic.parentTopicId;
  let guard = 0;

  while (currentParentId && guard < 16) {
    const parent = topicMap.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentTopicId;
    guard += 1;
  }

  return parts.join(' / ');
};

const SubjectPage: React.FC = () => {
  const { id } = useParams();
  const subjectId = Number(id);

  const [subject, setSubject] = useState<TopicSummary | null>(null);
  const [subjects, setSubjects] = useState<TopicSummary[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopicSummary[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [topicRelationsById, setTopicRelationsById] = useState<Record<number, KnowledgeRelationDetail[]>>({});
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
        const [fetchedSubject, fetchedSubjects, fetchedStudyTopics, fetchedReferenceEntities] = await Promise.all([
          fetchTopic(subjectId),
          fetchTopics(),
          fetchStudyTopics(subjectId),
          fetchReferenceEntities(),
        ]);
        const fetchedTopicRelations = await Promise.all(
          fetchedStudyTopics.map(async (topic) => [topic.id, await fetchTopicRelations(topic.id)] as const)
        );

        setSubject(fetchedSubject);
        setSubjects(fetchedSubjects);
        setStudyTopics(fetchedStudyTopics);
        setReferenceEntities(fetchedReferenceEntities);
        setTopicRelationsById(Object.fromEntries(fetchedTopicRelations));
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
    () => (subject?.parentSubjectId ? subjectMap.get(subject.parentSubjectId) ?? null : null),
    [subject?.parentSubjectId, subjectMap]
  );
  const childSubjects = useMemo(
    () =>
      subjects
        .filter((entry) => entry.parentSubjectId === subject?.id)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [subject?.id, subjects]
  );
  const lineage = useMemo(() => {
    if (!subject) return [];

    const path: TopicSummary[] = [subject];
    let currentParentId = subject.parentSubjectId;
    let guard = 0;

    while (currentParentId && guard < 16) {
      const parent = subjectMap.get(currentParentId);
      if (!parent) break;
      path.unshift(parent);
      currentParentId = parent.parentSubjectId;
      guard += 1;
    }

    return path;
  }, [subject, subjectMap]);
  const orderedStudyTopics = useMemo(() => orderStudyTopics(studyTopics), [studyTopics]);
  const topicMap = useMemo(() => new Map(studyTopics.map((entry) => [entry.id, entry])), [studyTopics]);
  const referenceEntityMap = useMemo(
    () => new Map(referenceEntities.map((entity) => [entity.id, entity])),
    [referenceEntities]
  );
  const topLevelStudyTopics = useMemo(
    () => orderedStudyTopics.filter(({ depth }) => depth === 0),
    [orderedStudyTopics]
  );
  const nestedStudyTopics = useMemo(
    () =>
      orderedStudyTopics
        .filter(({ depth }) => depth > 0)
        .map(({ topic, depth }) => ({
          depth,
          path: buildTopicPath(topic, topicMap),
          topic,
        })),
    [orderedStudyTopics, topicMap]
  );
  const topicsWithHistoricalFrameCount = useMemo(
    () => studyTopics.filter((topic) => (topicRelationsById[topic.id]?.length ?? 0) > 0).length,
    [studyTopics, topicRelationsById]
  );
  const atlasEntityAggregates = useMemo(() => {
    const grouped = new Map<number, SubjectAtlasEntityAggregate>();

    for (const topic of studyTopics) {
      const relations = topicRelationsById[topic.id] ?? [];

      for (const relation of relations) {
        const entity = referenceEntityMap.get(relation.toEntityId);
        if (!entity) continue;

        const current = grouped.get(entity.id);
        if (current) {
          current.relationCount += 1;
          current.topicIds.add(topic.id);
          current.topicCount = current.topicIds.size;
          continue;
        }

        grouped.set(entity.id, {
          entity,
          topicCount: 1,
          topicIds: new Set([topic.id]),
          relationCount: 1,
        });
      }
    }

    return [...grouped.values()].sort((left, right) => {
      if (left.topicCount !== right.topicCount) return right.topicCount - left.topicCount;
      const titleDifference = left.entity.title.localeCompare(right.entity.title);
      if (titleDifference !== 0) return titleDifference;
      return left.entity.id - right.entity.id;
    });
  }, [referenceEntityMap, studyTopics, topicRelationsById]);
  const formationAggregates = useMemo(
    () => atlasEntityAggregates.filter((entry) => entry.entity.kind === 'formation'),
    [atlasEntityAggregates]
  );
  const polityAggregates = useMemo(
    () => atlasEntityAggregates.filter((entry) => entry.entity.kind === 'polity'),
    [atlasEntityAggregates]
  );
  const personAggregates = useMemo(
    () => atlasEntityAggregates.filter((entry) => entry.entity.kind === 'person'),
    [atlasEntityAggregates]
  );
  const subjectAtlasHorizon = useMemo(
    () => formatAtlasHorizon(atlasEntityAggregates.map((entry) => entry.entity)),
    [atlasEntityAggregates]
  );
  const formationSubtypeSummary = useMemo(() => {
    const counts = new Map<string, number>();

    for (const entry of formationAggregates) {
      const label =
        entry.entity.formationSubtype
          ? formationSubtypeLabels[entry.entity.formationSubtype]
          : formationSubtypeLabels.other;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`)
      .join(', ');
  }, [formationAggregates]);

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
      <Link to="/subjects" className="topic-page-back">
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
                <Link to={`/subjects/${entry.id}`}>{entry.name}</Link>
                {index < lineage.length - 1 ? <span>/</span> : null}
              </React.Fragment>
            ))}
          </div>
          <div className="topic-page-hero-meta">
            <span>Updated {formatDate(subject.updatedAt)}</span>
            {parentSubject ? (
              <Link to={`/subjects/${parentSubject.id}`}>Parent: {parentSubject.name}</Link>
            ) : (
              <span>Root subject</span>
            )}
            <span>{orderedStudyTopics.length} topic{orderedStudyTopics.length === 1 ? '' : 's'}</span>
            <span>{subject.knowledgeItemCount} item{subject.knowledgeItemCount === 1 ? '' : 's'} through topics</span>
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
                <span className="topic-page-eyebrow">Historical Footprint</span>
                <h2>
                  Atlas framing across topics
                  <PageHint text="The formations, polities, and people currently shaping the topics inside this subject." />
                  <span className="topic-page-count-badge">{topicsWithHistoricalFrameCount}</span>
                </h2>
              </div>
            </div>

            {atlasEntityAggregates.length === 0 ? (
              <div className="topic-page-empty">
                No atlas context has been attached to this subject’s topics yet.
              </div>
            ) : (
              <div className="topic-page-subsection-stack topic-page-atlas-subsection-stack">
                <div className="topic-page-overview-grid topic-page-atlas-overview-grid">
                  <article className="topic-page-overview-card">
                    <div className="topic-page-overview-label">
                      <span className="topic-page-eyebrow">Framed Topics</span>
                      <PageHint text="How many topics in this subject already carry some atlas framing." />
                    </div>
                    <strong>
                      {topicsWithHistoricalFrameCount} / {orderedStudyTopics.length}
                    </strong>
                    <span className="topic-page-overview-meta">Topics with linked atlas entities</span>
                  </article>
                  <article className="topic-page-overview-card">
                    <div className="topic-page-overview-label">
                      <span className="topic-page-eyebrow">Formations</span>
                      <PageHint text="Civilizations, eras, traditions, or world frames already in play across this subject." />
                    </div>
                    <strong>{formationAggregates.length || 'None'}</strong>
                    <span className="topic-page-overview-meta">
                      {formationAggregates.length > 0 ? formationSubtypeSummary : 'No formation frame yet'}
                    </span>
                  </article>
                  <article className="topic-page-overview-card">
                    <div className="topic-page-overview-label">
                      <span className="topic-page-eyebrow">Polity Scope</span>
                      <PageHint text="Named polities already localizing topics in this subject." />
                    </div>
                    <strong>{polityAggregates.length || 'None'}</strong>
                    <span className="topic-page-overview-meta">
                      {polityAggregates.length > 0
                        ? polityAggregates
                            .slice(0, 2)
                            .map((entry) => entry.entity.title)
                            .join(', ')
                        : 'No polity scope yet'}
                    </span>
                  </article>
                  <article className="topic-page-overview-card">
                    <div className="topic-page-overview-label">
                      <span className="topic-page-eyebrow">Time Horizon</span>
                      <PageHint text="The broad date span implied by the atlas entities currently linked into this subject’s topics." />
                    </div>
                    <strong>{subjectAtlasHorizon || 'Open'}</strong>
                    <span className="topic-page-overview-meta">
                      {subjectAtlasHorizon ? 'Derived from linked atlas entities' : 'No dated atlas frame yet'}
                    </span>
                  </article>
                </div>

                {formationAggregates.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        Formations in play
                        <PageHint text="The larger civilizational or era frames currently shaping topics in this subject." />
                      </h3>
                      <span className="topic-page-count-badge">{formationAggregates.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {formationAggregates.slice(0, 6).map((entry) => (
                        <article key={`subject-formation-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>
                              {entry.entity.formationSubtype
                                ? formationSubtypeLabels[entry.entity.formationSubtype]
                                : formationSubtypeLabels.other}
                            </span>
                            <span>{entry.topicCount} topic{entry.topicCount === 1 ? '' : 's'}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                          </div>
                          {entry.entity.summary ? <p>{entry.entity.summary}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {polityAggregates.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        Polity scope
                        <PageHint text="Named built-in or curated polities already anchoring topics in this subject." />
                      </h3>
                      <span className="topic-page-count-badge">{polityAggregates.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {polityAggregates.slice(0, 6).map((entry) => (
                        <article key={`subject-polity-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>Polity</span>
                            <span>{entry.topicCount} topic{entry.topicCount === 1 ? '' : 's'}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                          </div>
                          {entry.entity.summary ? <p>{entry.entity.summary}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {personAggregates.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        People in view
                        <PageHint text="People already linked into the topics inside this subject." />
                      </h3>
                      <span className="topic-page-count-badge">{personAggregates.length}</span>
                    </div>
                    <div className="topic-page-card-grid">
                      {personAggregates.slice(0, 6).map((entry) => (
                        <article key={`subject-person-${entry.entity.id}`} className="topic-page-card">
                          <Link to={`/entities/${entry.entity.id}`} className="topic-page-card-link">
                            <strong>{entry.entity.title}</strong>
                          </Link>
                          <div className="topic-page-card-meta">
                            <span>Person</span>
                            <span>{entry.topicCount} topic{entry.topicCount === 1 ? '' : 's'}</span>
                            {formatReferenceTimespan(entry.entity) ? (
                              <span>{formatReferenceTimespan(entry.entity)}</span>
                            ) : null}
                          </div>
                          {entry.entity.summary ? <p>{entry.entity.summary}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </section>

          <section className="topic-page-panel">
            <div className="topic-page-section-head">
              <div>
                <span className="topic-page-eyebrow">Topic Landscape</span>
                <h2>
                  Topics inside this subject
                  <PageHint text="Subjects stay synchronic. Use topics for the contextual branches where items actually live." />
                  <span className="topic-page-count-badge">{orderedStudyTopics.length}</span>
                </h2>
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
              <div className="topic-page-subsection-stack">
                <section className="topic-page-subsection">
                  <div className="topic-page-subsection-head">
                    <h3>
                      Top-level topics
                      <PageHint text="These are the first practical branches directly under this subject." />
                    </h3>
                    <span className="topic-page-count-badge">{topLevelStudyTopics.length}</span>
                  </div>
                  <div className="topic-page-card-grid">
                    {topLevelStudyTopics.map(({ topic }) => (
                      <article key={topic.id} className="topic-page-card">
                        <Link to={`/topics/${topic.id}`} className="topic-page-card-link">
                          <strong>{topic.name}</strong>
                        </Link>
                        <div className="topic-page-card-meta">
                          <span>{topic.itemCount} items</span>
                          <span>{topic.childTopicCount} child topics</span>
                        </div>
                        {topic.summary || topic.description ? <p>{topic.summary || topic.description}</p> : null}
                        <div className="topic-page-card-actions">
                          <Link to={`/topics/${topic.id}`} className="topic-page-card-button">
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
                </section>

                {nestedStudyTopics.length > 0 ? (
                  <section className="topic-page-subsection">
                    <div className="topic-page-subsection-head">
                      <h3>
                        Nested branches
                        <PageHint text="Deeper topic branches are shown as paths here so the subject page stays readable." />
                      </h3>
                      <span className="topic-page-count-badge">{nestedStudyTopics.length}</span>
                    </div>
                    <div className="topic-page-item-list">
                      {nestedStudyTopics.map(({ topic, depth, path }) => (
                        <article key={topic.id} className="topic-page-item-card">
                          <div className="topic-page-item-top">
                            <div className="topic-page-item-badges">
                              <span>Depth {depth + 1}</span>
                              <span>{topic.childTopicCount} child topics</span>
                              <span>{topic.itemCount} items</span>
                            </div>
                            <Link to={`/topics/${topic.id}`} className="topic-page-item-link">
                              <strong>{topic.name}</strong>
                            </Link>
                          </div>
                          <div className="topic-page-item-meta">
                            <span>{path}</span>
                          </div>
                          {topic.summary || topic.description ? <p>{topic.summary || topic.description}</p> : null}
                          <div className="topic-page-item-actions">
                            <Link to={`/topics/${topic.id}`} className="topic-page-card-button">
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
                  </section>
                ) : null}
              </div>
            )}
          </section>
      </div>
    </div>
  );
};

export default SubjectPage;
