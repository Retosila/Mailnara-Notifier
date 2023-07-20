let watcher;

async function initMailWatcher() {
  const targetMailboxes = [];
  const [targetBaseURL, isInboxTargeted, isJunkTargeted, watchFirstPageOnly] =
    await Promise.all([
      storage.get("targetBaseURL"),
      storage.get("isInboxTargeted"),
      storage.get("isJunkTargeted"),
      storage.get("watchFirstPageOnly"),
    ]);

  const isOptionsValid = [
    targetBaseURL,
    isInboxTargeted,
    isJunkTargeted,
    watchFirstPageOnly,
  ].every((variable) => variable !== undefined && variable !== null);

  if (!isOptionsValid) {
    const errorMsg = `
    options are not set up properly:
        targetBaseURL=${targetBaseURL}
        isInboxTargeted=${isInboxTargeted}
        isJunkTargeted=${isJunkTargeted}
        watchFirstPageOnly=${watchFirstPageOnly}
    `;
    console.error(errorMsg);
    alert(errorMsg);
    return;
  }

  if (isInboxTargeted) {
    targetMailboxes.push("INBOX");
  }

  if (isJunkTargeted) {
    targetMailboxes.push("정크 메일");
  }

  const config = new Config(targetBaseURL, targetMailboxes, watchFirstPageOnly);
  return new MailWatcher(config);
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (!chrome.runtime?.id) {
    // Ignore chrome runtime invalidity error.
    sendResponse({ ok: true });
    return;
  }

  console.log("Called!");

  if (message.event == "onWatcherStateChanged") {
    let isWatching = message.data;

    if (isWatching) {
      initMailWatcher()
        .then((mailWatcher) => {
          watcher = mailWatcher;
          watcher.startWatching();
          console.info("start watching...");
          sendResponse({ ok: true, isWatching: true });
        })
        .catch((error) => {
          console.error(`failed to initialize watcher: ${error}`);
        });
    } else {
      if (watcher) {
        watcher.stopWatching();
      }

      console.info("stop watching...");
      watcher = null;
      sendResponse({ ok: true, isWatching: false });
    }

    // Keep the message channel open until sendResponse is called
    return true;
  }
});

(async () => {
  try {
    const isWatching = (await storage.get("isWatching")) ?? false;
    console.info(`load previous watcher state=${isWatching}`);

    if (!isWatching) {
      return;
    }

    watcher = await initMailWatcher();
    watcher.startWatching();
    console.info("start watching...");
  } catch (error) {
    console.error(`failed to initialize watcher: ${error}`);
  }
})();

console.debug("content script is injected");
