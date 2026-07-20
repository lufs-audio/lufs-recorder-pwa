# Recording Durability — implementation plan (PARKED)

> **Status: designed, not built.** Nothing here is on `main`. This is the step-by-step for turning
> lufs-recorder-pwa into a true on-device recordings library ("voice-memos, but with MIDI"), to be
> executed in its own work session so it doesn't creep on the single-self-contained-page simplicity
> that makes the tool appealing.
>
> Deep rationale, the Voice-Memos/competitor feature study, and the PWA grants-vs-limits analysis live
> in the `agent-knowledge` suite **`docs/product/lufs-recorder-pwa/`**. This file is the build plan.

## Goal

Recordings survive across visits on the same device, stored **locally** (no server, no account), so
the tool becomes a real capture-and-keep instrument. We're already ahead of Voice Memos in one axis
(MIDI + honest verification); durability is the axis we're missing.

## The one hard truth to design around

Browser storage is **not "forever,"** and no API makes it so. Design for this honestly (sources in the
KB suite):

| Platform | Reality | The durable path |
|---|---|---|
| Chromium desktop | Good — evicts only under real disk pressure (LRU); `persist()` exempts the origin | `persist()` after first save |
| Android Chrome | Fair — higher eviction risk (OS memory pressure); `persist()` can be weak in WebViews | install + `persist()` |
| **iOS Safari (tab)** | **7-day wipe** of all script-writable storage (IndexedDB/OPFS) after no interaction — a hard anti-tracking policy, not disk pressure | **Install to Home Screen** (exempts it) |
| Installed PWA (any OS) | Best available — own storage container; iOS exempts installed apps from the 7-day cap | this is *the* answer |

Eviction is **whole-origin and atomic** — when it fires, the browser drops *everything* for the origin
at once, not the oldest take. Cleanup and honesty are our job, not the browser's.

## Architecture (the "best way")

- **OPFS** (Origin Private File System, via a Web **Worker** + sync access handle) for the **audio/MIDI
  blob bytes** — ~10× faster than IndexedDB for large blobs, true random-access reads.
- **IndexedDB** for the **metadata index** — name, timestamp, duration, mode, `peaks`, resolved
  `notes`, verification, and the OPFS file key. Small structured records, easy to query.
- **`navigator.storage.persist()`** requested right after the first successful save; **log the real
  result** rather than assume success (a documented failure mode).
- **Export is the real escape hatch** — per-take download (works everywhere) + a bulk "export all"
  (zip of WAVs + `take.json` manifest). This is the only thing that survives platform eviction, so it's
  a safety net, not a nice-to-have.
- *Not* IndexedDB-blobs-at-scale; *not* the Cache API. File System Access "save to a real folder" is a
  **Chromium-desktop-only enhancement**, not the primary store.

## Durability as an honesty axis (this resolves the keep-forever vs. stale debate)

Persistence gets the **same honest treatment as verification.** Each take carries a **durability tier**,
shown plainly, exactly as it carries a verification status:

1. **In this browser** — best-effort; could be evicted (on iOS, within 7 days).
2. **Installed & persisted** — durable until the user clears/uninstalls.
3. **Exported** — a real file outside the browser's reach; truly theirs.

Default is **keep**; we **never silently delete** and **never silently hoard**. The user always sees
the tier and is nudged toward the durable ones (install / export). A recorder that silently loses a
take, or silently leaves 4 GB of stale takes on a phone, both *lie* — and we don't ship liars.

## Hygiene (don't overflow the device)

- Budget via `navigator.storage.estimate()`; show "X of Y used"; **warn ~80%**, **require action ~95%**.
- Guard `QuotaExceededError` **before and during** a record so we never corrupt a take mid-capture.
- **Opt-in** auto-prune ("auto-remove takes older than N days"), **off by default**.
- **Soft-delete recycle bin** (restore window) before hard delete — mirrors Voice Memos' "Recently
  Deleted." Never a silent purge.

## "Show in Finder / open Recordings" — honest answer

Not possible from a web page: no API reveals a file's OS path or opens Finder/Explorer (deliberate
privacy design). Closest, ranked: (1) File System Access "**Save to a folder**" on Chromium desktop —
files land in a real folder the user picked; (2) **Download** to the OS Downloads folder everywhere
else; (3) **the app's own Library becomes the "Recordings" home** — which, for an installed PWA, is
exactly the Voice-Memos feel. So the answer to "open Recordings" is: *we build Recordings, inside the app.*

## Lane split (same engine/surface seam as the rest of this repo)

- **Ciani (engine):** a **store layer** on `window.LUFSRec` — `saveTake / listTakes / getTake /
  deleteTake / renameTake / storageEstimate / persist / export` — plus a per-take `durability` field.
  OPFS+IDB, the Worker, quota guards. Owns durability *correctness*.
- **Amacher (surface):** the **Library** view — list, per-take rename/delete, storage meter,
  durability-tier badges, install + export nudges — bound to the store contract via
  [`SURFACE-CONTRACT.md`](SURFACE-CONTRACT.md). Owns how it *feels*.

## Step-by-step to Voice-Memos parity

Each phase ships behind `scripts/verify`, bumps `sw.js` `CACHE`, keeps zero external origins, and keeps
the app one self-contained `index.html` (the Worker can be an inlined blob module, as the AudioWorklet
already is).

1. **Store layer (engine).** OPFS+IDB behind `window.LUFSRec`: `saveTake/listTakes/getTake`. On stop,
   auto-save; on load, list. `persist()` after first save (log result). Unit-test the pure index logic.
2. **Library surface.** Amacher's list view over `listTakes`; open a stored take back into the existing
   playback/transport UI. Per-take **rename** + **delete** (soft-delete recycle bin).
3. **Storage awareness.** `storageEstimate()` meter; 80%/95% thresholds; `QuotaExceededError` guards;
   persistence-status + "Add to Home Screen for durable storage" nudge (honest, especially on iOS).
4. **Export / durability tiers.** Per-take download + **export-all** (zip + manifest). Surface the
   durability tier per take. Optional File System Access "save to a folder" on Chromium desktop.
5. **Hygiene polish.** Opt-in retention rules (off by default); recycle-bin auto-clean after N days;
   "Recently Deleted"-style restore.

**Parity checklist vs. Voice Memos** (we add MIDI + verification on top): record ✓ · waveform ✓ ·
list · rename · folders/tags · playback + scrub ✓ · trim/edit · soft-delete + restore · storage
usage · share/export · cross-device (out of scope — local-only by design; export is the bridge).

## Explicit non-goals (for now)

- No accounts, no server, no cloud sync — local-first is the point; export is the portability bridge.
- No multichannel (browser ceiling; stays with the native recorder).
- Don't compromise the single-file, zero-external-origin, verify-gated shape to get any of the above.

See also: [`SURFACE-CONTRACT.md`](SURFACE-CONTRACT.md) · [`README.md`](../README.md) · the
`agent-knowledge` suite `docs/product/lufs-recorder-pwa/`.
