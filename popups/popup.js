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

const ui = {
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

document.addEventListener("DOMContentLoaded", () => {
  const manifestData = chrome.runtime.getManifest();
  const version = manifestData.version;

  document.getElementById("version").textContent = `v${version}`;
});

window.onload = async () => {
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

    ui.slackAPITokenInput.addEventListener("input", () =>
      ui.checkInputFields()
    );
    ui.slackChannelIDInput.addEventListener("input", () =>
      ui.checkInputFields()
    );
    ui.checkInputFields();

    ui.saveButton.addEventListener("click", async () => {
      chrome.runtime.sendMessage(
        {
          event: "onSaveButtonClicked",
          data: {
            slackAPIToken: ui.slackAPITokenInput.value.trim(),
            slackChannelID: ui.slackChannelIDInput.value.trim(),
          },
        },
        (response) => {
          if (response.ok) {
            ui.toggleConfigurationVisibility(true);
            alert("Slack configuration is verified successfully.");
          } else {
            ui.slackAPITokenInput.value = "";
            ui.slackChannelIDInput.value = "";
            ui.checkInputFields();
            alert("Failed to verify slack configuration.");
          }
        }
      );
    });

    ui.configureButton.addEventListener("click", () => {
      ui.toggleConfigurationVisibility(false);
    });

    ui.watchToggleButton.addEventListener("click", async () => {
      const isWatching = await storage.get("isWatching");
      const newWatcherState = !isWatching;

      let response = await chrome.runtime.sendMessage({
        event: "onWatcherStateChanged",
        data: newWatcherState,
      });

      if (!response.ok) {
        alert(`Error: ${response.error}`);
        return;
      }

      const manifest = chrome.runtime.getManifest();
      const contentScripts = manifest.content_scripts;
      const matchPatterns = [];

      contentScripts.forEach((contentScript) => {
        contentScript.matches.forEach((match) => {
          matchPatterns.push(match);
        });
      });

      const tabs = await chrome.tabs.query({
        url: matchPatterns,
      });

      console.info(`Queried tabs: ${tabs.length}`);
      tabs.forEach((tab) => {
        console.debug("Tab: " + tab.id);
      });

      if (tabs.length === 0) {
        console.info("No matching tab found.");
        alert(
          `Cannot find any matching tabs.\nAt least one matching tab must exist in runtime:\n${matchPatterns}`
        );

        return;
      }

      // Only watch first tab.
      const [tab] = tabs;

      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          event: "onWatcherStateChanged",
          data: newWatcherState,
        });
      } catch (error) {
        throw new Error(`Error sending message to tab: ${error}`);
      }

      if (response.ok) {
        await storage.set("isWatching", newWatcherState);
        ui.setWatcherButtonText(newWatcherState);
        if (newWatcherState === true) {
          ui.hide(ui.configureButton);
          alert("Start watching mailbox!");
        } else {
          ui.show(ui.configureButton);
          alert("Stop watching mailbox.");
        }
      } else {
        throw new Error(response.error);
      }
    });
  } catch (error) {
    console.error(error);
  }
};
