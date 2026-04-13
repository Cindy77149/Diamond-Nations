let dailyState={pull:0,match:0,coach:false,claimed:[false,false,false],date:''};

function loadDailyState(){
  try{
    const raw=localStorage.getItem('dn_daily');
    if(raw){
      const d=JSON.parse(raw);
      if(d.date===new Date().toDateString()){
        dailyState=d;
        return;
      }
    }
  }catch(e){}
  dailyState={pull:0,match:0,coach:false,claimed:[false,false,false],date:new Date().toDateString()};
}
function saveDailyState(){
  try{
    localStorage.setItem('dn_daily',JSON.stringify({...dailyState,date:new Date().toDateString()}));
  }catch(e){}
}
function getDailyProgress(idx){
  return [Math.min(dailyState.pull,3),Math.min(dailyState.match,1),dailyState.coach?1:0][idx];
}
function claimDaily(idx){
  if(dailyState.claimed[idx])return;
  if(getDailyProgress(idx)<DAILY_DEF[idx].max){
    showSaveToast('任務尚未完成！');
    return;
  }
  dailyState.claimed[idx]=true;
  saveDailyState();
  gems+=DAILY_DEF[idx].gems;
  updateGemDisp();
  addActivity('🎁',`領取每日任務：${DAILY_DEF[idx].n}`,DAILY_DEF[idx].r);
  showSaveToast(`✅ 領取 ${DAILY_DEF[idx].r}！`);
  autoSave();
  renderHome();
}

const ACTS=[
  {i:'🎉',t:'歡迎加入 Diamond Nations！',s:'選擇了你的國家，開始收集卡牌吧',tm:'剛才'},
];

function addActivity(i,t,s){
  ACTS.unshift({i,t,s,tm:'剛才'});
  if(ACTS.length>20)ACTS.pop();
}
function renderHome(){
  document.getElementById('gem-home').textContent=gems.toLocaleString();
  const nation=getNationConfig(myNation);
  const subEl=document.getElementById('home-nation-sub');
  if(subEl)subEl.textContent=nation?nation.name+' · WBC':'選擇你的國家';

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
    const cur=getDailyProgress(idx);
    const pct=Math.round(cur/d.max*100);
    const claimed=dailyState.claimed[idx];
    const ready=cur>=d.max&&!claimed;
    const r=document.createElement('div');
    r.className='daily-row'+(claimed?' done':'');
    r.innerHTML=`<div class="dr-i">${d.i}</div><div class="dr-inf"><div class="dr-n">${d.n}</div><div class="dr-p">${cur}/${d.max}</div>${!claimed?`<div class="dr-tr"><div class="dr-f" style="width:${pct}%"></div></div>`:''}</div>${claimed?'<div style="font-size:16px;color:#4adb6a">✓</div>':ready?`<button class="dr-claim" onclick="claimDaily(${idx})">${d.r}</button>`:`<div class="dr-r">${d.r}</div>`}`;
    dlFrag.appendChild(r);
  });
  dl.innerHTML='';
  dl.appendChild(dlFrag);

  const al=document.getElementById('act-list');
  const alFrag=document.createDocumentFragment();
  ACTS.forEach(a=>{
    const r=document.createElement('div');
    r.className='daily-row';
    r.innerHTML=`<div class="dr-i">${a.i}</div><div class="dr-inf"><div class="dr-n">${a.t}</div><div class="dr-p">${a.s}</div></div><div style="font-size:9px;color:var(--color-text-tertiary)">${a.tm}</div>`;
    alFrag.appendChild(r);
  });
  al.innerHTML='';
  al.appendChild(alFrag);
}
