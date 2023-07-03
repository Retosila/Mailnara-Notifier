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

let ui;

document.addEventListener("DOMContentLoaded", () => {
  ui = {
    configureButton: document.getElementById("configure-settings"),
    saveButton: document.getElementById("save-settings"),
    slackAPITokenInput: document.getElementById("slack-api-token"),
    slackChannelIDInput: document.getElementById("slack-channel-id"),
    watchToggleButton: document.getElementById("watcher-toggle"),

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
        ui.show(ui.watchToggleButton);
      } else {
        ui.show(ui.slackAPITokenInput);
        ui.show(ui.slackChannelIDInput);
        ui.show(ui.saveButton);
        ui.hide(ui.configureButton);
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
  };

  try {
    const manifestData = chrome.runtime.getManifest();
    const version = manifestData.version;

    document.getElementById("version").textContent = `v${version}`;
  } catch (error) {
    console.error("Error while getting manifest data: ", error);
  }
});

async function loadSlackSettings() {
  try {
    const [slackAPIToken, slackChannelID, isWatching, hasSavedSettings] =
      await Promise.all([
        (async () => (await storage.get("slackAPIToken")) ?? "")(),
        (async () => (await storage.get("slackChannelID")) ?? "")(),
        (async () => (await storage.get("isWatching")) ?? false)(),
        (async () => (await storage.get("hasSavedSettings")) ?? false)(),
      ]);

    ui.slackAPITokenInput.value = slackAPIToken;
    ui.slackChannelIDInput.value = slackChannelID;
    ui.setWatcherButtonText(isWatching);
    ui.toggleConfigurationVisibility(hasSavedSettings);

    if (hasSavedSettings && isWatching) {
      ui.hide(ui.configureButton);
    } else if (hasSavedSettings && !isWatching) {
      ui.show(ui.configureButton);
    } else {
      ui.hide(ui.configureButton);
    }
  } catch (error) {
    throw new Error(`Error while loading Slack settings: ${error}`);
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

      console.log("response=");
      console.log(response);

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (!response.ok) {
        ui.slackAPITokenInput.value = "";
        ui.slackChannelIDInput.value = "";
        ui.checkInputFields();

        throw new Error(response.error);
      }

      ui.toggleConfigurationVisibility(true);
      alert("Slack configuration is verified successfully.");
    } catch (error) {
      console.debug(`Failed to verify slack configuration: ${error}`);
      alert("Failed to verify slack configuration.");
    }
  });

  ui.watchToggleButton.addEventListener("click", async () => {
    try {
      const isWatching = await storage.get("isWatching");
      const newWatcherState = !isWatching;

      chrome.runtime.sendMessage(
        {
          event: "onWatcherStateChanged",
          data: newWatcherState,
        },
        async (response) => {
          if (chrome.runtime.lastError) {
            console.debug(`Runtime error: ${chrome.runtime.lastError.message}`);
            return;
          }

          if (!response.ok) {
            console.error(`Invalid response: ${response.error}`);
            return;
          }

          let manifest;

          try {
            manifest = chrome.runtime.getManifest();
          } catch (error) {
            console.error(error);
          }

          const contentScripts = manifest.content_scripts;
          const matchPatterns = [];

          contentScripts.forEach((contentScript) => {
            contentScript.matches.forEach((match) => {
              matchPatterns.push(match);
            });
          });

          let tabs;

          try {
            tabs = await chrome.tabs.query({
              url: matchPatterns,
            });
          } catch (error) {
            console.error(error);
            return;
          }

          console.info(`Queried tabs: ${tabs.length}`);
          tabs.forEach((tab) => {
            console.debug("Tab: " + tab.id);
          });

          if (tabs.length === 0) {
            console.info("No matching tab found.");
            if (isWatching) {
              try {
                await storage.set("isWatching", false);
              } catch (error) {
                console.error(error);
                return;
              }

              ui.setWatcherButtonText(response.isWatching);
              ui.show(ui.configureButton);
              alert("Stop watching mailbox.");
            } else {
              alert(
                `Cannot find any matching tabs.\nAt least one matching tab must exist in runtime:\n${matchPatterns}`
              );
            }

            return;
          }

          // Only watch first tab.
          const [tab] = tabs;

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
                    `Runtime error: ${chrome.runtime.lastError.message}`
                  );
                  return;
                }

                if (!response.ok) {
                  console.error(`Invalid response: ${response.error}`);
                  return;
                }

                try {
                  await storage.set("isWatching", response.isWatching);
                } catch (error) {
                  console.error(error);
                  return;
                }

                ui.setWatcherButtonText(response.isWatching);

                if (response.isWatching === true) {
                  ui.hide(ui.configureButton);
                  alert("Start watching mailbox!");
                } else {
                  ui.show(ui.configureButton);
                  alert("Stop watching mailbox.");
                }
              }
            );
          } catch (error) {
            console.error(error);
            return;
          }
        }
      );
    } catch (error) {
      console.error(`Failed to handle button click event: ${error}`);
    }
  });
}

async function initPopup() {
  await loadSlackSettings();
  await initListeners();
}

window.onload = () => {
  initPopup().catch((error) => {
    console.error(error);
    alert(`Error: ${error}`);
  });
};
