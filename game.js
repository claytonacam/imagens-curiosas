'use strict';
// =====================================================================
//  TRETA NO PLANALTO — jogo de luta 2D estilo arcade (paródia)
// =====================================================================
const W = 960, H = 540, GROUND = 468, TAU = Math.PI * 2;
const FONT = "'Bangers', Impact, 'Arial Black', sans-serif";
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');

// ---------------------------------------------------------------------
//  Personagens
// ---------------------------------------------------------------------
const CHARS = {
  bolsonaro: {
    key: 'bolsonaro', name: 'BOLSONARO',
    suit: '#1f3b6e', pants: '#1a2f57', shirt: '#ffffff', tie: '#0b7a35',
    skin: '#f1c6a5', hair: '#2f2f33', accent: '#ffdf00', glow: '#2bd66b',
    projName: 'ARMINHA!', superName: 'MOTOCIATA!',
    quotes: ['Talkey?', 'Missão dada é missão cumprida!', 'Selva!'],
    imgBase: 'img/bolsonaro', img: null,
  },
  lula: {
    key: 'lula', name: 'LULA',
    suit: '#2b2b30', pants: '#222226', shirt: '#ffffff', tie: '#d0021b',
    skin: '#e6b38e', hair: '#c9c9c9', beard: '#d6d6d6', accent: '#ff3030', glow: '#ff5a3c',
    projName: 'ESTRELA!', superName: 'FAZ O L!',
    quotes: ['Companheiro, perdeu!', 'Picanha pra todo mundo!', 'Nunca antes na história desse país!'],
    imgBase: 'img/lula', img: null,
  },
};

// ---------------------------------------------------------------------
//  Fotos (img/<nome>.png|jpg|jpeg|webp ou upload salvo no navegador)
// ---------------------------------------------------------------------
function squareCrop(img) {
  // recorta um quadrado centralizado (um pouco para cima em retratos verticais)
  const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
  return { sx: (w - s) / 2, sy: h > w ? (h - s) * 0.22 : 0, s };
}
function loadCharImage(k) {
  const c = CHARS[k];
  let saved = null;
  try { saved = localStorage.getItem('treta-img-' + k); } catch (e) { /* sem storage */ }
  if (saved) {
    const im = new Image();
    im.onload = () => { c.img = im; };
    im.src = saved;
    return;
  }
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  let i = 0;
  const tryNext = () => {
    if (i >= exts.length) return;
    const im = new Image();
    im.onload = () => { c.img = im; };
    im.onerror = tryNext;
    im.src = c.imgBase + '.' + exts[i++];
  };
  tryNext();
}
Object.keys(CHARS).forEach(loadCharImage);

document.querySelectorAll('input[type=file][data-char]').forEach(inp => {
  inp.addEventListener('change', () => {
    const file = inp.files && inp.files[0];
    const k = inp.dataset.char;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = new Image();
      raw.onload = () => {
        // reduz para 256x256 para caber no localStorage
        const oc = document.createElement('canvas');
        oc.width = oc.height = 256;
        const { sx, sy, s } = squareCrop(raw);
        oc.getContext('2d').drawImage(raw, sx, sy, s, s, 0, 0, 256, 256);
        const url = oc.toDataURL('image/jpeg', 0.9);
        const im = new Image();
        im.onload = () => { CHARS[k].img = im; };
        im.src = url;
        try { localStorage.setItem('treta-img-' + k, url); } catch (e) { /* ok */ }
      };
      raw.src = reader.result;
    };
    reader.readAsDataURL(file);
    inp.value = '';
  });
});
document.querySelectorAll('button[data-clear]').forEach(b => {
  b.addEventListener('click', () => {
    const k = b.dataset.clear;
    CHARS[k].img = null;
    try { localStorage.removeItem('treta-img-' + k); } catch (e) { /* ok */ }
  });
});

// ---------------------------------------------------------------------
//  Som (WebAudio sintetizado)
// ---------------------------------------------------------------------
let actx = null, muted = false;
function initAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    else if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function tone(freq, dur, type, vol, toFreq) {
  if (!actx || muted) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol, freq) {
  if (!actx || muted) return;
  const t = actx.currentTime, len = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(actx.destination); src.start(t);
}
function sfx(n) {
  switch (n) {
    case 'punch': noise(0.09, 0.5, 1400); tone(140, 0.08, 'square', 0.12, 60); break;
    case 'kick': noise(0.14, 0.6, 900); tone(100, 0.12, 'square', 0.15, 45); break;
    case 'whiff': noise(0.06, 0.12, 3000); break;
    case 'block': tone(1100, 0.05, 'square', 0.08); noise(0.04, 0.2, 4000); break;
    case 'special': tone(260, 0.3, 'sawtooth', 0.12, 900); break;
    case 'super': tone(120, 0.7, 'sawtooth', 0.16, 1400); tone(180, 0.7, 'square', 0.06, 1800); break;
    case 'ko': tone(500, 1.1, 'triangle', 0.25, 50); noise(0.5, 0.4, 600); break;
    case 'select': tone(660, 0.06, 'square', 0.08); break;
    case 'start': tone(440, 0.1, 'square', 0.1); setTimeout(() => tone(880, 0.2, 'square', 0.1), 100); break;
    case 'jump': tone(300, 0.08, 'sine', 0.06, 500); break;
  }
}

// ---------------------------------------------------------------------
//  Entrada
// ---------------------------------------------------------------------
const keys = {}, prev = {};
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter']);
addEventListener('keydown', e => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys[e.code] = true;
  initAudio();
  if (e.code === 'KeyM') muted = !muted;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const down = c => !!keys[c];
const pressed = c => !!keys[c] && !prev[c];
const anyDown = list => list.some(down);
const anyPressed = list => list.some(pressed);

const MAP = {
  p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], punch: ['KeyF'], kick: ['KeyG'], special: ['KeyH'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
        punch: ['KeyK', 'Numpad1'], kick: ['KeyL', 'Numpad2'], special: ['Semicolon', 'Numpad3', 'Quote'] },
};
function readInput(m) {
  return {
    left: anyDown(m.left), right: anyDown(m.right), up: anyDown(m.up), down: anyDown(m.down),
    punchP: anyPressed(m.punch), kickP: anyPressed(m.kick), specialP: anyPressed(m.special),
  };
}
const NO_INPUT = { left: false, right: false, up: false, down: false, punchP: false, kickP: false, specialP: false };

