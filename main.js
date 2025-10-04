// Sky Dash - simple offline canvas runner
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  let best = +(localStorage.getItem('best')||0);
  bestEl.textContent = 'Best: ' + best;

  // Game state
  const state = {
    running: true,
    t: 0,
    speed: 3,
    stars: [],
    obstacles: [],
    pickups: [],
    score: 0
  };

  // Player
  const player = {
    x: W/2, y: H*0.78, r: 18, vx: 0
  };

  function reset() {
    state.t = 0; state.speed = 3; state.stars = []; state.obstacles = []; state.pickups = []; state.score = 0;
    player.x = W/2; player.vx = 0;
    state.running = true;
  }

  // Controls
  let leftHeld = false, rightHeld = false;
  function bindBtn(id, flag){
    const el = document.getElementById(id);
    const on = () => { if (id==='left') leftHeld = true; else rightHeld = true; };
    const off = () => { if (id==='left') leftHeld = false; else rightHeld = false; };
    el.addEventListener('touchstart', (e)=>{ e.preventDefault(); on(); }, {passive:false});
    el.addEventListener('touchend', (e)=>{ e.preventDefault(); off(); }, {passive:false});
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindBtn('left'); bindBtn('right');
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowLeft') leftHeld = true;
    if (e.key === 'ArrowRight') rightHeld = true;
    if (e.key === 'r') reset();
  });
  window.addEventListener('keyup', (e)=>{
    if (e.key === 'ArrowLeft') leftHeld = false;
    if (e.key === 'ArrowRight') rightHeld = false;
  });

  // Helpers
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function circle(x,y,r,c){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=c; ctx.fill(); }
  function rect(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }

  function spawnStar(){
    state.stars.push({x: rand(0,W), y: -10, vy: rand(0.5,1.5)});
  }
  function spawnObstacle(){
    const w = rand(40, 110);
    const x = rand(0, W-w);
    state.obstacles.push({x, y:-30, w, h: rand(14,24), vy: state.speed});
  }
  function spawnPickup(){
    state.pickups.push({x: rand(20,W-20), y:-20, r: 10, vy: state.speed*0.9});
  }

  let starTimer = 0, obsTimer = 0, pickTimer = 0;

  function update(dt){
    state.t += dt;

    // Difficulty ramp
    state.speed += dt*0.0015;

    // Spawn background stars
    starTimer += dt;
    if (starTimer > 80){ spawnStar(); starTimer = 0; }

    // Spawn obstacles
    obsTimer += dt;
    if (obsTimer > Math.max(400 - state.speed*35, 140)){
      spawnObstacle(); obsTimer = 0;
    }

    // Spawn pickups (points)
    pickTimer += dt;
    if (pickTimer > 1200){ spawnPickup(); pickTimer = 0; }

    // Move stars
    state.stars.forEach(s => s.y += s.vy*dt*0.06);
    state.stars = state.stars.filter(s => s.y < H+10);

    // Move obstacles
    state.obstacles.forEach(o => o.y += o.vy);
    state.obstacles = state.obstacles.filter(o => o.y < H+40);

    // Move pickups
    state.pickups.forEach(p => p.y += p.vy);
    state.pickups = state.pickups.filter(p => p.y < H+20);

    // Player control
    const accel = 0.7;
    if (leftHeld && !rightHeld) player.vx -= accel;
    if (rightHeld && !leftHeld) player.vx += accel;
    if (!leftHeld && !rightHeld) player.vx *= 0.88;
    player.vx = Math.max(-6.5, Math.min(6.5, player.vx));
    player.x += player.vx;
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));

    // Collisions
    // Obstacles: rectangles
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

    // Score increments with survival
    state.score += dt*0.01;
  }

  function draw(){
    // background
    rect(0,0,W,H,'#0d1321');
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    state.stars.forEach(s => { ctx.fillRect(s.x, s.y, 2, 2); });
    // player ship
    rect(player.x-2, player.y+player.r-6, 4, 14, '#ff9500'); // flame
    ctx.beginPath();
    ctx.moveTo(player.x, player.y-player.r);
    ctx.lineTo(player.x+player.r*0.9, player.y+player.r);
    ctx.lineTo(player.x-player.r*0.9, player.y+player.r);
    ctx.closePath();
    ctx.fillStyle = '#2a6f97';
    ctx.fill();
    // obstacles
    state.obstacles.forEach(o => rect(o.x, o.y, o.w, o.h, '#23395d'));
    // pickups
    state.pickups.forEach(p => circle(p.x, p.y, p.r, '#e9d8a6'));

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