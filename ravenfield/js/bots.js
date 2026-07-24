import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, damp, smooth, D2R } from './utils.js';
import { terrainHeight, collideCircle, supportHeight, raycastWorld, nearestSolid,
         spawnPosition, controlPoints, TEAM_COLORS } from './world.js';
import { findPath } from './paths.js';
import { player, damagePlayer } from './player.js';
import { spawnTracer, spawnPuff } from './effects.js';

export const bots = [];
export const botHitboxes = [];
export const killEvents = [];

const STATE = { ATTACK:0, ENGAGE:1, RETREAT:2, DEAD:3 };
const RADIUS = 0.4, HEIGHT = 1.75, STEP = 0.5;
let scene = null;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(),
      _v4 = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3(),
      _right = new THREE.Vector3(), worldUp = new THREE.Vector3(0,1,0);

/* ================= soldier visual ================= */
function makeSoldier(team){
  const g = new THREE.Group();
  const matU = new THREE.MeshLambertMaterial({ color: TEAM_COLORS[team], flatShading:true });
  const matD = new THREE.MeshLambertMaterial({
    color: new THREE.Color(TEAM_COLORS[team]).multiplyScalar(0.6), flatShading:true });
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xe8b58e, flatShading:true });
  const matGun  = new THREE.MeshLambertMaterial({ color: 0x26262b, flatShading:true });
  const matBoot = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  const B = (w,h,d,mat,x,y,z,parent=g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); parent.add(m); return m; };
  B(0.44,0.22,0.26, matD, 0, 0.86, 0);
  B(0.52,0.60,0.30, matU, 0, 1.24, 0);
  B(0.27,0.27,0.27, matSkin, 0, 1.66, 0);
  B(0.31,0.13,0.33, matU, 0, 1.78, -0.01);
  const aL = B(0.13,0.45,0.13, matU, -0.30, 1.22, -0.20); aL.rotation.x = -1.25;
  const aR = B(0.13,0.45,0.13, matU,  0.30, 1.22, -0.20); aR.rotation.x = -1.25;
  B(0.07,0.10,0.75, matGun, 0.12, 1.18, -0.35);
  B(0.04,0.04,0.30, matGun, 0.12, 1.21, -0.78);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.13, 0.78, 0); legR.position.set(0.13, 0.78, 0);
  B(0.17,0.78,0.20, matD, 0, -0.39, 0, legL); B(0.18,0.12,0.26, matBoot, 0, -0.72, -0.03, legL);
  B(0.17,0.78,0.20, matD, 0, -0.39, 0, legR); B(0.18,0.12,0.26, matBoot, 0, -0.72, -0.03, legR);
  g.add(legL, legR);
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.85, 0.75),
    new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false }));
  hitbox.position.y = 0.95; g.add(hitbox);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xffd27a,
    blending:THREE.AdditiveBlending, transparent:true, opacity:.95, depthWrite:false }));
  flash.scale.setScalar(0.5); flash.position.set(0.12, 1.2, -0.98);
  flash.visible = false; g.add(flash);
  return { group:g, legL, legR, hitbox, flash };
}

