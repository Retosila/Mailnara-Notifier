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
  },

  toggleConfigurationVisibility: (hasSavedSettings) => {
    if (hasSavedSettings) {
      ui.slackAPITokenInput.classList.add("hidden");
      ui.slackChannelIDInput.classList.add("hidden");
      ui.saveButton.classList.add("hidden");
      ui.configureButton.classList.remove("hidden");
      ui.watchToggleButton.classList.remove("hidden");
    } else {
      ui.slackAPITokenInput.classList.remove("hidden");
      ui.slackChannelIDInput.classList.remove("hidden");
      ui.saveButton.classList.remove("hidden");
      ui.configureButton.classList.add("hidden");
      ui.watchToggleButton.classList.add("hidden");
    }
  },

  setWatcherButtonText: (isWatching) => {
    ui.watchToggleButton.textContent = isWatching
      ? "Stop Watching"
      : "Start Watching";
  },
};

document.addEventListener("DOMContentLoaded", function () {
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
    if (isWatching) {
      ui.configureButton.classList.add("hidden");
    } else {
      ui.configureButton.classList.remove("hidden");
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
          ui.configureButton.classList.add("hidden");
          alert("Start watching mailbox!");
        } else {
          ui.configureButton.classList.remove("hidden");
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
