/* ============================================================
   Diamond Nations — players-data.js
   球員資料庫：ALL_PLAYERS
   ============================================================ */

const RAW_ALL_PLAYERS=window.RAW_ALL_PLAYERS||[];
const PLAYER_VALID_POS=new Set(['C','1B','2B','3B','SS','LF','CF','RF','OF','DH','SP','RP','CP']);
const PLAYER_VALID_RAR=new Set(['c','r','l','h','x']);
const PLAYER_DATA_ISSUES=[];
const PLAYER_SKILL_DEFS=new Map();

function makePlayerId(player,year){
  const base=`${player.nat}-${player.name}-${year??'na'}`;
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\p{Letter}\p{Number}]+/gu,'-')
    .replace(/^-+|-+$/g,'')
    .toLowerCase();
}

function pushPlayerIssue(index,message){
  PLAYER_DATA_ISSUES.push(`#${index+1} ${message}`);
}

function makeSkillId(skill){
  const base=`${skill.i||''}-${skill.n||''}-${skill.d||''}`;
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\p{Letter}\p{Number}]+/gu,'-')
    .replace(/^-+|-+$/g,'')
    .toLowerCase();
}

function normalizeSkill(skill,player,index,skillIndex){
  if(!skill||typeof skill!=='object'){
    pushPlayerIssue(index,`${player.name||'unknown'} has invalid skill at index ${skillIndex}`);
    return {id:`invalid-skill-${index}-${skillIndex}`,i:'?',n:'資料錯誤',d:'技能資料異常'};
  }
  const normalized={
    id:skill.id??makeSkillId(skill),
    i:skill.i??'✨',
    n:skill.n??'未命名技能',
    d:skill.d??'',
  };
  const existing=PLAYER_SKILL_DEFS.get(normalized.id);
  if(existing){
    if(existing.i!==normalized.i||existing.n!==normalized.n||existing.d!==normalized.d){
      pushPlayerIssue(index,`${player.name||'unknown'} skill id conflict "${normalized.id}"`);
    }
    return existing;
  }
  const frozen=Object.freeze(normalized);
  PLAYER_SKILL_DEFS.set(frozen.id,frozen);
  return frozen;
}

function normalizePlayer(player,index){
  const year=player.year??player.era?.[0]??null;
  const pos=Array.isArray(player.pos)?[...player.pos]:player.pos?[player.pos]:[];
  const skills=(player.skills||[]).map((skill,skillIndex)=>normalizeSkill(skill,player,index,skillIndex));
  const normalized={
    ...player,
    id:player.id??makePlayerId(player,year),
    year,
    pos,
    skillIds:skills.map(skill=>skill.id),
    skills,
  };

  if(!normalized.name)pushPlayerIssue(index,'missing name');
  if(!normalized.nat)pushPlayerIssue(index,`${normalized.name||'unknown'} missing nat`);
  if(!PLAYER_VALID_RAR.has(normalized.rar))pushPlayerIssue(index,`${normalized.name||'unknown'} has invalid rar "${normalized.rar}"`);
  if(normalized.ovr<0||normalized.ovr>99)pushPlayerIssue(index,`${normalized.name||'unknown'} has out-of-range ovr "${normalized.ovr}"`);
  if(!Array.isArray(normalized.stats)||normalized.stats.length!==5)pushPlayerIssue(index,`${normalized.name||'unknown'} stats length is not 5`);
  if(pos.length===0)pushPlayerIssue(index,`${normalized.name||'unknown'} has no position`);
  pos.forEach(code=>{ if(!PLAYER_VALID_POS.has(code)) pushPlayerIssue(index,`${normalized.name||'unknown'} has invalid pos "${code}"`); });
  if(normalized.pit && !pos.some(code=>['SP','RP','CP'].includes(code)))pushPlayerIssue(index,`${normalized.name||'unknown'} marked as pitcher without pitcher pos`);
  if(!normalized.pit && pos.some(code=>['SP','RP','CP'].includes(code)))pushPlayerIssue(index,`${normalized.name||'unknown'} marked as batter with pitcher pos`);

  return normalized;
}

window.ALL_PLAYERS=RAW_ALL_PLAYERS.map(normalizePlayer);
window.ALL_PLAYERS_BY_ID=new Map(window.ALL_PLAYERS.map(player=>[player.id,player]));
window.PLAYER_SKILLS=[...PLAYER_SKILL_DEFS.values()];
window.PLAYER_SKILL_MAP=new Map(window.PLAYER_SKILLS.map(skill=>[skill.id,skill]));

const PLAYER_DUP_KEYS=new Map();
window.ALL_PLAYERS.forEach((player,index)=>{
  const key=`${player.name}|${player.year??''}`;
  if(PLAYER_DUP_KEYS.has(key))pushPlayerIssue(index,`${player.name} duplicated with year ${player.year??'null'}`);
  else PLAYER_DUP_KEYS.set(key,player.id);
});

if(PLAYER_DATA_ISSUES.length){
  console.warn(
    `[players-data] Found ${PLAYER_DATA_ISSUES.length} data issue(s). Showing up to 20:\n`+
    PLAYER_DATA_ISSUES.slice(0,20).join('\n')
  );
}
