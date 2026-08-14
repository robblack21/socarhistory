# Rainbow Machine v0.7

A js13kGames 2026 **Unicorns and Rainbows** experiment: a tiny fantasy graphics processor that happens to animate a spectacularly overengineered stallion-unicorn through a moonlit medieval landscape.

**Live demo:** https://robblack21.github.io/socarhistory/rainbow-machine/

## Controls

- **Space / tap / Up:** jump and start
- **P:** cycle pose
- **1–4:** select Trot, Gallop, Prance, or Bound
- **D:** geometry, register, joint, hair, and material-bus debug view

## Conventions before features

The engine stays deliberately narrow:

1. **Flat numeric ROM:** artwork and articulation are instruction streams, not scene objects.
2. **Reusable atoms:** `HOUSE`, `TOWER`, `CHAPEL`, and `KEEP` generate six medieval parallax planes from data; no layer gets bespoke drawing code.
3. **One geometry bus:** tagged segments feed shadows, reflections, hoof support, hair collision, and ray tests.
4. **One strip compositor:** the Castlevania-style DIV/HOFF barrel effect and plane reflection are parameterisations of the same horizontal-strip pass.
5. **One light vocabulary:** three floating stars and the moon share light-source records and the shadow-volume consumer.
6. **One rainbow primitive:** a blurred bloom pass and a crisp colour pass call the same routine.
7. **One articulated horse vocabulary:** tapered bones, joints, hocks, hooves, pose registers, and stable marker IDs build every leg.

Features are admitted only when they fit one of those conventions. The machine is small; the crimes against perspective are not.

## Published representation

`index.html` is a tiny loader. It joins `p0`–`p2`, decodes the gzip payload and replaces itself with the packed game. This keeps the live Pages copy self-contained without changing the surrounding repository.

## Current size

- Packed game HTML: **33,814 bytes raw**
- js13k preview ZIP: **12,428 bytes**
- Nominal 13 KiB ceiling: **13,312 bytes**
- Remaining preview-ZIP headroom: **884 bytes**

The competition measurement is the final submitted ZIP, so the preview figure is the useful one.

## Browser notes

Dependency-free Canvas 2D, OKLCH with fallback colours, offscreen canvases, standard browser animation/input APIs, and `DecompressionStream` for the Pages loader.

No licence has been assigned yet.
