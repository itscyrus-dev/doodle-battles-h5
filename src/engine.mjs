import {TYPES,LEVELS,W,H,TEAM_LIMIT,ITEMS} from './data.mjs';
import {ANGLE_TOLERANCE,wrapAngle,turnTowards,center,muzzle,segmentDistance} from './combat.mjs';
import {clearPath,nextWaypoint,resolveRocks} from './terrain.mjs';
export class Battle {
  constructor(level=0,sandbox=false) {
    Object.assign(this,{level,sandbox,plan:[],history:[],phase:'build',units:[],shots:[],fx:[],events:[],elapsed:0,healed:false,serial:0});
    this.budget=LEVELS[level].budget;
    this.enemy=structuredClone(LEVELS[level].enemies);
    this.rocks=sandbox?[]:structuredClone(LEVELS[level].rocks);this.selectedItem='heal';this.itemUsed=false;this.effects={rally:0,smoke:0};
  }
  get spent(){return this.plan.filter(u=>u.team===0).reduce((s,u)=>s+TYPES[u.type].cost,0)}
  get remaining(){return this.budget-this.spent}
  count(type,team=0,ignoreId=null){return this.plan.filter(u=>u.team===team&&(!type||u.type===type)&&(ignoreId===null||u.pid!==ignoreId)).length;}
  beginStroke(){if(this.phase==='build'){this.history.push(structuredClone(this.plan));if(this.history.length>64)this.history.shift();}}
  placementError(type,x,y,team=0,ignoreId=null){
    if(this.phase!=='build')return '开战后不能调整阵容';
    if(!TYPES[type]||![0,1].includes(team)||!Number.isFinite(x)||!Number.isFinite(y))return '无效的布阵位置';
    if(x<25||x>W-25||y<65||y>H-35)return '请放在战场范围内';
    if((!this.sandbox&&(team!==0||y<335))||(this.sandbox&&((team===0&&y<335)||(team===1&&y>285))))return team===0?'请放在下方蓝色布阵区':'请放在上方红色布阵区';
    if(this.rocks.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+TYPES[type].r+3))return '巨石占据这里，换个落点';
    if(this.count(null,team,ignoreId)>=TEAM_LIMIT)return `全队最多 ${TEAM_LIMIT} 人，先回收一名士兵`;
    if(this.count(type,team,ignoreId)>=TYPES[type].limit)return `${TYPES[type].name}最多 ${TYPES[type].limit} 名`;
    const current=ignoreId===null?null:this.plan.find(u=>u.pid===ignoreId);
    if(!this.sandbox&&this.remaining+(current?.team===0?TYPES[current.type].cost:0)<TYPES[type].cost)return '墨水不够，换个兵种或回收士兵';
    if(this.plan.some(u=>(ignoreId===null||u.pid!==ignoreId)&&Math.hypot(u.x-x,u.y-y)<Math.max(27,(TYPES[u.type].r+TYPES[type].r)*.9)))return '这里已有士兵，稍微拉开一点';
    return '';
  }
  place(type,x,y,team=0){
    if(this.placementError(type,x,y,team))return false;
    this.plan.push({type,x,y,team,pid:this.serial++,born:Date.now()/1000});return true;
  }
  move(pid,x,y){
    const u=this.plan.find(u=>u.pid===pid);
    if(!u||this.placementError(u.type,x,y,u.team,pid))return false;
    if(Math.hypot(x-u.x,y-u.y)<.5)return true;
    this.beginStroke();u.x=x;u.y=y;return true;
  }
  remove(pid){
    if(this.phase!=='build'||!this.plan.some(u=>u.pid===pid))return false;
    this.beginStroke();this.plan=this.plan.filter(u=>u.pid!==pid);return true;
  }
  erase(x,y){if(this.phase==='build')this.plan=this.plan.filter(u=>Math.hypot(u.x-x,u.y-y)>30)}
  undo(){if(this.phase==='build'&&this.history.length)this.plan=this.history.pop()}
  clear(){if(this.phase==='build'){this.beginStroke();this.plan=[];}}
  start(){
    if(this.phase!=='build'||!this.plan.some(u=>u.team===0)||!(this.sandbox?this.plan.some(u=>u.team===1):this.enemy.length))return false;
    this.units=[...this.plan,...(this.sandbox?[]:this.enemy)].map((u,i)=>({...u,id:i,hp:TYPES[u.type].hp,max:TYPES[u.type].hp,
      cool:.2+(i%5)*.07,flash:0,swing:0,walk:0,moving:0,angle:u.team===0?-Math.PI/2:Math.PI/2,
      windup:0,windupTotal:0,targetId:null,recoil:0,hitAngle:0,dx:0,dy:u.team===0?-1:1,damageDealt:0,damageTaken:0,deathAt:null,blockFlash:0,threat:0}));
    Object.assign(this,{phase:'battle',elapsed:0,healed:false,shots:[],fx:[]});
    this.itemUsed=false;this.effects={rally:0,smoke:0};this.itemStats={healed:0,prevented:0,boostedAttacks:0};
    this.feedback=null;
    this.stats=[0,1].map(()=>({blocked:0,explosionTaken:0,damageTaken:0,backlineDeaths:0,stoneArrows:0,arrowsFired:0,firstLoss:null,byType:Object.fromEntries(Object.keys(TYPES).map(type=>[type,{dealt:0,taken:0,kills:0}]))}));return true;
  }
  selectItem(id){if(this.phase!=='build'||typeof id!=='string'||!Object.hasOwn(ITEMS,id))return false;this.selectedItem=id;return true;}
  get canUseItem(){return this.phase==='battle'&&!this.itemUsed&&(this.selectedItem!=='heal'||this.canHeal);}
  useItem(){
    if(!this.canUseItem)return false;
    if(this.selectedItem==='heal'){if(!this.heal())return false;this.itemStats.healed=this.healSummary.amount;}
    else this.effects[this.selectedItem]=ITEMS[this.selectedItem].duration;
    this.itemUsed=true;if(!this.feedback||this.feedback.kind!=='rear'||this.feedback.until<=this.elapsed)this.feedback={kind:'item',message:this.selectedItem==='heal'?`${this.healSummary.targets}名伤员恢复 ${Math.round(this.healSummary.amount)} 生命`:`${ITEMS[this.selectedItem].name}已生效`,until:this.elapsed+1.5};this.events.push('item');return true;
  }
  get canHeal(){return this.phase==='battle'&&!this.healed&&this.units.some(u=>u.team===0&&u.hp>0&&u.hp<u.max);}
  heal(){
    if(!this.canHeal)return false;
    this.healed=true;this.healSummary={targets:0,amount:0};
    for(const u of this.units)if(u.team===0&&u.hp>0&&u.hp<u.max){
      const amount=Math.min(u.max-u.hp,u.max*.3);u.hp+=amount;
      this.healSummary.targets++;this.healSummary.amount+=amount;this.effect(u.x,u.y,'heal');
    }
    return true;
  }
  effect(x,y,kind,team=0,extra={}){
    this.fx.push({x,y,kind,team,t:0,life:kind==='death'?.6:kind==='boom'?.5:.32,...extra});
  }
  hit(u,amount,source,ranged=false){
    if(u.hp<=0)return;
    const blocked=u.type==='guard'&&ranged,guardDamage=amount*(blocked?.55:1);
    const smoked=u.team===0&&ranged&&source?.type==='archer'&&this.effects.smoke>0;
    const damage=guardDamage*(smoked?.35:1);if(smoked)this.itemStats.prevented+=guardDamage-damage;
    const actual=Math.min(u.hp,damage),stats=this.stats?.[u.team];
    if(stats){stats.damageTaken+=actual;if(blocked)stats.blocked+=amount-guardDamage;if(source?.type==='bomber')stats.explosionTaken+=actual;}
    if(stats?.byType){stats.byType[u.type].taken+=actual;u.damageTaken+=actual;}
    const ownerId=source?.ownerId??source?.id,owner=Number.isInteger(ownerId)?this.units.find(v=>v.id===ownerId):null;
    if(owner&&owner.team!==u.team){owner.damageDealt+=actual;this.stats[owner.team].byType[owner.type].dealt+=actual;if(u.hp-damage<=0)this.stats[owner.team].byType[owner.type].kills++;}
    if(blocked){u.blockFlash=.24;this.events.push('block');}
    if(!ranged&&['archer','bomber'].includes(u.type)){
      u.threat=.95;if(u.team===0&&(!this.feedback||this.feedback.until<=this.elapsed||this.feedback.kind!=='rear'))this.feedback={kind:'rear',message:'后排被近战接触 · 注意保护',until:this.elapsed+1.6};
    }
    u.hp-=damage;u.flash=.13;u.recoil=.18;
    u.hitAngle=source?Math.atan2(u.y-source.y,u.x-source.x):0;
    const p=center(u);
    this.effect(p.x,p.y,blocked?'block':'hit',u.team,{angle:u.hitAngle,actor:true});this.events.push('hit');
    if(source){u.x+=Math.cos(u.hitAngle)*4;u.y+=Math.sin(u.hitAngle)*4;}
    if(u.hp<=0){u.deathAt=this.elapsed;if(stats&&!stats.firstLoss)stats.firstLoss={type:u.type,time:this.elapsed};if(stats&&['archer','bomber'].includes(u.type))stats.backlineDeaths++;this.effect(u.x,u.y,'death',u.team,{unit:{...u}});this.events.push('death');}
  }
  attack(u,target){
    const def=TYPES[u.type],ranged=['archer','bomber'].includes(u.type);
    u.cool=def.cooldown;u.swing=ranged?.22:.28;u.windup=0;u.windupTotal=0;u.targetId=null;
    if(u.team===0&&this.effects.rally>0)this.itemStats.boostedAttacks++;
    // 表现事件只供音效、震屏和震动使用，不参与模拟。
    this.events.push('attack',u.type==='archer'?'shoot':u.type==='bomber'?'toss':u.type==='giant'?'slam':'swing');
    if(ranged){
      if(u.type==='archer')this.stats[u.team].arrowsFired++;
      const start=muzzle(u),end=center(target),angle=u.angle;
      this.shots.push({x:start.x,y:start.y,sx:start.x,sy:start.y,tx:end.x,ty:end.y,target:target.id,
        ownerId:u.id,angle,vx:Math.cos(angle),vy:Math.sin(angle),team:u.team,type:u.type,speed:u.type==='bomber'?210:340,
        damage:def.damage,t:0,distance:Math.hypot(end.x-start.x,end.y-start.y)});
      this.effect(start.x,start.y,'release',u.team,{angle});
    }else{
      const p=center(u);this.effect(p.x,p.y,'slash',u.team,{angle:u.angle,heavy:u.type==='giant'});
      this.hit(target,def.damage,u);
    }
  }
  update(dt){
    if(this.phase!=='battle')return;
    this.elapsed+=dt;for(const key of Object.keys(this.effects)){const before=this.effects[key];this.effects[key]=Math.max(0,before-dt);if(before>0&&this.effects[key]===0&&(!this.feedback||this.feedback.kind!=='rear'||this.feedback.until<=this.elapsed))this.feedback={kind:'item-end',message:`${ITEMS[key].name}效果结束`,until:this.elapsed+1.6};}
    const alive=this.units.filter(u=>u.hp>0);
    for(const u of alive){
      if(u.hp<=0)continue;
      const def=TYPES[u.type];
      const rallied=u.team===0&&this.effects.rally>0;u.blockFlash=Math.max(0,u.blockFlash-dt);u.threat=Math.max(0,u.threat-dt);u.cool-=dt*(rallied?1.3:1);u.flash=Math.max(0,u.flash-dt);u.swing=Math.max(0,u.swing-dt);u.recoil=Math.max(0,u.recoil-dt);u.moving=0;
      const targets=alive.filter(v=>v.team!==u.team&&v.hp>0);
      if(!targets.length)continue;
      let target=targets.find(v=>v.id===u.targetId);
      if(!target){u.windup=0;u.windupTotal=0;target=targets.reduce((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)<Math.hypot(b.x-u.x,b.y-u.y)?a:b);}
      const a=center(u),b=center(target),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
      const desired=Math.atan2(dy,dx);
      u.angle=turnTowards(u.angle,desired,dt*8);u.dx=Math.cos(u.angle);u.dy=Math.sin(u.angle);
      const aligned=Math.abs(wrapAngle(desired-u.angle))<=ANGLE_TOLERANCE;
      const los=u.type!=='archer'||clearPath(a,b,this.rocks.map(o=>({...o,y:o.y-24})),0);
      const inRange=d<=def.range+TYPES[target.type].r&&los;
      if(u.windupTotal){
        if(!inRange){u.windup=0;u.windupTotal=0;u.targetId=null;}
        else {u.windup=Math.max(0,u.windup-dt);if(u.windup===0&&aligned)this.attack(u,target);}
      }else if(inRange&&u.cool<=0&&aligned){
        u.windupTotal=u.type==='archer'?.24:u.type==='bomber'?.28:u.type==='giant'?.26:.15;
        u.windup=u.windupTotal;u.targetId=target.id;
      }else if(!inRange&&u.swing<.1){
        u.navTime=(u.navTime||0)-dt;
        if(!u.waypoint||u.navTime<=0||Math.hypot(u.x-u.waypoint.x,u.y-u.waypoint.y)<10){u.waypoint=nextWaypoint(u,target,this.rocks,def.r+1);u.navTime=.45;}
        const mx=u.waypoint.x-u.x,my=u.waypoint.y-u.y,md=Math.hypot(mx,my)||1;
        const speed=def.speed*(rallied?1.4:1);u.x+=mx/md*Math.min(md,speed*dt);u.y+=my/md*Math.min(md,speed*dt);u.walk+=dt*10;u.moving=1;
        if((Math.floor(u.walk*2)+u.id)%8===0&&u.type==='giant')this.effect(u.x,u.y,'dust',u.team);
      }
    }
    // 身体分离只改变位置；武器朝向始终由上面的瞄准状态决定。
    for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
      const a=alive[i],b=alive[j];if(a.hp<=0||b.hp<=0)continue;
      let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),min=(TYPES[a.type].r+TYPES[b.type].r)*.85;
      if(d<.001){dx=1;dy=0;d=1;}
      if(d<min){const p=(min-d)*.5;a.x+=dx/d*p;a.y+=dy/d*p;b.x-=dx/d*p;b.y-=dy/d*p;}
    }
    for(const u of alive){resolveRocks(u,this.rocks,TYPES[u.type].r+3);u.x=Math.max(20,Math.min(W-20,u.x));u.y=Math.max(60,Math.min(H-25,u.y));}
    for(const s of this.shots){
      s.t+=dt;
      // 炸弹投向出手时的位置；箭沿出手方向直飞，不在空中追踪转弯。
      if(s.type==='bomber'){
        const dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy);
        if(d<=s.speed*dt+5){
          s.done=true;this.effect(s.tx,s.ty,'boom',s.team);this.events.push('boom');
          for(const u of this.units)if(u.hp>0&&u.team!==s.team){const p=center(u);if(Math.hypot(p.x-s.tx,p.y-s.ty)<48)this.hit(u,s.damage,s,true);}
        }else{s.x+=dx/d*s.speed*dt;s.y+=dy/d*s.speed*dt;}
      }else{
        const nx=s.x+s.vx*s.speed*dt,ny=s.y+s.vy*s.speed*dt;
        const hits=this.units.filter(u=>u.hp>0&&u.team!==s.team).map(u=>({u,p:center(u)}))
          .filter(({u,p})=>segmentDistance(p.x,p.y,s.x,s.y,nx,ny)<TYPES[u.type].r+3)
          .sort((a,b)=>Math.hypot(a.p.x-s.x,a.p.y-s.y)-Math.hypot(b.p.x-s.x,b.p.y-s.y));
        const arrowRocks=this.rocks.map(o=>({...o,y:o.y-24}));
        if(!clearPath({x:s.x,y:s.y},{x:nx,y:ny},arrowRocks)){s.done=true;this.stats[s.team].stoneArrows++;this.effect(nx,ny,'block',s.team);}
        else if(hits.length){this.hit(hits[0].u,s.damage,s,true);s.done=true;}
        s.x=nx;s.y=ny;if(s.t>2.5||nx<0||nx>W||ny<0||ny>H)s.done=true;
      }
    }
    this.shots=this.shots.filter(s=>!s.done);
    for(const f of this.fx)f.t+=dt;
    this.fx=this.fx.filter(f=>f.t<f.life);
    const blue=this.units.some(u=>u.team===0&&u.hp>0),red=this.units.some(u=>u.team===1&&u.hp>0);
    if(!blue||!red||this.elapsed>=80){this.phase=blue&&!red?'won':'lost';this.events.push(this.phase);}
  }
  // 胜负已定后的收尾停顿：只推进倒地、烟尘等特效并让士兵收招，不改变血量、时间和结果。
  settle(dt){
    if(this.phase!=='won'&&this.phase!=='lost')return;
    this.shots=[];
    for(const u of this.units){u.moving=0;u.flash=Math.max(0,u.flash-dt);u.swing=Math.max(0,u.swing-dt);u.recoil=Math.max(0,u.recoil-dt);u.blockFlash=Math.max(0,u.blockFlash-dt);}
    for(const f of this.fx)f.t+=dt;
    this.fx=this.fx.filter(f=>f.t<f.life);
  }
}
