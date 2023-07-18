const targetBaseURL =
  "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list";
const targetMailboxes = ["INBOX"];
const watchFirstPageOnly = true;

const config = new Config(targetBaseURL, targetMailboxes, watchFirstPageOnly);
const watcher = new MailWatcher(config);

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!chrome.runtime?.id) {
    sendResponse({ ok: false });
    return;
  }

  if (!watcher) {
    console.error("watcher is not initalized yet.");
    sendResponse({ ok: false });
    return;
  }

  if (message.event == "onWatcherStateChanged") {
    let isWatching = message.data;

    if (isWatching) {
      watcher.startWatching();
      console.info("start watching...");
      sendResponse({ ok: true, isWatching: true });
    } else {
      watcher.stopWatching();
      console.info("stop watching...");
      sendResponse({ ok: true, isWatching: false });
    }
  }
});

(async () => {
  try {
    if (!watcher) {
      throw new Error("watcher is not initalized yet");
    }

    await watcher.loadWatcherState();

    if (watcher.isWatching) {
      watcher.startWatching();
      console.info("start watching...");
    } else {
      watcher.stopWatching();
      console.info("stop watching...");
    }
  } catch (error) {
    console.error(`failed to get watch state: ${error}`);
  }
})();

console.debug("content script is injected");
