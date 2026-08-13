export const friendlyErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("permission") || message.includes("denied")) {
    return "CrossBeam needs nearby-device access. Check your phone settings and try again.";
  }
  if (message.includes("storage") || message.includes("space")) {
    return "There isn't enough free space for these files.";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "The other device took too long to respond. Move closer and try again.";
  }
  if (
    message.includes("device_not_ready") ||
    message.includes("not transfer-ready") ||
    message.includes("not transfer ready")
  ) {
    return "That device isn't ready right now. Open CrossBeam on it, then find the device and try again.";
  }
  if (
    message.includes("wi-fi direct") ||
    message.includes("peer") ||
    message.includes("endpoint") ||
    message.includes("host") ||
    message.includes("socket") ||
    message.includes("connect")
  ) {
    return "Couldn't connect to that device. Keep both devices nearby and try again.";
  }
  if (
    message.includes("checksum") ||
    message.includes("chunk") ||
    message.includes("protocol") ||
    message.includes("corrupt")
  ) {
    return "The file didn't arrive safely. Please try sending it again.";
  }
  if (message.includes("reject") || message.includes("declin")) {
    return "The other device declined the files.";
  }
  if (message.includes("file") && (message.includes("read") || message.includes("open"))) {
    return "CrossBeam couldn't open one of the files. Choose it again and retry.";
  }
  return "Something went wrong. Please try again.";
};
