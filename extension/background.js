/**
 * YouTube Music Web Controller - Background Service Worker
 * 
 * Handles tab and window activation/focusing on demand when triggered
 * by Stream Deck Long Press or remote commands.
 */

'use strict';

const extApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

if (extApi?.runtime?.onMessage) {
  extApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'YTM_FOCUS_TAB') {
      const tabId = sender?.tab?.id;
      const windowId = sender?.tab?.windowId;

      const focusTabAndWindow = (tId, wId) => {
        try {
          if (tId && extApi.tabs?.update) {
            extApi.tabs.update(tId, { active: true, highlighted: true });
          }
          if (wId && extApi.windows?.update) {
            extApi.windows.update(wId, { focused: true });
          }
        } catch (err) {
          // Suppress error safely
        }
      };

      if (tabId && windowId) {
        focusTabAndWindow(tabId, windowId);
      } else if (extApi.tabs?.query) {
        extApi.tabs.query({ url: '*://music.youtube.com/*' }, (tabs) => {
          if (tabs && tabs.length > 0) {
            focusTabAndWindow(tabs[0].id, tabs[0].windowId);
          }
        });
      }
    }
  });
}
