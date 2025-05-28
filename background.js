const TARGET_URL_INPUT_SELECTOR = '#video-url';
const TARGET_SUBMIT_BUTTON_SELECTOR = '#convert-button-1';
const CNVMP3_TARGET_URL = 'https://cnvmp3.com/';

function performCnvmp3Processing(urlToProcess, callback) {
  console.log("Background: Initiating processing for URL:", urlToProcess);

  chrome.tabs.create({ url: CNVMP3_TARGET_URL, active: true }, (newTab) => {
    if (chrome.runtime.lastError || !newTab || !newTab.id) {
      let errorMsg = "Error creating tab for cnvmp3.com";
      if (chrome.runtime.lastError) errorMsg += ": " + chrome.runtime.lastError.message;
      console.error("Background:", errorMsg);
      if (callback) callback({ status: errorMsg });
      return;
    }
    console.log("Background: Opened new tab with ID:", newTab.id, "URL:", newTab.pendingUrl || newTab.url);

    const tabUpdateListener = (tabId, changeInfo, tab) => {
      if (tabId === newTab.id && changeInfo.status === 'complete' && tab.url && tab.url.startsWith(CNVMP3_TARGET_URL)) {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);

        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: injectedFunctionToPasteAndClick,
          args: [urlToProcess, TARGET_URL_INPUT_SELECTOR, TARGET_SUBMIT_BUTTON_SELECTOR]
        }, (injectionResults) => {
          let responseStatus = "Script executed. Check target tab's console.";
          if (chrome.runtime.lastError) {
            responseStatus = "Script injection failed: " + chrome.runtime.lastError.message;
            console.error("Background: Script injection failed:", chrome.runtime.lastError.message);
          } else if (injectionResults && injectionResults[0] && injectionResults[0].result && injectionResults[0].result.message) {
            responseStatus = injectionResults[0].result.message;
            console.log("Background: Script executed in target tab. Result:", injectionResults[0].result);
          } else {
            console.warn("Background: Script executed, but no specific result object or message. Results:", injectionResults);
          }
          if (callback) callback({ status: responseStatus });
        });
      } else if (tabId === newTab.id && changeInfo.status === 'complete' && tab.url && !tab.url.startsWith(CNVMP3_TARGET_URL)) {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        const redirectMsg = "Tab redirected from target URL. Action aborted.";
        console.warn("Background: Target tab", tabId, "loaded but redirected to:", tab.url, ". Cannot operate.");
        if (callback) callback({ status: redirectMsg });
      }
    };
    chrome.tabs.onUpdated.addListener(tabUpdateListener);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pasteAndGo" && request.url) {
    performCnvmp3Processing(request.url, sendResponse);
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

const CONTEXT_MENU_ID = "processPageWithCnvmp3ContextMenu";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Download URL with CNVMP3",
    contexts: ["page"] // Show only when right-clicking on a page
  });
  console.log("Background: Context menu item created/updated.");
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    if (info.pageUrl) {
      if (info.pageUrl.startsWith("http:") || info.pageUrl.startsWith("https:")) {
        performCnvmp3Processing(info.pageUrl, (response) => {
          if (chrome.notifications) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: 'cnvmp3 URL Processor',
              message: response && response.status ? response.status : "Processing initiated."
            });
          } else {
            console.log("Background (Context Menu Action):", response && response.status ? response.status : "Processing initiated.");
          }
        });
      } else {
        console.warn("Background: Context menu clicked on a non http/https page:", info.pageUrl);
        if (chrome.notifications) {
            chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'cnvmp3 URL Processor', message: 'Cannot process: URL is not http/https.'});
        }
      }
    } else {
      console.warn("Background: Context menu clicked, but no pageUrl found in info object.");
       if (chrome.notifications) {
            chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'cnvmp3 URL Processor', message: 'Cannot process: No page URL found.'});
        }
    }
  }
});

function injectedFunctionToPasteAndClick(url, inputSelector, buttonSelector) {
  console.log("Injected Script: Running. URL:", url, "InputSel:", inputSelector, "ButtonSel:", buttonSelector);
  const urlInput = document.querySelector(inputSelector);
  const submitButton = document.querySelector(buttonSelector);
  let statusMessage = "";

  if (urlInput) {
    urlInput.value = url;
    urlInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    urlInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    statusMessage += "URL pasted into " + inputSelector + ". ";
    console.log("Injected Script: Pasted URL into", inputSelector);

    if (submitButton) {
      setTimeout(() => {
        submitButton.click();
        console.log("Injected Script: Clicked button " + buttonSelector);
      }, 500);
      statusMessage += "Submit button " + buttonSelector + " clicked.";
    } else {
      statusMessage += "Submit button NOT found with selector: " + buttonSelector + ".";
      console.error('Injected Script: Submit button not found with selector:', buttonSelector);
    }
  } else {
    statusMessage += "URL input field NOT found with selector: " + inputSelector + ".";
    console.error('Injected Script: URL input field not found with selector:', inputSelector);
  }
  return { message: statusMessage };
}