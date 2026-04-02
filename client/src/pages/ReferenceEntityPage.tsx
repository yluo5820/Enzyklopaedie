import React, { useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeRelationDetail,
  ReferenceEntity,
  ReferenceEntityKind,
  UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteReferenceEntity,
  fetchReferenceEntity,
  fetchReferenceEntityRelations,
  updateReferenceEntity,
} from '../api';
import './ReferenceEntityPage.css';

const kindOptions: ReferenceEntityKind[] = ['person', 'nation', 'civilization', 'era', 'place'];
const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  nation: 'Nation',
  civilization: 'Civilization',
  era: 'Era',
  place: 'Place',
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

const formatRelationType = (value: string) => value.replace(/_/g, ' ');

const parseYearInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
};

const toFormState = (entity: ReferenceEntity) => ({
  kind: entity.kind,
  title: entity.title,
  summary: entity.summary || '',
  description: entity.description || '',
  startYear: entity.startYear === undefined ? '' : String(entity.startYear),
  endYear: entity.endYear === undefined ? '' : String(entity.endYear),
});

const formatMetadataValue = (value: unknown) => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const buildSourceHref = (relation: KnowledgeRelationDetail) => {
  if (relation.fromEntityType === 'knowledge_item') return `/knowledge/${relation.fromEntityId}`;
  if (relation.fromEntityType === 'study_topic') return `/study-topics/${relation.fromEntityId}`;
  if (relation.fromEntityType === 'topic') return `/topics/${relation.fromEntityId}`;
  if (relation.fromEntityType === 'reference_entity') return `/entities/${relation.fromEntityId}`;
  return null;
};

const ReferenceEntityPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entityId = Number(id);

  const [entity, setEntity] = useState<ReferenceEntity | null>(null);
  const [relations, setRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [formState, setFormState] = useState({
    kind: 'person' as ReferenceEntityKind,
    title: '',
    summary: '',
    description: '',
    startYear: '',
    endYear: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(entityId) || entityId <= 0) {
      setError('Invalid reference entity.');
      setLoading(false);
      return;
    }

    const loadEntity = async () => {
      try {
        const [fetchedEntity, fetchedRelations] = await Promise.all([
          fetchReferenceEntity(entityId),
          fetchReferenceEntityRelations(entityId),
        ]);
        setEntity(fetchedEntity);
        setRelations(fetchedRelations);
        setFormState(toFormState(fetchedEntity));
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load reference entity.');
      } finally {
        setLoading(false);
      }
    };

    loadEntity();
  }, [entityId]);

  const legacySource = typeof entity?.metadata?.legacySource === 'string' ? entity.metadata.legacySource : null;
  const metadataEntries = useMemo(
    () => (entity?.metadata ? Object.entries(entity.metadata) : []),
    [entity?.metadata]
  );
  const externalLink =
    typeof entity?.metadata?.link === 'string' && entity.metadata.link
      ? entity.metadata.link
      : null;

  const itemRelations = useMemo(
    () => relations.filter((relation) => relation.fromEntityType === 'knowledge_item'),
    [relations]
  );
  const topicRelations = useMemo(
    () => relations.filter((relation) => relation.fromEntityType === 'study_topic'),
    [relations]
  );
  const subjectRelations = useMemo(
    () => relations.filter((relation) => relation.fromEntityType === 'topic'),
    [relations]
  );

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
    if (!entity || !formState.title.trim()) return;

    setSaving(true);
    setError(null);

    const payload: UpdateReferenceEntity = {
      kind: formState.kind,
      title: formState.title.trim(),
      summary: formState.summary.trim(),
      description: formState.description.trim(),
      startYear: parseYearInput(formState.startYear),
      endYear: parseYearInput(formState.endYear),
    };

    try {
      const updatedEntity = await updateReferenceEntity(entity.id, payload);
      setEntity(updatedEntity);
      setFormState(toFormState(updatedEntity));
    } catch (saveError) {
      console.error(saveError);
      setError('Failed to update reference entity.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entity || deleting) return;
    if (!window.confirm(`Remove "${entity.title}" from the reference atlas?`)) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteReferenceEntity(entity.id);
      navigate('/entities');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete reference entity.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="reference-entity-page">
        <div className="reference-entity-empty">Loading reference entity...</div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="reference-entity-page">
        <div className="reference-entity-empty">{error || 'Reference entity not found.'}</div>
      </div>
    );
  }

  return (
    <div className="reference-entity-page">
      <Link to="/entities" className="reference-entity-back">
        Back to Reference Atlas
      </Link>

      <section className="reference-entity-hero">
        <div>
          <span className="reference-entity-eyebrow">{kindLabels[entity.kind]}</span>
          <h1>{entity.title}</h1>
          <p>
            {entity.summary ||
              'This page holds the encyclopedic record for one person, nation, civilization, era, or place.'}
          </p>
        </div>
        <div className="reference-entity-stats">
          <div className="reference-entity-stat">
            <strong>{kindLabels[entity.kind]}</strong>
            <span>Entity kind</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{formatTimespan(entity)}</strong>
            <span>Chronology</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{topicRelations.length + subjectRelations.length}</strong>
            <span>Linked topics and subjects</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{itemRelations.length}</strong>
            <span>Linked items</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{formatDate(entity.updatedAt)}</strong>
            <span>Last updated</span>
          </div>
        </div>
      </section>

      {error ? <div className="reference-entity-error">{error}</div> : null}

      <div className="reference-entity-grid">
        <aside className="reference-entity-sidebar">
          <section className="reference-entity-panel">
            <span className="reference-entity-eyebrow">Identity</span>
            <h2>Record details</h2>
            <div className="reference-entity-side-list">
              <div className="reference-entity-side-item">
                <strong>Slug</strong>
                <span>{entity.slug}</span>
              </div>
              {legacySource ? (
                <div className="reference-entity-side-item">
                  <strong>Origin</strong>
                  <span>Imported from the legacy {legacySource} table</span>
                </div>
              ) : (
                <div className="reference-entity-side-item">
                  <strong>Origin</strong>
                  <span>Created directly in the new reference model</span>
                </div>
              )}
              {externalLink ? (
                <div className="reference-entity-side-item">
                  <strong>External link</strong>
                  <a href={externalLink} target="_blank" rel="noreferrer">
                    Open source link
                  </a>
                </div>
              ) : null}
            </div>
          </section>

          <section className="reference-entity-panel">
            <span className="reference-entity-eyebrow">Metadata</span>
            <h2>Attached fields</h2>
            {metadataEntries.length === 0 ? (
              <div className="reference-entity-empty">No metadata recorded yet.</div>
            ) : (
              <div className="reference-entity-side-list">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="reference-entity-side-item">
                    <strong>{key}</strong>
                    <span>{formatMetadataValue(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div className="reference-entity-main">
          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Topic Context</span>
                <h2>Topics and subjects pointing here</h2>
              </div>
            </div>

            {topicRelations.length === 0 && subjectRelations.length === 0 ? (
              <div className="reference-entity-empty">
                No topics or subjects point to this entity yet.
              </div>
            ) : (
              <div className="reference-entity-stack">
                {topicRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>topic</span>
                        </div>
                        <Link
                          to={buildSourceHref(relation) as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Topic #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
                {subjectRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>subject</span>
                        </div>
                        <Link
                          to={buildSourceHref(relation) as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Subject #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Item Context</span>
                <h2>Items pointing here</h2>
              </div>
            </div>

            {itemRelations.length === 0 ? (
              <div className="reference-entity-empty">No items point to this entity yet.</div>
            ) : (
              <div className="reference-entity-stack">
                {itemRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                        </div>
                        <Link
                          to={buildSourceHref(relation) as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Item #${relation.fromEntityId}`}</h3>
                        </Link>
                      </div>
                      <span>{formatDate(relation.createdAt)}</span>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Editor</span>
                <h2>Curate this entity</h2>
              </div>
              <button
                type="button"
                className="reference-entity-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Removing...' : 'Remove entity'}
              </button>
            </div>

            <form className="reference-entity-form" onSubmit={handleSubmit}>
              <div className="reference-entity-field">
                <label htmlFor="kind">Kind</label>
                <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                  {kindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {kindLabels[kind]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="reference-entity-field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" value={formState.title} onChange={handleChange} required />
              </div>

              <div className="reference-entity-grid-inline">
                <div className="reference-entity-field">
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

                <div className="reference-entity-field">
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

              <div className="reference-entity-field">
                <label htmlFor="summary">Summary</label>
                <textarea id="summary" name="summary" value={formState.summary} onChange={handleChange} />
              </div>

              <div className="reference-entity-field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formState.description}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ReferenceEntityPage;
