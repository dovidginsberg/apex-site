import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initCountUp(selector = '.n[data-count]') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll(selector).forEach((el) => {
    const target = Number(el.dataset.count);
    if (!target) return;
    const suffix = el.dataset.suffix || '';
    const counter = { val: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter() {
        gsap.to(counter, {
          val: target,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate() {
            el.textContent = Math.round(counter.val) + suffix;
          },
        });
      },
    });
  });
}
