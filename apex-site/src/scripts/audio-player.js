function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function renderBars(container, heights) {
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  heights.forEach((h) => {
    const bar = document.createElement('span');
    bar.style.height = `${Math.round(Math.max(0.12, h) * 100)}%`;
    frag.appendChild(bar);
  });
  container.appendChild(frag);
}

async function loadWaveform(src, barCount) {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(buf);
    const raw = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(raw.length / barCount));
    const peaks = [];
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j] || 0);
      peaks.push(sum / blockSize);
    }
    const max = Math.max(...peaks) || 1;
    return peaks.map((p) => p / max);
  } finally {
    ctx.close();
  }
}

export function initAudioPlayer(root) {
  const audio = root.querySelector('audio');
  const toggle = root.querySelector('.play-btn');
  const waveBase = root.querySelector('.wave-base');
  const waveProgress = root.querySelector('.wave-progress');
  const wave = root.querySelector('.wave');
  const timeEl = root.querySelector('.time-current');
  const durationEl = root.querySelector('.time-duration');
  if (!audio || !toggle || !waveBase || !waveProgress || !wave) return;

  const barCount = Math.round(Math.min(56, Math.max(28, wave.clientWidth / 6)));
  const flatBars = new Array(barCount).fill(0.3);
  renderBars(waveBase, flatBars);
  renderBars(waveProgress, flatBars);

  const source = audio.querySelector('source[type="audio/mpeg"]') || audio.querySelector('source');
  if (source?.src) {
    loadWaveform(source.src, barCount)
      .then((peaks) => {
        renderBars(waveBase, peaks);
        renderBars(waveProgress, peaks);
      })
      .catch(() => {});
  }

  const updateDuration = () => {
    if (durationEl && audio.duration) durationEl.textContent = formatTime(audio.duration);
  };
  audio.addEventListener('loadedmetadata', updateDuration);
  if (audio.readyState >= 1) updateDuration();

  const setProgress = (pct) => {
    waveProgress.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    wave.setAttribute('aria-valuenow', String(Math.round(pct)));
  };

  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    setProgress(pct);
    if (timeEl) timeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('ended', () => {
    toggle.classList.remove('is-playing');
    toggle.setAttribute('aria-label', 'Play voice message');
  });

  toggle.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      toggle.classList.add('is-playing');
      toggle.setAttribute('aria-label', 'Pause voice message');
    } else {
      audio.pause();
      toggle.classList.remove('is-playing');
      toggle.setAttribute('aria-label', 'Play voice message');
    }
  });

  wave.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = wave.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  });

  wave.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    const step = audio.duration * 0.05;
    if (e.key === 'ArrowRight') {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
    } else if (e.key === 'ArrowLeft') {
      audio.currentTime = Math.max(0, audio.currentTime - step);
    } else {
      return;
    }
    e.preventDefault();
  });
}
