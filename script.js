/**
 * DRIVER FATIGUE DETECTION SYSTEM
 * Real-Time Eye-Closure Monitoring & OpenCV/Keras Integration Architecture
 * Client-Side JavaScript Implementation
 */

(function () {
  'use strict';

  // ========================================================
  // STATE MANAGEMENT
  // ========================================================
  const state = {
    // Mode
    isDemoMode: true,
    isCameraRunning: false,
    currentFacingMode: 'user',

    // Driver Telemetry
    driverStatus: 'ALERT', // 'ALERT' | 'DROWSY' | 'UNAVAILABLE'
    eyeStatus: 'OPEN',     // 'OPEN' | 'CLOSED' | 'UNKNOWN'
    faceDetected: true,
    earValue: 0.31,        // Eye Aspect Ratio (simulated/computed)
    confidence: 96.8,      // %
    consecutiveClosedSeconds: 0.0,
    closureThresholdSeconds: 2.0,
    earThreshold: 0.22,
    blinkCount: 0,
    blinksLastMinute: 14,
    fatigueRiskScore: 8,   // 0 - 100

    // Timing & Loop
    monitoringStartTime: null,
    sessionTimerInterval: null,
    animationFrameId: null,
    lastFrameTime: performance.now(),
    fps: 30.0,

    // Audio & Alerts
    isMuted: false,
    isAlarmActive: false,
    audioContext: null,
    alarmOscillator: null,
    alarmGainNode: null,
    alarmIntervalId: null,

    // Stream & Camera Tracks
    mediaStream: null,

    // Incident Log
    alertHistory: []
  };

  // ========================================================
  // DOM ELEMENT REFERENCES
  // ========================================================
  const elements = {
    // Nav & Controls
    demoModeToggle: document.getElementById('demoModeToggle'),
    muteToggleBtn: document.getElementById('muteToggleBtn'),
    soundOnIcon: document.getElementById('soundOnIcon'),
    soundOffIcon: document.getElementById('soundOffIcon'),
    soundStatusText: document.getElementById('soundStatusText'),
    testAlarmBtn: document.getElementById('testAlarmBtn'),
    pipelineModalBtn: document.getElementById('pipelineModalBtn'),

    // Alert Banner
    drowsinessAlertBanner: document.getElementById('drowsinessAlertBanner'),
    dismissAlertBtn: document.getElementById('dismissAlertBtn'),

    // Viewport & Overlays
    webcam: document.getElementById('webcam'),
    hudCanvas: document.getElementById('hudCanvas'),
    cameraStandbyOverlay: document.getElementById('cameraStandbyOverlay'),
    cameraErrorBox: document.getElementById('cameraErrorBox'),
    cameraErrorMessage: document.getElementById('cameraErrorMessage'),
    overlayStartBtn: document.getElementById('overlayStartBtn'),
    retryCameraBtn: document.getElementById('retryCameraBtn'),
    continueDemoBtn: document.getElementById('continueDemoBtn'),

    // Badges & HUD Telemetry
    cameraStatusBadge: document.getElementById('cameraStatusBadge'),
    modelTag: document.getElementById('modelTag'),
    hudFpsVal: document.getElementById('hudFpsVal'),
    hudEarVal: document.getElementById('hudEarVal'),
    hudEyeStateVal: document.getElementById('hudEyeStateVal'),
    hudFaceStatusVal: document.getElementById('hudFaceStatusVal'),

    // Video Toolbar
    startCameraBtn: document.getElementById('startCameraBtn'),
    stopCameraBtn: document.getElementById('stopCameraBtn'),
    switchCameraBtn: document.getElementById('switchCameraBtn'),
    thresholdSlider: document.getElementById('thresholdSlider'),
    thresholdValDisplay: document.getElementById('thresholdValDisplay'),

    // Eye ROI
    leftEyeCanvas: document.getElementById('leftEyeCanvas'),
    rightEyeCanvas: document.getElementById('rightEyeCanvas'),
    leftEyeBadge: document.getElementById('leftEyeBadge'),
    rightEyeBadge: document.getElementById('rightEyeBadge'),
    closureDurationText: document.getElementById('closureDurationText'),
    closureProgressBar: document.getElementById('closureProgressBar'),
    closureStatusSubtext: document.getElementById('closureStatusSubtext'),

    // Driver Status Card
    driverStatusCard: document.getElementById('driverStatusCard'),
    stateIconCircle: document.getElementById('stateIconCircle'),
    statusIconAlert: document.getElementById('statusIconAlert'),
    statusIconDrowsy: document.getElementById('statusIconDrowsy'),
    statusIconUnavailable: document.getElementById('statusIconUnavailable'),
    driverStatusText: document.getElementById('driverStatusText'),
    driverStatusDesc: document.getElementById('driverStatusDesc'),

    // Metrics
    confidenceVal: document.getElementById('confidenceVal'),
    confidenceBar: document.getElementById('confidenceBar'),
    sessionTimerVal: document.getElementById('sessionTimerVal'),
    blinkCountVal: document.getElementById('blinkCountVal'),
    blinkRateVal: document.getElementById('blinkRateVal'),
    fatigueRiskVal: document.getElementById('fatigueRiskVal'),
    riskMeterFill: document.getElementById('riskMeterFill'),
    riskMeterLabel: document.getElementById('riskMeterLabel'),

    // Simulation Buttons
    simAlertBtn: document.getElementById('simAlertBtn'),
    simBlinkBtn: document.getElementById('simBlinkBtn'),
    simDrowsyBtn: document.getElementById('simDrowsyBtn'),
    simFaceLostBtn: document.getElementById('simFaceLostBtn'),

    // History Table
    alertCountBadge: document.getElementById('alertCountBadge'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    exportLogBtn: document.getElementById('exportLogBtn'),
    alertTableBody: document.getElementById('alertTableBody'),

    // Modal
    pipelineModal: document.getElementById('pipelineModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalUnderstoodBtn: document.getElementById('modalUnderstoodBtn')
  };

  // Canvas 2D Contexts
  const hudCtx = elements.hudCanvas.getContext('2d');
  const leftEyeCtx = elements.leftEyeCanvas.getContext('2d');
  const rightEyeCtx = elements.rightEyeCanvas.getContext('2d');

  // ========================================================
  // INITIALIZATION
  // ========================================================
  function init() {
    setupEventListeners();
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // Initial default state
    updateModeDisplay();
    startSessionTimer();
    renderStaticHUD();

    // Start requestAnimationFrame loop
    requestAnimationFrame(renderLoop);
  }

  function resizeCanvases() {
    const rect = elements.hudCanvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.hudCanvas.width = rect.width;
      elements.hudCanvas.height = rect.height;
    }
  }

  // ========================================================
  // WEBCAM & MEDIA DEVICES API
  // ========================================================
  async function startCamera() {
    hideCameraError();
    elements.cameraStatusBadge.className = 'status-tag status-demo';
    elements.cameraStatusBadge.textContent = 'CAMERA: CONNECTING...';

    const constraints = {
      audio: false,
      video: {
        facingMode: state.currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser context (HTTPS or localhost is required).');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.mediaStream = stream;
      elements.webcam.srcObject = stream;

      await new Promise((resolve) => {
        elements.webcam.onloadedmetadata = () => {
          elements.webcam.play().then(resolve).catch(resolve);
        };
      });

      state.isCameraRunning = true;
      elements.cameraStandbyOverlay.classList.add('hidden');
      elements.startCameraBtn.disabled = true;
      elements.stopCameraBtn.disabled = false;
      elements.cameraStatusBadge.className = 'status-tag status-active';
      elements.cameraStatusBadge.textContent = 'CAMERA: ACTIVE (30 FPS)';

      // Auto update demo mode indicator if camera is active
      if (state.isDemoMode) {
        elements.modelTag.className = 'status-tag status-demo';
        elements.modelTag.textContent = 'ENGINE: LIVE CAM + DEMO INFERENCE';
      }

      logEvent('SYSTEM', 'Camera feed started successfully', 'CAMERA ACTIVE', 'INFO');
    } catch (err) {
      console.warn('Camera Access Error:', err);
      handleCameraError(err);
    }
  }

  function stopCamera() {
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }

    elements.webcam.srcObject = null;
    state.isCameraRunning = false;
    elements.cameraStandbyOverlay.classList.remove('hidden');
    elements.startCameraBtn.disabled = false;
    elements.stopCameraBtn.disabled = true;

    elements.cameraStatusBadge.className = 'status-tag status-idle';
    elements.cameraStatusBadge.textContent = 'CAMERA: STANDBY';

    // Reset simulated closure state to prevent stuck alarm
    resetToAlertState();
    logEvent('SYSTEM', 'Camera feed stopped by user', 'CAMERA OFFLINE', 'INFO');
  }

  function toggleCameraDirection() {
    state.currentFacingMode = state.currentFacingMode === 'user' ? 'environment' : 'user';
    if (state.isCameraRunning) {
      stopCamera();
      setTimeout(startCamera, 300);
    }
  }

  function handleCameraError(error) {
    state.isCameraRunning = false;
    elements.cameraStatusBadge.className = 'status-tag status-alert';
    elements.cameraStatusBadge.textContent = 'CAMERA: ERROR';
    elements.cameraStandbyOverlay.classList.add('hidden');
    elements.cameraErrorBox.classList.remove('hidden');

    let msg = 'Unable to access camera. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      msg += 'Permission was denied by the browser. Please allow camera access in the URL bar settings.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      msg += 'No camera device found on this system.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      msg += 'Camera is currently locked by another application.';
    } else {
      msg += error.message || 'Check browser security settings and ensure page is served via HTTPS or localhost.';
    }

    elements.cameraErrorMessage.textContent = msg;
    logEvent('WARNING', 'Camera access failed', 'PERMISSION DENIED', 'WARNING');
  }

  function hideCameraError() {
    elements.cameraErrorBox.classList.add('hidden');
  }

  // ========================================================
  // DEMO MODE & INTERACTIVE SIMULATION
  // ========================================================
  function toggleDemoMode() {
    state.isDemoMode = !state.isDemoMode;
    updateModeDisplay();
  }

  function updateModeDisplay() {
    if (state.isDemoMode) {
      elements.demoModeToggle.classList.add('active');
      elements.demoModeToggle.classList.remove('live-mode');
      elements.demoModeToggle.setAttribute('aria-pressed', 'true');
      elements.demoModeToggle.querySelector('.toggle-label').innerHTML = 'DEMO MODE: <strong>ACTIVE</strong>';
      elements.modelTag.className = 'status-tag status-demo';
      elements.modelTag.textContent = state.isCameraRunning ? 'ENGINE: LIVE CAM + DEMO' : 'ENGINE: DEMO SIMULATION';
    } else {
      elements.demoModeToggle.classList.remove('active');
      elements.demoModeToggle.classList.add('live-mode');
      elements.demoModeToggle.setAttribute('aria-pressed', 'false');
      elements.demoModeToggle.querySelector('.toggle-label').innerHTML = 'PRODUCTION ARCH: <strong>READY</strong>';
      elements.modelTag.className = 'status-tag status-active';
      elements.modelTag.textContent = 'ENGINE: KERAS PIPELINE HOOK';
    }
  }

  // Simulation Triggers
  let simTimeoutId = null;

  function resetToAlertState() {
    clearTimeout(simTimeoutId);
    state.driverStatus = 'ALERT';
    state.eyeStatus = 'OPEN';
    state.faceDetected = true;
    state.earValue = 0.32;
    state.consecutiveClosedSeconds = 0.0;
    state.fatigueRiskScore = 12;
    stopAlarmSound();
    elements.drowsinessAlertBanner.classList.add('hidden');
    updateStatusCard();
  }

  function simulateSingleBlink() {
    clearTimeout(simTimeoutId);
    state.eyeStatus = 'CLOSED';
    state.earValue = 0.12;
    state.consecutiveClosedSeconds = 0.18;
    state.blinkCount += 1;
    elements.blinkCountVal.textContent = state.blinkCount;

    // Reset back to open after 200ms
    simTimeoutId = setTimeout(() => {
      resetToAlertState();
    }, 220);
  }

  function simulateProlongedClosure() {
    clearTimeout(simTimeoutId);
    state.eyeStatus = 'CLOSED';
    state.earValue = 0.09;
    state.consecutiveClosedSeconds = state.closureThresholdSeconds + 0.5;
    state.fatigueRiskScore = 95;
    state.driverStatus = 'DROWSY';

    triggerDrowsyAlert('Prolonged eye closure simulated (&gt; ' + state.closureThresholdSeconds.toFixed(1) + 's)');
  }

  function simulateFaceLost() {
    clearTimeout(simTimeoutId);
    state.faceDetected = false;
    state.eyeStatus = 'UNKNOWN';
    state.earValue = 0.0;
    state.driverStatus = 'UNAVAILABLE';
    state.consecutiveClosedSeconds = 0.0;
    stopAlarmSound();
    elements.drowsinessAlertBanner.classList.add('hidden');
    updateStatusCard();
  }

  // ========================================================
  // FATIGUE DETECTION DECISION ENGINE & STATE MACHINE
  // ========================================================
  function evaluateFatigueState(deltaSeconds) {
    if (!state.faceDetected) {
      state.driverStatus = 'UNAVAILABLE';
      state.consecutiveClosedSeconds = 0;
      updateStatusCard();
      return;
    }

    if (state.eyeStatus === 'CLOSED') {
      state.consecutiveClosedSeconds += deltaSeconds;

      // Risk score scales with closure duration
      const ratio = Math.min(1.0, state.consecutiveClosedSeconds / state.closureThresholdSeconds);
      state.fatigueRiskScore = Math.round(15 + ratio * 85);

      if (state.consecutiveClosedSeconds >= state.closureThresholdSeconds) {
        if (state.driverStatus !== 'DROWSY') {
          state.driverStatus = 'DROWSY';
          triggerDrowsyAlert(`Eye closure exceeded safety threshold (${state.closureThresholdSeconds.toFixed(1)}s)`);
        }
      }
    } else if (state.eyeStatus === 'OPEN') {
      // Eyes are open, gradually reduce closure timer
      state.consecutiveClosedSeconds = Math.max(0, state.consecutiveClosedSeconds - deltaSeconds * 2.5);
      if (state.consecutiveClosedSeconds === 0 && state.driverStatus === 'DROWSY') {
        state.driverStatus = 'ALERT';
        stopAlarmSound();
        elements.drowsinessAlertBanner.classList.add('hidden');
      }
      state.fatigueRiskScore = Math.max(8, Math.round(state.fatigueRiskScore - deltaSeconds * 10));
    }

    updateStatusCard();
  }

  function triggerDrowsyAlert(reason) {
    elements.drowsinessAlertBanner.classList.remove('hidden');
    playAlarmSound();

    logEvent('DROWSINESS ALERT', reason, 'CLOSED', 'CRITICAL');
  }

  function updateStatusCard() {
    // Progress bar for closure duration
    const progressPct = Math.min(100, (state.consecutiveClosedSeconds / state.closureThresholdSeconds) * 100);
    elements.closureProgressBar.style.width = progressPct + '%';
    elements.closureDurationText.textContent = `${state.consecutiveClosedSeconds.toFixed(1)}s / ${state.closureThresholdSeconds.toFixed(1)}s`;

    if (state.driverStatus === 'DROWSY') {
      elements.closureStatusSubtext.textContent = 'DANGER: DROWSY';
      elements.closureStatusSubtext.style.color = '#ef4444';
      elements.driverStatusCard.className = 'telemetry-card driver-status-card state-drowsy';
      elements.statusIconAlert.classList.add('hidden');
      elements.statusIconUnavailable.classList.add('hidden');
      elements.statusIconDrowsy.classList.remove('hidden');
      elements.driverStatusText.className = 'state-headline status-text-red';
      elements.driverStatusText.textContent = 'DROWSY';
      elements.driverStatusDesc.textContent = 'Driver fatigue detected! Immediate rest recommended';
    } else if (state.driverStatus === 'ALERT') {
      elements.closureStatusSubtext.textContent = progressPct > 50 ? 'WARNING' : 'NORMAL';
      elements.closureStatusSubtext.style.color = progressPct > 50 ? '#f59e0b' : '#10b981';
      elements.driverStatusCard.className = 'telemetry-card driver-status-card';
      elements.statusIconAlert.classList.remove('hidden');
      elements.statusIconUnavailable.classList.add('hidden');
      elements.statusIconDrowsy.classList.add('hidden');
      elements.driverStatusText.className = 'state-headline status-text-green';
      elements.driverStatusText.textContent = 'ALERT';
      elements.driverStatusDesc.textContent = 'Driver is responsive with normal eye activity';
    } else {
      elements.closureStatusSubtext.textContent = 'CALIBRATING';
      elements.closureStatusSubtext.style.color = '#94a3b8';
      elements.driverStatusCard.className = 'telemetry-card driver-status-card state-unavailable';
      elements.statusIconAlert.classList.add('hidden');
      elements.statusIconUnavailable.classList.remove('hidden');
      elements.statusIconDrowsy.classList.add('hidden');
      elements.driverStatusText.className = 'state-headline status-text-slate';
      elements.driverStatusText.textContent = 'DETECTION UNAVAILABLE';
      elements.driverStatusDesc.textContent = 'No face detected in video frame';
    }

    // Risk Meter & numbers
    elements.fatigueRiskVal.textContent = state.fatigueRiskScore;
    elements.riskMeterFill.style.width = state.fatigueRiskScore + '%';
    if (state.fatigueRiskScore > 75) {
      elements.riskMeterFill.className = 'risk-meter-fill fill-red';
      elements.riskMeterLabel.textContent = 'High Risk: Critical Fatigue Level';
      elements.fatigueRiskVal.className = 'metric-number status-text-red';
    } else if (state.fatigueRiskScore > 40) {
      elements.riskMeterFill.className = 'risk-meter-fill fill-yellow';
      elements.riskMeterLabel.textContent = 'Moderate Risk: Eye Weariness';
      elements.fatigueRiskVal.className = 'metric-number status-text-yellow';
    } else {
      elements.riskMeterFill.className = 'risk-meter-fill fill-green';
      elements.riskMeterLabel.textContent = 'Low Risk: Normal Attentiveness';
      elements.fatigueRiskVal.className = 'metric-number status-text-green';
    }

    // Update HUD text values
    elements.hudEarVal.textContent = state.earValue.toFixed(2);
    elements.hudEyeStateVal.textContent = state.eyeStatus;
    if (state.eyeStatus === 'CLOSED') {
      elements.hudEyeStateVal.className = 'hud-value status-text-red';
      elements.leftEyeBadge.className = 'badge-mini badge-red';
      elements.leftEyeBadge.textContent = `CLOSED (${state.earValue.toFixed(2)})`;
      elements.rightEyeBadge.className = 'badge-mini badge-red';
      elements.rightEyeBadge.textContent = `CLOSED (${state.earValue.toFixed(2)})`;
    } else if (state.eyeStatus === 'OPEN') {
      elements.hudEyeStateVal.className = 'hud-value status-text-green';
      elements.leftEyeBadge.className = 'badge-mini badge-green';
      elements.leftEyeBadge.textContent = `OPEN (${state.earValue.toFixed(2)})`;
      elements.rightEyeBadge.className = 'badge-mini badge-green';
      elements.rightEyeBadge.textContent = `OPEN (${state.earValue.toFixed(2)})`;
    } else {
      elements.hudEyeStateVal.className = 'hud-value status-text-slate';
      elements.leftEyeBadge.className = 'badge-mini badge-neutral';
      elements.leftEyeBadge.textContent = 'UNKNOWN';
      elements.rightEyeBadge.className = 'badge-mini badge-neutral';
      elements.rightEyeBadge.textContent = 'UNKNOWN';
    }

    elements.hudFaceStatusVal.textContent = state.faceDetected ? 'TRACKED' : 'LOST';
    elements.hudFaceStatusVal.className = state.faceDetected ? 'hud-value status-text-green' : 'hud-value status-text-red';
  }

  // ========================================================
  // AUDIO ALERT SYSTEM (WEB AUDIO API SYNTHESIZER)
  // ========================================================
  function initAudioContext() {
    if (!state.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        state.audioContext = new AudioCtx();
      }
    }
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
  }

  function playAlarmSound() {
    if (state.isMuted || state.isAlarmActive) return;

    try {
      initAudioContext();
      if (!state.audioContext) return;

      state.isAlarmActive = true;
      let toggleTone = true;

      // Pulse a dual-tone automotive alarm buzzer: 880Hz alternating with 659Hz
      state.alarmIntervalId = setInterval(() => {
        if (!state.isAlarmActive || state.isMuted) return;

        const osc = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(toggleTone ? 880 : 660, state.audioContext.currentTime);
        toggleTone = !toggleTone;

        gain.gain.setValueAtTime(0.18, state.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.16);

        osc.connect(gain);
        gain.connect(state.audioContext.destination);

        osc.start();
        osc.stop(state.audioContext.currentTime + 0.18);
      }, 220);
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  }

  function stopAlarmSound() {
    if (state.alarmIntervalId) {
      clearInterval(state.alarmIntervalId);
      state.alarmIntervalId = null;
    }
    state.isAlarmActive = false;
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
      stopAlarmSound();
      elements.soundOnIcon.classList.add('hidden');
      elements.soundOffIcon.classList.remove('hidden');
      elements.soundStatusText.textContent = 'MUTED';
      elements.muteToggleBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      elements.soundOnIcon.classList.remove('hidden');
      elements.soundOffIcon.classList.add('hidden');
      elements.soundStatusText.textContent = 'AUDIO ON';
      elements.muteToggleBtn.style.borderColor = '';
    }
  }

  function triggerAlarmTest() {
    initAudioContext();
    const wasMuted = state.isMuted;
    state.isMuted = false;
    playAlarmSound();

    setTimeout(() => {
      stopAlarmSound();
      state.isMuted = wasMuted;
    }, 1200);
  }

  // ========================================================
  // RENDER LOOP & HUD GRAPHICS
  // ========================================================
  function renderLoop(timestamp) {
    const deltaSeconds = (timestamp - state.lastFrameTime) / 1000;
    state.lastFrameTime = timestamp;

    // Approximate FPS calculation
    if (deltaSeconds > 0) {
      const currentFps = 1 / deltaSeconds;
      state.fps = state.fps * 0.9 + currentFps * 0.1;
      elements.hudFpsVal.textContent = state.fps.toFixed(1);
    }

    // Evaluate state machine
    evaluateFatigueState(deltaSeconds);

    // Draw HUD overlays
    drawHUDGraphics();

    // Render micro eye ROI canvases
    renderEyeROIs();

    state.animationFrameId = requestAnimationFrame(renderLoop);
  }

  function drawHUDGraphics() {
    const w = elements.hudCanvas.width;
    const h = elements.hudCanvas.height;
    hudCtx.clearRect(0, 0, w, h);

    if (!state.faceDetected) {
      // Draw lost target indicator
      hudCtx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      hudCtx.lineWidth = 2;
      hudCtx.setLineDash([8, 6]);
      hudCtx.strokeRect(w * 0.25, h * 0.2, w * 0.5, h * 0.6);
      hudCtx.setLineDash([]);
      hudCtx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      hudCtx.font = '12px "Chakra Petch", sans-serif';
      hudCtx.fillText('TARGET LOST / OCCLUDED', w * 0.25 + 10, h * 0.2 + 20);
      return;
    }

    // Center coordinates for face box (simulated or tracking)
    const boxW = Math.min(w * 0.45, 260);
    const boxH = boxW * 1.25;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    const isDrowsy = state.driverStatus === 'DROWSY';
    const mainColor = isDrowsy ? '#ef4444' : (state.isDemoMode ? '#00f0ff' : '#10b981');
    const cornerLen = 20;

    // 1. Draw Corner Reticles for Face Bounding Box
    hudCtx.strokeStyle = mainColor;
    hudCtx.lineWidth = 2.5;

    // Top-Left
    hudCtx.beginPath();
    hudCtx.moveTo(boxX, boxY + cornerLen);
    hudCtx.lineTo(boxX, boxY);
    hudCtx.lineTo(boxX + cornerLen, boxY);
    hudCtx.stroke();

    // Top-Right
    hudCtx.beginPath();
    hudCtx.moveTo(boxX + boxW - cornerLen, boxY);
    hudCtx.lineTo(boxX + boxW, boxY);
    hudCtx.lineTo(boxX + boxW, boxY + cornerLen);
    hudCtx.stroke();

    // Bottom-Left
    hudCtx.beginPath();
    hudCtx.moveTo(boxX, boxY + boxH - cornerLen);
    hudCtx.lineTo(boxX, boxY + boxH);
    hudCtx.lineTo(boxX + cornerLen, boxY + boxH);
    hudCtx.stroke();

    // Bottom-Right
    hudCtx.beginPath();
    hudCtx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
    hudCtx.lineTo(boxX + boxW, boxY + boxH);
    hudCtx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
    hudCtx.stroke();

    // Face tag label
    hudCtx.fillStyle = mainColor;
    hudCtx.font = '600 11px "Chakra Petch", sans-serif';
    hudCtx.fillText(`FACE ROI: CONF ${(state.confidence).toFixed(1)}%`, boxX + 4, boxY - 8);

    // 2. Eye ROIs on face
    const eyeBoxW = boxW * 0.25;
    const eyeBoxH = eyeBoxW * 0.65;
    const leftEyeX = boxX + boxW * 0.2;
    const rightEyeX = boxX + boxW * 0.55;
    const eyesY = boxY + boxH * 0.35;

    const eyeColor = state.eyeStatus === 'CLOSED' ? '#ef4444' : '#00f0ff';
    hudCtx.strokeStyle = eyeColor;
    hudCtx.lineWidth = 1.5;

    // Left Eye Box
    hudCtx.strokeRect(leftEyeX, eyesY, eyeBoxW, eyeBoxH);
    // Right Eye Box
    hudCtx.strokeRect(rightEyeX, eyesY, eyeBoxW, eyeBoxH);

    // Eye Aspect Ratio Text
    hudCtx.fillStyle = eyeColor;
    hudCtx.font = '10px "JetBrains Mono", monospace';
    hudCtx.fillText(`L: ${state.earValue.toFixed(2)}`, leftEyeX, eyesY - 4);
    hudCtx.fillText(`R: ${state.earValue.toFixed(2)}`, rightEyeX, eyesY - 4);

    // Dynamic HUD Crosshair center
    hudCtx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    hudCtx.lineWidth = 1;
    hudCtx.beginPath();
    hudCtx.moveTo(w / 2 - 15, h / 2);
    hudCtx.lineTo(w / 2 + 15, h / 2);
    hudCtx.moveTo(w / 2, h / 2 - 15);
    hudCtx.lineTo(w / 2, h / 2 + 15);
    hudCtx.stroke();
  }

  function renderEyeROIs() {
    drawEyeCrop(leftEyeCtx, elements.leftEyeCanvas.width, elements.leftEyeCanvas.height, 'LEFT');
    drawEyeCrop(rightEyeCtx, elements.rightEyeCanvas.width, elements.rightEyeCanvas.height, 'RIGHT');
  }

  function drawEyeCrop(ctx, w, h, eyeSide) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    const isClosed = state.eyeStatus === 'CLOSED';
    const isUnknown = state.eyeStatus === 'UNKNOWN';

    // Grid background
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (isUnknown) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "Chakra Petch"';
      ctx.fillText('NO SIGNAL', w / 2 - 24, h / 2 + 4);
      return;
    }

    // Schematic Eye Contour
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.38;
    const ry = isClosed ? 2 : h * 0.28;

    ctx.strokeStyle = isClosed ? '#ef4444' : '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (!isClosed) {
      // Iris & pupil
      ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed eyelid horizontal slit
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.lineTo(cx + rx, cy);
      ctx.stroke();
    }
  }

  function renderStaticHUD() {
    renderEyeROIs();
  }

  // ========================================================
  // SESSION TIMER & INCIDENT LOGGING
  // ========================================================
  function startSessionTimer() {
    state.monitoringStartTime = Date.now();
    state.sessionTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.monitoringStartTime) / 1000);
      const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      elements.sessionTimerVal.textContent = `${hours}:${mins}:${secs}`;
    }, 1000);
  }

  function logEvent(eventType, message, eyeState, severity) {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const item = {
      timestamp,
      eventType,
      message,
      eyeState,
      closureDuration: `${state.consecutiveClosedSeconds.toFixed(1)}s`,
      confidence: `${state.confidence.toFixed(1)}%`,
      severity
    };

    state.alertHistory.unshift(item);
    if (state.alertHistory.length > 50) state.alertHistory.pop();

    renderAlertTable();
  }

  function renderAlertTable() {
    elements.alertCountBadge.textContent = `${state.alertHistory.length} EVENTS`;

    if (state.alertHistory.length === 0) {
      elements.alertTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">No safety incidents recorded. System running normally.</td>
        </tr>
      `;
      return;
    }

    elements.alertTableBody.innerHTML = state.alertHistory.map((item) => {
      let badgeClass = 'table-badge-info';
      if (item.severity === 'CRITICAL') badgeClass = 'table-badge-critical';
      if (item.severity === 'WARNING') badgeClass = 'table-badge-warning';

      return `
        <tr>
          <td>${item.timestamp}</td>
          <td><strong>${item.eventType}</strong></td>
          <td>${item.eyeState}</td>
          <td>${item.closureDuration}</td>
          <td>${item.confidence}</td>
          <td><span class="${badgeClass}">${item.severity}</span></td>
        </tr>
      `;
    }).join('');
  }

  function clearAlertLog() {
    state.alertHistory = [];
    renderAlertTable();
  }

  function exportAlertLog() {
    const jsonStr = JSON.stringify(state.alertHistory, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_fatigue_log_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========================================================
  // EVENT LISTENERS SETUP
  // ========================================================
  function setupEventListeners() {
    // Nav Controls
    elements.demoModeToggle.addEventListener('click', toggleDemoMode);
    elements.muteToggleBtn.addEventListener('click', toggleMute);
    elements.testAlarmBtn.addEventListener('click', triggerAlarmTest);

    // Camera Controls
    elements.startCameraBtn.addEventListener('click', startCamera);
    elements.overlayStartBtn.addEventListener('click', startCamera);
    elements.stopCameraBtn.addEventListener('click', stopCamera);
    elements.switchCameraBtn.addEventListener('click', toggleCameraDirection);
    elements.retryCameraBtn.addEventListener('click', startCamera);
    elements.continueDemoBtn.addEventListener('click', () => {
      hideCameraError();
      elements.cameraStandbyOverlay.classList.remove('hidden');
    });

    // Alert Banner Dismiss
    elements.dismissAlertBtn.addEventListener('click', () => {
      stopAlarmSound();
      elements.drowsinessAlertBanner.classList.add('hidden');
      resetToAlertState();
    });

    // Threshold Slider
    elements.thresholdSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.closureThresholdSeconds = val;
      elements.thresholdValDisplay.textContent = val.toFixed(1) + 's';
    });

    // Interactive Demo Simulation Buttons
    elements.simAlertBtn.addEventListener('click', resetToAlertState);
    elements.simBlinkBtn.addEventListener('click', simulateSingleBlink);
    elements.simDrowsyBtn.addEventListener('click', simulateProlongedClosure);
    elements.simFaceLostBtn.addEventListener('click', simulateFaceLost);

    // Table Actions
    elements.clearLogBtn.addEventListener('click', clearAlertLog);
    elements.exportLogBtn.addEventListener('click', exportAlertLog);

    // Pipeline Modal
    elements.pipelineModalBtn.addEventListener('click', () => {
      elements.pipelineModal.classList.remove('hidden');
    });
    elements.closeModalBtn.addEventListener('click', () => {
      elements.pipelineModal.classList.add('hidden');
    });
    elements.modalUnderstoodBtn.addEventListener('click', () => {
      elements.pipelineModal.classList.add('hidden');
    });
    elements.pipelineModal.addEventListener('click', (e) => {
      if (e.target === elements.pipelineModal) {
        elements.pipelineModal.classList.add('hidden');
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.pipelineModal.classList.contains('hidden')) {
        elements.pipelineModal.classList.add('hidden');
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
      if (e.key === ' ') {
        // Spacebar test blink
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
          e.preventDefault();
          simulateSingleBlink();
        }
      }
    });
  }

  // Self-start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
