/* ============================================================
   Diamond Nations — bootstrap.js
   先載資料，再依序載入遊戲腳本
   ============================================================ */

(function () {
  const SCRIPT_ORDER = [
    'players-data.js?v=90',
    'nations-data.js?v=90',
    'game/core.js?v=90',
    'game/api.js?v=90',
    'game/home.js?v=90',
    'game/team.js?v=90',
    'game/app.js?v=90',
    'game/match.js?v=90',
  ];

  function ensureBootSplash() {
    let splash = document.getElementById('boot-splash');
    if (splash) return splash;
    splash = document.createElement('div');
    splash.id = 'boot-splash';
    splash.style.cssText = 'position:fixed;inset:0;z-index:9998;background:linear-gradient(180deg,#f6f2ea 0%,#ece6db 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:"Noto Sans TC",sans-serif;text-align:center;padding:24px';
    splash.innerHTML =
      '<div style="font-size:42px">⚾</div>' +
      '<div style="font-size:20px;font-weight:800;color:#0f4a28">Diamond Nations</div>' +
      '<div id="boot-splash-text" style="font-size:12px;color:#786b55;line-height:1.7">正在載入球員資料與遊戲系統...</div>';
    document.body.appendChild(splash);
    return splash;
  }

  function setBootText(text) {
    const el = document.getElementById('boot-splash-text');
    if (el) el.textContent = text;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('載入腳本失敗：' + src));
      document.body.appendChild(script);
    });
  }

  async function boot() {
    ensureBootSplash();
    try {
      setBootText('正在連接資料來源...');
      await window.loadStaticGameData();
      for (const src of SCRIPT_ORDER) {
        setBootText('正在載入 ' + src.replace(/\?.*$/, '') + ' ...');
        await loadScript(src);
      }
      document.getElementById('boot-splash')?.remove();
    } catch (err) {
      console.error('[bootstrap] 啟動失敗：', err);
      setBootText('啟動失敗，請確認 FastAPI 與靜態資料是否可用。');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
