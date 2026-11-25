import TheoryPage from './TheoryPage';
import { OPENINGS } from '../../theory/openings';

/** /openings and /openings/<name>. */
export default function OpeningTheoryPage() {
  return <TheoryPage collection={OPENINGS} />;
}
