const targetBaseURL =
  "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list";
const targetMailboxes = ["INBOX"];
const watchFirstPageOnly = true;

const config = new Config(targetBaseURL, targetMailboxes, watchFirstPageOnly);
const watcher = new MailWatcher(config);

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!chrome.runtime?.id) {
    return;
  }

  if (!watcher) {
    logger.error("watcher is not initalized yet.");
    return;
  }

  if (message.event == "onWatcherStateChanged") {
    let isWatching = message.data;

    if (isWatching) {
      watcher.startWatching();
      logger.info("start watching...");
      sendResponse({ ok: true, isWatching: true });
    } else {
      watcher.stopWatching();
      logger.info("stop watching...");
      sendResponse({ ok: true, isWatching: false });
    }
  }
});

(async () => {
  try {
    if (!watcher) {
      throw new Error("watcher is not initalized yet");
    }

    const isWatching = (await storage.get("isWatching")) ?? false;

    if (isWatching) {
      if (isWatching) {
        watcher.startWatching();
        logger.info("start watching...");
      } else {
        watcher.stopWatching();
        logger.info("stop watching...");
      }
    }
  } catch (error) {
    logger.error(`failed to get watch state: ${error}`);
  }
})();

logger.debug("content script is injected");
