import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Elements with .reveal start hidden via CSS (only when JS runs) and rise in once.
export function initReveal() {
  const els = gsap.utils.toArray('.reveal');
  if (!els.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(els, { opacity: 1, y: 0 });
    return;
  }

  ScrollTrigger.batch(els, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1, overwrite: true }),
  });
}

// Several sections pin themselves while scrolling (such as the home hero) and each
// registers from its own script, in whatever order the bundle runs them. Once everything is in,
// put the triggers back in page order and remeasure, so each pin accounts for the ones above it.
export function settleScrollTriggers() {
  const settle = () => {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };
  if (document.readyState === 'complete') requestAnimationFrame(settle);
  else window.addEventListener('load', settle, { once: true });
}