// controles de toque
document.querySelectorAll('#touch button[data-key]').forEach(b => {
  const k = b.dataset.key;
  const on = e => { e.preventDefault(); keys[k] = true; initAudio(); };
  const off = e => { e.preventDefault(); keys[k] = false; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
});

// ---------------------------------------------------------------------
//  Golpes
// ---------------------------------------------------------------------
// box: [distância à frente, y relativo ao pé, largura, altura]
const ATK = {
  punch:   { s: 4,  a: 4, r: 9,  dmg: 6,  box: [16, -150, 66, 26], kb: 3.5, hs: 14, m: 8,  snd: 'punch' },
  kick:    { s: 7,  a: 5, r: 15, dmg: 9,  box: [12, -110, 90, 30], kb: 6,   hs: 18, m: 10, snd: 'kick' },
  cpunch:  { s: 4,  a: 4, r: 9,  dmg: 5,  box: [16, -104, 62, 24], kb: 3,   hs: 13, m: 7,  snd: 'punch' },
  sweep:   { s: 8,  a: 5, r: 20, dmg: 8,  box: [8,  -34, 104, 26], kb: 5,   hs: 22, m: 10, snd: 'kick', low: true },
  apunch:  { s: 3,  a: 8, r: 4,  dmg: 7,  box: [10, -125, 62, 32], kb: 3,   hs: 16, m: 8,  snd: 'punch', air: true },
  akick:   { s: 5,  a: 9, r: 4,  dmg: 9,  box: [10, -82, 82, 32],  kb: 5,   hs: 18, m: 10, snd: 'kick', air: true },
  special: { s: 12, a: 0, r: 20, proj: 'normal' },
  super:   { s: 18, a: 0, r: 26, proj: 'super' },
};

// ---------------------------------------------------------------------
//  Estado global
// ---------------------------------------------------------------------
const G = {
  state: 'menu', t: 0, round: 1, clock: 99, clockTick: 0, msg: '', sub: '',
  mode: '1p', menuIdx: 0, diff: 1, paused: false,
  shake: 0, hitstop: 0, freeze: 0, freezeBy: null, slowmo: 0, tick: 0, winner: null,
};
const DIFFS = [
  { name: 'FÁCIL', block: 0.15, atk: 0.04, zone: 0.25 },
  { name: 'NORMAL', block: 0.45, atk: 0.08, zone: 0.4 },
  { name: 'DIFÍCIL', block: 0.75, atk: 0.16, zone: 0.5 },
];
let p1 = null, p2 = null, fighters = [];
let projs = [], parts = [], texts = [];

// ---------------------------------------------------------------------
//  Lutador
// ---------------------------------------------------------------------
class Fighter {
  constructor(key, side, cpu) {
    this.c = CHARS[key]; this.key = key; this.side = side; this.cpu = cpu;
    this.wins = 0; this.meter = 0; this.ai = { t: 0, mode: 'approach' };
    this.reset();
  }
  reset() {
    this.x = this.side === 0 ? 300 : 660; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1;
    this.hp = 100; this.dispHp = 100; this.state = 'idle'; this.anim = 0;
    this.atk = null; this.atkName = ''; this.t = 0; this.hasHit = false; this.airAtk = false;
    this.hitstun = 0; this.hitMax = 1; this.blockstun = 0; this.cool = 0;
    this.crouch = false; this.holdBack = false; this.holdDown = false;
    this.combo = 0; this.koT = 0; this.koRot = 0;
  }
  get grounded() { return this.y >= GROUND; }
  hurtbox() {
    const crouching = this.crouch && this.grounded;
    const h = crouching ? 190 : 228;
    return { x: this.x - 28, y: this.y - h, w: 56, h };
  }
  hitbox() {
    const b = this.atk.box;
    return { x: this.facing === 1 ? this.x + b[0] : this.x - b[0] - b[2], y: this.y + b[1], w: b[2], h: b[3] };
  }
  update(inp, opp) {
    this.anim++;
    if (this.cool > 0) this.cool--;
    if (this.dispHp > this.hp) this.dispHp = Math.max(this.hp, this.dispHp - 0.6);
    this.holdBack = this.facing === 1 ? inp.left : inp.right;
    this.holdDown = inp.down;

    if (this.state === 'ko') {
      this.koT++;
      this.physics();
      if (this.grounded) this.vx *= 0.85;
      this.koRot += (-Math.PI / 2 - this.koRot) * 0.15;
      return;
    }
    if (this.state === 'win') { this.vx = 0; this.physics(); return; }
    if (this.hitstun > 0) {
      this.hitstun--; this.state = 'hit'; this.atk = null;
      this.physics(); if (this.grounded) this.vx *= 0.82;
      if (this.hitstun === 0) { this.state = 'idle'; this.combo = 0; }
      return;
    }
    if (this.blockstun > 0) {
      this.blockstun--; this.state = 'block';
      this.physics(); this.vx *= 0.8;
      if (this.blockstun === 0) this.state = this.crouch ? 'crouch' : 'idle';
      return;
    }
    if (this.atk) { this.updateAtk(opp); this.physics(); return; }

    if (this.grounded) {
      this.facing = opp.x >= this.x ? 1 : -1;
      this.holdBack = this.facing === 1 ? inp.left : inp.right;
      this.crouch = inp.down;
      if (inp.specialP && this.cool <= 0) {
        this.startAtk(this.meter >= 100 ? 'super' : 'special');
      } else if (inp.punchP) {
        this.startAtk(this.crouch ? 'cpunch' : 'punch');
      } else if (inp.kickP) {
        this.startAtk(this.crouch ? 'sweep' : 'kick');
      } else if (inp.up) {
        this.vy = -16.5; this.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 4.6;
        this.state = 'jump'; this.crouch = false; this.airAtk = false; sfx('jump');
      } else if (this.crouch) {
        this.vx = 0; this.state = 'crouch';
      } else {
        const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        this.vx = dir * (dir === this.facing ? 4.2 : 3.2);
        this.state = dir ? 'walk' : 'idle';
      }
    } else if (!this.airAtk && (inp.punchP || inp.kickP)) {
      this.startAtk(inp.punchP ? 'apunch' : 'akick');
      this.airAtk = true;
    }
    this.physics();
  }
  startAtk(name) {
    this.atk = ATK[name]; this.atkName = name; this.t = 0; this.hasHit = false; this.state = 'atk';
    if (!this.atk.air) { this.vx = 0; this.crouch = name === 'cpunch' || name === 'sweep'; }
    if (name === 'super') {
      this.meter = 0; G.freeze = 45; G.freezeBy = this; sfx('super');
    } else if (!this.atk.proj) {
      sfx('whiff');
    }
  }
  updateAtk(opp) {
    const a = this.atk;
    this.t++;
    if (a.proj && this.t === a.s) { spawnProj(this, a.proj); this.cool = a.proj === 'super' ? 40 : 55; }
    if (!a.proj && !this.hasHit && this.t >= a.s && this.t < a.s + a.a && opp.state !== 'ko') {
      const hb = this.hitbox();
      if (overlap(hb, opp.hurtbox())) {
        this.hasHit = true;
        opp.receive(a, this, this.facing, hb.x + (this.facing === 1 ? hb.w : 0), hb.y + hb.h / 2);
      }
    }
    if (this.t >= a.s + a.a + a.r) {
      this.atk = null;
      this.state = this.grounded ? (this.crouch ? 'crouch' : 'idle') : 'jump';
    }
  }
  receive(a, att, dir, hx, hy) {
    const canBlock = this.holdBack && this.grounded && !this.atk && this.hitstun === 0 &&
      (!a.low || this.holdDown);
    if (canBlock) {
      const chip = a.proj ? (a.super ? 5 : 2) : 0;
      this.hp = Math.max(1, this.hp - chip);
      this.blockstun = a.super ? 22 : 12; this.state = 'block'; this.crouch = this.holdDown;
      this.vx = dir * a.kb * 0.8;
      this.meter = Math.min(100, this.meter + 4);
      burst(hx, hy, '#8fd3ff', 8, 4);
      sfx('block');
      G.hitstop = 3;
      return;
    }
    att.combo = this.hitstun > 0 ? att.combo + 1 : 1;
    this.hp = Math.max(0, this.hp - a.dmg);
    this.hitstun = a.hs; this.hitMax = a.hs; this.state = 'hit'; this.atk = null;
    this.vx = dir * a.kb;
    if (!this.grounded || a.super) this.vy = -6;
    att.meter = Math.min(100, att.meter + (a.m || 0));
    this.meter = Math.min(100, this.meter + (a.m || 0) / 2);
    burst(hx, hy, a.super ? '#ffffff' : '#ffd400', a.super ? 30 : 14, a.super ? 9 : 6);
    sfx(a.snd || 'kick');
    G.hitstop = a.super ? 10 : 5;
    G.shake = a.super ? 16 : 6;
    if (att.combo >= 2) addText(att.combo + ' HITS!', att.side === 0 ? 150 : W - 150, 170, '#ffd400', 40);
    if (this.hp <= 0) this.knockout(dir);
  }
  knockout(dir) {
    this.state = 'ko'; this.atk = null; this.hitstun = 0; this.blockstun = 0; this.crouch = false;
    this.vx = dir * 6; this.vy = -10; this.koT = 0;
    sfx('ko'); G.slowmo = 70; G.shake = 20;
  }
  physics() {
    const wasAir = !this.grounded;
    this.x += this.vx;
    if (wasAir || this.vy < 0) {
      this.vy += 0.75;
      this.y += this.vy;
      if (this.y >= GROUND) {
        this.y = GROUND; this.vy = 0;
        if (this.atk && this.atk.air) this.atk = null;
        if (this.state === 'jump' || this.state === 'atk') this.state = 'idle';
        if (this.state !== 'ko' && this.state !== 'hit' && this.state !== 'win') this.vx = 0;
      }
    }
    this.x = Math.max(36, Math.min(W - 36, this.x));
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function separate(a, b) {
  const minD = 52;
  const dx = b.x - a.x;
  if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 160 && a.state !== 'ko' && b.state !== 'ko') {
    const push = (minD - Math.abs(dx)) / 2;
    const s = dx === 0 ? (a.side === 0 ? 1 : -1) : Math.sign(dx);
    a.x -= s * push; b.x += s * push;
    for (const f of [a, b]) f.x = Math.max(36, Math.min(W - 36, f.x));
    // se um ficou preso na parede, empurra o outro
    if (Math.abs(b.x - a.x) < minD - 1) {
      if (a.x <= 36 || a.x >= W - 36) b.x = a.x + s * minD; else a.x = b.x - s * minD;
    }
  }
}

// ---------------------------------------------------------------------
//  Projéteis, partículas e textos
// ---------------------------------------------------------------------
function spawnProj(f, type) {
  const sup = type === 'super';
  projs.push({
    owner: f, key: f.key, sup, x: f.x + f.facing * 60, y: f.y - (sup ? 120 : 132),
    vx: f.facing * (sup ? 8.5 : 7.5), w: sup ? 110 : 44, h: sup ? 80 : 32, life: 0, dead: false,
    atk: sup ? { dmg: 24, hs: 40, kb: 10, m: 0, proj: true, super: true, snd: 'kick' }
             : { dmg: 11, hs: 20, kb: 5, m: 6, proj: true, snd: 'kick' },
  });
  addText(sup ? f.c.superName : f.c.projName, f.x, f.y - 260, f.c.accent, sup ? 54 : 34);
  if (!sup) sfx('special');
}
function updateProjs() {
  for (const p of projs) {
    p.x += p.vx; p.life++;
    if (p.x < -150 || p.x > W + 150) p.dead = true;
    if (p.life % 2 === 0) {
      parts.push({ x: p.x - Math.sign(p.vx) * p.w * 0.4, y: p.y + (Math.random() - 0.5) * p.h * 0.6,
        vx: -p.vx * 0.2, vy: (Math.random() - 0.5), life: 18, max: 18, color: p.owner.c.glow, size: p.sup ? 8 : 4 });
    }
  }
  // projétil contra projétil
  for (let i = 0; i < projs.length; i++) for (let j = i + 1; j < projs.length; j++) {
    const a = projs[i], b = projs[j];
    if (a.dead || b.dead || a.owner === b.owner) continue;
    if (overlap(pbox(a), pbox(b))) {
      if (a.sup && !b.sup) b.dead = true;
      else if (b.sup && !a.sup) a.dead = true;
      else { a.dead = b.dead = true; }
      burst((a.x + b.x) / 2, a.y, '#ffffff', 16, 6); sfx('block');
    }
  }
  // projétil contra lutador
  for (const p of projs) {
    if (p.dead) continue;
    const target = p.owner === p1 ? p2 : p1;
    if (target.state === 'ko') continue;
    if (overlap(pbox(p), target.hurtbox())) {
      p.dead = true;
      target.receive(p.atk, p.owner, Math.sign(p.vx), p.x + Math.sign(p.vx) * p.w / 2, p.y);
    }
  }
  projs = projs.filter(p => !p.dead);
}
const pbox = p => ({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });

function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = Math.random() * spd + 1;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 20 + Math.random() * 12, max: 30, color, size: 3 + Math.random() * 3 });
  }
}
function addText(text, x, y, color, size) { texts.push({ text, x, y, color, size, life: 60 }); }
function updateFx() {
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.y -= 0.6; t.life--; }
  texts = texts.filter(t => t.life > 0);
}

