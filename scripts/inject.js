const config = new Config(
  "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list", // targetBaseURL
  ["INBOX"], // targetMailboxes
  true // watchFirstPageOnly
);

console.log("Loading injection script...");

const watcher = new MailWatcher(config);
(async function () {
  console.log("Try to load saved watcher state...");
  await watcher.loadWatcherState();
  console.log(`Saved watcher state: ${watcher.isWatching}`);
  if (watcher.isWatching) {
    watcher.startWatching();
    console.log("Start watching...");
  } else {
    watcher.startWatching();
    console.log("Stop watching...");
  }
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.event == "onWatcherStateChanged") {
    console.log(`event: ${message.event}, data: ${message.data}`);
    let isWatching = message.data;

    if (isWatching === true) {
      watcher.startWatching();
      console.log("Start watching...");
      sendResponse({ ok: true, isWatching: true });
    } else if (isWatching === false) {
      watcher.stopWatching();
      console.log("Stop watching...");
      sendResponse({ ok: true, isWatching: false });
    } else {
      sendResponse({ ok: false });
    }
  }
});
