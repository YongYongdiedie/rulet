/* 구슬 대작전 — buildless prototype, authoritative host simulation. */
'use strict';
const $ = id => document.getElementById(id);
const colors = ['#c7f77c','#a898ff','#ffb879','#78d6f0','#f78aaa','#f5dc75'];
const W=720,H=940,R=12,WORLD_H=4600,FINISH=WORLD_H-70;
let cameraY=0;
let mode='idle',phase='lobby',balls=[],players={},mySlot=null,room=null,uid=null,net=null,unsubscribe=null;
let elapsed=0,accumulator=0,last=0,publishAt=0,finished=[],effects=[],busy=false,skillPending=false;
let requests={},processed=new Set(),assigning=false,round=0,heartbeat=0,starting=false;
let lastRemote=0,hostStale=false,online=true;
const pins=[],pinRows=[];for(let row=0;row<50;row++)for(let col=0;col<7;col++){const x=78+col*92+(row%2?46:0);if(x<675){const pin={x,y:205+row*82,r:7};pins.push(pin);(pinRows[row]??=[]).push(pin);}}
const paddles=Array.from({length:9},(_,i)=>({x:[190,540,345][i%3],y:390+i*470,len:120,angle:i%2?-.35:.32}));
const canvas=$('arena'),ctx=canvas.getContext('2d');
function toast(t){$('message').textContent=t;$('message').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('message').hidden=true,5000);}
function participantName(i){return players[i]?.name||`봇 ${String(i+1).padStart(2,'0')}`;}
function makeBalls(){return Array.from({length:30},(_,i)=>({i,x:65+(i%10)*65,y:55+Math.floor(i/10)*36,vx:(Math.random()-.5)*35,vy:0,done:false,used:false,progressY:55+Math.floor(i/10)*36,stalled:0}));}
balls=makeBalls();
function escapeText(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderUI(){
 $('phase').textContent=({lobby:'● 대기 중',countdown:'● 곧 출발!',running:'● 경기 진행 중',ended:'● 경기 종료'})[phase];
 $('arenaTitle').textContent=({lobby:'떨어질 준비, 됐나요?',countdown:'모두 출발선으로!',running:'지금, 흐름을 바꿔보세요.',ended:'오늘의 행운이 도착했어요.'})[phase];
 $('myNumber').textContent=mySlot===null?'?':mySlot+1;
 $('myNumber').style.background=mySlot===null?colors[0]:colors[mySlot%6];
 $('myName').textContent=mySlot===null?'입장하면 내 구슬이 정해져요.':`${participantName(mySlot)} · ${mySlot+1}번 구슬`;
 const b=balls[mySlot];$('skill').disabled=phase!=='running'||!b||b.used||b.done||skillPending||(mode==='participant'&&(!online||hostStale));
 $('skillHint').textContent=skillPending?'스킬 전달 중…':b?.used?'충격파를 사용했어요':b?.done?'이미 도착했어요':'경기 중 딱 한 번';
 $('skillCount').textContent=b?.used?'0 / 1':'1 / 1';
 $('start').disabled=phase!=='lobby'||assigning||starting;
 $('reset').hidden=!(phase==='ended'&&(mode==='demo'||mode==='host'));
 $('peopleCount').textContent=`${Object.keys(players).length} / 30`;
 $('roster').innerHTML=Array.from({length:30},(_,i)=>`<div class="person"><span class="dot" style="background:${colors[i%6]}">${i+1}</span><span>${escapeText(participantName(i))}${i===mySlot?' (나)':''}</span><small>${balls[i]?.done?'도착':balls[i]?.used?'스킬 사용':players[i]?'참여 완료':'BOT'}</small></div>`).join('');
 $('result').hidden=phase!=='ended';if(phase==='ended'&&finished.length)$('winner').textContent=`${finished[finished.length-1]+1}번 · ${participantName(finished[finished.length-1])}`;
}
function demo(){if(mode!=='idle')return;mode='demo';mySlot=0;players={0:{name:'나'}};$('homeControls').hidden=true;$('entryHint').textContent='데모 모드 · 구슬을 바꿔가며 충격파를 체험해 보세요.';$('demoLabel').hidden=false;$('selectBall').innerHTML=balls.map(b=>`<option value="${b.i}">${b.i+1}번 구슬</option>`).join('');$('roomControls').hidden=false;$('qr').hidden=true;$('roomCode').parentElement.hidden=true;$('copy').hidden=true;renderUI();}
function begin(){if(phase!=='lobby'||starting)return;starting=true;phase='countdown';balls=makeBalls();elapsed=0;finished=[];effects=[];processed=new Set();skillPending=false;round++;let n=3;$('countdown').hidden=false;$('countdown').textContent=n;renderUI();publish();const t=setInterval(()=>{n--;if(n===0){clearInterval(t);$('countdown').hidden=true;phase='running';starting=false;renderUI();publish();}else $('countdown').textContent=n;},1000);}
function collide(b,x,y,r){let dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy),min=R+r;if(d>=min)return;if(d<.001){dx=1;dy=-1;d=Math.sqrt(2);}const nx=dx/d,ny=dy/d;b.x=x+nx*min;b.y=y+ny*min;const v=b.vx*nx+b.vy*ny;if(v<0){b.vx-=1.65*v*nx;b.vy-=1.65*v*ny;}b.vx+=nx*8;}
function step(dt){elapsed+=dt;const arrivals=[];for(const b of balls){if(b.done)continue;const previousY=b.y;b.vy+=230*dt;b.vx*=Math.pow(.988,dt*60);b.vx=Math.max(-430,Math.min(430,b.vx));b.vy=Math.max(-450,Math.min(310,b.vy));b.x+=b.vx*dt;b.y+=b.vy*dt;
 if(b.x<R+23){b.x=R+23;b.vx=Math.abs(b.vx)*.75;}if(b.x>W-R-23){b.x=W-R-23;b.vx=-Math.abs(b.vx)*.75;}if(b.y<R+16){b.y=R+16;b.vy=Math.abs(b.vy)*.5;}
 for(const p of pinRows[Math.round((b.y-205)/82)]||[])collide(b,p.x,p.y,p.r);
 for(const p of paddles){const a=p.angle+Math.sin(elapsed*.8)*.4,dx=Math.cos(a)*p.len/2,dy=Math.sin(a)*p.len/2;const ax=p.x-dx,ay=p.y-dy,sx=dx*2,sy=dy*2;const u=Math.max(0,Math.min(1,((b.x-ax)*sx+(b.y-ay)*sy)/(sx*sx+sy*sy)));collide(b,ax+u*sx,ay+u*sy,5);}
 if(b.y>=FINISH){arrivals.push({i:b.i,t:(FINISH-previousY)/Math.max(.001,b.y-previousY)});b.done=true;b.y=FINISH+14;}
 }
 for(let i=0;i<30;i++)for(let j=i+1;j<30;j++){const a=balls[i],b=balls[j];if(a.done||b.done)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=2*R)continue;if(d<.001){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,over=(2*R-d)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-.85*v;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
 // Rescue only a marble stalled in the course for six seconds.
 for(const b of balls){if(b.done)continue;if(b.y>(b.progressY??b.y)+8){b.progressY=b.y;b.stalled=0;}else b.stalled=(b.stalled||0)+dt;if(b.stalled>6){b.vx=(Math.random()<.5?-1:1)*190;b.vy=140;b.stalled=0;b.progressY=b.y;}}
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
 ctx.save();ctx.translate(0,-cameraY);
 ctx.strokeStyle='#1c273b';ctx.lineWidth=1;for(let x=0;x<W;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_H);ctx.stroke();}for(let y=Math.floor(cameraY/36)*36;y<cameraY+H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 ctx.fillStyle='#64748d';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('DROP ZONE',W/2,25);ctx.strokeStyle='#34445d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(23,30);ctx.lineTo(23,FINISH);ctx.moveTo(W-23,30);ctx.lineTo(W-23,FINISH);ctx.stroke();
 for(const p of pins){if(p.y<cameraY-20||p.y>cameraY+H+20)continue;ctx.fillStyle='#3f4d66';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8392ad';ctx.beginPath();ctx.arc(p.x-2,p.y-2,2,0,Math.PI*2);ctx.fill();}
 for(const p of paddles){const a=p.angle+Math.sin(elapsed*.8)*.4;ctx.strokeStyle='#8c7bce';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-Math.cos(a)*p.len/2,p.y-Math.sin(a)*p.len/2);ctx.lineTo(p.x+Math.cos(a)*p.len/2,p.y+Math.sin(a)*p.len/2);ctx.stroke();}ctx.lineCap='butt';
 ctx.fillStyle='#c6f77b';ctx.fillRect(24,FINISH,W-48,3);ctx.fillStyle='#c6f77b12';ctx.fillRect(24,FINISH,W-48,57);ctx.font='bold 16px sans-serif';ctx.fillStyle='#c6f77b';ctx.fillText('L A S T  O N E  W I N S',W/2,FINISH+38);
 for(const b of balls){if(b.done)continue;ctx.shadowBlur=b.i===mySlot?22:6;ctx.shadowColor=colors[b.i%6];ctx.fillStyle=colors[b.i%6];ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(b.i===mySlot){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,R+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.fillText('ME',b.x,b.y-23);}ctx.fillStyle='#182036';ctx.font='bold 10px sans-serif';ctx.fillText(b.i+1,b.x,b.y+3.5);}
 effects=effects.filter(e=>now-e.born<650);for(const e of effects){const t=(now-e.born)/650;ctx.strokeStyle=`rgba(192,170,255,${1-t})`;ctx.lineWidth=5*(1-t);ctx.beginPath();ctx.arc(e.x,e.y,155*t,0,Math.PI*2);ctx.stroke();}
 ctx.restore();drawOverview();
}
function drawOverview(){
 ctx.fillStyle='#101725d9';ctx.fillRect(W-56,45,42,H-100);
 ctx.strokeStyle='#64748d';ctx.lineWidth=1;ctx.strokeRect(W-53,48,36,H-106);
 const scale=(H-106)/WORLD_H;
 ctx.fillStyle='#c6f77b24';ctx.fillRect(W-53,48+cameraY*scale,36,H*scale);
 for(const b of balls){ctx.fillStyle=b.done?'#526176':colors[b.i%6];ctx.beginPath();ctx.arc(W-47+(b.i%5)*6,48+Math.min(b.y,FINISH)*scale,b.i===mySlot?3:1.8,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#c6f77b';ctx.fillRect(W-53,48+FINISH*scale,36,2);
}
function frame(now){const dt=Math.min((now-(last||now))/1000,.05);last=now;if((mode==='demo'||mode==='host')&&phase==='running'){accumulator+=dt;while(accumulator>=1/120&&phase==='running'){step(1/120);accumulator-=1/120;}if(now-publishAt>120){publishAt=now;publish();}}updateCamera(dt);draw(now);requestAnimationFrame(frame);}requestAnimationFrame(frame);
function config(){try{return window.FIREBASE_CONFIG||JSON.parse(localStorage.getItem('marbleFirebase')||'null');}catch{return null;}}
async function connect(){if(net)return;const c=config();if(!c?.apiKey||!c?.databaseURL||!c?.projectId)throw Error('Firebase 설정을 먼저 저장해 주세요. README에 연결 방법이 있어요.');
 const base='https://www.gstatic.com/firebasejs/12.4.0/';const [app,auth,db]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-database.js')]);const a=app.initializeApp(c);const au=auth.getAuth(a);await auth.signInAnonymously(au);uid=au.currentUser.uid;net={...db,db:db.getDatabase(a)};
 net.onValue(net.ref(net.db,'.info/connected'),s=>{online=!!s.val();$('connection').textContent=online?'ONLINE ROOM':'RECONNECTING';renderUI();});
}
function roomRef(path=''){return net.ref(net.db,`rooms/${room}${path?'/'+path:''}`);}
async function publish(){if(mode!=='host'||!net)return;const state={phase,round,elapsed,balls:balls.map(b=>({...b,x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10})),finished,players,updatedAt:Date.now()};try{await net.set(roomRef('state'),state);}catch(e){toast('경기 동기화 오류: '+e.message);}}
async function assign(){if(assigning||mode!=='host'||phase!=='lobby')return;assigning=true;renderUI();try{const sorted=Object.entries(requests).sort((a,b)=>a[1].joinedAt-b[1].joinedAt);for(const [id,p] of sorted){if(Object.values(players).some(x=>x.uid===id))continue;const slot=Array.from({length:30},(_,i)=>i).find(i=>!players[i]);if(slot===undefined)break;players[slot]={uid:id,name:String(p.name).slice(0,18)};}await publish();}finally{assigning=false;renderUI();}}
function watchHost(){net.onValue(roomRef('requests'),s=>{requests=s.val()||{};if(phase==='lobby')assign();if(phase==='running'){for(const [id,p] of Object.entries(requests)){if(!p.skill||processed.has(id))continue;const entry=Object.entries(players).find(([,v])=>v.uid===id);if(entry){processed.add(id);shock(Number(entry[0]));}}}});}
async function createRoom(){if(busy||mode!=='idle')return;busy=true;try{await connect();room=Array.from(crypto.getRandomValues(new Uint8Array(9)),v=>v.toString(16).padStart(2,'0')).join('');await net.set(roomRef(),{host:uid,createdAt:Date.now(),state:{phase:'lobby',round:0,elapsed:0,balls:makeBalls(),players:{},finished:[],updatedAt:Date.now()}});mode='host';$('homeControls').hidden=true;$('roomControls').hidden=false;$('entryHint').textContent='QR을 스캔해 참여하세요. 최대 30명까지 입장할 수 있어요.';$('roomCode').textContent=room.slice(0,6).toUpperCase();const link=new URL(location.href);link.search='';link.searchParams.set('room',room);$('qr').innerHTML='';
 // QR encodes only a public room link; no participant information.
 const image=document.createElement('img');image.alt='참여 링크 QR 코드';image.src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(link.href);image.onerror=()=>toast('QR 이미지 연결 실패. 참여 링크 복사를 이용해 주세요.');$('qr').append(image);$('copy').dataset.link=link.href;watchHost();heartbeat=setInterval(()=>{if(mode==='host')publish();},2000);renderUI();}catch(e){toast(e.message);}finally{busy=false;}}
async function enterRoom(){mode='participant';document.body.classList.add('participant');$('homeControls').hidden=true;$('joinForm').hidden=false;$('entryHint').textContent='이름을 입력하고 나만의 구슬을 받으세요.';try{await connect();const snapshot=await net.get(roomRef());if(!snapshot.exists())throw Error('존재하지 않는 방이에요. 진행자에게 새 QR을 받아 주세요.');unsubscribe=net.onValue(roomRef('state'),s=>{const state=s.val();if(!state){toast('방이 종료되었어요.');return;}lastRemote=performance.now();hostStale=false;if(online)$('connection').textContent='ONLINE ROOM';const oldPhase=phase;phase=state.phase;elapsed=state.elapsed||0;round=state.round||0;players=state.players||{};const incoming=state.balls||[];if(incoming.length===30){for(const b of incoming){if(b.used&&!balls[b.i]?.used)effects.push({x:b.x,y:b.y,born:performance.now()});}balls=incoming;}finished=state.finished||[];const assigned=Object.entries(players).find(([,p])=>p.uid===uid);mySlot=assigned?Number(assigned[0]):null;if(mySlot!==null){$('joinForm').hidden=true;$('entryHint').textContent='입장 완료! 아래 충격파 버튼으로 경기 중 한 번 개입하세요.';}else if(Object.keys(players).length>=30){$('joinForm').hidden=true;$('entryHint').textContent='30명 정원이 찼어요. 이번 경기를 관람할 수 있어요.';}else if(phase!=='lobby'){$('joinForm').hidden=true;$('entryHint').textContent='경기가 시작되어 지금은 관람만 가능해요.';}else{$('joinForm').hidden=false;}
 $('countdown').hidden=phase!=='countdown';$('countdown').textContent='READY';if(mySlot!==null&&balls[mySlot]?.used)skillPending=false;if(oldPhase==='ended'&&phase==='lobby'){skillPending=false;}renderUI();},e=>toast('방 연결 오류: '+e.message));}catch(e){$('joinForm').hidden=true;toast(e.message);$('entryHint').textContent=e.message;}}
async function join(e){e.preventDefault();if(busy)return;const name=$('name').value.trim();if(!name){toast('이름을 입력해 주세요.');return;}busy=true;try{if(phase!=='lobby')throw Error('이미 시작된 경기예요. 다음 경기에 참여해 주세요.');const existing=await net.get(roomRef('requests/'+uid));if(!existing.exists())await net.set(roomRef('requests/'+uid),{name,joinedAt:Date.now(),skill:false});toast('구슬을 배정하고 있어요. 진행자 화면을 열어 두세요.');}catch(err){toast(err.message);}finally{busy=false;}}
async function useSkill(){if($('skill').disabled)return;if(mode==='demo'){shock(mySlot);return;}if(mode==='participant'){skillPending=true;renderUI();try{await net.set(roomRef('requests/'+uid+'/skill'),true);}catch(e){skillPending=false;renderUI();toast('스킬 전달 실패: '+e.message);}}}
async function reset(){if(phase!=='ended'||busy)return;busy=true;try{if(mode==='host'){// Clear previous requests; assigned members remain, but must opt into the new round.
 await net.remove(roomRef('requests'));players={};requests={};processed.clear();}
 phase='lobby';elapsed=0;cameraY=0;balls=makeBalls();finished=[];effects=[];skillPending=false;accumulator=0;await publish();renderUI();}catch(e){toast(e.message);}finally{busy=false;}}
$('demo').onclick=demo;$('create').onclick=createRoom;$('start').onclick=async()=>{if(mode==='host'){await assign();}begin();};$('joinForm').onsubmit=join;$('skill').onclick=useSkill;$('reset').onclick=reset;
$('selectBall').onchange=e=>{mySlot=Number(e.target.value);players={[mySlot]:{name:'나'}};renderUI();};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('copy').dataset.link);toast('참여 링크를 복사했어요.');}catch{toast('복사할 링크: '+$('copy').dataset.link);}};
$('saveConfig').onclick=()=>{try{const c=JSON.parse($('config').value);if(!c.apiKey||!c.projectId||!c.databaseURL)throw Error('apiKey, projectId, databaseURL이 필요해요.');localStorage.setItem('marbleFirebase',JSON.stringify(c));toast('저장했어요. 휴대폰에도 적용하려면 config.js에 같은 설정을 넣고 업로드하세요.');}catch(e){toast('설정 확인: '+e.message);}};
window.addEventListener('beforeunload',e=>{if(mode==='host'&&phase==='running'){e.preventDefault();e.returnValue='';}});
const params=new URLSearchParams(location.search);const candidate=params.get('room');if(candidate&&/^[a-f0-9]{18}$/.test(candidate)){room=candidate;enterRoom();}else if(candidate)toast('올바르지 않은 참여 링크예요.');renderUI();

setInterval(()=>{if(mode==='participant'&&lastRemote&&performance.now()-lastRemote>7000&&!hostStale){hostStale=true;$('connection').textContent='HOST PAUSED';renderUI();toast('진행자 연결이 멈췄어요. 진행자 탭과 인터넷 연결을 확인해 주세요.');}},1000);
