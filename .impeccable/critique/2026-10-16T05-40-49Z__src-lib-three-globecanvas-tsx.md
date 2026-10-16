---
target: globe stage /globe
total_score: 24
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:/Users/ay2609/workspaces/avi-site/src/lib/three/GlobeCanvas.tsx"
target_fingerprint: "sha256:b8cb5a3e55ae9b3640ef7ea602f91a61820c7410426cc2ca09674dee3beb9576"
target_path: /Users/ay2609/workspaces/avi-site/src/lib/three/GlobeCanvas.tsx
timestamp: 2026-10-16T05-40-49Z
slug: src-lib-three-globecanvas-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Globe stage `/globe`

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No hint of the halfway point that flips the site's theme |
| 2 | Match system / real world | 2 | No headline, and the network is never named |
| 3 | User control and freedom | 3 | Esc, browser back and a real URL all work |
| 4 | Consistency and standards | 3 | The only article without a flown headline |
| 5 | Error prevention | 2 | "Scroll to bend" doesn't warn that the change is site-wide and saved |
| 6 | Recognition rather than recall | 3 | The controls band lists every gesture |
| 7 | Flexibility and efficiency | 3 | Drag, scroll, Space and Esc |
| 8 | Aesthetic and minimalist design | 3 | Clean |
| 9 | Error recovery | 3 | Bending back undoes the flip |
| 10 | Help and documentation | n/a | Portfolio |
| **Total** | | **24/36** | **Acceptable** |

### Priority issues
- **[P1] No headline or caption on the stage.** The device network (relevant to IoT work) is never named. (/impeccable clarify)
- **[P2] The theme flip is a surprise.** The controls string should state the consequence in the caption's own words. (/impeccable clarify)
- **[P2] Phone: no instructions, and the exit says "Esc — Back" on a device with no Esc key; it's a 78×15 target.** (/impeccable adapt)
- **[P3] Phone composition.** About 230px is empty below the box. (/impeccable layout)

Detector: 4–5 findings, all ASCII/dateline false positives.