/* ================= lifecycle ================= */
function createBot(team, index, initialDelay){
  const v = makeSoldier(team);
  scene.add(v.group);
  const b = {
    team, name: `${team==='eagle'?'EAGLE':'RAVEN'}-${String(index+1).padStart(2,'0')}`,
    group: v.group, legL: v.legL, legR: v.legR, hitbox: v.hitbox, flash: v.flash,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    yaw: team==='eagle' ? -Math.PI/2 : Math.PI/2,
    hp: CFG.bot.hp, state: STATE.DEAD, stateT: 0,
    target: null, los: false, reactT: 0, burst: 0, burstPause: 0, fireCd: 0,
    path: [], pathI: 0, repathT: 0, stuckT: 0, lastX: 0, lastZ: 0,
    objective: null, millT: 0, millX: 0, millZ: 0,
    retreatX: 0, retreatZ: 0, fallDir: 1,
    thinkT: Math.random()*CFG.bot.thinkInterval,
    strafeDir: Math.random()<0.5?-1:1, strafeT: 0,
    flanker: Math.random()<0.3, flankSide: Math.random()<0.5?-1:1,
    regenT: 0, flashT: 0, walkPhase: Math.random()*6,
    deadT: 90, hidden: true, respawnT: initialDelay,
  };
  v.hitbox.userData.bot = b;
  botHitboxes.push(v.hitbox);
  bots.push(b);
  v.group.visible = false;
  return b;
}
export function initBots(scn){
  scene = scn;
  let i = 0;
  for (let n = 0; n < CFG.bot.count; n++){
    createBot('eagle', n, 0.5 + i++*0.22);
    createBot('raven', n, 0.5 + i++*0.22);
  }
}
function respawnBot(b){
  const sp = spawnPosition(b.team, bots.indexOf(b) % 10 + Math.random()*4);
  b.pos.set(sp.x, terrainHeight(sp.x, sp.z), sp.z);
  b.vel.set(0,0,0);
  b.hp = CFG.bot.hp; b.state = STATE.ATTACK; b.stateT = 0;
  b.target = null; b.path = []; b.objective = null;
  b.group.visible = true; b.hitbox.visible = true;
  b.group.rotation.set(0, b.yaw, 0);
  b.group.position.copy(b.pos);
  b.hidden = false; b.regenT = 0;
}
export function damageBot(b, amount, attacker){
  if (b.state === STATE.DEAD) return false;
  b.hp -= amount; b.regenT = 0;
  if (b.state !== STATE.RETREAT && (!b.target || Math.random() < 0.6)){
    b.target = (attacker === player) ? { kind:'player' } : { kind:'bot', ref:attacker };
    b.reactT = Math.min(b.reactT, 0.2); b.los = true; b.state = STATE.ENGAGE;
  }
  if (b.hp <= 0){
    b.state = STATE.DEAD; b.deadT = 0; b.hidden = false;
    b.respawnT = CFG.bot.respawnTime; b.fallDir = Math.random()<0.5?-1:1;
    b.hitbox.visible = false; b.target = null;
    killEvents.push({ killer: attacker===player ? 'YOU' : attacker.name, victim: b.name });
    return true;
  }
  return false;
}

/* ================= sensing ================= */
function inFov(b, x, z){
  const dx = x-b.pos.x, dz = z-b.pos.z, d = Math.hypot(dx,dz);
  if (d < 8) return true;
  return (dx*-Math.sin(b.yaw) + dz*-Math.cos(b.yaw))/d > Math.cos(CFG.bot.fovDeg*D2R/2);
}
function losTo(b, x, y, z){
  const ox = b.pos.x, oy = b.pos.y+1.55, oz = b.pos.z;
  const dx = x-ox, dy = y-oy, dz = z-oz;
  const dist = Math.hypot(dx,dy,dz);
  const wh = raycastWorld(_o.set(ox,oy,oz), _d.set(dx/dist,dy/dist,dz/dist), dist);
  return !wh || wh.distance > dist - 0.6;
}
function targetInfo(b){
  const t = b.target;
  if (!t) return null;
  if (t.kind === 'player'){
    if (player.dead) return null;
    return { x:player.pos.x, y:player.pos.y-0.55, z:player.pos.z,
             vx:player.vel.x, vz:player.vel.z };
  }
  const o = t.ref;
  if (o.state === STATE.DEAD) return null;
  return { x:o.pos.x, y:o.pos.y+1.3, z:o.pos.z, vx:o.vel.x, vz:o.vel.z };
}

