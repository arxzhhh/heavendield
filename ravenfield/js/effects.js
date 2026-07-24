import * as THREE from 'three';

let scene = null;
const tracers = [], puffs = [], decals = [];
let decalIdx = 0;

export function initEffects(scn){
  scene = scn;
  for (let i=0;i<48;i++){ // tracer pool
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0xffe6a0,
      transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, t:0, active:false });
  }
  for (let i=0;i<36;i++){ // puff pool
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xcfc4ae,
      transparent:true, opacity:0, depthWrite:false }));
    s.visible = false;
    scene.add(s);
    puffs.push({ s, t:0, active:false });
  }
  const dg = new THREE.CircleGeometry(.05, 10);
  for (let i=0;i<80;i++){ // decal ring pool
    const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color:0x20242a,
      transparent:true, opacity:0, depthWrite:false }));
    m.visible = false;
    scene.add(m);
    decals.push({ m, t:0, active:false });
  }
}

export function spawnTracer(a, b){
  const p = tracers.find(t => !t.active) || tracers[0];
  const arr = p.line.geometry.attributes.position.array;
  arr[0]=a.x; arr[1]=a.y; arr[2]=a.z; arr[3]=b.x; arr[4]=b.y; arr[5]=b.z;
  p.line.geometry.attributes.position.needsUpdate = true;
  p.line.visible = true; p.t = 0; p.active = true;
}
export function spawnPuff(pos){
  const p = puffs.find(t => !t.active); if (!p) return;
  p.s.position.copy(pos); p.s.scale.setScalar(.18);
  p.s.visible = true; p.t = 0; p.active = true;
}
export function spawnDecal(pos, n){
  const p = decals[decalIdx++ % decals.length];
  p.m.position.copy(pos).addScaledVector(n, .012);
  p.m.lookAt(pos.clone().add(n));
  p.m.visible = true; p.m.material.opacity = .85; p.t = 0; p.active = true;
}
export function updateEffects(dt){
  for (const p of tracers){ if (!p.active) continue; p.t += dt;
    if (p.t >= .06){ p.active = false; p.line.visible = false; }
    else p.line.material.opacity = .85*(1 - p.t/.06); }
  for (const p of puffs){ if (!p.active) continue; p.t += dt;
    if (p.t >= .22){ p.active = false; p.s.visible = false; }
    else { const k = p.t/.22; p.s.scale.setScalar(.18+k*.55); p.s.material.opacity = .8*(1-k); } }
  for (const p of decals){ if (!p.active) continue; p.t += dt;
    if (p.t >= 6){ p.active = false; p.m.visible = false; }
    else if (p.t > 5) p.m.material.opacity = .85*(6 - p.t); }
}
