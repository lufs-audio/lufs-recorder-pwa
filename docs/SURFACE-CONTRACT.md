# Surface Contract — lufs-recorder-pwa

The production front-end binds to this contract. The engine (`window.LUFSRec` in `index.html`) owns
capture, verification, DSP, MIDI note-resolution, and synth playback. **The surface renders and
arranges; it never forks engine logic.** Drive everything from the data + transports below.

> Ciani owns this file (the engine contract). Amacher owns the visual design that consumes it.

## Engine API — `window.LUFSRec`

```
caps                         // { secure, midi, gum, worklet, fsa, iframed, iOS }
mode (getter) / setMode(m)   // 'audio' | 'midi' | 'both'
setName(name)
grantAudio()  -> Promise<[{id,label}]>     // permission + device list
grantMidi()   -> Promise<[{id,name}]>      // permission + port list
refreshAudioDevices() -> Promise<[{id,label}]>
listMidi()    -> [{id,name}]
start({ mode, device, midiPort }) -> Promise    // begins capture
stop() -> Promise<take>                          // ends capture, returns a take
onStatus(cb) -> off        // cb({recording, elapsed_s, level, frames, midi, drop}) ~60fps while recording
onMidi(cb)   -> off        // cb({status, data}) per live MIDI message
takes         // array, newest first
serializeTake(take) -> JSON-safe object (what downloads write to take.json)
```

## Take — data contract

```jsonc
{
  "schema": "lufs-recorder/take@0.2-browser",
  "name": "...", "created": "ISO-8601", "mode": "audio|midi|both",
  "captured": { "channels", "rate", "bit_depth", "frames", "duration_s",
                "xruns": null, "xruns_inferred", "av_offset_ms", "midi_events" },
  "tracks": [ { "file", "channel", "peak_dbfs", "integrated_lufs" } ] | null,
  "midi":   { "file", "events", "note_ons", "note_offs",
              "notes": [ { "pitch", "start_ms", "dur_ms", "velocity", "channel" } ] } | null,
  "verification": { "verified": bool,
                    "checks": [ { "name", "ok", "gating", "detail", "mode" } ] }
}
```

Render aids attached at runtime (NOT serialized):
```
take.audio = { objectUrl, peaks:{ min:[], max:[], buckets }, sampleRate, duration_s } | null
take.transport         // unified (audio+midi synced when both present)  — bind your playhead here
take.audioTransport    // individual
take.midiTransport     // individual
```

- **Waveform** → draw from `take.audio.peaks` (min/max per bucket, −1..1). Bars, a filled path, an
  SVG — your call. Clicking to seek = `take.transport.seek(fraction * duration)`.
- **MIDI** → render a **piano roll** from `take.midi.notes` (pitch/start_ms/dur_ms/velocity/channel).
  **Piano roll, not kslider** — a horizontal note-lane timeline. Velocity can drive opacity/height.

## Transport interface (same shape for all three)

```
play(fromSec?) · pause() · seek(sec) · currentTime (getter) · duration (getter) · playing (getter)
on(evt, cb) -> off        // 'play' | 'pause' | 'time'(sec) | 'ended'
```

Write **one** transport component and point it at `take.transport`. The MIDI transport is a real
Web Audio synth — pressing play makes the notes audible and moves a playhead across the roll. For a
`both` take, `take.transport` plays audio + MIDI together (audio is the clock).

## Verification, honestly

Show `verification.checks[]` as-is. Two visual weights:
- **gating** (`gating:true`) — these decide `verified`. If any fail, the take is `FAILED`.
- **info** (`gating:false`) — inferred/measured; they report truth but never gate (e.g. `xruns` is a
  browser estimate, `channel_mapping` can't prove physical channels). Don't dress info checks up as
  pass/fail — that's the whole honesty point.

## Suggested class / `data-` hooks

Rebuild the DOM freely; if useful, these are the seams the reference UI uses:
`.take[data-mode]`, `.modeswitch button[data-mode][aria-pressed]`, `.meters .meter i` (level),
`.viz.waveform`, `.viz.pianoroll`, `.playhead`, `.transport`, `.checks .chk[.gating|.info]`,
`.dial[.armed|.live]`, `.midimon`.

## Design direction

- **Sibling to the real lufs-recorder frontend.** Same family, not a clone. LUFS Audio identity:
  charcoal `#111`, teal `#78BEBA` as the single lead accent, the four-color spectrum as seasoning
  (`#D35233` / `#9FC1D0` / `#C8654A` / `#D9A23D`), `lufs.` wordmark, Host Grotesk + Public Sans +
  Space Mono, dark-editorial / Swiss.
- **Record modes** (audio / midi / both) are a first-class control, not a buried setting.
- **Mobile + desktop.** Android Chrome = full audio + MIDI; iOS = audio-only (no Web MIDI) — the UI
  should degrade gracefully and say why (read `caps`).
- Keep it **installable + portable**: relative asset paths, no new external origins, don't break
  `scripts/verify`. Bump `sw.js` `CACHE` if you change shipped logic.

## Deliverable

Three distinct looks in one published site (same method as the native recorder Console/Scope/Glance
pass and the schedule dashboard directions), then we review and rev.
