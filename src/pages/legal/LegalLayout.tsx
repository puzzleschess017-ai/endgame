import { useEffect, type ReactNode } from 'react';
import AppShell from '../../components/AppShell';
import { CARD_CLASS } from '../../components/panelUi';

interface LegalLayoutProps {
  title: string;
  /** Text of the browser tab. */
  documentTitle: string;
  children: ReactNode;
}

/** A readable column of text inside the usual menu frame, for About, Privacy and Contact. */
export default function LegalLayout({ title, documentTitle, children }: LegalLayoutProps) {
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[760px]">
        <article className={`${CARD_CLASS} gap-5`}>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          <div className="flex flex-col gap-4 text-[15px] font-medium leading-relaxed text-white/80 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_a]:text-[#39ff88] [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
            {children}
          </div>
        </article>
      </div>
    </AppShell>
  );
}
