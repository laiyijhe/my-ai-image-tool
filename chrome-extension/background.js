chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "creatorGuardOpen",
    title: "Creator Guard — open dashboard",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "creatorGuardOpen") {
    const yourWebsite = "https://my-ai-site-dr-1am.vercel.app/";
    chrome.tabs.create({ url: yourWebsite });
  }
});
