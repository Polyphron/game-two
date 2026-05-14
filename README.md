# Game Two

Recovery-first rebuild of the old Null Range demo base as a clean Vite/Three.js game.

The first slice focuses on:

- procedural terrain with shared CPU sampling
- particle/dot terrain and topographic contour rendering
- starfield and bright celestial backdrop
- radar-hunt sector structure with separated enemy clusters
- tests for terrain sampling, sector generation, and visual contour geometry

## Commands

```powershell
npm install
npm run dev
npm test
npm run build
```

## References

- Live visual/behavioral reference: https://nullrange.com/
- Terrain repro reference: https://github.com/taylorallenux/study-particle-landscape
- Local design notes: `docs/superpowers/specs/2026-05-14-game-two-recovery-design.md`
