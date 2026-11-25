// The e-book that comes with Premium (a monthly or yearly subscription), on the account page.
// Premium: a download button. Everybody else: a short note on what Premium has. The file is sent by
// /api/ebooks/<slug>, which checks the plan again on the server, so hiding the button is only for show.
import { useState } from 'react';
import { BookOpen, Download, Lock } from 'lucide-react';
import { authHeaders, useAuth } from '../auth';
import { canDownloadEbooks } from '../utils/access';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS } from './panelUi';

const SLUG = 'queens-gambit';
const FILE_NAME = 'The-Queens-Gambit-Practical-Guide.pdf';

/** Gets the PDF with the sign-in token and saves it. Returns an error message, or null when the download started. */
export async function downloadEbook(): Promise<string | null> {
  try {
    const res = await fetch(`/api/ebooks/${SLUG}`, { headers: authHeaders() });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      return typeof body?.error === 'string' ? body.error : 'The e-book could not be downloaded. Please try again.';
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return null;
  } catch {
    return 'The e-book could not be downloaded. Check your connection and try again.';
  }
}

export default function EbookCard() {
  const { tier, status } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const included = canDownloadEbooks(tier);

  const download = async () => {
    setBusy(true);
    setError(null);
    setError(await downloadEbook());
    setBusy(false);
  };

  return (
    <div className={CARD_CLASS} data-testid="ebook-card">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-amber-300/15 flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6 text-amber-300" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white tracking-tight">The Queen’s Gambit: A Practical Guide</h2>
          <p className="text-sm font-medium text-white/70">E-book, PDF, 39 pages. Included with Premium.</p>
        </div>
      </div>
      <p className="text-sm font-medium text-white/80 leading-relaxed">
        Ideas, plans, traps and exercises for the Queen’s Gambit, with every line checked by computer and every evaluation from Stockfish.
      </p>
      {included ? (
        <>
          <button
            type="button"
            data-testid="ebook-download"
            onClick={() => void download()}
            disabled={busy}
            className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
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
        <p
          data-testid="ebook-locked"
          className="flex items-start gap-2 text-sm font-medium text-white/90 bg-[#101b2f] border border-[#39ff88]/40 rounded-xl px-3.5 py-2.5"
        >
          <Lock aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 text-[#39ff88]" />
          {status === 'loading' ? 'Checking your plan…' : 'The e-book is part of Premium, with a monthly or yearly subscription.'}
        </p>
      )}
    </div>
  );
}
