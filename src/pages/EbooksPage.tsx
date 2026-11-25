// The eBooks tab: every e-book with its price, and the Premium plans. Each e-book costs $1.99 to buy, and Premium has all of them for free.
// What the visitor owns is asked from the server (GET /api/ebooks), which is also what sends the PDF.
import { useEffect, useState } from 'react';
import { BookMarked, Check, Download, Lock, ShoppingCart } from 'lucide-react';
import AppShell from '../components/AppShell';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import PremiumCard from '../components/PremiumCard';
import { auth, authHeaders, useAuth } from '../auth';
import { getsEbooksFree } from '../utils/access';
import { EBOOKS, EBOOK_PRICE_LABEL, type EbookInfo } from '../utils/ebooks';
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

/** What the server says about the e-books: which ones the visitor may download, and for which one buying is set up. */
interface Library {
  /** null while the server has not answered yet. */
  owned: Set<string> | null;
  buyable: Set<string>;
  /** Asks the server again (used after a payment, until the purchase has arrived). */
  reload: () => void;
}

function useLibrary(signedIn: boolean, tier: string): Library {
  const [state, setState] = useState<{ owned: Set<string> | null; buyable: Set<string> }>({ owned: signedIn ? null : new Set(), buyable: new Set() });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let current = true;
    if (!signedIn) setState((was) => ({ ...was, owned: new Set() }));
    // Without an account the server cannot say what is owned, but the Buy button still needs to know if buying is open.
    fetch('/api/ebooks', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { books?: Array<{ slug?: unknown; owned?: unknown; buyable?: unknown }> } | null) => {
        if (!current) return;
        const books = (body?.books ?? []).filter((b): b is { slug: string; owned?: unknown; buyable?: unknown } => typeof b.slug === 'string');
        setState({
          owned: new Set(books.filter((b) => b.owned === true).map((b) => b.slug)),
          buyable: new Set(books.filter((b) => b.buyable === true).map((b) => b.slug)),
        });
      })
      .catch(() => current && setState((was) => ({ ...was, owned: was.owned ?? new Set() })));
    return () => {
      current = false;
    };
  }, [signedIn, tier, round]);
  return { owned: state.owned, buyable: state.buyable, reload: () => setRound((n) => n + 1) };
}

/** Asks the server for a checkout of an e-book and goes to its page. Returns an error message when that did not work. */
async function startCheckout(book: EbookInfo): Promise<string | null> {
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer: `ebook:${book.slug}` }),
    });
    const body = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
    if (res.ok && typeof body?.url === 'string') {
      window.location.assign(body.url);
      return null;
    }
    return typeof body?.error === 'string' ? body.error : 'The payment page could not be opened. Please try again.';
  } catch {
    return 'The payment page could not be opened. Check your connection and try again.';
  }
}

function BookCard({
  book,
  owned,
  buyable,
  signedIn,
  premium,
  unlocking,
}: {
  book: EbookInfo;
  owned: boolean | null;
  buyable: boolean;
  signedIn: boolean;
  premium: boolean;
  /** True just after a payment, while the purchase has not arrived yet. */
  unlocking: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    setError(await downloadEbook(book));
    setBusy(false);
  };

  const buy = async () => {
    setBusy(true);
    setError(null);
    const problem = await startCheckout(book);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
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
                unlocking ? (
                  <p data-testid="ebook-unlocking" role="status" className="text-sm font-bold text-[#39ff88]">
                    Payment received. Unlocking your e-book…
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid="ebook-buy"
                      disabled={!buyable || busy}
                      onClick={() => void buy()}
                      className={`${PRIMARY_BUTTON_CLASS} sm:w-auto sm:self-start flex items-center justify-center gap-2`}
                    >
                      {buyable ? <ShoppingCart className="w-4 h-4" aria-hidden="true" /> : <Lock className="w-4 h-4" aria-hidden="true" />}
                      {!buyable ? 'Buying opens soon' : busy ? 'Opening the payment page…' : `Buy for ${EBOOK_PRICE_LABEL}`}
                    </button>
                    {!buyable && (
                      <p data-testid="ebook-soon" className="text-sm font-medium text-white/70">
                        Premium members get every e-book for free as soon as Premium is on sale.
                      </p>
                    )}
                    {error && (
                      <p role="alert" data-testid="ebook-error" className="text-sm font-medium text-[#ffd2cc]">
                        {error}
                      </p>
                    )}
                  </>
                )
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
  const { owned, buyable, reload } = useLibrary(signedIn, tier);

  // After paying, Dodo sends the person back here (?purchase=book or ?purchase=premium, and Dodo adds status=... to the
  // address). The payment reaches the server a moment later (the webhook), so the page asks again every few seconds, for
  // half a minute, until the e-book or Premium is there. A payment that did not go through is not waited for.
  const [{ purchase, paid }] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get('purchase');
    const status = (params.get('status') ?? '').toLowerCase();
    return { purchase: kind === 'book' || kind === 'premium' ? kind : null, paid: status === '' || ['succeeded', 'active', 'processing'].includes(status) };
  });
  const [tries, setTries] = useState(0);
  const waitingForBook = purchase === 'book' && paid && signedIn && owned !== null && EBOOKS.some((book) => !owned.has(book.slug));
  const waitingForPremium = purchase === 'premium' && paid && signedIn && tier !== 'premium';
  const waiting = (waitingForBook || waitingForPremium) && tries < 12;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setTries((n) => n + 1);
      reload();
      if (waitingForPremium) void auth.refreshPlan();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [waiting, waitingForPremium, tries]);

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
        {!getsEbooksFree(tier) && <PremiumCard signedIn={signedIn} returnTo="/ebooks" unlocking={waiting && waitingForPremium} />}
        {EBOOKS.map((book) => (
          <BookCard
            key={book.slug}
            book={book}
            owned={owned === null ? null : owned.has(book.slug)}
            buyable={buyable.has(book.slug)}
            signedIn={signedIn}
            premium={getsEbooksFree(tier)}
            unlocking={waiting}
          />
        ))}
      </div>
    </AppShell>
  );
}
