export interface Subject {
    id: number;
    name: string;
    parentId?: number;
}
export interface Book {
    id: number;
    title: string;
    authorId: number;
    subjectIds: number[];
    year: number;
    pages?: number;
    isRead: boolean;
    rating?: number;
    coverImageUrl?: string;
    description?: string;
}
export interface Lecture {
    id: number;
    title: string;
    speakerId: number;
    subjectIds: number[];
    year: number;
    duration?: number;
    link?: string;
}
export interface Author {
    id: number;
    name: string;
    yearOfBirth?: number;
    yearOfDeath?: number;
    countryId?: number;
    description?: string;
    imageUrl?: string;
    link?: string;
    subjectIds?: number[];
}
export interface Nation {
    id: number;
    name: string;
    beginYear?: number;
    endYear?: number;
    description?: string;
    imageUrl?: string;
    link?: string;
    authorIds?: number[];
    civilizationId?: number;
    eraIds?: number[];
}
export interface Civilization {
    id: number;
    name: string;
    nationIds?: number[];
    description?: string;
    parentId?: number;
}
export interface Era {
    id: number;
    name: string;
    beginYear?: number;
    endYear?: number;
    description?: string;
    civilizationId?: number;
}
export interface Note {
    id: number;
    parentId: number;
    parentType: 'book' | 'lecture';
    content: string;
    timestamp: string;
}
export interface Comment {
    id: number;
    parentId: number;
    parentType: 'book' | 'lecture';
    content: string;
    timestamp: string;
}
export type NewBook = Omit<Book, 'id'>;
export type UpdateBook = Partial<Omit<Book, 'id'>>;
export type NewSubject = Omit<Subject, 'id'>;
export type UpdateSubject = Partial<Omit<Subject, 'id'>>;
export type NewLecture = Omit<Lecture, 'id'>;
export type UpdateLecture = Partial<Omit<Lecture, 'id'>>;
export type NewAuthor = Omit<Author, 'id'>;
export type UpdateAuthor = Partial<Omit<Author, 'id'>>;
export type NewNation = Omit<Nation, 'id'>;
export type UpdateNation = Partial<Omit<Nation, 'id'>>;
export type NewCivilization = Omit<Civilization, 'id'>;
export type UpdateCivilization = Partial<Omit<Civilization, 'id'>>;
export type NewEra = Omit<Era, 'id'>;
export type UpdateEra = Partial<Omit<Era, 'id'>>;
export type NewNote = Omit<Note, 'id'>;
export type UpdateNote = Partial<Omit<Note, 'id'>>;
export type NewComment = Omit<Comment, 'id'>;
export type UpdateComment = Partial<Omit<Comment, 'id'>>;
export type KnowledgeItemKind = 'book' | 'lecture' | 'article' | 'essay' | 'video' | 'podcast' | 'course' | 'artifact';
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
export interface Topic {
    id: number;
    name: string;
    slug: string;
    description?: string;
    parentTopicId?: number;
    color?: string;
    createdAt: string;
    updatedAt: string;
}
export interface TopicSummary extends Topic {
    knowledgeItemCount: number;
    childTopicCount: number;
}
export type ReferenceEntityKind = 'person' | 'nation' | 'civilization' | 'era' | 'place';
export interface ReferenceEntity {
    id: number;
    kind: ReferenceEntityKind;
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
export type KnowledgeRelationEntityType = 'knowledge_item' | 'topic' | 'reference_entity';
export type KnowledgeRelationType = 'about' | 'created_by' | 'related_to' | 'influenced_by' | 'part_of' | 'located_in' | 'during' | 'references';
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
export type ActivityEventType = 'knowledge_item_created' | 'knowledge_item_updated' | 'reference_entity_created' | 'reference_entity_updated' | 'topic_created' | 'note_created' | 'task_created' | 'relation_created' | 'review_created' | 'task_completed' | 'exhibit_published';
export interface ActivityEvent {
    id: number;
    type: ActivityEventType;
    entityType: string;
    entityId: number;
    message: string;
    metadata?: Record<string, unknown>;
    occurredAt: string;
}
export interface Place {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
    bounds?: Record<string, unknown>;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
export interface TimelineEvent {
    id: number;
    title: string;
    startYear?: number;
    endYear?: number;
    placeId?: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
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
export declare const slugifyTopicName: (value: string) => string;
export declare const buildReferenceEntitySlug: (kind: ReferenceEntityKind, title: string) => string;
export type NewKnowledgeItem = Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeItem = Partial<Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewTopic = Omit<Topic, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
export type UpdateTopic = Partial<Omit<Topic, 'id' | 'slug' | 'createdAt' | 'updatedAt'>>;
export interface ReferenceEntityDraft {
    kind: ReferenceEntityKind;
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
export type NewPlace = Omit<Place, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePlace = Partial<Omit<Place, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewTimelineEvent = Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTimelineEvent = Partial<Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewExhibit = Omit<Exhibit, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateExhibit = Partial<Omit<Exhibit, 'id' | 'createdAt' | 'updatedAt'>>;
