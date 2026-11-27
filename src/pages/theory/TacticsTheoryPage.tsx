import TheoryPage from './TheoryPage';
import { TACTICS } from '../../theory/tactics';

/** /tactics and /tactics/<name>. */
export default function TacticsTheoryPage() {
  return <TheoryPage collection={TACTICS} />;
}
