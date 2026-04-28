/* ============================================================
   Diamond Nations — data-loader.js
   從 FastAPI / JSON 非同步載入靜態遊戲資料
   取代：players-all.js、nations/*.js、packs-data.js、coaches-data.js、eras-data.js
   ============================================================ */
(function () {
  const PREFIX = location.protocol === 'file:' ? 'http://localhost:8000' : '';

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function load(resource) {
    const tries = [
      PREFIX + '/api/data/' + resource,
      PREFIX + '/data/' + resource + '.json',
    ];
    let lastError = null;
    for (const url of tries) {
      try {
        return await getJson(url);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error('無法載入 ' + resource + '（已試 ' + tries.join(' / ') + '，最後錯誤：' + (lastError?.message || 'unknown') + '）');
  }

  function resetDataGlobals() {
    window.RAW_ALL_PLAYERS = [];
    window.RAW_NATIONS = [];
    window.PACKS = [];
    window.ALL_COACHES = [];
    window.COACH_TYPES = [];
    window.WBC_ERAS = [];
    window.OPPS = [];
    window.PLAYS = [];
  }

  function showFatalError(msg) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="position:fixed;inset:0;z-index:9999;background:#0a1f10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:sans-serif;padding:24px;text-align:center">' +
        '<div style="font-size:40px">⚾</div>' +
        '<div style="font-size:18px;font-weight:700;color:#4adb6a">Diamond Nations</div>' +
        '<div style="font-size:13px;color:#f06070;max-width:320px;line-height:1.6">' + msg + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.4);max-width:320px;line-height:1.7">' +
          '請在專案目錄執行：<br>' +
          '<code style="background:rgba(255,255,255,.08);padding:6px 12px;border-radius:6px;font-size:12px">' +
          'uvicorn main:app --reload</code><br>' +
          '然後開啟 <a href="http://localhost:8000" style="color:#4adb6a">http://localhost:8000</a>' +
        '</div>' +
      '</div>'
    );
  }

  async function loadStaticGameData() {
    try {
      const [players, nations, packs, coachData, eraData] = await Promise.all([
        load('players'),
        load('nations'),
        load('packs'),
        load('coaches'),
        load('eras'),
      ]);

      window.RAW_ALL_PLAYERS = players;
      window.RAW_NATIONS = nations;
      window.PACKS = packs;
      window.ALL_COACHES = coachData.coaches;
      window.COACH_TYPES = coachData.coachTypes;
      window.WBC_ERAS = eraData.eras;
      window.OPPS = eraData.eras[eraData.eras.length - 1]?.teams || [];
      window.PLAYS = eraData.plays;

      console.info('[data-loader] ✓  players=%d nations=%d packs=%d coaches=%d eras=%d',
        window.RAW_ALL_PLAYERS.length, window.RAW_NATIONS.length, window.PACKS.length,
        window.ALL_COACHES.length, window.WBC_ERAS.length);
      return true;
    } catch (e) {
      console.error('[data-loader] 載入失敗：', e.message);
      resetDataGlobals();
      showFatalError('無法連接遊戲伺服器，請先啟動 FastAPI。');
      throw e;
    }
  }

  window.loadStaticGameData = loadStaticGameData;
})();
