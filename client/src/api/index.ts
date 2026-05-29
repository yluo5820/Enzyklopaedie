import {
  ActivityEvent,
  CanonicalHistoricalEntity,
  CanonicalHistoricalGeometryResponse,
  CanonicalHistoricalEntityKind,
  CanonicalHistoricalSearchMatch,
  FormationMembershipDetail,
  HistoricalBasemapPolityMatchResponse,
  HistoricalBasemapLayerResponse,
  HistoricalBasemapManifestResponse,
  KnowledgeItem,
  KnowledgeRelationEntityType,
  KnowledgeNote,
  KnowledgeRelationDetail,
  KnowledgeReview,
  KnowledgeTask,
  NewKnowledgeItem,
  NewKnowledgeRelation,
  NewKnowledgeNote,
  NewKnowledgeReview,
  NewKnowledgeTask,
  NewFormationMembership,
  NewPersonPolityMembership,
  NewPersonSubjectMembership,
  NewReferenceEntity,
  NewSubject,
  NewTopic,
  PersonPolityMembershipDetail,
  PersonSubjectMembershipDetail,
  PolitySnapshot,
  ReferenceAuthorityImportResult,
  ReferenceAuthoritySearchKind,
  ReferenceAuthoritySearchMatch,
  ReferenceEntity,
  Subject,
  SubjectSummary,
  TopicSummary,
  UpdateKnowledgeItem,
  UpdateKnowledgeNote,
  UpdateKnowledgeReview,
  UpdateKnowledgeTask,
  UpdateReferenceEntity,
  UpdateSubject,
  UpdateTopic,
} from '@enzyklopaedie/shared';

const API_BASE_URL = 'http://localhost:3001/api';

export type BookSearchProvider = 'open_library' | 'library_of_congress';
export type HistoricalAtlasKind = CanonicalHistoricalEntityKind | 'all';

export type BookSearchMatch = {
  id: string;
  authors: string[];
  coverImageUrl?: string;
  description?: string;
  languageCodes?: string[];
  pageCount?: number;
  publishedYear?: number;
  provider: BookSearchProvider;
  publisher?: string;
  sourceUrl?: string;
  subtitle?: string;
  title: string;
};

export type BookSearchFilters = {
  author?: string;
  language?: string;
  query?: string;
};

export type BookSearchPage = {
  hasMore: boolean;
  matches: BookSearchMatch[];
  nextPage: number | null;
  page: number;
  total?: number;
};

export const resetDevelopmentData = async (): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/dev/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to reset development data');
  }

  return response.json();
};

// Knowledge item API functions
export const fetchKnowledgeItems = async (): Promise<KnowledgeItem[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge items');
  }
  return response.json();
};

export const fetchHistoricalBasemapPolityMatch = async (
  year: number,
  featureId: string
): Promise<HistoricalBasemapPolityMatchResponse | null> => {
  const params = new URLSearchParams({
    year: String(year),
    featureId,
  });

  const response = await fetch(`${API_BASE_URL}/world-history/basemaps/polity-match?${params.toString()}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to reconcile the selected basemap region');
  }

  return response.json();
};

export const fetchKnowledgeItem = async (id: number): Promise<KnowledgeItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge item');
  }
  return response.json();
};

export const createKnowledgeItem = async (itemData: NewKnowledgeItem): Promise<KnowledgeItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(itemData),
  });
  if (!response.ok) {
    throw new Error('Failed to create knowledge item');
  }
  return response.json();
};

const buildBookSearchParams = (
  filters: BookSearchFilters,
  page: number,
  maxResults = 10
): URLSearchParams => {
  const trimmedQuery = filters.query?.trim() ?? '';
  const trimmedAuthor = filters.author?.trim() ?? '';
  const trimmedLanguage = filters.language?.trim() ?? '';

  const params = new URLSearchParams({
    maxResults: String(Math.min(Math.max(maxResults, 1), 20)),
    page: String(Math.max(page, 1)),
  });

  if (trimmedQuery) {
    params.set('q', trimmedQuery);
  }
  if (trimmedAuthor) {
    params.set('author', trimmedAuthor);
  }
  if (trimmedLanguage && trimmedLanguage !== 'any') {
    params.set('language', trimmedLanguage);
  }

  return params;
};

export const searchBookCatalog = async (
  provider: BookSearchProvider,
  filters: BookSearchFilters,
  page = 1,
  maxResults = 10
): Promise<BookSearchPage> => {
  const trimmedQuery = filters.query?.trim() ?? '';
  const trimmedAuthor = filters.author?.trim() ?? '';
  if (!trimmedQuery && !trimmedAuthor) {
    return {
      hasMore: false,
      matches: [],
      nextPage: null,
      page: 1,
      total: 0,
    };
  }

  const params = buildBookSearchParams(filters, page, maxResults);
  const routeBase =
    provider === 'open_library' ? `${API_BASE_URL}/open-library/search` : `${API_BASE_URL}/library-of-congress/search`;

  const response = await fetch(`${routeBase}?${params.toString()}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(
      errorPayload?.message ||
        (provider === 'open_library'
          ? 'Failed to search Open Library'
          : 'Failed to search the Library of Congress')
    );
  }

  return response.json() as Promise<BookSearchPage>;
};

