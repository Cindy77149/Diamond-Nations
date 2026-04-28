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
  }else{
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
    C:'c','1B':'first','2B':'second','3B':'third',SS:'ss',
    LF:'lf',CF:'cf',RF:'rf',DH:'dh'
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
  }else{
    filterPos='全部';lockedFilterPos=null;
  }
  closeTeamViewMenu();
  switchTeamTab('pick');renderFilterTabs();renderPlayerList();
}

function cancelPick(){
  pickMode=null;
  lockedFilterPos=null;
  document.getElementById('pick-banner').classList.remove('show');
  filterPos='全部';
  renderFilterTabs();
  renderPlayerList();
  swapSelection=null;
  renderTeam();
}

const POS_FILTERS=['全部','SP','RP','CP','C','1B','2B','3B','SS','OF','LF','CF','RF','DH'];
const BENCH_FILTERS=['全部','C','1B','2B','3B','SS','OF','LF','CF','RF','DH'];

function renderFilterTabs(){
  const fr=document.getElementById('filter-row');
  const frag=document.createDocumentFragment();
  const filters=lockedFilterPos?[lockedFilterPos]:(pickMode?.type==='bench'?BENCH_FILTERS:POS_FILTERS);
  filters.forEach(f=>{
    const b=document.createElement('button');
    b.className='ftab'+(f===filterPos?' active':'');
    b.textContent=f;
    b.onclick=()=>{
      if(lockedFilterPos)return;
      filterPos=f;
      renderFilterTabs();
      renderPlayerList();
    };
    frag.appendChild(b);
  });
  fr.innerHTML='';
  fr.appendChild(frag);
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
    list=list.filter(p=>{
      const pa=posArr(p);
      return pa.includes(filterPos)||(ofPos.includes(filterPos)&&pa.includes('OF'));
    });
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
  pl.innerHTML='';
  pl.appendChild(frag);
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
    case 0:return player.stats?.[0]??0;
    case 1:return player.power??player.stats?.[0]??0;
    case 2:return player.stats?.[1]??0;
    case 3:return player.stats?.[2]??0;
    case 4:return player.stats?.[3]??0;
    case 5:return player.stats?.[4]??0;
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
    refreshTeamUI({save:true});
    return;
  }
  const{type,idx}=pickMode;
  clearExistingPlayerFromTeam(p,type,idx);
  if(type==='lineup')lineup[idx]=p;
  else if(type==='bench')bench[idx]=p;
  else if(type==='rotation')rotation[idx]=p;
  else bullpen[idx]=p;
  pickMode=null;
  lockedFilterPos=null;
  document.getElementById('pick-banner').classList.remove('show');
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
