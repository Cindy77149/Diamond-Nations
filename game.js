/* ============================================================
   Diamond Nations — game.js
   全部遊戲邏輯：資料、狀態管理、渲染、抽卡、比賽、球探
   Generated: 2026-03-21
   依賴：style.css（外部）, Google Fonts（外部）
   ============================================================ */

/* ═══ DATA ═══ */
const P_STATS=[{zh:'投球力',fill:'#e05060'},{zh:'控球力',fill:'#5a7aee'},{zh:'變化球',fill:'#9a60e8'},{zh:'體　力',fill:'#2a9a5a'},{zh:'心　理',fill:'#e8804a'}];
const B_STATS=[{zh:'打擊力',fill:'#d4a017'},{zh:'力　量',fill:'#d96b2b'},{zh:'選球眼',fill:'#5a7aee'},{zh:'速　度',fill:'#2a9a5a'},{zh:'守備力',fill:'#9a60e8'},{zh:'心　理',fill:'#e8804a'}];
const RAR={
  h:{c:'#f8d050',bg:'#2a1a04',lbl:'HERO',bgC:'#18100a',bd:'#d4a017'},
  l:{c:'#cc88ff',bg:'#1a0a30',lbl:'LEGEND',bgC:'#100c1e',bd:'#8a50d8'},
  r:{c:'#7aaaff',bg:'#0e1a38',lbl:'RARE',bgC:'#0c1220',bd:'#4a6acc'},
  c:{c:'#6adb6a',bg:'#1a3a1a',lbl:'COM',bgC:'#0f1c0f',bd:'#3a6a3a'},
  x:{c:'#8b4513',bg:'#f5f0e8',lbl:'RETRO',bgC:'#faf6ee',bd:'#8b4513'},
};

/* ═══ External Data ═══ */
const ALL_PLAYERS=window.ALL_PLAYERS||[];
const NATIONS=window.NATIONS||[];
const PACKS=window.PACKS||[];
// 每個卡包各自的保底計數（FGO 風格：UP 池獨立）
const packPity={std:0,legend:0,limit:0,taiwan:0,retro:0};
// 抽卡歷史（最多100筆）
let pullHistory=[];
const ALL_COACHES=window.ALL_COACHES||[];
const COACH_TYPES=window.COACH_TYPES||[];
const WBC_ERAS=window.WBC_ERAS||[];
const OPPS=window.OPPS||[];
const PLAYS=window.PLAYS||[];
const COACH_MAP=new Map(ALL_COACHES.map(coach=>[coach.id,coach]));
const FALLBACK_WBC_FLAGS=['🇹🇼','🇯🇵','🇰🇷','🇺🇸','🇩🇴','🇻🇪','🇵🇷','🇨🇺'];
const SUPPORTED_WBC_FLAGS=new Set((NATIONS.length?NATIONS.map(n=>n.flag):FALLBACK_WBC_FLAGS).filter(Boolean));
const PLAYABLE_WBC_ERAS=WBC_ERAS
  .map(era=>{
    const teams=(era.teams||[]).filter(team=>SUPPORTED_WBC_FLAGS.has(team.flag));
    return teams.length?{...era,teams}:null;
  })
  .filter(era=>era&&era.teams.length>1);

/* ═══ Runtime UI State ═══ */
let selPack='std';
let pickMode=null,filterPos='全部';
let gs=null,simTimer=null;
let coachTab='bat';
let selNation=null,selLegend=null,lineupSel=[];
let teamPitcherTab='rot';
let lockedFilterPos=null;
let detailContext=null;
let dragSlotContext=null;
let swapSelection=null;
let recruitTab='scout';
let scoutCountdownTimer=null;
let collectionStatusFilter='all';
let collectionNationFilter='all';
let collectionTypeFilter='all';
let collectionDropdownOpen=null;
let collectionDropdownOptions={status:[],nation:[],type:[]};
// sync initial state
syncFromState();

/* ═══ Local Helpers ═══ */
function getNationConfig(nationId){
  return NATION_MAP.get(nationId)??null;
}

function isPitcherPlayer(player){
  return player.pit||hasPos(player,'SP')||hasPos(player,'RP')||hasPos(player,'CP');
}

function getPlayerKey(player){
  return `${player.name}|${player.year??''}`;
}

function getPlayerPoseSrc(p){
  const ps=posArr(p);
  const isJP=p.nat==='🇯🇵';
  const isKR=p.nat==='🇰🇷';
  const pre=isJP?'jp_':isKR?'kr_':'pose_';
  if(ps.includes('C'))return pre+'catcher.png';
  if(isPitcherPlayer(p))return pre+'pitcher.png';
  if(ps.includes('OF')||ps.includes('LF')||ps.includes('CF')||ps.includes('RF'))return pre+'outfielder.png';
  if(ps.includes('1B')||ps.includes('2B')||ps.includes('3B')||ps.includes('SS'))return pre+'infielder.png';
  return pre+'batter.png';
}

function buildPoseMiniCard(p,size='sm'){
  const rs=RAR[p.rar]||RAR.c;
  const isX=p.rar==='x';
  const src=getPlayerPoseSrc(p);
  const isSm=size==='sm';
  return `<div class="pcard ${size}" style="border-color:${rs.bd}">
    <div class="pcard-bar" style="background:${rs.bd}"></div>
    <div class="pcard-art"><img src="${src}" alt=""></div>
    <div class="pcard-foot">
      ${isSm
        ? `<div class="pcard-foot-sm">
             <span class="pcard-ovr" style="color:${rs.c}">${p.ovr}</span>
             <span class="pcard-badge" style="background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd}">${isX?'RTR':rs.lbl}</span>
           </div>`
        : `<div class="pcard-foot-row">
             <div class="pcard-name-block">
               <div class="pcard-name">${cleanName(p.name)}</div>
               <div class="pcard-pos" style="color:${rs.c}">${posStr(p)}</div>
             </div>
             <div class="pcard-ovr-block">
               <div class="pcard-ovr" style="color:${rs.c}">${p.ovr}</div>
               <div class="pcard-badge" style="background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd}">${isX?'RTR':rs.lbl}</div>
             </div>
           </div>`
      }
    </div>
  </div>`;
}

function refreshTeamUI({save=false,switchTab=null}={}){
  if(switchTab)switchTeamTab(switchTab);
  applyTeamViewMode();
  renderTeam();
  renderPlayerList();
  if(save)autoSave();
}

function collectUniquePlayers(refs){
  const seen=new Set();
  const unique=[];
  refs.forEach(ref=>{
    const player=findPlayer(ref.name,ref.year);
    if(!player)return;
    const key=`${player.name}|${player.year??''}`;
    if(seen.has(key))return;
    seen.add(key);
    unique.push(player);
  });
  return unique;
}

function addUniquePlayer(list, seen, player){
  if(!player)return false;
  const key=getPlayerKey(player);
  if(seen.has(key))return false;
  seen.add(key);
  list.push(player);
  return true;
}

function getStarterUniqueKey(player){
  return cleanName(player.name);
}

function addUniqueStarterPlayer(list, seen, player){
  if(!player)return false;
  const key=getStarterUniqueKey(player);
  if(seen.has(key))return false;
  seen.add(key);
  list.push(player);
  return true;
}

const WBC_ROSTER_TOTAL=30;
const WBC_MIN_PITCHERS=14;
const WBC_MIN_CATCHERS=2;
const WBC_TARGET_SP=5;
const WBC_TARGET_CP=1;
const WBC_TARGET_BATTERS=WBC_ROSTER_TOTAL-WBC_MIN_PITCHERS;
const STARTER_RARITY_QUOTA={c:10,r:8,l:7,h:4,x:1};
function getStarterRarityCounts(players){
  const counts={c:0,r:0,l:0,h:0,x:0};
  players.forEach(player=>{
    if(counts[player.rar]!==undefined)counts[player.rar]++;
  });
  return counts;
}

function pickStarterCandidate(pool, roster, seen, predicate){
  const available=pool.filter(player=>!seen.has(getStarterUniqueKey(player))&&predicate(player));
  if(!available.length)return null;
  const counts=getStarterRarityCounts(roster);
  const quotaCandidates=available
    .map(player=>({player,remaining:(STARTER_RARITY_QUOTA[player.rar]??0)-(counts[player.rar]??0)}))
    .filter(entry=>entry.remaining>0)
    .sort((a,b)=>b.remaining-a.remaining);
  return quotaCandidates[0]?.player??available[0];
}

function buildNationStarterRoster(nation, legendName){
  if(!nation)return [];
  const starterPool=collectUniquePlayers([{name:legendName},...nation.starters]);
  const roster=[];
  const seen=new Set();
  const nationPool=ALL_PLAYERS
    .filter(player=>player.nat===nation.flag)
    .sort((a,b)=>b.ovr-a.ovr);
  const combinedPool=[...starterPool,...nationPool];
  const rosterBatters=()=>roster.filter(player=>!isPitcherPlayer(player));
  const rosterCatchers=()=>roster.filter(player=>!isPitcherPlayer(player)&&hasPos(player,'C'));
  const rosterPosCount=pos=>roster.filter(player=>!isPitcherPlayer(player)&&hasPos(player,pos)).length;
  const rosterOutfielders=()=>roster.filter(player=>!isPitcherPlayer(player)&&['LF','CF','RF','OF'].some(pos=>hasPos(player,pos)));
  const rosterPitchers=()=>roster.filter(player=>isPitcherPlayer(player));
  const rosterSPs=()=>roster.filter(player=>hasPos(player,'SP')||(!hasPos(player,'RP')&&!hasPos(player,'CP')&&player.pit));
  const rosterCPs=()=>roster.filter(player=>hasPos(player,'CP'));
  const fillRoster=(predicate,targetCount)=>{
    while(!targetCount()){
      const player=pickStarterCandidate(combinedPool,roster,seen,predicate);
      if(!player)break;
      addUniqueStarterPlayer(roster,seen,player);
    }
  };

  fillRoster(player=>!isPitcherPlayer(player)&&hasPos(player,'C'),()=>rosterCatchers().length>=WBC_MIN_CATCHERS);
  fillRoster(player=>!isPitcherPlayer(player)&&hasPos(player,'1B'),()=>rosterPosCount('1B')>=1);
  fillRoster(player=>!isPitcherPlayer(player)&&hasPos(player,'2B'),()=>rosterPosCount('2B')>=1);
  fillRoster(player=>!isPitcherPlayer(player)&&hasPos(player,'3B'),()=>rosterPosCount('3B')>=1);
  fillRoster(player=>!isPitcherPlayer(player)&&hasPos(player,'SS'),()=>rosterPosCount('SS')>=1);
  fillRoster(player=>!isPitcherPlayer(player)&&['LF','CF','RF','OF'].some(pos=>hasPos(player,pos)),()=>rosterOutfielders().length>=4);
  fillRoster(player=>!isPitcherPlayer(player),()=>rosterBatters().length>=WBC_TARGET_BATTERS);
  fillRoster(player=>isPitcherPlayer(player)&&hasPos(player,'SP'),()=>rosterSPs().length>=WBC_TARGET_SP);
  fillRoster(player=>isPitcherPlayer(player)&&hasPos(player,'CP'),()=>rosterCPs().length>=WBC_TARGET_CP);
  fillRoster(player=>isPitcherPlayer(player)&&hasPos(player,'RP'),()=>rosterPitchers().length>=WBC_MIN_PITCHERS);
  fillRoster(player=>isPitcherPlayer(player),()=>rosterPitchers().length>=WBC_MIN_PITCHERS);
  fillRoster(player=>!isPitcherPlayer(player),()=>rosterBatters().length>=WBC_TARGET_BATTERS);
  fillRoster(()=>true,()=>roster.length>=WBC_ROSTER_TOTAL);
  return roster;
}

function getNationStarterPlayers(nationId,legendName){
  const nation=getNationConfig(nationId);
  if(!nation)return [];
  return buildNationStarterRoster(nation,legendName);
}

function applyNationBranding(nation){
  if(!nation)return;
  document.getElementById('home-flag').textContent=nation.flag;
  document.getElementById('settings-flag').textContent=nation.flag;
  document.getElementById('settings-nation-name').textContent=nation.name;
}

function renderMainScreens(){
  buildBanner();
  renderHome();
  renderCollection();
  applyRecruitTab();
  renderScoutScreen();
  renderFilterTabs();
  applyTeamViewMode();
  renderPlayerList();
  renderTeam();
  renderCoach();
  updateSettingsStats();
}

/* ═══ STEP 1: 選國家 ═══ */
function buildNationScreen(){
  document.getElementById('nation-screen').classList.remove('hide');
  const grid=document.getElementById('nation-grid');grid.innerHTML='';
  const btn=document.getElementById('ns-confirm-btn');
  NATIONS.forEach(n=>{
    const card=document.createElement('div');card.className='nation-card'+(selNation===n.id?' selected':'');
    card.innerHTML=`<div class="nc-flag">${n.flag}</div><div class="nc-name">${n.name}</div><div class="nc-desc">${n.desc}</div><div class="nc-bonus">✦ ${n.bonus}</div>`;
    card.onclick=()=>{selNation=n.id;document.querySelectorAll('.nation-card').forEach(c=>c.classList.remove('selected'));card.classList.add('selected');if(btn)btn.disabled=false;};
    grid.appendChild(card);
  });
  if(btn)btn.disabled=!selNation;
}
function goLegendStep(){
  if(!selNation)return;
  document.getElementById('nation-screen').classList.add('hide');
  buildLegendScreen();
  document.getElementById('legend-screen').classList.add('show');
}

/* ═══ STEP 2: 傳奇三選一 ═══ */
function buildLegendScreen(){
  const n=getNationConfig(selNation);
  if(!n)return;
  document.getElementById('legend-screen-sub').textContent=`選擇一位 ${n.flag} ${n.name} 復古傳奇球員加入起始陣容\n復古特別款・OVR 99・最強版本`;
  const container=document.getElementById('legend-cards');container.innerHTML='';
  n.legends.forEach(lname=>{
    const p=findPlayer(lname);if(!p)return;
    const card=document.createElement('div');card.className='legend-card'+(selLegend===lname?' selected':'');
    const cleanStory=p.story.replace(/<hl>/g,'').replace(/<\/hl>/g,'').replace('復古傳奇特別款・','');
    card.innerHTML=`
      <div class="chk-mark">✓</div>
      <div class="lc-av">${p.av}</div>
      <div class="lc-inf">
        <div class="lc-name">${cardLabel(p)}</div>
        <div class="lc-pos">${posStr(p)} · ${p.nat} · ${p.era?.[0]} 年</div>
        <div class="lc-desc">${cleanStory.substring(0,60)}...</div>
      </div>
      <div class="lc-right">
        <div class="lc-ovr">99</div>
        <div class="lc-ovr-lbl">OVR</div>
        <div class="lc-retro-tag">📸 傳奇</div>
      </div>`;
    card.onclick=()=>{selLegend=lname;buildLegendScreen();document.getElementById('ls-confirm-btn').disabled=false;};
    container.appendChild(card);
  });
}
function goLineupStep(){
  if(!selLegend)return;
  document.getElementById('legend-screen').classList.remove('show');
  buildLineupScreen();
  document.getElementById('lineup-screen').classList.add('show');
}

/* ═══ STEP 3: 預覽 WBC 30 人名單 ═══ */
function buildLineupScreen(){
  const n=getNationConfig(selNation);
  if(!n)return;
  const pool=document.getElementById('ls-pool');pool.innerHTML='';
  const legP=findPlayer(selLegend);
  const unique=getNationStarterPlayers(selNation,selLegend);
  lineupSel=unique.map(p=>({name:p.name,year:p.year}));
  const batters=unique.filter(p=>!isPitcherPlayer(p));
  const sps=unique.filter(p=>hasPos(p,'SP'));
  const rps=unique.filter(p=>hasPos(p,'RP'));
  const cps=unique.filter(p=>hasPos(p,'CP'));
  // 傳奇
  const legSec=document.createElement('div');legSec.className='ls-section-lbl';legSec.textContent='✨ 傳奇球員';pool.appendChild(legSec);
  if(legP)pool.appendChild(buildLineupPlayerRow(legP));
  // 野手
  const batSec=document.createElement('div');batSec.className='ls-section-lbl';batSec.style.marginTop='10px';batSec.textContent='⚾ 野手（'+batters.length+'人）';pool.appendChild(batSec);
  const batFrag2=document.createDocumentFragment();batters.forEach(p=>batFrag2.appendChild(buildLineupPlayerRow(p)));pool.appendChild(batFrag2);
  // 先發
  const spSec=document.createElement('div');spSec.className='ls-section-lbl';spSec.style.marginTop='10px';spSec.textContent='🎯 先發投手（'+sps.length+'人）';pool.appendChild(spSec);
  const spFrag=document.createDocumentFragment();sps.forEach(p=>spFrag.appendChild(buildLineupPlayerRow(p)));pool.appendChild(spFrag);
  // 牛棚
  const rpSec=document.createElement('div');rpSec.className='ls-section-lbl';rpSec.style.marginTop='10px';rpSec.textContent='🔥 牛棚（RP '+rps.length+'・CP '+cps.length+'）';pool.appendChild(rpSec);
  const rpFrag=document.createDocumentFragment();[...rps,...cps].forEach(p=>rpFrag.appendChild(buildLineupPlayerRow(p)));pool.appendChild(rpFrag);
  document.getElementById('lineup-count').textContent=unique.length;
  document.getElementById('ls-footer-info').textContent=`WBC 初始名單 ${unique.length} / ${WBC_ROSTER_TOTAL} 人・確認後進入遊戲！`;
  document.getElementById('ls-start-btn').disabled=false;
}

