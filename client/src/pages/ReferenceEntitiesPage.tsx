import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  NewReferenceEntity,
  ReferenceEntity,
  ReferenceEntityKind,
} from '@enzyklopaedie/shared';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  fetchReferenceEntities,
} from '../api';
import './ReferenceEntitiesPage.css';

const browseKindOptions: ReferenceEntityKind[] = ['person', 'polity', 'formation'];
const creatableKindOptions: ReferenceEntityKind[] = ['person', 'formation'];
const kindLabels: Record<ReferenceEntityKind, string> = {
  person: 'People',
  polity: 'Polities',
  formation: 'Formations',
};
const singularKindLabels: Record<ReferenceEntityKind, string> = {
  person: 'Person',
  polity: 'Polity',
  formation: 'Formation',
};
const kindAtlasLeads: Record<ReferenceEntityKind, string> = {
  person: 'Writers, thinkers, speakers, and other individual figures.',
  polity: 'Built-in historical-geographical units imported from the world-history basemap.',
  formation: 'User-curated groupings of polities across time and space.',
};

type EntityWorkbenchPreset = {
  lead: string;
  startYearLabel: string;
  endYearLabel: string;
  startYearPlaceholder: string;
  endYearPlaceholder: string;
  chronologyHint: string;
  summaryPlaceholder: string;
  descriptionPlaceholder: string;
  submitLabel: string;
  nextStep: string;
};

const entityWorkbenchPresets: Record<ReferenceEntityKind, EntityWorkbenchPreset> = {
  person: {
    lead:
      'People anchor provenance. Start with identity and life dates here, then link polities, formations, and influences on the detail page.',
    startYearLabel: 'Birth Year',
    endYearLabel: 'Death Year',
    startYearPlaceholder: '384 for Aristotle',
    endYearPlaceholder: '322',
    chronologyHint: 'Use life dates when known. Leave either field blank if uncertain.',
    summaryPlaceholder: 'Who is this person in one sentence?',
    descriptionPlaceholder: 'Biographical notes, role, major works, and why this person matters.',
    submitLabel: 'Add Person',
    nextStep: 'After saving, connect this person to items through created_by and to polities or formations.',
  },
  polity: {
    lead:
      'Polities are atlas-backed records imported from historical basemaps. They should normally come from the world-history importer, not be typed in here.',
    startYearLabel: 'Begin Year',
    endYearLabel: 'End Year',
    startYearPlaceholder: '-27',
    endYearPlaceholder: '476',
    chronologyHint: 'Polity chronology should normally be driven by imported atlas snapshots.',
    summaryPlaceholder: 'Built-in polity record',
    descriptionPlaceholder: 'Atlas-backed polity notes belong on the detail page once the importer has created the record.',
    submitLabel: 'Add Polity',
    nextStep: 'Use the world-history importer to seed polities from historical basemaps.',
  },
  formation: {
    lead:
      'Formations are user-curated spatiotemporal groupings of polities. Use them for historical continuities, regional periods, and civilizational spans.',
    startYearLabel: 'Begin Year',
    endYearLabel: 'End Year',
    startYearPlaceholder: '-323',
    endYearPlaceholder: '1453',
    chronologyHint: 'Use the broad span of the formation itself. Specific polity memberships can be dated on the detail page.',
    summaryPlaceholder: 'What historical formation does this record name?',
    descriptionPlaceholder: 'Notes on the scope, subtype, membership logic, and why these polities belong together.',
    submitLabel: 'Add Formation',
    nextStep: 'After saving, add polity memberships to define the formation directly.',
  },
};

type EntityFilter = 'all' | ReferenceEntityKind;
type EntityWorkbenchView = 'create' | 'list';

const createInitialFormState = (kind: ReferenceEntityKind = 'person') => ({
  kind,
  title: '',
  summary: '',
  description: '',
  startYear: '',
  endYear: '',
});

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

const previewTitles = (entities: ReferenceEntity[], limit = 2) => {
  if (entities.length === 0) return 'No entries yet';
  const preview = entities.slice(0, limit).map((entity) => entity.title).join(' · ');
  if (entities.length > limit) return `${preview} +${entities.length - limit}`;
  return preview;
};

