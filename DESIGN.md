---
name: Etnias — Casa Opy
description: Shared navigation and composer extension for the existing Etnias social application.
colors:
  opy-red: "#bd171c"
  opy-red-hover: "#991116"
  opy-ink: "#182c34"
  opy-muted: "#52656c"
  opy-paper: "#ffffff"
  opy-ground: "#f5f5f1"
  opy-line: "#dde2df"
  opy-focus: "#176b87"
  active-wash: "#fbefec"
  control-hover: "#f1f3f0"
  navigation-hover: "#e9eeea"
  field-surface: "#f7f8f6"
  field-border: "#c4cdca"
typography:
  headline:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.5vw, 32px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  body-small:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  navigation:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.4
  label:
    fontFamily: "Krub, Roboto, system-ui, sans-serif"
    fontSize: "13px"
rounded:
  control: "8px"
  navigation: "7px"
  panel: "16px"
  circle: "50%"
spacing:
  compact: "8px"
  control: "12px"
  regular: "16px"
  section: "24px"
  panel: "28px"
components:
  button-primary:
    backgroundColor: "{colors.opy-red}"
    textColor: "{colors.opy-paper}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.opy-red-hover}"
    textColor: "{colors.opy-paper}"
  button-more:
    backgroundColor: "{colors.opy-paper}"
    textColor: "{colors.opy-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.navigation}"
    padding: "8px 14px"
  button-menu:
    backgroundColor: "{colors.active-wash}"
    textColor: "{colors.opy-red}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  search:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.opy-ink}"
    rounded: "{rounded.control}"
  navigation-item:
    textColor: "{colors.opy-ink}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "10px 12px"
  navigation-item-active:
    backgroundColor: "{colors.opy-red}"
    textColor: "{colors.opy-paper}"
  dialog:
    backgroundColor: "{colors.opy-paper}"
    textColor: "{colors.opy-ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
    width: "min(520px, calc(100% - 32px))"
  bottom-navigation:
    backgroundColor: "{colors.opy-paper}"
    textColor: "{colors.opy-ink}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
    width: "440px"
---

# Design System: Etnias — Casa Opy

## Overview

**Creative North Star: "Casa Opy"**

Casa Opy organizes an existing community application through the supplied Etnias identity: red emphasis, light surfaces and readable navigation. The material is a practical social interface with compact controls, modest corners and a clear hierarchy. It represents a living, contemporary community without adding unverified cultural ornament.

This record covers the shared Opy layer in `public_html/assets/opy/opy.css`, `opy.js`, `bootstrap.php` and `views/*.php`, as integrated into Sunshine and WoWonder. It does not establish a replacement identity or a system for vendor feed cards, stories, avatars, advertisements, publisher widget interiors or dropdown contents. Those retain theme rules except for the explicit Opy overrides described here. The brand image is the optimized existing Sunshine logo; no new authorship or cultural provenance is asserted.

**Key Characteristics:**
- Red actions and current destinations against light neutral surfaces.
- Readable labels paired with simple outline SVG icons.
- Shared navigation with native dialogs and preserved social components.
- Responsive density and explicit keyboard focus.

## Colors

The palette combines an Etnias red accent with cool dark text and lightly warm page ground. Frontmatter records the source values; these names describe their application.

### Primary
- **Opy Red** (`opy-red`): primary buttons, current sidebar destination, menu emphasis, support link and central creation icon.
- **Opy Red Hover** (`opy-red-hover`): primary action hover state.
- **Active Wash** (`active-wash`): menu surface and current bottom destination.

### Neutral
- **Ink** (`opy-ink`): shared navigation, headings and controls.
- **Muted Ink** (`opy-muted`): secondary copy, search prompt and supporting labels.
- **Paper** (`opy-paper`): header, bottom navigation and dialogs.
- **Ground** (`opy-ground`): application background within the enabled layer.
- **Line** (`opy-line`): separators and quiet surface boundaries.
- **Control Hover / Navigation Hover**: tonal feedback on their respective control families.
- **Field Surface / Field Border**: inset search and secondary control separation.

Focus blue (`opy-focus`) is an interaction indicator, not a second brand accent. The sidecar’s generated tonal ramps are preview metadata only; they do not extend the implemented palette. One-off pending dots and availability status colors remain local implementation details rather than a semantic status palette.

**The Contextual Current Rule.** Current sidebar destinations use red fill and white text; current bottom destinations use the pale wash and red text. Preserve this distinction between navigation contexts.

## Typography

**Body and heading family:** Krub, then Roboto, system-ui and sans-serif. The Opy layer declares this stack and inherits theme font loading; it introduces no separate display face. No system display font is prescribed for future surfaces.

### Hierarchy
- **Headline:** feed heading, using the frontmatter fluid role; at the mobile breakpoint it becomes (26px).
- **Title:** dialog title, using the title role; mobile uses (22px).
- **Body:** composer text (16px, line-height 1.6); informational dialog prose uses the same size with a more open line-height (1.75).
- **Body small:** feed introduction (14px, line-height 1.6), reducing to (13px) on mobile.
- **Navigation:** sidebar labels (14px, line-height 1.4); active text is semibold (600).
- **Label:** secondary action and header labels (13px). Bottom labels are compact (11px desktop, 10px mobile), paired with icons; these sizes are local to this navigation, not a general body-text scale.

Inherited theme font weights are not normalized by this record. The CSS requests heading weight (650); the theme's available font faces determine its rendered interpolation or fallback.

## Layout

The shared topbar is fixed. Its centered inner region has a maximum width (1500px), minimum height (80px), horizontal padding (28px) and a principal gap (20px). The logo is contained without cropping. Content is spaced beneath it by the theme header reservation and Opy content padding.

