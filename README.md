# YouTube Swipe Sorter 📱🎬

A lightweight, mobile-first web application designed for rapidly reviewing videos from YouTube channels and sorting them into three distinct categories with intuitive swipe gestures:

* **🟢 WATCH**: Videos you want to watch. (Swipe Right `[→]`)
* **🔵 ARCHIVE**: Videos you want to save for reference. (Swipe Down `[↓]`)
* **🔴 AVOID**: Videos you don't want to watch. (Swipe Left `[←]`)

Built as a single self-contained application using HTML5, CSS3, Vanilla JavaScript, IndexedDB, and the official YouTube IFrame Player API.

---

## 🚀 Live App

* **GitHub Pages**: [https://aleonor228-ux.github.io/youtube-swipe-sorter/](https://aleonor228-ux.github.io/youtube-swipe-sorter/)

---

## ✨ Features

- **📱 Mobile-First Touch & Gestures**:
  - Full-card swipe gestures using native Pointer Events & Touch Events.
  - Video player is isolated so you can scrub timelines, seek, or change speed without accidentally classifying.
  - Large, reachable 60px thumb buttons for one-handed operation.
  - Haptic feedback on supported mobile devices.
  - Screen Wake Lock to keep the display active during long backlog triage sessions.

- **🎬 Official YouTube Embed & Autoplay**:
  - **Instant Automatic Playback**: Videos auto-play automatically when loaded and when swiping to the next card without requiring manual clicks on play buttons.
  - **📱 Vertical Drama Mode (9:16)**: Built-in portrait mode specifically optimized for vertical dramas, shorts, and reels with full-bleed tall player layout and quick `📱 9:16` / `🖥️ 16:9` toggle.
  - Embedded player with -10s / +10s seek and 1.0x – 2.0x playback speeds.
  - Automatic error recovery for restricted embeds (codes 100/101/150/153) with direct "Open in YouTube" options.
  - Preloaded metadata and thumbnails for upcoming videos for near-instant card transitions.

- **📥 Multiple Import Methods**:
  - **No API Key needed**: Paste a list of URLs, import `.txt`/`.csv` files, or click "Load Demo Queue".
  - **YouTube Channel Backlog (Data API v3)**: Enter your YouTube API key to fetch up to 5,000 videos from any channel handle (`@username`), channel ID (`UC...`), or uploads playlist (`UU...`).

- **💾 100% Local Storage & Privacy**:
  - All classifications and queue order are saved in your browser's IndexedDB.
  - No backend server, user accounts, or telemetry.
  - Full multi-level **Undo** history.

- **📤 Exports**:
  - Download `watch.csv`, `archive.csv`, and `avoid.csv` (single-column RFC 4180 format with normalized `url`).
  - Full JSON session backup and restore.

---

## 🧩 Install as a Chrome / Brave / Edge Extension

You can run **YouTube Swipe Sorter** directly inside Chrome's native **Side Panel** right alongside YouTube, complete with a **1-click video scraper** that extracts videos from any YouTube page without requiring an API key!

### Quick 30-Second Setup:
1. Open Chrome, Brave, or Edge and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select this project folder (`URL Sorter`).
5. Open any YouTube page (search results, a channel's videos, shorts, or a playlist).
### Keyboard Shortcuts to Open:
- **`Cmd + S + S`** (or **`Ctrl + S + S`** on Windows/Linux): On any YouTube page, hold `Cmd` and tap `S` twice quickly to instantly open the Swipe Sorter side panel and scan the page!
- **`Command + Shift + S`** (or **`Ctrl + Shift + S`**): Chrome's global browser shortcut. You can also customize this in `chrome://extensions/shortcuts` to any combination you like.

---

## 🛠️ Local Development (Web App)

Run with any simple HTTP server:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html` in your browser.