// ---------------------------------------------------------------------
//  IA
// ---------------------------------------------------------------------
function aiInput(f, o) {
  const inp = { ...NO_INPUT };
  const D = DIFFS[G.diff], ai = f.ai, R = Math.random;
  const d = o.x - f.x, dist = Math.abs(d);
  const tw = d > 0 ? 'right' : 'left', aw = d > 0 ? 'left' : 'right';

  const threat = projs.find(p => p.owner !== f && Math.sign(p.vx) === Math.sign(f.x - p.x) && Math.abs(p.x - f.x) < 280);
  if (threat) {
    if (ai.dodge === undefined) ai.dodge = R() < D.block + 0.15 ? (R() < 0.5 ? 'jump' : 'block') : 'none';
    if (ai.dodge === 'jump' && Math.abs(threat.x - f.x) < 190) { inp.up = true; inp[tw] = true; return inp; }
    if (ai.dodge === 'block') { inp[aw] = true; return inp; }
  } else ai.dodge = undefined;

  if (o.atk && !o.atk.proj && dist < 170) {
    if (ai.blk === undefined) ai.blk = R() < D.block;
    if (ai.blk) { inp[aw] = true; if (o.atk.low) inp.down = true; return inp; }
  } else ai.blk = undefined;

  if (--ai.t <= 0) {
    const r = R();
    if (dist > 280) ai.mode = r < D.zone ? 'zone' : 'approach';
    else if (dist > 120) ai.mode = r < 0.15 ? 'jumpin' : r < 0.3 ? 'zone' : 'approach';
    else ai.mode = r < 0.8 ? 'attack' : 'retreat';
    ai.t = 20 + R() * 30;
  }
  switch (ai.mode) {
    case 'approach': inp[tw] = true; if (dist < 110) { ai.mode = 'attack'; } break;
    case 'retreat': inp[aw] = true; break;
    case 'zone':
      if (f.cool <= 0 && f.grounded && !f.atk) { inp.specialP = true; ai.mode = 'approach'; ai.t = 30; }
      break;
    case 'jumpin':
      if (f.grounded && !f.atk) { inp.up = true; inp[tw] = true; }
      else if (dist < 130 && R() < 0.25) inp.kickP = true;
      break;
    case 'attack':
      if (dist > 125) inp[tw] = true;
      else if (R() < D.atk) {
        const r = R();
        if (r < 0.45) inp.punchP = true;
        else if (r < 0.8) inp.kickP = true;
        else { inp.down = true; inp.kickP = true; }
      }
      break;
  }
  if (f.meter >= 100 && dist > 150 && R() < 0.02) inp.specialP = true;
  return inp;
}

