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
  static DEBOUNCE_INTERVAL = 1000;

  observer;
  config;
  isWatching;
  debouncer;

  constructor(config) {
    this.isWatching = false;
    this.config = config;
    this.observer = null;
    this.debouncer = null;
  }

  startWatching() {
    this.observer = new MutationObserver(() => {
      // Use debouncing logic so as to ignore redundant callbacks.
      if (this.debouncer) {
        clearTimeout(this.debouncer);
      }

      this.debouncer = setTimeout(async () => {
        const isTargetURL = this.checkCurrentUrlIsTarget();
        if (!isTargetURL) {
          return;
        }

        const mailRows = this.getMailRows();
        if (mailRows === null || mailRows.length === 0) {
          return;
        }

        if (!(await this.isServiceRunning())) {
          console.info("service is not running");
          return;
        }

        const newMails = mailRows.map(this.createMail);
        console.info(`new mails: ${newMails.length}`);

        newMails.forEach((newMail) => {
          console.debug(newMail.title);
        });

        try {
          chrome.runtime.sendMessage(
            {
              event: "onNewMailsReceived",
              data: newMails,
            },
            (response) => {
              if (!response.ok) {
                console.error(`invalid response: ${response.error}`);
                return;
              }

              console.debug("success to pass new mails to notifier");
            }
          );
        } catch (error) {
          console.debug(`failed to pass new mails to notifier: ${error}`);
        }
      }, MailWatcher.DEBOUNCE_INTERVAL);
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

  async isServiceRunning() {
    let isServiceRunning;
    try {
      isServiceRunning = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { event: "isServiceRunning" },
          (response) => {
            if (!chrome.runtime?.id) {
              reject("invalid runtime id");
            } else if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (!response.ok) {
              reject(`invalid response: ${response.error}`);
            } else {
              resolve(response.data);
            }
          }
        );
      });
    } catch (error) {
      isServiceRunning = false;
    } finally {
      return isServiceRunning;
    }
  }

  checkCurrentUrlIsTarget() {
    if (!this.config) {
      return false;
    }

    const currentURL = window.location.href;
    let suffix = "/";
    if (this.config.watchFirstPageOnly) {
      suffix = "/0/"; // Path varible for pagination. First page always use "0/".
    }

    const isTargetURL = this.config.targetMailboxes.some((targetMailbox) => {
      const targetURL = `${this.config.targetBaseURL}${encodeURIComponent(
        targetMailbox
      )}${suffix}`;
      console.debug(`currentURL: ${currentURL}`);
      console.debug(`targetURL: ${targetURL}`);

      return currentURL.startsWith(targetURL);
    });

    console.debug(`isTargetURL: ${isTargetURL}`);

    return isTargetURL;
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
      return null;
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
    const titleElements = row
      .querySelector("td.tit_box > a")
      .querySelectorAll("span");
    const title = Array.from(titleElements).reduce((prev, curr, index) => {
      return prev + (index > 0 ? " " : "") + curr.textContent;
    }, "");
    const content = row.querySelector("td.tit_box > a").getAttribute("title");
    const timestamp = row.querySelector("#data_name").textContent;
    const size = row.querySelector("#size_name").textContent;

    return new Mail(sender, title, content, timestamp, size);
  }
}
