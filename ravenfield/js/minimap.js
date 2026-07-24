import { controlPoints, RUNWAY } from './world.js';
import { bots, STATE } from './bots.js';
import { player } from './player.js';

let ctx = null;
const S = 176, W2 = 260;                       // canvas size, world half-extent
const mx = x => (x + W2) / (2*W2) * S;
const my = z => (z + W2) / (2*W2) * S;         // north (-z) is up

export function initMinimap(){
  const c = document.getElementById('minimap');
  c.width = S; c.height = S;
  ctx = c.getContext('2d');
}
export function updateMinimap(){
  if (!ctx) return;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(26,38,29,0.74)'; ctx.fillRect(0, 0, S, S);
  // airstrip
  ctx.fillStyle = 'rgba(125,125,132,0.9)';
  ctx.fillRect(mx(RUNWAY.x-RUNWAY.w/2), my(RUNWAY.z-RUNWAY.d/2),
    RUNWAY.w/(2*W2)*S, RUNWAY.d/(2*W2)*S);
  // road
  ctx.strokeStyle = 'rgba(150,125,85,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
  controlPoints.forEach((cp,i) => i ? ctx.lineTo(mx(cp.x), my(cp.z)) : ctx.moveTo(mx(cp.x), my(cp.z)));
  ctx.stroke();
  // control points
  for (const cp of controlPoints){
    ctx.beginPath(); ctx.arc(mx(cp.x), my(cp.z), cp.radius/(2*W2)*S, 0, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(mx(cp.x), my(cp.z), 6, 0, 7);
    ctx.fillStyle = cp.owner==='eagle' ? '#5b8bef' : cp.owner==='raven' ? '#e05e54' : '#cfd2d6';
    ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    if (cp.cappingTeam && cp.progress > 0.02 && cp.progress < 0.99){
      ctx.beginPath();
      ctx.arc(mx(cp.x), my(cp.z), 9, -Math.PI/2, -Math.PI/2 + cp.progress*Math.PI*2);
      ctx.strokeStyle = cp.cappingTeam==='eagle' ? '#5b8bef' : '#e05e54';
      ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1;
    }
    ctx.fillStyle = '#101820'; ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cp.id, mx(cp.x), my(cp.z) + 0.5);
  }
  // fighters
  for (const b of bots){
    if (b.state === STATE.DEAD) continue;
    ctx.fillStyle = b.team === 'eagle' ? '#7fa9f5' : '#f08a80';
    ctx.fillRect(mx(b.pos.x)-1.5, my(b.pos.z)-1.5, 3, 3);
  }
  // player arrow
  if (!player.dead){
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    ctx.save();
    ctx.translate(mx(player.pos.x), my(player.pos.z));
    ctx.rotate(Math.atan2(fz, fx));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,3.5); ctx.lineTo(-4,-3.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(0.5, 0.5, S-1, S-1);
}
