const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const createButton = document.querySelector("[data-create-tournament]");
const statusMessage = document.querySelector("[data-status-message]");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

if (createButton && statusMessage) {
  createButton.addEventListener("click", () => {
    statusMessage.textContent = "Tournament creation is coming next. The arena is ready for the bracket engine.";
    createButton.classList.add("is-pulsing");

    window.setTimeout(() => {
      createButton.classList.remove("is-pulsing");
    }, 700);
  });
}

/* =========================================================
   Sound Effects System
   Self-contained. All sounds are synthesized with the Web Audio
   API (no external audio files), so there's nothing that can 404
   or crash the game if unsupported — every entry point below is
   guarded and simply does nothing if audio isn't available.
   ========================================================= */
const SFX = (function () {
  const STORAGE_KEY = "pongArena.soundEnabled";
  // Default ON: anything other than the literal string "false" counts as on,
  // so a first-ever visit (no stored value) defaults to enabled.
  let enabled = window.localStorage.getItem(STORAGE_KEY) !== "false";
  let audioCtx = null;
  let masterGain = null;

  function ensureContext() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.6;
      // A shared compressor keeps overlapping sounds from clipping/distorting.
      const compressor = audioCtx.createDynamicsCompressor();
      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
    } catch (err) {
      audioCtx = null;
      masterGain = null;
    }
    return audioCtx;
  }

  function tone({ freq, duration = 0.08, type = "sine", gain = 0.15, glideTo = null }) {
    const ctx = ensureContext();
    if (!ctx || !masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (glideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), ctx.currentTime + duration);
      }
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(env);
      env.connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch (err) {
      // Never let a synthesis failure affect gameplay.
    }
  }

  function sequence(notes) {
    if (!ensureContext()) return;
    let delay = 0;
    notes.forEach((note) => {
      window.setTimeout(() => tone(note), delay * 1000);
      delay += note.gap != null ? note.gap : note.duration || 0.08;
    });
  }

  const SOUNDS = {
    playerHit: () => tone({ freq: 620, duration: 0.06, type: "sine", gain: 0.12 }),
    aiHit: () => tone({ freq: 420, duration: 0.06, type: "triangle", gain: 0.12 }),
    wallBounce: () => tone({ freq: 260, duration: 0.05, type: "square", gain: 0.1, glideTo: 200 }),
    bonusScore: () =>
      sequence([
        { freq: 523.25, duration: 0.09, type: "square", gain: 0.18 },
        { freq: 659.25, duration: 0.09, type: "square", gain: 0.18 },
        { freq: 783.99, duration: 0.14, type: "square", gain: 0.2 },
      ]),
    powerCharge: () => tone({ freq: 900, duration: 0.04, type: "sine", gain: 0.06 }),
    powerReady: () =>
      sequence([
        { freq: 880, duration: 0.09, type: "triangle", gain: 0.18 },
        { freq: 1174.66, duration: 0.16, type: "triangle", gain: 0.2 },
      ]),
    powerActivate: () => tone({ freq: 320, duration: 0.12, type: "sawtooth", gain: 0.18, glideTo: 920 }),
    gameOver: () => tone({ freq: 400, duration: 0.35, type: "square", gain: 0.16, glideTo: 130 }),
    newHighScore: () =>
      sequence([
        { freq: 523.25, duration: 0.1, type: "triangle", gain: 0.2 },
        { freq: 659.25, duration: 0.1, type: "triangle", gain: 0.2 },
        { freq: 783.99, duration: 0.1, type: "triangle", gain: 0.2 },
        { freq: 1046.5, duration: 0.22, type: "triangle", gain: 0.22 },
      ]),
    uiClick: () => tone({ freq: 1000, duration: 0.02, type: "sine", gain: 0.05 }),
  };

  function play(name) {
    if (!enabled) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      fn();
    } catch (err) {
      // Swallow any audio error so it can never affect gameplay.
    }
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value) {
    enabled = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch (err) {
      // Ignore storage failures (e.g. private browsing) — in-memory state still works.
    }
    if (enabled) ensureContext();
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  return { play, isEnabled, setEnabled, toggle };
})();

const soundToggleButton = document.querySelector("[data-sound-toggle]");

function updateSoundToggleLabel() {
  if (!soundToggleButton) return;
  const on = SFX.isEnabled();
  soundToggleButton.textContent = `Sound: ${on ? "On" : "Off"}`;
  soundToggleButton.setAttribute("aria-pressed", String(on));
}

if (soundToggleButton) {
  updateSoundToggleLabel();
  soundToggleButton.addEventListener("click", () => {
    const nowOn = SFX.toggle();
    updateSoundToggleLabel();
    if (nowOn) SFX.play("uiClick");
  });
}

