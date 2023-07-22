const storage = {
  get: (key) => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], function (result) {
        resolve(result[key]);
      });
    });
  },

  set: (key, value) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
};

const DEBOUNCE_INTERVAL = 100;
const URL_REGEX = /^http(s)?:\/\/[^\s/$.?#].[^\s]*$/i;

const contentScripts = ["scripts/watcher.js", "scripts/inject.js"];

let ui;
let debouncer;

document.addEventListener("DOMContentLoaded", () => {
  ui = {
    changeNotifierSettingsButton: document.getElementById(
      "change-notifier-settings"
    ),
    saveNotifierSettingsButton: document.getElementById(
      "save-notifier-settings"
    ),
    slackAPITokenInput: document.getElementById("slack-api-token"),
    slackChannelIDInput: document.getElementById("slack-channel-id"),
    applyConfigsButton: document.getElementById("apply-configs"),
    watchToggleButton: document.getElementById("watch-toggle"),
    targetBaseURLInput: document.getElementById("target-base-url"),
    targetMailboxFieldset: document.getElementById("target-mailbox"),
    targetPageFieldset: document.getElementById("target-page"),
    mailboxInboxCheckbox: document.getElementById("mailbox-inbox"),
    mailboxJunkCheckbox: document.getElementById("mailbox-junk"),
    targetPageFirstRadio: document.getElementById("target-page-first"),
    targetPageAllRadio: document.getElementById("target-page-all"),

    checkInputFields: () => {
      ui.saveNotifierSettingsButton.disabled =
        !ui.slackAPITokenInput.value || !ui.slackChannelIDInput.value;
      ui.saveNotifierSettingsButton.classList.toggle(
        "opacity-50",
        ui.saveNotifierSettingsButton.disabled
      );
    },

    toggleConfigurationVisibility: (hasSavedNotifierSettings) => {
      if (hasSavedNotifierSettings) {
        ui.hide(ui.slackAPITokenInput);
        ui.hide(ui.slackChannelIDInput);
        ui.hide(ui.saveNotifierSettingsButton);
        ui.show(ui.changeNotifierSettingsButton);
        ui.show(ui.targetBaseURLInput);
        ui.show(ui.targetMailboxFieldset);
        ui.show(ui.targetPageFieldset);
        ui.show(ui.applyConfigsButton);
        ui.show(ui.watchToggleButton);
      } else {
        ui.show(ui.slackAPITokenInput);
        ui.show(ui.slackChannelIDInput);
        ui.show(ui.saveNotifierSettingsButton);
        ui.hide(ui.changeNotifierSettingsButton);
        ui.hide(ui.targetBaseURLInput);
        ui.hide(ui.targetMailboxFieldset);
        ui.hide(ui.targetPageFieldset);
        ui.hide(ui.applyConfigsButton);
        ui.hide(ui.watchToggleButton);
      }
    },

    setWatcherButtonText: (isWatching) => {
      ui.watchToggleButton.textContent = isWatching
        ? "Stop Watching"
        : "Start Watching";
    },

    hide: (element) => {
      element.classList.add("hidden");
    },

    show: (element) => {
      element.classList.remove("hidden");
    },

    disable: (element) => {
      element.disabled = true;
      element.classList.toggle("opacity-50", true);
    },

    enable: (element) => {
      element.disabled = false;
      element.classList.toggle("opacity-50", false);
    },
  };

  try {
    const manifestData = chrome.runtime.getManifest();
    const version = manifestData.version;

    document.getElementById("version").textContent = `v${version}`;
  } catch (error) {
    const errorMsg = `failed to load version: ${error}`;
    console.error(errorMsg);
    alert(errorMsg);
  }
});

async function loadSettings() {
  try {
    const [
      slackAPIToken,
      slackChannelID,
      isWatching,
      hasSavedNotifierSettings,
      targetBaseURL,
      isInboxTargeted,
      isJunkTargeted,
      watchFirstPageOnly,
    ] = await Promise.all([
      (async () => (await storage.get("slackAPIToken")) ?? "")(),
      (async () => (await storage.get("slackChannelID")) ?? "")(),
      (async () => (await storage.get("isWatching")) ?? false)(),
      (async () => (await storage.get("hasSavedNotifierSettings")) ?? false)(),
      (async () => (await storage.get("targetBaseURL")) ?? "")(),
      (async () => (await storage.get("isInboxTargeted")) ?? true)(),
      (async () => (await storage.get("isJunkTargeted")) ?? false)(),
      (async () => (await storage.get("watchFirstPageOnly")) ?? true)(),
    ]);

    ui.slackAPITokenInput.value = slackAPIToken;
    ui.slackChannelIDInput.value = slackChannelID;
    ui.setWatcherButtonText(isWatching);
    ui.toggleConfigurationVisibility(hasSavedNotifierSettings);
    ui.targetBaseURLInput.value = targetBaseURL;
    ui.mailboxInboxCheckbox.checked = isInboxTargeted;
    ui.mailboxJunkCheckbox.checked = isJunkTargeted;

    ui.disable(ui.applyConfigsButton);
    ui.checkInputFields();

    if (watchFirstPageOnly) {
      ui.targetPageFirstRadio.checked = true;
      ui.targetPageAllRadio.checked = false;
    } else {
      ui.targetPageFirstRadio.checked = false;
      ui.targetPageAllRadio.checked = true;
    }

    if (!targetBaseURL) {
      ui.disable(ui.watchToggleButton);
    } else {
      ui.enable(ui.watchToggleButton);
    }

    if (hasSavedNotifierSettings && isWatching) {
      ui.hide(ui.changeNotifierSettingsButton);
      ui.disable(ui.targetBaseURLInput);
      ui.disable(ui.targetMailboxFieldset);
      ui.disable(ui.targetPageFieldset);
    } else if (hasSavedNotifierSettings && !isWatching) {
      ui.show(ui.changeNotifierSettingsButton);
      ui.enable(ui.targetBaseURLInput);
      ui.enable(ui.targetMailboxFieldset);
      ui.enable(ui.targetPageFieldset);
    } else {
      ui.hide(ui.changeNotifierSettingsButton);
    }
  } catch (error) {
    throw new Error(`failed to load settings: ${error}`);
  }
}

async function initListeners() {
  ui.slackAPITokenInput.addEventListener("input", () => ui.checkInputFields());
  ui.slackChannelIDInput.addEventListener("input", () => ui.checkInputFields());

  ui.changeNotifierSettingsButton.addEventListener("click", () => {
    ui.toggleConfigurationVisibility(false);
  });

  ui.targetBaseURLInput.addEventListener("input", () => {
    ui.enable(ui.applyConfigsButton);
    ui.disable(ui.watchToggleButton);
  });
  ui.targetMailboxFieldset.addEventListener("change", () => {
    ui.enable(ui.applyConfigsButton);
    ui.disable(ui.watchToggleButton);
  });
  ui.targetPageFieldset.addEventListener("change", () => {
    ui.enable(ui.applyConfigsButton);
    ui.disable(ui.watchToggleButton);
  });

  ui.saveNotifierSettingsButton.addEventListener("click", async () => {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            event: "onSaveNotifierSettingsButtonClicked",
            data: {
              slackAPIToken: ui.slackAPITokenInput.value.trim(),
              slackChannelID: ui.slackChannelIDInput.value.trim(),
            },
          },
          (response) => {
            resolve(response);
          }
        );
      });
      console.log(response);

      if (!response.ok) {
        ui.slackAPITokenInput.value = "";
        ui.slackChannelIDInput.value = "";
        ui.checkInputFields();

        throw new Error(response.error);
      }

      ui.toggleConfigurationVisibility(true);
      alert("Notifier is set up successfully");
    } catch (error) {
      const errorMsg = `failed to set notifier: ${error}`;
      console.error(errorMsg);
      alert(errorMsg);
    }
  });

  ui.applyConfigsButton.addEventListener("click", async () => {
    // Save mail watcher configs in local stroage and inject content script.
    try {
      const targetBaseURL = ui.targetBaseURLInput.value;
      const isInboxTargeted = ui.mailboxInboxCheckbox.checked;
      const isJunkTargeted = ui.mailboxJunkCheckbox.checked;
      const watchFirstPageOnly = ui.targetPageFirstRadio.checked;

      if (!targetBaseURL) {
        throw new Error("target base url is not set up");
      }

      if (!URL_REGEX.test(targetBaseURL)) {
        throw new Error("invalid url foramt");
      }

      if (!isInboxTargeted && !isJunkTargeted) {
        throw new Error(
          "target mailbox is not set up. at least one mailbox must be selected"
        );
      }

      await storage.set("targetBaseURL", targetBaseURL);
      await storage.set("isInboxTargeted", isInboxTargeted);
      await storage.set("isJunkTargeted", isJunkTargeted);
      await storage.set("watchFirstPageOnly", watchFirstPageOnly);

      console.debug(`
      options has been set up:
          targetBaseURL=${targetBaseURL}
          isInboxTargeted=${isInboxTargeted}
          isJunkTargeted=${isJunkTargeted}
          watchFirstPageOnly=${watchFirstPageOnly}
      `);

      // MUST append wild card to query all tabs starts with target base url.
      const matchPattern = `${targetBaseURL}*`;
      const tabs = await chrome.tabs.query({
        url: matchPattern,
      });

      const promises = tabs.map(
        (tab) =>
          new Promise(async (resolve) => {
            chrome.tabs.reload(tab.id, {}, resolve);
          })
      );

      await Promise.all(promises);

      ui.enable(ui.watchToggleButton);
      ui.disable(ui.applyConfigsButton);
      alert("Mail watcher configurations are applied successfully!");
    } catch (error) {
      console.error(error);
      alert(error);
    }
  });

  ui.watchToggleButton.addEventListener("click", async () => {
    try {
      const isWatching = await storage.get("isWatching");
      const targetBaseURL = (await storage.get("targetBaseURL")) ?? "";

      if (!targetBaseURL) {
        throw new Error("target base url is not set up yet");
      }

      const newWatcherState = !isWatching;

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            event: "onWatcherStateChanged",
            data: newWatcherState,
          },
          (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError.message);
            } else {
              resolve(result);
            }
          }
        );
      });

      if (!response.ok) {
        throw new Error(`invalid response: ${response.error}`);
      }

      const tabs = await chrome.tabs.query({
        url: `${targetBaseURL}*`, // MUST append wild card to query all tabs starts with target base url.
      });

      console.info(`queried tabs: ${tabs.length}`);
      tabs.forEach((tab) => {
        console.debug("tab: " + tab.id);
      });

      const promises = tabs.map(
        (tab) =>
          new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(
              tab.id,
              {
                event: "onWatcherStateChanged",
                data: newWatcherState,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError.message);
                } else {
                  resolve(response);
                }
              }
            );
          })
      );

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        if (!response.ok) {
          throw new Error(`invalid response. ${response.error}`);
        }

        // Use debouncer to ignore redundant alert.
        if (debouncer) {
          clearTimeout(debouncer);
        }

        debouncer = setTimeout(async () => {
          try {
            await storage.set("isWatching", response.isWatching);
          } catch (error) {
            const errorMsg = `failed to save settings\n${error}`;
            console.error(errorMsg);
            alert(errorMsg);
            return;
          }

          ui.setWatcherButtonText(response.isWatching);

          if (response.isWatching === true) {
            ui.hide(ui.changeNotifierSettingsButton);
            ui.disable(ui.targetBaseURLInput);
            ui.disable(ui.targetMailboxFieldset);
            ui.disable(ui.targetPageFieldset);
            alert("Start watching mailbox!");
          } else {
            ui.show(ui.changeNotifierSettingsButton);
            ui.enable(ui.targetBaseURLInput);
            ui.enable(ui.targetMailboxFieldset);
            ui.enable(ui.targetPageFieldset);
            alert("Stop watching mailbox.");
          }
        }, DEBOUNCE_INTERVAL);
      });
    } catch (error) {
      console.error(error);
      alert(error);
    }
  });
}

async function initPopup() {
  await loadSettings();
  await initListeners();
}

window.onload = () => {
  initPopup().catch((error) => {
    const errorMsg = `failed to initialize popup\n${error}`;
    console.error(errorMsg);
    alert(errorMsg);
  });
};
