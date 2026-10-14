// Procedural audio — every cue is synthesized on the fly (oscillators +
// noise buffers), so there are no audio asset files to ship or license.
const AudioSys = (() => {
  let actx = null, master = null, musicGain = null;
  let volume = 0.6;

  function ensure() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = volume; master.connect(actx.destination);
    musicGain = actx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
  }
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }
  function tone(freq, duration, type = 'sine', vol = 0.15, sweepTo = null, detune = 0) {
    ensure();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    const jitter = 1 + (Math.random() - 0.5) * 0.06;
    osc.frequency.setValueAtTime(freq * jitter, actx.currentTime);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, actx.currentTime + duration);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration);
    osc.connect(gain); gain.connect(master);
    osc.start(); osc.stop(actx.currentTime + duration);
  }
  function noiseBurst(duration, vol = 0.1) {
    ensure();
    const bufferSize = actx.sampleRate * duration;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource(); src.buffer = buffer;
    const gain = actx.createGain(); gain.gain.value = vol;
    src.connect(gain); gain.connect(master);
    src.start();
  }
  let ambientStarted = false;
  function startAmbient() {
    ensure();
    if (ambientStarted) return;
    ambientStarted = true;
    const osc1 = actx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 55;
    const osc2 = actx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 82.5;
    const g = actx.createGain(); g.gain.value = 0.025;
    osc1.connect(g); osc2.connect(g); g.connect(master);
    osc1.start(); osc2.start();
  }
  function setTension(level) {
    if (!musicGain) return;
    musicGain.gain.linearRampToValueAtTime(level * 0.05, actx.currentTime + 0.4);
  }

  return {
    setVolume, startAmbient, setTension,
    shootAssault: () => tone(880, 0.05, 'square', 0.05),
    shootSniper: () => { tone(220, 0.18, 'sawtooth', 0.09, 90); noiseBurst(0.08, 0.04); },
    shootShotgun: () => noiseBurst(0.1, 0.08),
    hit: () => tone(140, 0.09, 'sawtooth', 0.08),
    hurt: () => tone(90, 0.18, 'sawtooth', 0.14),
    pickup: () => tone(660, 0.07, 'sine', 0.07, 1000),
    coin: () => tone(1200, 0.1, 'sine', 0.06, 1600),
    levelUp: () => tone(440, 0.4, 'sine', 0.12, 1300),
    dash: () => tone(300, 0.1, 'triangle', 0.08, 600),
    stun: () => tone(2000, 0.15, 'square', 0.05, 300),
    explode: () => { tone(120, 0.4, 'sawtooth', 0.15, 30); noiseBurst(0.3, 0.12); },
    bossDefeat: () => { tone(200, 0.9, 'sawtooth', 0.18, 50); noiseBurst(0.6, 0.1); },
    bossTelegraph: () => tone(500, 0.3, 'square', 0.06, 900),
    death: () => tone(200, 0.5, 'sawtooth', 0.15, 40),
    crit: () => tone(1500, 0.08, 'square', 0.07, 2200),
    // UI family: dry, mechanical, short. Never tonal except confirm.
    uiHover: () => tone(1400, 0.03, 'square', 0.025),
    uiClick: () => { tone(220, 0.05, 'square', 0.06); tone(880, 0.03, 'square', 0.03); },
    uiDeny: () => tone(110, 0.14, 'sawtooth', 0.07, 70),
    exploitPing: () => tone(1800, 0.12, 'square', 0.06, 2600),
    exploitHit: () => { tone(2200, 0.07, 'square', 0.08, 3200); tone(1100, 0.05, 'sine', 0.05); },
    overload: () => { tone(180, 0.5, 'sawtooth', 0.16, 900); noiseBurst(0.25, 0.08); },
  };
})();

export { AudioSys };
