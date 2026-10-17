/**
 * YouTube Swipe Sorter — Background Service Worker (Manifest V3)
 */

// Enable the side panel to open automatically when user clicks the extension action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error enabling side panel on click:", error));

// Optional action click listener fallback
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab && tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.warn("Side panel open error:", err);
  }
});

// Listen for keyboard command shortcuts from manifest.json
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command, tab) => {
    try {
      if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.warn("Could not open side panel via command:", err);
    }
  });
}

// Relay messages between content scripts on YouTube and the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "OPEN_SIDEPANEL_WITH_VIDEOS" || request.action === "OPEN_SIDEPANEL_FROM_KEYBOARD") {
    if (sender.tab && sender.tab.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch((err) => {
        console.warn("Could not open side panel by windowId, trying tabId:", err);
        if (sender.tab.id) {
          chrome.sidePanel.open({ tabId: sender.tab.id }).catch(console.warn);
        }
      });
    }
    // Store temporarily in chrome.storage.local so side panel can pick it up on launch
    if (request.videos && request.videos.length > 0) {
      chrome.storage.local.set({ pendingImportVideos: request.videos, pendingImportSource: request.source || "YouTube Page" });
    }
    sendResponse({ status: "ok" });
  }
  return true;
});