/* ================= think (4 Hz, staggered) ================= */
function pickObjective(b){
  const opts = controlPoints.filter(cp => cp.owner !== b.team)
    .sort((p,q) => ((p.x-b.pos.x)**2+(p.z-b.pos.z)**2) - ((q.x-b.pos.x)**2+(q.z-b.pos.z)**2));
  b.objective = (!opts.length) ? controlPoints[b.team==='eagle'?4:0]
    : (Math.random() < 0.7 || opts.length === 1) ? opts[0] : opts[1];
}
function repath(b, tx, tz){
  b.path = findPath(b.pos.x, b.pos.z, tx, tz, b.flanker ? 1.7 : 1);
  b.pathI = b.path.length > 2 ? 1 : 0;
  b.repathT = 2.5 + Math.random()*2;
}
function think(b){
  const cands = [];
  if (!player.dead){
    const d = b.pos.distanceTo(player.pos);
    if (d < CFG.bot.viewRange) cands.push({ d, kind:'player', x:player.pos.x, z:player.pos.z, y:player.pos.y-0.4 });
  }
  for (const o of bots){
    if (o.team === b.team || o.state === STATE.DEAD) continue;
    const d = Math.hypot(o.pos.x-b.pos.x, o.pos.z-b.pos.z, o.pos.y-b.pos.y);
    if (d < CFG.bot.viewRange) cands.push({ d, kind:'bot', ref:o, x:o.pos.x, z:o.pos.z, y:o.pos.y+1.4 });
  }
  cands.sort((a,c) => a.d - c.d);
  let found = null;
  for (let i=0; i<Math.min(cands.length,4); i++){
    const c = cands[i];
    if (inFov(b, c.x, c.z) && losTo(b, c.x, c.y, c.z)){
      found = c.kind==='player' ? { kind:'player' } : { kind:'bot', ref:c.ref };
      break;
    }
  }
  const had = b.target;
  b.target = found; b.los = !!found;
  if (found && !had){
    b.reactT = 0.35*(1.1 - CFG.bot.skill);
    b.burst = CFG.bot.burstMin + (Math.random()*(CFG.bot.burstMax-CFG.bot.burstMin)|0);
    b.burstPause = 0;
  }
  const prev = b.state;
  if (b.hp <= CFG.bot.retreatHp && found) b.state = STATE.RETREAT;
  else if (found) b.state = STATE.ENGAGE;
  else if (b.state === STATE.ENGAGE) b.state = STATE.ATTACK;
  if (b.state !== prev){
    b.stateT = 0;
    if (b.state === STATE.RETREAT){
      const s = nearestSolid(b.pos.x, b.pos.z, 22);
      const tx = found ? (targetInfo(b)?.x ?? b.pos.x) : b.pos.x;
      const tz = found ? (targetInfo(b)?.z ?? b.pos.z) : b.pos.z;
      if (s){ const ax = s.x-tx, az = s.z-tz, l = Math.hypot(ax,az)||1;
        b.retreatX = s.x + ax/l*(s.r+1.5); b.retreatZ = s.z + az/l*(s.r+1.5); }
      else { const home = controlPoints[b.team==='eagle'?0:4];
        b.retreatX = home.x; b.retreatZ = home.z; }
      repath(b, b.retreatX, b.retreatZ);
    }
    if (b.state === STATE.ATTACK){ b.objective = null; b.path = []; }
  }
  if (!b.objective) pickObjective(b);
}

/* ================= combat ================= */
function raySphereT(ox,oy,oz, dx,dy,dz, cx,cy,cz, r){
  const lx=ox-cx, ly=oy-cy, lz=oz-cz;
  const bb = lx*dx + ly*dy + lz*dz;
  const c = lx*lx + ly*ly + lz*lz - r*r;
  if (c > 0 && bb > 0) return Infinity;
  const disc = bb*bb - c;
  if (disc < 0) return Infinity;
  const t = -bb - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}
function botShoot(b, ti){
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  const muzzle = _v1.set(b.pos.x + fx*0.45, b.pos.y + 1.42, b.pos.z + fz*0.45);
  const dist = Math.hypot(ti.x-muzzle.x, ti.y-muzzle.y, ti.z-muzzle.z);
  const tLead = clamp(dist*0.003, 0, 0.3) * lerp(0.25, 1, CFG.bot.skill);
  const dir = _v2.set(ti.x + ti.vx*tLead - muzzle.x, ti.y - muzzle.y, ti.z + ti.vz*tLead - muzzle.z).normalize();
  const moving = Math.hypot(b.vel.x, b.vel.z) > 1;
  const err = (lerp(2.8, 0.9, CFG.bot.skill) + (moving ? 1.1 : 0)) * D2R;
  const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random())*err;
  dir.applyAxisAngle(worldUp, Math.cos(a)*r);
  _right.crossVectors(dir, worldUp).normalize();
  dir.applyAxisAngle(_right, Math.sin(a)*r);

  const wh = raycastWorld(muzzle, dir, 260);
  const worldDist = wh ? wh.distance : 260;
  let bestT = Infinity, kind = null, ref = null;
  if (!player.dead){
    for (const oy of [-1.1, -0.6, -0.1]){
      const t = raySphereT(muzzle.x,muzzle.y,muzzle.z, dir.x,dir.y,dir.z,
        player.pos.x, player.pos.y+oy, player.pos.z, 0.45);
      if (t < bestT){ bestT = t; kind = 'player'; ref = null; }
    }
  }
  for (const o of bots){
    if (o === b || o.team === b.team || o.state === STATE.DEAD) continue;
    if ((o.pos.x-muzzle.x)**2 + (o.pos.z-muzzle.z)**2 > worldDist*worldDist) continue;
    for (const hy of [0.5, 1.0, 1.5]){
      const t = raySphereT(muzzle.x,muzzle.y,muzzle.z, dir.x,dir.y,dir.z,
        o.pos.x, o.pos.y+hy, o.pos.z, 0.45);
      if (t < bestT){ bestT = t; kind = 'bot'; ref = o; }
    }
  }
  let end;
  if (kind && bestT <= worldDist){
    end = _v3.copy(muzzle).addScaledVector(dir, bestT + 0.1);
    if (kind === 'player') damagePlayer(CFG.bot.damage, b);
    else damageBot(ref, CFG.bot.damage, b);
    spawnPuff(_v4.copy(end));
  } else {
    end = wh ? wh.point : _v3.copy(muzzle).addScaledVector(dir, 260);
    if (wh && Math.random() < 0.5) spawnPuff(wh.point);
  }
  spawnTracer(muzzle, end);
  b.flashT = 0.05;
}
function updateCombat(b, dt){
  b.fireCd -= dt; b.burstPause -= dt; b.reactT -= dt; b.flashT -= dt;
  b.flash.visible = b.flashT > 0;
  if (b.state !== STATE.ENGAGE || !b.target) return;
  const ti = targetInfo(b);
  if (!ti){ b.target = null; return; }
  if (b.reactT > 0 || !b.los || b.burstPause > 0 || b.fireCd > 0) return;
  botShoot(b, ti);
  b.fireCd = 60/CFG.bot.rpm;
  if (--b.burst <= 0) b.burstPause = 0.7 + Math.random()*0.9;
}

