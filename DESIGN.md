---
name: Avi's front page
description: A personal site set as the front page of a broadsheet, where every article is a live picture that opens to full screen.
colors:
  ink: "#0a0a0b"
  panel: "#111113"
  bone: "#e6e4df"
  dim: "#8a8987"
  rule: "#2a2a2c"
  paper: "#f1efea"
  paper-panel: "#e8e6e0"
  paper-ink: "#17171a"
  paper-dim: "#52514d"
  paper-rule: "#c6c3bb"
  hub-violet: "#e36bff"
typography:
  masthead:
    fontFamily: "Instrument Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.4rem, 17.2cqw, 18rem)"
    fontWeight: 400
    lineHeight: 0.82
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Instrument Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(1rem, 27.9cqw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Instrument Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.5rem, 9cqw, 5rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.02em"
  stage-headline:
    fontFamily: "Instrument Serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.25rem, 7cqw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  dek:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10px"
    fontWeight: 300
    letterSpacing: "0.18em"
rounded:
  none: "0px"
spacing:
  gutter: "16px"
  label-gap: "6px"
  section-top: "16px"
  section-bottom: "40px"
components:
  article-section:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "16px 16px 12px"
  inline-link:
    textColor: "{colors.bone}"
  mono-link:
    textColor: "{colors.bone}"
    typography: "{typography.label}"
  mono-link-hover:
    textColor: "{colors.dim}"
  stage-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dim}"
    typography: "{typography.label}"
---

# Design System: Avi's front page

## Overview

**Creative North Star: "The Broadsheet of One"**

The site is set like the front page of a newspaper, with one person as the whole edition. A masthead carries the name at poster scale, and tiers of articles below it zig-zag the way a broadsheet does: the wide column swaps sides each tier. Every article is a picture rather than a block of text: a globe, a circuit board, a fractal. Clicking one grows it to fill the screen at its own address, and the newspaper's grid lines stretch out to the edges of the viewport around it. Esc folds it back into the page.

The material is newsprint in negative. It's one tone in four values, with hairline dashed rules instead of boxes, no radii and no shadows. The only real colours are the work itself: the globe's violet network hubs and the fractals' matplotlib palettes. Light and dark follow the reader's system until they pick one with the plain switch in the masthead, and the pick holds across visits. The globe stays tied to it: the switch bends the globe flat for light and round for dark, and bending the globe past halfway inside its window (open, or docked) flips the switch. On the page the globe only turns and opens; the wheel scrolls past it. Motion is mechanical rather than soft: hover rings switch on in hard steps like a fluorescent tube, labels type themselves in, and an optional synthesized sound layer clicks and hums.

**Key Characteristics:**
- Newspaper grid: masthead, tiers, dashed column rules, "Open ↗" under the globe, and no section kickers (Oct 22): headlines stand on their own.
- Headlines are fitted to their box in container units (`cqw`), so each word fills its column.
- Monochrome chrome: colour belongs only to the artwork.
- Live art everywhere: WebGL and animated ASCII fields stand in for photos.
- Hard-step motion and typed labels; reduced-motion collapses all of it.

## Colors

One tone, four values, mirrored for paper. The tokens keep their names in both themes (ink is always the page and bone always the text) and only swap ends.

