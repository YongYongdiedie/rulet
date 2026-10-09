/* 구슬 대작전 — buildless prototype, authoritative host simulation. */
'use strict';
const $ = id => document.getElementById(id);
const colors = ['#c7f77c','#a898ff','#ffb879','#78d6f0','#f78aaa','#f5dc75'];
const W=720,H=940,R=12,WORLD_H=4600,FINISH=WORLD_H-70;
let cameraY=0;
let mode='local',phase='lobby',balls=[],players={},mySlot=null;
let elapsed=0,accumulator=0,last=0,finished=[],effects=[],round=0,starting=false;
// Smooth bends inspired by the winding shape of Wheel of Fortune.
const courseKnots=[[0,360,330],[180,360,330],[600,235,185],[1000,475,170],[1450,260,180],[1850,420,210],[2300,230,190],[2750,465,180],[3200,260,200],[3650,440,180],[4100,345,210],[FINISH,360,280],[WORLD_H,360,280]];
function trackAt(y){const value=Math.max(0,Math.min(WORLD_H,y));let a=courseKnots[0],b=courseKnots[1];for(let i=1;i<courseKnots.length;i++){b=courseKnots[i];if(value<=b[0])break;a=b;}const t=Math.max(0,Math.min(1,(value-a[0])/(b[0]-a[0]))),u=t*t*(3-2*t);return {center:a[1]+(b[1]-a[1])*u,half:a[2]+(b[2]-a[2])*u};}
const walls=[[],[]];for(let y=0;y<=WORLD_H;y+=20){const t=trackAt(y);walls[0].push({x:t.center-t.half,y});walls[1].push({x:t.center+t.half,y});}
const pins=[],pinRows=[];for(let row=0;row<26;row++){const y=420+row*148,t=trackAt(y);for(let col=0;col<4;col++){const pin={x:t.center+(col-1.5)*54+(row%2?12:-12),y,r:7};pins.push(pin);(pinRows[row]??=[]).push(pin);}}
const paddles=[920,1950,2900,3830].map((y,i)=>({x:trackAt(y).center+(i%2?-48:48),y,len:92,angle:i%2?-.3:.3}));
const canvas=$('arena'),ctx=canvas.getContext('2d');
function toast(t){$('message').textContent=t;$('message').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('message').hidden=true,5000);}
function participantName(i){return players[i]?.name||`봇 ${String(i+1).padStart(2,'0')}`;}
function makeBalls(){return Array.from({length:30},(_,i)=>({i,x:65+(i%10)*65,y:55+Math.floor(i/10)*36,vx:(Math.random()-.5)*35,vy:0,done:false,used:false,progressY:55+Math.floor(i/10)*36,stalled:0}));}
balls=makeBalls();
function escapeText(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderUI(){
 $('phase').textContent=({lobby:'● 대기 중',countdown:'● 곧 출발!',running:'● 경기 진행 중',ended:'● 경기 종료'})[phase];
 $('arenaTitle').textContent=({lobby:'떨어질 준비, 됐나요?',countdown:'모두 출발선으로!',running:'지금, 흐름을 바꿔보세요.',ended:'마지막 구슬이 도착했어요.'})[phase];
 $('myNumber').textContent=mySlot===null?'?':mySlot+1;
 $('myNumber').style.background=mySlot===null?colors[0]:colors[mySlot%6];
 $('myName').textContent=mySlot===null?'이름을 등록하고 참가자를 선택하세요.':participantName(mySlot)+' · '+(mySlot+1)+'번 구슬';
 const ball=balls[mySlot];$('skill').disabled=phase!=='running'||!ball||ball.used||ball.done||!players[mySlot];
 $('skillHint').textContent=ball?.used?'이 참가자는 이미 사용했어요':ball?.done?'이미 도착했어요':'선택한 참가자의 스킬 · 경기 중 1회';
 $('skillCount').textContent=ball?.used?'0 / 1':'1 / 1';
 const locked=phase==='running'||phase==='countdown';
 $('names').disabled=locked;$('applyNames').disabled=locked;$('sampleNames').disabled=locked;
 $('start').disabled=phase!=='lobby'||starting||!Object.keys(players).length;
 $('reset').hidden=phase!=='ended';$('peopleCount').textContent=Object.keys(players).length+' / 30';
 $('selectBall').disabled=!Object.keys(players).length;
 $('roster').innerHTML=Array.from({length:30},(_,i)=>{const status=balls[i]?.done?'도착':balls[i]?.used?'스킬 사용':players[i]?'스킬 1회':'BOT';return '<button type="button" class="person roster-choice '+(mySlot===i?'selected':'')+'" data-slot="'+i+'" '+(!players[i]?'disabled':'')+'><span class="dot" style="background:'+colors[i%6]+'">'+(i+1)+'</span><span>'+escapeText(participantName(i))+'</span><small>'+status+'</small></button>';}).join('');
 $('result').hidden=phase!=='ended';if(phase==='ended'&&finished.length){const i=finished[finished.length-1];$('winner').textContent=(i+1)+'번 · '+participantName(i);}
}
function updateSelector(){
 $('selectBall').innerHTML=Object.keys(players).map(i=>'<option value="'+i+'">'+(Number(i)+1)+'번 · '+escapeText(players[i].name)+'</option>').join('');
 if(mySlot!==null)$('selectBall').value=String(mySlot);
}
function applyNames(){
 if(phase==='running'||phase==='countdown')return false;
 const names=$('names').value.split(/[\n,，]/).map(x=>x.trim()).filter(Boolean);
 if(!names.length){toast('참가자 이름을 한 줄에 한 명씩 입력하세요.');return false;}
 if(names.length>30){toast('참가자는 최대 30명입니다. 이름을 줄여주세요.');return false;}
 if(names.some(x=>x.length>18)){toast('참가자 이름은 18자 이내로 입력하세요.');return false;}
 players=Object.fromEntries(names.map((name,i)=>[i,{name}]));
 mySlot=players[mySlot]?mySlot:0;phase='lobby';balls=makeBalls();finished=[];effects=[];elapsed=0;cameraY=0;accumulator=0;
 updateSelector();renderUI();return true;
}
function choosePlayer(slot){if(!players[slot])return;mySlot=Number(slot);$('selectBall').value=String(slot);renderUI();}
function publish(){} // Single-computer mode: simulation and skill use are immediate.
function begin(){if(phase!=='lobby'||starting)return;starting=true;phase='countdown';balls=makeBalls();elapsed=0;finished=[];effects=[];round++;let n=3;$('countdown').hidden=false;$('countdown').textContent=n;renderUI();publish();const t=setInterval(()=>{n--;if(n===0){clearInterval(t);$('countdown').hidden=true;phase='running';starting=false;renderUI();publish();}else $('countdown').textContent=n;},1000);}
function collide(b,x,y,r){let dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy),min=R+r;if(d>=min)return;if(d<.001){dx=1;dy=-1;d=Math.sqrt(2);}const nx=dx/d,ny=dy/d;b.x=x+nx*min;b.y=y+ny*min;const v=b.vx*nx+b.vy*ny;if(v<0){b.vx-=1.65*v*nx;b.vy-=1.65*v*ny;}b.vx+=nx*8;}
function keepInTrack(b){
 const index=Math.floor(Math.max(0,Math.min(WORLD_H-1,b.y))/20);
 for(const side of walls)for(let j=Math.max(0,index-2);j<=Math.min(side.length-2,index+2);j++){
 const a=side[j],z=side[j+1],dx=z.x-a.x,dy=z.y-a.y;
 const t=Math.max(0,Math.min(1,((b.x-a.x)*dx+(b.y-a.y)*dy)/(dx*dx+dy*dy)));
 collide(b,a.x+t*dx,a.y+t*dy,4);
 }
 // Recover impulses that crossed a boundary, including ball-to-ball pushes.
 const track=trackAt(b.y),left=track.center-track.half+R+4,right=track.center+track.half-R-4;
 if(b.x<left){b.x=left;b.vx=Math.abs(b.vx)*.65;}
 if(b.x>right){b.x=right;b.vx=-Math.abs(b.vx)*.65;}
}
function drawTrack(){
 ctx.beginPath();for(let i=0;i<walls[0].length;i++){const p=walls[0][i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}for(let i=walls[1].length-1;i>=0;i--){const p=walls[1][i];ctx.lineTo(p.x,p.y);}ctx.closePath();ctx.fillStyle='#192638';ctx.fill();
 for(const side of walls){ctx.beginPath();side.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#73bdc3';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#b6e6de30';ctx.lineWidth=13;ctx.stroke();}
 ctx.setLineDash([8,22]);ctx.strokeStyle='#ffffff0b';ctx.lineWidth=2;ctx.beginPath();for(let y=0;y<=WORLD_H;y+=20){const x=trackAt(y).center;y?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.setLineDash([]);
}
function step(dt){elapsed+=dt;const arrivals=[];for(const b of balls){if(b.done)continue;const previousY=b.y;b.vy+=253*dt;b.vx*=Math.pow(.988,dt*60);b.vx=Math.max(-430,Math.min(430,b.vx));b.vy=Math.max(-450,Math.min(341,b.vy));b.x+=b.vx*dt;b.y+=b.vy*dt;
 keepInTrack(b);if(b.y<R+16){b.y=R+16;b.vy=Math.abs(b.vy)*.5;}
 for(const p of pinRows[Math.round((b.y-420)/148)]||[])collide(b,p.x,p.y,p.r);
 for(const p of paddles){const a=p.angle+Math.sin(elapsed*.8)*.4,dx=Math.cos(a)*p.len/2,dy=Math.sin(a)*p.len/2;const ax=p.x-dx,ay=p.y-dy,sx=dx*2,sy=dy*2;const u=Math.max(0,Math.min(1,((b.x-ax)*sx+(b.y-ay)*sy)/(sx*sx+sy*sy)));collide(b,ax+u*sx,ay+u*sy,5);}
 if(b.y>=FINISH){arrivals.push({i:b.i,t:(FINISH-previousY)/Math.max(.001,b.y-previousY)});b.done=true;b.y=FINISH+14;}
 }
 for(let i=0;i<30;i++)for(let j=i+1;j<30;j++){const a=balls[i],b=balls[j];if(a.done||b.done)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=2*R)continue;if(d<.001){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,over=(2*R-d)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-.85*v;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
 // Rescue only a marble stalled in the course for six seconds.
 for(const b of balls){if(b.done)continue;keepInTrack(b);if(b.y>(b.progressY??b.y)+8){b.progressY=b.y;b.stalled=0;}else b.stalled=(b.stalled||0)+dt;if(b.stalled>6){b.vx=(Math.random()<.5?-1:1)*190;b.vy=140;b.stalled=0;b.progressY=b.y;}}
 if(arrivals.length){arrivals.sort((a,b)=>a.t-b.t||a.i-b.i);finished.push(...arrivals.map(a=>a.i));renderUI();}
 if(finished.length===balls.length){phase='ended';renderUI();publish();}
}
function shock(i){const source=balls[i];if(phase!=='running'||!source||source.done||source.used)return false;source.used=true;const x=source.x,y=source.y;for(const b of balls){if(b.done)continue;const d=Math.hypot(b.x-x,b.y-y);if(d>155)continue;const a=Math.random()*Math.PI*2,power=260+(1-d/155)*230;b.vx+=Math.cos(a)*power;b.vy+=Math.sin(a)*power-95;}
 effects.push({x,y,born:performance.now()});renderUI();publish();return true;}
function updateCamera(dt){
 const active=balls.filter(b=>!b.done);
 let focus=0;
 if(phase==='running')focus=mySlot!==null&&!balls[mySlot]?.done?balls[mySlot].y:(active.length?Math.min(...active.map(b=>b.y)):FINISH);
 if(phase==='ended')focus=FINISH;
 const target=Math.max(0,Math.min(WORLD_H-H,focus-H*.38));
 if(phase==='lobby'||phase==='countdown')cameraY=0;
 else cameraY+=(target-cameraY)*(1-Math.exp(-dt*5));
 $('raceProgress').textContent=`도착 ${finished.length} / 30 · 남은 구슬 ${30-finished.length} · ${Math.floor(elapsed)}초`;
 $('cameraMode').textContent=mySlot!==null&&!balls[mySlot]?.done?'내 구슬 따라가기':'마지막 구슬 따라가기';
}
function draw(now){ctx.clearRect(0,0,W,H);ctx.fillStyle='#101725';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(0,-cameraY);drawTrack();
 ctx.strokeStyle='#1c273b';ctx.lineWidth=1;for(let x=0;x<W;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_H);ctx.stroke();}for(let y=Math.floor(cameraY/36)*36;y<cameraY+H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 ctx.fillStyle='#64748d';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('DROP ZONE',W/2,25);
 for(const p of pins){if(p.y<cameraY-20||p.y>cameraY+H+20)continue;ctx.fillStyle='#3f4d66';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8392ad';ctx.beginPath();ctx.arc(p.x-2,p.y-2,2,0,Math.PI*2);ctx.fill();}
 for(const p of paddles){const a=p.angle+Math.sin(elapsed*.8)*.4;ctx.strokeStyle='#8c7bce';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-Math.cos(a)*p.len/2,p.y-Math.sin(a)*p.len/2);ctx.lineTo(p.x+Math.cos(a)*p.len/2,p.y+Math.sin(a)*p.len/2);ctx.stroke();}ctx.lineCap='butt';
 const finishTrack=trackAt(FINISH);ctx.fillStyle='#c6f77b';ctx.fillRect(finishTrack.center-finishTrack.half,FINISH,finishTrack.half*2,3);ctx.fillStyle='#c6f77b12';ctx.fillRect(finishTrack.center-finishTrack.half,FINISH,finishTrack.half*2,57);ctx.font='bold 16px sans-serif';ctx.fillStyle='#c6f77b';ctx.fillText('L A S T  O N E  W I N S',W/2,FINISH+38);
 for(const b of balls){if(b.done)continue;ctx.shadowBlur=b.i===mySlot?22:6;ctx.shadowColor=colors[b.i%6];ctx.fillStyle=colors[b.i%6];ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(b.i===mySlot){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,R+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.fillText('ME',b.x,b.y-23);}ctx.fillStyle='#182036';ctx.font='bold 10px sans-serif';ctx.fillText(b.i+1,b.x,b.y+3.5);}
 effects=effects.filter(e=>now-e.born<650);for(const e of effects){const t=(now-e.born)/650;ctx.strokeStyle=`rgba(192,170,255,${1-t})`;ctx.lineWidth=5*(1-t);ctx.beginPath();ctx.arc(e.x,e.y,155*t,0,Math.PI*2);ctx.stroke();}
 ctx.restore();drawOverview();
}
function drawOverview(){
 ctx.fillStyle='#101725d9';ctx.fillRect(W-56,45,42,H-100);
 ctx.strokeStyle='#64748d';ctx.lineWidth=1;ctx.strokeRect(W-53,48,36,H-106);
 const scale=(H-106)/WORLD_H;
 ctx.beginPath();for(let y=0;y<=WORLD_H;y+=40){const t=trackAt(y),x=W-53+(t.center-t.half)/W*36;y?ctx.lineTo(x,48+y*scale):ctx.moveTo(x,48+y*scale);}for(let y=WORLD_H;y>=0;y-=40){const t=trackAt(y);ctx.lineTo(W-53+(t.center+t.half)/W*36,48+y*scale);}ctx.closePath();ctx.fillStyle='#73bdc330';ctx.fill();
 ctx.fillStyle='#c6f77b24';ctx.fillRect(W-53,48+cameraY*scale,36,H*scale);
 for(const b of balls){ctx.fillStyle=b.done?'#526176':colors[b.i%6];ctx.beginPath();ctx.arc(W-53+b.x/W*36,48+Math.min(b.y,FINISH)*scale,b.i===mySlot?3:1.8,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#c6f77b';ctx.fillRect(W-53,48+FINISH*scale,36,2);
}
function frame(now){const dt=Math.min((now-(last||now))/1000,.05);last=now;if(phase==='running'){accumulator+=dt;while(accumulator>=1/120&&phase==='running'){step(1/120);accumulator-=1/120;}}updateCamera(dt);draw(now);requestAnimationFrame(frame);}requestAnimationFrame(frame);
function reset(){if(phase!=='ended')return;phase='lobby';elapsed=0;cameraY=0;balls=makeBalls();finished=[];effects=[];accumulator=0;renderUI();}
$('applyNames').onclick=()=>{if(applyNames())toast('참가자를 등록했어요. 구슬을 선택하고 경기를 시작하세요.');};
$('sampleNames').onclick=()=>{if(phase==='running'||phase==='countdown')return;$('names').value=Array.from({length:6},(_,i)=>'참가자 '+(i+1)).join('\n');applyNames();};
$('start').onclick=()=>{if(phase==='lobby'&&applyNames())begin();};
$('skill').onclick=()=>{if(!$('skill').disabled)shock(mySlot);};
$('selectBall').onchange=e=>choosePlayer(Number(e.target.value));
$('roster').onclick=e=>{const target=e.target.closest('[data-slot]');if(target)choosePlayer(Number(target.dataset.slot));};
$('reset').onclick=reset;
window.addEventListener('beforeunload',e=>{if(phase==='running'){e.preventDefault();e.returnValue='';}});
renderUI();
