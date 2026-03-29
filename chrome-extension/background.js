chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "upscaleImage",
      title: "✨ 用我的 AI 修復這張圖",
      contexts: ["image"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "upscaleImage") {
      const yourWebsite = "https://my-ai-site-dr-1am.vercel.app/";
      const targetUrl = yourWebsite;
      
      chrome.tabs.create({ url: targetUrl });
    }
  });