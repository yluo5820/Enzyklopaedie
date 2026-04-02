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
    kindHelp: 'Use Book for anything primarily written. Articles, essays, and papers now fold into this one written form.',
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
      'Use Lecture for non-written study material. Videos, podcasts, courses, and similar resources now fold into this one media form.',
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

type FieldLabelProps = {
  htmlFor: string;
  hint?: string;
  label: string;
  required?: boolean;
};

const FieldLabel: React.FC<FieldLabelProps> = ({ htmlFor, hint, label, required = false }) => (
  <label htmlFor={htmlFor} className="knowledge-field-label">
    <span className="knowledge-field-label-main">
      <span>{label}</span>
      {required ? <span className="knowledge-field-badge">Required</span> : null}
      {hint ? (
        <span className="knowledge-help" tabIndex={0} aria-label={hint}>
          <span aria-hidden="true" className="knowledge-help-icon">
            i
          </span>
          <span role="tooltip" className="knowledge-help-tooltip">
            {hint}
          </span>
        </span>
      ) : null}
    </span>
  </label>
);

const KnowledgePage: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [people, setPeople] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
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

    const normalizedCreator = formState.creator.trim();
    const matchedPerson = normalizedCreator
      ? people.find(
          (person) => person.title.trim().toLowerCase() === normalizedCreator.toLowerCase()
        ) ?? null
      : null;

    const payload: NewKnowledgeItem = {
      kind: formState.kind,
      title: formState.title.trim(),
      creator: normalizedCreator || undefined,
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

      if (matchedPerson) {
        try {
          await createKnowledgeRelation(createdItem.id, {
            toEntityType: 'reference_entity',
            toEntityId: matchedPerson.id,
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
      {viewMode === 'create' ? (
        <section className="knowledge-panel knowledge-single-panel knowledge-create-panel">
          <div className="knowledge-header knowledge-header-row">
            <div>
              <span className="knowledge-eyebrow">Items</span>
              <h1>Add Item</h1>
              <p>Capture one book or lecture at a time, without the list competing for attention.</p>
            </div>
            <button
              type="button"
              className="knowledge-secondary-button"
              onClick={() => setViewMode('list')}
            >
              Show Item List ({items.length})
            </button>
          </div>

          {error ? <div className="knowledge-error">{error}</div> : null}

          <form className="knowledge-form knowledge-form-grid" onSubmit={handleSubmit}>
            <div className="knowledge-field knowledge-field-span-3 is-primary">
              <FieldLabel htmlFor="kind" hint={workbenchPreset.kindHelp} label="Kind" />
              <select id="kind" name="kind" value={formState.kind} onChange={handleChange}>
                {kindOptions.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === 'book' ? 'Book / Written Work' : 'Lecture / Media'}
                  </option>
                ))}
              </select>
            </div>

            <div className="knowledge-field knowledge-field-span-6 is-primary">
              <FieldLabel htmlFor="title" label="Title" required />
              <input
                id="title"
                name="title"
                value={formState.title}
                onChange={handleChange}
                placeholder="Enter the work you want to add"
                required
              />
            </div>

            <div className="knowledge-field knowledge-field-span-3 is-primary">
              <FieldLabel htmlFor="status" label="Status" />
              <select id="status" name="status" value={formState.status} onChange={handleChange}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="knowledge-field knowledge-field-span-6 is-primary">
              <FieldLabel
                htmlFor="creator"
                hint="Search an existing person here. If no match fits, keep typing and the text will be saved as-is."
                label={workbenchPreset.creatorLabel}
              />
              <input
                id="creator"
                name="creator"
                list="knowledge-creator-options"
                value={formState.creator}
                onChange={handleChange}
                placeholder={`Search or type a ${workbenchPreset.creatorLabel.toLowerCase()}`}
              />
              <datalist id="knowledge-creator-options">
                {people.map((person) => (
                  <option key={person.id} value={person.title} />
                ))}
              </datalist>
            </div>

            <div className="knowledge-field knowledge-field-span-6">
              <FieldLabel htmlFor="sourceName" label={workbenchPreset.sourceLabel} />
              <input
                id="sourceName"
                name="sourceName"
                value={formState.sourceName}
                onChange={handleChange}
                placeholder={workbenchPreset.sourcePlaceholder}
              />
            </div>

            <div className="knowledge-field knowledge-field-span-6">
              <FieldLabel htmlFor="sourceUrl" label="Source URL" />
              <input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                value={formState.sourceUrl}
                onChange={handleChange}
              />
            </div>

            <div className="knowledge-field knowledge-field-span-3">
              <FieldLabel htmlFor="publishedYear" label={workbenchPreset.yearLabel} />
              <input
                id="publishedYear"
                name="publishedYear"
                type="number"
                value={formState.publishedYear}
                onChange={handleChange}
              />
            </div>

            <div className="knowledge-field knowledge-field-span-3">
              <FieldLabel htmlFor={workbenchPreset.extraFieldName} label={workbenchPreset.extraFieldLabel} />
              <input
                id={workbenchPreset.extraFieldName}
                name={workbenchPreset.extraFieldName}
                type="number"
                value={extraFieldValue}
                onChange={handleChange}
                placeholder={workbenchPreset.extraFieldPlaceholder}
              />
            </div>

            <div className="knowledge-field knowledge-field-span-8">
              <FieldLabel htmlFor="summary" label="Summary" />
              <textarea
                id="summary"
                name="summary"
                value={formState.summary}
                onChange={handleChange}
                placeholder={workbenchPreset.summaryPlaceholder}
              />
            </div>

            <div className="knowledge-field knowledge-field-span-4">
              <FieldLabel
                htmlFor="upload-placeholder"
                hint="Reserved for future upload-to-autofill. This will later accept a cover or title-page image."
                label="Upload"
              />
              <div id="upload-placeholder" className="knowledge-upload-placeholder">
                <strong>Upload slot</strong>
                <span>Placeholder only. No upload flow is connected yet.</span>
              </div>
            </div>

            <div className="knowledge-form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="knowledge-panel knowledge-single-panel knowledge-list-panel">
          <div className="knowledge-header knowledge-header-row">
            <div>
              <span className="knowledge-eyebrow">Items</span>
              <h1>Item List</h1>
              <p>Open an entry, review the catalog, or return to capture mode.</p>
            </div>
            <button
              type="button"
              className="knowledge-secondary-button"
              onClick={() => setViewMode('create')}
            >
              Back to Add Item
            </button>
          </div>

          {error ? <div className="knowledge-error">{error}</div> : null}

          <div className="knowledge-summary-grid">
            <div className="knowledge-stat">
              <strong>{stats.total}</strong>
              <span>Total items</span>
            </div>
            <div className="knowledge-stat">
              <strong>{stats.active}</strong>
              <span>Active</span>
            </div>
            <div className="knowledge-stat">
              <strong>{stats.completed}</strong>
              <span>Completed</span>
            </div>
          </div>

          {loading ? <div className="knowledge-empty">Loading items...</div> : null}
          {!loading && items.length === 0 ? (
            <div className="knowledge-empty">
              No items yet. Switch back and add the first entry.
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
      )}
    </div>
  );
};

export default KnowledgePage;
