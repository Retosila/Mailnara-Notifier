try {
  importScripts("utils.js", "tracker.js", "notifier.js");
} catch (error) {
  console.error(`failed to import scripts: ${error}`);
}

class MailNotificationService {
  notifier;
  tracker;
  newMailCallback;
  isPrepared;
  isRunning;

  constructor(notifier, tracker) {
    this.notifier = notifier;
    this.tracker = tracker;
    this.newMailCallback = null;
    this.isPrepared = false;
    this.isRunning = false;
  }

  async prepare() {
    try {
      console.info("preparing service...");
      await Promise.all([this.notifier.prepare(), this.tracker.prepare()]);

      this.isPrepared = true;
      console.info("service is prepared succesfully");
    } catch (error) {
      throw new Error(`failed to prepare mail notification service: ${error}`);
    }
  }

  run() {
    this.newMailCallback = async (message, _, sendResponse) => {
      if (message.event === "onNewMailsReceived") {
        sendResponse({ ok: true });

        if (!this.notifier || !this.tracker) {
          console.error("Notifier or Tracker is not initialized");
          return;
        }

        const newMails = message.data;

        if (newMails === null || newMails.length === 0) {
          return;
        }

        await this.tracker.loadNotifiedMailList();

        newMails.forEach((newMail) => {
          const stringifedMail =
            newMail.sender +
            newMail.title +
            newMail.content +
            newMail.timestamp +
            newMail.size;

          const hash = generateMD5Hash(stringifedMail);

          const formattedMail = formatMail(newMail);
          if (!formattedMail) {
            console.error("failed to format mail");
            return;
          }

          const isAlreadyNotified = this.tracker.contains(hash);
          if (isAlreadyNotified) {
            console.debug("already notified");
            return;
          }

          this.tracker.add(hash);
          console.debug(`hashed mail is added to cache: ${hash}`);

          (async () => {
            try {
              await this.notifier.notify(formattedMail);
              console.info("notified successfully");
              console.debug(`notified mail:\n${formattedMail}`);
            } catch (error) {
              const msg = `failed to notify mail: ${error}`;
              console.warn(msg);
              this.tracker.rollback();
              console.info("rollback added hash");
              return;
            }

            try {
              await this.tracker.saveNotifiedMailList();
            } catch (error) {
              console.error(`failed to save notified mail list: ${error}`);
            }
          })();
        });
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(this.newMailCallback);
    this.isRunning = true;
  }

  suspend() {
    if (this.newMailCallback) {
      chrome.runtime.onMessage.removeListener(this.newMailCallback);
      this.newMailCallback = null;
      this.isRunning = false;
    }
  }
}

function keepAlive() {
  let currentTabId = null;

  function heartbeater() {
    const port = chrome.runtime.connect({ name: "heartbeat" });
    port.onDisconnect.addListener(() => {
      // Keep try to connect port when disconnected so as to keep service worker active.
      heartbeater();
    });
  }

  async function injectHeartbeater() {
    await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
      if (tabs.length > 0) {
        const currentTabExists = tabs.some((tab) => tab.id === currentTabId);

        if (!currentTabExists) {
          currentTabId = tabs[0].id;

          chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: heartbeater,
          });
        }
      }
    });
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "heartbeat") {
      setTimeout(() => {
        port.disconnect();
        console.debug("heartbeat");
      }, 3000);
    }
  });

  chrome.tabs.onUpdated.addListener(async (_, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url.startsWith("http")) {
      await injectHeartbeater();
    }
  });

  (async () => {
    await injectHeartbeater();
  })();
}

keepAlive();
console.info("make service worker keep alive");

