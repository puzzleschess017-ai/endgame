import { useState, type FormEvent } from 'react';
import { ShieldCheck, Target, Zap } from 'lucide-react';

interface WoodpeckerIntroModalProps {
  open: boolean;
  initialUsername?: string;
  onComplete: (username: string) => void;
}

const BENEFITS = [
  { icon: Zap, label: 'RECOGNIZE PATTERNS FASTER' },
  { icon: Target, label: 'IMPROVE CALCULATION' },
  { icon: ShieldCheck, label: 'BUILD ENDGAME CONFIDENCE' },
] as const;

export default function WoodpeckerIntroModal({
  open,
  initialUsername = '',
  onComplete,
}: WoodpeckerIntroModalProps) {
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setError('Please enter your username before continuing.');
      return;
    }
    setError(null);
    onComplete(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060c17]/85 backdrop-blur-[3px] p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="woodpecker-intro-title"
    >
      <div className="w-full max-w-[620px] my-auto bg-[#101b2f] border border-white/15 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.65)] p-6 sm:p-8 text-white">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <img
            src="/assets/aistudio/Add_a_heading__16_-removebg-preview_c70fa2ca.png"
            alt="Chess Tactics Guide logo"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain select-none shrink-0"
            draggable={false}
          />
          <div className="space-y-1">
            <h2
              id="woodpecker-intro-title"
              className="text-xl sm:text-2xl font-extrabold tracking-tight text-white"
            >
              WELCOME TO CHESS TACTICS GUIDE
            </h2>
            <p className="text-sm sm:text-base font-bold tracking-wide text-[#39ff88]">
              DISCOVER THE WOODPECKER METHOD
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 text-sm sm:text-[15px] font-medium text-white/90 leading-relaxed">
          <p>
            The Woodpecker Method is a proven chess training system built around repeatedly solving
            the same collection of puzzles over multiple cycles. Instead of constantly jumping to
            unfamiliar positions, each cycle strengthens pattern recognition, deepens calculation,
            and sharpens tactical understanding.
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5">
          <h3 className="text-sm sm:text-base font-bold tracking-wide text-[#39ff88]">
            WHY USE IT FOR ENDGAMES?
          </h3>
          <p className="text-sm sm:text-[15px] font-medium text-white/90 leading-relaxed">
            Endgames demand exact calculation and instant familiarity with recurring technical
            motifs. Repeating focused endgame sets trains you to spot winning ideas and critical
            defensive resources effortlessly under pressure.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BENEFITS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5 bg-[#16233b] border border-white/10 rounded-xl p-3.5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-lg bg-[#39ff88]/15 border border-[#39ff88]/40 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#39ff88]" aria-hidden="true" />
              </div>
              <span className="text-xs sm:text-[13px] font-bold tracking-wide text-white leading-snug">
                {label}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 pt-5 border-t border-white/10 space-y-3.5">
          <div className="space-y-2">
            <label
              htmlFor="ctg-intro-username"
              className="block text-xs sm:text-sm font-bold tracking-wide text-white/90 uppercase"
            >
              Your Training Name
            </label>
            <input
              id="ctg-intro-username"
              type="text"
              required
              maxLength={32}
              autoFocus
              autoComplete="nickname"
              value={usernameInput}
              onChange={(e) => {
                setUsernameInput(e.target.value);
                if (error && e.target.value.trim()) {
                  setError(null);
                }
              }}
              placeholder="ENTER YOUR USERNAME"
              aria-invalid={Boolean(error)}
              className="w-full rounded-xl bg-[#16233b] border border-white/20 focus:border-[#39ff88] focus:ring-2 focus:ring-[#39ff88]/25 focus:outline-none px-4 py-3 text-sm sm:text-base font-bold text-white placeholder:text-white/45 placeholder:font-semibold transition-all min-h-[48px]"
            />
            {error && (
              <p
                role="alert"
                className="text-xs sm:text-sm font-semibold text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-extrabold text-base tracking-wide transition-all duration-150 shadow-[0_6px_22px_rgba(57,255,136,0.25)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
          >
            LET&apos;S GET STARTED
          </button>
        </form>
      </div>
    </div>
  );
}
