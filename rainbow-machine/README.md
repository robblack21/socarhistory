# Rainbow Machine v0.9 — Infinity Tunnel Audio Bus

A js13kGames 2026 **Unicorns and Rainbows** experiment: a tiny fantasy graphics processor animating a spectacularly overengineered stallion-unicorn through a moonlit medieval infinity tunnel.

**Live demo:** https://robblack21.github.io/socarhistory/rainbow-machine/

## Controls

- **Space / tap / Up:** start audio and jump
- **P:** cycle pose
- **1–4:** select Trot, Gallop, Prance, or Bound
- **D:** geometry, register, joint, hair, material-bus and grounding debug view

Audio begins after the first user gesture, as required by browser autoplay policy.

## v0.9

- The rainbow is a centred recursive tunnel of wrapped depth rings, with near-ring parallax and shared crisp/bloom geometry.
- The moon rises from behind one hill line, crosses the sky, and sets behind the opposite hills.
- A `DIV=2` horizontal-strip map warps sky and floor around the hill horizon into a concave infinity stage; near floor strips expand toward the viewer.
- The explicit yellow ground line is gone. Floor grid, reflections, shadows, hoof particles and foreground expansion define the plane.
- A marker-driven dry run of the canonical horse ROM grounds the lowest hoof exactly on the logical floor.
- Procedural Web Audio consumes moon altitude, tunnel wraps, hoof materials, hay contact and jump state.
- A shared audio pulse feeds back into moon glow and the recursive rainbow.
- The horn anchor was recentered without adding a second horse renderer.

## Conventions before features

The engine stays deliberately narrow:

1. **Flat numeric ROM:** artwork and articulation are instruction streams, not scene objects.
2. **Reusable atoms:** medieval architecture is assembled from `HOUSE`, `TOWER`, `CHAPEL`, and `KEEP` programs.
3. **One geometry bus:** tagged segments feed shadows, reflections, hoof support, hair collision and ray tests.
4. **One strip compositor:** reflections and the Castlevania-style infinity warp are parameterisations of the same horizontal-strip pass.
5. **One light vocabulary:** floating stars and the moving moon share light records and the shadow-volume consumer.
6. **One rainbow vocabulary:** tunnel rings supply both bloom and crisp colour passes.
7. **One articulated horse vocabulary:** tapered bones, joints, hocks, hooves, pose registers and stable marker IDs build every leg.
8. **One audio bus:** scene events synthesize sound and write one visual feedback pulse.

Features are admitted only when they fit those conventions. The machine is small; the crimes against Euclidean space are not.

## Published representation

`index.html` is a tiny loader. It joins `p0`–`p2`, decodes the gzip payload and replaces itself with the packed game.

## Current size

- Packed game HTML: **33,810 bytes raw**
- js13k preview ZIP: **12,522 bytes**
- Nominal 13 KiB ceiling: **13,312 bytes**
- Remaining preview-ZIP headroom: **790 bytes**

The competition measurement is the final submitted ZIP, so the preview figure is the useful one.

## Browser notes

Dependency-free Canvas 2D, Web Audio, OKLCH with fallback colours, offscreen canvases, standard browser animation/input APIs, and `DecompressionStream` for the Pages loader.

No licence has been assigned yet.
