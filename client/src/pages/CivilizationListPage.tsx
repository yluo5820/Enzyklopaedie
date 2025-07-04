import React, { useEffect, useState } from 'react';
import { Civilization, Nation } from '@enzyklopaedie/shared';
import { fetchCivilizations, fetchNations, deleteCivilization } from '../api';
import AddCivilizationModal from '../components/AddCivilizationModal';
import EditCivilizationModal from '../components/EditCivilizationModal';

interface CivilizationListItem {
  id: number;
  name: string;
  description?: string;
  nations?: string[];
  parent?: string;
}

const CivilizationListPage: React.FC = () => {
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCivilization, setEditingCivilization] = useState<Civilization | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedCivilizations, fetchedNations] = await Promise.all([
          fetchCivilizations(),
          fetchNations(),
        ]);
        setCivilizations(fetchedCivilizations);
        setNations(fetchedNations);
      } catch (err) {
        setError('Failed to load civilizations.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create lookup maps for names
  const nationMap = new Map(nations.map(nation => [nation.id, nation.name]));
  const civilizationMap = new Map(civilizations.map(civilization => [civilization.id, civilization.name]));

  const handleCivilizationAdded = (civilization: Civilization) => {
    setCivilizations(prevCivilizations => [...prevCivilizations, civilization]);
  };

  const handleCivilizationUpdated = (updatedCivilization: Civilization) => {
    setCivilizations(prevCivilizations => 
      prevCivilizations.map(civilization => civilization.id === updatedCivilization.id ? updatedCivilization : civilization)
    );
  };

  const handleEditCivilization = (civilization: Civilization) => {
    setEditingCivilization(civilization);
    setIsEditModalOpen(true);
  };

  const handleDeleteCivilization = async (id: number) => {
    try {
      await deleteCivilization(id);
      setCivilizations((prevCivilizations) => prevCivilizations.filter((civilization) => civilization.id !== id));
    } catch (err) {
      setError('Failed to delete civilization.');
      console.error(err);
    }
  };

  // Convert civilizations to display format
  const civilizationItems: CivilizationListItem[] = civilizations.map(civilization => ({
    id: civilization.id,
    name: civilization.name,
    description: civilization.description,
    nations: civilization.nationIds?.map(id => nationMap.get(id)).filter(Boolean) as string[],
    parent: civilization.parentId ? civilizationMap.get(civilization.parentId) : undefined,
  })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

  if (loading) return <div>Loading civilizations...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Civilizations</h1>
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
          + Add Civilization
        </button>
      </div>

      {civilizationItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No civilizations in your library yet.</p>
          <p style={{ color: '#999' }}>Click "Add Civilization" to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {civilizationItems.map((civilization) => {
            const originalCivilization = civilizations.find(c => c.id === civilization.id);
            
            return (
              <div
                key={civilization.id}
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
                        🏛️
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{civilization.name}</h3>
                    </div>
                    
                    {civilization.parent && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Parent:</strong> {civilization.parent}
                      </p>
                    )}
                    
                    {civilization.nations && civilization.nations.length > 0 && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Nations:</strong> {civilization.nations.join(', ')}
                      </p>
                    )}
                    
                    {civilization.description && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        {civilization.description}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    <button
                      onClick={() => originalCivilization && handleEditCivilization(originalCivilization)}
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
                      onClick={() => handleDeleteCivilization(civilization.id)}
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

      <AddCivilizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCivilizationAdded={handleCivilizationAdded}
      />

      <EditCivilizationModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCivilization(null);
        }}
        civilization={editingCivilization}
        onCivilizationUpdated={handleCivilizationUpdated}
      />
    </div>
  );
};

export default CivilizationListPage; 