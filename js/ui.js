/* =========================================================
   明末杀 · 界面
   ========================================================= */
(function () {
  'use strict';

  const MMS = window.MMS;
  const UI = MMS.UI = {};

  const esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  let state = null;
  let screens = {};
  let selectedGeneralId = 'mansui_sheng';
  let difficultyId = 'normal';
  let matchMode = '1v1';
  let selectedOpponents = [];
  let cheatSettings = {
    enabled: false,
    invincible: true,
    unlimited: true,
    unanswerable: false,
    damageMultiplier: 2,
    extraDamage: 0
  };
  let selectedUid = null;
  let newUids = new Set();
  let lastLogId = 0;
  let lastHandSig = '';
  let intentText = '';
  let currentModal = null;
  let currentResolve = null;
  let tooltipEl = null;
  let audioCtx = null;
  let soundEnabled = true;
  let soundVolume = 1;
  let masterGain = null;
  let ambient = { on: false, gain: null, nodes: [], timer: null };
  let bgmAudio = null;
  let bgmMode = 'auto';
  let bgmContext = 'menu';
  let bgmVolume = 0.38;
  let bgmImportedUrl = '';
  let bgmImportedName = '';
  let bgmGestureArmed = false;
  const BGM_TRACKS = {
    menu: { name: 'Redemption of the Wolf', file: 'assets/audio/bgm-redemption.wav' },
    battle: { name: "Li's March", file: 'assets/audio/bgm-li-march.wav' },
    danger: { name: 'Daggers Drawn', file: 'assets/audio/bgm-daggers.wav' }
  };
  const VOICE_FILES = {
    zakou: 'assets/audio/laofang-zakou.mp3',
    oniichan: 'assets/audio/laofang-oniichan.mp3'
  };
  const voiceCache = {};
  const voiceLast = {};

  /* =======================================================
     音效
     ======================================================= */

  const Sound = UI.Sound = {
    enabled: true,
    ensure: function () {
      if (!soundEnabled) return null;
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        try { audioCtx = new Ctx(); } catch (e) { return null; }
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.98 * soundVolume;
        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 14;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.28;
        masterGain.connect(limiter);
        limiter.connect(audioCtx.destination);
      }
      return audioCtx;
    },
    tone: function (freq, dur, type, gain, slideTo, delay) {
      const ctx = this.ensure();
      if (!ctx || !soundEnabled) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.035), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.06);
    },
    noise: function (dur, gain, freq, delay, filterType) {
      const ctx = this.ensure();
      if (!ctx || !soundEnabled) return;
      const t0 = ctx.currentTime + (delay || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType || 'bandpass';
      filter.frequency.value = freq || 1100;
      filter.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.value = gain || 0.035;
      src.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      src.start(t0);
    },
    whoosh: function (dur, gain, from, to, delay) {
      const ctx = this.ensure();
      if (!ctx || !soundEnabled) return;
      const t0 = ctx.currentTime + (delay || 0);
      const d = dur || 0.32;
      const len = Math.max(1, Math.floor(ctx.sampleRate * d));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        const p = i / len;
        const attack = Math.min(1, p / 0.08);
        const tail = Math.pow(1 - p, 1.6);
        data[i] = (Math.random() * 2 - 1) * attack * tail;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.15;
      filter.frequency.setValueAtTime(from || 520, t0);
      filter.frequency.exponentialRampToValueAtTime(to || 4200, t0 + d * 0.46);
      filter.frequency.exponentialRampToValueAtTime(Math.max(160, from || 520) * 0.7, t0 + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.05), t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      src.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      src.start(t0);
    },
    flesh: function (intensity) {
      const k = intensity || 1;
      // Wet, meaty impact: low body thump, torn-skin noise, short wet splatter.
      this.noise(0.16, 0.17 * k, 520, 0, 'lowpass');
      this.noise(0.26, 0.095 * k, 210, 0.015, 'lowpass');
      this.noise(0.09, 0.085 * k, 1600, 0.018, 'bandpass');
      this.noise(0.06, 0.075 * k, 2900, 0.045, 'bandpass');
      this.tone(112, 0.2, 'sine', 0.105 * k, 42, 0.01);
      this.tone(62, 0.32, 'triangle', 0.075 * k, 27, 0.03);
    },
    pluck: function (freq, gain, delay) {
      this.tone(freq, 1.15, 'sine', gain || 0.02, freq * 0.995, delay || 0);
      this.tone(freq * 2, 0.5, 'triangle', (gain || 0.02) * 0.22, freq * 1.99, (delay || 0) + 0.01);
      this.noise(0.08, 0.006, 2600, delay || 0);
    },
    play: function (name) {
      if (!soundEnabled) return;
      switch (name) {
        case 'click':
          this.tone(560, 0.045, 'triangle', 0.012);
          this.noise(0.035, 0.008, 1800);
          break;
        case 'select':
          this.tone(330, 0.08, 'triangle', 0.018);
          this.tone(494, 0.12, 'sine', 0.012);
          break;
        case 'hover':
          this.tone(720, 0.035, 'sine', 0.009);
          this.tone(1080, 0.025, 'triangle', 0.005);
          break;
        case 'legend':
          this.tone(73, 2.1, 'sine', 0.055, 36);
          this.tone(146, 1.6, 'triangle', 0.028, 72);
          this.tone(292, 1.2, 'sine', 0.012, 146);
          this.noise(0.9, 0.06, 240, 0, 'lowpass');
          this.noise(0.45, 0.03, 3200, 0.1);
          break;
        case 'achievement':
          this.tone(523.25, 0.35, 'sine', 0.022);
          this.tone(659.25, 0.55, 'sine', 0.018, 0.08);
          this.tone(783.99, 0.9, 'sine', 0.014, 0.16);
          this.noise(0.18, 0.02, 3800, 0.05);
          break;
        case 'draw':
          this.noise(0.18, 0.026, 1900);
          this.tone(190, 0.06, 'sine', 0.015);
          break;
        case 'play':
          this.noise(0.24, 0.05, 900);
          this.tone(145, 0.15, 'sine', 0.025, 86);
          this.tone(620, 0.08, 'triangle', 0.01, 660);
          break;
        case 'sha_play':
          this.whoosh(0.22, 0.085, 700, 3800);
          this.noise(0.12, 0.05, 3100);
          this.tone(1240, 0.18, 'sawtooth', 0.018, 300);
          this.tone(90, 0.2, 'triangle', 0.028, 48);
          break;
        case 'shan':
          this.whoosh(0.3, 0.13, 300, 5400);
          this.noise(0.09, 0.04, 4300, 0, 'highpass');
          this.tone(1840, 0.18, 'sine', 0.014, 520, 0.02);
          break;
        case 'tao':
          this.pluck(523.25, 0.022, 0);
          this.pluck(659.25, 0.018, 0.12);
          this.pluck(783.99, 0.014, 0.24);
          break;
        case 'jiu':
          this.tone(168, 0.42, 'sine', 0.09, 64);
          this.noise(0.2, 0.045, 330, 0, 'lowpass');
          this.tone(326, 0.24, 'triangle', 0.02, 190, 0.08);
          break;
        case 'wuzhong':
          this.pluck(392, 0.018, 0);
          this.pluck(523.25, 0.018, 0.11);
          this.pluck(659.25, 0.016, 0.22);
          this.pluck(783.99, 0.012, 0.34);
          this.noise(0.14, 0.012, 3200, 0.02);
          break;
        case 'chaiqiao':
          this.noise(0.16, 0.1, 760, 0, 'lowpass');
          this.noise(0.1, 0.07, 1900, 0.02);
          this.tone(176, 0.22, 'sawtooth', 0.03, 58);
          break;
        case 'shunshou':
          this.whoosh(0.18, 0.08, 900, 3600);
          this.tone(1540, 0.12, 'triangle', 0.02, 540, 0.03);
          this.tone(220, 0.12, 'sine', 0.022, 130, 0.02);
          break;
        case 'juedou':
          this.noise(0.16, 0.09, 4200);
          this.tone(1120, 0.3, 'sawtooth', 0.03, 128);
          this.tone(78, 0.34, 'sine', 0.07, 38);
          this.noise(0.22, 0.04, 1800, 0.05);
          break;
        case 'nanman':
          this.tone(62, 0.38, 'sine', 0.1, 38);
          this.tone(78, 0.3, 'triangle', 0.055, 48, 0.12);
          this.tone(58, 0.42, 'sine', 0.08, 32, 0.28);
          this.noise(0.3, 0.045, 360, 0, 'lowpass');
          break;
        case 'wanjian':
          this.whoosh(0.28, 0.1, 500, 5600);
          this.whoosh(0.22, 0.07, 700, 4800, 0.09);
          this.whoosh(0.18, 0.05, 900, 4200, 0.18);
          this.noise(0.08, 0.035, 4300, 0.02, 'highpass');
          break;
        case 'lebu':
          this.tone(392, 0.5, 'sine', 0.025, 392);
          this.tone(466.16, 0.46, 'triangle', 0.018, 466.16, 0.05);
          this.tone(329.63, 0.55, 'sine', 0.015, 329.63, 0.14);
          this.noise(0.1, 0.01, 2200, 0.04);
          break;
        case 'bingliang':
          this.noise(0.3, 0.065, 420, 0, 'lowpass');
          this.tone(122, 0.34, 'triangle', 0.045, 48);
          this.noise(0.12, 0.03, 1600, 0.1);
          break;
        case 'wuxie':
          this.tone(880, 0.34, 'sine', 0.03, 220);
          this.tone(1320, 0.22, 'triangle', 0.016, 330, 0.03);
          this.noise(0.16, 0.04, 2600, 0.02);
          this.tone(160, 0.2, 'sine', 0.025, 70, 0.12);
          break;
        case 'equip_blade':
          this.whoosh(0.22, 0.075, 900, 3300);
          this.noise(0.12, 0.055, 3000, 0.02);
          this.tone(1460, 0.28, 'sawtooth', 0.018, 320, 0.03);
          break;
        case 'equip_sword':
          this.tone(1180, 0.42, 'triangle', 0.024, 1180);
          this.tone(1760, 0.3, 'sine', 0.016, 1760, 0.04);
          this.noise(0.18, 0.035, 3200, 0.01);
          break;
        case 'equip_bow':
          this.tone(196, 0.28, 'triangle', 0.035, 110);
          this.noise(0.12, 0.03, 2600, 0.05);
          this.tone(392, 0.4, 'sine', 0.018, 180, 0.08);
          break;
        case 'shandian':
          this.noise(0.5, 0.08, 1700, 0.02);
          this.noise(0.16, 0.16, 5600, 0.1, 'highpass');
          this.tone(48, 0.9, 'sawtooth', 0.055, 24);
          this.tone(1200, 0.25, 'square', 0.018, 100, 0.03);
          break;
        case 'egg_medical':
          this.pluck(261.63, 0.025, 0);
          this.pluck(392, 0.023, 0.12);
          this.pluck(523.25, 0.022, 0.24);
          this.pluck(783.99, 0.018, 0.36);
          this.tone(96, 0.8, 'sine', 0.08, 42);
          this.noise(0.3, 0.045, 3200, 0.08);
          break;
        case 'egg_wine':
          this.tone(64, 1.1, 'sine', 0.16, 30);
          this.tone(128, 0.65, 'triangle', 0.07, 48, 0.08);
          this.noise(0.5, 0.08, 260, 0, 'lowpass');
          this.pluck(196, 0.018, 0.2);
          this.pluck(293.66, 0.016, 0.34);
          break;
        case 'egg_massacre':
          this.tone(42, 1.35, 'sine', 0.22, 18);
          this.tone(70, 0.9, 'triangle', 0.12, 25);
          this.noise(0.7, 0.2, 150, 0, 'lowpass');
          this.noise(0.25, 0.11, 3000, 0.02);
          this.tone(980, 0.4, 'sawtooth', 0.03, 90, 0.04);
          this.noise(0.2, 0.06, 5400, 0.1, 'highpass');
          break;
        case 'slash':
          this.whoosh(0.34, 0.14, 240, 3600);
          this.noise(0.48, 0.22, 170, 0, 'lowpass');
          this.noise(0.2, 0.13, 3000, 0.01);
          this.flesh(1.18);
          this.tone(48, 0.7, 'sine', 0.23, 21);
          this.tone(76, 0.46, 'triangle', 0.12, 30);
          this.tone(980, 0.3, 'sawtooth', 0.032, 120, 0.01);
          this.tone(168, 0.2, 'square', 0.03, 76, 0.03);
          break;
        case 'swing':
          this.whoosh(0.22, 0.08, 520, 2800);
          this.noise(0.18, 0.07, 2600);
          this.tone(860, 0.2, 'sawtooth', 0.018, 200);
          this.tone(116, 0.14, 'triangle', 0.03, 58);
          break;
        case 'dodge':
          this.whoosh(0.36, 0.14, 340, 5400);
          this.noise(0.08, 0.052, 4400, 0, 'highpass');
          this.noise(0.22, 0.06, 2200, 0.04);
          this.tone(1960, 0.2, 'sine', 0.02, 360, 0.02);
          this.tone(126, 0.1, 'triangle', 0.02, 70, 0.12);
          break;
        case 'cut':
          this.whoosh(0.16, 0.12, 760, 5600);
          this.noise(0.14, 0.13, 3600, 0);
          this.noise(0.3, 0.1, 230, 0.02, 'lowpass');
          this.flesh(1.05);
          this.tone(1760, 0.12, 'sawtooth', 0.022, 210);
          this.tone(92, 0.3, 'sine', 0.1, 40, 0.02);
          this.tone(150, 0.16, 'triangle', 0.035, 72, 0.03);
          break;
        case 'impact':
          this.noise(0.22, 0.18, 170, 0.02, 'lowpass');
          this.noise(0.12, 0.12, 1500, 0, 'bandpass');
          this.tone(54, 0.42, 'sine', 0.14, 28, 0.02);
          this.tone(108, 0.24, 'triangle', 0.055, 50, 0.03);
          this.flesh(1.3);
          break;
        case 'hurt':
          this.tone(82, 0.34, 'sine', 0.115, 38);
          this.noise(0.24, 0.07, 230);
          this.tone(160, 0.1, 'triangle', 0.026, 110);
          break;
        case 'heavyHit':
          this.tone(54, 0.62, 'sine', 0.18, 26);
          this.tone(92, 0.36, 'triangle', 0.085, 42);
          this.noise(0.4, 0.155, 180, 0, 'lowpass');
          this.noise(0.13, 0.06, 2800, 0.015);
          this.tone(230, 0.12, 'square', 0.016, 108, 0.02);
          break;
        case 'heal':
          this.pluck(523.25, 0.02, 0);
          this.pluck(659.25, 0.017, 0.14);
          this.pluck(783.99, 0.014, 0.3);
          break;
        case 'peach':
          this.pluck(587.33, 0.014, 0);
          this.pluck(880, 0.01, 0.1);
          break;
        case 'judge':
          this.tone(196, 0.62, 'triangle', 0.035, 146);
          this.tone(392, 0.5, 'sine', 0.014);
          this.noise(0.4, 0.018, 720);
          break;
        case 'skill':
          this.tone(392, 0.22, 'triangle', 0.024);
          this.tone(523.25, 0.38, 'sine', 0.02);
          this.tone(783.99, 0.55, 'sine', 0.016);
          this.noise(0.12, 0.012, 2400);
          break;
        case 'turn':
          this.tone(92, 0.28, 'sine', 0.045, 58);
          this.noise(0.18, 0.02, 320);
          break;
        case 'aoe':
          this.noise(0.25, 0.06, 1400);
          this.noise(0.25, 0.04, 1800, 0.09);
          this.tone(160, 0.3, 'sawtooth', 0.012, 90);
          break;
        case 'error':
          this.tone(138, 0.14, 'square', 0.015, 120);
          break;
        case 'win':
          this.pluck(261.63, 0.02, 0);
          this.pluck(329.63, 0.018, 0.2);
          this.pluck(392, 0.017, 0.4);
          this.tone(523.25, 1.2, 'sine', 0.012, 523.25, 0.58);
          break;
        case 'lose':
          this.tone(147, 0.9, 'triangle', 0.045, 98);
          this.tone(110, 1.4, 'sine', 0.035, 73);
          this.noise(0.8, 0.02, 240);
          break;
        default: break;
      }
    },
    startAmbient: function () {
      const ctx = this.ensure();
      if (!ctx || !soundEnabled || ambient.on) return;
      ambient.on = true;
      const t0 = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.11, t0 + 2.4);
      gain.connect(masterGain);

      const nodes = [];
      // Low, breathing drone.
      [73.42, 110, 146.83].forEach(function (freq, idx) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = idx === 1 ? -4 : 3;
        filter.type = 'lowpass';
        filter.frequency.value = 310;
        g.gain.value = idx === 0 ? 0.045 : 0.014;
        osc.connect(filter);
        filter.connect(g);
        g.connect(gain);
        osc.start(t0);
        nodes.push(osc);
      });
      // Rain / paper wind.
      const len = Math.floor(ctx.sampleRate * 3.5);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i += 1) {
        const white = Math.random() * 2 - 1;
        last = last * 0.985 + white * 0.015;
        data[i] = last;
      }
      const wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 480;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.02;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(gain);
      wind.start(t0);
      nodes.push(wind);

      const self = this;
      const notes = [164.81, 196, 220, 246.94, 293.66];
      let noteIndex = 0;
      ambient.timer = setInterval(function () {
        if (!ambient.on || !soundEnabled) return;
        self.pluck(notes[noteIndex % notes.length], 0.009, 0);
        noteIndex += 1;
      }, 6200);
      ambient.gain = gain;
      ambient.nodes = nodes;
    },
    stopAmbient: function () {
      if (!ambient.on) return;
      ambient.on = false;
      if (ambient.timer) {
        clearInterval(ambient.timer);
        ambient.timer = null;
      }
      const ctx = audioCtx;
      if (ctx && ambient.gain) {
        try {
          ambient.gain.gain.cancelScheduledValues(ctx.currentTime);
          ambient.gain.gain.setValueAtTime(ambient.gain.gain.value, ctx.currentTime);
          ambient.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
        } catch (e) {}
      }
      const nodes = ambient.nodes;
      setTimeout(function () {
        nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
      }, 1200);
      ambient.nodes = [];
      ambient.gain = null;
    },
    playVoice: function (key) {
      if (!soundEnabled || !VOICE_FILES[key]) return;
      const now = Date.now();
      if (voiceLast[key] && now - voiceLast[key] < 700) return;
      voiceLast[key] = now;
      try {
        let audio = voiceCache[key];
        if (!audio) {
          audio = new Audio(VOICE_FILES[key]);
          audio.preload = 'auto';
          voiceCache[key] = audio;
        }
        audio.pause();
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, soundVolume * 0.92));
        const played = audio.play();
        if (played && played.catch) played.catch(function () {});
      } catch (e) {}
    },
    getVolume: function () {
      return soundVolume;
    },
    setVolume: function (value) {
      const v = Math.max(0, Math.min(1, Number(value)));
      if (!isFinite(v)) return soundVolume;
      soundVolume = v;
      if (masterGain) {
        try {
          masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
          masterGain.gain.setValueAtTime(soundVolume * 0.98, audioCtx.currentTime);
        } catch (e) {
          masterGain.gain.value = soundVolume * 0.98;
        }
      }
      try { localStorage.setItem('mms-volume', String(soundVolume)); } catch (e) {}
      const btn = $('#btn-volume');
      if (btn) {
        const pct = Math.round(soundVolume * 100);
        btn.title = '音效音量（调试）：' + pct + '%';
        btn.setAttribute('aria-label', '调整音效音量，当?' + pct + '%');
      }
      return soundVolume;
    },
    loadVolume: function () {
      try {
        const saved = parseFloat(localStorage.getItem('mms-volume'));
        if (isFinite(saved)) soundVolume = Math.max(0, Math.min(1, saved));
      } catch (e) {}
      this.setVolume(soundVolume);
    },
    startBgm: function (mode) {
      if (mode && (mode === 'auto' || mode === 'imported' || BGM_TRACKS[mode])) bgmMode = mode;
      return applyBgm(true);
    },
    stopBgm: function () {
      if (bgmAudio) bgmAudio.pause();
    },
    setBgmMode: function (mode) {
      bgmMode = (mode === 'auto' || mode === 'imported' || BGM_TRACKS[mode]) ? mode : 'auto';
      if (bgmMode === 'imported' && !bgmImportedUrl) bgmMode = 'auto';
      try { localStorage.setItem('mms-bgm-mode', bgmMode); } catch (e) {}
      applyBgm(true);
      return bgmMode;
    },
    setBgmContext: function (context) {
      bgmContext = (context === 'battle' || context === 'danger') ? context : 'menu';
      if (bgmMode === 'auto') applyBgm(false);
      return resolvedBgmMode();
    },
    setBgmVolume: function (value) {
      const v = Math.max(0, Math.min(1, Number(value)));
      if (!isFinite(v)) return bgmVolume;
      bgmVolume = v;
      if (bgmAudio) bgmAudio.volume = v;
      try { localStorage.setItem('mms-bgm-volume', String(v)); } catch (e) {}
      return v;
    },
    importBgm: async function (file) {
      if (!file) return false;
      if (!/^audio\//i.test(file.type || '') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name || '')) {
        UI.toast('请选择音频文件（MP3 / WAV / OGG 等）。', 'is-danger');
        return false;
      }
      if (file.size > 40 * 1024 * 1024) {
        UI.toast('音频文件过大，请选择 40MB 以内的文件。', 'is-danger');
        return false;
      }
      try {
        if (bgmImportedUrl) URL.revokeObjectURL(bgmImportedUrl);
        bgmImportedUrl = URL.createObjectURL(file);
        bgmImportedName = file.name || '本地音乐';
        bgmMode = 'imported';
        try {
          localStorage.setItem('mms-bgm-mode', 'imported');
          localStorage.setItem('mms-bgm-name', bgmImportedName);
        } catch (e) {}
        await saveBgmFile(file);
        applyBgm(true);
        UI.toast('已导入背景音乐：' + bgmImportedName, 'is-success');
        return true;
      } catch (e) {
        UI.toast('导入失败，请换一个音频文件试试。', 'is-danger');
        return false;
      }
    },
    resetBgm: function () {
      bgmMode = 'auto';
      bgmImportedName = '';
      try {
        localStorage.setItem('mms-bgm-mode', 'auto');
        localStorage.removeItem('mms-bgm-name');
      } catch (e) {}
      applyBgm(true);
      return 'auto';
    },
    getBgmInfo: function () {
      const resolved = resolvedBgmMode();
      return {
        mode: bgmMode,
        context: bgmContext,
        resolved: resolved,
        name: resolved === 'imported'
          ? (bgmImportedName || '本地音乐')
          : (BGM_TRACKS[resolved] ? BGM_TRACKS[resolved].name : BGM_TRACKS.menu.name),
        volume: bgmVolume,
        playing: !!(bgmAudio && !bgmAudio.paused),
        duration: bgmAudio && isFinite(bgmAudio.duration) ? Math.round(bgmAudio.duration) : 0,
        readyState: bgmAudio ? bgmAudio.readyState : 0
      };
    },
    toggle: function () {
      soundEnabled = !soundEnabled;
      const btn = $('#btn-sound');
      if (!soundEnabled) {
        this.stopAmbient();
        this.stopBgm();
        if (btn) {
          btn.classList.add('is-muted');
          btn.textContent = '静';
          btn.setAttribute('aria-label', '开启音效');
        }
      } else {
        if (btn) {
          btn.classList.remove('is-muted');
          btn.textContent = '声';
          btn.setAttribute('aria-label', '关闭音效');
        }
        this.play('click');
        this.startBgm();
        if ($('#screen-battle.is-active') && state && !state.over) this.startAmbient();
      }
      return soundEnabled;
    }
  };

  function resolvedBgmMode() {
    if (bgmMode === 'imported') return 'imported';
    if (bgmMode === 'auto') return BGM_TRACKS[bgmContext] ? bgmContext : 'menu';
    return BGM_TRACKS[bgmMode] ? bgmMode : 'menu';
  }

  function bgmSrc() {
    const mode = resolvedBgmMode();
    if (mode === 'imported' && bgmImportedUrl) return bgmImportedUrl;
    const track = BGM_TRACKS[mode] || BGM_TRACKS.menu;
    return track.file;
  }

  function ensureBgm() {
    if (!bgmAudio) {
      bgmAudio = new Audio();
      bgmAudio.loop = true;
      bgmAudio.preload = 'auto';
      bgmAudio.volume = Math.max(0, Math.min(1, bgmVolume));
      bgmAudio.addEventListener('error', function () {});
    }
    const src = bgmSrc();
    if (bgmAudio.getAttribute('src') !== src) bgmAudio.src = src;
    return bgmAudio;
  }

  function applyBgm(forcePlay) {
    const wasPlaying = !!(bgmAudio && !bgmAudio.paused);
    const a = ensureBgm();
    if (!a) return null;
    const src = bgmSrc();
    if (a.getAttribute('src') !== src) {
      a.src = src;
      a.load();
    }
    a.volume = Math.max(0, Math.min(1, bgmVolume));
    if (soundEnabled && (forcePlay || wasPlaying)) a.play().catch(function () {});
    return a;
  }

  function armBgmGesture() {
    if (bgmGestureArmed) return;
    bgmGestureArmed = true;
    const start = function () {
      if (!soundEnabled) return;
      const a = Sound.startBgm();
      if (a && !a.paused) {
        document.removeEventListener('pointerdown', start);
        document.removeEventListener('click', start);
      }
    };
    document.addEventListener('pointerdown', start, { passive: true });
    document.addEventListener('click', start, { passive: true });
  }

  function openBgmDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no-idb'));
      const req = window.indexedDB.open('mms-audio', 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb')); };
    });
  }

  async function saveBgmFile(file) {
    try {
      const db = await openBgmDb();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(file, 'bgm');
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error('save')); };
      });
      db.close();
    } catch (e) {}
  }

  async function loadBgmBlob() {
    try {
      const db = await openBgmDb();
      const blob = await new Promise(function (resolve, reject) {
        const tx = db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get('bgm');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('load')); };
      });
      db.close();
      return blob;
    } catch (e) {
      return null;
    }
  }

  async function loadBgmSettings() {
    try {
      const savedVol = parseFloat(localStorage.getItem('mms-bgm-volume'));
      if (isFinite(savedVol)) bgmVolume = Math.max(0, Math.min(1, savedVol));
      const savedMode = localStorage.getItem('mms-bgm-mode');
      const modeMap = {
        canye: 'auto', chengpo: 'battle',
        auto: 'auto', menu: 'menu', battle: 'battle',
        danger: 'danger', imported: 'imported'
      };
      if (savedMode && modeMap[savedMode]) bgmMode = modeMap[savedMode];
      bgmImportedName = localStorage.getItem('mms-bgm-name') || '';
    } catch (e) {}
    const storedBlob = await loadBgmBlob();
    if (storedBlob) {
      if (bgmImportedUrl) URL.revokeObjectURL(bgmImportedUrl);
      bgmImportedUrl = URL.createObjectURL(storedBlob);
      if (!bgmImportedName) bgmImportedName = '本地音乐';
    } else if (bgmMode === 'imported') {
      bgmMode = 'auto';
    }
    if (bgmAudio) {
      const wasPlaying = !bgmAudio.paused;
      bgmAudio.src = bgmSrc();
      bgmAudio.volume = bgmVolume;
      if (wasPlaying) bgmAudio.play().catch(function () {});
    }
  }

  /* =======================================================
     初始?     ======================================================= */

  function loadCheatSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('mms-cheats') || 'null');
      if (saved && typeof saved === 'object') {
        cheatSettings = Object.assign(cheatSettings, saved);
      }
    } catch (e) {}
    cheatSettings.damageMultiplier = Math.max(1, Math.min(1000, Number(cheatSettings.damageMultiplier) || 2));
    cheatSettings.extraDamage = Math.max(0, Math.min(100000, Number(cheatSettings.extraDamage) || 0));
    if (MMS.Engine && MMS.Engine.setCheats) MMS.Engine.setCheats(cheatSettings);
    UI.updateCheatButton();
  }

  UI.updateCheatButton = function () {
    const btn = $('#btn-cheats');
    if (!btn) return;
    btn.classList.toggle('is-on', !!cheatSettings.enabled);
    btn.textContent = cheatSettings.enabled ? '作弊模式 · 开' : '作弊模式';
  };

  UI.openCheatPanel = function () {
    const layer = openModalRaw({
      modalClass: 'cheat-modal',
      kicker: '开发者工具 · 酌情使用',
      title: '作弊模式',
      sub: '全部效果只作用于玩家。可以随时保存，下一局立即生效。',
      body:
        '<div class="cheat-panel">' +
          '<label class="cheat-master"><input type="checkbox" id="cheat-enabled"' + (cheatSettings.enabled ? ' checked' : '') + '><span><b>总开关</b><small>关闭后所有作弊效果失效</small></span></label>' +
          '<div class="cheat-options">' +
            '<label class="cheat-row"><input type="checkbox" id="cheat-invincible"' + (cheatSettings.invincible ? ' checked' : '') + '><span><b>无敌</b><small>玩家免疫所有伤害</small></span></label>' +
            '<label class="cheat-row"><input type="checkbox" id="cheat-unlimited"' + (cheatSettings.unlimited ? ' checked' : '') + '><span><b>出牌无限制</b><small>无距离、无【杀】次数、无手牌上限</small></span></label>' +
            '<label class="cheat-row"><input type="checkbox" id="cheat-unanswerable"' + (cheatSettings.unanswerable ? ' checked' : '') + '><span><b>出牌不可响应</b><small>玩家使用的牌不能被【闪】【无懈可击】等响应</small></span></label>' +
          '</div>' +
          '<div class="cheat-sliders">' +
            '<label class="cheat-slider"><span><b>伤害倍率</b><em id="cheat-mult-val">' + cheatSettings.damageMultiplier + '×</em></span><input id="cheat-mult" type="range" min="1" max="1000" step="1" value="' + cheatSettings.damageMultiplier + '"></label>' +
            '<label class="cheat-slider"><span><b>额外伤害</b><em id="cheat-extra-val">+' + cheatSettings.extraDamage + '</em></span><input id="cheat-extra" type="range" min="0" max="100000" step="100" value="' + cheatSettings.extraDamage + '"></label>' +
            '<div class="cheat-presets"><button type="button" data-cheat-preset="100000">一刀十万</button><button type="button" data-cheat-preset="1000">千倍伤害</button></div>' +
          '</div>' +
        '</div>',
      actions: modalButton('恢复默认', '__reset__', 'btn-ghost') + modalButton('保存', '__save__', 'btn-primary') + modalButton('取消', '__close__', 'btn-ghost'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    const mult = layer.querySelector('#cheat-mult');
    const extra = layer.querySelector('#cheat-extra');
    const paintValues = function () {
      const mv = layer.querySelector('#cheat-mult-val');
      const ev = layer.querySelector('#cheat-extra-val');
      if (mv) mv.textContent = mult.value + '×';
      if (ev) ev.textContent = '+' + extra.value;
    };
    layer.addEventListener('input', paintValues);
    layer.addEventListener('click', function (ev) {
      const preset = ev.target.closest('[data-cheat-preset]');
      if (preset) {
        mult.value = '1';
        extra.value = preset.getAttribute('data-cheat-preset');
        paintValues();
        return;
      }
      const action = ev.target.closest('[data-modal-value]');
      if (!action) return;
      const value = action.getAttribute('data-modal-value');
      if (value === '__reset__') {
        layer.querySelector('#cheat-enabled').checked = false;
        layer.querySelector('#cheat-invincible').checked = true;
        layer.querySelector('#cheat-unlimited').checked = true;
        layer.querySelector('#cheat-unanswerable').checked = false;
        mult.value = '2';
        extra.value = '0';
        paintValues();
        UI.toast('已恢复默认作弊设置，点击保存生效。', 'is-success');
        return;
      }
      if (value === '__save__') {
        cheatSettings = {
          enabled: layer.querySelector('#cheat-enabled').checked,
          invincible: layer.querySelector('#cheat-invincible').checked,
          unlimited: layer.querySelector('#cheat-unlimited').checked,
          unanswerable: layer.querySelector('#cheat-unanswerable').checked,
          damageMultiplier: Math.max(1, Math.min(1000, Number(mult.value) || 2)),
          extraDamage: Math.max(0, Math.min(100000, Number(extra.value) || 0))
        };
        try { localStorage.setItem('mms-cheats', JSON.stringify(cheatSettings)); } catch (e) {}
        if (MMS.Engine && MMS.Engine.setCheats) MMS.Engine.setCheats(cheatSettings);
        UI.updateCheatButton();
        closeModal();
        UI.toast(cheatSettings.enabled ? '作弊模式已开启。' : '作弊模式已关闭。', cheatSettings.enabled ? 'is-success' : 'is-danger');
        return;
      }
      if (value === '__close__') closeModal();
    });
  };

  UI.init = function () {
    screens = {
      title: $('#screen-title'),
      select: $('#screen-select'),
      battle: $('#screen-battle')
    };
    UI.showScreen('title');
    UI.bindGlobal();
    Sound.loadVolume();
    loadBgmSettings();
    armBgmGesture();
    UI.renderDifficulty();
    UI.renderMode();
    UI.renderRoster();
    UI.renderShowcase();
    createTooltip();
    UI.updateAchievementBar();
    loadCheatSettings();
  };

  UI.bindGlobal = function () {
    document.addEventListener('click', function (ev) {
      const archiveBtn = ev.target.closest('[data-archive-side]');
      if (archiveBtn) {
        ev.preventDefault();
        UI.openArchivePanel(archiveBtn.getAttribute('data-archive-side'));
        return;
      }
      const narrativeBtn = ev.target.closest('[data-narrative-side]');
      if (narrativeBtn) {
        ev.preventDefault();
        UI.openNarrativePanel(narrativeBtn.getAttribute('data-narrative-side'));
        return;
      }
      const btn = ev.target.closest('button');
      if (btn && !btn.disabled) Sound.play('click');
    }, true);

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (currentModal && currentModal.closeable) {
        if (currentModal.cancel) currentModal.cancel();
        else closeModal();
      }
    });

    window.addEventListener('resize', function () {
      hideTooltip();
    });
  };

  UI.showScreen = function (name) {
    Object.keys(screens).forEach(function (key) {
      if (!screens[key]) return;
      screens[key].classList.toggle('is-active', key === name);
    });
    if (name === 'select') {
      UI.renderRoster();
      UI.renderShowcase();
      UI.renderDifficulty();
    }
    Sound.setBgmContext(name === 'battle' ? 'battle' : 'menu');
  };

  UI.getState = function () { return state; };
  UI.openCustomModal = function (opts) { return openModalRaw(opts); };
  UI.modalButton = function (label, value, cls) { return modalButton(label, value, cls); };
  UI.closeModal = function () { closeModal(); };

  UI.setBattleState = function (s) {
    state = s;
    if (s) {
      selectedUid = s.selectedUid || null;
      lastHandSig = '';
      lastLogId = 0;
      UI.render(s);
    }
  };

  /* =======================================================
     择将
     ======================================================= */

  UI.getSelectedGeneralId = function () { return selectedGeneralId; };
  UI.getDifficulty = function () { return difficultyId; };
  UI.getMode = function () { return matchMode; };

  function opponentNeed() {
    return matchMode === '1v5' ? 5 : (matchMode === '1v2' ? 2 : 1);
  }

  UI.getOpponentIds = function () {
    return selectedOpponents.filter(function (id) {
      return id !== selectedGeneralId && MMS.generalById(id);
    }).slice(0, opponentNeed());
  };

  UI.setOpponents = function (ids) {
    const seen = {};
    selectedOpponents = (Array.isArray(ids) ? ids : []).filter(function (id) {
      if (seen[id] || id === selectedGeneralId || !MMS.generalById(id)) return false;
      seen[id] = true;
      return true;
    }).slice(0, opponentNeed());
    UI.renderOpponentPreview();
  };

  UI.renderOpponentPreview = function () {
    const preview = $('#opponent-preview');
    if (!preview) return;
    const ids = UI.getOpponentIds();
    const names = ids.map(function (id) {
      const g = MMS.generalById(id);
      return g ? g.name : '';
    }).filter(Boolean);
    const need = opponentNeed();
    const title = preview.querySelector('strong');
    const sub = preview.querySelector('small');
    const button = preview.querySelector('.opponent-pick');
    preview.classList.toggle('has-custom', names.length > 0);
    if (title) {
      title.textContent = names.length
        ? (names.length >= need ? names.join('、') : names.join('、') + ' · 余下随机')
        : (need === 5 ? '五名随机人机' : (need === 2 ? '两名随机人机' : '人机 · 随机武将'));
    }
    if (sub) {
      sub.textContent = names.length
        ? '已指定 ' + names.length + ' / ' + need + ' 名对手'
        : (need === 5 ? '一挑五 · 座次距离 · 坐骑栏' : (need === 2 ? '一挑二，两名对手同时在场' : '踏入乱世后揭晓'));
    }
    if (button) button.textContent = names.length ? '更换对手' : '选择对手';
  };

  UI.setMode = function (mode) {
    matchMode = mode === '1v5' ? '1v5' : (mode === '1v2' ? '1v2' : '1v1');
    selectedOpponents = selectedOpponents.slice(0, opponentNeed());
    UI.renderMode();
  };

  UI.renderMode = function () {
    const wrap = $('#match-mode');
    if (wrap) {
      wrap.querySelectorAll('[data-mode]').forEach(function (btn) {
        const active = btn.getAttribute('data-mode') === matchMode;
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-checked', String(active));
      });
    }
    UI.renderOpponentPreview();
  };

  UI.openOpponentPicker = function () {
    const need = opponentNeed();
    let draft = UI.getOpponentIds();
    const cards = MMS.GENERALS.map(function (g) {
      const self = g.id === selectedGeneralId;
      const selected = draft.indexOf(g.id) >= 0;
      return '<button class="opponent-card' + (selected ? ' is-selected' : '') + (self ? ' is-self' : '') + '"' +
        ' type="button" data-opponent="' + esc(g.id) + '"' + (self ? ' disabled' : '') + '>' +
        '<img src="' + esc(g.art) + '" alt="" style="object-position:' + esc(g.artPos) + '">' +
        '<span><b>' + esc(g.name) + '</b><small>' + esc(g.subtitle) + '</small></span>' +
        '<i>' + (self ? '当前' : '选') + '</i>' +
      '</button>';
    }).join('');
    const layer = openModalRaw({
      extraClass: 'opponent-layer',
      modalClass: 'opponent-modal',
      kicker: '对局设置 · 对手',
      title: '你想面对谁？',
      sub: '最多指定 ' + need + ' 名对手；不选或不足的部分由系统随机补足。',
      body: '<div class="opponent-grid">' + cards + '</div>' +
        '<div class="opponent-hint"><span id="opponent-pick-count">已选 0 / ' + need + '</span><small>点击武将选择或取消；玩家武将会被禁用。</small></div>',
      actions: modalButton('全随机', '__random__', 'btn-ghost') +
        modalButton('确认选择', '__confirm__', 'btn-primary') +
        modalButton('取消', '__close__', 'btn-ghost'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    const paint = function () {
      layer.querySelectorAll('[data-opponent]').forEach(function (card) {
        const id = card.getAttribute('data-opponent');
        card.classList.toggle('is-selected', draft.indexOf(id) >= 0);
      });
      const count = layer.querySelector('#opponent-pick-count');
      if (count) count.textContent = '已选 ' + draft.length + ' / ' + need + (draft.length < need ? ' · 余下随机' : '');
    };
    paint();
    layer.addEventListener('click', function (ev) {
      const card = ev.target.closest('[data-opponent]');
      if (card && !card.disabled) {
        const id = card.getAttribute('data-opponent');
        const at = draft.indexOf(id);
        if (at >= 0) draft.splice(at, 1);
        else if (draft.length >= need) {
          UI.toast('最多指定 ' + need + ' 名对手。', 'is-danger');
          return;
        } else draft.push(id);
        paint();
        return;
      }
      const action = ev.target.closest('[data-modal-value]');
      if (!action) return;
      const value = action.getAttribute('data-modal-value');
      if (value === '__random__') {
        draft = [];
        paint();
        UI.toast('已设为全随机。', 'is-success');
      } else if (value === '__confirm__') {
        UI.setOpponents(draft);
        closeModal();
      } else if (value === '__close__') {
        closeModal();
      }
    });
  };

  UI.setSelectedGeneral = function (id) {
    if (id === 'random') {
      const pool = MMS.GENERALS.filter(function (g) {
        return selectedOpponents.indexOf(g.id) < 0;
      });
      if (!pool.length) return;
      id = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (!MMS.generalById(id)) return;
    selectedGeneralId = id;
    selectedOpponents = selectedOpponents.filter(function (x) { return x !== id; });
    Sound.play('select');
    UI.renderRoster();
    UI.renderShowcase(true);
    UI.renderOpponentPreview();
  };

  UI.setDifficulty = function (id) {
    if (!MMS.difficultyById(id)) return;
    difficultyId = id;
    UI.renderDifficulty();
  };

  UI.renderDifficulty = function () {
    const wrap = $('#difficulty');
    if (!wrap) return;
    wrap.innerHTML = MMS.DIFFICULTIES.map(function (d) {
      return '<button class="diff-btn' + (d.id === difficultyId ? ' is-selected' : '') + '" type="button" data-difficulty="' + esc(d.id) + '" role="radio" aria-checked="' + (d.id === difficultyId) + '">' +
        esc(d.name) + '<small>' + esc(d.sub) + '</small></button>';
    }).join('');
  };

  UI.renderRoster = function () {
    const wrap = $('#roster');
    if (!wrap) return;
    const randomCard = '<button class="roster-card roster-random" type="button" data-general="random" role="option" aria-selected="false">' +
      '<span class="roster-art"><b class="roster-kanji">?</b></span>' +
      '<span class="roster-copy">' +
        '<strong>随机武将 <small>听天由命</small></strong>' +
        '<span>从可选武将中随机</span>' +
        '<span class="roster-hp">每次点击重新抽取</span>' +
      '</span>' +
      '<span class="roster-faction">随</span>' +
    '</button>';
    wrap.innerHTML = randomCard + MMS.GENERALS.map(function (g) {
      const selected = g.id === selectedGeneralId;
      let hpDots = '';
      for (let i = 0; i < Math.max(g.hp, 0); i += 1) hpDots += '<i></i>';
      for (let i = g.hp; i < 5; i += 1) hpDots += '<i class="off"></i>';
      return '<button class="roster-card' + (selected ? ' is-selected' : '') + '" type="button" data-general="' + esc(g.id) + '" role="option" aria-selected="' + selected + '">' +
        '<span class="roster-art"><img src="' + esc(g.art) + '" alt="" style="object-position:' + esc(g.artPos) + '"><b class="roster-kanji">' + esc(g.kanji) + '</b></span>' +
        '<span class="roster-copy">' +
          '<strong>' + esc(g.name) + ' <small>' + esc(g.subtitle) + '</small></strong>' +
          '<span>' + esc(g.work.replace(/[《》]/g, '')) + ' · ' + esc(g.title) + '</span>' +
          '<span class="roster-hp">' + hpDots + ' <em style="font-style:normal;color:rgba(210,197,172,.32);font-size:7px;margin-left:3px">体力 ' + g.hp + '</em></span>' +
        '</span>' +
        '<span class="roster-faction">' + esc(g.faction) + '</span>' +
      '</button>';
    }).join('');
  };

  UI.renderShowcase = function (animate) {
    const wrap = $('#showcase');
    if (!wrap) return;
    const g = MMS.generalById(selectedGeneralId) || MMS.GENERALS[0];
    let orbs = '';
    for (let i = 0; i < g.hp; i += 1) {
      const lost = g.startHp != null && i >= g.startHp;
      orbs += '<i class="hp-orb' + (lost ? ' lost' : '') + '"></i>';
    }
    const skills = g.skills.map(function (s) {
      return '<div class="skill-entry">' +
        '<div class="skill-name">' + esc(s.name) + '<small>' + esc(s.type) + '</small></div>' +
        '<div class="skill-desc">' + s.desc + '</div>' +
      '</div>';
    }).join('');

    wrap.classList.toggle('has-many-skills', g.skills.length > 5);
    wrap.innerHTML =
      '<div class="showcase-art">' +
        '<img src="' + esc(g.art) + '" alt="' + esc(g.name) + '" style="object-position:' + esc(g.artPos) + '">' +
        '<div class="art-kanji">' + esc(g.kanji) + '</div>' +
        '<div class="art-caption">' + esc(g.work.replace(/[《》]/g, '')) + ' · ' + esc(g.title) + '</div>' +
      '</div>' +
      '<div class="showcase-info">' +
        '<div class="showcase-head">' +
          '<div class="faction-seal ' + esc(g.factionClass) + '">' + esc(g.faction) + '</div>' +
          '<div class="showcase-name">' +
            '<span class="work">' + esc(g.work) + ' · ' + esc(g.title) + '</span>' +
            '<h2>' + esc(g.name) + '<small>' + esc(g.subtitle) + '</small></h2>' +
            '<div class="showcase-hp"><div class="hp-orbs">' + orbs + '</div> 体力 ' + g.hp + (g.startHp != null ? ' · 开局 ' + g.startHp : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="showcase-quote">' + esc(g.quote.replace(/[“”]/g, '')) + '</div>' +
        '<div class="showcase-tags">' + g.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<p class="showcase-intro">' + esc(g.intro) + '</p>' +
        '<div class="showcase-skills">' +
          '<div class="showcase-skills-head">武将技能</div>' +
          skills +
        '</div>' +
      '</div>';

    if (animate) {
      wrap.style.animation = 'none';
      void wrap.offsetWidth;
      wrap.style.animation = '';
    }
  };
  function isLastBreath(s) {
    return !!(s.player && s.player.alive !== false && s.player.hp === 1);
  }

  function ensureWoundLayer() {
    let layer = $('#wound-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'wound-layer';
    layer.className = 'wound-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML =
      '<div class="wound-glow"></div>' +
      '<i class="wound-stain s1"></i><i class="wound-stain s2"></i><i class="wound-stain s3"></i>' +
      '<i class="wound-stain s4"></i><i class="wound-stain s5"></i><i class="wound-stain s6"></i>' +
      '<i class="wound-drip d1"></i><i class="wound-drip d2"></i><i class="wound-drip d3"></i><i class="wound-drip d4"></i>';
    const screen = $('#screen-battle');
    if (screen) screen.appendChild(layer);
    return layer;
  }

  function updateWounds(s) {
    const screen = $('#screen-battle');
    if (!screen) return;
    ensureWoundLayer();
    const p = s && s.player;
    const dying = !!(p && (p.hp <= 0 || (p.flags && p.flags.dying)));
    const dead = !!(s && s.over && s.winner === 'ai');
    const low = !!(p && p.hp === 1 && !dying);
    screen.classList.toggle('is-low-hp', low);
    screen.classList.toggle('is-dying', dying);
    screen.classList.toggle('is-dead', dead);
  }

  UI.render = function (s) {
    state = s;
    if (!state) return;
    selectedUid = state.selectedUid || null;
    Sound.setBgmContext(state.over ? 'battle' : (isLastBreath(state) ? 'danger' : 'battle'));
    updateWounds(state);
    renderHeader();
    renderPanels();
    renderEnemyHand();
    renderHand();
    renderPiles();
    renderActionDock();
    renderLog();
    renderIntent();
  };

  function renderHeader() {
    const p = state.player;
    const ai = state.turn === 'ai2' && state.ai2 ? state.ai2 : state.ai;
    const isPlayer = state.turn === 'player';
    const roundEl = $('#battle-round');
    const turnEl = $('#battle-turn');
    const phaseEl = $('#battle-phase');
    if (roundEl) roundEl.textContent = '第 ' + Math.max(1, state.round) + ' 回合';
    if (turnEl) turnEl.textContent = state.over ? '终局' : (isPlayer ? '你的回合' : ai.general.name + '的回合');
    if (phaseEl) {
      phaseEl.textContent = phaseName();
      phaseEl.classList.toggle('is-danger', state.over || (state.phase === 'judge' && false));
    }

    const token = $('#turn-token');
    const tokenTitle = $('#turn-token-title');
    const tokenSub = $('#turn-token-sub');
    if (token) token.classList.toggle('is-ai', !isPlayer);
    if (tokenTitle) tokenTitle.textContent = state.over ? '终' : (isPlayer ? '你' : '敌');
    if (tokenSub) tokenSub.textContent = state.over ? '局' : phaseShort();

    const hint = $('#battle-hint');
    if (hint) hint.textContent = hintText();

    const endBtn = $('#btn-end-turn');
    if (endBtn) {
      const canEnd = isPlayer && state.phase === 'play' && !state.busy && !state.over;
      endBtn.disabled = !canEnd;
      endBtn.textContent = state.over ? '已终局' : (isPlayer ? '结束回合' : '对手回合');
    }
  }

  function phaseName() {
    if (!state) return '';
    if (state.over) return '终局';
    switch (state.phase) {
      case 'setup': return '序';
      case 'turnStart': return '回合开始';
      case 'judge': return '判定阶段';
      case 'draw': return '摸牌阶段';
      case 'play': return '出牌阶段';
      case 'discard': return '弃牌阶段';
      case 'end': return '结束阶段';
      case 'ending': return '结束回合';
      default: return '对局中';
    }
  }

  function phaseShort() {
    if (!state) return '';
    if (state.over) return '终';
    switch (state.phase) {
      case 'judge': return '判定';
      case 'draw': return '摸牌';
      case 'play': return '出牌';
      case 'discard': return '弃牌';
      case 'end': return '结束';
      case 'turnStart': return '回合';
      default: return '等待';
    }
  }

  function hintText() {
    if (!state) return '';
    if (state.over) return '牌局已经结束。';
    if (state.turn !== 'player') {
      if (state.phase === 'play') return intentText || '对手正在权衡手中的牌……';
      return '对手的' + phaseName() + '。';
    }
    if (state.phase === 'play') {
      if (state.busy) return '正在结算……';
      return '选择手牌，或点击武将技能。';
    }
    if (state.phase === 'discard') return '手牌超出上限，请弃牌。';
    if (state.phase === 'judge') return '判定中，听天由命。';
    if (state.phase === 'draw') return '正在摸牌……';
    return phaseName() + '。';
  }

  function renderPanels() {
    const player = $('#player-panel');
    const seat = document.querySelector('.enemy-seat');
    const list = (state.ais && state.ais.length) ? state.ais : [state.ai, state.ai2, state.ai3, state.ai4, state.ai5].filter(Boolean);
    const five = state.mode === '1v5' && list.length > 1;
    const two = state.mode === '1v2' && list.length > 1;
    if (seat) {
      seat.classList.toggle('has-two', two);
      seat.classList.toggle('has-five', five);
    }
    ['#enemy-panel', '#enemy2-panel', '#enemy3-panel', '#enemy4-panel', '#enemy5-panel'].forEach(function (sel, idx) {
      const el = $(sel);
      if (!el) return;
      const p = list[idx];
      el.hidden = !p || (!five && !two && idx > 0);
      el.innerHTML = p && !el.hidden ? panelHTML(p, true) : '';
    });
    if (player) player.innerHTML = panelHTML(state.player, false);
  }

  function panelHTML(p, isAI) {
    const hpOrbs = [];
    for (let i = 0; i < p.maxHp; i += 1) {
      hpOrbs.push('<i class="hp-orb' + (i >= p.hp ? ' lost' : '') + '"></i>');
    }
    const markChips = markHTML(p);
    const judgeChips = p.judge.map(function (c) {
      return '<span class="judge-token" title="' + esc(c.desc) + '">' + esc(c.name) + '</span>';
    }).join('');
    const weaponChip = '<div class="panel-weapon' + (p.weapon ? '' : ' is-empty') + '" title="' + esc(p.weapon ? p.weapon.desc : '尚未装备武器') + '"><span>武器</span><b>' + esc(p.weapon ? p.weapon.name : '无') + '</b></div>';
    const armorChip = '<div class="panel-weapon panel-armor' + (p.armor ? '' : ' is-empty') + '" title="' + esc(p.armor ? p.armor.desc : '尚未装备防具') + '"><span>防具</span><b>' + esc(p.armor ? p.armor.name : '无') + '</b></div>';
    const distanceText = (isAI && state.mode === '1v5' && MMS.Engine && MMS.Engine.distanceBetween)
      ? '距离 ' + MMS.Engine.distanceBetween(state.player, p)
      : '';
    const mountChip = (state.mode === '1v5')
      ? '<div class="panel-mounts"><span>进 ' + esc(p.mounts && p.mounts.offense ? p.mounts.offense.name : '无') + '</span><span>防 ' + esc(p.mounts && p.mounts.defense ? p.mounts.defense.name : '无') + '</span></div>'
      : '';
    const archiveChip = (p.general.id === 'suishi_shumo' || (Array.isArray(p.archive) && p.archive.length))
      ? '<button class="panel-archive" type="button" data-archive-side="' + esc(p.side) + '">简牍 <b>' + (p.archive ? p.archive.length : 0) + '</b><span>查看</span></button>'
      : '';
    const narrativeChip = (p.general.id === 'changxuanling' || (Array.isArray(p.narrative) && p.narrative.length))
      ? '<button class="panel-archive panel-narrative" type="button" data-narrative-side="' + esc(p.side) + '">叙事 <b>' + (p.narrative ? p.narrative.length : 0) + '</b><span>查看</span></button>'
      : '';

    const skillChips = p.general.skills.map(function (skill) {
      const st = MMS.Engine ? MMS.Engine.getSkillState(p, skill.id) : { usable: false, used: false, gained: true, lost: false };
      const classes = ['skill-chip'];
      if (st.active && st.usable) classes.push('is-active');
      if (!st.gained) classes.push('is-dormant');
      if (st.lost) classes.push('is-lost');
      if (st.used && !st.lost) classes.push('is-spent');
      return '<button class="' + classes.join(' ') + '" type="button" data-side="' + p.side + '" data-skill="' + esc(skill.id) + '" title="' + esc(skill.desc) + '">' + esc(skill.name) + '</button>';
    }).join('');

    return '<div class="panel-portrait"><div class="panel-art"><img src="' + esc(p.general.art) + '" alt="' + esc(p.general.name) + '" style="object-position:' + esc(p.general.artPos) + '"><b class="panel-kanji">' + esc(p.general.kanji) + '</b></div></div>' +
      '<div class="panel-status">' +
      '<div class="panel-topline">' +
        '<div class="panel-faction ' + esc(p.general.factionClass) + '">' + esc(p.general.faction) + '</div>' +
        '<div class="panel-side-tag">' + (isAI ? '敌将' : '我将') + '</div>' +
        '<div class="panel-handcount">手牌 <b>' + p.hand.length + '</b></div>' +
      '</div>' +
      '<div class="panel-body">' +
        '<div class="panel-title-row"><h3>' + esc(p.general.name) + '</h3><span class="panel-sub">' + esc(p.general.subtitle) + '</span></div>' +
        '<div class="panel-hp-row">' +
          '<div class="hp-orbs">' + hpOrbs.join('') + '</div>' +
          '<span class="panel-hp-text">' + Math.max(0, p.hp) + ' / ' + p.maxHp + '</span>' +
          (distanceText ? '<span class="panel-distance">' + esc(distanceText) + '</span>' : '') +
          (isAI ? '' : '<span class="panel-max-hp-note">手牌上限 ' + MMS.Engine.handLimit(p) + '</span>') +
        '</div>' +
        (markChips ? '<div class="panel-marks">' + markChips + '</div>' : '') +
        '<div class="panel-gear">' + weaponChip + armorChip + mountChip + '</div>' +
        archiveChip +
        narrativeChip +
        (judgeChips ? '<div class="panel-judge">' + judgeChips + '</div>' : '') +
        '<div class="panel-skills">' + skillChips + '</div>' +
      '</div>' +
      '</div>' +
      (p.alive ? '' : '<div class="panel-dead"><span>殁</span></div>');
  }

  function markHTML(p) {
    const chips = [];
    const gid = p.general.id;
    if (gid === 'mansui_sheng' || (p.marks.hen || 0) > 0) {
      chips.push('<span class="mark-chip mark-hen">恨<b>' + (p.marks.hen || 0) + '</b></span>');
    }
    if (gid === 'mansui_gongsheng' || gid === 'mansui_gongsi' || (p.marks.sui || 0) > 0) {
      chips.push('<span class="mark-chip">穗<b>' + (p.marks.sui || 0) + '</b></span>');
    }
    if (gid === 'fangzhiyou' || (p.marks.yi || 0) > 0) {
      chips.push('<span class="mark-chip mark-yi">忆<b>' + (p.marks.yi || 0) + '</b></span>');
    }
    if (gid === 'suishi_shumo' || (p.marks.mo || 0) > 0) {
      chips.push('<span class="mark-chip mark-mo">墨<b>' + (p.marks.mo || 0) + '</b></span>');
    }
    if (gid === 'changxuanling' || (p.marks.xu || 0) > 0) {
      chips.push('<span class="mark-chip mark-xu">叙<b>' + (p.marks.xu || 0) + '</b></span>');
    }
    if (gid === 'manhe' || (p.marks.yuan || 0) > 0) {
      chips.push('<span class="mark-chip mark-yuan" title="缘 / 穗锁资源">缘<b>' + (p.marks.yuan || 0) + '</b></span>');
    }
    if (gid === 'manhe' || (p.lifeZone && p.lifeZone.length)) {
      chips.push('<span class="mark-chip mark-yusheng" title="余生区 / 已封存牌">余生<b>' + ((p.lifeZone || []).length) + '</b></span>');
    }
    if (gid === 'wangyou' || (p.marks.kuang || 0) > 0) {
      chips.push('<span class="mark-chip mark-kuang" title="狂 / 吸血层数">狂<b>' + (p.marks.kuang || 0) + '</b></span>');
    }
    if (gid === 'wangyou' && p.flags && p.flags.buquSuits && p.flags.buquSuits.length) {
      const suitMap = { heart: '♥', diamond: '♦', club: '♣', spade: '♠' };
      chips.push('<span class="mark-chip mark-buqu" title="不屈已记录花色">不屈<b>' + p.flags.buquSuits.map(function (x) { return suitMap[x] || '?'; }).join('') + '</b></span>');
    }
    if (gid === 'laofang' || (p.marks.ma || 0) > 0) {
      chips.push('<span class="mark-chip mark-ma" title="妈 / 尼酱层数">妈<b>' + (p.marks.ma || 0) + '</b></span>');
    }
    if (gid === 'lanfeiyu' || (p.marks.fan || 0) > 0) {
      chips.push('<span class="mark-chip mark-fan" title="大白饭 / Token">饭<b>' + (p.marks.fan || 0) + '</b></span>');
    }
    if (p.flags && p.flags.hungry) chips.push('<span class="mark-chip mark-hungry">饥</span>');
    if (p.flags && p.flags.tongluSide) chips.push('<span class="mark-chip mark-tonglu">同路</span>');
    if (p.flags && p.flags.tizaiAnchorSide) chips.push('<span class="mark-chip mark-tizai">替灾</span>');
    if (p.flags && p.flags.noShanTurn) chips.push('<span class="mark-chip mark-noshan">封闪</span>');
    return chips.join('');
  }

  function renderEnemyHand() {
    const wrap = $('#enemy-hand');
    if (!wrap) return;
    const n = Math.min(state.ai.hand.length, 8);
    let html = '';
    for (let i = 0; i < n; i += 1) {
      html += '<i class="mini-back" style="--r:' + ((i - (n - 1) / 2) * 4) + 'deg"></i>';
    }
    wrap.innerHTML = html;
  }

  function renderHand() {
    const wrap = $('#player-hand');
    if (!wrap) return;
    const p = state.player;
    if (!p.hand.length) {
      wrap.innerHTML = '<div class="empty-hand">手中空无一物，乱世却在眼前。</div>';
      lastHandSig = 'empty';
      return;
    }

    const sig = p.hand.map(function (c) { return c.uid; }).join(',') + '|' + selectedUid + '|' + state.busy + '|' + state.phase + '|' + p.flags.slashUsed + '|' + p.hp + '|' + p.maxHp;
    if (sig === lastHandSig) return;
    lastHandSig = sig;

    wrap.innerHTML = p.hand.map(function (card, i) {
      const playable = MMS.Engine.canPlay(card, p);
      const selected = card.uid === selectedUid;
      const isNew = newUids.has(card.uid);
      const classes = ['card'];
      if (card.color === 'red') classes.push('red-suit');
      if (card.color === 'black') classes.push('black-suit');
      if (!playable.ok) classes.push('is-disabled');
      if (selected) classes.push('is-selected');
      if (isNew) classes.push('is-new');
      return handCardHTML(card, {
        index: i,
        classes: classes.join(' '),
        uid: card.uid,
        selected: selected
      });
    }).join('');
    newUids.clear();
  }

  function handCardHTML(card, opts) {
    opts = opts || {};
    const isSingle = card.name.length === 1;
    const nameClass = isSingle ? 'card-name' : 'card-name-small';
    return '<button class="' + (opts.classes || 'card') + '" type="button" data-uid="' + esc(card.uid) + '" style="--i:' + (opts.index || 0) + '" aria-label="' + esc(card.name + ' ' + card.suitName + card.rankLabel) + '">' +
      (card.art ? '<span class="card-art" style="background-image:url(&quot;' + esc(card.art) + '&quot;)"></span>' : '') +
      '<span class="corner"><span class="suit">' + esc(card.suitSymbol) + '</span>' + esc(card.rankLabel) + '</span>' +
      '<span class="corner-rank">' + esc(card.rankLabel) + '</span>' +
      '<span class="card-type">' + esc(card.typeLabel) + '</span>' +
      '<span class="watermark">' + esc(card.seal) + '</span>' +
      '<span class="' + nameClass + '">' + Array.from(card.name).map(function (ch) { return '<span>' + esc(ch) + '</span>'; }).join('') + '</span>' +
      '<span class="card-glyph">' + esc(card.glyph) + '</span>' +
      '<span class="card-corner-seal">' + esc(card.seal) + '</span>' +
      '<span class="card-flavor">' + esc(card.flavor || '') + '</span>' +
    '</button>';
  }

  function renderPiles() {
    const deck = $('#deck-count');
    const discard = $('#discard-count');
    const deckPile = $('#deck-pile');
    const deckLabel = deckPile ? deckPile.querySelector('small') : null;
    if (state.wastelandActive) {
      if (deck) deck.textContent = (state.wasteland || []).length;
      if (deckLabel) deckLabel.textContent = '荒仓';
      if (deckPile) deckPile.title = '荒仓：所有角色共用的牌堆';
    } else {
      if (deck) deck.textContent = state.deck.length;
      if (deckLabel) deckLabel.textContent = '牌堆';
    }
    if (discard) discard.textContent = state.discard.length;
  }

  function renderActionDock() {
    const kicker = $('#action-kicker');
    const title = $('#action-title');
    const desc = $('#action-desc');
    const useBtn = $('#btn-use-card');
    const cancelBtn = $('#btn-cancel-card');
    if (!kicker || !title || !desc || !useBtn || !cancelBtn) return;

    const p = state.player;
    const card = selectedUid ? p.hand.find(function (c) { return c.uid === selectedUid; }) : null;
    const canAct = state.turn === 'player' && state.phase === 'play' && !state.busy && !state.over;

    useBtn.disabled = true;
    cancelBtn.disabled = !card;
    useBtn.textContent = '使用';

    if (state.over) {
      kicker.textContent = '终局';
      title.textContent = state.winner === 'player' ? '你活了下来' : '你倒在了乱世里';
      desc.textContent = '这一局已经结束';
      useBtn.disabled = true;
      cancelBtn.disabled = true;
      return;
    }

    if (!canAct) {
      kicker.textContent = state.turn !== 'player' ? '对手回合' : phaseName();
      title.textContent = state.turn !== 'player' ? (intentText || '对手正在思') : '结算中…';
      desc.textContent = state.turn !== 'player' ? '等待对手结束回合' : '请稍';
      useBtn.disabled = true;
      cancelBtn.disabled = true;
      return;
    }

    if (!card) {
      kicker.textContent = '你的回合 · ' + phaseName();
      title.textContent = '选择一张手';
      desc.textContent = '点击手牌查看效果，也可以点击武将技能';
      desc.className = '';
      return;
    }

    const check = MMS.Engine.canPlay(card, p);
    kicker.textContent = card.typeLabel + ' · ' + card.suitName + card.rankLabel;
    title.textContent = card.name;
    desc.textContent = check.ok ? card.desc : check.reason;
    desc.className = check.ok ? 'is-ok' : 'is-warn';
    useBtn.disabled = !check.ok;
    useBtn.textContent = check.ok && check.target && check.target.side !== 'player' ? '对敌使用' : '使用';
    cancelBtn.disabled = false;
  }

  function renderLog() {
    const list = $('#log-list');
    if (!list) return;
    if (lastLogId === 0 || !list.children.length) {
      list.innerHTML = '';
      lastLogId = 0;
    }
    const newEntries = state.log.filter(function (item) { return item.id > lastLogId; });
    if (newEntries.length) {
      newEntries.forEach(function (item) {
        const li = document.createElement('li');
        li.className = 'log-item ' + (item.cls || 'log-system');
        li.innerHTML = item.html;
        list.appendChild(li);
      });
      lastLogId = newEntries[newEntries.length - 1].id;
      while (list.children.length > 110) list.removeChild(list.firstChild);
      list.scrollTop = list.scrollHeight;
    }
  }

  function renderIntent() {
    const el = $('#enemy-intent');
    if (!el) return;
    el.textContent = intentText || '';
    el.classList.toggle('is-visible', !!intentText && state && state.turn !== 'player' && !state.over);
  }

  UI.setIntent = function (text) {
    intentText = text || '';
    renderIntent();
    const hint = $('#battle-hint');
    if (hint && state && state.turn !== 'player') hint.textContent = intentText || hintText();
    const desc = $('#action-title');
    if (desc && state && state.turn !== 'player' && state.phase === 'play') desc.textContent = intentText || '对手正在思';
  };

  UI.setHint = function (text) {
    const hint = $('#battle-hint');
    if (hint) hint.textContent = text;
  };

  /* =======================================================
     卡牌悬停
     ======================================================= */

  function createTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'card-tooltip';
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', function (ev) {
      const cardEl = ev.target.closest('#player-hand .card');
      if (!cardEl || !state) return;
      const uid = cardEl.getAttribute('data-uid');
      const card = state.player.hand.find(function (c) { return c.uid === uid; });
      if (!card) return;
      const check = MMS.Engine.canPlay(card, state.player);
      tooltipEl.innerHTML = '<strong>' + esc(card.name) + '</strong>' +
        '<small>' + esc(card.typeLabel) + ' · ' + esc(card.suitName) + esc(card.rankLabel) + '</small>' +
        esc(card.desc) +
        '<div style="margin-top:7px;color:' + (check.ok ? 'rgba(155,182,168,.8)' : 'rgba(201,114,91,.8)') + '">' + esc(check.ok ? '可以使用' : check.reason) + '</div>';
      tooltipEl.classList.add('is-visible');
      positionTooltip(cardEl);
    });

    document.addEventListener('mouseout', function (ev) {
      if (ev.target.closest('#player-hand .card')) hideTooltip();
    });

    document.addEventListener('mousemove', function (ev) {
      if (!tooltipEl || !tooltipEl.classList.contains('is-visible')) return;
      const cardEl = ev.target.closest('#player-hand .card');
      if (cardEl) positionTooltip(cardEl);
    });
  }

  function positionTooltip(cardEl) {
    if (!tooltipEl) return;
    const r = cardEl.getBoundingClientRect();
    const tw = 240;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(12, Math.min(window.innerWidth - tw - 12, left));
    const top = Math.max(12, r.top - 170);
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('is-visible');
  }

  /* =======================================================
     弹窗基础设施
     ======================================================= */

  function openModalRaw(config) {
    const root = $('#modal-root');
    if (!root) return null;
    closeModal();
    const layer = document.createElement('div');
    layer.className = 'modal-layer' + (config.extraClass ? ' ' + config.extraClass : '');
    layer.innerHTML = '<div class="modal ' + (config.modalClass || '') + '" role="dialog" aria-modal="true">' +
      (config.kicker ? '<div class="modal-kicker">' + config.kicker + '</div>' : '') +
      (config.title ? '<h2>' + config.title + '</h2>' : '') +
      (config.sub ? '<div class="modal-sub">' + config.sub + '</div>' : '') +
      (config.body ? '<div class="modal-body">' + config.body + '</div>' : '') +
      '<div class="modal-actions">' + (config.actions || '') + '</div>' +
    '</div>';
    root.innerHTML = '';
    root.appendChild(layer);
    currentModal = {
      layer: layer,
      closeable: config.closeable !== false,
      cancel: config.cancel || null
    };
    if (currentModal.closeable) {
      layer.addEventListener('click', function (ev) {
        if (ev.target === layer) {
          if (currentModal.cancel) currentModal.cancel();
          else closeModal();
        }
      });
    }
    requestAnimationFrame(function () { layer.classList.add('is-open'); });
    return layer;
  }

  function closeModal() {
    const root = $('#modal-root');
    if (!root) return;
    const layer = root.querySelector('.modal-layer');
    if (layer) {
      layer.classList.remove('is-open');
      const modal = layer.querySelector('.modal');
      if (modal) {
        setTimeout(function () {
          if (root.contains(layer)) layer.remove();
        }, 300);
      } else {
        layer.remove();
      }
    }
    currentModal = null;
    currentResolve = null;
  }

  UI.closeModal = closeModal;

  function modalButton(label, value, cls, disabled) {
    return '<button class="btn ' + (cls || 'btn-ghost') + '" type="button" data-modal-value="' + esc(value) + '"' + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  /* =======================================================
     选项弹窗
     ======================================================= */

  UI.choose = function (config) {
    config = config || {};
    return new Promise(function (resolve) {
      const optionsHtml = (config.options || []).map(function (opt) {
        return '<button class="choice-btn" type="button" data-modal-value="' + esc(opt.value) + '"' + (opt.disabled ? ' disabled' : '') + '>' +
          '<span class="choice-key">' + (opt.key || '·') + '</span>' +
          '<span class="choice-copy"><strong>' + esc(opt.label) + '</strong>' + (opt.desc ? '<small>' + esc(opt.desc) + '</small>' : '') + '</span>' +
        '</button>';
      }).join('');
      const actions = config.cancelable === false ? '' : modalButton(config.cancelLabel || '取消', '__cancel__', 'btn-ghost');
      const layer = openModalRaw({
        kicker: config.kicker || '抉择',
        title: config.title || '',
        sub: config.sub || '',
        body: (config.body || '') + '<div class="choice-list">' + optionsHtml + '</div>',
        actions: actions,
        closeable: config.cancelable !== false,
        cancel: function () { finish(null); }
      });
      if (!layer) { resolve(null); return; }

      function finish(value) {
        currentResolve = null;
        closeModal();
        resolve(value);
      }
      layer.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-modal-value]');
        if (!btn || btn.disabled) return;
        const value = btn.getAttribute('data-modal-value');
        if (value === '__cancel__') finish(null);
        else finish(value);
      });
      currentResolve = finish;
    });
  };

  /* =======================================================
     选牌弹窗
     ======================================================= */

  UI.pickCards = function (config) {
    config = config || {};
    return new Promise(function (resolve) {
      const cards = config.cards || [];
      const min = config.min == null ? 1 : config.min;
      const max = config.max == null ? 1 : config.max;
      const confirmLabel = config.confirmLabel || '确认';
      const cancelable = config.cancelable !== false;
      const faceDown = !!config.faceDown;
      const cardsHtml = cards.map(function (c, index) {
        if (faceDown) {
          return '<div class="pick-card hidden-pick" data-pick-uid="' + esc(c.uid) + '" role="button" tabindex="0" aria-label="未公开手牌 ' + (index + 1) + '">' +
            '<span class="card card-back"></span>' +
            '<span class="hidden-slot">手牌 ' + (index + 1) + '</span>' +
          '</div>';
        }
        return '<div class="pick-card" data-pick-uid="' + esc(c.uid) + '" role="button" tabindex="0" aria-label="' + esc(c.name) + '">' + handCardHTML(c, { classes: 'card' }) + '</div>';
      }).join('');

      const actions = '<button class="btn btn-primary" type="button" data-pick-confirm disabled>' + esc(confirmLabel) + '</button>' +
        (cancelable ? modalButton(config.cancelLabel || '取消', '__cancel__', 'btn-ghost') : '');

      const layer = openModalRaw({
        kicker: config.kicker || '选择',
        title: config.title || '',
        sub: config.sub || '',
        body: '<div class="modal-cards' + (faceDown ? ' is-facedown' : '') + '">' + cardsHtml + '</div>' +
          '<div class="pick-meta"><span>' + (config.hint || '点击卡牌选择') + '</span><span class="pick-count">已?0 / ' + min + '</span></div>' +
          '<div class="pick-error"></div>',
        actions: actions,
        closeable: cancelable,
        cancel: function () { finish(null); }
      });
      if (!layer) { resolve(null); return; }

      const selected = new Set();
      const countEl = layer.querySelector('.pick-count');
      const errorEl = layer.querySelector('.pick-error');
      const confirmBtn = layer.querySelector('[data-pick-confirm]');

      function finish(value) {
        currentResolve = null;
        closeModal();
        resolve(value);
      }

      function refresh() {
        if (countEl) countEl.textContent = '已?' + selected.size + ' / ' + min;
        let error = '';
        if (selected.size < min) error = '还需选择 ' + (min - selected.size) + ' ';
        else if (selected.size > max) error = '最多选择 ' + max + ' ';
        else if (config.validate) error = config.validate(Array.from(selected)) || '';
        if (errorEl) errorEl.textContent = error;
        if (confirmBtn) confirmBtn.disabled = !!error || selected.size < min;
      }

      layer.addEventListener('click', function (ev) {
        const cardEl = ev.target.closest('[data-pick-uid]');
        if (cardEl) {
          const uid = cardEl.getAttribute('data-pick-uid');
          if (selected.has(uid)) {
            selected.delete(uid);
            cardEl.classList.remove('is-picked');
          } else {
            if (selected.size >= max) {
              if (max === 1) {
                selected.clear();
                $$('.pick-card.is-picked', layer).forEach(function (el) { el.classList.remove('is-picked'); });
              } else {
                if (errorEl) errorEl.textContent = '最多选择 ' + max + ' ';
                return;
              }
            }
            selected.add(uid);
            cardEl.classList.add('is-picked');
          }
          refresh();
          return;
        }
        const confirm = ev.target.closest('[data-pick-confirm]');
        if (confirm && !confirm.disabled) {
          finish(Array.from(selected));
          return;
        }
        const cancel = ev.target.closest('[data-modal-value="__cancel__"]');
        if (cancel) finish(null);
      });

      layer.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const cardEl = ev.target.closest('[data-pick-uid]');
        if (!cardEl) return;
        ev.preventDefault();
        cardEl.click();
      });

      refresh();
      currentResolve = finish;
    });
  };

  /* =======================================================
     响应弹窗
     ======================================================= */

  UI.askResponse = function (config) {
    config = config || {};
    return new Promise(function (resolve) {
      const cards = config.cards || [];
      const extras = config.extras || [];
      const cardsHtml = cards.map(function (item) {
        return '<div class="pick-card response-card" data-response-uid="' + esc(item.card.uid) + '" data-response-via="' + esc(item.via || '') + '" role="button" tabindex="0">' +
          handCardHTML(item.card, { classes: 'card' }) +
          '<span class="response-tag">' + esc(item.label || '打出') + '</span>' +
        '</div>';
      }).join('');
      const extraHtml = extras.map(function (x) {
        return '<button class="choice-btn" type="button" data-response-extra="' + esc(x.value) + '">' +
          '<span class="choice-key">' + (x.key || '·') + '</span><span class="choice-copy"><strong>' + esc(x.label) + '</strong><small>' + esc(x.desc || '') + '</small></span>' +
        '</button>';
      }).join('');
      const cancelLabel = config.cancelLabel || '不出';
      const layer = openModalRaw({
        kicker: config.kicker || '响应',
        title: config.title || '',
        sub: config.sub || '',
        body: (cards.length ? '<div class="response-cards">' + cardsHtml + '</div>' : '<div class="modal-body" style="margin-top:8px;color:rgba(210,197,172,.38)">没有可以打出的牌。</div>') +
          (extraHtml ? '<div class="response-extra">' + extraHtml + '</div>' : ''),
        actions: modalButton(cancelLabel, '__cancel__', 'btn-ghost'),
        closeable: true,
        cancel: function () { finish({ type: 'none' }); }
      });
      if (!layer) { resolve({ type: 'none' }); return; }

      function finish(value) {
        currentResolve = null;
        closeModal();
        resolve(value);
      }

      layer.addEventListener('click', function (ev) {
        const cardEl = ev.target.closest('[data-response-uid]');
        if (cardEl) {
          const uid = cardEl.getAttribute('data-response-uid');
          const via = cardEl.getAttribute('data-response-via') || null;
          const item = cards.find(function (x) { return x.card.uid === uid; });
          if (item) finish({ type: 'card', card: item.card, via: via });
          return;
        }
        const extraEl = ev.target.closest('[data-response-extra]');
        if (extraEl) {
          finish({ type: 'skill', value: extraEl.getAttribute('data-response-extra') });
          return;
        }
        const cancel = ev.target.closest('[data-modal-value="__cancel__"]');
        if (cancel) finish({ type: 'none' });
      });

      layer.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const cardEl = ev.target.closest('[data-response-uid]');
        if (!cardEl) return;
        ev.preventDefault();
        cardEl.click();
      });

      currentResolve = finish;
    });
  };

  /* =======================================================
     技能说?     ======================================================= */

  UI.openSkillModal = function (side, skillId) {
    if (!state) return;
    const p = side === 'ai2' ? state.ai2 : (side === 'ai' ? state.ai : state.player);
    const skill = p.general.skills.find(function (s) { return s.id === skillId; });
    if (!skill) return;
    const st = MMS.Engine.getSkillState(p, skillId);
    let status = '';
    if (st.lost) status = '<em>此技能已失去。</em>';
    else if (!st.gained) status = '尚未觉醒或获得';
    else if (st.active && st.used) status = '本回合已经发动过';
    else if (st.active && !st.usable) status = esc(st.reason || '当前无法发动');
    else if (st.active) status = '可以在出牌阶段发动';
    else status = '满足条件时自动触发';

    const canAct = side === 'player' && st.active && st.usable && state.turn === 'player' && state.phase === 'play' && !state.busy && !state.over;
    const actions = (canAct ? '<button class="btn btn-primary" type="button" data-skill-act="' + esc(skillId) + '">发动【' + esc(skill.name) + '】</button>' : '') +
      '<button class="btn btn-ghost" type="button" data-modal-close>知道了</button>';

    const layer = openModalRaw({
      kicker: (side !== 'player' ? '对手技能' : '你的技能') + ' · ' + esc(skill.type),
      title: '',
      body: '<div class="skill-modal-head"><div class="skill-glyph">' + esc(skill.name.charAt(0)) + '</div><div><h2>' + esc(skill.name) + '</h2><div class="skill-type">' + esc(skill.type) + '</div></div></div>' +
        '<p style="margin-top:16px;color:rgba(210,197,172,.55);line-height:1.85">' + skill.desc + '</p>' +
        '<p style="margin-top:10px;color:rgba(210,197,172,.4);line-height:1.8">' + skill.detail + '</p>' +
        '<p style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(210,197,172,.1);color:rgba(185,154,99,.7)">' + status + '</p>',
      actions: actions,
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    layer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-modal-close]')) {
        closeModal();
        return;
      }
      const act = ev.target.closest('[data-skill-act]');
      if (act) {
        const id = act.getAttribute('data-skill-act');
        closeModal();
        Sound.play('skill');
        MMS.Engine.humanActivateSkill(id);
      }
    });
  };

  /* =======================================================
     规则
     ======================================================= */

  UI.openChangelog = function () {
    const entries = [
      {
        v: 'Ver.0.90', date: '2026.11', title: '穗禾 · Ver.0.90',
        items: [
          '新增武将【满禾 · 穗禾良缘】，体力3，缘分/余生/封技/觉醒体系。',
          '【穗锁】以缘封存手牌，永久削减他人体力上限；【余生】每回合清空判定区。',
          '【良缘】按余生牌数封技、清空手牌装备或直接索命。',
          '【执念】觉醒后每回合从免缘交换、无敌跳摸、伤害+2跳弃中选择。'
        ]
      },
      {
        v: 'Ver.0.82', date: '2026.11', title: '护身 · Ver.0.82',
        items: [
          '修复忘忧【护身】发动后体力上限不扣除的问题。',
          '根因：体力上限扣除函数的结束条件写反，未结束的牌局反而直接返回。',
          '同一修复也恢复【血魔】扣除体力上限分支。'
        ]
      },
      {
        v: 'Ver.0.81', date: '2026.11', title: '觉醒 · Ver.0.81',
        items: [
          '修复牢方【杂鱼】触发后尼酱、萝莉丢失的问题。',
          '尼酱、萝莉改为牢方的休眠技：杂鱼觉醒后解锁，技能栏与被动/主动效果均正常生效。'
        ]
      },
      {
        v: 'Ver.0.80', date: '2026.11', title: '忘忧 · Ver.0.80',
        items: [
          '新增武将【忘忧 · 吸血之鬼】，2点体力开局、5点体力上限。',
          '新增吸血、嗜血、血魔、护身、不屈五个技能与“狂”标记。',
          '新增26个击杀成就：血食穗门、穗斩忘忧，并加入血食/碎镜两套全新全屏演出。'
        ]
      },
      {
        v: 'Ver.0.71', date: '2026.11', title: '杂口 · Ver.0.71',
        items: [
          '为牢方加入专属语音：主动技能/出牌播放杂口.mp3。',
          '牢方被动触发（杂鱼、尼酱十位变化）或被挡技能播放欧尼酱.mp3。',
          '语音沿用音效音量与静音开关；同名语音有700ms防刷屏间隔。'
        ]
      },
      {
        v: 'Ver.0.70', date: '2026.11', title: '抽象 · Ver.0.70',
        items: [
          '新增武将【牢方 · 抽象芳容】，体力3。',
          '【猎奇】：观看牌堆顶8张、调整顺序，然后依次使用前X张（体力+手牌数）。',
          '【杂鱼】：首次濒死按本局濒死次数回复体力，并将等量雷电劈向一名角色，获得尼酱/萝莉。',
          '【尼酱】：使用或打出牌累积“妈”，十位数变化时获得对应点数牌。',
          '【萝莉】：弃基本牌，让所有其他角色进行等同于“妈”个位数的闪电判定。'
        ]
      },
      {
        v: 'Ver.0.64', date: '2026.11', title: '梁圣 · Ver.0.64',
        items: [
          '蓝色大肥鱼新增【梁圣赐饭】：大白饭上限提升至8枚，每回合首次干饭额外+1。',
          '蓝色大肥鱼台词与简介加入“梁圣”彩蛋。',
          '六技能武将选将面板启用多技能紧凑布局。'
        ]
      },
      {
        v: 'Ver.0.63', date: '2026.11', title: '大白饭 · Ver.0.63',
        items: [
          '蓝色大肥鱼新增资源“大白饭”（Token），战斗面板显示“饭”标记。',
          '新增【干饭】：摸牌后获得大白饭，每回合最多2枚，上限6枚。',
          '新增【暴食】：消耗3枚大白饭摸2回1；满6枚时消耗6枚，摸3回1并重置求索。'
        ]
      },
      {
        v: 'Ver.0.62', date: '2026.11', title: '肥鱼 · Ver.0.62',
        items: [
          '武将【蓝肥鱼】更名为【蓝色大肥鱼】。',
          '【算力】新增：每回合首次使用锦囊牌后摸1张。',
          '【求索】改为观看4张、获得2张；两张类型不同再摸1张。',
          '【深潜】改为回复至3点、摸3张，重置求索并使下次求索多拿1张。'
        ]
      },
      {
        v: 'Ver.0.61', date: '2026.11', title: '战绩 · Ver.0.61',
        items: [
          '蓝肥鱼立绘更新为用户提供的完整蓝色鱼娘原画。',
          '新增历史战绩：记录胜负、武将、模式、难度、回合与关键数据。',
          '战绩支持全部/胜利/失败筛选、单条删除、两步确认清空全部。',
          '暂时移除 APK 打包入口与安装包，仅保留网页/PWA版。'
        ]
      },
      {
        v: 'Ver.0.60', date: '2026.11', title: '深潜 · Ver.0.60',
        items: [
          '新增彩蛋武将【蓝肥鱼 · 深度求索】：体力3，算力/求索/深潜。',
          '24个击杀成就各自拥有独立全屏演出：不同主题色、纹样、字符、立绘与标题。',
          '连续解锁多个击杀成就时，全屏演出会排队依次播放。',
          '新增 js/killfx.js 与蓝肥鱼 SVG 立绘。'
        ]
      },
      {
        v: 'Ver.0.53', date: '2026.11', title: '穗影 · Ver.0.53',
        items: [
          '使用新立绘裁切1:1人物头像，作为网页图标与PWA应用图标。',
          '新增 manifest.webmanifest，记录横屏、主题色与192/512图标。',
          '新增 Android APK 安装包：横屏全屏、离线内置资源。'
        ]
      },
      {
        v: 'Ver.0.52', date: '2026.11', title: '神憾 · Ver.0.52',
        items: [
          '成就总数扩展至45个，新增24个“某武将击杀某武将”组合成就。',
          '新增「神憾」：使用兮穗门击杀穗诗书生墨。',
          '神憾首次解锁时触发全屏墨浪、双将立绘、金红神光与穗墨字符特效。',
          '所有成就解锁时新增专属音效与顶部成就提示。'
        ]
      },
      {
        v: 'Ver.0.51', date: '2026.11', title: '裂穹 · Ver.0.51',
        items: [
          '神·满穗的人机操作【裂穹】时，只要出现【天冲】选项，必定选择天冲。',
          '削弱神·满穗生存能力：移除【穗佑】。'
        ]
      },
      {
        v: 'Ver.0.50', date: '2026.11', title: '荒仓 · Ver.0.50',
        items: [
          '新增武将【常宣灵 · 穗语载福】：体力3，叙标记、叙事区与荒仓。',
          '【穗叙】收牌/封闪/阵亡得叙；【途馑】合并荒仓，荒仓空时每回合全体流失1体力。',
          '【同路】绑定敌人施加【饥】；【茶话】回溯存活角色；【替灾】转移伤害/回复，3次后锚点即死。',
          '【归程】荒仓≤10觉醒；【断途】5叙直接死亡。为平衡，茶话目前可回溯本回合/上一回合。'
        ]
      },
      {
        v: 'Ver.0.40', date: '2026.11', title: '简牍 · Ver.0.40',
        items: [
          '新增武将【穗诗书生墨 · 诗书染穗】：体力3，墨标记与简牍区。',
          '【诗书】收牌入简牍；【诗人】简牍≥2时免疫杀与单体锦囊；【断更】弃墨永久保留简牍。',
          '【神罚】移出简牍造成伤害/流失体力，累计4张后可直杀；【神赐】觉醒获得【成神】。',
          '为形成联动，诗书在回合结束时补1枚墨；断更可在没有墨时发动。'
        ]
      },
      {
        v: 'Ver.0.32', date: '2026.11', title: '锦囊 · Ver.0.32',
        items: [
          '【穗亡】改为回复4点体力，只废除【仇视】，保留【清剿】。',
          '穗亡后的【封刀】：杀与酒不限次数；除杀外的基本牌视为杀。',
          '锦囊牌可选择视为【酒】或【过河拆桥】，每次使用前由玩家选择。'
        ]
      },
      {
        v: 'Ver.0.31', date: '2026.11', title: '穗亡 · Ver.0.31',
        items: [
          '修改【遇穗】：猜对后可选择体力上限+1（最多10）或回复1点体力。',
          '修改【穗亡】后的【封刀】：杀与酒不限次数；除杀外的基本牌视为杀，锦囊牌视为酒。',
          '保留穗亡回复3点体力、废除【清剿】【仇视】的效果。'
        ]
      },
      {
        v: 'Ver.0.30', date: '2026.11', title: '穗门 · Ver.0.30',
        items: [
          '新增武将【兮穗门 · 大顺永昌】：体力上限3，开局2血，初始手牌2张。',
          '新增【封刀】【遇穗】【仇视】【穗门】【背水】【清剿】【内伤】【穗亡】。',
          '封刀禁杀，酒意可附加在伤害锦囊上；遇穗以猜点数换体力上限；穗亡改写封刀。',
          '穗门/背水为觉醒链，清剿以弃光手牌换八张不同牌。'
        ]
      },
      {
        v: 'Ver.0.26', date: '2026.11', title: '十万 · Ver.0.26',
        items: [
          '作弊伤害倍率上限提升至 1000×，额外伤害上限提升至 +100000。',
          '新增「一刀十万」「千倍伤害」快捷预设。',
          '伤害下限仍至少为 1 点；一刀十万预设可造成 100001 点伤害。'
        ]
      },
      {
        v: 'Ver.0.25', date: '2026.11', title: '作弊模式 · Ver.0.25',
        items: [
          '主页面新增「作弊模式」按钮。',
          '可开启无敌、出牌无限制、出牌不可响应。',
          '可调伤害倍率（1×~100×）与额外伤害（+0~+100）。',
          '设置保存在本机，下一局自动沿用。'
        ]
      },
      {
        v: 'Ver.0.24', date: '2026.11', title: '分栏 · Ver.0.24',
        items: [
          '对局武将面板改为独立立绘卡与独立状态卡，立绘不再与状态文字叠在一起。',
          '体力、武器、防具、坐骑移入状态卡，装备统一排列。',
          '1V5 保留独立小立绘，并优先显示体力、距离与手牌。'
        ]
      },
      {
        v: 'Ver.0.23', date: '2026.11', title: '座次 · Ver.0.23',
        items: [
          '修复已知bug。'
        ]
      },
      {
        v: 'Ver.0.22', date: '2026.11', title: '血线 · Ver.0.22',
        items: [
          '玩家仅剩1点体力时，屏幕四周出现血迹、滴血与红光。',
          '玩家进入濒死状态时血迹扩大、红光增强。',
          '玩家死亡时追加大量血迹与深红暗角。'
        ]
      },
      {
        v: 'Ver.0.21', date: '2026.11', title: '蛇矛 · Ver.0.21',
        items: [
          '修复已知bug。',
          '新增武器【丈八蛇矛】：可弃一张手牌，令本张【杀】不可被【闪】响应。',
          '提高牌堆中【酒】的数量与摸到概率。',
          '强化【杀】命中反馈：刀锋横斩、血溅与更强冲击。',
          '选将界面增加悬停音效、选中脉动与立绘缩放反馈。'
        ]
      },
      {
        v: 'Ver.0.20', date: '2026.11', title: '天择 · Ver.0.20',
        items: [
          '新增玩家随机武将：选将界面可点击「随机武将」，每次点击重新抽取。',
          '加强界限突破良【孤城】：改写规则后本回合所有牌无法被响应。',
          '版本号规则：新增武将时十分位+1、百分位归零（0.19→0.20，0.29→0.30）。'
        ]
      },
      {
        v: 'Ver.0.19', date: '2026.11', title: '势斩 · Ver.0.19',
        items: [
          '增强史可法：新增【势斩】【狂骨】，技能参考势魏延的压迫与以战养战。',
          '【势斩】：使用【杀】无距离限制且不能被【闪】响应。',
          '【狂骨】：对其他角色造成伤害后回复1点体力。',
          '保留【死守】【殉国】。'
        ]
      },
      {
        v: 'Ver.0.18', date: '2026.11', title: '孤城 · Ver.0.18',
        items: [
          '界限突破良技能重做：移除模式增益，改按场上存活人数计算。',
          '准备阶段可改写本回合规则：出牌无距离、无【杀】次数限制，但至多使用 7-X 张牌；X为场上其他存活角色数，偶数翻倍。',
          '死战改为按场上其他存活角色数摸 1/2 张。'
        ]
      },
      {
        v: 'Ver.0.17', date: '2026.11', title: '神机 · Ver.0.17',
        items: [
          '新增「超级困难」人机：完整响应、技能使用与人类式斩杀判断。',
          '版本号规则改为：无新增武将 +0.01，新增武将 +0.1。'
        ]
      },
      {
        v: 'Ver.0.16', date: '2026.11', title: '神临 · Ver.0.16',
        items: [
          '修复已知bug。',
          '界限突破满穗更名为「神·满穗」，阵营改为神。',
          '新增界限突破良：1V1极强、1V2极弱、1V5极强。',
          '新增史可法：督师、死守、殉国。'
        ]
      },
      {
        v: 'Ver.0.15', date: '2026.11', title: '强敌 · Ver.0.15',
        items: [
          '修复已知bug。',
          '提高人机强度：普通/困难更会响应与使用技能，并优先斩杀两血以下目标。'
        ]
      },
      {
        v: 'Ver.0.14', date: '2026.11', title: '裂穹 · Ver.0.14',
        items: [
          '神·满穗获得神黄忠全部技能：【裂穹】与【斩决】。',
          '【裂穹】可击伤天冲/力烽/地机/中枢/气海五个部位；天冲击杀可加体力上限。',
          '保留【不灭】【穗佑】两个保命技能。'
        ]
      },
      {
        v: 'Ver.0.13', date: '2026.11', title: '旧友入局 · Ver.0.13',
        items: [
          '神·满穗原画替换为用户提供的立绘。',
          '新增《哀鸿：城破十日记》王生：3体力，旧游/护家。',
          '王生立绘取自官方角色视频封面；武将总数增至18人。'
        ]
      },
      {
        v: 'Ver.0.12', date: '2026.11', title: '界限突破 · Ver.0.12',
        items: [
          '新增武将「满穗 · 界限突破」：体力上限4，开局只有2点体力。',
          '【斩决】仿神黄忠：出牌阶段开始时二选一，以当前体力摸牌并令下一张杀无距离、不可闪；或以已损体力摸牌并在下次伤害后回复。',
          '新增两个保命技能：【不灭】濒死回复至2点（每局一次），【穗佑】每回合首次伤害完全防止。',
          '立绘重新从游戏画面取景，加入破界赤金色调；武将总数增至17人。'
        ]
      },
      {
        v: 'Ver.0.11', date: '2026.11', title: '雷不屠戮 · Ver.0.11',
        items: [
          '修复已知bug。'
        ]
      },
      {
        v: 'Ver.0.10', date: '2026.11', title: '择敌而战 · Ver.0.10',
        items: [
          '选将页新增「选择对手」：可从 16 名武将中指定 1V1/1V2/1V5 的敌方阵容。',
          '支持全随机；指定不足的席位由系统随机补足，当前武将不可被选为对手。',
          '手动指定的对手会在再战一局时保留；选择全随机时每局自动更换敌人。'
        ]
      },
      {
        v: 'Ver.0.09', date: '2026.11', title: '皮开肉绽 · Ver.0.09',
        items: [
          '新增成就「好好活着……知宥。」：使用方知宥击杀一次林翩翩。',
          '【杀】命中新增皮开肉绽裂口、飞散血滴与血染面板。',
          '强化受击镜头冲击：重击缩放、强震屏、红闪与音效层次。'
        ]
      },
      {
        v: 'Ver.0.08', date: '2026.11', title: '雷火藤甲 · Ver.0.08',
        items: [
          '每局结束再战时，敌人会更换为不同的武将。',
          '新增【雷杀】【火杀】属性杀，以及【藤甲】【布衣】【八卦阵】防具。',
          '新增防具栏、藤甲火焰增伤、八卦阵判定、布衣减伤与手牌上限。',
          '牌堆数量翻倍：常规 156 张，1V5 160 张。'
        ]
      },
      {
        v: 'Ver.0.07', date: '2026.11', title: '刀锋入骨 · Ver.0.07',
        items: [
          '强化伤害打击感：命中瞬间加入冲击环、飞散碎片与斩击闪白。',
          '轻击与重击分级震屏：重击触发更强震屏、全屏红闪与暗角。',
          '溅血效果增强：血斑、血痕与残留血渍同时出现。'
        ]
      },
      {
        v: 'Ver.0.06', date: '2026.11', title: '血染牌桌 · Ver.0.06',
        items: [
          '成就栏新增「重置成就」按钮，可清空成就与统计。',
          '【杀】造成伤害时增加更明显的溅血、血痕与轻微震屏。',
          '受到【杀】伤害时同样显示溅血与对局界面轻微抖动。'
        ]
      },
      {
        v: 'Ver.0.05', date: '2026.11', title: '雷落牌桌 · Ver.0.05',
        items: [
          '修复已知bug。',
          '濒死与死亡阶段同样会显示受击反馈。'
        ]
      },
      {
        v: 'Ver.0.04', date: '2026.11', title: '五座围杀 · Ver.0.04',
        items: [
          '新增 1V5 模式：你独自面对五名对手，按座次计算距离。',
          '1V5 新增坐骑牌与进攻 / 防御坐骑栏，武器也拥有攻击范围。',
          '1V5 中你每回合多摸两张牌，【杀】的使用次数 +1。',
          '首页新增成就栏：20 个成就，记录在浏览器本地。',
          '新增金翅大鹏王与豚妖，武将总数达到 16 人。'
        ]
      },
      {
        v: 'Ver.0.03', date: '2026.11', title: '哀鸿双璧 · Ver.0.03',
        items: [
          '主界面改为哀鸿双人构图：暖色苏怜烟居左，冷色林翩翩居右，标题居中。',
          '出牌特效改为覆盖在出牌武将牌上，随出牌者位置显示。',
          '濒危音乐仅在自己只剩 1 点体力时触发；回到 2 点以上立即恢复牌局曲。',
          '敌方低血量不再触发濒危曲。'
        ]
      },
      {
        v: 'Ver.0.02', date: '2026.11', title: '乱世之声 · Ver.0.02',
        items: [
          '主页面与选将背景音乐：Redemption of the Wolf。',
          '牌局背景音乐：Li\'s March。',
          '自身只剩 1 点体力时自动切到 Daggers Drawn，回复后切回牌局曲。',
          '音律设置新增「自动 / 主页面 / 战斗 / 濒危 / 本地」五种模式。'
        ]
      },
      {
        v: 'Ver.0.01', date: '2026.11', title: '中央对垒 · Ver.0.01',
        items: [
          '牌局 UI 重排：敌方武将居上，我方武将居下，隔桌对立。',
          '更新日志收进「更新日志」按钮，点开后才显示。',
          '版本号改为 Ver.0.01，此后每次更新递增 0.01。',
          '保留心兰、锦囊【闪电】、内置与可导入背景音乐。'
        ]
      },
      {
        v: 'Ver.0.00', date: '2026.11', title: '初版 · 十四位武将',
        items: [
          '完成 1V1 / 1V2 牌局、十四位武将、武器栏与彩蛋语音。',
          '牌堆 71 张，包含延时锦囊【闪电】。'
        ]
      }
    ];
    const body = entries.map(function (e, idx) {
      return '<article class="changelog-entry' + (idx === 0 ? ' is-current' : '') + '">' +
        '<header><span>' + esc(e.v) + '</span><time>' + esc(e.date) + '</time></header>' +
        '<h3>' + esc(e.title) + '</h3>' +
        '<ul>' + e.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '</article>';
    }).join('');
    const layer = openModalRaw({
      modalClass: 'changelog-modal',
      kicker: '更新日志 · ' + (MMS.VERSION_LABEL || 'Ver.0.01'),
      title: '乱世未停，牌局常新',
      sub: '当前版本 ' + (MMS.VERSION_LABEL || 'Ver.0.90') + '；无新增武将 +0.01；新增武将 +0.1 且百分位归零。',
      body: '<div class="changelog-list">' + body + '</div>',
      actions: modalButton('收下', '__close__', 'btn-primary'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    layer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-modal-value="__close__"]')) closeModal();
    });
  };

  UI.openArchivePanel = function (side) {
    const s = state || (MMS.Engine && MMS.Engine.getState ? MMS.Engine.getState() : null);
    if (!s) return;
    const p = side === 'player' ? s.player : (s.ais || []).find(function (x) { return x.side === side; });
    if (!p) return;
    const cards = (p.archive || []).map(function (entry) {
      const owner = entry.ownerSide === 'player' ? s.player : (s.ais || []).find(function (x) { return x.side === entry.ownerSide; });
      return '<div class="archive-entry">' +
        '<div class="archive-card">' + esc(entry.card.suitName) + esc(entry.card.rankLabel) + '【' + esc(entry.card.name) + '】</div>' +
        '<div class="archive-meta">原主：' + esc(owner ? owner.general.name : '已阵亡') + (entry.permanent ? ' · 永久保留' : ' · 回合结束归还') + '</div>' +
      '</div>';
    }).join('');
    openModalRaw({
      modalClass: 'archive-modal',
      kicker: '简牍区 · ' + p.general.name,
      title: '简牍',
      sub: '你可以永久查看这些牌。未标注“永久”的牌，会在你的回合结束后归还原主。',
      body: cards || '<div class="archive-empty">简牍区还没有牌。</div>',
      actions: modalButton('关闭', '__close__', 'btn-primary'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    const layer = document.querySelector('.modal');
    if (layer) layer.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-modal-value="__close__"]');
      if (b) closeModal();
    });
  };

  UI.openNarrativePanel = function (side) {
    const s = state || (MMS.Engine && MMS.Engine.getState ? MMS.Engine.getState() : null);
    if (!s) return;
    const p = side === 'player' ? s.player : (s.ais || []).find(function (x) { return x.side === side; });
    if (!p) return;
    const cards = (p.narrative || []).map(function (entry) {
      const owner = entry.ownerSide === 'player' ? s.player : (s.ais || []).find(function (x) { return x.side === entry.ownerSide; });
      return '<div class="archive-entry">' +
        '<div class="archive-card">' + esc(entry.card.suitName) + esc(entry.card.rankLabel) + '【' + esc(entry.card.name) + '】</div>' +
        '<div class="archive-meta">原主：' + esc(owner ? owner.general.name : '已阵亡') + (entry.permanent ? ' · 永久' : ' · 回合结束归还') + '</div>' +
      '</div>';
    }).join('');
    openModalRaw({
      modalClass: 'archive-modal',
      kicker: '叙事区 · ' + p.general.name,
      title: '叙事区',
      sub: '穗叙收走的牌会在回合结束时归还原主；期间可以查看。',
      body: cards || '<div class="archive-empty">叙事区还没有牌。</div>',
      actions: modalButton('关闭', '__close__', 'btn-primary'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    const layer = document.querySelector('.modal');
    if (layer) layer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-modal-value="__close__"]')) closeModal();
    });
  };

  UI.openRules = function () {
    const layer = openModalRaw({
      modalClass: 'rules-modal',
      kicker: '兵法',
      title: '一局明末杀',
      sub: '1V1、1V2 或 1V5：击败全部对手才能活下来。',
      body: '' +
        '<div class="rules-grid">' +
          '<div class="rule-block"><h3>胜负</h3><p>1V1：双方各选一名武将，轮流行动，将对手体力降至0即获胜。1V2：你独自面对两名人机，两名对手轮流行动。1V5：你在五座围杀中独自面对五名对手，击败全部五人才算胜利。</p></div>' +
          '<div class="rule-block"><h3>回合流程</h3><ul><li><b>判定</b>：结算判定区内的延时锦囊。</li><li><b>摸牌</b>：摸两张牌；1V5 中你额外摸两张。</li><li><b>出牌</b>：使用手牌与技能；1V5 中你的【杀】次数 +1。</li><li><b>弃牌</b>：手牌不能超过体力值（有技能修正）。</li></ul></div>' +
          '<div class="rule-block"><h3>1V5 · 距离</h3><p>六人围坐，你与每名对手按座次计算距离。武器提供攻击范围；只有距离不大于攻击范围时，【杀】才能指定该对手。进攻坐骑令你计算距离-1，防御坐骑令别人计算与你的距离+1。</p></div>' +
          '<div class="rule-block"><h3>基本牌</h3><ul><li><b>杀</b>：每回合限一次，需【闪】抵消。</li><li><b>雷杀 / 火杀</b>：属性【杀】。火杀对藤甲目标伤害+1；雷杀造成雷电伤害。</li><li><b>闪</b>：响应【杀】或【万箭齐发】。</li><li><b>桃</b>：回复1点体力，或在濒死时自救。</li><li><b>酒</b>：可多次饮用，酒意叠加，令下一张【杀】伤害+1；濒死时可回复1点体力。</li></ul></div>' +
          '<div class="rule-block"><h3>锦囊</h3><ul><li><b>无中生有</b>：摸两张牌。</li><li><b>拆 / 顺</b>：指定对手的手牌区（背面选择，结算后揭示）或装备区（公开选择）。</li><li><b>无懈可击</b>：抵消一张锦囊牌，可被另一张无懈可击反制。</li><li><b>决斗 / 南蛮 / 万箭</b>：迫使对手打出【杀】或【闪】；一挑二时，你的【南蛮】【万箭】会命中两名对手。</li><li><b>乐 / 兵粮 / 闪电</b>：延时判定，跳过阶段或引发雷电。</li></ul></div>' +
          '<div class="rule-block"><h3>武器 · 防具 · 坐骑</h3><p>武器牌进入武器栏并提供攻击范围；防具进入防具栏，藤甲令普通【杀】【南蛮】【万箭】无效且受火焰伤害+1，布衣每回合首次受伤-1且手牌上限+1，八卦阵在无【闪】时可判定，红色视为【闪】。1V5 中另有进攻/防御坐骑栏：赤兔令你计算距离-1；爪黄飞电、的卢、绝影令别人计算与你的距离+1。</p></div>' +
          '<div class="rule-block"><h3>标记与觉醒</h3><p>“恨”“穗”“忆”是三位武将的专属资源，显示在武将牌上。部分武将在首次濒死或资源达到条件时觉醒，获得新的技能。</p></div>' +
          '<div class="rule-block"><h3>操作</h3><p>点击手牌查看可用性，再点“使用”。需要响应时，会弹出可打出的牌。点击武将牌上的技能名查看完整说明；发光技能可以主动发动。</p></div>' +
        '</div>' +
        '<div class="rules-foot">本作是同人卡牌游戏，非商业作品。人物与作品设定归《饿殍：明末千里行》《哀鸿：城破十日记》原作者所有。技能为 1V1 / 1V2 / 1V5 简化改编，部分数值与参考卡面不同。</div>',
      actions: '<button class="btn btn-primary" type="button" data-modal-close>收兵</button>',
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    layer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-modal-close]')) closeModal();
    });
  };

  function fxLayer() { return $('#fx-layer'); }

  function panelEl(side) {
    if (side === 'ai2') return $('#enemy2-panel');
    if (side === 'ai3') return $('#enemy3-panel');
    if (side === 'ai4') return $('#enemy4-panel');
    if (side === 'ai5') return $('#enemy5-panel');
    if (side === 'ai') return $('#enemy-panel');
    return $('#player-panel');
  }

  function panelRect(side) {
    const el = panelEl(side);
    return el ? el.getBoundingClientRect() : null;
  }

  UI.toast = function (text, cls) {
    const layer = $('#toast-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = text;
    layer.appendChild(el);
    if (cls && cls.indexOf('is-skill') >= 0) UI.castSkill(text);
    setTimeout(function () { el.classList.add('is-out'); }, 2100);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 2450);
  };

  UI.castSkill = function (text) {
    const layer = fxLayer();
    if (!layer) return;
    if (layer.querySelectorAll('.skill-cast').length >= 2) return;
    const el = document.createElement('div');
    el.className = 'skill-cast';
    el.innerHTML = '<i class="skill-cast-ring"></i><span>' + esc(text) + '</span><b>技</b>';
    layer.appendChild(el);
    Sound.play('skill');
    setTimeout(function () { el.remove(); }, 1550);
  };

  UI.banner = function (title, sub, cls) {
    const layer = $('#banner-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'battle-banner ' + (cls ? 'is-' + cls : '');
    el.innerHTML = '<span>' + esc(title) + '</span><small>' + esc(sub || '') + '</small>';
    layer.appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); }, 1900);
    setTimeout(function () { el.remove(); }, 2400);
  };

  UI.float = function (side, text, cls) {
    const rect = panelRect(side);
    if (!rect) return;
    const layer = fxLayer();
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'float-text ' + (cls || '');
    el.textContent = text;
    el.style.left = (rect.left + rect.width * 0.5) + 'px';
    el.style.top = (rect.top + rect.height * 0.36) + 'px';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 1100);
  };

  UI.markNewCard = function (uid) {
    if (uid) newUids.add(uid);
  };

  UI.hit = function (side, amount) {
    const el = panelEl(side);
    if (!el) return;
    amount = Math.max(1, amount | 0 || 1);
    el.classList.remove('is-hit', 'is-heavy-hit');
    void el.offsetWidth;
    el.classList.add(amount >= 2 ? 'is-heavy-hit' : 'is-hit');
    el.classList.add('is-bloodied');
    setTimeout(function () { el.classList.remove('is-bloodied'); }, 2200);
    Sound.play('cut');
    if (amount >= 2) Sound.play('impact');
    const screen = $('#screen-battle');
    if (screen) {
      const heavyShake = amount >= 2;
      screen.classList.remove('is-shaking', 'is-heavy-shaking', 'is-impact', 'is-heavy-impact');
      void screen.offsetWidth;
      screen.classList.add(heavyShake ? 'is-heavy-impact' : 'is-impact');
      setTimeout(function () {
        screen.classList.remove('is-impact', 'is-heavy-impact');
      }, heavyShake ? 620 : 380);
      if (side === 'player') {
        screen.classList.remove('is-damaged');
        void screen.offsetWidth;
        screen.classList.add('is-damaged');
        setTimeout(function () { screen.classList.remove('is-damaged'); }, 780);
      }
    }
    if (UI.bloodSplatter) UI.bloodSplatter(side, amount);
    const rect = panelRect(side);
    const layer = fxLayer();
    if (rect && layer) {
      // 皮开肉绽：数道新鲜裂口与飞散血滴
      const cutCount = amount >= 2 ? 7 : 4;
      for (let i = 0; i < cutCount; i += 1) {
        const cut = document.createElement('i');
        cut.className = 'fx-flesh-cut';
        cut.style.left = (rect.left + rect.width * (0.28 + Math.random() * 0.45)) + 'px';
        cut.style.top = (rect.top + rect.height * (0.24 + Math.random() * 0.45)) + 'px';
        cut.style.width = (28 + Math.random() * 70) + 'px';
        cut.style.setProperty('--r', (Math.random() * 80 - 40) + 'deg');
        cut.style.setProperty('--d', (i * 0.035) + 's');
        layer.appendChild(cut);
        setTimeout(function () { cut.remove(); }, 900);
      }
      const dropCount = amount >= 2 ? 16 : 10;
      for (let i = 0; i < dropCount; i += 1) {
        const drop = document.createElement('i');
        drop.className = 'fx-blood-drop';
        drop.style.left = (rect.left + rect.width * 0.5) + 'px';
        drop.style.top = (rect.top + rect.height * 0.38) + 'px';
        drop.style.setProperty('--s', (3 + Math.random() * 9) + 'px');
        drop.style.setProperty('--dx', (Math.random() * 230 - 115) + 'px');
        drop.style.setProperty('--dy', (Math.random() * 180 - 30) + 'px');
        layer.appendChild(drop);
        setTimeout(function () { drop.remove(); }, 900);
      }
      const ring = document.createElement('div');
      ring.className = 'fx-impact-ring' + (side === 'player' ? ' is-player' : '');
      ring.style.left = (rect.left + rect.width * 0.5) + 'px';
      ring.style.top = (rect.top + rect.height * 0.4) + 'px';
      layer.appendChild(ring);
      setTimeout(function () { ring.remove(); }, 780);
      const shardCount = amount >= 2 ? 14 : 9;
      for (let i = 0; i < shardCount; i += 1) {
        const shard = document.createElement('i');
        shard.className = 'fx-impact-shard';
        shard.style.left = (rect.left + rect.width * 0.5) + 'px';
        shard.style.top = (rect.top + rect.height * 0.4) + 'px';
        shard.style.setProperty('--s', (5 + Math.random() * 10) + 'px');
        shard.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px');
        shard.style.setProperty('--dy', (Math.random() * 150 - 80) + 'px');
        shard.style.setProperty('--r', (Math.random() * 360) + 'deg');
        layer.appendChild(shard);
        setTimeout(function () { shard.remove(); }, 820);
      }
    }
    if (amount >= 2) {
      const flash = document.createElement('div');
      flash.className = 'fx-heavy-flash' + (side === 'player' ? ' is-player' : '');
      document.body.appendChild(flash);
      const vignette = document.createElement('div');
      vignette.className = 'fx-vignette is-heavy';
      document.body.appendChild(vignette);
      setTimeout(function () { flash.remove(); vignette.remove(); }, 900);
    }
    setTimeout(function () { el.classList.remove('is-hit', 'is-heavy-hit'); }, 800);
  };

  UI.heal = function (side) {
    const el = panelEl(side);
    if (!el) return;
    el.classList.remove('is-healed');
    void el.offsetWidth;
    el.classList.add('is-healed');
    setTimeout(function () { el.classList.remove('is-healed'); }, 800);
  };

  UI.dodge = function (side) {
    UI.float(side, '闪', 'is-heal');
    const el = panelEl(side);
    if (el) {
      el.classList.add('is-dodged');
      setTimeout(function () { el.classList.remove('is-dodged'); }, 520);
    }
  };

  UI.awaken = function (side) {
    const el = panelEl(side);
    if (!el) return;
    el.classList.remove('is-awakened');
    void el.offsetWidth;
    el.classList.add('is-awakened');
    setTimeout(function () { el.classList.remove('is-awakened'); }, 1400);
  };

  UI.slashSwing = function (fromSide, toSide) {
    const a = panelRect(fromSide);
    const b = panelRect(toSide);
    const layer = fxLayer();
    if (!a || !b || !layer) return;
    const x1 = a.left + a.width * 0.55, y1 = a.top + a.height * 0.35;
    const x2 = b.left + b.width * 0.55, y2 = b.top + b.height * 0.35;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const el = document.createElement('i');
    el.className = 'fx-slash-swing';
    el.style.left = x1 + 'px'; el.style.top = y1 + 'px';
    el.style.width = len + 'px'; el.style.transform = 'rotate(' + ang + 'deg)';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 520);
  };

  UI.slashFx = function (fromSide, toSide, card) {
    const b = panelRect(toSide);
    const layer = fxLayer();
    if (!b || !layer) return;
    const word = document.createElement('div');
    word.className = 'fx-slash-word';
    word.textContent = '殺';
    word.style.left = (b.left + b.width * 0.62) + 'px';
    word.style.top = (b.top + b.height * 0.34) + 'px';
    layer.appendChild(word);
    const ring = document.createElement('div');
    ring.className = 'fx-impact-ring';
    ring.style.left = (b.left + b.width * 0.5) + 'px';
    ring.style.top = (b.top + b.height * 0.42) + 'px';
    layer.appendChild(ring);
    for (let i = 0; i < 8; i += 1) {
      const arc = document.createElement('i');
      arc.className = 'fx-cut-scar';
      arc.style.left = (b.left + b.width * (0.3 + Math.random() * 0.5)) + 'px';
      arc.style.top = (b.top + b.height * (0.3 + Math.random() * 0.45)) + 'px';
      arc.style.setProperty('--r', (Math.random() * 80 - 40) + 'deg');
      layer.appendChild(arc);
      setTimeout(function () { arc.remove(); }, 700);
    }
    for (let i = 0; i < 2; i += 1) {
      const blade = document.createElement('i');
      blade.className = 'fx-blade-cut';
      blade.style.left = (b.left + b.width * 0.5) + 'px';
      blade.style.top = (b.top + b.height * (0.36 + i * 0.13)) + 'px';
      blade.style.width = (b.width * (0.92 + Math.random() * 0.25)) + 'px';
      blade.style.setProperty('--r', (i === 0 ? -18 : 14) + (Math.random() * 8 - 4) + 'deg');
      blade.style.setProperty('--d', (i * 0.04) + 's');
      layer.appendChild(blade);
      setTimeout(function () { blade.remove(); }, 760);
    }
    const flash = document.createElement('div');
    flash.className = 'fx-slash-flash';
    layer.appendChild(flash);
    setTimeout(function () { flash.remove(); }, 500);
    setTimeout(function () { word.remove(); ring.remove(); }, 1200);
  };

  UI.bloodSplatter = function (side, amount) {
    const r = panelRect(side);
    const layer = fxLayer();
    if (!r || !layer) return;
    const el = document.createElement('div');
    el.className = 'fx-blood-splatter';
    el.style.left = (r.left + r.width * 0.55) + 'px';
    el.style.top = (r.top + r.height * 0.35) + 'px';
    layer.appendChild(el);
    const count = Math.min(16, 9 + Math.max(0, amount | 0) * 2);
    for (let i = 0; i < count; i += 1) {
      const s = document.createElement('i');
      s.className = 'fx-blood-streak';
      s.style.left = (r.left + r.width * 0.55 + (Math.random() * 160 - 80)) + 'px';
      s.style.top = (r.top + r.height * 0.4 + (Math.random() * 100 - 30)) + 'px';
      s.style.setProperty('--rot', (Math.random() * 360) + 'deg');
      s.style.width = (18 + Math.random() * 30) + 'px';
      layer.appendChild(s);
      setTimeout(function () { s.remove(); }, 900);
    }
    const stain = document.createElement('div');
    stain.className = 'fx-blood-stain';
    stain.style.left = (r.left + r.width * 0.55) + 'px';
    stain.style.top = (r.top + r.height * 0.4) + 'px';
    layer.appendChild(stain);
    setTimeout(function () { stain.remove(); }, 1800);
    setTimeout(function () { el.remove(); }, 1400);
  };

  UI.showJudge = function (card, label, resultText) {
    const stage = $('#judge-stage');
    if (!stage) return;
    stage.innerHTML = '<div class="judge-card"><span>' + esc(label || '判定') + '</span><b>' + esc(card ? card.name : '') + '</b><small>' + esc(resultText || '') + '</small></div>';
    stage.classList.add('is-visible');
  };

  UI.clearJudge = function () {
    const stage = $('#judge-stage');
    if (!stage) return;
    stage.classList.remove('is-visible');
    stage.innerHTML = '';
  };

  const CARD_FX = {
    sha: { seal: '斬', tone: 'red', glyph: '刃', sound: 'sha_play', particles: 9 },
    shan: { seal: '避', tone: 'jade', glyph: '影', sound: 'shan', particles: 7 },
    tao: { seal: '生', tone: 'pink', glyph: '花', sound: 'tao', particles: 10 },
    jiu: { seal: '醉', tone: 'amber', glyph: '酒', sound: 'jiu', particles: 8 },
    wuzhong: { seal: '無', tone: 'gold', glyph: '無', sound: 'wuzhong', particles: 11 },
    chaiqiao: { seal: '拆', tone: 'steel', glyph: '木', sound: 'chaiqiao', particles: 8 },
    shunshou: { seal: '牽', tone: 'gold', glyph: '手', sound: 'shunshou', particles: 8 },
    juedou: { seal: '決', tone: 'red', glyph: '決', sound: 'juedou', particles: 9 },
    nanman: { seal: '蠻', tone: 'brown', glyph: '蠻', sound: 'nanman', particles: 12 },
    wanjian: { seal: '箭', tone: 'silver', glyph: '箭', sound: 'wanjian', particles: 14 },
    lebu: { seal: '樂', tone: 'violet', glyph: '樂', sound: 'lebu', particles: 8 },
    bingliang: { seal: '糧', tone: 'ochre', glyph: '禾', sound: 'bingliang', particles: 9 },
    shandian: { seal: '電', tone: 'silver', glyph: '雷', sound: 'shandian', particles: 12 },
    leisha: { seal: '雷', tone: 'silver', glyph: '雷', sound: 'sha_play', particles: 11 },
    huosha: { seal: '火', tone: 'red', glyph: '火', sound: 'sha_play', particles: 11 },
    tengjia: { seal: '藤', tone: 'jade', glyph: '甲', sound: 'equip_sword', particles: 8 },
    buyi: { seal: '布', tone: 'ochre', glyph: '衣', sound: 'equip_sword', particles: 7 },
    bagua: { seal: '卦', tone: 'gold', glyph: '卦', sound: 'wuxie', particles: 9 },
    wuxie: { seal: '懈', tone: 'silver', glyph: '懈', sound: 'wuxie', particles: 8 },
    liang_blade: { seal: '刀', tone: 'steel', glyph: '刀', sound: 'equip_blade', particles: 8 },
    wangsheng_sword: { seal: '劍', tone: 'silver', glyph: '劍', sound: 'equip_sword', particles: 8 },
    yaobing_bow: { seal: '弓', tone: 'bronze', glyph: '弓', sound: 'equip_bow', particles: 8 },
    zhangba_spear: { seal: '丈', tone: 'steel', glyph: '矛', sound: 'equip_blade', particles: 10 },
    _default: { seal: '令', tone: 'gold', glyph: '令', sound: 'play', particles: 7 }
  };

  UI.playCardFx = function (card, side) {
    const layer = fxLayer();
    if (!card || !layer) return;
    const fx = CARD_FX[card.kind] || CARD_FX._default;
    const rect = panelRect(side);
    const el = document.createElement('div');
    el.className = 'play-card-fx is-general-fx' + (side === 'player' ? ' is-player' : ' is-ai');
    el.setAttribute('data-tone', fx.tone);
    el.setAttribute('data-card', card.kind);
    if (rect) {
      el.style.left = (rect.left + rect.width * 0.5) + 'px';
      el.style.top = (rect.top + rect.height * 0.5) + 'px';
    } else {
      el.style.left = '50%';
      el.style.top = '50%';
    }
    let particles = '';
    for (let i = 0; i < fx.particles; i += 1) {
      particles += '<i class="fx-card-particle" style="--x:' + (Math.random() * 180 - 90) + 'px;--y:' + (Math.random() * -150 - 20) + 'px;--d:' + (Math.random() * 0.2) + 's">' + esc(fx.glyph) + '</i>';
    }
    el.innerHTML = '<span class="fx-play-seal">' + esc(fx.seal) + '</span><span class="fx-card-particles">' + particles + '</span>' +
      (card.art ? '<div class="fx-play-card" style="background-image:url(&quot;' + esc(card.art) + '&quot;)"></div>' : '') +
      '<b class="fx-play-name">' + esc(card.name) + '</b>';
    layer.appendChild(el);
    const actor = panelEl(side);
    if (actor) {
      actor.classList.remove('is-casting');
      void actor.offsetWidth;
      actor.classList.add('is-casting');
      setTimeout(function () { actor.classList.remove('is-casting'); }, 900);
    }
    Sound.play(fx.sound);
    setTimeout(function () { el.remove(); }, 1200);
  };

  const EGG_VOICE = {
    medical: {
      lines: ['呵，三张桃——医术高超！', '妙手回春，医术高超！', '这点伤，也配叫伤？医术高超！'],
      rate: 1.04, pitch: 1.08, volume: 1
    },
    wine: {
      lines: ['嗝……三坛女儿红……酒醉万世！', '好酒！再来一坛——酒醉万世！', '嗝，天旋地转……酒醉万世！'],
      rate: 0.84, pitch: 0.76, volume: 1
    },
    massacre: {
      lines: ['一刀，三点血——癫狂屠戮！', '杀！癫狂屠戮！', '血，够热——癫狂屠戮！'],
      rate: 1.14, pitch: 0.66, volume: 1
    }
  };

  function speakEgg(text, key) {
    try {
      if (!soundEnabled || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
      const profile = EGG_VOICE[key] || EGG_VOICE.massacre;
      const line = text || profile.lines[Math.floor(Math.random() * profile.lines.length)];
      window.speechSynthesis.cancel();
      const u = new window.SpeechSynthesisUtterance(line);
      u.lang = 'zh-CN';
      u.rate = profile.rate + (Math.random() * 0.05 - 0.025);
      u.pitch = profile.pitch + (Math.random() * 0.08 - 0.04);
      u.volume = Math.max(0, Math.min(1, soundVolume * (profile.volume || 1)));
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const zh = voices.filter(function (v) { return /zh|chinese|中文|汉语/i.test((v.lang || '') + ' ' + (v.name || '')); });
      const preferred = zh.filter(function (v) {
        return /xiaoxiao|yunxi|huihui|kangkang|yaoyao|tingting|meijia|natural|neural/i.test(v.name || '');
      });
      const pool = preferred.length ? preferred : zh;
      if (pool.length) {
        const pick = key === 'medical' ? 0 : (key === 'wine' ? 1 : 2);
        u.voice = pool[pick % pool.length];
      }
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  UI.easterEgg = function (key, title, sub) {
    const old = document.querySelector('.fx-easter-egg');
    if (old) old.remove();
    const layer = fxLayer();
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'fx-easter-egg';
    el.setAttribute('data-theme', key || 'massacre');
    const voiceProfile = EGG_VOICE[key] || EGG_VOICE.massacre;
    const voiceLine = voiceProfile.lines[Math.floor(Math.random() * voiceProfile.lines.length)];
    let chars = '';
    Array.from(title).forEach(function (ch, i) {
      chars += '<span style="--i:' + i + '">' + esc(ch) + '</span>';
    });
    let shards = '';
    for (let i = 0; i < 28; i += 1) {
      shards += '<i style="--x:' + (Math.random() * 120 - 60) + 'vw;--y:' + (Math.random() * 100 - 50) + 'vh;--r:' + (Math.random() * 360 - 180) + 'deg;--d:' + (Math.random() * 0.22) + 's;--s:' + (4 + Math.random() * 13) + 'px"></i>';
    }
    el.innerHTML =
      '<div class="egg-flash"></div>' +
      '<div class="egg-rings"><i></i><i></i><i></i></div>' +
      '<div class="egg-title">' + chars + '</div>' +
      '<div class="egg-voice">“' + esc(voiceLine) + '”</div>' +
      '<div class="egg-sub">彩蛋 · ' + esc(sub || '') + '</div>' +
      '<div class="egg-seal">彩<br>蛋</div>' +
      '<div class="egg-shards">' + shards + '</div>';
    layer.appendChild(el);
    layer.classList.add('is-easter');
    const screen = $('#screen-battle');
    if (screen) {
      screen.classList.add('is-easter-shaking');
      setTimeout(function () { screen.classList.remove('is-easter-shaking'); }, 1800);
    }
    Sound.play('egg_' + (key || 'massacre'));
    speakEgg(voiceLine, key || 'massacre');
    setTimeout(function () {
      if (layer.contains(el)) el.remove();
      layer.classList.remove('is-easter');
    }, 3000);
  };

  /* =======================================================
     成就
     ======================================================= */

  const KILL_FX = MMS.KILL_FX || {};
  let killFxQueue = [];
  let killFxActive = false;

  const ACH_KEY = 'mms-achievements';
  const ACH_STATS_KEY = 'mms-ach-stats';

  function loadAchievements() {
    let unlocked = {};
    let stats = {
      games: 0, wins: 0, wins1v2: 0, wins1v5: 0,
      streak: 0, bestStreak: 0, modes: {}, characters: {},
      generalWins: {}, modeWins: {}, superWins: 0,
      best: { damage: 0, draw: 0, skills: 0, heals: 0, weapons: 0, mounts: 0, cards: 0 }
    };
    try {
      const u = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
      if (u && typeof u === 'object') unlocked = u;
      const s = JSON.parse(localStorage.getItem(ACH_STATS_KEY) || 'null');
      if (s && typeof s === 'object') {
        stats = Object.assign(stats, s);
        stats.modes = s.modes || {};
        stats.characters = s.characters || {};
        stats.generalWins = s.generalWins || {};
        stats.modeWins = s.modeWins || {};
        stats.superWins = s.superWins || 0;
        stats.best = Object.assign({ damage: 0, draw: 0, skills: 0, heals: 0, weapons: 0, mounts: 0, cards: 0 }, s.best || {});
      }
    } catch (e) {}
    return { unlocked: unlocked, stats: stats };
  }

  function saveAchievements(unlocked, stats) {
    try {
      localStorage.setItem(ACH_KEY, JSON.stringify(unlocked));
      localStorage.setItem(ACH_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function achievementSatisfied(id, stats, game) {
    const b = stats.best;
    const def = (MMS.ACHIEVEMENTS || []).find(function (a) { return a.id === id; });
    if (def && def.killer) {
      if (!game || !game.player || !game.player.general || !game.player.stats) return false;
      if (game.player.general.id !== def.killer) return false;
      return !!((game.player.stats.kills || {})[def.target]);
    }
    switch (id) {
      case 'first_game': return stats.games >= 1;
      case 'first_win': return stats.wins >= 1;
      case 'wins_10': return stats.wins >= 10;
      case 'games_25': return stats.games >= 25;
      case 'win_1v2': return stats.wins1v2 >= 1;
      case 'win_1v5': return stats.wins1v5 >= 1;
      case 'flawless': return !!(game && game.win && game.player.hp === game.player.maxHp);
      case 'last_breath': return !!(game && game.win && game.player.hp === 1);
      case 'quick_win': return !!(game && game.win && game.round <= 5);
      case 'damage_15': return b.damage >= 15;
      case 'damage_25': return b.damage >= 25;
      case 'draw_30': return b.draw >= 30;
      case 'skills_10': return b.skills >= 10;
      case 'heal_8': return b.heals >= 8;
      case 'arsenal': return b.weapons >= 3;
      case 'cavalry': return !!(game && game.mode === '1v5' && game.player.mounts && game.player.mounts.offense && game.player.mounts.defense);
      case 'modes_all': return !!(stats.modes['1v1'] && stats.modes['1v2'] && stats.modes['1v5']);
      case 'generals_10': return Object.keys(stats.characters).length >= 10;
      case 'streak_3': return stats.bestStreak >= 3;
      case 'cards_40': return b.cards >= 40;
      case 'fang_lin': return !!(game && game.player && game.player.stats && game.player.stats.fangKilledLin > 0);
      default: return false;
    }
  }

  UI.recordAchievements = function (data) {
    if (!data || !data.player) return [];
    const saved = loadAchievements();
    const unlocked = saved.unlocked;
    const stats = saved.stats;
    const p = data.player;
    stats.games += 1;
    if (data.win) {
      stats.wins += 1;
      stats.streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      if (data.mode === '1v2') stats.wins1v2 += 1;
      if (data.mode === '1v5') stats.wins1v5 += 1;
      stats.modeWins[data.mode || '1v1'] = true;
      if (p.general && p.general.id) stats.generalWins[p.general.id] = true;
      if (data.difficulty && data.difficulty.id === 'super') stats.superWins += 1;
    } else {
      stats.streak = 0;
    }
    stats.modes[data.mode || '1v1'] = true;
    if (p.general && p.general.id) stats.characters[p.general.id] = true;
    const st = p.stats || {};
    stats.best.damage = Math.max(stats.best.damage, st.damageDealt || 0);
    stats.best.draw = Math.max(stats.best.draw, st.cardsDrawn || 0);
    stats.best.skills = Math.max(stats.best.skills, st.skillsUsed || 0);
    stats.best.heals = Math.max(stats.best.heals, st.heals || 0);
    stats.best.weapons = Math.max(stats.best.weapons, st.weaponsEquipped || 0);
    stats.best.mounts = Math.max(stats.best.mounts, st.mountsEquipped || 0);
    stats.best.cards = Math.max(stats.best.cards, st.cardsPlayed || 0);

    const newly = [];
    MMS.ACHIEVEMENTS.forEach(function (a) {
      if (!unlocked[a.id] && achievementSatisfied(a.id, stats, data)) {
        unlocked[a.id] = Date.now();
        newly.push(a);
      }
    });
    saveAchievements(unlocked, stats);
    UI.updateAchievementBar();
    newly.forEach(function (a) {
      UI.achievementToast(a);
    });
    const killNew = newly.filter(function (a) { return a.killer; });
    if (killNew.length) {
      setTimeout(function () { killNew.forEach(function (a) { UI.killAchievementSpectacle(a); }); }, 650);
    }
    return newly;
  };

  UI.resetAchievements = async function () {
    const choice = await UI.choose({
      kicker: '成就栏 · 重置',
      title: '要重置全部成就吗？',
      sub: '会同时清除成就解锁记录、累计对局、胜场、连胜与使用过的武将记录。此操作不可撤销。',
      options: [
        { value: 'yes', label: '确认重置', desc: '清空全部 47 个成就与统计。' },
        { value: 'no', label: '保留记录', desc: '回到成就栏，不做更改。' }
      ],
      cancelable: false
    });
    if (choice !== 'yes') {
      UI.openAchievements();
      return false;
    }
    try {
      localStorage.removeItem(ACH_KEY);
      localStorage.removeItem(ACH_STATS_KEY);
    } catch (e) {}
    UI.updateAchievementBar();
    UI.toast('成就与统计已重置。', 'is-success');
    UI.openAchievements();
    return true;
  };

  UI.updateAchievementBar = function () {
    const saved = loadAchievements();
    const all = MMS.ACHIEVEMENTS || [];
    const count = all.filter(function (a) { return saved.unlocked[a.id]; }).length;
    const latest = all.filter(function (a) { return saved.unlocked[a.id]; }).pop();
    const text = document.querySelector('#title-ach-text');
    const fill = document.querySelector('#title-ach-fill');
    if (text) text.textContent = count + ' / ' + all.length + (latest ? ' · ' + latest.title : ' · 尚未解锁');
    if (fill) fill.style.width = (all.length ? count / all.length * 100 : 0) + '%';
  };

  UI.achievementToast = function (a) {
    if (!a) return;
    const stack = document.querySelectorAll('.ach-unlock').length;
    const el = document.createElement('div');
    el.className = 'ach-unlock';
    el.style.top = (26 + stack * 82) + 'px';
    el.innerHTML =
      '<span class="ach-unlock-icon">' + esc(a.icon || '成') + '</span>' +
      '<div class="ach-unlock-copy">' +
        '<small>成就解锁 · ACHIEVEMENT</small>' +
        '<b>' + esc(a.title) + '</b>' +
        '<span>' + esc(a.desc) + '</span>' +
      '</div>' +
      '<i class="ach-unlock-line"></i>';
    document.body.appendChild(el);
    Sound.play('achievement');
    setTimeout(function () { el.classList.add('is-out'); }, 3200);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 4100);
  };

  function playNextKillFx() {
    if (killFxActive) return;
    const a = killFxQueue.shift();
    if (!a) return;
    const fx = KILL_FX[a.id] || { mode: 'gold', motif: 'X', label: 'KILL', glyphs: 'KILL', a: '#d8aa63', b: '#24160d', c: '#fff0c9' };
    const killer = MMS.generalById(a.killer) || { name: '?', art: '' };
    const target = MMS.generalById(a.target) || { name: '?', art: '' };
    killFxActive = true;
    const layer = document.createElement('div');
    layer.className = 'ach-spectacle kill-spectacle';
    layer.setAttribute('data-fx', fx.mode);
    layer.style.setProperty('--fx-a', fx.a);
    layer.style.setProperty('--fx-b', fx.b);
    layer.style.setProperty('--fx-c', fx.c);
    layer.innerHTML =
      '<div class="ach-spectacle-veil"></div>' +
      '<div class="ach-spectacle-rays"></div>' +
      '<div class="ach-spectacle-ink ink-a"></div>' +
      '<div class="ach-spectacle-ink ink-b"></div>' +
      '<div class="ach-spectacle-motif">' + esc(fx.motif) + '</div>' +
      '<div class="ach-spectacle-portrait is-left"><img src="' + esc(killer.art) + '" alt=""></div>' +
      '<div class="ach-spectacle-portrait is-right"><img src="' + esc(target.art) + '" alt=""></div>' +
      '<div class="ach-spectacle-center">' +
        '<span class="ach-spectacle-kicker">' + esc(fx.label) + '<i></i>' + esc(a.title) + '</span>' +
        '<h1>' + esc(a.title) + '</h1>' +
        '<p>' + esc(killer.name) + ' <b>&#x5F11;</b> ' + esc(target.name) + '</p>' +
        '<small>' + esc(a.desc) + '</small>' +
      '</div>' +
      '<div class="ach-spectacle-glyphs">' + fx.glyphs.split('').map(function (ch, i) { return '<i style="--i:' + i + '">' + esc(ch) + '</i>'; }).join('') + '</div>' +
      '<div class="ach-spectacle-sparks">' + Array.from({ length: 34 }).map(function () {
        return '<i style="--x:' + (Math.random() * 100) + '%;--d:' + (Math.random() * 2.1) + 's;--r:' + (Math.random() * 360) + 'deg;--s:' + (0.35 + Math.random() * 1.35) + '"></i>';
      }).join('') + '</div>';
    document.body.appendChild(layer);
    Sound.play('legend');
    setTimeout(function () { layer.classList.add('is-out'); }, 4300);
    setTimeout(function () {
      if (layer.parentNode) layer.remove();
      killFxActive = false;
      playNextKillFx();
    }, 5300);
  }

  UI.killAchievementSpectacle = function (a) {
    if (!a) return;
    killFxQueue.push(a);
    playNextKillFx();
  };

  UI.openAchievements = function () {
    const saved = loadAchievements();
    const all = MMS.ACHIEVEMENTS || [];
    const count = all.filter(function (a) { return saved.unlocked[a.id]; }).length;
    const body = all.map(function (a) {
      const on = !!saved.unlocked[a.id];
      return '<div class="ach-item' + (on ? ' is-unlocked' : '') + '">' +
        '<span class="ach-icon">' + esc(a.icon) + '</span>' +
        '<div class="ach-body"><b>' + esc(a.title) + '</b><small>' + esc(a.desc) + '</small></div>' +
      '</div>';
    }).join('');
    const layer = openModalRaw({
      modalClass: 'achievement-modal',
      kicker: '成就栏 · ' + (MMS.VERSION_LABEL || 'Ver.0.12'),
      title: '乱世行状',
      sub: '纪录你在牌桌与城破之间留下的痕迹。',
      body: '<div class="ach-progress-head"><span>已解锁 ' + count + ' / ' + all.length + '</span><span>成就栏</span></div><div class="ach-grid">' + body + '</div>',
      actions: modalButton('重置成就', '__reset__', 'btn-ghost') + modalButton('收下', '__close__', 'btn-primary'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    layer.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-modal-value="__close__"]')) closeModal();
      else if (ev.target.closest('[data-modal-value="__reset__"]')) UI.resetAchievements();
    });
  };

  UI.showResult = function (data) {
    Sound.stopAmbient();
    if (UI.recordHistory) UI.recordHistory(data);
    UI.recordAchievements(data);
    const win = !!data.win;
    const p = data.player;
    const ai = (!win && data.ai2 && data.ai && !data.ai.alive && data.ai2.alive) ? data.ai2 : data.ai;
    const pStats = p.stats;
    const quote = win ? p.general.quote : ai.general.quote;
    const quoteFrom = win ? p.general.name : ai.general.name;
    const reason = data.reason || (win ? ai.general.name + '已经倒下。' : '你倒在了乱世里。');
    const layer = openModalRaw({
      extraClass: 'result-layer',
      modalClass: 'result-modal',
      kicker: '终局',
      title: '',
      body: '' +
        '<div class="result-seal">' + esc(win ? '生' : '死') + '</div>' +
        '<div class="result-title">' + (win ? '活过今日' : '饿殍千里') + '</div>' +
        '<div class="result-sub">' + (win ? '你从牌桌上活了下来。' : '这一局，你没能走出乱世。') + ' · ' + esc(reason) + '</div>' +
        '<div class="result-quote">' + esc(quote) + '<span class="from">—— ' + esc(quoteFrom) + '</span></div>' +
        '<div class="result-author">哀鸿 · 城破十日记　/　广开兮穗门 作</div>' +
        '<div class="result-stats">' +
          '<div class="result-stat"><b>' + data.round + '</b><span>回合数</span></div>' +
          '<div class="result-stat"><b>' + pStats.damageDealt + '</b><span>造成伤害</span></div>' +
          '<div class="result-stat"><b>' + pStats.skillsUsed + '</b><span>发动技能</span></div>' +
        '</div>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-result-action="rematch">再战一局</button>' +
          '<button class="btn btn-ghost" type="button" data-result-action="reselect">择将重来</button>' +
          '<button class="btn btn-ghost" type="button" data-result-action="title">回到封面</button>' +
        '</div>',
      actions: '',
      closeable: false
    });
    if (!layer) return;
    Sound.play(win ? 'win' : 'lose');
    layer.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-result-action]');
      if (!btn) return;
      if (MMS.App && MMS.App.handleResult) MMS.App.handleResult(btn.getAttribute('data-result-action'), data);
    });
  };

  UI.openVolumeSettings = function () {
    const initial = Math.round(Sound.getVolume() * 100);
    const layer = openModalRaw({
      kicker: '调试 · 音效',
      title: '音效音量',
      sub: '拖动滑杆调整主音量；设置会保存在本机。',
      body:
        '<div class="volume-settings">' +
          '<div class="volume-readout"><span>主音量</span><b id="volume-value">' + initial + '%</b></div>' +
          '<input id="volume-range" class="volume-range" type="range" min="0" max="100" step="5" value="' + initial + '" aria-label="音效音量">' +
          '<div class="volume-ticks"><span>静音</span><span>默认</span><span>最大</span></div>' +
          '<div class="volume-tests">' +
            '<button class="btn btn-ghost" type="button" data-volume-test="slash">试听【杀】</button>' +
            '<button class="btn btn-ghost" type="button" data-volume-test="dodge">试听【闪】</button>' +
            '<button class="btn btn-ghost" type="button" data-volume-reset>恢复 100%</button>' +
          '</div>' +
          '<p class="volume-note">当前为调试入口：只影响音效与环境声，不影响游戏判定。</p>' +
        '</div>',
      actions: modalButton('关闭', '__close__', 'btn-ghost'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    const range = layer.querySelector('#volume-range');
    const value = layer.querySelector('#volume-value');
    function apply(v) {
      const pct = Math.round(Sound.setVolume(v / 100) * 100);
      if (value) value.textContent = pct + '%';
      if (range) range.value = String(pct);
    }
    if (range) range.addEventListener('input', function () { apply(Number(range.value)); });
    layer.addEventListener('click', function (ev) {
      const test = ev.target.closest('[data-volume-test]');
      if (test) { Sound.play(test.getAttribute('data-volume-test')); return; }
      if (ev.target.closest('[data-volume-reset]')) { apply(100); return; }
      if (ev.target.closest('[data-modal-value="__close__"]')) closeModal();
    });
  };

  UI.openAudioSettings = function () {
    const info = Sound.getBgmInfo();
    const layer = openModalRaw({
      kicker: '音律 · 背景音乐',
      title: '乱世之声',
      sub: '自动随牌局切换；也可以固定曲目，或导入你喜欢的本地音乐。',
      body:
        '<div class="bgm-settings">' +
          '<div class="bgm-now"><span>正在播放</span><b id="bgm-now-name">' + esc(info.name) + '</b></div>' +
          '<div class="bgm-track-list">' +
            '<button class="bgm-track" type="button" data-bgm-track="auto"><b>自 动</b><small>主页 / 牌局 / 濒危</small></button>' +
            '<button class="bgm-track" type="button" data-bgm-track="menu"><b>主页面</b><small>Redemption of the Wolf</small></button>' +
            '<button class="bgm-track" type="button" data-bgm-track="battle"><b>战 斗</b><small>Li\'s March</small></button>' +
            '<button class="bgm-track" type="button" data-bgm-track="danger"><b>濒 危</b><small>Daggers Drawn</small></button>' +
            '<button class="bgm-track" type="button" data-bgm-track="imported"><b>本 地</b><small id="bgm-import-label">' + (bgmImportedName ? esc(bgmImportedName) : '尚未导入') + '</small></button>' +
          '</div>' +
          '<div class="bgm-volume-row"><span>音乐音量</span><b id="bgm-volume-value">' + Math.round(info.volume * 100) + '%</b></div>' +
          '<input id="bgm-volume-range" class="volume-range" type="range" min="0" max="100" step="5" value="' + Math.round(info.volume * 100) + '" aria-label="背景音乐音量">' +
          '<div class="bgm-actions">' +
            '<button class="btn btn-ghost" type="button" data-bgm-file>导入本地音乐</button>' +
            '<button class="btn btn-ghost" type="button" data-bgm-reset>恢复自动</button>' +
          '</div>' +
          '<input id="bgm-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" hidden>' +
          '<p class="bgm-note">自动模式：主页与选将为 Redemption of the Wolf，牌局为 Li\'s March，自身只剩 1 点体力时切到 Daggers Drawn，回复后切回。支持 MP3 / WAV / OGG / M4A，建议 40MB 以内；导入文件仅保存在本机。</p>' +
        '</div>',
      actions: modalButton('关闭', '__close__', 'btn-ghost'),
      closeable: true,
      cancel: function () { closeModal(); }
    });
    if (!layer) return;
    const range = layer.querySelector('#bgm-volume-range');
    const volValue = layer.querySelector('#bgm-volume-value');
    const nowName = layer.querySelector('#bgm-now-name');
    const fileInput = layer.querySelector('#bgm-file-input');
    const importLabel = layer.querySelector('#bgm-import-label');
    function refresh() {
      const i = Sound.getBgmInfo();
      if (nowName) nowName.textContent = i.name;
      if (volValue) volValue.textContent = Math.round(i.volume * 100) + '%';
      if (range) range.value = String(Math.round(i.volume * 100));
      if (importLabel) importLabel.textContent = bgmImportedName || '尚未导入';
      layer.querySelectorAll('[data-bgm-track]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-bgm-track') === i.mode);
      });
    }
    refresh();
    if (range) range.addEventListener('input', function () {
      Sound.setBgmVolume(Number(range.value) / 100);
      refresh();
    });
    layer.addEventListener('click', function (ev) {
      const track = ev.target.closest('[data-bgm-track]');
      if (track) {
        const mode = track.getAttribute('data-bgm-track');
        if (mode === 'imported' && !bgmImportedName) { if (fileInput) fileInput.click(); return; }
        Sound.setBgmMode(mode);
        refresh();
        return;
      }
      if (ev.target.closest('[data-bgm-file]')) { if (fileInput) fileInput.click(); return; }
      if (ev.target.closest('[data-bgm-reset]')) { Sound.resetBgm(); refresh(); return; }
      if (ev.target.closest('[data-modal-value="__close__"]')) closeModal();
    });
    if (fileInput) fileInput.addEventListener('change', async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const ok = await Sound.importBgm(file);
      if (ok) refresh();
    });
  };

})();
