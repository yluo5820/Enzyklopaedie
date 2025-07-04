import React, { useEffect, useState } from 'react';
import { Era, Civilization } from '@enzyklopaedie/shared';
import { fetchEras, fetchCivilizations, deleteEra } from '../api';
import AddEraModal from '../components/AddEraModal';
import EditEraModal from '../components/EditEraModal';

interface EraListItem {
  id: number;
  name: string;
  beginYear?: number;
  endYear?: number;
  description?: string;
  civilization?: string;
}

const EraListPage: React.FC = () => {
  const [eras, setEras] = useState<Era[]>([]);
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEra, setEditingEra] = useState<Era | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedEras, fetchedCivilizations] = await Promise.all([
          fetchEras(),
          fetchCivilizations(),
        ]);
        setEras(fetchedEras);
        setCivilizations(fetchedCivilizations);
      } catch (err) {
        setError('Failed to load eras.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create lookup maps for names
  const civilizationMap = new Map(civilizations.map(civilization => [civilization.id, civilization.name]));

  const handleEraAdded = (era: Era) => {
    setEras(prevEras => [...prevEras, era]);
  };

  const handleEraUpdated = (updatedEra: Era) => {
    setEras(prevEras => 
      prevEras.map(era => era.id === updatedEra.id ? updatedEra : era)
    );
  };

  const handleEditEra = (era: Era) => {
    setEditingEra(era);
    setIsEditModalOpen(true);
  };

  const handleDeleteEra = async (id: number) => {
    try {
      await deleteEra(id);
      setEras((prevEras) => prevEras.filter((era) => era.id !== id));
    } catch (err) {
      setError('Failed to delete era.');
      console.error(err);
    }
  };

  // Convert eras to display format
  const eraItems: EraListItem[] = eras.map(era => ({
    id: era.id,
    name: era.name,
    beginYear: era.beginYear,
    endYear: era.endYear,
    description: era.description,
    civilization: era.civilizationId ? civilizationMap.get(era.civilizationId) : undefined,
  })).sort((a, b) => {
    // Sort by begin year if available, otherwise by name
    if (a.beginYear && b.beginYear) {
      return a.beginYear - b.beginYear;
    }
    if (a.beginYear) return -1;
    if (b.beginYear) return 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) return <div>Loading eras...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Eras</h1>
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
          + Add Era
        </button>
      </div>

      {eraItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No eras in your library yet.</p>
          <p style={{ color: '#999' }}>Click "Add Era" to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {eraItems.map((era) => {
            const originalEra = eras.find(e => e.id === era.id);
            
            return (
              <div
                key={era.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ 
                        marginRight: '10px', 
                        fontSize: '20px',
                        color: '#007bff'
                      }}>
                        ⏰
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{era.name}</h3>
                    </div>
                    
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      {era.beginYear && era.endYear 
                        ? `${era.beginYear} - ${era.endYear}`
                        : era.beginYear 
                        ? `from ${era.beginYear}`
                        : era.endYear 
                        ? `until ${era.endYear}`
                        : ''
                      }
                      {era.civilization && (era.beginYear || era.endYear) && ' • '}
                      {era.civilization && `Civilization: ${era.civilization}`}
                    </p>
                    
                    {era.description && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        {era.description}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    <button
                      onClick={() => originalEra && handleEditEra(originalEra)}
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
                    <button
                      onClick={() => handleDeleteEra(era.id)}
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

      <AddEraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEraAdded={handleEraAdded}
      />

      <EditEraModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingEra(null);
        }}
        era={editingEra}
        onEraUpdated={handleEraUpdated}
      />
    </div>
  );
};

export default EraListPage; 