### Primary
- **Bone** (#e6e4df, dark mode): every headline, body text, the active state of every mono label, and the hover ring. On paper it becomes **Paper Ink** (#17171a).

### Neutral
- **Ink** (#0a0a0b): the page in dark mode. **Paper** (#f1efea) in light mode: a warm newsprint rather than white.
- **Panel** (#111113 / Paper Panel #e8e6e0): wells set into the page. Used sparingly.
- **Dim** (#8a8987 / Paper Dim #52514d): labels, deks, captions, and inactive chapter entries. On paper it's tuned darker (6.9:1) because small type reads thinner on a light ground.
- **Rule** (#2a2a2c / Paper Rule #c6c3bb): every hairline, all of them dashed except the outer page border.
- **ASCII** (bone at 50% / paper ink at 68%) and **Stripe** (bone at 10%): the animated character fields and the hatch fill.

### Tertiary (art only)
- **Hub Violet** (#e36bff, approximately; computed in the shader): the globe's population hubs, the one accent the site owns. It deepens on paper.
- The fractal palettes (matplotlib and CMasher maps) belong to the artwork and are never used for UI.

### Named Rules
**The Colour Is the Work Rule.** UI chrome never takes a hue. Colour on screen should always come from an artwork.

**The Two Ends Rule.** A theme is the same four tokens swapped. Never add a light-only or dark-only token for chrome.

## Typography

**Display Font:** Instrument Serif (with Georgia)
**Body Font:** Newsreader with optical sizing (with Georgia)
**Label/Mono Font:** IBM Plex Mono Light 300

**Character:** A condensed, high-contrast newspaper display face for anything that's a title, a text serif designed for reading on screen for anything you actually read, and a hairline mono for all the furniture: labels, dates, controls.

### Hierarchy
- **Masthead** (400, fitted up to 18rem, line-height 0.82, uppercase, −0.03em): the name and nothing else.
- **Headline** (400, fitted up to 4.5rem on the rail or 8rem on the lead, line-height 0.86, uppercase, −0.02em): article names on the front page and chapter names on the stage.
- **Stage headline** (400, clamp 2.25–4.5rem, uppercase): the chapter name on an open article, which the front-page headline flies into.
- **Title** (400, clamp 2.5–5rem, line-height 0.9, sentence case): "Hi, I'm Avi."
- **Body** (Newsreader 1.125rem/1.6, at most 36rem wide): the About letter.
- **Dek** (Newsreader 0.95rem/1.5, dim, at most 30rem; italic in figure captions): one or two lines under a headline.
- **Label** (Plex Mono 300, 10px, uppercase, 0.18em tracking, dim): "Open ↗", the clock, the sound and light/dark switches, the footer links, stage bands and chapter indexes.

### Named Rules
**The Titles-Only Rule.** Instrument Serif is too tall to read in. It sets names and titles only, never a sentence of body text.

**The Fitted Headline Rule.** Size headlines with `fillSize()` against the nearest `.fit` container. Never pick a fixed px size per word.

## Layout

The page is a single well, `clamp(320px, 65.5vw, 1310px)` wide and centred, with a solid hairline down each side. Inside it, tiers stack top to bottom: the masthead; then the About letter (17fr) beside the globe (10fr), with only "Open ↗" under it; then the seam, a 96px band of isovalues in ink; then the work: equal tiles, two across on a desktop and one on a phone, every project the same anatomy (Oct 27). The letter's tier is a flex stack whose last item takes the slack, so its two columns end level; in the work, each tile pins its art to its foot, so a row's tiles end level too. The page ends in a footer bar, a dashed rule under LinkedIn and GitHub set right. All sections use a 16px horizontal gutter.

Below 768px everything drops to one column. In the work tier the lead goes first.

On the stage (an open article), the article's box is centred on the viewport. Its four edges extend as dashed rules to the screen edges, leaving bands: the kicker and "Esc — Back" above, the controls below (hidden under 640px), and nothing at the sides. A small framed globe docks in the bottom-left corner while another article is open.

## Elevation & Depth

None. The system is flat: no shadows and no tonal lifting. Depth comes from layering on the page instead: articles' art sits on document-level layers above the paper, the open stage covers the page with ink, and the receding newspaper is pushed away (`data-push`) instead of shaded.

**The Flat Newsprint Rule.** Nothing casts a shadow. Separation comes from a hairline or from space.

## Shapes

Square everything: zero radius anywhere. Containers are implied by dashed 1px rules, not drawn as boxes. The only solid boxes are the hover ring (a 1px bone border bled 1px over the dashed rules) and the docked globe's frame. The hatch (45° stripes) marks space that's held open.

## Components

### Project tile (front page)
- **Character:** a newspaper story whose picture is the point.
- **Structure:** "Open ↗" alone, set right, above the name (the number-and-stack line was removed Oct 27); the name in uppercase serif at clamp 2.4–4rem, the same in every tile; a dim line of copy; then the art at 4:3 across the foot, under a dashed rule. A new project is one more tile.
- **Open cue:** "Open ↗", dim, turning bone with the ring. Every opening thing carries it (the globe's under it), because phones have no hover to discover the ring with.
- **Interaction:** the whole section is a `role="link"`. Hover or keyboard focus flickers a solid bone ring on over its dashed rules, in hard steps over 0.3s. One click opens the article at its route.

### Stage chrome (an open article)
- The newspaper's grid grown to the viewport. Top band: the kicker on the left and "Esc — Back" on the right. Bottom band: how to work the art. The band text types itself in once everything has landed.

### Chapter index
- A mono ordered list ("00 Watch … 04 Face") at the top right of the art, with a 1×10px bone marker beside the active entry. Entries are clickable, and inactive ones are dim.

### Links
- **Inline (in prose):** a dashed 1px dim underline at 0.22em offset that turns solid bone on hover.
- **Mono (footer):** LinkedIn and GitHub, bone labels that dim on hover, set right in the footer bar.

### Hit areas
- 10px furniture that's tapped (Sound, Light/Dark, footer links, Back) gets a 44px-tall hit area from an empty `::after` (`HIT` in `furniture.ts`), so the type and the layout stay as they are.

### Touch words
- A touch screen gets its own instructions (`pointer: coarse`): "← Back" rather than "Esc — Back", and swipe/tap hints in the bottom band (`touch` in `articles.ts`), short enough to clear the docked globe.

### Light/dark switch
- Two mono words in the masthead, "Light" and "Dark". The current one is bone with a filled dot (●), the other dim with an open one (○). Each is a button with `aria-pressed` and a 44px hit area. Choosing one eases the globe to its end of the bend.

### Sound switch
- A mono "Sound — Off" label with a 10-cell ASCII level meter (`.:-=+*#%`) that reads the real audio output. Switching it on flickers the masthead.

### Isovalues (the seam)
- A drifting noise drawn as stacked, shaded terraces (`src/lib/iso/IsoField.tsx`, after FabriceNeyret2's "isovalues 3"). On the page it runs in **ink**: the ground with terraces lifting a little towards the text colour and a hairline on each isoline, following light and dark. A **spectrum** paint exists for a piece that wants colour. It stops drawing off screen and holds still for reduced motion.

### ASCII fields
- Animated character fields (lattice, crate, the fractal cover) drawn in the ASCII token; the seam field survives only in the link preview. They're decoration and spacers, never content, and are hidden from assistive tech.

## Do's and Don'ts

### Do:
- **Do** keep every label in Plex Mono 300 at 10px, uppercase with 0.18em tracking.
- **Don't** put a section kicker ("/About", "/Project — …") or a "Fig." number over the front page's headings; the owner removed them (Oct 22). The open articles' stage bands keep theirs.
- **Do** draw structure with 1px dashed `rule` hairlines; the outer page edges are the only solid rules.
- **Do** let artwork carry all of the colour: the globe's violet and the fractal palettes.
- **Do** give every opening thing both a click and a keyboard path, plus a visible focus state (the flicker ring).
- **Do** use hard-step (`step-end`) timing for state changes that should feel electrical, and respect `prefers-reduced-motion`.

### Don't:
- **Don't** round a corner or add a shadow.
- **Don't** set body copy in Instrument Serif.
- **Don't** add a UI accent colour. A hover is bone or dim, never a hue.
- **Don't** fade a hover ring in smoothly; it catches like a tube.
