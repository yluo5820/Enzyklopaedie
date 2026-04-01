import React, { useState, useEffect } from 'react';
import { Book, Lecture, NewBook, NewLecture, Author, Subject } from '@enzyklopaedie/shared';
import { createBook, createLecture, fetchAuthors, fetchSubjects, createAuthor, createSubject } from '../api';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded: (book: Book) => void;
  onLectureAdded: (lecture: Lecture) => void;
}

type GoogleBookVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    imageLinks?: {
      thumbnail?: string;
    };
  };
};

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onBookAdded,
  onLectureAdded,
}) => {
  const [itemType, setItemType] = useState<'book' | 'lecture' | null>(null);
  const [bookAddMode, setBookAddMode] = useState<'custom' | 'search' | null>(null);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState<GoogleBookVolume[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [bookSelectedIds, setBookSelectedIds] = useState<string[]>([]);
  const [bookBulkAddLoading, setBookBulkAddLoading] = useState(false);
  const [bookBulkAddError, setBookBulkAddError] = useState<string | null>(null);
  
  // Book form state
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthorId, setBookAuthorId] = useState<number | 'new' | null>(null);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [bookSubjectId, setBookSubjectId] = useState<number | 'new' | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [bookYear, setBookYear] = useState(new Date().getFullYear().toString());
  const [bookPages, setBookPages] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  
  // Lecture form state
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureSpeakerId, setLectureSpeakerId] = useState<number | 'new' | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [lectureSubjectId, setLectureSubjectId] = useState<number | 'new' | null>(null);
  const [newLectureSubjectName, setNewLectureSubjectName] = useState('');
  const [lectureYear, setLectureYear] = useState(new Date().getFullYear().toString());
  const [lectureDuration, setLectureDuration] = useState('');
  const [lectureLink, setLectureLink] = useState('');
  
  // Shared state
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsError, setAuthorsError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const googleBooksApiKey = (import.meta.env as { VITE_GOOGLE_BOOKS_API_KEY?: string })
    .VITE_GOOGLE_BOOKS_API_KEY;

  // Fetch authors and subjects when modal opens for book or lecture
  useEffect(() => {
    if (isOpen && (itemType === 'book' || itemType === 'lecture')) {
      setAuthorsLoading(true);
      setSubjectsLoading(true);
      
      Promise.all([
        fetchAuthors().catch(() => {
          setAuthorsError('Failed to load authors');
          return [];
        }),
        fetchSubjects().catch(() => {
          setSubjectsError('Failed to load subjects');
          return [];
        })
      ]).then(([fetchedAuthors, fetchedSubjects]) => {
        setAuthors(fetchedAuthors);
        setSubjects(fetchedSubjects);
      }).finally(() => {
        setAuthorsLoading(false);
        setSubjectsLoading(false);
      });
    }
    if (itemType !== 'book') {
      setBookAddMode(null);
    }
    if (!isOpen) {
      setItemType(null);
      setBookAddMode(null);
      setBookSearchQuery('');
      setBookSearchResults([]);
      setBookSearchLoading(false);
      setBookSearchError(null);
      setBookSelectedIds([]);
      setBookBulkAddLoading(false);
      setBookBulkAddError(null);
      setBookAuthorId(null);
      setNewAuthorName('');
      setBookSubjectId(null);
      setNewSubjectName('');
      setLectureSpeakerId(null);
      setNewSpeakerName('');
      setLectureSubjectId(null);
      setNewLectureSubjectName('');
    }
  }, [isOpen, itemType]);

  const resetBookSearch = () => {
    setBookSearchQuery('');
    setBookSearchResults([]);
    setBookSearchLoading(false);
    setBookSearchError(null);
    setBookSelectedIds([]);
    setBookBulkAddLoading(false);
    setBookBulkAddError(null);
  };

  const parsePublishedYear = (publishedDate?: string) => {
    if (!publishedDate) return new Date().getFullYear();
    const match = publishedDate.match(/\d{4}/);
    if (!match) return new Date().getFullYear();
    return Number.parseInt(match[0], 10);
  };

  const handleBookSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = bookSearchQuery.trim();
    if (!trimmedQuery) return;

    setBookSearchLoading(true);
    setBookSearchError(null);
    setBookSearchResults([]);
    setBookSelectedIds([]);

    try {
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', trimmedQuery);
      url.searchParams.set('maxResults', '10');
      if (googleBooksApiKey) {
        url.searchParams.set('key', googleBooksApiKey);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to search books');
      }
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setBookSearchResults(items);
    } catch (error) {
      console.error('Failed to search books:', error);
      setBookSearchError('Failed to search books');
    } finally {
      setBookSearchLoading(false);
    }
  };

  const toggleBookSelection = (volumeId: string) => {
    setBookSelectedIds((prev) =>
      prev.includes(volumeId) ? prev.filter((id) => id !== volumeId) : [...prev, volumeId]
    );
  };

  const handleAddSelectedBooks = async () => {
    if (bookSelectedIds.length === 0) return;

    setBookBulkAddLoading(true);
    setBookBulkAddError(null);

    try {
      const selectedVolumes = bookSearchResults.filter((volume) =>
        bookSelectedIds.includes(volume.id)
      );
      const authorCache = new Map(
        authors.map((author) => [author.name.trim().toLowerCase(), author.id])
      );

      for (const volume of selectedVolumes) {
        const info = volume.volumeInfo ?? {};
        const title = info.title?.trim() || 'Untitled';
        const rawAuthorName = info.authors?.[0] || 'Unknown Author';
        const authorName = rawAuthorName.trim() || 'Unknown Author';
        const authorKey = authorName.toLowerCase();
        let authorId = authorCache.get(authorKey);

        if (!authorId) {
          const createdAuthor = await createAuthor({ name: authorName });
          authorId = createdAuthor.id;
          authorCache.set(authorKey, authorId);
          setAuthors((prev) => [...prev, createdAuthor]);
        }

        const newBook: NewBook = {
          title,
          authorId,
          subjectIds: [1],
          year: parsePublishedYear(info.publishedDate),
          pages: info.pageCount,
          isRead: false,
          description: info.description || undefined,
          coverImageUrl: info.imageLinks?.thumbnail,
        };

        const addedBook = await createBook(newBook);
        onBookAdded(addedBook);
      }

      setBookSelectedIds([]);
    } catch (error) {
      console.error('Failed to add selected books:', error);
      setBookBulkAddError('Failed to add selected books');
    } finally {
      setBookBulkAddLoading(false);
    }
  };

  const handleSubmitBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle) return;
    let authorId: number | null = null;
    let subjectId: number | null = null;
    
    try {
      // Handle author creation/selection
      if (bookAuthorId === 'new') {
        if (!newAuthorName) return;
        const newAuthor = await createAuthor({ name: newAuthorName });
        authorId = newAuthor.id;
      } else {
        authorId = bookAuthorId as number;
      }
      if (!authorId) return;
      
      // Handle subject creation/selection
      if (bookSubjectId === 'new') {
        if (!newSubjectName) return;
        const newSubject = await createSubject({ name: newSubjectName });
        subjectId = newSubject.id;
      } else {
        subjectId = bookSubjectId as number;
      }
      
      const newBook: NewBook = {
        title: bookTitle,
        authorId,
        subjectIds: subjectId ? [subjectId] : [1], // Use selected subject or default to General
        year: parseInt(bookYear),
        pages: bookPages ? parseInt(bookPages) : undefined,
        isRead: false,
        description: bookDescription || undefined,
      };
      const addedBook = await createBook(newBook);
      onBookAdded(addedBook);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to add book:', error);
    }
  };

  const handleSubmitLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle) return;
    let speakerId: number | null = null;
    let subjectId: number | null = null;
    
    try {
      // Handle speaker creation/selection
      if (lectureSpeakerId === 'new') {
        if (!newSpeakerName) return;
        const newSpeaker = await createAuthor({ name: newSpeakerName });
        speakerId = newSpeaker.id;
      } else {
        speakerId = lectureSpeakerId as number;
      }
      if (!speakerId) return;
      
      // Handle subject creation/selection
      if (lectureSubjectId === 'new') {
        if (!newLectureSubjectName) return;
        const newSubject = await createSubject({ name: newLectureSubjectName });
        subjectId = newSubject.id;
      } else {
        subjectId = lectureSubjectId as number;
      }
      
      const newLecture: NewLecture = {
        title: lectureTitle,
        speakerId,
        subjectIds: subjectId ? [subjectId] : [1], // Use selected subject or default to General
        year: parseInt(lectureYear),
        duration: lectureDuration ? parseInt(lectureDuration) : undefined,
        link: lectureLink || undefined,
      };
      
      const addedLecture = await createLecture(newLecture);
      onLectureAdded(addedLecture);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to add lecture:', error);
    }
  };

  const resetForm = () => {
    setItemType(null);
    setBookAddMode(null);
    setBookTitle('');
    setBookAuthorId(null);
    setNewAuthorName('');
    setBookSubjectId(null);
    setNewSubjectName('');
    setBookYear(new Date().getFullYear().toString());
    setBookPages('');
    setBookDescription('');
    setLectureTitle('');
    setLectureSpeakerId(null);
    setNewSpeakerName('');
    setLectureSubjectId(null);
    setNewLectureSubjectName('');
    setLectureYear(new Date().getFullYear().toString());
    setLectureDuration('');
    setLectureLink('');
    resetBookSearch();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '400px',
        width: '90%',
        maxWidth: bookAddMode === 'search' ? '700px' : '500px',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Add New Item</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {!itemType ? (
          <div>
            <p style={{ marginBottom: '20px' }}>What would you like to add?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setItemType('book')}
                style={{
                  padding: '15px 20px',
                  border: '2px solid #007bff',
                  backgroundColor: 'white',
                  color: '#007bff',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                📚 Book
              </button>
              <button
                onClick={() => setItemType('lecture')}
                style={{
                  padding: '15px 20px',
                  border: '2px solid #28a745',
                  backgroundColor: 'white',
                  color: '#28a745',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                🎓 Lecture
              </button>
            </div>
          </div>
        ) : itemType === 'book' && !bookAddMode ? (
          <div>
            <p style={{ marginBottom: '20px' }}>How would you like to add a book?</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <button
                onClick={() => setBookAddMode('custom')}
                style={{
                  padding: '15px 20px',
                  border: '2px solid #007bff',
                  backgroundColor: 'white',
                  color: '#007bff',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                ✍️ Custom
              </button>
              <button
                onClick={() => setBookAddMode('search')}
                style={{
                  padding: '15px 20px',
                  border: '2px solid #17a2b8',
                  backgroundColor: 'white',
                  color: '#17a2b8',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                🔎 Search
              </button>
            </div>
            <button
              type="button"
              onClick={() => setItemType(null)}
              style={{
                padding: '10px 15px',
                border: '1px solid #ddd',
                backgroundColor: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        ) : itemType === 'book' && bookAddMode === 'custom' ? (
          <form onSubmit={handleSubmitBook}>
            <h3>Add New Book</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Title *</label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Author *</label>
              {authorsLoading ? (
                <div>Loading authors...</div>
              ) : authorsError ? (
                <div style={{ color: 'red' }}>{authorsError}</div>
              ) : (
                <>
                  <select
                    value={bookAuthorId === null ? '' : bookAuthorId}
                    onChange={e => {
                      if (e.target.value === 'new') {
                        setBookAuthorId('new');
                      } else {
                        setBookAuthorId(Number(e.target.value));
                        setNewAuthorName('');
                      }
                    }}
                    required={bookAuthorId !== 'new'}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                  >
                    <option value="" disabled>Select an author...</option>
                    {authors.map(author => (
                      <option key={author.id} value={author.id}>{author.name}</option>
                    ))}
                    <option value="new">+ Add new author</option>
                  </select>
                  {bookAuthorId === 'new' && (
                    <input
                      type="text"
                      placeholder="New author name"
                      value={newAuthorName}
                      onChange={e => setNewAuthorName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Subject</label>
              {subjectsLoading ? (
                <div>Loading subjects...</div>
              ) : subjectsError ? (
                <div style={{ color: 'red' }}>{subjectsError}</div>
              ) : (
                <>
                  <select
                    value={bookSubjectId === null ? '' : bookSubjectId}
                    onChange={e => {
                      if (e.target.value === 'new') {
                        setBookSubjectId('new');
                      } else {
                        setBookSubjectId(e.target.value ? Number(e.target.value) : null);
                        setNewSubjectName('');
                      }
                    }}
                    required={bookSubjectId === 'new'}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                  >
                    <option value="">Select a subject (optional)</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                    <option value="new">+ Add new subject</option>
                  </select>
                  {bookSubjectId === 'new' && (
                    <input
                      type="text"
                      placeholder="New subject name"
                      value={newSubjectName}
                      onChange={e => setNewSubjectName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Year</label>
              <input
                type="number"
                value={bookYear}
                onChange={(e) => setBookYear(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Pages</label>
              <input
                type="number"
                value={bookPages}
                onChange={(e) => setBookPages(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
              <textarea
                value={bookDescription}
                onChange={(e) => setBookDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setBookAddMode(null)}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Add Book
              </button>
            </div>
          </form>
        ) : itemType === 'book' && bookAddMode === 'search' ? (
          <div>
            <h3>Search Books</h3>
            <form
              onSubmit={handleBookSearch}
              style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
            >
              <input
                type="text"
                value={bookSearchQuery}
                onChange={(e) => setBookSearchQuery(e.target.value)}
                placeholder="Search by title, author, or keyword"
                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button
                type="submit"
                disabled={bookSearchLoading}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {bookSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
            {bookSearchError && <div style={{ color: 'red', marginBottom: '10px' }}>{bookSearchError}</div>}
            {!bookSearchLoading && bookSearchResults.length === 0 && bookSearchQuery.trim() && (
              <div style={{ color: '#666', marginBottom: '10px' }}>No results found.</div>
            )}
            {bookSearchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bookSearchResults.map((volume) => {
                  const info = volume.volumeInfo ?? {};
                  const title = info.title || 'Untitled';
                  const authorsText = info.authors?.join(', ') || 'Unknown author';
                  const publishedDate = info.publishedDate || 'Unknown year';
                  const description = info.description || '';
                  const thumbnail = info.imageLinks?.thumbnail;
                  const isSelected = bookSelectedIds.includes(volume.id);
                  const preview =
                    description.length > 160 ? `${description.slice(0, 160)}...` : description;

                  return (
                    <label
                      key={volume.id}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '10px',
                        border: '1px solid #eee',
                        borderRadius: '6px',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f0f7ff' : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBookSelection(volume.id)}
                        style={{ marginTop: '4px' }}
                      />
                      {thumbnail && (
                        <img
                          src={thumbnail}
                          alt={`${title} cover`}
                          style={{
                            width: '48px',
                            height: '72px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#333' }}>{title}</div>
                        <div style={{ color: '#666', fontSize: '0.9em' }}>{authorsText}</div>
                        <div style={{ color: '#999', fontSize: '0.85em' }}>{publishedDate}</div>
                        {preview && (
                          <p style={{ marginTop: '6px', fontSize: '0.9em', color: '#444' }}>
                            {preview}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {bookBulkAddError && <div style={{ color: 'red', marginTop: '10px' }}>{bookBulkAddError}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                type="button"
                onClick={() => {
                  setBookAddMode(null);
                  resetBookSearch();
                }}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleAddSelectedBooks}
                disabled={bookSelectedIds.length === 0 || bookBulkAddLoading}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {bookBulkAddLoading
                  ? 'Adding...'
                  : `Add Selected${bookSelectedIds.length ? ` (${bookSelectedIds.length})` : ''}`}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitLecture}>
            <h3>Add New Lecture</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Title *</label>
              <input
                type="text"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Speaker *</label>
              {authorsLoading ? (
                <div>Loading speakers...</div>
              ) : authorsError ? (
                <div style={{ color: 'red' }}>{authorsError}</div>
              ) : (
                <>
                  <select
                    value={lectureSpeakerId === null ? '' : lectureSpeakerId}
                    onChange={e => {
                      if (e.target.value === 'new') {
                        setLectureSpeakerId('new');
                      } else {
                        setLectureSpeakerId(Number(e.target.value));
                        setNewSpeakerName('');
                      }
                    }}
                    required={lectureSpeakerId !== 'new'}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                  >
                    <option value="" disabled>Select a speaker...</option>
                    {authors.map(author => (
                      <option key={author.id} value={author.id}>{author.name}</option>
                    ))}
                    <option value="new">+ Add new speaker</option>
                  </select>
                  {lectureSpeakerId === 'new' && (
                    <input
                      type="text"
                      placeholder="New speaker name"
                      value={newSpeakerName}
                      onChange={e => setNewSpeakerName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Subject</label>
              {subjectsLoading ? (
                <div>Loading subjects...</div>
              ) : subjectsError ? (
                <div style={{ color: 'red' }}>{subjectsError}</div>
              ) : (
                <>
                  <select
                    value={lectureSubjectId === null ? '' : lectureSubjectId}
                    onChange={e => {
                      if (e.target.value === 'new') {
                        setLectureSubjectId('new');
                      } else {
                        setLectureSubjectId(e.target.value ? Number(e.target.value) : null);
                        setNewLectureSubjectName('');
                      }
                    }}
                    required={lectureSubjectId === 'new'}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                  >
                    <option value="">Select a subject (optional)</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                    <option value="new">+ Add new subject</option>
                  </select>
                  {lectureSubjectId === 'new' && (
                    <input
                      type="text"
                      placeholder="New subject name"
                      value={newLectureSubjectName}
                      onChange={e => setNewLectureSubjectName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Year</label>
              <input
                type="number"
                value={lectureYear}
                onChange={(e) => setLectureYear(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Duration (minutes)</label>
              <input
                type="number"
                value={lectureDuration}
                onChange={(e) => setLectureDuration(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Link (URL)</label>
              <input
                type="url"
                value={lectureLink}
                onChange={(e) => setLectureLink(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setItemType(null)}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Add Lecture
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddItemModal; 
