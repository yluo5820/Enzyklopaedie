import React from 'react';
import { BrowserRouter as Router, NavLink, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WorldHistoryPage from './pages/WorldHistoryPage';
import ItemWorkbenchPage from './pages/ItemWorkbenchPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ReferenceEntitiesPage from './pages/ReferenceEntitiesPage';
import ReferenceEntityPage from './pages/ReferenceEntityPage';
import SubjectTreePage from './pages/SubjectTreePage';
import SubjectPage from './pages/SubjectPage';
import TopicPage from './pages/TopicPage';
import './App.css';

type NavItem = {
  label: string;
  match: (pathname: string) => boolean;
  to: string;
};

const navItems: NavItem[] = [
  {
    label: 'Home',
    to: '/',
    match: (pathname) => pathname === '/',
  },
  {
    label: 'Items',
    to: '/knowledge',
    match: (pathname) => pathname.startsWith('/knowledge'),
  },
  {
    label: 'Subjects',
    to: '/subjects',
    match: (pathname) => pathname.startsWith('/subjects') || pathname.startsWith('/topics'),
  },
  {
    label: 'Entities',
    to: '/entities',
    match: (pathname) => pathname.startsWith('/entities'),
  },
  {
    label: 'World History',
    to: '/world-history',
    match: (pathname) => pathname.startsWith('/world-history'),
  },
];

const AppShell: React.FC = () => {
  const location = useLocation();
  const currentNavItem = navItems.find((item) => item.match(location.pathname)) ?? navItems[0];

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-nav-brand">
            <span className="app-nav-eyebrow">Enzyklopaedie</span>
            <strong>{currentNavItem.label}</strong>
          </div>

          <div className="app-nav-links" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={item.match(location.pathname) ? 'app-nav-link is-active' : 'app-nav-link'}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/knowledge" element={<ItemWorkbenchPage />} />
          <Route path="/knowledge/:id" element={<ItemDetailPage />} />
          <Route path="/subjects" element={<SubjectTreePage />} />
          <Route path="/subjects/:id" element={<SubjectPage />} />
          <Route path="/topics/:id" element={<TopicPage />} />
          <Route path="/entities" element={<ReferenceEntitiesPage />} />
          <Route path="/entities/:id" element={<ReferenceEntityPage />} />
          <Route path="/world-history" element={<WorldHistoryPage />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppShell />
    </Router>
  );
};

export default App;
