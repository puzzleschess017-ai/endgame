import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import CoordinatesPage from './pages/CoordinatesPage.tsx';
import './index.css';

// One bundle, one page per path. Unknown paths show the Woodpecker trainer, as before.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = path === '/coordinates' ? CoordinatesPage : App;

createRoot(document.getElementById('root')!).render(<Page />);
