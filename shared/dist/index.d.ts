export type KnowledgeItemKind = 'book' | 'lecture';
export type KnowledgeItemStatus = 'inbox' | 'queued' | 'active' | 'completed' | 'archived';
export interface KnowledgeItem {
    id: number;
    kind: KnowledgeItemKind;
    title: string;
    creator?: string;
    sourceName?: string;
    sourceUrl?: string;
    summary?: string;
    description?: string;
    publishedYear?: number;
    startedOn?: string;
    completedOn?: string;
    status: KnowledgeItemStatus;
    rating?: number;
    coverImageUrl?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface Subject {
    id: number;
    name: string;
    slug: string;
    description?: string;
    parentSubjectId?: number;
    color?: string;
    createdAt: string;
    updatedAt: string;
}
export interface SubjectSummary extends Subject {
    knowledgeItemCount: number;
    childSubjectCount: number;
    topicCount: number;
}
export interface Topic {
    id: number;
    subjectId: number;
    name: string;
    slug: string;
    summary?: string;
    description?: string;
    parentTopicId?: number;
    createdAt: string;
    updatedAt: string;
}
export interface TopicSummary extends Topic {
    itemCount: number;
    childTopicCount: number;
    subjectName: string;
    subjectSlug: string;
}
export type ReferenceEntityKind = 'person' | 'polity' | 'formation';
export type FormationSubtype = 'civilization' | 'era' | 'tradition' | 'world_frame' | 'other';
export declare const isFormationSubtype: (value: unknown) => value is FormationSubtype;
export interface ReferenceEntity {
    id: number;
    kind: ReferenceEntityKind;
    formationSubtype?: FormationSubtype;
    title: string;
    slug: string;
    summary?: string;
    description?: string;
    startYear?: number;
    endYear?: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export declare const isBuiltInPolityEntity: (entity: Pick<ReferenceEntity, "kind" | "metadata">) => boolean;
export type KnowledgeRelationEntityType = 'knowledge_item' | 'subject' | 'topic' | 'reference_entity';
export type KnowledgeRelationType = 'about' | 'contains' | 'created_by' | 'related_to' | 'influenced_by' | 'part_of' | 'located_in' | 'during' | 'references';
export interface KnowledgeRelation {
    id: number;
    fromEntityType: KnowledgeRelationEntityType;
    fromEntityId: number;
    toEntityType: KnowledgeRelationEntityType;
    toEntityId: number;
    relationType: KnowledgeRelationType;
    note?: string;
    createdAt: string;
}
export interface KnowledgeRelationDetail extends KnowledgeRelation {
    fromEntityTitle?: string;
    toEntityTitle?: string;
    fromEntityKind?: string;
    toEntityKind?: string;
}
export type KnowledgeTaskStatus = 'todo' | 'doing' | 'done' | 'archived';
export interface KnowledgeNote {
    id: number;
    knowledgeItemId: number;
    content: string;
    createdAt: string;
    updatedAt: string;
}
export interface KnowledgeTask {
    id: number;
    knowledgeItemId: number;
    title: string;
    details?: string;
    status: KnowledgeTaskStatus;
    dueAt?: string;
    scheduledFor?: string;
    completedAt?: string;
    sortOrder?: number;
    createdAt: string;
    updatedAt: string;
}
export interface KnowledgeReview {
    id: number;
    knowledgeItemId: number;
    score?: number;
    summary?: string;
    body?: string;
    createdAt: string;
    updatedAt: string;
}
export type ActivityEventType = 'knowledge_item_created' | 'knowledge_item_updated' | 'reference_entity_created' | 'reference_entity_updated' | 'subject_created' | 'topic_created' | 'topic_updated' | 'topic_deleted' | 'note_created' | 'task_created' | 'relation_created' | 'review_created' | 'task_completed' | 'exhibit_published';
export interface ActivityEvent {
    id: number;
    type: ActivityEventType;
    entityType: string;
    entityId: number;
    message: string;
    metadata?: Record<string, unknown>;
    occurredAt: string;
}
export interface PolitySnapshot {
    id: number;
    referenceEntityId: number;
    snapshotYear: number;
    source: 'historical-basemaps';
    titleAtSnapshot: string;
    parentLabel?: string;
    subjectLabel?: string;
    borderPrecision?: number;
    geometry: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface FormationMembership {
    id: number;
    formationEntityId: number;
    polityEntityId: number;
    startYear?: number;
    endYear?: number;
    note?: string;
    createdAt: string;
}
export interface FormationMembershipDetail extends FormationMembership {
    formationTitle?: string;
    formationSlug?: string;
    polityTitle?: string;
    politySlug?: string;
}
export interface PersonPolityMembership {
    id: number;
    personEntityId: number;
    polityEntityId: number;
    startYear?: number;
    endYear?: number;
    note?: string;
    createdAt: string;
}
export interface PersonPolityMembershipDetail extends PersonPolityMembership {
    personTitle?: string;
    personSlug?: string;
    polityTitle?: string;
    politySlug?: string;
}
export interface PersonSubjectMembership {
    id: number;
    personEntityId: number;
    subjectId: number;
    note?: string;
    createdAt: string;
}
export interface PersonSubjectMembershipDetail extends PersonSubjectMembership {
    personTitle?: string;
    personSlug?: string;
    subjectName?: string;
    subjectSlug?: string;
}
export interface HistoricalBasemapPolityMatchResponse {
    referenceEntity: ReferenceEntity;
    snapshot: PolitySnapshot;
}
export type CanonicalHistoricalEntityAuthority = 'wikidata';
export type CanonicalHistoricalEntityKind = 'person' | 'ruler' | 'battle' | 'nation' | 'civilization' | 'era' | 'place' | 'region';
export interface CanonicalHistoricalEntity {
    id: number;
    authority: CanonicalHistoricalEntityAuthority;
    authorityId: string;
    kind: CanonicalHistoricalEntityKind;
    referenceEntityId?: number;
    title: string;
    summary?: string;
    description?: string;
    startYear?: number;
    endYear?: number;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
    sourceUrl?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface CanonicalHistoricalSearchMatch {
    authority: CanonicalHistoricalEntityAuthority;
    authorityId: string;
    kind: CanonicalHistoricalEntityKind;
    title: string;
    summary?: string;
    description?: string;
    startYear?: number;
    endYear?: number;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
    sourceUrl?: string;
    metadata?: Record<string, unknown>;
}
export interface CanonicalHistoricalGeometryResponse {
    entityId: number;
    title: string;
    source: 'wikimedia_commons_map';
    cached: boolean;
    cachedAt?: string;
    geojson: Record<string, unknown>;
}
export interface HistoricalBasemapYear {
    year: number;
    filename: string;
    countryCount: number;
}
export interface HistoricalBasemapManifestResponse {
    source: 'historical-basemaps';
    title: string;
    license: 'GPL-3.0';
    cutoffYear: number;
    minYear: number;
    maxYear: number;
    datasetPresent: boolean;
    availableYears: HistoricalBasemapYear[];
}
export interface HistoricalBasemapLayerResponse {
    source: 'historical-basemaps';
    requestedYear: number;
    resolvedYear: number;
    filename: string;
    featureCount: number;
    geojson: Record<string, unknown>;
}
export interface Exhibit {
    id: number;
    title: string;
    slug: string;
    summary?: string;
    description?: string;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface KnowledgeProgressSummary {
    total: number;
    active: number;
    completed: number;
    byStatus: Record<KnowledgeItemStatus, number>;
}
export declare const summarizeKnowledgeProgress: (items: Array<Pick<KnowledgeItem, "status">>) => KnowledgeProgressSummary;
export declare const slugifyName: (value: string) => string;
export declare const buildReferenceEntitySlug: (kind: ReferenceEntityKind, title: string) => string;
export type NewKnowledgeItem = Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeItem = Partial<Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewSubject = Omit<Subject, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
export type UpdateSubject = Partial<Omit<Subject, 'id' | 'slug' | 'createdAt' | 'updatedAt'>>;
export type NewTopic = Omit<Topic, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
export type UpdateTopic = Partial<Omit<Topic, 'id' | 'slug' | 'createdAt' | 'updatedAt'>>;
export interface ReferenceEntityDraft {
    kind: ReferenceEntityKind;
    formationSubtype?: FormationSubtype | null;
    title: string;
    summary?: string | null;
    description?: string | null;
    startYear?: number | null;
    endYear?: number | null;
    metadata?: Record<string, unknown>;
}
export type NewReferenceEntity = ReferenceEntityDraft;
export type UpdateReferenceEntity = Partial<ReferenceEntityDraft>;
export type NewKnowledgeRelation = Omit<KnowledgeRelation, 'id' | 'createdAt'>;
export type UpdateKnowledgeRelation = Partial<Omit<KnowledgeRelation, 'id' | 'createdAt'>>;
export type NewKnowledgeTask = Omit<KnowledgeTask, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeTask = Partial<Omit<KnowledgeTask, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewKnowledgeNote = Omit<KnowledgeNote, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeNote = Partial<Omit<KnowledgeNote, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewKnowledgeReview = Omit<KnowledgeReview, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeReview = Partial<Omit<KnowledgeReview, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewActivityEvent = Omit<ActivityEvent, 'id' | 'occurredAt'>;
export type UpdateActivityEvent = Partial<Omit<ActivityEvent, 'id' | 'occurredAt'>>;
export type NewPolitySnapshot = Omit<PolitySnapshot, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePolitySnapshot = Partial<Omit<PolitySnapshot, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewFormationMembership = Omit<FormationMembership, 'id' | 'createdAt'>;
export type UpdateFormationMembership = Partial<Omit<FormationMembership, 'id' | 'createdAt'>>;
export type NewPersonPolityMembership = Omit<PersonPolityMembership, 'id' | 'createdAt'>;
export type UpdatePersonPolityMembership = Partial<Omit<PersonPolityMembership, 'id' | 'createdAt'>>;
export type NewPersonSubjectMembership = Omit<PersonSubjectMembership, 'id' | 'createdAt'>;
export type UpdatePersonSubjectMembership = Partial<Omit<PersonSubjectMembership, 'id' | 'createdAt'>>;
export type NewCanonicalHistoricalEntity = Omit<CanonicalHistoricalEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCanonicalHistoricalEntity = Partial<Omit<CanonicalHistoricalEntity, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewExhibit = Omit<Exhibit, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateExhibit = Partial<Omit<Exhibit, 'id' | 'createdAt' | 'updatedAt'>>;