/* ================= movement ================= */
function lerpAngle(a, b, t){
  let d = b - a;
  while (d > Math.PI) d -= Math.PI*2;
  while (d < -Math.PI) d += Math.PI*2;
  return a + d*t;
}
function seek(b, tx, tz, out){
  const dx = tx-b.pos.x, dz = tz-b.pos.z, d = Math.hypot(dx,dz);
  if (d > 0.05){ out.x += dx/d; out.z += dz/d; }
  return d;
}
function updateMovement(b, dt){
  const want = _v4.set(0,0,0);
  let speed = CFG.bot.speed, yawGoal = b.yaw, moving = false;

  if (b.state === STATE.ATTACK){
    if (!b.path.length || b.repathT <= 0) repath(b, b.objective.x, b.objective.z);
    const wp = b.path[b.pathI];
    const objD = Math.hypot(b.objective.x-b.pos.x, b.objective.z-b.pos.z);
    if (wp && Math.hypot(wp.x-b.pos.x, wp.z-b.pos.z) < 2.5 && b.pathI < b.path.length-1) b.pathI++;
    if (objD < b.objective.radius - 2){
      b.millT -= dt;
      if (b.millT <= 0){
        const a = Math.random()*Math.PI*2, r = Math.random()*(b.objective.radius-3);
        b.millX = b.objective.x + Math.cos(a)*r; b.millZ = b.objective.z + Math.sin(a)*r;
        b.millT = 3 + Math.random()*3;
      }
      if (seek(b, b.millX, b.millZ, want) > 1.5) moving = true;
    } else {
      const target = b.path[b.pathI] || b.objective;
      seek(b, target.x, target.z, want); moving = true;
      const far = Math.hypot(target.x-b.pos.x, target.z-b.pos.z) > 25;
      speed = far ? CFG.bot.sprintSpeed : CFG.bot.speed;
    }
  } else if (b.state === STATE.ENGAGE){
    const ti = targetInfo(b);
    if (ti){
      const dx = ti.x-b.pos.x, dz = ti.z-b.pos.z, d = Math.hypot(dx,dz) || 1;
      if (d > 42){ want.x += dx/d; want.z += dz/d; moving = true; }
      else if (d < 14){ want.x -= dx/d; want.z -= dz/d; moving = true; }
      b.strafeT -= dt;
      if (b.strafeT <= 0){ b.strafeDir *= -1; b.strafeT = 1.2 + Math.random()*1.8; }
      const px = -dz/d, pz = dx/d;
      want.x += px*b.strafeDir*0.9 + (b.flanker ? px*b.flankSide*0.5 : 0);
      want.z += pz*b.strafeDir*0.9 + (b.flanker ? pz*b.flankSide*0.5 : 0);
      moving = true;
      yawGoal = Math.atan2(-dx, -dz);
    }
  } else if (b.state === STATE.RETREAT){
    if (!b.path.length || b.repathT <= 0) repath(b, b.retreatX, b.retreatZ);
    const wp = b.path[b.pathI];
    if (wp && Math.hypot(wp.x-b.pos.x, wp.z-b.pos.z) < 2.5 && b.pathI < b.path.length-1) b.pathI++;
    const t = b.path[b.pathI] || { x:b.retreatX, z:b.retreatZ };
    if (seek(b, t.x, t.z, want) > 2) moving = true;
    speed = CFG.bot.sprintSpeed;
  }

  for (const o of bots){
    if (o === b || o.state === STATE.DEAD) continue;
    const dx = b.pos.x-o.pos.x, dz = b.pos.z-o.pos.z, d2 = dx*dx+dz*dz;
    if (d2 < 1.44 && d2 > 1e-4){ const d = Math.sqrt(d2);
      want.x += dx/d*(1.4-d)*1.5; want.z += dz/d*(1.4-d)*1.5; }
  }

  const wl = Math.hypot(want.x, want.z);
  if (wl > 0.01){ want.x /= wl; want.z /= wl; }
  const kk = 1 - Math.exp(-8*dt);
  b.vel.x += (want.x*speed - b.vel.x)*kk;
  b.vel.z += (want.z*speed - b.vel.z)*kk;
  b.vel.y -= CFG.player.gravity*dt;

  b.pos.x += b.vel.x*dt; b.pos.z += b.vel.z*dt;
  collideCircle(b.pos, RADIUS, b.pos.y, b.pos.y + HEIGHT, STEP);
  b.pos.y += b.vel.y*dt;
  const floor = supportHeight(b.pos.x, b.pos.z, b.pos.y, STEP);
  if (b.pos.y <= floor){ b.pos.y = floor; b.vel.y = 0; b.grounded = true; }
  else b.grounded = false;
  b.pos.x = clamp(b.pos.x, -250, 250); b.pos.z = clamp(b.pos.z, -250, 250);

  if (b.state !== STATE.ENGAGE && wl > 0.05) yawGoal = Math.atan2(-want.x, -want.z);
  b.yaw = lerpAngle(b.yaw, yawGoal, 1 - Math.exp(-10*dt));

  const prog = Math.hypot(b.pos.x-b.lastX, b.pos.z-b.lastZ);
  if (moving && wl > 0.05 && prog < 0.004){ b.stuckT += dt;
    if (b.stuckT > 1.2){ b.stuckT = 0; b.path = []; b.vel.x += (Math.random()-0.5)*6; b.vel.z += (Math.random()-0.5)*6; }
  } else b.stuckT = 0;
  b.lastX = b.pos.x; b.lastZ = b.pos.z;
}

