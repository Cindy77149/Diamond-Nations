/* ============================================================
   Diamond Nations — game-core.js
   核心狀態 / 存檔 / 共用工具
   ============================================================ */

/* ═══ STATE ═══ */
/* ═══ GAMESTATE - Centralized State Management ═══ */
const GameState={
  gems:3000,pity:0,
  myNation:null,myLegend:null,
  collection:[],
  lineup:Array(9).fill(null),
  battingOrder:[0,1,2,3,4,5,6,7,8],
  bench:Array(16).fill(null),
  benchSlots:7,
  rotation:Array(5).fill(null),
  bullpen:Array(16).fill(null),
  bullpenSlots:9,
  teamViewMode:'standard',
  teamSortMode:'ovr',
  positionPenaltyEnabled:false,
  ownedCoaches:['mgr1','bat1','pit1','def1','fit1','psy1'],
  equippedCoaches:{},
  matchCount:0,
  clearedDynasties:[],
  journeyProgress:{},
  scoutCandidates:[],
  naturalizedPlayers:[],
  scoutLevels:{s1:1,s2:1,s3:1},
  scoutDispatched:{},
};
// Proxy shortcuts for backward compatibility
let gems,pity,myNation,myLegend,collection,lineup,battingOrder,bench,benchSlots,rotation,bullpen,bullpenSlots,ownedCoaches,equippedCoaches,matchCount,scoutCandidates,naturalizedPlayers,clearedDynasties,journeyProgress;
let teamViewMode,teamSortMode,positionPenaltyEnabled;
function syncFromState(){
  gems=GameState.gems;pity=GameState.pity;
  myNation=GameState.myNation;myLegend=GameState.myLegend;
  collection=GameState.collection;
  lineup=GameState.lineup;battingOrder=GameState.battingOrder||[0,1,2,3,4,5,6,7,8];bench=GameState.bench||Array(16).fill(null);benchSlots=GameState.benchSlots||7;rotation=GameState.rotation;bullpen=GameState.bullpen||Array(16).fill(null);bullpenSlots=GameState.bullpenSlots||9;
  teamViewMode=GameState.teamViewMode||'standard';
  teamSortMode=GameState.teamSortMode||'ovr';
  positionPenaltyEnabled=GameState.positionPenaltyEnabled===true;
  ownedCoaches=Array.isArray(GameState.ownedCoaches)?GameState.ownedCoaches:['mgr1','bat1','pit1','def1','fit1','psy1'];
  equippedCoaches=GameState.equippedCoaches;
  matchCount=GameState.matchCount;
  clearedDynasties=GameState.clearedDynasties||[];
  journeyProgress=GameState.journeyProgress||{};
  scoutCandidates=GameState.scoutCandidates;
  naturalizedPlayers=GameState.naturalizedPlayers;
  // 恢復各卡包保底計數
  if(GameState.packPity) Object.assign(packPity,GameState.packPity);
  if(GameState.pullHistory) pullHistory=GameState.pullHistory;
}
function syncToState(){
  GameState.gems=gems;GameState.pity=pity;
  GameState.myNation=myNation;GameState.myLegend=myLegend;
  GameState.collection=collection;
  GameState.lineup=lineup;GameState.battingOrder=battingOrder;GameState.bench=bench;GameState.benchSlots=benchSlots;GameState.rotation=rotation;GameState.bullpen=bullpen;GameState.bullpenSlots=bullpenSlots;
  GameState.teamViewMode=teamViewMode;
  GameState.teamSortMode=teamSortMode;
  GameState.positionPenaltyEnabled=positionPenaltyEnabled===true;
  GameState.ownedCoaches=ownedCoaches;
  GameState.equippedCoaches=equippedCoaches;
  GameState.matchCount=matchCount;
  GameState.clearedDynasties=clearedDynasties;
  GameState.journeyProgress=journeyProgress;
  GameState.scoutCandidates=scoutCandidates;
  GameState.naturalizedPlayers=naturalizedPlayers;
  GameState.packPity={...packPity};
  GameState.pullHistory=pullHistory.slice(0,100);
}
/* ══ 十槽存檔系統 ══ */
const SAVE_PREFIX='dn_save_';
const AUTO_SLOT=0; // slot 0 = 自動存檔

