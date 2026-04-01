import React, { useState, useEffect } from 'react';
import { Nation, UpdateNation, Author, Civilization, Era } from '@enzyklopaedie/shared';
import { updateNation, fetchAuthors, fetchCivilizations, fetchEras, createAuthor, createCivilization, createEra } from '../api';

interface EditNationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nation: Nation | null;
  onNationUpdated: (nation: Nation) => void;
}

const EditNationModal: React.FC<EditNationModalProps> = ({
  isOpen,
  onClose,
  nation,
  onNationUpdated,
}) => {
  // Nation form state
  const [nationName, setNationName] = useState('');
  const [beginYear, setBeginYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  
  // Author selection
  const [authorIds, setAuthorIds] = useState<number[]>([]);
  const [newAuthorName, setNewAuthorName] = useState('');
  
  // Civilization selection
  const [civilizationId, setCivilizationId] = useState<number | 'new' | null>(null);
  const [newCivilizationName, setNewCivilizationName] = useState('');
  
  // Era selection
  const [eraIds, setEraIds] = useState<number[]>([]);
  const [newEraName, setNewEraName] = useState('');
  
  // Shared state
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsError, setAuthorsError] = useState<string | null>(null);
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [civilizationsLoading, setCivilizationsLoading] = useState(false);
  const [civilizationsError, setCivilizationsError] = useState<string | null>(null);
  const [eras, setEras] = useState<Era[]>([]);
  const [erasLoading, setErasLoading] = useState(false);
  const [erasError, setErasError] = useState<string | null>(null);

  // Initialize form when nation changes
  useEffect(() => {
    if (nation) {
      setNationName(nation.name);
      setBeginYear(nation.beginYear?.toString() || '');
      setEndYear(nation.endYear?.toString() || '');
      setDescription(nation.description || '');
      setImageUrl(nation.imageUrl || '');
      setLink(nation.link || '');
      setAuthorIds(nation.authorIds || []);
      setCivilizationId(nation.civilizationId || null);
      setEraIds(nation.eraIds || []);
      setNewAuthorName('');
      setNewCivilizationName('');
      setNewEraName('');
    }
  }, [nation]);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthorsLoading(true);
      setCivilizationsLoading(true);
      setErasLoading(true);
      
      Promise.all([
        fetchAuthors().catch(() => {
          setAuthorsError('Failed to load authors');
          return [];
        }),
        fetchCivilizations().catch(() => {
          setCivilizationsError('Failed to load civilizations');
          return [];
        }),
        fetchEras().catch(() => {
          setErasError('Failed to load eras');
          return [];
        })
      ]).then(([fetchedAuthors, fetchedCivilizations, fetchedEras]) => {
        setAuthors(fetchedAuthors);
        setCivilizations(fetchedCivilizations);
        setEras(fetchedEras);
      }).finally(() => {
        setAuthorsLoading(false);
        setCivilizationsLoading(false);
        setErasLoading(false);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nation || !nationName) return;
    
    let finalAuthorIds: number[] = [];
    let finalCivilizationId: number | null = null;
    let finalEraIds: number[] = [];
    
    try {
      // Handle author creation/selection
      if (newAuthorName) {
        const newAuthor = await createAuthor({ name: newAuthorName });
        finalAuthorIds = [...authorIds, newAuthor.id];
      } else {
        finalAuthorIds = authorIds;
      }
      
      // Handle civilization creation/selection
      if (civilizationId === 'new') {
        if (!newCivilizationName) return;
        const newCivilization = await createCivilization({ name: newCivilizationName });
        finalCivilizationId = newCivilization.id;
      } else {
        finalCivilizationId = civilizationId as number;
      }
      
      // Handle era creation/selection
      if (newEraName) {
        const newEra = await createEra({ name: newEraName });
        finalEraIds = [...eraIds, newEra.id];
      } else {
        finalEraIds = eraIds;
      }
      
      const updatedNation: UpdateNation = {
        name: nationName,
        beginYear: beginYear ? parseInt(beginYear) : undefined,
        endYear: endYear ? parseInt(endYear) : undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        link: link || undefined,
        authorIds: finalAuthorIds.length > 0 ? finalAuthorIds : undefined,
        civilizationId: finalCivilizationId || undefined,
        eraIds: finalEraIds.length > 0 ? finalEraIds : undefined,
      };
      
      const result = await updateNation(nation.id, updatedNation);
      onNationUpdated(result);
      onClose();
    } catch (error) {
      console.error('Failed to update nation:', error);
    }
  };

  if (!isOpen || !nation) return null;

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
          <h2>Edit Nation</h2>
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
              value={nationName}
              onChange={(e) => setNationName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Begin Year</label>
            <input
              type="number"
              value={beginYear}
              onChange={(e) => setBeginYear(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>End Year</label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Authors</label>
            {authorsLoading ? (
              <div>Loading authors...</div>
            ) : authorsError ? (
              <div style={{ color: 'red' }}>{authorsError}</div>
            ) : (
              <>
                <select
                  multiple
                  value={authorIds.map(String)}
                  onChange={e => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
                    setAuthorIds(selectedOptions);
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px', minHeight: '100px' }}
                >
                  {authors.map(author => (
                    <option key={author.id} value={author.id}>{author.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Add new author (optional)"
                  value={newAuthorName}
                  onChange={e => setNewAuthorName(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Civilization</label>
            {civilizationsLoading ? (
              <div>Loading civilizations...</div>
            ) : civilizationsError ? (
              <div style={{ color: 'red' }}>{civilizationsError}</div>
            ) : (
              <>
                <select
                  value={civilizationId === null ? '' : civilizationId}
                  onChange={e => {
                    if (e.target.value === 'new') {
                      setCivilizationId('new');
                    } else {
                      setCivilizationId(e.target.value ? Number(e.target.value) : null);
                      setNewCivilizationName('');
                    }
                  }}
                  required={civilizationId === 'new'}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                >
                  <option value="">Select a civilization (optional)</option>
                  {civilizations.map(civilization => (
                    <option key={civilization.id} value={civilization.id}>{civilization.name}</option>
                  ))}
                  <option value="new">+ Add new civilization</option>
                </select>
                {civilizationId === 'new' && (
                  <input
                    type="text"
                    placeholder="New civilization name"
                    value={newCivilizationName}
                    onChange={e => setNewCivilizationName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Eras</label>
            {erasLoading ? (
              <div>Loading eras...</div>
            ) : erasError ? (
              <div style={{ color: 'red' }}>{erasError}</div>
            ) : (
              <>
                <select
                  multiple
                  value={eraIds.map(String)}
                  onChange={e => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
                    setEraIds(selectedOptions);
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px', minHeight: '100px' }}
                >
                  {eras.map(era => (
                    <option key={era.id} value={era.id}>{era.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Add new era (optional)"
                  value={newEraName}
                  onChange={e => setNewEraName(e.target.value)}
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
              Update Nation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNationModal; 
