import * as THREE from 'three';
import { terrainHeight } from './world.js';

const NODES = [
  ['A',-200,18], ['B',-100,-42], ['C',0,0], ['D',100,42], ['E',200,-18],
  ['AB',-150,-12], ['BC',-50,-21], ['CD',50,21], ['DE',150,12],
  ['ABn',-150,-62], ['BCn',-50,-58], ['CDn',50,70], ['DEn',152,64],   // north flank
  ['ABs',-150,48], ['BCs',-52,34], ['CDs',50,-34], ['DEs',150,-58],   // south flank
  ['RW',-205,66], ['RW2',-168,86],                                    // airstrip branch
].map(([id,x,z]) => ({ id, x, z }));

const EDGES = [ // [a, b, isMainRoad?]
  ['A','AB',1],['AB','B',1],['B','BC',1],['BC','C',1],['C','CD',1],['CD','D',1],['D','DE',1],['DE','E',1],
  ['AB','ABn'],['ABn','B'],['BC','BCn'],['BCn','C'],['CD','CDn'],['CDn','D'],['DE','DEn'],['DEn','E'],
  ['AB','ABs'],['ABs','B'],['BC','BCs'],['BCs','C'],['CD','CDs'],['CDs','D'],['DE','DEs'],['DEs','E'],
  ['ABn','BCn'],['BCn','CDn'],['CDn','DEn'],
  ['ABs','BCs'],['BCs','CDs'],['CDs','DEs'],
  ['A','RW'],['RW','RW2'],['RW','ABs'],
];

const byId = {}; NODES.forEach(n => byId[n.id] = n);
const adj = {};  NODES.forEach(n => adj[n.id] = []);
for (const [a, b, road] of EDGES){
  const na = byId[a], nb = byId[b];
  const w = Math.hypot(na.x-nb.x, na.z-nb.z)
          + 2*Math.abs(terrainHeight(na.x,na.z) - terrainHeight(nb.x,nb.z));
  adj[a].push({ id:b, w, road:!!road });
  adj[b].push({ id:a, w, road:!!road });
}
const heur = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);

export function nearestNode(x, z){
  let best = null, bd = Infinity;
  for (const n of NODES){ const d = (n.x-x)**2 + (n.z-z)**2; if (d < bd){ bd = d; best = n; } }
  return best;
}
export function findPath(sx, sz, tx, tz, roadPenalty = 1){
  const start = nearestNode(sx,sz), goal = nearestNode(tx,tz);
  if (start.id === goal.id) return [{ x:sx, z:sz }, { x:tx, z:tz }];
  const open = new Set([start.id]);
  const g = { [start.id]: 0 }, from = {}, f = { [start.id]: heur(start, goal) };
  while (open.size){
    let cur = null, best = Infinity;
    for (const id of open){ const v = f[id] ?? Infinity; if (v < best){ best = v; cur = id; } }
    if (cur === goal.id){
      const pts = [{ x:tx, z:tz }];
      let c = cur;
      while (c !== start.id){ pts.push({ x:byId[c].x, z:byId[c].z }); c = from[c]; }
      pts.push({ x:sx, z:sz });
      return pts.reverse();
    }
    open.delete(cur);
    for (const e of adj[cur]){
      const ng = g[cur] + e.w * (e.road ? roadPenalty : 1);
      if (ng < (g[e.id] ?? Infinity)){
        g[e.id] = ng; from[e.id] = cur;
        f[e.id] = ng + heur(byId[e.id], goal);
        open.add(e.id);
      }
    }
  }
  return [{ x:sx, z:sz }, { x:tx, z:tz }]; // fallback: straight line
}
export function buildPathDebug(scene){
  const pts = [];
  for (const [a,b] of EDGES){
    const na = byId[a], nb = byId[b];
    pts.push(na.x, terrainHeight(na.x,na.z)+0.4, na.z, nb.x, terrainHeight(nb.x,nb.z)+0.4, nb.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(g,
    new THREE.LineBasicMaterial({ color:0xffee00, transparent:true, opacity:0.5 })));
}
