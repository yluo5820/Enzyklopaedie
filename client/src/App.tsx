import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BookListPage from './pages/BookListPage';
import AuthorListPage from './pages/AuthorListPage';
import NationListPage from './pages/NationListPage';
import CivilizationListPage from './pages/CivilizationListPage';
import EraListPage from './pages/EraListPage';
// Import other pages

const App: React.FC = () => {
  return (
    <Router>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '15px' }}>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/books">Library</Link></li>
          <li><Link to="/authors">Authors</Link></li>
          <li><Link to="/nations">Nations</Link></li>
          <li><Link to="/civilizations">Civilizations</Link></li>
          <li><Link to="/eras">Eras</Link></li>
          {/* Add links for lectures, subjects, etc. */}
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BookListPage />} />
        <Route path="/authors" element={<AuthorListPage />} />
        <Route path="/nations" element={<NationListPage />} />
        <Route path="/civilizations" element={<CivilizationListPage />} />
        <Route path="/eras" element={<EraListPage />} />
        {/* Define routes for BookDetail, LectureList, LectureDetail, Subject pages etc. */}
      </Routes>
    </Router>
  );
};

export default App;