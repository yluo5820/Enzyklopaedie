import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeRelationDetail,
  KnowledgeRelationType,
  ReferenceEntity,
  ReferenceEntityKind,
  UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createReferenceEntityRelation,
  deleteReferenceEntity,
  deleteReferenceEntityRelation,
  fetchReferenceEntities,
  fetchReferenceEntity,
  fetchReferenceEntityOutgoingRelations,
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

type EntityStructurePreset = {
  allowedRelationTypes: KnowledgeRelationType[];
  defaultRelationType: KnowledgeRelationType;
  helperText: string;
  notePlaceholder: string;
  targetPrompt: string;
  targetKinds: ReferenceEntityKind[];
};

const entityStructurePresets: Record<ReferenceEntityKind, EntityStructurePreset> = {
  person: {
    allowedRelationTypes: ['located_in', 'during', 'part_of', 'related_to', 'influenced_by'],
    defaultRelationType: 'located_in',
    helperText:
      'Use entity links here for provenance and setting: where this person belongs, when they belong, and who influenced them.',
    notePlaceholder: 'Optional note about this affiliation or influence',
    targetPrompt: 'Choose a nation, civilization, era, place, or related person',
    targetKinds: ['nation', 'civilization', 'era', 'place', 'person'],
  },
  nation: {
    allowedRelationTypes: ['contains', 'part_of', 'during', 'located_in', 'related_to', 'influenced_by'],
    defaultRelationType: 'part_of',
    helperText:
      'Use this to place the nation inside a broader civilization, era, or geography, or to record sub-polities when useful.',
    notePlaceholder: 'Optional note about this national structure',
    targetPrompt: 'Choose a civilization, era, place, nation, or related polity',
    targetKinds: ['civilization', 'era', 'place', 'nation'],
  },
  civilization: {
    allowedRelationTypes: ['contains', 'part_of', 'located_in', 'related_to', 'influenced_by'],
    defaultRelationType: 'contains',
    helperText:
      'Civilizations usually contain nations and eras. Use part-of only when you need nested civilizational groupings.',
    notePlaceholder: 'Optional note about this civilizational scope',
    targetPrompt: 'Choose a nation, era, place, or sub-/super-civilization',
    targetKinds: ['nation', 'era', 'place', 'civilization'],
  },
  era: {
    allowedRelationTypes: ['contains', 'part_of', 'related_to', 'influenced_by'],
    defaultRelationType: 'contains',
    helperText:
      'Eras work best as chronological containers. Use contains for sub-eras and part-of for broader historical periods.',
    notePlaceholder: 'Optional note about this chronological structure',
    targetPrompt: 'Choose a sub-era, super-era, or closely related period',
    targetKinds: ['era'],
  },
  place: {
    allowedRelationTypes: ['contains', 'part_of', 'located_in', 'related_to'],
    defaultRelationType: 'part_of',
    helperText:
      'Places usually nest inside other places, and they can also host nations or civilizations when geography matters.',
    notePlaceholder: 'Optional note about this spatial structure',
    targetPrompt: 'Choose a place, nation, or civilization',
    targetKinds: ['place', 'nation', 'civilization'],
  },
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

const formatRelationType = (value: KnowledgeRelationType) => value.replace(/_/g, ' ');

const formatIncomingRelationType = (value: KnowledgeRelationType) =>
  value === 'contains' ? 'contained by' : formatRelationType(value);

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

const buildRelationHref = (relation: KnowledgeRelationDetail, direction: 'incoming' | 'outgoing') => {
  const entityType = direction === 'incoming' ? relation.fromEntityType : relation.toEntityType;
  const entityId = direction === 'incoming' ? relation.fromEntityId : relation.toEntityId;

  if (entityType === 'knowledge_item') return `/knowledge/${entityId}`;
  if (entityType === 'study_topic') return `/study-topics/${entityId}`;
  if (entityType === 'topic') return `/topics/${entityId}`;
  if (entityType === 'reference_entity') return `/entities/${entityId}`;
  return null;
};

const getTopicSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Topics about this person';
  if (kind === 'nation') return 'Topics about this nation';
  if (kind === 'civilization') return 'Topics about this civilization';
  if (kind === 'era') return 'Topics about this era';
  return 'Topics about this place';
};

const getItemSectionLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'person') return 'Authored works';
  return 'Linked items';
};

const getEntityStructureLabel = (kind: ReferenceEntityKind) => {
  if (kind === 'civilization') return 'Civilizational structure';
  if (kind === 'nation') return 'National structure';
  if (kind === 'era') return 'Era structure';
  if (kind === 'place') return 'Place structure';
  return 'Affiliations and influences';
};

const getKindPriority = (kindOrder: ReferenceEntityKind[]) =>
  kindOrder.reduce<Record<ReferenceEntityKind, number>>((accumulator, kind, index) => {
    accumulator[kind] = index;
    return accumulator;
  }, { person: 99, nation: 99, civilization: 99, era: 99, place: 99 });

const ReferenceEntityPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entityId = Number(id);

  const [entity, setEntity] = useState<ReferenceEntity | null>(null);
  const [allEntities, setAllEntities] = useState<ReferenceEntity[]>([]);
  const [incomingRelations, setIncomingRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [outgoingRelations, setOutgoingRelations] = useState<KnowledgeRelationDetail[]>([]);
  const [formState, setFormState] = useState({
    kind: 'person' as ReferenceEntityKind,
    title: '',
    summary: '',
    description: '',
    startYear: '',
    endYear: '',
  });
  const [relationForm, setRelationForm] = useState({
    toEntityId: '',
    relationType: 'contains' as KnowledgeRelationType,
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingRelation, setSavingRelation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(entityId) || entityId <= 0) {
      setError('Invalid reference entity.');
      setLoading(false);
      return;
    }

    const loadEntity = async () => {
      try {
        const [fetchedEntity, fetchedEntities, fetchedIncomingRelations, fetchedOutgoingRelations] =
          await Promise.all([
            fetchReferenceEntity(entityId),
            fetchReferenceEntities(),
            fetchReferenceEntityRelations(entityId),
            fetchReferenceEntityOutgoingRelations(entityId),
          ]);

        setEntity(fetchedEntity);
        setAllEntities(fetchedEntities);
        setIncomingRelations(fetchedIncomingRelations);
        setOutgoingRelations(fetchedOutgoingRelations);
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
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'knowledge_item'),
    [incomingRelations]
  );
  const authoredWorks = useMemo(
    () => itemRelations.filter((relation) => relation.relationType === 'created_by'),
    [itemRelations]
  );
  const relatedItems = useMemo(
    () => itemRelations.filter((relation) => relation.relationType !== 'created_by'),
    [itemRelations]
  );
  const topicRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'study_topic'),
    [incomingRelations]
  );
  const subjectRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'topic'),
    [incomingRelations]
  );
  const incomingEntityRelations = useMemo(
    () => incomingRelations.filter((relation) => relation.fromEntityType === 'reference_entity'),
    [incomingRelations]
  );
  const structurePreset = entity ? entityStructurePresets[entity.kind] : entityStructurePresets.person;
  const selectableEntities = useMemo(() => {
    const kindPriority = getKindPriority(structurePreset.targetKinds);

    return [...allEntities]
      .filter(
        (candidate) =>
          candidate.id !== entity?.id && structurePreset.targetKinds.includes(candidate.kind)
      )
      .sort((left, right) => {
        const leftPriority = kindPriority[left.kind] ?? 99;
        const rightPriority = kindPriority[right.kind] ?? 99;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const titleComparison = left.title.localeCompare(right.title);
        if (titleComparison !== 0) return titleComparison;

        return left.id - right.id;
      });
  }, [allEntities, entity?.id, structurePreset]);

  useEffect(() => {
    if (!entity) return;

    setRelationForm((current) => {
      const nextRelationType = structurePreset.allowedRelationTypes.includes(current.relationType)
        ? current.relationType
        : structurePreset.defaultRelationType;
      const hasSelectedTarget = selectableEntities.some(
        (candidate) => String(candidate.id) === current.toEntityId
      );
      const nextTargetId = hasSelectedTarget ? current.toEntityId : '';

      if (
        nextRelationType === current.relationType &&
        nextTargetId === current.toEntityId
      ) {
        return current;
      }

      return {
        ...current,
        relationType: nextRelationType,
        toEntityId: nextTargetId,
      };
    });
  }, [entity, selectableEntities, structurePreset]);

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
      startTransition(() => {
        setAllEntities((current) =>
          current.map((existing) => (existing.id === updatedEntity.id ? updatedEntity : existing))
        );
      });
    } catch (saveError) {
      console.error(saveError);
      setError('Failed to update reference entity.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRelation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entity || !relationForm.toEntityId) return;

    setSavingRelation(true);
    setError(null);

    try {
      const relation = await createReferenceEntityRelation(entity.id, {
        toEntityId: Number(relationForm.toEntityId),
        relationType: relationForm.relationType,
        note: relationForm.note.trim() || undefined,
      });

      startTransition(() => {
        setOutgoingRelations((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === relation.id);
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = relation;
            return next;
          }

          return [relation, ...current];
        });
      });

      setRelationForm({
        toEntityId: '',
        relationType: structurePreset.defaultRelationType,
        note: '',
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to create entity relation.');
    } finally {
      setSavingRelation(false);
    }
  };

  const handleDeleteRelation = async (relationId: number) => {
    if (!entity) return;

    try {
      await deleteReferenceEntityRelation(entity.id, relationId);
      startTransition(() => {
        setOutgoingRelations((current) => current.filter((relation) => relation.id !== relationId));
      });
    } catch (relationError) {
      console.error(relationError);
      setError('Failed to delete entity relation.');
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
            <strong>{authoredWorks.length || itemRelations.length}</strong>
            <span>{entity.kind === 'person' ? 'Authored works' : 'Linked items'}</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{topicRelations.length + subjectRelations.length}</strong>
            <span>Topics and subjects</span>
          </div>
          <div className="reference-entity-stat">
            <strong>{outgoingRelations.length + incomingEntityRelations.length}</strong>
            <span>Entity links</span>
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
                <span className="reference-entity-eyebrow">Atlas Context</span>
                <h2>{getTopicSectionLabel(entity.kind)}</h2>
              </div>
            </div>

            {topicRelations.length === 0 && subjectRelations.length === 0 ? (
              <div className="reference-entity-empty">No topics or subjects point here yet.</div>
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
                          to={buildRelationHref(relation, 'incoming') as string}
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
                          to={buildRelationHref(relation, 'incoming') as string}
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
                <h2>{getItemSectionLabel(entity.kind)}</h2>
              </div>
            </div>

            {entity.kind === 'person' ? (
              authoredWorks.length === 0 ? (
                <div className="reference-entity-empty">No authored works point to this person yet.</div>
              ) : (
                <div className="reference-entity-stack">
                  {authoredWorks.map((relation) => (
                    <article key={relation.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatRelationType(relation.relationType)}</span>
                            {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                          </div>
                          <Link
                            to={buildRelationHref(relation, 'incoming') as string}
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
              )
            ) : itemRelations.length === 0 ? (
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
                          to={buildRelationHref(relation, 'incoming') as string}
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

            {entity.kind === 'person' && relatedItems.length > 0 ? (
              <div className="reference-entity-subsection">
                <h3>Other item links</h3>
                <div className="reference-entity-stack">
                  {relatedItems.map((relation) => (
                    <article key={relation.id} className="reference-entity-card">
                      <div className="reference-entity-card-top">
                        <div>
                          <div className="reference-entity-badges">
                            <span>{formatRelationType(relation.relationType)}</span>
                            {relation.fromEntityKind ? <span>{relation.fromEntityKind}</span> : null}
                          </div>
                          <Link
                            to={buildRelationHref(relation, 'incoming') as string}
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
              </div>
            ) : null}
          </section>

          <section className="reference-entity-panel">
            <div className="reference-entity-section-head">
              <div>
                <span className="reference-entity-eyebrow">Structure</span>
                <h2>{getEntityStructureLabel(entity.kind)}</h2>
                <p className="reference-entity-section-copy">{structurePreset.helperText}</p>
              </div>
            </div>

            <form className="reference-entity-form" onSubmit={handleCreateRelation}>
              <div className="reference-entity-grid-inline">
                <div className="reference-entity-field">
                  <label htmlFor="entity-relation-type">Relation</label>
                  <select
                    id="entity-relation-type"
                    value={relationForm.relationType}
                    onChange={(event) =>
                      setRelationForm((current) => ({
                        ...current,
                        relationType: event.target.value as KnowledgeRelationType,
                      }))
                    }
                  >
                    {structurePreset.allowedRelationTypes.map((relationType) => (
                      <option key={relationType} value={relationType}>
                        {formatRelationType(relationType)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="reference-entity-field">
                  <label htmlFor="entity-relation-target">Target entity</label>
                  <select
                    id="entity-relation-target"
                    value={relationForm.toEntityId}
                    onChange={(event) =>
                      setRelationForm((current) => ({
                        ...current,
                        toEntityId: event.target.value,
                      }))
                    }
                  >
                    <option value="">{structurePreset.targetPrompt}</option>
                    {selectableEntities.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title} ({candidate.kind})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="reference-entity-field">
                <label htmlFor="entity-relation-note">Note</label>
                <input
                  id="entity-relation-note"
                  value={relationForm.note}
                  onChange={(event) =>
                    setRelationForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder={structurePreset.notePlaceholder}
                />
              </div>
              <button type="submit" disabled={savingRelation || !relationForm.toEntityId}>
                {savingRelation ? 'Linking...' : 'Add entity link'}
              </button>
            </form>

            {outgoingRelations.length === 0 && incomingEntityRelations.length === 0 ? (
              <div className="reference-entity-empty">
                No entity-to-entity links have been recorded yet.
              </div>
            ) : (
              <div className="reference-entity-stack">
                {outgoingRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatRelationType(relation.relationType)}</span>
                          <span>outgoing</span>
                        </div>
                        <Link
                          to={buildRelationHref(relation, 'outgoing') as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.toEntityTitle || `Entity #${relation.toEntityId}`}</h3>
                        </Link>
                      </div>
                      <button type="button" onClick={() => handleDeleteRelation(relation.id)}>
                        Delete
                      </button>
                    </div>
                    {relation.note ? <p>{relation.note}</p> : null}
                  </article>
                ))}
                {incomingEntityRelations.map((relation) => (
                  <article key={relation.id} className="reference-entity-card">
                    <div className="reference-entity-card-top">
                      <div>
                        <div className="reference-entity-badges">
                          <span>{formatIncomingRelationType(relation.relationType)}</span>
                          <span>incoming</span>
                        </div>
                        <Link
                          to={buildRelationHref(relation, 'incoming') as string}
                          className="reference-entity-card-link"
                        >
                          <h3>{relation.fromEntityTitle || `Entity #${relation.fromEntityId}`}</h3>
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
              <button type="button" className="reference-entity-danger" onClick={handleDelete} disabled={deleting}>
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
