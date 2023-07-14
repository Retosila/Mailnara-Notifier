try {
  importScripts("lib/hash.js");
} catch (error) {
  console.error(`failed to import script: ${error}`);
}

function formatMail(mail) {
  const ok = verify(mail);
  if (!ok) {
    return null;
  }

  return `Title: ${mail.title}\nSender: ${mail.sender}\nContent: ${mail.content}`;
}

function verify(mail) {
  // FIXME: Add verifications.
  return true;
}

function generateMD5Hash(str) {
  return MD5_hexhash(str);
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

  remove: (key) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
};
