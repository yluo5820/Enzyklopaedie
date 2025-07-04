import React, { useState, useEffect } from 'react';
import { Book, Lecture, UpdateBook, UpdateLecture, Author, Subject } from '@enzyklopaedie/shared';
import { updateBook, updateLecture, fetchAuthors, fetchSubjects, createAuthor, createSubject } from '../api';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Book | Lecture | null;
  onBookUpdated: (book: Book) => void;
  onLectureUpdated: (lecture: Lecture) => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  onClose,
  item,
  onBookUpdated,
  onLectureUpdated,
}) => {
  // Book form state
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthorId, setBookAuthorId] = useState<number | 'new' | null>(null);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [bookSubjectId, setBookSubjectId] = useState<number | 'new' | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [bookYear, setBookYear] = useState('');
  const [bookPages, setBookPages] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [bookRating, setBookRating] = useState('');
  
  // Lecture form state
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureSpeakerId, setLectureSpeakerId] = useState<number | 'new' | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [lectureSubjectId, setLectureSubjectId] = useState<number | 'new' | null>(null);
  const [newLectureSubjectName, setNewLectureSubjectName] = useState('');
  const [lectureYear, setLectureYear] = useState('');
  const [lectureDuration, setLectureDuration] = useState('');
  const [lectureLink, setLectureLink] = useState('');
  
  // Shared state
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsError, setAuthorsError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      if ('authorId' in item) {
        // Book
        setBookTitle(item.title);
        setBookAuthorId(item.authorId);
        setBookSubjectId(item.subjectIds?.[0] || null);
        setBookYear(item.year.toString());
        setBookPages(item.pages?.toString() || '');
        setBookDescription(item.description || '');
        setBookRating(item.rating?.toString() || '');
      } else {
        // Lecture
        setLectureTitle(item.title);
        setLectureSpeakerId(typeof item.speakerId === 'number' ? item.speakerId : null);
        setLectureSubjectId(item.subjectIds?.[0] || null);
        setLectureYear(item.year.toString());
        setLectureDuration(item.duration?.toString() || '');
        setLectureLink(item.link || '');
      }
    }
  }, [item]);

  // Fetch authors and subjects when modal opens
  useEffect(() => {
    if (isOpen) {
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
      resetForm();
    }
  }, [isOpen]);

  const handleSubmitBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle || !item || !('authorId' in item)) return;
    
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
      
      const updateData: UpdateBook = {
        title: bookTitle,
        authorId,
        subjectIds: subjectId ? [subjectId] : [1],
        year: parseInt(bookYear),
        pages: bookPages ? parseInt(bookPages) : undefined,
        description: bookDescription || undefined,
        rating: bookRating ? parseInt(bookRating) : undefined,
      };
      
      await updateBook(item.id, updateData);
      
      // Create updated book object for callback
      const updatedBook: Book = {
        ...item,
        ...updateData,
      };
      
      onBookUpdated(updatedBook);
      onClose();
    } catch (error) {
      console.error('Failed to update book:', error);
    }
  };

  const handleSubmitLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle || !item || 'authorId' in item) return;
    
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
      
      const updateData: UpdateLecture = {
        title: lectureTitle,
        speakerId,
        subjectIds: subjectId ? [subjectId] : [1],
        year: parseInt(lectureYear),
        duration: lectureDuration ? parseInt(lectureDuration) : undefined,
        link: lectureLink || undefined,
      };
      
      await updateLecture(item.id, updateData);
      
      // Create updated lecture object for callback
      const updatedLecture: Lecture = {
        ...item,
        ...updateData,
      };
      
      onLectureUpdated(updatedLecture);
      onClose();
    } catch (error) {
      console.error('Failed to update lecture:', error);
    }
  };

  const resetForm = () => {
    setBookTitle('');
    setBookAuthorId(null);
    setNewAuthorName('');
    setBookSubjectId(null);
    setNewSubjectName('');
    setBookYear('');
    setBookPages('');
    setBookDescription('');
    setBookRating('');
    setLectureTitle('');
    setLectureSpeakerId(null);
    setNewSpeakerName('');
    setLectureSubjectId(null);
    setNewLectureSubjectName('');
    setLectureYear('');
    setLectureDuration('');
    setLectureLink('');
  };

  if (!isOpen || !item) return null;

  const isBook = 'authorId' in item;

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
          <h2>Edit {isBook ? 'Book' : 'Lecture'}</h2>
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

        {isBook ? (
          <form onSubmit={handleSubmitBook}>
            <h3>Edit Book</h3>
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
              <label style={{ display: 'block', marginBottom: '5px' }}>Rating (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={bookRating}
                onChange={(e) => setBookRating(e.target.value)}
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
                onClick={onClose}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
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
                Update Book
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitLecture}>
            <h3>Edit Lecture</h3>
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
                onClick={onClose}
                style={{
                  padding: '10px 15px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
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
                Update Lecture
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditItemModal; 