// ---------------------------------------------------------------------
//  Fluxo do jogo
// ---------------------------------------------------------------------
const MENU = [
  { label: '1 JOGADOR — BOLSONARO', act: () => startMatch('bolsonaro', 'lula', true) },
  { label: '1 JOGADOR — LULA', act: () => startMatch('lula', 'bolsonaro', true) },
  { label: '2 JOGADORES', act: () => startMatch('bolsonaro', 'lula', false) },
  { label: 'DIFICULDADE', act: () => { G.diff = (G.diff + 1) % DIFFS.length; } },
];
function menuRect(i) { return { x: W / 2 - 200, y: 340 + i * 44, w: 400, h: 38 }; }

function startMatch(k1, k2, cpu) {
  G.mode = cpu ? '1p' : '2p';
  p1 = new Fighter(k1, 0, false);
  p2 = new Fighter(k2, 1, cpu);
  fighters = [p1, p2];
  G.round = 1;
  sfx('start');
  startRound();
}
function startRound() {
  p1.reset(); p2.reset();
  projs = []; parts = []; texts = [];
  G.state = 'intro'; G.t = 0; G.clock = 99; G.clockTick = 0; G.winner = null;
  G.slowmo = 0; G.freeze = 0; G.hitstop = 0;
}
function endRound(byTime) {
  G.state = 'roundEnd'; G.t = 0;
  if (p1.hp === p2.hp) { G.winner = null; G.msg = byTime ? 'EMPATE!' : 'DUPLO K.O.!'; }
  else {
    G.winner = p1.hp > p2.hp ? p1 : p2;
    G.winner.wins++;
    G.msg = byTime ? 'TEMPO!' : 'K.O.!';
  }
}
function afterRound() {
  if (p1.wins >= 2 || p2.wins >= 2 || G.round >= 5) {
    G.state = 'matchEnd'; G.t = 0;
    G.winner = p1.wins === p2.wins ? null : (p1.wins > p2.wins ? p1 : p2);
    G.quote = G.winner ? G.winner.c.quotes[Math.floor(Math.random() * G.winner.c.quotes.length)] : '';
    if (G.winner && G.winner.state !== 'ko') G.winner.state = 'win';
  } else {
    G.round++;
    startRound();
  }
}

function updateFighters(active) {
  const i1 = active ? readInput(MAP.p1) : NO_INPUT;
  let i2 = NO_INPUT;
  if (active) i2 = p2.cpu ? aiInput(p2, p1) : readInput(MAP.p2);
  p1.update(i1, p2);
  p2.update(i2, p1);
  separate(p1, p2);
  updateProjs();
}

function step() {
  G.tick++;
  if (G.shake > 0) G.shake *= 0.85;
  if (G.shake < 0.5) G.shake = 0;

  if (G.state === 'menu') { menuUpdate(); return; }

  if (pressed('KeyP') || pressed('Escape')) {
    if (G.state === 'fight') G.paused = !G.paused;
  }
  if (G.paused) {
    if (pressed('KeyQ')) { G.paused = false; G.state = 'menu'; }
    return;
  }
  if (G.freeze > 0) { G.freeze--; return; }
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.slowmo > 0) { G.slowmo--; if (G.slowmo % 3) { updateFx(); return; } }

  switch (G.state) {
    case 'intro':
      G.t++;
      updateFighters(false);
      if (G.t >= 130) { G.state = 'fight'; }
      break;
    case 'fight':
      updateFighters(true);
      if (++G.clockTick >= 60) { G.clockTick = 0; G.clock--; }
      if (p1.hp <= 0 || p2.hp <= 0) endRound(false);
      else if (G.clock <= 0) endRound(true);
      break;
    case 'roundEnd':
      G.t++;
      updateFighters(false);
      if (G.t === 90 && G.winner && G.winner.state !== 'ko' && G.winner.grounded) G.winner.state = 'win';
      if (G.t >= 210) afterRound();
      break;
    case 'matchEnd':
      G.t++;
      updateFighters(false);
      if (G.t > 60 && (anyPressed(['Enter', 'Space', 'KeyF', 'KeyK']) || G.clicked)) G.state = 'menu';
      break;
  }
  G.clicked = false;
  updateFx();
}

