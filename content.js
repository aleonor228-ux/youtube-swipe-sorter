/**
 * YouTube Swipe Sorter — In-Page Content Script
 * Scrapes visible videos from Search, Channel Videos, Shorts, Playlists, and Feeds
 */

(function () {
  let floatingBtn = null;
  let updateDebounce = null;

  // Extract clean video ID and metadata from a DOM card element
  function parseVideoElement(card) {
    const link = card.querySelector('a#video-title, a#video-title-link, a.yt-simple-endpoint[href*="/watch?"], a.yt-simple-endpoint[href*="/shorts/"]');
    if (!link) return null;

    const href = link.getAttribute('href') || '';
    let videoId = null;
    let isVertical = false;

    if (href.includes('/watch?v=')) {
      const match = href.match(/[?&]v=([^&#]+)/);
      if (match) videoId = match[1];
    } else if (href.includes('/shorts/')) {
      const match = href.match(/\/shorts\/([^?&#/]+)/);
      if (match) {
        videoId = match[1];
        isVertical = true;
      }
    }

    if (!videoId) return null;

    const titleText = (link.textContent || link.getAttribute('title') || '').trim();
    if (!titleText) return null;

    // Detect vertical drama cues in title
    if (!isVertical && /vertical|drama|shortmax|reelshort|dramabox|ep\s*\d+|episode\s*\d+/i.test(titleText)) {
      isVertical = true;
    }

    // Channel name
    const chEl = card.querySelector('#channel-name, #byline, .ytd-channel-name');
    const channelTitle = chEl ? chEl.textContent.trim().replace(/\s+/g, ' ') : 'YouTube';

    // Duration badge
    const badgeEl = card.querySelector('ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer, #time-status');
    const duration = badgeEl ? badgeEl.textContent.trim() : (isVertical ? '00:59' : '');

    return {
      id: videoId,
      title: titleText,
      channelTitle: channelTitle || 'YouTube',
      duration: duration,
      classification: 'unsorted',
      isVertical: isVertical
    };
  }

  // Scrapes all currently loaded video cards on the page
  function scrapeVideosFromPage() {
    const seenIds = new Set();
    const videos = [];

    // If currently on a watch page, include current video first
    try {
      const url = new URL(window.location.href);
      if (url.pathname === '/watch' && url.searchParams.get('v')) {
        const curId = url.searchParams.get('v');
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string');
        const channelEl = document.querySelector('#owner #channel-name a, #upload-info #channel-name a');
        videos.push({
          id: curId,
          title: titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', ''),
          channelTitle: channelEl ? channelEl.textContent.trim() : 'YouTube',
          duration: '',
          classification: 'unsorted',
          isVertical: /vertical|drama|shortmax|reelshort|dramabox|ep\s*\d+/i.test(document.title)
        });
        seenIds.add(curId);
      }
    } catch (e) {}

    const selectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-reel-item-renderer'
    ];

    const cards = document.querySelectorAll(selectors.join(', '));
    cards.forEach((card) => {
      const item = parseVideoElement(card);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        videos.push(item);
      }
    });

    return videos;
  }

  // Inject floating button into YouTube page
  function createFloatingButton() {
    if (document.getElementById('yt-swipe-sorter-trigger')) return;

    floatingBtn = document.createElement('div');
    floatingBtn.id = 'yt-swipe-sorter-trigger';
    floatingBtn.innerHTML = `
      <div class="yss-trigger-inner">
        <span class="yss-trigger-icon">⚡</span>
        <span class="yss-trigger-text">Swipe Sorter</span>
        <span class="yss-trigger-badge" id="yss-video-count">0</span>
      </div>
    `;

    floatingBtn.addEventListener('click', () => {
      const videos = scrapeVideosFromPage();
      if (videos.length === 0) {
        showInPageToast('No video cards found on this page. Try scrolling down!');
        return;
      }
      chrome.runtime.sendMessage({
        action: 'OPEN_SIDEPANEL_WITH_VIDEOS',
        videos: videos,
        source: document.title.replace(' - YouTube', '')
      });
      showInPageToast(`Sent ${videos.length} videos to Swipe Sorter! ↗`);
    });

    document.body.appendChild(floatingBtn);
    updateButtonCount();
  }

  function updateButtonCount() {
    if (!floatingBtn) return;
    const badge = document.getElementById('yss-video-count');
    if (!badge) return;
    const count = scrapeVideosFromPage().length;
    badge.textContent = count > 99 ? '99+' : count;
    floatingBtn.style.display = count > 0 ? 'flex' : 'none';
  }

  function showInPageToast(msg) {
    const existing = document.getElementById('yss-inpage-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'yss-inpage-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('yss-fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }

  // Handle message requests from Side Panel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCRAPE_YOUTUBE_VIDEOS') {
      const videos = scrapeVideosFromPage();
      sendResponse({
        videos: videos,
        pageTitle: document.title.replace(' - YouTube', ''),
        url: window.location.href
      });
    }
    return true;
  });

  // --- Keyboard Shortcut: Cmd+S+S (Mac) or Ctrl+S+S (Win/Linux) to open Side Panel ---
  let lastCmdSTime = 0;
  let cmdSPendingTimeout = null;

  function initKeyboardShortcut() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable
      const targetTag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || (e.target && e.target.isContentEditable)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierActive = isMac ? e.metaKey : e.ctrlKey;
      const key = (e.key || '').toLowerCase();

      // Check if modifier (Cmd / Ctrl) is held and key is 's'
      if (modifierActive && key === 's') {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        if (now - lastCmdSTime < 650) {
          // Double press chord detected: Cmd+S+S!
          if (cmdSPendingTimeout) clearTimeout(cmdSPendingTimeout);
          lastCmdSTime = 0;

          const videos = scrapeVideosFromPage();
          showInPageToast(`⚡ Opening Swipe Sorter (${isMac ? 'Cmd+S+S' : 'Ctrl+S+S'})...`);
          chrome.runtime.sendMessage({
            action: 'OPEN_SIDEPANEL_FROM_KEYBOARD',
            videos: videos,
            source: document.title.replace(' - YouTube', '')
          });
        } else {
          // First Cmd+S press: Prompt user to tap 's' once more to complete chord
          lastCmdSTime = now;
          showInPageToast(`Press S again to open Swipe Sorter (${isMac ? 'Cmd+S+S' : 'Ctrl+S+S'})`);
          if (cmdSPendingTimeout) clearTimeout(cmdSPendingTimeout);
          cmdSPendingTimeout = setTimeout(() => {
            lastCmdSTime = 0;
          }, 650);
        }
      }
    }, true);
  }

  // Observe DOM changes on YouTube (SPA navigation & dynamic loading)
  function initObserver() {
    createFloatingButton();
    initKeyboardShortcut();

    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(updateButtonCount, 1200);
    });

    const observer = new MutationObserver(() => {
      if (updateDebounce) clearTimeout(updateDebounce);
      updateDebounce = setTimeout(updateButtonCount, 800);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
