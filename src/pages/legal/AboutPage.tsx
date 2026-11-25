import LegalLayout from './LegalLayout';

export default function AboutPage() {
  return (
    <LegalLayout title="About Chess Tactics Guide" documentTitle="About | Chess Tactics Guide">
      <p>
        Chess Tactics Guide is a free place to train chess. It started with one idea, the Woodpecker method:
        solve the same set of endgame puzzles again and again, a little faster every cycle, until the patterns
        become automatic.
      </p>
      <h2>What you can do here</h2>
      <ul>
        <li>
          <a href="/woodpecker">Woodpecker</a>: choose a set of puzzles and repeat it in cycles. Your time and
          accuracy are tracked per cycle.
        </li>
        <li>
          <a href="/streak">Puzzle Streak</a> and <a href="/race">Puzzle Race</a>: puzzles that get harder one by
          one, or as many as you can solve against the clock.
        </li>
        <li>
          <a href="/blindfold">Blindfold</a>: memorize a position, then find the checkmate without seeing the
          pieces, plus short memory drills.
        </li>
        <li>
          <a href="/coordinates">Coordinate Training</a>, the <a href="/editor">Board Editor</a> and the{' '}
          <a href="/analysis">Board Analysis</a> (check any position with the Stockfish engine).
        </li>
        <li>
          Short lessons with diagrams: <a href="/endgames">endgame theory</a> and{' '}
          <a href="/openings">opening theory</a>, each with a button that opens the position in Board Analysis.
        </li>
      </ul>
      <h2>Where the puzzles come from</h2>
      <p>
        The puzzles come from the open <a href="https://database.lichess.org/#puzzles">Lichess puzzle database</a>,
        which is released under the CC0 licence. Thank
        you to Lichess and its community for making this possible.
      </p>
      <h2>Accounts</h2>
      <p>
        Everything works without an account, and your results stay in your browser. A free account keeps your
        results on every device and unlocks more training options. Some of the more advanced options are reserved
        for Premium, a monthly or yearly subscription that also includes every e-book.
      </p>
      <p>
        Questions, ideas or a bug to report? See the <a href="/contact">Contact</a> page. How your data is handled
        is explained on the <a href="/privacy">Privacy</a> page.
      </p>
    </LegalLayout>
  );
}
