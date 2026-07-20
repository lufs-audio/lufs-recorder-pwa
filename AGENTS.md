# AGENTS.md — lufs-recorder-pwa

Agent-facing front door for the browser-native lufs-recorder. Read this before changing anything.

## What this is
A **zero-install, browser-native capture adapter** in the lufs-recorder family. Records audio + MIDI
entirely client-side, verifies each take **honestly**, exports a `take.json` that shares the native
recorder's schema, and plays takes back — drag-scrub waveform for audio, a branded piano-roll driven by
an in-browser Web Audio synth for MIDI. Shipped: **v0.3.1**, live at <https://lufs-recorder-pwa.exe.xyz/>,
production surface = **Rack** (desktop) + **Tap** (mobile). **Tier A pure static, zero build, zero
external origins**, one self-contained `index.html`.

**Parked next step:** on-device recording durability (a local "voice-memos"-style library). Designed,
not built — see `docs/DURABILITY.md` and the `agent-knowledge` suite `docs/product/lufs-recorder-pwa/`.
Keep it off `main` until its own session; don't let it erode the single-file simplicity.

## Architecture — the engine/surface seam
- **Engine = the product.** All capture, verification, WAV/LUFS DSP, MIDI note resolution, and synth
  playback live in `window.LUFSRec` inside `index.html`. It exposes a **data + transport contract**
  (see `docs/SURFACE-CONTRACT.md`). The pure helpers are unit-tested (see below).
- **Surface = replaceable.** The DOM/CSS in `index.html` is a **throwaway reference UI**. The
  production design binds to `window.LUFSRec` and must never fork capture/DSP/MIDI logic.

## Correctness doctrine
A take is **proven, not merely produced**. `take.verification` splits **gating** (authoritative:
`audio_present`, `sample_rate`, `bit_depth_export`, `midi_present`, `midi_note_balance`) from
**inferred/non-gating** (`xruns`, `channel_mapping`) which report truthfully and never fake confidence.
Verification is **mode-aware**: the absent half of a single-mode take is not asserted.

## Repo map
```
index.html              # engine (window.LUFSRec) + throwaway reference UI
manifest.webmanifest    # PWA manifest (relative start_url/scope)
sw.js                   # service worker (BUMP CACHE every release)
icons/icon.svg          # brand icon (vector; installable on Chromium/Android)
404.html                # error document
site.yaml               # website-portability manifest (source of truth)
site/                   # neutral config: headers/redirects/external-origins/routes
scripts/verify          # fail-closed artifact verifier ("exit 0 is not enough")
scripts/package         # assemble dist/ + SHA256SUMS + artifact.json + verification.json
scripts/smoke           # deployed-URL check
ci/deploy.yml           # staged workflow (a human/local agent moves it to .github/workflows/)
docs/SURFACE-CONTRACT.md# the data + transport contract for the design pass
docs/DURABILITY.md      # parked roadmap: on-device recordings library (OPFS + IndexedDB)
```

## Before you call anything done
1. `bash scripts/verify` must pass (fail-closed).
2. If you touched engine logic, re-run the pure-helper unit tests (the harness lives in the PR that
   introduced them; keep helpers pure so they stay node-testable).
3. If you changed shipped logic, **bump `CACHE` in `sw.js`** or clients get stale code.
4. Keep asset refs **relative** and external origins **empty**.

## Deploy
Tier A, no build. Preferred: GitHub Pages **Deploy from branch → `deploy`** (populated by
`ci/deploy.yml`: verify → package → retain → publish). Direct `main`/root also works for a quick host,
but then the verify gate does not block the deploy — prefer the output-branch path.
See [[website-portability/README]] and the `hosting-provider-static-deploy` skill.

## Browser support (real ceilings)
Chromium/Android: full audio + MIDI. Firefox: partial MIDI. **Safari/iOS: no Web MIDI** → audio-only.
Multichannel/arbitrary physical channels are **out of reach in the browser** — that stays with the
native recorder. This is a sibling, not a replacement.
