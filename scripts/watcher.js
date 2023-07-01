const storage = {
  get: (key) => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], function (result) {
        resolve(result[key]);
      });
    });
  },
};

class Mail {
  sender;
  title;
  content;
  timestamp;
  size;

  constructor(sender, title, content, timestamp, size) {
    this.sender = sender;
    this.title = title;
    this.content = content;
    this.timestamp = timestamp;
    this.size = size;
  }
}

class Config {
  targetBaseURL;
  targetMailboxes;
  watchFirstPageOnly;

  constructor(
    targetBaseURL = "",
    targetMailboxes = [""],
    watchFirstPageOnly = true
  ) {
    this.targetBaseURL = targetBaseURL;
    this.targetMailboxes = targetMailboxes;
    this.watchFirstPageOnly = watchFirstPageOnly;
  }
}

class MailWatcher {
  static instance;

  observer;
  config;
  isWatching;

  constructor(config) {
    if (MailWatcher.instance) {
      return MailWatcher.instance;
    }

    this.isWatching = false;
    this.config = config;
    this.observer = null;

    MailWatcher.instance = this;
  }

  async loadWatcherState() {
    try {
      this.isWatching = (await storage.get("isWatching")) ?? false;
    } catch (error) {
      throw new Error(`Failed to load watcher state: ${error}`);
    }
  }

  startWatching() {
    const self = this;

    this.observer = new MutationObserver(() => {
      // Check current injection script has valid context.
      if (!chrome.runtime?.id) {
        return;
      }

      const isTargetUrl = self.checkCurrentUrlIsTarget(config);
      if (!isTargetUrl) {
        return;
      }

      const mailRows = self.getMailRows();
      if (mailRows === null || mailRows.length === 0) {
        return;
      }

      const newMails = mailRows.map(self.createMail);

      console.info(`Unread mails: ${newMails.length}`);

      newMails.forEach((newMail) => {
        console.debug(newMail.title);
      });

      chrome.runtime.sendMessage({
        event: "onNewMailsReceived",
        data: newMails,
      });
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    this.isWatching = true;
  }

  stopWatching() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.isWatching = false;
    }
  }

  checkCurrentUrlIsTarget(config) {
    const currentUrl = window.location.href;
    let suffix = "";
    if (config.watchFirstPageOnly) {
      suffix = "0/"; // Path varible for pagination. First page always use "0/".
    }

    const isTargetUrl = config.targetMailboxes.some((targetMailbox) => {
      const url = `${config.targetBaseURL}/${targetMailbox}/${suffix}`;
      return currentUrl.startsWith(url);
    });

    return isTargetUrl;
  }

  getMailRows() {
    const mailListBox = document.getElementById("mail_list_box_div");
    if (!mailListBox) {
      return null;
    }

    let mailRows = mailListBox.querySelectorAll(
      "table.mail_table > tbody > tr"
    );
    if (mailRows.length === 0) {
      console.error("No rows found.");
      return null;
    } else {
      console.debug(`${mailRows.length} rows found.`);
    }

    mailRows = Array.from(mailRows).filter((row) => {
      const readStatus = row
        .querySelector("td > div > span")
        .getAttribute("title");
      return readStatus === "안읽음";
    });

    return mailRows;
  }

  createMail(row) {
    const sender = row.querySelector("#user_name").textContent;
    const title = row.querySelector("td.tit_box > a > span").textContent;
    const content = row.querySelector("td.tit_box > a").getAttribute("title");
    const timestamp = row.querySelector("#data_name").textContent;
    const size = row.querySelector("#size_name").textContent;

    return new Mail(sender, title, content, timestamp, size);
  }
}
