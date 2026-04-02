import React, { useEffect, useMemo, useState } from 'react';
import type { ActivityEvent, KnowledgeItem } from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import { fetchActivityEvents, fetchKnowledgeItems, fetchReferenceEntities } from '../api';
import { summarizeKnowledgeProgress } from '../utils/knowledgeProgress';
import './HomePage.css';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const HomePage: React.FC = () => {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [referenceEntityCount, setReferenceEntityCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [items, events, referenceEntities] = await Promise.all([
          fetchKnowledgeItems(),
          fetchActivityEvents(6),
          fetchReferenceEntities(),
        ]);
        setKnowledgeItems(items);
        setActivityEvents(events);
        setReferenceEntityCount(referenceEntities.length);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => summarizeKnowledgeProgress(knowledgeItems), [knowledgeItems]);

  return (
    <div className="home-page">
      <section className="home-hero">
        <span className="home-eyebrow">Enzyklopaedie</span>
        <h1>A local-first encyclopedia for what you learn.</h1>
        <p>
          The direction is no longer just a reading log. This project is becoming a personal knowledge
          world: capture items, organize them through subjects and topics, place them in a
          chronology, track tasks and reviews, and eventually publish exhibition pages that show the
          growth of your collection.
        </p>
        <div className="home-links">
          <Link to="/subjects">Open Subject Tree</Link>
          <Link to="/knowledge">Open Item Workbench</Link>
          <Link to="/entities">Open Reference Atlas</Link>
          <Link to="/world-history">Open World History</Link>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Product Spine</span>
            <h2>What we are building next</h2>
            <p>
              The model is mostly in place now. The next phase is making the encyclopedia feel easy to
              use every day: faster capture, calmer pages, stronger historical context, and clearer
              ways to see progress.
            </p>
            <div className="home-pillars">
              <div className="home-pillar">
                <strong>Daily capture</strong>
                <p>Item creation should stay friction-light, so adding a book or lecture feels like the default daily action.</p>
              </div>
              <div className="home-pillar">
                <strong>Subject and topic curation</strong>
                <p>Subject and topic pages now need to read less like admin screens and more like living encyclopedia surfaces.</p>
              </div>
              <div className="home-pillar">
                <strong>Entity atlas</strong>
                <p>People, nations, civilizations, eras, and places should become structured context pages instead of loose records.</p>
              </div>
              <div className="home-pillar">
                <strong>Historical framing</strong>
                <p>
                  The next map step is not more rendering tricks. It is better time-and-place data flowing out of topics and entities.
                </p>
              </div>
              <div className="home-pillar">
                <strong>Progress and exhibition</strong>
                <p>After the core pages feel right, activity history, milestones, and showcase pages can turn the archive outward.</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Current State</span>
            <h3>Foundation metrics</h3>
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
                <strong>{loading ? '...' : referenceEntityCount}</strong>
                <span>Reference entities</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="home-panel" style={{ marginTop: '22px' }}>
        <div className="home-panel-inner">
          <span className="home-eyebrow">Activity</span>
          <h2>Recent development of the encyclopedia</h2>
          <p>
            This is the beginning of the satisfaction loop you described: the system should remember not
            just what exists, but what has changed.
          </p>
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
                  <strong>{event.message}</strong>
                  <span>{formatDate(event.occurredAt)}</span>
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
