import React, { useState, useEffect } from 'react';
import { Book, Lecture, NewBook, NewLecture, Author, Subject } from '@enzyklopaedie/shared';
import { createBook, createLecture, fetchAuthors, fetchSubjects, createAuthor, createSubject } from '../api';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded: (book: Book) => void;
  onLectureAdded: (lecture: Lecture) => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onBookAdded,
  onLectureAdded,
}) => {
  const [itemType, setItemType] = useState<'book' | 'lecture' | null>(null);
  
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

  // Fetch authors and subjects when modal opens for book or lecture
  useEffect(() => {
    if (isOpen && (itemType === 'book' || itemType === 'lecture')) {
      setAuthorsLoading(true);
      setSubjectsLoading(true);
      
      Promise.all([
        fetchAuthors().catch((err) => {
          setAuthorsError('Failed to load authors');
          return [];
        }),
        fetchSubjects().catch((err) => {
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
    if (!isOpen) {
      setItemType(null);
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
        maxWidth: '500px',
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
        ) : itemType === 'book' ? (
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