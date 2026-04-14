let selEraIdx=5;
let selMatchMode=null;
let selJourneyView='eras'; // 'eras' | 'opps'
let expandedMatchRosterKey=null;

function resetMatchSetupView(){
  selMatchMode=null;
  selJourneyView='eras';
  expandedMatchRosterKey=null;
}
function openJourneyEra(eraIdx){
  selEraIdx=eraIdx;
  selJourneyView='opps';
  renderMatchSetup();
}
function backToJourneyEras(){
  selJourneyView='eras';
  expandedMatchRosterKey=null;
  renderMatchSetup();
}

function getDynastyKey(opp){
  return `${opp._eraYear||opp.era||'na'}|${opp.name}`;
}
function getJourneyKey(opp){
  return `${opp._eraYear||opp.era||opp.era||'na'}|${opp.name}`;
}
function getMatchRosterKey(opp){
  return `${opp._challengeType||'journey'}|${opp._eraYear||opp.era||'na'}|${opp.name}`;
}
function getJourneyStars(opp){
  return journeyProgress?.[getJourneyKey(opp)]||0;
}
function calcJourneyStars({win,margin,runsAllowed}){
  if(!win)return 0;
  let stars=1;
  if(margin>=3)stars++;
  if(runsAllowed===0||margin>=5)stars++;
  return Math.min(3,stars);
}
function buildJourneyStarsMarkup(stars){
  if(!stars)return '<span class="journey-stars pending">未擊敗</span>';
  const filled='★'.repeat(stars);
  const empty='☆'.repeat(Math.max(0,3-stars));
  return `<span class="journey-stars cleared">${filled}${empty}</span>`;
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
      if(selJourneyView==='eras'){
        const myNatFlagJ=n?n.flag:null;
        const eraCards=PLAYABLE_WBC_ERAS.slice().sort((a,b)=>b.year-a.year).map((era,_si)=>{
          const origIdx=PLAYABLE_WBC_ERAS.indexOf(era);
          const allOpps=era.teams.filter(t=>!(myNatFlagJ&&t.flag===myNatFlagJ));
          const total=allOpps.length;
          const cleared=allOpps.filter(t=>getJourneyStars(t)>0).length;
          const champTeam=era.teams.find(t=>t.champion);
          const pct=total?Math.round(cleared/total*100):0;
          const done=cleared===total&&total>0;
          return `<button class="jec${done?' done':''}" type="button" onclick="openJourneyEra(${origIdx})">
            <div class="jec-top">
              <div class="jec-year">${era.year}</div>
              <div class="jec-champ">${champTeam?.flag||'🏆'}</div>
            </div>
            <div class="jec-body">
              <div class="jec-label">${era.label}</div>
              <div class="jec-desc">${era.desc}</div>
              <div class="jec-prog-row">
                <div class="jec-prog-bar"><div class="jec-prog-fill" style="width:${pct}%"></div></div>
                <div class="jec-prog-txt">${cleared}/${total} 隊</div>
              </div>
            </div>
            <div class="jec-arr">›</div>
          </button>`;
        }).join('');
        detail.innerHTML=`
          <div class="match-detail-card">
            <div class="match-detail-top">
              <div>
                <div class="match-detail-title">經典賽征途</div>
                <div class="match-detail-sub">選擇年份，挑戰歷代 WBC 強敵</div>
              </div>
              <button class="match-detail-close" type="button" onclick="setMatchMode('journey')">×</button>
            </div>
            <div class="journey-era-grid">${eraCards}</div>
          </div>`;
      }else{
        detail.innerHTML=`
          <div class="match-detail-card">
            <div class="match-detail-top">
              <button class="jec-back" type="button" onclick="backToJourneyEras()">‹ 年份</button>
              <button class="match-detail-close" type="button" onclick="setMatchMode('journey')">×</button>
            </div>
            <div id="era-header"></div>
            <div class="match-section-head">
              <span>本屆強敵</span>
              <span class="match-section-note" id="match-stage-note"></span>
            </div>
            <div class="opp-list" id="opp-list"></div>
          </div>`;
      }
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
  if(selEraIdx>=PLAYABLE_WBC_ERAS.length)selEraIdx=0;
  const curEra=PLAYABLE_WBC_ERAS[selEraIdx];
  const champTeam=curEra?.teams.find(t=>t.champion);
  // 只在 journey opps 視圖才渲染 era-header / stage-note
  if(selMatchMode==='journey'&&selJourneyView==='opps'){
    const ehdr=document.getElementById('era-header');
    if(ehdr&&curEra)ehdr.innerHTML=`<div class="era-header"><div class="era-champ-flag">${champTeam?champTeam.flag:'🏆'}</div><div class="era-info"><div class="era-title">${curEra.label}</div><div class="era-desc">${curEra.desc}</div>${champTeam&&champTeam.mvp?`<div class="era-mvp">🏅 當屆 MVP：${champTeam.mvp}</div>`:''}</div></div>`;
    const stageNote=document.getElementById('match-stage-note');
    if(stageNote&&curEra)stageNote.textContent=`${curEra.year} 年代表強隊，逐一挑戰並建立你的征服紀錄`;
  }

  const ol=document.getElementById('opp-list');
  if(ol&&curEra){
    ol.innerHTML='';
    const myStr=myPreview.overall||75;
    const myNatFlag=n?n.flag:'';
    curEra.teams.forEach(opp=>{
      if(myNatFlag&&opp.flag===myNatFlag)return;
      const oppPreview=getOpponentMatchPreviewRatings(opp);
      const diff=myStr-oppPreview.overall;
      const dc=diff>=0?'#4adb6a':'#f06070';
      const diffTxt=diff>0?`+${diff}`:diff===0?'±0':`${diff}`;
      const bestStars=getJourneyStars(opp);
      const cleared=bestStars>0;
      const oppRoster=oppPreview.roster;
      const rosterKey=getMatchRosterKey(opp);
      const expanded=expandedMatchRosterKey===rosterKey;
      const starterPreview=oppRoster.starters.slice(0,4).map(player=>cleanName(player.name)).join(' · ');
      const row=document.createElement('div');
      row.className='opp-row'+(cleared?' cleared':'');
      const champBadge=opp.champion?'<span class="champ-tag">🏆 冠軍</span>':'';
      const keyPlayers=oppRoster.starters.slice(0,2).map(player=>cleanName(player.name)).join(' · ');
      row.innerHTML=`<div class="opp-flag">${opp.flag}</div><div class="opp-inf"><div style="display:flex;align-items:center;gap:5px"><div class="opp-nm">${opp.name}</div>${champBadge}${buildJourneyStarsMarkup(bestStars)}</div><div class="opp-sb">${opp.desc}</div><div class="opp-sb" style="margin-top:4px">${keyPlayers}</div><div class="opp-roster-box"><div class="opp-roster-line"><span class="opp-roster-tag">先發</span><span class="opp-roster-copy">${starterPreview||'依年度名單自動組成'}</span></div><div class="opp-roster-meta">打線 ${oppPreview.batOvr} · 先發 ${oppPreview.pitOvr} · 替補 ${oppRoster.bench.length} 人 · 牛棚 ${oppRoster.bullpen.length} 人</div><button class="opp-roster-toggle" type="button">${expanded?'收起名單':'看完整名單'}</button>${expanded?`<div class="opp-roster-detail"><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發 9 人</div><div class="opp-roster-list">${oppRoster.starters.map(player=>`<span>${cleanName(player.name)}</span>`).join('')}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">替補</div><div class="opp-roster-list">${oppRoster.bench.length?oppRoster.bench.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">先發輪值</div><div class="opp-roster-list">${oppRoster.rotation.length?oppRoster.rotation.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div><div class="opp-roster-sec"><div class="opp-roster-sec-title">牛棚</div><div class="opp-roster-list">${oppRoster.bullpen.length?oppRoster.bullpen.map(player=>`<span>${cleanName(player.name)}</span>`).join(''):'<span>無</span>'}</div></div></div>`:''}</div></div><div style="text-align:right;flex-shrink:0"><div class="opp-str" style="color:${dc}">${oppPreview.overall}</div><div style="font-size:9px;color:${dc}">戰力差 ${diffTxt}</div></div><div class="opp-arr">›</div>`;
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
    const dynastyTeams=PLAYABLE_WBC_ERAS
      .map(era=>{
        const champ=era.teams.find(t=>t.champion);
        const top=champ||[...era.teams].sort((a,b)=>b.str-a.str)[0];
        return top?{...top,_eraLabel:era.label,_eraYear:era.year}:null;
      })
      .filter(Boolean)
      .slice()
      .sort((a,b)=>b.str-a.str||b._eraYear-a._eraYear)
      .slice(0,6);
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
  const n=getNationConfig(myNation);
  const myFlag=n?n.flag:'🇹🇼';
  document.getElementById('gs-my-flag').textContent=myFlag;
  document.getElementById('gs-opp-flag').textContent=opp.flag;
  document.getElementById('gs-opp-nm').textContent=opp.name;
  ['gs-s1','gs-s2'].forEach(id=>document.getElementById(id).textContent='0');
  document.getElementById('gs-inn').textContent='第 1 局上';
  document.getElementById('gs-log').innerHTML='';
  document.getElementById('gb-next').disabled=false;
  document.getElementById('gb-auto').disabled=false;
  document.getElementById('game-result').classList.remove('show');
  const grBox=document.getElementById('gr-box');
  if(grBox)grBox.innerHTML='';
  const {batBonus,pitBonus}=getCoachBonus();

  const myBatSlots=battingOrder.map(lineupIdx=>lineup[lineupIdx]?{player:lineup[lineupIdx],idx:lineupIdx}:null).filter(Boolean);
  const myBatOvr=myBatSlots.length>0
    ?Math.round(myBatSlots.reduce((sum,slot)=>sum+getEffectiveOvr(slot.player,'lineup',slot.idx),0)/myBatSlots.length)+Math.round(batBonus/10)
    :72;
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
  const myTeamOvr=clampRating(myBatOvr*.56+displayMyPitOvr*.44);
  const oppTeamOvr=clampRating(oppBatOvr*.56+displayOppPitOvr*.44);

  gs={inning:1,half:'top',outs:0,bases:[null,null,null],scores:[0,0],done:false,opp,
    myStr:Math.min(99,myBatOvr),
    myPitStr:Math.min(99,displayMyPitOvr),
    myTeamOvr,
    oppBatOvr,
    oppPitOvr:Math.min(99,displayOppPitOvr),
    oppTeamOvr,
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
  addGameLog(`⚾ 比賽開始！我方打線${myBatOvr} / 先發投手${displayMyPitOvr}  vs  對手打線${oppBatOvr} / 先發投手${displayOppPitOvr}`,'sys');
  updateGameUI();
}
function getCurPitcher(isTop){return isTop?(gs.oppPitchers[gs.oppPitIdx]||gs.oppPitchers[0]):(gs.myPitchers[gs.myPitIdx]||gs.myPitchers[0]);}
function getCurBatter(isTop){if(isTop){if(!gs.myBatters.length)return null;return gs.myBatters[gs.myBatterIdx%gs.myBatters.length];}if(!gs.oppBatters.length)return null;return gs.oppBatters[gs.oppBatterIdx%gs.oppBatters.length];}
function clampRating(val,min=40,max=99){
  return Math.max(min,Math.min(max,Math.round(val)));
}
function getOpponentYearPool(opp){
  const exact=ALL_PLAYERS.filter(player=>player.nat===opp.flag&&player.year===opp.era);
  if(exact.length)return exact;
  const sameNation=ALL_PLAYERS
    .filter(player=>player.nat===opp.flag)
    .sort((a,b)=>Math.abs((a.year??opp.era)-opp.era)-Math.abs((b.year??opp.era)-opp.era)||b.ovr-a.ovr);
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
      ab:0,h:0,hr:0,rbi:0,
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
    ab:0,h:0,hr:0,rbi:0,
  };
}
function buildPitcherProfile({name,ovr=75,type='SP',player=null}){
  const stuff=player?(getAbilityValue(player,0)||ovr):clampRating(ovr+3);
  const control=player?(getAbilityValue(player,1)||ovr):clampRating(ovr);
  const breakBall=player?(getAbilityValue(player,2)||ovr):clampRating(ovr+1);
  const mental=player?(getAbilityValue(player,4)||ovr):clampRating(ovr);
  return {
    name,ovr,stamina:100,type,
    stuff,control,breakBall,mental,
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
  batters.filter(player=>!usedBatters.has(getPlayerKey(player))).forEach(player=>bench.push(player));

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
  [['base1',0],['base2',1],['base3',2]].forEach(([id,i])=>{
    const el=document.getElementById(id);
    if(el){
      el.style.background=gs.bases[i]?'#f0c030':'#1a4a2a';
      el.style.boxShadow=gs.bases[i]?'0 0 6px rgba(240,192,48,.5)':'';
    }
  });
  [['out1',0],['out2',1],['out3',2]].forEach(([id,i])=>{
    const el=document.getElementById(id);
    if(el){
      el.style.background=i<gs.outs?'#f06070':'#1a4a2a';
      el.style.boxShadow=i<gs.outs?'0 0 5px rgba(240,96,112,.5)':'';
    }
  });
  const pNm=document.getElementById('gs-pitcher-name');
  if(pNm)pNm.textContent=pitcher.name;
  const stam=Math.max(0,Math.round(pitcher.stamina));
  const pct=document.getElementById('gs-stamina-pct');
  if(pct)pct.textContent=stam+'%';
  const bar=document.getElementById('gs-stamina-bar');
  if(bar){
    bar.style.width=stam+'%';
    bar.style.background=stam>60?'#4adb6a':stam>30?'#f0c030':'#f06070';
  }
  const bNm=document.getElementById('gs-batter-name');
  if(bNm)bNm.textContent=batter.name;
  const bSt=document.getElementById('gs-batter-stat');
  if(bSt)bSt.textContent=batter.ab+'打 '+batter.h+'安 '+batter.hr+'轟';
  const myNow=document.getElementById('gs-my-now');
  const oppNow=document.getElementById('gs-opp-now');
  if(isTop){
    if(myNow)myNow.textContent='🏏 '+batter.name;
    if(oppNow)oppNow.textContent='⚾ '+pitcher.name;
  }else{
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
  const offenseTeamOvr=isTop?(gs.myTeamOvr??gs.myStr):(gs.oppTeamOvr??gs.oppBatOvr);
  const defenseTeamOvr=isTop?(gs.oppTeamOvr??gs.oppPitOvr):(gs.myTeamOvr??gs.myPitStr);
  const directOvrEdge=(batOvr-pitOvr)*0.22;
  const contactEdge=((batter?.contact??batOvr)-(pitcher?.stuff??pitOvr))*0.16;
  const disciplineEdge=((batter?.eye??batOvr)-(pitcher?.control??pitOvr))*0.13;
  const mentalEdge=((batter?.mental??batOvr)-(pitcher?.mental??pitOvr))*0.07;
  const teamEdge=(offenseTeamOvr-defenseTeamOvr)*0.24;
  const scorePressure=(getOffenseScore(isTop)-getDefenseScore(isTop))*0.06;
  const staminaBonus=(100-pitcher.stamina)*0.22;
  const rawDiff=(directOvrEdge+contactEdge+disciplineEdge+mentalEdge+teamEdge+scorePressure+staminaBonus)/100;
  const sig=Math.max(0.20,Math.min(0.80,1/(1+Math.exp(-rawDiff*2.85))));
  return {sig,batOvr,pitOvr,pitcher,batter};
}
function updateFormula(){
  const {sig,batOvr,pitOvr,batter}=calcMatchSig();
  const hitRate=Math.round(sig*30+6+((batter?.contact??70)-70)*0.06);
  const hrRate=Math.max(1,Math.round(sig*6+((batter?.power??70)-70)*0.035));
  const kRate=Math.max(10,Math.round((1-sig)*34+10-((batter?.eye??70)-70)*0.04));
  const f=document.getElementById('gs-formula');
  if(!f)return;
  const diff=batOvr-pitOvr;
  const adv=diff>0?`<span style="color:#4adb6a;font-size:9px">▲${diff}</span>`
    :diff<0?`<span style="color:#f06070;font-size:9px">▼${Math.abs(diff)}</span>`
    :`<span style="color:#d4a017;font-size:9px">均衡</span>`;
  f.innerHTML=`<div class="gf-i"><div class="gf-l">投手OVR</div><div class="gf-v" style="color:#e05060">${pitOvr}</div></div><div class="gf-s">vs</div><div class="gf-i"><div class="gf-l">打者OVR</div><div class="gf-v" style="color:#d4a017">${batOvr}</div></div><div class="gf-s">${adv}</div><div class="gf-i"><div class="gf-l">安打率</div><div class="gf-v" style="color:#6adb6a">${hitRate}%</div></div><div class="gf-s">|</div><div class="gf-i"><div class="gf-l">HR率</div><div class="gf-v" style="color:#f0c030">${hrRate}%</div></div><div class="gf-s">|</div><div class="gf-i"><div class="gf-l">三振率</div><div class="gf-v" style="color:#cc88ff">${kRate}%</div></div>`;
}
function getOffenseBench(isTop){return isTop?gs.myBench:gs.oppBench;}
function getOffenseBatters(isTop){return isTop?gs.myBatters:gs.oppBatters;}
function getOffenseScore(isTop){return gs.scores[isTop?0:1];}
function getDefenseScore(isTop){return gs.scores[isTop?1:0];}
function advanceRunnersOnOut({allowSecondToThird=false,allowThirdToHome=false}={}){
  const nextBases=[null,null,null];
  let scored=0;
  if(gs.bases[2]){
    if(allowThirdToHome)scored++;
    else nextBases[2]=gs.bases[2];
  }
  if(gs.bases[1]){
    if(!nextBases[2]&&allowSecondToThird)nextBases[2]=gs.bases[1];
    else nextBases[1]=gs.bases[1];
  }
  if(gs.bases[0])nextBases[0]=gs.bases[0];
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
    if(gs.outs<3&&runnerOnFirst&&Math.random()<0.12)scored++;
    else nextBases[2]=runnerOnThird;
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
    if(gs.bases[1]&&Math.random()<0.18)scored++;
    else nextBases[2]=gs.bases[2];
  }
  if(gs.bases[1])nextBases[2]=gs.bases[1];
  gs.outs+=2;
  gs.bases=nextBases;
  return {scored};
}
function resolveSacrificeBunt(){
  gs.outs++;
  let scored=0;
  const nextBases=[null,null,null];
  const buntScores=!!gs.bases[2]&&Math.random()<0.18;
  if(buntScores)scored++;
  else if(gs.bases[2])nextBases[2]=gs.bases[2];
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
    .sort((a,b)=>(b.atBatOvr-a.atBatOvr)||((b.power+b.contact)-(a.power+a.contact)))[0];
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
  const shW=gs.outs<2&&!!gs.bases[0]?Math.max(0.0015,(1-sig)*0.011+0.0012-contactAdj*0.12):0;
  const sfW=gs.outs<2&&!!gs.bases[2]?Math.max(0.004,sig*0.016+0.0025+powerAdj*0.18):0;
  const hrW=Math.max(0.003,sig*0.060-0.006+powerAdj*0.9+mentalAdj);
  const h3W=Math.max(0.002,sig*0.018-0.003+speedAdj+contactAdj*0.22);
  const h2W=Math.max(0.016,sig*0.092+0.008+contactAdj*0.8+powerAdj*0.45+speedAdj*0.25);
  const h1W=Math.max(0.052,sig*0.182+0.022+contactAdj+speedAdj*0.32);
  const bbW=Math.max(0.022,sig*0.066+0.010+eyeAdj*0.95);
  const kW=Math.max(0.075,(1-sig)*0.355+0.072-eyeAdj-contactAdj*0.28);
  const goW=Math.max(0.052,(1-sig)*0.315+0.066-speedAdj*0.22);
  const foW=Math.max(0.048,(1-sig)*0.270+0.050-powerAdj*0.12);
  const dpW=gs.bases[0]&&gs.outs<2?Math.max(0.003,(1-sig)*0.038+0.0035-speedAdj*0.45):0;
  const total=shW+sfW+hrW+h3W+h2W+h1W+bbW+kW+goW+foW+dpW;
  const ws=[shW,sfW,hrW,h3W,h2W,h1W,bbW,kW,goW,foW,dpW].map(w=>w/total);
  const ts=['sh','sf','hr','h3','h2','h1','bb','k','go','fo','dp'];
  let r=Math.random(),c=0;
  for(let i=0;i<ws.length;i++){
    c+=ws[i];
    if(r<c)return ts[i];
  }
  return 'go';
}
function simNext(){
  if(!gs||gs.done)return;
  const isTop=gs.half==='top';
  maybePinchHit(isTop);
  if(attemptSteal(isTop)){
    if(gs.outs>=3){
      gs.outs=0;
      gs.bases=[null,null,null];
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
  }else if(t==='sh'){
    const result=resolveSacrificeBunt();
    scored=result.scored;
    batter.rbi+=scored;
  }else if(t==='sf'){
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
  }else if(t==='go'){
    const result=resolveGroundOut();
    scored=result.scored;
    batter.rbi+=scored;
  }else if(t==='fo'){
    gs.outs++;
    scored=advanceRunnersOnOut({allowSecondToThird:Math.random()<0.28});
    batter.rbi+=scored;
  }else if(t==='dp'){
    const result=resolveDoublePlay();
    scored=result.scored;
    batter.rbi+=scored;
  }else if(t==='bb'){
    if(isTop)gs.stats.myBB++;else gs.stats.oppBB++;
    if(gs.bases[0]&&gs.bases[1]&&gs.bases[2])scored=1;
    if(gs.bases[1]&&gs.bases[0])gs.bases[2]=gs.bases[1];
    if(gs.bases[0])gs.bases[1]=gs.bases[0];
    gs.bases[0]={...batter};
    batter.rbi+=scored;
  }else{
    batter.h++;
    if(isTop)gs.stats.myH++;else gs.stats.oppH++;
    const adv=t==='hr'?4:t==='h3'?3:t==='h2'?2:1;
    for(let i=2;i>=0;i--)if(gs.bases[i]&&i+adv>=3)scored++;
    if(t==='hr'){
      scored++;
      gs.bases=[null,null,null];
      batter.hr++;
      if(isTop)gs.stats.myHR++;else gs.stats.oppHR++;
    }else{
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
    gs.outs=0;
    gs.bases=[null,null,null];
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
  }
  document.getElementById('gs-inn').textContent='第'+gs.inning+'局'+(gs.half==='top'?'上':'下');
  updateGameUI();
}
function addGameLog(txt,cls){
  const log=document.getElementById('gs-log');
  const mid=document.querySelector('.gs-mid');
  const el=document.createElement('div');
  el.className='gl-e gl-'+cls;
  el.textContent=txt;
  log.appendChild(el);
  requestAnimationFrame(()=>{
    if(mid)mid.scrollTop=mid.scrollHeight;
    log.scrollTop=log.scrollHeight;
  });
}
function simAuto(){
  if(simTimer)return;
  document.getElementById('gb-next').disabled=true;
  document.getElementById('gb-auto').disabled=true;
  simTimer=setInterval(()=>{
    simNext();
    if(gs&&gs.done){
      clearInterval(simTimer);
      simTimer=null;
    }
  },60);
}
function endGame(){
  if(simTimer){
    clearInterval(simTimer);
    simTimer=null;
  }
  gs.done=true;
  document.getElementById('gb-next').disabled=true;
  document.getElementById('gb-auto').disabled=true;
  const s1=gs.scores[0],s2=gs.scores[1];
  const win=s1>s2;
  const winReward=win?100:0;
  const shutoutBonus=(win&&s2===0)?50:0;
  const hrReward=gs.stats.myHR*10;
  const isJourney=gs.opp&&gs.opp._challengeType!=='dynasty';
  const journeyStars=calcJourneyStars({win,margin:s1-s2,runsAllowed:s2});
  const journeyKey=isJourney?getJourneyKey(gs.opp):null;
  const bestJourneyStars=journeyKey?Math.max(journeyProgress?.[journeyKey]||0,journeyStars):0;
  const dynastyKey=gs.opp&&gs.opp._challengeType==='dynasty'?gs.opp._dynastyKey:null;
  const dynastyFirstClear=!!(win&&dynastyKey&&!clearedDynasties.includes(dynastyKey));
  const dynastyReward=dynastyFirstClear?150:0;
  if(dynastyFirstClear)clearedDynasties=[...clearedDynasties,dynastyKey];
  if(journeyKey&&win){
    journeyProgress={...(journeyProgress||{}),[journeyKey]:bestJourneyStars};
  }
  const totalReward=winReward+shutoutBonus+hrReward+dynastyReward;
  document.getElementById('gr-banner').textContent=win?'🏆 勝利！':'敗北';
  document.getElementById('gr-banner').className='gr-banner '+(win?'win':'loss');
  document.getElementById('gr-score').textContent=s1+' : '+s2;
  const {batBonus}=getCoachBonus();
  document.getElementById('gr-stats').innerHTML=`<div class="gr-row"><span>對手</span><span class="gr-val">${gs.opp.name}</span></div><div class="gr-row"><span>比分</span><span class="gr-val">${s1} : ${s2}</span></div>${isJourney&&win?`<div class="gr-row"><span>征途評價</span><span class="gr-val" style="color:#f0c030">${'★'.repeat(journeyStars)}${'☆'.repeat(Math.max(0,3-journeyStars))}</span></div><div class="gr-row"><span>最佳紀錄</span><span class="gr-val" style="color:#7ce28c">${'★'.repeat(bestJourneyStars)}${'☆'.repeat(Math.max(0,3-bestJourneyStars))}</span></div>`:''}<div class="gr-row"><span>安打</span><span class="gr-val">${gs.stats.myH} : ${gs.stats.oppH}</span></div><div class="gr-row"><span>全壘打</span><span class="gr-val">${gs.stats.myHR} : ${gs.stats.oppHR}</span></div><div class="gr-row"><span>奪三振</span><span class="gr-val">${gs.stats.myK} : ${gs.stats.oppK}</span></div><div class="gr-row"><span>保送</span><span class="gr-val">${gs.stats.myBB} : ${gs.stats.oppBB}</span></div>${batBonus>0?'<div class="gr-row"><span>教練加成</span><span class="gr-val" style="color:#d4a017">+'+batBonus+'</span></div>':''}${dynastyFirstClear?'<div class="gr-row"><span>王朝首通</span><span class="gr-val" style="color:#7ce28c">+150 💎</span></div>':''}${totalReward>0?`<div class="gr-row"><span>比賽獎勵</span><span class="gr-val" style="color:#f0c030">+${totalReward} 💎</span></div>`:''}`;
  const box=document.getElementById('gr-box');
  if(box&&gs.myBatters){
    const rows=gs.myBatters.filter(b=>b.ab>0).map(b=>{
      const avg=b.ab>0?(b.h/b.ab).toFixed(3).replace('0.','.'):'.000';
      return '<div style="display:flex;gap:6px;font-size:9px;padding:3px 0;border-bottom:.5px solid #1a4a2a;align-items:center"><span style="flex:1;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+b.name+'</span><span style="color:rgba(255,255,255,.5);width:20px;text-align:right">'+b.ab+'</span><span style="color:#4adb6a;width:18px;text-align:right">'+b.h+'</span><span style="color:#f0c030;width:18px;text-align:right">'+b.hr+'</span><span style="color:#cc88ff;width:18px;text-align:right">'+b.rbi+'</span><span style="color:rgba(255,255,255,.4);width:30px;text-align:right">'+avg+'</span></div>';
    }).join('');
    box.innerHTML='<div style="display:flex;gap:6px;font-size:8px;padding:2px 0 4px;border-bottom:.5px solid #2a6a3a;color:rgba(74,219,106,.7)"><span style="flex:1">打者</span><span style="width:20px;text-align:right">打</span><span style="width:18px;text-align:right">安</span><span style="width:18px;text-align:right">轟</span><span style="width:18px;text-align:right">點</span><span style="width:30px;text-align:right">打率</span></div>'+rows;
  }
  if(totalReward>0){
    gems+=totalReward;
    updateGemDisp();
  }
  dailyState.match=Math.min(1,dailyState.match+1);
  saveDailyState();
  addActivity(
    win?'🏆':'💔',
    win?`${gs.opp.name} ${dynastyFirstClear?'王朝首通完成':isJourney?`征途 ${journeyStars}★ 擊敗`:'擊敗'} (${s1}:${s2})`:`不敵 ${gs.opp.name} (${s1}:${s2})`,
    totalReward>0?`+${totalReward} 💎`:'繼續加油！'
  );
  document.getElementById('game-result').classList.add('show');
  renderMatchSetup();
  tickScouts();
  autoSave();
}
function closeGame(){
  if(simTimer){
    clearInterval(simTimer);
    simTimer=null;
  }
  gs=null;
  document.getElementById('game-result').classList.remove('show');
  document.getElementById('gr-box').innerHTML='';
  document.getElementById('gr-stats').innerHTML='';
  document.getElementById('gs-log').innerHTML='';
  document.getElementById('gs-s1').textContent='0';
  document.getElementById('gs-s2').textContent='0';
  document.getElementById('gs-inn').textContent='準備中';
  document.getElementById('gs-my-now').textContent='—';
  document.getElementById('gs-opp-now').textContent='—';
  document.getElementById('gs-pitcher-name').textContent='—';
  document.getElementById('gs-batter-name').textContent='—';
  document.getElementById('gs-batter-stat').textContent='—';
  document.getElementById('gs-stamina-pct').textContent='100%';
  document.getElementById('gs-stamina-bar').style.width='100%';
  document.getElementById('gs-stamina-bar').style.background='#4adb6a';
  document.getElementById('gs-formula').innerHTML='';
  [['base1',0],['base2',1],['base3',2]].forEach(([id])=>{
    const el=document.getElementById(id);
    if(el){
      el.style.background='#1a4a2a';
      el.style.boxShadow='';
    }
  });
  [['out1',0],['out2',1],['out3',2]].forEach(([id])=>{
    const el=document.getElementById(id);
    if(el){
      el.style.background='#1a4a2a';
      el.style.boxShadow='';
    }
  });
  document.getElementById('gb-next').disabled=false;
  document.getElementById('gb-auto').disabled=false;
  document.getElementById('game-screen').classList.remove('show');
}
function resetGame(){
  const opp=gs?.opp?{...gs.opp}:null;
  document.getElementById('game-result').classList.remove('show');
  document.getElementById('gr-box').innerHTML='';
  if(!opp)return;
  startGame(opp);
}
