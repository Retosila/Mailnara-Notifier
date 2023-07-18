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
      await Promise.all([this.notifier.prepare(), this.tracker.prepare()]);

      this.isPrepared = true;
    } catch (error) {
      throw new Error(`failed to prepare mail notification service: ${error}`);
    }
  }

  run() {
    this.newMailCallback = async (message, _, sendResponse) => {
      if (message.event === "onNewMailsReceived") {
        sendResponse({ ok: true });

        if (!this.notifier || !this.tracker) {
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
            return;
          }

          const isAlreadyNotified = this.tracker.contains(hash);
          if (isAlreadyNotified) {
            return;
          }

          this.tracker.add(hash);

          (async () => {
            try {
              await this.notifier.notify(formattedMail);
            } catch (error) {
              const msg = `failed to notify mail: ${error}`;
              this.tracker.rollback();
              return;
            }

            try {
              await this.tracker.saveNotifiedMailList();
            } catch (error) {}
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
      }, 25000);
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

let notifier;
let tracker;
let service;

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "isServiceRunning") {
    if (!service) {
      sendResponse({ ok: false, data: null });
      return;
    }

    sendResponse({ ok: true, data: service.isRunning });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  const manifest = chrome.runtime.getManifest();
  const contentScripts = manifest.content_scripts;

  const executeScriptsInTabs = async (matchPattern, scripts) => {
    const tabs = await chrome.tabs.query({ url: matchPattern });
    tabs.forEach((tab) => {
      scripts.forEach((script) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [script],
        });
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
    const isWatching = message.data;

    if (!service || !service.isPrepared) {
      sendResponse({ ok: false });
      return;
    }

    if (isWatching) {
      if (service.isRunning) {
        sendResponse({ ok: true });
        return;
      }
      service.run();
    } else {
      service.suspend();
    }
    sendResponse({ ok: true });
  }
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "onSaveButtonClicked") {
    if (!message.data.slackAPIToken) {
      sendResponse({ ok: false, error: "slack api token is empty" });
      return;
    }

    if (!message.data.slackChannelID) {
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

        if (!service.isPrepared) {
          // Must call suspend() before preare() not to refer old listener.
          service.suspend();
          await service.prepare();
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
        } catch (error) {
          sendResponse({ ok: false, error: error.toString() });
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

    if (!hasSavedSettings) {
      return;
    }

    notifier = new SlackNotifier();
    tracker = new NotifiedMailTracker();
    service = new MailNotificationService(notifier, tracker);

    if (!service.isPrepared) {
      // Must call suspend() before preare() not to refer old listener.
      service.suspend();
      await service.prepare();
    }

    if (isWatching && !service.isRunning) {
      service.run();
    }
  } catch (error) {}
})();
