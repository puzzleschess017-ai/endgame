import { ChevronDown } from 'lucide-react';

/**
 * "What is the Woodpecker method?" for the setup panel. Closed it is one line, so the Start button stays on the
 * screen; a visitor who does not know the method opens it and reads three short paragraphs. The longer version is
 * on the About page.
 */
export default function WoodpeckerExplainer() {
  return (
    <details className="group mt-1.5" data-testid="woodpecker-explainer">
      <summary className="inline-flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[13px] font-semibold text-accent hover:underline underline-offset-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        What is the Woodpecker method?
        <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-xl bg-inset border border-white/10 p-3 text-[13px] font-medium leading-snug text-white/80">
        <p>
          A training idea from Hans Tikkanen and Axel Smith (book: <em>The Woodpecker Method</em>, 2018). You take one
          fixed set of puzzles and solve the same set again and again. Each round, called a cycle, you try to be faster
          than the last one without making more mistakes.
        </p>
        <p>
          Seeing the same positions over and over turns the patterns into habit, so you spot them at a glance in your
          own games.
        </p>
        <p>
          Here you choose how many puzzles and how many cycles. Your time and accuracy are tracked for every cycle, so
          you can watch your time fall.{' '}
          <a href="/about" className="text-accent underline underline-offset-2">
            Read more
          </a>
        </p>
      </div>
    </details>
  );
}