function buildLineupPlayerRow(p){
  const rs=RAR[p.rar];
  const row=document.createElement('div');
  row.className='ls-pl-row selected';
  row.innerHTML=`
    <div class="ls-chk">✓</div>
    <span style="font-size:18px;flex-shrink:0">${p.av}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:700;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nat} ${cardLabel(p)}</div>
      <div style="font-size:9px;color:var(--color-text-tertiary);margin-top:1px">${posStr(p)} · OVR ${p.ovr}</div>
    </div>
    <span style="font-family:'Bebas Neue',cursive;font-size:15px;color:${rs.c};flex-shrink:0">${p.ovr}</span>
    <span style="font-size:7px;font-weight:700;padding:1px 4px;border-radius:3px;background:${rs.bg};color:${rs.c};font-family:'Bebas Neue',cursive;flex-shrink:0">${rs.lbl}</span>`;
  return row;
}

function finishSetup(){
  const unique=getNationStarterPlayers(selNation,selLegend);
  collection=[...unique];
  myNation=selNation;myLegend=selLegend;
  autoSetLineup(unique);
  autoSave(); // 首次選完國家立刻存檔
  document.getElementById('lineup-screen').classList.remove('show');
  enterGame();
}

function autoSetLineup(players){
  lineup=Array(9).fill(null);battingOrder=[0,1,2,3,4,5,6,7,8];bench=Array(MAX_RESERVE_SLOTS).fill(null);rotation=Array(5).fill(null);bullpen=Array(MAX_RESERVE_SLOTS).fill(null);
  const pitchers=players.filter(isPitcherPlayer);
  const batters=players.filter(p=>!isPitcherPlayer(p));
  // 野手優先依守備位置排先發，避免一開始出現重複位置的隨機打線
  const desiredStarterSlots=['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  const usedBatters=new Set();
  const getDefenseFitScore=(player,slotPos)=>{
    if(slotPos==='DH')return hasPos(player,'DH')?3:1;
    if(hasPos(player,slotPos))return 4;
    if(['LF','CF','RF'].includes(slotPos)&&hasPos(player,'OF'))return 3;
    if(['LF','RF'].includes(slotPos)&&['LF','RF'].some(pos=>hasPos(player,pos)))return 2;
    if(slotPos==='CF'&&['LF','RF'].some(pos=>hasPos(player,pos)))return 1;
    return 0;
  };
  const takeBatter=(predicate,slotPos=null)=>{
    const candidate=batters
      .filter(p=>!usedBatters.has(getPlayerKey(p)))
      .filter(predicate)
      .sort((a,b)=>{
        const fitDiff=slotPos?getDefenseFitScore(b,slotPos)-getDefenseFitScore(a,slotPos):0;
        if(fitDiff!==0)return fitDiff;
        const versatilityDiff=posArr(a).length-posArr(b).length;
        if(versatilityDiff!==0)return versatilityDiff;
        return b.ovr-a.ovr;
      })[0];
    if(candidate)usedBatters.add(getPlayerKey(candidate));
    return candidate||null;
  };
  const fillSlot=(slotPos)=>{
    if(slotPos==='DH'){
      return takeBatter(p=>hasPos(p,'DH'),slotPos)
        || takeBatter(p=>['1B','LF','RF','OF'].some(pos=>hasPos(p,pos)),slotPos)
        || takeBatter(()=>true,slotPos);
    }
    if(['LF','CF','RF'].includes(slotPos)){
      return takeBatter(p=>hasPos(p,slotPos),slotPos)
        || takeBatter(p=>hasPos(p,'OF'),slotPos)
        || takeBatter(p=>['LF','CF','RF'].some(pos=>hasPos(p,pos)),slotPos)
        || takeBatter(()=>true,slotPos);
    }
    return takeBatter(p=>hasPos(p,slotPos),slotPos)
      || takeBatter(()=>true,slotPos);
  };
  desiredStarterSlots.forEach((slotPos,i)=>{lineup[i]=fillSlot(slotPos);});
  batters
    .filter(p=>!usedBatters.has(getPlayerKey(p)))
    .sort((a,b)=>b.ovr-a.ovr)
    .slice(0,getBenchSlotCount())
    .forEach((p,i)=>{bench[i]=p;});
  // 投手分類
  const cps=pitchers.filter(p=>hasPos(p,'CP'));
  const rps=pitchers.filter(p=>hasPos(p,'RP'));
  const sps=pitchers.filter(p=>hasPos(p,'SP')||(!hasPos(p,'CP')&&!hasPos(p,'RP')&&p.pit));
  const otherPitchers=pitchers.filter(p=>!hasPos(p,'SP')&&!hasPos(p,'RP')&&!hasPos(p,'CP'));
  const closerIdx=getCloserIndex();
  const middleBullpenSlots=Math.max(0,getBullpenSlotCount()-1);
  if(cps[0])bullpen[closerIdx]=cps[0];
  rps.slice(0,middleBullpenSlots).forEach((p,i)=>{bullpen[i]=p;});
  sps.slice(0,5).forEach((p,i)=>rotation[i]=p);
  otherPitchers.forEach(p=>{
    const rotIdx=rotation.indexOf(null);
    if(rotIdx>=0){rotation[rotIdx]=p;return;}
    const bullIdx=findFirstEmptySlot(bullpen,getBullpenSlotCount(),closerIdx);
    if(bullIdx>=0)bullpen[bullIdx]=p;
  });
  sps.slice(5).forEach(p=>{
    const bullIdx=findFirstEmptySlot(bullpen,getBullpenSlotCount(),closerIdx);
    if(bullIdx>=0)bullpen[bullIdx]=p;
  });
  rps.slice(middleBullpenSlots).forEach(p=>{
    const bullIdx=findFirstEmptySlot(bullpen,getBullpenSlotCount(),closerIdx);
    if(bullIdx>=0)bullpen[bullIdx]=p;
  });
  if(!bullpen[closerIdx]){
    const fallbackCloser=bullpen.find(Boolean)||rotation.find(Boolean)||pitchers[0]||null;
    if(fallbackCloser)bullpen[closerIdx]=fallbackCloser;
  }
}

function showUnpackAnim(cards,nation){
  const overlay=document.getElementById('unpack-overlay');
  document.getElementById('up-title').textContent=`🎁 ${nation.flag} ${nation.name} WBC 初始名單`;
  document.getElementById('up-sub').textContent=`獲得 ${cards.length} 張起始卡牌（WBC 30 人名單）！`;
  unpackAnimState.cards=cards.slice();
  unpackAnimState.nation={...nation};
  startUnpackAnim(true);
  overlay.classList.add('show');
}

const unpackAnimState={
  cards:[],
  nation:null,
  timer:null,
  completed:false
};

function renderUnpackCards(cards,{animated=true}={}){
  const container=document.getElementById('up-cards');
  container.innerHTML='';
  cards.slice(0,12).forEach((card,i)=>{
    const rs=RAR[card.rar];const isH=card.rar==='h';
    const outer=document.createElement('div');outer.className='card-outer-sm';
    if(isH){const g=document.createElement('div');g.className='hero-ring';outer.appendChild(g);}
    const c=document.createElement('div');c.className='rc';
    const delay=animated?i*.07:0;
    const animation=animated?`cardIn .35s ease ${delay}s both`:'none';
    const isX2=card.rar==='x';
    const isH2=card.rar==='h';
    c.style.cssText=`background:#0c1b2e;border:2px solid ${rs.bd};animation:${animation};width:70px;opacity:1;transform:none;box-shadow:${isH2?'0 0 10px rgba(212,160,23,.4)':'0 6px 16px rgba(0,0,0,.2)'}`;
    c.innerHTML=`<div class="rc-top" style="background:${rs.bd}"></div><div class="rc-body"><img src="${getPlayerPoseSrc(card)}" style="width:100%;height:100%;object-fit:contain;display:block"></div><div class="rc-bot"><div class="rc-foot-row"><div class="rc-name-block"><div class="rc-name">${card.nat} ${cleanName(card.name)}</div><div class="rc-pos">${posStr(card)}${card.year?' · '+card.year:''}</div></div><div class="rc-ovr-block"><span class="rc-ovr" style="color:${rs.c}">${card.ovr}</span><span class="rc-sub" style="background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd}">${isX2?'RTR':rs.lbl}</span></div></div></div>`;
    outer.appendChild(c);container.appendChild(outer);
  });
}

function setUnpackAnimComplete(completed){
  unpackAnimState.completed=completed;
  const skipBtn=document.getElementById('up-skip-btn');
  const replayBtn=document.getElementById('up-replay-btn');
  skipBtn.disabled=completed;
  replayBtn.disabled=!completed;
}

function startUnpackAnim(animated=true){
  clearTimeout(unpackAnimState.timer);
  renderUnpackCards(unpackAnimState.cards,{animated});
  if(!animated){
    setUnpackAnimComplete(true);
    return;
  }
  setUnpackAnimComplete(false);
  const totalCards=Math.min(unpackAnimState.cards.length,12);
  const totalMs=Math.max(550,350+Math.max(0,totalCards-1)*70+220);
  unpackAnimState.timer=setTimeout(()=>{
    unpackAnimState.timer=null;
    setUnpackAnimComplete(true);
  },totalMs);
}

function skipUnpackAnim(){
  if(unpackAnimState.completed)return;
  startUnpackAnim(false);
}

function replayUnpackAnim(){
  if(!unpackAnimState.cards.length)return;
  startUnpackAnim(true);
}

function enterGame(){
  clearTimeout(unpackAnimState.timer);
  unpackAnimState.timer=null;
  document.getElementById('unpack-overlay').classList.remove('show');
  applyNationBranding(getNationConfig(myNation));
  renderMainScreens();
  // 顯示主畫面
  hideAllScreens();
  document.getElementById('sc-home').classList.add('show');
}

/* ═══ SCREEN NAV ═══ */
function goScreen(id){
  const requestedId=id;
  if(id!=='team'&&pickMode){
    pickMode=null;
    lockedFilterPos=null;
    filterPos='全部';
    swapSelection=null;
    teamPitcherTab='rot';
    const banner=document.getElementById('pick-banner');
    if(banner)banner.classList.remove('show');
  }
  if(requestedId==='scout'){
    recruitTab='scout';
    id='gacha';
  }else if(requestedId==='gacha'){
    recruitTab='scout';
  }
  hideAllScreens();
  document.getElementById('sc-'+id)?.classList.add('show');
  if(id==='team')refreshTeamUI({switchTab:'bat'});
  if(id==='match'){
    resetMatchSetupView();
    renderMatchSetup();
  }
  if(id==='home')renderHome();
  if(id==='collection')renderCollection();
  if(id==='coach')renderCoach();
  if(id==='gacha'){applyRecruitTab();if(recruitTab==='scout')renderScoutScreen();}
  if(id==='settings')updateSettingsStats();
  const activeNav=id==='gacha'&&recruitTab==='scout'?'scout':id;
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active',el.getAttribute('onclick')===`goScreen('${activeNav}')`);
  });
}

