import{Battle}from'./engine.mjs';
export function draftOf(g){return g.plan.filter(u=>!u.team).map(({type,x,y})=>({type,x,y,team:0}));}
export function validateDraft(level,raw){
 if(!Array.isArray(raw)||raw.length>10)return null;
 const g=new Battle(level);for(const u of raw){if(!u||u.team!==0||!g.place(u.type,u.x,u.y,0))return null;}
 return g.plan.map(({type,x,y,team,pid})=>({type,x,y,team,pid}));
}