/* ================= visuals / anim ================= */
function updateAnim(b, dt){
  const sp = Math.hypot(b.vel.x, b.vel.z);
  b.walkPhase += dt * (4 + sp*1.6);
  const amp = clamp(sp / CFG.bot.sprintSpeed, 0, 1) * 0.55;
  b.legL.rotation.x =  Math.sin(b.walkPhase)*amp;
  b.legR.rotation.x = -Math.sin(b.walkPhase)*amp;
  b.group.position.copy(b.pos);
  b.group.rotation.y = b.yaw;
}
function updateDead(b, dt){
  if (!b.hidden){
    b.deadT += dt;
    b.group.rotation.x = b.fallDir * smooth(clamp(b.deadT/0.5, 0, 1)) * Math.PI/2;
    if (b.deadT > 2.6) b.group.position.y -= dt*0.9;
    if (b.deadT > 3.4){ b.hidden = true; b.group.visible = false; }
  }
  b.respawnT -= dt;
  if (b.hidden && b.respawnT <= 0) respawnBot(b);
}

/* ================= main update ================= */
export function updateBots(dt){
  for (const b of bots){
    if (b.state === STATE.DEAD){ updateDead(b, dt); continue; }
    b.stateT += dt;
    if (b.state === STATE.RETREAT && (b.hp >= CFG.bot.reengageHp || b.stateT > 9)){
      b.state = STATE.ATTACK; b.path = []; b.objective = null;
    }
    b.thinkT -= dt;
    if (b.thinkT <= 0){ think(b); b.thinkT = CFG.bot.thinkInterval*(0.8 + Math.random()*0.4); }
    updateCombat(b, dt);
    updateMovement(b, dt);
    updateAnim(b, dt);
    b.regenT += dt;
    if (b.regenT > CFG.bot.regenDelay && b.hp < CFG.bot.hp)
      b.hp = Math.min(CFG.bot.hp, b.hp + CFG.bot.regenRate*dt);
  }
}
