import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type {
  KnowledgeItem,
  KnowledgeItemKind,
  KnowledgeItemStatus,
  KnowledgeRelationDetail,
  NewKnowledgeItem,
  ReferenceEntity,
  TopicSummary,
} from '@enzyklopaedie/shared';
import { Link } from 'react-router-dom';
import {
  type BookSearchPage,
  type BookSearchFilters,
  type BookSearchProvider,
  createKnowledgeItem,
  createKnowledgeRelation,
  createReferenceEntity,
  deleteKnowledgeItem,
  fetchKnowledgeItemTopics,
  fetchKnowledgeItems,
  fetchKnowledgeRelations,
  fetchReferenceEntities,
  type BookSearchMatch,
  searchBookCatalog,
} from '../api';
import { summarizeKnowledgeProgress } from '../utils/knowledgeProgress';
import './ItemWorkbenchPage.css';

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
type StatusFilter = 'all' | KnowledgeItemStatus;
type ItemListGroupBy = 'none' | 'topic' | 'subject' | 'entity';
type CaptureMode = 'manual' | 'search';
type ItemListContext = {
  entityLabels?: string[];
  topics?: TopicSummary[];
};
type SearchLanguageOption = {
  code: string;
  label: string;
};
type SearchProviderOption = {
  description: string;
  label: string;
  value: BookSearchProvider;
};

const kindOptions: ItemWorkbenchKind[] = ['book', 'lecture'];
const statusOptions: KnowledgeItemStatus[] = ['inbox', 'queued', 'active', 'completed', 'archived'];
const searchLanguageOptions: SearchLanguageOption[] = [
  { code: 'any', label: 'Any language' },
  { code: 'eng', label: 'English' },
  { code: 'ger', label: 'German' },
  { code: 'fre', label: 'French' },
  { code: 'spa', label: 'Spanish' },
  { code: 'ita', label: 'Italian' },
  { code: 'lat', label: 'Latin' },
  { code: 'grc', label: 'Ancient Greek' },
  { code: 'chi', label: 'Chinese' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'rus', label: 'Russian' },
  { code: 'ara', label: 'Arabic' },
];
const languageLabelByCode = new Map(searchLanguageOptions.map((option) => [option.code, option.label]));
const searchProviderOptions: SearchProviderOption[] = [
  {
    description: 'Broader general catalog with better everyday discovery.',
    label: 'Open Library',
    value: 'open_library',
  },
  {
    description: 'Library of Congress records, useful as a second catalog check.',
    label: 'Library of Congress',
    value: 'library_of_congress',
  },
];
const providerLabelByValue = new Map(searchProviderOptions.map((option) => [option.value, option.label]));

const itemWorkbenchPresets: Record<ItemWorkbenchKind, ItemWorkbenchPreset> = {
  book: {
    creatorLabel: 'Author',
    extraFieldLabel: 'Pages',
    extraFieldName: 'pageCount',
    extraFieldPlaceholder: '320',
    kindHelp: 'Use Book for anything primarily written. Articles, essays, and papers fold into this form.',
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
      'Use Lecture for non-written study material. Videos, podcasts, courses, and similar resources fold into this form.',
    sourceLabel: 'Platform / Channel / Series',
    sourcePlaceholder: 'Channel, platform, course series...',
    summaryPlaceholder: 'Why does this lecture or resource belong in your encyclopedia?',
    yearLabel: 'Release Year',
  },
};

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

const sortPeople = (values: ReferenceEntity[]) =>
  [...values].sort((left, right) => left.title.localeCompare(right.title));

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

const formatStatusLabel = (value: StatusFilter) => {
  if (value === 'all') return 'All';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const dedupeAndSort = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));

const getEntityLabelsForItem = (relations: KnowledgeRelationDetail[]) =>
  dedupeAndSort(
    relations
      .filter(
        (relation) =>
          relation.toEntityType === 'reference_entity' &&
          relation.relationType !== 'created_by' &&
          typeof relation.toEntityTitle === 'string'
      )
      .map((relation) => relation.toEntityTitle?.trim() ?? '')
  );

