import { useEffect } from 'react';
import { ArrowRight, BookOpen, Repeat } from 'lucide-react';
import AppShell from '../../components/AppShell';
import DiagramBoard from '../../components/DiagramBoard';
import { CARD_CLASS, START_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../../components/panelUi';
import {
  LESSONS,
  THEORY_BASE,
  lessonBySlug,
  lessonForPath,
  lessonPath,
  practiceHref,
  type Lesson,
} from '../../theory/endgames';

const PROSE_CLASS =
  'flex flex-col gap-4 text-[15px] font-medium leading-relaxed text-white/80 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_a]:text-[#39ff88] [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5';

const KIND_TEXT: Record<Lesson['kind'], string> = {
  Win: 'A winning position',
  Draw: 'A drawing position',
  Technique: 'A technique',
};

function setTitle(title: string) {
  document.title = `${title} | Chess Tactics Guide`;
}

function Index() {
  useEffect(() => setTitle('Chess Endgame Theory and Lessons'), []);
  return (
    <article className={`${CARD_CLASS} gap-5`} data-testid="theory-index">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Chess endgame theory</h1>
        <p className={`mt-3 ${PROSE_CLASS}`}>
          Short lessons on the endgames every player should know. Each one has diagrams, the key idea in plain words and a
          button that opens the position in the Endgame Tablebase, so you can play it against perfect defence.
        </p>
      </div>
      <ul className="flex flex-col gap-3" data-testid="lesson-list">
        {LESSONS.map((lesson) => (
          <li key={lesson.slug}>
            <a
              href={lessonPath(lesson.slug)}
              className="group flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#101b2f] p-4 no-underline hover:border-[#39ff88]/60"
              data-testid="lesson-card"
            >
              <span className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#39ff88]">{KIND_TEXT[lesson.kind]}</span>
                <span className="text-base font-bold text-white">{lesson.title}</span>
                <span className="text-sm font-medium text-white/70">{lesson.summary}</span>
              </span>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-white/50 group-hover:text-[#39ff88]" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

function LessonView({ lesson }: { lesson: Lesson }) {
  useEffect(() => setTitle(lesson.title), [lesson.title]);
  return (
    <article className={`${CARD_CLASS} gap-5`} data-testid="lesson">
      <nav aria-label="Breadcrumb" className="text-sm font-semibold text-white/60">
        <a href={THEORY_BASE} className="text-white/70 no-underline hover:text-[#39ff88]">
          Endgame theory
        </a>
        <span aria-hidden="true"> › </span>
        <span className="text-white/80">{KIND_TEXT[lesson.kind]}</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight text-white">{lesson.title}</h1>

      <div className={PROSE_CLASS}>
        {lesson.intro.map((text) => (
          <p key={text}>{text}</p>
        ))}
        {lesson.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
            {section.bullets && (
              <ul>
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
            {section.diagram && (
              <figure className="flex flex-col gap-2 my-1" data-testid="figure">
                <DiagramBoard fen={section.diagram.fen} arrows={section.diagram.arrows} />
                <figcaption className="text-sm font-semibold text-white/70 max-w-[360px]">{section.diagram.caption}</figcaption>
              </figure>
            )}
          </section>
        ))}
      </div>

      <section
        className="flex flex-col gap-3 rounded-xl border border-[#39ff88]/30 bg-[#39ff88]/5 p-4"
        aria-label="Practise this"
        data-testid="practise"
      >
        <h2 className="text-lg font-bold text-white">Practise this</h2>
        <p className="text-sm font-medium text-white/75">
          Theory sticks when you play it. Open the position in the Endgame Tablebase and try it against perfect play, or
          train endgames from real games with the Woodpecker method.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={practiceHref(lesson)} className={`${START_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline sm:flex-1`} data-testid="practise-tablebase">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {lesson.practice.label}
          </a>
          <a href="/woodpecker" className={`${SECONDARY_BUTTON_CLASS} relative flex items-center justify-center gap-2 no-underline sm:w-auto`} data-testid="practise-woodpecker">
            <Repeat className="h-4 w-4" aria-hidden="true" />
            Woodpecker endgames
            <span
              data-testid="premium-badge"
              className="pointer-events-none absolute -top-2 right-2 rounded-[4px] bg-red-600 px-1.5 py-px text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
            >
              Premium
            </span>
          </a>
        </div>
        <p className="text-xs font-medium text-white/50">The Endgame Tablebase is made for larger screens. Woodpecker endgame puzzles are part of Premium.</p>
      </section>

      <section aria-label="Read next" data-testid="related">
        <h2 className="mb-2 text-lg font-bold text-white">Read next</h2>
        <ul className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {lesson.related
            .map((slug) => lessonBySlug(slug))
            .filter((l): l is Lesson => !!l)
            .map((l) => (
              <li key={l.slug}>
                <a href={lessonPath(l.slug)} className="text-[#39ff88] underline underline-offset-2">
                  {l.title}
                </a>
              </li>
            ))}
          <li>
            <a href={THEORY_BASE} className="text-white/70 underline underline-offset-2 hover:text-[#39ff88]">
              All endgame lessons
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}

/** The index of the lessons (/endgames) and each lesson (/endgames/<name>). */
export default function EndgameTheoryPage() {
  const lesson = lessonForPath(window.location.pathname);
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[760px]">{lesson ? <LessonView lesson={lesson} /> : <Index />}</div>
    </AppShell>
  );
}
