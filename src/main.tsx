import { Component, lazy, startTransition, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './pages/HomePage.tsx';
import BigScreenOnly from './components/BigScreenOnly.tsx';
import './index.css';
import './sync';  // keeps the results of a signed-in visitor on the account
import { initConsent } from './utils/consent';
import { internalTarget, isChunkError, LESSON_BASES, normalizePath } from './utils/navigation.ts';

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

/** The page for an address. Every lesson (/endgames/<name>, /openings/<name>, /tactics/<name>) is shown by the page of its index; an unknown address shows Home (the server answers it with 404). */
function pageFor(pathname: string): ComponentType {
  const path = normalizePath(pathname);
  const base = LESSON_BASES.find((b) => path.startsWith(`${b}/`));
  return PAGES[path] ?? (base ? PAGES[base] : HomePage);
}

function currentLocation() {
  return { path: normalizePath(window.location.pathname), search: window.location.search };
}

const RELOADED_KEY = 'ctg_chunk_reload';

/**
 * When a page file cannot be loaded (typically a tab that was open before a deploy: the old files are gone), load the
 * site again once, which fetches the new page and its files. Other errors are left alone.
 */
class ReloadOnChunkError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (!isChunkError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
      if (Date.now() - last < 10_000) return; // already tried a moment ago: no reload loop
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
      window.location.reload();
    } catch {
      // no storage: do nothing rather than risk a loop
    }
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Shows the page of the address and changes it without loading the site again when the visitor clicks a link to
 * another page (see src/utils/navigation.ts). The change is a transition, so the old page stays on the screen until
 * the new one (and its files) is ready: no blank screen between two tabs. The new page is mounted from scratch, as if
 * it had been loaded, so no page has to know it was reached by a click.
 */
function App() {
  const [where, setWhere] = useState(currentLocation);
  const first = useRef(true);

  useEffect(() => {
    const show = () => startTransition(() => setWhere(currentLocation()));
    const pages = Object.keys(PAGES);
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = internalTarget(event, { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute('download') }, window.location, pages);
      if (!target) return;
      event.preventDefault();
      const now = window.location.pathname + window.location.search + window.location.hash;
      if (target !== now) window.history.pushState(null, '', target);
      show();
    };
    window.addEventListener('popstate', show);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', show);
      document.removeEventListener('click', onClick);
    };
  }, []);

  // A new page starts at the top (the first one is already there).
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [where.path, where.search]);

  const Page = pageFor(where.path);
  return (
    <ReloadOnChunkError>
      <Suspense fallback={null}>
        <Page key={where.path + where.search} />
      </Suspense>
    </ReloadOnChunkError>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
