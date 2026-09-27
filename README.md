# Detecting Driver Fatigue in Real Time: An OpenCV and Keras Implementation

A modern, responsive, automotive-grade web application for monitoring driver attentiveness, tracking eye closure, and delivering real-time auditory and visual drowsiness warnings.

---

## Features

1. **Dashboard & Optical HUD:**
   - Real-time webcam viewport with target face tracking reticle and eye ROI landmark boxes.
   - Dual micro-crop canvases displaying Left Eye & Right Eye telemetry in real time.
   - Real-time calculated Eye Aspect Ratio (EAR) metric and detection confidence readout.

2. **Camera Management:**
   - Instant permission request via browser `navigator.mediaDevices.getUserMedia()`.
   - Start / Stop camera controls with complete hardware track release.
   - Front/Back camera switcher and permission error handling with helpful diagnostics.

3. **Fatigue Detection Engine:**
   - Configurable eye-closure duration safety limit (1.0s to 4.0s threshold slider).
   - Temporal state machine tracking consecutive closed frames.
   - Driver states: **ALERT** (Green), **DROWSY** (Red), and **DETECTION UNAVAILABLE** (Slate).

4. **Safety Alert System:**
   - High-visibility pulsing warning banner on drowsiness detection.
   - Built-in Web Audio API dual-tone buzzer (880Hz / 660Hz) with zero external audio assets required.
   - Mute/Unmute audio control and single-burst alarm prevention.
   - Interactive safety incident table with timestamped logging and JSON export.

5. **Demo & Simulation Suite:**
   - Dedicated Demo Mode with interactive trigger buttons:
     - *Eyes Open (Alert)*
     - *Normal Blink (0.2s)*
     - *Prolonged Closure (Triggers Drowsiness Alert)*
     - *Face Lost / Obscured*
   - Clear "DEMO DATA" labeling to prevent misleading diagnostic claims.

6. **OpenCV & Keras Integration Architecture:**
   - Ready-to-hook pipeline modal showcasing the Haar Cascade / Dlib 68-landmark preprocessor and CNN binary classification model code (`build_fatigue_model`).

---

## File Structure

```text
├── index.html       # Semantic HTML5 dashboard layout and HUD elements
├── style.css        # Responsive dark automotive HUD design system
├── script.js        # State machine, audio synthesizer, camera & simulation logic
├── vercel.json      # Static hosting configuration for Vercel
└── README.md        # Documentation and deployment instructions
```

---

## How to Run Locally

### Option 1: Direct File
Double-click `index.html` or open it directly in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari.

### Option 2: Local HTTP Server (Recommended for Camera Access)
Webcam permissions in modern browsers require a secure origin (`http://localhost` or `https://`):

```bash
# Using Python 3:
python3 -m http.server 8000

# Or using Node.js:
npx serve .
```

Open `http://localhost:8000` in your browser.

---

## Deploy to Vercel

### Method 1: Using the Vercel CLI
```bash
npm i -g vercel
vercel
```

### Method 2: Deploy via GitHub
1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your repository.
4. Leave Build Settings empty (Framework Preset: "Other").
5. Click **Deploy**. Vercel will automatically serve `index.html`, `style.css`, and `script.js` with HTTPS enabled!
