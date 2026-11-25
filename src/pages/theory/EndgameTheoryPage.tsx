import TheoryPage from './TheoryPage';
import { ENDGAMES } from '../../theory/endgames';

/** /endgames and /endgames/<name>. */
export default function EndgameTheoryPage() {
  return <TheoryPage collection={ENDGAMES} />;
}
