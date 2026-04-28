# Diamond Nations 遊戲架構與邏輯

這份文件整理目前 `Diamond Nations` 的整體架構、資料流、主要模組分工，以及核心遊戲邏輯。目標不是行銷專案，而是作為工程與產品視角的系統說明。

---

## 1. 專案定位

`Diamond Nations` 是一個以 WBC 為主題的運動題材卡牌收集與比賽模擬遊戲。玩家會從國家代表隊開始，透過抽卡、收藏、組隊、比賽、征途、王朝、教練與球探系統，逐步建立自己的國家隊陣容。

核心設計目標有三個：

- 把真實球員資料映射成可玩的卡牌與模擬系統
- 把收藏、進度、獎勵與比賽結果串成完整主循環
- 讓專案從單機前端原型演進成較清楚的資料層與前後端結構

---

## 2. 整體架構

目前專案可以分成四層：

1. 靜態資料層
2. FastAPI 後端層
3. 前端啟動與資料載入層
4. 前端遊戲模組層

### 2.1 靜態資料層

目前靜態資料集中在 `data/*.json`：

- `data/players.json`
- `data/nations.json`
- `data/packs.json`
- `data/coaches.json`
- `data/eras.json`

這些檔案是目前遊戲內容的 source of truth。前端不再直接依賴舊版的 `players-all.js`、`packs-data.js`、`coaches-data.js`、`eras-data.js`、`nations/*.js`。

### 2.2 FastAPI 後端層

後端進入點是 [`main.py`](./main.py)。

主要提供兩類 API：

- 靜態資料 API：`/api/data/{resource}`
- 存檔 API：`/api/saves/{slot}`

其中 `resource` 目前允許：

- `players`
- `nations`
- `packs`
- `coaches`
- `eras`

另外還有：

- `/api/health`：檢查服務狀態與目前已存在的存檔槽

後端同時用 `StaticFiles` 直接提供前端頁面，因此開發時可以直接透過：

```bash
uvicorn main:app --reload
```

然後用 `http://localhost:8000` 進入遊戲。

### 2.3 前端啟動與資料載入層

前端啟動入口目前分成兩段：

- [`data-loader.js`](./data-loader.js)
- [`bootstrap.js`](./bootstrap.js)

`data-loader.js` 負責：

- 透過 `async/await` 載入所有靜態資料
- 優先嘗試 `/api/data/{resource}`
- 若 API 失敗，再退回 `/data/{resource}.json`
- 將資料寫到全域變數，例如：
  - `window.RAW_ALL_PLAYERS`
  - `window.RAW_NATIONS`
  - `window.PACKS`
  - `window.ALL_COACHES`
  - `window.COACH_TYPES`
  - `window.WBC_ERAS`
  - `window.OPPS`
  - `window.PLAYS`

`bootstrap.js` 負責：

- 顯示啟動畫面
- 等待 `loadStaticGameData()` 完成
- 依序載入前端遊戲腳本
- 避免在資料尚未可用前就初始化遊戲邏輯

這讓目前專案的初始化流程從「一口氣用多個 `<script>` 同步灌資料」演進成比較明確的 async bootstrap。

### 2.4 前端遊戲模組層

目前主要模組如下：

- [`game-core.js`](./game-core.js)
- [`game-api.js`](./game-api.js)
- [`game-home.js`](./game-home.js)
- [`game-team.js`](./game-team.js)
- [`game-match.js`](./game-match.js)
- [`game.js`](./game.js)

---

## 3. 模組分工

### 3.1 `game-core.js`

這是整個遊戲的核心狀態與共用工具層。

主要責任：

- 定義中央狀態 `GameState`
- 管理 `localStorage` 存檔
- 十槽存檔系統
- 自動存檔
- 存檔建構與還原
- 玩家資料快取、查詢與共用工具

`GameState` 目前包含：

- 寶石、保底、所屬國家、傳奇球員
- 收藏球員
- 先發、打序、板凳、輪值、牛棚
- 教練擁有與裝備狀態
- 比賽次數
- 王朝通關紀錄
- 征途星等進度
- 球探候選人與歸化球員
- 球探等級與派遣狀態

`GameState` 是整個遊戲狀態的中心，其他模組讀寫時會透過同步函式與其保持一致。

### 3.2 `game-api.js`

這個模組處理前端和 FastAPI 的互動。

主要責任：

- 偵測 FastAPI 是否在線
- 顯示後端同步狀態
- 將自動存檔同步到後端
- 從後端取回存檔
- 更新設定頁同步 UI

這層讓專案不只是純本機 `localStorage` 遊戲，而是具備後端同步能力。

### 3.3 `game-home.js`

這個模組負責首頁與日常留存系統。

主要責任：

- 每日任務狀態讀寫
- 每日獎勵領取
- 最近活動紀錄
- 主頁資料 render