/* ═══ HOME ═══ */
const BANNERS=[
  {bg:'radial-gradient(ellipse at 28% 60%,#2a9a52 0%,transparent 54%),linear-gradient(150deg,#051e0e 0%,#0a3a1c 45%,#082814 100%)',icon:'🔥',tag:'招募中心',title:'招募球員',sub:'搜尋頂尖球員，打造你的最強陣容',page:'gacha'},
  {bg:'radial-gradient(ellipse at 30% 55%,#3a1e60 0%,transparent 52%),linear-gradient(150deg,#06040f 0%,#140a22 40%,#1e0e04 100%)',icon:'🏆',tag:'賽季模式',title:'WBC 2026',sub:'帶領你的國家征戰世界！',page:'match'},
  {bg:'radial-gradient(ellipse at 25% 60%,#6a3010 0%,transparent 50%),linear-gradient(150deg,#0e0704 0%,#241004 45%,#160c04 100%)',icon:'🧑‍🏫',tag:'教練系統',title:'招募教練',sub:'提升打擊・投手・守備・心理・調度',page:'coach'},
];
let curBanner=0,bannerTimer=null;
function buildBanner(){
  const sl=document.getElementById('banner-slides'),dots=document.getElementById('bdots');sl.innerHTML='';dots.innerHTML='';
  BANNERS.forEach((b,i)=>{
    const s=document.createElement('div');s.className='banner-slide';s.style.background=b.bg;
    s.innerHTML=`
      <div class="bs-glow"></div>
      <div class="bs-deco-icon">${b.icon}</div>
      <div class="bs-copy">
        <div class="bs-tag-row">
          <span class="bs-tag">${b.tag}</span>
          <span class="bs-live">HOT</span>
        </div>
        <div class="bs-title">${b.title}</div>
        <div class="bs-sub">${b.sub}</div>
        <div class="bs-footer">
          <span class="bs-cta">立即前往 →</span>
        </div>
      </div>`;
    s.onclick=()=>goScreen(b.page);sl.appendChild(s);
    const d=document.createElement('div');d.className='bdot'+(i===0?' active':'');d.onclick=()=>goBanner(i);dots.appendChild(d);
  });
  if(bannerTimer)clearInterval(bannerTimer);
  bannerTimer=setInterval(()=>goBanner((curBanner+1)%BANNERS.length),3500);
}
function goBanner(i){curBanner=i;document.getElementById('banner-slides').style.transform=`translateX(-${i*100}%)`;document.querySelectorAll('.bdot').forEach((d,j)=>d.classList.toggle('active',j===i));}
/* ── 每日任務定義 ── */
const DAILY_DEF=[
  {i:'🎴',n:'今日抽卡',max:3,r:'💎×30',gems:30},
  {i:'⚾',n:'完成一場比賽',max:1,r:'💎×50',gems:50},
  {i:'🧑‍🏫',n:'裝備一位教練',max:1,r:'💎×20',gems:20},
];
/* ── 每日狀態（每日重置）── */
/* ═══ COLLECTION ═══ */
function setCollectionStatusFilter(filter){
  collectionStatusFilter=filter;
  closeCollectionDropdown();
  renderCollection();
}
function setCollectionNationFilter(filter){
  collectionNationFilter=filter;
  closeCollectionDropdown();
  renderCollection();
}
function setCollectionTypeFilter(filter){
  collectionTypeFilter=filter;
  closeCollectionDropdown();
  renderCollection();
}
function closeCollectionDropdown(){
  collectionDropdownOpen=null;
  ['status','nation','type'].forEach(key=>{
    document.getElementById(`collection-${key}-wrap`)?.classList.remove('open');
  });
}
function toggleCollectionDropdown(key){
  if(collectionDropdownOpen===key){closeCollectionPicker();return;}
  closeCollectionDropdown();
  collectionDropdownOpen=key;
  const wrap=document.getElementById(`collection-${key}-wrap`);
  const overlay=document.getElementById('collection-picker-overlay');
  const sheet=overlay?.querySelector('.collection-picker-sheet');
  wrap?.classList.add('open');
  const optionsWrap=document.getElementById('collection-picker-options');
  if(optionsWrap){
    function renderDropdownOptions(options){
      const frag=document.createDocumentFragment();
      options.forEach(option=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='collection-dropdown-opt'+(option.active?' active':'');
        btn.textContent=option.label;
        if(option.children){
          btn.classList.add('has-children');
          btn.onclick=()=>{
            optionsWrap.querySelectorAll('.collection-dropdown-opt').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            // 展開子選項
            let sub=optionsWrap.querySelector('.collection-dropdown-sub');
            if(sub)sub.remove();
            sub=document.createElement('div');
            sub.className='collection-dropdown-sub';
            option.children.forEach(child=>{
              const cbtn=document.createElement('button');
              cbtn.type='button';
              cbtn.className='collection-dropdown-opt sub'+(child.active?' active':'');
              cbtn.textContent=child.label;
              cbtn.onclick=()=>{
                optionsWrap.querySelectorAll('.collection-dropdown-opt').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                cbtn.classList.add('active');
                child.onPick();
              };
              sub.appendChild(cbtn);
            });
            btn.insertAdjacentElement('afterend',sub);
          };
        }else{
          btn.onclick=()=>{
            optionsWrap.querySelectorAll('.collection-dropdown-opt').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            option.onPick();
          };
        }
        frag.appendChild(btn);
      });
      optionsWrap.innerHTML='';
      optionsWrap.appendChild(frag);
      // 若目前篩選值是子選項，自動展開父層
      const cur=collectionTypeFilter;
      if(key==='type'){
        const parent=options.find(o=>o.children?.some(c=>c.id===cur));
        if(parent){
            const allParents=[...optionsWrap.querySelectorAll('.collection-dropdown-opt.has-children')];
          allParents.forEach(pb=>{
            if(pb.textContent===parent.label)pb.click();
          });
        }
      }
    }
    renderDropdownOptions(collectionDropdownOptions[key]||[]);
  }
  if(overlay&&sheet&&wrap){
    const appRect=(document.querySelector('.app')||overlay).getBoundingClientRect();
    const wrapRect=wrap.getBoundingClientRect();
    const btnRect=wrap.querySelector('.collection-select-btn')?.getBoundingClientRect()||wrapRect;
    const desiredLeft=Math.min(Math.max(12,wrapRect.left-appRect.left),Math.max(12,appRect.width-240));
    const desiredTop=btnRect.bottom-appRect.top+4;
    sheet.style.left=`${desiredLeft}px`;
    sheet.style.top=`${desiredTop}px`;
  }
  overlay?.classList.add('show');
}
function closeCollectionPicker(e){
  if(e&&e.target&&e.target!==e.currentTarget)return;
  document.getElementById('collection-picker-overlay')?.classList.remove('show');
  closeCollectionDropdown();
}
function renderCollection(){
  const nation=getNationConfig(myNation);
  const myFlag=nation?.flag||null;
  const allUnique=Array.from(new Map(ALL_PLAYERS.filter(Boolean).map(p=>[getPlayerKey(p),p])).values());
  const ownedUnique=Array.from(new Map(collection.filter(Boolean).map(p=>[getPlayerKey(p),p])).values());
  const ownedKeys=new Set(ownedUnique.map(p=>getPlayerKey(p)));
  const hitters=ownedUnique.filter(p=>!isPitcherPlayer(p));
  const pitchers=ownedUnique.filter(p=>isPitcherPlayer(p));
  const ownNation=myFlag?ownedUnique.filter(p=>p.nat===myFlag):[];
  const nationFlags=[...new Set(allUnique.map(p=>p.nat).filter(Boolean))];
  const orderedFlags=[
    ...NATIONS.map(n=>n.flag).filter(f=>nationFlags.includes(f)),
    ...nationFlags.filter(f=>!NATIONS.some(n=>n.flag===f)).sort(),
  ];
  const allProgressLabelEl=document.getElementById('collection-all-progress-label');
  const allProgressPctEl=document.getElementById('collection-all-progress-pct');
  const allProgressFillEl=document.getElementById('collection-all-progress-fill');
  const nationProgressLabelEl=document.getElementById('collection-nation-progress-label');
  const nationProgressPctEl=document.getElementById('collection-nation-progress-pct');
  const nationProgressFillEl=document.getElementById('collection-nation-progress-fill');
  const allPct=allUnique.length?Math.min(100,Math.round(ownedUnique.length/allUnique.length*100)):0;
  const nationTotal=myFlag?allUnique.filter(p=>p.nat===myFlag).length:0;
  const nationPct=nationTotal?Math.min(100,Math.round(ownNation.length/nationTotal*100)):0;
  if(allProgressLabelEl)allProgressLabelEl.textContent=`全部 ${ownedUnique.length} / ${allUnique.length}`;
  if(allProgressPctEl)allProgressPctEl.textContent=`${allPct}%`;
  if(allProgressFillEl)allProgressFillEl.style.width=`${allPct}%`;
  if(nationProgressLabelEl)nationProgressLabelEl.textContent=`本國 ${ownNation.length} / ${nationTotal}`;
  if(nationProgressPctEl)nationProgressPctEl.textContent=`${nationPct}%`;
  if(nationProgressFillEl)nationProgressFillEl.style.width=`${nationPct}%`;
  const statusOptions=[
    {id:'all',label:'收藏'},{id:'owned',label:'已收藏'},{id:'unowned',label:'未收藏'},
  ];
  const nationOptions=[{id:'all',label:'國家'},...orderedFlags.map(flag=>{
    const nat=NATIONS.find(n=>n.flag===flag);
    return {id:flag,label:`${nat?.name||flag}`};
  })];
  const typeOptions=[
    {id:'all',label:'類型'},
    {id:'hitters',label:'野手',children:[
      {id:'C',label:'C'},
      {id:'1B',label:'1B'},
      {id:'2B',label:'2B'},
      {id:'3B',label:'3B'},
      {id:'SS',label:'SS'},
      {id:'LF',label:'LF'},
      {id:'CF',label:'CF'},
      {id:'RF',label:'RF'},
      {id:'OF',label:'OF'},
    ]},
    {id:'pitchers',label:'投手',children:[
      {id:'SP',label:'SP'},
      {id:'RP',label:'RP'},
      {id:'CP',label:'CP'},
    ]},
  ];
  const statusLabel=document.getElementById('collection-status-label');
  const nationLabel=document.getElementById('collection-nation-label');
  const typeLabel=document.getElementById('collection-type-label');
  if(statusLabel)statusLabel.textContent=statusOptions.find(o=>o.id===collectionStatusFilter)?.label||'收藏';
  if(nationLabel)nationLabel.textContent=nationOptions.find(o=>o.id===collectionNationFilter)?.label||'國家';
  if(typeLabel)typeLabel.textContent=typeOptions.find(o=>o.id===collectionTypeFilter)?.label||'類型';
  document.getElementById('collection-status-wrap')?.classList.toggle('active',collectionStatusFilter!=='all');
  document.getElementById('collection-nation-wrap')?.classList.toggle('active',collectionNationFilter!=='all');
  document.getElementById('collection-type-wrap')?.classList.toggle('active',collectionTypeFilter!=='all');
  collectionDropdownOptions.status=statusOptions.map(o=>({...o,active:collectionStatusFilter===o.id,onPick:()=>setCollectionStatusFilter(o.id)}));
  collectionDropdownOptions.nation=nationOptions.map(o=>({...o,active:collectionNationFilter===o.id,onPick:()=>setCollectionNationFilter(o.id)}));
  collectionDropdownOptions.type=typeOptions.map(o=>({
    ...o,
    active:collectionTypeFilter===o.id,
    onPick:()=>setCollectionTypeFilter(o.id),
    children:o.children?.map(c=>({...c,active:collectionTypeFilter===c.id,onPick:()=>setCollectionTypeFilter(c.id)})),
  }));
  let list=[...allUnique];
  if(collectionNationFilter!=='all')list=list.filter(p=>p.nat===collectionNationFilter);
  if(collectionStatusFilter==='owned')list=list.filter(p=>ownedKeys.has(getPlayerKey(p)));
  if(collectionStatusFilter==='unowned')list=list.filter(p=>!ownedKeys.has(getPlayerKey(p)));
  if(collectionTypeFilter==='hitters')list=list.filter(p=>!isPitcherPlayer(p));
  else if(['C','1B','2B','3B','SS','LF','CF','RF','OF'].includes(collectionTypeFilter))
    list=list.filter(p=>!isPitcherPlayer(p)&&hasPos(p,collectionTypeFilter));
  else if(collectionTypeFilter==='pitchers')list=list.filter(p=>isPitcherPlayer(p));
  else if(collectionTypeFilter==='SP')list=list.filter(p=>hasPos(p,'SP')||(!hasPos(p,'RP')&&!hasPos(p,'CP')&&p.pit));
  else if(collectionTypeFilter==='RP')list=list.filter(p=>hasPos(p,'RP'));
  else if(collectionTypeFilter==='CP')list=list.filter(p=>hasPos(p,'CP'));
  list.sort((a,b)=>
    (ownedKeys.has(getPlayerKey(b))?1:0)-(ownedKeys.has(getPlayerKey(a))?1:0)||
    b.ovr-a.ovr||cleanName(a.name).localeCompare(cleanName(b.name),'zh-Hant')
  );
  const grid=document.getElementById('collection-grid');
  if(!grid)return;
  if(!list.length){
    grid.innerHTML=`<div class="collection-empty" style="grid-column:1/-1">目前這個分類還沒有球員卡<br>去招募中心或比賽頁收集更多球員吧。</div>`;
    return;
  }
  const frag=document.createDocumentFragment();
  list.forEach(p=>{
    const rs=RAR[p.rar]||RAR.c;
    const isOwned=ownedKeys.has(getPlayerKey(p));
    const card=document.createElement('div');
    card.className='collection-card'+(isOwned?'':' unowned');
    card.style.border=`2px solid ${rs.bd}`;
    const isXc=p.rar==='x';
    card.innerHTML=`
      <div class="collection-card-top" style="background:${rs.bd}"></div>
      <div class="collection-card-body">
        <img src="${getPlayerPoseSrc(p)}" class="cc-img" alt="">
      </div>
      <div class="collection-card-foot">
        <div class="cc-name-row">
          <div class="collection-card-name">${p.nat} ${cleanName(p.name)}</div>
          <span class="cc-ovr-num" style="color:${rs.c}">${p.ovr}</span>
        </div>
        <div class="cc-sub-row">
          <span class="collection-card-meta">${posStr(p)}${p.year?' · '+p.year:''}</span>
          <span class="cc-rar-tag" style="color:${rs.c};background:${rs.bg}">${isXc?'RTR':rs.lbl}</span>
        </div>
      </div>`;
    card.onclick=()=>{const dp=isOwned?(ownedUnique.find(op=>getPlayerKey(op)===getPlayerKey(p))||p):p;showDetail(dp);};
    frag.appendChild(card);
  });
  grid.innerHTML='';
  grid.appendChild(frag);
}

/* ═══ GACHA ═══ */
const POOL={
  std:ALL_PLAYERS,
  legend:ALL_PLAYERS.filter(p=>p.rar==='h'||p.rar==='l'),
  limit:ALL_PLAYERS.filter(p=>['🇻🇪','🇯🇵'].includes(p.nat)),
  taiwan:ALL_PLAYERS.filter(p=>p.nat==='🇹🇼'),
};
function updateGemDisp(){['gem-home','gem-gacha','gem-disp','gem-scout'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=gems.toLocaleString();});}
function applyRecruitTab(){
  const scoutPage=document.getElementById('recruit-page-scout');
  if(scoutPage)scoutPage.classList.add('show');
}
function switchRecruitTab(tab){
  recruitTab=tab;
  applyRecruitTab();
  if(tab==='scout')renderScoutScreen();
}
function buildPacks(){
  const g=document.getElementById('pack-grid');g.innerHTML='';
  const frag=document.createDocumentFragment();
  PACKS.forEach(p=>{
    const c=document.createElement('div');c.className='pack-card'+(p.id===selPack?' selected':'');
    const upHtml=p.up?`<div style="display:flex;align-items:center;gap:4px;margin-top:5px"><span class="up-badge">UP</span><span style="font-size:8px;color:var(--color-text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${p.up.name}</span></div>`:'';
    const rarHtml=p.rates.x?`<span class="rate-tag" style="background:rgba(139,69,19,.15);color:#8b4513">RETRO ${p.rates.x}%</span>`:'';
    c.innerHTML=`<div class="pack-top" style="background:${p.bg}">${p.emoji}</div><div class="pack-info"><div class="pack-name">${p.name}</div><div class="pack-desc">${p.desc}</div><div class="pack-rates"><span class="rate-tag" style="background:rgba(212,160,23,.12);color:#f8d050">HERO ${p.rates.h}%</span><span class="rate-tag" style="background:rgba(154,96,232,.12);color:#cc88ff">LEG ${p.rates.l}%</span>${rarHtml}</div>${upHtml}<div style="font-size:8px;color:var(--color-text-tertiary);margin-top:4px">天井 ${p.pity}抽 · 軟保底 ${p.softPity}抽</div></div>`;
    c.onclick=()=>{openPullChoice(p.id);};frag.appendChild(c);
  });
  g.appendChild(frag);
  updatePityUI();renderUPInfo();
}
function _packHeaderBg(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `linear-gradient(160deg,rgba(${r},${g},${b},.45) 0%,#0a0a10 80%)`;
}
function openPullChoice(packId){
  selPack=packId;
  const pack=PACKS.find(p=>p.id===packId);if(!pack)return;
  const header=document.getElementById('pcb-header');
  const body=document.getElementById('pcb-body');
  header.style.background=_packHeaderBg(pack.color);
  header.innerHTML=`<div style="font-size:52px;margin-bottom:8px">${pack.emoji}</div><div style="font-family:'Bebas Neue',cursive;font-size:24px;color:#fff;letter-spacing:.05em;text-shadow:0 1px 8px rgba(0,0,0,.6)">${pack.name}</div><div style="font-size:11px;color:rgba(255,255,255,.85);margin-top:5px;text-shadow:0 1px 4px rgba(0,0,0,.5)">${pack.desc}</div>`;
  const cur=packPity[packId]||0;
  const pct=Math.min(100,Math.round(cur/pack.pity*100));
  const upHtml=pack.up?`<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(212,160,23,.08);border-radius:8px;border:.5px solid rgba(212,160,23,.3);margin-bottom:10px"><span class="up-badge">UP</span><span style="font-size:10px;color:rgba(255,255,255,.85);flex:1">${pack.up.name}</span><span style="font-size:9px;color:#d4a017">HERO中 ${pack.up.upBonus}%</span></div>`:'';
  body.innerHTML=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px"><span class="rate-tag" style="background:rgba(212,160,23,.2);color:#f8d050">HERO ${pack.rates.h}%</span><span class="rate-tag" style="background:rgba(154,96,232,.2);color:#cc88ff">LEG ${pack.rates.l}%</span><span class="rate-tag" style="background:rgba(122,170,255,.2);color:#7aaaff">RARE ${pack.rates.r}%</span>${pack.rates.x?`<span class="rate-tag" style="background:rgba(139,69,19,.25);color:#c8783a">RETRO ${pack.rates.x}%</span>`:''}</div>${upHtml}<div><div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.7);margin-bottom:5px"><span>天井進度 ${cur} / ${pack.pity}</span><span>${cur>=pack.softPity?'⚠️ 軟保底中':'軟保底 '+pack.softPity+' 抽後'}</span></div><div style="height:5px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${cur>=pack.softPity?'linear-gradient(90deg,#f06070,#f8d050)':'linear-gradient(90deg,#d4a017,#f8d050)'};border-radius:3px"></div></div></div>`;
  document.getElementById('pull-choice-overlay').classList.add('show');
  updatePityUI();
}
function closePullChoice(){document.getElementById('pull-choice-overlay').classList.remove('show');}
function closePullChoiceBg(e){if(e.target===document.getElementById('pull-choice-overlay'))closePullChoice();}

