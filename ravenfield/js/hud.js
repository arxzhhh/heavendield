import { CFG } from './config.js';
import { lerp } from './utils.js';
import { wpn } from './weapon.js';
import { player } from './player.js';

let elMag, elRes, elHint, elFps, chU, chD, chL, chR, crosshair;
let vignette, hitmarker, hmO = 0, hintOverride = null;
let ammoDirty = true;
export function markAmmoDirty(){ ammoDirty = true; }

export function initHUD(){
  elMag = document.querySelector('#ammo .mag'); elRes = document.querySelector('#ammo .res');
  elHint = document.getElementById('hint'); elFps = document.getElementById('fps');
  chU = document.querySelector('.bU'); chD = document.querySelector('.bD');
  chL = document.querySelector('.bL'); chR = document.querySelector('.bR');
  crosshair = document.getElementById('crosshair');
  vignette = document.getElementById('vignette'); hitmarker = document.getElementById('hitmarker');
}
export function setFps(v){ elFps.textContent = v+' fps'; }
export function updateHUD(sA, dt){
  player.damageFlash = Math.max(0, player.damageFlash - dt*0.8);
  const lowHp = (!player.dead && player.hp < 40)
    ? (1 - player.hp/40) * (0.35 + 0.15*Math.sin(performance.now()*0.006)) : 0;
  vignette.style.opacity = Math.max(player.damageFlash*0.9, lowHp).toFixed(3);
  hmO = Math.max(0, hmO - dt*4);
  hitmarker.style.opacity = hmO;
  
  if (ammoDirty){ elMag.textContent = wpn.mag; elRes.textContent = '/ '+wpn.reserve; ammoDirty=false; }
  elHint.textContent = hintOverride || (wpn.reloading ? 'RELOADING'
    : (wpn.mag===0 && wpn.reserve>0) ? 'PRESS R TO RELOAD' : '');
  const gap = 5 + ((lerp(CFG.rifle.spreadHip, CFG.rifle.spreadAds, sA) + wpn.bloom) * 26);
  chU.style.transform = `translateY(${-gap}px)`; chD.style.transform = `translateY(${gap}px)`;
  chL.style.transform = `translateX(${-gap}px)`; chR.style.transform = `translateX(${gap}px)`;
  crosshair.style.opacity = sA > .5 ? 0 : 1;
}

export function showHitmarker(kill){ hmO = 1; hitmarker.classList.toggle('kill', !!kill); }
export function setHintOverride(text){ hintOverride = text; }
