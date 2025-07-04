import React, { useState, useEffect } from 'react';
import { Era, NewEra, Civilization } from '@enzyklopaedie/shared';
import { createEra, fetchCivilizations, createCivilization } from '../api';

interface AddEraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEraAdded: (era: Era) => void;
}

const AddEraModal: React.FC<AddEraModalProps> = ({
  isOpen,
  onClose,
  onEraAdded,
}) => {
  // Era form state
  const [eraName, setEraName] = useState('');
  const [beginYear, setBeginYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [description, setDescription] = useState('');
  
  // Civilization selection
  const [civilizationId, setCivilizationId] = useState<number | 'new' | null>(null);
  const [newCivilizationName, setNewCivilizationName] = useState('');
  
  // Shared state
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [civilizationsLoading, setCivilizationsLoading] = useState(false);
  const [civilizationsError, setCivilizationsError] = useState<string | null>(null);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      setCivilizationsLoading(true);
      
      fetchCivilizations().catch((err) => {
        setCivilizationsError('Failed to load civilizations');
        return [];
      }).then((fetchedCivilizations) => {
        setCivilizations(fetchedCivilizations);
      }).finally(() => {
        setCivilizationsLoading(false);
      });
    }
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eraName) return;
    
    let finalCivilizationId: number | null = null;
    
    try {
      // Handle civilization creation/selection
      if (civilizationId === 'new') {
        if (!newCivilizationName) return;
        const newCivilization = await createCivilization({ name: newCivilizationName });
        finalCivilizationId = newCivilization.id;
      } else {
        finalCivilizationId = civilizationId as number;
      }
      
      const newEra: NewEra = {
        name: eraName,
        beginYear: beginYear ? parseInt(beginYear) : undefined,
        endYear: endYear ? parseInt(endYear) : undefined,
        description: description || undefined,
        civilizationId: finalCivilizationId || undefined,
      };
      
      const addedEra = await createEra(newEra);
      onEraAdded(addedEra);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to add era:', error);
    }
  };

  const resetForm = () => {
    setEraName('');
    setBeginYear('');
    setEndYear('');
    setDescription('');
    setCivilizationId(null);
    setNewCivilizationName('');
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
          <h2>Add New Era</h2>
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
              value={eraName}
              onChange={(e) => setEraName(e.target.value)}
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
              Add Era
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEraModal; 