function updatePityUI(){
  const pack=PACKS.find(p=>p.id===selPack);if(!pack)return;
  const cur=packPity[selPack]||0;
  const pct=Math.min(100,Math.round(cur/pack.pity*100));
  const remaining=pack.pity-cur;
  const inSoft=cur>=pack.softPity;
  const fi=document.getElementById('pity-fi');
  if(fi){fi.style.width=pct+'%';fi.style.background=inSoft?'linear-gradient(90deg,#f06070,#f8d050)':'linear-gradient(90deg,#d4a017,#f8d050)';}
  const ct=document.getElementById('pity-count-txt');if(ct){ct.textContent=cur;ct.style.color=inSoft?'#f06070':'#d4a017';}
  const mx=document.getElementById('pity-max-txt');if(mx)mx.textContent='/ '+pack.pity;
  const rm=document.getElementById('pity-remaining-txt');
  if(rm)rm.textContent=inSoft?`⚠️ 軟保底中！每抽+${pack.softStep}% HERO（距天井 ${remaining} 抽）`:`距天井 ${remaining} 抽・${pack.softPity-cur>0?pack.softPity-cur+'抽後軟保底':'已在軟保底'}`;
  const sm=document.getElementById('soft-pity-marker');if(sm)sm.textContent=pack.softPity+' 抽';
  updateGemDisp();
}
function renderUPInfo(){
  const pack=PACKS.find(p=>p.id===selPack);
  const row=document.getElementById('up-info-row');if(!row)return;
  if(pack&&pack.up)row.innerHTML=`<span class="up-badge">UP</span> <span style="font-size:10px;color:var(--color-text-secondary);margin-left:4px">${pack.up.name}</span><span style="font-size:9px;color:var(--color-text-tertiary);margin-left:6px">HERO中 ${pack.up.upBonus}% 為UP</span>`;
  else row.innerHTML=`<span class="gem-chip">💎 ${gems.toLocaleString()}</span><span style="font-size:10px;color:var(--color-text-tertiary);margin-left:8px">單抽300 · 十連2700</span>`;
}
function rollOne(packId){
  const pack=PACKS.find(p=>p.id===packId);if(!pack)return null;
  packPity[packId]=(packPity[packId]||0)+1;
  const cur=packPity[packId];
  let hRate=pack.rates.h;
  if(cur>=pack.softPity)hRate=Math.min(100,pack.rates.h+(cur-pack.softPity+1)*pack.softStep);
  let rar;
  if(cur>=pack.pity){packPity[packId]=0;rar='h';}
  else{
    const r=Math.random()*100;
    const xRate=pack.rates.x||0;
    if(r<hRate)rar='h';
    else if(r<hRate+xRate)rar='x';
    else if(r<hRate+xRate+pack.rates.l)rar='l';
    else if(r<hRate+xRate+pack.rates.l+pack.rates.r)rar='r';
    else rar='c';
  }
  if(rar==='h')packPity[packId]=0;
  let pool=(POOL[packId]||ALL_PLAYERS).filter(x=>x.rar===rar);
  if(rar==='h'&&pack.up&&Math.random()*100<pack.up.upBonus){
    const upNames=pack.up.name.split(' / ').map(s=>s.trim());
    const upPool=pool.filter(p=>upNames.some(u=>p.name===u||p.name.includes(cleanName(u))));
    if(upPool.length)pool=upPool;
  }
  if(rar==='x')pool=ALL_PLAYERS.filter(p=>p.rar==='x');
  if(!pool.length)pool=ALL_PLAYERS.filter(p=>p.rar==='r');
  const card=pool[Math.floor(Math.random()*pool.length)]||ALL_PLAYERS[0];
  const _isDup=!!collection.find(c=>c.name===card.name&&(c.year??null)===(card.year??null));
  if(!_isDup)collection.push(card);
  return {...card,_pityAt:cur,_isDup};
}
function addToHistory(cards){
  cards.forEach(c=>{const rs=RAR[c.rar]||RAR.r;pullHistory.unshift({name:cleanName(c.name),nat:c.nat,av:c.av,rar:c.rar,rarlbl:rs.lbl,rarc:rs.c,rarbg:rs.bg});});
  if(pullHistory.length>100)pullHistory=pullHistory.slice(0,100);
}
function renderPullHistory(){
  const wrap=document.getElementById('pull-history-wrap');
  const list=document.getElementById('ph-list');
  if(!pullHistory.length){if(wrap)wrap.style.display='none';return;}
  if(wrap)wrap.style.display='block';
  const heroCount=pullHistory.filter(h=>h.rar==='h'||h.rar==='x').length;
  const legCount=pullHistory.filter(h=>h.rar==='l').length;
  const ph=document.getElementById('ph-stats');if(ph)ph.textContent=`共${pullHistory.length}抽 HERO×${heroCount} LEG×${legCount}`;
  const frag=document.createDocumentFragment();
  pullHistory.slice(0,50).forEach((h,i)=>{
    const item=document.createElement('div');item.className='ph-item';
    if(h.rar==='h'||h.rar==='x')item.style.background=RAR[h.rar].bg;
    item.style.borderLeft=`3px solid ${RAR[h.rar]?.bd||h.rarc}`;
    item.innerHTML=`<span class="ph-num">${pullHistory.length-i}</span><span class="ph-name" style="color:${h.rarc}">${h.nat} ${h.name}</span><span class="ph-rar" style="background:${h.rarbg};color:${h.rarc};border:1px solid ${RAR[h.rar]?.bd||h.rarc}">${h.rarlbl}</span>`;
    frag.appendChild(item);
  });
  if(list){list.innerHTML='';list.appendChild(frag);}
}
function doPull(n){
  const cost=n===1?300:2700;if(gems<cost){showSaveToast('💎 不足！');return;}
  gems-=cost;updateGemDisp();
  let results=[];let dupComp=0;
  for(let i=0;i<n;i++){const r=rollOne(selPack);results.push(r);if(r&&r._isDup){const tbl={h:150,l:100,r:50,x:100,c:20};dupComp+=(tbl[r.rar]||20);}}
  if(n===10&&!results.some(r=>r&&['h','l','r','x'].includes(r.rar))){
    const pool=(POOL[selPack]||ALL_PLAYERS).filter(x=>x.rar==='r');
    if(pool.length)results[9]={...pool[Math.floor(Math.random()*pool.length)],_pityAt:0};
  }
  results=results.filter(Boolean);
  if(dupComp>0){gems+=dupComp;updateGemDisp();setTimeout(()=>showSaveToast(`♻️ 重複補償 +${dupComp} 💎`),400);}
  // 每日任務：抽卡進度
  dailyState.pull=Math.min(3,dailyState.pull+n);saveDailyState();
  addToHistory(results);updatePityUI();renderPullHistory();
  if(n===1)showSinglePullAnim(results[0]);
  else showTenPullAnim(results);
  autoSave();
}
function buildCardElement(card,large=false){
  const rs=RAR[card.rar]||RAR.r;
  const isH=card.rar==='h';const isX=card.rar==='x';const isL=card.rar==='l';
  const wrap=document.createElement('div');
  wrap.style.cssText=`position:relative;width:${large?180:62}px;flex-shrink:0`;
  if(isH||isX){const gl=document.createElement('div');gl.className='hero-star-burst';wrap.appendChild(gl);for(let i=0;i<8;i++){const ray=document.createElement('div');ray.className='beam-ray';ray.style.transform=`rotate(${i*45}deg)`;wrap.appendChild(ray);}}
  else if(isL){const gl=document.createElement('div');gl.className='legend-glow-wrap';wrap.appendChild(gl);}
  const ce=document.createElement('div');
  const boxShadow=isH?`0 0 ${large?24:10}px rgba(212,160,23,.5)`:isL?`0 0 ${large?20:8}px rgba(138,80,216,.45)`:isX?`0 0 ${large?14:6}px rgba(139,69,19,.3)`:`0 8px 20px rgba(0,0,0,.25)`;
  ce.style.cssText=`background:#0c1b2e;border:${large?2:1.5}px solid ${rs.bd};box-shadow:${boxShadow};border-radius:${large?12:8}px;overflow:hidden;display:flex;flex-direction:column;width:100%;aspect-ratio:3/4.2;cursor:pointer`;
  const dn=cleanName(card.name);
  const src=getPlayerPoseSrc(card);
  ce.innerHTML=`
    <div style="height:${large?7:4}px;background:${rs.bd};flex-shrink:0"></div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:${large?'6px 4px 0':'2px 2px 0'}">
      <img src="${src}" style="width:100%;height:100%;object-fit:contain;display:block">
    </div>
    <div style="padding:${large?'7px 10px 9px':'3px 5px 5px'};background:rgba(255,255,255,.96);border-top:1px solid rgba(0,0,0,.06);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:${large?6:3}px">
      <div style="flex:1;min-width:0;overflow:hidden">
        <div style="font-size:${large?11:7.5}px;font-weight:700;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">${card.nat} ${dn}</div>
        <div style="font-size:${large?8:5.5}px;font-weight:600;color:${rs.c};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${posStr(card)}${large&&card.year?' · '+card.year:''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;gap:${large?2:1}px">
        <span style="font-family:'Bebas Neue',cursive;font-size:${large?26:12}px;color:${rs.c};line-height:1">${card.ovr}</span>
        <span style="font-size:${large?7:5.5}px;font-weight:700;padding:1px ${large?5:3}px;border-radius:3px;background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd};white-space:nowrap">${isX?'RETRO':rs.lbl}</span>
      </div>
    </div>`;
  ce.onclick=()=>{closePullAnim();showDetail(card);};
  wrap.appendChild(ce);return wrap;
}
function showSinglePullAnim(card){
  const overlay=_pullOverlay;
  const stage=_pullSingle;
  _pullTen.style.display='none';stage.style.display='flex';stage.innerHTML='';
  const rs=RAR[card.rar]||RAR.r;
  const isH=card.rar==='h';const isX=card.rar==='x';const isL=card.rar==='l';
  overlay.style.background=isH||isX?'radial-gradient(circle at 50% 40%,rgba(248,208,80,.25),#000 70%)':isL?'radial-gradient(circle at 50% 40%,rgba(154,96,232,.2),#000 70%)':'radial-gradient(circle at 50% 40%,rgba(30,30,60,.8),#000 70%)';
  const inner=document.createElement('div');inner.style.cssText='animation:cardReveal .6s cubic-bezier(.25,.46,.45,.94) forwards';
  inner.appendChild(buildCardElement(card,true));stage.appendChild(inner);
  const tag=document.createElement('div');
  tag.style.cssText=`font-family:'Bebas Neue',cursive;font-size:${isH||isX?28:isL?22:16}px;color:${rs.c};letter-spacing:.1em;margin-top:16px;text-shadow:0 0 20px ${rs.c}`;
  tag.textContent=isH?'⭐ HERO ⭐':isX?'📸 傳奇 📸':isL?'✦ LEGEND ✦':rs.lbl;
  stage.appendChild(tag);
  const nm=document.createElement('div');nm.style.cssText='font-size:16px;font-weight:700;color:white;margin-top:6px';nm.textContent=cleanName(card.name)+(card.year?' ['+card.year+']':'');stage.appendChild(nm);
  const btn=document.createElement('button');btn.className='pull-close-btn';btn.style.marginTop='24px';btn.textContent='確認';btn.onclick=closePullAnim;stage.appendChild(btn);
  overlay.classList.add('show');
}
function showTenPullAnim(cards){
  const overlay=_pullOverlay;
  const stage=_pullTen;
  _pullSingle.style.display='none';stage.style.display='flex';stage.innerHTML='';
  const hasH=cards.some(c=>c.rar==='h'||c.rar==='x');const hasL=cards.some(c=>c.rar==='l');
  overlay.style.background=hasH?'radial-gradient(circle at 50% 30%,rgba(248,208,80,.2),#000 70%)':hasL?'radial-gradient(circle at 50% 30%,rgba(154,96,232,.15),#000 70%)':'#000';
  const heroC=cards.filter(c=>c.rar==='h'||c.rar==='x').length;
  const legC=cards.filter(c=>c.rar==='l').length;
  const title=document.createElement('div');title.className='pull-ten-title';
  title.textContent=heroC?`🎊 HERO × ${heroC}！`:legC?`✦ LEGEND × ${legC}`:'10連抽結果';
  title.style.color=heroC?'#f8d050':legC?'#cc88ff':'white';stage.appendChild(title);
  const grid=document.createElement('div');grid.className='pull-ten-grid';
  const frag=document.createDocumentFragment();
  cards.forEach((card,i)=>{const o=buildCardElement(card,false);o.style.animationDelay=`${i*0.07}s`;o.classList.add('pull-ten-card');frag.appendChild(o);});
  grid.appendChild(frag);stage.appendChild(grid);
  if(heroC||legC){const b=document.createElement('div');b.className='ten-result-banner';b.style.background=heroC?'rgba(248,208,80,.12)':'rgba(154,96,232,.12)';b.style.color=heroC?'#f8d050':'#cc88ff';b.style.border=`.5px solid ${heroC?'rgba(248,208,80,.3)':'rgba(154,96,232,.3)'}`;b.textContent=heroC?`⭐ 恭喜獲得 ${heroC} 張 HERO！`:`✦ 獲得 ${legC} 張 LEGEND！`;stage.appendChild(b);}
  const btn=document.createElement('button');btn.className='pull-close-btn';btn.textContent='確認收下';btn.onclick=closePullAnim;stage.appendChild(btn);
  overlay.classList.add('show');
}
function closePullAnim(){
  _pullOverlay.classList.remove('show');
  _pullSingle.innerHTML='';_pullSingle.style.display='flex';
  _pullTen.innerHTML='';_pullTen.style.display='none';
}
/* ═══ TEAM ═══ */
const BAT=['1','2','3','4','5','6','7','8','9'];
const ROT=['SP 1','SP 2','SP 3','SP 4','SP 5'];
const DEF_POS=['C','1B','2B','3B','SS','LF','CF','RF','DH'];
const MAX_RESERVE_SLOTS=16;
function getBenchSlotCount(){return Math.max(1,Math.min(16,benchSlots||7));}
function getBullpenSlotCount(){return Math.max(1,Math.min(16,bullpenSlots||9));}
function getBenchLabels(){return Array.from({length:getBenchSlotCount()},(_,i)=>`B${i+1}`);}
function getCloserIndex(){return getBullpenSlotCount()-1;}
function getBullpenLabels(){return Array.from({length:getBullpenSlotCount()},(_,i)=>i===getCloserIndex()?'CP':'RP');}
function getActiveBench(){return (bench||[]).slice(0,getBenchSlotCount());}
function getActiveBullpen(){return (bullpen||[]).slice(0,getBullpenSlotCount());}
function findFirstEmptySlot(arr,count,skipIdx=-1){
  for(let i=0;i<count;i++){
    if(i===skipIdx)continue;
    if(!arr[i])return i;
  }
  return -1;
}
function getAssignedSlotPos(type,idx){
  if(type==='lineup'||type==='defense')return DEF_POS[idx]||null;
  if(type==='bench')return null;
  if(type==='rotation')return 'SP';
  if(type==='bullpen')return idx===getCloserIndex()?'CP':'RP';
  return null;
}
function canCoverPosition(player,slotPos){
  if(!player||!slotPos)return false;
  if(slotPos==='DH')return !isPitcherPlayer(player);
  const positions=posArr(player);
  if(positions.includes(slotPos))return true;
  if(['LF','CF','RF'].includes(slotPos)&&positions.includes('OF'))return true;
  return false;
}
function getPositionPenalty(player,type,idx){
  if(!positionPenaltyEnabled||!player)return 0;
  const slotPos=getAssignedSlotPos(type,idx);
  if(!slotPos)return 0;
  if(type==='lineup'||type==='defense'){
    if(canCoverPosition(player,slotPos))return 0;
    const defenseSkill=Array.isArray(player.stats)&&Number.isFinite(player.stats[3])?player.stats[3]:60;
    if(slotPos==='C'||hasPos(player,'C'))return 10;
    if(slotPos==='SS'||slotPos==='CF'||hasPos(player,'SS')||hasPos(player,'CF'))return 8;
    if(['2B','3B','LF','RF'].includes(slotPos))return defenseSkill>=80?7:6;
    if(slotPos==='1B')return 5;
    return 6;
  }
  if(type==='rotation'){
    if(hasPos(player,'SP')||(!hasPos(player,'RP')&&!hasPos(player,'CP')&&player.pit))return 0;
    if(hasPos(player,'RP'))return 6;
    if(hasPos(player,'CP'))return 7;
    return player.pit?5:0;
  }
  if(type==='bullpen'){
    if(idx===4){
      if(hasPos(player,'CP'))return 0;
      if(hasPos(player,'RP'))return 3;
      if(hasPos(player,'SP'))return 7;
      return player.pit?5:0;
    }
    if(hasPos(player,'RP')||hasPos(player,'CP'))return 0;
    if(hasPos(player,'SP'))return 5;
    return player.pit?4:0;
  }
  return 0;
}
function getEffectiveOvr(player,type,idx){
  if(!player)return null;
  return Math.max(40,(player.ovr||0)-getPositionPenalty(player,type,idx));
}
function getOvr(arr){const f=arr.filter(Boolean);return f.length?Math.round(f.reduce((a,p)=>a+p.ovr,0)/f.length):'--';}
/* ═══ MATCH ═══ */
function getCoachBonus(){
  let batBonus=0,pitBonus=0;
  Object.values(equippedCoaches).forEach(cid=>{
    const c=COACH_MAP.get(cid);if(!c)return;
    if(c.type==='bat')batBonus+=Math.round(c.ovr*0.05);
    if(c.type==='pit')pitBonus+=Math.round(c.ovr*0.04);
    if(c.type==='psy'){batBonus+=Math.round(c.ovr*0.02);pitBonus+=Math.round(c.ovr*0.02);}
    if(c.type==='mgr'){batBonus+=Math.round(c.ovr*0.03);pitBonus+=Math.round(c.ovr*0.03);}
  });
  return{batBonus,pitBonus};
}
function hasCoachOwned(id){
  return Array.isArray(ownedCoaches)&&ownedCoaches.includes(id);
}
function getCoachRecruitPool(){
  const unowned=ALL_COACHES.filter(c=>!hasCoachOwned(c.id));
  return unowned.length?unowned:ALL_COACHES.slice();
}
function rollCoachRecruit(){
  const pool=getCoachRecruitPool();
  if(!pool.length)return null;
  const weighted=[];
  pool.forEach(c=>{
    const weight={c:50,r:28,l:16,h:6,x:3}[c.rarity]??20;
    for(let i=0;i<weight;i++)weighted.push(c);
  });
  return weighted[Math.floor(Math.random()*weighted.length)]||pool[0];
}
function recruitCoach(){
  const cost=300;
  const coach=rollCoachRecruit();
  if(!coach){showSaveToast('目前沒有可招募教練');return;}
  if(gems<cost){showSaveToast(`💎 不足！需要 ${cost}`);return;}
  gems-=cost;
  if(hasCoachOwned(coach.id)){
    coach.lv=Math.min(coach.maxLv,coach.lv+1);
    showSaveToast(`重複獲得 ${coach.name}，教練等級 +1`);
  }else{
    ownedCoaches.push(coach.id);
    showSaveToast(`成功招募 ${coach.name}`);
  }
  updateGemDisp();
  renderScoutScreen();
  renderCoach();
  autoSave();
}
let deferredInstallPrompt=null;
/* ═══ COACH ═══ */
function renderCoach(){
  const br=document.getElementById('coach-bonus-row');br.innerHTML='';
  const colorMap={bat:'#d4a017',pit:'#5a7aee',def:'#4adb6a',fit:'#e8804a',psy:'#cc88ff',mgr:'#e05a2a'};
  const equippedCount=COACH_TYPES.reduce((n,t)=>n+(equippedCoaches[t.id]?1:0),0);
  const meta=document.getElementById('coach-meta');if(meta)meta.textContent=`已裝備 ${equippedCount} / ${COACH_TYPES.length}`;
  const bonusFrag=document.createDocumentFragment();
  COACH_TYPES.forEach(t=>{
    const cid=equippedCoaches[t.id];const c=cid?COACH_MAP.get(cid):null;
    const chip=document.createElement('div');
    chip.className='coach-bonus-chip';chip.style.cssText=`background:${colorMap[t.id]}20;color:${colorMap[t.id]};border:.5px solid ${colorMap[t.id]}`;
    chip.textContent=c?`${t.icon} ${c.bonus}`:`${t.icon} 未裝備`;bonusFrag.appendChild(chip);
  });
  br.innerHTML='';br.appendChild(bonusFrag);
  const tabFrag=document.createDocumentFragment();
  COACH_TYPES.forEach(t=>{
    const tab=document.createElement('div');tab.className='coach-tab'+(coachTab===t.id?' active':'');
    tab.textContent=`${t.icon} ${t.label}`;tab.onclick=()=>{coachTab=t.id;renderCoach();};tabFrag.appendChild(tab);
  });
  const tabs=document.getElementById('coach-tabs');tabs.innerHTML='';tabs.appendChild(tabFrag);
  const coaches=ALL_COACHES.filter(c=>c.type===coachTab);
  const ct=COACH_TYPES.find(t=>t.id===coachTab);
  const typeCopy=document.getElementById('coach-type-copy');
  if(typeCopy)typeCopy.textContent=ct?`${ct.icon} ${ct.label}：${ct.desc}`:'裝備教練後自動套用到比賽';
  const cardFrag=document.createDocumentFragment();
  const list=document.getElementById('coach-list');
  coaches.forEach(c=>{
    const isOwned=hasCoachOwned(c.id);
    const isEquipped=equippedCoaches[c.type]===c.id;const rs=RAR[c.rarity]||RAR.r;
    const card=document.createElement('div');card.className='coach-card'+(isEquipped?' equipped':'')+(!isOwned?' locked':'');
    card.innerHTML=`
      <div class="coach-card-accent" style="background:${ct.color}"></div>
      <div class="coach-card-header">
        <div class="cc-av" style="background:${rs.bgC};border:1px solid ${rs.bd}">${c.av}</div>
        <div class="cc-inf">
          <div class="cc-topline">
            <div class="cc-name">${c.name}</div>
            <div class="cc-badge" style="background:${rs.bgC};border:1px solid ${rs.bd};color:${rs.c}">${isOwned?(rs.lbl||''):'未持有'}</div>
          </div>
          <div class="cc-role">${c.en||''} · ${ct.label} · ${c.obtain}獲得</div>
          <div class="cc-desc">${c.desc}</div>
        </div>
        <div class="cc-lv-wrap">
          <div class="cc-lv" style="color:${rs.c}">Lv.${c.lv}</div>
          <div class="cc-lv-lbl">/${c.maxLv}</div>
        </div>
      </div>
      <div class="coach-stats">
        <div class="cs-row"><span class="cs-lbl">${ct.label}能力</span><div class="cs-bar"><div class="cs-fill" style="background:${ct.color};width:${c.ovr}%"></div></div><span class="cs-val">${c.ovr}</span></div>
        <div class="cs-row"><span class="cs-lbl">加成效果</span><div style="flex:1;font-size:11px;font-weight:700;color:${ct.color}">${c.bonus}</div></div>
      </div>
      <div class="coach-btns">
        ${!isOwned
          ?`<button class="cb locked" disabled>尚未持有</button>`
          :isEquipped
            ?`<button class="cb unequip" data-id="${c.id}">卸下教練</button>`
            :`<button class="cb equip" data-id="${c.id}">裝備教練</button>`}
        <button class="cb upgrade" data-id="${c.id}" ${!isOwned||c.lv>=c.maxLv?'disabled':''}>升級 (🪙 500)</button>
      </div>`;
    const desc=card.querySelector('.cc-desc');
    if(desc&&isEquipped)desc.insertAdjacentHTML('beforeend',' <span style="color:#4adb6a;font-weight:700">· 目前裝備中</span>');
    card.querySelector('.cb.equip, .cb.unequip')?.addEventListener('click',()=>{
      if(isEquipped){delete equippedCoaches[c.type];}else{equippedCoaches[c.type]=c.id;if(!dailyState.coach){dailyState.coach=true;saveDailyState();}}
      renderCoach();autoSave();
    });
    card.querySelector('.cb.upgrade')?.addEventListener('click',()=>{
      if(c.lv>=c.maxLv)return;
      if(gems<500){showSaveToast('💎 不足！升級需要 500');return;}
      gems-=500;updateGemDisp();c.lv++;c.bonus=c.bonus.replace(/\d+/g,n=>parseInt(n)+2);renderCoach();autoSave();
    });
    cardFrag.appendChild(card);
  });
  list.innerHTML='';list.appendChild(cardFrag);
}

