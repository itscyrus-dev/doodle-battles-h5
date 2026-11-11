import {TYPES} from './data.mjs';
import {drawUnit} from './render.mjs';

// 单一指针手势：画兵、拖入、移位、回收；落下之前不改变已有士兵。
export class FormationInput {
  constructor({canvas,renderer,getGame,getSelection,select,onChange,message}) {
    Object.assign(this,{canvas,renderer,getGame,getSelection,select,onChange,message});
    this.gesture=null;this.lastMessage='';this.lastMessageAt=0;
    this.ghost=document.createElement('canvas');this.ghost.width=144;this.ghost.height=180;
    this.ghost.className='drag-ghost';this.ghost.hidden=true;this.ghost.setAttribute('aria-hidden','true');document.body.append(this.ghost);
    canvas.addEventListener('pointerdown',e=>this.down(e));
    const lost=e=>{if(this.gesture?.pointer===e.pointerId)this.cancel();};
    canvas.addEventListener('lostpointercapture',lost);
    for(const card of document.querySelectorAll('[data-type]')){
      card.style.touchAction='none';
      card.addEventListener('pointerdown',e=>this.down(e,card.dataset.type));
      card.addEventListener('lostpointercapture',lost);
    }
    document.addEventListener('pointermove',e=>this.move(e),{passive:false});
    document.addEventListener('pointerup',e=>this.up(e));
    document.addEventListener('pointercancel',e=>{if(this.gesture?.pointer===e.pointerId)this.cancel();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.cancel();});
    window.addEventListener('blur',()=>this.cancel());
  }
  get active(){return !!this.gesture;}
  inside(e,element){const r=element.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
  pick(p){
    return this.getGame().plan.slice().sort((a,b)=>b.y-a.y).find(u=>Math.abs(p.x-u.x)<(u.type==='giant'?26:20)&&p.y>u.y-(u.type==='giant'?80:62)&&p.y<u.y+10);
  }
  tell(text){if(text&&(text!==this.lastMessage||performance.now()-this.lastMessageAt>1100)){this.message(text);this.lastMessage=text;this.lastMessageAt=performance.now();}}
  down(e,type=null){
    const g=this.getGame();if(this.active||g.phase!=='build'||e.button>0||e.isPrimary===false)return;
    e.preventDefault();
    const point=this.renderer.point(e),selection=this.getSelection();
    const unit=!type&&!selection.eraser?this.pick(point):null;
    const suggestion=!type&&!unit&&!selection.eraser?(this.renderer.guideGhosts||[]).find(v=>Math.abs(point.x-v.x)<21&&point.y>v.y-62&&point.y<v.y+12&&!g.placementError(v.type,v.x,v.y,v.team)):null;
    if(suggestion){point.x=suggestion.x;point.y=suggestion.y;this.select(suggestion.type);}
    const kind=type?'card':unit?'unit':'paint';
    this.renderer.selectedPid=unit?.pid??null;
    this.gesture={pointer:e.pointerId,element:e.currentTarget,startX:e.clientX,startY:e.clientY,kind,type:type||unit?.type||selection.type,
      unit,team:unit?.team||0,offset:unit?{x:unit.x-point.x,y:unit.y-point.y}:{x:0,y:0},point,moved:false,last:point};
    e.currentTarget.setPointerCapture(e.pointerId);
    if(type||unit)this.select(type||unit.type);
    if(kind==='paint'){g.beginStroke();this.paint(point);}
    this.onChange(unit?'inspect':null,unit?.team,{type:unit?.type});
  }
  paint(p){
    const g=this.getGame(),selection=this.getSelection();
    if(selection.eraser){g.erase(p.x,p.y);this.onChange();return;}
    const team=g.sandbox&&p.y<300?1:0;
    const error=g.placementError(selection.type,p.x,p.y,team);
    if(!error){g.place(selection.type,p.x,p.y,team);this.onChange('place',team,{type:selection.type});}
    else if(!error.includes('已有士兵'))this.tell(error);
    if(error&&!error.includes('已有士兵')&&(error!==this.lastRejected||performance.now()-(this.rejectedAt||0)>700)){this.lastRejected=error;this.rejectedAt=performance.now();this.onChange('rejected',team,{reason:error,type:selection.type});}
  }
  move(e){
    const s=this.gesture;if(!s||s.pointer!==e.pointerId)return;
    e.preventDefault();if(this.getGame().phase!=='build'){this.cancel();return;}
    if(Math.hypot(e.clientX-s.startX,e.clientY-s.startY)>7)s.moved=true;
    const p=this.renderer.point(e);
    if(s.kind==='paint'){
      const d=Math.hypot(p.x-s.last.x,p.y-s.last.y);
      if(d>=30){const dx=(p.x-s.last.x)/d,dy=(p.y-s.last.y)/d,n=Math.floor(d/30);
        for(let i=1;i<=n;i++)this.paint({x:s.last.x+dx*i*30,y:s.last.y+dy*i*30});
        s.last={x:s.last.x+dx*n*30,y:s.last.y+dy*n*30};
      }return;
    }
    if(!s.moved)return;
    s.point={x:p.x+s.offset.x,y:p.y+s.offset.y};
    const g=this.getGame();s.team=s.unit?.team??(g.sandbox&&s.point.y<300?1:0);
    s.recycle=s.kind==='unit'&&(this.inside(e,document.getElementById('recycle'))||this.inside(e,document.getElementById('roster')));
    s.error=s.recycle?'':g.placementError(s.type,s.point.x,s.point.y,s.team,s.unit?.pid??null);
    const rect=this.canvas.getBoundingClientRect(),px=rect.x+(s.point.x*this.renderer.scale+this.renderer.ox)*rect.width/this.canvas.width,
      py=rect.y+(s.point.y*this.renderer.scale+this.renderer.oy)*rect.height/this.canvas.height;
    this.ghost.hidden=false;this.ghost.style.left=`${px}px`;this.ghost.style.top=`${py}px`;
    this.ghost.classList.toggle('invalid',!!s.error);this.ghost.classList.toggle('recycling',!!s.recycle);
    const c=this.ghost.getContext('2d');c.clearRect(0,0,144,180);c.save();c.scale(2,2);drawUnit(c,{type:s.type,x:36,y:77,team:s.team,angle:.3},0,1.55,true);c.restore();
    document.getElementById('app').classList.toggle('dragging-unit',s.kind==='unit');
    document.getElementById('recycle').classList.toggle('over',!!s.recycle);
    this.renderer.drag={...s.point,type:s.type,team:s.team,unit:s.unit,valid:!s.error,recycle:s.recycle};
    document.getElementById('dragstatus').hidden=false;
    document.getElementById('dragstatus').textContent=s.recycle?`松手回收 · 退还 ${TYPES[s.type].cost} 墨水`:s.error||'松手放置 · 拖回下方兵种栏可回收';
    const preview=this.renderer.inspect(this.getGame());if(preview&&!s.error&&!s.recycle)document.getElementById('dragstatus').textContent+=` · ${preview.status}`;
    this.onChange(null,s.team);
  }
  up(e){
    const s=this.gesture;if(!s||s.pointer!==e.pointerId)return;
    if(s.kind!=='paint'&&s.moved){
      const g=this.getGame();this.move(e);
      if(s.recycle){g.remove(s.unit.pid);this.onChange('remove',s.team,{type:s.type});this.message(g.sandbox?'已回收，数量名额已恢复':`已回收，退还 ${TYPES[s.type].cost} 墨水`);}
      else if(s.error)this.message(`${s.error}${s.kind==='unit'?'，已退回原位':''}`);
      else if(s.kind==='unit'){if(g.move(s.unit.pid,s.point.x,s.point.y))this.onChange('move',s.team,{type:s.type});}
      else {g.beginStroke();g.place(s.type,s.point.x,s.point.y,s.team);this.onChange('place',s.team,{type:s.type});}
    }
    this.finish();
  }
  finish(){
    const s=this.gesture;this.gesture=null;if(s?.moved)this.renderer.selectedPid=null;
    if(s?.element.hasPointerCapture(s.pointer))s.element.releasePointerCapture(s.pointer);
    this.ghost.hidden=true;this.renderer.drag=null;
    document.getElementById('app').classList.remove('dragging-unit');document.getElementById('recycle').classList.remove('over');document.getElementById('dragstatus').hidden=true;
    this.onChange();
  }
  cancel(){if(!this.gesture)return;if(this.gesture.kind==='paint')this.getGame().undo();this.finish();}
}
