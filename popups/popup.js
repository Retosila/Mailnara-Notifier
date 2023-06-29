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

  checkInputFields: function () {
    this.saveButton.disabled =
      !this.slackAPITokenInput.value || !this.slackChannelIDInput.value;
  },

  toggleConfigurationVisibility: function (hasSavedSettings) {
    if (hasSavedSettings) {
      this.saveButton.classList.add("hidden");
      this.configureButton.classList.remove("hidden");
      this.slackAPITokenInput.classList.add("hidden");
      this.slackChannelIDInput.classList.add("hidden");
      this.watchToggleButton.classList.remove("hidden");
    } else {
      this.saveButton.classList.remove("hidden");
      this.configureButton.classList.add("hidden");
      this.slackAPITokenInput.classList.remove("hidden");
      this.slackChannelIDInput.classList.remove("hidden");
      this.watchToggleButton.classList.add("hidden");
    }
  },

  setWatcherButtonText: function (isWatching) {
    this.watchToggleButton.textContent = isWatching
      ? "Stop Watching"
      : "Start Watching";
  },
};

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

    ui.slackAPITokenInput.addEventListener("input", () =>
      ui.checkInputFields()
    );
    ui.slackChannelIDInput.addEventListener("input", () =>
      ui.checkInputFields()
    );
    ui.checkInputFields();

    ui.saveButton.addEventListener("click", async () => {
      await Promise.all([
        storage.set("slackAPIToken", ui.slackAPITokenInput.value),
        storage.set("slackChannelID", ui.slackChannelIDInput.value),
        storage.set("hasSavedSettings", true),
      ]);

      ui.toggleConfigurationVisibility(true);
    });

    ui.configureButton.addEventListener("click", () => {
      ui.toggleConfigurationVisibility(false);
    });

    ui.watchToggleButton.addEventListener("click", async () => {
      const isWatching = await storage.get("isWatching");
      const newWatcherState = !isWatching;

      const [tab] = await chrome.tabs.query({
        url: ["https://mail.sds.co.kr/*"],
      });

      const response = await chrome.tabs.sendMessage(tab.id, {
        event: "onWatcherStateChanged",
        data: newWatcherState,
      });

      if (response.ok) {
        ui.setWatcherButtonText(newWatcherState);
        await storage.set("isWatching", newWatcherState);
      } else {
        throw new Error("Invalid watcher state.");
      }
    });
  } catch (error) {
    console.error(error);
  }
};
