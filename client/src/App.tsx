import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BookListPage from './pages/BookListPage';
// Import other pages

const App: React.FC = () => {
  return (
    <Router>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '15px' }}>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/books">Books</Link></li>
          {/* Add links for lectures, subjects, etc. */}
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BookListPage />} />
        {/* Define routes for BookDetail, LectureList, LectureDetail, Subject pages etc. */}
      </Routes>
    </Router>
  );
};

export default App;