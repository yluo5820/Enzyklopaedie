import {
  ActivityEvent,
  Author,
  Book,
  Civilization,
  Comment,
  Era,
  KnowledgeItem,
  KnowledgeRelationDetail,
  KnowledgeNote,
  KnowledgeReview,
  KnowledgeTask,
  KnowledgeRelationEntityType,
  Lecture,
  Nation,
  NewAuthor,
  NewBook,
  NewCivilization,
  NewComment,
  NewEra,
  NewKnowledgeItem,
  NewKnowledgeRelation,
  NewKnowledgeNote,
  NewKnowledgeReview,
  NewKnowledgeTask,
  NewLecture,
  NewNation,
  NewNote,
  NewReferenceEntity,
  NewTopic,
  NewSubject,
  Note,
  ReferenceEntity,
  Subject,
  Topic,
  TopicSummary,
  UpdateAuthor,
  UpdateBook,
  UpdateCivilization,
  UpdateComment,
  UpdateEra,
  UpdateKnowledgeItem,
  UpdateKnowledgeNote,
  UpdateKnowledgeReview,
  UpdateKnowledgeTask,
  UpdateLecture,
  UpdateNation,
  UpdateNote,
  UpdateReferenceEntity,
  UpdateSubject,
} from '@enzyklopaedie/shared';

const API_BASE_URL = 'http://localhost:3001/api';

// Book API functions
export const fetchBooks = async (): Promise<Book[]> => {
  const response = await fetch(`${API_BASE_URL}/books`);
  if (!response.ok) {
    throw new Error('Failed to fetch books');
  }
  return response.json();
};

export const createBook = async (bookData: NewBook): Promise<Book> => {
  const response = await fetch(`${API_BASE_URL}/books`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookData),
  });
  if (!response.ok) {
    throw new Error('Failed to create book');
  }
  return response.json();
};

export const updateBook = async (id: number, bookData: UpdateBook): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/books/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookData),
  });
  if (!response.ok) {
    throw new Error('Failed to update book');
  }
};

export const deleteBook = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/books/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete book');
  }
};

// Subject API functions
export const fetchSubjects = async (): Promise<Subject[]> => {
  const response = await fetch(`${API_BASE_URL}/subjects`);
  if (!response.ok) {
    throw new Error('Failed to fetch subjects');
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
    throw new Error('Failed to create subject');
  }
  return response.json();
};

export const updateSubject = async (id: number, subjectData: UpdateSubject): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/subjects/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subjectData),
  });
  if (!response.ok) {
    throw new Error('Failed to update subject');
  }
};

export const deleteSubject = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/subjects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete subject');
  }
};

// Lecture API functions
export const fetchLectures = async (): Promise<Lecture[]> => {
  const response = await fetch(`${API_BASE_URL}/lectures`);
  if (!response.ok) {
    throw new Error('Failed to fetch lectures');
  }
  return response.json();
};

export const createLecture = async (lectureData: NewLecture): Promise<Lecture> => {
  const response = await fetch(`${API_BASE_URL}/lectures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lectureData),
  });
  if (!response.ok) {
    throw new Error('Failed to create lecture');
  }
  return response.json();
};

export const updateLecture = async (id: number, lectureData: UpdateLecture): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/lectures/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lectureData),
  });
  if (!response.ok) {
    throw new Error('Failed to update lecture');
  }
};

export const deleteLecture = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/lectures/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete lecture');
  }
};

// Note API functions
export const fetchNotes = async (): Promise<Note[]> => {
  const response = await fetch(`${API_BASE_URL}/notes`);
  if (!response.ok) {
    throw new Error('Failed to fetch notes');
  }
  return response.json();
};

export const fetchNotesByParent = async (parentId: number, parentType: 'book' | 'lecture'): Promise<Note[]> => {
  const response = await fetch(`${API_BASE_URL}/notes/parent?parentId=${parentId}&parentType=${parentType}`);
  if (!response.ok) {
    throw new Error('Failed to fetch notes by parent');
  }
  return response.json();
};

export const createNote = async (noteData: NewNote): Promise<Note> => {
  const response = await fetch(`${API_BASE_URL}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(noteData),
  });
  if (!response.ok) {
    throw new Error('Failed to create note');
  }
  return response.json();
};

export const updateNote = async (id: number, noteData: UpdateNote): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(noteData),
  });
  if (!response.ok) {
    throw new Error('Failed to update note');
  }
};

export const deleteNote = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete note');
  }
};

// Comment API functions
export const fetchComments = async (): Promise<Comment[]> => {
  const response = await fetch(`${API_BASE_URL}/comments`);
  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }
  return response.json();
};

export const fetchCommentsByParent = async (parentId: number, parentType: 'book' | 'lecture'): Promise<Comment[]> => {
  const response = await fetch(`${API_BASE_URL}/comments/parent?parentId=${parentId}&parentType=${parentType}`);
  if (!response.ok) {
    throw new Error('Failed to fetch comments by parent');
  }
  return response.json();
};