export const fetchHistoricalAtlasEntities = async (
  options: {
    kind?: HistoricalAtlasKind;
    year?: number;
  } = {}
): Promise<CanonicalHistoricalEntity[]> => {
  const params = new URLSearchParams();

  if (options.kind && options.kind !== 'all') {
    params.set('kind', options.kind);
  }
  if (options.year !== undefined) {
    params.set('year', String(options.year));
  }

  const response = await fetch(
    `${API_BASE_URL}/world-history/entities${params.toString() ? `?${params.toString()}` : ''}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch world history atlas entities');
  }
  return response.json();
};

export const fetchWorldHistoryPersonSubjectMemberships = async (
  personEntityIds: number[]
): Promise<PersonSubjectMembershipDetail[]> => {
  const uniquePersonEntityIds = [...new Set(personEntityIds.filter((value) => Number.isInteger(value) && value > 0))];
  if (uniquePersonEntityIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    personEntityIds: uniquePersonEntityIds.join(','),
  });

  const response = await fetch(`${API_BASE_URL}/world-history/person-subject-memberships?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch atlas person subject memberships');
  }
  return response.json();
};

export const fetchHistoricalBasemapManifest = async (
  cutoffYear?: number
): Promise<HistoricalBasemapManifestResponse> => {
  const params = new URLSearchParams();
  if (cutoffYear !== undefined) {
    params.set('cutoffYear', String(cutoffYear));
  }

  const response = await fetch(
    `${API_BASE_URL}/world-history/basemaps/manifest${params.toString() ? `?${params.toString()}` : ''}`
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to fetch historical basemap manifest');
  }

  return response.json();
};

export const fetchHistoricalBasemapLayer = async (
  year: number,
  cutoffYear?: number
): Promise<HistoricalBasemapLayerResponse> => {
  const params = new URLSearchParams({
    year: String(year),
  });
  if (cutoffYear !== undefined) {
    params.set('cutoffYear', String(cutoffYear));
  }

  const response = await fetch(`${API_BASE_URL}/world-history/basemaps/layer?${params.toString()}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to fetch historical basemap layer');
  }

  return response.json();
};

export const searchHistoricalAtlas = async (
  query: string,
  kind: HistoricalAtlasKind = 'all',
  limit = 10
): Promise<CanonicalHistoricalSearchMatch[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    limit: String(Math.min(Math.max(limit, 1), 20)),
  });

  if (kind !== 'all') {
    params.set('kind', kind);
  }

  const response = await fetch(`${API_BASE_URL}/world-history/search?${params.toString()}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to search the world history atlas');
  }

  return response.json();
};

