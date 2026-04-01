import React, { useEffect, useState } from 'react';
import { Nation, Author, Civilization, Era } from '@enzyklopaedie/shared';
import { fetchNations, fetchAuthors, fetchCivilizations, fetchEras, deleteNation } from '../api';
import AddNationModal from '../components/AddNationModal';
import EditNationModal from '../components/EditNationModal';

interface NationListItem {
  id: number;
  name: string;
  beginYear?: number;
  endYear?: number;
  description?: string;
  authors?: string[];
  civilization?: string;
  eras?: string[];
}

const NationListPage: React.FC = () => {
  const [nations, setNations] = useState<Nation[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [civilizations, setCivilizations] = useState<Civilization[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNation, setEditingNation] = useState<Nation | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedNations, fetchedAuthors, fetchedCivilizations, fetchedEras] = await Promise.all([
          fetchNations(),
          fetchAuthors(),
          fetchCivilizations(),
          fetchEras(),
        ]);
        setNations(fetchedNations);
        setAuthors(fetchedAuthors);
        setCivilizations(fetchedCivilizations);
        setEras(fetchedEras);
      } catch (err) {
        setError('Failed to load nations.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create lookup maps for names
  const authorMap = new Map(authors.map(author => [author.id, author.name]));
  const civilizationMap = new Map(civilizations.map(civilization => [civilization.id, civilization.name]));
  const eraMap = new Map(eras.map(era => [era.id, era.name]));

  const handleNationAdded = (nation: Nation) => {
    setNations(prevNations => [...prevNations, nation]);
  };

  const handleNationUpdated = (updatedNation: Nation) => {
    setNations(prevNations => 
      prevNations.map(nation => nation.id === updatedNation.id ? updatedNation : nation)
    );
  };

  const handleEditNation = (nation: Nation) => {
    setEditingNation(nation);
    setIsEditModalOpen(true);
  };

  const handleDeleteNation = async (id: number) => {
    try {
      await deleteNation(id);
      setNations((prevNations) => prevNations.filter((nation) => nation.id !== id));
    } catch (err) {
      setError('Failed to delete nation.');
      console.error(err);
    }
  };

  // Convert nations to display format
  const nationItems: NationListItem[] = nations.map(nation => ({
    id: nation.id,
    name: nation.name,
    beginYear: nation.beginYear,
    endYear: nation.endYear,
    description: nation.description,
    authors: nation.authorIds?.map(id => authorMap.get(id)).filter(Boolean) as string[],
    civilization: nation.civilizationId ? civilizationMap.get(nation.civilizationId) : undefined,
    eras: nation.eraIds?.map(id => eraMap.get(id)).filter(Boolean) as string[],
  })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

  if (loading) return <div>Loading nations...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Nations</h1>
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
          + Add Nation
        </button>
      </div>

      {nationItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No nations in your library yet.</p>
          <p style={{ color: '#999' }}>Click "Add Nation" to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {nationItems.map((nation) => {
            const originalNation = nations.find(n => n.id === nation.id);
            
            return (
              <div
                key={nation.id}
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
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{nation.name}</h3>
                    </div>
                    
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      {nation.beginYear && nation.endYear 
                        ? `${nation.beginYear} - ${nation.endYear}`
                        : nation.beginYear 
                        ? `from ${nation.beginYear}`
                        : nation.endYear 
                        ? `until ${nation.endYear}`
                        : ''
                      }
                      {nation.civilization && (nation.beginYear || nation.endYear) && ' • '}
                      {nation.civilization && `Civilization: ${nation.civilization}`}
                    </p>
                    
                    {nation.authors && nation.authors.length > 0 && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Authors:</strong> {nation.authors.join(', ')}
                      </p>
                    )}
                    
                    {nation.eras && nation.eras.length > 0 && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Eras:</strong> {nation.eras.join(', ')}
                      </p>
                    )}
                    
                    {nation.description && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        {nation.description}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    <button
                      onClick={() => originalNation && handleEditNation(originalNation)}
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
                      onClick={() => handleDeleteNation(nation.id)}
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

      <AddNationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNationAdded={handleNationAdded}
      />

      <EditNationModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingNation(null);
        }}
        nation={editingNation}
        onNationUpdated={handleNationUpdated}
      />
    </div>
  );
};

export default NationListPage; 