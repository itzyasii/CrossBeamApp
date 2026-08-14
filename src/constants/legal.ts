export type LegalSection = {
  title: string;
  body: string;
};

export const LEGAL_LAST_UPDATED = "August 15, 2026";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Overview",
    body: "CrossBeam is an offline-first local file-sharing app. CrossBeam does not operate an account system, advertising network, analytics service, cloud storage service, or developer-controlled transfer server.",
  },
  {
    title: "Files and shared content",
    body: "Files, photos, videos, documents, text, and links you select are processed on your device and sent directly to the receiving device you choose over the local network. CrossBeam does not upload this content to a CrossBeam server.",
  },
  {
    title: "Nearby-device information",
    body: "To discover and connect to nearby devices, CrossBeam may use local network addresses, device names, Wi-Fi Direct, Nearby Wi-Fi, Bluetooth, and local service discovery. This information is used only for nearby discovery, pairing, and transfer operations.",
  },
  {
    title: "Permissions",
    body: "Camera access is used only when you scan a CrossBeam pairing QR code. Nearby Wi-Fi, Bluetooth, and location-related permissions are used for local device discovery where required by Android. Notification permission is used for incoming-transfer requests and active-transfer progress. File pickers and system share sheets provide access only to content you select.",
  },
  {
    title: "Information stored on your device",
    body: "CrossBeam stores app settings, remembered devices, transfer history, pending approvals, and resumable-transfer state locally. App backup is disabled on Android. You can clear history, remove remembered devices, or uninstall CrossBeam to remove app-managed local data.",
  },
  {
    title: "Security",
    body: "CrossBeam validates transfer structure and file integrity and asks for approval from new senders. End-to-end encrypted transfer sessions are still under development. Until that protection ships, use CrossBeam only on networks and with devices you trust.",
  },
  {
    title: "Data collection and sharing",
    body: "CrossBeam does not sell data and does not send personal data to the developer or advertising companies. A file transfer intentionally shares the content and necessary transfer metadata with the receiving device selected by the user.",
  },
  {
    title: "Children",
    body: "CrossBeam is a general-audience utility and is not directed to children. It does not knowingly collect children's personal information through a developer-operated service.",
  },
  {
    title: "Changes and contact",
    body: "This policy may change when CrossBeam's capabilities change. The updated date will be shown here. Privacy questions can be sent to yasirpechuho1@gmail.com.",
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Using CrossBeam",
    body: "CrossBeam lets you discover nearby devices and transfer user-selected content over local connections. You are responsible for confirming the receiving device and reviewing incoming-transfer requests.",
  },
  {
    title: "Your responsibilities",
    body: "Share only content you own or have permission to distribute. Do not use CrossBeam to violate another person's privacy, intellectual-property rights, device security, or applicable law.",
  },
  {
    title: "Network and device safety",
    body: "Use trusted devices and trusted local networks. Device discovery and transfer availability depend on operating-system permissions, network conditions, storage space, and device compatibility.",
  },
  {
    title: "No cloud recovery",
    body: "CrossBeam does not keep cloud copies of transferred files or app history. Deleted files, cleared history, and data lost through uninstall or device failure cannot be recovered by CrossBeam.",
  },
  {
    title: "Service availability",
    body: "The app is provided as available and may contain defects. Transfers can be interrupted by network changes, background restrictions, power loss, insufficient storage, or incompatible devices. Verify important files after transfer.",
  },
  {
    title: "Updates",
    body: "Features, compatibility, and these terms may change in later releases. Continuing to use an updated version means accepting the terms shown in that version.",
  },
  {
    title: "Contact",
    body: "Questions about these terms can be sent to yasirpechuho1@gmail.com.",
  },
];
