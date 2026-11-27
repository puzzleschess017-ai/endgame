import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './pages/HomePage.tsx';
import BigScreenOnly from './components/BigScreenOnly.tsx';
import './index.css';
import './sync';  // keeps the results of a signed-in visitor on the account
import { initConsent } from './utils/consent';

// One page per path. Home (statistics) is the landing page and the fallback for unknown paths, so it
// is in the main bundle; every other page is loaded when it is opened, so the boards, chess rules and
// the like are not downloaded by someone who only looks at the dashboard.
/** Board Editor and Board Analysis are not for phones: there they show a short note and load nothing else. */
function bigScreenOnly(title: string, Page: ComponentType): ComponentType {
  return function BigScreenPage() {
    return (
      <BigScreenOnly title={title}>
        <Page />
      </BigScreenOnly>
    );
  };
}

const PAGES: Record<string, ComponentType> = {
  '/woodpecker': lazy(() => import('./App.tsx')),
  '/coordinates': lazy(() => import('./pages/CoordinatesPage.tsx')),
  '/streak': lazy(() => import('./pages/StreakPage.tsx')),
  '/survival': lazy(() => import('./pages/SurvivalPage.tsx')),
  '/blindfold': lazy(() => import('./pages/BlindfoldPage.tsx')),
  '/statistics': lazy(() => import('./pages/StatisticsPage.tsx')),
  '/editor': bigScreenOnly('Board Editor', lazy(() => import('./pages/EditorPage.tsx'))),
  '/analysis': bigScreenOnly('Board Analysis', lazy(() => import('./pages/AnalysisPage.tsx'))),
  // The old address of the page (the server also redirects it; this keeps an old link working in the dev server).
  '/tablebase': bigScreenOnly('Board Analysis', lazy(() => import('./pages/AnalysisPage.tsx'))),
  '/login': lazy(() => import('./pages/LoginPage.tsx')),
  '/endgames': lazy(() => import('./pages/theory/EndgameTheoryPage.tsx')),
  '/openings': lazy(() => import('./pages/theory/OpeningTheoryPage.tsx')),
  '/tactics': lazy(() => import('./pages/theory/TacticsTheoryPage.tsx')),
  '/ebooks': lazy(() => import('./pages/EbooksPage.tsx')),
  '/pricing': lazy(() => import('./pages/PricingPage.tsx')),
  '/about': lazy(() => import('./pages/legal/AboutPage.tsx')),
  '/privacy': lazy(() => import('./pages/legal/PrivacyPage.tsx')),
  '/terms': lazy(() => import('./pages/legal/TermsPage.tsx')),
  '/refunds': lazy(() => import('./pages/legal/RefundPage.tsx')),
  '/contact': lazy(() => import('./pages/legal/ContactPage.tsx')),
};

initConsent();  // Google Analytics is loaded only for a visitor who accepted cookies

const path = window.location.pathname.replace(/\/+$/, '') || '/';
// Every lesson (/endgames/<name>, /openings/<name>, /tactics/<name>) is shown by the same page as its index. An unknown name shows the index too.
const Page =
  PAGES[path] ??
  (path.startsWith('/endgames/')
    ? PAGES['/endgames']
    : path.startsWith('/openings/')
      ? PAGES['/openings']
      : path.startsWith('/tactics/')
        ? PAGES['/tactics']
        : HomePage);

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>,
);
