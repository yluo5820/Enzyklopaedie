import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  NewReferenceEntity,
  ReferenceEntity,
  ReferenceEntityKind,
} from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  fetchReferenceEntities,
} from '../api';
import './ReferenceEntitiesPage.css';

const kindOptions: ReferenceEntityKind[] = ['person', 'nation', 'civilization', 'era', 'place'];
const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'People',
  nation: 'Nations',
  civilization: 'Civilizations',
  era: 'Eras',
  place: 'Places',
};

type EntityFilter = 'all' | ReferenceEntityKind;

const initialFormState = {
  kind: 'person' as ReferenceEntityKind,
  title: '',
  summary: '',
  description: '',
  startYear: '',
  endYear: '',
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const formatYear = (value?: number) => {
  if (value === undefined) return null;
  if (value < 0) return `${Math.abs(value)} BCE`;
  if (value > 0) return `${value} CE`;
  return 'Year 0';
};

const formatTimespan = (entity: ReferenceEntity) => {
  const start = formatYear(entity.startYear);
  const end = formatYear(entity.endYear);

  if (start && end) return `${start} - ${end}`;
  return start || end || 'No chronology yet';
};

const getLegacySource = (entity: ReferenceEntity) =>
  typeof entity.metadata?.legacySource === 'string' ? entity.metadata.legacySource : null;

const parseYearInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const sortEntities = (entities: ReferenceEntity[]) =>
  [...entities].sort((left, right) => {
    const titleComparison = left.title.localeCompare(right.title);
    if (titleComparison !== 0) return titleComparison;
    return left.kind.localeCompare(right.kind);
  });

const ReferenceEntitiesPage: React.FC = () => {
  const [entities, setEntities] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<EntityFilter>('all');
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    const loadEntities = async () => {
      try {
        setEntities(await fetchReferenceEntities());
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load reference entities.');
      } finally {
        setLoading(false);
      }
    };

    loadEntities();
  }, []);

  const counts = useMemo(() => {
    const byKind = Object.fromEntries(kindOptions.map((kind) => [kind, 0])) as Record<
      ReferenceEntityKind,
      number
    >;

    for (const entity of entities) {
      byKind[entity.kind] += 1;
    }

    return byKind;
  }, [entities]);

  const filteredEntities = useMemo(() => {
    if (filter === 'all') return sortEntities(entities);
    return sortEntities(entities.filter((entity) => entity.kind === filter));
  }, [entities, filter]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.title.trim()) return;

    setSubmitting(true);
    setError(null);

    const payload: NewReferenceEntity = {
      kind: formState.kind,
      title: formState.title.trim(),
      summary: formState.summary.trim() || undefined,
      description: formState.description.trim() || undefined,
      startYear: parseYearInput(formState.startYear),
      endYear: parseYearInput(formState.endYear),
    };

    try {
      const createdEntity = await createReferenceEntity(payload);
      startTransition(() => {
        setEntities((current) => {
          const existingIndex = current.findIndex((entity) => entity.id === createdEntity.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = createdEntity;
            return next;
          }

          return [...current, createdEntity];
        });
      });
      setFormState(initialFormState);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to create reference entity.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entity: ReferenceEntity) => {
    try {
      await deleteReferenceEntity(entity.id);
      startTransition(() => {
        setEntities((current) => current.filter((entry) => entry.id !== entity.id));
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError(`Failed to remove ${entity.title}.`);
    }
  };

  return (
    <div className="reference-entities-page">
      <div className="reference-entities-layout">
        <aside className="reference-entities-panel reference-entities-form-panel">
          <div className="reference-entities-header">
            <span className="reference-entities-eyebrow">Reference Atlas</span>
            <h1>People, nations, eras, places</h1>
            <p>
              This is the second structural layer of the encyclopedia. Topics stay as the subject tree;
              reference entities hold the beings, polities, periods, and locations that knowledge items
              can later point to.
            </p>
          </div>

          <form className="reference-entities-form" onSubmit={handleSubmit}>
            <div className="reference-entities-field">
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </select>
            </div>

            <div className="reference-entities-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" value={formState.title} onChange={handleChange} required />
            </div>

            <div className="reference-entities-grid">
              <div className="reference-entities-field">
                <label htmlFor="startYear">Start Year</label>
                <input
                  id="startYear"
                  name="startYear"
                  type="number"
                  value={formState.startYear}
                  onChange={handleChange}
                  placeholder="-500 for BCE"
                />
              </div>

              <div className="reference-entities-field">
                <label htmlFor="endYear">End Year</label>
                <input
                  id="endYear"
                  name="endYear"
                  type="number"
                  value={formState.endYear}
                  onChange={handleChange}
                  placeholder="1453"
                />
              </div>
            </div>

            <div className="reference-entities-field">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                name="summary"
                value={formState.summary}
                onChange={handleChange}
                placeholder="A short encyclopedic description"
              />
            </div>

            <div className="reference-entities-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formState.description}
                onChange={handleChange}
                placeholder="Longer notes about this person, nation, civilization, era, or place"
              />
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Reference Entity'}
            </button>
          </form>
        </aside>

        <section className="reference-entities-content">
          <section className="reference-entities-panel reference-entities-summary">
            <div className="reference-entities-header">
              <span className="reference-entities-eyebrow">Structure</span>
              <h1>Unified Reference Model</h1>
              <p>
                The old author, nation, civilization, and era screens are now being folded into one
                system. The tree remains about disciplines; this atlas handles the rest of the world.
              </p>
            </div>

            <div className="reference-entities-stats">
              <div className="reference-entities-stat">
                <strong>{entities.length}</strong>
                <span>Total entities</span>
              </div>
              {kindOptions.map((kind) => (
                <div key={kind} className="reference-entities-stat">
                  <strong>{counts[kind]}</strong>
                  <span>{kindLabels[kind]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="reference-entities-panel reference-entities-list-panel">
            <div className="reference-entities-list-header">
              <div>
                <span className="reference-entities-eyebrow">Inventory</span>
                <h2>Reference entities</h2>
              </div>
            </div>

            <div className="reference-entities-filters">
              <button
                type="button"
                className={filter === 'all' ? 'reference-entities-filter is-active' : 'reference-entities-filter'}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              {kindOptions.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={
                    filter === kind ? 'reference-entities-filter is-active' : 'reference-entities-filter'
                  }
                  onClick={() => setFilter(kind)}
                >
                  {kindLabels[kind]}
                </button>
              ))}
            </div>

            {error ? <div className="reference-entities-error">{error}</div> : null}
            {loading ? <div className="reference-entities-empty">Loading reference entities...</div> : null}
            {!loading && filteredEntities.length === 0 ? (
              <div className="reference-entities-empty">
                No entities in this slice yet. Add the first one in the atlas workbench.
              </div>
            ) : null}

            {!loading && filteredEntities.length > 0 ? (
              <div className="reference-entities-items">
                {filteredEntities.map((entity) => {
                  const legacySource = getLegacySource(entity);

                  return (
                    <article key={entity.id} className="reference-entities-item">
                      <div className="reference-entities-item-top">
                        <div>
                          <div className="reference-entities-meta">
                            <span className="reference-entities-badge">{entity.kind}</span>
                            {legacySource ? (
                              <span className="reference-entities-badge reference-entities-badge-secondary">
                                imported from {legacySource}
                              </span>
                            ) : null}
                          </div>
                          <h3>{entity.title}</h3>
                          <div className="reference-entities-meta">
                            <span>{formatTimespan(entity)}</span>
                            <span>Updated {formatDate(entity.updatedAt)}</span>
                          </div>
                        </div>

                        <div className="reference-entities-actions">
                          <Link to={`/entities/${entity.id}`} className="reference-entities-link">
                            Open
                          </Link>
                          <button type="button" onClick={() => handleDelete(entity)}>
                            Remove
                          </button>
                        </div>
                      </div>

                      {entity.summary ? <p>{entity.summary}</p> : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  );
};

export default ReferenceEntitiesPage;
