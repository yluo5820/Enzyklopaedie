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

type ItemWorkbenchPreset = {
  creatorLabel: string;
  extraFieldLabel: string;
  extraFieldName: 'pageCount' | 'durationMinutes';
  extraFieldPlaceholder: string;
  kindHelp: string;
  sourceLabel: string;
  sourcePlaceholder: string;
  summaryPlaceholder: string;
  yearLabel: string;
};

type ItemWorkbenchKind = 'book' | 'lecture';

const kindOptions: ItemWorkbenchKind[] = ['book', 'lecture'];
const itemWorkbenchPresets: Record<ItemWorkbenchKind, ItemWorkbenchPreset> = {
  book: {
    creatorLabel: 'Author',
    extraFieldLabel: 'Pages',
    extraFieldName: 'pageCount',
    extraFieldPlaceholder: '320',
    kindHelp: 'Use Book for anything primarily written: books, essays, articles, papers, and similar texts.',
    sourceLabel: 'Publisher / Journal / Collection',
    sourcePlaceholder: 'Publisher, journal, archive...',
    summaryPlaceholder: 'Why does this written work belong in your encyclopedia?',
    yearLabel: 'Published Year',
  },
  lecture: {
    creatorLabel: 'Speaker / Lecturer / Creator',
    extraFieldLabel: 'Duration (minutes)',
    extraFieldName: 'durationMinutes',
    extraFieldPlaceholder: '90',
    kindHelp:
      'Use Lecture for non-written study material: lectures, videos, podcasts, courses, and similar resources.',
    sourceLabel: 'Platform / Channel / Series',
    sourcePlaceholder: 'Channel, platform, course series...',
    summaryPlaceholder: 'Why does this lecture or resource belong in your encyclopedia?',
    yearLabel: 'Release Year',
  },
};

const statusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];

const createInitialFormState = (kind: ItemWorkbenchKind = 'book') => ({
  kind: kind as KnowledgeItemKind,
  title: '',
  creator: '',
  creatorEntityId: '',
  sourceName: '',
  sourceUrl: '',
  summary: '',
  publishedYear: '',
  pageCount: '',
  durationMinutes: '',
  status: 'inbox' as KnowledgeItemStatus,
});

const readNumericMetadata = (item: KnowledgeItem, key: 'pageCount' | 'durationMinutes') => {
  const value = item.metadata?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getItemRecordDetail = (item: KnowledgeItem) => {
  const pageCount = readNumericMetadata(item, 'pageCount');
  if (pageCount) return `${pageCount} pages`;

  const durationMinutes = readNumericMetadata(item, 'durationMinutes');
  if (durationMinutes) return `${durationMinutes} min`;

  return null;
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
  const [formState, setFormState] = useState(createInitialFormState());

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
  const workbenchKind = formState.kind as ItemWorkbenchKind;
  const workbenchPreset = itemWorkbenchPresets[workbenchKind];
  const extraFieldValue =
    workbenchPreset.extraFieldName === 'pageCount' ? formState.pageCount : formState.durationMinutes;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      ...(name === 'kind'
        ? {
            pageCount: '',
            durationMinutes: '',
          }
        : {}),
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

    const metadata =
      formState.kind === 'book'
        ? formState.pageCount
          ? { pageCount: Number(formState.pageCount) }
          : undefined
        : formState.durationMinutes
          ? { durationMinutes: Number(formState.durationMinutes) }
          : undefined;

    const payload: NewKnowledgeItem = {
      kind: formState.kind,
      title: formState.title.trim(),
      creator: formState.creator.trim() || undefined,
      sourceName: formState.sourceName.trim() || undefined,
      sourceUrl: formState.sourceUrl.trim() || undefined,
      summary: formState.summary.trim() || undefined,
      publishedYear: formState.publishedYear ? Number(formState.publishedYear) : undefined,
      status: formState.status,
      metadata,
    };

    try {
      const createdItem = await createKnowledgeItem(payload);
      const savedKind = workbenchKind;
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
      setFormState(createInitialFormState(savedKind));
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
              Capture the concrete works that make up your encyclopedia. The workbench now treats items
              as either written material or lecture/media material, while keeping one unified item model.
            </p>
          </div>

          <form className="knowledge-form" onSubmit={handleSubmit}>
            <div className="knowledge-field">
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === 'book' ? 'Book / Written Work' : 'Lecture / Media'}
                  </option>
                ))}
              </select>
              <span className="knowledge-field-hint">{workbenchPreset.kindHelp}</span>
            </div>

            <div className="knowledge-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" value={formState.title} onChange={handleChange} required />
            </div>

            <div className="knowledge-field">
              <label htmlFor="creator">{workbenchPreset.creatorLabel}</label>
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
              <label htmlFor="sourceName">{workbenchPreset.sourceLabel}</label>
              <input
                id="sourceName"
                name="sourceName"
                value={formState.sourceName}
                onChange={handleChange}
                placeholder={workbenchPreset.sourcePlaceholder}
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

            <div className="knowledge-form-inline">
              <div className="knowledge-field">
                <label htmlFor="publishedYear">{workbenchPreset.yearLabel}</label>
                <input
                  id="publishedYear"
                  name="publishedYear"
                  type="number"
                  value={formState.publishedYear}
                  onChange={handleChange}
                />
              </div>

              <div className="knowledge-field">
                <label htmlFor={workbenchPreset.extraFieldName}>{workbenchPreset.extraFieldLabel}</label>
                <input
                  id={workbenchPreset.extraFieldName}
                  name={workbenchPreset.extraFieldName}
                  type="number"
                  value={extraFieldValue}
                  onChange={handleChange}
                  placeholder={workbenchPreset.extraFieldPlaceholder}
                />
              </div>
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
                placeholder={workbenchPreset.summaryPlaceholder}
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
                          {getItemRecordDetail(item) ? <span>{getItemRecordDetail(item)}</span> : null}
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
