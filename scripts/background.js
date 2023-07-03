try {
  importScripts("utils.js", "tracker.js", "notifier.js");
} catch (error) {
  console.error(`Failed to import scripts: ${error}`);
}

class MailNotificationService {
  static instance;

  notifier;
  tracker;
  messageListener;
  isPrepared;

  constructor(notifier, tracker) {
    if (MailNotificationService.instance) {
      return MailNotificationService.instance;
    }

    this.notifier = notifier;
    this.tracker = tracker;
    this.listener = null;
    this.isPrepared = false;

    MailNotificationService.instance = this;
  }

  async prepare() {
    try {
      await Promise.all([this.notifier.prepare(), this.tracker.prepare()]);
      this.isPrepared = true;
    } catch (error) {
      throw new Error(`Failed to prepare mail notification service: ${error}`);
    }
  }

  run() {
    const self = this;

    this.listener = (message, _, sendResponse) => {
      if (message.event === "onNewMailsReceived") {
        sendResponse({ ok: true });

        if (!self.notifier || !self.tracker) {
          console.error("Notifier or Tracker is not initialized");
          return;
        }

        const newMails = message.data;

        if (newMails === null || newMails.length === 0) {
          return;
        }

        newMails.forEach((newMail) => {
          const stringifedMail =
            newMail.sender +
            newMail.title +
            newMail.content +
            newMail.timestamp +
            newMail.size;

          const hash = generateMD5Hash(stringifedMail);
          console.debug(`Hash value for new mail: ${hash}`);

          const isAlreadyNotified = self.tracker.contains(hash);
          if (isAlreadyNotified) {
            console.debug("Already notified.");
            return;
          }
          self.tracker.add(hash);

          const formattedMail = formatMail(newMail);
          if (formattedMail) {
            (async () => {
              try {
                await self.notifier.notify(formattedMail);
                console.info("Notified successfully.");
                console.debug(`Notified mail:\n${formattedMail}`);
              } catch (error) {
                console.warn(`Failed to notify mail: ${error}`);
                self.tracker.rollback();
                return;
              }

              try {
                self.tracker.saveNotifiedMailList();
              } catch (error) {
                console.error(`Failed to save notified mail list: ${error}`);
              }
            })();
          }
        });
      }
    };

    chrome.runtime.onMessage.addListener(this.listener);
  }

  suspend() {
    if (this.listener) {
      chrome.runtime.onMessage.removeListener(this.listener);
      this.listener = null;
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.debug("Service worker is newly installed. Reason: " + details.reason);

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
                `Script ${script} injected successfully into ${tab.url}.`
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

  console.info("Start to initialize service.");

  const notifier = new SlackNotifier();
  const tracker = new NotifiedMailTracker();
  const service = new MailNotificationService(notifier, tracker);

  const checkServiceVitality = () => {
    if (!service) {
      console.error("Fatal error: service is missing.");
      chrome.runtime.reload();
      return;
    }
  };

  checkServiceVitality();

  (async () => {
    try {
      const hasSavedSettings = (await storage.get("hasSavedSettings")) ?? false;
      console.debug(`hasSavedSettings: ${hasSavedSettings}`);
      checkServiceVitality();

      if (hasSavedSettings && !service.isPrepared) {
        console.info(
          "Slack API setting and service is intialized, but not prepared yet."
        );

        // Must call suspend() before preare() not to refer old listener.
        service.suspend();
        await service.prepare();
        console.info("Mail notification service is prepared.");
        service.run();
        console.info("Start mail notification service...");
      }
    } catch (error) {
      console.error(`Failed to run service: ${error}`);
      return;
    }
  })();

  const onSaveButtonClickedListener = (message, _, sendResponse) => {
    if (message.event === "onSaveButtonClicked") {
      console.debug("onSaveButtonClicked.");

      if (!message.data.slackAPIToken) {
        console.error("Slack API Token is empty.");
        return;
      }

      if (!message.data.slackChannelID) {
        console.error("Slack ChannelID is empty.");
      }

      checkServiceVitality();

      (async () => {
        try {
          await Promise.all([
            storage.set("slackAPIToken", message.data.slackAPIToken),
            storage.set("slackChannelID", message.data.slackChannelID),
            storage.set("hasSavedSettings", true),
          ]);

          service.suspend();
          await service.prepare();
        } catch (error) {
          try {
            await Promise.all([
              storage.remove("slackAPIToken"),
              storage.remove("slackChannelID"),
              storage.remove("hasSavedSettings"),
            ]);
          } catch (error) {
            throw new Error(`Failed to remove key from storage: ${error}`);
          }
        }
      })()
        .then(() => {
          sendResponse({ ok: true });
          console.info("Mail notification service is prepared.");
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error });
          console.info(`Failed to save slack configuration: ${error}`);
        });
    }

    return true;
  };

  const onWatcherStateChangedListener = (message, _, sendResponse) => {
    if (message.event === "onWatcherStateChanged") {
      console.debug(`onWatcherStateChanged. New state: ${message.data}`);
      checkServiceVitality();

      const isWatching = message.data;
      if (isWatching) {
        service.run();
        console.info("Start mail notification service...");
      } else {
        service.suspend();
        console.info("Suspend mail notification service...");
      }
      sendResponse({ ok: true });
    }
  };

  chrome.runtime.onMessage.addListener(onSaveButtonClickedListener);
  chrome.runtime.onMessage.addListener(onWatcherStateChangedListener);
});
