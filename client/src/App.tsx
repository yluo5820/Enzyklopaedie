import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, NavLink, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const WorldHistoryPage = lazy(() => import('./pages/WorldHistoryPage'));
const ItemWorkbenchPage = lazy(() => import('./pages/ItemWorkbenchPage'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
const ReferenceEntitiesPage = lazy(() => import('./pages/ReferenceEntitiesPage'));
const ReferenceEntityPage = lazy(() => import('./pages/ReferenceEntityPage'));
const SubjectTreePage = lazy(() => import('./pages/SubjectTreePage'));
const SubjectPage = lazy(() => import('./pages/SubjectPage'));
const TopicPage = lazy(() => import('./pages/TopicPage'));

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
        <Suspense
          fallback={
            <div className="app-route-loading" role="status" aria-live="polite">
              <span className="app-nav-eyebrow">Loading</span>
              <strong>Preparing this page…</strong>
            </div>
          }
        >
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
        </Suspense>
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
