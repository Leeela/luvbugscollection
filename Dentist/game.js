// ═══════════════════════════════════════════════════════════
// GODISBACILLEN RYMMER FRÅN TANDLÄKAREN! — endless runner
// Fas 1 prototyp — portrait-native, stadsmiljö-bakgrund
// ═══════════════════════════════════════════════════════════

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // ── DOM ──
  const menuEl       = document.getElementById('menu');
  const hudEl        = document.getElementById('hud');
  const scoreEl      = document.getElementById('score');
  const livesPill    = document.getElementById('livesPill');
  const brushCountEl = document.getElementById('brushCount');
  const streakPillEl  = document.getElementById('streakPill');
  const streakCountEl = document.getElementById('streakCount');
  const pauseBtn     = document.getElementById('pauseBtn');
  const instruction  = document.getElementById('instruction');
  const gameoverEl   = document.getElementById('gameover');
  const gameoverTitle= document.getElementById('gameoverTitle');
  const finalScoreEl = document.getElementById('finalScore');
  const starsEl      = document.getElementById('stars');
  const highscoreTxt = document.getElementById('highscoreText');
  const bestStreakEl = document.getElementById('bestStreakText');
  const playAgainBtn = document.getElementById('playAgain');
  const toMenuBtn    = document.getElementById('toMenu');
  const nextLevelBtn = document.getElementById('nextLevel');

  // ── Dimensioner — viewport-native, inga ctx.scale() ──
  let VW, VH, GY, PR, JUMP, GRAV;

  function resize() {
    VW = canvas.width  = window.innerWidth;
    VH = canvas.height = window.innerHeight;
    GY   = Math.round(VH * 0.82);           // marknivå
    PR   = Math.round(Math.min(VW, VH) * 0.07); // spelarens radius
    const BASE = Math.min(VW, VH);
    JUMP = Math.max(-(BASE * 0.060), -28);  // hoppkraft (begränsad för stora skärmar)
    GRAV = Math.min(BASE * 0.0018, 0.85);  // gravitation (begränsad för stora skärmar)
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Svårighetsgrader ──
  const DIFFICULTIES = {
    easy: {
      label: 'EASY',
      startSpeed: () => VW * 0.003,
      maxSpeed:   () => VW * 0.003,   // ökar aldrig — konstant hastighet
      speedGrowth:() => 0,
      obstacleGap: [180, 300],
      candyGap:    [70, 130],
      dentistGap:      [4000, 5000],
      dentistChaseGap: [4000, 5000],
      maxDentists: 1,
      lives: Infinity,
      jumpForgiveness: 12,
      starThresholds: [50, 150, 300],
      candyHeightLevels: 3,
      candyBounceSpeed: 0.025,
      candyBounceAmplitude: () => PR * 0.4,
    },
    medium: {
      label: 'MEDIUM',
      startSpeed: () => VW * 0.006,
      maxSpeed:   () => VW * 0.015,
      speedGrowth:() => VW * 0.000002,
      obstacleGap: [100, 200],
      candyGap:    [50, 100],
      dentistGap:      [1500, 2500],
      dentistChaseGap: [1500, 2500],
      maxDentists: 2,
      lives: 3,
      jumpForgiveness: 6,
      starThresholds: [100, 300, 500],
      candyHeightLevels: 5,
      candyBounceSpeed: 0.055,
      candyBounceAmplitude: () => PR * 0.9,
    },
    hard: {
      label: 'HARD',
      startSpeed: () => VW * 0.009,
      maxSpeed:   () => VW * 0.025,
      speedGrowth:() => VW * 0.000004,
      obstacleGap: [80, 150],
      candyGap:    [40, 90],
      dentistGap:      [1000, 1800],
      dentistChaseGap: [280, 420],
      maxDentists: 3,
      lives: 1,
      jumpForgiveness: 3,
      starThresholds: [200, 500, 1000],
      candyHeightLevels: 5,
      candyBounceSpeed: 0.095,
      candyBounceAmplitude: () => PR * 1.4,
    },
  };

  // ── Spelstate ──
  let state = {
    running: false, paused: false, brushing: false,
    difficulty: null, config: null,
    speed: 0, frame: 0, score: 0, lives: 0,
    invincibleFrames: 0,
    obstacles: [], candies: [], buildings: [],
    bgScroll: 0, fgScroll: 0,
    nextObstacleIn: 80, nextCandyIn: 50,
    brushCount: 0, passedObstacles: new Set(),
    dentists: [], dentistsSpawned: 0, showingWinVideo: false,
  };

  const player = { x: 0, y: 0, vy: 0, onGround: true };
  let winVideoTimer = null;
  let brushState = null;

  // ── JAA!-hoppljud (mp3-fil) ──
  const jaaSound = new Audio('../JAA!.mp3');
  jaaSound.preload = 'auto';
  jaaSound.volume = 0.15;

  const tackSound = new Audio('../Tack.mp3');
  tackSound.preload = 'auto';
  tackSound.volume = 1.0;
  function playJaaSound() {
    try { jaaSound.currentTime = 0; jaaSound.play().catch(() => {}); } catch(e) {}
  }

  // ── Ljud (Web Audio API — inga filer behövs) ──
  let audioCtx = null;
  function getCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Bakgrundsmusik — glad löp-melodi
  let bgLoopId = null;
  let bgMasterGain = null;
  const BG_MELODY = [523, 659, 784, 880, 784, 659, 523, 392]; // C5 E5 G5 A5 G5 E5 C5 G4
  let bgStep = 0;
  function startBgMusic() {
    if (bgLoopId) return;
    const ctx = getCtx();
    bgMasterGain = ctx.createGain();
    bgMasterGain.gain.value = 0.07;
    bgMasterGain.connect(ctx.destination);
    bgStep = 0;
    function tick() {
      if (!state.running) return;
      if (!state.paused) {
        const ctx2 = getCtx();
        const freq = BG_MELODY[bgStep % BG_MELODY.length];
        const osc  = ctx2.createOscillator();
        const g    = ctx2.createGain();
        osc.connect(g); g.connect(bgMasterGain);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(1, ctx2.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.13);
        osc.start(); osc.stop(ctx2.currentTime + 0.13);
        bgStep++;
      }
      bgLoopId = setTimeout(tick, 175);
    }
    tick();
  }
  function stopBgMusic() {
    if (bgLoopId) { clearTimeout(bgLoopId); bgLoopId = null; }
    if (bgMasterGain) { try { bgMasterGain.disconnect(); } catch(e){} bgMasterGain = null; }
  }

  // Hopp-ljud: snabb ascending-beep när Godisbacillen klarar en tandborste
  function playJumpSound() {
    try {
      const ctx = getCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(); osc.stop(ctx.currentTime + 0.22);
    } catch(e) {}
  }

  // Godis-ljud: litet dubbel-pling vid upphämtning
  function playCandySound() {
    try {
      const ctx = getCtx();
      [[880, 0], [1100, 0.09]].forEach(([freq, delay]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.start(t); osc.stop(t + 0.14);
      });
    } catch(e) {}
  }

  // Varningsljud: två låga "dun"-pulser när tandläkaren spawnar
  function playWarningSound() {
    try {
      const ctx = getCtx();
      [0, 0.28].forEach(delay => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + delay + 0.22);
        gain.gain.setValueAtTime(0.22, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.22);
      });
    } catch(e) {}
  }

  // ── Sprite-laddning ──
  const sprites = {
    run1: new Image(),
    run2: new Image(),
    jump: new Image(),
    dentist: new Image(),
    tooth: new Image(),
    toothbrush: new Image(),
    gaper: new Image(),
  };
  sprites.run1.src = 'sprites/Godisbacillen springer.png';
  sprites.run2.src = 'sprites/Godisbacillen springer snabbt.png';
  sprites.jump.src = 'sprites/Godisbacillen hoppar.png';
  sprites.dentist.src = 'sprites/Tandläkaren.png';
  sprites.tooth.src = 'sprites/tand.png';
  sprites.toothbrush.src = 'sprites/tandborste.png';
  sprites.gaper.src = 'sprites/godisbacillen-gapar.png';
  let spritesLoaded = 0;
  Object.values(sprites).forEach(img => {
    img.onload = () => spritesLoaded++;
  });

  // ── Input ──
  function jump() {
    if (!state.running || state.paused) return;
    if (player.onGround) {
      player.vy = JUMP;
      player.onGround = false;
      playJaaSound();
    }
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  });
  document.addEventListener('pointerdown', e => {
    if (!state.running || state.paused) return;
    if (e.target.closest('.pause-btn, .gameover, .overlay')) return;
    jump();
  });

  // ── Meny ──
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.diff));
  });
  playAgainBtn.addEventListener('click', () => startGame(state.difficulty));
  toMenuBtn.addEventListener('click', showMenu);
  pauseBtn.addEventListener('click', togglePause);
  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', () => {
      const difficulties = ['medium', 'hard'];
      const currentIdx = difficulties.indexOf(state.difficulty);
      const nextDiff = difficulties[Math.min(currentIdx+1, difficulties.length-1)];
      startGame(nextDiff);
    });
  }

  function showMenu() {
    state.running = false; state.paused = false;
    gameoverEl.classList.remove('show');
    hudEl.style.display = 'none';
    pauseBtn.classList.remove('show');
    menuEl.classList.remove('hidden');
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '▶' : '⏸';
  }

  function startGame(difficulty) {
    resize(); // uppdatera dimensioner vid start
    state.difficulty = difficulty;
    state.config = DIFFICULTIES[difficulty];
    state.running = true; state.paused = false;
    state.speed = state.config.startSpeed();
    state.frame = 0; state.score = 0;
    state.lives = state.config.lives;
    state.invincibleFrames = 0;
    state.obstacles = []; state.candies = [];
    state.bgScroll = 0; state.fgScroll = 0;
    state.nextObstacleIn = 120;
    state.nextCandyIn = 60;
    state.brushCount = 0;
    state.milestonesReached = 0;
    state.bonusBounce = false;
    state.streak = 0;
    state.bestStreak = 0;
    popups.length = 0;
    state.passedObstacles = new Set();
    state.nextDentistIn = state.config.dentistGap[0];
    state.dentists = [];
    state.dentistsSpawned = 0;
    state.showingWinVideo = false;
    if (nextLevelBtn) nextLevelBtn.style.display = 'none';
    stopBgMusic();
    startBgMusic();

    // Bakgrundsbyggnader
    state.buildings = [];
    for (let i = 0; i < 8; i++) {
      state.buildings.push(mkBuilding(i * VW * 0.3));
    }

    player.x = VW * 0.15;
    player.y = GY;
    player.vy = 0; player.onGround = true;

    menuEl.classList.add('hidden');
    gameoverEl.classList.remove('show');
    hudEl.style.display = 'flex';
    pauseBtn.classList.add('show');
    pauseBtn.textContent = '⏸';
    instruction.classList.remove('show');
    void instruction.offsetWidth;
    instruction.classList.add('show');
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    if (brushCountEl) brushCountEl.textContent = `🪥 ${state.brushCount}/10`;
    if (state.lives === Infinity) {
      livesPill.innerHTML = '💖';
    } else {
      livesPill.innerHTML = '❤️'.repeat(Math.max(0, state.lives)) || '💔';
    }
    if (streakCountEl) streakCountEl.textContent = state.streak;
    if (streakPillEl) {
      streakPillEl.style.display = state.streak >= 3 ? 'block' : 'none';
      streakPillEl.style.background = state.streak >= 10
        ? 'rgba(255,215,0,0.95)'   // guld vid 10+
        : state.streak >= 5
        ? 'rgba(255,152,0,0.95)'   // orange vid 5+
        : 'rgba(255,255,255,0.95)'; // vit vid 3-4
    }
  }

  // ── Bakgrundsbyggnader ──
  function mkBuilding(x) {
    const h = VH * (0.20 + Math.random() * 0.25);
    const w = VH * 0.12;
    const treeTypes = ['oak', 'pine'];
    const color = treeTypes[Math.floor(Math.random() * treeTypes.length)];
    return { x, w, h, color, hasTree: true };
  }

  function drawFlowers(x, y, slot = 0) {
    const colors = ['#ff69b4','#ffd700','#ff4500','#ee82ee','#ffd700'];
    for (let i = 0; i < 3; i++) {
      const fx = x + i * VW * 0.03;
      const fc = colors[(slot * 3 + i) % colors.length];
      ctx.strokeStyle = '#228B22';
      ctx.lineWidth = Math.max(1.5, VW * 0.003);
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.lineTo(fx, y - VH * 0.04);
      ctx.stroke();
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(fx, y - VH * 0.04, VH * 0.018, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(fx, y - VH * 0.04, VH * 0.007, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Spawn hinder ──
  let obstacleIdCounter = 0;
  function spawnObstacle() {
    // Slumpa tand (60%) eller tandborste (40%)
    const type = Math.random() < 0.6 ? 'tooth' : 'toothbrush';
    let oh, aspect;
    if (type === 'tooth') {
      oh = PR * 1.4;
      aspect = sprites.tooth.naturalWidth > 0
        ? sprites.tooth.naturalWidth / sprites.tooth.naturalHeight
        : 642 / 502;
    } else {
      oh = PR * 1.1;
      aspect = sprites.toothbrush.naturalWidth > 0
        ? sprites.toothbrush.naturalWidth / sprites.toothbrush.naturalHeight
        : 703 / 371;
    }
    const ow = oh * aspect;
    const obs = { id: obstacleIdCounter++, type, x: VW + 30, y: GY, w: ow, h: oh, isBrush: true };
    state.obstacles.push(obs);
  }

  // ── Spawn godis ──
  function spawnCandy() {
    const types = ['candy','lollipop','rainbow','glitter','cake','superbag'];
    const weights = [58, 20, 8, 8, 4, 2];
    const total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*total, type='candy';
    for (let i=0;i<types.length;i++) { r-=weights[i]; if(r<=0){type=types[i];break;} }
    const cs = PR * 0.9; // större godis
    const allHeights = [GY - PR*1.2, GY - PR*2.2, GY - PR*3.2, GY - PR*4.2, GY - PR*5];
    const numLevels = state.config.candyHeightLevels || 5;
    const heights = allHeights.slice(0, numLevels);
    const baseY = heights[Math.floor(Math.random() * heights.length)];
    state.candies.push({ type, x: VW+20, baseY, y: baseY, w: cs, h: cs, wobble: Math.random()*Math.PI*2 });
  }

  // ── Kollision ──
  function rectsOverlap(a, b, m=0) {
    return a.x+m < b.x+b.w && a.x+a.w-m > b.x && a.y+m < b.y+b.h && a.y+a.h-m > b.y;
  }

  // ── Popups ──
  const popups = [];
  function spawnPopup(text, x, y) {
    popups.push({ text, x, y, life: 55, vy: -1.5 });
  }

  function triggerMilestone(n) {
    if (n === 1) {
      // Hastighetsboost vid milstolpe 1
      state.speed = Math.min(state.speed * 1.4, state.config.maxSpeed());
      spawnPopup('🔥 Snabbare!', VW / 2, VH * 0.3);
    } else if (n === 2) {
      state.bonusBounce = true;
      spawnPopup('🍬 What is going on?!', VW / 2, VH * 0.3);
    }
  }

  // ── Partiklar ──
  const particles = [];
  function spawnParticles(x, y, color) {
    for (let i=0;i<10;i++) {
      particles.push({
        x, y,
        vx:(Math.random()-0.5)*8,
        vy:-(Math.random()*8+2),
        life:40, color, size: PR*0.15+Math.random()*PR*0.15
      });
    }
  }

  // ── Update ──
  function update() {
    if (state.brushing) { updateBrushing(); return; }
    if (!state.running || state.paused) return;
    state.frame++;
    const cfg = state.config;
    const maxSpd = cfg.maxSpeed();
    if (state.speed < maxSpd) state.speed += cfg.speedGrowth();
    state.bgScroll += state.speed * 0.3;
    state.fgScroll += state.speed;

    // Spelare-fysik
    player.vy += GRAV;
    player.y  += player.vy;
    if (player.y >= GY) { player.y = GY; player.vy = 0; player.onGround = true; }

    if (state.invincibleFrames > 0) state.invincibleFrames--;

    // Spawn
    state.nextObstacleIn--;
    if (state.nextObstacleIn <= 0) {
      spawnObstacle();
      const [mn,mx] = cfg.obstacleGap;
      state.nextObstacleIn = mn + Math.random()*(mx-mn);
    }
    state.nextCandyIn--;
    if (state.nextCandyIn <= 0) {
      spawnCandy();
      const [mn,mx] = cfg.candyGap;
      state.nextCandyIn = mn + Math.random()*(mx-mn);
    }

    // Tandläkare spawn
    state.nextDentistIn--;
    if (state.nextDentistIn <= 0 && state.dentistsSpawned < cfg.maxDentists) {
      const dentistW = PR*2.0;
      const dentistH = PR*2.5;
      state.dentists.push({ x: VW, y: GY - dentistH, w: dentistW, h: dentistH, passed: false });
      state.dentistsSpawned++;
      playWarningSound();
      // Nästa gap: kort chase-gap om fler ska komma, annars nästa våg
      const [mn,mx] = state.dentistsSpawned < cfg.maxDentists ? cfg.dentistChaseGap : cfg.dentistGap;
      state.nextDentistIn = mn + Math.random()*(mx-mn);
    }

    // Spelar-hitbox
    const playerRect = { x: player.x-PR*0.7, y: player.y-PR*2, w: PR*1.4, h: PR*2 };

    // Hinder
    for (let i=state.obstacles.length-1;i>=0;i--) {
      const o = state.obstacles[i];
      o.x -= state.speed;

      // Detektera om tandborste/tand är framgångsrikt hoppad över
      if (o.isBrush && !state.passedObstacles.has(o.id) && player.x > o.x + o.w) {
        state.passedObstacles.add(o.id);
        state.brushCount++;
        if (state.difficulty !== 'easy') {
          if (state.brushCount === 4 && state.milestonesReached < 1) {
            state.milestonesReached = 1;
            triggerMilestone(1);
          }
          if (state.brushCount === 7 && state.milestonesReached < 2) {
            state.milestonesReached = 2;
            triggerMilestone(2);
          }
        }
        playJumpSound();
        state.score += 50;
        spawnParticles(o.x + o.w/2, o.y, '#ffeb3b');
        updateHUD();
        if (state.dentists.length === 0 && state.dentistsSpawned >= cfg.maxDentists) {
          showDentistWinVideo();
        }
      }

      if (o.x + o.w < 0) { state.obstacles.splice(i,1); continue; }
      if (state.invincibleFrames<=0) {
        const obsRect = { x:o.x, y:o.y-o.h, w:o.w, h:o.h };
        if (rectsOverlap(playerRect, obsRect, cfg.jumpForgiveness)) handleHit();
      }
    }

    // Godis
    for (let i=state.candies.length-1;i>=0;i--) {
      const c = state.candies[i];
      c.x -= state.speed;
      const baseAmplitude = state.config.candyBounceAmplitude ? state.config.candyBounceAmplitude() : PR * 0.9;
      const amplitude = state.bonusBounce ? baseAmplitude * 1.6 : baseAmplitude;
      const bounceSpeed = state.config.candyBounceSpeed || 0.055;
      c.y = c.baseY + Math.sin(state.frame * bounceSpeed + c.wobble) * amplitude;
      // Godis har passerat spelaren utan att plockas
      if (!c.missed && c.x + c.w < player.x - PR) {
        c.missed = true;
        state.streak = 0;
        updateHUD();
      }
      if (c.x+c.w<0) { state.candies.splice(i,1); continue; }
      const cr = { x:c.x-c.w/2, y:c.y-c.h/2, w:c.w, h:c.h };
      if (rectsOverlap(playerRect, cr)) { collectCandy(c); state.candies.splice(i,1); }
    }

    // Tandläkare — loopa över alla aktiva tandläkare
    for (let di = state.dentists.length - 1; di >= 0; di--) {
      if (!state.running) return;  // guard: avbryt om vinst/förlust redan triggats
      const d = state.dentists[di];
      d.x -= state.speed;

      if (d.x + d.w < 0) {
        state.dentists.splice(di, 1);
        // Sista tandläkaren scrollade av — spela vinst-video
        if (state.running &&
            state.dentists.length === 0 &&
            state.dentistsSpawned >= cfg.maxDentists) {
          showDentistWinVideo();
        }
        continue;
      }

      // Markera passerad och kolla vinst om ALLA är passerade
      if (!d.passed && player.x > d.x + d.w) {
        d.passed = true;
        const allPassed = state.dentists.every(dt => dt.passed);
        if (allPassed) {
          showDentistWinVideo();
          // return borttagen — guard i loop-toppen hanterar detta nästa iteration
        }
      }

      // Kollision
      if (state.invincibleFrames <= 0) {
        const dentistHitboxW = d.w * 0.5;
        const dentistHitboxH = d.h * 0.75;
        const dentistHitboxX = d.x + d.w * 0.25;
        const dentistHitboxY = d.y + d.h * 0.10;
        const dentistRect = { x: dentistHitboxX, y: dentistHitboxY, w: dentistHitboxW, h: dentistHitboxH };
        if (rectsOverlap(playerRect, dentistRect)) {
          if (state.config.lives === Infinity) {
            // Lätt-läge: studsa tillbaka, ingen game over
            state.invincibleFrames = 60;
            player.vy = JUMP * 0.6;
            player.onGround = false;
          } else {
            capturedByDentist();
            return;
          }
        }
      }
    }

    // Popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) popups.splice(i, 1);
    }

    // Partiklar
    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.3; p.life--;
      if(p.life<=0) particles.splice(i,1);
    }

    // Bakgrundsbyggnader — rulla om
    for (const b of state.buildings) {
      b.x -= state.speed * 0.3;
      if (b.x + b.w < 0) {
        b.x = VW + Math.random()*VW*0.1;
        b.h = VH*(0.25+Math.random()*0.35);
        b.w = VW*(0.12+Math.random()*0.14);
        b.hasTree = Math.random() < 0.6;
      }
    }

    // Poäng per frame
    if (state.frame % 8 === 0) { state.score++; updateHUD(); }
  }

  function collectCandy(c) {
    const vals = {candy:5,lollipop:15,rainbow:25,glitter:20,cake:30,superbag:50};
    const cols = {candy:'#f06292',lollipop:'#ff9800',rainbow:'#e91e63',glitter:'#ffd700',cake:'#f48fb1',superbag:'#ff4081'};
    playCandySound();
    if (!c.fromRain) {
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      const popupY = Math.max(PR * 2, player.y - PR * 3);
      if (state.streak === 3)  spawnPopup('3 i rad! 🔥', player.x, popupY);
      if (state.streak === 5)  spawnPopup('x2 BONUS! 🔥🔥', player.x, popupY);
      if (state.streak === 10) spawnPopup('STREAKMASTER! 🌟', player.x, popupY);
    }

    const baseVal = vals[c.type] || 5;
    const multiplier = state.streak >= 10 ? 3 : state.streak >= 5 ? 2 : state.streak >= 3 ? 1.5 : 1;
    state.score += Math.round(baseVal * multiplier);
    spawnParticles(c.x, c.y, cols[c.type]||'#ff4081');
    updateHUD();
    // Supergodis-påse: godisregn!
    if (c.type === 'superbag') {
      const rainTypes = ['candy','lollipop','rainbow','glitter'];
      for (let i = 0; i < 4; i++) {
        const rainBaseY = GY - PR * (1.5 + Math.random() * 4);
        state.candies.push({
          type: rainTypes[Math.floor(Math.random()*rainTypes.length)],
          x: VW * (0.3 + Math.random() * 0.5),
          baseY: rainBaseY,
          y: rainBaseY,
          w: PR * 0.9, h: PR * 0.9,
          wobble: Math.random() * Math.PI * 2,
          fromRain: true,
        });
      }
      spawnParticles(c.x, c.y - PR, '#ffd700');
    }
  }

  function handleHit() {
    if (state.lives === Infinity) {
      state.invincibleFrames = 40;
      player.vy = JUMP * 0.6;
      player.onGround = false;
      return;
    }
    state.lives--;
    state.invincibleFrames = 60;
    player.vy = JUMP * 0.7;
    player.onGround = false;
    updateHUD();
    if (state.lives <= 0) gameOver();
  }

  function showDentistWinVideo() {
    if (!state.running) return;
    stopBgMusic();
    state.running = false; // stoppa direkt — inga fler träffar möjliga
    state.showingWinVideo = true;
    state.score += 200;
    pauseBtn.classList.remove('show');
    hudEl.style.display = 'none';

    const video = document.createElement('video');
    video.src = '../WOW_Yay!.mp4';
    video.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);height:70vh;width:auto;z-index:30;border-radius:20px;background:transparent;';
    video.muted = false;
    const cleanup = () => {
      if (document.body.contains(video)) document.body.removeChild(video);
      state.showingWinVideo = false;
      showWinCard();
    };
    video.onended = cleanup;
    video.onerror = cleanup;
    video.play().catch(() => { video.muted = true; video.play(); });
    document.body.appendChild(video);
  }

  function showWinCard() {
    gameoverTitle.textContent = '🎉 Du vann!';
    finalScoreEl.textContent = state.score;
    starsEl.textContent = '⭐⭐⭐';
    if (bestStreakEl) bestStreakEl.textContent = `🔥 Bästa streak: ${state.bestStreak}`;
    const hsKey = 'dentist_hs_' + state.difficulty;
    const prev = parseInt(localStorage.getItem(hsKey) || '0', 10);
    if (state.score > prev) {
      localStorage.setItem(hsKey, state.score);
      highscoreTxt.textContent = '🏆 Nytt rekord!';
    } else {
      highscoreTxt.textContent = 'Rekord: ' + prev + ' 🍬';
    }
    playAgainBtn.textContent = 'Start over';
    if (nextLevelBtn) {
      const difficulties = ['medium', 'hard'];
      const currentIdx = difficulties.indexOf(state.difficulty);
      nextLevelBtn.style.display = currentIdx < difficulties.length - 1 ? 'block' : 'none';
    }
    setTimeout(() => gameoverEl.classList.add('show'), 400);
  }

  function capturedByDentist() {
    if (!state.running) return;
    if (winVideoTimer) { clearTimeout(winVideoTimer); winVideoTimer = null; }
    stopBgMusic();
    state.running = false;
    pauseBtn.classList.remove('show');
    hudEl.style.display = 'none';

    // Spela fångst-videon
    const video = document.createElement('video');
    video.src = '../EN_TandlakareFangar.mp4';
    video.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);height:70vh;width:auto;z-index:30;border-radius:20px;background:transparent;';
    video.muted = false;
    video.onended = () => {
      document.body.removeChild(video);
      startBrushing(); // interaktivt tandborstnings-minispel!
    };
    video.play().catch(() => {
      video.muted = true;
      video.play();
    });
    document.body.appendChild(video);
  }

  // ── Tandborstnings-minispel ──────────────────────────────────

  function _brushEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = VW / rect.width, sy = VH / rect.height;
    if (e.touches && e.touches.length > 0)
      return { x: (e.touches[0].clientX - rect.left)*sx, y: (e.touches[0].clientY - rect.top)*sy };
    return { x: (e.clientX - rect.left)*sx, y: (e.clientY - rect.top)*sy };
  }
  function _onBrushDown(e) {
    if (!state.brushing || !brushState || brushState.celebrating) return;
    e.preventDefault();
    const p = _brushEventPos(e);
    brushState.pointerDown = true;
    brushState.px = brushState.prevPx = p.x;
    brushState.py = brushState.prevPy = p.y;
  }
  function _onBrushMove(e) {
    if (!state.brushing || !brushState || !brushState.pointerDown || brushState.celebrating) return;
    e.preventDefault();
    const p = _brushEventPos(e);
    brushState.prevPx = brushState.px; brushState.prevPy = brushState.py;
    brushState.px = p.x; brushState.py = p.y;
  }
  function _onBrushUp() { if (brushState) brushState.pointerDown = false; }

  function startBrushing() {
    const NUM = 4;
    const tw = PR * 1.9, th = PR * 2.8, gap = PR * 0.55;
    const totalW = NUM*tw + (NUM-1)*gap;
    const sx = (VW - totalW) / 2;
    const ty = VH * 0.62;
    const teeth = Array.from({length: NUM}, (_, i) => ({
      x: sx + i*(tw+gap), y: ty - th, w: tw, h: th, dirty: 100, sparkled: false,
    }));
    brushState = {
      teeth, pointerDown: false,
      px: -1, py: -1, prevPx: -1, prevPy: -1,
      celebrating: false, celebrateTimer: 0,
      sparkles: [],
    };
    state.brushing = true;
    document.addEventListener('pointerdown', _onBrushDown, { passive: false });
    document.addEventListener('pointermove', _onBrushMove, { passive: false });
    document.addEventListener('pointerup',   _onBrushUp);
    document.addEventListener('touchstart',  _onBrushDown, { passive: false });
    document.addEventListener('touchmove',   _onBrushMove, { passive: false });
    document.addEventListener('touchend',    _onBrushUp);
  }

  function updateBrushing() {
    if (!brushState) return;
    // Uppdatera befintliga glittringar
    brushState.sparkles = brushState.sparkles.filter(s => {
      s.x += s.vx; s.y += s.vy; s.vy += 0.18; s.life--; return s.life > 0;
    });
    if (brushState.celebrating) {
      brushState.celebrateTimer++;
      if (brushState.celebrateTimer > 100) finishBrushing();
      return;
    }
    if (!brushState.pointerDown) return;
    const dx = brushState.px - brushState.prevPx;
    const dy = brushState.py - brushState.prevPy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    brushState.teeth.forEach(t => {
      const over = brushState.px > t.x - PR*0.4 && brushState.px < t.x+t.w+PR*0.4 &&
                   brushState.py > t.y - PR*0.5 && brushState.py < t.y+t.h+PR*0.5;
      if (!over) return;
      t.dirty = Math.max(0, t.dirty - dist * 0.9 - 0.8);
      if (t.dirty === 0 && !t.sparkled) {
        t.sparkled = true;
        for (let i=0;i<10;i++) brushState.sparkles.push({
          x: t.x+t.w/2+(Math.random()-.5)*t.w,
          y: t.y+t.h*.4,
          vx:(Math.random()-.5)*7, vy:-(Math.random()*4+2),
          life:55, size: PR*(0.1+Math.random()*0.2),
          color:['#fffde7','#fff9c4','#f0f4c3','#ffffff'][Math.floor(Math.random()*4)],
        });
      }
    });
    if (brushState.teeth.every(t => t.dirty===0)) {
      brushState.celebrating = true;
      brushState.celebrateTimer = 0;
      try { tackSound.currentTime = 0; tackSound.play().catch(() => {}); } catch(e) {}
      for (let i=0;i<40;i++) brushState.sparkles.push({
        x: VW/2+(Math.random()-.5)*VW*.8,
        y: VH*.5+(Math.random()-.5)*VH*.5,
        vx:(Math.random()-.5)*9, vy:-(Math.random()*7+2),
        life:90, size:PR*(0.2+Math.random()*.4),
        color:['#ffeb3b','#ff4081','#00e5ff','#69f0ae','#ff6e40','#ff85b3'][Math.floor(Math.random()*6)],
      });
    }
  }

  function drawBrushing() {
    if (!brushState) return;
    // Bakgrund
    const bg = ctx.createLinearGradient(0,0,0,VH);
    bg.addColorStop(0,'#e3f2fd'); bg.addColorStop(1,'#fce4ec');
    ctx.fillStyle = bg; ctx.fillRect(0,0,VW,VH);

    // Rubrik
    ctx.textAlign = 'center';
    if (brushState.celebrating) {
      ctx.fillStyle='#43a047';
      ctx.font=`bold ${Math.round(VH*.06)}px Arial`;
      ctx.fillText('🎉 BRAVOOOO! 🎉', VW/2, VH*.07);
      ctx.font=`${Math.round(VH*.035)}px Arial`;
      ctx.fillStyle='#388e3c';
      ctx.fillText('Supert borstat! 🦷✨', VW/2, VH*.13);
    } else {
      ctx.fillStyle='#e91e63';
      ctx.font=`bold ${Math.round(VH*.055)}px Arial`;
      ctx.fillText('🦷 BRUSH YOUR TEETH!', VW/2, VH*.07);
      ctx.fillStyle='#5d4037';
      ctx.font=`${Math.round(VH*.03)}px Arial`;
      ctx.fillText('Gnugga med fingret fram och tillbaka!', VW/2, VH*.13);
    }

    // Godisbacillen-bild (riktig karaktär)
    const imgH = VH * 0.32;
    const gaper = sprites.gaper;
    if (gaper && gaper.complete && gaper.naturalWidth > 0) {
      const aspect = gaper.naturalWidth / gaper.naturalHeight;
      const imgW = imgH * aspect;
      ctx.drawImage(gaper, VW/2 - imgW/2, VH * 0.16, imgW, imgH);
    }

    // Pil ned mot borst-tänder
    if (!brushState.celebrating) {
      ctx.fillStyle='#e91e63';
      ctx.font=`${Math.round(VH*.045)}px Arial`;
      ctx.fillText('👇', VW/2, VH*.48);
    }

    // Borst-tänder (triangulära som Godisbacillens egna tänder)
    // Varannan tand lite bredare/smalare för ojämn karaktärslik känsla
    const toothShapes = brushState.teeth.length === 4
      ? [0.5, 0.42, 0.58, 0.45]
      : [0.5, 0.42, 0.58, 0.45, 0.55, 0.5]; // botten-punkt X-offset per tand
    brushState.teeth.forEach((t, idx) => {
      const tipX = t.x + t.w * toothShapes[idx]; // spetsens X-position
      // Hjälpfunktion: rita tandform
      function toothPath() {
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + t.w, t.y);
        ctx.lineTo(tipX, t.y + t.h);
        ctx.closePath();
      }
      // Vit tand
      ctx.fillStyle = '#ffffff';
      toothPath(); ctx.fill();
      ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 1.5;
      toothPath(); ctx.stroke();
      // Smuts-overlay (klippt till tandformen)
      if (t.dirty > 0) {
        ctx.save();
        toothPath(); ctx.clip();
        ctx.fillStyle = `rgba(160,100,20,${(t.dirty/100)*0.78})`;
        ctx.fillRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
        ctx.restore();
      }
      // Glans-stjärna när ren
      if (t.dirty === 0) {
        ctx.fillStyle = 'rgba(255,253,200,0.9)';
        ctx.beginPath();
        ctx.arc(tipX - t.w*0.12, t.y + t.h*0.18, t.w*0.14, 0, Math.PI*2);
        ctx.fill();
      }
    });

    // Glitterpartiklar
    brushState.sparkles.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life/65);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.size||PR*.15,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;

    // Tandborste-cursor om finger är nere
    if (brushState.pointerDown && brushState.px>=0) {
      const bw=PR*.7, bh=PR*2.8;
      ctx.fillStyle='#80d8ff';
      ctx.beginPath(); ctx.roundRect(brushState.px-bw/2, brushState.py-bh, bw, bh, bw/2); ctx.fill();
      ctx.fillStyle='white';
      for (let i=0;i<4;i++) {
        ctx.beginPath();
        ctx.arc(brushState.px-bw*.3+i*(bw*.2), brushState.py-bh+PR*.35, PR*.12, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Progressbar
    const cleanN = brushState.teeth.filter(t=>t.dirty===0).length;
    const prog = cleanN/brushState.teeth.length;
    const bW=VW*.72, bH=VH*.03, bX=(VW-bW)/2, bY=VH*.86;
    ctx.fillStyle='#e0e0e0'; ctx.beginPath(); ctx.roundRect(bX,bY,bW,bH,bH/2); ctx.fill();
    if (prog>0) {
      ctx.fillStyle='#43a047'; ctx.beginPath(); ctx.roundRect(bX,bY,bW*prog,bH,bH/2); ctx.fill();
    }
    ctx.fillStyle='#5d4037'; ctx.font=`bold ${Math.round(VH*.026)}px Arial`;
    ctx.fillText(`🦷 ${cleanN}/${brushState.teeth.length} borstad`, VW/2, bY-VH*.01);
  }

  function finishBrushing() {
    document.removeEventListener('pointerdown', _onBrushDown);
    document.removeEventListener('pointermove', _onBrushMove);
    document.removeEventListener('pointerup',   _onBrushUp);
    document.removeEventListener('touchstart',  _onBrushDown);
    document.removeEventListener('touchmove',   _onBrushMove);
    document.removeEventListener('touchend',    _onBrushUp);
    state.brushing = false;
    brushState = null;

    state.lives--;
    updateHUD();

    if (state.lives <= 0) {
      // Game over
      const [s1,s2,s3] = state.config.starThresholds;
      const stars = state.score>=s3?3:state.score>=s2?2:state.score>=s1?1:0;
      starsEl.textContent = '⭐'.repeat(stars)+'☆'.repeat(3-stars);
      if (bestStreakEl) bestStreakEl.textContent = `🔥 Bästa streak: ${state.bestStreak}`;
      finalScoreEl.textContent = state.score;
      const hsKey = 'dentist_hs_'+state.difficulty;
      const prev = parseInt(localStorage.getItem(hsKey)||'0',10);
      if (state.score>prev) {
        localStorage.setItem(hsKey, state.score);
        highscoreTxt.textContent = '🏆 Nytt rekord!';
        gameoverTitle.textContent = '🎉 Fantastiskt!';
      } else {
        highscoreTxt.textContent = 'Rekord: '+prev+' 🍬';
        gameoverTitle.textContent = state.difficulty === 'easy' ? '🌟 Keep going!' : '😅 Good try!';
      }
      playAgainBtn.textContent = '▶ TRY AGAIN';
      if (nextLevelBtn) nextLevelBtn.style.display = 'none';
      setTimeout(() => gameoverEl.classList.add('show'), 200);
    } else {
      // Fortsätt spelet! Rensa tandläkare + ge oskadbarhet
      state.dentists = [];
      state.nextDentistIn = 2500;
      state.invincibleFrames = 180;
      player.y = GY; player.vy = 0; player.onGround = true;
      state.running = true;
      pauseBtn.classList.add('show');
      hudEl.style.display = 'flex';
      startBgMusic();
    }
  }

  // ────────────────────────────────────────────────────────────

  function win() {
    if (!state.running) return;
    stopBgMusic();
    state.running = false;
    pauseBtn.classList.remove('show');
    hudEl.style.display = 'none';
    showWinCard();
  }

  function gameOver() {
    if (!state.running) return;
    if (winVideoTimer) { clearTimeout(winVideoTimer); winVideoTimer = null; }
    stopBgMusic();
    state.running = false;
    pauseBtn.classList.remove('show');
    hudEl.style.display = 'none';
    const [s1,s2,s3] = state.config.starThresholds;
    let stars = state.score>=s3?3:state.score>=s2?2:state.score>=s1?1:0;
    starsEl.textContent = '⭐'.repeat(stars)+'☆'.repeat(3-stars);
    if (bestStreakEl) bestStreakEl.textContent = `🔥 Bästa streak: ${state.bestStreak}`;
    finalScoreEl.textContent = state.score;
    const hsKey = 'dentist_hs_'+state.difficulty;
    const prev = parseInt(localStorage.getItem(hsKey)||'0',10);
    if (state.score>prev) {
      localStorage.setItem(hsKey, state.score);
      highscoreTxt.textContent = '🏆 Nytt rekord!';
      gameoverTitle.textContent = '🎉 Fantastiskt!';
    } else {
      highscoreTxt.textContent = 'Rekord: '+prev+' 🍬';
      if (state.difficulty === 'easy') {
        gameoverTitle.textContent = '🌟 Bra jobbat!';
      } else {
        gameoverTitle.textContent = stars===3?'🌟 Awesome!':stars===0?'😊 Try again!':'🎉 Great job!';
      }
    }
    setTimeout(()=>gameoverEl.classList.add('show'),400);
  }

  // ══════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════

  function drawClouds() {
    const cloudData = [
      { baseX: VW*0.1, y: GY*0.2, size: 1 },
      { baseX: VW*0.35, y: GY*0.3, size: 0.8 },
      { baseX: VW*0.6, y: GY*0.25, size: 1.2 },
      { baseX: VW*0.85, y: GY*0.35, size: 0.9 },
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    cloudData.forEach(cloud => {
      const x = (cloud.baseX - state.bgScroll*0.4) % (VW + 200) - 100;
      const y = cloud.y;
      const s = cloud.size;
      // Molnformad figur (3 cirklar)
      ctx.beginPath();
      ctx.arc(x, y, VH*0.05*s, 0, Math.PI*2);
      ctx.arc(x + VH*0.07*s, y, VH*0.06*s, 0, Math.PI*2);
      ctx.arc(x + VH*0.14*s, y, VH*0.05*s, 0, Math.PI*2);
      ctx.fill();
    });
  }

  function drawBird() {
    const birdX = ((state.fgScroll * 0.3) % (VW + 100)) - 50;
    const birdY = GY * 0.18;
    const s = VH * 0.025;

    // Kropp
    ctx.fillStyle = '#e84393';
    ctx.beginPath();
    ctx.ellipse(birdX, birdY, s*1.4, s*0.9, 0, 0, Math.PI*2);
    ctx.fill();

    // Huvud
    ctx.beginPath();
    ctx.arc(birdX + s*1.3, birdY - s*0.3, s*0.75, 0, Math.PI*2);
    ctx.fill();

    // Näbb
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.moveTo(birdX + s*2.0, birdY - s*0.25);
    ctx.lineTo(birdX + s*2.7, birdY - s*0.1);
    ctx.lineTo(birdX + s*2.0, birdY + s*0.05);
    ctx.closePath();
    ctx.fill();

    // Öga
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(birdX + s*1.55, birdY - s*0.5, s*0.28, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(birdX + s*1.62, birdY - s*0.54, s*0.13, 0, Math.PI*2);
    ctx.fill();

    // Vinge (böjd kurva — tydlig W-form)
    ctx.strokeStyle = '#c0006a';
    ctx.lineWidth = Math.max(2, s*0.3);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(birdX - s*1.4, birdY - s*0.3);
    ctx.quadraticCurveTo(birdX - s*0.5, birdY + s*0.6, birdX, birdY);
    ctx.quadraticCurveTo(birdX + s*0.5, birdY + s*0.6, birdX + s*0.8, birdY - s*0.2);
    ctx.stroke();

    // Svans
    ctx.fillStyle = '#e84393';
    ctx.beginPath();
    ctx.moveTo(birdX - s*1.2, birdY);
    ctx.lineTo(birdX - s*2.0, birdY - s*0.5);
    ctx.lineTo(birdX - s*1.8, birdY + s*0.3);
    ctx.lineTo(birdX - s*2.2, birdY + s*0.5);
    ctx.lineTo(birdX - s*1.4, birdY + s*0.4);
    ctx.closePath();
    ctx.fill();
  }

  function drawTree(x, y) {
    const treeH = VH * 0.15;
    const trunkW = VW * 0.015;
    const trunkH = treeH * 0.55;
    const crownR = treeH * 0.35;

    // Stamme först (bakom löven)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - trunkW/2, y - trunkH, trunkW, trunkH);

    // Löv (täcker stammen)
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x, y - trunkH - crownR*0.2, crownR, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - crownR*0.6, y - trunkH - crownR*0.6, crownR*0.9, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + crownR*0.6, y - trunkH - crownR*0.6, crownR*0.9, 0, Math.PI*2);
    ctx.fill();
  }

  function drawBackground() {
    // Himmel
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GY);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(1, '#e0f6ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VW, GY);

    drawClouds();
    drawBird();

    // Träd (ersätter höghus)
    for (const b of state.buildings) {
      const treeH = b.h;
      const trunkW = b.w * 0.18;
      const trunkH = treeH * 0.45;
      const crownR = treeH * 0.42;
      const cx = b.x + b.w / 2;

      let leafColor1, leafColor2, trunkColor;
      if (b.color === 'pine') {
        leafColor1 = '#1a6b1a'; leafColor2 = '#145214'; trunkColor = '#6b3a1f';
      } else if (b.color === 'cherry') {
        leafColor1 = '#ff85b3'; leafColor2 = '#e8427a'; trunkColor = '#7a3b1e';
      } else {
        leafColor1 = '#2d8a2d'; leafColor2 = '#1c6e1c'; trunkColor = '#8B4513';
      }

      // Stam
      ctx.fillStyle = trunkColor;
      ctx.fillRect(cx - trunkW / 2, GY - trunkH, trunkW, trunkH);

      // Lövverk
      ctx.fillStyle = leafColor1;
      ctx.beginPath();
      ctx.arc(cx, GY - trunkH - crownR * 0.5, crownR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - crownR * 0.65, GY - trunkH - crownR * 0.2, crownR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + crownR * 0.65, GY - trunkH - crownR * 0.2, crownR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Blommor vid trädets fot (stabilt slot-index = trädets index i arrayen)
      drawFlowers(b.x, GY, state.buildings.indexOf(b));
    }

    // Gräsmatta
    ctx.fillStyle = '#5aad3a';
    ctx.fillRect(0, GY, VW, VH - GY);
    ctx.fillStyle = '#6ecf48';
    ctx.fillRect(0, GY, VW, VH * 0.012);

    // Blommor längs marken (slot = i → stabil färg per plats, oberoende av scroll)
    const flowerSpacing = VW * 0.12;
    for (let i = 0; i < Math.ceil(VW / flowerSpacing) + 2; i++) {
      const fx = ((i * flowerSpacing - state.fgScroll * 0.4) % (VW + flowerSpacing)) - flowerSpacing;
      drawFlowers(fx, GY, i);
    }
  }

  function drawPlayer() {
    if (state.invincibleFrames>0 && Math.floor(state.invincibleFrames/4)%2===0) return;

    const cx = player.x;
    const cy = player.y - PR;

    // Skugga
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, GY+VH*0.008, PR*0.9, VH*0.008, 0, 0, Math.PI*2);
    ctx.fill();

    // Välj rätt sprite
    let sprite;
    if (!player.onGround) {
      sprite = sprites.jump;
    } else {
      sprite = (Math.floor(state.frame / 12) % 2 === 0) ? sprites.run1 : sprites.run2;
    }

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      // Bevara aspect ratio (inte distorted)
      const targetH = PR * 3.5;
      const aspect = sprite.naturalWidth / sprite.naturalHeight;
      const targetW = targetH * aspect;
      const sx = cx - targetW/2;
      const sy = player.y - targetH; // fötter på marken
      ctx.drawImage(sprite, sx, sy, targetW, targetH);
    } else {
      // Fallback om bilden inte är laddad
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.arc(cx, cy, PR, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawObstacle(o) {
    const bx=o.x, by=o.y-o.h, bw=o.w, bh=o.h;

    // Skugga
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(bx+bw/2, GY+VH*0.006, bw*0.4, VH*0.006, 0, 0, Math.PI*2);
    ctx.fill();

    // Rita sprite om den finns, annars fallback till canvas
    let sprite = null;
    if (o.type === 'toothbrush') sprite = sprites.toothbrush;
    else if (o.type === 'tooth') sprite = sprites.tooth;

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, bx, by, bw, bh);
    } else {
      // Fallback canvas-rita
      if (o.type==='toothbrush') {
        // Handtag
        ctx.fillStyle='#1e88e5';
        ctx.beginPath();
        ctx.roundRect(bx, by+bh*0.2, bw*0.65, bh*0.6, 4);
        ctx.fill();
        // Borsthuvud
        ctx.fillStyle='#f5f5f5';
        ctx.beginPath();
        ctx.roundRect(bx+bw*0.58, by, bw*0.42, bh, 3);
        ctx.fill();
        ctx.strokeStyle='#bdbdbd';
        ctx.lineWidth=1.5;
        ctx.stroke();
        // Borst
        ctx.fillStyle='#81d4fa';
        for (let i=0;i<5;i++) {
          ctx.fillRect(bx+bw*0.61+i*(bw*0.07), by, bw*0.05, bh*0.4);
        }
      }
      else if (o.type==='tooth') {
        ctx.fillStyle='#fafafa';
        ctx.strokeStyle='#e0e0e0';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(bx+bw*0.5, by);
        ctx.quadraticCurveTo(bx+bw*1.1, by+bh*0.3, bx+bw*0.8, by+bh);
        ctx.lineTo(bx+bw*0.2, by+bh);
        ctx.quadraticCurveTo(bx-bw*0.1, by+bh*0.3, bx+bw*0.5, by);
        ctx.fill(); ctx.stroke();
        // Arga ögon
        ctx.fillStyle='#e53935';
        ctx.fillRect(bx+bw*0.2, by+bh*0.3, bw*0.15, bh*0.12);
        ctx.fillRect(bx+bw*0.6, by+bh*0.3, bw*0.15, bh*0.12);
      }
      else if (o.type==='toothpaste') {
        // Tub
        ctx.fillStyle='#e91e63';
        ctx.beginPath();
        ctx.roundRect(bx+bw*0.15, by, bw*0.85, bh, 4);
        ctx.fill();
        // Lock
        ctx.fillStyle='#fff';
        ctx.beginPath();
        ctx.roundRect(bx, by+bh*0.15, bw*0.2, bh*0.7, 3);
        ctx.fill();
        // Tandkräm-bubbla
        ctx.fillStyle='#4fc3f7';
        ctx.beginPath();
        ctx.arc(bx+bw*0.05, by+bh*0.5, bh*0.4, 0, Math.PI*2);
        ctx.fill();
        // Text-dekor
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.fillRect(bx+bw*0.3, by+bh*0.3, bw*0.5, bh*0.15);
        ctx.fillRect(bx+bw*0.3, by+bh*0.55, bw*0.35, bh*0.15);
      }
      else { // floss
        ctx.fillStyle='#f8bbd0';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh/2);
        ctx.fill();
        ctx.strokeStyle='#e91e63';
        ctx.lineWidth=1.5;
        ctx.stroke();
      }
    }
  }

  function drawCandy(c) {
    const cx=c.x, cy=c.y, r=c.w/2;

    if (c.type==='candy') {
      ctx.fillStyle='#f06292';
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(cx-r*0.3,cy-r*0.3,r*0.35,0,Math.PI*2); ctx.fill();
    }
    else if (c.type==='lollipop') {
      ctx.fillStyle='#8d6e63'; ctx.fillRect(cx-1,cy+r,2,r*1.5);
      ctx.fillStyle='#ff9800';
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy,r*0.65,0,Math.PI*2); ctx.stroke();
    }
    else if (c.type==='rainbow') {
      ['#f44336','#ff9800','#ffeb3b','#4caf50','#2196f3','#9c27b0'].forEach((col,i)=>{
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.arc(cx,cy,r-i*r*0.13,0,Math.PI*2); ctx.fill();
      });
    }
    else if (c.type==='glitter') {
      ctx.fillStyle='#ffd700';
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#fff59d'; ctx.lineWidth=2;
      for (let i=0;i<8;i++) {
        const a=state.frame*0.05+i*Math.PI/4;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(a)*(r+2),cy+Math.sin(a)*(r+2));
        ctx.lineTo(cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8));
        ctx.stroke();
      }
    }
    else if (c.type==='cake') {
      ctx.fillStyle='#a1887f';
      ctx.fillRect(cx-r,cy+r*0.1,r*2,r);
      ctx.fillStyle='#f48fb1';
      ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,0); ctx.fill();
      ctx.fillStyle='#e91e63';
      ctx.beginPath(); ctx.arc(cx,cy-r*0.7,r*0.2,0,Math.PI*2); ctx.fill();
    }
    else { // superbag — glittrande godispåse
      // Påskropp
      ctx.fillStyle='#ff4081';
      ctx.beginPath(); ctx.roundRect(cx-r*0.85,cy-r*0.3,r*1.7,r*1.4,r*0.35); ctx.fill();
      // Glans
      ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(cx-r*0.25,cy+r*0.1,r*0.4,r*0.25,-.4,0,Math.PI*2); ctx.fill();
      // Knut/knipsa överst
      ctx.fillStyle='#c2185b';
      ctx.beginPath(); ctx.arc(cx,cy-r*0.45,r*0.38,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#880e4f'; ctx.lineWidth=Math.max(1,r*0.1);
      ctx.beginPath(); ctx.arc(cx,cy-r*0.45,r*0.38,0,Math.PI*2); ctx.stroke();
      // Stjärna i mitten
      const puls = 0.85+Math.sin(state.frame*0.15+c.wobble)*0.15;
      ctx.fillStyle=`rgba(255,235,59,${puls})`;
      ctx.font=`bold ${Math.round(r*1.1)}px Arial`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⭐',cx,cy+r*0.5);
      ctx.textBaseline='alphabetic';
    }
  }

  function drawParticles() {
    particles.forEach(p=>{
      ctx.globalAlpha=p.life/40;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;
  }

  function drawPopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      if (p.life <= 0) continue;  // redan borttagna av update(), men guard för säkerhets skull
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#e91e63';
      ctx.lineWidth = 3;
      ctx.font = `bold ${Math.round(VH * 0.04)}px Arial`;
      ctx.textAlign = 'center';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawDentist() {
    if (!state.dentists.length) return;

    // Varningssignal — visa för första opasserade tandläkaren
    const unpassedFirst = state.dentists.find(dt => !dt.passed);
    if (unpassedFirst) {
      const pulse = Math.abs(Math.sin(state.frame * 0.15));
      ctx.globalAlpha = 0.4 + pulse * 0.6;
      const iconSize = VH * 0.1;
      if (sprites.dentist && sprites.dentist.complete && sprites.dentist.naturalWidth > 0) {
        const aspect = sprites.dentist.naturalWidth / sprites.dentist.naturalHeight;
        const iconW = iconSize * aspect;
        ctx.drawImage(sprites.dentist, VW - iconW - 16, VH * 0.26, iconW, iconSize);
      }
      ctx.globalAlpha = 1;
    }

    for (const d of state.dentists) {
    // Skugga
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(d.x + d.w/2, GY+VH*0.008, d.w*0.4, VH*0.008, 0, 0, Math.PI*2);
    ctx.fill();

    // Rita sprite om den finns
    if (sprites.dentist && sprites.dentist.complete && sprites.dentist.naturalWidth > 0) {
      ctx.drawImage(sprites.dentist, d.x, d.y, d.w, d.h);
    } else {
      // Fallback canvas-rita
      const dx = d.x + d.w/2;
      const dy = d.y - d.h/2;

      // Tandläkarens kropp (ljusblå coat)
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(dx - d.w*0.3, dy, d.w*0.6, d.h*0.6);

      // Huvud (rund)
      ctx.fillStyle = '#fdbcb4';
      ctx.beginPath();
      ctx.arc(dx, dy - d.h*0.15, d.w*0.25, 0, Math.PI*2);
      ctx.fill();

      // Mun (ilsken linje)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = Math.max(2, d.w*0.06);
      ctx.beginPath();
      ctx.moveTo(dx - d.w*0.15, dy - d.h*0.25);
      ctx.lineTo(dx + d.w*0.15, dy - d.h*0.25);
      ctx.stroke();

      // Ögon (ilskna)
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(dx - d.w*0.12, dy - d.h*0.18, d.w*0.08, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dx + d.w*0.12, dy - d.h*0.18, d.w*0.08, 0, Math.PI*2);
      ctx.fill();

      // Tandläkar-spegeln (cirkel)
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(dx - d.w*0.35, dy - d.h*0.2, d.w*0.15, 0, Math.PI*2);
      ctx.fill();

      // Text: "TANDLÄKARE"
      ctx.fillStyle = '#333';
      ctx.font = `bold ${Math.round(d.w*0.08)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('DENTIST', dx, dy + d.h*0.45);
    }
    } // end for (const d of state.dentists)
  }

  // ── Render-loop ──
  function draw() {
    if (state.brushing) { drawBrushing(); return; }
    ctx.clearRect(0,0,VW,VH);
    drawBackground();
    state.obstacles.forEach(drawObstacle);
    state.candies.forEach(drawCandy);
    if (state.dentists.length) drawDentist();
    drawParticles();
    drawPopups();
    drawPlayer();

    if (state.paused) {
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(0,0,VW,VH);
      ctx.fillStyle='white';
      ctx.font=`bold ${Math.round(VH*0.06)}px Arial`;
      ctx.textAlign='center';
      ctx.fillText('⏸ PAUSAD', VW/2, VH/2);
      ctx.font=`${Math.round(VH*0.03)}px Arial`;
      ctx.fillText('Press ▶ to continue', VW/2, VH/2+VH*0.06);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();
})();
