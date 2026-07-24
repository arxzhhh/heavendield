import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, smooth } from './utils.js';
import { input } from './input.js';
import { terrainHeight, collideCircle, supportHeight } from './world.js';

export const yawObj = new THREE.Object3D();
export const pitchObj = new THREE.Object3D();
yawObj.add(pitchObj);

export const PLAYER_TEAM = 'eagle';

export const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: -Math.PI/2, pitch: 0,           // face +X (toward point B from Eagle spawn)
  grounded: true, prevVy: 0,
  lastFall: 0,                          // consumed by weapon for landing dip
  sprintT: 0, sprintLock: 0,            // owned here; weapon reads/locks
  aimKick: 0,                           // written by weapon (recoil spring)
  hp: 100, dead: false, deadT: 0, regenT: 0, damageFlash: 0,
};

const RADIUS = 0.4, HEIGHT = 1.75, STEP = 0.5;

export function updatePlayer(dt){
  const P = CFG.player;
  
  if (player.dead){ // freeze while dead; main handles respawn timer
    yawObj.position.copy(player.pos); yawObj.rotation.y = player.yaw;
    pitchObj.rotation.x = clamp(player.pitch + player.aimKick, -1.55, 1.55);
    return;
  }
  
  player.regenT += dt;
  if (player.regenT > P.regenDelay && player.hp < P.hp)
    player.hp = Math.min(P.hp, player.hp + P.regenRate*dt);
  
  if (input.locked && !player.dead){
    player.yaw -= input.dx * P.sens;
    player.pitch = clamp(player.pitch - input.dy * P.sens, -1.55, 1.55);
  }
  input.dx = input.dy = 0;

  const k = input.keys;
  const f = (k.KeyW?1:0)-(k.KeyS?1:0), s = (k.KeyD?1:0)-(k.KeyA?1:0);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let wx = -sy*f + cy*s, wz = -cy*f - sy*s;
  const wl = Math.hypot(wx,wz); if (wl > 1){ wx/=wl; wz/=wl; }

  player.sprintLock -= dt;
  const wantSprint = (k.ShiftLeft||k.ShiftRight) && k.KeyW && !input.ads && player.sprintLock<=0;
  player.sprintT += ((wantSprint?1:0) - player.sprintT) * (1 - Math.exp(-10*dt));
  const targetSpeed = lerp(P.walk, P.sprint, smooth(player.sprintT)) * (input.ads ? P.adsSpeed : 1);

  const lam = player.grounded ? P.groundLambda : P.airLambda;
  const kk = 1 - Math.exp(-lam*dt);
  player.vel.x += (wx*targetSpeed - player.vel.x)*kk;
  player.vel.z += (wz*targetSpeed - player.vel.z)*kk;
  player.vel.y -= P.gravity*dt;
  if (input.locked && !player.dead && k.Space && player.grounded){ player.vel.y = P.jump; player.grounded = false; }

  player.prevVy = player.vel.y;
  player.pos.x += player.vel.x*dt;
  player.pos.z += player.vel.z*dt;
  const feetY0 = player.pos.y - P.eye;
  collideCircle(player.pos, RADIUS, feetY0, feetY0 + HEIGHT, STEP);
  player.pos.y += player.vel.y*dt;
  const feetY = player.pos.y - P.eye;
  const floor = supportHeight(player.pos.x, player.pos.z, feetY);
  if (player.pos.y <= floor + P.eye){
    if (!player.grounded && player.prevVy < -7) player.lastFall = -player.prevVy;
    player.pos.y = floor + P.eye; player.vel.y = 0; player.grounded = true;
  } else player.grounded = false;
  player.pos.x = clamp(player.pos.x, -250, 250);
  player.pos.z = clamp(player.pos.z, -250, 250);

  yawObj.position.copy(player.pos);
  yawObj.rotation.y = player.yaw;
  pitchObj.rotation.x = clamp(player.pitch + player.aimKick, -1.55, 1.55);
}

export function damagePlayer(amount, source){
  if (player.dead) return false;
  player.hp -= amount; player.regenT = 0;
  player.damageFlash = Math.min(1, player.damageFlash + amount/45);
  if (player.hp <= 0){ player.hp = 0; player.dead = true; player.deadT = 0; return true; }
  return false;
}
