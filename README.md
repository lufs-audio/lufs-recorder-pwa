# lufs-recorder · browser

A **zero-install, browser-native capture adapter** for the [lufs-recorder](https://github.com/danialrami/lufs-recorder) family. It records audio + MIDI entirely in the browser sandbox — no backend, no install — verifies each take honestly, and exports a `take.json` that shares the native recorder's schema.

It is the **sibling** of the native recorder, not a replacement. The native tool owns studio-grade, multichannel, driver-verified capture. This one owns the *record-from-any-laptop, nothing-to-install* job: quick MIDI/audio sketch capture, a demo/onboarding surface, and a capture point on machines where you can't (or won't) install anything.

**Live:** <https://lufs-recorder-pwa.exe.xyz/>

> **Status:** shipped (v0.3.1). The production surface — a responsive **Rack** (desktop) + **Tap** (mobile) design — is live over the real engine. On-device recording durability (a "voice-memos"-style local library) is **designed and parked** for its own session — see [Roadmap](#roadmap).

---

## What it does

- **Record modes:** capture **audio + midi**, **audio only**, or **midi only** — a first-class toggle.
- **Grant audio** → enumerates input devices. **Grant MIDI** → lists input ports. Pick, name the take, hit **Record**.
- **Audio:** `getUserMedia` (all processing disabled) → **AudioWorklet** pulling raw `Float32` frames → lossless **24-bit PCM WAV** encoded by hand (no MediaRecorder compression).
- **MIDI:** **Web MIDI API** — every message logged with timestamps, live monitor.
- **Playback + visualize:** each take renders a **waveform** you can play and **scrub**, and a **MIDI piano-roll** with a real in-browser **Web Audio synth** so you can *hear* the MIDI, playhead moving across both.
- On stop it assembles a `take.json` (`captured` / `tracks` / `midi` incl. resolved `notes` / `verification`) and offers per-file downloads.
- A **live capability panel** reports exactly what your browser allows, in real time.

## Architecture — engine vs surface

All capture, verification, DSP, MIDI note-resolution, and synth playback live in `window.LUFSRec`
(in `index.html`) — the engine is the product. The **production surface** (Rack + Tap) is a separate
layer that binds to the engine's data + transport contract in
[`docs/SURFACE-CONTRACT.md`](docs/SURFACE-CONTRACT.md) and never forks engine logic; the same seam
governs any future surface (e.g. a recordings Library). Pure helpers (note resolution, peaks,
verification, LUFS) are node-unit-tested. The whole app is still **one self-contained `index.html`** —
that packaged simplicity is a feature, and the bar any new work has to clear.

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

## Verify locally

Practice what the product preaches — the site ships a fail-closed verifier (per the LUFS
website-portability contract):

```
bash scripts/verify      # "exit 0 is not enough": proves the servable bytes are correct
bash scripts/package     # assembles dist/ + SHA256SUMS + artifact.json + verification.json
bash scripts/smoke URL   # checks a deployed URL serves the right artifact
```

## Host it yourself

It's static — host it anywhere that serves over https:

**Preferred (verified):** activate `ci/deploy.yml` (a human/local agent runs
`git mv ci/deploy.yml .github/workflows/deploy.yml`), then GitHub Pages → **Deploy from a branch** →
`deploy` / root. On every push to `main`, CI runs verify → package → retain → publishes the verified
output to the `deploy` branch. A red verify never ships.

**Quickest:** Pages → **Deploy from a branch** → `main` / `/ (root)`, no build step — but the verify
gate doesn't block this path, so prefer the `deploy` branch for anything real.

The production site currently runs on **exe.dev** at <https://lufs-recorder-pwa.exe.xyz/>. Because every
asset path is relative and there are zero external origins, the same bytes serve unchanged from any
static host (exe.dev, Cloudflare Pages, GitHub Pages, Hostinger, Netlify, an S3/R2 bucket behind https)
— serve the `deploy` branch or the repo root. See the `hosting-provider-static-deploy` skill and
[`agent-knowledge` → `docs/infra/website-portability`].

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

## Roadmap

The big next step is **on-device recording durability** — keep recordings on the device across
visits, so this becomes a true "voice-memos"-style local library (with MIDI, which Voice Memos can't
do). It is **designed and deliberately parked** for its own work session, because doing it right pulls
in Web Worker / OPFS logic that deserves care and would otherwise creep on the "one self-contained
page" simplicity that makes this tool appealing.

- **Implementation plan + step-by-step to feature parity:** [`docs/DURABILITY.md`](docs/DURABILITY.md)
- **Full analysis** (why this architecture, Voice-Memos/competitor feature study, what being a PWA
  grants vs. its limits and how other music PWAs work around them): the
  `lufs-recorder-pwa` doc suite in `agent-knowledge` → `docs/product/lufs-recorder-pwa/`.

Nothing about durability is built into `main` yet — the shipped app is capture + verify + playback +
export, and stays that way until the durability session.

## License

GPL-3.0 — matching the lufs-recorder family.
