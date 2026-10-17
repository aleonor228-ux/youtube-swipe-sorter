    /* ==========================================================================
       YOUTUBE SWIPE SORTER — CORE ENGINE & LOGIC
       ========================================================================== */

    // --- Demo Video Dataset (High quality videos for immediate zero-config testing) ---
    const DEMO_VIDEOS = [
      {
        id: "d9nS23jC9aM",
        title: "Vertical Drama • Secret Heiress Episode 1",
        channelTitle: "ShortMax Drama",
        duration: "00:58",
        durationSec: 58,
        publishedAt: "2024-05-10T12:00:00Z",
        classification: "unsorted",
        isVertical: true
      },
      {
        id: "lM80Gk4P5aE",
        title: "Vertical Drama • The Hidden Billionaire Ep 2",
        channelTitle: "ReelShort Stories",
        duration: "01:12",
        durationSec: 72,
        publishedAt: "2024-05-11T14:00:00Z",
        classification: "unsorted",
        isVertical: true
      },
      {
        id: "kJQP7kiw5Fk",
        title: "Vertical Drama • Revenge of the Ex Episode 3",
        channelTitle: "DramaBox Official",
        duration: "01:05",
        durationSec: 65,
        publishedAt: "2024-05-12T16:00:00Z",
        classification: "unsorted",
        isVertical: true
      },
      {
        id: "L_LUpnjgPso",
        title: "How Quantum Computers Break Encryption",
        channelTitle: "Veritasium",
        duration: "18:42",
        durationSec: 1122,
        publishedAt: "2024-03-12T16:00:00Z",
        classification: "unsorted",
        isVertical: false
      },
      {
        id: "0e3GPea1Tyg",
        title: "The Simple Solution to Traffic",
        channelTitle: "CGP Grey",
        duration: "05:14",
        durationSec: 314,
        publishedAt: "2023-11-04T12:00:00Z",
        classification: "unsorted",
        isVertical: false
      },
      {
        id: "77ZEw8bz0pI",
        title: "Why Dyson Spheres Might Be The Ultimate Technology",
        channelTitle: "Kurzgesagt – In a Nutshell",
        duration: "11:58",
        durationSec: 718,
        publishedAt: "2023-09-19T14:00:00Z",
        classification: "unsorted",
        isVertical: false
      },
      {
        id: "aircAruvnKk",
        title: "Neural Networks from Scratch - Chapter 1",
        channelTitle: "3Blue1Brown",
        duration: "19:12",
        durationSec: 1152,
        publishedAt: "2023-08-10T15:00:00Z",
        classification: "unsorted",
        isVertical: false
      },
      {
        id: "fJ9rUzIMcZQ",
        title: "Bohemian Rhapsody (Official Video Remastered)",
        channelTitle: "Queen Official",
        duration: "05:59",
        durationSec: 359,
        publishedAt: "2022-01-01T00:00:00Z",
        classification: "unsorted",
        isVertical: false
      },
      {
        id: "M7lc1UVf-VE",
        title: "YouTube Developers Live at Google I/O",
        channelTitle: "Google Developers",
        duration: "04:30",
        durationSec: 270,
        publishedAt: "2021-05-18T18:00:00Z",
        classification: "unsorted",
        isVertical: false
      }
    ];

    /* ==========================================================================
       INDEXEDDB DATABASE MANAGER
       ========================================================================== */
    const DB_NAME = "YTSwipeSorterDB";
    const DB_VERSION = 1;
    let dbInstance = null;

    async function initDatabase() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("videos")) {
            const videoStore = db.createObjectStore("videos", { keyPath: "id" });
            videoStore.createIndex("classification", "classification", { unique: false });
            videoStore.createIndex("importOrder", "importOrder", { unique: false });
            videoStore.createIndex("publishedAt", "publishedAt", { unique: false });
          }
          if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
          }
        };
        req.onsuccess = (e) => {
          dbInstance = e.target.result;
          resolve(dbInstance);
        };
        req.onerror = (e) => {
          console.error("IndexedDB error:", e.target.error);
          reject(e.target.error);
        };
      });
    }

    async function dbPutVideo(video) {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["videos"], "readwrite");
        const store = tx.objectStore("videos");
        const req = store.put(video);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }

    async function dbBulkPutVideos(videos) {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["videos"], "readwrite");
        const store = tx.objectStore("videos");
        videos.forEach(v => store.put(v));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async function dbGetAllVideos() {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["videos"], "readonly");
        const store = tx.objectStore("videos");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async function dbClearAll() {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["videos", "settings"], "readwrite");
        tx.objectStore("videos").clear();
        tx.objectStore("settings").clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async function dbSetSetting(key, val) {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(["settings"], "readwrite");
        tx.objectStore("settings").put({ key, val });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async function dbGetSetting(key, defaultVal = null) {
      return new Promise((resolve) => {
        const tx = dbInstance.transaction(["settings"], "readonly");
        const req = tx.objectStore("settings").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.val : defaultVal);
        req.onerror = () => resolve(defaultVal);
      });
    }

    /* ==========================================================================
       APPLICATION STATE
       ========================================================================== */
    const State = {
      allVideos: [],            // Complete authoritative map/array of videos
      queue: [],                // Active sorted/filtered queue of video IDs to review
      queueIndex: 0,            // Current index in queue
      currentVideo: null,       // Video object currently displayed
      undoStack: [],            // Stack of { videoId, prevClassification, newClassification }
      filterMode: "unsorted",   // 'unsorted', 'all', 'watch', 'archive', 'avoid'
      sortMode: "original",     // 'original', 'shuffle', 'newest', 'oldest', 'shortest', 'longest'
      apiKey: "",
      hapticEnabled: true,
      wakeLockEnabled: true,
      autoplayEnabled: true,    // Auto-plays videos on load and card advance
      aspectRatioMode: "vertical", // 'vertical' (9:16), 'standard' (16:9), 'auto'
      muteAutoplay: false,
      autoAdvanceEnabled: true, // Automatically sorts to Watch & advances on episode end
      amoledEnabled: false,     // AMOLED true black theme mode
      swipeThreshold: 50,       // Pixels to trigger swipe decision (fast & responsive)
      wakeLockSentinel: null,
      ytPlayer: null,
      ytPlayerReady: false,
      currentPlaybackState: -1,
      isClassifying: false,     // Concurrency lock to prevent double-tap issues
      abortChannelImport: false
    };

    /* ==========================================================================
       YOUTUBE IFRAME PLAYER INTEGRATION
       ========================================================================== */
    function getSafeOrigin() {
      const orig = window.location.origin;
      if (!orig || orig === "null" || orig.startsWith("file:") || orig.startsWith("content:")) {
        return "https://www.youtube.com";
      }
      return orig;
    }

    if (typeof window.YT === "undefined") {
      window.YT = {
        PlayerState: {
          UNSTARTED: -1,
          ENDED: 0,
          PLAYING: 1,
          PAUSED: 2,
          BUFFERING: 3,
          CUED: 5
        }
      };
    }

    class PostMessageYTPlayer {
      constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.iframe = null;
        this.currentVideoId = "";
        this.currentTime = 0;
        this.playbackRate = 1;
        this.isMutedState = false;
        this.createIframe();
        this.setupMessageListener();
        setTimeout(() => {
          onPlayerReady({});
        }, 80);
      }

      createIframe() {
        if (!this.container) return;
        this.container.innerHTML = "";
        this.iframe = document.createElement("iframe");
        this.iframe.id = "pm-yt-iframe";
        this.iframe.width = "100%";
        this.iframe.height = "100%";
        this.iframe.setAttribute("frameborder", "0");
        this.iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        this.iframe.setAttribute("allowfullscreen", "1");
        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "none";
        this.iframe.style.display = "block";
        this.container.appendChild(this.iframe);
      }

      setupMessageListener() {
        window.addEventListener("message", (e) => {
          if (!e.data) return;
          try {
            const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
            if (data.event === "onStateChange") {
              onPlayerStateChange({ data: data.info });
            } else if (data.event === "infoDelivery" && data.info) {
              if (typeof data.info.currentTime === "number") {
                this.currentTime = data.info.currentTime;
              }
              if (typeof data.info.playbackRate === "number") {
                this.playbackRate = data.info.playbackRate;
              }
              if (typeof data.info.muted === "boolean") {
                this.isMutedState = data.info.muted;
              }
            } else if (data.event === "onError") {
              onPlayerError({ data: data.info });
            }
          } catch (err) {}
        });
      }

      sendCommand(func, args = []) {
        if (!this.iframe || !this.iframe.contentWindow) return;
        try {
          this.iframe.contentWindow.postMessage(JSON.stringify({
            event: "command",
            func: func,
            args: args
          }), "*");
        } catch (e) {}
      }

      loadVideoById(opts) {
        const vidId = typeof opts === "object" ? opts.videoId : opts;
        this.currentVideoId = vidId;
        this.currentTime = 0;
        const origin = getSafeOrigin();
        const auto = State.autoplayEnabled ? 1 : 0;
        const mute = State.muteAutoplay ? 1 : 0;
        if (!this.iframe) this.createIframe();
        this.iframe.src = `https://www.youtube-nocookie.com/embed/${vidId}?enablejsapi=1&autoplay=${auto}&mute=${mute}&playsinline=1&modestbranding=1&rel=0&origin=${encodeURIComponent(origin)}`;
      }

      cueVideoById(opts) {
        const vidId = typeof opts === "object" ? opts.videoId : opts;
        this.currentVideoId = vidId;
        const origin = getSafeOrigin();
        if (!this.iframe) this.createIframe();
        this.iframe.src = `https://www.youtube-nocookie.com/embed/${vidId}?enablejsapi=1&autoplay=0&playsinline=1&modestbranding=1&rel=0&origin=${encodeURIComponent(origin)}`;
      }

      playVideo() {
        this.sendCommand("playVideo");
      }

      pauseVideo() {
        this.sendCommand("pauseVideo");
      }

      seekTo(seconds, allowSeekAhead = true) {
        this.currentTime = seconds;
        this.sendCommand("seekTo", [seconds, allowSeekAhead]);
      }

      setPlaybackRate(rate) {
        this.playbackRate = rate;
        this.sendCommand("setPlaybackRate", [rate]);
      }

      getPlaybackRate() {
        return this.playbackRate;
      }

      getCurrentTime() {
        return this.currentTime;
      }

      mute() {
        this.isMutedState = true;
        this.sendCommand("mute");
      }

      unMute() {
        this.isMutedState = false;
        this.sendCommand("unMute");
      }

      isMuted() {
        return this.isMutedState;
      }
    }

    window.onYouTubeIframeAPIReady = function() {
      initYouTubePlayer();
    };

    let ytInitAttempts = 0;
    function initYouTubePlayer() {
      if (typeof YT !== "undefined" && YT.Player) {
        const safeOrigin = getSafeOrigin();
        try {
          State.ytPlayer = new YT.Player("yt-player-target", {
            host: "https://www.youtube.com",
            width: "100%",
            height: "100%",
            videoId: "",
            playerVars: {
              autoplay: 1,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              fs: 1,
              enablejsapi: 1,
              origin: safeOrigin,
              widget_referrer: safeOrigin
            },
            events: {
              onReady: onPlayerReady,
              onStateChange: onPlayerStateChange,
              onError: onPlayerError
            }
          });
          return;
        } catch (err) {
          console.warn("YouTube player init error:", err);
        }
      }

      // If in Chrome extension environment or iframe_api script was blocked by CSP
      ytInitAttempts++;
      if (ytInitAttempts > 4 || (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id)) {
        State.ytPlayer = new PostMessageYTPlayer("yt-player-target");
      } else {
        setTimeout(initYouTubePlayer, 200);
      }
    }

    function onPlayerReady(event) {
      State.ytPlayerReady = true;
      if (State.currentVideo) {
        loadVideoInPlayer(State.currentVideo.id);
      }
    }

    let autoplayRetryTimer = null;
    let autoAdvanceTimer = null;
    let autoAdvanceSecondsLeft = 3;

    function onPlayerStateChange(event) {
      State.currentPlaybackState = event.data;
      const playBtn = document.getElementById("btn-toggle-play");
      const thumbOverlay = document.getElementById("player-thumb-overlay");

      if (event.data === YT.PlayerState.PLAYING) {
        if (playBtn) playBtn.textContent = "Pause";
        if (thumbOverlay) thumbOverlay.classList.add("hidden");
        hidePlayerError();
        cancelAutoAdvanceCountdown();
        if (autoplayRetryTimer) {
          clearTimeout(autoplayRetryTimer);
          autoplayRetryTimer = null;
        }
        if (State.ytPlayer && State.ytPlayer.isMuted && !State.ytPlayer.isMuted()) {
          showUnmutePrompt(false);
        }
      } else if (event.data === YT.PlayerState.PAUSED) {
        if (playBtn) playBtn.textContent = "Play";
        cancelAutoAdvanceCountdown();
      } else if (event.data === YT.PlayerState.ENDED) {
        if (playBtn) playBtn.textContent = "Replay";
        startAutoAdvanceCountdown();
      } else if (event.data === YT.PlayerState.BUFFERING) {
        hidePlayerError();
        cancelAutoAdvanceCountdown();
        if (thumbOverlay) thumbOverlay.classList.add("hidden");
      }
    }

    // --- Auto-Advance Countdown ---
    function startAutoAdvanceCountdown() {
      if (!State.autoAdvanceEnabled) return;
      if (State.queue.length === 0 || State.queueIndex >= State.queue.length) return;

      const pill = document.getElementById("auto-advance-pill");
      const countEl = document.getElementById("advance-count-sec");
      if (!pill || !countEl) return;

      autoAdvanceSecondsLeft = 3;
      countEl.textContent = autoAdvanceSecondsLeft;
      pill.style.display = "flex";

      if (autoAdvanceTimer) clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = setInterval(() => {
        autoAdvanceSecondsLeft--;
        if (autoAdvanceSecondsLeft > 0) {
          countEl.textContent = autoAdvanceSecondsLeft;
        } else {
          cancelAutoAdvanceCountdown();
          classifyCurrentVideo("watch", "right");
        }
      }, 1000);
    }

    function cancelAutoAdvanceCountdown() {
      if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      const pill = document.getElementById("auto-advance-pill");
      if (pill) pill.style.display = "none";
    }

    // --- Floating Bottom Undo Pill ---
    let floatingUndoTimer = null;

    function showFloatingUndoPill(category) {
      const pill = document.getElementById("floating-undo-pill");
      const dot = document.getElementById("floating-undo-dot");
      const catText = document.getElementById("floating-undo-cat");
      if (!pill || !dot || !catText) return;

      if (floatingUndoTimer) {
        clearTimeout(floatingUndoTimer);
        floatingUndoTimer = null;
      }

      const catLabel = category === "watch" ? "Watch" : (category === "avoid" ? "Avoid" : "Archive");
      catText.textContent = catLabel;
      dot.className = `undo-dot ${category}`;

      pill.style.display = "flex";
      pill.style.opacity = "1";
      pill.style.transform = "translateX(-50%) translateY(0)";

      floatingUndoTimer = setTimeout(() => {
        hideFloatingUndoPill();
      }, 4200);
    }

    function hideFloatingUndoPill() {
      const pill = document.getElementById("floating-undo-pill");
      if (!pill) return;
      pill.style.opacity = "0";
      pill.style.transform = "translateX(-50%) translateY(15px)";
      setTimeout(() => {
        pill.style.display = "none";
      }, 250);
      if (floatingUndoTimer) {
        clearTimeout(floatingUndoTimer);
        floatingUndoTimer = null;
      }
    }

    // --- AMOLED True Black Theme Mode ---
    function setAmoledTheme(enabled) {
      State.amoledEnabled = !!enabled;
      dbSetSetting("amoled_theme", !!enabled);
      if (enabled) {
        document.body.classList.add("theme-amoled");
      } else {
        document.body.classList.remove("theme-amoled");
      }
      const toggle = document.getElementById("toggle-amoled");
      if (toggle) toggle.checked = !!enabled;
      const btn = document.getElementById("btn-toggle-amoled");
      if (btn) {
        btn.classList.toggle("active-tool", !!enabled);
        btn.title = enabled ? "AMOLED True Black is ON (Click to toggle)" : "AMOLED True Black is OFF (Click to toggle)";
      }
    }

    // --- Binge YouTube Playlist & Clipboard Tools ---
    function openWatchPlaylist() {
      const watchVideos = State.allVideos.filter(v => v.classification === "watch");
      if (watchVideos.length === 0) {
        showToast("No videos in Watch list yet! Swipe right to add.");
        return;
      }
      const ids = watchVideos.map(v => v.id).slice(0, 50);
      const url = `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
      window.open(url, "_blank", "noopener");
      showToast(`Opening YouTube playlist with ${ids.length} videos! ↗`);
      triggerHaptic();
    }

    async function copyWatchUrlsToClipboard() {
      const watchVideos = State.allVideos.filter(v => v.classification === "watch");
      if (watchVideos.length === 0) {
        showToast("No videos in Watch list yet! Swipe right to add.");
        return;
      }
      const text = watchVideos.map(v => `https://www.youtube.com/watch?v=${v.id}`).join("\n");
      try {
        await navigator.clipboard.writeText(text);
        showToast(`Copied ${watchVideos.length} Watch URLs to clipboard! 📋`);
        triggerHaptic();
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(`Copied ${watchVideos.length} Watch URLs to clipboard! 📋`);
        triggerHaptic();
      }
    }

    // --- Player Video Gestures (Double-tap to seek, hold for 2x, tap to play/pause) ---
    let lastTapTime = 0;
    let lastTapX = 0;
    let singleTapTimeout = null;
    let holdSpeedTimeout = null;
    let isHolding2x = false;
    let speedBeforeHold = 1;
    let touchStartX = 0;
    let touchStartY = 0;

    function setupPlayerGestures() {
      const overlay = document.getElementById("player-gesture-overlay");
      if (!overlay) return;

      overlay.addEventListener("pointerdown", (e) => {
        if (!State.ytPlayer) return;
        touchStartX = e.clientX;
        touchStartY = e.clientY;

        // Long press detection for 2.0x playback speed
        holdSpeedTimeout = setTimeout(() => {
          isHolding2x = true;
          try {
            speedBeforeHold = (State.ytPlayer.getPlaybackRate && State.ytPlayer.getPlaybackRate()) || 1;
            State.ytPlayer.setPlaybackRate(2);
            const badge = document.getElementById("speed-hold-badge");
            if (badge) badge.style.display = "flex";
            triggerHaptic();
          } catch (err) {
            console.warn("2x speed error:", err);
          }
        }, 320);
      });

      overlay.addEventListener("pointermove", (e) => {
        const dist = Math.hypot(e.clientX - touchStartX, e.clientY - touchStartY);
        if (dist > 15) {
          if (holdSpeedTimeout) {
            clearTimeout(holdSpeedTimeout);
            holdSpeedTimeout = null;
          }
        }
      });

      const cancelOrEndHold = (e) => {
        if (holdSpeedTimeout) {
          clearTimeout(holdSpeedTimeout);
          holdSpeedTimeout = null;
        }

        if (isHolding2x) {
          isHolding2x = false;
          const badge = document.getElementById("speed-hold-badge");
          if (badge) badge.style.display = "none";
          try {
            if (State.ytPlayer && State.ytPlayer.setPlaybackRate) {
              State.ytPlayer.setPlaybackRate(speedBeforeHold || 1);
            }
          } catch (err) {}
          return true;
        }
        return false;
      };

      overlay.addEventListener("pointercancel", cancelOrEndHold);

      overlay.addEventListener("pointerup", (e) => {
        if (cancelOrEndHold(e)) {
          return; // Was press-and-hold
        }

        const now = Date.now();
        const rect = overlay.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const isLeftZone = relX < rect.width * 0.45;
        const isRightZone = relX > rect.width * 0.55;

        // Double-Tap Detection (<280ms between taps)
        if (now - lastTapTime < 280 && Math.abs(e.clientX - lastTapX) < 50) {
          if (singleTapTimeout) {
            clearTimeout(singleTapTimeout);
            singleTapTimeout = null;
          }
          lastTapTime = 0;

          if (isLeftZone) {
            // Seek -10s
            if (State.ytPlayer && State.ytPlayer.getCurrentTime) {
              const cur = State.ytPlayer.getCurrentTime();
              State.ytPlayer.seekTo(Math.max(0, cur - 10), true);
            }
            triggerSeekAnimation("left");
            triggerHaptic();
          } else {
            // Seek +10s (Right or Center double-tap)
            if (State.ytPlayer && State.ytPlayer.getCurrentTime) {
              const cur = State.ytPlayer.getCurrentTime();
              State.ytPlayer.seekTo(cur + 10, true);
            }
            triggerSeekAnimation("right");
            triggerHaptic();
          }
        } else {
          // Single tap pending (wait 250ms to ensure not double-tap)
          lastTapTime = now;
          lastTapX = e.clientX;

          singleTapTimeout = setTimeout(() => {
            if (!State.ytPlayer) return;
            if (State.currentPlaybackState === YT.PlayerState.PLAYING) {
              State.ytPlayer.pauseVideo();
              triggerPlayFlash("⏸");
            } else {
              const thumbOverlay = document.getElementById("player-thumb-overlay");
              if (thumbOverlay) thumbOverlay.classList.add("hidden");
              if (State.ytPlayer.unMute && !State.muteAutoplay) State.ytPlayer.unMute();
              State.ytPlayer.playVideo();
              triggerPlayFlash("▶");
            }
          }, 250);
        }
      });
    }

    function triggerSeekAnimation(side) {
      const el = document.getElementById(side === "left" ? "seek-feedback-left" : "seek-feedback-right");
      if (!el) return;
      el.classList.remove("animate-ripple");
      void el.offsetWidth;
      el.classList.add("animate-ripple");
    }

    function triggerPlayFlash(icon) {
      const el = document.getElementById("play-feedback-center");
      const iconEl = document.getElementById("center-flash-icon");
      if (!el || !iconEl) return;
      iconEl.textContent = icon;
      el.classList.remove("animate-flash");
      void el.offsetWidth;
      el.classList.add("animate-flash");
    }

    function onPlayerError(event) {
      console.warn("YouTube player error event code:", event.data);
      const code = event.data;
      let msgTitle = "Playback Unavailable";
      let msgDesc = "This video encountered a playback issue.";

      if (code === 2) {
        msgTitle = "Invalid Parameter";
        msgDesc = "The video ID appears malformed.";
      } else if (code === 5) {
        msgTitle = "HTML5 Player Error";
        msgDesc = "HTML5 playback failed for this video.";
      } else if (code === 100) {
        msgTitle = "Video Not Found";
        msgDesc = "This video has been removed or set to private.";
      } else if (code === 101 || code === 150) {
        msgTitle = "Embedding Prohibited";
        msgDesc = "The video creator or YouTube restricts embedding on third-party sites.";
      } else if (code === 153) {
        msgTitle = "Origin Blocked (Error 153)";
        msgDesc = "YouTube blocks embeds when opened locally (content:// or file://) instead of an HTTP web address. Tap 'Open in YouTube' or view Wi-Fi address.";
      }

      showPlayerError(msgTitle, msgDesc);
    }

    function showPlayerError(title, desc) {
      document.getElementById("error-title").textContent = title;
      document.getElementById("error-desc").textContent = desc;
      document.getElementById("player-error-banner").style.display = "flex";
      const thumbOverlay = document.getElementById("player-thumb-overlay");
      if (thumbOverlay) thumbOverlay.classList.add("hidden");
    }

    function hidePlayerError() {
      const banner = document.getElementById("player-error-banner");
      if (banner) banner.style.display = "none";
    }

    function showUnmutePrompt(visible) {
      const banner = document.getElementById("banner-unmute-prompt");
      if (!banner) return;
      if (visible && !State.muteAutoplay) {
        banner.style.display = "flex";
      } else {
        banner.style.display = "none";
      }
    }

    function unmuteAndDismiss() {
      if (State.ytPlayer && State.ytPlayer.unMute) {
        State.ytPlayer.unMute();
      }
      showUnmutePrompt(false);
    }

    function updateAutoplayUI() {
      const btn = document.getElementById("btn-toggle-autoplay");
      const toggle = document.getElementById("toggle-autoplay");
      if (toggle) toggle.checked = State.autoplayEnabled;
      if (btn) {
        const dot = btn.querySelector(".tool-dot");
        if (State.autoplayEnabled) {
          btn.classList.add("active-tool");
          if (dot) dot.classList.add("active");
          btn.title = "Autoplay is ON (Click to turn off)";
        } else {
          btn.classList.remove("active-tool");
          if (dot) dot.classList.remove("active");
          btn.title = "Autoplay is OFF (Click to turn on)";
        }
      }
    }

    function updateCardAspectRatio() {
      const activeCard = document.getElementById("active-card");
      const previewCard = document.getElementById("preview-card");
      const aspectBtn = document.getElementById("btn-toggle-aspect");
      const aspectLabel = document.getElementById("aspect-label");
      const selectAspect = document.getElementById("select-aspect-ratio");

      let isVertical = false;
      if (State.aspectRatioMode === "vertical") {
        isVertical = true;
      } else if (State.aspectRatioMode === "standard") {
        isVertical = false;
      } else if (State.aspectRatioMode === "auto") {
        const v = State.currentVideo;
        if (v && (v.isVertical || (v.durationSec && v.durationSec <= 90) || /shorts|drama|vertical|ep\.|episode/i.test(v.title || ""))) {
          isVertical = true;
        } else {
          isVertical = false;
        }
      }

      if (isVertical) {
        if (activeCard) activeCard.classList.add("vertical-mode");
        if (previewCard) previewCard.classList.add("vertical-mode");
        if (aspectLabel) aspectLabel.textContent = "📱 9:16";
        if (aspectBtn) {
          aspectBtn.classList.add("active-tool");
          aspectBtn.title = "Vertical Drama (9:16). Click to switch to Standard Landscape (16:9)";
        }
      } else {
        if (activeCard) activeCard.classList.remove("vertical-mode");
        if (previewCard) previewCard.classList.remove("vertical-mode");
        if (aspectLabel) aspectLabel.textContent = "🖥️ 16:9";
        if (aspectBtn) {
          aspectBtn.classList.remove("active-tool");
          aspectBtn.title = "Standard Landscape (16:9). Click to switch to Vertical Drama (9:16)";
        }
      }

      if (selectAspect && selectAspect.value !== State.aspectRatioMode) {
        selectAspect.value = State.aspectRatioMode;
      }
    }

    function loadVideoInPlayer(videoId) {
      if (!videoId) return;
      hidePlayerError();
      showUnmutePrompt(false);

      if (autoplayRetryTimer) {
        clearTimeout(autoplayRetryTimer);
        autoplayRetryTimer = null;
      }

      const thumbOverlay = document.getElementById("player-thumb-overlay");
      if (thumbOverlay) {
        thumbOverlay.style.backgroundImage = `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`;
      }

      if (!State.ytPlayerReady || !State.ytPlayer) {
        if (thumbOverlay) thumbOverlay.classList.remove("hidden");
        return;
      }

      try {
        if (State.autoplayEnabled) {
          if (State.muteAutoplay && State.ytPlayer.mute) {
            State.ytPlayer.mute();
          }

          // Use loadVideoById to start playback immediately
          if (State.ytPlayer.loadVideoById) {
            State.ytPlayer.loadVideoById({
              videoId: videoId,
              startSeconds: 0
            });
          }

          if (thumbOverlay) {
            thumbOverlay.classList.add("hidden");
          }

          if (State.ytPlayer.playVideo) {
            try {
              State.ytPlayer.playVideo();
            } catch (pErr) {
              console.warn("Autoplay playVideo trigger:", pErr);
            }
          }

          // Mobile / Browser policy fallback: If unmuted autoplay was blocked by browser
          autoplayRetryTimer = setTimeout(() => {
            if (State.currentPlaybackState !== YT.PlayerState.PLAYING &&
                State.currentPlaybackState !== YT.PlayerState.BUFFERING &&
                State.autoplayEnabled && State.ytPlayer) {
              console.log("Unmuted autoplay restricted by browser policy; trying muted fallback...");
              try {
                if (State.ytPlayer.mute) State.ytPlayer.mute();
                if (State.ytPlayer.playVideo) State.ytPlayer.playVideo();
                showUnmutePrompt(true);
              } catch (e) {
                console.warn("Muted autoplay fallback failed:", e);
                if (thumbOverlay) thumbOverlay.classList.remove("hidden");
              }
            }
          }, 850);

        } else {
          // Manual play mode
          if (thumbOverlay) thumbOverlay.classList.remove("hidden");
          if (State.ytPlayer.cueVideoById) {
            State.ytPlayer.cueVideoById({ videoId });
          } else if (State.ytPlayer.loadVideoById) {
            State.ytPlayer.loadVideoById(videoId);
          }
        }

        const ifr = document.querySelector("#yt-player-target, #yt-player-container iframe");
        if (ifr) {
          ifr.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
          ifr.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
        }
      } catch (e) {
        console.warn("Could not load/play video in player:", e);
        if (thumbOverlay) thumbOverlay.classList.remove("hidden");
      }
    }

    /* ==========================================================================
       QUEUE MANAGEMENT & NAVIGATION
       ========================================================================== */
    function rebuildQueue() {
      let filtered = [];
      if (State.filterMode === "unsorted") {
        filtered = State.allVideos.filter(v => !v.classification || v.classification === "unsorted");
      } else if (State.filterMode === "all") {
        filtered = [...State.allVideos];
      } else {
        filtered = State.allVideos.filter(v => v.classification === State.filterMode);
      }

      // Sort
      if (State.sortMode === "newest") {
        filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      } else if (State.sortMode === "oldest") {
        filtered.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
      } else if (State.sortMode === "shortest") {
        filtered.sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0));
      } else if (State.sortMode === "longest") {
        filtered.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0));
      } else if (State.sortMode === "shuffle") {
        // Fisher-Yates
        for (let i = filtered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
        }
      } else {
        // Original importOrder
        filtered.sort((a, b) => (a.importOrder || 0) - (b.importOrder || 0));
      }

      State.queue = filtered.map(v => v.id);
      State.queueIndex = 0;
      updateStats();
      renderCurrentCard();
      preloadNextThumbnails();
    }

    function renderCurrentCard() {
      const activeCard = document.getElementById("active-card");
      const emptyState = document.getElementById("empty-state");

      if (State.queue.length === 0 || State.queueIndex >= State.queue.length) {
        // No videos or backlog cleared
        activeCard.style.display = "none";
        emptyState.classList.add("active");
        State.currentVideo = null;
        updateUndoButton();
        return;
      }

      emptyState.classList.remove("active");
      activeCard.style.display = "flex";
      resetCardTransform();

      const videoId = State.queue[State.queueIndex];
      const video = State.allVideos.find(v => v.id === videoId);
      State.currentVideo = video;

      if (!video) return;

      // Update card metadata
      document.getElementById("card-video-title").textContent = video.title || `YouTube Video (${videoId})`;
      document.getElementById("card-channel-name").textContent = video.channelTitle || "YouTube Channel";
      document.getElementById("card-duration").textContent = video.duration || "--:--";

      if (video.publishedAt) {
        const d = new Date(video.publishedAt);
        document.getElementById("card-date").textContent = !isNaN(d) ? d.toLocaleDateString() : "--/--/--";
      } else {
        document.getElementById("card-date").textContent = "--/--/--";
      }

      // Update Aspect Ratio layout for vertical drama or standard
      updateCardAspectRatio();

      // Load and auto-play player
      loadVideoInPlayer(video.id);

      // Setup preview card behind active card
      const nextIndex = State.queueIndex + 1;
      const previewCard = document.getElementById("preview-card");
      if (nextIndex < State.queue.length) {
        const nextVideoId = State.queue[nextIndex];
        const nextVideo = State.allVideos.find(v => v.id === nextVideoId);
        if (nextVideo) {
          previewCard.style.display = "flex";
          document.getElementById("preview-thumb").src = `https://i.ytimg.com/vi/${nextVideo.id}/mqdefault.jpg`;
          document.getElementById("preview-title").textContent = nextVideo.title || nextVideo.id;
          document.getElementById("preview-channel").textContent = nextVideo.channelTitle || "";
        }
      } else {
        previewCard.style.display = "none";
      }

      updateUndoButton();
    }

    function preloadNextThumbnails() {
      // Lookahead: Preload next 3 images
      const nextLimit = Math.min(State.queueIndex + 4, State.queue.length);
      for (let i = State.queueIndex + 1; i < nextLimit; i++) {
        const id = State.queue[i];
        if (id) {
          const img = new Image();
          img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        }
      }
    }

    /* ==========================================================================
       CLASSIFICATION ENGINE (Watch, Archive, Avoid)
       ========================================================================== */
    async function classifyCurrentVideo(category, directionAnim = null) {
      if (State.isClassifying) return;
      if (!State.currentVideo) return;

      // Cancel any ongoing auto-advance countdown if user manually classifies
      cancelAutoAdvanceCountdown();

      State.isClassifying = true;
      const video = State.currentVideo;
      const prevClassification = video.classification || "unsorted";

      // 1. Play Card Swipe Animation
      await animateCardExit(directionAnim || getDirectionForCategory(category));

      // 2. Immediate local save in IndexedDB
      video.classification = category;
      video.classifiedAt = new Date().toISOString();

      try {
        await dbPutVideo(video);
      } catch (err) {
        showToast("Error saving classification locally");
        console.error("IndexedDB write failed:", err);
      }

      // 3. Record in Undo stack
      State.undoStack.push({
        videoId: video.id,
        prevClassification: prevClassification,
        newClassification: category,
        queueIndex: State.queueIndex
      });

      // 4. Haptic vibration
      triggerHaptic();

      // 5. Update counts & advance
      updateStats();

      // Show floating bottom undo pill for one-handed thumb ergonomics
      showFloatingUndoPill(category);

      // If we are reviewing unsorted, remove video from queue
      if (State.filterMode === "unsorted") {
        State.queue.splice(State.queueIndex, 1);
        // Do not increment State.queueIndex because next item slid into place
      } else {
        State.queueIndex++;
      }

      renderCurrentCard();
      preloadNextThumbnails();
      State.isClassifying = false;
    }

    function getDirectionForCategory(cat) {
      if (cat === "watch") return "right";
      if (cat === "avoid") return "left";
      if (cat === "archive") return "down";
      return "right";
    }

    async function undoLastDecision() {
      if (State.undoStack.length === 0) return;
      hideFloatingUndoPill();
      const item = State.undoStack.pop();

      const video = State.allVideos.find(v => v.id === item.videoId);
      if (!video) return;

      video.classification = item.prevClassification;
      await dbPutVideo(video);

      // Re-insert into queue if filter mode is unsorted
      if (State.filterMode === "unsorted" && item.prevClassification === "unsorted") {
        State.queue.splice(item.queueIndex, 0, video.id);
        State.queueIndex = item.queueIndex;
      } else if (State.queueIndex > 0) {
        State.queueIndex--;
      }

      updateStats();
      renderCurrentCard();
      showToast("Undone last classification");
      triggerHaptic();
    }

    function updateUndoButton() {
      const btnUndo = document.getElementById("btn-undo");
      btnUndo.disabled = State.undoStack.length === 0;
    }

    function updateStats() {
      let watch = 0, archive = 0, avoid = 0, unsorted = 0;
      State.allVideos.forEach(v => {
        if (v.classification === "watch") watch++;
        else if (v.classification === "archive") archive++;
        else if (v.classification === "avoid") avoid++;
        else unsorted++;
      });

      const total = State.allVideos.length;
      const classified = watch + archive + avoid;
      const pct = total > 0 ? Math.round((classified / total) * 100) : 0;

      document.getElementById("stat-watch").textContent = watch;
      document.getElementById("stat-archive").textContent = archive;
      document.getElementById("stat-avoid").textContent = avoid;

      document.getElementById("stat-progress-text").textContent = `${classified} / ${total}`;
      document.getElementById("stat-percent").textContent = `(${pct}%)`;

      // Visual progress bar
      if (total > 0) {
        document.getElementById("track-watch").style.width = `${(watch / total) * 100}%`;
        document.getElementById("track-archive").style.width = `${(archive / total) * 100}%`;
        document.getElementById("track-avoid").style.width = `${(avoid / total) * 100}%`;
      } else {
        document.getElementById("track-watch").style.width = "0%";
        document.getElementById("track-archive").style.width = "0%";
        document.getElementById("track-avoid").style.width = "0%";
      }

      // Export sheet counters
      document.getElementById("export-count-watch").textContent = `${watch} URLs • watch.csv`;
      document.getElementById("export-count-archive").textContent = `${archive} URLs • archive.csv`;
      document.getElementById("export-count-avoid").textContent = `${avoid} URLs • avoid.csv`;

      // Queue badge
      const queueBadge = document.getElementById("queue-badge");
      if (unsorted > 0) {
        queueBadge.style.display = "block";
        queueBadge.textContent = unsorted > 999 ? "999+" : unsorted;
      } else {
        queueBadge.style.display = "none";
      }

      document.getElementById("queue-total-count").textContent = State.queue.length;
    }

    /* ==========================================================================
       GESTURE ENGINE (Pointer + Touch Events with Real-Time Card Swiping)
       ========================================================================== */
    let dragStartX = 0;
    let dragStartY = 0;
    let dragCurrentX = 0;
    let dragCurrentY = 0;
    let dragStartTime = 0;
    let isDragging = false;
    let dragPointerId = null;

    const activeCard = document.getElementById("active-card");
    const swipeHandle = document.getElementById("swipe-handle");
    const stampWatch = document.getElementById("stamp-watch");
    const stampAvoid = document.getElementById("stamp-avoid");
    const stampArchive = document.getElementById("stamp-archive");

    function isInteractiveTarget(target) {
      if (!target) return false;
      return !!target.closest("button, select, a, input, textarea, #yt-player-container, #yt-player-target, .player-tools-bar, .player-play-btn, .tool-btn, #player-gesture-overlay, .player-gesture-overlay, #auto-advance-pill, .auto-advance-pill, #floating-undo-pill, .floating-undo-pill");
    }

    function setupGestures() {
      // 1. Pointer Events (Desktop & Modern Mobile)
      activeCard.addEventListener("pointerdown", onCardPointerDown);
      window.addEventListener("pointermove", onCardPointerMove);
      window.addEventListener("pointerup", onCardPointerUp);
      window.addEventListener("pointercancel", onCardPointerCancel);

      // 2. Native Touch Events (Android Chrome / iOS Safari rock-solid fallback)
      activeCard.addEventListener("touchstart", onCardTouchStart, { passive: false });
      window.addEventListener("touchmove", onCardTouchMove, { passive: false });
      window.addEventListener("touchend", onCardTouchEnd);
      window.addEventListener("touchcancel", onCardTouchCancel);
    }

    // --- Pointer Events Handlers ---
    function onCardPointerDown(e) {
      if (State.isClassifying || !State.currentVideo) return;
      if (isInteractiveTarget(e.target)) return;

      isDragging = true;
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCurrentX = e.clientX;
      dragCurrentY = e.clientY;
      dragStartTime = Date.now();

      activeCard.style.transition = "none";
      try {
        activeCard.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onCardPointerMove(e) {
      if (!isDragging || e.pointerId !== dragPointerId) return;
      handleDragMove(e.clientX, e.clientY);
    }

    function onCardPointerUp(e) {
      if (!isDragging || e.pointerId !== dragPointerId) return;
      isDragging = false;
      try {
        activeCard.releasePointerCapture(dragPointerId);
      } catch (err) {}
      handleDragEnd();
    }

    function onCardPointerCancel(e) {
      if (!isDragging || e.pointerId !== dragPointerId) return;
      isDragging = false;
      springBackCard();
    }

    // --- Touch Events Handlers ---
    function onCardTouchStart(e) {
      if (State.isClassifying || !State.currentVideo) return;
      if (isInteractiveTarget(e.target)) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      isDragging = true;
      dragPointerId = null; // Managed by touch
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      dragCurrentX = t.clientX;
      dragCurrentY = t.clientY;
      dragStartTime = Date.now();

      activeCard.style.transition = "none";
    }

    function onCardTouchMove(e) {
      if (!isDragging || e.touches.length !== 1) return;
      const t = e.touches[0];
      // Prevent browser native scrolling & back/forward navigation gesture
      if (e.cancelable) e.preventDefault();
      handleDragMove(t.clientX, t.clientY);
    }

    function onCardTouchEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      handleDragEnd();
    }

    function onCardTouchCancel(e) {
      if (!isDragging) return;
      isDragging = false;
      springBackCard();
    }

    // --- Unified Move & End Logic ---
    function handleDragMove(clientX, clientY) {
      dragCurrentX = clientX;
      dragCurrentY = clientY;

      const deltaX = dragCurrentX - dragStartX;
      const deltaY = dragCurrentY - dragStartY;

      // Real-time card translation and tilt
      const rotation = deltaX * 0.055;
      activeCard.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;

      const threshold = State.swipeThreshold || 50;

      // Downward swipe (Archive) check
      if (deltaY > 20 && deltaY > Math.abs(deltaX) * 0.9) {
        const opacity = Math.min(1, deltaY / (threshold * 1.2));
        stampArchive.style.opacity = opacity;
        stampWatch.style.opacity = 0;
        stampAvoid.style.opacity = 0;
        activeCard.style.borderColor = `rgba(59, 130, 246, ${0.2 + opacity * 0.8})`;
        activeCard.style.boxShadow = `0 10px 30px rgba(59, 130, 246, ${opacity * 0.35})`;
      } else if (deltaX > 15) {
        // Watch (Right)
        const opacity = Math.min(1, deltaX / threshold);
        stampWatch.style.opacity = opacity;
        stampAvoid.style.opacity = 0;
        stampArchive.style.opacity = 0;
        activeCard.style.borderColor = `rgba(16, 185, 129, ${0.2 + opacity * 0.8})`;
        activeCard.style.boxShadow = `0 10px 30px rgba(16, 185, 129, ${opacity * 0.35})`;
      } else if (deltaX < -15) {
        // Avoid (Left)
        const opacity = Math.min(1, Math.abs(deltaX) / threshold);
        stampAvoid.style.opacity = opacity;
        stampWatch.style.opacity = 0;
        stampArchive.style.opacity = 0;
        activeCard.style.borderColor = `rgba(239, 68, 68, ${0.2 + opacity * 0.8})`;
        activeCard.style.boxShadow = `0 10px 30px rgba(239, 68, 68, ${opacity * 0.35})`;
      } else {
        stampWatch.style.opacity = 0;
        stampAvoid.style.opacity = 0;
        stampArchive.style.opacity = 0;
        activeCard.style.borderColor = "var(--border-subtle)";
        activeCard.style.boxShadow = "var(--shadow-card)";
      }
    }

    function handleDragEnd() {
      const deltaX = dragCurrentX - dragStartX;
      const deltaY = dragCurrentY - dragStartY;
      const threshold = State.swipeThreshold || 50;
      const elapsed = Math.max(1, Date.now() - dragStartTime);
      const velocityX = deltaX / elapsed;
      const velocityY = deltaY / elapsed;

      // Downward swipe -> Archive
      if ((deltaY > threshold || velocityY > 0.4) && deltaY > Math.abs(deltaX) * 0.8) {
        classifyCurrentVideo("archive", "down");
      }
      // Right swipe -> Watch
      else if (deltaX > threshold || velocityX > 0.4) {
        classifyCurrentVideo("watch", "right");
      }
      // Left swipe -> Avoid
      else if (deltaX < -threshold || velocityX < -0.4) {
        classifyCurrentVideo("avoid", "left");
      }
      // Release below threshold -> Spring back
      else {
        springBackCard();
      }
    }

    function springBackCard() {
      activeCard.style.transition = "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.25), border-color 0.2s ease, box-shadow 0.2s ease";
      activeCard.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
      activeCard.style.borderColor = "var(--border-subtle)";
      activeCard.style.boxShadow = "var(--shadow-card)";
      stampWatch.style.opacity = 0;
      stampAvoid.style.opacity = 0;
      stampArchive.style.opacity = 0;
    }

    function resetCardTransform() {
      activeCard.style.transition = "none";
      activeCard.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
      activeCard.style.borderColor = "var(--border-subtle)";
      activeCard.style.boxShadow = "var(--shadow-card)";
      stampWatch.style.opacity = 0;
      stampAvoid.style.opacity = 0;
      stampArchive.style.opacity = 0;
    }

    function animateCardExit(direction) {
      return new Promise((resolve) => {
        activeCard.style.transition = "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease-out";
        const width = window.innerWidth || 400;
        const height = window.innerHeight || 700;
        const currentDY = dragCurrentY - dragStartY;

        if (direction === "right") {
          activeCard.style.transform = `translate3d(${width + 120}px, ${currentDY}px, 0) rotate(18deg)`;
          stampWatch.style.opacity = 1;
        } else if (direction === "left") {
          activeCard.style.transform = `translate3d(-${width + 120}px, ${currentDY}px, 0) rotate(-18deg)`;
          stampAvoid.style.opacity = 1;
        } else if (direction === "down") {
          activeCard.style.transform = `translate3d(${dragCurrentX - dragStartX}px, ${height + 140}px, 0)`;
          stampArchive.style.opacity = 1;
        }
        activeCard.style.opacity = "0";

        setTimeout(() => {
          activeCard.style.transition = "none";
          activeCard.style.opacity = "1";
          resetCardTransform();
          resolve();
        }, 220);
      });
    }

    /* ==========================================================================
       IMPORT WORKFLOWS
       ========================================================================== */

    // Normalize and extract YouTube video ID from various formats
    function extractYouTubeId(urlOrId) {
      if (!urlOrId) return null;
      const clean = urlOrId.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

      const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
      const match = clean.match(regex);
      return match ? match[1] : null;
    }

    // A. URL / Text / CSV Import
    async function importFromUrlsText(rawText) {
      if (!rawText || !rawText.trim()) {
        showToast("Please provide URLs or file content");
        return;
      }

      const lines = rawText.split(/[\r\n,]+/);
      const newVideos = [];
      const existingIds = new Set(State.allVideos.map(v => v.id));
      let addedCount = 0;
      let duplicateCount = 0;

      for (const line of lines) {
        const id = extractYouTubeId(line);
        if (id) {
          const isShortOrVertical = line.toLowerCase().includes("/shorts/") ||
                                   line.toLowerCase().includes("drama") ||
                                   line.toLowerCase().includes("vertical") ||
                                   line.toLowerCase().includes("reel");
          if (!existingIds.has(id)) {
            existingIds.add(id);
            newVideos.push({
              id: id,
              title: isShortOrVertical ? `Vertical Drama (${id})` : `Video ${id}`,
              channelTitle: "Imported from URL list",
              duration: "--:--",
              durationSec: 0,
              publishedAt: new Date().toISOString(),
              classification: "unsorted",
              importOrder: State.allVideos.length + addedCount,
              isVertical: isShortOrVertical
            });
            addedCount++;
          } else {
            duplicateCount++;
          }
        }
      }

      if (addedCount > 0) {
        State.allVideos.push(...newVideos);
        await dbBulkPutVideos(newVideos);
        rebuildQueue();
        closeAllModals();
        showToast(`Imported ${addedCount} videos (${duplicateCount} duplicates skipped)`);
      } else {
        showToast(duplicateCount > 0 ? "All URLs were duplicates" : "No valid YouTube URLs found");
      }
    }

    // B. Chrome Extension Active YouTube Tab Scraper
    async function importFromActiveYouTubeTab() {
      if (typeof chrome === "undefined" || !chrome.tabs) {
        showToast("Open this in the Chrome Extension to scrape active YouTube tabs!");
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes("youtube.com")) {
          showToast("Please switch to or open a YouTube tab (Search, Channel, or Playlist) first!");
          return;
        }

        showToast("Scanning YouTube tab for video cards...");

        chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_YOUTUBE_VIDEOS" }, async (response) => {
          if (chrome.runtime.lastError || !response || !response.videos) {
            try {
              if (chrome.scripting && chrome.scripting.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["content.js"]
                });
                chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_YOUTUBE_VIDEOS" }, async (res2) => {
                  if (res2 && res2.videos && res2.videos.length > 0) {
                    await handleScrapedVideos(res2.videos, res2.pageTitle || tab.title);
                  } else {
                    showToast("No video cards detected on current YouTube view.");
                  }
                });
                return;
              }
            } catch (injErr) {
              console.warn("Script injection fallback error:", injErr);
            }
            showToast("Could not read videos from YouTube tab. Try scrolling the YouTube page and try again.");
            return;
          }

          if (response.videos && response.videos.length > 0) {
            await handleScrapedVideos(response.videos, response.pageTitle || tab.title);
          } else {
            showToast("No video cards found on this YouTube page. Scroll down to load more!");
          }
        });
      } catch (err) {
        console.error("Tab import error:", err);
        showToast("Tab import error: " + (err.message || "Unknown error"));
      }
    }

    async function handleScrapedVideos(scrapedList, sourceTitle = "") {
      if (!scrapedList || scrapedList.length === 0) return;

      const existingIds = new Set(State.allVideos.map(v => v.id));
      const toAdd = [];

      scrapedList.forEach((v, idx) => {
        if (!existingIds.has(v.id)) {
          existingIds.add(v.id);
          toAdd.push({
            id: v.id,
            title: v.title || `Video ${v.id}`,
            channelTitle: v.channelTitle || "YouTube",
            duration: v.duration || "",
            durationSec: 0,
            publishedAt: new Date().toISOString(),
            classification: "unsorted",
            isVertical: !!v.isVertical,
            importOrder: State.allVideos.length + idx
          });
        }
      });

      if (toAdd.length > 0) {
        State.allVideos.push(...toAdd);
        await dbBulkPutVideos(toAdd);
        rebuildQueue();
        closeAllModals();
        showToast(`Imported ${toAdd.length} videos from ${sourceTitle || "YouTube"}! ⚡`);
        triggerHaptic();
      } else {
        showToast(`All ${scrapedList.length} videos from this page are already in your queue!`);
      }
    }

    function checkPendingExtensionImports() {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get(["pendingImportVideos", "pendingImportSource"], (res) => {
        if (res && res.pendingImportVideos && res.pendingImportVideos.length > 0) {
          handleScrapedVideos(res.pendingImportVideos, res.pendingImportSource);
          chrome.storage.local.remove(["pendingImportVideos", "pendingImportSource"]);
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.pendingImportVideos && changes.pendingImportVideos.newValue) {
          handleScrapedVideos(changes.pendingImportVideos.newValue, (changes.pendingImportSource && changes.pendingImportSource.newValue) || "YouTube");
          chrome.storage.local.remove(["pendingImportVideos", "pendingImportSource"]);
        }
      });
    }

    // Parse ISO 8601 duration PT1H2M10S to string
    function parseDurationISO(isoDuration) {
      if (!isoDuration) return { str: "--:--", sec: 0 };
      const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return { str: "--:--", sec: 0 };
      const hours = parseInt(match[1] || 0, 10);
      const mins = parseInt(match[2] || 0, 10);
      const secs = parseInt(match[3] || 0, 10);

      const totalSec = hours * 3600 + mins * 60 + secs;
      let str = "";
      if (hours > 0) {
        str = `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      } else {
        str = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return { str, sec: totalSec };
    }

    // B. YouTube Channel Import (Data API v3)
    async function startChannelImport() {
      const apiKey = document.getElementById("input-api-key").value.trim();
      const channelQuery = document.getElementById("input-channel-id").value.trim();
      const maxLimit = parseInt(document.getElementById("input-max-import").value, 10) || 150;

      if (!apiKey) {
        showToast("Please enter a YouTube API Key");
        return;
      }
      if (!channelQuery) {
        showToast("Please enter a Channel Handle, ID or URL");
        return;
      }

      // Save API key
      State.apiKey = apiKey;
      await dbSetSetting("yt_api_key", apiKey);

      const progressBox = document.getElementById("import-channel-progress");
      const statusText = document.getElementById("import-status-text");
      const statusCount = document.getElementById("import-status-count");
      const statusBar = document.getElementById("import-status-bar");
      const startBtn = document.getElementById("btn-start-channel-import");

      progressBox.style.display = "flex";
      startBtn.disabled = true;
      State.abortChannelImport = false;

      statusText.textContent = "Resolving channel & uploads playlist...";
      statusBar.style.width = "10%";

      try {
        let uploadsPlaylistId = null;
        let channelTitle = "YouTube Channel";

        // Check if query is directly an uploads playlist (UU...)
        if (channelQuery.startsWith("UU") || channelQuery.startsWith("PL")) {
          uploadsPlaylistId = channelQuery;
        } else {
          // Resolve channel via API
          let channelUrl = "";
          if (channelQuery.startsWith("@") || channelQuery.includes("/@")) {
            const handle = channelQuery.split("/").pop().replace("@", "");
            channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
          } else if (channelQuery.startsWith("UC")) {
            channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelQuery}&key=${apiKey}`;
          } else {
            // General query fallback
            channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forUsername=${encodeURIComponent(channelQuery)}&key=${apiKey}`;
          }

          const chanRes = await fetch(channelUrl);
          const chanData = await chanRes.json();

          if (chanData.error) {
            throw new Error(chanData.error.message || "YouTube API error");
          }

          if (!chanData.items || chanData.items.length === 0) {
            // If forUsername failed, try search
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelQuery)}&key=${apiKey}`;
            const sRes = await fetch(searchUrl);
            const sData = await sRes.json();
            if (sData.items && sData.items.length > 0) {
              const chanId = sData.items[0].snippet.channelId;
              channelTitle = sData.items[0].snippet.channelTitle;
              uploadsPlaylistId = "UU" + chanId.substring(2);
            } else {
              throw new Error("Channel not found. Please verify the handle or Channel ID (UC...).");
            }
          } else {
            const item = chanData.items[0];
            channelTitle = item.snippet.title;
            uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
          }
        }

        if (!uploadsPlaylistId) {
          throw new Error("Could not find uploads playlist for this channel.");
        }

        // Paginate playlist items
        statusText.textContent = `Fetching uploads for ${channelTitle}...`;
        statusBar.style.width = "25%";

        let pageToken = "";
        const fetchedVideos = [];
        const existingIds = new Set(State.allVideos.map(v => v.id));

        while (fetchedVideos.length < maxLimit && !State.abortChannelImport) {
          const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${pageToken}&key=${apiKey}`;
          const plRes = await fetch(plUrl);
          const plData = await plRes.json();

          if (plData.error) {
            throw new Error(plData.error.message || "Failed fetching playlist");
          }

          if (!plData.items || plData.items.length === 0) break;

          for (const item of plData.items) {
            const vidId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
            if (vidId && !existingIds.has(vidId)) {
              existingIds.add(vidId);
              fetchedVideos.push({
                id: vidId,
                title: item.snippet.title || `Video ${vidId}`,
                channelTitle: item.snippet.channelTitle || channelTitle,
                duration: "--:--",
                durationSec: 0,
                publishedAt: item.snippet.publishedAt || item.contentDetails.videoPublishedAt,
                classification: "unsorted"
              });
            }
            if (fetchedVideos.length >= maxLimit) break;
          }

          statusCount.textContent = `${fetchedVideos.length} / ${maxLimit}`;
          const pct = Math.min(85, Math.round(25 + (fetchedVideos.length / maxLimit) * 50));
          statusBar.style.width = `${pct}%`;

          pageToken = plData.nextPageToken;
          if (!pageToken) break;
        }

        // Fetch Durations in batches of 50 via videos.list
        if (fetchedVideos.length > 0 && !State.abortChannelImport) {
          statusText.textContent = "Fetching video durations...";
          for (let i = 0; i < fetchedVideos.length; i += 50) {
            const batch = fetchedVideos.slice(i, i + 50);
            const idsStr = batch.map(v => v.id).join(",");
            const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsStr}&key=${apiKey}`;
            try {
              const vRes = await fetch(vUrl);
              const vData = await vRes.json();
              if (vData.items) {
                const map = new Map(vData.items.map(it => [it.id, it.contentDetails.duration]));
                batch.forEach(v => {
                  if (map.has(v.id)) {
                    const parsed = parseDurationISO(map.get(v.id));
                    v.duration = parsed.str;
                    v.durationSec = parsed.sec;
                  }
                });
              }
            } catch (err) {
              console.warn("Could not fetch duration batch:", err);
            }
          }
        }

        // Finalize Import
        if (fetchedVideos.length > 0) {
          fetchedVideos.forEach((v, idx) => {
            v.importOrder = State.allVideos.length + idx;
          });
          State.allVideos.push(...fetchedVideos);
          await dbBulkPutVideos(fetchedVideos);
          rebuildQueue();
          closeAllModals();
          showToast(`Successfully added ${fetchedVideos.length} videos from ${channelTitle}!`);
        } else {
          showToast("No new videos found (all already imported or empty channel).");
        }

      } catch (err) {
        console.error("Channel import error:", err);
        showToast(`Import error: ${err.message}`);
      } finally {
        progressBox.style.display = "none";
        startBtn.disabled = false;
      }
    }

    /* ==========================================================================
       CSV EXPORT & JSON BACKUP
       ========================================================================== */
    function exportCategoryCSV(category, filename) {
      const items = State.allVideos.filter(v => v.classification === category);
      if (items.length === 0) {
        showToast(`No videos categorized as ${category.toUpperCase()} yet`);
        return;
      }

      // Format: 1 column named url with normalized https://www.youtube.com/watch?v=VIDEO_ID
      let csvContent = "\uFEFFurl\r\n"; // UTF-8 BOM
      items.forEach(v => {
        csvContent += `https://www.youtube.com/watch?v=${v.id}\r\n`;
      });

      downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
      showToast(`Exported ${items.length} URLs to ${filename}`);
    }

    async function exportAllCSVs() {
      exportCategoryCSV("watch", "watch.csv");
      // Delay downloads slightly to allow browser multi-download permission
      setTimeout(() => exportCategoryCSV("archive", "archive.csv"), 600);
      setTimeout(() => exportCategoryCSV("avoid", "avoid.csv"), 1200);
    }

    function exportSessionJSON() {
      const payload = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        settings: {
          filterMode: State.filterMode,
          sortMode: State.sortMode,
          hapticEnabled: State.hapticEnabled,
          wakeLockEnabled: State.wakeLockEnabled
        },
        videos: State.allVideos
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const filename = `youtube_swipe_backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(jsonStr, filename, "application/json;charset=utf-8;");
      showToast("Session backup exported");
    }

    async function restoreSessionJSON(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || !Array.isArray(data.videos)) {
            throw new Error("Invalid backup format: missing videos array");
          }

          const existingMap = new Map(State.allVideos.map(v => [v.id, v]));
          let mergedCount = 0;

          data.videos.forEach(v => {
            if (v.id) {
              existingMap.set(v.id, v);
              mergedCount++;
            }
          });

          State.allVideos = Array.from(existingMap.values());
          await dbBulkPutVideos(State.allVideos);
          rebuildQueue();
          closeAllModals();
          showToast(`Successfully restored/merged ${mergedCount} videos`);
        } catch (err) {
          console.error("Restore error:", err);
          showToast(`Backup error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }

    function downloadFile(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 300);
    }

    /* ==========================================================================
       QUEUE MODAL & ITEM LIST VIEW
       ========================================================================== */
    function renderQueueModalList() {
      const container = document.getElementById("queue-items-container");
      container.innerHTML = "";

      let items = [];
      if (State.filterMode === "unsorted") {
        items = State.allVideos.filter(v => !v.classification || v.classification === "unsorted");
      } else if (State.filterMode === "all") {
        items = [...State.allVideos];
      } else {
        items = State.allVideos.filter(v => v.classification === State.filterMode);
      }

      if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No videos in this category.</div>`;
        return;
      }

      // Display up to 100 items for performant scrolling
      const displayItems = items.slice(0, 100);

      displayItems.forEach((v, idx) => {
        const itemEl = document.createElement("div");
        const isCurrent = State.currentVideo && State.currentVideo.id === v.id;
        itemEl.className = `queue-item ${isCurrent ? 'active' : ''}`;

        const catClass = v.classification || "unsorted";
        itemEl.innerHTML = `
          <img class="queue-item-thumb" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy">
          <div class="queue-item-info">
            <div class="queue-item-title">${v.title || v.id}</div>
            <div class="queue-item-meta">
              <span>${v.channelTitle || 'Channel'}</span>
              <span>•</span>
              <span>${v.duration || '--:--'}</span>
            </div>
          </div>
          <span class="cat-tag ${catClass}">${catClass}</span>
        `;

        itemEl.addEventListener("click", () => {
          // Jump to this video
          const foundIdx = State.queue.indexOf(v.id);
          if (foundIdx !== -1) {
            State.queueIndex = foundIdx;
          } else {
            State.queue.splice(State.queueIndex, 0, v.id);
          }
          renderCurrentCard();
          closeAllModals();
        });

        container.appendChild(itemEl);
      });

      if (items.length > 100) {
        const moreNotice = document.createElement("div");
        moreNotice.style.cssText = "text-align:center; padding:10px; font-size:11px; color:var(--text-muted);";
        moreNotice.textContent = `... and ${items.length - 100} more items in list`;
        container.appendChild(moreNotice);
      }
    }

    /* ==========================================================================
       SCREEN WAKE LOCK API & HAPTIC VIBRATION
       ========================================================================== */
    async function requestWakeLock() {
      if (!State.wakeLockEnabled || !("wakeLock" in navigator)) return;
      try {
        State.wakeLockSentinel = await navigator.wakeLock.request("screen");
        State.wakeLockSentinel.addEventListener("release", () => {
          State.wakeLockSentinel = null;
        });
      } catch (err) {
        // Can fail if browser tab is backgrounded
      }
    }

    function releaseWakeLock() {
      if (State.wakeLockSentinel) {
        State.wakeLockSentinel.release();
        State.wakeLockSentinel = null;
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    });

    function triggerHaptic() {
      if (!State.hapticEnabled || !("vibrate" in navigator)) return;
      try {
        navigator.vibrate(35); // 35ms subtle tactile pulse
      } catch (e) {}
    }

    /* ==========================================================================
       TOAST & MODAL CONTROLLERS
       ========================================================================== */
    let toastTimeout = null;
    function showToast(msg) {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
      }, 2500);
    }

    function openModal(id) {
      closeAllModals();
      const m = document.getElementById(id);
      if (m) m.classList.add("open");
    }

    function closeAllModals() {
      document.querySelectorAll(".modal-backdrop").forEach(el => el.classList.remove("open"));
    }

    /* ==========================================================================
       EVENT LISTENERS & BINDINGS
       ========================================================================== */
    function setupEventListeners() {
      // Primary Action Buttons
      document.getElementById("btn-action-watch").addEventListener("click", () => classifyCurrentVideo("watch", "right"));
      document.getElementById("btn-action-avoid").addEventListener("click", () => classifyCurrentVideo("avoid", "left"));
      document.getElementById("btn-action-archive").addEventListener("click", () => classifyCurrentVideo("archive", "down"));
      document.getElementById("btn-undo").addEventListener("click", undoLastDecision);

      // Player Controls
      document.getElementById("btn-manual-play").addEventListener("click", () => {
        const thumbOverlay = document.getElementById("player-thumb-overlay");
        if (thumbOverlay) thumbOverlay.classList.add("hidden");
        if (State.ytPlayer) {
          if (State.ytPlayer.unMute && !State.muteAutoplay) State.ytPlayer.unMute();
          if (State.ytPlayer.playVideo) State.ytPlayer.playVideo();
        }
        showUnmutePrompt(false);
      });

      document.getElementById("btn-toggle-play").addEventListener("click", () => {
        if (!State.ytPlayer) return;
        if (State.currentPlaybackState === YT.PlayerState.PLAYING) {
          State.ytPlayer.pauseVideo();
        } else {
          const thumbOverlay = document.getElementById("player-thumb-overlay");
          if (thumbOverlay) thumbOverlay.classList.add("hidden");
          if (State.ytPlayer.unMute && !State.muteAutoplay) State.ytPlayer.unMute();
          State.ytPlayer.playVideo();
          showUnmutePrompt(false);
        }
      });

      // Autoplay Toggle Button
      const btnToggleAutoplay = document.getElementById("btn-toggle-autoplay");
      if (btnToggleAutoplay) {
        btnToggleAutoplay.addEventListener("click", () => {
          State.autoplayEnabled = !State.autoplayEnabled;
          dbSetSetting("autoplay_enabled", State.autoplayEnabled);
          updateAutoplayUI();
          showToast(State.autoplayEnabled ? "Autoplay enabled: videos play automatically" : "Autoplay disabled");
          if (State.autoplayEnabled && State.ytPlayer && State.currentPlaybackState !== YT.PlayerState.PLAYING) {
            State.ytPlayer.playVideo();
          }
        });
      }

      // Aspect Ratio Toggle Button (9:16 Drama vs 16:9 Landscape)
      const btnToggleAspect = document.getElementById("btn-toggle-aspect");
      if (btnToggleAspect) {
        btnToggleAspect.addEventListener("click", () => {
          State.aspectRatioMode = State.aspectRatioMode === "vertical" ? "standard" : "vertical";
          dbSetSetting("aspect_ratio_mode", State.aspectRatioMode);
          updateCardAspectRatio();
          showToast(`Player layout: ${State.aspectRatioMode === "vertical" ? "Vertical Drama (9:16)" : "Standard Landscape (16:9)"}`);
        });
      }

      // Unmute Prompt Banner
      const bannerUnmute = document.getElementById("banner-unmute-prompt");
      if (bannerUnmute) {
        bannerUnmute.addEventListener("click", unmuteAndDismiss);
      }

      // Global click to unmute if browser policy initially started muted
      window.addEventListener("pointerdown", () => {
        const banner = document.getElementById("banner-unmute-prompt");
        if (banner && banner.style.display === "flex") {
          unmuteAndDismiss();
        }
      }, { passive: true });

      document.getElementById("btn-seek-back").addEventListener("click", () => {
        if (State.ytPlayer && State.ytPlayer.getCurrentTime) {
          const cur = State.ytPlayer.getCurrentTime();
          State.ytPlayer.seekTo(Math.max(0, cur - 10), true);
        }
      });

      document.getElementById("btn-seek-fwd").addEventListener("click", () => {
        if (State.ytPlayer && State.ytPlayer.getCurrentTime) {
          const cur = State.ytPlayer.getCurrentTime();
          State.ytPlayer.seekTo(cur + 10, true);
        }
      });

      document.getElementById("select-speed").addEventListener("change", (e) => {
        const speed = parseFloat(e.target.value);
        if (State.ytPlayer && State.ytPlayer.setPlaybackRate) {
          State.ytPlayer.setPlaybackRate(speed);
        }
      });

      document.getElementById("btn-open-external-yt").addEventListener("click", () => {
        if (State.currentVideo) {
          window.open(`https://www.youtube.com/watch?v=${State.currentVideo.id}`, "_blank", "noopener");
        }
      });

      // Player Error Actions
      document.getElementById("btn-err-open-yt").addEventListener("click", () => {
        if (State.currentVideo) {
          window.open(`https://www.youtube.com/watch?v=${State.currentVideo.id}`, "_blank", "noopener");
        }
      });

      document.getElementById("btn-err-retry").addEventListener("click", () => {
        if (State.currentVideo) {
          loadVideoInPlayer(State.currentVideo.id);
        }
      });

      document.getElementById("btn-err-skip").addEventListener("click", () => {
        State.queueIndex++;
        renderCurrentCard();
      });

      // Header Modals
      document.getElementById("btn-open-queue").addEventListener("click", () => {
        renderQueueModalList();
        openModal("modal-queue");
      });

      document.getElementById("btn-open-menu").addEventListener("click", () => openModal("modal-menu"));

      // Modal Closers
      document.querySelectorAll(".btn-close-modal").forEach(btn => {
        btn.addEventListener("click", closeAllModals);
      });
      document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
        backdrop.addEventListener("click", (e) => {
          if (e.target === backdrop) closeAllModals();
        });
      });

      // Empty State Buttons
      document.getElementById("btn-empty-export-all").addEventListener("click", exportAllCSVs);
      document.getElementById("btn-empty-review-all").addEventListener("click", () => {
        State.filterMode = "all";
        document.getElementById("select-queue-filter").value = "all";
        rebuildQueue();
      });
      document.getElementById("btn-empty-import").addEventListener("click", () => openModal("modal-import"));

      // Import Tabs (Active Tab, URLs, Channel API)
      const tabActive = document.getElementById("tab-import-active");
      const tabUrls = document.getElementById("tab-import-urls");
      const tabChan = document.getElementById("tab-import-channel");
      const panelActive = document.getElementById("panel-import-active");
      const panelUrls = document.getElementById("panel-import-urls");
      const panelChan = document.getElementById("panel-import-channel");

      const selectImportTab = (activeTab, activePanel) => {
        [tabActive, tabUrls, tabChan].forEach(t => t && t.classList.remove("active"));
        [panelActive, panelUrls, panelChan].forEach(p => p && (p.style.display = "none"));
        if (activeTab) activeTab.classList.add("active");
        if (activePanel) activePanel.style.display = "block";
      };

      if (tabActive) tabActive.addEventListener("click", () => selectImportTab(tabActive, panelActive));
      if (tabUrls) tabUrls.addEventListener("click", () => selectImportTab(tabUrls, panelUrls));
      if (tabChan) tabChan.addEventListener("click", () => selectImportTab(tabChan, panelChan));

      // Active YouTube Tab Scan Buttons
      const btnImportActiveTab = document.getElementById("btn-import-active-tab");
      if (btnImportActiveTab) {
        btnImportActiveTab.addEventListener("click", importFromActiveYouTubeTab);
      }
      const btnScanActiveTab = document.getElementById("btn-scan-active-tab");
      if (btnScanActiveTab) {
        btnScanActiveTab.addEventListener("click", importFromActiveYouTubeTab);
      }
      const btnEmptyImportTab = document.getElementById("btn-empty-import-tab");
      if (btnEmptyImportTab) {
        btnEmptyImportTab.addEventListener("click", importFromActiveYouTubeTab);
      }

      // Parse URLs Button
      document.getElementById("btn-parse-urls").addEventListener("click", () => {
        const text = document.getElementById("input-urls").value;
        importFromUrlsText(text);
      });

      // Load Demo Data Buttons
      document.querySelectorAll("[id^='btn-load-demo-data']").forEach(btn => {
        btn.addEventListener("click", async () => {
          const existingIds = new Set(State.allVideos.map(v => v.id));
          const toAdd = DEMO_VIDEOS.filter(v => !existingIds.has(v.id)).map((v, i) => ({
            ...v,
            importOrder: State.allVideos.length + i
          }));

          if (toAdd.length > 0) {
            State.allVideos.push(...toAdd);
            await dbBulkPutVideos(toAdd);
            rebuildQueue();
            closeAllModals();
            showToast(`Loaded ${toAdd.length} demo videos!`);
          } else {
            showToast("Demo videos are already loaded.");
          }
        });
      });

      // File Import (Text / CSV)
      document.getElementById("file-import-urls").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => importFromUrlsText(ev.target.result);
          reader.readAsText(file);
        }
      });

      // Channel Import
      document.getElementById("btn-start-channel-import").addEventListener("click", startChannelImport);
      document.getElementById("btn-cancel-import").addEventListener("click", () => {
        State.abortChannelImport = true;
      });
      document.getElementById("link-show-api-guide").addEventListener("click", (e) => {
        e.preventDefault();
        openModal("modal-api-guide");
      });

      // Queue Modal Filter & Sort
      document.getElementById("select-queue-filter").addEventListener("change", (e) => {
        State.filterMode = e.target.value;
        rebuildQueue();
        renderQueueModalList();
      });

      document.getElementById("select-queue-sort").addEventListener("change", (e) => {
        State.sortMode = e.target.value;
        rebuildQueue();
        renderQueueModalList();
      });

      document.getElementById("btn-shuffle-quick").addEventListener("click", () => {
        State.sortMode = "shuffle";
        document.getElementById("select-queue-sort").value = "shuffle";
        rebuildQueue();
        renderQueueModalList();
        showToast("Queue shuffled!");
      });

      // Exports
      document.getElementById("btn-export-watch").addEventListener("click", () => exportCategoryCSV("watch", "watch.csv"));
      document.getElementById("btn-export-archive").addEventListener("click", () => exportCategoryCSV("archive", "archive.csv"));
      document.getElementById("btn-export-avoid").addEventListener("click", () => exportCategoryCSV("avoid", "avoid.csv"));
      document.getElementById("btn-export-all-csv").addEventListener("click", exportAllCSVs);
      document.getElementById("btn-export-json").addEventListener("click", exportSessionJSON);

      document.getElementById("file-restore-json").addEventListener("change", (e) => {
        restoreSessionJSON(e.target.files[0]);
      });

      // Settings toggles
      document.getElementById("toggle-haptic").addEventListener("change", (e) => {
        State.hapticEnabled = e.target.checked;
        dbSetSetting("haptic", e.target.checked);
      });

      document.getElementById("toggle-wakelock").addEventListener("change", (e) => {
        State.wakeLockEnabled = e.target.checked;
        dbSetSetting("wakelock", e.target.checked);
        if (State.wakeLockEnabled) requestWakeLock();
        else releaseWakeLock();
      });

      document.getElementById("toggle-mute-autoplay").addEventListener("change", (e) => {
        State.muteAutoplay = e.target.checked;
        dbSetSetting("mute_autoplay", e.target.checked);
      });

      // Settings: Autoplay toggle
      const toggleAutoplay = document.getElementById("toggle-autoplay");
      if (toggleAutoplay) {
        toggleAutoplay.addEventListener("change", (e) => {
          State.autoplayEnabled = e.target.checked;
          dbSetSetting("autoplay_enabled", e.target.checked);
          updateAutoplayUI();
          showToast(State.autoplayEnabled ? "Autoplay enabled" : "Autoplay disabled");
          if (State.autoplayEnabled && State.ytPlayer && State.currentPlaybackState !== YT.PlayerState.PLAYING) {
            State.ytPlayer.playVideo();
          }
        });
      }

      // Settings: Aspect ratio selector
      const selectAspect = document.getElementById("select-aspect-ratio");
      if (selectAspect) {
        selectAspect.addEventListener("change", (e) => {
          State.aspectRatioMode = e.target.value;
          dbSetSetting("aspect_ratio_mode", e.target.value);
          updateCardAspectRatio();
          showToast(`Player: ${e.target.options[e.target.selectedIndex].text}`);
        });
      }

      // Settings: AMOLED Pure Black toggle
      const toggleAmoled = document.getElementById("toggle-amoled");
      if (toggleAmoled) {
        toggleAmoled.addEventListener("change", (e) => {
          setAmoledTheme(e.target.checked);
          showToast(e.target.checked ? "AMOLED True Black enabled" : "Standard theme restored");
        });
      }

      // Header AMOLED Quick Toggle
      const btnToggleAmoled = document.getElementById("btn-toggle-amoled");
      if (btnToggleAmoled) {
        btnToggleAmoled.addEventListener("click", () => {
          setAmoledTheme(!State.amoledEnabled);
          showToast(State.amoledEnabled ? "AMOLED True Black enabled" : "Standard theme restored");
        });
      }

      // Settings: Auto-advance countdown toggle
      const toggleAutoAdv = document.getElementById("toggle-auto-advance");
      if (toggleAutoAdv) {
        toggleAutoAdv.addEventListener("change", (e) => {
          State.autoAdvanceEnabled = e.target.checked;
          dbSetSetting("auto_advance_enabled", e.target.checked);
          showToast(e.target.checked ? "Auto-advance enabled" : "Auto-advance disabled");
        });
      }

      // Auto-advance Countdown Pill Actions
      const btnAdvanceNow = document.getElementById("btn-advance-now");
      if (btnAdvanceNow) {
        btnAdvanceNow.addEventListener("click", () => {
          cancelAutoAdvanceCountdown();
          classifyCurrentVideo("watch", "right");
        });
      }

      const btnAdvanceCancel = document.getElementById("btn-advance-cancel");
      if (btnAdvanceCancel) {
        btnAdvanceCancel.addEventListener("click", () => {
          cancelAutoAdvanceCountdown();
          showToast("Auto-advance cancelled for this episode");
        });
      }

      // Floating Bottom Undo Pill Action
      const btnFloatingUndo = document.getElementById("btn-floating-undo");
      if (btnFloatingUndo) {
        btnFloatingUndo.addEventListener("click", () => {
          undoLastDecision();
        });
      }

      // Binge Playlist & Copy URLs Actions
      const btnQuickPlaylist = document.getElementById("btn-quick-playlist");
      if (btnQuickPlaylist) {
        btnQuickPlaylist.addEventListener("click", openWatchPlaylist);
      }
      const btnModalOpenPlaylist = document.getElementById("btn-modal-open-playlist");
      if (btnModalOpenPlaylist) {
        btnModalOpenPlaylist.addEventListener("click", openWatchPlaylist);
      }

      const btnQuickCopy = document.getElementById("btn-quick-copy");
      if (btnQuickCopy) {
        btnQuickCopy.addEventListener("click", copyWatchUrlsToClipboard);
      }
      const btnModalCopyUrls = document.getElementById("btn-modal-copy-urls");
      if (btnModalCopyUrls) {
        btnModalCopyUrls.addEventListener("click", copyWatchUrlsToClipboard);
      }

      // Clear all data
      document.getElementById("btn-clear-all-data").addEventListener("click", async () => {
        if (confirm("Are you sure you want to delete all saved videos, classifications, and local data? This cannot be undone.")) {
          await dbClearAll();
          State.allVideos = [];
          State.queue = [];
          State.queueIndex = 0;
          State.undoStack = [];
          updateStats();
          renderCurrentCard();
          closeAllModals();
          showToast("All local data has been erased.");
        }
      });

      // Fix local origin modal button
      const fixBtn = document.getElementById("btn-fix-local-origin");
      if (fixBtn) {
        fixBtn.addEventListener("click", () => openModal("modal-local-origin-guide"));
      }

      // Keyboard Shortcuts
      window.addEventListener("keydown", (e) => {
        // Ignore if user is currently typing in an input or textarea
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

        if (e.key === "ArrowRight") {
          e.preventDefault();
          classifyCurrentVideo("watch", "right");
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          classifyCurrentVideo("avoid", "left");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          classifyCurrentVideo("archive", "down");
        } else if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          undoLastDecision();
        } else if (e.key === " ") {
          e.preventDefault();
          document.getElementById("btn-toggle-play").click();
        } else if (e.key === "j" || e.key === "J") {
          document.getElementById("btn-seek-back").click();
        } else if (e.key === "l" || e.key === "L") {
          document.getElementById("btn-seek-fwd").click();
        }
      });
    }

    /* ==========================================================================
       APP INITIALIZATION & RESUME RESTORATION
       ========================================================================== */
    async function initApp() {
      setupGestures();
      setupPlayerGestures();
      setupEventListeners();
      checkPendingExtensionImports();

      // Check if opened via local file scheme (content:// or file://)
      const isLocalOrigin = window.location.protocol === "file:" ||
                            window.location.protocol === "content:" ||
                            window.location.origin === "null";
      if (isLocalOrigin) {
        const banner = document.getElementById("banner-local-file");
        if (banner) banner.style.display = "flex";
      }

      try {
        await initDatabase();

        // Restore Settings
        const savedApiKey = await dbGetSetting("yt_api_key", "");
        if (savedApiKey) {
          State.apiKey = savedApiKey;
          document.getElementById("input-api-key").value = savedApiKey;
        }

        const haptic = await dbGetSetting("haptic", true);
        State.hapticEnabled = haptic;
        document.getElementById("toggle-haptic").checked = haptic;

        const wake = await dbGetSetting("wakelock", true);
        State.wakeLockEnabled = wake;
        document.getElementById("toggle-wakelock").checked = wake;

        const mute = await dbGetSetting("mute_autoplay", false);
        State.muteAutoplay = mute;
        document.getElementById("toggle-mute-autoplay").checked = mute;

        const auto = await dbGetSetting("autoplay_enabled", true);
        State.autoplayEnabled = auto;

        const aspect = await dbGetSetting("aspect_ratio_mode", "vertical");
        State.aspectRatioMode = aspect;

        const autoAdvance = await dbGetSetting("auto_advance_enabled", true);
        State.autoAdvanceEnabled = autoAdvance;
        const toggleAutoAdvInput = document.getElementById("toggle-auto-advance");
        if (toggleAutoAdvInput) toggleAutoAdvInput.checked = autoAdvance;

        const amoled = await dbGetSetting("amoled_theme", false);
        setAmoledTheme(amoled);

        updateAutoplayUI();
        updateCardAspectRatio();

        // Restore Videos
        const savedVideos = await dbGetAllVideos();
        if (savedVideos && savedVideos.length > 0) {
          State.allVideos = savedVideos;
          rebuildQueue();
        } else {
          // First time launch: Prompt import modal or offer demo dataset
          openModal("modal-import");
        }

        requestWakeLock();
      } catch (err) {
        console.error("Initialization failed:", err);
        showToast("Storage initialization failed. Check browser privacy mode.");
      }
    }

    // Start App when DOM is loaded
    document.addEventListener("DOMContentLoaded", initApp);