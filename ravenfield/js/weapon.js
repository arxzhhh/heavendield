import * as THREE from 'three';
import { CFG } from './config.js';
import { D2R, clamp, lerp, damp, smooth } from './utils.js';
import { input } from './input.js';
import { player } from './player.js';
import { colliders, raycastTerrain } from './world.js';
import { spawnTracer, spawnPuff, spawnDecal } from './effects.js';
import { markAmmoDirty } from './hud.js';

let camera = null;
export const wpn = {
  mag: CFG.rifle.magSize, reserve: CFG.rifle.reserve,
  reloading:false, reloadT:0, cd:0,
  bloom:0, tempKick:0, zKick:0,
  adsT:0, bobPhase:0, dip:0,
};

let gun, muzzleTip, flash, flashLight;
const matBody = new THREE.MeshLambertMaterial({ color:0x2b2b31 });
const matDark = new THREE.MeshLambertMaterial({ color:0x1e1e24 });
const matMag  = new THREE.MeshLambertMaterial({ color:0x3a3a42 });
const matArm  = new THREE.MeshLambertMaterial({ color:CFG.team.eagle });

function gbox(w,h,d, x,y,z, mat, rx=0, ry=0, rz=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.rotation.set(rx,ry,rz); gun.add(m); return m;
}

export function createWeapon(cam){
  camera = cam;
  gun = new THREE.Group();
  camera.add(gun);

  gbox(0.070,0.090,0.42,  0.00,-0.060,-0.05, matBody);
  gbox(0.034,0.034,0.30,  0.00,-0.052,-0.38, matDark);
  gbox(0.062,0.066,0.24,  0.00,-0.058,-0.26, matBody);
  gbox(0.050,0.170,0.09,  0.00,-0.165, 0.03, matMag, 0.18);
  gbox(0.050,0.075,0.20,  0.00,-0.062, 0.26, matBody);
  gbox(0.042,0.100,0.05,  0.00,-0.135, 0.13, matDark,-0.35);
  gbox(0.012,0.050,0.012, 0.00,-0.020,-0.46, matDark);
  gbox(0.016,0.035,0.014,-0.018,-0.022, 0.10, matDark);
  gbox(0.016,0.035,0.014, 0.018,-0.022, 0.10, matDark);
  gbox(0.075,0.070,0.30,  0.055,-0.170, 0.10, matArm, 0.45, 0.15);
  gbox(0.070,0.065,0.30, -0.060,-0.150,-0.16, matArm, 0.80,-0.10);
  muzzleTip = new THREE.Object3D(); muzzleTip.position.set(0,-0.052,-0.55); gun.add(muzzleTip);

  flash = new THREE.Group(); flash.position.copy(muzzleTip.position); gun.add(flash);
  const flashMat = new THREE.MeshBasicMaterial({ color:0xffd27a, blending:THREE.AdditiveBlending,
    transparent:true, opacity:.95, depthWrite:false, side:THREE.DoubleSide });
  const fp1 = new THREE.Mesh(new THREE.PlaneGeometry(.22,.22), flashMat);
  const fp2 = fp1.clone(); fp2.rotation.z = Math.PI/2;
  flash.add(fp1, fp2); flash.visible = false;
  flashLight = new THREE.PointLight(0xffc27a, 0, 9); flash.add(flashLight);
}

const HIP_POS = new THREE.Vector3( 0.24,-0.235,-0.50), HIP_ROT = new THREE.Vector3( 0.02,-0.06, 0.02);
const ADS_POS = new THREE.Vector3( 0.00, 0.000,-0.42), ADS_ROT = new THREE.Vector3( 0,0,0);
const SPR_POS = new THREE.Vector3( 0.30,-0.330,-0.40), SPR_ROT = new THREE.Vector3(-0.10,-0.30, 0.08);

