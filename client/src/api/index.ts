import { Book, NewBook, UpdateBook, Subject, NewSubject, UpdateSubject, Lecture, NewLecture, UpdateLecture, Author, NewAuthor, UpdateAuthor, Nation, NewNation, UpdateNation, Civilization, NewCivilization, UpdateCivilization, Era, NewEra, UpdateEra, Note, NewNote, UpdateNote, Comment, NewComment, UpdateComment } from '@enzyklopaedie/shared';

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