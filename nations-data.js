/* ============================================================
   Diamond Nations — nations-data.js
   國家配置：NATIONS
   ============================================================ */

window.NATIONS = (window.RAW_NATIONS || []);

// 以 id 快速查找國家設定
const NATION_BY_ID = new Map(window.NATIONS.map(n => [n.id, n]));
function getNationConfig(id) { return NATION_BY_ID.get(id) ?? null; }

// 取得某國家的 WBC 冠軍次數
function getWbcTitles(id) {
  const n = getNationConfig(id);
  if (!n) return 0;
  return (n.wbcHistory || []).filter(h => h.champion).length;
}
