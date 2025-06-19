import React, { useEffect, useState } from 'react';
import { Book } from '../types'; // Assuming client/src/types is set up
import { fetchBooks, createBook, deleteBook, updateBook } from '../api'; // Assuming client/src/api is set up

const BookListPage: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getBooks = async () => {
      try {
        const fetchedBooks = await fetchBooks();
        setBooks(fetchedBooks);
      } catch (err) {
        setError('Failed to load books.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    getBooks();
  }, []);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle || !newBookAuthor) return;

    try {
      const addedBook = await createBook({
        title: newBookTitle,
        author: newBookAuthor,
        subjectId: 1, // Example subject ID
        year: new Date().getFullYear(),
        isRead: false,
      });
      setBooks((prevBooks) => [...prevBooks, addedBook]);
      setNewBookTitle('');
      setNewBookAuthor('');
    } catch (err) {
      setError('Failed to add book.');
      console.error(err);
    }
  };

  const handleDeleteBook = async (id: number) => {
    try {
      await deleteBook(id);
      setBooks((prevBooks) => prevBooks.filter((book) => book.id !== id));
    } catch (err) {
      setError('Failed to delete book.');
      console.error(err);
    }
  };

  const handleToggleRead = async (book: Book) => {
    try {
      await updateBook(book.id, { isRead: !book.isRead });
      setBooks((prevBooks) =>
        prevBooks.map((b) => (b.id === book.id ? { ...b, isRead: !b.isRead } : b))
      );
    } catch (err) {
      setError('Failed to update book status.');
      console.error(err);
    }
  };

  if (loading) return <div>Loading books...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>My Book List</h1>

      <form onSubmit={handleAddBook} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Book Title"
          value={newBookTitle}
          onChange={(e) => setNewBookTitle(e.target.value)}
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <input
          type="text"
          placeholder="Author"
          value={newBookAuthor}
          onChange={(e) => setNewBookAuthor(e.target.value)}
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 12px' }}>Add Book</button>
      </form>

      {books.length === 0 ? (
        <p>No books in your list yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {books.map((book) => (
            <li
              key={book.id}
              style={{
                border: '1px solid #ccc',
                padding: '10px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: book.isRead ? '#e0ffe0' : 'white',
              }}
            >
              <div>
                <strong>{book.title}</strong> by {book.author} ({book.year})
                {book.isRead && <span> - Read! {book.rating ? `(${book.rating}/5)` : ''}</span>}
              </div>
              <div>
                <button
                  onClick={() => handleToggleRead(book)}
                  style={{ marginRight: '5px', padding: '5px 10px' }}
                >
                  {book.isRead ? 'Mark as Unread' : 'Mark as Read'}
                </button>
                <button
                  onClick={() => handleDeleteBook(book.id)}
                  style={{ padding: '5px 10px', backgroundColor: 'red', color: 'white', border: 'none' }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BookListPage;