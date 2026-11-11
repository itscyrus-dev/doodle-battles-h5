import {W,H,TYPES,starsFor} from './data.mjs';
import {formationPreview} from './tactical-preview.mjs';
import {UNIT_SCALE,center} from './combat.mjs';
const C={ink:'#344655',skin:'#f5d4a4',skinShade:'#d9a976',metal:'#d7e3e7',metalShade:'#809baa',gold:'#edca79',wood:'#98653f'};
const TEAMS=[{main:'#4c86d7',light:'#91bcec',dark:'#315d9a',cape:'#345c92'},{main:'#d97362',light:'#f6b39b',dark:'#9c4e49',cape:'#ae594e'}];
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,x,y,a,b,color=C.ink,width=2){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();}
function box(c,x,y,w,h,r,fill,stroke=C.ink,width=1.6){c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();if(stroke)c.stroke();}
function gradient(c,y,h,light,dark){const g=c.createLinearGradient(-8,y,13,y+h);g.addColorStop(0,light);g.addColorStop(1,dark);return g;}
function path(c,points,fill,stroke=C.ink,width=1.6){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
function limb(c,x,y,ex,ey,wx,wy,col){line(c,x,y,ex,ey,C.ink,7);line(c,ex,ey,wx,wy,C.ink,6);line(c,x,y,ex,ey,col,4.2);line(c,ex,ey,wx,wy,C.skin,3.5);ellipse(c,wx,wy,3.2,3.2,C.ink);ellipse(c,wx-.4,wy-.5,2.4,2.4,C.skin);}
function drawWeapon(c,u,t,reduced){
  const a=u.angle??(u.team?Math.PI/2:-Math.PI/2),p=u.windupTotal?1-u.windup/u.windupTotal:0;
  const release=u.swing?u.swing/(u.type==='archer'?.22:.28):0;
  const attack=u.windupTotal?-p*.7:u.swing?Math.sin(release*Math.PI)*.9:0;
  c.save();c.translate(0,-20);c.rotate(a);
  if(u.type==='archer'){
    const recoil=reduced?0:Math.sin(release*Math.PI)*2;
    c.translate(-recoil,0);
    limb(c,-2,-7,5,-10,20,-1,TEAMS[u.team||0].main);
    limb(c,-4,6,5,10,11-p*7,0,TEAMS[u.team||0].main);
    c.strokeStyle=C.ink;c.lineWidth=5;c.beginPath();c.moveTo(19,-16);c.quadraticCurveTo(30,0,19,16);c.stroke();
    c.strokeStyle=C.wood;c.lineWidth=2.8;c.stroke();
    line(c,19,-16,11-p*7,0,'#ede6c4',1);line(c,11-p*7,0,19,16,'#ede6c4',1);
    if(!u.swing){line(c,9-p*7,0,30-p*7,0,'#6d4d35',1.5);path(c,[[30-p*7,0],[24-p*7,-3],[24-p*7,3]],C.metal,null);line(c,10-p*7,0,6-p*7,-3,TEAMS[u.team||0].light,2);}
  }else if(u.type==='bomber'){
    const x=13-(reduced?0:p*12),y=-3-(reduced?0:p*9);
    limb(c,-3,-5,5,-10,x,y,TEAMS[u.team||0].main);
    if(!u.swing){ellipse(c,x+4,y-2,7.5,7.5,C.ink);ellipse(c,x+3,y-3,5.8,5.8,gradient(c,-12,12,'#73858b','#303c46'));ellipse(c,x+1,y-6,2,1.6,'#b9c6b8');line(c,x+4,y-9,x+7,y-14,C.wood,2);ellipse(c,x+7,y-14,1.6,1.6,C.gold);}
  }else{
    c.rotate(reduced?-.3:attack-.3);
    limb(c,-3,4,5,9,12,0,TEAMS[u.team||0].main);
    if(u.type==='giant'){
      line(c,8,0,32,0,C.ink,7);line(c,8,0,32,0,C.wood,4.5);
      box(c,27,-12,16,24,4,gradient(c,-12,24,'#e6e5d9','#8b9ca1'));line(c,29,-8,39,-8,'#f9f8dd',2);box(c,25,-5,3,10,1,C.gold);
    }else{
      box(c,8,-2.5,9,5,2,C.wood);
      line(c,17,-7,17,7,C.ink,4);line(c,17,-7,17,7,C.gold,2.2);
      path(c,[[18,-3.4],[35,-3],[41,0],[35,3],[18,3.4]],gradient(c,-4,9,'#f5f4dd','#a3bbc4'));
      line(c,21,-1.4,35,-1.4,'#fff9de',1.1);
    }
  }
  c.restore();
}
export function drawUnit(c,u,time=0,scale=UNIT_SCALE,reduced=false){
  const team=TEAMS[u.team||0],giant=u.type==='giant',a=u.angle??(u.team?Math.PI/2:-Math.PI/2);
  const side=Math.cos(a),front=Math.sin(a)>-.6||Math.abs(side)>.55,walking=u.moving||0;
  const step=reduced?0:Math.sin(u.walk||0)*walking;
  const wind=u.windupTotal?1-u.windup/u.windupTotal:0;
  const age=u.born?Date.now()/1000-u.born:1,pop=!reduced&&age<.3?1+Math.sin(age/.3*Math.PI)*.15:1;
  c.save();c.translate(u.x,u.y);c.scale(scale*(giant?1.38:1)*pop,scale*(giant?1.38:1)*pop);
  ellipse(c,1,3,15,4.5,'#32483725');ellipse(c,1,3,9,2.5,'#32483715');
  if(u.death){c.globalAlpha=1-u.death;c.rotate(u.death*(side<0?-1:1)*1.5);c.translate(0,u.death*5);}
  if(!reduced){c.translate(Math.cos(u.hitAngle||0)*(u.recoil||0)*13,-Math.abs(step)*1.6);c.rotate((walking?side*.045:0)+(u.recoil||0)*.5);}
  // 双腿交替抬起，靴底、裤腿和手臂分层。
  for(const [i,x]of [[0,-6],[1,6]]){const z=step*(i?-1:1);line(c,x,-8,x+z*2,-1,C.ink,7);line(c,x,-8,x+z*2,-1,team.dark,4.2);box(c,x-4+z*2,-3-Math.max(0,z)*2,9,6,2.6,gradient(c,-4,8,'#6f7776','#344656'),C.ink,1.2);}
  const flutter=reduced?0:Math.sin((u.walk||time*2)+u.x)*1.6;
  path(c,[[-11,-27],[10,-27],[13+flutter,-7],[0,-10],[-12+flutter,-6]],team.cape);
  if(!front)drawWeapon(c,u,time,reduced);
  box(c,-11,-24,22,19,6,gradient(c,-24,20,team.light,team.main));
  box(c,-9,-9,18,4,1.5,'#7c6552',null);box(c,-2.5,-10,5,5,1,C.gold,C.ink,1);
  if(front){path(c,[[-7,-23],[7,-23],[8,-15],[0,-11],[-8,-15]],gradient(c,-24,16,'#e1e9db','#9fbbb8'),C.ink,1.1);line(c,-4,-20,4,-20,'#f8f5df',1.5);}
  else{line(c,-7,-19,6,-10,team.light,2);ellipse(c,0,-19,2,2,C.gold);}
  ellipse(c,side*1.4,-31,13.3,13.3,C.ink);
  ellipse(c,side*1.4,-31.5,11.7,11.7,gradient(c,-43,23,'#ffe7bf',C.skinShade));
  // 头部根据实际朝向显示正面、侧面或背面，避免正脸身体向后射击。
  if(front){
    const look=side*3;
    ellipse(c,look-4,-31,1.5,2.1,C.ink);ellipse(c,look+4,-31,1.5,2.1,C.ink);
    ellipse(c,look-4.3,-31.7,.45,.6,'#fff5dd');ellipse(c,look+3.7,-31.7,.45,.6,'#fff5dd');
    ellipse(c,look-7.5,-27,2,1.2,'#e6ab8a66');ellipse(c,look+7.5,-27,2,1.2,'#e6ab8a66');
    line(c,look-1.7,-26.2,look+1.7,-26.2,'#a06e56',1.2);
  }
  if(u.type==='archer'){
    c.fillStyle=gradient(c,-46,25,team.light,team.dark);c.strokeStyle=C.ink;c.lineWidth=1.7;c.beginPath();c.moveTo(-13,-28);c.quadraticCurveTo(-16,-44,-3,-47);c.quadraticCurveTo(12,-47,15,-29);c.lineTo(8,-32);c.quadraticCurveTo(3,-45,-7,-34);c.lineTo(-10,-26);c.closePath();c.fill();c.stroke();
    if(!front)ellipse(c,0,-33,10.5,10,team.main);
    line(c,-7,-43,1,-45,'#d9e4b677',1.5);
    path(c,[[-9,-20],[-17,-16],[-13,-10]],team.main);
  }else if(u.type==='bomber'){
    box(c,-13,-43,26,15,6,gradient(c,-44,18,'#f3d584','#ba9452'));
    if(front){for(const x of [-8,3]){box(c,x-2,-36,9,8,3,C.ink);box(c,x-.5,-34.7,6,5.2,2,gradient(c,-35,6,'#d9f0e4','#6ea4ac'),null);line(c,x,-34,x+3,-34,'#eef6e6',1);}}
    else line(c,-10,-34,10,-34,'#816b46',3);
    box(c,-9,-22,18,12,3,'#8c7755',C.ink,1.2);for(const x of [-5,2])box(c,x,-20,4,7,1,C.gold,C.ink,.7);
  }else if(giant){
    box(c,-15,-45,30,17,7,gradient(c,-45,19,'#c2c2d6','#777f9a'));
    box(c,-17,-24,10,10,3,C.metal);box(c,7,-24,10,10,3,C.metal);
    path(c,[[-11,-43],[-18,-48],[-16,-35],[-11,-35]],C.gold);path(c,[[11,-43],[18,-48],[16,-35],[11,-35]],C.gold);
    line(c,-6,-41,7,-41,'#ede7e7',1.5);
  }else{
    box(c,-14,-44,28,17,6,gradient(c,-45,21,team.light,team.dark));
    path(c,[[-14,-31],[-10,-26],[-6,-31]],team.main);path(c,[[14,-31],[10,-26],[6,-31]],team.main);
    line(c,-11,-32,11,-32,C.ink,2);line(c,-9,-40,6,-40,'#d5e5f0aa',1.8);
    box(c,-2,-45,4,13,1.5,gradient(c,-45,13,C.gold,'#b89653'),C.ink,.9);
    if(u.type==='guard')path(c,[[-3,-46],[-2,-51],[7,-50],[10,-47]],team.dark);
    if(!front)box(c,-10,-32,20,9,3,gradient(c,-33,10,team.main,team.dark),null);
  }
  if(front)drawWeapon(c,u,time,reduced);
  if(u.type==='guard'){
    c.save();c.translate(side<0?-13:12,-16);c.rotate(side*.15);
    path(c,[[-8,-10],[7,-10],[8,0],[5,9],[0,13],[-6,8],[-9,0]],gradient(c,-10,24,C.gold,'#b28b4d'));
    path(c,[[-5,-7],[4,-7],[5,0],[2,7],[0,9],[-4,5],[-6,0]],team.main,C.ink,1);
    if(u.blockFlash>0){c.save();c.globalAlpha=u.blockFlash/.24*.8;path(c,[[-9,-10],[8,-10],[9,0],[5,10],[0,14],[-7,8],[-10,0]],'#d9f6ef','#f9fff2',2);c.restore();}
    line(c,0,-5,0,5,'#e7d9ac',2);line(c,-4,-1,4,-1,'#e7d9ac',2);ellipse(c,-5,-6,1,1,'#fff0cb');c.restore();
  }
  if(u.flash>0){c.globalAlpha=u.flash/.13*.7;ellipse(c,side*2,-32,10,10,'#fff6cc');box(c,-8,-23,16,15,4,'#fff3c6',null);}
  c.restore();
  if(!u.death&&u.threat>0){c.save();c.strokeStyle='#c87764';c.lineWidth=2;c.beginPath();c.ellipse(u.x,u.y+2,19,7,0,0,Math.PI*2);c.stroke();box(c,u.x-6,u.y-76,12,16,5,'#fae4c9','#c87764',1);c.fillStyle='#a86054';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('!',u.x,u.y-64);c.restore();}
  if(!u.death&&u.hp>0&&u.hp<u.max){const width=giant?38:29,y=u.y-(giant?86:65);box(c,u.x-width/2,y,width,4.5,2,'#485d4740',null);box(c,u.x-width/2,y,width*Math.max(0,u.hp/u.max),4.5,2,team.main,null);}
}
function effect(c,f,reduced){
  const p=f.t/f.life,alpha=1-p,team=TEAMS[f.team||0];c.save();c.translate(f.x,f.y);c.globalAlpha=alpha;
  if(f.kind==='death'){
    if(!reduced)drawUnit(c,{...f.unit,x:0,y:0,flash:0,death:p},0,UNIT_SCALE,false);
    for(let i=0;i<5;i++)ellipse(c,Math.cos(i*1.7)*p*20,-4+Math.sin(i*1.7)*p*9,3+p*3,2+p*2,'#dfd4b5');
  }else if(f.kind==='heal'){
    c.strokeStyle='#72a17f';c.lineWidth=2;c.beginPath();c.ellipse(0,0,12+p*28,5+p*10,0,0,Math.PI*2);c.stroke();
    line(c,-4,-25-p*15,4,-25-p*15,'#69a780',3);line(c,0,-29-p*15,0,-21-p*15,'#69a780',3);
  }else if(!reduced&&f.kind==='slash'){
    c.rotate(f.angle);c.strokeStyle=f.heavy?'#f1cb7ec9':'#fff4c8dd';c.lineWidth=f.heavy?7:4;
    c.beginPath();c.arc(0,0,(f.heavy?36:29)+p*7,-.8+p,.7+p);c.stroke();
    c.strokeStyle=team.light;c.lineWidth=1.3;c.beginPath();c.arc(0,0,34+p*6,-.5+p,.8+p);c.stroke();
  }else if(f.kind==='boom'){
    c.fillStyle='#ebbc6a18';c.strokeStyle='#d4a567';c.lineWidth=1.5;c.beginPath();c.arc(0,0,48,0,Math.PI*2);c.fill();c.stroke();
    if(reduced){c.restore();return;}
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ellipse(c,Math.cos(a)*p*30,Math.sin(a)*p*24,8+p*7,7+p*6,p<.25?'#ffde8a':'#d9c8a5');}
    c.strokeStyle='#e9b66d';c.lineWidth=3*(1-p);c.beginPath();c.arc(0,0,5+p*47,0,Math.PI*2);c.stroke();
  }else if(!reduced&&['hit','block','release'].includes(f.kind)){
    if(f.kind==='block'&&f.actor){c.font='bold 11px sans-serif';c.textAlign='center';c.fillStyle='#477f8a';c.fillText('格挡',0,-18-p*8);}
    c.rotate(f.angle||0);const block=f.kind==='block',release=f.kind==='release';
    if(!release){path(c,[[-7,-3],[-4,-12],[0,-5],[8,-8],[5,0],[12,5],[3,5],[0,12],[-3,5],[-11,5]],block?'#d5eced':'#fff0a9',null);}
    for(let i=0;i<(release?3:6);i++){const a=i*2.4,r=5+p*(release?10:24),x=Math.cos(a)*r,y=Math.sin(a)*r;line(c,x,y,x+Math.cos(a)*4,y+Math.sin(a)*4,block?'#b6d5de':'#e9bd61',2*(1-p)+.4);}
  }else if(!reduced&&f.kind==='dust')ellipse(c,0,0,2+p*6,1+p*2,'#d5c59e66');
  c.restore();
}
export class Renderer{
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.resize();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;new ResizeObserver(()=>this.resize()).observe(canvas);}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.scale=Math.min(this.canvas.width/W,this.canvas.height/H);this.ox=(this.canvas.width-W*this.scale)/2;this.oy=(this.canvas.height-H*this.scale)/2;this.fieldCache=null;}
  // 震屏只在表现层偏移画面；减少动效模式下不震。
  kick(amount){if(!this.reduced)this.shake=Math.min(9,(this.shake||0)+amount);}
  // 静态草地只在尺寸变化时画一次，之后每帧直接贴图，减轻手机的绘制压力。
  field(){
    if(this.fieldCache)return this.fieldCache;
    if(!this.canvas.width||!this.canvas.height)return null;
    const k=document.createElement('canvas');k.width=this.canvas.width;k.height=this.canvas.height;
    const c=k.getContext('2d');c.setTransform(this.scale,0,0,this.scale,this.ox,this.oy);
    const bg=c.createRadialGradient(260,290,30,260,310,460);bg.addColorStop(0,'#f6f1db');bg.addColorStop(1,'#dce5cb');c.fillStyle=bg;c.fillRect(0,0,W,H);
    for(let i=0;i<190;i++){const x=(i*137.73)%W,y=(i*73.43)%H;ellipse(c,x,y,i%4?1:2,.7,i%3?'#8e9e6e1c':'#a5a07228');}
    for(let i=0;i<38;i++){const x=(i*149.7)%W,y=(i*71.2)%H;if(x>45&&x<W-45)continue;line(c,x,y,x-3,y-5,'#91a57a77',1.3);line(c,x,y,x+4,y-4,'#91a57a77',1.3);if(i%4===0){ellipse(c,x+5,y-5,2,2,'#fbf5df');ellipse(c,x+6,y-6,1,1,'#d2b76a');}}
    return this.fieldCache=k;
  }
  // 胜负揭晓的横幅：在战报弹出前停顿片刻，让最后一击和倒地动作播完。
  drawBanner(c,g,t){
    this.endSeen??=t;const age=t-this.endSeen,grow=this.reduced?1:Math.min(1,age/.25),pop=this.reduced?1:1+Math.sin(grow*Math.PI)*.08;
    const won=g.phase==='won',timeout=!won&&g.units.some(u=>u.team===0&&u.hp>0);
    const title=g.sandbox?(won?'蓝队获胜':timeout?'时间到':'红队获胜'):won?'胜 利':timeout?'时间到':'全军覆没';
    const note=g.sandbox?`用时 ${g.elapsed.toFixed(1)} 秒`:won?'':timeout?'80秒内没能分出胜负':'调整布阵，再来一次';
    c.save();c.globalAlpha=grow*.55;c.fillStyle='#f7f4e6';c.fillRect(0,0,W,H);c.globalAlpha=grow;
    c.translate(W/2,H/2-24);c.scale(pop,pop);c.rotate(-.025);
    box(c,-150,-46,300,92,20,won?'#fff6dc':'#f9ebe4',won?'#d9b458':'#d99b8b',2.5);
    c.textAlign='center';c.textBaseline='middle';c.fillStyle=won?'#3f6fc4':'#b5604f';c.font='800 34px ui-rounded,"PingFang SC","Microsoft YaHei",sans-serif';c.fillText(title,0,-12);
    if(won&&!g.sandbox){const stars=starsFor(g);c.font='22px sans-serif';for(let i=0;i<3;i++){if(!this.reduced&&age<.3+i*.16)continue;c.fillStyle=i<stars?'#e0a93a':'#d3cfc1';c.fillText(i<stars?'★':'☆',(i-1)*32,26);}}
    else{c.font='13px ui-rounded,"PingFang SC","Microsoft YaHei",sans-serif';c.fillStyle='#8c7f72';c.fillText(note,0,24);}
    c.restore();
  }
  point(e){const r=this.canvas.getBoundingClientRect();return{x:((e.clientX-r.left)*this.canvas.width/r.width-this.ox)/this.scale,y:((e.clientY-r.top)*this.canvas.height/r.height-this.oy)/this.scale};}
  inspect(g){
    if(g.phase!=='build'||this.drag?.recycle||this.drag?.valid===false)return null;
    const u=this.drag?{...this.drag.unit,type:this.drag.type,team:this.drag.team,x:this.drag.x,y:this.drag.y}:g.plan.find(u=>u.pid===this.selectedPid);
    if(!u)return null;
    const key=JSON.stringify([u,g.plan,g.enemy,g.rocks,g.sandbox]);
    if(key!==this.previewKey){this.previewKey=key;this.preview=formationPreview(g,u);}return this.preview;
  }
  drawInspection(c,p){
    if(!p)return;c.save();c.beginPath();c.rect(0,0,W,H);c.clip();
    c.fillStyle='#7297d912';c.strokeStyle='#678fc58a';c.lineWidth=1.4;c.setLineDash([5,6]);c.beginPath();c.arc(p.origin.x,p.origin.y,p.range,0,Math.PI*2);c.fill();c.stroke();
    c.setLineDash([4,5]);c.strokeStyle='#5a8e72';c.lineWidth=2;c.beginPath();p.route.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.setLineDash([]);
    if(p.route.length>1){const end=p.route.at(-1);ellipse(c,end.x,end.y,5,3,'#80a57a');}
    if(p.target){c.setLineDash([3,6]);line(c,p.origin.x,p.origin.y,p.aim.x,p.aim.y,p.blocked?'#c87764aa':'#d0a96c88',1.4);c.setLineDash([]);c.strokeStyle='#ce9074';c.lineWidth=1.5;c.beginPath();c.ellipse(p.target.x,p.target.y+2,17,6,0,0,Math.PI*2);c.stroke();
      if(p.blocked){const mx=p.obstruction?.x??(p.origin.x+p.aim.x)/2,my=p.obstruction?.y??(p.origin.y+p.aim.y)/2;line(c,mx-5,my-5,mx+5,my+5,'#bf7564',2);line(c,mx+5,my-5,mx-5,my+5,'#bf7564',2);}}
    c.strokeStyle='#628cca';c.lineWidth=2.4;c.beginPath();c.ellipse(p.unit.x,p.unit.y+3,19,7,0,0,Math.PI*2);c.stroke();c.restore();
  }
  draw(g,t){
    const c=this.c,build=g.phase==='build';
    const dt=Math.min(.05,Math.max(0,t-(this.lastT??t)));this.lastT=t;this.shake=this.shake>.15?this.shake*Math.exp(-dt*11):0;
    const sx=this.shake?(Math.random()-.5)*2*this.shake*this.scale:0,sy=this.shake?(Math.random()-.5)*2*this.shake*this.scale:0;
    c.setTransform(1,0,0,1,0,0);c.fillStyle='#e7ecdc';c.fillRect(0,0,this.canvas.width,this.canvas.height);
    const field=this.field();if(field)c.drawImage(field,sx,sy);
    c.setTransform(this.scale,0,0,this.scale,this.ox+sx,this.oy+sy);
    if(build){c.fillStyle='#b2d0e51b';c.fillRect(0,315,W,H-315);c.fillStyle='#eaa18d16';c.fillRect(0,0,W,285);}
    if(build){c.setLineDash([4,8]);line(c,28,300,W-28,300,'#a8ad9160',1.5);c.setLineDash([]);c.font='10px sans-serif';c.textAlign='center';c.fillStyle='#b79c85';c.fillText(g.sandbox?'红方布阵区':'敌方阵地',W/2,65);c.fillStyle='#819c96';c.fillText('我 方 布 阵 区',W/2,332);}
    // 巨石按脚底圆形参与碰撞；明暗与苔藓只是同一碰撞物的绘制。
    for(const o of g.rocks){
      if(build)ellipse(c,o.x,o.y,o.r,o.r,'#87976918');
      ellipse(c,o.x+3,o.y+7,o.r+5,o.r*.43,'#40503528');
      const stone=c.createLinearGradient(o.x-o.r,o.y-o.r,o.x+o.r,o.y+12);stone.addColorStop(0,'#c6ccb7');stone.addColorStop(.5,'#9da997');stone.addColorStop(1,'#6e8278');
      c.fillStyle=stone;c.strokeStyle='#61776b';c.lineWidth=2;c.beginPath();c.moveTo(o.x-o.r,o.y);c.lineTo(o.x-o.r*.8,o.y-o.r*.65);c.lineTo(o.x-o.r*.2,o.y-o.r*.93);c.lineTo(o.x+o.r*.65,o.y-o.r*.7);c.lineTo(o.x+o.r,o.y-4);c.lineTo(o.x+o.r*.5,o.y+o.r*.28);c.lineTo(o.x-o.r*.5,o.y+o.r*.28);c.closePath();c.fill();c.stroke();
      line(c,o.x-o.r*.6,o.y-o.r*.6,o.x+o.r*.1,o.y-o.r*.75,'#e2e5cd',2);
      line(c,o.x+o.r*.3,o.y-o.r*.65,o.x+o.r*.1,o.y-3,'#7c8f82',1.5);
      for(let i=0;i<5;i++)ellipse(c,o.x-o.r*.6+i*o.r*.28,o.y+4+Math.sin(i*2)*4,7,3.5,'#879d6e');
    }
    if(build)this.drawInspection(c,this.inspect(g));
    const units=(build?[...g.plan,...(g.sandbox?[]:g.enemy)]:g.units.filter(u=>u.hp>0)).slice().sort((a,b)=>a.y-b.y);
    const time=g.phase==='paused'?g.elapsed:t;
    if(this.drag&&!this.drag.recycle){const d=this.drag;c.save();c.strokeStyle=d.valid?'#648d73':'#c87764';c.fillStyle=d.valid?'#97bd8d35':'#df96843a';c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.ellipse(d.x,d.y,23,10,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
    for(const u of units){
      if(!build&&u.team===0){
        if(g.effects.smoke>0){c.save();c.globalAlpha=.25;for(let i=0;i<3;i++)ellipse(c,u.x+(this.reduced?0:Math.sin(time*2+i*2)*12),u.y-18+i*4,18,12,'#afc3c8');c.restore();}
        if(g.effects.rally>0){c.strokeStyle='#d4b25f';c.lineWidth=2;c.beginPath();c.ellipse(u.x,u.y+3,18,6,0,0,Math.PI*2);c.stroke();if(!this.reduced)line(c,u.x-20,u.y-15,u.x-12,u.y-15,'#d4b25f',2);}
      }
      c.save();if(this.drag?.unit?.pid===u.pid&&u.pid!==undefined)c.globalAlpha=.22;drawUnit(c,u,time,UNIT_SCALE,this.reduced);c.restore();}
    if(build&&!this.drag)for(const ghost of this.guideGhosts||[]){
      if(g.placementError(ghost.type,ghost.x,ghost.y,ghost.team))continue;
      c.save();c.globalAlpha=.22;drawUnit(c,ghost,0,UNIT_SCALE,true);c.globalAlpha=.65;c.strokeStyle='#a7a678';c.lineWidth=1.5;c.setLineDash([4,4]);c.beginPath();c.ellipse(ghost.x,ghost.y+3,19,7,0,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font='10px sans-serif';c.textAlign='center';c.fillStyle='#7a8a65';c.fillText(`试放${TYPES[ghost.type].name}`,ghost.x,ghost.y+20);c.restore();
    }
    for(const s of g.shots){
      c.save();c.translate(s.x,s.y);
      if(s.type==='bomber'){
        const progress=Math.min(1,s.t*s.speed/(s.distance||1)),lift=Math.sin(progress*Math.PI)*35;
        ellipse(c,0,12,4,1.5,'#4c594226');c.translate(0,-lift);c.rotate(s.t*8);
        ellipse(c,0,0,5.5,5.5,C.ink);ellipse(c,-1,-1,3.8,3.8,'#697b7e');line(c,1,-5,4,-8,C.wood,1.5);ellipse(c,4,-8,1.4,1.4,C.gold);
      }else{
        c.rotate(s.angle);const col=TEAMS[s.team||0].light;
        line(c,-17,0,-5,0,`${col}55`,2);line(c,-10,0,5,0,'#8b6946',1.6);path(c,[[8,0],[2,-2.7],[2,2.7]],C.metal,null);
        line(c,-9,0,-13,-3,col,2);line(c,-9,0,-13,3,col,2);
      }c.restore();
    }
    for(const f of g.fx)effect(c,f,this.reduced);
    if(g.phase==='won'||g.phase==='lost')this.drawBanner(c,g,t);else this.endSeen=null;
    if(g.phase==='paused'){c.fillStyle='#f7f4e6a0';c.fillRect(0,0,W,H);c.fillStyle=C.ink;c.font='bold 28px sans-serif';c.textAlign='center';c.fillText('休息一下',W/2,H/2);c.font='14px sans-serif';c.fillText('点击下方按钮继续',W/2,H/2+30);}
    c.setTransform(1,0,0,1,0,0);
  }
}
