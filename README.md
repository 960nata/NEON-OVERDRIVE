# 🚀 Neon Overdrive - 3D Synthwave Tunnel Racer

**Neon Overdrive** is a premium, high-performance, real-time 3D Synthwave Tunnel Racer game built using React, TypeScript, and raw Three.js. Pilot customizable wireframe fighter jets through a hyper-speed neon-lit cyber tunnel, dodge barriers, and engage in high-octane laser battles with enemy spacecraft!

---

## 🎨 Features & Highlights

- **3D Cyberpunk Graphics**: Pure WebGL rendering using **Three.js** with neon colors, glassmorphic UI panels, CRT scanline overlays, glitch effects, and smooth rendering performance.
- **Custom Aircraft Selector**:
  - **F-15 Eagle**: Swept wing fighter styled in Neon Cyan.
  - **F-22 Raptor**: Diamond wing stealth fighter styled in Neon Pink.
  - **Su-57 Felon**: Delta body advanced fighter styled in Neon Gold/Yellow.
- **Dynamic Real-time Sound Synthesis**: Powered by a custom **Web Audio API synthesizer** (`AudioManager.ts`). Generates synthwave music loops, engine pitch-shifting, laser zaps, and explosions dynamically in the browser, removing the need for heavy audio file downloads.
- **Active Cyber Combat**: Dodge barricades, pyramids, and cubes while destroying weaving enemy aircraft that fire hostiles lasers.
- **Complete Game Loop**: Title menu, real-time HUD (shield integrity, score tracking, speed gauge), game pause menu, and a Game Over screen with direct plane swap controls.
- **Branded Link**: Fully integrated, glowing link pointing to [HADINATA.DEV](https://hadinata.dev).

---

## 🕹️ Controls

- **Steer Left / Right**: Press `A` / `D` or `Left` / `Right` arrow keys.
- **Mouse / Touch steering**: Drag the cursor/screen left and right to steer.
- **Shoot Lasers**: Press `Spacebar` or tap the screen.
- **Pause / Resume**: Press `P` or `Escape` keys.

---

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite 6 (utilizing JS-only bundlers to avoid macOS binary code-signing constraints).
- **Language**: TypeScript.
- **Rendering**: Raw Three.js WebGL Renderer.
- **Sound**: HTML5 Web Audio API Synth.
- **Styling**: Modern CSS with backdrop filters (glassmorphism), flex layouts, and custom viewport units.

---

## 🚀 Running Locally

Follow these commands to install and start the game locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 3. Build Production Bundle
```bash
npm run build
```
This generates a zero-config static bundle in the `dist/` directory ready for hosting on Vercel, Netlify, or Firebase.

---

*Powered by [hadinata.dev](https://hadinata.dev)*
