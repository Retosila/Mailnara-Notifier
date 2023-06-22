class Notifier {
  notifier;

  constructor(notifier) {
    this.notifier = notifier;
  }

  notify(message) {
    this.notifier.notify(message);
  }
}

class SlackNotifier {
  token;
  channelID;
  endpoint;

  constructor(token, channelID, endpoint) {
    this.token = token;
    this.channelID = channelID;
    this.endpoint = endpoint;
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
        console.info("Message sent: ", data.ts);
      } else {
        console.error("Error: ", data.error);
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  }
}
