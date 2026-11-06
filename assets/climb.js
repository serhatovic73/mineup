// MineUp ana sayfası: kaydırmak tırmanmak demek. Dünya ve paneller birlikte aşağı kayar, karakter duvardan duvara zıplar.
// Görseller ve veri scripts/site-assets.py ile oyunun kendi kodundan üretilir.
(() => {
  const D = window.MINEUP, root = document.documentElement;
  const G = 'assets/game/';
  const lang = () => root.dataset.lang === 'tr' ? 'tr' : 'en';
  const $ = id => document.getElementById(id);

  // ---------- karakter seçimi ve mod kartları (düz akışta da çalışır) ----------
  let charIdx = 0, climber = {};
  const POSES = ['cling', 'jump'];
  const load = src => { const i = new Image(); i.src = src; return i; };
  function setClimber(id) { const next = {}; for (const p of POSES) next[p] = load(`${G}chars/${id}-${p}.webp`); climber = next; }
  const grid = $('char-grid');
  D.chars.forEach((c, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'char-cell'; b.dataset.k = k;
    b.innerHTML = `<img src="${G}chars/${c.id}-stand.webp" alt="" loading="lazy" width="400" height="400">`;
    grid.append(b);
  });
  function showChar(k, user) {
    charIdx = (k + D.chars.length) % D.chars.length;
    const c = D.chars[charIdx], t = c[lang()];
    const big = $('char-big');
    big.src = `${G}chars/${c.id}-stand.webp`; big.alt = t[0];
    big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    big.parentElement.style.setProperty('--c', c.color);
    $('char-name').textContent = t[0]; $('char-tool').textContent = t[1];
    $('char-ab').textContent = t[3] + ':'; $('char-desc').textContent = t[4];
    grid.querySelectorAll('.char-cell').forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === charIdx));
      b.setAttribute('aria-label', D.chars[i][lang()][0]);
    });
    if (user) { setClimber(c.id); grid.children[charIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  grid.addEventListener('click', e => { const b = e.target.closest('.char-cell'); if (b) showChar(+b.dataset.k, true); });
  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => showChar(charIdx + +b.dataset.step, true)));

  const modeGrid = $('mode-grid');
  function renderModes() {
    modeGrid.innerHTML = D.modes.map(m => {
      const t = m[lang()];
      const dots = Array.from({ length: 5 }, (_, j) => `<i class="${j < m.diff ? 'on' : ''}"></i>`).join('');
      return `<article class="mode" style="--c:${m.color}"><img src="${G}mode-${m.id}.webp" alt="" loading="lazy"><b>${t[0]}</b><span class="dots">${dots}</span><small>${t[1]}</small></article>`;
    }).join('');
  }
  document.addEventListener('langchange', () => { showChar(charIdx); renderModes(); updateScore(); });
  showChar(0); renderModes(); setClimber('explorer');

  // Telefonda dokunma oyuna gider; geniş ekranda oyun panelin içinde açılır
  const phonePlay = $('phone-play');
  phonePlay.addEventListener('click', e => {
    if (innerWidth < 900) return;
    e.preventDefault();
    const f = document.createElement('iframe');
    f.src = 'play/'; f.title = 'MineUp'; f.allow = 'autoplay; fullscreen';
    const ph = phonePlay.parentElement; ph.replaceChildren(f); f.focus();
  });

  // telefondaki ekran görüntüleri sırayla değişir (oyun açılınca durur)
  const SHOTS = [2, 3, 1, 4, 5].map(n => `assets/shots/${n}.jpg`);
  let shotIdx = 0;
  SHOTS.forEach(load);
  const shotTimer = setInterval(() => {
    const img = $('phone-shot');
    if (!img) { clearInterval(shotTimer); return; }
    shotIdx = (shotIdx + 1) % SHOTS.length; img.src = SHOTS[shotIdx];
  }, 2600);

  let gold = 0, topM = 0;
  function updateScore() {
    const el = $('summit-score');
    if (!gold) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = lang() === 'tr' ? `Bu sayfada ${gold} altın topladın. Sıra gerçek tırmanışta!` : `You grabbed ${gold} gold on this page. Now for the real climb!`;
  }

  if (!root.classList.contains('climb')) return;

  // ---------- sahne ----------
  const cv = $('world'), ctx = cv.getContext('2d');
  const scenes = [...document.querySelectorAll('.scene')];
  let W = 0, H = 0, DPR = 1, SPACE = 0, sMax = 1;
  let wallW = 200, wallScale = 1;
  const METERS = 1000;  // sayfa sonundaki yükseklik

  function resize() {
    const w = innerWidth, h = innerHeight;
    DPR = Math.min(devicePixelRatio || 1, w < 700 ? 2 : 1.5);
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    // mobilde adres çubuğu açılıp kapanınca kaydırma mesafesi zıplamasın
    if (w !== W || Math.abs(h - H) > 140 || !SPACE) {
      SPACE = h * 1.96;
      sMax = SPACE * (scenes.length - 1);
      $('track').style.height = sMax + h + 'px';
    }
    W = w; H = h;
    wallW = Math.max(112, Math.min(330, w * .2));
    wallScale = wallW / 320;
  }

  // paneller: orta bölgede ağır, dışında hızlı
  const SLOW = .1, DWELL = .38, FAST = 1.6;
  function panelY(d) {
    const D0 = H * DWELL, a = Math.abs(d), s = Math.sign(d);
    return a < D0 ? d * SLOW : s * (D0 * SLOW + (a - D0) * FAST);
  }

  const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`; };

  // sprite'lar
  const S = {};
  const names = ['gold', 'purple', 'blue', 'cloud', 'monkey', 'island0', 'island1', 'island2', 'island3', 'island4', 'wall-l', 'wall-r',
    'fly-bird', 'fly-crow', 'fly-bat', 'fly-bee', 'fly-eagle', 'fly-owl', 'fly-firebird', 'fly-ufo'];
  for (const n of names) S[n] = load(`${G}${n}.webp`);
  const ok = i => i && i.complete && i.naturalWidth > 0;

  // duvar kenarı: dünya y'sine göre kayanın bittiği x
  const STRIP = D.sizes['wall-l'][1];
  function stripY(worldY) {  // aynalı tekrar: 0..STRIP..0
    const per = STRIP * 2; let y = worldY % per; if (y < 0) y += per;
    return y < STRIP ? y : per - y;
  }
  function edgeAt(side, worldY) {
    const arr = side < 0 ? D.edges.l : D.edges.r;
    const y = stripY(worldY / wallScale) / 40, i = Math.min(arr.length - 1, Math.floor(y));
    const e = lerp(arr[i], arr[Math.min(arr.length - 1, i + 1)], y - i);
    return side < 0 ? e * wallW : W - wallW + e * wallW;
  }
  function drawWall(side, cam) {
    const img = S[side < 0 ? 'wall-l' : 'wall-r'];
    if (!ok(img)) return;
    const h = STRIP * wallScale, x = side < 0 ? 0 : W - wallW;
    // dünya yukarı doğru eksi; ekranda y = dünya + cam
    const first = Math.floor((-cam) / h);
    for (let k = first; k * h + cam < H; k++) {
      const y = k * h + cam;
      if (((k % 2) + 2) % 2) { ctx.save(); ctx.translate(0, y + h); ctx.scale(1, -1); ctx.drawImage(img, x, 0, wallW, h + 1); ctx.restore(); }
      else ctx.drawImage(img, x, y, wallW, h + 1);
    }
  }

  // ---------- toplanabilirler ve duvar süsleri (dünya koordinatı: yukarı eksi) ----------
  const GOLD_STEP = 150, taken = new Set(), parts = [], pops = [];
  function goldAt(k) {
    if (hash(k, 1) > .72) return null;
    const row = hash(Math.floor(k / 4), 9), wave = Math.sin(k * .9 + row * 6);
    const sMargin = wallW * .72 + 34;
    const x = lerp(sMargin, W - sMargin, clamp(row + wave * .16, 0, 1));
    return { k, x, y: -k * GOLD_STEP - 120 };
  }

  // ---------- karakter ----------
  const hero = { side: -1, air: 0, dur: .45, fromX: 0, x: 0, y: 0, hop: 0, settled: true, queued: false };
  const HOP = 420;
  function heroScale() { return clamp(W / 1200, .62, 1) * 1.05; }
  function heroBaseY() { return H * (W < 700 ? .84 : .74); }
  function clingX(side, cam) {
    const base = heroBaseY();
    const e = edgeAt(side, base - cam);
    return e - side * 8 * heroScale();  // kazma kayaya gömülür, gövde kenarın hemen önünde durur
  }
  function jump(toSide, cam) {
    hero.fromX = hero.x; hero.side = toSide; hero.air = 1e-3;
    hero.dur = clamp(Math.abs(clingX(toSide, cam) - hero.x) / 1500, .3, .62);
    if (hero.settled) dust(hero.x, hero.y);
    hero.settled = false;
  }
  function dust(x, y) {
    for (let k = 0; k < 7; k++) parts.push({ x, y: y + 10, vx: (Math.random() - .5) * 150, vy: -40 - Math.random() * 110, life: .55, c: '#d9c7b8', r: 2 + Math.random() * 3 });
  }
  function sparkle(x, y, c = '#ffe07a') {
    for (let k = 0; k < 10; k++) { const a = Math.random() * 6.3, v = 70 + Math.random() * 170; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .55, c, r: 2 + Math.random() * 3 }); }
  }
  function grab(g, screenY) {
    taken.add(g.k); gold++;
    $('hud-gold').textContent = gold; updateScore();
    sparkle(g.x, screenY);
    pops.push({ x: g.x, y: screenY, t: 0, text: '+1' });
  }

  // ---------- uçanlar ----------
  const flyers = [];
  let nextFly = 1.2;
  const ZONES = [['fly-bird', 'fly-bee'], ['fly-bird', 'fly-bee', 'fly-eagle'], ['fly-eagle', 'fly-crow', 'fly-owl'], ['fly-crow', 'fly-firebird', 'fly-bat'], ['fly-bat', 'fly-ufo', 'fly-firebird']];
  function spawnFlyer(t01) {
    const z = ZONES[Math.min(ZONES.length - 1, Math.floor(t01 * ZONES.length))];
    const kind = z[Math.floor(Math.random() * z.length)], dir = Math.random() < .5 ? 1 : -1;
    flyers.push({ kind, dir, x: dir > 0 ? wallW * .3 : W - wallW * .3, y: 80 + Math.random() * (H * .6), v: (kind === 'fly-eagle' ? 240 : kind === 'fly-ufo' ? 70 : 130) * (W < 700 ? .6 : 1), ph: Math.random() * 6 });
  }

  // ---------- çizim ----------
  let time = 0, last = 0, s = scrollY, cam = 0, confetti = [], summitDone = false;
  const SKY = [
    ['#2f74dc', '#7fc1ff', '#d8f0ff'],
    ['#3a3f9e', '#c77bb0', '#ffb38a'],
    ['#0a0f2c', '#2b2463', '#4b2c6b'],
  ];
  function drawSky(t) {
    const a = t < .55 ? 0 : 1, f = a ? (t - .55) / .45 : t / .55;
    const stop = i => mix(SKY[a][i], SKY[a + 1][i], f);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, stop(0)); g.addColorStop(.55, stop(1)); g.addColorStop(1, stop(2));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const night = clamp((t - .55) / .3, 0, 1);
    if (night > 0) {
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 110; k++) {
        const x = hash(k, 3) * W, y = ((hash(k, 4) * H * 1.4 + cam * .04) % (H * 1.4));
        ctx.globalAlpha = night * (.35 + .65 * Math.abs(Math.sin(time * 1.5 + k)));
        const r = k % 7 ? 2 : 3; ctx.fillRect(x, y, r, r);
      }
      ctx.globalAlpha = 1;
    }
    const sx = W * .76, sy = H * .13, sr = H * .62;
    const sun = ctx.createRadialGradient(sx, sy, 10, sx, sy, sr);
    sun.addColorStop(0, `rgba(255,250,220,${.42 * (1 - night)})`); sun.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  }
  function layer(fn, f, sp, salt) {  // sonsuz dikey dizi: paralaks katmanları
    const off = cam * f, k0 = Math.floor((-off - 500) / sp), k1 = Math.ceil((H + 200 - off) / sp);
    for (let k = k0; k <= k1; k++) fn(k, k * sp + off, hash(k, salt), hash(k, salt + 1));
  }
  function drawIslands(f, sp, scale, alpha, salt, night) {
    ctx.globalAlpha = alpha * (1 - night * .35);
    layer((k, y, a, b) => {
      const img = S['island' + Math.floor(b * 5)];
      if (!ok(img)) return;
      const iw = img.naturalWidth * scale * (W < 700 ? .55 : .75) * (.8 + a * .5), ih = img.naturalHeight / img.naturalWidth * iw;
      const lo = wallW * .55, x = lerp(lo, W - lo, a) + Math.sin(time * .35 + k) * 8;
      ctx.drawImage(img, x - iw / 2, y + Math.sin(time * .6 + k * 2) * 6, iw, ih);
    }, f, sp, salt);
    ctx.globalAlpha = 1;
  }
  function drawClouds(f, sp, alpha, salt) {
    const img = S.cloud; if (!ok(img)) return;
    ctx.globalAlpha = alpha;
    layer((k, y, a) => {
      const cw = (W < 700 ? 240 : 420) * (.7 + a * .6), x = a * (W + cw) - cw + Math.sin(time * .08 + k) * 40 + time * 5 * (a - .5);
      ctx.drawImage(img, x, y, cw, cw * .41);
    }, f, sp, salt);
    ctx.globalAlpha = 1;
  }
  function drawMotes() {
    for (let k = 0; k < 30; k++) {
      const sp = 10 + (k % 5) * 6, span = H + 40;
      let y = (k * 131 - time * sp + cam * .18) % span; if (y < 0) y += span; y -= 20;
      const x = (k * 97.3 * W / 540) % W + Math.sin(time * .6 + k) * 18;
      ctx.globalAlpha = .25 + .35 * (Math.sin(time * 2 + k * 1.7) * .5 + .5);
      ctx.fillStyle = k % 4 ? '#fff6d8' : '#bff0ff';
      ctx.beginPath(); ctx.arc(x, y, 1.4 + (k % 3) * .8, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawWallStuff() {  // kristaller ve maymunlar duvara bağlı
    const sp = 260, k0 = Math.floor((-cam - 200) / sp), k1 = Math.ceil((H + 200 - cam) / sp);
    const q = clamp(W / 1100, .55, 1);
    for (let k = k0; k <= k1; k++) {
      const side = hash(k, 21) < .5 ? -1 : 1, kind = hash(k, 22), wy = k * sp, y = wy + cam;
      const ex = edgeAt(side, wy);
      if (kind < .36) {
        const img = kind < .16 ? S.purple : S.blue; if (!ok(img)) continue;
        const pulse = 1 + Math.sin(time * 3 + k) * .05, ww = 74 * q * pulse, hh = ww * img.naturalHeight / img.naturalWidth;
        ctx.save(); ctx.translate(ex + side * 3, y); ctx.scale(-side, 1); ctx.drawImage(img, -8 * q, -hh / 2, ww, hh); ctx.restore();
      } else if (kind < .46 && ok(S.monkey)) {
        const ww = 58 * q, hh = ww * S.monkey.naturalHeight / S.monkey.naturalWidth, my = y + Math.sin(time * .8 + k) * 22;
        const mx = ex - side * 18 * q;
        ctx.save(); ctx.translate(mx, my); ctx.scale(side, 1); ctx.drawImage(S.monkey, -ww / 2, -hh / 2, ww, hh); ctx.restore();
      }
    }
  }
  function drawGold() {
    const img = S.gold; if (!ok(img)) return;
    const k0 = Math.floor((cam - H - 240) / GOLD_STEP), k1 = Math.ceil((cam + 200) / GOLD_STEP);
    for (let k = Math.max(0, k0); k <= k1; k++) {
      if (taken.has(k)) continue;
      const g = goldAt(k); if (!g) continue;
      const y = g.y + cam + Math.sin(time * 2.4 + k) * 5;
      if (y < 40 || y > H + 40) continue;
      const hit = Math.abs(hero.x - g.x) < 44 && Math.abs(hero.y - y) < 58;
      if (hit) { grab(g, y); continue; }
      const sx = .78 + Math.abs(Math.cos(time * 2 + k)) * .22, h = 46, w = h * img.naturalWidth / img.naturalHeight;
      ctx.save(); ctx.translate(g.x, y); ctx.scale(sx, 1); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    }
  }
  function drawFlyers(dt, t01) {
    nextFly -= dt;
    if (nextFly <= 0 && flyers.length < 4) { spawnFlyer(t01); nextFly = 2.2 + Math.random() * 3.4; }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.x += f.dir * f.v * dt; f.ph += dt * 9;
      if (f.x < -120 || f.x > W + 120) { flyers.splice(i, 1); continue; }
      const img = S[f.kind]; if (!ok(img)) continue;
      const q = (W < 700 ? .42 : .6), w = img.naturalWidth * q, h = img.naturalHeight * q, y = f.y + Math.sin(f.ph * .25) * 22;
      ctx.save(); ctx.translate(f.x, y); ctx.scale(f.dir, f.kind === 'fly-ufo' ? 1 : 1 + Math.sin(f.ph) * .07); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    }
  }
  function drawLava() {
    const y = H * .94 + cam * 1.0;
    if (y > H + 60) return;
    const glow = ctx.createLinearGradient(0, y - 200, 0, y);
    glow.addColorStop(0, 'rgba(255,90,30,0)'); glow.addColorStop(1, 'rgba(255,90,30,.5)');
    ctx.fillStyle = glow; ctx.fillRect(0, y - 200, W, 240);
    ctx.beginPath(); ctx.moveTo(0, H + 10);
    for (let x = 0; x <= W + 18; x += 18) ctx.lineTo(x, y + Math.sin(x * .025 + time * 3) * 7 + Math.sin(x * .06 - time * 2) * 4);
    ctx.lineTo(W, H + 10); ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + 200);
    g.addColorStop(0, '#ffd04a'); g.addColorStop(.15, '#ff7a1a'); g.addColorStop(1, '#a01a0a');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,240,160,.75)';
    for (let k = 0; k < 16; k++) {
      const bx = (k * 113 + time * 22) % W, by = y + 16 + (k * 37) % 70;
      ctx.beginPath(); ctx.arc(bx, by, 2.5 + (k % 3) * 2, 0, 7); ctx.fill();
    }
    // yukarı sıçrayan kıvılcımlar
    for (let k = 0; k < 18; k++) {
      const p = ((time * (.25 + (k % 5) * .06) + k * .37) % 1), x = hash(k, 77) * W;
      ctx.globalAlpha = (1 - p) * .9; ctx.fillStyle = k % 2 ? '#ffb040' : '#ffe07a';
      ctx.fillRect(x + Math.sin(time + k) * 12, y - p * 170, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  function drawHero(dt) {
    const base = heroBaseY(), target = clingX(hero.side, cam);
    let pose = 'cling', ax = 0;
    if (hero.air > 0) {
      hero.air += dt / hero.dur;
      if (hero.air >= 1) { hero.air = 0; hero.settled = true; hero.x = target; dust(target, base); }
      else {
        const t = hero.air, e = t * (2 - t);
        hero.x = lerp(hero.fromX, target, e); ax = Math.sin(t * Math.PI) * 74; pose = 'jump';
      }
    } else hero.x = target;
    hero.y = base - ax;
    const img = climber[pose] && ok(climber[pose]) ? climber[pose] : climber.cling;
    if (hero.air === 0 && hero.settled) {  // karşı duvardaki iniş halkası
      const ox = edgeAt(-hero.side, base - cam) + hero.side * 8, r = 16 + Math.sin(time * 4) * 2;
      ctx.strokeStyle = 'rgba(125,255,154,.95)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ox, base - 6, r * heroScale(), 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(125,255,154,.95)'; ctx.beginPath(); ctx.arc(ox, base - 6, 4, 0, 7); ctx.fill();
    }
    if (!ok(img)) return;
    const size = 160 * heroScale();  // 240 pikselde 160 oyun birimi
    ctx.save(); ctx.translate(hero.x, hero.y + (pose === 'cling' ? Math.sin(time * 4) * 1.4 : 0));
    // oyundaki gibi: sprite sağa bakar (sağ duvar), sol duvarda aynalanır
    ctx.scale(hero.side, 1);
    ctx.drawImage(img, -size / 2, -size * .525, size, size);
    ctx.restore();
  }
  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
      ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '26px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt; if (p.t > .8) { pops.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - p.t / .8;
      ctx.lineWidth = 6; ctx.strokeStyle = '#3a1a00'; ctx.strokeText(p.text, p.x, p.y - p.t * 70);
      ctx.fillStyle = '#ffd76a'; ctx.fillText(p.text, p.x, p.y - p.t * 70);
    }
    ctx.globalAlpha = 1;
  }
  function drawConfetti(dt) {
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]; c.life -= dt; if (c.life <= 0) { confetti.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 160 * dt; c.rot += c.vr * dt;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.globalAlpha = Math.min(1, c.life); ctx.fillStyle = c.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function positionScenes() {
    scenes.forEach((el, i) => {
      const d = s - i * SPACE, y = panelY(d);
      const on = Math.abs(y) < H * 1.05;
      if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
      if (on) el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
    });
  }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; time += dt;
    const target = clamp(scrollY, 0, sMax);
    s += (target - s) * (1 - Math.exp(-dt * 11));
    if (Math.abs(target - s) < .1) s = target;
    cam = s;
    const t01 = sMax ? s / sMax : 0, m = Math.round(t01 * METERS);
    if (m !== topM) { topM = m; $('hud-m').textContent = m; }

    positionScenes();

    // duvardan duvara: yeterince yükselince karşıya zıpla
    const hop = Math.floor(cam / HOP);
    if (hop !== hero.hop) { hero.hop = hop; if (hero.air === 0) jump(-hero.side, cam); else hero.queued = true; }
    if (hero.queued && hero.air === 0) { hero.queued = false; jump(-hero.side, cam); }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const night = clamp((t01 - .55) / .3, 0, 1);
    drawSky(t01);
    drawClouds(.1, 620, .55, 31);
    drawIslands(.22, 780, .75, .6, 41, night);
    drawClouds(.3, 760, .75, 51);
    drawIslands(.5, 980, 1.05, 1, 61, night);
    drawMotes();
    drawFlyers(dt, t01);
    drawGold();
    drawWall(-1, cam); drawWall(1, cam);
    drawWallStuff();
    drawHero(dt);
    drawParts(dt);
    drawLava();
    drawConfetti(dt);

    if (!summitDone && t01 > .985) {
      summitDone = true;
      const cols = ['#ffc531', '#c45cff', '#7fd3ff', '#ff7a2a', '#7dff9a', '#fff'];
      for (let k = 0; k < 90; k++) confetti.push({ x: W / 2, y: H * .35, vx: (Math.random() - .5) * 900, vy: -220 - Math.random() * 480, vr: (Math.random() - .5) * 12, rot: Math.random() * 6, life: 2 + Math.random() * 1.5, c: cols[k % cols.length] });
    }
    requestAnimationFrame(frame);
  }

  // gökyüzüne dokun: altını kap, boşsa karakter zıplar
  cv.addEventListener('click', e => {
    const k0 = Math.floor((cam - H - 240) / GOLD_STEP), k1 = Math.ceil((cam + 200) / GOLD_STEP);
    for (let k = Math.max(0, k0); k <= k1; k++) {
      if (taken.has(k)) continue;
      const g = goldAt(k); if (!g) continue;
      const y = g.y + cam;
      if (Math.hypot(e.clientX - g.x, e.clientY - y) < 42) { grab(g, y); return; }
    }
    if (hero.air === 0) jump(-hero.side, cam);
  });

  // bağlantılar: sahnelerin ortasına kaydır
  const goTo = id => {
    const i = scenes.findIndex(el => el.id === id);
    if (i >= 0) scrollTo({ top: i * SPACE, behavior: 'smooth' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-go]');
    if (a) { e.preventDefault(); goTo(a.dataset.go); }
  });
  // sekmeyle bir öğeye gelinince o sahneye git (gizli paneller odak almaz, görünür olanlar için)
  document.addEventListener('focusin', e => {
    const sc = e.target.closest && e.target.closest('.scene');
    if (sc) { const i = scenes.indexOf(sc); if (Math.abs(scrollY - i * SPACE) > H * .4) scrollTo({ top: i * SPACE }); }
  });

  addEventListener('resize', resize);
  resize();
  if (location.hash.length > 1) { const i = scenes.findIndex(el => el.id === location.hash.slice(1)); if (i >= 0) scrollTo(0, i * SPACE); }
  s = scrollY;
  hero.hop = Math.floor(s / HOP);
  hero.x = clingX(hero.side, s);
  requestAnimationFrame(t => { last = t; frame(t); });
})();
