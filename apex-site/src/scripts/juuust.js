import { gsap } from 'gsap';

// The campaign line: "Just" stretches into "Juuuust" — the extra u's ease open one by one.
function stretch(word, delay = 0) {
  return gsap.fromTo(
    word.querySelectorAll('.ux'),
    { maxWidth: 0, opacity: 0 },
    { maxWidth: '0.62em', opacity: 1, duration: 0.55, ease: 'power2.inOut', stagger: 0.16, delay, clearProps: 'maxWidth' }
  );
}

export function initJuuust(root = document) {
  const words = root.querySelectorAll('[data-juuust]');
  if (!words.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  words.forEach((word, n) => {
    // Manual words wait collapsed ("Just") until something dispatches `juuust:play` on them.
    if (word.hasAttribute('data-manual')) {
      gsap.set(word.querySelectorAll('.ux'), { maxWidth: 0, opacity: 0 });
      let played = false;
      word.addEventListener('juuust:play', () => {
        if (played) return;
        played = true;
        stretch(word, 0.1);
      });
      return;
    }
    stretch(word, Number(word.dataset.delay || 0.5) + n * 0.2);
  });
}
