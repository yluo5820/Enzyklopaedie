import React, { useEffect, useState } from 'react';
import { Book, Lecture, Author } from '@enzyklopaedie/shared';
import { fetchBooks, fetchLectures, fetchAuthors, deleteBook, deleteLecture, updateBook } from '../api';
import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';
import CenteredContainer from '../components/CenteredContainer';

interface ListItem {
  id: number;
  type: 'book' | 'lecture';
  title: string;
  author?: string;
  speaker?: string;
  year: number;
  isRead?: boolean;
  rating?: number;
  duration?: number;
  link?: string;
  description?: string;
}

const BookListPage: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Book | Lecture | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedBooks, fetchedLectures, fetchedAuthors] = await Promise.all([
          fetchBooks(),
          fetchLectures(),
          fetchAuthors(),
        ]);
        setBooks(fetchedBooks);
        setLectures(fetchedLectures);
        setAuthors(fetchedAuthors);
      } catch (err) {
        setError('Failed to load items.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create a lookup map for author names
  const authorMap = new Map(authors.map(author => [author.id, author.name]));

  const handleBookAdded = (book: Book) => {
    setBooks(prevBooks => [...prevBooks, book]);
  };

  const handleLectureAdded = (lecture: Lecture) => {
    setLectures(prevLectures => [...prevLectures, lecture]);
  };

  const handleBookUpdated = (updatedBook: Book) => {
    setBooks(prevBooks => 
      prevBooks.map(book => book.id === updatedBook.id ? updatedBook : book)
    );
  };

  const handleLectureUpdated = (updatedLecture: Lecture) => {
    setLectures(prevLectures => 
      prevLectures.map(lecture => lecture.id === updatedLecture.id ? updatedLecture : lecture)
    );
  };

  const handleEditItem = (item: Book | Lecture) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
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

  const handleDeleteLecture = async (id: number) => {
    try {
      await deleteLecture(id);
      setLectures((prevLectures) => prevLectures.filter((lecture) => lecture.id !== id));
    } catch (err) {
      setError('Failed to delete lecture.');
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

  // Combine books and lectures into a single list for display
  const allItems: ListItem[] = [
    ...books.map(book => ({
      id: book.id,
      type: 'book' as const,
      title: book.title,
      author: authorMap.get(book.authorId) || `Unknown Author (ID: ${book.authorId})`,
      year: book.year,
      isRead: book.isRead,
      rating: book.rating,
      description: book.description,
    })),
    ...lectures.map(lecture => ({
      id: lecture.id,
      type: 'lecture' as const,
      title: lecture.title,
      speaker: typeof lecture.speakerId === 'number' 
        ? authorMap.get(lecture.speakerId) || `Unknown Speaker (ID: ${lecture.speakerId})`
        : lecture.speakerId, // If it's a string, use it directly
      year: lecture.year,
      duration: lecture.duration,
      link: lecture.link,
    }))
  ].sort((a, b) => b.year - a.year); // Sort by year, newest first

  if (loading) return <CenteredContainer>Loading items...</CenteredContainer>;
  if (error) return <CenteredContainer><div style={{ color: 'red' }}>Error: {error}</div></CenteredContainer>;

  return (
    <CenteredContainer>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>My Library</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            + Add Item
          </button>
        </div>

        {allItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No items in your library yet.</p>
            <p style={{ color: '#999' }}>Click "Add Item" to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {allItems.map((item) => {
              const originalItem = item.type === 'book' 
                ? books.find(b => b.id === item.id)
                : lectures.find(l => l.id === item.id);
              
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: item.type === 'book' && item.isRead ? '#f0f8f0' : 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ 
                          marginRight: '10px', 
                          fontSize: '20px',
                          color: item.type === 'book' ? '#007bff' : '#28a745'
                        }}>
                          {item.type === 'book' ? '📚' : '🎓'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>{item.title}</h3>
                      </div>
                      
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        {item.type === 'book' 
                          ? `by ${item.author}` 
                          : `by ${item.speaker}`
                        } • {item.year}
                      </p>
                      
                      {item.type === 'book' && item.isRead && (
                        <p style={{ margin: '5px 0', color: '#28a745', fontWeight: 'bold' }}>
                          ✓ Read{item.rating ? ` • Rating: ${item.rating}/5` : ''}
                        </p>
                      )}
                      
                      {item.type === 'lecture' && item.duration && (
                        <p style={{ margin: '5px 0', color: '#666' }}>
                          Duration: {item.duration} minutes
                        </p>
                      )}
                      
                      {item.description && (
                        <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                          {item.description}
                        </p>
                      )}
                      
                      {item.type === 'lecture' && item.link && (
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#007bff', 
                            textDecoration: 'none',
                            fontSize: '14px'
                          }}
                        >
                          🔗 Watch Lecture
                        </a>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                      <button
                        onClick={() => originalItem && handleEditItem(originalItem)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffc107',
                          color: '#212529',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Edit
                      </button>
                      {item.type === 'book' && (
                        <button
                          onClick={() => {
                            const book = books.find(b => b.id === item.id);
                            if (book) handleToggleRead(book);
                          }}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ddd',
                            backgroundColor: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {item.isRead ? 'Mark Unread' : 'Mark Read'}
                        </button>
                      )}
                      <button
                        onClick={() => item.type === 'book' 
                          ? handleDeleteBook(item.id) 
                          : handleDeleteLecture(item.id)
                        }
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AddItemModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onBookAdded={handleBookAdded}
          onLectureAdded={handleLectureAdded}
        />

        <EditItemModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          item={editingItem}
          onBookUpdated={handleBookUpdated}
          onLectureUpdated={handleLectureUpdated}
        />
      </div>
    </CenteredContainer>
  );
};

export default BookListPage;