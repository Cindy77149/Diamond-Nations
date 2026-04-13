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

function buildPoseMiniCard(p,size='sm'){
  const rs=RAR[p.rar]||RAR.c;
  const isH=p.rar==='h';
  const isL=p.rar==='l';
  const isR=p.rar==='r';
  const isX=p.rar==='x';
  let avBg,avTopBg,avGlow;
  if(isH){avBg='linear-gradient(145deg,#2a1500,#1a0a00)';avTopBg='linear-gradient(90deg,#b07010,#f8d050,#d4a017)';avGlow='0 0 12px rgba(212,160,23,.28)';}
  else if(isL){avBg='linear-gradient(145deg,#150828,#0c0518)';avTopBg='linear-gradient(90deg,#6030b8,#cc88ff,#8a50d8)';avGlow='0 0 10px rgba(138,80,216,.24)';}
  else if(isR){avBg='linear-gradient(145deg,#0a1428,#060c18)';avTopBg='linear-gradient(90deg,#3050a8,#7aaaff)';avGlow='0 0 8px rgba(74,106,204,.18)';}
  else if(isX){avBg='linear-gradient(145deg,#faf6ee,#e8dcc8)';avTopBg='repeating-linear-gradient(90deg,#8b4513 0,#8b4513 3px,transparent 3px,transparent 6px)';avGlow='none';}
  else{avBg='linear-gradient(145deg,#0d1a0d,#060f06)';avTopBg=rs.bd;avGlow='none';}
  const poseSize=size==='lg'?34:28;
  return `
    <div class="pose-mini-card ${size}" style="background:${avBg};border:1.5px solid ${rs.bd};box-shadow:${avGlow}">
      <div class="pose-mini-top" style="background:${avTopBg}"></div>
      <div class="pose-mini-body">
        ${getPoseSVG(p,poseSize)}
      </div>
    </div>
  `;
}

function refreshTeamUI({save=false,switchTab=null}={}){
  if(switchTab)switchTeamTab(switchTab);
  applyTeamViewMode();
  renderTeam();
  renderPlayerList();
  if(save)autoSave();
}

function autoFillBenchIfPossible(){
  const usedKeys=new Set([...lineup,...bench,...rotation,...bullpen].filter(Boolean).map(getPlayerKey));
  const hitters=collection.filter(player=>!isPitcherPlayer(player)&&!usedKeys.has(getPlayerKey(player))).sort((a,b)=>b.ovr-a.ovr);
  for(let i=0;i<getBenchSlotCount();i++){
    if(bench[i])continue;
    const next=hitters.shift();
    if(!next)break;
    bench[i]=next;
    usedKeys.add(getPlayerKey(next));
  }
}

function autoFillBullpenIfPossible(){
  const usedKeys=new Set([...lineup,...bench,...rotation,...bullpen].filter(Boolean).map(getPlayerKey));
  const closerIdx=getCloserIndex();
  const pitchers=collection.filter(player=>isPitcherPlayer(player)&&!usedKeys.has(getPlayerKey(player))).sort((a,b)=>b.ovr-a.ovr);
  if(!bullpen[closerIdx]){
    const closerCandidate=pitchers.find(player=>hasPos(player,'CP'))||pitchers.find(player=>hasPos(player,'RP'))||pitchers[0];
    if(closerCandidate){
      bullpen[closerIdx]=closerCandidate;
      usedKeys.add(getPlayerKey(closerCandidate));
      pitchers.splice(pitchers.findIndex(player=>getPlayerKey(player)===getPlayerKey(closerCandidate)),1);
    }
  }
  for(let i=0;i<getBullpenSlotCount();i++){
    if(i===closerIdx)continue;
    if(bullpen[i])continue;
    const next=pitchers.shift();
    if(!next)break;
    bullpen[i]=next;
    usedKeys.add(getPlayerKey(next));
  }
}

function applyTeamViewMode(){
  const screen=document.getElementById('sc-team');
  if(!screen)return;
  screen.classList.toggle('team-view-compact',teamViewMode==='compact');
  const btn=document.getElementById('team-view-btn');
  if(btn)btn.textContent='排列';
  document.querySelectorAll('.team-view-opt').forEach(opt=>{
    opt.classList.toggle('active',opt.dataset.mode===teamViewMode);
  });
  document.querySelectorAll('.team-sort-opt').forEach(opt=>{
    opt.classList.toggle('active',opt.dataset.sort===teamSortMode);
  });
}

function toggleTeamViewMenu(){
  document.getElementById('team-view-menu')?.classList.toggle('show');
}

function closeTeamViewMenu(){
  document.getElementById('team-view-menu')?.classList.remove('show');
}

function setTeamViewMode(mode){
  teamViewMode=mode;
  applyTeamViewMode();
  renderTeam();
  renderPlayerList();
  autoSave();
}

function setTeamSortMode(mode){
  teamSortMode=mode;
  applyTeamViewMode();
  renderPlayerList();
  autoSave();
}