這部分是玩家回流與進度感的重要來源。

### 3.4 `game-team.js`

這個模組負責組隊與名單管理。

主要責任：

- 先發、板凳、輪值、牛棚操作
- 選人 / 換人 / 比較
- 組隊頁 render
- 守位適性與懲罰
- 候補與牛棚名額調整

這層是玩家把收藏轉成真正 playable roster 的核心。

### 3.5 `game-match.js`

這個模組負責比賽與進度模式。

主要責任：

- 比賽入口頁
- 經典賽征途
- 王朝挑戰
- 對手 roster 建構
- 比賽模擬
- 星等與通關結算
- 比賽後獎勵與紀錄

這是目前遊戲邏輯最重的一塊。

### 3.6 `game.js`

這個模組是整體整合層，保留大量主流程與其他系統邏輯。

主要責任：

- 新手流程
- 國家與傳奇選擇
- 主畫面 navigation
- 抽卡系統
- 收藏頁
- 教練系統
- 球探系統
- 設定頁邏輯
- 啟動時讀檔與初始 render

---

## 4. 資料流

目前遊戲資料流大致如下：

1. 使用者打開 `index.html`
2. `data-loader.js` 載入 `data/*.json` 或 FastAPI `/api/data/*`
3. `bootstrap.js` 在資料準備完成後依序載入遊戲模組
4. `players-data.js` 先把原始球員資料正規化成 `ALL_PLAYERS`
5. 其他遊戲模組開始初始化
6. `game.js` 啟動時先讀每日任務、再讀取自動存檔
7. 若有存檔且國家存在，直接進主頁；否則進新手選國家流程
8. 遊戲進行中，狀態寫回 `GameState`
9. 存檔時同時寫入：
   - 本地 `localStorage`
   - 若後端在線，透過 `game-api.js` 同步到 FastAPI

---

## 5. 球員資料處理邏輯

球員資料的原始入口是 `window.RAW_ALL_PLAYERS`，由 `data-loader.js` 載入後交給 [`players-data.js`](./players-data.js) 處理。

`players-data.js` 的責任：

- 正規化球員 `id`
- 正規化年份與守位資料
- 正規化技能資料
- 驗證 rarity、守位、stats 長度等欄位
- 建立：
  - `window.ALL_PLAYERS`
  - `window.ALL_PLAYERS_BY_ID`
  - `window.PLAYER_SKILLS`
  - `window.PLAYER_SKILL_MAP`

這層讓前端遊戲邏輯不需要直接處理髒資料，而是使用已正規化的球員物件。

---

## 6. 主遊戲循環

遊戲的核心主循環大致是：

1. 選國家
2. 選一位本國傳奇球員
3. 自動建立初始 WBC 30 人名單
4. 進入主頁
5. 透過以下系統持續循環：
   - 抽卡
   - 收藏
   - 組隊
   - 教練
   - 球探
   - 比賽
   - 征途 / 王朝
6. 得到獎勵後再回頭優化陣容與收藏

如果用產品角度來看，主循環可以簡化成：

`收集 → 組隊 → 挑戰 → 獎勵 → 再收集 / 再組隊`

---

## 7. 抽卡與收藏邏輯

抽卡相關資料來自 `packs.json`，而前端抽卡流程主要在 `game.js`。

目前抽卡系統包含：

- 多種卡池
- 保底與軟保底
- 十抽保底
- 抽卡歷史
- 重複球員補償

抽到的球員會進入 `collection`，然後：

- 可在收藏頁篩選查看
- 可加入組隊
- 也可能成為後續征途與比賽平衡的素材

收藏頁目前支援：

- 收藏狀態篩選
- 國家篩選
- 類型篩選
- 稀有度篩選

---

## 8. 組隊邏輯

組隊資料主要由：

- `lineup`
- `battingOrder`
- `bench`
- `rotation`
- `bullpen`

組成。

目前的設計重點：

- 先發 9 人、候補野手、先發輪值、牛棚分開管理
- 支援守位適性判斷
- 可開啟守位錯位懲罰
- 候補與牛棚名額總和固定為 16，可在設定調整分配

也就是說，這不是單純把高 OVR 球員塞進隊伍，而是有 roster 結構與位置考量。

---

## 9. 比賽系統邏輯

比賽模擬主要在 `game-match.js`。

### 9.1 對手建立

目前對手不是依賴舊的手工 JS 檔，而是：

- 從 `WBC_ERAS` 決定年代與國家隊框架
- 再從 `ALL_PLAYERS` 依國家與年份建立對手 roster

對手 roster 會分成：

- `starters`
- `bench`
- `rotation`
- `bullpen`

### 9.2 比賽前評估

賽前畫面會先計算：

- 我方打線 / 先發投手評價
- 對手打線 / 先發投手評價
- 綜合戰力差

這讓賽前顯示和實際比賽體感比較一致，而不是只顯示一個靜態 `opp.str`。