// Shared AI difficulty settings (Easy/Medium/Hard), reused by both Endless
// Mode and Classic Mode so the two modes never drift out of sync.
// maxBallSpeed/speedIncrement are Endless-specific (its rally speed ramp);
// Classic Mode only reads ballSpeed/aiSpeed/aiError/pace from this object.
const DIFFICULTY_PRESETS = {
  easy: { ballSpeed: 260, maxBallSpeed: 260, speedIncrement: 0, aiSpeed: 170, aiError: 60, pace: 1 },
  medium: { ballSpeed: 320, maxBallSpeed: 560, speedIncrement: 12, aiSpeed: 230, aiError: 46, pace: 2 },
  hard: { ballSpeed: 400, maxBallSpeed: 760, speedIncrement: 16, aiSpeed: 300, aiError: 28, pace: 3 },
};

/* =========================================================
   Endless Mode — Pong Engine
   Self-contained. Does not touch nav-toggle or Tournament code above.
   Reuses existing DOM hooks/CSS classes already defined in the markup:
   [data-game-screen], [data-pong-canvas], [data-score], [data-high-score],
   [data-difficulty], [data-power], [data-game-over], [data-record-label],
   [data-final-score], [data-final-best], [data-play-again],
   [data-main-menu] (x2), [data-start-endless] (x2), body.game-active
   ========================================================= */
