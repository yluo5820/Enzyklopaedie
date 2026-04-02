import {
  ActivityEvent,
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
  NewReferenceEntity,
  NewStudyTopic,
  NewTopic,
  ReferenceEntity,
  StudyTopicSummary,
  Topic,
  TopicSummary,
  UpdateKnowledgeItem,
  UpdateKnowledgeNote,
  UpdateKnowledgeReview,
  UpdateKnowledgeTask,
  UpdateReferenceEntity,
  UpdateTopic,
} from '@enzyklopaedie/shared';

const API_BASE_URL = 'http://localhost:3001/api';

// Knowledge item API functions
export const fetchKnowledgeItems = async (): Promise<KnowledgeItem[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge items');
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

export const fetchTopics = async (): Promise<TopicSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/topics`);
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

export const createTopic = async (topicData: NewTopic): Promise<Topic> => {
  const response = await fetch(`${API_BASE_URL}/topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(topicData),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to create subject');
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
    throw new Error(payload?.message || 'Failed to update subject');
  }
  return response.json();
};

export const deleteTopic = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to delete subject');
  }
};

export const fetchStudyTopics = async (subjectId?: number): Promise<StudyTopicSummary[]> => {
  const url = subjectId
    ? `${API_BASE_URL}/study-topics?subjectId=${subjectId}`
    : `${API_BASE_URL}/study-topics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch study topics');
  }
  return response.json();
};

export const fetchStudyTopic = async (id: number): Promise<StudyTopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch study topic');
  }
  return response.json();
};

export const createStudyTopic = async (topicData: NewStudyTopic): Promise<StudyTopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/study-topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(topicData),
  });
  if (!response.ok) {
    throw new Error('Failed to create study topic');
  }
  return response.json();
};

export const deleteStudyTopic = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Failed to delete topic');
  }
};

export const fetchStudyTopicKnowledgeItems = async (studyTopicId: number): Promise<KnowledgeItem[]> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${studyTopicId}/knowledge-items`);
  if (!response.ok) {
    throw new Error('Failed to fetch study topic knowledge items');
  }
  return response.json();
};

export const fetchKnowledgeItemStudyTopics = async (
  knowledgeItemId: number
): Promise<StudyTopicSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/study-topics`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge item study topics');
  }
  return response.json();
};

export const assignStudyTopicToKnowledgeItem = async (
  knowledgeItemId: number,
  studyTopicId: number
): Promise<StudyTopicSummary> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/study-topics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studyTopicId }),
  });
  if (!response.ok) {
    throw new Error('Failed to assign study topic to knowledge item');
  }
  return response.json();
};

export const removeStudyTopicFromKnowledgeItem = async (
  knowledgeItemId: number,
  studyTopicId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/knowledge-items/${knowledgeItemId}/study-topics/${studyTopicId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    throw new Error('Failed to remove study topic from knowledge item');
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

export const fetchStudyTopicRelations = async (
  studyTopicId: number
): Promise<KnowledgeRelationDetail[]> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${studyTopicId}/relations`);
  if (!response.ok) {
    throw new Error('Failed to fetch study topic relations');
  }
  return response.json();
};

export const createStudyTopicRelation = async (
  studyTopicId: number,
  relationData: {
    toEntityType?: KnowledgeRelationEntityType;
    toEntityId: number;
    relationType: NewKnowledgeRelation['relationType'];
    note?: string;
  }
): Promise<KnowledgeRelationDetail> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${studyTopicId}/relations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(relationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create study topic relation');
  }
  return response.json();
};

export const deleteStudyTopicRelation = async (
  studyTopicId: number,
  relationId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/study-topics/${studyTopicId}/relations/${relationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete study topic relation');
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