At widths of at least (1200px), the home container is capped at (1440px), with (28px) side padding and columns (19% / 56% / 25%). From (992px) through (1199px), the side navigation and feed use (24% / 76%); the right rail is hidden. Below (992px), the feed fills the available width and the desktop side navigation disappears. The complete menu remains accessible through its drawer.

At (700px) and below, the header wraps into two rows, the logo reduces to (100px), visible utility labels collapse while accessible names remain, and content uses (12px) outer padding. The persistent bottom navigation becomes full width, square edged, bottom aligned and safe-area aware. Desktop bottom navigation is centered (440px wide, 16px from the bottom); on mobile it fills the width. The restored five actions are Feed, Mercado, Postagem, Saberes and EtnIA. Body bottom clearance reserves space for this bar; the bar hides when the visual viewport indicates a software keyboard. Opy, Interatividade, Chat and Maracá remain in the header.

Spacing is compact and functional: (8px) control gaps, (12px) interior spacing, (16px) ordinary separation and (24px / 28px) section or dialog padding. These are observed recurring values, not a uniform mathematical grid imposed on vendor content.

## Elevation & Depth

Most shared surfaces use borders and tonal separation. Diffuse shadows distinguish fixed bottom navigation and modal layers; they are intentional parts of this operational interface.

### Shadow Vocabulary
- **Floating bottom bar:** `0 6px 28px #182c3424`.
- **Mobile bottom bar:** `0 -4px 20px #182c3414`.
- **Dialog:** `0 12px 60px #142a3433`, with backdrop `#132b3c80`.

The header stays flat with a single bottom border. Both fixed navigation surfaces use stacking level (1035); native modal dialogs occupy the browser's top layer.

## Shapes

Controls and search have gently rounded corners using the control radius. Sidebar rows and the secondary composer action use the smaller navigation radius. Dialogs use the panel radius; the drawer retains this rounding only on its right corners. Circles identify avatars, the feed exploration control and the raised creation icon. Small circular pending markers signal explanatory destinations and are not decorative motifs.

## Components

### Buttons

Primary acknowledgement buttons use red fill, white text, semibold weight (600), control corners and at least (44px) height. Hover deepens the red. The menu button uses the pale active wash. The secondary composer action is a bordered paper control with at least (44px) height; it retains its static surface on hover because the source defines no separate hover fill. Shared focus is an outline (3px) in focus blue with an offset (3px).

### Inputs / Fields

Search is an inset, bordered horizontal group with an accessible label, flexible input and icon submit button. The input uses readable text (14px); mobile reduces its height from (46px) to (42px). The source does not establish a general error or disabled field treatment.

### Navigation

Sidebar rows pair labels with outline SVGs (22px, stroke 1.7) and use a compact minimum row height (42px). Hover applies a neutral wash. Permission-aware links remain links; unavailable destinations are buttons that open an explanation. The small pending dot is accompanied by explanatory text in the availability dialog.

The sidebar presents the complete community navigation and a direct Salvos destination. The five persistent bottom actions pair visible labels with SVGs. Their rows have minimum height (56px), and the center creation icon rises above the bar. The complete menu is reused in a left drawer rather than duplicated into a separate mobile information architecture.

**The Labelled Icon Rule.** Use SVG icons with visible labels where space permits and accessible names when labels collapse; decorative SVGs are hidden from assistive technology.

### Dialogs / Containers

Native dialogs use paper, ink, panel corners, bounded viewport height and a maximum normal width from the dialog token. Desktop padding reduces to (22px) on mobile. The left drawer is bounded to (370px) or the available viewport minus (24px), spans the dynamic viewport height and uses (24px) padding. Close controls are (44px) square.

Opening a dialog records its trigger; closing, including Escape, restores focus to that trigger. Arrival motion moves up from (8px) over (180ms) with `cubic-bezier(.16, 1, .3, 1)` only when reduced motion is not requested. No generic card or chip component is introduced by this layer.

### Composer extension

The existing composer remains the publishing surface. Opy supplies a readable prompt and an accessible More/Less options toggle; secondary controls stay in the original form. The Postagem shortcut focuses the existing text area without replacing the draft. On mobile the shared overrides provide (16px) text, a (112px) minimum input area and a named-composer variant (156px) with (58px) top padding, keeping the name clear of the writing area. Wrapping action rows and (44px) action controls accommodate narrow widths. These are adapter constraints rather than a new universal input component.

## Do's and Don'ts

### Do:
- **Do** preserve the Etnias logo, red emphasis and light surfaces when extending the shared layer.
- **Do** retain labelled SVG controls, visible focus and native dialog focus restoration.
- **Do** reuse the contextual current states and the responsive navigation rules.
- **Do** preserve vendor component behavior and drafts while applying explicit shared overrides.

### Don't:
- **Don't** infer cultural provenance or introduce uncontextualized Indigenous ornament from a conceptual reference.
- **Don't** treat vendor feed, story, avatar or widget styling as shared Opy design tokens.
- **Don't** present an unavailable destination as an operational service or replace its explanation with invented content.
- **Don't** generalize compact bottom-navigation label sizes to reading text.

## Functional homologation extension — 4 November 2026

The separate Vercel environment preserves the shared palette and Krub. Its local preview styles use 15px reading text, 12px feed panels and 16px composer text; these do not redefine vendor theme tokens. Six labelled composer actions provide photo/video, audio, PDF, emojis, feeling and polls. Public archival posts retain authorship and dates; new interactions persist between visitor sessions. Scope and verification are recorded in [previa-vercel.md](docs/previa-vercel.md).

The user preferred the preceding navigation arrangement; it was restored after the first UX iteration while retaining the functional composer and public archive. Author photos available in the archive now use circular 42px images with initial fallback.
