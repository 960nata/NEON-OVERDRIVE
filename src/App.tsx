import { useState, useEffect, useRef } from 'react';
import { GameEngine } from './GameEngine';
import { audioManager } from './AudioManager';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);

  // React state for game HUD and screens
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [speed, setSpeed] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [selectedShip, setSelectedShip] = useState<'f15' | 'f22' | 'su57'>('f15');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport or touch capability
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize game on canvas mount
  useEffect(() => {
    if (!canvasRef.current) return;

    // Load High Score from LocalStorage
    const savedHighScore = localStorage.getItem('neon_overdrive_highscore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }

    // Initialize Game Engine
    const engine = new GameEngine(canvasRef.current, {
      onScoreChange: (s) => {
        setScore(s);
      },
      onHealthChange: (h) => {
        setHealth((prev) => {
          // If health drops (and is not initial setting or gameover reset)
          if (h < prev && h >= 0 && prev <= 3) {
            setDamageFlash(true);
            setTimeout(() => setDamageFlash(false), 150);
          }
          return h;
        });
      },
      onSpeedChange: (sp) => {
        setSpeed(sp);
      },
      onGameOver: (finalScore) => {
        setGameState('gameover');
        
        // Save new high score if applicable
        const savedHigh = localStorage.getItem('neon_overdrive_highscore');
        const currentHigh = savedHigh ? parseInt(savedHigh, 10) : 0;
        if (finalScore > currentHigh) {
          localStorage.setItem('neon_overdrive_highscore', finalScore.toString());
          setHighScore(finalScore);
        }
      },
    });

    gameRef.current = engine;
    
    // Start background demo animation for main menu
    engine.startMenuDemo();

    // Resize Handler
    const handleResize = () => {
      if (gameRef.current) {
        gameRef.current.handleResize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameRef.current) {
        gameRef.current.cleanup();
        gameRef.current = null;
      }
    };
  }, []);

  const startGame = () => {
    // Resume browser AudioContext
    audioManager.resume();
    
    if (gameRef.current) {
      gameRef.current.reset();
      gameRef.current.start();
    }
    
    setScore(0);
    setHealth(3);
    setGameState('playing');
  };

  const selectShipType = (type: 'f15' | 'f22' | 'su57') => {
    setSelectedShip(type);
    if (gameRef.current) {
      gameRef.current.setShipType(type);
    }
  };

  const pauseGame = () => {
    if (gameRef.current) {
      gameRef.current.pause();
    }
    setGameState('paused');
  };

  const resumeGame = () => {
    if (gameRef.current) {
      gameRef.current.start();
    }
    setGameState('playing');
  };

  const exitToMenu = () => {
    if (gameRef.current) {
      gameRef.current.reset();
      gameRef.current.startMenuDemo();
    }
    setGameState('menu');
  };

  const handleMuteToggle = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  // Listen for global Pause keys (Escape or P)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          pauseGame();
        } else if (gameState === 'paused') {
          resumeGame();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [gameState]);

  // Speed bar percentage (relative to a top speed of 120 units)
  const speedPercentage = Math.min((speed / 120) * 100, 100);

  return (
    <div className="app-container">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Retro overlays (CRT Scanlines and dark vignette edges) */}
      <div className="scanlines" />
      <div className="screen-vignette" />

      {/* Screen flash on hit */}
      {damageFlash && (
        <div 
          className="ui-screen glitch-flash" 
          style={{ pointerEvents: 'none', zIndex: 14 }} 
        />
      )}

      {/* Main Menu overlay */}
      {gameState === 'menu' && (
        <div className="ui-screen">
          <div className="glass-panel">
            <h1 className="title glow-pink">NEON</h1>
            <h1 className="title glow-cyan">OVERDRIVE</h1>
            <h2 className="subtitle">3D Tunnel Racer</h2>

            <p className="instructions">
              Navigate the endless cybergrid tunnel. Dodge obstacles and blast enemy fighters in hyperspeed combat.
            </p>

            <div className="control-guide">
              {isMobile ? (
                <>
                  <div className="control-row">
                    <span>Steer Ship:</span>
                    <span className="glow-cyan" style={{ fontWeight: 600 }}>Swipe Left / Right</span>
                  </div>
                  <div className="control-row">
                    <span>Fire Lasers:</span>
                    <span className="glow-pink" style={{ fontWeight: 600 }}>Tap Screen</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="control-row">
                    <span>Steer Ship:</span>
                    <span>
                      <span className="key-cap">A</span> / <span className="key-cap">D</span> or <span className="key-cap">←</span> / <span className="key-cap">→</span>
                    </span>
                  </div>
                  <div className="control-row">
                    <span>Mouse / Touch:</span>
                    <span>Drag Left / Right</span>
                  </div>
                  <div className="control-row">
                    <span>Fire Lasers:</span>
                    <span>
                      <span className="key-cap">Spacebar</span> or <span className="key-cap">Tap Screen</span>
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="ship-selector-title">Select Cyber Jet</div>
            <div className="ship-selector-grid">
              <div 
                className={`ship-select-card ${selectedShip === 'f15' ? 'active-f15' : ''}`}
                onClick={() => selectShipType('f15')}
              >
                <div className="ship-card-name">F-15</div>
                <div className="ship-card-desc">Swept Wing<br/>Cyan</div>
              </div>
              <div 
                className={`ship-select-card ${selectedShip === 'f22' ? 'active-f22' : ''}`}
                onClick={() => selectShipType('f22')}
              >
                <div className="ship-card-name">F-22</div>
                <div className="ship-card-desc">Stealth Diamond<br/>Pink</div>
              </div>
              <div 
                className={`ship-select-card ${selectedShip === 'su57' ? 'active-su57' : ''}`}
                onClick={() => selectShipType('su57')}
              >
                <div className="ship-card-name">Su-57</div>
                <div className="ship-card-desc">Delta Body<br/>Gold</div>
              </div>
            </div>

            <button className="cyber-btn" onClick={startGame}>
              Start Mission
            </button>

            {highScore > 0 && (
              <div className="high-score-box">
                SYSTEM HIGH SCORE: {highScore}
              </div>
            )}

            <a 
              href="https://hadinata.dev" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="branding-text"
              style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}
            >
              POWERED BY HADINATA.DEV
            </a>
          </div>
        </div>
      )}

      {/* Gameplay HUD */}
      {gameState === 'playing' && (
        <div className="hud-container">
          <div className="hud-top">
            {/* Shield/Health indicator */}
            <div className="hud-element">
              <div className="hud-label">Shield Integrity</div>
              <div className="hud-value glow-pink">{health * 33}%</div>
              <div className="shield-bar">
                <div className={`shield-cell ${health >= 1 ? 'active' : ''}`} />
                <div className={`shield-cell ${health >= 2 ? 'active' : ''}`} />
                <div className={`shield-cell ${health >= 3 ? 'active' : ''}`} />
              </div>
            </div>

            {/* Current Score */}
            <div className="hud-element" style={{ textAlign: 'right' }}>
              <div className="hud-label">Score</div>
              <div className="hud-value glow-cyan">{score}</div>
            </div>
          </div>

          <div className="hud-bottom">
            {/* Speed Indicator */}
            <div className="hud-element">
              <div className="hud-label">Velocity</div>
              <div className="hud-value glow-cyan">
                {speed} <span style={{ fontSize: '12px' }}>KM/H</span>
              </div>
              {/* Dynamic Speed Bar */}
              <div style={{
                width: '130px',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '3px',
                marginTop: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${speedPercentage}%`,
                  height: '100%',
                  background: 'var(--neon-cyan)',
                  boxShadow: '0 0 8px var(--neon-cyan)',
                  transition: 'width 0.15s ease'
                }} />
              </div>
            </div>

            {/* Control Buttons Group */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Pause Button */}
              <button 
                className="mute-button" 
                onClick={pauseGame}
                title="Pause Game"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                </svg>
              </button>

              {/* Mute controller */}
              <button 
                className="mute-button" 
                onClick={handleMuteToggle}
                title={isMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Screen Overlay */}
      {gameState === 'paused' && (
        <div className="ui-screen">
          <div className="glass-panel" style={{ borderColor: 'var(--neon-cyan)', boxShadow: '0 8px 32px 0 rgba(0, 240, 255, 0.2)' }}>
            <h1 className="title glow-cyan">PAUSED</h1>
            <h2 className="subtitle">Mission Suspended</h2>

            <p className="instructions" style={{ marginBottom: '20px' }}>
              Your cyberfighter is in stasis. Firing controls and engines are offline.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button className="cyber-btn" onClick={resumeGame} style={{ margin: 0, width: '100%' }}>
                Resume Mission
              </button>
              <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
                <button className="cyber-btn pink" onClick={startGame} style={{ margin: 0, flex: 1 }}>
                  Restart
                </button>
                <button className="cyber-btn" onClick={exitToMenu} style={{ margin: 0, flex: 1 }}>
                  Exit Menu
                </button>
              </div>
            </div>

            <a 
              href="https://hadinata.dev" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="branding-text"
              style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}
            >
              POWERED BY HADINATA.DEV
            </a>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="ui-screen">
          <div className="glass-panel" style={{ borderColor: 'var(--neon-pink)', boxShadow: '0 8px 32px 0 rgba(255, 0, 127, 0.2)' }}>
            <h1 className="title glow-pink">GAME OVER</h1>
            <h2 className="subtitle">Mission Terminated</h2>

            <div style={{ margin: '15px 0', fontSize: '18px', fontFamily: 'var(--font-orbitron)' }}>
              <div style={{ marginBottom: '6px' }}>
                FINAL SCORE: <span className="glow-cyan" style={{ fontWeight: 800 }}>{score}</span>
              </div>
              <div>
                HIGH SCORE: <span className="glow-yellow" style={{ fontWeight: 800 }}>{highScore}</span>
              </div>
            </div>

            <div className="ship-selector-title" style={{ marginTop: '10px', fontSize: '12px' }}>Change Cyber Jet</div>
            <div className="ship-selector-grid" style={{ marginBottom: '15px', transform: 'scale(0.95)' }}>
              <div 
                className={`ship-select-card ${selectedShip === 'f15' ? 'active-f15' : ''}`}
                onClick={() => selectShipType('f15')}
                style={{ padding: '8px' }}
              >
                <div className="ship-card-name" style={{ fontSize: '13px' }}>F-15</div>
                <div className="ship-card-desc" style={{ fontSize: '9px', marginTop: '2px' }}>Cyan</div>
              </div>
              <div 
                className={`ship-select-card ${selectedShip === 'f22' ? 'active-f22' : ''}`}
                onClick={() => selectShipType('f22')}
                style={{ padding: '8px' }}
              >
                <div className="ship-card-name" style={{ fontSize: '13px' }}>F-22</div>
                <div className="ship-card-desc" style={{ fontSize: '9px', marginTop: '2px' }}>Pink</div>
              </div>
              <div 
                className={`ship-select-card ${selectedShip === 'su57' ? 'active-su57' : ''}`}
                onClick={() => selectShipType('su57')}
                style={{ padding: '8px' }}
              >
                <div className="ship-card-name" style={{ fontSize: '13px' }}>Su-57</div>
                <div className="ship-card-desc" style={{ fontSize: '9px', marginTop: '2px' }}>Gold</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%' }}>
              <button className="cyber-btn pink" onClick={startGame} style={{ margin: 0, flex: 1 }}>
                Retry
              </button>
              <button className="cyber-btn" onClick={exitToMenu} style={{ margin: 0, flex: 1 }}>
                Exit Menu
              </button>
            </div>

            <a 
              href="https://hadinata.dev" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="branding-text"
              style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}
            >
              POWERED BY HADINATA.DEV
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