const isBuiltInPolityReferenceEntity = (entity: Pick<ReferenceEntity, 'kind' | 'metadata'>) =>
  entity.kind === 'polity' &&
  entity.metadata?.atlasSource === 'historical-basemaps' &&
  entity.metadata?.builtIn === true;

const ReferenceEntitiesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entities, setEntities] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [filter, setFilter] = useState<EntityFilter>('all');
  const [formState, setFormState] = useState(createInitialFormState());
  const viewMode: EntityWorkbenchView = searchParams.get('view') === 'list' ? 'list' : 'create';

  const setViewMode = (nextViewMode: EntityWorkbenchView) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextViewMode === 'list') {
      nextSearchParams.set('view', 'list');
    } else {
      nextSearchParams.delete('view');
    }

    setSearchParams(nextSearchParams);
  };

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

  const workbenchPreset = entityWorkbenchPresets[formState.kind];

  const counts = useMemo(() => {
    const byKind = Object.fromEntries(browseKindOptions.map((kind) => [kind, 0])) as Record<
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
  const groupedEntities = useMemo(
    () =>
      browseKindOptions.map((kind) => ({
        kind,
        title: kindLabels[kind],
        lead: kindAtlasLeads[kind],
        entities: sortEntities(entities.filter((entity) => entity.kind === kind)),
      })),
    [entities]
  );
  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groupedEntities.filter((group) => group.entities.length > 0);

    const group = groupedEntities.find((candidate) => candidate.kind === filter);
    return group ? [group] : [];
  }, [filter, groupedEntities]);

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
      const savedKind = payload.kind;
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
      setFormState(createInitialFormState(savedKind));
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
      {viewMode === 'create' ? (
        <section className="reference-entities-panel reference-entities-single-panel reference-entities-create-panel">
          <div className="reference-entities-header reference-entities-header-row">
            <div>
              <span className="reference-entities-eyebrow">Reference Atlas</span>
              <h1>Add {singularKindLabels[formState.kind]}</h1>
              <p>Capture one primary atlas record at a time. New history work should start with people or formations.</p>
            </div>
            <button
              type="button"
              className="reference-entities-secondary-button"
              onClick={() => setViewMode('list')}
            >
              Show Atlas Index ({entities.length})
            </button>
          </div>

          {error ? <div className="reference-entities-error">{error}</div> : null}

          <div className="reference-entities-create-toolbar">
            <button
              type="button"
              className={`reference-entities-secondary-button${showAdvancedDetails ? ' is-active' : ''}`}
              onClick={() => setShowAdvancedDetails((current) => !current)}
            >
              {showAdvancedDetails ? 'Hide advanced details' : 'Show advanced details'}
            </button>
          </div>

          <form className="reference-entities-form reference-entities-form-grid" onSubmit={handleSubmit}>
            <div className="reference-entities-field reference-entities-field-span-4 is-primary">
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                {creatableKindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {singularKindLabels[kind]}
                  </option>
                ))}
              </select>
            </div>

            <div className="reference-entities-field reference-entities-field-span-8 is-primary">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" value={formState.title} onChange={handleChange} required />
            </div>

            {showAdvancedDetails ? (
              <>
                <div className="reference-entities-field reference-entities-field-span-6">
                  <label htmlFor="startYear">{workbenchPreset.startYearLabel}</label>
                  <input
                    id="startYear"
                    name="startYear"
                    type="number"
                    value={formState.startYear}
                    onChange={handleChange}
                    placeholder={workbenchPreset.startYearPlaceholder}
                  />
                </div>

                <div className="reference-entities-field reference-entities-field-span-6">
                  <label htmlFor="endYear">{workbenchPreset.endYearLabel}</label>
                  <input
                    id="endYear"
                    name="endYear"
                    type="number"
                    value={formState.endYear}
                    onChange={handleChange}
                    placeholder={workbenchPreset.endYearPlaceholder}
                  />
                </div>

                <div className="reference-entities-inline-note reference-entities-field-span-12">
                  {workbenchPreset.chronologyHint}
                </div>

                <div className="reference-entities-field reference-entities-field-span-6">
                  <label htmlFor="summary">Summary</label>
                  <textarea
                    id="summary"
                    name="summary"
                    value={formState.summary}
                    onChange={handleChange}
                    placeholder={workbenchPreset.summaryPlaceholder}
                  />
                </div>

                <div className="reference-entities-field reference-entities-field-span-6">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formState.description}
                    onChange={handleChange}
                    placeholder={workbenchPreset.descriptionPlaceholder}
                  />
                </div>

                <div className="reference-entities-note reference-entities-field-span-12">
                  <strong>Next step after creation</strong>
                  <span>{workbenchPreset.nextStep}</span>
                </div>
              </>
            ) : (
              <div className="reference-entities-collapsed-note reference-entities-field-span-12">
                Chronology, summary, description, and next-step guidance are hidden until you open advanced details.
              </div>
            )}

            <div className="reference-entities-form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : workbenchPreset.submitLabel}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="reference-entities-panel reference-entities-single-panel reference-entities-list-panel">
          <div className="reference-entities-header reference-entities-header-row">
            <div>
              <span className="reference-entities-eyebrow">Atlas Index</span>
              <h1>Reference Atlas</h1>
              <p>Browse the atlas backbone directly: people, built-in polities, and formations.</p>
            </div>
            <button
              type="button"
              className="reference-entities-secondary-button"
              onClick={() => setViewMode('create')}
            >
              Back to Add Entity
            </button>
          </div>

          {error ? <div className="reference-entities-error">{error}</div> : null}

          <div className="reference-entities-stats">
            <div className="reference-entities-stat">
              <strong>{entities.length}</strong>
              <span>Total entities</span>
            </div>
            {groupedEntities.map((group) => (
              <div key={group.kind} className="reference-entities-stat reference-entities-stat-rich">
                <strong>{counts[group.kind]}</strong>
                <span>{group.title}</span>
                <small>{previewTitles(group.entities)}</small>
              </div>
            ))}
          </div>

          <div className="reference-entities-filters">
            <button
              type="button"
              className={filter === 'all' ? 'reference-entities-filter is-active' : 'reference-entities-filter'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {browseKindOptions.map((kind) => (
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

          {loading ? <div className="reference-entities-empty">Loading reference entities...</div> : null}
          {!loading && filteredEntities.length === 0 ? (
            <div className="reference-entities-empty">
              No entities in this slice yet. Switch back and add the first atlas record.
            </div>
          ) : null}

          {!loading && filteredEntities.length > 0 ? (
            <div className="reference-entities-groups">
              {visibleGroups.map((group) => (
                <section key={group.kind} className="reference-entities-kind-group">
                  <div className="reference-entities-kind-head">
                    <div>
                      <div className="reference-entities-meta">
                        <span className="reference-entities-badge">{group.kind}</span>
                        <span className="reference-entities-kind-count">{group.entities.length}</span>
                      </div>
                      <h3>{group.title}</h3>
                      <p>{group.lead}</p>
                    </div>
                  </div>

                  <div className="reference-entities-items">
                    {group.entities.map((entity) => {
                      const legacySource = getLegacySource(entity);
                      const isBuiltInPolity = isBuiltInPolityReferenceEntity(entity);
                      return (
                        <article key={entity.id} className="reference-entities-item">
                          <div className="reference-entities-item-top">
                            <div>
                              <div className="reference-entities-meta">
                                <span className="reference-entities-badge">{entity.kind}</span>
                                {isBuiltInPolity ? (
                                  <span className="reference-entities-badge reference-entities-badge-secondary">
                                    atlas built-in
                                  </span>
                                ) : null}
                                {legacySource ? (
                                  <span className="reference-entities-badge reference-entities-badge-secondary">
                                    imported from {legacySource}
                                  </span>
                                ) : null}
                              </div>
                              <h4>{entity.title}</h4>
                              <div className="reference-entities-meta">
                                <span>{formatTimespan(entity)}</span>
                                <span>Updated {formatDate(entity.updatedAt)}</span>
                              </div>
                            </div>

                            <div className="reference-entities-actions">
                              <Link
                                to={`/entities/${entity.id}`}
                                state={{ returnTo: '/entities?view=list' }}
                                className="reference-entities-link"
                              >
                                Open
                              </Link>
                              {!isBuiltInPolity ? (
                                <button type="button" onClick={() => handleDelete(entity)}>
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {entity.summary ? <p>{entity.summary}</p> : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default ReferenceEntitiesPage;