function buildSaveable(){
  syncToState();
  const n=NATIONS.find(x=>x.id===GameState.myNation);
  const s={
    _ver:'v6',
    _ts:Date.now(),
    _nation:GameState.myNation,
    _natFlag:n?n.flag:'⚾',
    _natName:n?n.name:'未知',
    _gems:GameState.gems,
    _collectionCount:GameState.collection.length,
    _ovr:getOvr([...GameState.lineup,...GameState.bench,...GameState.rotation,...GameState.bullpen]),
    gems:GameState.gems,pity:GameState.pity,
    myNation:GameState.myNation,myLegend:GameState.myLegend,
    ownedCoaches:GameState.ownedCoaches,equippedCoaches:GameState.equippedCoaches,matchCount:GameState.matchCount,
    clearedDynasties:GameState.clearedDynasties,
    journeyProgress:GameState.journeyProgress,
    collection:GameState.collection.map(p=>({name:p.name,year:p.year??null,_naturalized:p._naturalized||false,_origNat:p._origNat||null})),
    lineup:GameState.lineup.map(p=>p?{name:p.name,year:p.year??null}:null),
    battingOrder:(GameState.battingOrder||[0,1,2,3,4,5,6,7,8]).slice(0,9),
    bench:GameState.bench.map(p=>p?{name:p.name,year:p.year??null}:null),
    benchSlots:GameState.benchSlots||7,
    rotation:GameState.rotation.map(p=>p?{name:p.name,year:p.year??null}:null),
    bullpen:GameState.bullpen.map(p=>p?{name:p.name,year:p.year??null}:null),
    bullpenSlots:GameState.bullpenSlots||9,
    teamViewMode:GameState.teamViewMode,
    teamSortMode:GameState.teamSortMode,
    positionPenaltyEnabled:GameState.positionPenaltyEnabled===true,
    scoutCandidates:GameState.scoutCandidates.map(p=>({name:p.name,year:p.year??null,_fromScout:p._fromScout,_scoutName:p._scoutName,_region:p._region})),
    naturalizedPlayers:GameState.naturalizedPlayers.map(p=>({name:p.name,year:p.year??null,_origNat:p._origNat})),
    myScoutsState:myScouts.map(s=>({id:s.id,lv:s.lv,dispatched:s.dispatched,region:s.region,doneIn:s.doneIn,doneAt:s.doneAt??0,searchMode:s.searchMode??null,candidateName:s.candidate?s.candidate.name:null,candidateYear:s.candidate?s.candidate.year??null:null,rarWeights:s.rarWeights})),
    packPity:{...packPity},
    pullHistory:pullHistory.slice(0,100).map(h=>({name:h.name,nat:h.nat,av:h.av,rar:h.rar,rarlbl:h.rarlbl,rarc:h.rarc,rarbg:h.rarbg})),
  };
  return s;
}

function restoreSave(saved){
  GameState.gems=saved.gems??3000;GameState.pity=saved.pity??0;
  GameState.myNation=saved.myNation??null;GameState.myLegend=saved.myLegend??null;
  GameState.ownedCoaches=saved.ownedCoaches??['mgr1','bat1','pit1','def1','fit1','psy1'];
  GameState.equippedCoaches=saved.equippedCoaches??{};GameState.matchCount=saved.matchCount??0;
  Object.values(GameState.equippedCoaches).forEach(cid=>{
    if(cid&&!GameState.ownedCoaches.includes(cid))GameState.ownedCoaches.push(cid);
  });
  GameState.clearedDynasties=saved.clearedDynasties??[];
  GameState.journeyProgress=saved.journeyProgress??{};
  // 向後相容：支援舊格式（string）和新格式（{name,year}）
  const restoreRef=s=>{
    if(!s)return null;
    if(typeof s==='string')return findPlayerCompat(s);
    return findPlayerCompat(s.name,s.year);
  };
  GameState.collection=(saved.collection||[]).map(s=>{const p=restoreRef(s);return p?{...p,_naturalized:s._naturalized||false,_origNat:s._origNat||null}:null;}).filter(Boolean);
  GameState.lineup=(saved.lineup||Array(9).fill(null)).map(restoreRef);
  GameState.battingOrder=(saved.battingOrder||[0,1,2,3,4,5,6,7,8]).slice(0,9);
  GameState.bench=(saved.bench||Array(16).fill(null)).map(restoreRef);
  GameState.benchSlots=saved.benchSlots||7;
  GameState.rotation=(saved.rotation||Array(5).fill(null)).map(restoreRef);
  GameState.bullpen=(saved.bullpen||Array(16).fill(null)).map(restoreRef);
  GameState.bullpenSlots=saved.bullpenSlots||9;
  GameState.teamViewMode=saved.teamViewMode||'standard';
  GameState.teamSortMode=saved.teamSortMode||'ovr';
  GameState.positionPenaltyEnabled=saved.positionPenaltyEnabled===true;
  GameState.scoutCandidates=(saved.scoutCandidates||[]).map(s=>{const p=restoreRef(s);return p?{...p,_fromScout:s._fromScout,_scoutName:s._scoutName,_region:s._region}:null;}).filter(Boolean);
  GameState.naturalizedPlayers=(saved.naturalizedPlayers||[]).map(s=>{const p=restoreRef(s);return p?{...p,_naturalized:true,_origNat:s._origNat}:null;}).filter(Boolean);
  if(saved.myScoutsState){saved.myScoutsState.forEach(ss=>{const scout=myScouts.find(s=>s.id===ss.id);if(!scout)return;scout.lv=ss.lv??1;scout.rarWeights=ss.rarWeights??scout.rarWeights;scout.dispatched=ss.dispatched??false;scout.region=ss.region??null;scout.doneIn=ss.doneIn??0;scout.doneAt=ss.doneAt??0;scout.searchMode=ss.searchMode??null;scout.candidate=ss.candidateName?findPlayerCompat(ss.candidateName,ss.candidateYear)||null:null;});}
  // 恢復各卡包保底計數
  if(saved.packPity)Object.assign(packPity,saved.packPity);
  // 恢復抽卡歷史
  if(saved.pullHistory)pullHistory=saved.pullHistory;
  syncFromState();
}

