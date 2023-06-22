try {
  importScripts("utils.js", "tracker.js", "notifier.js");
} catch (e) {
  console.log(`Failed to import scripts: ${e}`);
}

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

async function initSlackNotifier() {
  const slackAPIEndpoint = "https://slack.com/api/chat.postMessage";

  let slackAPIToken;
  let slackChannelID;

  try {
    slackAPIToken = await storage.get("slackAPIToken");
    slackChannelID = await storage.get("slackChannelID");

    console.log(
      `Fetched slack configuration: ${slackAPIToken}, ${slackChannelID}`
    );
  } catch (error) {
    console.error(error);
  }

  if (!slackAPIToken || !slackChannelID) {
    console.log("Slack configuration is not set properly.");
    return;
  }

  return new SlackNotifier(slackAPIToken, slackChannelID, slackAPIEndpoint);
}

console.log("Start service worker...");

const tracker = new NotifiedMailTracker();
tracker.loadNotifiedMailList();

let slackNotifier;
let notifier;

(async () => {
  slackNotifier = await initSlackNotifier();
  notifier = new Notifier(slackNotifier);
})();

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.event === "onNewMailsReceived") {
    if (!notifier || !tracker) {
      console.error("Notifier or Tracker is not initialized");
      return;
    }

    const newMails = message.data;

    if (newMails === null || newMails.length === 0) {
      return;
    }

    newMails.forEach(async (newMail) => {
      const stringifedMail =
        newMail.sender +
        newMail.title +
        newMail.content +
        newMail.timestamp +
        newMail.size;

      const hash = generateMD5Hash(stringifedMail);
      console.log(`Hashed mail: ${hash}`);

      const isAlreadyNotified = tracker.contains(hash);
      if (isAlreadyNotified) {
        console.log("This mail is already notified.");
        return;
      }

      let formattedMail = formatMail(newMail);
      if (formattedMail) {
        notifier.notify(formattedMail);
        console.log(`Sent notification for following mail: \n${formattedMail}`);
        tracker.add(hash);
        console.log("Added to notified mail list.");
        tracker.saveNotifiedMailList();
      }
    });
  }

  return;
});