/* ═══ 設定 ═══ */
function updateSettingsStats(){
  const el=document.getElementById('stat-collection');if(el)el.textContent=collection.length+' 位';
  const benchVal=document.getElementById('bench-slots-val');
  const benchValTeam=document.getElementById('bench-slots-val-team');
  const bullVal=document.getElementById('bullpen-slots-val');
  const bullValTeam=document.getElementById('bullpen-slots-val-team');
  if(benchVal)benchVal.textContent=getBenchSlotCount();
  if(benchValTeam)benchValTeam.textContent=getBenchSlotCount();
  if(bullVal)bullVal.textContent=getBullpenSlotCount();
  if(bullValTeam)bullValTeam.textContent=getBullpenSlotCount();
  const btn=document.getElementById('position-penalty-btn');
  const sub=document.getElementById('position-penalty-sub');
  if(btn){
    btn.textContent=positionPenaltyEnabled?'已開啟':'關閉';
    btn.style.background=positionPenaltyEnabled?'rgba(212,160,23,.12)':'var(--color-background-secondary)';
    btn.style.borderColor=positionPenaltyEnabled?'#d4a017':'var(--color-border-tertiary)';
    btn.style.color=positionPenaltyEnabled?'#7b5a0e':'var(--color-text-primary)';
  }
  if(sub){
    sub.textContent=positionPenaltyEnabled
      ?'開啟中：站錯守位或投手角色時，組隊顯示與比賽會套用降幅。'
      :'關閉中：目前仍依卡片原始 OVR 計算。';
  }
  updateInstallPromptUI();
}
function compactBenchToSlots(nextBench){
  const active=getActiveBench().filter(Boolean);
  const compact=active.slice(0,nextBench);
  for(let i=0;i<bench.length;i++)bench[i]=compact[i]||null;
}
function compactBullpenToSlots(nextBull){
  const active=getActiveBullpen().filter(Boolean);
  const oldCloserPlayer=getActiveBullpen()[getCloserIndex()]||null;
  const preferredCloser=oldCloserPlayer&&active.some(p=>getPlayerKey(p)===getPlayerKey(oldCloserPlayer))
    ?active.find(p=>getPlayerKey(p)===getPlayerKey(oldCloserPlayer))
    :(active.find(p=>hasPos(p,'CP'))||active[active.length-1]||null);
  const others=preferredCloser?active.filter(p=>getPlayerKey(p)!==getPlayerKey(preferredCloser)):active.slice();
  for(let i=0;i<bullpen.length;i++)bullpen[i]=null;
  others.slice(0,Math.max(0,nextBull-1)).forEach((player,idx)=>{bullpen[idx]=player;});
  if(nextBull>0&&preferredCloser)bullpen[nextBull-1]=preferredCloser;
}
function adjustReserveConfig(delta){
  const oldBench=getBenchSlotCount();
  const oldBull=getBullpenSlotCount();
  const nextBench=Math.max(1,Math.min(15,oldBench+delta));
  const nextBull=16-nextBench;
  if(nextBench===oldBench)return;
  const benchFilled=getActiveBench().filter(Boolean).length;
  const bullFilled=getActiveBullpen().filter(Boolean).length;

  if(nextBench<oldBench && benchFilled>nextBench){
    showSaveToast(`請先移除 ${benchFilled-nextBench} 位候補球員`);
    return;
  }

  if(nextBull<oldBull && bullFilled>nextBull){
    showSaveToast(`請先移除 ${bullFilled-nextBull} 位牛棚球員`);
    return;
  }

  benchSlots=nextBench;
  bullpenSlots=nextBull;
  compactBenchToSlots(nextBench);
  compactBullpenToSlots(nextBull);
  autoFillBenchIfPossible();
  autoFillBullpenIfPossible();
  updateSettingsStats();
  renderHome();
  renderTeam();
  autoSave();
}
function adjustBullpenConfig(delta){
  adjustReserveConfig(-delta);
}
function togglePositionPenalty(){
  positionPenaltyEnabled=!positionPenaltyEnabled;
  updateSettingsStats();
  renderTeam();
  autoSave();
}
function isStandalonePWA(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
}
function updateInstallPromptUI(){
  const btn=document.getElementById('install-app-btn');
  const sub=document.getElementById('install-app-sub');
  const note=document.getElementById('install-app-note');
  if(!btn||!sub||!note)return;
  btn.classList.remove('ready');
  if(isStandalonePWA()){
    btn.disabled=true;
    btn.textContent='已安裝';
    sub.textContent='目前已經是安裝版 App。';
    note.textContent='你現在開的是主畫面安裝版本。';
    return;
  }
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(deferredInstallPrompt){
    btn.disabled=false;
    btn.classList.add('ready');
    btn.textContent='安裝 App';
    sub.textContent='可像 app 一樣從手機桌面直接開啟。';
    note.textContent='按下安裝後即可加入主畫面。';
    return;
  }
  if(isIOS){
    btn.disabled=true;
    btn.textContent='Safari 安裝';
    sub.textContent='iPhone / iPad 請用 Safari 開啟。';
    note.textContent='打開分享選單後選「加入主畫面」，即可安裝成 App。';
    return;
  }
  btn.disabled=true;
  btn.textContent='無法安裝';
  sub.textContent='目前裝置或瀏覽器沒有提供安裝提示。';
  note.textContent='請使用支援 PWA 安裝的瀏覽器重新開啟。';
}
async function promptInstallApp(){
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(()=>null);
  deferredInstallPrompt=null;
  updateInstallPromptUI();
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  updateInstallPromptUI();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  updateInstallPromptUI();
});
window.addEventListener('load',()=>setTimeout(updateInstallPromptUI,300));
function showChangeNation(){document.getElementById('confirm-overlay').classList.add('show');}
function closeConfirm(){document.getElementById('confirm-overlay').classList.remove('show');}
function resetScoutsState(){
  scoutCandidates=[];
  naturalizedPlayers=[];
  myScouts=SCOUT_DEFS.map(s=>({...s,dispatched:false,doneIn:0,doneAt:0,searchMode:null,region:null,candidate:null}));
  dispatchingScoutId=null;
  selRegionId=null;
}
function doChangeNation(){
  closeConfirm();
  deleteSlot(AUTO_SLOT);
  localStorage.removeItem('diamond_nations_save_v1');
  // 清除陣容與收藏
  collection=[];lineup=Array(9).fill(null);battingOrder=[0,1,2,3,4,5,6,7,8];bench=Array(MAX_RESERVE_SLOTS).fill(null);benchSlots=7;rotation=Array(5).fill(null);bullpen=Array(MAX_RESERVE_SLOTS).fill(null);bullpenSlots=9;
  // 清除國家與選擇狀態
  myNation=null;myLegend=null;selNation=null;selLegend=null;lineupSel=[];
  // 清除比賽與進度
  matchCount=0;clearedDynasties=[];journeyProgress={};
  // 重置寶石
  gems=3000;
  // 清除抽卡保底
  pity=0;Object.keys(packPity).forEach(k=>packPity[k]=0);pullHistory=[];
  // 清除球探狀態
  resetScoutsState();
  // 同步回 GameState（保留 gems 與 equippedCoaches）
  syncToState();
  document.getElementById('home-flag').textContent='⚾';
  document.getElementById('ns-confirm-btn').disabled=true;
  buildNationScreen();
  document.getElementById('nation-screen').classList.remove('hide');
  hideAllScreens();
}

/* ═══ DETAIL ═══ */
/* ── 進階數據計算 ── */
function calcAdvanced(p){
  const s=p.stats||[80,80,80,80,80];
  const ovr=p.ovr||80;
  if(p.pit){
    // 投手：[投球力, 控球力, 變化球, 體力, 心理]
    const stuff=s[0],ctrl=s[1],break_=s[2];
    const era=Math.max(0.80,Math.min(6.50,(100-ovr)*0.09+1.20-((ctrl-70)*0.03))).toFixed(2);
    const whip=Math.max(0.70,Math.min(1.80,(100-ctrl)*0.012+0.72)).toFixed(2);
    const k9=Math.max(4.0,Math.min(16.0,stuff*0.12+break_*0.04-10)).toFixed(1);
    const bb9=Math.max(0.5,Math.min(6.0,(100-ctrl)*0.055+0.5)).toFixed(1);
    const fip=Math.max(1.0,Math.min(6.0,parseFloat(era)+((stuff-ctrl)*0.004))).toFixed(2);
    const war=Math.max(0.0,Math.min(12.0,(ovr-65)*0.22)).toFixed(1);
    const babip=Math.max(.220,Math.min(.340,.290-(stuff-70)*.001+(break_-70)*.0005)).toFixed(3).replace(/^0\./,'.');
    const rankColor=ovr>=95?'#f8d050':ovr>=85?'#cc88ff':ovr>=75?'#7aaaff':'#6adb6a';
    const rankLabel=ovr>=95?'頂尖':ovr>=85?'明星':ovr>=75?'主力':'基礎';
    return {type:'pit',era,whip,k9,bb9,fip,war,babip,rankColor,rankLabel,ovr};
  } else {
    // 野手：[打擊力, 選球眼, 速度, 守備力, 心理]
    const bat=s[0],eye=s[1],spd=s[2],def=s[3];
    const avg=Math.max(.180,Math.min(.380,(bat-50)*.0022+.240)).toFixed(3).replace(/^0\./,'.');
    const obp=Math.max(.250,Math.min(.480,(parseFloat(avg.replace('.','0.'))||.270)+(eye-50)*.0025+.050)).toFixed(3).replace(/^0\./,'.');
    const iso=Math.max(.050,Math.min(.350,(bat-50)*.0038+.090)).toFixed(3).replace(/^0\./,'.');
    const slg=(parseFloat(avg.replace('.','0.'))+parseFloat(iso.replace('.','0.'))).toFixed(3).replace(/^0\./,'.');
    const ops=(parseFloat(obp.replace('.','0.'))+parseFloat(slg.replace('.','0.'))).toFixed(3).replace(/^0\./,'.');
    const woba=Math.max(.260,Math.min(.500,(parseFloat(obp.replace('.','0.'))+parseFloat(slg.replace('.','0.')))*0.47+.060)).toFixed(3).replace(/^0\./,'.');
    const wrcPlus=Math.max(40,Math.min(220,Math.round((ovr-70)*2.2+100)));
    const war=Math.max(0.0,Math.min(12.0,(ovr-62)*0.20)).toFixed(1);
    const babip=Math.max(.240,Math.min(.400,.300+(bat-70)*.001+(spd-70)*.0008)).toFixed(3).replace(/^0\./,'.');
    const defRate=Math.max(.940,Math.min(1.000,.960+(def-60)*.0005)).toFixed(3);
    const drs=Math.round((def-75)*0.4);
    const rf=Math.max(1.0,Math.min(5.5,(def*0.025+spd*0.015))).toFixed(1);
    const rankColor=ovr>=95?'#f8d050':ovr>=85?'#cc88ff':ovr>=75?'#7aaaff':'#6adb6a';
    const rankLabel=ovr>=95?'頂尖':ovr>=85?'明星':ovr>=75?'主力':'基礎';
    return {type:'bat',avg,obp,slg,ops,iso,woba,wrcPlus,war,babip,defRate,drs,rf,rankColor,rankLabel,ovr};
  }
}

