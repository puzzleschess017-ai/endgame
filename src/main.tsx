import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import CoordinatesPage from './pages/CoordinatesPage.tsx';
import RacePage from './pages/RacePage.tsx';
import StreakPage from './pages/StreakPage.tsx';
import './index.css';

// One bundle, one page per path. Unknown paths show the Woodpecker trainer, as before.
const PAGES: Record<string, () => React.JSX.Element> = {
  '/coordinates': CoordinatesPage,
  '/streak': StreakPage,
  '/race': RacePage,
};

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = PAGES[path] ?? App;

createRoot(document.getElementById('root')!).render(<Page />);
