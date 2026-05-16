---
name: CrossBeam
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4fdbc8'
  on-secondary: '#003731'
  secondary-container: '#04b4a2'
  on-secondary-container: '#003f38'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-mono:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style
The design system for this product is built on a "Technical Glassmorphism" aesthetic. It targets users who prioritize privacy and performance in local file sharing. The visual narrative avoids typical "cloud" metaphors, focusing instead on the physics of local transmission: beams, pulses, and refractive surfaces.

The style combines high-fidelity glass effects with a structured, professional layout. It evokes a sense of "digital hardware"—tools that feel tangible, heavy, and precise.

**Design Principles:**
- **Refractive Depth:** Use layered translucency to indicate hierarchy.
- **Precision Utility:** Every element must look engineered; no unnecessary flourishes.
- **Obsidian Dark:** The primary experience is dark-first, utilizing deep neutrals to allow primary accents to "glow" like physical LEDs.

## Colors
The palette is anchored in **Deep Slate** and **Obsidian** tones to ensure the UI feels grounded and technical rather than "gamified." 

- **Primary (Indigo-Violet):** Reserved for active states, transmission progress, and "the beam." It should feel like a high-energy light source.
- **Success (Teal):** Used for completed transfers and secure connection statuses.
- **Surface Strategy:** In Dark Mode, use `#020617` as the base. Layers are built using increasing opacities of white or primary-tinted overlays rather than lighter solid grays. 
- **Light Mode:** When in Light Mode, the primary remains consistent, but the background shifts to a cool, clinical light gray (`#F8FAFC`) with high-contrast glass (frosted white).

## Typography
The typography system uses **Hanken Grotesk** for its sharp, contemporary geometry and exceptional legibility across screen sizes. To reinforce the technical nature of the app, **Geist** is used for labels, metadata, and file paths.

**Usage Guidelines:**
- **Headlines:** Use `display-lg` for connection status screens and empty states.
- **Labels:** Always use the monospaced `label-mono` for file sizes, IP addresses, and transfer speeds to ensure character alignment in dynamic data.
- **Hierarchy:** Use font weight rather than color to distinguish importance, maintaining high contrast for accessibility in dark environments.

## Layout & Spacing
The system utilizes a **4px baseline grid** for granular control. 

**Mobile Layout:** 
- Uses a fluid 4-column grid.
- Margins are fixed at 20px. 
- Navigation is pinned to a bottom tab bar with glass effects.

**TV & Desktop Layout:**
- Uses a 12-column grid.
- Sidebar navigation (width: 280px) is mandatory for TV. 
- Elements must have a 48px minimum hit target for remote-based navigation.
- Focus states must be clearly visible via a primary-colored 2px outer glow.

## Elevation & Depth
Depth is achieved through **Tonal Stacking** and **Backdrop Filtering** rather than traditional drop shadows.

- **Level 0 (Base):** Solid `#020617`.
- **Level 1 (Cards):** Background blur (20px) + 1px border (`rgba(255,255,255, 0.1)`).
- **Level 2 (Modals/Popovers):** Background blur (40px) + 1px border (`rgba(255,255,255, 0.2)`) + subtle primary-tinted outer glow.
- **The "Beam" Effect:** For active transfers, use a linear gradient border that "rotates" or "pulses" around the card to indicate activity without distracting motion.

## Shapes
The shape language is "Soft-Technical." Elements are rounded enough to feel premium and approachable, but not "bubbly."

- **Standard Containers:** 0.5rem (8px) radius.
- **Large Sections/Cards:** 1rem (16px) radius.
- **Interactive Elements (Buttons):** 0.5rem (8px) radius to maintain a structural, modular look.
- **Avatars/Device Icons:** 1.5rem (24px) or fully circular to distinguish "entities" from "containers."

## Components

### Buttons
- **Primary:** Solid Primary color with white text. High-contrast hover state (slight brighten).
- **Secondary (Glass):** Semi-transparent white fill (10%) with a 1px border. 
- **Destructive:** Soft red (`#FB7185`) text and border; no solid fill unless hovered.

### Glass Cards
- All cards must use `backdrop-filter: blur(20px)`.
- Borders should be top-heavy (gradient from `rgba(255,255,255,0.15)` to `rgba(255,255,255,0.05)`) to simulate a light source from above.

### Transfer List
- Items should use `label-mono` for the file size and transfer percentage.
- Progress bars are thin (4px) and use a subtle "scanning" glow effect within the primary color fill.

### Radar/Discovery
- Use concentric circular outlines with decreasing opacity. 
- Active devices appear as high-contrast nodes with a 1px Primary glow.

### Input Fields
- Dark-filled (`rgba(0,0,0,0.2)`) with a 1px border that turns Primary on focus. 
- Use Geist Mono for technical inputs like IP addresses or port numbers.