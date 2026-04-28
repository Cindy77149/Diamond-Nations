# Diamond Nations ⚾

WBC 棒球卡牌遊戲，收集球員、組建陣容、挑戰世界各國。

![screenshot](screenshot.png)

---

## 你可以做什麼

- 從 8 個 WBC 國家中選擇你代表的隊伍
- 抽卡收集 1,365 位真實球員，組建 9 人先發陣容
- 挑戰歷屆 WBC 年代對戰，派遣球探搜尋新球員
- 安裝到手機桌面，像 app 一樣使用（PWA）

---

## 技術亮點

**全端架構：FastAPI + Vanilla JS**
後端提供 REST API 管理存檔與遊戲資料，前端純 JS 不依賴框架。

**非同步啟動流程**
`bootstrap.js` 先等所有資料透過 `Promise.all` 載入完成，再依序注入遊戲模組，使用者看到進度畫面而非空白頁。

**存檔不損毀**
使用 `tempfile + os.replace` atomic write，就算中途斷電，原本的存檔也不會壞。

---

## 怎麼跑

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

開啟 [http://localhost:8000](http://localhost:8000)
