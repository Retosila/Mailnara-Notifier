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

let ui;
let debouncer;

document.addEventListener("DOMContentLoaded", () => {
  ui = {
    configureButton: document.getElementById("configure-settings"),
    saveButton: document.getElementById("save-settings"),
    slackAPITokenInput: document.getElementById("slack-api-token"),
    slackChannelIDInput: document.getElementById("slack-channel-id"),
    watchToggleButton: document.getElementById("watcher-toggle"),
    targetBaseURLInput: document.getElementById("target-base-url"),
    targetMailboxFieldset: document.getElementById("target-mailbox"),
    targetPageFieldset: document.getElementById("target-page"),
    mailboxInboxCheckbox: document.getElementById("mailbox-inbox"),
    mailboxJunkCheckbox: document.getElementById("mailbox-junk"),
    targetPageFirstRadio: document.getElementById("target-page-first"),
    targetPageAllRadio: document.getElementById("target-page-all"),

    checkInputFields: () => {
      ui.saveButton.disabled =
        !ui.slackAPITokenInput.value || !ui.slackChannelIDInput.value;
      ui.saveButton.classList.toggle("opacity-50", ui.saveButton.disabled);
    },

    toggleConfigurationVisibility: (hasSavedSettings) => {
      if (hasSavedSettings) {
        ui.hide(ui.slackAPITokenInput);
        ui.hide(ui.slackChannelIDInput);
        ui.hide(ui.saveButton);
        ui.show(ui.configureButton);
        ui.show(ui.targetBaseURLInput);
        ui.show(ui.targetMailboxFieldset);
        ui.show(ui.targetPageFieldset);
        ui.show(ui.watchToggleButton);
      } else {
        ui.show(ui.slackAPITokenInput);
        ui.show(ui.slackChannelIDInput);
        ui.show(ui.saveButton);
        ui.hide(ui.configureButton);
        ui.hide(ui.targetBaseURLInput);
        ui.hide(ui.targetMailboxFieldset);
        ui.hide(ui.targetPageFieldset);
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
    const errorMsg = `error while getting manifest data: ${error}`;
    console.error(errorMsg);
    alert(`Error: ${errorMsg}`);
  }
});

async function loadSettings() {
  try {
    const [
      slackAPIToken,
      slackChannelID,
      isWatching,
      hasSavedSettings,
      targetBaseURL,
      isInboxTargeted,
      isJunkTargeted,
      watchFirstPageOnly,
    ] = await Promise.all([
      (async () => (await storage.get("slackAPIToken")) ?? "")(),
      (async () => (await storage.get("slackChannelID")) ?? "")(),
      (async () => (await storage.get("isWatching")) ?? false)(),
      (async () => (await storage.get("hasSavedSettings")) ?? false)(),
      (async () => (await storage.get("targetBaseURL")) ?? "")(),
      (async () => (await storage.get("isInboxTargeted")) ?? true)(),
      (async () => (await storage.get("isJunkTargeted")) ?? false)(),
      (async () => (await storage.get("watchFirstPageOnly")) ?? true)(),
    ]);

    ui.slackAPITokenInput.value = slackAPIToken;
    ui.slackChannelIDInput.value = slackChannelID;
    ui.setWatcherButtonText(isWatching);
    ui.toggleConfigurationVisibility(hasSavedSettings);
    ui.targetBaseURLInput.value = targetBaseURL;
    ui.mailboxInboxCheckbox.checked = isInboxTargeted;
    ui.mailboxJunkCheckbox.checked = isJunkTargeted;
    if (watchFirstPageOnly) {
      ui.targetPageFirstRadio.checked = true;
      ui.targetPageAllRadio.checked = false;
    } else {
      ui.targetPageFirstRadio.checked = false;
      ui.targetPageAllRadio.checked = true;
    }

    if (hasSavedSettings && isWatching) {
      ui.hide(ui.configureButton);
      ui.disable(ui.targetBaseURLInput);
      ui.disable(ui.targetMailboxFieldset);
      ui.disable(ui.targetPageFieldset);
    } else if (hasSavedSettings && !isWatching) {
      ui.show(ui.configureButton);
      ui.enable(ui.targetBaseURLInput);
      ui.enable(ui.targetMailboxFieldset);
      ui.enable(ui.targetPageFieldset);
    } else {
      ui.hide(ui.configureButton);
    }
  } catch (error) {
    throw new Error(`error while loading slack settings: ${error}`);
  }
}

async function initListeners() {
  ui.slackAPITokenInput.addEventListener("input", () => ui.checkInputFields());
  ui.slackChannelIDInput.addEventListener("input", () => ui.checkInputFields());
  ui.configureButton.addEventListener("click", () => {
    ui.toggleConfigurationVisibility(false);
  });
  ui.checkInputFields();

  ui.saveButton.addEventListener("click", async () => {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            event: "onSaveButtonClicked",
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

      if (!response.ok) {
        ui.slackAPITokenInput.value = "";
        ui.slackChannelIDInput.value = "";
        ui.checkInputFields();

        throw new Error(response.error);
      }

      ui.toggleConfigurationVisibility(true);
      alert("Slack configuration is verified successfully.");
    } catch (error) {
      const errorMsg = `failed to verify slack configuration: ${error}`;
      console.error(errorMsg);
      alert(errorMsg);
    }
  });

  ui.watchToggleButton.addEventListener("click", async () => {
    try {
      const targetBaseURL = ui.targetBaseURLInput.value;
      const isInboxTargeted = ui.mailboxInboxCheckbox.checked;
      const isJunkTargeted = ui.mailboxJunkCheckbox.checked;
      const watchFirstPageOnly = ui.targetPageFirstRadio.checked;

      if (!targetBaseURL) {
        const errorMsg = "target base url is not set up";
        console.error(errorMsg);
        alert(`Error: ${errorMsg}`);
        return;
      }

      if (!URL_REGEX.test(targetBaseURL)) {
        const errorMsg = "invalid url foramt";
        console.error(errorMsg);
        alert(`Error: ${errorMsg}`);
        return;
      }

      if (!isInboxTargeted && !isJunkTargeted) {
        const errorMsg =
          "target mailboxes are not set up. at least one mailbox must be selected";
        console.error(errorMsg);
        alert(`Error: ${errorMsg}`);
        return;
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

      const isWatching = await storage.get("isWatching");
      const newWatcherState = !isWatching;

      chrome.runtime.sendMessage(
        {
          event: "onWatcherStateChanged",
          data: newWatcherState,
        },
        async (response) => {
          if (!response.ok) {
            const errorMsg = `invalid response: ${response.error}`;
            console.error(errorMsg);
            alert(errorMsg);
            return;
          }

          let tabs;

          try {
            tabs = await chrome.tabs.query({
              url: `${targetBaseURL}*`, // MUST append wild card to query all tabs starts with target base url.
            });
          } catch (error) {
            const errorMsg = `failed to get tabs: ${error}`;
            console.error(errorMsg);
            alert(errorMsg);
            return;
          }

          console.info(`queried tabs: ${tabs.length}`);
          tabs.forEach((tab) => {
            console.debug("tab: " + tab.id);
          });

          if (tabs.length === 0) {
            console.info("no matching tab found");
            if (isWatching) {
              try {
                await storage.set("isWatching", false);
              } catch (error) {
                const errorMsg = `failed to save settings: ${error}`;
                console.error(errorMsg);
                alert(errorMsg);
                return;
              }

              ui.setWatcherButtonText(response.isWatching);
              ui.show(ui.configureButton);
              alert("Stop watching mailbox.");
            } else {
              alert(
                `Cannot find any tabs matched with target base url.\nAt least one matching tab must exist in runtime:\n${targetBaseURL}`
              );
            }

            return;
          }

          for (const tab of tabs) {
            try {
              chrome.tabs.sendMessage(
                tab.id,
                {
                  event: "onWatcherStateChanged",
                  data: newWatcherState,
                },
                async (response) => {
                  if (chrome.runtime.lastError) {
                    console.debug(
                      `runtime error: ${chrome.runtime.lastError.message}`
                    );
                    return;
                  }

                  if (!response.ok) {
                    console.error(`invalid response: ${response.error}`);
                    return;
                  }

                  // Use debouncer to ignore redundant alert.
                  if (debouncer) {
                    clearTimeout(debouncer);
                  }

                  debouncer = setTimeout(async () => {
                    try {
                      await storage.set("isWatching", response.isWatching);
                    } catch (error) {
                      const errorMsg = `failed to save settings: ${error}`;
                      console.error(errorMsg);
                      alert(errorMsg);
                      return;
                    }

                    ui.setWatcherButtonText(response.isWatching);

                    if (response.isWatching === true) {
                      ui.hide(ui.configureButton);
                      ui.disable(ui.targetBaseURLInput);
                      ui.disable(ui.targetMailboxFieldset);
                      ui.disable(ui.targetPageFieldset);
                      alert("Start watching mailbox!");
                    } else {
                      ui.show(ui.configureButton);
                      ui.enable(ui.targetBaseURLInput);
                      ui.enable(ui.targetMailboxFieldset);
                      ui.enable(ui.targetPageFieldset);
                      alert("Stop watching mailbox.");
                    }
                  }, DEBOUNCE_INTERVAL);
                }
              );
            } catch (error) {
              const errorMsg = `unknown error: ${error}`;
              console.error(errorMsg);
              alert(errorMsg);
              return;
            }
          }
        }
      );
    } catch (error) {
      const errorMsg = `unknown error: ${error}`;
      console.error(errorMsg);
      alert(errorMsg);
    }
  });
}

async function initPopup() {
  await loadSettings();
  await initListeners();
}

window.onload = () => {
  initPopup().catch((error) => {
    const errorMsg = `failed to initialize popup: ${error}`;
    console.error(errorMsg);
    alert(errorMsg);
  });
};
