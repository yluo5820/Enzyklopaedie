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

const formatStatusLabel = (value: KnowledgeItem['status']) =>
  value.charAt(0).toUpperCase() + value.slice(1);

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
          fetchActivityEvents(5),
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
  const recentActivityEvents = useMemo(() => activityEvents.slice(0, 5), [activityEvents]);
  const focusItems = useMemo(() => {
    const statusPriority: Record<KnowledgeItem['status'], number> = {
      active: 0,
      queued: 1,
      inbox: 2,
      completed: 3,
      archived: 4,
    };

    return [...knowledgeItems]
      .filter((item) => item.status === 'active' || item.status === 'queued' || item.status === 'inbox')
      .sort((left, right) => {
        const statusGap = statusPriority[left.status] - statusPriority[right.status];
        if (statusGap !== 0) return statusGap;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .slice(0, 4);
  }, [knowledgeItems]);
  const entityCounts = useMemo(
    () =>
      referenceEntities.reduce<Record<ReferenceEntity['kind'], number>>(
        (accumulator, entity) => {
          accumulator[entity.kind] += 1;
          return accumulator;
        },
        { person: 0, polity: 0, formation: 0, nation: 0, civilization: 0, era: 0, place: 0 }
      ),
    [referenceEntities]
  );
  const primaryEntityCount = entityCounts.person + entityCounts.polity + entityCounts.formation;
  const legacyEntityCount =
    entityCounts.nation + entityCounts.civilization + entityCounts.era + entityCounts.place;
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

      <section className="home-focus-grid">
        <section className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Continue</span>
            <h2>Study queue</h2>
            {loading ? <div className="home-empty">Loading current queue...</div> : null}
            {!loading && focusItems.length === 0 ? (
              <div className="home-empty">
                Nothing is waiting right now. Add an item or move something back into the queue.
              </div>
            ) : null}
            {!loading && focusItems.length > 0 ? (
              <div className="home-focus-list">
                {focusItems.map((item) => (
                  <Link key={item.id} to={`/knowledge/${item.id}`} className="home-focus-item">
                    <div className="home-focus-top">
                      <strong>{item.title}</strong>
                      <span className={`home-status-chip is-${item.status}`}>{formatStatusLabel(item.status)}</span>
                    </div>
                    <div className="home-focus-meta">
                      <span>{item.kind}</span>
                      <span>Updated {formatDate(item.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Resume</span>
            <h2>Recent surfaces</h2>
            <div className="home-resume-grid">
              <Link to={recentTopic ? `/topics/${recentTopic.id}` : '/subjects'} className="home-resume-card">
                <strong>Topic</strong>
                <span>{recentTopic ? recentTopic.name : 'No topic yet'}</span>
                <small>{recentTopic ? recentTopic.subjectName : 'Start from the subject tree'}</small>
              </Link>
              <Link
                to={recentEntity ? `/entities/${recentEntity.id}` : '/entities?view=list'}
                className="home-resume-card"
              >
                <strong>Entity</strong>
                <span>{recentEntity ? recentEntity.title : 'No entity yet'}</span>
                <small>{recentEntity ? recentEntity.kind : 'Open the atlas index'}</small>
              </Link>
              <Link
                to={recentSubject ? `/subjects/${recentSubject.id}` : '/subjects'}
                className="home-resume-card"
              >
                <strong>Subject</strong>
                <span>{recentSubject ? recentSubject.name : 'No subject yet'}</span>
                <small>{recentSubject ? `${recentSubject.topicCount} topics` : 'Open the subject tree'}</small>
              </Link>
              <Link
                to={recentItem ? `/knowledge/${recentItem.id}` : '/knowledge?view=list'}
                className="home-resume-card"
              >
                <strong>Item</strong>
                <span>{recentItem ? recentItem.title : 'No item yet'}</span>
                <small>{recentItem ? recentItem.status : 'Open the item workbench'}</small>
              </Link>
            </div>
          </div>
        </section>
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
            <span>{loading ? '...' : entityCounts.polity} built-in polities</span>
            <span>{loading ? '...' : entityCounts.formation} formations</span>
            <span>{loading ? '...' : legacyEntityCount} legacy atlas records</span>
          </div>
          <p>Build the historical world around the knowledge tree with people, polities, and formations.</p>
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
                <p>Finish the shift toward people, polities, and formations as the atlas backbone.</p>
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
                <strong>{loading ? '...' : primaryEntityCount}</strong>
                <span>Primary atlas records</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : legacyEntityCount}</strong>
                <span>Legacy atlas records</span>
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
          {!loading && recentActivityEvents.length === 0 ? (
            <div className="home-empty">
              No recorded activity yet. Add something in the item workbench and it will start
              appearing here.
            </div>
          ) : null}
          {!loading && recentActivityEvents.length > 0 ? (
            <div className="home-activity">
              {recentActivityEvents.map((event) => (
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
