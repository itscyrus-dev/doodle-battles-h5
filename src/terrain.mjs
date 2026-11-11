import {segmentDistance} from './combat.mjs';
export function clearPath(a,b,rocks,pad=0){return rocks.every(o=>segmentDistance(o.x,o.y,a.x,a.y,b.x,b.y)>o.r+pad);}
// 静态圆形障碍的可视图寻路；绕行点留出身体半径，禁止穿石。
export function nextWaypoint(start,goal,rocks,radius){
  if(clearPath(start,goal,rocks,radius))return goal;
  const nodes=[start,goal];
  for(const o of rocks)for(let i=0;i<8;i++){
    const a=i*Math.PI/4,p={x:o.x+Math.cos(a)*(o.r+radius+12),y:o.y+Math.sin(a)*(o.r+radius+12)};
    if(p.x>22&&p.x<498&&p.y>60&&p.y<595&&rocks.every(v=>Math.hypot(p.x-v.x,p.y-v.y)>v.r+radius))nodes.push(p);
  }
  const n=nodes.length,dist=Array(n).fill(Infinity),prev=Array(n).fill(-1),visited=new Set();dist[0]=0;
  for(let k=0;k<n;k++){
    let u=-1;for(let i=0;i<n;i++)if(!visited.has(i)&&(u<0||dist[i]<dist[u]))u=i;
    if(u<0||!Number.isFinite(dist[u]))break;if(u===1)break;visited.add(u);
    for(let v=0;v<n;v++)if(v!==u&&!visited.has(v)&&clearPath(nodes[u],nodes[v],rocks,radius)){
      const d=dist[u]+Math.hypot(nodes[u].x-nodes[v].x,nodes[u].y-nodes[v].y);if(d<dist[v]){dist[v]=d;prev[v]=u;}
    }
  }
  if(prev[1]<0)return start;
  let v=1;while(prev[v]>0)v=prev[v];return nodes[v];
}
export function resolveRocks(unit,rocks,radius){
  for(let k=0;k<3;k++)for(const o of rocks){let dx=unit.x-o.x,dy=unit.y-o.y,d=Math.hypot(dx,dy),r=o.r+radius;if(d<r){if(d<.001){dx=1;dy=0;d=1;}unit.x=o.x+dx/d*(r+.1);unit.y=o.y+dy/d*(r+.1);}}
}
