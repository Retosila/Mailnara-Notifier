class Notifier {
  async prepare() {
    throw new Error("prepare() must be implemented");
  }

  async notify() {
    throw new Error("notify() must be implemented");
  }
}

class SlackNotifier extends Notifier {
  token;
  channelID;
  endpoint;
  isPrepared;

  constructor() {
    super();
    this.endpoint = "https://slack.com/api/chat.postMessage";
    this.isPrepared = false;
  }

  async prepare() {
    if (this.isPrepared) {
      console.debug("slack notifier is already prepared");
      return;
    }

    try {
      const [slackAPIToken, slackChannelID] = await Promise.all([
        (async () => (await storage.get("slackAPIToken")) ?? "")(),
        (async () => (await storage.get("slackChannelID")) ?? "")(),
      ]);

      if (!slackAPIToken || !slackChannelID) {
        throw new Error(
          `failed to validate slack configuration: ${result.error}`
        );
      }

      this.token = slackAPIToken;
      this.channelID = slackChannelID;

      console.info("notifier is prepared successfully");
    } catch (error) {
      throw new Error(`failed to fetch slack configuration: ${error}`);
    }
  }

  async notify(message) {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json; charset=UTF-8",
    };

    const body = JSON.stringify({
      channel: this.channelID,
      text: message,
    });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: headers,
        body: body,
      });

      const data = await response.json();

      if (!data.ok) {
        let msg;

        switch (data.error) {
          case "invalid_auth":
            msg =
              "Slack API token is invalid. Please re-configure your Slack API token properly.";
            break;

          case "channel_not_found":
            msg =
              "Cannot find your Slack Channel. Please re-configure your Slack Channel ID properly.";
            break;

          default:
            msg = data.error;
        }

        chrome.notifications.create({
          type: "basic",
          iconUrl: "../assets/images/icon96.png",
          title: "Mailnara Notifier",
          message: `Failed to notify\nError: ${msg}`,
        });

        throw new Error(`failed to send slack message: ${data.error}`);
      }

      console.debug(`success to notify: ${data.ts}`);
    } catch (error) {
      throw new Error(`failed to notify: ${error}`);
    }
  }
}
