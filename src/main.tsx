import {createRoot} from 'react-dom/client';
import AnalysisPage from './pages/AnalysisPage.tsx';
import App from './App.tsx';
import CoordinatesPage from './pages/CoordinatesPage.tsx';
import EditorPage from './pages/EditorPage.tsx';
import BlindfoldPage from './pages/BlindfoldPage.tsx';
import HomePage from './pages/HomePage.tsx';
import RacePage from './pages/RacePage.tsx';
import StatisticsPage from './pages/StatisticsPage.tsx';
import StreakPage from './pages/StreakPage.tsx';
import './index.css';

// One bundle, one page per path. Home (statistics) is the landing page and the fallback for unknown paths.
const PAGES: Record<string, () => React.JSX.Element> = {
  '/woodpecker': App,
  '/coordinates': CoordinatesPage,
  '/streak': StreakPage,
  '/race': RacePage,
  '/blindfold': BlindfoldPage,
  '/statistics': StatisticsPage,
  '/editor': EditorPage,
  '/analysis': AnalysisPage,
};

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = PAGES[path] ?? HomePage;

createRoot(document.getElementById('root')!).render(<Page />);
