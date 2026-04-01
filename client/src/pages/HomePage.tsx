import React, { useEffect, useMemo, useState } from 'react';
import type { ActivityEvent, KnowledgeItem } from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import { fetchActivityEvents, fetchKnowledgeItems } from '../api';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [items, events] = await Promise.all([
          fetchKnowledgeItems(),
          fetchActivityEvents(6),
        ]);
        setKnowledgeItems(items);
        setActivityEvents(events);
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
          world: capture books and lectures, classify them into a living taxonomy, place them on a
          chronology, track tasks and reviews, and eventually publish exhibition pages that show the
          growth of your collection.
        </p>
        <div className="home-links">
          <Link to="/topics">Open Topic Tree</Link>
          <Link to="/knowledge">Open Knowledge Workbench</Link>
          <Link to="/world-history">Open World History</Link>
          <Link to="/books">Open Legacy Library</Link>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-inner">
            <span className="home-eyebrow">Product Spine</span>
            <h2>What we are building next</h2>
            <p>
              The current rebuild is centered on one unified knowledge model. Everything else should hang
              off that model instead of living as isolated CRUD screens.
            </p>
            <div className="home-pillars">
              <div className="home-pillar">
                <strong>Knowledge objects</strong>
                <p>Books, lectures, articles, and courses live in one shared structure.</p>
              </div>
              <div className="home-pillar">
                <strong>Taxonomy and relations</strong>
                <p>Topics should branch, relate, and reveal the structure of your encyclopedia.</p>
              </div>
              <div className="home-pillar">
                <strong>Chronology and places</strong>
                <p>The map only becomes meaningful once items carry time and place data.</p>
              </div>
              <div className="home-pillar">
                <strong>Progress and exhibition</strong>
                <p>Activity history, milestones, and curated pages turn the archive into something alive.</p>
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
                <span>Knowledge items</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : stats.active}</strong>
                <span>Active items</span>
              </div>
              <div className="home-stat">
                <strong>{loading ? '...' : stats.completed}</strong>
                <span>Completed items</span>
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
              No recorded activity yet. Add something in the knowledge workbench and it will start
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