const getItemGroupLabels = (groupBy: ItemListGroupBy, context: ItemListContext | undefined) => {
  if (!context) return [];
  if (groupBy === 'topic') {
    return dedupeAndSort((context.topics ?? []).map((topic) => topic.name));
  }
  if (groupBy === 'subject') {
    return dedupeAndSort((context.topics ?? []).map((topic) => topic.subjectName));
  }
  if (groupBy === 'entity') {
    return context.entityLabels ?? [];
  }
  return [];
};

const getUngroupedLabel = (groupBy: ItemListGroupBy) => {
  if (groupBy === 'topic') return 'Without topic';
  if (groupBy === 'subject') return 'Without subject';
  if (groupBy === 'entity') return 'Without entity';
  return 'Items';
};

const formatLanguageLabel = (code: string) => languageLabelByCode.get(code) ?? code.toUpperCase();
const formatProviderLabel = (provider: BookSearchProvider) =>
  providerLabelByValue.get(provider) ?? provider;

const buildKnowledgeItemFromSearchMatch = (book: BookSearchMatch): NewKnowledgeItem => {
  const authorLabel = book.authors.join(', ').trim();
  return {
    kind: 'book',
    title: book.title.trim(),
    creator: authorLabel || undefined,
    sourceName: book.publisher?.trim() || undefined,
    sourceUrl: book.sourceUrl,
    summary: book.subtitle?.trim() || undefined,
    description: book.description?.trim() || undefined,
    publishedYear: book.publishedYear,
    status: 'inbox',
    coverImageUrl: book.coverImageUrl,
    metadata: {
      importedFrom: book.provider,
      providerRecordId: book.id,
      ...(book.provider === 'open_library' ? { openLibraryId: book.id } : {}),
      ...(book.provider === 'library_of_congress' ? { libraryOfCongressId: book.id } : {}),
      ...(book.pageCount ? { pageCount: book.pageCount } : {}),
    },
  };
};

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