export const saveHistoricalAtlasEntity = async (
  entityData: Omit<CanonicalHistoricalEntity, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CanonicalHistoricalEntity> => {
  const response = await fetch(`${API_BASE_URL}/world-history/entities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entityData),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to save atlas entity');
  }

  return response.json();
};

export const promoteHistoricalAtlasEntity = async (
  id: number
): Promise<{ atlasEntity: CanonicalHistoricalEntity; referenceEntity: ReferenceEntity }> => {
  const response = await fetch(`${API_BASE_URL}/world-history/entities/${id}/promote`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to create a local entity from the atlas');
  }

  return response.json();
};

export const fetchHistoricalAtlasGeometry = async (
  id: number
): Promise<CanonicalHistoricalGeometryResponse> => {
  const response = await fetch(`${API_BASE_URL}/world-history/entities/${id}/geometry`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to fetch atlas geometry');
  }

  return response.json();
};

export const deleteHistoricalAtlasEntity = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/world-history/entities/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete atlas entity');
  }
};

export const updateKnowledgeItem = async (
  id: number,
  itemData: UpdateKnowledgeItem
): Promise<KnowledgeItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(itemData),
  });
  if (!response.ok) {
    throw new Error('Failed to update knowledge item');
  }
  return response.json();
};

export const deleteKnowledgeItem = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete knowledge item');
  }
};

export const fetchReferenceEntities = async (kind?: string): Promise<ReferenceEntity[]> => {
  const params = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const response = await fetch(`${API_BASE_URL}/reference-entities${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch reference entities');
  }
  return response.json();
};

export const searchReferenceEntityAuthority = async (
  query: string,
  kind: ReferenceAuthoritySearchKind = 'person',
  limit = 10
): Promise<ReferenceAuthoritySearchMatch[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    kind,
    limit: String(Math.min(Math.max(limit, 1), 20)),
  });

  const response = await fetch(`${API_BASE_URL}/reference-entities/authority-search?${params.toString()}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to search Wikidata authority records');
  }

  return response.json();
};

export const importReferenceEntityAuthority = async (
  match: ReferenceAuthoritySearchMatch
): Promise<ReferenceAuthorityImportResult> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/authority-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(match),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to import Wikidata authority record');
  }

  return response.json();
};

export const fetchReferenceEntity = async (id: number): Promise<ReferenceEntity> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch reference entity');
  }
  return response.json();
};

export const fetchReferenceEntityRelations = async (
  id: number
): Promise<KnowledgeRelationDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/relations`);
  if (!response.ok) {
    throw new Error('Failed to fetch reference entity relations');
  }
  return response.json();
};

export const fetchReferenceEntityPolitySnapshots = async (
  id: number
): Promise<PolitySnapshot[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/polity-snapshots`);
  if (!response.ok) {
    throw new Error('Failed to fetch polity snapshots');
  }
  return response.json();
};

export const fetchReferenceEntityFormationMemberships = async (
  id: number
): Promise<FormationMembershipDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/formation-memberships`);
  if (!response.ok) {
    throw new Error('Failed to fetch formation memberships');
  }
  return response.json();
};

export const fetchReferenceEntityPersonPolityMemberships = async (
  id: number
): Promise<PersonPolityMembershipDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/person-polity-memberships`);
  if (!response.ok) {
    throw new Error('Failed to fetch person polity memberships');
  }
  return response.json();
};

export const fetchReferenceEntityPersonSubjectMemberships = async (
  id: number
): Promise<PersonSubjectMembershipDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/person-subject-memberships`);
  if (!response.ok) {
    throw new Error('Failed to fetch person subject memberships');
  }
  return response.json();
};