const BAT_EXCEL_LABELS=[
  ['g','G'],['ab','AB'],['r','R'],['h','H'],['d2','2B'],['d3','3B'],['hr','HR'],['rbi','RBI'],
  ['bb','BB'],['so','SO'],['sb','SB'],['cs','CS'],['pa','PA'],['hbp','HBP'],['sac','SAC'],['sf','SF'],
  ['gidp','GIDP'],['xbh','XBH'],['tb','TB'],['ibb','IBB'],
  ['avg','AVG'],['obp','OBP'],['slg','SLG'],['ops','OPS'],['babip','BABIP'],['iso','ISO'],
  ['abhr','AB/HR'],['bbk','BB/K'],['bbpct','BB%'],['kpct','K%'],['goao','GO/AO'],
];

const PIT_EXCEL_LABELS=[
  ['w','W'],['l','L'],['era','ERA'],['g','G'],['gs','GS'],['cg','CG'],['sho','SHO'],
  ['sv','SV'],['svo','SVO'],['ip','IP'],['h','H'],['r','R'],['er','ER'],['hr','HR'],
  ['hb','HB'],['bb','BB'],['so','SO'],['whip','WHIP'],['avg','AVG'],['tbf','TBF'],
  ['np','NP'],['pip','P/IP'],['qs','QS'],['gf','GF'],['hld','HLD'],['ibb','IBB'],
  ['wp','WP'],['bk','BK'],['gdp','GDP'],['babip','BABIP'],['so9','SO/9'],['bb9','BB/9'],
  ['kbb','K/BB'],['goao','GO/AO'],['sb','SB'],['cs','CS'],['pk','PK'],
];

const EXCEL_METRIC_HINTS={
  avg:'打擊率',
  obp:'上壘率',
  slg:'長打率',
  ops:'上壘加長打',
  babip:'球進場安打率',
  iso:'純長打率',
  abhr:'平均幾打數一轟',
  bbk:'保送與三振比',
  bbpct:'保送比例',
  kpct:'三振比例',
  goao:'滾地與飛球比',
  g:'出賽場次',
  ab:'打數',
  r:'得分',
  h:'安打',
  d2:'二壘安打',
  d3:'三壘安打',
  hr:'全壘打',
  rbi:'打點',
  bb:'保送',
  so:'三振',
  sb:'盜壘',
  cs:'盜壘失敗',
  pa:'打席',
  hbp:'觸身球',
  sac:'犧牲觸擊',
  sf:'高飛犧牲打',
  gidp:'雙殺打',
  xbh:'長打數',
  tb:'壘打數',
  ibb:'故意四壞',
  w:'勝投',
  l:'敗投',
  era:'防禦率',
  gs:'先發場次',
  cg:'完投',
  sho:'完封',
  sv:'救援成功',
  svo:'救援機會',
  ip:'投球局數',
  er:'責失分',
  hb:'觸身球保送',
  whip:'每局被上壘率',
  tbf:'面對打者數',
  np:'總用球數',
  pip:'每局用球',
  qs:'優質先發',
  gf:'結束比賽場次',
  hld:'中繼成功',
  wp:'暴投',
  bk:'投手犯規',
  gdp:'製造雙殺',
  so9:'每九局三振',
  bb9:'每九局保送',
  kbb:'三振保送比',
  pk:'牽制出局',
};

function renderExcelMetricCards(src, entries){
  return entries
    .filter(([key])=>src[key]!==undefined&&src[key]!==null&&src[key]!=='')
    .map(([key,label])=>`<div class="adv-card ${['avg','obp','slg','ops','era','whip','so9','bb9'].includes(key)?'highlight':''}">
      <div class="adv-lbl">${label}</div>
      <div class="adv-val" style="font-size:22px">${src[key]}</div>
      <div class="adv-sub">${EXCEL_METRIC_HINTS[key]||'原始紀錄數據'}</div>
    </div>`)
    .join('');
}

function switchExcelAdvTab(btn,key){
  const wrap=btn.closest('.adv-excel-wrap');
  if(!wrap)return;
  wrap.querySelectorAll('.adv-tab-btn').forEach(el=>el.classList.toggle('active',el===btn));
  wrap.querySelectorAll('.adv-tab-panel').forEach(el=>el.classList.toggle('show',el.dataset.tab===key));
}

function buildExcelAdvHTML(p){
  const src=p.excel;
  if(!src||!Object.keys(src).length)return '';
  const groups=p.pit
    ?[
      {key:'core',label:'核心',entries:[['era','ERA'],['whip','WHIP'],['so9','SO/9'],['bb9','BB/9'],['kbb','K/BB'],['babip','BABIP']]},
      {key:'game',label:'內容',entries:[['w','W'],['l','L'],['g','G'],['gs','GS'],['ip','IP'],['h','H'],['r','R'],['er','ER'],['hr','HR'],['bb','BB'],['so','SO'],['hb','HB'],['avg','AVG'],['tbf','TBF'],['np','NP'],['pip','P/IP']]},
      {key:'extra',label:'其他',entries:[['cg','CG'],['sho','SHO'],['sv','SV'],['svo','SVO'],['qs','QS'],['gf','GF'],['hld','HLD'],['ibb','IBB'],['wp','WP'],['bk','BK'],['gdp','GDP'],['goao','GO/AO'],['sb','SB'],['cs','CS'],['pk','PK']]}
    ]
    :[
      {key:'core',label:'核心',entries:[['avg','AVG'],['obp','OBP'],['slg','SLG'],['ops','OPS'],['babip','BABIP'],['iso','ISO']]},
      {key:'bat',label:'打席',entries:[['g','G'],['pa','PA'],['ab','AB'],['h','H'],['r','R'],['rbi','RBI'],['hr','HR'],['bb','BB'],['so','SO'],['sb','SB'],['cs','CS']]},
      {key:'extra',label:'其他',entries:[['d2','2B'],['d3','3B'],['hbp','HBP'],['sac','SAC'],['sf','SF'],['gidp','GIDP'],['xbh','XBH'],['tb','TB'],['ibb','IBB'],['abhr','AB/HR'],['bbk','BB/K'],['bbpct','BB%'],['kpct','K%'],['goao','GO/AO']]}
    ];
  const tabs=groups.filter(g=>renderExcelMetricCards(src,g.entries));
  if(!tabs.length)return '';
  return `<div class="adv-excel-wrap">
    <div class="adv-tab-row">
      ${tabs.map((g,i)=>`<button class="adv-tab-btn ${i===0?'active':''}" type="button" onclick="switchExcelAdvTab(this,'${g.key}')">${g.label}</button>`).join('')}
    </div>
    ${tabs.map((g,i)=>`<div class="adv-tab-panel ${i===0?'show':''}" data-tab="${g.key}"><div class="adv-grid">${renderExcelMetricCards(src,g.entries)}</div></div>`).join('')}
  </div>`;
}

function buildAdvHTML(p){
  return buildExcelAdvHTML(p) || `<div class="adv-excel-wrap"><div class="adv-empty">這張卡目前沒有可顯示的 Excel 原始進階數據。</div></div>`;
}

function getPlayerArchetypeLabel(player){
  if(player.pit){
    if(hasPos(player,'SP'))return '先發王牌';
    if(hasPos(player,'CP'))return '終結守護神';
    if(hasPos(player,'RP'))return '牛棚壓制者';
    return '投手';
  }
  if(hasPos(player,'C'))return '防守核心';
  if(hasPos(player,'DH'))return '中心打者';
  if(['LF','CF','RF','OF'].some(pos=>hasPos(player,pos)))return '外野火力';
  if(['SS','2B','3B'].some(pos=>hasPos(player,pos)))return '內野主力';
  return '打線核心';
}

function getPlayerPeakLabel(player){
  if(player.ovr>=95)return '世代等級';
  if(player.ovr>=90)return '頂級主力';
  if(player.ovr>=85)return '明星戰力';
  if(player.ovr>=78)return '穩定先發';
  return '輪替深度';
}

function buildDetailSummaryHTML(player){
  const years=Array.isArray(player.era)&&player.era.length
    ?(Math.min(...player.era)===Math.max(...player.era)
      ?String(player.era[0])
      :`${Math.min(...player.era)}-${Math.max(...player.era)}`)
    :player.year?String(player.year):'未知';
  const excel=player.excel||{};
  const quickMetric=player.pit
    ?[
        {label:'壓制指標',value:excel.so9?`SO/9 ${excel.so9}`:(excel.so?`SO ${excel.so}`:'--')},
        {label:'穩定度',value:excel.whip?`WHIP ${excel.whip}`:(excel.era?`ERA ${excel.era}`:'--')}
      ]
    :[
        {label:'打擊輸出',value:excel.ops?`OPS ${excel.ops}`:(excel.slg?`SLG ${excel.slg}`:'--')},
        {label:'上壘能力',value:excel.obp?`OBP ${excel.obp}`:(excel.avg?`AVG ${excel.avg}`:'--')}
      ];
  const quickMetricSub=player.excel&&Object.keys(player.excel).length?'':'尚無 Excel 數據';
  return `
    <div class="ds-summary">
      <div class="ds-summary-card accent">
        <div class="ds-summary-lbl">球員定位</div>
        <div class="ds-summary-val">${getPlayerArchetypeLabel(player)}</div>
      </div>
      <div class="ds-summary-card">
        <div class="ds-summary-lbl">出賽年代</div>
        <div class="ds-summary-val">${years}</div>
      </div>
      ${quickMetric.map(metric=>`
        <div class="ds-summary-card">
          <div class="ds-summary-lbl">${metric.label}</div>
        <div class="ds-summary-val">${metric.value}</div>
        <div class="ds-summary-sub">${quickMetricSub}</div>
        </div>`).join('')}
    </div>`;
}

