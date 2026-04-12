/* ============================================================
   Diamond Nations — packs-data.js
   卡包配置：PACKS
   ============================================================ */

window.PACKS=[
  {
    id:'std',name:'標準卡包',emoji:'📦',color:'#5a7aee',bg:'rgba(90,122,238,.08)',
    desc:'所有現役球員',
    // FGO 風格：前 10 抽各自判定，每抽獨立保底
    rates:{h:3,l:9,r:28,c:60},
    pity:90,            // 硬天井（90抽必出HERO）
    softPity:75,        // 軟保底起點
    softStep:6,         // 每抽+6%
    tenGuarantee:'r',   // 十連保底最低 RARE
    up:null,            // 無UP
  },
  {
    id:'legend',name:'傳奇卡包',emoji:'🏆',color:'#d4a017',bg:'rgba(212,160,23,.1)',
    desc:'歷代傳奇球員・LEGEND 12%',
    rates:{h:3,l:12,r:25,c:60},
    pity:90,softPity:75,softStep:6,tenGuarantee:'l',
    up:{name:'松坂大輔 / 李承燁 / Derek Jeter',upBonus:50}, // UP池：HERO中50%機率為UP球員
  },
  {
    id:'limit',name:'限定 WBC 卡包',emoji:'🔥',color:'#e05060',bg:'rgba(224,80,96,.08)',
    desc:'限定球員 UP・HERO 5%・天井 60 抽',
    rates:{h:5,l:12,r:23,c:60},
    pity:60,softPity:45,softStep:8,tenGuarantee:'r',
    up:{name:'大谷翔平 [2023] / Ronald Acuña Jr.',upBonus:70},
  },
  {
    id:'taiwan',name:'台灣精選',emoji:'🇹🇼',color:'#4adb6a',bg:'rgba(74,219,106,.08)',
    desc:'台灣球員 UP・HERO 機率 +1%',
    rates:{h:4,l:12,r:26,c:58},
    pity:80,softPity:65,softStep:7,tenGuarantee:'r',
    up:{name:'古林睿煬 / 張育成',upBonus:80},
  },
  {
    id:'retro',name:'復古傳說',emoji:'📸',color:'#8b4513',bg:'rgba(139,69,19,.08)',
    desc:'RETRO 限定・OVR 99 保證',
    rates:{h:2,l:8,r:26,c:54,x:10}, // x=RETRO
    pity:50,softPity:35,softStep:10,tenGuarantee:'l',
    up:{name:'王建民 [2013 傳奇] / 松坂大輔 [2006 傳奇]',upBonus:60},
  },
];
