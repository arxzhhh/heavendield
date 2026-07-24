import { CFG } from './config.js';
import { lerp } from './utils.js';
import { wpn } from './weapon.js';
import { player } from './player.js';
import { controlPoints } from './world.js';
import { match } from './match.js';

let elMag, elRes, elHint, elFps, chU, chD, chL, chR, crosshair;
let vignette, hitmarker, hmO = 0, hintOverride = null;
let tEagle, tRaven, pipsBox, banner, bannerT = 0, killfeed;
let ammoDirty = true;
export function markAmmoDirty(){ ammoDirty = true; }

export function initHUD(){
  elMag = document.querySelector('#ammo .mag'); elRes = document.querySelector('#ammo .res');
  elHint = document.getElementById('hint'); elFps = document.getElementById('fps');
  chU = document.querySelector('.bU'); chD = document.querySelector('.bD');
  chL = document.querySelector('.bL'); chR = document.querySelector('.bR');
  crosshair = document.getElementById('crosshair');
  vignette = document.getElementById('vignette'); hitmarker = document.getElementById('hitmarker');
  tEagle = document.getElementById('tEagle'); tRaven = document.getElementById('tRaven');
  pipsBox = document.getElementById('pips'); banner = document.getElementById('banner');
  killfeed = document.getElementById('killfeed');
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

export function updateTickets(){
  tEagle.textContent = match.tickets.eagle;
  tRaven.textContent = match.tickets.raven;
  tEagle.parentNode.classList.toggle('low', match.tickets.eagle <= 15);
  tRaven.parentNode.classList.toggle('low', match.tickets.raven <= 15);
  for (let i = 0; i < controlPoints.length; i++)
    pipsBox.children[i].className = controlPoints[i].owner === 'eagle' ? 'eagle'
      : controlPoints[i].owner === 'raven' ? 'raven' : '';
}
export function showBanner(text, team){
  banner.textContent = text;
  banner.className = team;
  bannerT = 3;
}
export function pushKill(killer, killerTeam, victim, victimTeam){
  const row = document.createElement('div');
  row.className = 'kill';
  const kc = killerTeam === 'eagle' ? '#7fa9f5' : killerTeam === 'raven' ? '#f08a80' : '#fff';
  const vc = victimTeam === 'eagle' ? '#7fa9f5' : '#f08a80';
  row.innerHTML = `<span style="color:${kc}">${killer}</span><b>▸</b><span style="color:${vc}">${victim}</span>`;
  killfeed.prepend(row);
  while (killfeed.children.length > 5) killfeed.lastChild.remove();
  setTimeout(() => { row.style.opacity = 0; setTimeout(() => row.remove(), 450); }, 4600);
}