function menuUpdate() {
  if (anyPressed(['KeyW', 'ArrowUp'])) { G.menuIdx = (G.menuIdx + MENU.length - 1) % MENU.length; sfx('select'); }
  if (anyPressed(['KeyS', 'ArrowDown'])) { G.menuIdx = (G.menuIdx + 1) % MENU.length; sfx('select'); }
  if (G.menuIdx === 3 && anyPressed(['KeyA', 'ArrowLeft'])) { G.diff = (G.diff + DIFFS.length - 1) % DIFFS.length; sfx('select'); }
  if (G.menuIdx === 3 && anyPressed(['KeyD', 'ArrowRight'])) { G.diff = (G.diff + 1) % DIFFS.length; sfx('select'); }
  if (anyPressed(['Enter', 'Space', 'KeyF', 'KeyK'])) { sfx('select'); MENU[G.menuIdx].act(); }
}

cv.addEventListener('pointerdown', e => {
  initAudio();
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  if (G.state === 'menu') {
    MENU.forEach((m, i) => {
      const b = menuRect(i);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { G.menuIdx = i; sfx('select'); m.act(); }
    });
  } else if (G.state === 'matchEnd') {
    G.clicked = true;
  }
});

// ---------------------------------------------------------------------
//  Cenário (pré-renderizado)
// ---------------------------------------------------------------------
const bg = document.createElement('canvas');
bg.width = W; bg.height = H;
(function drawBackground() {
  const b = bg.getContext('2d');
  const sky = b.createLinearGradient(0, 0, 0, 350);
  sky.addColorStop(0, '#160c2e'); sky.addColorStop(0.5, '#5b2a6e'); sky.addColorStop(1, '#f39446');
  b.fillStyle = sky; b.fillRect(0, 0, W, 350);
  // estrelas
  b.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 70; i++) b.fillRect((i * 137) % W, (i * 71) % 150, 1.5, 1.5);
  // sol
  const sun = b.createRadialGradient(480, 300, 10, 480, 300, 160);
  sun.addColorStop(0, 'rgba(255,220,120,1)'); sun.addColorStop(0.35, 'rgba(255,170,70,.8)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
  b.fillStyle = sun; b.fillRect(300, 120, 360, 240);
  // Congresso Nacional (silhueta)
  const sil = '#2a1838';
  b.fillStyle = sil;
  b.fillRect(250, 326, 460, 24);
  b.fillRect(462, 150, 15, 180); b.fillRect(483, 150, 15, 180);
  b.fillRect(462, 222, 36, 8);
  // cúpula (senado)
  b.beginPath(); b.arc(610, 326, 52, Math.PI, 0); b.fill();
  // cuia (câmara)
  b.beginPath(); b.moveTo(290, 304); b.quadraticCurveTo(360, 345, 430, 304); b.closePath(); b.fill();
  b.beginPath(); b.ellipse(360, 304, 70, 7, 0, 0, TAU); b.fill();
  b.fillRect(352, 318, 16, 10);
  // prédios ao fundo
  b.fillStyle = '#3a2048';
  for (let i = 0; i < 9; i++) { b.fillRect(40 + i * 24, 300 - (i % 3) * 8, 18, 50); b.fillRect(740 + i * 24, 300 - ((i + 1) % 3) * 8, 18, 50); }
  // mastro com bandeira
  b.fillStyle = '#ddd'; b.fillRect(868, 150, 4, 200);
  b.fillStyle = '#009c3b'; b.fillRect(872, 152, 64, 44);
  b.fillStyle = '#ffdf00'; b.beginPath(); b.moveTo(904, 156); b.lineTo(932, 174); b.lineTo(904, 192); b.lineTo(876, 174); b.closePath(); b.fill();
  b.fillStyle = '#002776'; b.beginPath(); b.arc(904, 174, 10, 0, TAU); b.fill();
  b.fillStyle = '#ddd'; b.fillRect(88, 150, 4, 200);
  b.fillStyle = '#009c3b'; b.fillRect(24, 152, 64, 44);
  b.fillStyle = '#ffdf00'; b.beginPath(); b.moveTo(56, 156); b.lineTo(84, 174); b.lineTo(56, 192); b.lineTo(28, 174); b.closePath(); b.fill();
  b.fillStyle = '#002776'; b.beginPath(); b.arc(56, 174, 10, 0, TAU); b.fill();
  // chão (Praça dos Três Poderes)
  const gr = b.createLinearGradient(0, 350, 0, H);
  gr.addColorStop(0, '#9c8664'); gr.addColorStop(1, '#5a4733');
  b.fillStyle = gr; b.fillRect(0, 350, W, H - 350);
  b.strokeStyle = 'rgba(0,0,0,.18)'; b.lineWidth = 1;
  for (let i = -14; i <= 14; i++) { b.beginPath(); b.moveTo(480 + i * 40, 350); b.lineTo(480 + i * 150, H); b.stroke(); }
  [372, 398, 430, 470, 520].forEach(y => { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); });
  // torcida
  for (let i = 0; i < 80; i++) {
    const x = i * 12 + (i % 2) * 4, left = x < W / 2;
    const y = 352 + (i % 3) * 3;
    b.fillStyle = 'rgba(20,10,30,.85)';
    b.beginPath(); b.arc(x, y - 8, 5, 0, TAU); b.fill();
    b.fillRect(x - 5, y - 4, 10, 14);
    if (i % 4 === 0) {
      b.fillStyle = left ? (i % 8 === 0 ? '#ffdf00' : '#009c3b') : (i % 8 === 0 ? '#ffffff' : '#d0021b');
      b.fillRect(x - 1, y - 30, 2, 20); b.fillRect(x + 1, y - 30, 12, 8);
    }
  }
  b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(0, 362, W, 6);
})();

