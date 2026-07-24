import { CFG } from './config.js';
import { controlPoints, setCPOwner, setCPProgress } from './world.js';
import { bots, STATE } from './bots.js';
import { player, PLAYER_TEAM } from './player.js';

export const match = {
  tickets: { eagle: 0, raven: 0 },
  over: false, winner: null,
  bleedT: 0,
  captureEvents: [],   // {team, text} — drained by main for banners
};
const inside = (cp, x, z) => (x-cp.x)**2 + (z-cp.z)**2 <= cp.radius*cp.radius;

export function initMatch(){
  const t = CFG.bot.count * 6;
  match.tickets.eagle = t; match.tickets.raven = t;
  match.over = false; match.winner = null;
  match.bleedT = CFG.match.bleedInterval;
  for (const cp of controlPoints){
    cp.progress = cp.owner === 'neutral' ? 0 : 1;
    cp.cappingTeam = null;
  }
}
export function loseTickets(team, n){
  if (match.over) return;
  match.tickets[team] = Math.max(0, match.tickets[team] - n);
  if (match.tickets[team] <= 0){
    match.over = true;
    match.winner = team === 'eagle' ? 'raven' : 'eagle';
  }
}
export function updateMatch(dt){
  if (match.over) return;
  /* ---- capture ---- */
  for (const cp of controlPoints){
    let e = 0, r = 0;
    if (!player.dead && PLAYER_TEAM === 'eagle' && inside(cp, player.pos.x, player.pos.z)) e++;
    for (const b of bots){
      if (b.state === STATE.DEAD || !inside(cp, b.pos.x, b.pos.z)) continue;
      if (b.team === 'eagle') e++; else r++;
    }
    const contested = e > 0 && r > 0;
    if (contested || (e === 0 && r === 0)){ setCPProgress(cp, cp.progress, cp.cappingTeam); continue; }

    const team = e > 0 ? 'eagle' : 'raven';
    const rate = CFG.match.capSpeeds[Math.min(e > 0 ? e : r, 4)] / CFG.match.captureTime;

    if (cp.owner === team){                       // re-secure a partially drained point
      cp.progress = Math.min(1, cp.progress + rate*dt);
      cp.cappingTeam = null;
    } else if (cp.owner === 'neutral'){
      if (cp.cappingTeam && cp.cappingTeam !== team){   // reverse an in-progress cap
        cp.progress = Math.max(0, cp.progress - rate*dt);
        if (cp.progress === 0) cp.cappingTeam = team;
      } else {
        cp.cappingTeam = team;
        cp.progress = Math.min(1, cp.progress + rate*dt);
        if (cp.progress >= 1){
          setCPOwner(cp, team);
          cp.cappingTeam = null;
          match.captureEvents.push({ team,
            text: `${team==='eagle'?'EAGLE':'RAVEN'} CAPTURED POINT ${cp.id}` });
        }
      }
    } else {                                      // enemy-owned: drain to neutral first
      cp.progress = Math.max(0, cp.progress - rate*dt);
      if (cp.progress <= 0){ setCPOwner(cp, 'neutral'); cp.cappingTeam = team; }
    }
    setCPProgress(cp, cp.progress, cp.cappingTeam);
  }
  /* ---- ticket bleed: fewer points held → bleed ---- */
  match.bleedT -= dt;
  if (match.bleedT <= 0){
    match.bleedT = CFG.match.bleedInterval;
    let eh = 0, rh = 0;
    for (const cp of controlPoints){
      if (cp.owner === 'eagle') eh++; else if (cp.owner === 'raven') rh++;
    }
    if (eh > rh) loseTickets('raven', (eh-rh)*CFG.match.bleedPerPoint);
    else if (rh > eh) loseTickets('eagle', (rh-eh)*CFG.match.bleedPerPoint);
  }
}
