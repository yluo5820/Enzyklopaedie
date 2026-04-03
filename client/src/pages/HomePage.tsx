import React, { useEffect, useMemo, useState } from 'react';
import type { ActivityEvent, KnowledgeItem, ReferenceEntity, SubjectSummary, TopicSummary } from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import {
  fetchActivityEvents,
  fetchKnowledgeItems,
  fetchReferenceEntities,
  fetchSubjects,
  fetchTopics,
} from '../api';
import { summarizeKnowledgeProgress } from '../utils/knowledgeProgress';
import './HomePage.css';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const buildActivityHref = (event: ActivityEvent) => {
  if (event.entityType === 'knowledge_item') return `/knowledge/${event.entityId}`;
  if (event.entityType === 'subject') return `/subjects/${event.entityId}`;
  if (event.entityType === 'topic') return `/topics/${event.entityId}`;
  if (event.entityType === 'reference_entity') return `/entities/${event.entityId}`;
  return null;
};

const getMostRecent = <T extends { updatedAt: string }>(values: T[]) =>
  [...values].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

const HomePage: React.FC = () => {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [referenceEntities, setReferenceEntities] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [items, events, fetchedSubjects, fetchedTopics, fetchedReferenceEntities] = await Promise.all([
          fetchKnowledgeItems(),
          fetchActivityEvents(8),
          fetchSubjects(),
          fetchTopics(),
          fetchReferenceEntities(),
        ]);
        setKnowledgeItems(items);
        setActivityEvents(events);
        setSubjects(fetchedSubjects);
        setTopics(fetchedTopics);
        setReferenceEntities(fetchedReferenceEntities);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => summarizeKnowledgeProgress(knowledgeItems), [knowledgeItems]);
  const recentItem = useMemo(() => getMostRecent(knowledgeItems), [knowledgeItems]);
  const recentSubject = useMemo(() => getMostRecent(subjects), [subjects]);
  const recentTopic = useMemo(() => getMostRecent(topics), [topics]);
  const recentEntity = useMemo(() => getMostRecent(referenceEntities), [referenceEntities]);
  const entityCounts = useMemo(
    () =>
      referenceEntities.reduce<Record<ReferenceEntity['kind'], number>>(
        (accumulator, entity) => {
          accumulator[entity.kind] += 1;
          return accumulator;
        },
        { person: 0, nation: 0, civilization: 0, era: 0, place: 0 }
      ),
    [referenceEntities]
  );
  const topLevelTopics = useMemo(
    () => topics.filter((topic) => !topic.parentTopicId).length,
    [topics]
  );

  return (
    <div className="home-page">
      <section className="home-hero">
        <span className="home-eyebrow">Enzyklopaedie</span>
        <h1>A local-first encyclopedia for what you learn.</h1>
        <p>
          The core model is now in place. Use this hub to move between daily capture, subject
          curation, atlas building, and the first historical surfaces without digging through the app.
        </p>
        <div className="home-links">
          <Link to="/knowledge">Add Item</Link>
          <Link to="/knowledge?view=list">Open Item List</Link>
          <Link to="/subjects">Open Subject Tree</Link>
          <Link to="/entities?view=list">Open Atlas Index</Link>
        </div>
      </section>

      <section className="home-surface-grid">
        <article className="home-surface-card">
          <span className="home-eyebrow">Items</span>
          <h2>{loading ? '...' : stats.total} captured</h2>
          <div className="home-surface-meta">
            <span>{loading ? '...' : stats.byStatus.inbox} inbox</span>
            <span>{loading ? '...' : stats.byStatus.active} active</span>
            <span>{loading ? '...' : stats.completed} completed</span>
          </div>
          <p>Keep daily capture and queue review friction-light.</p>
          <div className="home-surface-actions">
            <Link to="/knowledge">Add item</Link>
            <Link to="/knowledge?view=list">Open list</Link>
            {recentItem ? <Link to={`/knowledge/${recentItem.id}`}>Recent item: {recentItem.title}</Link> : null}
          </div>
        </article>

        <article className="home-surface-card">
          <span className="home-eyebrow">Subjects</span>
          <h2>{loading ? '...' : subjects.length} branches</h2>
          <div className="home-surface-meta">
            <span>{loading ? '...' : topics.length} total topics</span>
            <span>{loading ? '...' : topLevelTopics} top-level topics</span>
          </div>
          <p>Shape the synchronic tree rooted at Ontology.</p>
          <div className="home-surface-actions">
            <Link to="/subjects">Open tree</Link>
            {recentSubject ? <Link to={`/subjects/${recentSubject.id}`}>Recent subject: {recentSubject.name}</Link> : null}
            {recentTopic ? <Link to={`/topics/${recentTopic.id}`}>Recent topic: {recentTopic.name}</Link> : null}
          </div>
        </article>

        <article className="home-surface-card">
          <span className="home-eyebrow">Topics</span>
          <h2>{loading ? '...' : topics.length} study contexts</h2>
          <div className="home-surface-meta">
            <span>{loading ? '...' : topics.filter((topic) => topic.itemCount > 0).length} with items</span>
            <span>{loading ? '...' : topics.filter((topic) => topic.childTopicCount > 0).length} with subtopics</span>
          </div>
          <p>Use topics as the living places where items and history meet.</p>
          <div className="home-surface-actions">
            <Link to="/subjects">Find a topic</Link>
            {recentTopic ? <Link to={`/topics/${recentTopic.id}`}>Continue topic</Link> : null}
          </div>
        </article>

        <article className="home-surface-card">
          <span className="home-eyebrow">Entity Atlas</span>
          <h2>{loading ? '...' : referenceEntities.length} atlas records</h2>
          <div className="home-surface-meta">
            <span>{loading ? '...' : entityCounts.person} people</span>
            <span>{loading ? '...' : entityCounts.nation + entityCounts.civilization} historical bodies</span>
            <span>{loading ? '...' : entityCounts.era + entityCounts.place} eras & places</span>
          </div>
          <p>Build the world around the knowledge tree: people, polities, periods, and places.</p>
          <div className="home-surface-actions">
            <Link to="/entities">Add entity</Link>
            <Link to="/entities?view=list">Open atlas</Link>
            {recentEntity ? <Link to={`/entities/${recentEntity.id}`}>Recent entity: {recentEntity.title}</Link> : null}
          </div>
        </article>
      </section>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Current Focus</span>
            <h2>Product Spine</h2>
            <div className="home-pillars">
              <div className="home-pillar">
                <strong>Daily capture</strong>
                <p>Keep item capture fast enough to use every day.</p>
              </div>
              <div className="home-pillar">
                <strong>Subject and topic curation</strong>
                <p>Make subjects and topics feel like real encyclopedia pages.</p>
              </div>
              <div className="home-pillar">
                <strong>Entity atlas</strong>
                <p>Differentiate people, nations, civilizations, eras, and places more strongly.</p>
              </div>
              <div className="home-pillar">
                <strong>Historical framing</strong>
                <p>Feed better time-and-place data into the world-history surface.</p>
              </div>
              <div className="home-pillar">
                <strong>Progress and exhibition</strong>
                <p>Turn activity, milestones, and showcases into the satisfaction loop.</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Current State</span>
            <h3>At a glance</h3>
            <div className="home-stats">
              <div className="home-stat">
                <strong>{loading ? '...' : stats.total}</strong>
                <span>Items</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : stats.active}</strong>
                <span>Active items</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : stats.completed}</strong>
                <span>Completed items</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : subjects.length}</strong>
                <span>Subjects</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : topics.length}</strong>
                <span>Topics</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : referenceEntities.length}</strong>
                <span>Reference entities</span>
              </div>
              <div className="home-stat">
                <strong>Prototype</strong>
                <span>World history</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="home-panel" style={{ marginTop: '22px' }}>
        <div className="home-panel-inner">
          <span className="home-eyebrow">Activity</span>
          <h2>Recent development of the encyclopedia</h2>
          {loading ? <div className="home-empty">Loading activity...</div> : null}
          {!loading && activityEvents.length === 0 ? (
            <div className="home-empty">
              No recorded activity yet. Add something in the item workbench and it will start
              appearing here.
            </div>
          ) : null}
          {!loading && activityEvents.length > 0 ? (
            <div className="home-activity">
              {activityEvents.map((event) => (
                <div key={event.id} className="home-activity-item">
                  <div className="home-activity-top">
                    <strong>{event.message}</strong>
                    <span>{formatDate(event.occurredAt)}</span>
                  </div>
                  <div className="home-activity-meta">
                    <span>{event.entityType.replace(/_/g, ' ')}</span>
                    {buildActivityHref(event) ? <Link to={buildActivityHref(event) as string}>Open</Link> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
