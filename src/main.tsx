import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './pages/HomePage.tsx';
import './index.css';

// One page per path. Home (statistics) is the landing page and the fallback for unknown paths, so it
// is in the main bundle; every other page is loaded when it is opened, so the boards, chess rules and
// the like are not downloaded by someone who only looks at the dashboard.
const PAGES: Record<string, ComponentType> = {
  '/woodpecker': lazy(() => import('./App.tsx')),
  '/coordinates': lazy(() => import('./pages/CoordinatesPage.tsx')),
  '/streak': lazy(() => import('./pages/StreakPage.tsx')),
  '/race': lazy(() => import('./pages/RacePage.tsx')),
  '/blindfold': lazy(() => import('./pages/BlindfoldPage.tsx')),
  '/statistics': lazy(() => import('./pages/StatisticsPage.tsx')),
  '/editor': lazy(() => import('./pages/EditorPage.tsx')),
  '/tablebase': lazy(() => import('./pages/TablebasePage.tsx')),
  '/login': lazy(() => import('./pages/LoginPage.tsx')),
};

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = PAGES[path] ?? HomePage;

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>,
);
