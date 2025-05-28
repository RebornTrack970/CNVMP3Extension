document.addEventListener('DOMContentLoaded', function() {

  const pasteAndGoBtn = document.getElementById('pasteAndGoBtn');
  const statusDiv = document.getElementById('status');

  if (!pasteAndGoBtn) {
    statusDiv.textContent = "Error: Popup button not found.";
    return;
  }

  pasteAndGoBtn.addEventListener('click', async () => {
    console.log("Popup: pasteAndGoBtn clicked."); 
    statusDiv.textContent = 'Processing...';
    pasteAndGoBtn.disabled = true;

    try {
      let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.url) {
        if (currentTab.url.startsWith("http:") || currentTab.url.startsWith("https:")) {
          chrome.runtime.sendMessage(
            {
              action: "pasteAndGo",
              url: currentTab.url
            },
            (response) => {
              console.log("Popup: Response from background script received.", response); 
              if (chrome.runtime.lastError) {
                console.error("Popup: Error sending message to background or in response:", chrome.runtime.lastError.message);
                statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
              } else if (response && response.status) {
                console.log("Popup: Background script response status:", response.status);
                statusDiv.textContent = response.status;
              } else {
                statusDiv.textContent = 'No response or unknown error from background.';
                console.warn("Popup: No response or unknown error from background. Full response:", response);
              }
              pasteAndGoBtn.disabled = false;
            }
          );
        } else {
          console.warn("Popup: Invalid URL scheme. Not http/https.");
          statusDiv.textContent = 'Invalid URL. Not http/https.';
          pasteAndGoBtn.disabled = false;
        }
      } else {
        statusDiv.textContent = 'Cannot get current tab URL.';
        pasteAndGoBtn.disabled = false;
      }
    } catch (e) {
        statusDiv.textContent = 'Popup Error: ' + e.message;
        pasteAndGoBtn.disabled = false;
    }
  });
});