function saveToSlot(slot){
  try{
    const s=buildSaveable();
    if(slot===AUTO_SLOT)s._label='🔄 自動存檔';
    localStorage.setItem(SAVE_PREFIX+slot,JSON.stringify(s));
    return true;
  }catch(e){console.warn('Save failed:',e);return false;}
}

function loadFromSlot(slot){
  try{
    const raw=localStorage.getItem(SAVE_PREFIX+slot);
    if(!raw)return false;
    restoreSave(JSON.parse(raw));
    return true;
  }catch(e){console.warn('Load failed:',e);return false;}
}

function deleteSlot(slot){
  localStorage.removeItem(SAVE_PREFIX+slot);
}

function getSlotMeta(slot){
  try{
    const raw=localStorage.getItem(SAVE_PREFIX+slot);
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(e){return null;}
}

// ── 向後相容（autoSave 用 slot 0）──
function saveGame(){saveToSlot(AUTO_SLOT);}
function loadGame(){
  // 嘗試新格式 slot0，失敗則嘗試舊 SAVE_KEY
  if(loadFromSlot(AUTO_SLOT))return true;
  try{
    const old=localStorage.getItem('diamond_nations_save_v1');
    if(!old)return false;
    restoreSave(JSON.parse(old));
    // 遷移到新格式
    saveToSlot(AUTO_SLOT);
    return true;
  }catch(e){return false;}
}
function autoSave(){saveToSlot(AUTO_SLOT);}


function showSaveToast(msg){
  let t=document.getElementById('save-toast');
  if(!t){t=document.createElement('div');t.id='save-toast';t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:white;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;pointer-events:none;border:.5px solid rgba(255,255,255,.15);box-shadow:0 4px 16px rgba(0,0,0,.4)';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';},2000);
}

/* ═══ UTILS ═══ */
// players-data.js 會先正規化 id/year/pos
// 主鍵：name+'|'+year（支援同名不同年份）
const NATION_MAP=new Map(NATIONS.map(n=>[n.id,n]));
const PLAYER_MAP=new Map(ALL_PLAYERS.map(p=>[p.name+'|'+(p.year??''),p]));
// 名字備查表（name-only fallback，同名取最後一個）
const PLAYER_NAME_MAP=new Map();
ALL_PLAYERS.forEach(p=>PLAYER_NAME_MAP.set(p.name,p));
function findPlayer(name,year){
  if(year!==undefined&&year!==null)return PLAYER_MAP.get(name+'|'+year)??null;
  return PLAYER_NAME_MAP.get(name)??null;
}
const posArr=p=>Array.isArray(p.pos)?p.pos:[p.pos];
const hasPos=(p,pos)=>posArr(p).includes(pos);
const posStr=p=>posArr(p).join('/');
const cleanName=n=>n.replace(/ \[\d{4} 傳奇\]/,'').replace(/ \[\d{4}\]/,'').replace(' [RETRO]','');
// 卡牌顯示名稱：只顯示名字，年份另外顯示
const cardLabel=p=>cleanName(p.name);
const PLAYER_CLEAN_NAME_MAP=new Map();
ALL_PLAYERS.forEach(p=>{
  const cleaned=cleanName(p.name);
  if(!PLAYER_CLEAN_NAME_MAP.has(cleaned))PLAYER_CLEAN_NAME_MAP.set(cleaned,p);
});
// 向後相容：舊存檔名稱沒有年份標籤時，嘗試用 cleanName 或 name+year 匹配
const findPlayerCompat=(name,year)=>{
  const direct=findPlayer(name,year);if(direct)return direct;
  if(year)return findPlayer(name)??null; // year-only fallback
  const base=cleanName(name);
  // 舊格式：name 內嵌年份，如「大谷翔平 (2023)」
  return PLAYER_CLEAN_NAME_MAP.get(base)
    ??PLAYER_NAME_MAP.get(base)
    ??ALL_PLAYERS.find(p=>p.name.startsWith(base+' ['))
    ??null;
};
/* 快取常用 DOM + 共用 helper */
const _pullOverlay=document.getElementById('pull-anim-overlay');
const _pullSingle=document.getElementById('pull-single-stage');
const _pullTen=document.getElementById('pull-ten-stage');
const _detailOverlay=document.getElementById('detail-overlay');
function hideAllScreens(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('show'));}
