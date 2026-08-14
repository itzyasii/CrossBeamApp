# CrossBeam Play Store release checklist

## Build and policy

- [ ] Run `npm run validate` with no errors.
- [ ] Run `npm run android:lint` and review every release warning.
- [ ] Build the production AAB with `npm run build:android`.
- [ ] Confirm the AAB targets API 36 and contains armeabi-v7a and arm64-v8a.
- [ ] Verify the final AAB reports `PAGE_ALIGNMENT_16K` with bundletool.
- [ ] Test the Play-delivered split APK from an internal testing track.
- [ ] Confirm the upload certificate is not the Android debug certificate.
- [ ] Enroll in Play App Signing and securely retain the upload key.
- [ ] Complete Data Safety using `store-listing/data-safety-draft.md` as a starting point.
- [ ] Publish the Privacy Policy text at an active HTTPS URL and add that URL to Play Console.
- [ ] Complete Ads, Target Audience, Content Rating, App Access, and Foreground Service declarations.

## Mobile readiness

- [ ] Test Android 7 through Android 16, including Android 13+ nearby-device permissions.
- [ ] Test select, share-sheet import, send, receive, approve, reject, retry, pause, cancel, and history.
- [ ] Test permission denial and permanent denial without blocking unrelated features.
- [ ] Test backgrounding, screen lock, Wi-Fi loss, low storage, duplicate names, and app restart.
- [ ] Test both light and dark themes, font scaling, TalkBack, rotation, and edge-to-edge layouts.

## Android TV readiness

- [ ] Confirm the 320x180 banner and 160x160 xhdpi TV launcher icon appear correctly.
- [ ] Confirm Back exits to the TV launcher without a phone-style confirmation dialog.
- [ ] Complete every flow using only a D-pad remote.
- [ ] Test 720p, 1080p, and 4K layouts plus a low-RAM Android TV device/emulator.
- [ ] Verify QR pairing from at least two phone camera models and realistic TV viewing distance.
- [ ] Confirm the app remains landscape and no camera/touchscreen hardware is required.

## Store rollout

- [ ] Upload phone/tablet screenshots, 512x512 store icon, and 1024x500 feature graphic.
- [ ] Upload at least one unaltered Android TV screenshot and the TV banner.
- [ ] Add support email, privacy URL, release notes, and reviewer instructions.
- [ ] Run internal testing, then the required closed test if the developer account is subject to it.
- [ ] Review the Play pre-launch report before promotion.
- [ ] Use staged rollout and monitor crash rate, ANRs, wake locks, reviews, and transfer failures.
