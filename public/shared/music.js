// ─── 8-Bit Music Engine ──────────────────────────────────────────
// Procedural chiptune music using Web Audio API.
// Usage: ArcadeMusic.play("school-runner") / .stop() / .toggle()

window.ArcadeMusic = (() => {
  let ctx = null;
  let masterGain = null;
  let playing = false;
  let currentSong = null;
  let scheduledNodes = [];
  let loopTimer = null;
  let muted = JSON.parse(localStorage.getItem("arcadeMuted") || "false");

  // Note frequencies
  const NOTE = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50,
    Db4: 277.18, Eb4: 311.13, Gb4: 369.99, Ab4: 415.30, Bb4: 466.16,
    Db5: 554.37, Eb5: 622.25, Gb5: 739.99, Ab5: 830.61, Bb5: 932.33,
    Db3: 138.59, Eb3: 155.56, Gb3: 185.00, Ab3: 207.65, Bb3: 233.08,
    REST: 0,
  };
  const R = NOTE.REST;

  // ─── Song Definitions ────────────────────────────────────────
  // Each song has: bpm, tracks[] where each track has { wave, gain, notes[] }
  // notes are [frequency, duration_in_beats]

  const SONGS = {
    "school-runner": {
      bpm: 150,
      tracks: [
        // Lead melody — energetic running theme
        { wave: "square", gain: 0.12, notes: [
          [NOTE.E5, 0.5], [NOTE.E5, 0.5], [R, 0.5], [NOTE.E5, 0.5],
          [R, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 1],
          [NOTE.G5, 1], [R, 1], [NOTE.G4, 1], [R, 1],

          [NOTE.C5, 1], [R, 0.5], [NOTE.G4, 1], [R, 0.5],
          [NOTE.E4, 1], [R, 0.5], [NOTE.A4, 1],
          [NOTE.B4, 1], [NOTE.Bb4, 0.5], [NOTE.A4, 1],

          [NOTE.G4, 0.667], [NOTE.E5, 0.667], [NOTE.G5, 0.667],
          [NOTE.A5, 1], [NOTE.F5, 0.5], [NOTE.G5, 0.5],
          [R, 0.5], [NOTE.E5, 1], [NOTE.C5, 0.5], [NOTE.D5, 0.5], [NOTE.B4, 1],

          [NOTE.C5, 1], [R, 0.5], [NOTE.G4, 1], [R, 0.5],
          [NOTE.E4, 1], [R, 0.5], [NOTE.A4, 1],
          [NOTE.B4, 1], [NOTE.Bb4, 0.5], [NOTE.A4, 1],

          [NOTE.G4, 0.667], [NOTE.E5, 0.667], [NOTE.G5, 0.667],
          [NOTE.A5, 1], [NOTE.F5, 0.5], [NOTE.G5, 0.5],
          [R, 0.5], [NOTE.E5, 1], [NOTE.C5, 0.5], [NOTE.D5, 0.5], [NOTE.B4, 1],
        ]},
        // Bass line
        { wave: "square", gain: 0.08, notes: [
          [NOTE.C3, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5],
          [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5],
          [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5], [R, 0.5],
          [NOTE.G3, 0.5], [R, 0.5], [NOTE.G3, 0.5], [R, 0.5],

          [NOTE.C3, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5],
          [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5],
          [NOTE.A3, 0.5], [NOTE.A3, 0.5], [NOTE.A3, 0.5], [NOTE.A3, 0.5],
          [NOTE.E3, 0.5], [NOTE.E3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5],

          [NOTE.C3, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5],
          [NOTE.F3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5],
          [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.E3, 0.5],
          [NOTE.C3, 0.5], [NOTE.D3, 0.5], [NOTE.E3, 0.5], [NOTE.C3, 0.5],

          [NOTE.C3, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5],
          [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5],
          [NOTE.A3, 0.5], [NOTE.A3, 0.5], [NOTE.A3, 0.5], [NOTE.A3, 0.5],
          [NOTE.E3, 0.5], [NOTE.E3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5],

          [NOTE.C3, 0.5], [NOTE.C3, 0.5], [NOTE.C4, 0.5], [NOTE.C3, 0.5],
          [NOTE.F3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5], [NOTE.F3, 0.5],
          [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.G3, 0.5], [NOTE.E3, 0.5],
          [NOTE.C3, 0.5], [NOTE.D3, 0.5], [NOTE.E3, 0.5], [NOTE.C3, 0.5],
        ]},
        // Arpeggio/harmony
        { wave: "triangle", gain: 0.06, notes: [
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],

          [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.G5, 0.25], [NOTE.D5, 0.25],
          [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.G5, 0.25], [NOTE.D5, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],

          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.C5, 0.25],
          [NOTE.E4, 0.25], [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.G4, 0.25],

          [NOTE.F4, 0.25], [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.A4, 0.25],
          [NOTE.F4, 0.25], [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.A4, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],

          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.25], [NOTE.E5, 0.25],
          [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.C5, 0.25],
          [NOTE.E4, 0.25], [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.G4, 0.25],

          [NOTE.F4, 0.25], [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.A4, 0.25],
          [NOTE.F4, 0.25], [NOTE.A4, 0.25], [NOTE.C5, 0.25], [NOTE.A4, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],
          [NOTE.G4, 0.25], [NOTE.B4, 0.25], [NOTE.D5, 0.25], [NOTE.B4, 0.25],
        ]},
      ],
    },

    "tetris": {
      bpm: 140,
      tracks: [
        // Lead — dark, tense Russian-flavored melody (original composition)
        { wave: "square", gain: 0.11, notes: [
          [NOTE.E5, 1], [NOTE.B4, 0.5], [NOTE.C5, 0.5],
          [NOTE.D5, 1], [NOTE.C5, 0.5], [NOTE.B4, 0.5],
          [NOTE.A4, 1], [NOTE.A4, 0.5], [NOTE.C5, 0.5],
          [NOTE.E5, 1], [NOTE.D5, 0.5], [NOTE.C5, 0.5],

          [NOTE.B4, 1.5], [NOTE.C5, 0.5],
          [NOTE.D5, 1], [NOTE.E5, 1],
          [NOTE.C5, 1], [NOTE.A4, 1],
          [NOTE.A4, 2],

          [R, 0.5], [NOTE.D5, 1], [NOTE.F5, 0.5],
          [NOTE.A5, 1], [NOTE.G5, 0.5], [NOTE.F5, 0.5],
          [NOTE.E5, 1.5], [NOTE.C5, 0.5],
          [NOTE.E5, 1], [NOTE.D5, 0.5], [NOTE.C5, 0.5],

          [NOTE.B4, 1], [NOTE.B4, 0.5], [NOTE.C5, 0.5],
          [NOTE.D5, 1], [NOTE.E5, 1],
          [NOTE.C5, 1], [NOTE.A4, 1],
          [NOTE.A4, 2],
        ]},
        // Bass — driving, ominous
        { wave: "square", gain: 0.07, notes: [
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],

          [NOTE.G3, 0.5], [NOTE.D3, 0.5], [NOTE.G3, 0.5], [NOTE.D3, 0.5],
          [NOTE.G3, 0.5], [NOTE.D3, 0.5], [NOTE.G3, 0.5], [NOTE.D3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],

          [NOTE.D3, 0.5], [NOTE.A3, 0.5], [NOTE.D3, 0.5], [NOTE.A3, 0.5],
          [NOTE.D3, 0.5], [NOTE.A3, 0.5], [NOTE.D3, 0.5], [NOTE.A3, 0.5],
          [NOTE.C3, 0.5], [NOTE.G3, 0.5], [NOTE.C3, 0.5], [NOTE.G3, 0.5],
          [NOTE.C3, 0.5], [NOTE.G3, 0.5], [NOTE.C3, 0.5], [NOTE.G3, 0.5],

          [NOTE.G3, 0.5], [NOTE.D3, 0.5], [NOTE.G3, 0.5], [NOTE.D3, 0.5],
          [NOTE.G3, 0.5], [NOTE.D3, 0.5], [NOTE.G3, 0.5], [NOTE.D3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
          [NOTE.A3, 0.5], [NOTE.E3, 0.5], [NOTE.A3, 0.5], [NOTE.E3, 0.5],
        ]},
        // Counter-melody — triangle wave for warmth
        { wave: "triangle", gain: 0.06, notes: [
          [NOTE.A4, 0.5], [R, 0.5], [NOTE.C5, 0.5], [R, 0.5],
          [NOTE.B4, 0.5], [R, 0.5], [NOTE.A4, 0.5], [R, 0.5],
          [NOTE.A4, 0.5], [R, 0.5], [NOTE.C5, 0.5], [R, 0.5],
          [NOTE.E5, 0.5], [R, 0.5], [NOTE.D5, 0.5], [R, 0.5],

          [NOTE.B4, 0.5], [R, 1], [NOTE.C5, 0.5],
          [NOTE.D5, 0.5], [R, 0.5], [NOTE.E5, 0.5], [R, 0.5],
          [NOTE.C5, 0.5], [R, 0.5], [NOTE.A4, 0.5], [R, 0.5],
          [NOTE.A4, 1], [R, 1],

          [R, 0.5], [NOTE.D5, 0.5], [R, 0.5], [NOTE.F5, 0.5],
          [NOTE.A5, 0.5], [R, 0.5], [NOTE.G5, 0.5], [R, 0.5],
          [NOTE.E5, 0.5], [R, 0.5], [NOTE.C5, 0.5], [R, 0.5],
          [NOTE.E5, 0.5], [R, 0.5], [NOTE.D5, 0.5], [R, 0.5],

          [NOTE.B4, 0.5], [R, 0.5], [NOTE.B4, 0.5], [R, 0.5],
          [NOTE.D5, 0.5], [R, 0.5], [NOTE.E5, 0.5], [R, 0.5],
          [NOTE.C5, 0.5], [R, 0.5], [NOTE.A4, 0.5], [R, 0.5],
          [NOTE.A4, 1], [R, 1],
        ]},
      ],
    },

    "flappy": {
      bpm: 120,
      tracks: [
        // Lead — dreamy, floaty electronic melody
        { wave: "square", gain: 0.10, notes: [
          [NOTE.E5, 1], [NOTE.G5, 0.5], [NOTE.A5, 0.5], [NOTE.G5, 1],
          [NOTE.E5, 0.5], [NOTE.D5, 0.5], [NOTE.C5, 1], [NOTE.D5, 1],
          [NOTE.E5, 1], [NOTE.C5, 0.5], [NOTE.D5, 0.5], [NOTE.E5, 1],
          [NOTE.G5, 1], [NOTE.A5, 0.5], [NOTE.G5, 0.5], [NOTE.E5, 1],

          [NOTE.D5, 1], [NOTE.E5, 0.5], [NOTE.D5, 0.5], [NOTE.C5, 1],
          [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.D5, 1],
          [NOTE.E5, 1.5], [NOTE.D5, 0.5],
          [NOTE.C5, 1], [NOTE.A4, 1], [NOTE.C5, 1], [R, 1],

          [NOTE.A5, 1], [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 1],
          [NOTE.A5, 0.5], [NOTE.G5, 0.5], [NOTE.E5, 1], [NOTE.D5, 1],
          [NOTE.C5, 1], [NOTE.D5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 1],
          [NOTE.E5, 1], [NOTE.D5, 0.5], [NOTE.C5, 0.5], [NOTE.D5, 1],

          [NOTE.E5, 1], [NOTE.G5, 0.5], [NOTE.A5, 0.5], [NOTE.G5, 1],
          [NOTE.E5, 0.5], [NOTE.D5, 0.5], [NOTE.C5, 1], [NOTE.D5, 1],
          [NOTE.C5, 2], [R, 1],
          [NOTE.C5, 1], [NOTE.D5, 0.5], [NOTE.E5, 0.5], [R, 1],
        ]},
        // Bass — steady pulse
        { wave: "triangle", gain: 0.08, notes: [
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.A3, 1], [NOTE.E3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],

          [NOTE.F3, 1], [NOTE.C3, 1], [NOTE.F3, 1], [NOTE.C3, 1],
          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.G3, 1], [NOTE.D3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.C3, 1], [NOTE.G3, 1],

          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.A3, 1], [NOTE.E3, 1],
          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.G3, 1], [NOTE.D3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],

          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.A3, 1], [NOTE.E3, 1], [NOTE.A3, 1], [NOTE.E3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
          [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.C3, 1], [NOTE.G3, 1],
        ]},
        // Arpeggiated pads
        { wave: "sine", gain: 0.05, notes: [
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],

          [NOTE.F4, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.F5, 0.5],
          [NOTE.C5, 0.5], [NOTE.A4, 0.5], [NOTE.F4, 0.5], [NOTE.A4, 0.5],
          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.G4, 0.5], [NOTE.B4, 0.5], [NOTE.D5, 0.5], [NOTE.G5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.E5, 0.5],

          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5],
          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.G4, 0.5], [NOTE.B4, 0.5], [NOTE.D5, 0.5], [NOTE.G5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],

          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A5, 0.5],
          [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
          [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C6, 0.5],
          [NOTE.G5, 0.5], [NOTE.E5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
        ]},
      ],
    },
  };

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  }

  function scheduleTrack(track, startTime, beatDur) {
    let t = startTime;
    for (const [freq, beats] of track.notes) {
      const dur = beats * beatDur;
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = track.wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(track.gain, t);
        // Slight attack/decay envelope for less harsh sound
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(track.gain, t + 0.01);
        gain.gain.setValueAtTime(track.gain, t + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur);
        scheduledNodes.push(osc);
      }
      t += dur;
    }
    return t - startTime; // total duration
  }

  function scheduleSong(songId) {
    const song = SONGS[songId];
    if (!song) return;
    const beatDur = 60 / song.bpm;

    // Find longest track duration
    let maxDur = 0;
    for (const track of song.tracks) {
      let dur = 0;
      for (const [, beats] of track.notes) dur += beats * beatDur;
      if (dur > maxDur) maxDur = dur;
    }

    const startTime = ctx.currentTime + 0.05;
    for (const track of song.tracks) {
      scheduleTrack(track, startTime, beatDur);
    }

    // Schedule next loop
    loopTimer = setTimeout(() => {
      if (playing && currentSong === songId) {
        scheduleSong(songId);
      }
    }, maxDur * 1000 - 100); // slightly early to avoid gaps
  }

  function play(songId) {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (playing && currentSong === songId) return;
    stop();
    playing = true;
    currentSong = songId;
    scheduleSong(songId);
  }

  function stop() {
    playing = false;
    currentSong = null;
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    for (const node of scheduledNodes) {
      try { node.stop(); } catch (e) {}
    }
    scheduledNodes = [];
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem("arcadeMuted", JSON.stringify(muted));
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : 1;
    }
    return !muted;
  }

  function isMuted() {
    return muted;
  }

  return { play, stop, toggle, isMuted };
})();