const raycaster = new THREE.Raycaster();
const worldUp = new THREE.Vector3(0,1,0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(),
      _q = new THREE.Quaternion(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

function dirFromAngles(yaw, pitch){
  const cp = Math.cos(pitch);
  return _v3.set(-cp*Math.sin(yaw), Math.sin(pitch), -cp*Math.cos(yaw)).normalize();
}

function startReload(){
  if (wpn.reloading || wpn.mag >= CFG.rifle.magSize || wpn.reserve <= 0) return;
  wpn.reloading = true; wpn.reloadT = 0;
}

function shoot(){
  const R = CFG.rifle;
  wpn.mag--; wpn.cd = 60/R.rpm;
  player.sprintLock = 0.35;
  wpn.bloom = Math.min(R.bloomMax, wpn.bloom + R.bloomPerShot);

  const adsK = smooth(wpn.adsT);
  const spread = (lerp(R.spreadHip, R.spreadAds, adsK) + wpn.bloom*(1-0.5*adsK)) * D2R;
  const ang = Math.random()*Math.PI*2, rad = Math.sqrt(Math.random())*spread;

  const P = clamp(player.pitch + wpn.tempKick, -1.55, 1.55);
  const dir = dirFromAngles(player.yaw, P).clone();
  camera.getWorldQuaternion(_q);
  _r.set(1,0,0).applyQuaternion(_q); _u.set(0,1,0).applyQuaternion(_q);
  dir.applyAxisAngle(_u, Math.cos(ang)*rad).applyAxisAngle(_r, Math.sin(ang)*rad).normalize();

  const kv = (R.kickVert + (Math.random()*2-1)*R.kickVertVar) * D2R;
  const kh = (Math.random()*2-1) * R.kickHoriz * D2R;
  player.pitch = clamp(player.pitch + kv*(1-R.kickRecoverFrac), -1.55, 1.55);
  player.yaw += kh;
  wpn.tempKick += kv*R.kickRecoverFrac;
  wpn.zKick = 1;

  // --- hitscan: props via raycaster, terrain via analytical heightfield ---
  camera.getWorldPosition(_v1);
  raycaster.set(_v1, dir); raycaster.far = R.range;
  const hits = raycaster.intersectObjects(colliders, false);
  const propHit = hits.length ? hits[0] : null;
  const terrHit = raycastTerrain(_v1, dir, propHit ? propHit.distance : R.range);
  let end = null, normal = null;
  if (propHit && (!terrHit || propHit.distance <= terrHit.distance)){
    end = propHit.point.clone();
    normal = propHit.face.normal.clone().transformDirection(propHit.object.matrixWorld);
  } else if (terrHit){ end = terrHit.point; normal = terrHit.normal; }
  if (!end) end = _v1.clone().addScaledVector(dir, R.range);

  // --- feedback ---
  muzzleTip.getWorldPosition(_v2);
  spawnTracer(_v2.clone(), end);
  if (normal){
    spawnPuff(end.clone().addScaledVector(normal, .03));
    if (end.distanceTo(_v1) > 1) spawnDecal(end, normal);
  }
  flash.visible = true; flash.rotation.z = Math.random()*Math.PI;
  const s = .8 + Math.random()*.5; flash.scale.setScalar(s);
  flashLight.intensity = 3;
  markAmmoDirty();
}

function fireControl(dt){
  const R = CFG.rifle;
  wpn.cd -= dt;
  const want = input.trigger;
  if (want){
    if (wpn.mag <= 0) startReload();
    else if (R.fireMode === 'auto' && wpn.cd <= 0) shoot();
  }
  if (input.semiEdge){
    input.semiEdge = false;
    if (want && wpn.mag > 0 && R.fireMode === 'semi' && wpn.cd <= 0) shoot();
  }
  if (wpn.reloading){
    wpn.reloadT += dt;
    if (wpn.reloadT >= R.reloadTime){
      const take = Math.min(R.magSize - wpn.mag, wpn.reserve);
      wpn.mag += take; wpn.reserve -= take;
      wpn.reloading = false; markAmmoDirty();
    }
  }
}

function updateWeapon(dt, speedFactor, grounded, t){
  const P = CFG.player;
  const wantAds = input.ads;
  wpn.adsT = clamp(wpn.adsT + (wantAds?1:-1)*dt/P.adsTime, 0, 1);

  if (input.keys.KeyR) startReload();

  wpn.tempKick = damp(wpn.tempKick, 0, CFG.rifle.kickRecoverSpeed, dt);
  wpn.zKick = damp(wpn.zKick, 0, 12, dt);
  flashLight.intensity *= Math.exp(-dt*28);
  if (flash.visible && flashLight.intensity < .05) flash.visible = false;

  wpn.bobPhase += dt*(7 + 5*speedFactor);
  const bobY = grounded ? Math.sin(wpn.bobPhase*2)*.012*speedFactor : 0;
  const bobX = grounded ? Math.cos(wpn.bobPhase)*.008*speedFactor : 0;
  input.mvx = damp(input.mvx, 0, 8, dt); input.mvy = damp(input.mvy, 0, 8, dt);
  const swayX = clamp(-input.mvx*.00045, -.05, .05) + Math.sin(t*1.1)*.0015;
  const swayY = clamp(-input.mvy*.00035, -.04, .04) + Math.cos(t*1.4)*.0010;
  wpn.dip = damp(wpn.dip, 0, 6, dt);
  if (player.lastFall > 0){ wpn.dip = clamp(player.lastFall*0.010, 0, 0.07); player.lastFall = 0; }

  let rl = 0;
  if (wpn.reloading){
    const k = wpn.reloadT/CFG.rifle.reloadTime;
    rl = Math.sin(Math.min(k*1.15, 1)*Math.PI) * (k < .85 ? 1 : (1-k)/.15);
  }

  const sS = smooth(player.sprintT), sA = smooth(wpn.adsT);
  gun.position.set(
    lerp(lerp(HIP_POS.x, SPR_POS.x, sS), ADS_POS.x, sA) + bobX,
    lerp(lerp(HIP_POS.y, SPR_POS.y, sS), ADS_POS.y, sA) + bobY - wpn.dip - rl*.10,
    lerp(lerp(HIP_POS.z, SPR_POS.z, sS), ADS_POS.z, sA) + wpn.zKick*.05);
  gun.rotation.set(
    lerp(lerp(HIP_ROT.x, SPR_ROT.x, sS), ADS_ROT.x, sA) + swayY - wpn.zKick*.10 - rl*.9,
    lerp(lerp(HIP_ROT.y, SPR_ROT.y, sS), ADS_ROT.y, sA) + swayX + rl*.35,
    lerp(lerp(HIP_ROT.z, SPR_ROT.z, sS), ADS_ROT.z, sA) - rl*.25);

  camera.fov = lerp(P.fov, P.adsFov, sA) + sS*3.5*(1-sA);
  camera.updateProjectionMatrix();

  player.aimKick = wpn.tempKick;
  camera.position.y = grounded ? Math.sin(wpn.bobPhase*2)*0.018*speedFactor : 0;
  return sA;
}

export { fireControl, updateWeapon };