function getPoseSVG(p,size=44){
  const ps=posArr(p);
  const isP=isPitcherPlayer(p);
  const isC=ps.includes('C');
  const isOF=ps.includes('OF')||ps.includes('LF')||ps.includes('CF')||ps.includes('RF');
  const isIF=ps.includes('1B')||ps.includes('2B')||ps.includes('3B')||ps.includes('SS');
  let src;
  if(isC)src='pose_catcher.png';
  else if(isP)src='pose_pitcher.png';
  else if(isOF)src='pose_outfielder.png';
  else if(isIF)src='pose_infielder.png';
  else src='pose_batter.png';
  return `<img src="${src}" style="width:${size}px;height:${Math.round(size*1.4)}px;object-fit:contain;display:block;margin:0 auto;">`;
}
function _getPoseSVG_unused(p,size=44){
  const ps=posArr(p);
  const isP=isPitcherPlayer(p);
  const isC=ps.includes('C');
  const isOF=ps.includes('OF')||ps.includes('LF')||ps.includes('CF')||ps.includes('RF');
  const isIF=ps.includes('1B')||ps.includes('2B')||ps.includes('3B')||ps.includes('SS');
  const s=size;
  const f=v=>Math.round(v*10)/10;
  // Colors – Taiwan blue cartoon theme
  const SK='#f5c09a';const UN='#2050c8';const CA='#153a96';
  const GL='#c87820';const DK='#1a1a2e';const WH='#f0f4ff';
  const RD='#cc2222';const BT='#7a3a10';
  const cx=s*0.5;
  const hR=s*0.175;          // head radius
  const hCY=s*0.245;         // head centre Y
  const bY1=hCY+hR*0.88;    // body top Y
  const bY2=s*0.73;          // body bottom Y
  const bW=s*0.165;          // body half-width
  const lB=s*0.96;           // leg bottom Y
  // ── Head & cap (shared) ──
  const HEAD=`<circle cx="${f(cx)}" cy="${f(hCY)}" r="${f(hR)}" fill="${SK}"/>
<path d="M${f(cx-hR*0.92)} ${f(hCY-hR*0.05)}A${f(hR*0.95)} ${f(hR*0.95)} 0 0 1 ${f(cx+hR*0.92)} ${f(hCY-hR*0.05)}Z" fill="${CA}"/>
<ellipse cx="${f(cx+hR*0.72)}" cy="${f(hCY)}" rx="${f(hR*0.38)}" ry="${f(hR*0.15)}" fill="${CA}"/>
<circle cx="${f(cx-hR*0.3)}" cy="${f(hCY+hR*0.12)}" r="${f(hR*0.11)}" fill="${DK}"/>
<circle cx="${f(cx+hR*0.3)}" cy="${f(hCY+hR*0.12)}" r="${f(hR*0.11)}" fill="${DK}"/>`;
  let BODY='';
  if(isC){
    // 捕手 ── 蹲低 + 護面罩
    const sq1=bY1+s*0.02;const sq2=sq1+s*0.2;
    BODY=`<rect x="${f(cx-hR*0.88)}" y="${f(hCY-hR*0.6)}" width="${f(hR*1.76)}" height="${f(hR*1.22)}" rx="${f(hR*0.28)}" fill="none" stroke="${RD}" stroke-width="${f(hR*0.2)}"/>
<ellipse cx="${f(cx)}" cy="${f((sq1+sq2)/2)}" rx="${f(bW*1.08)}" ry="${f((sq2-sq1)/2)}" fill="${UN}"/>
<line x1="${f(cx-bW*0.65)}" y1="${f(sq1+s*0.02)}" x2="${f(s*0.11)}" y2="${f(sq1+s*0.06)}" stroke="${SK}" stroke-width="${f(s*0.08)}" stroke-linecap="round"/>
<circle cx="${f(s*0.1)}" cy="${f(sq1+s*0.07)}" r="${f(s*0.082)}" fill="${GL}"/>
<line x1="${f(cx+bW*0.65)}" y1="${f(sq1+s*0.02)}" x2="${f(s*0.86)}" y2="${f(sq1+s*0.04)}" stroke="${SK}" stroke-width="${f(s*0.078)}" stroke-linecap="round"/>
<line x1="${f(cx-bW*0.5)}" y1="${f(sq2)}" x2="${f(cx-bW*1.1)}" y2="${f(sq2+s*0.18)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.5)}" y1="${f(sq2)}" x2="${f(cx+bW*1.1)}" y2="${f(sq2+s*0.18)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>`;
  } else if(isP){
    // 投手 ── 大步跨出投球：右臂後舉持球，左臂前推手套，前腳跨大步
    const midY=(bY1+bY2)/2;
    BODY=`<ellipse cx="${f(cx-s*0.04)}" cy="${f(midY-s*0.02)}" rx="${f(bW*1.05)}" ry="${f((bY2-bY1)*0.48)}" fill="${UN}"/>
<line x1="${f(cx+bW*0.4)}" y1="${f(bY1+s*0.06)}" x2="${f(s*0.86)}" y2="${f(hCY+s*0.06)}" stroke="${SK}" stroke-width="${f(s*0.092)}" stroke-linecap="round"/>
<circle cx="${f(s*0.88)}" cy="${f(hCY+s*0.03)}" r="${f(s*0.075)}" fill="${WH}"/>
<line x1="${f(cx-bW*0.4)}" y1="${f(bY1+s*0.08)}" x2="${f(s*0.1)}" y2="${f(bY1+s*0.04)}" stroke="${SK}" stroke-width="${f(s*0.088)}" stroke-linecap="round"/>
<circle cx="${f(s*0.09)}" cy="${f(bY1+s*0.04)}" r="${f(s*0.096)}" fill="${GL}"/>
<line x1="${f(cx-bW*0.5)}" y1="${f(bY2)}" x2="${f(s*0.1)}" y2="${f(lB)}" stroke="${UN}" stroke-width="${f(s*0.14)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.4)}" y1="${f(bY2)}" x2="${f(s*0.88)}" y2="${f(lB-s*0.04)}" stroke="${UN}" stroke-width="${f(s*0.14)}" stroke-linecap="round"/>`;
  } else if(isOF){
    // 外野手 ── 右臂高舉接球
    BODY=`<ellipse cx="${f(cx)}" cy="${f((bY1+bY2)/2)}" rx="${f(bW)}" ry="${f((bY2-bY1)/2)}" fill="${UN}"/>
<line x1="${f(cx+bW*0.5)}" y1="${f(bY1+s*0.04)}" x2="${f(s*0.87)}" y2="${f(hCY+s*0.04)}" stroke="${SK}" stroke-width="${f(s*0.088)}" stroke-linecap="round"/>
<circle cx="${f(s*0.87)}" cy="${f(hCY-s*0.01)}" r="${f(s*0.1)}" fill="${GL}"/>
<line x1="${f(cx-bW*0.5)}" y1="${f(bY1+s*0.1)}" x2="${f(s*0.1)}" y2="${f(bY1+s*0.2)}" stroke="${SK}" stroke-width="${f(s*0.08)}" stroke-linecap="round"/>
<line x1="${f(cx-bW*0.4)}" y1="${f(bY2)}" x2="${f(cx-bW*0.8)}" y2="${f(lB)}" stroke="${UN}" stroke-width="${f(s*0.12)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.4)}" y1="${f(bY2)}" x2="${f(cx+bW*0.8)}" y2="${f(lB)}" stroke="${UN}" stroke-width="${f(s*0.12)}" stroke-linecap="round"/>`;
  } else if(isIF){
    // 內野手 ── 低身接球姿勢，左手持手套向下
    BODY=`<ellipse cx="${f(cx-s*0.03)}" cy="${f((bY1+bY2)/2+s*0.02)}" rx="${f(bW)}" ry="${f((bY2-bY1)/2)}" fill="${UN}"/>
<line x1="${f(cx-bW*0.5)}" y1="${f(bY1+s*0.1)}" x2="${f(s*0.11)}" y2="${f(bY2-s*0.04)}" stroke="${SK}" stroke-width="${f(s*0.084)}" stroke-linecap="round"/>
<circle cx="${f(s*0.1)}" cy="${f(bY2-s*0.02)}" r="${f(s*0.096)}" fill="${GL}"/>
<line x1="${f(cx+bW*0.45)}" y1="${f(bY1+s*0.06)}" x2="${f(s*0.87)}" y2="${f(bY1+s*0.12)}" stroke="${SK}" stroke-width="${f(s*0.08)}" stroke-linecap="round"/>
<line x1="${f(cx-bW*0.4)}" y1="${f(bY2)}" x2="${f(cx-bW*1.05)}" y2="${f(lB-s*0.02)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.35)}" y1="${f(bY2)}" x2="${f(cx+bW*0.95)}" y2="${f(lB-s*0.02)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>`;
  } else {
    // 打者/DH ── 揮棒預備姿勢
    BODY=`<ellipse cx="${f(cx-s*0.03)}" cy="${f((bY1+bY2)/2)}" rx="${f(bW)}" ry="${f((bY2-bY1)/2)}" fill="${UN}"/>
<line x1="${f(s*0.84)}" y1="${f(bY1-s*0.07)}" x2="${f(cx-s*0.04)}" y2="${f(bY1+s*0.22)}" stroke="${BT}" stroke-width="${f(s*0.082)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.5)}" y1="${f(bY1+s*0.04)}" x2="${f(s*0.83)}" y2="${f(bY1-s*0.04)}" stroke="${SK}" stroke-width="${f(s*0.088)}" stroke-linecap="round"/>
<line x1="${f(cx-bW*0.45)}" y1="${f(bY1+s*0.1)}" x2="${f(s*0.11)}" y2="${f(bY1+s*0.18)}" stroke="${SK}" stroke-width="${f(s*0.08)}" stroke-linecap="round"/>
<circle cx="${f(s*0.1)}" cy="${f(bY1+s*0.19)}" r="${f(s*0.086)}" fill="${GL}"/>
<line x1="${f(cx-bW*0.45)}" y1="${f(bY2)}" x2="${f(cx-bW*1.1)}" y2="${f(lB)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>
<line x1="${f(cx+bW*0.3)}" y1="${f(bY2)}" x2="${f(cx+bW*0.65)}" y2="${f(lB)}" stroke="${UN}" stroke-width="${f(s*0.13)}" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${HEAD}${BODY}</svg>`;
}

function showDetail(p,context=null){
  detailContext=context;
  const rs=RAR[p.rar]||RAR.h;const defs=p.pit?P_STATS:B_STATS;
  // 更新 detail-sheet 等級邊框
  const sheet=document.querySelector('.detail-sheet');
  // 根據等級設定 sheet 背景色與邊框
  const rarTheme={
    h:{bg1:'#fffdf6',bg2:'#fff8df',bg3:'#f7efd0',border:'#d4a017',glow:'0 0 28px rgba(212,160,23,.18)',text:'#201606',text2:'#9b7412',text3:'#7d6730'},
    l:{bg1:'#fcf9ff',bg2:'#f4ecff',bg3:'#ece1ff',border:'#8a50d8',glow:'0 0 24px rgba(138,80,216,.16)',text:'#1c1028',text2:'#7d4cc3',text3:'#76618f'},
    r:{bg1:'#f9fbff',bg2:'#eef4ff',bg3:'#dfe9ff',border:'#4a6acc',glow:'0 0 18px rgba(74,106,204,.14)',text:'#10203f',text2:'#476cc9',text3:'#66789e'},
    x:{bg1:'#fdf7ef',bg2:'#f5ead9',bg3:'#ead8bf',border:'#8b4513',glow:'0 0 16px rgba(139,69,19,.14)',text:'#3a1a00',text2:'#9a5f2b',text3:'#8a6c4f'},
    c:{bg1:'#fbfffb',bg2:'#f0faef',bg3:'#dff0df',border:'#3a6a3a',glow:'0 0 14px rgba(58,106,58,.12)',text:'#122412',text2:'#3f8248',text3:'#667f66'},
  };
  const th=rarTheme[p.rar]||rarTheme.c;
  const rarLabelMap={h:'HERO',l:'LEGEND',r:'RARE',c:'COMMON',x:'RETRO'};
  const rarAccentMap={
    h:'傳說金卡',
    l:'傳奇紫卡',
    r:'稀有藍卡',
    c:'基礎綠卡',
    x:'復古特別款',
  };
  if(sheet){
    sheet.className=`detail-sheet rar-${p.rar}`;
    sheet.style.cssText=`background:${th.bg1};--ds-bg:${th.bg1};--ds-bg2:${th.bg2};--ds-bg3:${th.bg3};--ds-text:${th.text};--ds-text2:${th.text2};--ds-text3:${th.text3};--ds-border:rgba(20,20,20,.08);--ds-border2:${th.border};border-color:${th.border};box-shadow:${th.glow}`;
  }
  const ov=document.getElementById('detail-overlay');
  if(ov){ov.style.background=`radial-gradient(circle at 50% 25%,${th.bg2}cc,rgba(0,0,0,.7) 65%)`;}

  const isRetro=p.rar==='x';const isH=p.rar==='h';const isL=p.rar==='l';const isR2=p.rar==='r';
  const story=(p.story||'尚無球員故事。').replace(/<hl>/g,'<span class="ds-hl">').replace(/<\/hl>/g,'</span>');
  const rows=defs.map((s,i)=>`<div class="ds-stat-row"><span class="ds-sn">${s.zh}</span><div class="ds-track"><div class="ds-fill" style="background:${s.fill};width:0%;--w:${getAbilityValue(p,i)}%"></div></div><span class="ds-sv">${getAbilityValue(p,i)}</span></div>`).join('');
  const skills=(p.skills&&p.skills.length)
    ?p.skills.map(s=>`<div class="ds-sk"><div class="ds-sk-i">${s.i}</div><div class="ds-sk-n">${s.n}</div><div class="ds-sk-d">${s.d}</div></div>`).join('')
    :`<div class="ds-sk empty"><div class="ds-sk-n">尚無技能資料</div><div class="ds-sk-d">這張卡目前沒有額外技能描述。</div></div>`;
  const inTeam=isInTeam(p);
  const isReplaceContext=['defense','lineup','bench','rotation','bullpen'].includes(detailContext?.type);
  const replaceLabel=detailContext?.type==='rotation'
    ?'更換先發'
    :detailContext?.type==='bullpen'
      ?'更換牛棚'
      :'更換球員';
  const detailActionBtn=isReplaceContext&&inTeam
    ?`<button class="ds-btn add" onclick="window._changeTeamFromDetail()">${replaceLabel}</button>`
    :inTeam
      ?`<button class="ds-btn remove" onclick="window._removeFromTeam('${p.name}',${p.year??'null'})">從陣容移除</button>`
      :`<button class="ds-btn add" onclick="window._addFromDetail('${p.name}',${p.year??'null'})">加入陣容 ＋</button>`;
  const displayName=cardLabel(p);
  let avGlow;
  if(isH){avGlow='0 0 16px rgba(212,160,23,.5)';}
  else if(isL){avGlow='0 0 14px rgba(138,80,216,.4)';}
  else if(isR2){avGlow='0 0 8px rgba(74,106,204,.25)';}
  else{avGlow='none';}
  const adv=calcAdvanced(p);
  const advHTML=buildAdvHTML(p,adv);
  const summaryHTML=buildDetailSummaryHTML(p,adv);

  document.getElementById('ds-content').innerHTML=`
    <div class="ds-rarity-banner" style="background:${rs.bg};color:${rs.c};border-bottom:1px solid ${rs.bd}">
      <span class="ds-rarity-main">${rarLabelMap[p.rar]||rs.lbl}</span>
      <span class="ds-rarity-sub">${rarAccentMap[p.rar]||rs.lbl}</span>
    </div>
    <div class="ds-head">
      <div class="ds-av-card" style="border-color:${rs.bd};box-shadow:${avGlow}">
        <div class="ds-av-top" style="background:${rs.bd}"></div>
        <div class="ds-av-body">
          <img src="${getPlayerPoseSrc(p)}" style="width:100%;height:100%;object-fit:contain;display:block">
        </div>
      </div>
      <div class="ds-inf">
        <div class="ds-zh" style="color:${isRetro?'#3a1a00':'var(--color-text-primary)'}">${displayName}</div>
        <div class="ds-en">${p.en}</div>
        <div class="ds-tags"><span class="ds-tag">${p.nat}</span><span class="ds-tag">${posStr(p)}</span><span class="ds-tag ds-tag-rarity" style="background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd}">${rarLabelMap[p.rar]||rs.lbl}</span>${p.year?`<span class="ds-tag">WBC ${p.year}</span>`:''}</div>
        <div class="ds-ovr-row"><span class="ds-ovr" style="color:${isRetro?'#8b4513':rs.c}">${p.ovr}</span><span class="ds-ovr-l">OVR</span><span class="ds-role-pill">${getPlayerArchetypeLabel(p)}</span></div>
      </div>
    </div>
    <div class="ds-tabs">
      <div class="ds-tab active" onclick="switchDetailTab(this,'tab-base')">⚡ 能力值</div>
      <div class="ds-tab" onclick="switchDetailTab(this,'tab-adv')">📊 進階數據</div>
      <div class="ds-tab" onclick="switchDetailTab(this,'tab-info')">📖 球員故事</div>
    </div>
    <div class="ds-tab-page show" id="tab-base">
      <div class="ds-stat-l">能力值</div>
      ${rows}
      ${summaryHTML}
      <div style="margin-top:12px"><div class="ds-stat-l">特殊技能</div><div class="ds-skills" style="padding:0;margin-top:6px">${skills}</div></div>
    </div>
    <div class="ds-tab-page" id="tab-adv">${advHTML}</div>
    <div class="ds-tab-page" id="tab-info">
      <div class="ds-story-head">
        <div class="ds-story-title">球員簡介</div>
        <div class="ds-story-sub">${displayName} ・ ${getPlayerPeakLabel(p)}</div>
      </div>
      <div class="ds-story" style="padding:0;border:none">${story}</div>
    </div>
    <div class="ds-btns">
      <button class="ds-btn" onclick="window._closeDetail()">關閉</button>
      ${detailActionBtn}
    </div>`;
  document.getElementById('detail-overlay').classList.add('show');
  setTimeout(()=>document.querySelectorAll('.ds-fill').forEach(el=>el.style.width=el.style.getPropertyValue('--w')),80);
}
function switchDetailTab(tab,pageId){
  tab.closest('.detail-sheet').querySelectorAll('.ds-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  tab.closest('.detail-sheet').querySelectorAll('.ds-tab-page').forEach(p=>p.classList.remove('show'));
  document.getElementById(pageId).classList.add('show');
}
window._closeDetail=()=>{detailContext=null;_detailOverlay.classList.remove('show');};
window.closeDetailBg=(e)=>{if(e.target===_detailOverlay)window._closeDetail();};
window._changeTeamFromDetail=()=>{
  if(!detailContext)return;
  const idx=detailContext.idx;
  const pos=detailContext.pos;
  const type=detailContext.type;
  window._closeDetail();
  if(type==='defense'||type==='lineup'){
    startPick('lineup',idx,{filter:pos,lockFilter:true});
    return;
  }
  if(type==='bench'){
    startPick('bench',idx);
    return;
  }
  if(type==='rotation'){
    startPick('rotation',idx,{filter:'SP',lockFilter:true});
    return;
  }
  if(type==='bullpen'){
    const filter=pos==='CP'?'CP':'RP';
    startPick('bullpen',idx,{filter,lockFilter:true});
  }
};
window._addFromDetail=(name,year)=>{const p=findPlayer(name,year);if(p){window._closeDetail();addPlayer(p);}};
window._removeFromTeam=(name,year)=>{
  const p=findPlayer(name,year);
  if(!p)return;
  [lineup,bench,rotation,bullpen].forEach(arr=>{
    const i=arr.findIndex(x=>x&&x.name===p.name&&x.year===p.year);
    if(i>=0)arr[i]=null;
  });
  autoFillBenchIfPossible();
  autoFillBullpenIfPossible();
  window._closeDetail();
  refreshTeamUI({save:true});
};

/* ═══ SCOUT SYSTEM ═══ */
const MAX_SCOUTS=3;

const SCOUT_DEFS=[
  {id:'s1',name:'陳志明',en:'Scout Chen',lv:1,maxLv:5,icon:'🕵️',
   desc:'初級球探，擅長亞洲市場，CPB出身。',
   quality:'COMMON/RARE為主',rarWeights:{c:0.55,r:0.35,l:0.08,h:0.02},
   cost:200,upgCost:500,dispatchTime:3},
  {id:'s2',name:'Roberto Silva',en:'Scout Silva',lv:1,maxLv:5,icon:'🕵️‍♂️',
   desc:'資深球探，拉丁美洲人脈豐富，曾在MLB任職。',
   quality:'RARE為主',rarWeights:{c:0.30,r:0.48,l:0.17,h:0.05},
   cost:500,upgCost:1200,dispatchTime:2},
  {id:'s3',name:'Marcus Johnson',en:'Scout Johnson',lv:1,maxLv:5,icon:'🧐',
   desc:'精英球探，前MLB球探部門主任，找到頂尖球員的機率最高。',
   quality:'LEGEND/HERO機率大增',rarWeights:{c:0.15,r:0.40,l:0.33,h:0.12},
   cost:1000,upgCost:3000,dispatchTime:1},
];

const SCOUT_REGIONS=[
  {id:'tw',flag:'🇹🇼',name:'台灣',desc:'CPBL / 台灣旅外',nations:['🇹🇼']},
  {id:'jp',flag:'🇯🇵',name:'日本/韓國',desc:'NPB/KBO 精英',nations:['🇯🇵','🇰🇷']},
  {id:'latam',flag:'🌎',name:'拉丁美洲',desc:'多明尼加/委內瑞拉',nations:['🇩🇴','🇻🇪','🇵🇷','🇲🇽','🇨🇺']},
  {id:'us',flag:'🇺🇸',name:'北美',desc:'MLB 球員',nations:['🇺🇸','🇨🇦']},
  {id:'eu',flag:'🇪🇺',name:'歐洲/澳洲',desc:'新興棒球市場',nations:['🇳🇱','🇮🇹','🇩🇪','🇦🇺']},
  {id:'global',flag:'🌍',name:'全球',desc:'任意國籍，驚喜更多',nations:['🇯🇵','🇰🇷','🇩🇴','🇻🇪','🇺🇸','🇳🇱','🇮🇹','🇵🇷','🇲🇽']},
];

// state
let myScouts=SCOUT_DEFS.map(s=>({...s,dispatched:false,doneIn:0,doneAt:0,searchMode:null,region:null,candidate:null}));
let dispatchingScoutId=null;
let selRegionId=null;
const SCOUT_MINUTE_PER_STEP=10;

function getScoutLevel(scout){
  // lv影響稀有度權重
  const lvBonus=(scout.lv-1)*0.02;
  return {
    c:Math.max(0.05,scout.rarWeights.c-lvBonus*2),
    r:scout.rarWeights.r+lvBonus,
    l:scout.rarWeights.l+lvBonus,
    h:Math.min(0.30,scout.rarWeights.h+lvBonus*0.5),
  };
}
function getScoutDurationMs(scout){
  return scout.dispatchTime*SCOUT_MINUTE_PER_STEP*60*1000;
}
function formatScoutEta(ms){
  const totalSec=Math.max(0,Math.ceil(ms/1000));
  const mins=Math.floor(totalSec/60);
  const secs=totalSec%60;
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}
function getScoutRemainingMs(scout){
  if(!scout.dispatched||scout.candidate)return 0;
  if(!scout.doneAt&&scout.doneIn>0){
    scout.doneAt=Date.now()+scout.doneIn*getScoutDurationMs(scout);
    scout.doneIn=0;
  }
  if(scout.doneAt)return Math.max(0,scout.doneAt-Date.now());
  return Math.max(0,(scout.doneIn||0)*getScoutDurationMs(scout));
}
function completeScoutSearch(scout){
  if(!scout||scout.candidate)return;
  const p=rollScoutPlayer(scout,scout.region);
  scout.doneIn=0;
  scout.doneAt=0;
  scout.searchMode=null;
  if(p){
    scout.candidate=p;
    scoutCandidates.push({...p,_fromScout:scout.id,_scoutName:scout.name});
  }else{
    // 找不到球員（該地區無可用球員）→ 球探回到空閒
    scout.dispatched=false;
    scout.region=null;
    scout.candidate=null;
  }
  return p;
}
function resolveScoutTimers(){
  let anyDone=false;
  myScouts.forEach(scout=>{
    if(scout.dispatched&&!scout.candidate&&getScoutRemainingMs(scout)<=0){
      completeScoutSearch(scout);
      anyDone=true;
    }
  });
  return anyDone;
}
function ensureScoutCountdownLoop(){
  if(scoutCountdownTimer)return;
  scoutCountdownTimer=setInterval(()=>{
    const active=myScouts.some(scout=>scout.dispatched&&!scout.candidate);
    if(!active)return;
    const anyDone=resolveScoutTimers();
    if(anyDone){
      renderScoutScreen();
      // 若 gacha/scout 頁面開著，自動切到搜尋結果 tab
      if(document.getElementById('sc-gacha')?.classList.contains('show')&&recruitTab==='scout'){
        const candidateTab=document.querySelectorAll('.scout-tab')[1];
        if(candidateTab)switchScoutTab(candidateTab,'stab-candidates');
      }
      showSaveToast('🕵️ 球探回報了！');
      autoSave();
      return;
    }
    if(document.getElementById('sc-gacha')?.classList.contains('show')&&recruitTab==='scout'){
      renderScoutScreen();
    }
  },1000);
}

function rollScoutPlayer(scout,region){
  const reg=SCOUT_REGIONS.find(r=>r.id===region);
  const nats=reg?reg.nations:['🇺🇸'];
  // 篩選對應國籍球員（排除已在候選、已在收藏）
  const candKeys=new Set(scoutCandidates.map(p=>p.name+'|'+(p.year??'')));
  const collKeys=new Set(collection.map(p=>p.name+'|'+(p.year??'')));
  const pool=ALL_PLAYERS.filter(p=>
    nats.includes(p.nat)&&
    !candKeys.has(p.name+'|'+(p.year??''))&&
    !collKeys.has(p.name+'|'+(p.year??''))
  );
  if(!pool.length)return null;
  // 依稀有度權重篩選
  const weights=getScoutLevel(scout);
  const total=weights.c+weights.r+weights.l+weights.h;
  let roll=Math.random()*total;
  let targetRar='c';
  if(roll<weights.h)targetRar='h';
  else if(roll<weights.h+weights.l)targetRar='l';
  else if(roll<weights.h+weights.l+weights.r)targetRar='r';
  const rarPool=pool.filter(p=>p.rar===targetRar);
  const src=rarPool.length?rarPool:pool;
  return {...src[Math.floor(Math.random()*src.length)],_scoutId:scout.id,_region:region};
}

function switchScoutTab(tab,pageId){
  if(!tab)return;
  tab.closest('.scout-tabs')?.querySelectorAll('.scout-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  ['stab-scouts','stab-candidates'].forEach(id=>{
    const el=document.getElementById(id);if(el){el.style.display=id===pageId?'flex':'none';el.style.flexDirection='column';}
  });
  if(pageId==='stab-candidates')renderCandidates();
}

function renderScoutScreen(){
  resolveScoutTimers();
  const gemEl=document.getElementById('gem-scout')||document.getElementById('gem-gacha');
  if(gemEl)gemEl.textContent=gems.toLocaleString();
  renderScoutSlots();
  renderScoutList();
  ensureScoutCountdownLoop();
}

function renderScoutSlots(){
  const row=document.getElementById('scout-slots-row');row.innerHTML='';
  myScouts.forEach(scout=>{
    const slot=document.createElement('div');
    if(!scout.dispatched){
      slot.className='scout-slot empty';
      slot.innerHTML=`<div class="ss-icon">🔭</div><div class="ss-sub" style="font-size:9px">空閒</div><div style="font-size:9px;font-weight:700;color:var(--color-text-primary)">${scout.name}</div>`;
    } else if(scout.candidate){
      slot.className='scout-slot done';
      slot.innerHTML=`<div class="ss-icon">⭐</div><div class="ss-name" style="font-size:9px">${scout.candidate.name}</div><div class="ss-sub">點擊查看</div>`;
      slot.querySelector('.ss-icon').textContent=scout.candidate.av;
      slot.onclick=()=>{switchScoutTab(document.querySelector('.scout-tab:nth-child(2)'),'stab-candidates');};
    } else {
      slot.className='scout-slot active';
      const reg=SCOUT_REGIONS.find(r=>r.id===scout.region);
      const modeLabel=scout.searchMode==='free'?'免費搜尋':'快速搜尋';
      slot.innerHTML=`<div class="ss-icon">${reg?reg.flag:'🌍'}</div><div class="ss-name">${scout.name}</div><div class="ss-sub">${reg?reg.name:'搜尋中'} · ${modeLabel}</div><div class="ss-timer">剩 ${formatScoutEta(getScoutRemainingMs(scout))}</div>`;
    }
    row.appendChild(slot);
  });
}

function renderScoutList(){
  const sec=document.getElementById('stab-scouts');sec.innerHTML='';
  myScouts.forEach(scout=>{
    const qualColor={1:'#6adb6a',2:'#7aaaff',3:'#d4a017'}[Math.min(3,scout.lv)]||'#6adb6a';
    const card=document.createElement('div');card.className='scout-card';
    card.innerHTML=`
      <div class="sc-top">
        <div class="sc-av" style="background:rgba(90,200,250,.1);border:1px solid rgba(90,200,250,.3)">${scout.icon}</div>
        <div class="sc-inf">
          <div class="sc-name">${scout.name}</div>
          <div class="sc-role">${scout.en} · ${scout.desc}</div>
        </div>
        <div class="sc-lv"><div class="sc-lv-num" style="color:#5ac8fa">Lv.${scout.lv}</div><div class="sc-lv-lbl">/${scout.maxLv}</div></div>
      </div>
      <div class="sc-tags">
        <span class="sc-tag" style="background:rgba(90,200,250,.1);color:#5ac8fa">免費 ${scout.dispatchTime*SCOUT_MINUTE_PER_STEP} 分鐘回報</span>
        <span class="sc-tag" style="background:${qualColor}20;color:${qualColor}">${scout.quality}</span>
        <span class="sc-tag" style="background:rgba(212,160,23,.1);color:#d4a017">快速完成 💎 ${scout.cost}</span>
      </div>
      <div class="sc-actions">
        <button class="sc-btn dispatch" ${scout.dispatched?'disabled':''} onclick="openDispatch('${scout.id}')">${scout.dispatched&&scout.candidate?'✅ 已有回報':scout.dispatched?'🔭 搜尋中...':'🔭 開始搜尋'}</button>
        <button class="sc-btn upgrade" ${scout.lv>=scout.maxLv?'disabled':''} onclick="upgradeScout('${scout.id}')">升級 💎${scout.upgCost}</button>
      </div>`;
    sec.appendChild(card);
  });
}

function openDispatch(scoutId){
  const scout=myScouts.find(s=>s.id===scoutId);
  if(!scout||scout.dispatched)return;
  dispatchingScoutId=scoutId;selRegionId=null;
  document.getElementById('db-scout-icon').textContent=scout.icon;
  document.getElementById('db-scout-name').textContent=scout.name+' 派遣地區';
  document.getElementById('dispatch-confirm-btn').disabled=true;
  document.getElementById('dispatch-free-btn').disabled=true;
  const grid=document.getElementById('region-grid');grid.innerHTML='';
  const infoEl=document.getElementById('dispatch-info');
  const selectRegion=(reg,btn)=>{
    selRegionId=reg.id;
    grid.querySelectorAll('.region-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    infoEl.innerHTML=`<b style="color:#5ac8fa">${reg.flag} ${reg.name}</b><br>免費搜尋：${scout.dispatchTime*SCOUT_MINUTE_PER_STEP} 分鐘後回報<br>快速完成：💎 ${scout.cost}<br>搜尋區域：${reg.name}<br>搜尋國籍：${reg.nations.join(' ')}`;
    document.getElementById('dispatch-confirm-btn').disabled=false;
    document.getElementById('dispatch-free-btn').disabled=false;
    document.getElementById('dispatch-confirm-btn').textContent=`快速完成 💎 ${scout.cost}`;
  };
  let firstBtn=null,firstRegion=null;
  SCOUT_REGIONS.forEach(reg=>{
    const btn=document.createElement('div');btn.className='region-btn';
    btn.innerHTML=`<div class="rb-flag">${reg.flag}</div><div class="rb-name">${reg.name}</div><div class="rb-qual">${reg.desc}</div><div style="font-size:9px;color:#5ac8fa;margin-top:3px">搜尋區域</div>`;
    btn.onclick=()=>selectRegion(reg,btn);
    if(!firstBtn){firstBtn=btn;firstRegion=reg;}
    grid.appendChild(btn);
  });
  if(firstBtn&&firstRegion)selectRegion(firstRegion,firstBtn);
  document.getElementById('dispatch-overlay').classList.add('show');
}
function closeDispatch(){document.getElementById('dispatch-overlay').classList.remove('show');dispatchingScoutId=null;selRegionId=null;}

function confirmDispatch(mode='free'){
  if(!dispatchingScoutId||!selRegionId)return;
  const scout=myScouts.find(s=>s.id===dispatchingScoutId);
  const reg=SCOUT_REGIONS.find(r=>r.id===selRegionId);
  if(!scout||!reg)return;
  if(mode==='fast'){
    const cost=scout.cost;
    if(gems<cost){alert(`💎 不足！需要 ${cost} 寶石`);return;}
    gems-=cost;
  }
  scout.dispatched=true;
  scout.region=selRegionId;
  scout.doneIn=0;
  scout.doneAt=Date.now()+getScoutDurationMs(scout);
  scout.candidate=null;
  scout.searchMode=mode;
  let result=null;
  if(mode==='fast')result=completeScoutSearch(scout);
  closeDispatch();
  renderScoutScreen();
  if(mode==='fast'){
    const candidateTab=document.querySelectorAll('.scout-tab')[1];
    if(candidateTab)switchScoutTab(candidateTab,'stab-candidates');
    renderCandidates();
    showSaveToast(result?'球探已快速完成，結果已送達':'這個地區目前沒有可招募球員');
  }else{
    showSaveToast('免費搜尋已開始');
  }
  updateGemDisp();autoSave();
}

function upgradeScout(scoutId){
  const scout=myScouts.find(s=>s.id===scoutId);
  if(!scout||scout.lv>=scout.maxLv)return;
  if(gems<scout.upgCost){alert(`💎 不足！需要 ${scout.upgCost} 寶石`);return;}
  gems-=scout.upgCost;scout.lv++;
  const wts=scout.rarWeights;
  wts.c=Math.max(0.05,wts.c-0.05);wts.r+=0.02;wts.l+=0.02;wts.h=Math.min(0.25,wts.h+0.01);
  renderScoutScreen();updateGemDisp();autoSave();
}

// 比賽結束後呼叫
function tickScouts(){
  matchCount++;
  if(resolveScoutTimers()){
    renderScoutScreen();
    autoSave();
  }
}

function renderCandidates(){
  const sec=document.getElementById('stab-candidates');sec.innerHTML='';
  if(!scoutCandidates.length){
    sec.innerHTML=`<div style="text-align:center;padding:30px;color:var(--color-text-tertiary);font-size:12px">📭 目前沒有搜尋結果<br>派遣球探後等待回報！</div>`;
    return;
  }
  const candFrag=document.createDocumentFragment();
  scoutCandidates.forEach((p,idx)=>{
    const rs=RAR[p.rar]||RAR.r;
    const card=document.createElement('div');card.className='candidate-card'+(p.rar==='h'||p.rar==='x'?' hot':'');
    card.innerHTML=`
      <div class="nat-banner"></div>
      <div class="cand-body">
        <div class="cand-av" style="background:${rs.bgC};border:1.5px solid ${rs.bd}">
          ${p.av}<span class="cand-nat-flag">${p.nat}</span>
        </div>
        <div class="cand-inf">
          <div class="cand-name">${cardLabel(p)}</div>
          <div class="cand-sub">${posStr(p)} · 由 ${p._scoutName||'球探'} 發現 · ${SCOUT_REGIONS.find(r=>r.id===p._region)?.name||''}</div>
          <div style="display:flex;gap:4px;margin-top:4px">
            <span style="font-size:8px;padding:1px 5px;border-radius:4px;font-weight:700;background:${rs.bg};color:${rs.c}">${rs.lbl}</span>
            <span style="font-size:8px;padding:1px 5px;border-radius:4px;font-weight:700;background:rgba(90,200,250,.1);color:#5ac8fa">🔭 搜尋回報</span>
          </div>
        </div>
        <div>
          <div class="cand-ovr" style="color:${rs.c};font-family:'Bebas Neue',cursive;font-size:24px">${p.ovr}</div>
          <div style="font-size:8px;color:${rs.c};text-align:right">${rs.lbl}</div>
        </div>
      </div>
      <div class="cand-cost">
        <div class="cand-cost-lbl">加入後可直接在收藏與組隊中使用</div>
        <button class="nat-btn" onclick="claimScoutCandidate(${idx})">加入收藏</button>
      </div>`;
    card.querySelector('.cand-av').style.cursor='pointer';
    card.querySelector('.cand-av').onclick=()=>showDetail(p);
    candFrag.appendChild(card);
  });
  sec.innerHTML='';sec.appendChild(candFrag);
}

function claimScoutCandidate(idx){
  const p=scoutCandidates[idx];if(!p)return;
  collection.push({...p});
  scoutCandidates.splice(idx,1);
  const scout=myScouts.find(s=>s.id===p._fromScout);
  if(scout){scout.dispatched=false;scout.candidate=null;scout.region=null;scout.doneIn=0;}
  updateGemDisp();renderCandidates();renderScoutScreen();autoSave();
  showDetail(p);
}

/* ═══ INIT ═══ */
loadDailyState();
// Load save on startup
const hasSave=loadGame();
if(hasSave&&myNation){
  const _n=getNationConfig(myNation);
  if(_n){
    document.getElementById('nation-screen').classList.add('hide');
    applyNationBranding(_n);
    renderMainScreens();
    updateGemDisp();
    hideAllScreens();
    document.getElementById('sc-home').classList.add('show');
  }else{
    buildNationScreen();
  }
}else{
  buildNationScreen();
}