let notifier;
let tracker;
let service;

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "isServiceRunning") {
    if (!service) {
      console.debug("service is not initialized");
      sendResponse({ ok: false, data: null });
      return;
    }

    console.debug(`isServiceRunning: ${service.isRunning}`);
    sendResponse({ ok: true, data: service.isRunning });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.debug(`service worker is newly installed\nreason: ${details.reason}`);

  const manifest = chrome.runtime.getManifest();
  const contentScripts = manifest.content_scripts;

  const executeScriptsInTabs = async (matchPattern, scripts) => {
    const tabs = await chrome.tabs.query({ url: matchPattern });
    tabs.forEach((tab) => {
      scripts.forEach((script) => {
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: [script] },
          () => {
            if (chrome.runtime.lastError) {
              console.debug(chrome.runtime.lastError.message);
            } else {
              console.debug(
                `script ${script} injected successfully into ${tab.url}.`
              );
            }
          }
        );
      });
    });
  };

  contentScripts.forEach((contentScript) => {
    const matchPatterns = contentScript.matches;
    const scripts = contentScript.js;

    matchPatterns.forEach((matchPattern) =>
      executeScriptsInTabs(matchPattern, scripts)
    );
  });
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "onWatcherStateChanged") {
    console.debug(`onWatcherStateChanged. new state: ${message.data}`);

    const isWatching = message.data;

    if (!service || !service.isPrepared) {
      console.debug("service is null or service is not prepared");
      sendResponse({ ok: false });
      return;
    }

    if (isWatching) {
      if (service.isRunning) {
        console.info("service is already running");
        sendResponse({ ok: true });
        return;
      }
      service.run();
      console.info("run mail notification service...");
    } else {
      service.suspend();
      console.info("suspend mail notification service...");
    }
    sendResponse({ ok: true });
  }
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "onSaveButtonClicked") {
    console.debug("onSaveButtonClicked");

    if (!message.data.slackAPIToken) {
      console.error("slack api token is empty");
      sendResponse({ ok: false, error: "slack api token is empty" });
      return;
    }

    if (!message.data.slackChannelID) {
      console.error("slack channel id is empty");
      sendResponse({ ok: false, error: "slack channel id is empty" });
      return;
    }

    (async () => {
      try {
        await Promise.all([
          storage.set("slackAPIToken", message.data.slackAPIToken),
          storage.set("slackChannelID", message.data.slackChannelID),
          storage.set("hasSavedSettings", true),
        ]);

        notifier = new SlackNotifier();
        tracker = new NotifiedMailTracker();
        service = new MailNotificationService(notifier, tracker);
        console.info("service is initialized");

        if (!service.isPrepared) {
          console.info(
            "slack api setting and service is intialized, but not prepared yet"
          );

          // Must call suspend() before preare() not to refer old listener.
          service.suspend();
          await service.prepare();
          console.info("mail notification service is prepared");
        }

        sendResponse({ ok: true });
      } catch (error) {
        try {
          await Promise.all([
            storage.remove("slackAPIToken"),
            storage.remove("slackChannelID"),
            storage.remove("hasSavedSettings"),
          ]);

          sendResponse({ ok: false, error: error.toString() });
          console.info(
            `failed to save slack configuration: ${error.toString()}`
          );
        } catch (error) {
          sendResponse({ ok: false, error: error.toString() });
          console.info(
            `failed to clear slack configuration: ${error.toString()}`
          );
        }
      }
    })();

    return true;
  }
});

(async () => {
  try {
    const hasSavedSettings = (await storage.get("hasSavedSettings")) ?? false;
    const isWatching = (await storage.get("isWatching")) ?? false;
    console.debug(`hasSavedSettings: ${hasSavedSettings}`);
    console.debug(`isWatching: ${isWatching}`);

    if (!hasSavedSettings) {
      console.info("slack api setting is not set yet");
      return;
    }

    notifier = new SlackNotifier();
    tracker = new NotifiedMailTracker();
    service = new MailNotificationService(notifier, tracker);
    console.info("service is initialized");

    if (!service.isPrepared) {
      console.info(
        "slack api setting and service is intialized, but not prepared yet"
      );

      // Must call suspend() before preare() not to refer old listener.
      service.suspend();
      await service.prepare();
      console.info("mail notification service is prepared");
    }

    if (isWatching && !service.isRunning) {
      service.run();
      console.info("run mail notification service...");
    }
  } catch (error) {
    console.error(`failed to run service: ${error}`);
  }
})();
