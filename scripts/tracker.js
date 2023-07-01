class NotifiedMailTracker {
  static instance;

  static SIZE = 500;
  static DATA_KEY = "notifiedMailHashes";
  static POINTER_KEY = "oldestNotifiedMailPointer";

  cache;
  pointer;

  constructor() {
    if (NotifiedMailTracker.instance) {
      return NotifiedMailTracker.instance;
    }

    this.cache = new Array(NotifiedMailTracker.SIZE).fill(null);
    this.pointer = 0;

    NotifiedMailTracker.instance = this;
  }

  async prepare() {
    this.loadNotifiedMailList();
  }

  async loadNotifiedMailList() {
    try {
      await this.load();
      console.info("Loaded the notified mail list successfully.");

      const cachedHashes = this.cache.filter((item) => item !== null);
      console.info(`Cached Hashes: ${cachedHashes.length}`);
      console.debug(cachedHashes);
    } catch (error) {
      throw new Error(
        `"An error occurred while loading the notified mail list: ${error}`
      );
    }
  }

  async saveNotifiedMailList() {
    try {
      await this.save();
      console.info("Saved the notified mail list successfully.");
    } catch (error) {
      throw new Error(
        `"An error occurred while saving the notified mail list: ${error}`
      );
    }
  }

  async load() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        [NotifiedMailTracker.DATA_KEY, NotifiedMailTracker.POINTER_KEY],
        (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.cache = result[NotifiedMailTracker.DATA_KEY] || this.cache;
            this.pointer =
              result[NotifiedMailTracker.POINTER_KEY] || this.pointer;
            resolve();
          }
        }
      );
    });
  }

  async save() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        {
          [NotifiedMailTracker.DATA_KEY]: this.cache,
          [NotifiedMailTracker.POINTER_KEY]: this.pointer,
        },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        }
      );
    });
  }

  add(hash) {
    this.cache[this.pointer] = hash;
    this.pointer = (this.pointer + 1) % NotifiedMailTracker.SIZE;
  }

  contains(hash) {
    return this.cache.includes(hash);
  }
}
