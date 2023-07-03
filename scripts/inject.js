const targetBaseURL =
  "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list";
const targetMailboxes = ["INBOX"];
const watchFirstPageOnly = true;

const config = new Config(targetBaseURL, targetMailboxes, watchFirstPageOnly);
const watcher = new MailWatcher(config);

if (chrome.runtime?.id) {
  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    // Check current injection script has valid context.
    if (!chrome.runtime?.id) {
      console.warn("Runtime context is invalid.");
      return;
    }

    if (!watcher) {
      console.error("Watcher is not initalized yet.");
      return;
    }

    if (message.event == "onWatcherStateChanged") {
      let isWatching = message.data;

      if (isWatching) {
        watcher.startWatching();
        console.info("Start watching...");
        sendResponse({ ok: true, isWatching: true });
      } else {
        watcher.stopWatching();
        console.info("Stop watching...");
        sendResponse({ ok: true, isWatching: false });
      }
    }
  });
} else {
  console.warn("Runtime context is invalid.");
}

(async () => {
  try {
    if (!watcher) {
      throw new Error("Watcher is not initalized yet.");
    }

    const isWatching = (await storage.get("isWatching")) ?? false;

    if (isWatching) {
      if (isWatching) {
        watcher.startWatching();
        console.info("Start watching...");
      } else {
        watcher.stopWatching();
        console.info("Stop watching...");
      }
    }
  } catch (error) {
    console.error(`Failed to get watch state: ${error}`);
  }
})();

console.debug("Content script is injected.");
