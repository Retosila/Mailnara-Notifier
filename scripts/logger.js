const logger = {
  log(level, message) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
      date.getSeconds()
    ).padStart(2, "0")}`;

    const maxLevelLength = 7;
    const formattedlevel = `[${level}]`.padEnd(maxLevelLength);

    const log = console[level.toLowerCase()];
    log(`[${formattedDate}] ${formattedlevel} ${message}`);
  },
  info(message) {
    this.log("INFO", message);
  },
  debug(message) {
    this.log("DEBUG", message);
  },
  error(message) {
    this.log("ERROR", message);
  },
  warn(message) {
    this.log("WARN", message);
  },
};
