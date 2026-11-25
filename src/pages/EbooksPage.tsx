// The eBooks tab: every e-book with its price. Each costs $1.99 to buy, and Premium has all of them for free.
// What the visitor owns is asked from the server (GET /api/ebooks), which is also what sends the PDF.
import { useEffect, useState } from 'react';
import { BookMarked, Check, Download, Lock } from 'lucide-react';
import AppShell from '../components/AppShell';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import { authHeaders, useAuth } from '../auth';
import { getsEbooksFree } from '../utils/access';
import { EBOOKS, EBOOK_PRICE_LABEL, PURCHASES_OPEN, type EbookInfo } from '../utils/ebooks';
import { readSavedUsername } from '../utils/profile';

const CARD =
  'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Gets the PDF with the sign-in token and saves it. Returns an error message, or null when the download started. */
export async function downloadEbook(book: EbookInfo): Promise<string | null> {
  try {
    const res = await fetch(`/api/ebooks/${book.slug}`, { headers: authHeaders() });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      return typeof body?.error === 'string' ? body.error : 'The e-book could not be downloaded. Please try again.';
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = book.downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return null;
  } catch {
    return 'The e-book could not be downloaded. Check your connection and try again.';
  }
}

/** The slugs of the e-books the visitor may download, or null while the server has not answered yet. */
function useOwned(signedIn: boolean, tier: string): Set<string> | null {
  const [owned, setOwned] = useState<Set<string> | null>(signedIn ? null : new Set());
  useEffect(() => {
    if (!signedIn) {
      setOwned(new Set());
      return;
    }
    let current = true;
    setOwned(null);
    fetch('/api/ebooks', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { books?: Array<{ slug?: unknown; owned?: unknown }> } | null) => {
        if (!current) return;
        const slugs = (body?.books ?? []).filter((b) => b.owned === true && typeof b.slug === 'string').map((b) => b.slug as string);
        setOwned(new Set(slugs));
      })
      .catch(() => current && setOwned(new Set()));
    return () => {
      current = false;
    };
  }, [signedIn, tier]);
  return owned;
}

function BookCard({ book, owned, signedIn, premium }: { book: EbookInfo; owned: boolean | null; signedIn: boolean; premium: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    setError(await downloadEbook(book));
    setBusy(false);
  };

  return (
    <article className={`${CARD} p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:gap-6`} data-testid={`ebook-${book.slug}`}>
      <img
        src={`/covers/${book.slug}.webp`}
        alt={`Cover of ${book.title}`}
        width={240}
        height={360}
        className="w-40 sm:w-44 shrink-0 self-center sm:self-start rounded-lg border border-white/10 shadow-[0_10px_30px_rgba(4,9,20,0.5)]"
      />
      <div className="flex flex-col gap-3 min-w-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{book.title}</h2>
          <p className="mt-0.5 text-sm font-semibold text-white/70">{book.subtitle}</p>
        </div>
        <p className="text-sm font-medium text-white/80 leading-relaxed">{book.blurb}</p>
        <p className="text-xs font-bold uppercase tracking-wider text-white/55">PDF · {book.pages} pages · English</p>

        <div className="mt-1 flex flex-col gap-2.5">
          {owned ? (
            <>
              <p data-testid="ebook-owned" className="flex items-center gap-1.5 text-sm font-bold text-[#39ff88]">
                <Check className="w-4 h-4" aria-hidden="true" /> {premium ? 'Included with Premium' : 'You own this e-book'}
              </p>
              <button
                type="button"
                data-testid="ebook-download"
                onClick={() => void download()}
                disabled={busy}
                className={`${PRIMARY_BUTTON_CLASS} sm:w-auto sm:self-start flex items-center justify-center gap-2`}
              >
                <Download className="w-5 h-5" aria-hidden="true" /> {busy ? 'Downloading…' : 'Download the PDF'}
              </button>
              {error && (
                <p role="alert" data-testid="ebook-error" className="text-sm font-medium text-[#ffd2cc]">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span data-testid="ebook-price" className="text-2xl font-bold text-white tabular-nums">
                  {EBOOK_PRICE_LABEL}
                </span>
                <span className="text-sm font-bold text-amber-300">Free with Premium</span>
              </p>
              {owned === null ? (
                <p className="text-sm font-medium text-white/70">Checking your account…</p>
              ) : signedIn ? (
                <>
                  <button
                    type="button"
                    data-testid="ebook-buy"
                    disabled={!PURCHASES_OPEN}
                    className={`${PRIMARY_BUTTON_CLASS} sm:w-auto sm:self-start flex items-center justify-center gap-2`}
                  >
                    <Lock className="w-4 h-4" aria-hidden="true" />
                    {PURCHASES_OPEN ? `Buy for ${EBOOK_PRICE_LABEL}` : 'Buying opens soon'}
                  </button>
                  {!PURCHASES_OPEN && (
                    <p data-testid="ebook-soon" className="text-sm font-medium text-white/70">
                      Premium members get every e-book for free as soon as Premium is on sale.
                    </p>
                  )}
                </>
              ) : (
                <a
                  href="/login?next=%2Febooks"
                  data-testid="ebook-signin"
                  className={`${SECONDARY_BUTTON_CLASS} sm:w-auto sm:self-start px-5 flex items-center justify-center no-underline`}
                >
                  Sign in to buy or download
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** The eBooks tab: a list of e-books, each with Download (owned or Premium) or its price. */
export default function EbooksPage() {
  const { session, tier, name } = useAuth();
  const signedIn = session !== null;
  const owned = useOwned(signedIn, tier);

  useEffect(() => {
    document.title = 'Chess eBooks: The Queen’s Gambit and more | Chess Tactics Guide';
  }, []);

  return (
    <AppShell username={name || readSavedUsername()}>
      <div className="mx-auto w-full max-w-[860px] flex flex-col gap-5" data-testid="ebooks">
        <header className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-xl bg-rose-400/15 flex items-center justify-center shrink-0">
            <BookMarked className="w-6 h-6 text-rose-300" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">eBooks</h1>
            <p className="mt-1 text-[15px] font-medium text-white/75 leading-relaxed">
              Chess books with diagrams, plans, traps and exercises. {EBOOK_PRICE_LABEL} each, and every one is free with Premium.
            </p>
          </div>
        </header>
        {EBOOKS.map((book) => (
          <BookCard key={book.slug} book={book} owned={owned === null ? null : owned.has(book.slug)} signedIn={signedIn} premium={getsEbooksFree(tier)} />
        ))}
      </div>
    </AppShell>
  );
}