window.addEventListener('click',e=>{
  const wrap=document.querySelector('.team-view-wrap');
  if(!wrap)return;
  if(!wrap.contains(e.target))closeTeamViewMenu();
});

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
    c.style.cssText=`background:linear-gradient(180deg,#fffefa 0%,${isX2?'#f8efe3':'#f9f6f0'} 100%);border:2px solid ${rs.bd};animation:${animation};width:70px;opacity:1;transform:none;box-shadow:0 8px 16px rgba(0,0,0,.08)`;
    c.innerHTML=`<div class="rc-top" style="background:${rs.bd}"></div><div class="rc-body"><div class="rc-av">${buildPoseMiniCard(card,'sm')}</div><div class="rc-pos" style="color:${rs.c}">${posStr(card)}</div></div><div class="rc-bot"><div class="rc-name">${cleanName(card.name)}</div><div class="rc-sub-row"><span class="rc-ovr" style="color:${rs.c}">${card.ovr}</span><span class="rc-sub" style="background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${isX2?'RETRO':rs.lbl}${card.year?'・'+card.year:''}</span></div></div>`;
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
  if(id==='match')renderMatchSetup();
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
  {bg:'linear-gradient(135deg,#0f4a28,#1a6b3a)',icon:'🔥',tag:'限時活動',title:'限定卡包',sub:'2026 WBC 冠軍委內瑞拉限定 · HERO 5%',page:'gacha'},
  {bg:'linear-gradient(135deg,#100c1e,#2a1a04)',icon:'🏆',tag:'賽季模式',title:'WBC 2026',sub:'帶領你的國家征戰世界！',page:'match'},
  {bg:'linear-gradient(135deg,#18100a,#2a1a04)',icon:'🧑‍🏫',tag:'教練系統',title:'招募教練',sub:'提升打擊・投手・守備・心理・調度',page:'coach'},
];
let curBanner=0,bannerTimer=null;
function buildBanner(){
  const sl=document.getElementById('banner-slides'),dots=document.getElementById('bdots');sl.innerHTML='';dots.innerHTML='';
  BANNERS.forEach((b,i)=>{
    const s=document.createElement('div');s.className='banner-slide';s.style.background=b.bg;
    s.innerHTML=`<div class="bs-icon">${b.icon}</div><div><div class="bs-tag">${b.tag}</div><div class="bs-title">${b.title}</div><div class="bs-sub">${b.sub}</div></div>`;
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
let dailyState={pull:0,match:0,coach:false,claimed:[false,false,false],date:''};
function loadDailyState(){
  try{
    const raw=localStorage.getItem('dn_daily');
    if(raw){const d=JSON.parse(raw);if(d.date===new Date().toDateString()){dailyState=d;return;}}
  }catch(e){}
  dailyState={pull:0,match:0,coach:false,claimed:[false,false,false],date:new Date().toDateString()};
}
function saveDailyState(){try{localStorage.setItem('dn_daily',JSON.stringify({...dailyState,date:new Date().toDateString()}));}catch(e){}}
function getDailyProgress(idx){return[Math.min(dailyState.pull,3),Math.min(dailyState.match,1),dailyState.coach?1:0][idx];}
function claimDaily(idx){
  if(dailyState.claimed[idx])return;
  if(getDailyProgress(idx)<DAILY_DEF[idx].max){showSaveToast('任務尚未完成！');return;}
  dailyState.claimed[idx]=true;saveDailyState();
  gems+=DAILY_DEF[idx].gems;updateGemDisp();
  addActivity('🎁',`領取每日任務：${DAILY_DEF[idx].n}`,DAILY_DEF[idx].r);
  showSaveToast(`✅ 領取 ${DAILY_DEF[idx].r}！`);
  autoSave();renderHome();
}
/* ── 活動記錄 ── */
const ACTS=[
  {i:'🎉',t:'歡迎加入 Diamond Nations！',s:'選擇了你的國家，開始收集卡牌吧',tm:'剛才'},
];
function addActivity(i,t,s){ACTS.unshift({i,t,s,tm:'剛才'});if(ACTS.length>20)ACTS.pop();}
function renderHome(){
  document.getElementById('gem-home').textContent=gems.toLocaleString();
  const nation=getNationConfig(myNation);
  const subEl=document.getElementById('home-nation-sub');
  if(subEl)subEl.textContent=nation?nation.name+' · WBC':'選擇你的國家';
  // 球隊狀態卡
  const ovr=getTeamSummaryOvr();
  const batFilled=lineup.filter(Boolean).length+getActiveBench().filter(Boolean).length;
  const rotFilled=rotation.filter(Boolean).length;
  const bullFilled=getActiveBullpen().filter(Boolean).length;
  const el=id=>document.getElementById(id);
  if(el('hc-ovr'))el('hc-ovr').textContent=ovr;
  if(el('hc-lineup-sub'))el('hc-lineup-sub').textContent=ovr==='--'?'尚未配置陣容':'綜合能力值';
  if(el('hc-bat-cnt'))el('hc-bat-cnt').textContent=batFilled+'/'+(9+getBenchSlotCount());
  if(el('hc-rot-cnt'))el('hc-rot-cnt').textContent=rotFilled+'/5';
  if(el('hc-bull-cnt'))el('hc-bull-cnt').textContent=bullFilled+'/'+getBullpenSlotCount();
  // 收藏進度卡
  const uniqByKey=list=>Array.from(new Map(list.filter(Boolean).map(player=>[getPlayerKey(player),player])).values());
  const allUnique=uniqByKey(ALL_PLAYERS);
  const myFlag=nation?.flag||null;
  const allCollected=uniqByKey(collection);
  const nationPool=myFlag?allUnique.filter(player=>player.nat===myFlag):[];
  const nationCollected=myFlag?allCollected.filter(player=>player.nat===myFlag):[];
  const allTotal=allUnique.length;
  const allCnt=allCollected.length;
  const allPct=allTotal?Math.min(100,Math.round(allCnt/allTotal*100)):0;
  const nationPct=nationPool.length?Math.min(100,Math.round(nationCollected.length/nationPool.length*100)):0;
  if(el('hc-col-count'))el('hc-col-count').textContent=allCnt;
  if(el('hc-col-sub'))el('hc-col-sub').textContent=`全部 ${allCnt} / ${allTotal}`;
  if(el('hc-col-fill'))el('hc-col-fill').style.width=allPct+'%';
  if(el('hc-col-pct'))el('hc-col-pct').textContent=allPct+'%';
  if(el('hc-col-own'))el('hc-col-own').textContent=myFlag?`${nation?.name||'本國'} ${nationCollected.length} / ${nationPool.length}`:'本國 0 / 0';
  if(el('hc-col-own-fill'))el('hc-col-own-fill').style.width=nationPct+'%';
  if(el('hc-col-own-pct'))el('hc-col-own-pct').textContent=nationPct+'%';
  const dl=document.getElementById('daily-list');
  const dlFrag=document.createDocumentFragment();
  DAILY_DEF.forEach((d,idx)=>{
    const cur=getDailyProgress(idx);const pct=Math.round(cur/d.max*100);const claimed=dailyState.claimed[idx];const ready=cur>=d.max&&!claimed;
    const r=document.createElement('div');r.className='daily-row'+(claimed?' done':'');
    r.innerHTML=`<div class="dr-i">${d.i}</div><div class="dr-inf"><div class="dr-n">${d.n}</div><div class="dr-p">${cur}/${d.max}</div>${!claimed?`<div class="dr-tr"><div class="dr-f" style="width:${pct}%"></div></div>`:''}</div>${claimed?'<div style="font-size:16px;color:#4adb6a">✓</div>':ready?`<button class="dr-claim" onclick="claimDaily(${idx})">${d.r}</button>`:`<div class="dr-r">${d.r}</div>`}`;
    dlFrag.appendChild(r);
  });
  dl.innerHTML='';dl.appendChild(dlFrag);
  const al=document.getElementById('act-list');
  const alFrag=document.createDocumentFragment();
  ACTS.forEach(a=>{
    const r=document.createElement('div');r.className='daily-row';
    r.innerHTML=`<div class="dr-i">${a.i}</div><div class="dr-inf"><div class="dr-n">${a.t}</div><div class="dr-p">${a.s}</div></div><div style="font-size:9px;color:var(--color-text-tertiary)">${a.tm}</div>`;
    alFrag.appendChild(r);
  });
  al.innerHTML='';al.appendChild(alFrag);
}

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
    const frag=document.createDocumentFragment();
    (collectionDropdownOptions[key]||[]).forEach(option=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='collection-dropdown-opt'+(option.active?' active':'');
      btn.textContent=option.label;
      btn.onclick=()=>{
        optionsWrap.querySelectorAll('.collection-dropdown-opt').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        option.onPick();
      };
      frag.appendChild(btn);
    });
    optionsWrap.innerHTML='';
    optionsWrap.appendChild(frag);
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
    {id:'all',label:'全部'},{id:'owned',label:'已收藏'},{id:'unowned',label:'未收藏'},
  ];
  const nationOptions=[{id:'all',label:'全部國家'},...orderedFlags.map(flag=>{
    const nat=NATIONS.find(n=>n.flag===flag);
    return {id:flag,label:`${nat?.name||flag}`};
  })];
  const typeOptions=[
    {id:'all',label:'全部'},{id:'hitters',label:'野手'},{id:'pitchers',label:'投手'},
  ];
  const statusLabel=document.getElementById('collection-status-label');
  const nationLabel=document.getElementById('collection-nation-label');
  const typeLabel=document.getElementById('collection-type-label');
  if(statusLabel)statusLabel.textContent=statusOptions.find(o=>o.id===collectionStatusFilter)?.label||'全部';
  if(nationLabel)nationLabel.textContent=nationOptions.find(o=>o.id===collectionNationFilter)?.label||'全部國家';
  if(typeLabel)typeLabel.textContent=typeOptions.find(o=>o.id===collectionTypeFilter)?.label||'全部';
  document.getElementById('collection-status-wrap')?.classList.toggle('active',collectionStatusFilter!=='all');
  document.getElementById('collection-nation-wrap')?.classList.toggle('active',collectionNationFilter!=='all');
  document.getElementById('collection-type-wrap')?.classList.toggle('active',collectionTypeFilter!=='all');
  collectionDropdownOptions.status=statusOptions.map(o=>({...o,active:collectionStatusFilter===o.id,onPick:()=>setCollectionStatusFilter(o.id)}));
  collectionDropdownOptions.nation=nationOptions.map(o=>({...o,active:collectionNationFilter===o.id,onPick:()=>setCollectionNationFilter(o.id)}));
  collectionDropdownOptions.type=typeOptions.map(o=>({...o,active:collectionTypeFilter===o.id,onPick:()=>setCollectionTypeFilter(o.id)}));
  let list=[...allUnique];
  if(collectionNationFilter!=='all')list=list.filter(p=>p.nat===collectionNationFilter);
  if(collectionStatusFilter==='owned')list=list.filter(p=>ownedKeys.has(getPlayerKey(p)));
  if(collectionStatusFilter==='unowned')list=list.filter(p=>!ownedKeys.has(getPlayerKey(p)));
  if(collectionTypeFilter==='hitters')list=list.filter(p=>!isPitcherPlayer(p));
  if(collectionTypeFilter==='pitchers')list=list.filter(p=>isPitcherPlayer(p));
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
    card.innerHTML=`
      <div class="collection-card-top" style="background:${rs.bd}"></div>
      <div class="collection-card-body">
        <div class="collection-card-pose">${buildPoseMiniCard(p,'lg')}</div>
      </div>
      <div class="collection-card-foot">
        <div class="collection-card-name">${p.nat} ${cleanName(p.name)}</div>
        <div class="collection-card-meta">${posStr(p)} · ${p.year||''}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
          <span class="collection-card-badge" style="background:${rs.bg};color:${rs.c};border:.5px solid ${rs.bd}">${p.ovr} ${rs.lbl}</span>
          ${isOwned?`<span class="collection-card-owned">已收藏</span>`:''}
        </div>
      </div>`;
    card.onclick=()=>openDetail(p.name,p.year??null);
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
  wrap.style.cssText=`position:relative;width:${large?180:60}px;flex-shrink:0`;
  if(isH||isX){const gl=document.createElement('div');gl.className='hero-star-burst';wrap.appendChild(gl);for(let i=0;i<8;i++){const ray=document.createElement('div');ray.className='beam-ray';ray.style.transform=`rotate(${i*45}deg)`;wrap.appendChild(ray);}}
  else if(isL){const gl=document.createElement('div');gl.className='legend-glow-wrap';wrap.appendChild(gl);}
  const ce=document.createElement('div');
  const bgStyle=`linear-gradient(180deg,#fffefa 0%,${isX?'#f8efe3':'#f9f6f0'} 100%)`;
  const borderStyle=`2px solid ${rs.bd}`;
  const boxShadow=isH?`0 0 ${large?16:8}px rgba(212,160,23,.24)`:isL?`0 0 ${large?14:6}px rgba(138,80,216,.2)`:isX?`0 0 ${large?10:5}px rgba(139,69,19,.14)`:`0 6px 14px rgba(0,0,0,.08)`;
  ce.style.cssText=`background:${bgStyle};border:${borderStyle};box-shadow:${boxShadow};border-radius:${large?10:7}px;overflow:hidden;display:flex;flex-direction:column;width:100%;aspect-ratio:3/4.2;cursor:pointer`;
  const dn=cleanName(card.name);
  ce.innerHTML=`<div style="height:${large?7:4}px;background:${rs.bd};flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${large?6:3}px;padding:${large?'10px 8px 8px':'6px 4px 4px'}"><div class="pull-pose-box ${large?'large':'small'}">${buildPoseMiniCard(card,large?'lg':'sm')}</div><div style="font-family:'Bebas Neue',cursive;font-size:${large?14:9}px;color:${rs.c};line-height:1;opacity:.9">${posStr(card)}</div></div><div style="padding:${large?'6px 8px 7px':'3px 4px 4px'};background:rgba(255,255,255,.8);border-top:1px solid rgba(0,0,0,.05);flex-shrink:0"><div style="font-family:'Bebas Neue',cursive;font-size:${large?12:8}px;color:#1f1b16;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.nat} ${dn}</div><div style="display:flex;align-items:center;justify-content:center;gap:${large?6:3}px;margin-top:2px"><span style="font-family:'Bebas Neue',cursive;font-size:${large?18:10}px;color:${rs.c};line-height:1">${card.ovr}</span><span style="font-size:${large?8:6}px;font-weight:700;padding:1px 3px;border-radius:3px;background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${isX?'RETRO':rs.lbl}${card.year?'・'+card.year:''}</span></div></div>`;
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
function getWeightedMetric(groups){
  const usable=groups
    .map(group=>{
      const vals=(group.values||[]).filter(v=>Number.isFinite(v));
      return vals.length?{avg:vals.reduce((a,v)=>a+v,0)/vals.length,weight:group.weight}:null;
    })
    .filter(Boolean);
  if(!usable.length)return'--';
  const totalWeight=usable.reduce((a,g)=>a+g.weight,0);
  if(!totalWeight)return'--';
  return Math.round(usable.reduce((a,g)=>a+g.avg*g.weight,0)/totalWeight);
}
function getAssignedOvr(arr,type,startIdx=0){
  const vals=arr.map((p,i)=>p?getEffectiveOvr(p,type,i+startIdx):null).filter(v=>v!==null);
  return vals.length?Math.round(vals.reduce((a,v)=>a+v,0)/vals.length):'--';
}
function getDefenseOvr(arr){
  const f=arr.filter(Boolean).filter(p=>!p.pit&&Array.isArray(p.stats)&&p.stats.length>3&&Number.isFinite(p.stats[3]));
  return f.length?Math.round(f.reduce((a,p)=>a+(p.stats[3]||0),0)/f.length):'--';
}
function getBattingSummaryOvr(){
  const starterVals=lineup.map((p,i)=>p?getEffectiveOvr(p,'lineup',i):null).filter(v=>v!==null);
  const benchVals=getActiveBench().map(p=>p?p.ovr:null).filter(v=>v!==null);
  return getWeightedMetric([
    {values:starterVals,weight:.86},
    {values:benchVals,weight:.14},
  ]);
}
function getPitchingSummaryOvr(){
  const rotationVals=rotation.map((p,i)=>p?getEffectiveOvr(p,'rotation',i):null).filter(v=>v!==null);
  const bullpenVals=getActiveBullpen().map((p,i)=>p?getEffectiveOvr(p,'bullpen',i):null).filter(v=>v!==null);
  return getWeightedMetric([
    {values:rotationVals,weight:.72},
    {values:bullpenVals,weight:.28},
  ]);
}
function getDefenseSummaryOvr(){
  const posWeights={C:1.15,'1B':0.82,'2B':1.02,'3B':0.96,SS:1.14,LF:0.9,CF:1.08,RF:0.9,DH:0.45};
  const weighted=lineup
    .map((player,idx)=>{
      if(!player||player.pit||!Array.isArray(player.stats)||!Number.isFinite(player.stats[3]))return null;
      return {avg:player.stats[3]||0,weight:posWeights[DEF_POS[idx]]??1};
    })
    .filter(Boolean);
  if(!weighted.length)return'--';
  const totalWeight=weighted.reduce((a,g)=>a+g.weight,0);
  return Math.round(weighted.reduce((a,g)=>a+g.avg*g.weight,0)/totalWeight);
}
function getTeamSummaryOvr(){
  const bat=getBattingSummaryOvr();
  const pit=getPitchingSummaryOvr();
  const def=getDefenseSummaryOvr();
  return getWeightedMetric([
    {values:[bat],weight:.46},
    {values:[pit],weight:.34},
    {values:[def],weight:.20},
  ]);
}
function updateTeamHeader(){
  const batCount=[...lineup,...getActiveBench()].filter(Boolean).length;
  const pitCount=[...rotation,...getActiveBullpen()].filter(Boolean).length;
  document.getElementById('t-ovr').textContent=getTeamSummaryOvr();
  document.getElementById('t-bat').textContent=getBattingSummaryOvr();
  document.getElementById('t-pit').textContent=getPitchingSummaryOvr();
  document.getElementById('t-def').textContent=getDefenseSummaryOvr();
  const batCntEl=document.getElementById('t-bat-cnt');
  const pitCntEl=document.getElementById('t-pit-cnt');
  if(batCntEl)batCntEl.textContent=batCount;
  if(pitCntEl)pitCntEl.textContent=pitCount;
}
function switchTeamTab(id){
  document.querySelectorAll('.sub-tab').forEach((t,i)=>t.classList.toggle('active',['bat','pitch','def','pick'][i]===id));
  document.querySelectorAll('.sub-page').forEach(p=>p.classList.remove('show'));
  document.getElementById('sp-'+id)?.classList.add('show');
  if(id==='pick')swapSelection=null;
  closeTeamViewMenu();
  if(id==='pitch')switchPitcherTab(teamPitcherTab);
}
function switchPitcherTab(id){
  teamPitcherTab=id;
  document.querySelectorAll('.pitcher-sub-tab').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.sub===id);
  });
  document.querySelectorAll('.pitcher-sub-page').forEach(page=>page.classList.remove('show'));
  document.getElementById('sp-pitch-'+id)?.classList.add('show');
}
function openDefenseDetail(player,idx){
  showDetail(player,{type:'defense',idx,pos:DEF_POS[idx]});
}
function openDefensePick(idx){
  startPick('lineup',idx,{filter:DEF_POS[idx],lockFilter:true});
}
function buildTeamDetailContext(type,idx){
  return {type,idx,pos:getAssignedSlotPos(type,idx)};
}
function remapBattingOrderForDefenseSwap(fromIdx,toIdx){
  battingOrder=battingOrder.map(posIdx=>{
    if(posIdx===fromIdx)return toIdx;
    if(posIdx===toIdx)return fromIdx;
    return posIdx;
  });
}
function swapTeamSlots(type,fromIdx,toIdx){
  if(fromIdx===toIdx)return;
  if(type==='bat'){
    const tmp=battingOrder[fromIdx];
    battingOrder[fromIdx]=battingOrder[toIdx];
    battingOrder[toIdx]=tmp;
  }else if(type==='defense'){
    const tmp=lineup[fromIdx];
    lineup[fromIdx]=lineup[toIdx];
    lineup[toIdx]=tmp;
    remapBattingOrderForDefenseSwap(fromIdx,toIdx);
  }else if(type==='bench'){
    const tmp=bench[fromIdx];
    bench[fromIdx]=bench[toIdx];
    bench[toIdx]=tmp;
  }else{
    const targetArray=type==='rotation'?rotation:bullpen;
    const tmp=targetArray[fromIdx];
    targetArray[fromIdx]=targetArray[toIdx];
    targetArray[toIdx]=tmp;
  }
  swapSelection=null;
  refreshTeamUI({save:true});
}
function handleTeamSlotSelect(type,idx){
  if(pickMode)return;
  if(!swapSelection){
    swapSelection={type,idx};
    renderTeam();
    return;
  }
  if(swapSelection.type!==type){
    swapSelection={type,idx};
    renderTeam();
    return;
  }
  if(swapSelection.idx===idx){
    swapSelection=null;
    renderTeam();
    return;
  }
  swapTeamSlots(type,swapSelection.idx,idx);
}
function handleTeamSlotDragStart(e,type,idx){
  if(pickMode)return;
  dragSlotContext={type,idx};
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',`${type}:${idx}`);
  e.currentTarget.classList.add('dragging');
}
function handleTeamSlotDragEnd(e){
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.slot.drop-target').forEach(el=>el.classList.remove('drop-target'));
  dragSlotContext=null;
}
function handleTeamSlotDragOver(e,type){
  if(!dragSlotContext||dragSlotContext.type!==type)return;
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  e.currentTarget.classList.add('drop-target');
}
function handleTeamSlotDragLeave(e){
  e.currentTarget.classList.remove('drop-target');
}
function handleTeamSlotDrop(e,type,idx){
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if(!dragSlotContext||dragSlotContext.type!==type)return;
  swapTeamSlots(type,dragSlotContext.idx,idx);
  dragSlotContext=null;
}
function isInTeam(p){return lineup.includes(p)||bench.includes(p)||rotation.includes(p)||bullpen.includes(p);}
function mkSlot(leftLbl,p,type,idx){
  const actualIdx=type==='bat'?battingOrder[idx]:idx;
  const detailType=type==='bat'?'lineup':type;
  const effectiveType=type==='bat'?'lineup':type;
  const sel=pickMode&&((pickMode.type===effectiveType&&pickMode.idx===actualIdx)||(type==='defense'&&pickMode.type==='lineup'&&pickMode.idx===idx));
  const swapSel=swapSelection&&swapSelection.type===type&&swapSelection.idx===idx;
  const wrap=document.createElement('div');wrap.className='slot-row-wrap';
  const numEl=document.createElement('span');numEl.className='sl-num'+((type==='lineup'||type==='bat')?' is-bat':' is-role');
  if(type==='lineup'||type==='bat'){
    const txt=document.createElement('span');
    txt.className='sl-num-text';
    txt.textContent=leftLbl;
    numEl.appendChild(txt);
  }else{
    numEl.textContent=leftLbl;
  }
  wrap.appendChild(numEl);
  const slot=document.createElement('div');slot.className='slot'+(p?'':' empty')+(sel?' selected':'')+(swapSel?' swap-selected':'');
  slot.dataset.slotType=type;
  slot.dataset.slotIdx=idx;
  if(p){
    const rs=RAR[p.rar];const body=document.createElement('div');body.className='slot-body';
    const effOvr=getEffectiveOvr(p,effectiveType,actualIdx);
    const penalty=getPositionPenalty(p,effectiveType,actualIdx);
    const nameColor=p.rar==='x'?'#3a1a00':'#1f1b16';
    const subColor=p.rar==='x'?'rgba(58,26,0,.72)':'#74685a';
    slot.style.border=`2px solid ${rs.bd}`;
    slot.style.background=`linear-gradient(180deg,#fffefa 0%,${p.rar==='x'?'#f8efe3':'#f9f6f0'} 100%)`;
    slot.style.boxShadow=p.rar==='h'
      ?'0 8px 18px rgba(212,160,23,.14)'
      :p.rar==='l'
        ?'0 8px 18px rgba(138,80,216,.12)'
        :p.rar==='r'
          ?'0 8px 18px rgba(74,106,204,.1)'
          :p.rar==='c'
            ?'0 8px 16px rgba(58,106,58,.08)'
            :'0 8px 16px rgba(139,69,19,.08)';
    body.innerHTML=`<div class="sl-inf" style="cursor:pointer"><div class="sl-name-wrap"><div class="sl-nm" style="color:${nameColor}">${p.nat} ${cardLabel(p)}</div><span class="sl-poschip">${posStr(p)}</span></div><div class="sl-sb" style="color:${subColor}">${p.en}${p.year?'・'+p.year:''}${penalty>0?` · 錯位 -${penalty}`:''}</div></div><span class="sl-ovr" style="color:${rs.c}">${effOvr}</span><span class="sl-rar" style="background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${rs.lbl}</span><span class="sl-rm">✕</span>`;
    body.querySelector('.sl-inf').onclick=(e)=>{e.stopPropagation();showDetail(p,buildTeamDetailContext(detailType,actualIdx));};
    body.querySelector('.sl-rm').onclick=(e)=>{
      e.stopPropagation();
      if(type==='bat'||type==='lineup'||type==='defense')lineup[actualIdx]=null;
      else if(type==='bench')bench[idx]=null;
      else if(type==='rotation')rotation[idx]=null;
      else bullpen[idx]=null;
      if(type!=='bench'&&type!=='bullpen'){
        autoFillBenchIfPossible();
        autoFillBullpenIfPossible();
      }
      refreshTeamUI();
    };
    slot.appendChild(body);
    slot.onclick=(e)=>{
      if(e.target.closest('.sl-inf')||e.target.closest('.sl-rm'))return;
      handleTeamSlotSelect(type,idx);
    };
    slot.draggable=!pickMode;
    slot.addEventListener('dragstart',e=>handleTeamSlotDragStart(e,type,idx));
    slot.addEventListener('dragend',handleTeamSlotDragEnd);
    slot.addEventListener('dragover',e=>handleTeamSlotDragOver(e,type));
    slot.addEventListener('dragleave',handleTeamSlotDragLeave);
    slot.addEventListener('drop',e=>handleTeamSlotDrop(e,type,idx));
  } else {
    const ph=document.createElement('div');ph.className='slot-empty-body';
    ph.innerHTML=`<span class="sl-av" style="font-size:14px;opacity:.3">＋</span><div class="sl-inf"><div class="sl-nm" style="color:var(--color-text-tertiary)">點擊選擇</div></div>`;
    slot.appendChild(ph);
    if(type==='bat')slot.onclick=()=>handleTeamSlotSelect(type,idx);
    else slot.onclick=()=>startPick(type==='defense'?'lineup':type,actualIdx);
    slot.addEventListener('dragover',e=>handleTeamSlotDragOver(e,type));
    slot.addEventListener('dragleave',handleTeamSlotDragLeave);
    slot.addEventListener('drop',e=>handleTeamSlotDrop(e,type,idx));
  }
  wrap.appendChild(slot);
  return wrap;
}
function renderDefenseField(container){
  if(!container)return;
  const posClassMap={
    C:'c', '1B':'first', '2B':'second', '3B':'third', SS:'ss',
    LF:'lf', CF:'cf', RF:'rf', DH:'dh'
  };
  const items=DEF_POS.map((pos,i)=>{
    const player=lineup[i];
    const tile=document.createElement('button');
    tile.type='button';
    tile.className=`def-pos-tile ${player?'filled':'empty'} pos-${posClassMap[pos]||'bench'}`;
    if(player){
      const rs=RAR[player.rar]||RAR.c;
      const effOvr=getEffectiveOvr(player,'defense',i);
      const penalty=getPositionPenalty(player,'defense',i);
      tile.style.borderColor=rs.bd;
      tile.draggable=!pickMode;
      tile.innerHTML=`
        <div class="def-pos-label">${pos}</div>
        <div class="def-pos-card">
          <div class="def-pos-name">${cardLabel(player)}</div>
          <div class="def-pos-meta">
            <span class="def-pos-ovr" style="color:${rs.c}">${effOvr}</span>
            <span class="def-pos-rar" style="background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${rs.lbl}</span>
          </div>
          ${penalty>0?`<div class="def-pos-penalty">錯位 -${penalty}</div>`:''}
        </div>
      `;
      tile.onclick=()=>openDefenseDetail(player,i);
      tile.addEventListener('dragstart',e=>handleTeamSlotDragStart(e,'defense',i));
      tile.addEventListener('dragend',handleTeamSlotDragEnd);
      tile.addEventListener('dragover',e=>handleTeamSlotDragOver(e,'defense'));
      tile.addEventListener('dragleave',handleTeamSlotDragLeave);
      tile.addEventListener('drop',e=>handleTeamSlotDrop(e,'defense',i));
    }else{
      tile.innerHTML=`
        <div class="def-pos-label">${pos}</div>
        <div class="def-pos-empty">＋</div>
      `;
      tile.onclick=()=>openDefensePick(i);
      tile.addEventListener('dragover',e=>handleTeamSlotDragOver(e,'defense'));
      tile.addEventListener('dragleave',handleTeamSlotDragLeave);
      tile.addEventListener('drop',e=>handleTeamSlotDrop(e,'defense',i));
    }
    return tile;
  });
  container.innerHTML=`
    <div class="def-field-wrap">
      <div class="def-field">
        <div class="def-diamond"></div>
        <div class="def-outfield-arc"></div>
      </div>
    </div>
  `;
  const field=container.querySelector('.def-field');
  items.forEach(tile=>field.appendChild(tile));
}
function renderTeam(){
  updateTeamHeader();
  const batFrag=document.createDocumentFragment();
  battingOrder.forEach((lineupIdx,i)=>batFrag.appendChild(mkSlot(BAT[i],lineup[lineupIdx],'bat',i)));
  const benchFrag=document.createDocumentFragment();
  getActiveBench().forEach((p,i)=>benchFrag.appendChild(mkSlot(getBenchLabels()[i],p,'bench',i)));
  const rotFrag=document.createDocumentFragment();
  rotation.forEach((p,i)=>rotFrag.appendChild(mkSlot(ROT[i],p,'rotation',i)));
  const bullFrag=document.createDocumentFragment();
  getActiveBullpen().forEach((p,i)=>bullFrag.appendChild(mkSlot(getBullpenLabels()[i],p,'bullpen',i)));
  const bat=document.getElementById('sp-bat-lineup');bat.innerHTML='';bat.appendChild(batFrag);
  const batBench=document.getElementById('sp-bat-bench');batBench.innerHTML='';batBench.appendChild(benchFrag);
  const def=document.getElementById('sp-def');if(def)renderDefenseField(def);
  const rot=document.getElementById('sp-pitch-rot');rot.innerHTML='';rot.appendChild(rotFrag);
  const bull=document.getElementById('sp-pitch-bull-list');if(bull){bull.innerHTML='';bull.appendChild(bullFrag);}
  switchPitcherTab(teamPitcherTab);
}
function startPick(type,idx,opts={}){
  pickMode={type,idx};
  document.getElementById('pick-hint').textContent='▶ 選擇 '+(type==='lineup'?BAT[idx]:type==='bench'?getBenchLabels()[idx]:type==='rotation'?ROT[idx]:getBullpenLabels()[idx]);
  document.getElementById('pick-banner').classList.add('show');
  if(opts.filter){
    filterPos=opts.filter;
    lockedFilterPos=opts.lockFilter?opts.filter:null;
  }else if(type==='rotation'){
    filterPos='SP';lockedFilterPos=null;
  }else if(type==='bullpen'){
    filterPos=getBullpenLabels()[idx]==='CP'?'CP':'RP';lockedFilterPos=null;
  }else if(type==='bench'){
    filterPos='全部';lockedFilterPos=null;
  }else{
    filterPos='全部';lockedFilterPos=null;
  }
  closeTeamViewMenu();
  switchTeamTab('pick');renderFilterTabs();renderPlayerList();
}
function cancelPick(){pickMode=null;lockedFilterPos=null;document.getElementById('pick-banner').classList.remove('show');filterPos='全部';renderFilterTabs();renderPlayerList();swapSelection=null;renderTeam();}
const POS_FILTERS=['全部','SP','RP','CP','C','1B','2B','3B','SS','OF','LF','CF','RF','DH'];
const BENCH_FILTERS=['全部','C','1B','2B','3B','SS','OF','LF','CF','RF','DH'];
function renderFilterTabs(){
  const fr=document.getElementById('filter-row');
  const frag=document.createDocumentFragment();
  const filters=lockedFilterPos?[lockedFilterPos]:(pickMode?.type==='bench'?BENCH_FILTERS:POS_FILTERS);
  filters.forEach(f=>{const b=document.createElement('button');b.className='ftab'+(f===filterPos?' active':'');b.textContent=f;b.onclick=()=>{if(lockedFilterPos)return;filterPos=f;renderFilterTabs();renderPlayerList();};frag.appendChild(b);});
  fr.innerHTML='';fr.appendChild(frag);
}
function renderPlayerList(){
  const pl=document.getElementById('player-list');
  if(!pl)return;
  let list=collection.length>0?[...collection]:[...ALL_PLAYERS];
  const ofPos=['LF','CF','RF'];
  const teamKeys=new Set([...lineup,...bench,...rotation,...bullpen].filter(Boolean).map(getPlayerKey));
  const prioritizeAvailableBench=pickMode?.type==='bench';
  if(prioritizeAvailableBench&&filterPos==='全部'){
    list=list.filter(p=>!isPitcherPlayer(p));
  }else if(filterPos!=='全部'){
    list=list.filter(p=>{const pa=posArr(p);return pa.includes(filterPos)||(ofPos.includes(filterPos)&&pa.includes('OF'));});
  }
  const applyBaseSort=(a,b)=>{
    if(prioritizeAvailableBench){
      const aInTeam=teamKeys.has(getPlayerKey(a));
      const bInTeam=teamKeys.has(getPlayerKey(b));
      if(aInTeam!==bInTeam)return aInTeam?1:-1;
    }
    return 0;
  };
  if(teamSortMode==='rarity'){
    const rank={h:5,x:4,l:3,r:2,c:1};
    list.sort((a,b)=>applyBaseSort(a,b)||(rank[b.rar]||0)-(rank[a.rar]||0)||b.ovr-a.ovr||cleanName(a.name).localeCompare(cleanName(b.name),'zh-Hant'));
  }else if(teamSortMode==='acquired'){
    const idxMap=new Map(collection.map((p,i)=>[getPlayerKey(p),i]));
    list.sort((a,b)=>applyBaseSort(a,b)||(idxMap.get(getPlayerKey(b))??-1)-(idxMap.get(getPlayerKey(a))??-1));
  }else{
    list.sort((a,b)=>applyBaseSort(a,b)||b.ovr-a.ovr||cleanName(a.name).localeCompare(cleanName(b.name),'zh-Hant'));
  }
  if(teamViewMode==='compact'){
    const grid=document.createElement('div');
    grid.className='pick-card-grid';
    list.forEach(p=>{
      const inTeam=teamKeys.has(getPlayerKey(p));const rs=RAR[p.rar]||RAR.c;
      const isX=p.rar==='x';
      const card=document.createElement('div');
      card.className='pick-card'+(inTeam?' in-team':'');
      card.style.background=`linear-gradient(180deg,#fffefa 0%,${isX?'#f8efe3':'#f9f6f0'} 100%)`;
      card.style.border=`2px solid ${rs.bd}`;
      card.innerHTML=`
        <div class="pick-card-top" style="background:${rs.bd}"></div>
        <div class="pick-card-body" onclick="showDetail(p)">
          <div class="pick-card-av">${buildPoseMiniCard(p,'lg')}</div>
          <div class="pick-card-pos" style="color:${rs.c}">${posStr(p)}</div>
        </div>
        <div class="pick-card-foot">
          <div class="pick-card-name">${cardLabel(p)}</div>
          <div class="pick-card-meta">
            <span class="pick-card-ovr" style="color:${rs.c}">${p.ovr}</span>
            <span class="pick-card-rar" style="background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${isX?'RETRO':rs.lbl}</span>
          </div>
        </div>
        ${inTeam?'<div class="pick-card-badge">已上陣</div>':'<button class="pick-card-add" type="button">加入</button>'}
      `;
      card.querySelector('.pick-card-body').onclick=(e)=>{e.stopPropagation();showDetail(p);};
      if(!inTeam){
        card.querySelector('.pick-card-add').onclick=(e)=>{e.stopPropagation();addPlayer(p);};
      }
      grid.appendChild(card);
    });
    pl.innerHTML='';
    pl.appendChild(grid);
    return;
  }
  const frag=document.createDocumentFragment();
  list.forEach(p=>{
    const inTeam=teamKeys.has(getPlayerKey(p));const rs=RAR[p.rar]||RAR.c;
    const isX=p.rar==='x';
    const nameColor=isX?'#3a1a00':'#1f1b16';
    const metaColor=isX?'#8a6c4f':'#74685a';
    const row=document.createElement('div');
    row.className='pick-row'+(inTeam?' in-team':'');
    row.style.background=`linear-gradient(180deg,#fffefa 0%,${isX?'#f8efe3':'#f9f6f0'} 100%)`;
    row.style.border=`2px solid ${rs.bd}`;
    row.innerHTML=`
      <div class="pick-row-accent" style="background:${rs.bd}"></div>
      <div class="pick-row-av" onclick="showDetail(p)">${buildPoseMiniCard(p,'sm')}</div>
      <div class="pick-row-main" onclick="showDetail(p)">
        <div class="pick-row-name-wrap">
          <div class="pick-row-name" style="color:${nameColor}">${p.nat} ${cardLabel(p)}</div>
          <span class="pick-row-poschip">${posStr(p)}</span>
        </div>
        <div class="pick-row-sub" style="color:${metaColor}">${p.en}${p.year?'・'+p.year:''}</div>
      </div>
      <span class="pick-row-ovr" style="color:${rs.c}">${p.ovr}</span>
      <span class="pick-row-rar" style="background:${rs.bg};color:${rs.c};border:1px solid ${rs.bd}">${isX?'RETRO':rs.lbl}</span>
      ${inTeam?'<span class="pick-row-in">已上陣</span>':'<button class="pick-row-add" type="button">加入</button>'}
    `;
    row.querySelector('.pick-row-av').onclick=(e)=>{e.stopPropagation();showDetail(p);};
    row.querySelector('.pick-row-main').onclick=(e)=>{e.stopPropagation();showDetail(p);};
    if(!inTeam){
      row.querySelector('.pick-row-add').onclick=(e)=>{e.stopPropagation();addPlayer(p);};
    }
    frag.appendChild(row);
  });
  pl.innerHTML='';pl.appendChild(frag);
}
function clearExistingPlayerFromTeam(player,excludeType=null,excludeIdx=-1){
  const key=getPlayerKey(player);
  lineup.forEach((cur,i)=>{if(cur&&getPlayerKey(cur)===key&&!(excludeType==='lineup'&&excludeIdx===i))lineup[i]=null;});
  bench.slice(0,getBenchSlotCount()).forEach((cur,i)=>{if(cur&&getPlayerKey(cur)===key&&!(excludeType==='bench'&&excludeIdx===i))bench[i]=null;});
  rotation.forEach((cur,i)=>{if(cur&&getPlayerKey(cur)===key&&!(excludeType==='rotation'&&excludeIdx===i))rotation[i]=null;});
  bullpen.slice(0,getBullpenSlotCount()).forEach((cur,i)=>{if(cur&&getPlayerKey(cur)===key&&!(excludeType==='bullpen'&&excludeIdx===i))bullpen[i]=null;});
}
function getAbilityValue(player,index){
  if(!player)return 0;
  if(player.pit)return player.stats?.[index]??0;
  switch(index){
    case 0:return player.stats?.[0]??0; // 打擊力
    case 1:return player.power??player.stats?.[0]??0; // 力量
    case 2:return player.stats?.[1]??0; // 選球眼
    case 3:return player.stats?.[2]??0; // 速度
    case 4:return player.stats?.[3]??0; // 守備力
    case 5:return player.stats?.[4]??0; // 心理
    default:return 0;
  }
}
let _comparePending=null;
function showCompare(current,incoming){
  _comparePending=incoming;
  const defs=current.pit?P_STATS:B_STATS;
  const rsA=RAR[current.rar]||RAR.c;
  const rsB=RAR[incoming.rar]||RAR.c;
  const ovrDiff=incoming.ovr-current.ovr;
  const ovrDiffColor=ovrDiff>0?'#4adb6a':ovrDiff<0?'#f06070':'rgba(255,255,255,.4)';
  const ovrDiffStr=ovrDiff>0?`▲${ovrDiff}`:ovrDiff<0?`▼${Math.abs(ovrDiff)}`:'—';
  const statRows=defs.map((d,i)=>{
    const a=getAbilityValue(current,i),b=getAbilityValue(incoming,i),diff=b-a;
    const diffColor=diff>0?'#4adb6a':diff<0?'#f06070':'var(--color-text-tertiary)';
    const diffStr=diff>0?`+${diff}`:diff<0?`${diff}`:'—';
    return `<div class="cmp-row">
      <div style="display:flex;align-items:center;gap:4px">
        <div class="cmp-bar-wrap" style="flex:1"><div class="cmp-bar" style="width:${Math.round(a/99*100)}%;background:${rsA.c}"></div></div>
        <span class="cmp-val">${a}</span>
      </div>
      <div class="cmp-mid">
        <div class="cmp-lbl">${d.zh}</div>
        <div class="cmp-diff" style="color:${diffColor}">${diffStr}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <div class="cmp-bar-wrap" style="flex:1"><div class="cmp-bar" style="width:${Math.round(b/99*100)}%;background:${rsB.c}"></div></div>
        <span class="cmp-val">${b}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('compare-content').innerHTML=`
    <div class="cmp-header">
      <div class="cmp-player">
        <div class="cmp-tag">現有球員</div>
        <div class="cmp-name">${cardLabel(current)}</div>
        <div class="cmp-pos">${current.nat} ${posStr(current)}</div>
        <div class="cmp-ovr-row">
          <div class="cmp-ovr" style="color:${rsA.c}">${current.ovr}</div>
          <div class="cmp-rar" style="background:${rsA.bg};color:${rsA.c};border:1px solid ${rsA.bd}">${rsA.lbl}</div>
        </div>
      </div>
      <div class="cmp-vs">
        <div class="cmp-vs-txt">VS</div>
        <div class="cmp-ovr-diff" style="color:${ovrDiffColor}">${ovrDiffStr}</div>
      </div>
      <div class="cmp-player right">
        <div class="cmp-tag new">換入球員</div>
        <div class="cmp-name">${cardLabel(incoming)}</div>
        <div class="cmp-pos">${incoming.nat} ${posStr(incoming)}</div>
        <div class="cmp-ovr-row">
          <div class="cmp-ovr" style="color:${rsB.c}">${incoming.ovr}</div>
          <div class="cmp-rar" style="background:${rsB.bg};color:${rsB.c};border:1px solid ${rsB.bd}">${rsB.lbl}</div>
        </div>
      </div>
    </div>
    <div class="cmp-body">${statRows}</div>`;
  document.getElementById('compare-overlay').classList.add('show');
}
function closeCompare(){
  _comparePending=null;
  document.getElementById('compare-overlay').classList.remove('show');
}
function closeCompareBg(e){if(e.target===document.getElementById('compare-overlay'))closeCompare();}
function confirmCompare(){
  if(!_comparePending)return;
  const p=_comparePending;
  closeCompare();
  doAddPlayer(p);
}

function addPlayer(p){
  // pickMode 且槽位已有球員 → 先比較
  if(pickMode){
    const{type,idx}=pickMode;
    const cur=type==='lineup'?lineup[idx]:type==='bench'?bench[idx]:type==='rotation'?rotation[idx]:bullpen[idx];
    if(cur){showCompare(cur,p);return;}
  }
  doAddPlayer(p);
}
function doAddPlayer(p){
  if(!pickMode){
    clearExistingPlayerFromTeam(p);
    const closerIdx=getCloserIndex();
    if(hasPos(p,'CP')&&!bullpen[closerIdx]){bullpen[closerIdx]=p;}
    else if(hasPos(p,'RP')){const i=findFirstEmptySlot(bullpen,getBullpenSlotCount(),closerIdx);if(i>=0)bullpen[i]=p;}
    else if(p.pit){const i=rotation.indexOf(null);if(i>=0)rotation[i]=p;else{const j=findFirstEmptySlot(bullpen,getBullpenSlotCount(),closerIdx);if(j>=0)bullpen[j]=p;}}
    else{
      const i=lineup.indexOf(null);
      if(i>=0)lineup[i]=p;
      else{
        const j=findFirstEmptySlot(bench,getBenchSlotCount());
        if(j>=0)bench[j]=p;
      }
    }
    refreshTeamUI({save:true});return;
  }
  const{type,idx}=pickMode;
  clearExistingPlayerFromTeam(p,type,idx);
  if(type==='lineup')lineup[idx]=p;
  else if(type==='bench')bench[idx]=p;
  else if(type==='rotation')rotation[idx]=p;
  else bullpen[idx]=p;
  pickMode=null;lockedFilterPos=null;document.getElementById('pick-banner').classList.remove('show');
  filterPos='全部';
  if(type==='bench'){
    refreshTeamUI({save:true,switchTab:'bat'});
    return;
  }
  if(type==='rotation'){
    teamPitcherTab='rot';
    refreshTeamUI({save:true,switchTab:'pitch'});
    return;
  }
  if(type==='bullpen'){
    teamPitcherTab='bull';
    refreshTeamUI({save:true,switchTab:'pitch'});
    return;
  }
  refreshTeamUI({save:true,switchTab:'bat'});
}

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
let selEraIdx=5;
let selMatchMode=null;
let deferredInstallPrompt=null;
let expandedMatchRosterKey=null;
function getDynastyKey(opp){
  return `${opp._eraYear||opp.era||'na'}|${opp.name}`;
}
function getMatchRosterKey(opp){
  return `${opp._challengeType||'journey'}|${opp._eraYear||opp.era||'na'}|${opp.name}`;
}
function toggleMatchRoster(key){
  expandedMatchRosterKey=expandedMatchRosterKey===key?null:key;
  renderMatchSetup();
}
function setMatchMode(mode){
  selMatchMode=selMatchMode===mode?null:mode;
  if(!selMatchMode)expandedMatchRosterKey=null;
  renderMatchSetup();
}
function getMyMatchPreviewRatings(){
  const {batBonus,pitBonus}=getCoachBonus();
  const myBatSlots=battingOrder.map(lineupIdx=>lineup[lineupIdx]?{player:lineup[lineupIdx],idx:lineupIdx}:null).filter(Boolean);
  const batOvr=myBatSlots.length
    ?Math.round(myBatSlots.reduce((sum,slot)=>sum+getEffectiveOvr(slot.player,'lineup',slot.idx),0)/myBatSlots.length)+Math.round(batBonus/10)
    :72;
  const pitOvr=rotation[0]
    ?(getEffectiveOvr(rotation[0],'rotation',0)||72)+Math.round(pitBonus/10)
    :72;
  return {
    batOvr:clampRating(batOvr),
    pitOvr:clampRating(pitOvr),
    overall:clampRating(batOvr*.56+pitOvr*.44),
  };
}
function getOpponentMatchPreviewRatings(opp){
  const roster=buildOpponentTeamFromYear(opp);
  const batBase=roster.starters.length
    ?Math.round(roster.starters.reduce((sum,player)=>sum+player.ovr,0)/roster.starters.length)
    :opp.str;
  const pitPool=[...roster.rotation,...roster.bullpen];
  const pitBase=pitPool.length
    ?Math.round(pitPool.reduce((sum,player)=>sum+player.ovr,0)/pitPool.length)
    :opp.str;
  const batOvr=clampRating(batBase*.82+opp.str*.18);
  const pitOvr=clampRating(pitBase*.82+opp.str*.18);
  const starterPitOvr=roster.rotation[0]
    ?clampRating(roster.rotation[0].ovr*.72+pitOvr*.28)
    :pitOvr;
  return {
    roster,
    batOvr,
    pitOvr:starterPitOvr,
    overall:clampRating(batOvr*.56+starterPitOvr*.44),
  };
}
function renderMatchSetup(){
  const myPreview=getMyMatchPreviewRatings();
  const n=getNationConfig(myNation);
  document.getElementById('match-mode-grid')?.classList.toggle('collapsed',!!selMatchMode);
  ['journey','dynasty','special'].forEach(mode=>{
    document.getElementById('match-mode-'+mode)?.classList.toggle('active',selMatchMode===mode);
  });
  const detail=document.getElementById('match-detail');
  if(detail){
    detail.classList.toggle('has-mode',!!selMatchMode);
    if(selMatchMode==='journey'){
      detail.innerHTML=`
        <div class="match-detail-card">
          <div class="match-detail-top">
            <div>
              <div class="match-detail-title">經典賽征途</div>
              <div class="match-detail-sub">從年份節點一路推進，挑戰 ${n?n.name:'你的代表隊'} 的歷代經典對手。</div>
            </div>
            <button class="match-detail-close" type="button" onclick="setMatchMode('journey')">×</button>
          </div>
          <div class="match-section-head">
            <span>年份節點</span>
            <span class="match-section-note">選擇年份</span>
          </div>
          <div class="journey-rail" id="era-tabs"></div>
          <div id="era-header"></div>
          <div class="match-section-head">
            <span>本屆強敵</span>
            <span class="match-section-note" id="match-stage-note">逐一擊破，解鎖下一段征途</span>
          </div>
          <div class="opp-list" id="opp-list"></div>
        </div>`;
    }else if(selMatchMode==='dynasty'){
      detail.innerHTML=`
        <div class="match-detail-card">
          <div class="match-detail-top">
            <div>
              <div class="match-detail-title">王朝挑戰</div>
              <div class="match-detail-sub">挑戰歷代冠軍完全體與巔峰世代，首通可獲得額外獎勵。</div>
            </div>
            <button class="match-detail-close" type="button" onclick="setMatchMode('dynasty')">×</button>
          </div>
          <div class="dynasty-grid" id="dynasty-grid"></div>
        </div>`;
    }else if(selMatchMode==='special'){
      detail.innerHTML=`
        <div class="special-event-card">
          <div class="match-detail-top" style="margin-bottom:6px">
            <div>
              <div class="special-event-kicker">SPECIAL EVENT</div>
              <div class="special-event-title">特別賽 即將開放</div>
            </div>
            <button class="match-detail-close" type="button" onclick="setMatchMode('special')">×</button>
          </div>
          <div class="special-event-copy">這裡之後可以放每日挑戰、限定規則賽與活動關卡。目前先保留成獨立模式入口。</div>
          <div class="special-event-meta">
            <div class="special-event-tag">COMING SOON</div>
            <div class="opp-str" style="font-size:18px;color:#d4a017">EVENT</div>
          </div>
        </div>`;
    }else{
      detail.innerHTML='<div class="match-detail-empty">選擇上方一種模式，查看比賽詳情。</div>';
    }
  }
  // 年份 tabs
  if(selEraIdx>=PLAYABLE_WBC_ERAS.length)selEraIdx=0;
  const etabs=document.getElementById('era-tabs');if(etabs){etabs.innerHTML='';
  PLAYABLE_WBC_ERAS.forEach((era,i)=>{
    const btn=document.createElement('button');
    btn.className='era-tab'+(i===selEraIdx?' active':'');
    btn.innerHTML=`<div class="era-year">${era.year}</div><div class="era-champ-mini">${era.champion}</div><div class="era-copy">${era.desc}</div>`;
    btn.onclick=()=>{selEraIdx=i;renderMatchSetup();};
    etabs.appendChild(btn);
  });}
  // 本屆資訊
  const curEra=PLAYABLE_WBC_ERAS[selEraIdx];
  const champTeam=curEra?.teams.find(t=>t.champion);
  const ehdr=document.getElementById('era-header');
  if(ehdr&&curEra)ehdr.innerHTML=`<div class="era-header"><div class="era-champ-flag">${champTeam?champTeam.flag:'🏆'}</div><div class="era-info"><div class="era-title">${curEra.label}</div><div class="era-desc">${curEra.desc}</div>${champTeam&&champTeam.mvp?`<div class="era-mvp">🏅 當屆 MVP：${champTeam.mvp}</div>`:''}</div></div>`;
  const stageNote=document.getElementById('match-stage-note');
  if(stageNote&&curEra)stageNote.textContent=`${curEra.year} 年代表強隊，逐一挑戰並建立你的征服紀錄`;
  // 對手列表
  const ol=document.getElementById('opp-list');
  if(ol&&curEra){
    ol.innerHTML='';
    const myStr=myPreview.overall||75;
    const myNatFlag=n?n.flag:'';
    curEra.teams.forEach(opp=>{
      if(myNatFlag&&opp.flag===myNatFlag)return;
      const oppPreview=getOpponentMatchPreviewRatings(opp);
      const diff=myStr-oppPreview.overall;const dc=diff>=0?'#4adb6a':'#f06070';
      const diffTxt=diff>0?`+${diff}`:diff===0?'±0':`${diff}`;
      const oppRoster=oppPreview.roster;
      const rosterKey=getMatchRosterKey(opp);
      const expanded=expandedMatchRosterKey===rosterKey;
      const starterPreview=oppRoster.starters.slice(0,4).map(player=>cleanName(player.name)).join(' · ');
      const row=document.createElement('div');row.className='opp-row';
      const champBadge=opp.champion?'<span class="champ-tag">🏆 冠軍</span>':'';
      const keyPlayers=oppRoster.starters.slice(0,2).map(player=>cleanName(player.name)).join(' · ');
      row.innerHTML=`<div class="opp-flag">${opp.flag}</div><div class="opp-inf"><div style="display:flex;align-items:center;gap:5px"><div class="opp-nm">${opp.name}</div>${champBadge}</div><div class="opp-sb">${opp.desc}</div><div class="opp-sb" style="margin-top:4px">${keyPlayers}</div><div class="opp-roster-box"><div class="opp-roster-line"><span class="opp-roster-tag">先發</span><span class="opp-roster-copy">${starterPreview||'依年度名單自動組成'}</span></div><div class="opp-roster-meta">打線 ${oppPreview.batOvr} · 先發 ${oppPreview.pitOvr} · 替補 ${oppRoster.bench.length} 人 · 牛棚 ${oppRoster.bullpen.length} 人</div><button class="opp-roster-toggle" type="button">${expanded?'收起名單':'看完整名單'}</button>${expanded?`<div class="opp-roster-detail"><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發 9 人</div><div class="opp-roster-list">${oppRoster.starters.map(player=>`<span>${cleanName(player.name)}</span>`).join('')}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">替補</div><div class="opp-roster-list">${oppRoster.bench.length?oppRoster.bench.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發輪值</div><div class="opp-roster-list">${oppRoster.rotation.length?oppRoster.rotation.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">牛棚</div><div class="opp-roster-list">${oppRoster.bullpen.length?oppRoster.bullpen.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div></div>`:''}</div></div><div style="text-align:right;flex-shrink:0"><div class="opp-str" style="color:${dc}">${oppPreview.overall}</div><div style="font-size:9px;color:${dc}">戰力差 ${diffTxt}</div></div><div class="opp-arr">›</div>`;
      row.querySelector('.opp-roster-toggle')?.addEventListener('click',e=>{
        e.stopPropagation();
        toggleMatchRoster(rosterKey);
      });
      row.onclick=()=>startGame({...opp});
      ol.appendChild(row);
    });
  }

  const dg=document.getElementById('dynasty-grid');
  if(dg){
    dg.innerHTML='';
    const dynastyTeams=PLAYABLE_WBC_ERAS.map(era=>{
      const champ=era.teams.find(t=>t.champion);
      const top=champ||[...era.teams].sort((a,b)=>b.str-a.str)[0];
      return top?{...top,_eraLabel:era.label,_eraYear:era.year}:null;
    }).filter(Boolean).slice().sort((a,b)=>b.str-a.str||b._eraYear-a._eraYear).slice(0,6);
    dynastyTeams.forEach(opp=>{
      const key=getDynastyKey(opp);
      const cleared=clearedDynasties.includes(key);
      const oppPreview=getOpponentMatchPreviewRatings(opp);
      const oppRoster=oppPreview.roster;
      const rosterKey=getMatchRosterKey({...opp,_challengeType:'dynasty'});
      const expanded=expandedMatchRosterKey===rosterKey;
      const starterPreview=oppRoster.starters.slice(0,3).map(player=>cleanName(player.name)).join(' · ');
      const card=document.createElement('button');
      card.type='button';
      card.className='dynasty-card'+(cleared?' cleared':'');
      card.innerHTML=`
        ${cleared?'<div class="dynasty-medal" aria-hidden="true"><div class="dynasty-medal-core">🏆</div></div>':''}
        <div class="dynasty-status ${cleared?'cleared':'pending'}">${cleared?'已擊敗':'未擊敗'}</div>
        <div class="dynasty-kicker">DYNASTY CHALLENGE</div>
        <div class="dynasty-head">
          <div>
            <div class="dynasty-year">${opp._eraYear}</div>
            <div class="dynasty-name">${opp.name}</div>
          </div>
          <div class="dynasty-flag">${opp.flag}</div>
        </div>
        <div class="dynasty-copy">${opp.desc}${starterPreview?`<br>${oppRoster.starters.slice(0,2).map(player=>cleanName(player.name)).join(' · ')}`:''}</div>
        <div class="opp-roster-box dynasty-roster-box">
          <div class="opp-roster-line"><span class="opp-roster-tag">先發</span><span class="opp-roster-copy">${starterPreview||'依年度名單自動組成'}</span></div>
          <div class="opp-roster-meta">打線 ${oppPreview.batOvr} · 先發 ${oppPreview.pitOvr} · 替補 ${oppRoster.bench.length} 人 · 牛棚 ${oppRoster.bullpen.length} 人</div>
          <button class="opp-roster-toggle dynasty" type="button">${expanded?'收起名單':'看完整名單'}</button>
          ${expanded?`<div class="opp-roster-detail"><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發 9 人</div><div class="opp-roster-list">${oppRoster.starters.map(player=>`<span>${cleanName(player.name)}</span>`).join('')}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">替補</div><div class="opp-roster-list">${oppRoster.bench.length?oppRoster.bench.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發輪值</div><div class="opp-roster-list">${oppRoster.rotation.length?oppRoster.rotation.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">牛棚</div><div class="opp-roster-list">${oppRoster.bullpen.length?oppRoster.bullpen.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div></div>`:''}
        </div>
        <div class="dynasty-meta">
          <div class="dynasty-str">OVR ${oppPreview.overall}</div>
          <div class="dynasty-tag ${cleared?'done':''}">${cleared?'首通完成':'首通獎勵 150💎'}</div>
        </div>
      `;
      card.querySelector('.opp-roster-toggle')?.addEventListener('click',e=>{
        e.stopPropagation();
        toggleMatchRoster(rosterKey);
      });
      card.onclick=()=>startGame({...opp,_challengeType:'dynasty',_dynastyKey:key});
      dg.appendChild(card);
    });
  }
}
function startGame(opp){
  const n=getNationConfig(myNation);const myFlag=n?n.flag:'🇹🇼';
  document.getElementById('gs-my-flag').textContent=myFlag;
  document.getElementById('gs-opp-flag').textContent=opp.flag;
  document.getElementById('gs-opp-nm').textContent=opp.name;
  ['gs-s1','gs-s2'].forEach(id=>document.getElementById(id).textContent='0');
  document.getElementById('gs-inn').textContent='第 1 局上';
  document.getElementById('gs-log').innerHTML='';
  document.getElementById('gb-next').disabled=false;
  document.getElementById('gb-auto').disabled=false;
  document.getElementById('game-result').classList.remove('show');
  const grBox=document.getElementById('gr-box');if(grBox)grBox.innerHTML='';
  const{batBonus,pitBonus}=getCoachBonus();

  // ── 關鍵修正：打線和投手分開計算 ──
  const myBatSlots=battingOrder.map(lineupIdx=>lineup[lineupIdx]?{player:lineup[lineupIdx],idx:lineupIdx}:null).filter(Boolean);
  const myPitArr=[...rotation.filter(Boolean),...getActiveBullpen().filter(Boolean)];
  // 打線 OVR（只算野手）
  const myBatOvr=myBatSlots.length>0
    ?Math.round(myBatSlots.reduce((s,slot)=>s+getEffectiveOvr(slot.player,'lineup',slot.idx),0)/myBatSlots.length)+Math.round(batBonus/10)
    :72;
  // 本場先發投手 OVR
  const myPitOvr=rotation[0]
    ?(getEffectiveOvr(rotation[0],'rotation',0)||72)+Math.round(pitBonus/10)
    :72;

  const myBatters=myBatSlots.length>0
    ?myBatSlots.map((slot,orderIdx)=>buildBatterProfile({
      name:slot.player.name,
      pos:slot.player.pos,
      ovr:getEffectiveOvr(slot.player,'lineup',slot.idx),
      player:slot.player,
      slotIndex:orderIdx,
    }))
    :[buildBatterProfile({name:'打者A',pos:'OF',ovr:72,slotIndex:0})];
  const myBenchProfiles=getActiveBench()
    .filter(Boolean)
    .map((player,i)=>buildBatterProfile({
      name:player.name,
      pos:player.pos,
      ovr:player.ovr,
      player,
      slotIndex:9+i,
    }));
  const mySP=rotation.map((p,i)=>p?buildPitcherProfile({name:p.name,ovr:getEffectiveOvr(p,'rotation',i)||75,type:'SP',player:p}):null).filter(Boolean);
  const myRP=getActiveBullpen().map((p,i)=>p?buildPitcherProfile({name:p.name,ovr:getEffectiveOvr(p,'bullpen',i),type:hasPos(p,'CP')?'CP':'RP',player:p}):null).filter(Boolean);
  const myPitchers=[
    ...(mySP[0]?[mySP[0]]:[]),
    ...myRP,
    ...mySP.slice(1).map(p=>({...p,type:'LR'})),
  ];
  if(myPitchers.length===0)myPitchers.push(buildPitcherProfile({name:'先發投手',ovr:myPitOvr,type:'SP'}));

  const oppRoster=buildOpponentTeamFromYear(opp);
  const oppBatBase=oppRoster.starters.length
    ?Math.round(oppRoster.starters.reduce((sum,player)=>sum+player.ovr,0)/oppRoster.starters.length)
    :opp.str;
  const oppPitPool=[...oppRoster.rotation,...oppRoster.bullpen];
  const oppPitBase=oppPitPool.length
    ?Math.round(oppPitPool.reduce((sum,player)=>sum+player.ovr,0)/oppPitPool.length)
    :opp.str;
  const oppBatOvr=clampRating(oppBatBase*.82+opp.str*.18);
  const oppPitOvr=clampRating(oppPitBase*.82+opp.str*.18);
  const oppBatters=oppRoster.starters.length
    ?oppRoster.starters.map((player,i)=>buildBatterProfile({
      name:player.name,
      pos:player.pos||'',
      ovr:clampRating(player.ovr*.72+oppBatOvr*.28),
      player,
      slotIndex:i,
    }))
    :Array.from({length:9},(_,i)=>buildBatterProfile({name:`${opp.name} ${i+1}番`,pos:'',ovr:oppBatOvr,slotIndex:i}));
  const oppBenchProfiles=oppRoster.bench.map((player,i)=>buildBatterProfile({
    name:player.name,
    pos:player.pos||'',
    ovr:clampRating(player.ovr*.72+oppBatOvr*.28),
    player,
    slotIndex:9+i,
  }));
  while(oppBatters.length<9)oppBatters.push(buildBatterProfile({name:`${opp.name} ${oppBatters.length+1}番`,pos:'',ovr:oppBatOvr,slotIndex:oppBatters.length}));

  const oppPitchers=[...oppRoster.rotation,...oppRoster.bullpen].length
    ?[
      ...(oppRoster.rotation[0]?[oppRoster.rotation[0]]:[]),
      ...oppRoster.bullpen,
      ...oppRoster.rotation.slice(1),
    ].map((player,i)=>buildPitcherProfile({
      name:player.name,
      ovr:clampRating(player.ovr*.72+oppPitOvr*.28-(i===1?1:0)+(i===2?-1:0)),
      type:i===0?'SP':hasPos(player,'CP')?'CP':(hasPos(player,'RP')?'RP':'LR'),
      player,
    }))
    :[
      buildPitcherProfile({name:opp.name+' 先發',ovr:oppPitOvr,type:'SP'}),
      buildPitcherProfile({name:opp.name+' 中繼',ovr:Math.round(oppPitOvr*0.97),type:'RP'}),
      buildPitcherProfile({name:opp.name+' 終結',ovr:Math.round(oppPitOvr*0.98),type:'CP'}),
    ];

  const displayMyPitOvr=myPitchers[0]?.ovr??myPitOvr;
  const displayOppPitOvr=oppPitchers[0]?.ovr??oppPitOvr;

  gs={inning:1,half:'top',outs:0,bases:[null,null,null],scores:[0,0],done:false,opp,
    myStr:Math.min(99,myBatOvr),       // 我方打線
    myPitStr:Math.min(99,displayMyPitOvr),    // 我方本場先發（顯示用）
    oppBatOvr,
    oppPitOvr:Math.min(99,displayOppPitOvr),  // 對手本場先發（顯示用）
    myBatters,myBatterIdx:0,
    oppBatters,oppBatterIdx:0,
    myBench:myBenchProfiles,
    oppBench:oppBenchProfiles,
    oppRotation:oppRoster.rotation,
    oppBullpen:oppRoster.bullpen,
    myPitchers,myPitIdx:0,
    oppPitchers,oppPitIdx:0,
    stats:{myH:0,myHR:0,myK:0,myBB:0,oppH:0,oppHR:0,oppK:0,oppBB:0}};
  document.getElementById('gs-title').textContent='vs '+opp.name;
  document.getElementById('game-screen').classList.add('show');
  // 開場日誌顯示實際 OVR 對比
  addGameLog(`⚾ 比賽開始！我方打線${myBatOvr} / 先發投手${displayMyPitOvr}  vs  對手打線${oppBatOvr} / 先發投手${displayOppPitOvr}`,'sys');
  updateGameUI();
}
function getCurPitcher(isTop){return isTop?(gs.oppPitchers[gs.oppPitIdx]||gs.oppPitchers[0]):(gs.myPitchers[gs.myPitIdx]||gs.myPitchers[0]);}
function getCurBatter(isTop){if(isTop){if(!gs.myBatters.length)return null;return gs.myBatters[gs.myBatterIdx%gs.myBatters.length];}else{if(!gs.oppBatters.length)return null;return gs.oppBatters[gs.oppBatterIdx%gs.oppBatters.length];}}
function clampRating(val,min=40,max=99){
  return Math.max(min,Math.min(max,Math.round(val)));
}
function getOpponentYearPool(opp){
  const exact=ALL_PLAYERS.filter(player=>player.nat===opp.flag&&player.year===opp.era);
  if(exact.length)return exact;
  const sameNation=ALL_PLAYERS
    .filter(player=>player.nat===opp.flag)
    .sort((a,b)=>
      Math.abs((a.year??opp.era)-opp.era)-Math.abs((b.year??opp.era)-opp.era)||
      b.ovr-a.ovr
    );
  const fallbackYear=sameNation[0]?.year;
  return fallbackYear==null?sameNation:sameNation.filter(player=>player.year===fallbackYear);
}
function buildBatterProfile({name,pos='',ovr=72,player=null,slotIndex=0}){
  if(player){
    const contact=getAbilityValue(player,0)||ovr;
    const power=getAbilityValue(player,1)||ovr;
    const eye=getAbilityValue(player,2)||ovr;
    const speed=getAbilityValue(player,3)||ovr;
    const mental=getAbilityValue(player,5)||ovr;
    return {
      name,pos,ovr,
      contact,power,eye,speed,mental,
      atBatOvr:clampRating(ovr*.58+contact*.2+power*.08+eye*.08+mental*.06),
      ab:0,h:0,hr:0,rbi:0
    };
  }
  const slotMods=[
    {contact:4,power:2,eye:4,speed:3,mental:2},
    {contact:3,power:1,eye:2,speed:4,mental:1},
    {contact:5,power:5,eye:2,speed:0,mental:3},
    {contact:2,power:7,eye:1,speed:-1,mental:3},
    {contact:1,power:4,eye:0,speed:-1,mental:1},
    {contact:0,power:1,eye:0,speed:0,mental:0},
    {contact:-1,power:0,eye:-1,speed:1,mental:0},
    {contact:-2,power:-1,eye:-1,speed:1,mental:-1},
    {contact:-3,power:-2,eye:-2,speed:0,mental:-1},
  ][slotIndex]||{contact:0,power:0,eye:0,speed:0,mental:0};
  const contact=clampRating(ovr+slotMods.contact);
  const power=clampRating(ovr+slotMods.power);
  const eye=clampRating(ovr+slotMods.eye);
  const speed=clampRating(ovr+slotMods.speed);
  const mental=clampRating(ovr+slotMods.mental);
  return {
    name,pos,ovr,
    contact,power,eye,speed,mental,
    atBatOvr:clampRating(ovr*.64+contact*.16+power*.08+eye*.07+mental*.05),
    ab:0,h:0,hr:0,rbi:0
  };
}
function buildPitcherProfile({name,ovr=75,type='SP',player=null}){
  const stuff=player?(getAbilityValue(player,0)||ovr):clampRating(ovr+3);
  const control=player?(getAbilityValue(player,1)||ovr):clampRating(ovr);
  const breakBall=player?(getAbilityValue(player,2)||ovr):clampRating(ovr+1);
  const mental=player?(getAbilityValue(player,4)||ovr):clampRating(ovr);
  return {
    name,ovr,stamina:100,type,
    stuff,control,breakBall,mental
  };
}
function buildOpponentTeamFromYear(opp){
  const pool=getOpponentYearPool(opp);
  const batters=pool
    .filter(player=>!isPitcherPlayer(player))
    .sort((a,b)=>b.ovr-a.ovr||cleanName(a.name).localeCompare(cleanName(b.name),'zh-Hant'));
  const pitchers=pool
    .filter(player=>isPitcherPlayer(player))
    .sort((a,b)=>b.ovr-a.ovr||cleanName(a.name).localeCompare(cleanName(b.name),'zh-Hant'));
  const starters=Array(9).fill(null);
  const bench=[];
  const usedBatters=new Set();
  const desiredStarterSlots=['C','1B','2B','3B','SS','LF','CF','RF','DH'];
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
      .filter(player=>!usedBatters.has(getPlayerKey(player)))
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
  const fillStarterSlot=(slotPos)=>{
    if(slotPos==='DH'){
      return takeBatter(player=>hasPos(player,'DH'),slotPos)
        || takeBatter(player=>['1B','LF','RF','OF'].some(pos=>hasPos(player,pos)),slotPos)
        || takeBatter(()=>true,slotPos);
    }
    if(['LF','CF','RF'].includes(slotPos)){
      return takeBatter(player=>hasPos(player,slotPos),slotPos)
        || takeBatter(player=>hasPos(player,'OF'),slotPos)
        || takeBatter(player=>['LF','CF','RF'].some(pos=>hasPos(player,pos)),slotPos)
        || takeBatter(()=>true,slotPos);
    }
    return takeBatter(player=>hasPos(player,slotPos),slotPos)
      || takeBatter(()=>true,slotPos);
  };
  desiredStarterSlots.forEach((slotPos,i)=>{starters[i]=fillStarterSlot(slotPos);});
  batters
    .filter(player=>!usedBatters.has(getPlayerKey(player)))
    .forEach(player=>bench.push(player));

  const rotation=[];
  const bullpen=[];
  const cps=pitchers.filter(player=>hasPos(player,'CP'));
  const rps=pitchers.filter(player=>hasPos(player,'RP'));
  const sps=pitchers.filter(player=>hasPos(player,'SP')||(!hasPos(player,'RP')&&!hasPos(player,'CP')&&player.pit));
  const otherPitchers=pitchers.filter(player=>!hasPos(player,'SP')&&!hasPos(player,'RP')&&!hasPos(player,'CP'));
  const usedPitchers=new Set();
  const addPitcher=(list,player)=>{
    if(!player)return false;
    const key=getPlayerKey(player);
    if(usedPitchers.has(key))return false;
    usedPitchers.add(key);
    list.push(player);
    return true;
  };
  sps.forEach(player=>{ if(rotation.length<5)addPitcher(rotation,player); });
  otherPitchers.forEach(player=>{ if(rotation.length<5)addPitcher(rotation,player); });
  cps.forEach(player=>{ if(bullpen.length<9)addPitcher(bullpen,player); });
  rps.forEach(player=>{ if(bullpen.length<9)addPitcher(bullpen,player); });
  otherPitchers.forEach(player=>{ if(bullpen.length<9)addPitcher(bullpen,player); });
  sps.forEach(player=>{ if(bullpen.length<9)addPitcher(bullpen,player); });
  pitchers.forEach(player=>{
    if(rotation.length<5)addPitcher(rotation,player);
    else if(bullpen.length<9)addPitcher(bullpen,player);
  });
  return {
    starters:starters.filter(Boolean),
    bench,
    rotation,
    bullpen,
    batters,
    pitchers,
  };
}
function updateGameUI(){
  const isTop=gs.half==='top';
  const pitcher=getCurPitcher(isTop);
  const batter=getCurBatter(isTop);
  // 壘包（3個）
  [['base1',0],['base2',1],['base3',2]].forEach(([id,i])=>{
    const el=document.getElementById(id);
    if(el){el.style.background=gs.bases[i]?'#f0c030':'#1a4a2a';el.style.boxShadow=gs.bases[i]?'0 0 6px rgba(240,192,48,.5)':'';}
  });
  // 出局數（3個燈）
  [['out1',0],['out2',1],['out3',2]].forEach(([id,i])=>{
    const el=document.getElementById(id);
    if(el){el.style.background=i<gs.outs?'#f06070':'#1a4a2a';el.style.boxShadow=i<gs.outs?'0 0 5px rgba(240,96,112,.5)':'';}
  });
  // 投手
  const pNm=document.getElementById('gs-pitcher-name');if(pNm)pNm.textContent=pitcher.name;
  const stam=Math.max(0,Math.round(pitcher.stamina));
  const pct=document.getElementById('gs-stamina-pct');if(pct)pct.textContent=stam+'%';
  const bar=document.getElementById('gs-stamina-bar');
  if(bar){bar.style.width=stam+'%';bar.style.background=stam>60?'#4adb6a':stam>30?'#f0c030':'#f06070';}
  // 打者
  const bNm=document.getElementById('gs-batter-name');if(bNm)bNm.textContent=batter.name;
  const bSt=document.getElementById('gs-batter-stat');if(bSt)bSt.textContent=batter.ab+'打 '+batter.h+'安 '+batter.hr+'轟';
  // 比分列：顯示當前球員
  const myNow=document.getElementById('gs-my-now');
  const oppNow=document.getElementById('gs-opp-now');
  if(isTop){
    // 我方進攻（我方打者在打）
    if(myNow)myNow.textContent='🏏 '+batter.name;
    if(oppNow)oppNow.textContent='⚾ '+pitcher.name;
  } else {
    // 對方進攻（我方投手在投）
    if(myNow)myNow.textContent='⚾ '+pitcher.name;
    if(oppNow)oppNow.textContent='🏏 '+batter.name;
  }
  updateFormula();
}
function calcMatchSig(){
  const isTop=gs.half==='top';
  const pitcher=getCurPitcher(isTop);
  const batter=getCurBatter(isTop);
  const batOvr=batter?.atBatOvr??(isTop?gs.myStr:gs.oppBatOvr);
  const pitOvr=pitcher.ovr;
  const contactEdge=((batter?.contact??batOvr)-(pitcher?.stuff??pitOvr))*0.12;
  const disciplineEdge=((batter?.eye??batOvr)-(pitcher?.control??pitOvr))*0.1;
  const mentalEdge=((batter?.mental??batOvr)-(pitcher?.mental??pitOvr))*0.05;
  const staminaBonus=(100-pitcher.stamina)*0.22;
  const rawDiff=(batOvr-pitOvr+contactEdge+disciplineEdge+mentalEdge+staminaBonus)/100;
  const sig=1/(1+Math.exp(-rawDiff*2.5));
  return {sig,batOvr,pitOvr,pitcher,batter};
}
function updateFormula(){
  const {sig,batOvr,pitOvr,batter}=calcMatchSig();
  const hitRate=Math.round(sig*30+6+((batter?.contact??70)-70)*0.06);
  const hrRate=Math.max(1,Math.round(sig*6+((batter?.power??70)-70)*0.035));
  const kRate=Math.max(10,Math.round((1-sig)*34+10-((batter?.eye??70)-70)*0.04));
  const f=document.getElementById('gs-formula');if(!f)return;
  const diff=batOvr-pitOvr;
  const adv=diff>0?`<span style="color:#4adb6a;font-size:9px">▲${diff}</span>`
            :diff<0?`<span style="color:#f06070;font-size:9px">▼${Math.abs(diff)}</span>`
            :`<span style="color:#d4a017;font-size:9px">均衡</span>`;
  f.innerHTML=`<div class="gf-i"><div class="gf-l">投手OVR</div><div class="gf-v" style="color:#e05060">${pitOvr}</div></div><div class="gf-s">vs</div><div class="gf-i"><div class="gf-l">打者OVR</div><div class="gf-v" style="color:#d4a017">${batOvr}</div></div><div class="gf-s">${adv}</div><div class="gf-i"><div class="gf-l">安打率</div><div class="gf-v" style="color:#6adb6a">${hitRate}%</div></div><div class="gf-s">|</div><div class="gf-i"><div class="gf-l">HR率</div><div class="gf-v" style="color:#f0c030">${hrRate}%</div></div><div class="gf-s">|</div><div class="gf-i"><div class="gf-l">三振率</div><div class="gf-v" style="color:#cc88ff">${kRate}%</div></div>`;
}
function getOffenseBench(isTop){
  return isTop?gs.myBench:gs.oppBench;
}
function getOffenseBatters(isTop){
  return isTop?gs.myBatters:gs.oppBatters;
}
function getOffenseScore(isTop){
  return gs.scores[isTop?0:1];
}
function getDefenseScore(isTop){
  return gs.scores[isTop?1:0];
}
function advanceRunnersOnOut({allowSecondToThird=false,allowThirdToHome=false}={}){
  const nextBases=[null,null,null];
  let scored=0;
  if(gs.bases[2]){
    if(allowThirdToHome){
      scored++;
    }else{
      nextBases[2]=gs.bases[2];
    }
  }
  if(gs.bases[1]){
    if(!nextBases[2]&&allowSecondToThird)nextBases[2]=gs.bases[1];
    else nextBases[1]=gs.bases[1];
  }
  if(gs.bases[0]){
    nextBases[0]=gs.bases[0];
  }
  gs.bases=nextBases;
  return scored;
}
function resolveGroundOut(){
  let scored=0;
  const runnerOnFirst=gs.bases[0];
  const runnerOnSecond=gs.bases[1];
  const runnerOnThird=gs.bases[2];
  gs.outs++;
  const nextBases=[null,null,null];
  if(runnerOnThird){
    if(gs.outs<3&&runnerOnFirst&&Math.random()<0.12){
      scored++;
    }else{
      nextBases[2]=runnerOnThird;
    }
  }
  if(runnerOnSecond){
    if(gs.outs<3&&Math.random()<0.35&&!nextBases[2])nextBases[2]=runnerOnSecond;
    else nextBases[1]=runnerOnSecond;
  }
  if(runnerOnFirst){
    if(gs.outs<3&&!nextBases[1])nextBases[1]=runnerOnFirst;
    else if(gs.outs<3&&!nextBases[2])nextBases[2]=runnerOnFirst;
  }
  gs.bases=nextBases;
  return {scored};
}
function resolveDoublePlay(){
  const runnerOnFirst=gs.bases[0];
  if(!runnerOnFirst||gs.outs>=2){
    const result=resolveGroundOut();
    return {scored:result.scored};
  }
  const nextBases=[null,null,null];
  let scored=0;
  if(gs.bases[2]){
    if(gs.bases[1]&&Math.random()<0.18){
      scored++;
    }else{
      nextBases[2]=gs.bases[2];
    }
  }
  if(gs.bases[1]){
    nextBases[2]=gs.bases[1];
  }
  gs.outs+=2;
  gs.bases=nextBases;
  return {scored};
}
function resolveSacrificeBunt(){
  gs.outs++;
  let scored=0;
  const nextBases=[null,null,null];
  const buntScores=!!gs.bases[2]&&Math.random()<0.18;
  if(buntScores){
    scored++;
  }else if(gs.bases[2]){
    nextBases[2]=gs.bases[2];
  }
  if(gs.bases[1]){
    if(!nextBases[2])nextBases[2]=gs.bases[1];
    else nextBases[1]=gs.bases[1];
  }
  if(gs.bases[0]){
    if(!nextBases[1])nextBases[1]=gs.bases[0];
    else if(!nextBases[2])nextBases[2]=gs.bases[0];
    else nextBases[0]=gs.bases[0];
  }
  gs.bases=nextBases;
  return {scored};
}
function maybePinchHit(isTop){
  if(gs.inning<8)return null;
  const bench=getOffenseBench(isTop);
  if(!bench?.length)return null;
  const batters=getOffenseBatters(isTop);
  const idx=isTop?(gs.myBatterIdx%batters.length):(gs.oppBatterIdx%batters.length);
  const current=batters[idx];
  if(!current)return null;
  const scoreDiff=getOffenseScore(isTop)-getDefenseScore(isTop);
  const lateCloseGame=Math.abs(scoreDiff)<=2;
  const tyingOrGoAheadChance=(scoreDiff<=0)&&!!(gs.bases[1]||gs.bases[2]);
  const lastCall=gs.inning>=9&&scoreDiff<0;
  if(!lateCloseGame)return null;
  if(!tyingOrGoAheadChance&&!lastCall)return null;
  if(gs.outs===2&&!gs.bases[0]&&!gs.bases[1]&&!gs.bases[2])return null;
  const candidate=bench
    .filter(player=>player.atBatOvr>current.atBatOvr+5)
    .sort((a,b)=>
      (b.atBatOvr-a.atBatOvr)||
      (b.power+b.contact)-(a.power+a.contact)
    )[0];
  if(!candidate)return null;
  bench.splice(bench.indexOf(candidate),1);
  batters[idx]={...candidate,ab:current.ab,h:current.h,hr:current.hr,rbi:current.rbi,_pinchHit:true};
  addGameLog(`🔁 ${isTop?'我方':'對方'}代打：${candidate.name} 上場`, 'sys');
  return batters[idx];
}
function attemptSteal(isTop){
  if(gs.outs>=2)return false;
  const runnerOnFirst=gs.bases[0];
  const runnerOnSecond=gs.bases[1];
  const tryRunner=runnerOnSecond&&!gs.bases[2]
    ?{runner:runnerOnSecond,from:1,to:2}
    :(runnerOnFirst&&!gs.bases[1]?{runner:runnerOnFirst,from:0,to:1}:null);
  if(!tryRunner?.runner)return false;
  const speed=tryRunner.runner.speed??70;
  const closeGame=Math.abs(getOffenseScore(isTop)-getDefenseScore(isTop))<=2;
  const pressureBonus=closeGame?0.01:0;
  const stealChance=Math.max(0.01,Math.min(0.16,0.025+(speed-70)*0.0022+pressureBonus));
  if(Math.random()>=stealChance)return false;
  const successRate=Math.max(0.52,Math.min(0.86,0.62+(speed-70)*0.0045));
  if(Math.random()<successRate){
    gs.bases[tryRunner.to]=tryRunner.runner;
    gs.bases[tryRunner.from]=null;
    addGameLog(`💨 ${tryRunner.runner.name} 盜壘成功！`, 'hit');
  }else{
    gs.bases[tryRunner.from]=null;
    gs.outs++;
    addGameLog(`🚫 ${tryRunner.runner.name} 盜壘失敗`, 'out');
  }
  return true;
}

function pickPlayAdvanced(){
  const {sig,batter,pitcher}=calcMatchSig();
  const powerAdj=((batter?.power??70)-(pitcher?.stuff??70))*0.0007;
  const eyeAdj=((batter?.eye??70)-(pitcher?.control??70))*0.00055;
  const speedAdj=((batter?.speed??70)-70)*0.00045;
  const contactAdj=((batter?.contact??70)-70)*0.00065;
  const mentalAdj=((batter?.mental??70)-(pitcher?.mental??70))*0.00025;
  const shW  = gs.outs<2&&!!gs.bases[0] ? Math.max(0.0015,(1-sig)*0.011+0.0012-contactAdj*0.12) : 0;
  const sfW  = gs.outs<2&&!!gs.bases[2] ? Math.max(0.004,sig*0.016+0.0025+powerAdj*0.18) : 0;
  const hrW  = Math.max(0.003, sig*0.060-0.006+powerAdj*0.9+mentalAdj);
  const h3W  = Math.max(0.002, sig*0.018-0.003+speedAdj+contactAdj*0.22);
  const h2W  = Math.max(0.016, sig*0.092+0.008+contactAdj*0.8+powerAdj*0.45+speedAdj*0.25);
  const h1W  = Math.max(0.052, sig*0.182+0.022+contactAdj+speedAdj*0.32);
  const bbW  = Math.max(0.022, sig*0.066+0.010+eyeAdj*0.95);
  const kW   = Math.max(0.075,(1-sig)*0.355+0.072-eyeAdj-contactAdj*0.28);
  const goW  = Math.max(0.052,(1-sig)*0.315+0.066-speedAdj*0.22);
  const foW  = Math.max(0.048,(1-sig)*0.270+0.050-powerAdj*0.12);
  const dpW  = gs.bases[0]&&gs.outs<2?Math.max(0.003,(1-sig)*0.038+0.0035-speedAdj*0.45):0;
  const total=shW+sfW+hrW+h3W+h2W+h1W+bbW+kW+goW+foW+dpW;
  const ws=[shW,sfW,hrW,h3W,h2W,h1W,bbW,kW,goW,foW,dpW].map(w=>w/total);
  const ts=['sh','sf','hr','h3','h2','h1','bb','k','go','fo','dp'];
  let r=Math.random(),c=0;
  for(let i=0;i<ws.length;i++){c+=ws[i];if(r<c)return ts[i];}
  return 'go';
}
function simNext(){
  if(!gs||gs.done)return;
  const isTop=gs.half==='top';
  maybePinchHit(isTop);
  if(attemptSteal(isTop)){
    if(gs.outs>=3){
      gs.outs=0;gs.bases=[null,null,null];
      if(gs.half==='top'){
        gs.half='bottom';
        if(gs.inning>=9&&gs.scores[1]>gs.scores[0]){endGame();return;}
        addGameLog(`━━ 第${gs.inning}局下半 ━━`,'sys');
      }else{
        if(gs.inning>=9&&gs.scores[0]!==gs.scores[1]){endGame();return;}
        gs.inning++;
        gs.half='top';
        addGameLog(`━━ 第${gs.inning}局上半 ━━`,'sys');
      }
      document.getElementById('gs-inn').textContent='第'+gs.inning+'局'+(gs.half==='top'?'上':'下');
    }
    updateGameUI();
    return;
  }
  const t=pickPlayAdvanced();
  const isOut=['k','go','fo','dp','sh','sf'].includes(t);
  const batter=getCurBatter(isTop);
  const pitcher=getCurPitcher(isTop);
  let scored=0;
  const countsAsAtBat=!['bb','sh','sf'].includes(t);
  if(countsAsAtBat)batter.ab++;
  pitcher.stamina=Math.max(0,pitcher.stamina-(isOut?2:5));
  const EMOJIS={sh:'🪵',sf:'🎯',hr:'💥',h3:'🔥',h2:'⚡',h1:'✅',bb:'🚶',k:'❌',go:'⬇️',fo:'🌀',dp:'💀'};
  const TXTS={sh:'犧牲短打',sf:'高飛犧牲打',hr:'全壘打！',h3:'三壘安打',h2:'二壘安打',h1:'一壘安打',bb:'四壞球',k:'三振出局',go:'地滾出局',fo:'飛球出局',dp:'雙殺打'};
  if(t==='k'){
    gs.outs++;
    if(isTop)gs.stats.oppK++;else gs.stats.myK++;
  } else if(t==='sh'){
    const result=resolveSacrificeBunt();
    scored=result.scored;
    batter.rbi+=scored;
  } else if(t==='sf'){
    gs.outs++;
    if(gs.bases[2]){
      scored++;
      gs.bases[2]=null;
    }
    if(gs.bases[1]&&Math.random()<0.35){
      gs.bases[2]=gs.bases[1];
      gs.bases[1]=null;
    }
    batter.rbi+=scored;
  } else if(t==='go'){
    const result=resolveGroundOut();
    scored=result.scored;
    batter.rbi+=scored;
  } else if(t==='fo'){
    gs.outs++;
    scored=advanceRunnersOnOut({allowSecondToThird:Math.random()<0.28});
    batter.rbi+=scored;
  } else if(t==='dp'){
    const result=resolveDoublePlay();
    scored=result.scored;
    batter.rbi+=scored;
  } else if(t==='bb'){
    if(isTop)gs.stats.myBB++;else gs.stats.oppBB++;
    if(gs.bases[0]&&gs.bases[1]&&gs.bases[2])scored=1;
    if(gs.bases[1]&&gs.bases[0])gs.bases[2]=gs.bases[1];
    if(gs.bases[0])gs.bases[1]=gs.bases[0];
    gs.bases[0]={...batter};
    batter.rbi+=scored;
  } else {
    batter.h++;
    if(isTop)gs.stats.myH++;else gs.stats.oppH++;
    const adv=t==='hr'?4:t==='h3'?3:t==='h2'?2:1;
    for(let i=2;i>=0;i--)if(gs.bases[i]&&i+adv>=3)scored++;
    if(t==='hr'){scored++;gs.bases=[null,null,null];batter.hr++;if(isTop)gs.stats.myHR++;else gs.stats.oppHR++;}
    else{
      const nb=[null,null,null];
      nb[adv-1]={...batter};
      for(let i=2;i>=0;i--)if(gs.bases[i]&&i+adv<3)nb[i+adv]=gs.bases[i];
      gs.bases=nb;
    }
    batter.rbi+=scored;
  }
  gs.scores[isTop?0:1]+=scored;
  let logTxt=`${EMOJIS[t]} ${batter.name} ${TXTS[t]}`;
  if(scored>0)logTxt+=`・${scored}分得分！`;
  addGameLog(logTxt,t==='hr'?'hr':isOut?'out':'hit');
  document.getElementById('gs-s1').textContent=gs.scores[0];
  document.getElementById('gs-s2').textContent=gs.scores[1];
  if(!isTop&&gs.inning>=9&&gs.scores[1]>gs.scores[0]){
    endGame();
    return;
  }
  if(isTop)gs.myBatterIdx++;else gs.oppBatterIdx++;
  // 換投
  const pit=getCurPitcher(!isTop);
  const pitArr=isTop?gs.oppPitchers:gs.myPitchers;
  const pitIdxKey=isTop?'oppPitIdx':'myPitIdx';
  if(pit.stamina<=15||(pit.type==='SP'&&gs.inning>=7&&pit.stamina<35)||(pit.type==='SP'&&gs.inning>=9)){
    if(gs[pitIdxKey]<pitArr.length-1){
      gs[pitIdxKey]++;
      const next=pitArr[gs[pitIdxKey]];
      addGameLog(`🔄 ${isTop?'對方':'我方'}換投：${next.name}（${next.type}）`,'sys');
    }
  }
  if(gs.outs>=3){
    gs.outs=0;gs.bases=[null,null,null];
    if(gs.half==='top'){
      gs.half='bottom';
      if(gs.inning>=9&&gs.scores[1]>gs.scores[0]){endGame();return;}
      addGameLog(`━━ 第${gs.inning}局下半 ━━`,'sys');
    }
    else{
      if(gs.inning>=9&&gs.scores[0]!==gs.scores[1]){endGame();return;}
      gs.inning++;
      gs.half='top';
      addGameLog(`━━ 第${gs.inning}局上半 ━━`,'sys');
    }
  }
  document.getElementById('gs-inn').textContent='第'+gs.inning+'局'+(gs.half==='top'?'上':'下');
  updateGameUI();
}
function addGameLog(txt,cls){const log=document.getElementById('gs-log');const el=document.createElement('div');el.className='gl-e gl-'+cls;el.textContent=txt;log.appendChild(el);log.scrollTop=log.scrollHeight;}
function simAuto(){if(simTimer)return;document.getElementById('gb-next').disabled=true;document.getElementById('gb-auto').disabled=true;simTimer=setInterval(()=>{simNext();if(gs&&gs.done){clearInterval(simTimer);simTimer=null;}},60);}
function endGame(){
  if(simTimer){clearInterval(simTimer);simTimer=null;}
  gs.done=true;
  document.getElementById('gb-next').disabled=true;
  document.getElementById('gb-auto').disabled=true;
  const s1=gs.scores[0],s2=gs.scores[1];const win=s1>s2;
  // 計算比賽獎勵
  const winReward=win?100:0;
  const shutoutBonus=(win&&s2===0)?50:0;
  const hrReward=gs.stats.myHR*10;
  const dynastyKey=gs.opp&&gs.opp._challengeType==='dynasty'?gs.opp._dynastyKey:null;
  const dynastyFirstClear=!!(win&&dynastyKey&&!clearedDynasties.includes(dynastyKey));
  const dynastyReward=dynastyFirstClear?150:0;
  if(dynastyFirstClear)clearedDynasties=[...clearedDynasties,dynastyKey];
  const totalReward=winReward+shutoutBonus+hrReward+dynastyReward;
  document.getElementById('gr-banner').textContent=win?'🏆 勝利！':'敗北';
  document.getElementById('gr-banner').className='gr-banner '+(win?'win':'loss');
  document.getElementById('gr-score').textContent=s1+' : '+s2;
  const{batBonus}=getCoachBonus();
  document.getElementById('gr-stats').innerHTML=`<div class="gr-row"><span>對手</span><span class="gr-val">${gs.opp.name}</span></div><div class="gr-row"><span>比分</span><span class="gr-val">${s1} : ${s2}</span></div><div class="gr-row"><span>安打</span><span class="gr-val">${gs.stats.myH} : ${gs.stats.oppH}</span></div><div class="gr-row"><span>全壘打</span><span class="gr-val">${gs.stats.myHR} : ${gs.stats.oppHR}</span></div><div class="gr-row"><span>奪三振</span><span class="gr-val">${gs.stats.myK} : ${gs.stats.oppK}</span></div><div class="gr-row"><span>保送</span><span class="gr-val">${gs.stats.myBB} : ${gs.stats.oppBB}</span></div>${batBonus>0?'<div class="gr-row"><span>教練加成</span><span class="gr-val" style="color:#d4a017">+'+batBonus+'</span></div>':''}${dynastyFirstClear?'<div class="gr-row"><span>王朝首通</span><span class="gr-val" style="color:#7ce28c">+150 💎</span></div>':''}${totalReward>0?`<div class="gr-row"><span>比賽獎勵</span><span class="gr-val" style="color:#f0c030">+${totalReward} 💎</span></div>`:''}`;
  const box=document.getElementById('gr-box');
  if(box&&gs.myBatters){
    const rows=gs.myBatters.filter(b=>b.ab>0).map(b=>{
      const avg=b.ab>0?(b.h/b.ab).toFixed(3).replace('0.','.'):'.000';
      return '<div style="display:flex;gap:6px;font-size:9px;padding:3px 0;border-bottom:.5px solid #1a4a2a;align-items:center"><span style="flex:1;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+b.name+'</span><span style="color:rgba(255,255,255,.5);width:20px;text-align:right">'+b.ab+'</span><span style="color:#4adb6a;width:18px;text-align:right">'+b.h+'</span><span style="color:#f0c030;width:18px;text-align:right">'+b.hr+'</span><span style="color:#cc88ff;width:18px;text-align:right">'+b.rbi+'</span><span style="color:rgba(255,255,255,.4);width:30px;text-align:right">'+avg+'</span></div>';
    }).join('');
    box.innerHTML='<div style="display:flex;gap:6px;font-size:8px;padding:2px 0 4px;border-bottom:.5px solid #2a6a3a;color:rgba(74,219,106,.7)"><span style="flex:1">打者</span><span style="width:20px;text-align:right">打</span><span style="width:18px;text-align:right">安</span><span style="width:18px;text-align:right">轟</span><span style="width:18px;text-align:right">點</span><span style="width:30px;text-align:right">打率</span></div>'+rows;
  }
  // 發放獎勵
  if(totalReward>0){gems+=totalReward;updateGemDisp();}
  // 每日任務 & 活動記錄
  dailyState.match=Math.min(1,dailyState.match+1);saveDailyState();
  addActivity(
    win?'🏆':'💔',
    win?`${gs.opp.name} ${dynastyFirstClear?'王朝首通完成':'擊敗'} (${s1}:${s2})`:`不敵 ${gs.opp.name} (${s1}:${s2})`,
    totalReward>0?`+${totalReward} 💎`:'繼續加油！'
  );
  document.getElementById('game-result').classList.add('show');
  renderMatchSetup();
  tickScouts();autoSave();
}
function closeGame(){if(simTimer){clearInterval(simTimer);simTimer=null;}document.getElementById('game-screen').classList.remove('show');}
function resetGame(){document.getElementById('game-result').classList.remove('show');document.getElementById('gr-box').innerHTML='';}
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
  matchCount=0;clearedDynasties=[];
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
  const c='rgba(255,255,255,0.18)';
  const ps=posArr(p);
  const isP=isPitcherPlayer(p);
  const isSP=ps.includes('SP')||(isP&&!ps.includes('RP')&&!ps.includes('CP'));
  const isRP=ps.includes('RP');
  const isCP=ps.includes('CP');
  const isC=ps.includes('C');
  const isOF=ps.includes('OF')||ps.includes('LF')||ps.includes('CF')||ps.includes('RF');
  const s=size;const h=Math.round(s*0.28);const hw=Math.round(s*0.16);
  const bx=Math.round(s/2);const by=Math.round(s*0.22);
  let body='';
  if(isCP||isRP){
    // 後援：側投姿勢，腿弓步
    body=`<ellipse cx="${bx}" cy="${by}" rx="${hw}" ry="${h*0.38}" fill="${c}"/>
<line x1="${bx}" y1="${by+h*0.38}" x2="${bx}" y2="${Math.round(s*0.68)}" stroke="${c}" stroke-width="${Math.round(s*0.09)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.28)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.68)}" y2="${Math.round(s*0.88)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.2)}" y2="${Math.round(s*0.65)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.82)}" y2="${Math.round(s*0.42)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>`;
  } else if(isSP){
    // 先發：高舉投球臂
    body=`<ellipse cx="${bx}" cy="${by}" rx="${hw}" ry="${h*0.38}" fill="${c}"/>
<line x1="${bx}" y1="${by+h*0.38}" x2="${bx}" y2="${Math.round(s*0.68)}" stroke="${c}" stroke-width="${Math.round(s*0.09)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.35)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.65)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.22)}" y2="${Math.round(s*0.38)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.78)}" y2="${Math.round(s*0.6)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>`;
  } else if(isC){
    // 捕手：蹲低姿勢
    body=`<ellipse cx="${bx}" cy="${by}" rx="${hw}" ry="${h*0.38}" fill="${c}"/>
<line x1="${bx}" y1="${by+h*0.38}" x2="${bx}" y2="${Math.round(s*0.58)}" stroke="${c}" stroke-width="${Math.round(s*0.09)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.58)}" x2="${Math.round(s*0.28)}" y2="${Math.round(s*0.82)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${Math.round(s*0.28)}" y1="${Math.round(s*0.82)}" x2="${Math.round(s*0.22)}" y2="${Math.round(s*0.62)}" stroke="${c}" stroke-width="${Math.round(s*0.07)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.58)}" x2="${Math.round(s*0.72)}" y2="${Math.round(s*0.82)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${Math.round(s*0.72)}" y1="${Math.round(s*0.82)}" x2="${Math.round(s*0.78)}" y2="${Math.round(s*0.62)}" stroke="${c}" stroke-width="${Math.round(s*0.07)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.46)}" x2="${Math.round(s*0.2)}" y2="${Math.round(s*0.56)}" stroke="${c}" stroke-width="${Math.round(s*0.07)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.46)}" x2="${Math.round(s*0.8)}" y2="${Math.round(s*0.56)}" stroke="${c}" stroke-width="${Math.round(s*0.07)}" stroke-linecap="round"/>`;
  } else if(isOF){
    // 外野：張手接球姿勢
    body=`<ellipse cx="${bx}" cy="${by}" rx="${hw}" ry="${h*0.38}" fill="${c}"/>
<line x1="${bx}" y1="${by+h*0.38}" x2="${bx}" y2="${Math.round(s*0.68)}" stroke="${c}" stroke-width="${Math.round(s*0.09)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.35)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.65)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.48)}" x2="${Math.round(s*0.16)}" y2="${Math.round(s*0.38)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.48)}" x2="${Math.round(s*0.84)}" y2="${Math.round(s*0.38)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>`;
  } else {
    // 內野手/DH：揮棒姿勢（默認）
    body=`<ellipse cx="${bx}" cy="${by}" rx="${hw}" ry="${h*0.38}" fill="${c}"/>
<line x1="${bx}" y1="${by+h*0.38}" x2="${bx}" y2="${Math.round(s*0.68)}" stroke="${c}" stroke-width="${Math.round(s*0.09)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.35)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.68)}" x2="${Math.round(s*0.65)}" y2="${Math.round(s*0.95)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.18)}" y2="${Math.round(s*0.52)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>
<line x1="${Math.round(s*0.18)}" y1="${Math.round(s*0.52)}" x2="${Math.round(s*0.78)}" y2="${Math.round(s*0.44)}" stroke="${c}" stroke-width="${Math.round(s*0.07)}" stroke-linecap="round"/>
<line x1="${bx}" y1="${Math.round(s*0.5)}" x2="${Math.round(s*0.82)}" y2="${Math.round(s*0.56)}" stroke="${c}" stroke-width="${Math.round(s*0.08)}" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${body}</svg>`;
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
  let avBg,avGlow;
  if(isH){avBg='linear-gradient(145deg,#2a1500,#1a0a00)';avGlow='0 0 16px rgba(212,160,23,.5)';}
  else if(isL){avBg='linear-gradient(145deg,#150828,#0c0518)';avGlow='0 0 14px rgba(138,80,216,.4)';}
  else if(isR2){avBg='linear-gradient(145deg,#0a1428,#060c18)';avGlow='0 0 8px rgba(74,106,204,.25)';}
  else if(isRetro){avBg='linear-gradient(145deg,#faf6ee,#e8dcc8)';avGlow='none';}
  else{avBg='linear-gradient(145deg,#0d1a0d,#060f06)';avGlow='none';}
  const adv=calcAdvanced(p);
  const advHTML=buildAdvHTML(p,adv);
  const summaryHTML=buildDetailSummaryHTML(p,adv);

  document.getElementById('ds-content').innerHTML=`
    <div class="ds-rarity-banner" style="background:${rs.bg};color:${rs.c};border-bottom:1px solid ${rs.bd}">
      <span class="ds-rarity-main">${rarLabelMap[p.rar]||rs.lbl}</span>
      <span class="ds-rarity-sub">${rarAccentMap[p.rar]||rs.lbl}</span>
    </div>
    <div class="ds-head">
      <div class="ds-av-card" style="background:${avBg};border:${isH?'2px':'1.5px'} solid ${rs.bd};box-shadow:${avGlow}">
        <div class="ds-av-body">
          ${getPoseSVG(p,42)}
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