// ---------------------------------------------------------------------
//  Desenho dos lutadores
// ---------------------------------------------------------------------
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function limb(ax, ay, bx, by, bend, col, w) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const jx = mx + (-dy / len) * bend, jy = my + (dx / len) * bend;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(jx, jy); ctx.lineTo(bx, by); ctx.stroke();
}

// cabeça: foto recortada em círculo ou caricatura desenhada
function drawHead(c, x, y, r, mirror) {
  ctx.save();
  ctx.translate(x, y);
  if (c.img && c.img.complete && c.img.naturalWidth) {
    ctx.save();
    if (mirror) ctx.scale(-1, 1);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.closePath();
    ctx.fillStyle = c.skin; ctx.fill();
    ctx.clip();
    const { sx, sy, s } = squareCrop(c.img);
    ctx.drawImage(c.img, sx, sy, s, s, -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  } else if (c.key === 'bolsonaro') {
    drawBolsonaroFace(c, r);
  } else {
    drawLulaFace(c, r);
  }
  ctx.restore();
}
function faceBase(c, r) {
  ctx.fillStyle = c.skin; ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 2.5;
  // orelha
  ctx.beginPath(); ctx.ellipse(-r * 0.62, r * 0.05, r * 0.16, r * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // rosto
  ctx.beginPath(); ctx.ellipse(r * 0.05, 0, r * 0.82, r * 0.98, 0, 0, TAU); ctx.fill(); ctx.stroke();
}
function eye(x, y, r) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(x + r * 0.35, y, r * 0.6, 0, TAU); ctx.fill();
}
function drawBolsonaroFace(c, r) {
  faceBase(c, r);
  // cabelo escuro com risca lateral
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.85, -r * 0.95, r * 0.1, -r * 1.0);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.95, r * 0.86, -r * 0.35);
  ctx.quadraticCurveTo(r * 0.4, -r * 0.62, -r * 0.1, -r * 0.55);
  ctx.quadraticCurveTo(-r * 0.45, -r * 0.5, -r * 0.55, r * 0.0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.95); ctx.quadraticCurveTo(-r * 0.05, -r * 0.75, -r * 0.1, -r * 0.57); ctx.stroke();
  // sobrancelhas
  ctx.strokeStyle = c.hair; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.3); ctx.lineTo(r * 0.3, -r * 0.33); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.48, -r * 0.33); ctx.lineTo(r * 0.72, -r * 0.27); ctx.stroke();
  eye(r * 0.2, -r * 0.12, r * 0.1); eye(r * 0.6, -r * 0.12, r * 0.1);
  // nariz
  ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.05); ctx.quadraticCurveTo(r * 0.82, r * 0.25, r * 0.5, r * 0.3); ctx.stroke();
  // boca (sorriso de canto)
  ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.55); ctx.quadraticCurveTo(r * 0.45, r * 0.68, r * 0.7, r * 0.48); ctx.stroke();
  // óculos? não. bochecha
  ctx.fillStyle = 'rgba(220,80,80,.18)'; ctx.beginPath(); ctx.arc(r * 0.05, r * 0.3, r * 0.16, 0, TAU); ctx.fill();
}
function drawLulaFace(c, r) {
  faceBase(c, r);
  // cabelo grisalho
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, r * 0.1);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.9, r * 0.05, -r * 1.02);
  ctx.quadraticCurveTo(r * 0.75, -r * 1.0, r * 0.85, -r * 0.45);
  ctx.quadraticCurveTo(r * 0.35, -r * 0.72, -r * 0.2, -r * 0.62);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.4, -r * 0.5, r * 0.15);
  ctx.closePath(); ctx.fill();
  // barba cheia
  ctx.fillStyle = c.beard; ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.6, r * 1.15, r * 0.25, r * 1.1);
  ctx.quadraticCurveTo(r * 0.85, r * 0.95, r * 0.86, r * 0.25);
  ctx.quadraticCurveTo(r * 0.7, r * 0.35, r * 0.55, r * 0.32);
  ctx.quadraticCurveTo(r * 0.1, r * 0.3, -r * 0.2, r * 0.45);
  ctx.quadraticCurveTo(-r * 0.4, r * 0.3, -r * 0.62, r * 0.05);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // bigode
  ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.42, r * 0.3, r * 0.1, -0.1, 0, TAU); ctx.fill();
  // boca
  ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.62, r * 0.14, r * 0.07, 0, 0, TAU); ctx.fill();
  // sobrancelhas grossas
  ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.3); ctx.lineTo(r * 0.32, -r * 0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.48, -r * 0.36); ctx.lineTo(r * 0.74, -r * 0.3); ctx.stroke();
  eye(r * 0.2, -r * 0.13, r * 0.1); eye(r * 0.6, -r * 0.13, r * 0.1);
  // nariz
  ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.05); ctx.quadraticCurveTo(r * 0.9, r * 0.22, r * 0.52, r * 0.28); ctx.stroke();
}