export const createComment = async (commentData: NewComment): Promise<Comment> => {
  const response = await fetch(`${API_BASE_URL}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commentData),
  });
  if (!response.ok) {
    throw new Error('Failed to create comment');
  }
  return response.json();
};

export const updateComment = async (id: number, commentData: UpdateComment): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commentData),
  });
  if (!response.ok) {
    throw new Error('Failed to update comment');
  }
};

export const deleteComment = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
};

// Author API functions
export const fetchAuthors = async (): Promise<Author[]> => {
  const response = await fetch(`${API_BASE_URL}/authors`);
  if (!response.ok) {
    throw new Error('Failed to fetch authors');
  }
  return response.json();
};

export const createAuthor = async (authorData: NewAuthor): Promise<Author> => {
  const response = await fetch(`${API_BASE_URL}/authors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(authorData),
  });
  if (!response.ok) {
    throw new Error('Failed to create author');
  }
  return response.json();
};

export const updateAuthor = async (id: number, authorData: UpdateAuthor): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/authors/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(authorData),
  });
  if (!response.ok) {
    throw new Error('Failed to update author');
  }
};

export const deleteAuthor = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/authors/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete author');
  }
};

// Nation API functions
export const fetchNations = async (): Promise<Nation[]> => {
  const response = await fetch(`${API_BASE_URL}/nations`);
  if (!response.ok) {
    throw new Error('Failed to fetch nations');
  }
  return response.json();
};

export const createNation = async (nationData: NewNation): Promise<Nation> => {
  const response = await fetch(`${API_BASE_URL}/nations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create nation');
  }
  return response.json();
};

export const updateNation = async (id: number, nationData: UpdateNation): Promise<Nation> => {
  const response = await fetch(`${API_BASE_URL}/nations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nationData),
  });
  if (!response.ok) {
    throw new Error('Failed to update nation');
  }
  return response.json();
};

export const deleteNation = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/nations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete nation');
  }
};

// Civilization API functions
export const fetchCivilizations = async (): Promise<Civilization[]> => {
  const response = await fetch(`${API_BASE_URL}/civilizations`);
  if (!response.ok) {
    throw new Error('Failed to fetch civilizations');
  }
  return response.json();
};

export const createCivilization = async (civilizationData: NewCivilization): Promise<Civilization> => {
  const response = await fetch(`${API_BASE_URL}/civilizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(civilizationData),
  });
  if (!response.ok) {
    throw new Error('Failed to create civilization');
  }
  return response.json();
};

export const updateCivilization = async (id: number, civilizationData: UpdateCivilization): Promise<Civilization> => {
  const response = await fetch(`${API_BASE_URL}/civilizations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(civilizationData),
  });
  if (!response.ok) {
    throw new Error('Failed to update civilization');
  }
  return response.json();
};

export const deleteCivilization = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/civilizations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete civilization');
  }
};

// Era API functions
export const fetchEras = async (): Promise<Era[]> => {
  const response = await fetch(`${API_BASE_URL}/eras`);
  if (!response.ok) {
    throw new Error('Failed to fetch eras');
  }
  return response.json();
};

export const createEra = async (eraData: NewEra): Promise<Era> => {
  const response = await fetch(`${API_BASE_URL}/eras`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eraData),
  });
  if (!response.ok) {
    throw new Error('Failed to create era');
  }
  return response.json();
};

export const updateEra = async (id: number, eraData: UpdateEra): Promise<Era> => {
  const response = await fetch(`${API_BASE_URL}/eras/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eraData),
  });
  if (!response.ok) {
    throw new Error('Failed to update era');
  }
  return response.json();
};

export const deleteEra = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/eras/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete era');
  }
};

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
    throw new Error('Failed to create topic');
  }
  return response.json();
};

export const fetchTopicKnowledgeItems = async (topicId: number): Promise<KnowledgeItem[]> => {
  const response = await fetch(`${API_BASE_URL}/topics/${topicId}/knowledge-items`);
  if (!response.ok) {
    throw new Error('Failed to fetch topic knowledge items');
  }
  return response.json();
};

export const fetchKnowledgeItemTopics = async (knowledgeItemId: number): Promise<Topic[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-items/${knowledgeItemId}/topics`);
  if (!response.ok) {
    throw new Error('Failed to fetch knowledge item topics');
  }
  return response.json();
};

export const assignTopicToKnowledgeItem = async (
  knowledgeItemId: number,
  topicId: number
): Promise<Topic> => {
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

export const fetchTopicRelations = async (topicId: number): Promise<KnowledgeRelationDetail[]> => {
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

export const deleteTopicRelation = async (topicId: number, relationId: number): Promise<void> => {
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
