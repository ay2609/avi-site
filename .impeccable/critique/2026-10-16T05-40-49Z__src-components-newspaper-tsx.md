---
target: front page /
total_score: 17
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ay2609/workspaces/avi-site/src/components/Newspaper.tsx"
target_fingerprint: "sha256:7c48889d09bf4c7adae25724a567be8036390faaefa5ddadca7ca46171c2a3d1"
target_path: /Users/ay2609/workspaces/avi-site/src/components/Newspaper.tsx
timestamp: 2026-10-16T05-40-49Z
slug: src-components-newspaper-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Front page `/`

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The globe's bend flips the whole site's theme, with no warning, and the flip persists |
| 2 | Match system / real world | 3 | The newspaper metaphor reads at once; the placeholder "spots" look like content |
| 3 | User control and freedom | 2 | The globe captures the wheel (desktop) and touch (phone), so a reader trying to scroll gets stuck |
| 4 | Consistency and standards | 3 | Work order: Watch then Fractals on desktop, Fractals then Watch on phone and in tab order |
| 5 | Error prevention | 1 | A normal scroll over the globe becomes a persistent theme change |
| 6 | Recognition rather than recall | 2 | Only Watch says "Open it"; there's no open cue for Fractals or the globe, and phones have no hover ring |
| 7 | Flexibility and efficiency | n/a | Portfolio |
| 8 | Aesthetic and minimalist design | 2 | About 600px (desktop) / 640px (phone) of unlabelled ASCII placeholders |
| 9 | Error recovery | 2 | The 404 is the default Next page, with no link home |
| 10 | Help and documentation | n/a | Portfolio |
| **Total** | | **17/32** | **Acceptable** |

Design specificity: authored, not interchangeable (broadsheet grid, fitted serif headlines, path kickers, Fig. 1, ASCII seam). The weakness is the interaction language: every instruction is in the faintest 10px label style, and key behaviours (articles open, the globe takes the wheel) go unsaid.

Detector: 20 findings on desktop and 19 on phone; contrast passes at AA in both themes. Real findings:
- undersized-ui-text on the interactive 10px labels (Sound, LinkedIn, GitHub)
- tap targets 15px tall

False positives, all part of the world's identity or ASCII art:
- eyebrow/kicker (the newspaper dateline and kickers)
- gradient-text (the per-glyph ASCII colour clip)
- tight-leading (aria-hidden ASCII `<pre>` blocks)
- cramped-padding on the seam strip

### Priority issues
- **[P1] Globe scroll/touch trap with an accidental persistent theme flip.**
  - Desktop: with the cursor on the globe the wheel bends it and the page scrolls 0px, even mid-scroll when the globe slides under a still cursor.
  - Phone: the 318px canvas has touch-action none.
  - Fix: let a scroll already under way pass through, hand the wheel back to the page at the bend's limits, and use touch-action pan-y on the page canvas. (/impeccable harden)
- **[P1] Nothing tells a visitor that the articles open.** Fix: give every article the same quiet "Open" cue in its label row, globe included. (/impeccable clarify)
- **[P2] The "spots held open" cost most of a screen and read as dead articles.** Fix: cut them. (/impeccable distill)
- **[P2] Work order changes by breakpoint and in focus order.** Fix: put Watch first in the DOM and drop the `order` swap. (/impeccable layout)
- **[P3] Contact links and the Sound toggle are 15px-tall targets.** Fix: enlarge the hit areas without changing the type. (/impeccable adapt)

### Persona red flags
- **Jordan, first-timer:** scrolls over the globe and gets stuck, then the page turns white. Sees FRACTALS with no hint that it opens.
- **Casey, mobile:** a swipe that starts on the globe turns it instead of scrolling. 640px of ASCII sits before the email.
- **Recruiter:** the hardware proof is one unadvertised click away.

### Minor
- The globe figure and Contact have no headings.
- Space-to-pause takes the spacebar while the globe is hovered.
- The 404 is off-brand.
