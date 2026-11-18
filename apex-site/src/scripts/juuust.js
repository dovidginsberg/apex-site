import { gsap } from 'gsap';

// The campaign line: "Just" stretches into "Juuuust" — the extra u's ease open one by one.
export function initJuuust(root = document) {
  const words = root.querySelectorAll('[data-juuust]');
  if (!words.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  words.forEach((word, n) => {
    const extra = word.querySelectorAll('.ux');
    gsap.fromTo(
      extra,
      { maxWidth: 0, opacity: 0 },
      {
        maxWidth: '0.62em',
        opacity: 1,
        duration: 0.55,
        ease: 'power2.inOut',
        stagger: 0.16,
        delay: Number(word.dataset.delay || 0.5) + n * 0.2,
        clearProps: 'maxWidth',
      }
    );
  });
}
