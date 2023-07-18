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
    sendResponse({ ok: false });
    return;
  }

  if (message.event == "onWatcherStateChanged") {
    let isWatching = message.data;

    if (isWatching) {
      watcher.startWatching();

      sendResponse({ ok: true, isWatching: true });
    } else {
      watcher.stopWatching();

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
    } else {
      watcher.stopWatching();
    }
  } catch (error) {}
})();
