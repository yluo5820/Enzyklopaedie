import React, { useState, useEffect } from 'react';
import { Civilization, UpdateCivilization, Nation } from '@enzyklopaedie/shared';
import { updateCivilization, fetchNations, createNation } from '../api';

interface EditCivilizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  civilization: Civilization | null;
  onCivilizationUpdated: (civilization: Civilization) => void;
}

const EditCivilizationModal: React.FC<EditCivilizationModalProps> = ({
  isOpen,
  onClose,
  civilization,
  onCivilizationUpdated,
}) => {
  // Civilization form state
  const [civilizationName, setCivilizationName] = useState('');
  const [description, setDescription] = useState('');
  
  // Nation selection
  const [nationIds, setNationIds] = useState<number[]>([]);
  const [newNationName, setNewNationName] = useState('');
  
  // Parent civilization selection
  const [parentId, setParentId] = useState<number | 'new' | null>(null);
  const [newParentName, setNewParentName] = useState('');
  
  // Shared state
  const [nations, setNations] = useState<Nation[]>([]);
  const [nationsLoading, setNationsLoading] = useState(false);
  const [nationsError, setNationsError] = useState<string | null>(null);
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [civilizationsLoading, setCivilizationsLoading] = useState(false);
  const [civilizationsError, setCivilizationsError] = useState<string | null>(null);

  // Initialize form when civilization changes
  useEffect(() => {
    if (civilization) {
      setCivilizationName(civilization.name);
      setDescription(civilization.description || '');
      setNationIds(civilization.nationIds || []);
      setParentId(civilization.parentId || null);
      setNewNationName('');
      setNewParentName('');
    }
  }, [civilization]);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      setNationsLoading(true);
      setCivilizationsLoading(true);
      
      Promise.all([
        fetchNations().catch(() => {
          setNationsError('Failed to load nations');
          return [];
        }),
        import('../api').then(api => api.fetchCivilizations()).catch(() => {
          setCivilizationsError('Failed to load civilizations');
          return [];
        })
      ]).then(([fetchedNations, fetchedCivilizations]) => {
        setNations(fetchedNations);
        setCivilizations(fetchedCivilizations);
      }).finally(() => {
        setNationsLoading(false);
        setCivilizationsLoading(false);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!civilization || !civilizationName) return;
    
    let finalNationIds: number[] = [];
    let finalParentId: number | null = null;
    
    try {
      // Handle nation creation/selection
      if (newNationName) {
        const newNation = await createNation({ name: newNationName });
        finalNationIds = [...nationIds, newNation.id];
      } else {
        finalNationIds = nationIds;
      }
      
      // Handle parent civilization creation/selection
      if (parentId === 'new') {
        if (!newParentName) return;
        const newParent = await import('../api').then(api => api.createCivilization({ name: newParentName }));
        finalParentId = newParent.id;
      } else {
        finalParentId = parentId as number;
      }
      
      const updatedCivilization: UpdateCivilization = {
        name: civilizationName,
        description: description || undefined,
        nationIds: finalNationIds.length > 0 ? finalNationIds : undefined,
        parentId: finalParentId || undefined,
      };
      
      const result = await updateCivilization(civilization.id, updatedCivilization);
      onCivilizationUpdated(result);
      onClose();
    } catch (error) {
      console.error('Failed to update civilization:', error);
    }
  };

  if (!isOpen || !civilization) return null;

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
          <h2>Edit Civilization</h2>
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
              value={civilizationName}
              onChange={(e) => setCivilizationName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Nations</label>
            {nationsLoading ? (
              <div>Loading nations...</div>
            ) : nationsError ? (
              <div style={{ color: 'red' }}>{nationsError}</div>
            ) : (
              <>
                <select
                  multiple
                  value={nationIds.map(String)}
                  onChange={e => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
                    setNationIds(selectedOptions);
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px', minHeight: '100px' }}
                >
                  {nations.map(nation => (
                    <option key={nation.id} value={nation.id}>{nation.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Add new nation (optional)"
                  value={newNationName}
                  onChange={e => setNewNationName(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Parent Civilization</label>
            {civilizationsLoading ? (
              <div>Loading civilizations...</div>
            ) : civilizationsError ? (
              <div style={{ color: 'red' }}>{civilizationsError}</div>
            ) : (
              <>
                <select
                  value={parentId === null ? '' : parentId}
                  onChange={e => {
                    if (e.target.value === 'new') {
                      setParentId('new');
                    } else {
                      setParentId(e.target.value ? Number(e.target.value) : null);
                      setNewParentName('');
                    }
                  }}
                  required={parentId === 'new'}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px' }}
                >
                  <option value="">Select a parent civilization (optional)</option>
                  {civilizations.map(civ => (
                    <option key={civ.id} value={civ.id}>{civ.name}</option>
                  ))}
                  <option value="new">+ Add new parent civilization</option>
                </select>
                {parentId === 'new' && (
                  <input
                    type="text"
                    placeholder="New parent civilization name"
                    value={newParentName}
                    onChange={e => setNewParentName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                )}
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
              Update Civilization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCivilizationModal; 
