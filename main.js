// Sky Dash - version améliorée (visuel + gameplay + tactile)
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  let best = +(localStorage.getItem('best')||0);
  bestEl.textContent = 'Best: ' + best;

  // --- Palette de couleurs ---
  const COLORS = {
    bgTop:    '#0b1023',
    bgBottom: '#261447',
    star:     'rgba(255,255,255,0.9)',
    ship:     '#00d4ff',
    thruster: '#ff8e00',
    obstacle: 'rgba(91,61,240,0.85)',
    pickup:   '#ffd166',
    pickupGlow: 'rgba(255,209,102,0.15)'
  };

  // Game state
  const state = {
    running: true,
    t: 0,
    speed: 2.2,
    stars: [],
    obstacles: [],
    pickups: [],
    score: 0
  };

  // Player
  const player = {
    x: W/2, y: H*0.78, r: 18, vx: 0
  };

  // Lanes & "porte" (trou)
  const LANES = 5;
  const laneWidth = W / LANES;
  const laneCenter = (i) => i * laneWidth + laneWidth / 2;
  let gapLane = 2;
  let gapDir = 1;
  const GAP_WIDTH = 1;

  // Timers
  let starTimer = 0;
  let waveTimer = 0;
  let pickupEvery = 4;
  let waveCount = 0;

  function reset() {
    state.t = 0; state.speed = 2.2; state.stars = []; state.obstacles = []; state.pickups = []; state.score = 0;
    player.x = W/2; player.vx = 0;
    gapLane = 2; gapDir = 1; waveTimer = 0; waveCount = 0;
    state.running = true;
  }

  // --- Contrôles : tactile/souris (glisser) + R pour reset sur PC ---
  let touchTargetX = null;
  function toCanvasX(clientX){
    const rect = canvas.getBoundingClientRect();
    const ratio = W / rect.width;
    return (clientX - rect.left) * ratio;
  }
  canvas.addEventListener('touchstart', (e) => {
    touchTargetX = toCanvasX(e.touches[0].clientX);
  }, {passive:true});
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    touchTargetX = toCanvasX(e.touches[0].clientX);
  }, {passive:false});
  canvas.addEventListener('touchend', () => { touchTargetX = null; });

  canvas.addEventListener('mousedown', (e) => { touchTargetX = toCanvasX(e.clientX); });
  canvas.addEventListener('mousemove', (e) => { if (touchTargetX !== null) touchTargetX = toCanvasX(e.clientX); });
  canvas.addEventListener('mouseup',   () => { touchTargetX = null; });

  window.addEventListener('keydown', (e)=>{
    if (e.key === 'r' && !state.running) reset();
  });

  // Helpers
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function circle(x,y,r,c){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=c; ctx.fill(); }
  function rect(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }

  function spawnStar(){
    state.stars.push({x: rand(0,W), y: -10, vy: rand(0.5,1.5)});
  }

  function spawnWave(){
    const y = -24;
    for (let i = 0; i < LANES; i++){
      if (i >= gapLane && i < gapLane + GAP_WIDTH) continue; // trou
      const x = i * laneWidth + 6;
      state.obstacles.push({ x, y, w: laneWidth - 12, h: 18, vy: state.speed });
    }
    if (waveCount % pickupEvery === 0){
      const px = laneCenter(Math.min(gapLane, LANES-1));
      state.pickups.push({ x: px, y: y - 22, r: 10, vy: state.speed * 0.95 });
    }

    if (gapLane <= 0) gapDir = 1;
    else if (gapLane >= LANES - GAP_WIDTH) gapDir = -1;
    if (Math.random() < 0.17) gapDir *= -1; // petite variation
    gapLane += gapDir;
    gapLane = Math.max(0, Math.min(LANES - GAP_WIDTH, gapLane));

    waveCount++;
  }

  function update(dt){
    state.t += dt;

    // Accélération progressive
    const baseSpeed = 2.2;
    const accelPerMs = 0.0009;
    state.speed = baseSpeed + state.t * accelPerMs;

    // Étoiles d'arrière-plan
    starTimer += dt;
    if (starTimer > 80){ spawnStar(); starTimer = 0; }
    state.stars.forEach(s => s.y += s.vy*dt*0.06);
    state.stars = state.stars.filter(s => s.y < H+10);

    // Génération des vagues (cadence dépend de la vitesse)
    waveTimer += dt;
    const targetInterval = Math.max(380 - state.speed * 40, 180);
    if (waveTimer >= targetInterval){
      spawnWave();
      waveTimer = 0;
    }

    // Déplacement obstacles/pickups
    state.obstacles.forEach(o => o.y += o.vy);
    state.obstacles = state.obstacles.filter(o => o.y < H+40);
    state.pickups.forEach(p => p.y += p.vy);
    state.pickups = state.pickups.filter(p => p.y < H+20);

    // Contrôle du joueur (lerp vers la position du doigt/curseur)
    if (touchTargetX !== null) {
      const lerp = 0.15;
      player.x += (touchTargetX - player.x) * lerp;
    } else {
      player.vx *= 0.90;
      player.x += player.vx;
    }
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));

    // Collisions: obstacles (rectangles)
    for (const o of state.obstacles){
      const nearestX = Math.max(o.x, Math.min(player.x, o.x + o.w));
      const nearestY = Math.max(o.y, Math.min(player.y, o.y + o.h));
      const dx = player.x - nearestX, dy = player.y - nearestY;
      if (dx*dx + dy*dy < player.r*player.r){
        state.running = false;
      }
    }
    // Pickups
    for (let i = state.pickups.length-1; i>=0; --i){
      const p = state.pickups[i];
      const dx = player.x - p.x, dy = player.y - p.y;
      if (dx*dx + dy*dy < (player.r + p.r)*(player.r + p.r)){
        state.pickups.splice(i,1);
        state.score += 10;
      }
    }

    // Score
    state.score += dt*0.01;
  }

  function draw(){
    // background dégradé
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // étoiles
    ctx.fillStyle = COLORS.star;
    state.stars.forEach(s => { ctx.fillRect(s.x, s.y, 2, 2); });

    // vaisseau
    rect(player.x-2, player.y+player.r-6, 4, 14, COLORS.thruster); // flamme
    ctx.beginPath();
    ctx.moveTo(player.x, player.y-player.r);
    ctx.lineTo(player.x+player.r*0.9, player.y+player.r);
    ctx.lineTo(player.x-player.r*0.9, player.y+player.r);
    ctx.closePath();
    ctx.fillStyle = COLORS.ship;
    ctx.fill();

    // obstacles
    state.obstacles.forEach(o => rect(o.x, o.y, o.w, o.h, COLORS.obstacle));

    // pickups (glow)
    state.pickups.forEach(p => {
      circle(p.x, p.y, p.r*2.2, COLORS.pickupGlow);
      circle(p.x, p.y, p.r, COLORS.pickup);
    });

    // UI
    scoreEl.textContent = 'Score: ' + Math.floor(state.score);
    if (!state.running){
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      rect(0,0,W,H,'rgba(0,0,0,0.6)');
      ctx.fillStyle = 'white';
      ctx.font = '28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', W/2, H/2 - 30);
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Touchez pour rejouer', W/2, H/2 + 6);
    }
  }

  let last = 0;
  function loop(ts){
    const dt = Math.min(32, ts - last || 16);
    last = ts;
    if (state.running) update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Restart on tap when dead
  canvas.addEventListener('touchstart', () => {
    if (!state.running){
      best = Math.max(best, Math.floor(state.score));
      localStorage.setItem('best', best);
      bestEl.textContent = 'Best: ' + best;
      reset();
    }
  }, {passive:true});
  canvas.addEventListener('mousedown', () => {
    if (!state.running){
      best = Math.max(best, Math.floor(state.score));
      localStorage.setItem('best', best);
      bestEl.textContent = 'Best: ' + best;
      reset();
    }
  });

})();