import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initReveal() {
  const els = gsap.utils.toArray('.reveal');
  if (!els.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.set(els, { autoAlpha: 0, y: 24 });

  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        overwrite: true,
      }),
  });
}
