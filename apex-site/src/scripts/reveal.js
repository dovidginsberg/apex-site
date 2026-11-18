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