function drawFighter(f) {
  const c = f.c, st = f.state, a = f.atk, an = a ? f.atkName : '';
  // sombra
  const air = Math.min(1, (GROUND - f.y) / 300);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 4, 44 * (1 - air * 0.5), 9, 0, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);
  if (st === 'ko') { ctx.translate(0, -24 * (f.koRot / (-Math.PI / 2))); ctx.rotate(f.koRot); }
  if (st === 'hit' && f.hitstun > f.hitMax - 4) ctx.filter = 'brightness(1.8)';

  const crouching = f.crouch && f.grounded && st !== 'ko' && st !== 'hit';
  let hipY = -84, shY = -150, headY = -192, lean = 0;
  if (crouching) { hipY = -50; shY = -114; headY = -156; }
  const bob = st === 'idle' || st === 'crouch' ? Math.sin(f.anim * 0.12) * 2 : 0;
  shY += bob; headY += bob;

  let ff = [24, 0], bf = [-22, 0], fh = [30, shY + 30], bh = [16, shY + 36];
  if (st === 'walk') { const s = Math.sin(f.anim * 0.25); ff = [22 + s * 14, -Math.max(0, s) * 6]; bf = [-20 - s * 14, -Math.max(0, -s) * 6]; }
  if (crouching) { ff = [32, 0]; bf = [-32, 0]; }
  if (!f.grounded && st !== 'ko') { ff = [20, hipY + 54]; bf = [-14, hipY + 48]; }
  if (st === 'hit') { lean = -0.2; fh = [8, shY - 14]; bh = [-22, shY - 8]; }
  if (st === 'block') { fh = [28, headY + 30]; bh = [22, headY + 40]; lean = -0.05; }
  if (st === 'win') { fh = [12, headY - 52 + Math.sin(f.anim * 0.2) * 4]; bh = [-20, shY + 44]; }
  if (a) {
    const ph = f.t < a.s ? 's' : f.t < a.s + a.a ? 'a' : 'r';
    const tip = [a.box ? a.box[0] + a.box[2] - 6 : 0, a.box ? a.box[1] + a.box[3] / 2 : 0];
    if (an === 'punch' || an === 'cpunch' || an === 'apunch') {
      fh = ph === 'a' ? tip : ph === 's' ? [12, shY + 24] : [42, shY + 22];
      lean = ph === 'a' ? 0.08 : 0;
    } else if (an === 'kick' || an === 'sweep' || an === 'akick') {
      ff = ph === 'a' ? tip : ph === 's' ? [28, hipY + 22] : [34, an === 'akick' ? hipY + 50 : -8];
      lean = ph === 'a' ? -0.14 : 0;
      fh = [18, shY + 26]; bh = [-10, shY + 34];
    } else {
      fh = ph === 's' ? [-14, shY + 22] : [62, shY + 18];
      bh = ph === 's' ? [-20, shY + 30] : [54, shY + 30];
    }
  }

  // pernas
  limb(-8, hipY, bf[0], bf[1], -10, c.pants, 16);
  shoe(bf[0], bf[1]);
  // tronco + braço de trás (com inclinação)
  ctx.save();
  ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  limb(-6, shY + 6, bh[0], bh[1], 10, shadeColor(c.suit), 13);
  fist(bh[0], bh[1], c.skin);
  ctx.restore();

  limb(8, hipY, ff[0], ff[1], -10, c.pants, 16);
  shoe(ff[0], ff[1]);

  ctx.save();
  ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  // pescoço
  ctx.fillStyle = c.skin; ctx.fillRect(-7, headY + 24, 14, shY - headY - 18);
  // paletó
  ctx.fillStyle = c.suit; rr(-25, shY - 6, 50, hipY - shY + 16, 12); ctx.fill();
  ctx.fillStyle = c.shirt;
  ctx.beginPath(); ctx.moveTo(-10, shY - 6); ctx.lineTo(10, shY - 6); ctx.lineTo(0, shY + 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.tie;
  ctx.beginPath(); ctx.moveTo(0, shY - 3); ctx.lineTo(-5, shY + 4); ctx.lineTo(0, shY + 36); ctx.lineTo(5, shY + 4); ctx.closePath(); ctx.fill();
  if (c.key === 'bolsonaro') {
    // faixa verde e amarela
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#009c3b'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-20, shY); ctx.lineTo(22, hipY - 2); ctx.stroke();
    ctx.strokeStyle = '#ffdf00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-20, shY); ctx.lineTo(22, hipY - 2); ctx.stroke();
  } else {
    // broche de estrela
    star(-13, shY + 16, 6, 2.6, '#e10600');
  }
  ctx.fillStyle = '#111'; ctx.fillRect(-25, hipY - 2, 50, 6);
  // cabeça
  drawHead(c, 2, headY, 40, f.facing === -1);
  // braço da frente
  limb(8, shY + 6, fh[0], fh[1], 10, c.suit, 13);
  fist(fh[0], fh[1], c.skin);
  ctx.restore();

  ctx.restore();
  ctx.filter = 'none';
}
function shoe(x, y) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x + 5, y - 3, 12, 6, 0, 0, TAU); ctx.fill(); }
function fist(x, y, skin) { ctx.fillStyle = skin; ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, TAU); ctx.fill(); ctx.stroke(); }
function shadeColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.75, g = ((n >> 8) & 255) * 0.75, b = (n & 255) * 0.75;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function star(x, y, R, r, color, rot = 0) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
}

