import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BookListPage from './pages/BookListPage';
import AuthorListPage from './pages/AuthorListPage';
import NationListPage from './pages/NationListPage';
import CivilizationListPage from './pages/CivilizationListPage';
import EraListPage from './pages/EraListPage';
import WorldHistoryPage from './pages/WorldHistoryPage';
import KnowledgePage from './pages/KnowledgePage';
import KnowledgeDetailPage from './pages/KnowledgeDetailPage';
import TopicTreePage from './pages/TopicTreePage';
import TopicPage from './pages/TopicPage';
// Import other pages

const App: React.FC = () => {
  return (
    <Router>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8f9fa',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <nav style={{
          padding: '15px 0',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 20px',
          }}>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              gap: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <li><Link to="/" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Home</Link></li>
              <li><Link to="/knowledge" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Knowledge</Link></li>
              <li><Link to="/topics" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Topics</Link></li>
              <li><Link to="/books" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Library</Link></li>
              <li><Link to="/authors" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Authors</Link></li>
              <li><Link to="/nations" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Nations</Link></li>
              <li><Link to="/civilizations" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Civilizations</Link></li>
              <li><Link to="/eras" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>Eras</Link></li>
              <li><Link to="/world-history" style={{ textDecoration: 'none', color: '#333', fontWeight: '500', padding: '8px 12px', borderRadius: '6px', transition: 'background-color 0.2s' }}>World History</Link></li>
            </ul>
          </div>
        </nav>
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            minHeight: 'calc(100vh - 70px)', // adjust for nav height
            padding: '40px 0',
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
            <Route path="/topics" element={<TopicTreePage />} />
            <Route path="/topics/:id" element={<TopicPage />} />
            <Route path="/books" element={<BookListPage />} />
            <Route path="/authors" element={<AuthorListPage />} />
            <Route path="/nations" element={<NationListPage />} />
            <Route path="/civilizations" element={<CivilizationListPage />} />
            <Route path="/eras" element={<EraListPage />} />
            <Route path="/world-history" element={<WorldHistoryPage />} />
            {/* Define routes for BookDetail, LectureList, LectureDetail, Subject pages etc. */}
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
