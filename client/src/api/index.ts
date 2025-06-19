import { Book, NewBook, UpdateBook } from '../types'; // Assuming client/src/types is set up

const API_BASE_URL = 'http://localhost:3001/api';

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

// Add similar functions for lectures, subjects, notes, comments