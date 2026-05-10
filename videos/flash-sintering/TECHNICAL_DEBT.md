# Technical debt — flash-sintering video

Notes for `lucastonon` to revisit later.

## 1. Anchor PDF substitution

**Original plan:** anchor on Cologna, Rashkova, Raj 2010 — "Flash sintering of nanograin zirconia in <5 s at 850 °C", *J. Am. Ceram. Soc.* 93(11):3556–3559, DOI `10.1111/j.1551-2916.2010.04089.x`.

**Reality:** that paper is paywalled at Wiley with no open preprint. The Raj group page (https://www.colorado.edu/lab/raj-rishi/publications/flash-sintering) only lists DOIs, not direct PDFs. MDPI and iris.unitn.it both 403'd `curl`/`fetch`. ResearchGate requires login.

**Pivot used:** Yoon, Ghose et al. 2019, "On the synchronicity of flash sintering and phase transformation," *J. Am. Ceram. Soc.* (Brookhaven OSTI mirror, https://www.osti.gov/servlets/purl/1498863). 10 pages, JACerS rapid communication, YSZ flash sintering with synchrotron diffraction. Genuinely open.

**Why it's still good:** same journal, same material (YSZ), modern flash physics with hard data. The full Cologna–Raj 2010 origin story still gets told in the narrative — just sourced from the research dossier instead of from the anchor PDF.

**To revert later:** drop the real Cologna–Raj 2010 PDF at `videos/flash-sintering/paper.pdf`, edit `paperSource.value` and `paperTitle` in `config.yaml` and `manifest.json` back to the Wiley DOI / 2010 title, then re-run `/paper-video script flash-sintering` to regenerate brief + script. Narration would need re-running on changed beats.

## 2. Other open-access flash-sintering PDFs already cached

If you want to add supplementary papers (the framework only takes one anchor, but the research dossier can reference others):

- `/tmp/flash-srep.pdf` — Saunders, Grasso, Reece 2016, *Sci. Rep.* "Ultrafast-Contactless Flash Sintering using Plasma Electrodes" (CC-BY 4.0). Frontier visual: arc plasma flashing of B₄C / SiC.
- `/tmp/osti2.pdf` — O'Toole, Ghose 2023, JACerS "In-operando synchrotron experiments of flash sintering carried out in current rate mode" (OSTI mirror). Recent state-of-the-art.

(These will be cleared on next reboot — copy them somewhere persistent if you want to keep them.)

## 3. Image source whitelist for asset-fetcher

CC-BY safe (verified during planning): MDPI, Nature *Sci. Rep.* / *npj*, Frontiers, SpringerOpen.
Not safe (redraw in Manim instead): Wiley, Elsevier, Tandfonline.

The Sci. Rep. 27222 paper (Saunders 2016) is a good source for the "glowing flashing sample" photograph. MDPI Materials 16/4/1544 is a good source for before/after grain micrographs.

## 4. Marker MPS crash → CPU fallback

`npm run extract-paper -- flash-sintering` crashed the first time on the Apple-Silicon MPS backend with a Surya/torch index-out-of-bounds error. Re-running with `TORCH_DEVICE=cpu` completed in ~108 s. If this recurs on other papers, consider making CPU the default in `src/tools/extract-paper.ts`. Not a per-video issue.

## 5. Anchor paper turned out to be reactive-flash, not classic densification

The Yoon 2019 paper actually documents **reactive flash sintering of MgAl₂O₄ spinel** from MgO + Al₂O₃ powders — i.e., flash sintering and phase transformation happening *simultaneously*. Only one equation was captured in `equations.json`: the spinel-formation reaction `MgO + Al₂O₃ → MgAl₂O₄`. Strain ε = ln(l/l₀) and density ρ = ρ₀·e^(−3ε) appear inline in §2.2 but Marker rendered them as Unicode mathvariant glyphs rather than LaTeX — the storyteller may want to add those as Manim-rendered equations rather than equationCard reveals.

The "synchronicity" framing actually deepens the video: flash isn't just *fast densification*, it's a regime where chemistry and densification happen in the same second-scale event. The critic should weave that into the narrative.

## 7. Producer quality-gate auto-skipped

The user can listen to videos/flash-sintering/narration/beat-001.mp3 onward at any time; failed-prosody beats can be re-narrated individually with `npm run narrate -- flash-sintering <beat_id> --force`.

Also: `eleven_v3` does not currently support ElevenLabs request-stitching (`previous_text`/`next_text`) — the API rejects with 400 unsupported_model. `src/tools/narrate.ts` was patched to skip stitching when `voice.model_id === 'eleven_v3'`. Prosody continuity in this video relies on per-beat audio tags, not stitching.

## 8. Visualizer fixes that landed in shared code

These are framework-level changes the visualizer made while authoring this video. Worth keeping or reverting consciously:

- **`src/remotion/components/CaptionBar.tsx`** — patched a non-monotonic `interpolate` input-range crash caused by zero-duration words in `*.timestamps.json`. Added EPS guards on activation + pastness curves. Future videos benefit from this fix; no per-video config.
- **`src/tools/narrate.ts`** — patched to skip ElevenLabs request stitching (`previous_text`/`next_text`) when `voice.model_id === 'eleven_v3'`, since the v3 endpoint rejects those fields with 400 `unsupported_model`. Affects every video that uses an `eleven_v3` voice. Prosody continuity becomes the storyteller's responsibility (per-beat audio tags).
- **Manim 0.19 `VMobject.close_path()` returns None** — `frontier.py` used it like a chainable; rewrote to close manually by appending the start point. If future Manim scenes do path closure this way, do the same.

## 9. Final video

- Path: `videos/flash-sintering/output.mp4`
- Duration: 559.4 s (~9:19) — under the 10–12 min target by ~40–80 s. The shortfall is content density, not pacing. To extend, `/paper-video script flash-sintering` and ask the storyteller to add 15–30 beats expanding act 3 (more derivation steps) or act 4 (more SoTA materials).
- 1920×1080 h264 + AAC 48 kHz stereo, 73.7 MB.
- Visual blemishes the visualizer flagged but did not block on:
  - `lineage` scene: "Duval d'Adrian" and "Taylor" labels slightly overlap because 1922/1933 are close on the timeline.
  - `particle_coalescence`: only one Voronoi cell remained inside the viewport (others clipped by bounding seeds); the dense-polycrystal tableau still reads.

## 6. Research dossier location

Full history + mechanism + state-of-the-art research is at:
`/Users/lucastonon/.claude/plans/create-a-video-about-bright-sonnet-agent-a28fca6b3634a1b94.md`

The critic agent should read it as supplementary context to weave history and SoTA into the narrative arc.
