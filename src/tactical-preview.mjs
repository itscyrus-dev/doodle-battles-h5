import {TYPES} from './data.mjs';
import {center} from './combat.mjs';
import {clearPath,nextWaypoint} from './terrain.mjs';
function firstIntersection(a,b,rocks){
  const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy;if(!A)return null;let earliest=Infinity;
  for(const o of rocks){const ox=a.x-o.x,oy=a.y-o.y,B=2*(ox*dx+oy*dy),C=ox*ox+oy*oy-o.r*o.r,D=B*B-4*A*C;if(D<0)continue;
    const t=C<=0?0:(-B-Math.sqrt(D))/(2*A);if(t>=0&&t<=1)earliest=Math.min(earliest,t);}
  return Number.isFinite(earliest)?{x:a.x+dx*earliest,y:a.y+dy*earliest}:null;
}
// 与战斗相同的最近目标、身体中心、射程和巨石判定；这里只预估静态接敌，不预测胜负。
export function formationPreview(g,u){
  const enemies=(g.sandbox?g.plan:g.enemy).filter(v=>v.team!==u.team);
  const def=TYPES[u.type],a=center(u);
  if(!enemies.length)return {unit:u,range:def.range,origin:a,target:null,route:[u],blocked:false,status:'先布置敌方，才能预览接敌路线'};
  const target=enemies.reduce((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)<Math.hypot(b.x-u.x,b.y-u.y)?a:b);
  const b=center(target),arrowRocks=g.rocks.map(o=>({...o,y:o.y-24}));
  const blocked=u.type==='archer'&&!clearPath(a,b,arrowRocks);
  const inRange=Math.hypot(a.x-b.x,a.y-b.y)<=def.range+TYPES[target.type].r&&!blocked;
  const route=[{x:u.x,y:u.y}];let p={x:u.x,y:u.y},reachable=true;
  if(!inRange)for(let k=0;k<16;k++){
    const wp=nextWaypoint(p,target,g.rocks,def.r+1),d=Math.hypot(wp.x-p.x,wp.y-p.y);
    if(d<.1){reachable=false;break;}
    let stop=false;
    for(let i=1;i<=Math.ceil(d/6);i++){
      const t=Math.min(1,i*6/d),q={...u,x:p.x+(wp.x-p.x)*t,y:p.y+(wp.y-p.y)*t},c=center(q);
      if(Math.hypot(c.x-b.x,c.y-b.y)<=def.range+TYPES[target.type].r&&(u.type!=='archer'||clearPath(c,b,arrowRocks))){route.push({x:q.x,y:q.y});stop=true;break;}
    }
    if(stop)break;route.push({x:wp.x,y:wp.y});p=wp;
    if(Math.hypot(p.x-target.x,p.y-target.y)<1)break;
    if(k===15)reachable=false;
  }
  return {unit:u,range:def.range,origin:a,target,aim:b,route,blocked,obstruction:blocked?firstIntersection(a,b,arrowRocks):null,inRange,reachable,
    status:!reachable?'当前路线受阻，试试换个落点':blocked?'巨石挡箭 · 需要绕行':inRange?'当前目标已在射程内':u.type==='bomber'?'抛投可以越石 · 虚线为接敌路线':'虚线为静态接敌路线'};
}
