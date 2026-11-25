import { useEffect } from 'react';
import { ArrowRight, BookOpen, Repeat } from 'lucide-react';
import AppShell from '../../components/AppShell';
import DiagramBoard from '../../components/DiagramBoard';
import { CARD_CLASS, START_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../../components/panelUi';
import { practiceHref } from '../../theory/endgames';
import type { Lesson, TheoryCollection } from '../../theory/types';

const PROSE_CLASS =
  'flex flex-col gap-4 text-[15px] font-medium leading-relaxed text-white/80 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_a]:text-[#39ff88] [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5';

const KIND_TEXT: Record<Lesson['kind'], string> = {
  Win: 'A winning position',
  Draw: 'A drawing position',
  Technique: 'A technique',
  Opening: 'An opening',
  Defence: 'A defence',
  Principles: 'The basics',
};

function setTitle(title: string) {
  document.title = `${title} | Chess Tactics Guide`;
}

function LessonCard({ lesson, collection }: { lesson: Lesson; collection: TheoryCollection }) {
  const preview = lesson.sections.find((section) => section.diagram)?.diagram;
  return (
    <a
      href={collection.pathFor(lesson.slug)}
      className="group flex h-full flex-col gap-3 rounded-xl border border-white/10 bg-[#101b2f] p-3 no-underline transition-colors hover:border-[#39ff88]/60 focus-visible:outline-2 focus-visible:outline-[#39ff88]"
      data-testid="lesson-card"
    >
      {preview && (
        <div className="pointer-events-none flex justify-center" aria-hidden="true">
          <DiagramBoard fen={preview.fen} label="" />
        </div>
      )}
      <span className="flex flex-1 flex-col gap-1 px-1 pb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-[#39ff88]">{KIND_TEXT[lesson.kind]}</span>
        <span className="text-base font-bold leading-snug text-white">{lesson.title}</span>
        <span className="text-sm font-medium leading-snug text-white/70">{lesson.summary}</span>
        <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-bold text-white/60 group-hover:text-[#39ff88]">
          Read the lesson
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </a>
  );
}

function Index({ collection }: { collection: TheoryCollection }) {
  useEffect(() => setTitle(collection.index.title), [collection.index.title]);
  return (
    <article className={`${CARD_CLASS} gap-6`} data-testid="theory-index">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{collection.index.heading}</h1>
        <p className={`mt-3 max-w-[720px] ${PROSE_CLASS}`}>{collection.index.intro}</p>
      </div>
      {collection.groups.map((group) => {
        const lessons = collection.lessons.filter((lesson) => lesson.group === group);
        if (lessons.length === 0) return null;
        return (
          <section key={group} aria-label={group} className="flex flex-col gap-3" data-testid="lesson-group">
            <h2 className="text-lg font-bold text-white">{group}</h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(215px,1fr))] gap-4" data-testid="lesson-list">
              {lessons.map((lesson) => (
                <li key={lesson.slug}>
                  <LessonCard lesson={lesson} collection={collection} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}

function LessonView({ lesson, collection }: { lesson: Lesson; collection: TheoryCollection }) {
  useEffect(() => setTitle(lesson.title), [lesson.title]);
  return (
    <article className={`${CARD_CLASS} gap-5`} data-testid="lesson">
      <nav aria-label="Breadcrumb" className="text-sm font-semibold text-white/60">
        <a href={collection.base} className="text-white/70 no-underline hover:text-[#39ff88]">
          {collection.name}
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
        <p className="text-sm font-medium text-white/75">{collection.practiceText}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={practiceHref(lesson)} className={`${START_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline sm:flex-1`} data-testid="practise-analysis">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {lesson.practice.label}
          </a>
          {collection.woodpecker && (
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
          )}
        </div>
        <p className="text-xs font-medium text-white/50">
          Board Analysis is made for larger screens.{' '}
          {collection.woodpecker ? 'The engine is free with an account; Woodpecker endgame puzzles are part of Premium.' : 'The engine is free with an account.'}
        </p>
      </section>

      <section aria-label="Read next" data-testid="related">
        <h2 className="mb-2 text-lg font-bold text-white">Read next</h2>
        <ul className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {lesson.related
            .map((slug) => collection.bySlug(slug))
            .filter((l): l is Lesson => !!l)
            .map((l) => (
              <li key={l.slug}>
                <a href={collection.pathFor(l.slug)} className="text-[#39ff88] underline underline-offset-2">
                  {l.title}
                </a>
              </li>
            ))}
          <li>
            <a href={collection.base} className="text-white/70 underline underline-offset-2 hover:text-[#39ff88]">
              {collection.allLabel}
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}

/** The index of a collection (/endgames, /openings) and each of its lessons (/endgames/<name>). */
export default function TheoryPage({ collection }: { collection: TheoryCollection }) {
  const lesson = collection.forPath(window.location.pathname);
  return (
    <AppShell>
      <div className={`mx-auto w-full ${lesson ? 'max-w-[760px]' : 'max-w-[1080px]'}`}>
        {lesson ? <LessonView lesson={lesson} collection={collection} /> : <Index collection={collection} />}
      </div>
    </AppShell>
  );
}