export const fetchReferenceEntityOutgoingRelations = async (
  id: number
): Promise<KnowledgeRelationDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/outgoing-relations`);
  if (!response.ok) {
    throw new Error('Failed to fetch outgoing reference entity relations');
  }
  return response.json();
};

export const createReferenceEntityRelation = async (
  id: number,
  relationData: {
    toEntityId: number;
    relationType: NewKnowledgeRelation['relationType'];
    note?: string;
  }
): Promise<KnowledgeRelationDetail> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/outgoing-relations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(relationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create reference entity relation');
  }
  return response.json();
};

export const createFormationMembership = async (
  id: number,
  membershipData: Omit<NewFormationMembership, 'formationEntityId'>
): Promise<FormationMembershipDetail> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/formation-memberships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(membershipData),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to create formation membership');
  }
  return response.json();
};

export const createPersonPolityMembership = async (
  id: number,
  membershipData: Omit<NewPersonPolityMembership, 'personEntityId'>
): Promise<PersonPolityMembershipDetail> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/person-polity-memberships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(membershipData),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to create person polity membership');
  }
  return response.json();
};

export const createPersonSubjectMembership = async (
  id: number,
  membershipData: Omit<NewPersonSubjectMembership, 'personEntityId'>
): Promise<PersonSubjectMembershipDetail> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/person-subject-memberships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(membershipData),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to create person subject membership');
  }
  return response.json();
};

export const deleteReferenceEntityRelation = async (
  id: number,
  relationId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}/outgoing-relations/${relationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete reference entity relation');
  }
};

export const deleteFormationMembership = async (
  id: number,
  membershipId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/reference-entities/${id}/formation-memberships/${membershipId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to delete formation membership');
  }
};

export const deletePersonPolityMembership = async (
  id: number,
  membershipId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/reference-entities/${id}/person-polity-memberships/${membershipId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to delete person polity membership');
  }
};

export const deletePersonSubjectMembership = async (
  id: number,
  membershipId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/reference-entities/${id}/person-subject-memberships/${membershipId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(errorPayload?.message || 'Failed to delete person subject membership');
  }
};

export const createReferenceEntity = async (
  entityData: NewReferenceEntity
): Promise<ReferenceEntity> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entityData),
  });
  if (!response.ok) {
    throw new Error('Failed to create reference entity');
  }
  return response.json();
};

export const updateReferenceEntity = async (
  id: number,
  entityData: UpdateReferenceEntity
): Promise<ReferenceEntity> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entityData),
  });
  if (!response.ok) {
    throw new Error('Failed to update reference entity');
  }
  return response.json();
};

export const deleteReferenceEntity = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/reference-entities/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete reference entity');
  }
};

export const fetchSubjects = async (): Promise<SubjectSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/subjects`);
  if (!response.ok) {
    throw new Error('Failed to fetch subjects');
  }
  return response.json();
};

export const fetchSubject = async (id: number): Promise<SubjectSummary> => {
  const response = await fetch(`${API_BASE_URL}/subjects/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch subject');
  }
  return response.json();
};

export const createSubject = async (subjectData: NewSubject): Promise<Subject> => {
  const response = await fetch(`${API_BASE_URL}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subjectData),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to create subject');
  }
  return response.json();
};

export const updateSubject = async (
  id: number,
  subjectData: UpdateSubject
): Promise<SubjectSummary> => {
  const response = await fetch(`${API_BASE_URL}/subjects/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subjectData),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to update subject');
  }
  return response.json();
};

export const deleteSubject = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/subjects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to delete subject');
  }
};

export const fetchTopics = async (subjectId?: number): Promise<TopicSummary[]> => {
  const url = subjectId
    ? `${API_BASE_URL}/topics?subjectId=${subjectId}`
    : `${API_BASE_URL}/topics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch topics');
  }
  return response.json();
};

export const fetchTopic = async (id: number): Promise<TopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/topics/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch topic');
  }
  return response.json();
};

export const createTopic = async (topicData: NewTopic): Promise<TopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(topicData),
  });
  if (!response.ok) {
    throw new Error('Failed to create topic');
  }
  return response.json();
};

export const updateTopic = async (id: number, topicData: UpdateTopic): Promise<TopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(topicData),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to update topic');
  }
  return response.json();
};

export const deleteTopic = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to delete topic');
  }
};

export const fetchTopicKnowledgeItems = async (topicId: number): Promise<KnowledgeItem[]> => {
  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/knowledge-items`);
  if (!response.ok) {
    throw new Error('Failed to fetch topic knowledge items');
  }
  return response.json();
};

export const fetchKnowledgeItemTopics = async (
  knowledgeItemId: number
): Promise<TopicSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/topics`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge item topics');
  }
  return response.json();
};

export const assignTopicToKnowledgeItem = async (
  knowledgeItemId: number,
  topicId: number
): Promise<TopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topicId }),
  });
  if (!response.ok) {
    throw new Error('Failed to assign topic to knowledge item');
  }
  return response.json();
};

export const removeTopicFromKnowledgeItem = async (
  knowledgeItemId: number,
  topicId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/topics/${topicId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to remove topic from knowledge item');
  }
};

