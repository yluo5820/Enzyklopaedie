import React, { useEffect, useState } from 'react';
import { Author, Subject, Nation } from '@enzyklopaedie/shared';
import { fetchAuthors, fetchSubjects, fetchNations, deleteAuthor } from '../api';
import AddAuthorModal from '../components/AddAuthorModal';
import EditAuthorModal from '../components/EditAuthorModal';

interface AuthorListItem {
  id: number;
  name: string;
  yearOfBirth?: number;
  yearOfDeath?: number;
  country?: string;
  description?: string;
  subjects?: string[];
}

const AuthorListPage: React.FC = () => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedAuthors, fetchedSubjects, fetchedNations] = await Promise.all([
          fetchAuthors(),
          fetchSubjects(),
          fetchNations(),
        ]);
        setAuthors(fetchedAuthors);
        setSubjects(fetchedSubjects);
        setNations(fetchedNations);
      } catch (err) {
        setError('Failed to load authors.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create lookup maps for names
  const subjectMap = new Map(subjects.map(subject => [subject.id, subject.name]));
  const nationMap = new Map(nations.map(nation => [nation.id, nation.name]));

  const handleAuthorAdded = (author: Author) => {
    setAuthors(prevAuthors => [...prevAuthors, author]);
  };

  const handleAuthorUpdated = (updatedAuthor: Author) => {
    setAuthors(prevAuthors => 
      prevAuthors.map(author => author.id === updatedAuthor.id ? updatedAuthor : author)
    );
  };

  const handleEditAuthor = (author: Author) => {
    setEditingAuthor(author);
    setIsEditModalOpen(true);
  };

  const handleDeleteAuthor = async (id: number) => {
    try {
      await deleteAuthor(id);
      setAuthors((prevAuthors) => prevAuthors.filter((author) => author.id !== id));
    } catch (err) {
      setError('Failed to delete author.');
      console.error(err);
    }
  };

  // Convert authors to display format
  const authorItems: AuthorListItem[] = authors.map(author => ({
    id: author.id,
    name: author.name,
    yearOfBirth: author.yearOfBirth,
    yearOfDeath: author.yearOfDeath,
    country: author.countryId ? nationMap.get(author.countryId) : undefined,
    description: author.description,
    subjects: author.subjectIds?.map(id => subjectMap.get(id)).filter(Boolean) as string[],
  })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

  if (loading) return <div>Loading authors...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Authors</h1>
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
          + Add Author
        </button>
      </div>

      {authorItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No authors in your library yet.</p>
          <p style={{ color: '#999' }}>Click "Add Author" to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {authorItems.map((author) => {
            const originalAuthor = authors.find(a => a.id === author.id);
            
            return (
              <div
                key={author.id}
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
                        👤
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{author.name}</h3>
                    </div>
                    
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      {author.yearOfBirth && author.yearOfDeath 
                        ? `${author.yearOfBirth} - ${author.yearOfDeath}`
                        : author.yearOfBirth 
                        ? `b. ${author.yearOfBirth}`
                        : author.yearOfDeath 
                        ? `d. ${author.yearOfDeath}`
                        : ''
                      }
                      {author.country && (author.yearOfBirth || author.yearOfDeath) && ' • '}
                      {author.country && author.country}
                    </p>
                    
                    {author.subjects && author.subjects.length > 0 && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Subjects:</strong> {author.subjects.join(', ')}
                      </p>
                    )}
                    
                    {author.description && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        {author.description}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                    <button
                      onClick={() => originalAuthor && handleEditAuthor(originalAuthor)}
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
                      onClick={() => handleDeleteAuthor(author.id)}
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

      <AddAuthorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAuthorAdded={handleAuthorAdded}
      />

      <EditAuthorModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingAuthor(null);
        }}
        author={editingAuthor}
        onAuthorUpdated={handleAuthorUpdated}
      />
    </div>
  );
};

export default AuthorListPage; 