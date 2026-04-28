/* ============================================================
   Diamond Nations — game-api.js
   FastAPI 同步 / 後端狀態
   ============================================================ */

const DN_API_BASE=window.location.protocol==='file:'?'http://127.0.0.1:8000':'';
const backendSyncState={
  available:false,
  checking:false,
  lastSyncAt:0,
  remoteAutoMeta:null,
  syncTimer:null,
};

function buildApiUrl(path){
  if(!path.startsWith('/'))path='/'+path;
  return `${DN_API_BASE}${path}`;
}

async function apiRequest(path,options={}){
  const opts={...options};
  const headers={...(opts.headers||{})};
  if(opts.body!==undefined&&!headers['Content-Type'])headers['Content-Type']='application/json';
  opts.headers=headers;
  const res=await fetch(buildApiUrl(path),opts);
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(data?.detail||`HTTP ${res.status}`);
  return data;
}

function formatSyncTime(ts){
  if(!ts)return '尚未同步';
  const d=new Date(ts);
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  return `${d.getMonth()+1}/${d.getDate()} ${hh}:${mm}`;
}

function updateBackendSyncUI(){
  const sub=document.getElementById('backend-sync-sub');
  const note=document.getElementById('backend-sync-note');
  const statusBtn=document.getElementById('backend-status-btn');
  const saveBtn=document.getElementById('backend-save-btn');
  const loadBtn=document.getElementById('backend-load-btn');
  const statusPill=document.getElementById('backend-status-pill');
  const lastSyncPill=document.getElementById('backend-last-sync-pill');
  if(!sub||!note||!statusBtn||!saveBtn||!loadBtn||!statusPill||!lastSyncPill)return;

  const remoteLabel=backendSyncState.lastSyncAt
    ?`本機同步 ${formatSyncTime(backendSyncState.lastSyncAt)}`
    :backendSyncState.remoteAutoMeta?`後端存檔 ${formatSyncTime(backendSyncState.remoteAutoMeta.updated_at)}`:'尚未同步';

  lastSyncPill.textContent=remoteLabel;
  statusBtn.disabled=backendSyncState.checking;
  saveBtn.disabled=backendSyncState.checking||!backendSyncState.available;
  loadBtn.disabled=backendSyncState.checking||!backendSyncState.available;
  statusBtn.classList.remove('ready');
  saveBtn.classList.remove('ready');
  loadBtn.classList.remove('ready');

  if(backendSyncState.checking){
    statusBtn.textContent='檢查中...';
    sub.textContent='正在確認 FastAPI 是否在線。';
    statusPill.textContent='檢查中';
    statusPill.className='backend-sync-pill muted';
    note.textContent='如果你是直接開 index.html，FastAPI 預設會檢查 http://127.0.0.1:8000。';
    return;
  }

  if(backendSyncState.available){
    statusBtn.textContent='重新檢查';
    statusBtn.classList.add('ready');
    saveBtn.classList.add('ready');
    loadBtn.classList.add('ready');
    sub.textContent='FastAPI 已連線，可把目前自動存檔同步到後端，或直接從後端把最新存檔拉回來。';
    statusPill.textContent='已連線';
    statusPill.className='backend-sync-pill online';
    note.textContent='現在仍會照常保留本機 localStorage；每次自動存檔也會順手同步到後端。';
  }else{
    statusBtn.textContent='檢查連線';
    statusBtn.classList.remove('ready');
    saveBtn.classList.remove('ready');
    loadBtn.classList.remove('ready');
    sub.textContent='尚未連到 FastAPI。啟動後端後，可把這個遊戲變成真的前後端 side project。';
    statusPill.textContent='離線';
    statusPill.className='backend-sync-pill offline';
    note.textContent='啟動 `uvicorn main:app --reload` 後，再回來按「檢查連線」即可。';
  }
}

async function refreshBackendStatus(showToast=false){
  backendSyncState.checking=true;
  updateBackendSyncUI();
  try{
    const data=await apiRequest('/api/health');
    backendSyncState.available=true;
    backendSyncState.remoteAutoMeta=(data.saved_slots||[]).find(s=>s.slot===AUTO_SLOT)||null;
    if(showToast)showSaveToast('FastAPI 已連線');
    return data;
  }catch(err){
    backendSyncState.available=false;
    backendSyncState.remoteAutoMeta=null;
    if(showToast)showSaveToast('找不到 FastAPI 伺服器');
    return null;
  }finally{
    backendSyncState.checking=false;
    updateBackendSyncUI();
  }
}

function hydrateFrontendAfterBackendLoad(){
  if(myNation){
    applyNationBranding(getNationConfig(myNation));
    renderMainScreens();
    updateGemDisp();
    goScreen('home');
  }else{
    buildNationScreen();
    document.getElementById('nation-screen')?.classList.remove('hide');
    document.getElementById('legend-screen')?.classList.remove('show');
    document.getElementById('lineup-screen')?.classList.remove('show');
    hideAllScreens();
  }
  updateSettingsStats();
}

async function syncCurrentSaveToBackend(slot=AUTO_SLOT,silent=false,preparedSave=null){
  const save=preparedSave||buildSaveable();
  try{
    const data=await apiRequest(`/api/saves/${slot}`,{
      method:'POST',
      body:JSON.stringify({
        label:slot===AUTO_SLOT?'🔄 自動存檔':`手動存檔 ${slot}`,
        source:'browser',
        save,
      }),
    });
    backendSyncState.available=true;
    backendSyncState.lastSyncAt=Date.now();
    backendSyncState.remoteAutoMeta=data.meta||null;
    updateBackendSyncUI();
    if(!silent)showSaveToast('已同步到 FastAPI');
    return data;
  }catch(err){
    backendSyncState.available=false;
    updateBackendSyncUI();
    if(!silent)showSaveToast('同步失敗，請先啟動 FastAPI');
    throw err;
  }
}

async function loadCurrentSaveFromBackend(slot=AUTO_SLOT){
  try{
    const data=await apiRequest(`/api/saves/${slot}`);
    restoreSave(data.save);
    backendSyncState.available=true;
    backendSyncState.lastSyncAt=Date.now();
    backendSyncState.remoteAutoMeta=data.meta||null;
    hydrateFrontendAfterBackendLoad();
    showSaveToast('已從 FastAPI 讀取存檔');
    return data;
  }catch(err){
    if(err.message!=='找不到這個存檔槽')backendSyncState.available=false;
    updateBackendSyncUI();
    showSaveToast(err.message==='找不到這個存檔槽'?'後端還沒有這個存檔':'後端沒有可讀取的存檔');
    throw err;
  }
}

function queueBackendAutoSync(slot,preparedSave=null){
  if(slot!==AUTO_SLOT||!backendSyncState.available)return;
  clearTimeout(backendSyncState.syncTimer);
  backendSyncState.syncTimer=setTimeout(()=>{
    syncCurrentSaveToBackend(slot,true,preparedSave).catch(()=>null);
  },900);
}

function initBackendSyncAfterLoad(){
  updateBackendSyncUI();
  setTimeout(()=>refreshBackendStatus(false),900);
}

if(document.readyState==='complete')initBackendSyncAfterLoad();
else window.addEventListener('load',initBackendSyncAfterLoad,{once:true});
