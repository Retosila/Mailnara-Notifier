class Notifier {
  async prepare() {
    throw new Error("prepare() must be implemented");
  }

  async notify() {
    throw new Error("notify() must be implemented");
  }
}

class SlackNotifier extends Notifier {
  static instance;

  token;
  channelID;
  endpoint;

  constructor() {
    if (SlackNotifier.instance) {
      return SlackNotifier.instance;
    }

    super();
    this.endpoint = "https://slack.com/api/chat.postMessage";

    SlackNotifier.instance = this;
  }

  async prepare() {
    try {
      const [slackAPIToken, slackChannelID] = await Promise.all([
        (async () => (await storage.get("slackAPIToken")) ?? "")(),
        (async () => (await storage.get("slackChannelID")) ?? "")(),
      ]);

      const result = await this.hasValidConfiguration(
        slackAPIToken,
        slackChannelID,
        this.endpoint
      );

      if (result.ok) {
        console.debug("Slack configuration is validated");

        this.token = slackAPIToken;
        this.channelID = slackChannelID;
      } else {
        throw new Error(
          `Failed to validate slack configuration: ${result.error}`
        );
      }
    } catch (error) {
      throw new Error(`Failed to fetch slack configuration: ${error}`);
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

      if (data.ok) {
        console.debug(`Success to notify: ${data.ts}`);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      throw new Error(`Failed to notify: ${error}`);
    }
  }

  async hasValidConfiguration(slackAPIToken, slackChannelID, slackAPIEndpoint) {
    console.debug(
      `Check slack configuration validty:\nAPI Token:${slackAPIToken}\nChannel ID:${slackChannelID}\nEndpoint:${slackAPIEndpoint}`
    );

    if (!slackAPIToken || !slackChannelID || !slackAPIEndpoint) {
      return false;
    }

    // Post message to the given endpoint to check vitality.
    const headers = {
      Authorization: `Bearer ${slackAPIToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    };

    const body = JSON.stringify({
      channel: slackChannelID,
      text: "Check slack configuration validity.",
    });

    try {
      const response = await fetch(slackAPIEndpoint, {
        method: "POST",
        headers: headers,
        body: body,
      });

      const data = await response.json();

      if (data.ok) {
        return { ok: true };
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      return { ok: false, error: error };
    }
  }
}