function drawProj(p) {
  const dir = Math.sign(p.vx);
  ctx.save(); ctx.translate(p.x, p.y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.w * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(0.4, p.owner.c.glow + 'aa'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, p.w * 0.7, 0, TAU); ctx.fill();
  if (p.key === 'bolsonaro') {
    ctx.scale(dir, 1);
    if (p.sup) {
      // motocicleta
      ctx.strokeStyle = '#111'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(-30, 18, 17, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, 18, 17, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#009c3b';
      ctx.beginPath(); ctx.moveTo(-36, 10); ctx.lineTo(-10, -8); ctx.lineTo(24, -8); ctx.lineTo(36, 12); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffdf00'; ctx.fillRect(-8, -16, 26, 9);
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(24, -8); ctx.lineTo(30, -26); ctx.lineTo(40, -28); ctx.stroke();
      ctx.fillStyle = '#ffdf00';
      for (let i = 0; i < 3; i++) ctx.fillRect(-80 - i * 18 - (p.life % 6) * 2, -10 + i * 10, 26, 3);
    } else {
      // "arminha": mão com dedo apontando
      ctx.fillStyle = '#ffdf00';
      ctx.beginPath(); ctx.ellipse(-4, 0, 22, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = CHARS.bolsonaro.skin; ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 2;
      rr(-12, -8, 18, 16, 5); ctx.fill(); ctx.stroke();
      rr(2, -8, 18, 6, 3); ctx.fill(); ctx.stroke();
      rr(-8, -16, 6, 10, 3); ctx.fill(); ctx.stroke();
    }
  } else {
    if (p.sup) {
      ctx.rotate(Math.sin(p.life * 0.2) * 0.15);
      ctx.font = `110px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.strokeText('L', 0, 6);
      ctx.fillStyle = '#e10600'; ctx.fillText('L', 0, 6);
    } else {
      star(0, 0, 20, 8.5, '#e10600', p.life * 0.25);
      star(0, 0, 9, 4, '#ffd0c0', p.life * 0.25);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  HUD e telas
// ---------------------------------------------------------------------
function bigText(t, x, y, size, fill, stroke = '#000', align = 'center') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 9); ctx.strokeStyle = stroke;
  ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y);
}
function healthBar(x, y, w, h, v, dv, anchorRight) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#5a0000'; ctx.fillRect(x, y, w, h);
  const dw = w * dv, vw = w * v;
  ctx.fillStyle = '#ff5050'; ctx.fillRect(anchorRight ? x + w - dw : x, y, dw, h);
  ctx.fillStyle = v < 0.25 ? '#ff9d00' : '#ffd400'; ctx.fillRect(anchorRight ? x + w - vw : x, y, vw, h);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y + 2, w, 4);
}
function meterBar(f, x, w, anchorRight) {
  const y = 512, h = 12, full = f.meter >= 100;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#1d1440'; ctx.fillRect(x, y, w, h);
  const mw = w * f.meter / 100;
  ctx.fillStyle = full ? (G.tick % 20 < 10 ? '#5af2ff' : '#ffffff') : '#2e7bff';
  ctx.fillRect(anchorRight ? x + w - mw : x, y, mw, h);
  bigText(full ? 'SUPER PRONTO!' : 'SUPER', anchorRight ? x + w : x, y - 12, 18, full ? '#5af2ff' : '#cfd8ff', '#000', anchorRight ? 'right' : 'left');
}
function drawHUD() {
  healthBar(76, 26, 350, 22, p1.hp / 100, p1.dispHp / 100, true);
  healthBar(W - 76 - 350, 26, 350, 22, p2.hp / 100, p2.dispHp / 100, false);
  drawHead(p1.c, 40, 40, 28, false);
  drawHead(p2.c, W - 40, 40, 28, true);
  bigText(p1.c.name, 80, 66, 22, '#fff', '#000', 'left');
  bigText(p2.c.name + (p2.cpu ? ' (CPU)' : ''), W - 80, 66, 22, '#fff', '#000', 'right');
  for (let i = 0; i < 2; i++) {
    star(410 - i * 22, 66, 9, 4, i < p1.wins ? '#ffd400' : 'rgba(0,0,0,.5)');
    star(W - 410 + i * 22, 66, 9, 4, i < p2.wins ? '#ffd400' : 'rgba(0,0,0,.5)');
  }
  ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 34, 14, 68, 48);
  bigText(String(Math.max(0, G.clock)).padStart(2, '0'), W / 2, 39, 42, G.clock <= 10 ? '#ff5050' : '#fff');
  meterBar(p1, 40, 220, false);
  meterBar(p2, W - 260, 220, true);
}

function drawMenu() {
  ctx.drawImage(bg, 0, 0);
  ctx.fillStyle = 'rgba(8,4,20,.55)'; ctx.fillRect(0, 0, W, H);
  const bounce = Math.sin(G.tick * 0.05) * 4;
  bigText('TRETA NO PLANALTO', W / 2, 70 + bounce, 78, '#ffd400', '#2a0a00');
  bigText('Edição Presidencial', W / 2, 122, 26, '#fff');
  drawHead(CHARS.bolsonaro, 250, 230, 82, false);
  drawHead(CHARS.lula, W - 250, 230, 82, true);
  bigText('BOLSONARO', 250, 330, 30, '#2bd66b');
  bigText('LULA', W - 250, 330, 30, '#ff5a3c');
  bigText('VS', W / 2, 230, 90 + Math.sin(G.tick * 0.1) * 6, '#ff3030', '#fff');
  MENU.forEach((m, i) => {
    const b = menuRect(i), sel = i === G.menuIdx;
    ctx.fillStyle = sel ? 'rgba(255,212,0,.95)' : 'rgba(0,0,0,.55)';
    rr(b.x, b.y, b.w, b.h, 8); ctx.fill();
    const label = i === 3 ? `DIFICULDADE: ◀ ${DIFFS[G.diff].name} ▶` : m.label;
    bigText(label, W / 2, b.y + b.h / 2 + 1, 24, sel ? '#1a0a00' : '#fff', sel ? '#ffd400' : '#000');
  });
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'center';
  ctx.fillText('↑ ↓ para escolher · ENTER para confirmar · M liga/desliga o som · Jogo de paródia, sem afiliação política', W / 2, 530);
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (G.state === 'menu') { drawMenu(); ctx.restore(); return; }
  if (G.shake) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  ctx.drawImage(bg, 0, 0);
  if (G.freeze > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-20, -20, W + 40, H + 40); }
  // lutador atacando fica na frente
  const order = p1.atk && !p2.atk ? [p2, p1] : [p1, p2];
  order.forEach(drawFighter);
  projs.forEach(drawProj);
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.life / 20);
    bigText(t.text, t.x, t.y, t.size, t.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHUD();

  if (G.freeze > 0 && G.freezeBy) {
    // corte do super
    const f = G.freezeBy, k = 1 - G.freeze / 45, left = f.side === 0;
    const x = left ? -200 + Math.min(1, k * 3) * 420 : W + 200 - Math.min(1, k * 3) * 420;
    ctx.fillStyle = f.c.glow + 'cc';
    ctx.beginPath(); ctx.moveTo(0, 190); ctx.lineTo(W, 160); ctx.lineTo(W, 330); ctx.lineTo(0, 360); ctx.closePath(); ctx.fill();
    drawHead(f.c, x, 260, 90, !left);
    bigText(f.c.superName, left ? 620 : 340, 260, 72, '#fff', '#000');
  }

  if (G.state === 'intro') {
    if (G.t < 75) bigText('ROUND ' + G.round, W / 2, H / 2 - 30, 90, '#ffd400');
    else bigText('LUTE!', W / 2, H / 2 - 30, 110 + (G.t - 75) * 0.4, '#ff3030', '#fff');
  } else if (G.state === 'roundEnd') {
    bigText(G.msg, W / 2, H / 2 - 40, 110, '#ff3030', '#fff');
    if (G.t > 80) bigText(G.winner ? G.winner.c.name + ' VENCE O ROUND' : 'NINGUÉM VENCE', W / 2, H / 2 + 40, 40, '#fff');
  } else if (G.state === 'matchEnd') {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
    if (G.winner) {
      drawHead(G.winner.c, W / 2, 200, 95, false);
      bigText(G.winner.c.name + ' VENCEU!', W / 2, 340, 72, '#ffd400');
      bigText('"' + G.quote + '"', W / 2, 400, 34, '#fff');
    } else {
      bigText('EMPATE TÉCNICO!', W / 2, 260, 80, '#ffd400');
    }
    if (G.t > 60 && G.tick % 60 < 40) bigText('ENTER ou toque para voltar ao menu', W / 2, 470, 26, '#cfd8ff');
  }
  if (G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
    bigText('PAUSA', W / 2, H / 2 - 20, 90, '#fff');
    bigText('P continua · Q volta ao menu', W / 2, H / 2 + 50, 28, '#cfd8ff');
  }
}

// ---------------------------------------------------------------------
//  Loop principal (passo fixo de 60 Hz)
// ---------------------------------------------------------------------
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) {
    step();
    for (const k in keys) prev[k] = keys[k];
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// gancho para testes automatizados
window.__treta = { G, get p1() { return p1; }, get p2() { return p2; }, keys };