const ItemWorkbenchPage: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [people, setPeople] = useState<ReferenceEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listContextError, setListContextError] = useState<string | null>(null);
  const [listContextLoading, setListContextLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCreatorEntity, setCreatingCreatorEntity] = useState(false);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [importingBooks, setImportingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('manual');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupBy, setGroupBy] = useState<ItemListGroupBy>('none');
  const [itemContexts, setItemContexts] = useState<Record<number, ItemListContext>>({});
  const [formState, setFormState] = useState(createInitialFormState());
  const [bookSearchProvider, setBookSearchProvider] = useState<BookSearchProvider>('open_library');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchAuthor, setBookSearchAuthor] = useState('');
  const [bookSearchLanguage, setBookSearchLanguage] = useState('any');
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchMatch[]>([]);
  const [bookSearchPage, setBookSearchPage] = useState(1);
  const [bookSearchHasMore, setBookSearchHasMore] = useState(false);
  const [bookSearchTotal, setBookSearchTotal] = useState<number | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const [fetchedItems, fetchedPeople] = await Promise.all([
          fetchKnowledgeItems(),
          fetchReferenceEntities('person'),
        ]);
        setItems(fetchedItems);
        setPeople(sortPeople(fetchedPeople));
      } catch (loadError) {
        console.error(loadError);
        setError('Failed to load items.');
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  useEffect(() => {
    if (formState.kind === 'lecture' && captureMode === 'search') {
      setCaptureMode('manual');
    }
  }, [captureMode, formState.kind]);

  const normalizedCreator = formState.creator.trim();
  const matchedPerson = useMemo(
    () =>
      normalizedCreator
        ? people.find((person) => person.title.trim().toLowerCase() === normalizedCreator.toLowerCase()) ?? null
        : null,
    [normalizedCreator, people]
  );

  const stats = useMemo(() => summarizeKnowledgeProgress(items), [items]);
  const orderedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [items]
  );
  const statusCounts = useMemo(
    () => ({
      all: items.length,
      inbox: items.filter((item) => item.status === 'inbox').length,
      queued: items.filter((item) => item.status === 'queued').length,
      active: items.filter((item) => item.status === 'active').length,
      completed: items.filter((item) => item.status === 'completed').length,
      archived: items.filter((item) => item.status === 'archived').length,
    }),
    [items]
  );
  const filteredItems = useMemo(
    () =>
      orderedItems.filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter)),
    [orderedItems, statusFilter]
  );
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') {
      return [
        {
          id: 'all-items',
          items: filteredItems,
          label: statusFilter === 'all' ? 'All items' : `${formatStatusLabel(statusFilter)} items`,
        },
      ];
    }

    const groups = new Map<string, KnowledgeItem[]>();
    const ungroupedItems: KnowledgeItem[] = [];

    for (const item of filteredItems) {
      const labels = getItemGroupLabels(groupBy, itemContexts[item.id]);
      if (labels.length === 0) {
        ungroupedItems.push(item);
        continue;
      }

      for (const label of labels) {
        const branch = groups.get(label) ?? [];
        branch.push(item);
        groups.set(label, branch);
      }
    }

    const organizedGroups = [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, groupedBranch]) => ({
        id: label,
        items: groupedBranch,
        label,
      }));

    if (ungroupedItems.length > 0) {
      organizedGroups.push({
        id: 'ungrouped-items',
        items: ungroupedItems,
        label: getUngroupedLabel(groupBy),
      });
    }

    return organizedGroups;
  }, [filteredItems, groupBy, itemContexts, statusFilter]);

  const workbenchKind = formState.kind as ItemWorkbenchKind;
  const workbenchPreset = itemWorkbenchPresets[workbenchKind];
  const extraFieldValue =
    workbenchPreset.extraFieldName === 'pageCount' ? formState.pageCount : formState.durationMinutes;

  const selectedBooks = useMemo(
    () => bookSearchResults.filter((book) => selectedBookIds.includes(book.id)),
    [bookSearchResults, selectedBookIds]
  );

  const currentSearchFilters = useMemo(
    (): BookSearchFilters => ({
      query: bookSearchQuery,
      author: bookSearchAuthor,
      language: bookSearchLanguage,
    }),
    [bookSearchAuthor, bookSearchLanguage, bookSearchQuery]
  );

  useEffect(() => {
    if (viewMode !== 'list' || items.length === 0 || groupBy === 'none') {
      return;
    }

    const needsTopics = groupBy === 'topic' || groupBy === 'subject';
    const missingItems = items.filter((item) => {
      const context = itemContexts[item.id];
      if (!context) return true;
      if (needsTopics) return !context.topics;
      return !context.entityLabels;
    });

    if (missingItems.length === 0) return;

    let cancelled = false;

    const loadListContext = async () => {
      setListContextLoading(true);
      setListContextError(null);

      try {
        if (needsTopics) {
          const entries = await Promise.all(
            missingItems.map(async (item) => ({
              itemId: item.id,
              topics: await fetchKnowledgeItemTopics(item.id),
            }))
          );

          if (cancelled) return;
          setItemContexts((current) => {
            const next = { ...current };
            for (const entry of entries) {
              next[entry.itemId] = {
                ...next[entry.itemId],
                topics: entry.topics,
              };
            }
            return next;
          });
        } else {
          const entries = await Promise.all(
            missingItems.map(async (item) => ({
              entityLabels: getEntityLabelsForItem(await fetchKnowledgeRelations(item.id)),
              itemId: item.id,
            }))
          );

          if (cancelled) return;
          setItemContexts((current) => {
            const next = { ...current };
            for (const entry of entries) {
              next[entry.itemId] = {
                ...next[entry.itemId],
                entityLabels: entry.entityLabels,
              };
            }
            return next;
          });
        }
      } catch (contextLoadError) {
        console.error(contextLoadError);
        if (!cancelled) {
          setListContextError('Failed to organize items by that context.');
        }
      } finally {
        if (!cancelled) {
          setListContextLoading(false);
        }
      }
    };

    void loadListContext();

    return () => {
      cancelled = true;
    };
  }, [groupBy, itemContexts, items, viewMode]);

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

  const saveItemWithCreatorLink = async (payload: NewKnowledgeItem, creatorLabel?: string) => {
    const createdItem = await createKnowledgeItem(payload);
    const normalized = creatorLabel?.trim() ?? '';
    const matchedCreator =
      normalized
        ? people.find((person) => person.title.trim().toLowerCase() === normalized.toLowerCase()) ?? null
        : null;
    let relationFailed = false;

    if (matchedCreator) {
      try {
        await createKnowledgeRelation(createdItem.id, {
          toEntityType: 'reference_entity',
          toEntityId: matchedCreator.id,
          relationType: 'created_by',
        });
      } catch (relationError) {
        console.error(relationError);
        relationFailed = true;
      }
    }

    return { createdItem, relationFailed };
  };

  const handleCreateCreatorEntity = async () => {
    if (!normalizedCreator || matchedPerson) return;

    setCreatingCreatorEntity(true);
    setError(null);
    setNotice(null);

    try {
      const createdPerson = await createReferenceEntity({
        kind: 'person',
        title: normalizedCreator,
        summary: 'Created from the item capture flow.',
      });

      startTransition(() => {
        setPeople((current) => {
          const next = current.some((person) => person.id === createdPerson.id)
            ? current.map((person) => (person.id === createdPerson.id ? createdPerson : person))
            : [...current, createdPerson];
          return sortPeople(next);
        });
      });

      setNotice(`Created person "${createdPerson.title}". This item will now link to that entity.`);
    } catch (createError) {
      console.error(createError);
      setError('Failed to create the person entity from this creator name.');
    } finally {
      setCreatingCreatorEntity(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.title.trim()) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

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
      creator: normalizedCreator || undefined,
      sourceName: formState.sourceName.trim() || undefined,
      sourceUrl: formState.sourceUrl.trim() || undefined,
      summary: formState.summary.trim() || undefined,
      publishedYear: formState.publishedYear ? Number(formState.publishedYear) : undefined,
      status: formState.status,
      metadata,
    };

    try {
      const savedKind = workbenchKind;
      const { createdItem, relationFailed } = await saveItemWithCreatorLink(payload, normalizedCreator);

      startTransition(() => {
        setItems((current) => [createdItem, ...current]);
      });
      setFormState(createInitialFormState(savedKind));
      setShowAdvancedDetails(false);
      setNotice(relationFailed ? 'Item was created, but the creator entity link could not be saved.' : 'Item added.');
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to create item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchResponse = (pageData: BookSearchPage, append = false) => {
    setBookSearchPage(pageData.page);
    setBookSearchHasMore(pageData.hasMore);
    setBookSearchTotal(pageData.total ?? null);
    setBookSearchResults((current) => {
      if (!append) {
        return pageData.matches;
      }

      const next = [...current];
      for (const match of pageData.matches) {
        if (!next.some((existing) => existing.provider === match.provider && existing.id === match.id)) {
          next.push(match);
        }
      }
      return next;
    });
  };

  const runBookSearch = async (page: number, append = false) => {
    if (!currentSearchFilters.query?.trim() && !currentSearchFilters.author?.trim()) return;
    setSearchingBooks(true);
    setBookSearchError(null);
    setNotice(null);

    try {
      const pageData = await searchBookCatalog(bookSearchProvider, currentSearchFilters, page, 10);
      handleSearchResponse(pageData, append);
      if (!append) {
        setSelectedBookIds([]);
      }
      if (!append && pageData.matches.length === 0) {
        setBookSearchError(`No matching books came back from ${formatProviderLabel(bookSearchProvider)}.`);
      }
    } catch (searchError) {
      console.error(searchError);
      setBookSearchError(
        searchError instanceof Error
          ? searchError.message
          : `Failed to search ${formatProviderLabel(bookSearchProvider)} right now.`
      );
    } finally {
      setSearchingBooks(false);
    }
  };

  const handleSearchBooks = async (event: React.FormEvent) => {
    event.preventDefault();
    setBookSearchResults([]);
    setBookSearchPage(1);
    setBookSearchHasMore(false);
    setBookSearchTotal(null);
    await runBookSearch(1, false);
  };

  const handleLoadMoreBooks = async () => {
    if (!bookSearchHasMore || searchingBooks) return;
    await runBookSearch(bookSearchPage + 1, true);
  };

  const handleImportSelectedBooks = async () => {
    if (selectedBooks.length === 0) return;

    setImportingBooks(true);
    setError(null);
    setBookSearchError(null);
    setNotice(null);

    try {
      const savedEntries = await Promise.all(
        selectedBooks.map(async (book) => {
          const payload = buildKnowledgeItemFromSearchMatch(book);
          return saveItemWithCreatorLink(payload, payload.creator);
        })
      );

      const createdItems = savedEntries.map((entry) => entry.createdItem);
      const relationFailures = savedEntries.some((entry) => entry.relationFailed);

      startTransition(() => {
        setItems((current) => [...createdItems.reverse(), ...current]);
      });
      setSelectedBookIds([]);
      setNotice(
        relationFailures
          ? `Imported ${createdItems.length} book${createdItems.length === 1 ? '' : 's'}, but some creator links could not be saved.`
          : `Imported ${createdItems.length} book${createdItems.length === 1 ? '' : 's'} from Open Library.`
      );
    } catch (importError) {
      console.error(importError);
      setBookSearchError('Failed to import the selected books.');
    } finally {
      setImportingBooks(false);
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

  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]
    );
  };

  return (
    <div className="knowledge-page">
      {viewMode === 'create' ? (
        <section className="knowledge-panel knowledge-single-panel knowledge-create-panel">
          <div className="knowledge-header knowledge-header-row">
            <div>
              <span className="knowledge-eyebrow">Items</span>
              <h1>Add Item</h1>
              <p>Make capture the easy daily action. Keep the main form small, and only open more when you need it.</p>
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
          {notice ? <div className="knowledge-notice">{notice}</div> : null}

          <div className="knowledge-capture-toolbar">
            <div className="knowledge-capture-pillars">
              <button
                type="button"
                className={`knowledge-capture-pill${captureMode === 'manual' ? ' is-active' : ''}`}
                onClick={() => setCaptureMode('manual')}
              >
                Manual entry
              </button>
              {workbenchKind === 'book' ? (
                <button
                  type="button"
                  className={`knowledge-capture-pill${captureMode === 'search' ? ' is-active' : ''}`}
                  onClick={() => setCaptureMode('search')}
                >
                  Search books
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={`knowledge-secondary-button${showAdvancedDetails ? ' is-active' : ''}`}
              onClick={() => setShowAdvancedDetails((current) => !current)}
            >
              {showAdvancedDetails ? 'Hide advanced details' : 'Show advanced details'}
            </button>
          </div>

          {captureMode === 'search' && workbenchKind === 'book' ? (
            <section className="knowledge-search-panel">
              <div className="knowledge-search-head">
                <div>
                  <span className="knowledge-eyebrow">{formatProviderLabel(bookSearchProvider)}</span>
                  <h2>Import books by search</h2>
                  <p>Compare supported catalogs, then tighten the list with author and language filters when the first pass feels noisy.</p>
                </div>
              </div>

              <div className="knowledge-provider-pills" role="tablist" aria-label="Book search provider">
                {searchProviderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`knowledge-capture-pill${bookSearchProvider === option.value ? ' is-active' : ''}`}
                    onClick={() => {
                      setBookSearchProvider(option.value);
                      setBookSearchResults([]);
                      setSelectedBookIds([]);
                      setBookSearchError(null);
                      setBookSearchPage(1);
                      setBookSearchHasMore(false);
                      setBookSearchTotal(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="knowledge-search-filter-note">
                {
                  searchProviderOptions.find((option) => option.value === bookSearchProvider)
                    ?.description
                }
              </div>

              <form className="knowledge-search-form" onSubmit={handleSearchBooks}>
                <input
                  value={bookSearchQuery}
                  onChange={(event) => setBookSearchQuery(event.target.value)}
                  placeholder="Title or keywords"
                />
                <input
                  value={bookSearchAuthor}
                  onChange={(event) => setBookSearchAuthor(event.target.value)}
                  placeholder="Author filter"
                />
                <select
                  value={bookSearchLanguage}
                  onChange={(event) => setBookSearchLanguage(event.target.value)}
                  aria-label="Language filter"
                >
                  {searchLanguageOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    searchingBooks || (!bookSearchQuery.trim() && !bookSearchAuthor.trim())
                  }
                >
                  {searchingBooks ? 'Searching...' : 'Search Open Library'}
                </button>
              </form>

              <div className="knowledge-search-filter-note">
                Author and language filters are applied on top of the main query, so you can tell whether a weak result set is a catalog problem or just a loose search.
              </div>

              {bookSearchError ? <div className="knowledge-error">{bookSearchError}</div> : null}

              {bookSearchResults.length > 0 ? (
                <>
                  <div className="knowledge-search-actions">
                    <span>
                      Loaded {bookSearchResults.length}
                      {bookSearchTotal ? ` of about ${bookSearchTotal}` : ''} matches from{' '}
                      {formatProviderLabel(bookSearchProvider)}
                    </span>
                    <div className="knowledge-search-action-group">
                      <button
                        type="button"
                        className="knowledge-secondary-button"
                        onClick={() => setSelectedBookIds(bookSearchResults.map((book) => book.id))}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="knowledge-secondary-button"
                        onClick={() => setSelectedBookIds([])}
                        disabled={selectedBookIds.length === 0}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleImportSelectedBooks}
                        disabled={importingBooks || selectedBooks.length === 0}
                      >
                        {importingBooks
                          ? 'Importing...'
                          : `Import selected (${selectedBooks.length})`}
                      </button>
                      <button
                        type="button"
                        className="knowledge-secondary-button"
                        onClick={handleLoadMoreBooks}
                        disabled={searchingBooks || !bookSearchHasMore}
                      >
                        {searchingBooks && bookSearchResults.length > 0 ? 'Loading...' : 'Fetch more'}
                      </button>
                    </div>
                  </div>

                  <div className="knowledge-search-results">
                    {bookSearchResults.map((book) => (
                      <label key={book.id} className="knowledge-search-card">
                        <div className="knowledge-search-card-check">
                          <input
                            type="checkbox"
                            checked={selectedBookIds.includes(book.id)}
                            onChange={() => toggleBookSelection(book.id)}
                          />
                        </div>
                        <div className="knowledge-search-card-body">
                          <div className="knowledge-search-card-top">
                            <div>
                              <strong>{book.title}</strong>
                              {book.subtitle ? <span>{book.subtitle}</span> : null}
                            </div>
                            {book.coverImageUrl ? (
                              <img src={book.coverImageUrl} alt="" className="knowledge-search-cover" />
                            ) : null}
                          </div>
                          <div className="knowledge-meta">
                            {book.authors.length > 0 ? <span>{book.authors.join(', ')}</span> : null}
                            {book.publisher ? <span>{book.publisher}</span> : null}
                            {book.publishedYear ? <span>{book.publishedYear}</span> : null}
                            {book.pageCount ? <span>{book.pageCount} pages</span> : null}
                            {book.languageCodes?.length ? (
                              <span>
                                {book.languageCodes
                                  .slice(0, 3)
                                  .map((code) => formatLanguageLabel(code))
                                  .join(', ')}
                              </span>
                            ) : null}
                          </div>
                          {book.description ? (
                            <p>{book.description.slice(0, 220)}{book.description.length > 220 ? '…' : ''}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : (
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

              <div className="knowledge-field knowledge-field-span-12 is-primary">
                <FieldLabel
                  htmlFor="creator"
                  hint="Search an existing person. If no match exists yet, create it here or keep the text as a temporary fallback."
                  label={workbenchPreset.creatorLabel}
                />
                <div className="knowledge-creator-row">
                  <input
                    id="creator"
                    name="creator"
                    list="knowledge-creator-options"
                    value={formState.creator}
                    onChange={handleChange}
                    placeholder={`Search or type a ${workbenchPreset.creatorLabel.toLowerCase()}`}
                  />
                  {!matchedPerson && normalizedCreator ? (
                    <button
                      type="button"
                      className="knowledge-secondary-button"
                      onClick={handleCreateCreatorEntity}
                      disabled={creatingCreatorEntity}
                    >
                      {creatingCreatorEntity ? 'Creating person...' : 'Create person'}
                    </button>
                  ) : null}
                </div>
                <datalist id="knowledge-creator-options">
                  {people.map((person) => (
                    <option key={person.id} value={person.title} />
                  ))}
                </datalist>
                {matchedPerson ? (
                  <div className="knowledge-inline-note">
                    This will link the item to the existing person entity <strong>{matchedPerson.title}</strong>.
                  </div>
                ) : normalizedCreator ? (
                  <div className="knowledge-inline-note">
                    This name will be saved as plain text unless you create a matching person entity first.
                  </div>
                ) : (
                  <div className="knowledge-inline-note">
                    Leave this blank if you do not want to record the creator yet.
                  </div>
                )}
              </div>

              {showAdvancedDetails ? (
                <>
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

                  <div className="knowledge-field knowledge-field-span-6">
                    <FieldLabel htmlFor="summary" label="Summary" />
                    <textarea
                      id="summary"
                      name="summary"
                      value={formState.summary}
                      onChange={handleChange}
                      placeholder={workbenchPreset.summaryPlaceholder}
                    />
                  </div>

                  <div className="knowledge-field knowledge-field-span-12">
                    <FieldLabel
                      htmlFor="upload-placeholder"
                      hint="Reserved for future upload-to-autofill. This will later accept a cover or title-page image."
                      label="Upload"
                    />
                    <div id="upload-placeholder" className="knowledge-upload-placeholder">
                      <strong>Upload slot</strong>
                      <span>Placeholder only. This will later become image-to-autofill for book or lecture records.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="knowledge-collapsed-note knowledge-field-span-12">
                  Optional source data, year, pages or duration, summary, and upload hooks are hidden until you open advanced details.
                </div>
              )}

              <div className="knowledge-form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          )}
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
          {notice ? <div className="knowledge-notice">{notice}</div> : null}

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

          <div className="knowledge-list-controls">
            <div className="knowledge-list-filter-group">
              <span className="knowledge-list-filter-label">Status</span>
              <div className="knowledge-chip-row">
                {(['all', ...statusOptions] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`knowledge-filter-chip${statusFilter === status ? ' is-active' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    <span>{formatStatusLabel(status)}</span>
                    <strong>{statusCounts[status]}</strong>
                  </button>
                ))}
              </div>
            </div>

            <label className="knowledge-list-organizer">
              <span className="knowledge-list-filter-label">Then organize by</span>
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as ItemListGroupBy)}>
                <option value="none">Nothing extra</option>
                <option value="topic">Topic</option>
                <option value="subject">Subject</option>
                <option value="entity">Entity</option>
              </select>
            </label>
          </div>

          {groupBy !== 'none' && listContextError ? (
            <div className="knowledge-error">{listContextError}</div>
          ) : null}
          {groupBy !== 'none' && listContextLoading ? (
            <div className="knowledge-empty">Loading {groupBy} context for this list...</div>
          ) : null}

          {loading ? <div className="knowledge-empty">Loading items...</div> : null}
          {!loading && items.length === 0 ? (
            <div className="knowledge-empty">No items yet. Switch back and add the first entry.</div>
          ) : null}
          {!loading && items.length > 0 && filteredItems.length === 0 ? (
            <div className="knowledge-empty">
              No items are currently in {formatStatusLabel(statusFilter).toLowerCase()}.
            </div>
          ) : null}

          {!loading && filteredItems.length > 0 && (groupBy === 'none' || !listContextLoading) ? (
            <div className="knowledge-items">
              {groupedItems.map((group) => (
                <section key={group.id} className="knowledge-list-group">
                  {groupBy !== 'none' ? (
                    <div className="knowledge-list-group-header">
                      <h2>{group.label}</h2>
                      <span>{group.items.length}</span>
                    </div>
                  ) : null}

                  <div className="knowledge-list-group-items">
                    {group.items.map((item) => (
                      <article key={`${group.id}-${item.id}`} className="knowledge-item">
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
                </section>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default ItemWorkbenchPage;
