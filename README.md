# lufs-recorder · browser

A **zero-install, browser-native capture adapter** for the [lufs-recorder](https://github.com/danialrami/lufs-recorder) family. It records audio + MIDI entirely in the browser sandbox — no backend, no install — verifies each take honestly, and exports a `take.json` that shares the native recorder's schema.

It is the **sibling** of the native recorder, not a replacement. The native tool owns studio-grade, multichannel, driver-verified capture. This one owns the *record-from-any-laptop, nothing-to-install* job: quick MIDI/audio sketch capture, a demo/onboarding surface, and a capture point on machines where you can't (or won't) install anything.

> This is currently a single-page app with a deliberately throwaway UI. The **capture and verification logic is the real deliverable.**

---

## What it does

- **Grant audio** → enumerates input devices. **Grant MIDI** → lists input ports.
- Pick a device + port, name the take, hit **Record**.
- **Audio:** `getUserMedia` (all processing disabled) → **AudioWorklet** pulling raw `Float32` frames → lossless **24-bit PCM WAV** encoded by hand (no MediaRecorder compression).
- **MIDI:** **Web MIDI API** — every message logged with timestamps, live monitor.
- On stop it assembles a `take.json` (`captured` / `tracks` / `midi` / `verification`) and offers per-file downloads, plus **save-to-folder** via the File System Access API where supported.
- A **live capability panel** reports exactly what your browser allows, in real time.

## Verification is honest

Verification is split the way the lufs-recorder doctrine demands — a take is *proven*, not merely produced, and the contract **never claims confidence it doesn't have**:

**Authoritative · gating** (a take is `VERIFIED` only if all of these pass):
- `audio_present` — frames captured
- `sample_rate` — a 48 kHz context is forced
- `bit_depth_export` — 24-bit PCM
- `midi_note_balance` — note-ons == note-offs (Web MIDI sees every message; this ports perfectly)
- `true_peak` — sample peak per channel

Plus a real **BS.1770 integrated LUFS** (two-stage K-weighting + absolute/relative gating, not an RMS approximation).

**Inferred / info · non-gating** (reported truthfully, never faked, never gating):
- `xruns` — the browser cannot see driver-level underruns; a frame-accounting estimate is reported and **labelled inferred**
- `channel_mapping` — the browser cannot prove *physical* channel identity
- `av_offset` — first MIDI event vs audio start, measured across the two clocks

## Install as a PWA

Served over **https** (or `localhost`), this is an installable PWA — manifest + service worker + offline app shell. In Chromium desktop use the install icon in the address bar; on Android Chrome use **Add to Home screen**. Once installed it launches standalone and runs offline.

## Host it yourself

It's static — host it anywhere that serves over https:

**GitHub Pages (simplest):** Settings → Pages → Build and deployment → **Deploy from a branch** → `main` / `/ (root)`. It'll be live at `https://danialrami.github.io/lufs-recorder-pwa/`. No build step, no workflow.

Any static host works too (Cloudflare Pages, Hostinger, Netlify, an S3/R2 bucket behind https) — just serve the repo root.

## Browser support — the real constraints

| Capability | Chromium (Chrome/Edge/Opera) | Firefox | Safari / iOS |
|---|---|---|---|
| Audio capture (`getUserMedia` + AudioWorklet) | ✅ | ✅ | ✅ (default input only on iOS) |
| **Web MIDI** | ✅ | ⚠️ partial | ❌ none |
| File System Access (save-to-folder) | ✅ | ⚠️ download fallback | ⚠️ download fallback |
| PWA install | ✅ | ⚠️ limited | ⚠️ limited |

- **Requires a secure context** (https or `localhost`). Device access is blocked otherwise.
- **Mobile:** works responsively. Android Chrome gets **both** audio and MIDI. **iOS has no Web MIDI at all** and locks audio to the default input, so it degrades to audio-only there — a platform ceiling, not a bug. The page detects and states this.
- **Multichannel is out of reach in the browser.** This captures the interface's stereo path, not arbitrary physical channels (e.g. "channels 9–10"). That job stays with the native recorder.

## Relationship to the native recorder

Same `take.json` shape, same verification philosophy, different capture backend. The intent is for the verifier and take schema to become **shared code** with the native recorder's TypeScript build so there's a single source of truth for what a verified take *is* — the browser is just another capture adapter feeding that contract.

## License

GPL-3.0 — matching the lufs-recorder family.
