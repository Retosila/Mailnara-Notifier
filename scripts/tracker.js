class NotifiedMailTracker {
  static SIZE = 500;
  static DATA_KEY = "notifiedMailHashes";
  static POINTER_KEY = "oldestNotifiedMailPointer";

  cache;
  pointer;
  backup;

  constructor() {
    this.cache = new Array(NotifiedMailTracker.SIZE).fill(null);
    this.pointer = 0;
    this.backup = null;
  }

  async prepare() {
    await this.loadNotifiedMailList();
    console.info("tracker is prepared successfully");
  }

  async loadNotifiedMailList() {
    try {
      await this.load();
      console.info("loaded the notified mail list successfully");

      const cachedHashes = this.cache.filter((item) => item !== null);
      console.info(`cached hashes: ${cachedHashes.length}`);
      console.debug(cachedHashes);
    } catch (error) {
      throw new Error(
        `"an error occurred while loading the notified mail list: ${error}`
      );
    }
  }

  async saveNotifiedMailList() {
    try {
      await this.save();
      console.info("saved the notified mail list successfully");
    } catch (error) {
      throw new Error(
        `"an error occurred while saving the notified mail list: ${error}`
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
    this.backup = { hash: this.cache[this.pointer], pointer: this.pointer };

    this.pointer = (this.pointer + 1) % NotifiedMailTracker.SIZE;
    this.cache[this.pointer] = hash;
  }

  rollback() {
    if (this.backup) {
      this.cache[this.backup.pointer] = this.backup.hash;
      this.pointer = this.backup.pointer;

      this.backup = null;
    }
  }

  contains(hash) {
    return this.cache.includes(hash);
  }
}