### 9.3 打席邏輯

比賽邏輯已從「整隊平均對撞」演進成：

- 當前打者 vs 當前投手

影響打席事件的因素包含：

- 打者 OVR
- `contact`
- `power`
- `eye`
- `speed`
- `mental`
- 投手 OVR
- `stuff`
- `control`
- `breakBall`
- `mental`
- `stamina`
- 整隊戰力差與比數情境

系統會先算出打席傾向，再依權重抽出事件，例如：

- 一壘安打
- 二壘安打
- 三壘安打
- 全壘打
- 保送
- 三振
- 地滾出局
- 飛球出局
- 雙殺
- 犧牲短打 / 高飛犧牲打

### 9.4 比賽進行

每個打席後會更新：

- 壘包
- 出局數
- 得分
- 球員數據
- 投手體力
- 換局 / 換半局 / 換投

另外目前也包含：

- 延長賽
- 自動換投
- 再戰功能
- 比賽中快速模擬

### 9.5 模式進度

目前兩個主要模式：

#### 經典賽征途

- 以年份切分挑戰
- 每隊可記錄最佳星數
- 通關狀態與星等進度存入 `journeyProgress`

#### 王朝挑戰

- 挑戰歷代冠軍或高強度隊伍
- 首通可獲得額外獎勵
- 通關紀錄存入 `clearedDynasties`

---

## 10. 教練與球探系統

### 10.1 教練系統

教練資料來自 `coaches.json`。

主要作用：

- 提供打擊、投手、守備、體能、心理、調度加成
- 玩家可以招募、裝備、升級教練
- 教練效果會回饋到比賽前評價與比賽模擬中

### 10.2 球探系統

球探系統在 `game.js`。

主要作用：

- 派遣球探到不同地區搜尋球員
- 支援免費等待與快速完成
- 產生候選球員後加入收藏
- 球探狀態會進入存檔

這是抽卡之外另一條球員取得管道，也增加了遊戲中長期進度感。

---

## 11. 每日任務與活動邏輯

每日任務在 `game-home.js`。

目前包含：

- 抽卡任務
- 完成比賽
- 裝備教練

特性：

- 以日期切換每日狀態
- 完成後可領寶石
- 最近活動紀錄會把玩家重要行為顯示在主頁

從產品角度，這層主要在補：

- 回流理由
- 輕量獎勵節奏
- 首頁內容密度

---

## 12. 存檔設計

存檔有兩層：

### 12.1 本地存檔

透過 `localStorage`：

- 十槽設計
- `slot 0` 為自動存檔
- 用 `buildSaveable()` 建立可序列化內容
- 用 `restoreSave()` 還原回遊戲狀態

### 12.2 後端同步存檔

若 FastAPI 在線：

- 前端可手動同步目前存檔
- 也可從後端取回存檔
- `game-core.js` 在 `saveToSlot()` 後會排程自動同步

### 12.3 防損毀寫入

後端使用 `tempfile + os.replace` 的 atomic write：

- 新檔先寫到暫存檔
- 成功後再整份 replace

這代表：

- 存檔成功時，會得到完整新檔
- 若寫入中途中斷，原本舊檔仍保持完整

這是針對資料完整性的保護措施。

---

## 13. Service Worker 與快取

目前有 `sw.js`：

- 預先 cache 主要前端資產
- 預先 cache `data/*.json`
- HTML 採 network-first，避免畫面卡在舊版
- 每次調整 cache 名單或入口結構時會升版 cache key

最近也已清理舊資料 JS 檔的 cache 風險，避免瀏覽器繼續拿退役資源。

---

## 14. 目前技術特色

如果從系統設計角度總結，這個專案目前有幾個比較重要的特色：

- 前端模組化而非全塞單檔
- 資料與程式邏輯分層
- Async bootstrap，先載資料再啟動遊戲
- FastAPI 作為資料與存檔 API
- 中央狀態 `GameState`
- 比賽模擬不是假 UI，而是真的數值系統
- 存檔有 atomic write 防損毀

---

## 15. 目前仍可持續優化的方向

目前架構已經比原型期清楚很多，但如果要再往更成熟產品前進，還有幾個方向：

- 把 `game.js` 再繼續拆細
- 補更多比賽事件與真實棒球規則細節
- 為數值平衡加入統計驗證與 simulation analytics
- 把活動記錄也做成持久化資料
- 為作品集與面試準備更明確的 scoring / valuation 說明

---

## 16. 一句話總結

`Diamond Nations` 目前的架構可以概括成：

> 以 `data/*.json` 為資料來源、由 FastAPI 提供 API 與存檔同步、透過 async bootstrap 啟動前端模組化遊戲系統，並用中央狀態 `GameState` 串起收藏、組隊、比賽、進度與存檔的運動題材卡牌模擬遊戲。