export const fetchKnowledgeRelations = async (
  knowledgeItemId: number
): Promise<KnowledgeRelationDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/relations`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge relations');
  }
  return response.json();
};

export const createKnowledgeRelation = async (
  knowledgeItemId: number,
  relationData: Omit<NewKnowledgeRelation, 'fromEntityType' | 'fromEntityId'>
): Promise<KnowledgeRelationDetail> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/relations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(relationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create knowledge relation');
  }
  return response.json();
};

export const deleteKnowledgeRelation = async (
  knowledgeItemId: number,
  relationId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/relations/${relationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete knowledge relation');
  }
};

export const fetchTopicRelations = async (
  topicId: number
): Promise<KnowledgeRelationDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/relations`);
  if (!response.ok) {
    throw new Error('Failed to fetch topic relations');
  }
  return response.json();
};

export const createTopicRelation = async (
  topicId: number,
  relationData: {
    toEntityType?: KnowledgeRelationEntityType;
    toEntityId: number;
    relationType: NewKnowledgeRelation['relationType'];
    note?: string;
  }
): Promise<KnowledgeRelationDetail> => {
  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/relations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(relationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create topic relation');
  }
  return response.json();
};

export const deleteTopicRelation = async (
  topicId: number,
  relationId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/relations/${relationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete topic relation');
  }
};

export const fetchKnowledgeNotes = async (knowledgeItemId: number): Promise<KnowledgeNote[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/notes`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge notes');
  }
  return response.json();
};

export const createKnowledgeNote = async (
  knowledgeItemId: number,
  noteData: Omit<NewKnowledgeNote, 'knowledgeItemId'>
): Promise<KnowledgeNote> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(noteData),
  });
  if (!response.ok) {
    throw new Error('Failed to create knowledge note');
  }
  return response.json();
};

export const updateKnowledgeNote = async (
  knowledgeItemId: number,
  noteId: number,
  noteData: UpdateKnowledgeNote
): Promise<KnowledgeNote> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/notes/${noteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(noteData),
  });
  if (!response.ok) {
    throw new Error('Failed to update knowledge note');
  }
  return response.json();
};

export const deleteKnowledgeNote = async (knowledgeItemId: number, noteId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/notes/${noteId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete knowledge note');
  }
};

export const fetchKnowledgeTasks = async (knowledgeItemId: number): Promise<KnowledgeTask[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/tasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge tasks');
  }
  return response.json();
};

export const createKnowledgeTask = async (
  knowledgeItemId: number,
  taskData: Omit<NewKnowledgeTask, 'knowledgeItemId'>
): Promise<KnowledgeTask> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });
  if (!response.ok) {
    throw new Error('Failed to create knowledge task');
  }
  return response.json();
};

export const updateKnowledgeTask = async (
  knowledgeItemId: number,
  taskId: number,
  taskData: UpdateKnowledgeTask
): Promise<KnowledgeTask> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });
  if (!response.ok) {
    throw new Error('Failed to update knowledge task');
  }
  return response.json();
};

export const deleteKnowledgeTask = async (knowledgeItemId: number, taskId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete knowledge task');
  }
};

export const fetchKnowledgeReviews = async (knowledgeItemId: number): Promise<KnowledgeReview[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/reviews`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge reviews');
  }
  return response.json();
};

export const createKnowledgeReview = async (
  knowledgeItemId: number,
  reviewData: Omit<NewKnowledgeReview, 'knowledgeItemId'>
): Promise<KnowledgeReview> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reviewData),
  });
  if (!response.ok) {
    throw new Error('Failed to create knowledge review');
  }
  return response.json();
};

export const updateKnowledgeReview = async (
  knowledgeItemId: number,
  reviewId: number,
  reviewData: UpdateKnowledgeReview
): Promise<KnowledgeReview> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/reviews/${reviewId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reviewData),
  });
  if (!response.ok) {
    throw new Error('Failed to update knowledge review');
  }
  return response.json();
};

export const deleteKnowledgeReview = async (
  knowledgeItemId: number,
  reviewId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/reviews/${reviewId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete knowledge review');
  }
};

// Activity event API functions
export const fetchActivityEvents = async (limit = 25): Promise<ActivityEvent[]> => {
  const response = await fetch(`${API_BASE_URL}/activity-events?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity events');
  }
  return response.json();
};
