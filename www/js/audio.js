'use strict';
/*
 * Vale Florido — efeitos sonoros e trilha sonora sintetizados com Web Audio
 * (sem arquivos .wav: tudo é gerado na hora).
 */
const Sound = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  let sfxOn = true, musOn = true;
  try {
    const p = JSON.parse(localStorage.getItem('valeflorido_audio') || '{}');
    if (p.sfx === false) sfxOn = false;
    if (p.mus === false) musOn = false;
  } catch (e) { /* sem armazenamento: usa padrão */ }

  function persist() {
    try { localStorage.setItem('valeflorido_audio', JSON.stringify({ sfx: sfxOn, mus: musOn })); } catch (e) { /* ignora */ }
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.7 : 0; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = musOn ? 0.2 : 0; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function noise({ dur = 0.1, type = 'lowpass', f = 1000, q = 1, vol = 0.5, delay = 0, attack = 0.004 }) {
    if (!ac || !sfxOn) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slideTo = null, bus = null) {
    if (!ac) return;
    if (!bus && !sfxOn) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const sfx = {
    hoe() { noise({ dur: 0.13, f: 650, vol: 0.9 }); tone(120, 0.12, 'sine', 0.5, 0, 55); },
    water() { noise({ dur: 0.6, type: 'bandpass', f: 1700, q: 0.7, vol: 0.32, attack: 0.08 }); noise({ dur: 0.45, type: 'highpass', f: 3800, vol: 0.08, attack: 0.1 }); },
    pop() { tone(420, 0.09, 'sine', 0.5, 0, 980); tone(1250, 0.04, 'square', 0.06, 0.03); },
    coin() { tone(1318.5, 0.08, 'square', 0.12); tone(1760, 0.4, 'square', 0.12, 0.08); },
    chop() { noise({ dur: 0.1, type: 'bandpass', f: 520, q: 2, vol: 0.9 }); tone(190, 0.1, 'triangle', 0.5, 0, 90); },
    rock() { noise({ dur: 0.09, type: 'highpass', f: 2200, vol: 0.5 }); tone(1500, 0.09, 'square', 0.07, 0, 900); },
    plant() { noise({ dur: 0.08, f: 1300, vol: 0.4 }); tone(660, 0.05, 'sine', 0.15, 0.04); },
    splash() { noise({ dur: 0.4, f: 1400, vol: 0.6, attack: 0.01 }); },
    bite() { tone(1046, 0.07, 'square', 0.14); tone(1568, 0.12, 'square', 0.14, 0.08); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'square', 0.1, i * 0.1)); },
    eat() { noise({ dur: 0.06, type: 'bandpass', f: 900, q: 3, vol: 0.5 }); noise({ dur: 0.06, type: 'bandpass', f: 800, q: 3, vol: 0.5, delay: 0.13 }); },
    click() { tone(880, 0.04, 'square', 0.05); },
    error() { tone(200, 0.15, 'square', 0.08, 0, 130); },
    swing() { noise({ dur: 0.09, type: 'bandpass', f: 2500, q: 1.5, vol: 0.12, attack: 0.03 }); },
  };

  // ---------- Trilha: violão/ukulele lo-fi em loop ----------
  const BPM = 78, EIGHTH = 60 / BPM / 2;
  const CHORDS = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]]; // Fmaj7 Em7 Dm7 Cmaj7
  const BASS = [41, 40, 38, 36];
  const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  const SCALE = [72, 74, 76, 79, 81, 84];
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  let melody = [];
  (function buildMelody() {
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 128; i++) melody.push(r() < 0.38 ? SCALE[(r() * SCALE.length) | 0] : 0);
  })();

  let step = 0, nextT = 0, timer = null;

  function pluck(freq, t, vol, dur = 0.9) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = freq * 1.003;
    const g = ac.createGain(), g2 = ac.createGain(); g2.gain.value = 0.12;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(musBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function schedule() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % 4, e = step % 8;
      const ch = CHORDS[bar];
      pluck(mf(ch[ARP[e]]), nextT, e === 0 ? 0.32 : 0.22);
      if (e === 0 || e === 4) {
        const t = nextT, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = mf(BASS[bar]);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 3.5);
        o.connect(g); g.connect(musBus); o.start(t); o.stop(t + EIGHTH * 4);
      }
      const mel = melody[step % melody.length];
      if (mel && Math.floor(step / 32) % 2 === 1) pluck(mf(mel), nextT, 0.16, 1.3);
      nextT += EIGHTH * (e % 2 ? 0.92 : 1.08); // leve swing
      step++;
    }
  }

  function startMusic() {
    if (timer) return;
    nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 120);
  }

  return {
    init,
    play(name) { if (ac && sfxOn && sfx[name]) sfx[name](); },
    get sfxOn() { return sfxOn; },
    get musOn() { return musOn; },
    toggleSfx() { sfxOn = !sfxOn; if (sfxBus) sfxBus.gain.value = sfxOn ? 0.7 : 0; persist(); return sfxOn; },
    toggleMusic() { musOn = !musOn; if (musBus) musBus.gain.value = musOn ? 0.2 : 0; persist(); return musOn; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
