import { useEffect, useState } from 'react';
import { rivalTag, type RivalFacts } from './facts';

/**
 * The curiosities ticker of the next rival (persistent under the header). The
 * facts scroll as a seamless marquee — the text is duplicated so the loop has no
 * seam, and the duration scales with length so reading speed stays constant.
 * Ported from the lab mockup; with reduced motion the facts are shown one at a
 * time (content, not movement) instead of scrolling.
 */
export function RivalTicker({ slug, name, facts }: { slug: string; name: string; facts: RivalFacts }) {
  const list = facts[slug] ?? [];
  const tag = rivalTag(slug, name);
  const reduce = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);

  // Reduced motion: step through the facts; otherwise the marquee carries them.
  useEffect(() => {
    if (!reduce || list.length <= 1) return;
    const t = setInterval(() => setIdx((i) => i + 1), 9000);
    return () => clearInterval(t);
  }, [reduce, list.length, slug]);

  let body: React.ReactNode = null;
  if (list.length > 0) {
    if (reduce) {
      body = list[idx % list.length];
    } else {
      const text = list.join('   ·   ') + '   ·   ';
      const duration = `${Math.round(text.length * 0.17)}s`;
      body = (
        <span className="tk-run" style={{ animationDuration: duration }}>
          <span>{text}</span>
          <span>{text}</span>
        </span>
      );
    }
  }

  return (
    <div className="ticker" aria-live="polite">
      <span className="ticker-tag">{tag}</span>
      <span className="ticker-txt">{body}</span>
    </div>
  );
}

/** Whether the user prefers reduced motion (false where matchMedia is unavailable). */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = (): void => setReduce(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}
