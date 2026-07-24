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
