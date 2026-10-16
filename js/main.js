(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- scroll: progress bar + nav ---------- */
  const bar = $('.progress'), nav = $('.nav');
  let lastY = 0, ticking = false;
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('solid', y > 40);
    nav.classList.toggle('hide', y > lastY + 4 && y > 400);
    if (y < lastY - 4) nav.classList.remove('hide');
    lastY = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  const targets = $$('[data-reveal],[data-stagger],[data-line]');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(t => t.classList.add('in', 'settled'));
  } else {
    $$('[data-stagger]').forEach(g => $$('.chip', g).forEach((c, i) => c.style.transitionDelay = `${i * 45}ms,${i * 45}ms,0s,0s,0s`));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const t = e.target;
      t.classList.add('in');
      if (t.hasAttribute('data-tilt')) setTimeout(() => t.classList.add('settled'), 1300);
      io.unobserve(t);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    targets.forEach(t => io.observe(t));
  }

  /* ---------- hero name scramble ---------- */
  const glyphs = '!<>-_\\/[]{}=+*^?#01';
  const scramble = (el, delay) => {
    const final = el.textContent, n = final.length, start = performance.now() + delay;
    const dur = 900;
    const frame = now => {
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      let out = '';
      for (let i = 0; i < n; i++) {
        const c = final[i];
        out += c === ' ' || p >= (i + 1) / n ? c : glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
    };
    requestAnimationFrame(frame);
    setTimeout(() => { el.textContent = final; }, delay + dur + 400);
  };
  if (!reduce) $$('[data-scramble]').forEach((el, i) => scramble(el, 150 + i * 350));

  /* ---------- terminal typing ---------- */
  const term = $('#term');
  if (term && !reduce) {
    const rows = $$('p', term);
    const cmds = $$('.cmd', term).map(c => { const t = c.textContent; c.textContent = ''; return t; });
    rows.forEach(r => r.style.visibility = 'hidden');
    const caret = $('.caret', term); caret.style.display = 'none';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      await sleep(700);
      let ci = 0;
      for (const r of rows) {
        r.style.visibility = 'visible';
        const c = $('.cmd', r);
        if (c) {
          const txt = cmds[ci++];
          for (let i = 1; i <= txt.length; i++) { c.textContent = txt.slice(0, i); await sleep(45 + Math.random() * 40); }
          await sleep(260);
        } else { await sleep(180); }
      }
      caret.style.display = '';
    })();
  }

  /* ---------- tilt + magnetic (fine pointers only) ---------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach(el => {
      let raf = 0;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { el.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateZ(0) scale(1.02)`; });
      });
      el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.style.transform = ''; });
    });
    $$('.mag').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    /* cursor spotlight (compositor-only transform) */
    const spot = $('.spot'); let mx = -999, my = -999, sraf = 0;
    addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!sraf) sraf = requestAnimationFrame(() => { spot.style.transform = `translate3d(${mx}px,${my}px,0)`; sraf = 0; });
    }, { passive: true });
  }

  /* ---------- lightbox ---------- */
  if (typeof HTMLDialogElement === 'function') {
    const dlg = document.createElement('dialog'); dlg.className = 'lb';
    dlg.innerHTML = '<img alt=""><button type="button" aria-label="Close">×</button>';
    document.body.appendChild(dlg);
    const big = $('img', dlg);
    document.addEventListener('click', e => {
      const card = e.target.closest && e.target.closest('.shot');
      const im = card && $('img', card);
      if (!im || !im.complete || !im.naturalWidth) return;
      big.src = im.currentSrc || im.src; big.alt = im.alt; dlg.showModal();
    });
    dlg.addEventListener('click', () => dlg.close());
  }

  /* ---------- particle network (paused when hidden / off-screen) ---------- */
  const cv = $('#net');
  if (cv && !reduce) {
    const ctx = cv.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = 1, pts = [], run = true, px = -999, py = -999;
    const LINK = 130;
    const init = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(70, Math.floor(w * h / 20000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, c: Math.random() < .7 ? '62,242,220' : '168,85,247' }));
    };
    const step = () => {
      if (!run) return;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        const dx = a.x - px, dy = a.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { const f = (1 - d2 / 14000) * .6; a.x += dx * f * .05; a.y += dy * f * .05; }
        ctx.fillStyle = `rgba(${a.c},.9)`;
        ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], ex = a.x - b.x, ey = a.y - b.y, e2 = ex * ex + ey * ey;
          if (e2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(${a.c},${(1 - Math.sqrt(e2) / LINK) * .35})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (d2 < 24000) {
          ctx.strokeStyle = `rgba(255,210,63,${(1 - d2 / 24000) * .5})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(px, py); ctx.stroke();
        }
      }
      requestAnimationFrame(step);
    };
    const toggle = on => { if (on && !run) { run = true; requestAnimationFrame(step); } else if (!on) run = false; };
    init();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(init, 200); });
    addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
    document.addEventListener('visibilitychange', () => toggle(!document.hidden));
    requestAnimationFrame(step);
  }
})();
