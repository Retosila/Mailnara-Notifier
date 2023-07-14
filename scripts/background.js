try {
  importScripts("logger.js", "utils.js", "tracker.js", "notifier.js");
} catch (error) {
  console.error(`failed to import scripts: ${error}`);
}

class MailNotificationService {
  static instance;

  notifier;
  tracker;
  newMailCallback;
  isPrepared;

  constructor(notifier, tracker) {
    if (MailNotificationService.instance) {
      return MailNotificationService.instance;
    }

    this.notifier = notifier;
    this.tracker = tracker;
    this.newMailCallback = null;
    this.isPrepared = false;

    MailNotificationService.instance = this;
  }

  async prepare() {
    try {
      logger.info("preparing service...");
      await Promise.all([this.notifier.prepare(), this.tracker.prepare()]);
      this.isPrepared = true;
      logger.info("service is prepared succesfully");
    } catch (error) {
      throw new Error(`failed to prepare mail notification service: ${error}`);
    }
  }

  run() {
    this.newMailCallback = async (message, _, sendResponse) => {
      if (message.event === "onNewMailsReceived") {
        sendResponse({ ok: true });

        if (!this.notifier || !this.tracker) {
          logger.error("Notifier or Tracker is not initialized");
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
            logger.error("failed to format mail");
            return;
          }

          const isAlreadyNotified = this.tracker.contains(hash);
          if (isAlreadyNotified) {
            logger.debug("already notified");
            return;
          }

          this.tracker.add(hash);
          logger.debug(`hashed mail is added to cache: ${hash}`);

          (async () => {
            try {
              await this.notifier.notify(formattedMail);
              logger.info("notified successfully");
              logger.debug(`notified mail:\n${formattedMail}`);
            } catch (error) {
              logger.warn(`failed to notify mail: ${error}`);
              this.tracker.rollback();
              logger.info("rollback added hash");
              return;
            }

            try {
              await this.tracker.saveNotifiedMailList();
            } catch (error) {
              logger.error(`failed to save notified mail list: ${error}`);
            }
          })();
        });
      }
    };

    chrome.runtime.onMessage.addListener(this.newMailCallback);
  }

  suspend() {
    if (this.newMailCallback) {
      chrome.runtime.onMessage.removeListener(this.newMailCallback);
      this.newMailCallback = null;
    }
  }
}

logger.info("start to initialize service");

const notifier = new SlackNotifier();
const tracker = new NotifiedMailTracker();
const service = new MailNotificationService(notifier, tracker);

(async () => {
  try {
    const hasSavedSettings = (await storage.get("hasSavedSettings")) ?? false;
    logger.debug(`hasSavedSettings: ${hasSavedSettings}`);

    if (hasSavedSettings && !service.isPrepared) {
      logger.info(
        "slack api setting and service is intialized, but not prepared yet"
      );

      // Must call suspend() before preare() not to refer old listener.
      service.suspend();
      await service.prepare();
      logger.info("mail notification service is prepared");
      service.run();
      logger.info("start mail notification service...");
    }
  } catch (error) {
    logger.error(`failed to run service: ${error}`);
    return;
  }
})();

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "onWatcherStateChanged") {
    logger.debug(`onWatcherStateChanged. new state: ${message.data}`);

    const isWatching = message.data;
    if (isWatching) {
      service.run();
      logger.info("start mail notification service...");
    } else {
      service.suspend();
      logger.info("suspend mail notification service...");
    }
    sendResponse({ ok: true });
  }
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.event === "onSaveButtonClicked") {
    logger.debug("onSaveButtonClicked");

    if (!message.data.slackAPIToken) {
      logger.error("slack api token is empty");
      return;
    }

    if (!message.data.slackChannelID) {
      logger.error("slack channel id is empty");
      return;
    }

    (async () => {
      try {
        await Promise.all([
          storage.set("slackAPIToken", message.data.slackAPIToken),
          storage.set("slackChannelID", message.data.slackChannelID),
          storage.set("hasSavedSettings", true),
        ]);

        service.suspend();
        await service.prepare();

        sendResponse({ ok: true });
        logger.info("mail notification service is prepared");
      } catch (error) {
        try {
          await Promise.all([
            storage.remove("slackAPIToken"),
            storage.remove("slackChannelID"),
            storage.remove("hasSavedSettings"),
          ]);

          sendResponse({ ok: false, error: error.toString() });
          logger.info(
            `failed to save slack configuration: ${error.toString()}`
          );
        } catch (error) {
          sendResponse({ ok: false, error: error.toString() });
          logger.info(
            `failed to clear slack configuration: ${error.toString()}`
          );
        }
      }
    })();
  }

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  logger.debug(`service worker is newly installed\nreason: ${details.reason}`);

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
              logger.debug(chrome.runtime.lastError.message);
            } else {
              logger.debug(
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
