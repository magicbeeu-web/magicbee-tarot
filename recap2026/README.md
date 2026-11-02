# 魔法蜜蜂 塔羅版 2026 年度回顧（recap2026/）— PREVIEW，尚未上線

獨立子頁，不改動網站任何既有檔案；共用根目錄的 bee.webp、wordmark.webp、back.webp、bgm.mp3。

## 計分規則
- 每題 A=金、B=水、C=火、D=風；8 題中被選最多次的字母決定能量。
- 該字母被選 ≥5 次 → 強主牌；≤4 次 → 平衡主牌。
  A 皇后/世界、B 戀人/星星、C 太陽/戰車、D 魔術師/女祭司。
- 平手：若第 8 題的答案在平手字母之中，以它為準；否則取平手字母中「最後一次被選到」的那個（由第 8 題往回找）。
  （平手只會發生在 ≤4 次，所以平手一定是平衡主牌。）
- 結果卡「你選了它幾次」顯示真實次數（2/8–8/8）。

## 檔案
- index.html / style.css / app.js / data.js（data.js 由 quiz.md 原文自動產生）
- img/base-*.webp（與 site_results 同一支 make_recap.py 畫的結果卡，次數欄留空）、img/count-N.png（次數貼片）
- fonts/（Source Han Sans TW / Noto Serif CJK 子集，只含頁面用到的字）
- _build/：make_assets.py（重產 data.js 與圖）、subset_fonts.sh（改字後重做字型子集）、qa.py（全組合計分驗證＋截圖）。上線可不上傳 _build/。

## 測試
- `?test=1` 不計 GoatCounter；`?test=1&ans=AAAAABCD` 直接看該組答案的結果。

## 上線步驟（需 Amber 同意後才做）
1. 把整個 recap2026/ 資料夾（可略過 _build/）上傳到 GitHub repo magicbeeu-web/magicbee-tarot 的 main 分支根目錄
   （GitHub 網頁 Add file → Upload files，拖入資料夾；或用 magicbeeu-web 帳號 git push）。
2. GitHub Pages 約 1–2 分鐘後生效：https://magicbeeu-web.github.io/magicbee-tarot/recap2026/
3. 用手機（含 LINE 內建瀏覽器、IG 內建瀏覽器）實測：作答、音樂開關、分享/存圖。
4. 之後若改了 css/js，把 index.html 內的 `?v=` 版本號 +1，避免快取。
