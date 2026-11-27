import LegalLayout from './LegalLayout';

export default function AboutPage() {
  return (
    <LegalLayout title="About Chess Tactics Guide" documentTitle="About | Chess Tactics Guide">
      <p>
        Chess Tactics Guide is a free place to train chess. It started with one idea, the Woodpecker method:
        solve the same set of endgame puzzles again and again, a little faster every cycle, until the patterns
        become automatic.
      </p>
      <h2 id="woodpecker-method">What is the Woodpecker method?</h2>
      <p>
        The Woodpecker method trains chess by repetition. It was developed by the Swedish chess player Hans Tikkanen
        and described by him and Axel Smith in their book <em>The Woodpecker Method</em> (2018). The name comes from
        the bird that keeps hitting the same spot.
      </p>
      <ol>
        <li>Take one fixed set of puzzles.</li>
        <li>Solve all of them carefully and note how long it took and how many you got right.</li>
        <li>Solve the same set again. That is the next cycle: try to be faster without making more mistakes.</li>
        <li>
          Keep going for several cycles. The positions become familiar and you start to see the patterns at a glance.
        </li>
      </ol>
      <p>
        The idea is that the patterns stay with you, so you find the right idea faster in your own games. On this
        site you choose how many puzzles and how many cycles, and your time and accuracy are tracked in every cycle.
        After a cycle you can review the puzzles you missed or solved slowest. The puzzles come from the Lichess
        database, either endgames only or of every kind.
      </p>
      <p>
        Chess Tactics Guide is an independent site and is not affiliated with the authors or the publisher of the
        book, which explains the method in far more depth.
      </p>
      <h2>What you can do here</h2>
      <ul>
        <li>
          <a href="/woodpecker">Woodpecker</a>: choose a set of puzzles and repeat it in cycles. Your time and
          accuracy are tracked per cycle.
        </li>
        <li>
          <a href="/streak">Puzzle Streak</a> and <a href="/survival">Puzzle Survival</a>: puzzles that get harder one by
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
          Short lessons with diagrams: <a href="/endgames">endgame theory</a>, <a href="/openings">opening theory</a> and{' '}
          <a href="/tactics">tactics</a>, each with a button that opens the position in Board Analysis.
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
