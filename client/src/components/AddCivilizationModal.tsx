import React, { useState, useEffect } from 'react';
import { Civilization, NewCivilization, Nation } from '@enzyklopaedie/shared';
import { createCivilization, fetchNations, createNation } from '../api';

interface AddCivilizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCivilizationAdded: (civilization: Civilization) => void;
}

const AddCivilizationModal: React.FC<AddCivilizationModalProps> = ({
  isOpen,
  onClose,
  onCivilizationAdded,
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

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      setNationsLoading(true);
      setCivilizationsLoading(true);
      
      Promise.all([
        fetchNations().catch((err) => {
          setNationsError('Failed to load nations');
          return [];
        }),
        import('../api').then(api => api.fetchCivilizations()).catch((err) => {
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
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!civilizationName) return;
    
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
        const newParent = await createCivilization({ name: newParentName });
        finalParentId = newParent.id;
      } else {
        finalParentId = parentId as number;
      }
      
      const newCivilization: NewCivilization = {
        name: civilizationName,
        description: description || undefined,
        nationIds: finalNationIds.length > 0 ? finalNationIds : undefined,
        parentId: finalParentId || undefined,
      };
      
      const addedCivilization = await createCivilization(newCivilization);
      onCivilizationAdded(addedCivilization);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to add civilization:', error);
    }
  };

  const resetForm = () => {
    setCivilizationName('');
    setDescription('');
    setNationIds([]);
    setNewNationName('');
    setParentId(null);
    setNewParentName('');
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
          <h2>Add New Civilization</h2>
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
                  {civilizations.map(civilization => (
                    <option key={civilization.id} value={civilization.id}>{civilization.name}</option>
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
              Add Civilization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCivilizationModal; 