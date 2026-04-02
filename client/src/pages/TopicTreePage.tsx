import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type { TopicSummary } from '@enzyklopaedie/shared';
import { useNavigate } from 'react-router-dom';
import { createTopic, deleteTopic, fetchTopics, updateTopic } from '../api';
import './TopicTreePage.css';

interface PositionedTopic {
  topic: TopicSummary;
  x: number;
  y: number;
  depth: number;
  radius: number;
}

const NODE_X_STEP = 260;
const NODE_Y_STEP = 170;
const BASE_X = 140;
const BASE_Y = 110;

const wrapLabel = (value: string, maxChars = 13) => {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    lines.push(word.slice(0, maxChars));
    currentLine = word.slice(maxChars);
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
};

const buildTreeLayout = (topics: TopicSummary[]) => {
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const children = new Map<number | null, TopicSummary[]>();

  for (const topic of topics) {
    const key = topic.parentTopicId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(topic);
    children.set(key, branch);
  }

  for (const branch of children.values()) {
    branch.sort((left, right) => left.name.localeCompare(right.name));
  }

  const root = topics.find((topic) => topic.slug === 'ontology') ?? topics[0];
  const positioned = new Map<number, PositionedTopic>();
  let row = 0;
  let maxDepth = 0;

  const visit = (topic: TopicSummary, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const directChildren = children.get(topic.id) ?? [];
    let y = BASE_Y + row * NODE_Y_STEP;

    if (directChildren.length === 0) {
      row += 1;
    } else {
      const childYs = directChildren.map((child) => visit(child, depth + 1));
      y = childYs.reduce((sum, current) => sum + current, 0) / childYs.length;
    }

    positioned.set(topic.id, {
      topic,
      x: BASE_X + depth * NODE_X_STEP,
      y,
      depth,
      radius: Math.min(68, 34 + topic.topicCount * 4 + topic.childTopicCount * 2),
    });

    return y;
  };

  if (root) {
    visit(root, 0);
  }

  const width = BASE_X * 2 + (maxDepth + 1) * NODE_X_STEP;
  const height = Math.max(BASE_Y * 2 + row * NODE_Y_STEP, 540);

  const edges = Array.from(positioned.values()).flatMap((position) => {
    const parentId = position.topic.parentTopicId;
    if (!parentId) return [];

    const parent = positioned.get(parentId);
    if (!parent) return [];

    return [
      {
        key: `${parent.topic.id}-${position.topic.id}`,
        fromX: parent.x + parent.radius,
        fromY: parent.y,
        toX: position.x - position.radius,
        toY: position.y,
      },
    ];
  });

  return {
    root,
    topicMap,
    positioned: Array.from(positioned.values()),
    edges,
    width,
    height,
  };
};

const buildLineage = (topic: TopicSummary | null, topicMap: Map<number, TopicSummary>) => {
  if (!topic) return [];

  const lineage: TopicSummary[] = [topic];
  let currentParentId = topic.parentTopicId;
  let guard = 0;

  while (currentParentId && guard < 24) {
    const parent = topicMap.get(currentParentId);
    if (!parent) break;
    lineage.unshift(parent);
    currentParentId = parent.parentTopicId;
    guard += 1;
  }

  return lineage;
};

const TopicTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [subjectDraft, setSubjectDraft] = useState({
    description: '',
    name: '',
  });
  const [childDraft, setChildDraft] = useState({
    description: '',
    name: '',
  });
  const [savingSubject, setSavingSubject] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(false);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        setTopics(await fetchTopics());
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load the subject tree.');
      } finally {
        setLoading(false);
      }
    };

    loadTopics();
  }, []);

  const layout = useMemo(() => buildTreeLayout(topics), [topics]);
  const selectedTopic = useMemo(
    () => (selectedTopicId ? layout.topicMap.get(selectedTopicId) ?? null : null),
    [layout.topicMap, selectedTopicId]
  );
  const selectedLineage = useMemo(
    () => buildLineage(selectedTopic, layout.topicMap),
    [layout.topicMap, selectedTopic]
  );
  const totalTopics = useMemo(
    () => topics.reduce((sum, topic) => sum + topic.topicCount, 0),
    [topics]
  );
  const selectedParent = useMemo(
    () =>
      selectedTopic?.parentTopicId ? layout.topicMap.get(selectedTopic.parentTopicId) ?? null : null,
    [layout.topicMap, selectedTopic]
  );
  const isRootSubject = selectedTopic?.slug === 'ontology';

  useEffect(() => {
    if (topics.length === 0) {
      setSelectedTopicId(null);
      return;
    }

    setSelectedTopicId((current) => {
      if (current && topics.some((topic) => topic.id === current)) {
        return current;
      }

      return topics.find((topic) => topic.slug === 'ontology')?.id ?? topics[0].id;
    });
  }, [topics]);

  useEffect(() => {
    if (!selectedTopic) return;

    setSubjectDraft({
      description: selectedTopic.description ?? '',
      name: selectedTopic.name,
    });
    setChildDraft({
      description: '',
      name: '',
    });
  }, [selectedTopic]);

  const handleSaveSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTopic || !subjectDraft.name.trim()) return;

    setSavingSubject(true);
    setError(null);

    try {
      const updatedSubject = await updateTopic(selectedTopic.id, {
        description: subjectDraft.description.trim() || undefined,
        name: subjectDraft.name.trim(),
      });

      startTransition(() => {
        setTopics((current) =>
          current.map((topic) => (topic.id === updatedSubject.id ? updatedSubject : topic))
        );
      });
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to update subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleCreateChild = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTopic || !childDraft.name.trim()) return;

    setCreatingChild(true);
    setError(null);

    try {
      const createdSubject = await createTopic({
        description: childDraft.description.trim() || undefined,
        name: childDraft.name.trim(),
        parentTopicId: selectedTopic.id,
      });

      const nextSubject: TopicSummary = {
        ...createdSubject,
        childTopicCount: 0,
        knowledgeItemCount: 0,
        topicCount: 0,
      };

      startTransition(() => {
        setTopics((current) =>
          current
            .map((topic) =>
              topic.id === selectedTopic.id
                ? { ...topic, childTopicCount: topic.childTopicCount + 1 }
                : topic
            )
            .concat(nextSubject)
        );
        setSelectedTopicId(nextSubject.id);
      });
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : 'Failed to create child subject.');
    } finally {
      setCreatingChild(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!selectedTopic || isRootSubject) return;

    const confirmed = window.confirm(
      `Remove "${selectedTopic.name}" from the subject tree? This only works for empty leaf subjects.`
    );
    if (!confirmed) return;

    setDeletingSubject(true);
    setError(null);

    try {
      await deleteTopic(selectedTopic.id);

      startTransition(() => {
        setTopics((current) =>
          current
            .filter((topic) => topic.id !== selectedTopic.id)
            .map((topic) =>
              topic.id === selectedTopic.parentTopicId
                ? { ...topic, childTopicCount: Math.max(0, topic.childTopicCount - 1) }
                : topic
            )
        );
        setSelectedTopicId(selectedTopic.parentTopicId ?? null);
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete subject.');
    } finally {
      setDeletingSubject(false);
    }
  };

  return (
    <div className="topic-tree-page">
      <section className="topic-tree-hero">
        <div>
          <span className="topic-tree-eyebrow">Subject Spine</span>
          <h1>Ontology Subject Tree</h1>
          <p>
            This is the encyclopedia’s synchronic subject taxonomy: a tech-tree style map rooted in
            Ontology, then branching into the disciplines and sub-disciplines you want to build out over
            time. Click a branch to rename it, add a child subject under it, or remove an empty leaf.
          </p>
        </div>
        <div className="topic-tree-hero-stats">
          <div className="topic-tree-stat">
            <strong>{loading ? '...' : topics.length}</strong>
            <span>Subjects</span>
          </div>
          <div className="topic-tree-stat">
            <strong>{loading ? '...' : totalTopics}</strong>
            <span>Topics across subjects</span>
          </div>
        </div>
      </section>

      <section className="topic-tree-panel">
        <div className="topic-tree-toolbar">
          <div>
            <span className="topic-tree-eyebrow">Explorer</span>
            <h2>Subject map</h2>
          </div>
          <div className="topic-tree-controls">
            <button type="button" onClick={() => setZoom((current) => Math.max(0.7, current - 0.1))}>
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((current) => Math.min(1.6, current + 0.1))}>
              +
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              Reset
            </button>
          </div>
        </div>

        {error ? <div className="topic-tree-empty">{error}</div> : null}
        {loading ? <div className="topic-tree-empty">Loading subject tree...</div> : null}
        {!loading && topics.length === 0 ? (
          <div className="topic-tree-empty">No subjects yet.</div>
        ) : null}

        {!loading && topics.length > 0 ? (
          <div className="topic-tree-workspace">
            <div className="topic-tree-canvas-shell">
              <div
                className="topic-tree-canvas"
                style={{
                  width: `${layout.width * zoom}px`,
                  height: `${layout.height * zoom}px`,
                }}
              >
                <svg
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  style={{
                    width: `${layout.width}px`,
                    height: `${layout.height}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: '0 0',
                  }}
                  role="img"
                  aria-label="Subject technology tree"
                >
                  <defs>
                    <linearGradient id="topicTreeRootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#eedabf" />
                      <stop offset="100%" stopColor="#d5b089" />
                    </linearGradient>
                  </defs>

                  {layout.edges.map((edge) => (
                    <path
                      key={edge.key}
                      d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX + 56} ${edge.fromY}, ${edge.toX - 56} ${edge.toY}, ${edge.toX} ${edge.toY}`}
                      className="topic-tree-edge"
                    />
                  ))}

                  {layout.positioned.map((position) => {
                    const labelLines = wrapLabel(position.topic.name);
                    const isRoot = position.topic.slug === 'ontology';
                    const isSelected = position.topic.id === selectedTopicId;

                    return (
                      <g
                        key={position.topic.id}
                        className={`topic-tree-node${isSelected ? ' is-selected' : ''}`}
                        transform={`translate(${position.x}, ${position.y})`}
                        onClick={() => setSelectedTopicId(position.topic.id)}
                        onDoubleClick={() => navigate(`/topics/${position.topic.id}`)}
                      >
                        <circle
                          r={position.radius}
                          className={isRoot ? 'topic-tree-node-circle topic-tree-node-root' : 'topic-tree-node-circle'}
                          fill={isRoot ? 'url(#topicTreeRootGradient)' : undefined}
                        />
                        <text className="topic-tree-node-depth" y={-position.radius - 16}>
                          {isSelected ? 'Selected' : `Tier ${position.depth}`}
                        </text>
                        <text className="topic-tree-node-title" textAnchor="middle">
                          {labelLines.map((line, index) => (
                            <tspan
                              key={`${position.topic.id}-${line}-${index}`}
                              x="0"
                              dy={index === 0 ? -6 : 16}
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                        <text className="topic-tree-node-count" y={position.radius - 12} textAnchor="middle">
                          {position.topic.topicCount} topic{position.topic.topicCount === 1 ? '' : 's'}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <aside className="topic-tree-editor">
              {selectedTopic ? (
                <>
                  <div className="topic-tree-editor-head">
                    <span className="topic-tree-eyebrow">Selected Subject</span>
                    <h3>{selectedTopic.name}</h3>
                    <p>
                      {isRootSubject
                        ? 'Ontology remains the fixed root. Use it to add the first major branches of the encyclopedia.'
                        : 'This branch is now the active edit target. Adding a child here automatically records the parent relation.'}
                    </p>
                  </div>

                  <div className="topic-tree-editor-stats">
                    <div className="topic-tree-editor-stat">
                      <strong>{selectedTopic.childTopicCount}</strong>
                      <span>Child subjects</span>
                    </div>
                    <div className="topic-tree-editor-stat">
                      <strong>{selectedTopic.topicCount}</strong>
                      <span>Contained topics</span>
                    </div>
                    <div className="topic-tree-editor-stat">
                      <strong>{selectedTopic.knowledgeItemCount}</strong>
                      <span>Items through topics</span>
                    </div>
                  </div>

                  <div className="topic-tree-editor-note">
                    <strong>Lineage</strong>
                    <span>{selectedLineage.map((topic) => topic.name).join(' / ')}</span>
                  </div>

                  <div className="topic-tree-editor-note">
                    <strong>Parent</strong>
                    <span>{selectedParent ? selectedParent.name : 'Root subject'}</span>
                  </div>

                  <form className="topic-tree-editor-form" onSubmit={handleSaveSubject}>
                    <div className="topic-tree-editor-section">
                      <h4>Rename or revise</h4>
                      <label>
                        <span>Subject name</span>
                        <input
                          value={subjectDraft.name}
                          onChange={(event) =>
                            setSubjectDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          disabled={isRootSubject}
                          placeholder="Subject name"
                        />
                      </label>
                      <label>
                        <span>Description</span>
                        <textarea
                          value={subjectDraft.description}
                          onChange={(event) =>
                            setSubjectDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Optional description"
                        />
                      </label>
                      <button type="submit" disabled={savingSubject || isRootSubject}>
                        {savingSubject ? 'Saving...' : isRootSubject ? 'Ontology is fixed' : 'Save subject'}
                      </button>
                    </div>
                  </form>

                  <form className="topic-tree-editor-form" onSubmit={handleCreateChild}>
                    <div className="topic-tree-editor-section">
                      <h4>Add child subject</h4>
                      <label>
                        <span>Name</span>
                        <input
                          value={childDraft.name}
                          onChange={(event) =>
                            setChildDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder={`New branch under ${selectedTopic.name}`}
                        />
                      </label>
                      <label>
                        <span>Description</span>
                        <textarea
                          value={childDraft.description}
                          onChange={(event) =>
                            setChildDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Optional description for the new branch"
                        />
                      </label>
                      <button type="submit" disabled={creatingChild}>
                        {creatingChild ? 'Creating...' : `Create under ${selectedTopic.name}`}
                      </button>
                    </div>
                  </form>

                  <div className="topic-tree-editor-actions">
                    <button type="button" onClick={() => navigate(`/topics/${selectedTopic.id}`)}>
                      Open subject page
                    </button>
                    {!isRootSubject ? (
                      <button
                        type="button"
                        className="topic-tree-danger-button"
                        onClick={handleDeleteSubject}
                        disabled={deletingSubject}
                      >
                        {deletingSubject ? 'Removing...' : 'Remove leaf subject'}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="topic-tree-empty">Select a subject node to edit it.</div>
              )}
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default TopicTreePage;
