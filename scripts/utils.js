try {
  importScripts("lib/hash.js");
} catch (e) {
  console.log(`Failed to import scripts: ${e}`);
}

function formatMail(mail) {
  const ok = verify(mail);
  if (!ok) {
    return null;
  }

  return `Title: ${mail.title}\nSender: ${mail.sender}\nContent: ${mail.content}\nTimestamp: ${mail.timestamp}\nSize: ${mail.size}`;
}

function verify(mail) {
  // FIXME: Add verifications.
  return true;
}

function generateMD5Hash(str) {
  return MD5_hexhash(str);
}