(function () {
  const gameScreen = document.querySelector("[data-game-screen]");
  const canvas = document.querySelector("[data-pong-canvas]");

  if (!gameScreen || !canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.querySelector("[data-score]");
  const highScoreEl = document.querySelector("[data-high-score]");
  const difficultyEl = document.querySelector("[data-difficulty]");
  const powerMeterEl = document.querySelector("[data-power]");
  const powerFillEl = document.querySelector("[data-power-fill]");
  const powerPercentEl = document.querySelector("[data-power-percent]");
  const gameOverEl = document.querySelector("[data-game-over]");
  const recordLabelEl = document.querySelector("[data-record-label]");
  const finalScoreEl = document.querySelector("[data-final-score]");
  const finalBestEl = document.querySelector("[data-final-best]");
  const playAgainButton = document.querySelector("[data-play-again]");

  // Two of each of these exist (nav + hero, topbar + game-over card).
  const startButtons = document.querySelectorAll("[data-start-endless]");
  const mainMenuButtons = document.querySelectorAll("[data-main-menu]");

  const difficultyScreen = document.querySelector("[data-difficulty-screen]");
  const difficultyButtons = document.querySelectorAll("[data-difficulty-select]");
  const difficultyBackButton = document.querySelector("[data-difficulty-back]");

  const HIGH_SCORE_KEY = "pongArena.endlessBestScore";

  const PLAYER_SPEED = 480;
  const PADDLE_MARGIN = 22;
  const BALL_RADIUS = 9;
  // Must stay smaller than BALL_RADIUS: this is a dead zone the paddle can
  // never enter, so if it were >= the ball's radius, the ball could sit
  // entirely inside it and pass the paddle's x position untouched.
  const PADDLE_EDGE_GAP = BALL_RADIUS - 2;
  const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;

  // Power charge system (Endless Mode only).
  const POWER_MAX = 100;
  const POWER_CHARGE_ON_HIT = 5;
  const POWER_CHARGE_ON_PASS = 20;
  const BLINK_COOLDOWN_SECONDS = 0.5;

  // Floating charge circles (Endless Mode only).
  const CIRCLE_RADIUS = 20;
  const CIRCLE_MAX_ACTIVE = 2;
  const CIRCLE_SPAWN_MIN_SECONDS = 4;
  const CIRCLE_SPAWN_MAX_SECONDS = 8;
  const CIRCLE_DRIFT_SPEED = 26;
  const CIRCLE_SPAWN_CLEARANCE = 34; // keep spawn point away from paddles/ball
  const CIRCLE_CHARGE_MIN = 5;
  const CIRCLE_CHARGE_MAX = 20;
  const CIRCLE_BONUS_CHANCE = 0.12;
  const CIRCLE_BONUS_MIN = 20;
  const CIRCLE_BONUS_MAX = 35;
  const COLLECT_EFFECT_SECONDS = 0.35;

  // Pull theme colors from the existing CSS custom properties so the
  // canvas drawing matches the site's palette without hardcoding it twice.
  const styles = getComputedStyle(document.documentElement);
  const colors = {
    text: styles.getPropertyValue("--text").trim() || "#f6fbf8",
    muted: styles.getPropertyValue("--muted").trim() || "#a9bab4",
    line: styles.getPropertyValue("--line").trim() || "rgba(246,251,248,0.13)",
    green: styles.getPropertyValue("--green").trim() || "#37f29a",
    coral: styles.getPropertyValue("--coral").trim() || "#ff6b4a",
    gold: styles.getPropertyValue("--gold").trim() || "#ffd166",
    blue: styles.getPropertyValue("--blue").trim() || "#7aa7ff",
  };

  const state = {
    active: false,
    width: 0,
    height: 0,
    score: 0,
    difficulty: "medium",
    ballSpeed: 0,
    power: 0,
    blinkCooldown: 0,
    circles: [],
    circleSpawnTimer: 0,
    collectEffects: [],
    best: Number(window.localStorage.getItem(HIGH_SCORE_KEY)) || 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    player: { y: 0, height: 110, width: 14, vy: 0 },
    ai: { y: 0, height: 110, width: 14, tracking: false, errorOffset: 0 },
    keys: { up: false, down: false },
    pointerY: null,
    lastTime: 0,
    rafId: null,
  };

  highScoreEl && (highScoreEl.textContent = String(state.best));

  function currentDifficulty() {
    return DIFFICULTY_PRESETS[state.difficulty] || DIFFICULTY_PRESETS.medium;
  }

  function updatePowerDisplay() {
    if (!powerMeterEl || !powerFillEl || !powerPercentEl) return;
    const ready = state.power >= POWER_MAX;
    powerFillEl.style.width = `${state.power}%`;
    powerPercentEl.textContent = ready ? "READY" : `${state.power}%`;
    powerMeterEl.classList.toggle("is-ready", ready);
  }

  function addPowerCharge(amount) {
    // Charge stops accumulating once at 100% — clamping here also means
    // a hit and a pass in the same frame can't push it past full.
    const previous = state.power;
    state.power = Math.min(POWER_MAX, state.power + amount);
    updatePowerDisplay();

    if (previous < POWER_MAX && state.power >= POWER_MAX) {
      SFX.play("powerReady");
    } else if (state.power > previous) {
      SFX.play("powerCharge");
    }
  }

  function randomCircleCharge() {
    if (Math.random() < CIRCLE_BONUS_CHANCE) {
      return Math.round(CIRCLE_BONUS_MIN + Math.random() * (CIRCLE_BONUS_MAX - CIRCLE_BONUS_MIN));
    }
    return Math.round(CIRCLE_CHARGE_MIN + Math.random() * (CIRCLE_CHARGE_MAX - CIRCLE_CHARGE_MIN));
  }

  function trySpawnCircle() {
    if (state.circles.length >= CIRCLE_MAX_ACTIVE) return;

    const minX = PADDLE_MARGIN + state.player.width + CIRCLE_SPAWN_CLEARANCE;
    const maxX = state.width - PADDLE_MARGIN - state.ai.width - CIRCLE_SPAWN_CLEARANCE;
    const minY = CIRCLE_RADIUS + 6;
    const maxY = state.height - CIRCLE_RADIUS - 6;
    if (maxX <= minX || maxY <= minY) return; // table too small right now, skip this attempt

    let x = 0;
    let y = 0;
    let clearOfBall = false;
    for (let attempt = 0; attempt < 6 && !clearOfBall; attempt++) {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
      clearOfBall = Math.hypot(x - state.ball.x, y - state.ball.y) >= CIRCLE_SPAWN_CLEARANCE * 2;
    }
    if (!clearOfBall) return; // couldn't find a clear spot this cycle; try again next timer

    const angle = Math.random() * Math.PI * 2;
    state.circles.push({
      x,
      y,
      vx: Math.cos(angle) * CIRCLE_DRIFT_SPEED,
      vy: Math.sin(angle) * CIRCLE_DRIFT_SPEED,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  function spawnCollectEffect(x, y) {
    state.collectEffects.push({ x, y, age: 0 });
  }

  function updateCircles(dt) {
    state.circleSpawnTimer -= dt;
    if (state.circleSpawnTimer <= 0) {
      trySpawnCircle();
      state.circleSpawnTimer =
        CIRCLE_SPAWN_MIN_SECONDS + Math.random() * (CIRCLE_SPAWN_MAX_SECONDS - CIRCLE_SPAWN_MIN_SECONDS);
    }

    state.circles.forEach((circle) => {
      circle.x += circle.vx * dt;
      circle.y += circle.vy * dt;
      circle.pulse += dt * 2;
      if (circle.x - CIRCLE_RADIUS <= 0 || circle.x + CIRCLE_RADIUS >= state.width) {
        circle.vx *= -1;
      }
      if (circle.y - CIRCLE_RADIUS <= 0 || circle.y + CIRCLE_RADIUS >= state.height) {
        circle.vy *= -1;
      }
    });

    // Ball/circle collision — purely additive: awards charge and removes
    // the circle, never touches the ball's own position or velocity, so
    // it can't affect ball physics.
    state.circles = state.circles.filter((circle) => {
      const hit = Math.hypot(state.ball.x - circle.x, state.ball.y - circle.y) <= BALL_RADIUS + CIRCLE_RADIUS;
      if (hit) {
        addPowerCharge(randomCircleCharge());
        spawnCollectEffect(circle.x, circle.y);
      }
      return !hit;
    });

    state.collectEffects.forEach((fx) => {
      fx.age += dt;
    });
    state.collectEffects = state.collectEffects.filter((fx) => fx.age < COLLECT_EFFECT_SECONDS);
  }

  function drawCircles() {
    state.circles.forEach((circle) => {
      const glow = 0.5 + 0.5 * Math.sin(circle.pulse);

      ctx.beginPath();
      ctx.globalAlpha = 0.3 + glow * 0.25;
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 1.5;
      ctx.arc(circle.x, circle.y, CIRCLE_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.globalAlpha = 0.55 + glow * 0.25;
      ctx.fillStyle = colors.green;
      ctx.arc(circle.x, circle.y, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    });

    state.collectEffects.forEach((fx) => {
      const progress = fx.age / COLLECT_EFFECT_SECONDS;
      ctx.beginPath();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 2;
      ctx.arc(fx.x, fx.y, CIRCLE_RADIUS + progress * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function activateBlink() {
    if (!state.active || state.power < POWER_MAX || state.blinkCooldown > 0) return;

    SFX.play("powerActivate");

    const targetY = state.ball.y - state.player.height / 2;
    state.player.y = Math.max(
      PADDLE_EDGE_GAP,
      Math.min(state.height - state.player.height - PADDLE_EDGE_GAP, targetY)
    );

    state.power = 0;
    state.blinkCooldown = BLINK_COOLDOWN_SECONDS;
    updatePowerDisplay();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;

    state.player.height = Math.max(70, Math.min(140, rect.height * 0.2));
    state.ai.height = state.player.height;
    state.player.y = Math.min(state.player.y, rect.height - state.player.height - PADDLE_EDGE_GAP);
    state.ai.y = Math.min(state.ai.y, rect.height - state.ai.height - PADDLE_EDGE_GAP);
  }

  function serveBall(towardPlayer) {
    const angle = (Math.random() * 2 - 1) * (Math.PI / 6);
    const direction = towardPlayer ? -1 : 1;
    state.ball.x = state.width / 2;
    state.ball.y = state.height / 2;
    state.ball.vx = Math.cos(angle) * state.ballSpeed * direction;
    state.ball.vy = Math.sin(angle) * state.ballSpeed;
  }

  function resetGame() {
    state.score = 0;
    state.ballSpeed = currentDifficulty().ballSpeed;
    state.power = 0;
    state.blinkCooldown = 0;
    state.circles = [];
    state.collectEffects = [];
    state.circleSpawnTimer = CIRCLE_SPAWN_MIN_SECONDS;
    state.player.y = state.height / 2 - state.player.height / 2;
    state.ai.y = state.height / 2 - state.ai.height / 2;
    state.player.vy = 0;
    scoreEl && (scoreEl.textContent = "0");
    difficultyEl && (difficultyEl.textContent = String(currentDifficulty().pace));
    updatePowerDisplay();
    serveBall(false);
  }

  function updatePlayer(dt) {
    if (state.pointerY !== null) {
      const targetY = state.pointerY - state.player.height / 2;
      state.player.y += (targetY - state.player.y) * Math.min(1, dt * 14);
    } else {
      let dir = 0;
      if (state.keys.up) dir -= 1;
      if (state.keys.down) dir += 1;
      state.player.y += dir * PLAYER_SPEED * dt;
    }
    state.player.y = Math.max(PADDLE_EDGE_GAP, Math.min(state.height - state.player.height - PADDLE_EDGE_GAP, state.player.y));
  }

  function updateAI(dt, aiSpeed, aiError) {
    let targetY;

    if (state.ball.vx > 0) {
      // Ball is heading toward the AI: track it, but only roll the aim
      // error once per approach so the paddle doesn't twitch every frame.
      if (!state.ai.tracking) {
        state.ai.tracking = true;
        state.ai.errorOffset = (Math.random() * 2 - 1) * aiError;
      }
      targetY = state.ball.y - state.ai.height / 2 + state.ai.errorOffset;
    } else {
      // Ball is heading away: drift smoothly back to a resting position
      // instead of chasing the ball's constantly-changing y position.
      state.ai.tracking = false;
      targetY = state.height / 2 - state.ai.height / 2;
    }

    const diff = targetY - state.ai.y;
    const step = Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, diff));
    state.ai.y = Math.max(PADDLE_EDGE_GAP, Math.min(state.height - state.ai.height - PADDLE_EDGE_GAP, state.ai.y + step));
  }

  function reflectOffPaddle(paddleY, paddleHeight, incomingSpeed, direction) {
    const relative = (state.ball.y - (paddleY + paddleHeight / 2)) / (paddleHeight / 2);
    const clamped = Math.max(-1, Math.min(1, relative));
    const angle = clamped * MAX_BOUNCE_ANGLE;
    state.ball.vx = Math.cos(angle) * incomingSpeed * direction;
    state.ball.vy = Math.sin(angle) * incomingSpeed;
  }

  function update(dt) {
    const { aiSpeed, aiError, maxBallSpeed, speedIncrement } = currentDifficulty();

    if (state.blinkCooldown > 0) {
      state.blinkCooldown = Math.max(0, state.blinkCooldown - dt);
    }

    updatePlayer(dt);
    updateAI(dt, aiSpeed, aiError);

    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;

    updateCircles(dt);

    if (state.ball.y - BALL_RADIUS <= 0) {
      state.ball.y = BALL_RADIUS;
      state.ball.vy *= -1;
      SFX.play("wallBounce");
    } else if (state.ball.y + BALL_RADIUS >= state.height) {
      state.ball.y = state.height - BALL_RADIUS;
      state.ball.vy *= -1;
      SFX.play("wallBounce");
    }

    const playerX = PADDLE_MARGIN;
    const aiX = state.width - PADDLE_MARGIN - state.ai.width;

    // Player paddle collision — one point per hit, plus a gradual,
    // capped speed increase. Repositioning the ball out of the paddle
    // immediately below prevents this from firing again next frame.
    if (
      state.ball.vx < 0 &&
      state.ball.x - BALL_RADIUS <= playerX + state.player.width &&
      state.ball.x - BALL_RADIUS >= playerX &&
      state.ball.y >= state.player.y &&
      state.ball.y <= state.player.y + state.player.height
    ) {
      state.ball.x = playerX + state.player.width + BALL_RADIUS;
      state.score += 1;
      state.ballSpeed = Math.min(state.ballSpeed + speedIncrement, maxBallSpeed);
      reflectOffPaddle(state.player.y, state.player.height, state.ballSpeed, 1);
      scoreEl && (scoreEl.textContent = String(state.score));
      addPowerCharge(POWER_CHARGE_ON_HIT);
      SFX.play("playerHit");
    }

    // AI paddle collision — bounce only, no score, speed unchanged.
    if (
      state.ball.vx > 0 &&
      state.ball.x + BALL_RADIUS >= aiX &&
      state.ball.x + BALL_RADIUS <= aiX + state.ai.width &&
      state.ball.y >= state.ai.y &&
      state.ball.y <= state.ai.y + state.ai.height
    ) {
      state.ball.x = aiX - BALL_RADIUS;
      reflectOffPaddle(state.ai.y, state.ai.height, state.ballSpeed, -1);
      SFX.play("aiHit");
    }

    // Ball completely passed the AI paddle and reached the right-side
    // scoring boundary — award the bonus once, then reset. Re-centering
    // the ball here means this can't fire again until it happens for
    // real next time, so it's a single, non-duplicating event.
    if (state.ball.x + BALL_RADIUS >= state.width) {
      state.score += 5;
      scoreEl && (scoreEl.textContent = String(state.score));
      addPowerCharge(POWER_CHARGE_ON_PASS);
      SFX.play("bonusScore");
      state.ballSpeed = currentDifficulty().ballSpeed;
      serveBall(true); // AI serves first, sending the ball toward the player
      return;
    }

    // Only the player missing ends the game.
    if (state.ball.x - BALL_RADIUS <= 0) {
      endGame();
    }
  }

  function drawCourt() {
    ctx.clearRect(0, 0, state.width, state.height);

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(state.width / 2, 0);
    ctx.lineTo(state.width / 2, state.height);
    ctx.stroke();
    ctx.setLineDash([]);

    drawCircles();

    const paddleRadius = state.player.width / 2;

    ctx.fillStyle = colors.coral;
    ctx.beginPath();
    ctx.roundRect(PADDLE_MARGIN, state.player.y, state.player.width, state.player.height, paddleRadius);
    ctx.fill();

    ctx.fillStyle = colors.blue;
    ctx.beginPath();
    ctx.roundRect(state.width - PADDLE_MARGIN - state.ai.width, state.ai.y, state.ai.width, state.ai.height, paddleRadius);
    ctx.fill();

    ctx.fillStyle = colors.gold;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(timestamp) {
    if (!state.active) return;
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;

    update(dt);
    drawCourt();

    state.rafId = window.requestAnimationFrame(loop);
  }

  function startLoop() {
    state.lastTime = 0;
    state.rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function endGame() {
    state.active = false;
    stopLoop();

    const isNewBest = state.score > state.best;
    if (isNewBest) {
      state.best = state.score;
      window.localStorage.setItem(HIGH_SCORE_KEY, String(state.best));
    }

    SFX.play(isNewBest ? "newHighScore" : "gameOver");

    finalScoreEl && (finalScoreEl.textContent = String(state.score));
    finalBestEl && (finalBestEl.textContent = String(state.best));
    highScoreEl && (highScoreEl.textContent = String(state.best));
    recordLabelEl && (recordLabelEl.textContent = isNewBest ? "New Best Score!" : "Game Over");

    gameOverEl && gameOverEl.removeAttribute("hidden");
  }

  function openDifficultyScreen() {
    document.body.classList.add("game-active");
    gameScreen.setAttribute("hidden", "");
    gameOverEl && gameOverEl.setAttribute("hidden", "");
    difficultyScreen && difficultyScreen.removeAttribute("hidden");
  }

  function startEndlessMode(difficulty) {
    state.difficulty = difficulty;

    difficultyScreen && difficultyScreen.setAttribute("hidden", "");
    document.body.classList.add("game-active");
    gameScreen.removeAttribute("hidden");
    gameOverEl && gameOverEl.setAttribute("hidden", "");

    resizeCanvas();
    resetGame();

    state.active = true;
    startLoop();
  }

  function exitToMainMenu() {
    state.active = false;
    stopLoop();
    gameOverEl && gameOverEl.setAttribute("hidden", "");
    gameScreen.setAttribute("hidden", "");
    difficultyScreen && difficultyScreen.setAttribute("hidden", "");
    document.body.classList.remove("game-active");
  }

  startButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      openDifficultyScreen();
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      startEndlessMode(button.dataset.difficultySelect);
    });
  });

  difficultyBackButton &&
    difficultyBackButton.addEventListener("click", () => {
      SFX.play("uiClick");
      exitToMainMenu();
    });

  mainMenuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      exitToMainMenu();
    });
  });

  if (playAgainButton) {
    playAgainButton.addEventListener("click", () => {
      SFX.play("uiClick");
      gameOverEl && gameOverEl.setAttribute("hidden", "");
      resizeCanvas();
      resetGame();
      state.active = true;
      startLoop();
    });
  }

  window.addEventListener("resize", () => {
    if (state.active) resizeCanvas();
  });

  window.addEventListener("keydown", (event) => {
    if (!state.active) return;
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      state.keys.up = true;
      state.pointerY = null;
      event.preventDefault();
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      state.keys.down = true;
      state.pointerY = null;
      event.preventDefault();
    } else if ((event.key === "z" || event.key === "Z") && !event.repeat) {
      event.preventDefault();
      activateBlink();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      state.keys.up = false;
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      state.keys.down = false;
    }
  });

  function pointerToCanvasY(clientY) {
    const rect = canvas.getBoundingClientRect();
    return clientY - rect.top;
  }

  // Mouse paddle control — temporarily disabled per request; the player
  // paddle now follows keyboard input only. To re-enable, uncomment the
  // addEventListener call below (the handler itself is unchanged).
  function handleMouseMove(event) {
    if (!state.active) return;
    state.pointerY = pointerToCanvasY(event.clientY);
  }
  // canvas.addEventListener("mousemove", handleMouseMove);

  // Touch paddle control — disabled per request, same as mouse above.
  // The paddle now follows keyboard input (Arrow Up/Down, W/S) only.
  // preventDefault is kept so touching the canvas doesn't scroll the page;
  // it just no longer sets pointerY, so it can't move the paddle.
  function handleTouchMove(event) {
    if (!state.active) return;
    event.preventDefault();
  }
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
})();

/* =========================================================
   Classic Mode — Traditional Pong
   Fully self-contained: its own canvas, its own state, its own loop.
   Does not read from or write to the Endless Mode engine above, so it
   cannot affect Endless Mode's behavior. It reuses two shared things
   only: the SFX module, and the shared DIFFICULTY_PRESETS object
   (same Easy/Medium/Hard AI settings Endless uses). The paddle/ball
   physics formulas are re-implemented locally (not imported from the
   Endless engine) so this new mode can never regress it.
   DOM hooks: [data-start-classic] (x2), [data-classic-difficulty-screen],
   [data-classic-difficulty-select] (x3), [data-classic-difficulty-back],
   [data-classic-screen], [data-classic-canvas], [data-classic-player-score],
   [data-classic-ai-score], [data-classic-main-menu] (x2),
   [data-classic-game-over], [data-classic-result], [data-classic-result-label],
   [data-classic-final-player], [data-classic-final-ai], [data-classic-play-again]
   ========================================================= */
(function () {
  const classicScreen = document.querySelector("[data-classic-screen]");
  const canvas = document.querySelector("[data-classic-canvas]");

  if (!classicScreen || !canvas) return;

  const ctx = canvas.getContext("2d");

  // Two of each of these exist (nav + hero for start; topbar + game-over
  // card for main menu) — same pattern as Endless Mode's buttons.
  const startButtons = document.querySelectorAll("[data-start-classic]");
  const mainMenuButtons = document.querySelectorAll("[data-classic-main-menu]");

  const difficultyScreen = document.querySelector("[data-classic-difficulty-screen]");
  const difficultyButtons = document.querySelectorAll("[data-classic-difficulty-select]");
  const difficultyBackButton = document.querySelector("[data-classic-difficulty-back]");

  const playerScoreEl = document.querySelector("[data-classic-player-score]");
  const aiScoreEl = document.querySelector("[data-classic-ai-score]");
  const gameOverEl = document.querySelector("[data-classic-game-over]");
  const resultEl = document.querySelector("[data-classic-result]");
  const resultLabelEl = document.querySelector("[data-classic-result-label]");
  const finalPlayerEl = document.querySelector("[data-classic-final-player]");
  const finalAiEl = document.querySelector("[data-classic-final-ai]");
  const playAgainButton = document.querySelector("[data-classic-play-again]");

  const WIN_SCORE = 11;
  const PLAYER_SPEED = 480;
  const PADDLE_MARGIN = 22;
  const BALL_RADIUS = 9;
  const PADDLE_EDGE_GAP = BALL_RADIUS - 2;
  const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;

  const styles = getComputedStyle(document.documentElement);
  const colors = {
    line: styles.getPropertyValue("--line").trim() || "rgba(246,251,248,0.13)",
    coral: styles.getPropertyValue("--coral").trim() || "#ff6b4a",
    gold: styles.getPropertyValue("--gold").trim() || "#ffd166",
    blue: styles.getPropertyValue("--blue").trim() || "#7aa7ff",
  };

  const state = {
    active: false,
    width: 0,
    height: 0,
    difficulty: "medium",
    playerScore: 0,
    aiScore: 0,
    nextServe: "player",
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    player: { y: 0, height: 110, width: 14 },
    ai: { y: 0, height: 110, width: 14, tracking: false, errorOffset: 0 },
    keys: { up: false, down: false },
    lastTime: 0,
    rafId: null,
  };

  function currentDifficulty() {
    return DIFFICULTY_PRESETS[state.difficulty] || DIFFICULTY_PRESETS.medium;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;

    state.player.height = Math.max(70, Math.min(140, rect.height * 0.2));
    state.ai.height = state.player.height;
    state.player.y = Math.min(state.player.y, rect.height - state.player.height - PADDLE_EDGE_GAP);
    state.ai.y = Math.min(state.ai.y, rect.height - state.ai.height - PADDLE_EDGE_GAP);
  }

  // Ball speed stays fixed at the chosen difficulty's starting speed for
  // the whole match — no Endless-style rally ramp, per spec ("keep the
  // ball speed balanced... reset normally after each point").
  function serveBall(towardPlayer) {
    const { ballSpeed } = currentDifficulty();
    const angle = (Math.random() * 2 - 1) * (Math.PI / 6);
    const direction = towardPlayer ? -1 : 1;
    state.ball.x = state.width / 2;
    state.ball.y = state.height / 2;
    state.ball.vx = Math.cos(angle) * ballSpeed * direction;
    state.ball.vy = Math.sin(angle) * ballSpeed;
  }

  function resetPositions() {
    state.player.y = state.height / 2 - state.player.height / 2;
    state.ai.y = state.height / 2 - state.ai.height / 2;
    state.ai.tracking = false;
  }

  function resetMatch() {
    state.playerScore = 0;
    state.aiScore = 0;
    state.nextServe = Math.random() < 0.5 ? "player" : "ai";
    playerScoreEl && (playerScoreEl.textContent = "0");
    aiScoreEl && (aiScoreEl.textContent = "0");
    resetPositions();
    serveBall(state.nextServe === "ai"); // server's ball moves away from the server
  }

  function updatePlayer(dt) {
    let dir = 0;
    if (state.keys.up) dir -= 1;
    if (state.keys.down) dir += 1;
    state.player.y += dir * PLAYER_SPEED * dt;
    state.player.y = Math.max(
      PADDLE_EDGE_GAP,
      Math.min(state.height - state.player.height - PADDLE_EDGE_GAP, state.player.y)
    );
  }

  function updateAI(dt, aiSpeed, aiError) {
    let targetY;
    if (state.ball.vx > 0) {
      if (!state.ai.tracking) {
        state.ai.tracking = true;
        state.ai.errorOffset = (Math.random() * 2 - 1) * aiError;
      }
      targetY = state.ball.y - state.ai.height / 2 + state.ai.errorOffset;
    } else {
      state.ai.tracking = false;
      targetY = state.height / 2 - state.ai.height / 2;
    }
    const diff = targetY - state.ai.y;
    const step = Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, diff));
    state.ai.y = Math.max(
      PADDLE_EDGE_GAP,
      Math.min(state.height - state.ai.height - PADDLE_EDGE_GAP, state.ai.y + step)
    );
  }

  function reflectOffPaddle(paddleY, paddleHeight, incomingSpeed, direction) {
    const relative = (state.ball.y - (paddleY + paddleHeight / 2)) / (paddleHeight / 2);
    const clamped = Math.max(-1, Math.min(1, relative));
    const angle = clamped * MAX_BOUNCE_ANGLE;
    state.ball.vx = Math.cos(angle) * incomingSpeed * direction;
    state.ball.vy = Math.sin(angle) * incomingSpeed;
  }

  function awardPoint(winner) {
    if (winner === "player") {
      state.playerScore += 1;
      playerScoreEl && (playerScoreEl.textContent = String(state.playerScore));
    } else {
      state.aiScore += 1;
      aiScoreEl && (aiScoreEl.textContent = String(state.aiScore));
    }
    SFX.play("bonusScore");

    if (state.playerScore >= WIN_SCORE || state.aiScore >= WIN_SCORE) {
      endMatch(winner);
      return;
    }

    // Strict alternation each point — a simple, consistent serve rule.
    state.nextServe = state.nextServe === "player" ? "ai" : "player";
    resetPositions();
    serveBall(state.nextServe === "ai");
  }

  function update(dt) {
    const { aiSpeed, aiError, ballSpeed } = currentDifficulty();

    updatePlayer(dt);
    updateAI(dt, aiSpeed, aiError);

    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;

    if (state.ball.y - BALL_RADIUS <= 0) {
      state.ball.y = BALL_RADIUS;
      state.ball.vy *= -1;
      SFX.play("wallBounce");
    } else if (state.ball.y + BALL_RADIUS >= state.height) {
      state.ball.y = state.height - BALL_RADIUS;
      state.ball.vy *= -1;
      SFX.play("wallBounce");
    }

    const playerX = PADDLE_MARGIN;
    const aiX = state.width - PADDLE_MARGIN - state.ai.width;

    if (
      state.ball.vx < 0 &&
      state.ball.x - BALL_RADIUS <= playerX + state.player.width &&
      state.ball.x - BALL_RADIUS >= playerX &&
      state.ball.y >= state.player.y &&
      state.ball.y <= state.player.y + state.player.height
    ) {
      state.ball.x = playerX + state.player.width + BALL_RADIUS;
      reflectOffPaddle(state.player.y, state.player.height, ballSpeed, 1);
      SFX.play("playerHit");
    }

    if (
      state.ball.vx > 0 &&
      state.ball.x + BALL_RADIUS >= aiX &&
      state.ball.x + BALL_RADIUS <= aiX + state.ai.width &&
      state.ball.y >= state.ai.y &&
      state.ball.y <= state.ai.y + state.ai.height
    ) {
      state.ball.x = aiX - BALL_RADIUS;
      reflectOffPaddle(state.ai.y, state.ai.height, ballSpeed, -1);
      SFX.play("aiHit");
    }

    // Traditional scoring: whoever the ball gets past scores the point.
    if (state.ball.x + BALL_RADIUS >= state.width) {
      awardPoint("player");
      return;
    }
    if (state.ball.x - BALL_RADIUS <= 0) {
      awardPoint("ai");
    }
  }

  function drawCourt() {
    ctx.clearRect(0, 0, state.width, state.height);

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(state.width / 2, 0);
    ctx.lineTo(state.width / 2, state.height);
    ctx.stroke();
    ctx.setLineDash([]);

    const paddleRadius = state.player.width / 2;

    ctx.fillStyle = colors.coral;
    ctx.beginPath();
    ctx.roundRect(PADDLE_MARGIN, state.player.y, state.player.width, state.player.height, paddleRadius);
    ctx.fill();

    ctx.fillStyle = colors.blue;
    ctx.beginPath();
    ctx.roundRect(
      state.width - PADDLE_MARGIN - state.ai.width,
      state.ai.y,
      state.ai.width,
      state.ai.height,
      paddleRadius
    );
    ctx.fill();

    ctx.fillStyle = colors.gold;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(timestamp) {
    if (!state.active) return;
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;

    update(dt);
    drawCourt();

    state.rafId = window.requestAnimationFrame(loop);
  }

  function startLoop() {
    state.lastTime = 0;
    state.rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function endMatch(winner) {
    state.active = false;
    stopLoop();

    const playerWon = winner === "player";
    resultEl && (resultEl.textContent = playerWon ? "YOU WIN" : "AI WINS");
    resultLabelEl && (resultLabelEl.textContent = playerWon ? "Victory" : "Defeat");
    finalPlayerEl && (finalPlayerEl.textContent = String(state.playerScore));
    finalAiEl && (finalAiEl.textContent = String(state.aiScore));
    SFX.play(playerWon ? "newHighScore" : "gameOver");

    gameOverEl && gameOverEl.removeAttribute("hidden");
  }

  function openDifficultyScreen() {
    document.body.classList.add("game-active");
    classicScreen.setAttribute("hidden", "");
    gameOverEl && gameOverEl.setAttribute("hidden", "");
    difficultyScreen && difficultyScreen.removeAttribute("hidden");
  }

  function startMatch(difficulty) {
    state.difficulty = difficulty;

    difficultyScreen && difficultyScreen.setAttribute("hidden", "");
    document.body.classList.add("game-active");
    classicScreen.removeAttribute("hidden");
    gameOverEl && gameOverEl.setAttribute("hidden", "");

    resizeCanvas();
    resetMatch();

    state.active = true;
    startLoop();
  }

  function exitToMainMenu() {
    state.active = false;
    stopLoop();
    gameOverEl && gameOverEl.setAttribute("hidden", "");
    classicScreen.setAttribute("hidden", "");
    difficultyScreen && difficultyScreen.setAttribute("hidden", "");
    document.body.classList.remove("game-active");
  }

  startButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      openDifficultyScreen();
    });
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      startMatch(button.dataset.classicDifficultySelect);
    });
  });

  difficultyBackButton &&
    difficultyBackButton.addEventListener("click", () => {
      SFX.play("uiClick");
      exitToMainMenu();
    });

  mainMenuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      SFX.play("uiClick");
      exitToMainMenu();
    });
  });

  if (playAgainButton) {
    playAgainButton.addEventListener("click", () => {
      SFX.play("uiClick");
      gameOverEl && gameOverEl.setAttribute("hidden", "");
      resizeCanvas();
      resetMatch();
      state.active = true;
      startLoop();
    });
  }

  window.addEventListener("resize", () => {
    if (state.active) resizeCanvas();
  });

  // Keyboard only — no mousemove/touchmove listeners exist anywhere in
  // this module, so mouse and touch simply cannot move this paddle.
  window.addEventListener("keydown", (event) => {
    if (!state.active) return;
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      state.keys.up = true;
      event.preventDefault();
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      state.keys.down = true;
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      state.keys.up = false;
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      state.keys.down = false;
    }
  });
})();