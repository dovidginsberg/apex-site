// Single source of truth for contact details, navigation and shared content.

export const site = {
  name: 'Apex Events & Concierge',
  url: 'https://apexconcierge.co',
  email: 'daniel@apexconcierge.co',
  phone: '+18453766359',
  phoneDisplay: '(845) 376-6359',
  whatsapp: 'https://wa.me/18453766359',
};

export const nav = [
  { href: '/corporate/', label: 'Corporate' },
  { href: '/celebrations/', label: 'Celebrations' },
  { href: '/concierge/', label: 'Concierge' },
  { href: '/work/', label: 'Work' },
  { href: '/about/', label: 'About' },
];

export const testimonials = {
  sarah: {
    quote:
      'Daniel anticipated needs before we even realized them. Every guest felt personally attended to — we were completely present for our wedding because he held everything together flawlessly.',
    name: 'Sarah M.',
    event: 'Private Estate Wedding · Addison Park',
  },
  jonathan: {
    quote:
      'The level of precision was extraordinary. Our 400-person gala ran with such grace that three board members asked if we had doubled our budget. We had simply chosen Apex.',
    name: 'Jonathan R.',
    event: 'Annual Corporate Gala · Manhattan',
  },
  alyssa: {
    quote:
      "I've attended events run by the world's best planners. What sets Apex apart is the warmth — guests feel genuinely cared for, not just managed. That's rare and priceless.",
    name: 'Alyssa G.',
    event: 'Wedding · Long Island',
  },
};

export const campaign = [
  { src: '/images/campaign/jet.webp', alt: 'A hand in a dark suit adjusts a champagne flute aboard a private jet. Juuuust perfect. An Apex Standard.' },
  { src: '/images/campaign/arrival.webp', alt: 'A chauffeur checks his watch as a limousine waits at the end of a red carpet. Juuuust perfect. An Apex Standard.' },
  { src: '/images/campaign/table.webp', alt: 'Seen from above, a hand pulls out a velvet chair at a set table. Juuuust perfect. An Apex Standard.' },
  { src: '/images/campaign/glasses.webp', alt: 'A hand nudges one champagne flute into line with the rest. Juuuust perfect. An Apex Standard.' },
];

// Authentic Apex event photography and footage.
export const work = [
  { type: 'image', src: '/images/real-gala-marriott-marquis.webp', alt: 'Guests fill a ballroom of round tables beneath a crystal chandelier at an annual gala', title: 'Annual gala', cat: 'corporate', meta: 'Marriott Marquis, NYC', w: 2400, h: 1600 },
  { type: 'video', src: '/videos/hero-daniel-720.mp4', poster: '/images/hero-daniel-poster.webp', alt: 'Daniel Pearlman directing guests at an evening ceremony', title: 'Daniel on the floor', cat: 'ceremony', meta: 'Evening ceremony', w: 1920, h: 1080 },
  { type: 'image', src: '/images/real-tablescape.webp', alt: 'A long marble table set with gold-rimmed glassware, white orchids and monogrammed napkins', title: 'Marble tablescape', cat: 'reception', meta: 'Evening reception', w: 1500, h: 2000 },
  { type: 'image', src: '/images/real-ceremony-aisle.webp', alt: 'A bride walks a floral-lined garden aisle toward the chuppah', title: 'Garden chuppah', cat: 'ceremony', meta: 'Private estate ceremony', w: 1600, h: 1200 },
  { type: 'image', src: '/images/real-rose-arch-aisle.webp', alt: 'White rose arches line a ballroom aisle beneath crystal chandeliers', title: 'Rose arch aisle', cat: 'ceremony', meta: 'Ballroom ceremony', w: 1200, h: 1600 },
  { type: 'image', src: '/images/real-flower-dome-stage.webp', alt: 'A dome of white and gold florals frames a ballroom stage', title: 'Floral dome stage', cat: 'reception', meta: 'Ballroom reception', w: 1599, h: 884 },
  { type: 'image', src: '/images/philosophy-staircase.webp', alt: 'A floral chuppah under a clear-top tent surrounded by cherry blossoms', title: 'Clear-top tent', cat: 'ceremony', meta: 'Spring ceremony', w: 1600, h: 1200 },
  { type: 'video', src: '/videos/gallery-clip-2.mp4', poster: '/images/gallery-clip-2-poster.jpg', alt: 'Footage of a garden walkway reveal at a reception entrance', title: 'Garden walkway reveal', cat: 'reception', meta: 'Reception entrance', w: 960, h: 720 },
];
