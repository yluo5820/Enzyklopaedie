import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeItemKind,
  KnowledgeItemStatus,
  NewKnowledgeItem,
  ReferenceEntity,
} from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import {
  createKnowledgeItem,
  createKnowledgeRelation,
  deleteKnowledgeItem,
  fetchKnowledgeItems,
  fetchReferenceEntities,
} from '../api';
import { summarizeKnowledgeProgress } from '../utils/knowledgeProgress';
import './KnowledgePage.css';

const kindOptions: KnowledgeItemKind[] = [
  'book',
  'lecture',
  'article',
  'essay',
  'video',
  'podcast',
  'course',
  'artifact',
];

const statusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];

const initialFormState = {
  kind: 'book' as KnowledgeItemKind,
  title: '',
  creator: '',
  creatorEntityId: '',
  sourceName: '',
  sourceUrl: '',
  summary: '',
  publishedYear: '',
  status: 'inbox' as KnowledgeItemStatus,
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

const KnowledgePage: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [people, setPeople] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const [fetchedItems, fetchedPeople] = await Promise.all([
          fetchKnowledgeItems(),
          fetchReferenceEntities('person'),
        ]);
        setItems(fetchedItems);
        setPeople(
          [...fetchedPeople].sort((left, right) => left.title.localeCompare(right.title))
        );
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load items.');
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  const stats = useMemo(() => summarizeKnowledgeProgress(items), [items]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreatorEntityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    const selectedPerson = people.find((person) => String(person.id) === nextId);

    setFormState((current) => ({
      ...current,
      creatorEntityId: nextId,
      creator: selectedPerson ? selectedPerson.title : current.creator,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.title.trim()) return;

    setSubmitting(true);
    setError(null);

    const payload: NewKnowledgeItem = {
      kind: formState.kind,
      title: formState.title.trim(),
      creator: formState.creator.trim() || undefined,
      sourceName: formState.sourceName.trim() || undefined,
      sourceUrl: formState.sourceUrl.trim() || undefined,
      summary: formState.summary.trim() || undefined,
      publishedYear: formState.publishedYear ? Number(formState.publishedYear) : undefined,
      status: formState.status,
    };

    try {
      const createdItem = await createKnowledgeItem(payload);
      let relationFailed = false;

      if (formState.creatorEntityId) {
        try {
          await createKnowledgeRelation(createdItem.id, {
            toEntityType: 'reference_entity',
            toEntityId: Number(formState.creatorEntityId),
            relationType: 'created_by',
          });
        } catch (relationError) {
          console.error(relationError);
          relationFailed = true;
        }
      }

      startTransition(() => {
        setItems((current) => [createdItem, ...current]);
      });
      setFormState(initialFormState);
      if (relationFailed) {
        setError('Item was created, but the creator entity link could not be saved.');
      }
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to create item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteKnowledgeItem(id);
      startTransition(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete item.');
    }
  };

  return (
    <div className="knowledge-page">
      <div className="knowledge-layout">
        <aside className="knowledge-panel knowledge-form-panel">
          <div className="knowledge-header">
            <span className="knowledge-eyebrow">Phase 1</span>
            <h1>Item Workbench</h1>
            <p>
              Capture the concrete works that make up your encyclopedia. Books and lectures are now just
              different kinds of items.
            </p>
          </div>

          <form className="knowledge-form" onSubmit={handleSubmit}>
            <div className="knowledge-field">
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>

            <div className="knowledge-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" value={formState.title} onChange={handleChange} required />
            </div>

            <div className="knowledge-field">
              <label htmlFor="creator">Creator / Author / Speaker</label>
              <input id="creator" name="creator" value={formState.creator} onChange={handleChange} />
            </div>

            <div className="knowledge-field">
              <label htmlFor="creatorEntityId">Creator Entity</label>
              <select
                id="creatorEntityId"
                name="creatorEntityId"
                value={formState.creatorEntityId}
                onChange={handleCreatorEntityChange}
              >
                <option value="">Keep this as plain text for now</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.title}
                  </option>
                ))}
              </select>
              <span className="knowledge-field-hint">
                Selecting a person here will also create a formal <code>created_by</code> link.
              </span>
            </div>

            <div className="knowledge-field">
              <label htmlFor="sourceName">Source</label>
              <input
                id="sourceName"
                name="sourceName"
                value={formState.sourceName}
                onChange={handleChange}
                placeholder="Publisher, channel, collection..."
              />
            </div>

            <div className="knowledge-field">
              <label htmlFor="sourceUrl">Source URL</label>
              <input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                value={formState.sourceUrl}
                onChange={handleChange}
              />
            </div>

            <div className="knowledge-field">
              <label htmlFor="publishedYear">Published Year</label>
              <input
                id="publishedYear"
                name="publishedYear"
                type="number"
                value={formState.publishedYear}
                onChange={handleChange}
              />
            </div>

            <div className="knowledge-field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" value={formState.status} onChange={handleChange}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="knowledge-field">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                name="summary"
                value={formState.summary}
                onChange={handleChange}
                placeholder="Why does this belong in your encyclopedia?"
              />
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Item'}
            </button>
          </form>
        </aside>

        <section className="knowledge-content">
          <section className="knowledge-panel knowledge-summary">
            <div className="knowledge-header">
              <span className="knowledge-eyebrow">Foundation</span>
              <h1>Unified Item Model</h1>
              <p>
                This is the concrete inventory layer of the encyclopedia. The surrounding layers now
                organize these items through subjects, topics, entities, notes, tasks, places, and
                exhibitions.
              </p>
            </div>
            <div className="knowledge-summary-grid">
              <div className="knowledge-stat">
                <strong>{stats.total}</strong>
                <span>Total items</span>
              </div>
              <div className="knowledge-stat">
                <strong>{stats.active}</strong>
                <span>Currently active</span>
              </div>
              <div className="knowledge-stat">
                <strong>{stats.completed}</strong>
                <span>Completed entries</span>
              </div>
            </div>
          </section>

          <section className="knowledge-panel knowledge-list-panel">
            <div className="knowledge-list-header">
              <div>
                <span className="knowledge-eyebrow">Inventory</span>
                <h2>Items</h2>
              </div>
            </div>

            {error && <div className="knowledge-error">{error}</div>}
            {loading ? <div className="knowledge-empty">Loading items...</div> : null}
            {!loading && items.length === 0 ? (
              <div className="knowledge-empty">
                No items yet. Add the first entry in the workbench to begin the rebuild.
              </div>
            ) : null}

            {!loading && items.length > 0 ? (
              <div className="knowledge-items">
                {items.map((item) => (
                  <article key={item.id} className="knowledge-item">
                    <div className="knowledge-item-top">
                      <div>
                        <div className="knowledge-meta">
                          <span className="knowledge-badge">{item.kind}</span>
                          <span className="knowledge-badge knowledge-status">{item.status}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <div className="knowledge-meta">
                          {item.creator ? <span>{item.creator}</span> : null}
                          {item.sourceName ? <span>{item.sourceName}</span> : null}
                          {item.publishedYear ? <span>{item.publishedYear}</span> : null}
                          <span>Updated {formatDate(item.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="knowledge-item-actions">
                        <Link to={`/knowledge/${item.id}`} className="knowledge-item-link">
                          Open
                        </Link>
                        <button type="button" onClick={() => handleDelete(item.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    {item.summary ? <p>{item.summary}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  );
};

export default KnowledgePage;
