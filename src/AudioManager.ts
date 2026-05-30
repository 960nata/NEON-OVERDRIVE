// Web Audio API Synthesizer and Sound Effects Manager for Neon Overdrive

class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private backgroundLoopIntervalId: any = null;
  private currentStep: number = 0;
  private tempo: number = 125; // BPM
  private isPlayingMusic: boolean = false;

  // Nodes for engine hum
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    
    // Create AudioContext (handling cross-browser names)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
    } else {
      if (this.engineGain) this.engineGain.gain.value = 0.05;
    }
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  // --- Sound Effects ---

  public playLaser() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    
    // Oscillator for laser sound (sawtooth or triangle)
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, time);
    // Fast frequency sweep down
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.18);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.18);

    gainNode.gain.setValueAtTime(0.15, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  public playEnemyLaser() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    
    // Higher pitched oscillator for enemy laser (triangle with sweep)
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(300, time + 0.12);

    gainNode.gain.setValueAtTime(0.08, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  public playExplosion() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    const duration = 0.8;

    // Create white noise buffer
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Start with low pass cutoff high and drop it rapidly
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(60, time + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.4, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noiseNode.start(time);
    noiseNode.stop(time + duration);

    // Add a sub-bass rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(100, time);
    subOsc.frequency.linearRampToValueAtTime(10, time + 0.4);

    subGain.gain.setValueAtTime(0.5, time);
    subGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(time);
    subOsc.stop(time + 0.4);
  }

  public playHit() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    const duration = 0.25;

    // Plucky retro hit
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.linearRampToValueAtTime(50, time + duration);

    gainNode.gain.setValueAtTime(0.25, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
  }

  public playGameOver() {
    this.resume();
    this.stopMusic();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    const duration = 1.8;

    // Distorted frequency sweep down
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, time);
    osc1.frequency.linearRampToValueAtTime(30, time + duration);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(154, time); // slightly detuned
    osc2.frequency.linearRampToValueAtTime(31, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(50, time + duration);

    gainNode.gain.setValueAtTime(0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  // --- Continuous Engine Hum ---

  public startEngine() {
    this.resume();
    if (this.isMuted || !this.ctx || this.engineOsc) return;

    const time = this.ctx.currentTime;
    
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.setValueAtTime(45, time); // low hum
    
    this.engineGain.gain.setValueAtTime(0.05, time);

    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    
    this.engineOsc.start(time);
  }

  public setEngineSpeed(speedFactor: number) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || this.isMuted) return;
    
    const time = this.ctx.currentTime;
    // Map speedFactor (0 to 1) to frequency (45Hz to 95Hz)
    const freq = 45 + speedFactor * 50;
    this.engineOsc.frequency.setTargetAtTime(freq, time, 0.1);
    
    // Scale hum volume slightly with speed
    const gainVal = 0.04 + speedFactor * 0.04;
    this.engineGain.gain.setTargetAtTime(gainVal, time, 0.1);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch (e) {}
      this.engineOsc = null;
    }
    this.engineGain = null;
  }

  // --- Background Synth Music Loop ---

  public startMusic() {
    this.resume();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.startEngine();

    // Octaved classic synthwave driving bassline
    // Notes: A (La), G (Sol), F (Fa), E (Mi)
    const baseFreqs = {
      A: 55.00,  // A1
      G: 48.99,  // G1
      F: 43.65,  // F1
      E: 41.20   // E1
    };

    // 16-step pattern: notes and octaves (0 = base, 1 = octave up)
    const pattern = [
      { note: 'A', oct: 0 }, { note: 'A', oct: 0 }, { note: 'A', oct: 1 }, { note: 'A', oct: 0 },
      { note: 'G', oct: 0 }, { note: 'G', oct: 0 }, { note: 'G', oct: 1 }, { note: 'G', oct: 0 },
      { note: 'F', oct: 0 }, { note: 'F', oct: 0 }, { note: 'F', oct: 1 }, { note: 'F', oct: 0 },
      { note: 'E', oct: 0 }, { note: 'E', oct: 0 }, { note: 'E', oct: 1 }, { note: 'E', oct: 1 }
    ];

    const stepDuration = 60 / this.tempo / 2; // eighth notes
    this.currentStep = 0;

    const playStep = () => {
      if (!this.ctx || !this.isPlayingMusic) return;

      const time = this.ctx.currentTime;
      const step = pattern[this.currentStep];
      const baseFreq = baseFreqs[step.note as keyof typeof baseFreqs];
      const freq = step.oct === 1 ? baseFreq * 2 : baseFreq;

      if (!this.isMuted) {
        // Synthesize a retro plucky synth bass sound
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);

        // Sub oscillator for more beefy sound
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq / 2, time);

        filter.type = 'lowpass';
        // Pluck envelope: filter frequency starts high, decays rapidly
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(150, time + stepDuration * 0.9);
        filter.Q.setValueAtTime(4, time);

        // Volume envelope
        gainNode.gain.setValueAtTime(0.12, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.95);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + stepDuration);
        osc2.stop(time + stepDuration);
      }

      this.currentStep = (this.currentStep + 1) % pattern.length;
    };

    // Run scheduler
    const scheduleNext = () => {
      if (!this.isPlayingMusic) return;
      playStep();
      const delay = stepDuration * 1000;
      this.backgroundLoopIntervalId = setTimeout(scheduleNext, delay);
    };

    scheduleNext();
  }

  public stopMusic() {
    this.isPlayingMusic = false;
    this.stopEngine();
    if (this.backgroundLoopIntervalId) {
      clearTimeout(this.backgroundLoopIntervalId);
      this.backgroundLoopIntervalId = null;
    }
  }
}

// Export a singleton instance
export const audioManager = new AudioManager();
