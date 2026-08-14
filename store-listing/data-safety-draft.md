# Data Safety working draft

This is an implementation-derived draft, not a substitute for completing the Play Console questionnaire against the final AAB and every included SDK.

- Developer-operated accounts: none.
- Advertising or analytics SDKs: none currently configured.
- Developer-controlled cloud collection: none currently implemented.
- User-selected files/content: processed locally and intentionally transmitted to the receiver selected by the user; not sent to the developer.
- Nearby device data: accessed locally for discovery and pairing; not sent to the developer.
- Approximate/precise location permission: used only where Android requires it for nearby-device discovery; not sent to the developer.
- Camera: used to scan pairing QR codes; images are not retained or sent to the developer.
- App activity: transfer history and settings remain on-device.
- Encryption in transit: do not claim encrypted transfer sessions until authenticated transport encryption is implemented.
- Deletion: users can clear history/remove remembered devices; uninstalling removes app-managed local data.
