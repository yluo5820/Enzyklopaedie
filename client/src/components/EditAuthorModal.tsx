import React, { useState, useEffect } from 'react';
import { Author, UpdateAuthor, Subject, Nation } from '@enzyklopaedie/shared';
import { updateAuthor, fetchSubjects, fetchNations, createSubject, createNation } from '../api';

interface EditAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  author: Author | null;
  onAuthorUpdated: (author: Author) => void;
}

const EditAuthorModal: React.FC<EditAuthorModalProps> = ({
  isOpen,
  onClose,
  author,
  onAuthorUpdated,
}) => {
  // Author form state
  const [authorName, setAuthorName] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [yearOfDeath, setYearOfDeath] = useState('');
  const [countryId, setCountryId] = useState<number | 'new' | null>(null);
  const [newCountryName, setNewCountryName] = useState('');
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  
  // Shared state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [nations, setNations] = useState<Nation[]>([]);
  const [nationsLoading, setNationsLoading] = useState(false);
  const [nationsError, setNationsError] = useState<string | null>(null);

  // Populate form when author changes
  useEffect(() => {
    if (author) {
      setAuthorName(author.name);
      setYearOfBirth(author.yearOfBirth?.toString() || '');
      setYearOfDeath(author.yearOfDeath?.toString() || '');
      setCountryId(author.countryId || null);
      setSubjectIds(author.subjectIds || []);
      setDescription(author.description || '');
      setImageUrl(author.imageUrl || '');
      setLink(author.link || '');
    }
  }, [author]);

  // Fetch subjects and nations when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubjectsLoading(true);
      setNationsLoading(true);
      
      Promise.all([
        fetchSubjects().catch((err) => {
          setSubjectsError('Failed to load subjects');
          return [];
        }),
        fetchNations().catch((err) => {
          setNationsError('Failed to load nations');
          return [];
        })
      ]).then(([fetchedSubjects, fetchedNations]) => {
        setSubjects(fetchedSubjects);
        setNations(fetchedNations);
      }).finally(() => {
        setSubjectsLoading(false);
        setNationsLoading(false);
      });
    }
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName || !author) return;
    
    let finalCountryId: number | null = null;
    let finalSubjectIds: number[] = [];
    
    try {
      // Handle country creation/selection
      if (countryId === 'new') {
        if (!newCountryName) return;
        const newCountry = await createNation({ name: newCountryName });
        finalCountryId = newCountry.id;
      } else {
        finalCountryId = countryId as number;
      }
      
      // Handle subject creation/selection
      if (newSubjectName) {
        const newSubject = await createSubject({ name: newSubjectName });
        finalSubjectIds = [...subjectIds, newSubject.id];
      } else {
        finalSubjectIds = subjectIds;
      }
      
      const updateData: UpdateAuthor = {
        name: authorName,
        yearOfBirth: yearOfBirth ? parseInt(yearOfBirth) : undefined,
        yearOfDeath: yearOfDeath ? parseInt(yearOfDeath) : undefined,
        countryId: finalCountryId || undefined,
        subjectIds: finalSubjectIds.length > 0 ? finalSubjectIds : undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        link: link || undefined,
      };
      
      await updateAuthor(author.id, updateData);
      
      // Create updated author object for callback
      const updatedAuthor: Author = {
        ...author,
        ...updateData,
      };
      
      onAuthorUpdated(updatedAuthor);
      onClose();
    } catch (error) {
      console.error('Failed to update author:', error);
    }
  };

  const resetForm = () => {
    setAuthorName('');
    setYearOfBirth('');
    setYearOfDeath('');
    setCountryId(null);
    setNewCountryName('');
    setSubjectIds([]);
    setNewSubjectName('');
    setDescription('');
    setImageUrl('');
    setLink('');
  };

  if (!isOpen || !author) return null;

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
          <h2>Edit Author</h2>
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Name *</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Year of Birth</label>
            <input
              type="number"
              value={yearOfBirth}
              onChange={(e) => setYearOfBirth(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Year of Death</label>
            <input
              type="number"
              value={yearOfDeath}
              onChange={(e) => setYearOfDeath(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Country</label>
            {nationsLoading ? (
              <div>Loading countries...</div>
            ) : nationsError ? (
              <div style={{ color: 'red' }}>{nationsError}</div>
            ) : (
              <>
                <select
                  value={countryId === null ? '' : countryId}
                  onChange={e => {
                    if (e.target.value === 'new') {
                      setCountryId('new');
                    } else {
                      setCountryId(e.target.value ? Number(e.target.value) : null);
                      setNewCountryName('');
                    }
                  }}
                  required={countryId === 'new'}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                >
                  <option value="">Select a country (optional)</option>
                  {nations.map(nation => (
                    <option key={nation.id} value={nation.id}>{nation.name}</option>
                  ))}
                  <option value="new">+ Add new country</option>
                </select>
                {countryId === 'new' && (
                  <input
                    type="text"
                    placeholder="New country name"
                    value={newCountryName}
                    onChange={e => setNewCountryName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Subjects</label>
            {subjectsLoading ? (
              <div>Loading subjects...</div>
            ) : subjectsError ? (
              <div style={{ color: 'red' }}>{subjectsError}</div>
            ) : (
              <>
                <select
                  multiple
                  value={subjectIds.map(String)}
                  onChange={e => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
                    setSubjectIds(selectedOptions);
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px', minHeight: '100px' }}
                >
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Add new subject (optional)"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Link (URL)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
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
              Update Author
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAuthorModal; 