import React, { useEffect, useMemo, useState } from 'react';
import type { TopicSummary } from '@enzyklopaedie/shared';
import { useNavigate } from 'react-router-dom';
import { fetchTopics } from '../api';
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

    return [{
      key: `${parent.topic.id}-${position.topic.id}`,
      fromX: parent.x + parent.radius,
      fromY: parent.y,
      toX: position.x - position.radius,
      toY: position.y,
    }];
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

const TopicTreePage: React.FC = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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
  const totalTopics = useMemo(
    () => topics.reduce((sum, topic) => sum + topic.topicCount, 0),
    [topics]
  );

  return (
    <div className="topic-tree-page">
      <section className="topic-tree-hero">
        <div>
          <span className="topic-tree-eyebrow">Subject Spine</span>
          <h1>Ontology Subject Tree</h1>
          <p>
            This is the encyclopedia’s synchronic subject taxonomy: a tech-tree style map rooted in
            Ontology, then branching into the disciplines and sub-disciplines you want to build out over
            time. Subjects contain contextual topics, and those topics contain the concrete items.
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

                  return (
                    <g
                      key={position.topic.id}
                      className="topic-tree-node"
                      transform={`translate(${position.x}, ${position.y})`}
                      onClick={() => navigate(`/topics/${position.topic.id}`)}
                    >
                      <circle
                        r={position.radius}
                        className={isRoot ? 'topic-tree-node-circle topic-tree-node-root' : 'topic-tree-node-circle'}
                        fill={isRoot ? 'url(#topicTreeRootGradient)' : undefined}
                      />
                      <text className="topic-tree-node-depth" y={-position.radius - 16}>
                        Tier {position.depth}
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
        ) : null}
      </section>
    </div>
  );
};

export default TopicTreePage;
