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

    self.listener = (message) => {
      if (message.event === "onNewMailsReceived") {
        if (!self.notifier || !self.tracker) {
          console.warn("Notifier or Tracker is not initialized");
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

          const formattedMail = formatMail(newMail);
          if (formattedMail) {
            (async () => {
              try {
                await self.notifier.notify(formattedMail);
              } catch (error) {
                console.warn(error);
                return;
              }
            })();
            console.info("Notified successfully.");
            console.debug(`Notified mail:\n${formattedMail}`);

            self.tracker.add(hash);
            self.tracker.saveNotifiedMailList();
          }
        });
      }
    };

    chrome.runtime.onMessage.addListener(self.listener);
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
              console.error(chrome.runtime.lastError.message);
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
      console.error(error);
      return;
    }
  })();

  const onWatcherStateChangedListener = (message, _, sendResponse) => {
    if (message.event === "onWatcherStateChanged") {
      console.debug(`onWatcherStateChanged. Data: ${message.data}`);
      checkServiceVitality();

      const isWatching = message.data;
      if (isWatching) {
        service.run();
        console.info("Start mail notification service...");
      } else {
        service.suspend();
        console.info("Suspend mail notification service...");
      }
      sendResponse({ ok: true, error: null });
    }
  };

  const onSaveButtonClickedListener = (message, _, sendResponse) => {
    if (message.event === "onSaveButtonClicked") {
      console.debug(`onSaveButtonClicked. Data: ${message.data}`);

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
          console.info("Mail notification service is prepared.");

          sendResponse({ ok: true, error: null });
        } catch (error) {
          try {
            await Promise.all([
              storage.remove("slackAPIToken"),
              storage.remove("slackChannelID"),
              storage.remove("hasSavedSettings"),
            ]);
          } catch (error) {
            console.error(error);
          }

          console.error(error);
          sendResponse({ ok: false, error: error });
        }
      })();

      return true;
    }
  };

  chrome.runtime.onMessage.addListener(onWatcherStateChangedListener);
  chrome.runtime.onMessage.addListener(onSaveButtonClickedListener);
});
