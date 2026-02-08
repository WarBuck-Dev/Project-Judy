# Project Judy - Visual Style Updates

## Overview
Updated the simulator's visual design to match a premium military-grade radar interface aesthetic with clean tactical display, refined typography, and polished UI elements.

## Version 2.0 Updates (January 2026)

### Major Visual Changes
- ❌ Removed radial gradient background for cleaner display
- ✅ Solid black background (#000000) for better contrast
- ✅ Fixed mission time box width (210px) to prevent layout shifts
- ✅ Added visual selection indicators (dashed rings) for bullseye and assets
- ✅ White radar return dots (4px, 70% opacity) with adjustable decay
- ✅ MIL-STD-2525 symbology (top-half air tracks)
- ✅ Ownship asset with gray circle + crosshair symbol
- ✅ Rotating radar sweep (40° trail, 60-segment gradient)

## Key Visual Improvements

### 1. **Radar Display**
- ✅ Solid black background for optimal contrast
- 🌟 Applied glow filter to SVG elements
- 📐 Reduced grid opacity to 8% for more subtle appearance
- 📏 Increased grid spacing from 50px to 60px
- ✨ White fading radar returns beneath tracks (sweep-based generation)
- 🎯 Dashed selection rings for selected objects
- ⚡ Rotating radar sweep emanating from ownship
  - 10-second full rotation (36°/second)
  - 320 NM maximum range
  - 40-degree sweep trail
  - 60-segment ultra-smooth gradient fade
  - 1px leading edge indicator line
  - User-adjustable opacity (0-100%)
- 🗺️ High-resolution Persian Gulf map
  - Detailed coastline with hundreds of coordinate points from KML source
  - 10 major islands rendered (Bahrain, Qeshm, Abu Musa, and more)
  - Outline-only rendering (#808080, 1.5px stroke, 50% opacity)
  - Matches coastline style for visual consistency
  - Accurate geographic representation for tactical training

### 2. **Glowing Effects**
All UI elements now feature layered glow effects:
- **Text shadows**: Multiple layers for depth (0-30px glow radius)
- **Box shadows**: Outer glow + inner glow for depth
- **Border shadows**: Enhanced with RGBA green/yellow glows
- **Hover states**: Intensified glows on interaction

### 3. **Control Panel**
- 🎨 Gradient background (black to dark green)
- 💡 Left border increased to 3px with shadow
- 📦 Section boxes now have rounded corners (4px radius)
- ✨ Background tint for depth (rgba green overlay)
- 🔤 Increased title size to 26px with intense glow
- 📏 Increased width from 320px to 380px
- 🔧 SYSTEMS section added under PLAYBACK controls for organized access

### 4. **Buttons & Controls**
- 🎯 All buttons now have rounded corners (4px)
- 💫 Enhanced glow effects on hover
- 🎬 Smooth transitions (0.3s)
- 📈 Subtle lift animation on hover (translateY -2px)
- 🔤 Increased letter spacing for military aesthetic
- 📦 Inner and outer box shadows
- 🔴 Radar OFF button turns red when disabled for clear status indication

### 5. **Position Display Boxes**
- 📐 Increased from 120px to 140px min-width
- 🎨 Enhanced border radius (4px)
- 💡 Stronger glow effects (15px radius)
- 🔤 Larger value font (14px, bold, letter-spaced)
- ✨ Text shadow on values for glow effect
- 📏 Increased padding for breathing room
- 🎯 Dynamic labels showing custom bullseye names

### 6. **Status Indicators**
- 🎯 Rounded corners (4px)
- 💡 Dynamic glow based on state:
  - Running: Green glow
  - Paused: Yellow glow
- 🔤 Increased letter spacing (2px)
- 📦 Enhanced box shadows
- ⏱️ Fixed-width mission time display (210px) prevents layout shifts

### 7. **Asset List**
- 🎨 Semi-transparent black background
- 📐 Rounded corners on items (3px)
- 💫 Glow effect on hover
- ✨ Selected items have intense glow
- 🎯 Smooth slide animation on hover (translateX 3px)
- 🔤 Enhanced text shadows on asset names

### 8. **Input Fields**
- 🎨 Dark semi-transparent backgrounds
- 💡 Inner glow effect (inset shadow)
- ✨ Intense glow on focus with background tint
- 🔤 Increased font size to 11px
- 📦 Rounded corners (3px)
- 📏 Increased padding to 10px

### 9. **Context Menus**
- 💫 Strong outer and inner glow
- 📐 Rounded corners (4px)
- 🎯 Slide animation on hover (translateX 3px)
- ✨ Text glow on hover
- 🎨 Enhanced hover background brightness

### 10. **Modal Dialogs**
- 🎨 Gradient background (diagonal black to dark green)
- 🌫️ Backdrop blur effect (5px)
- 💡 Very strong glow (40px outer, 20px inner)
- 📐 Rounded corners (8px)
- 🔤 Enhanced title glow effects

### 11. **Pause Menu**
- 🎨 Same gradient as modals
- 💡 Strongest glow effect (50px outer, 25px inner)
- 📐 Rounded corners (8px)
- 📏 Increased padding and min-width

### 12. **Scrollbars**
- 🎨 Gradient thumb (green to darker green)
- 💡 Glow effect on scrollbar thumb
- 📐 Rounded corners (5px)
- ✨ Enhanced glow on hover

## Color Palette

### Primary Colors
- **Primary Green**: #00FF00 (Bright radar green)
- **Dark Green**: #001a00 (Background tint)
- **Semi-Green**: rgba(0, 20, 0, 0.3-0.6) (Overlays)

### Accent Colors
- **Yellow**: #FFFF00 (Secondary marks, paused state)
- **Red**: #FF0000 (Hostile assets, danger buttons, recording)
- **Light Blue**: #00BFFF (Friendly assets)
- **Orange**: #FFA500 (Unknown unevaluated)

### Effects
- **Glow Green**: rgba(0, 255, 0, 0.3-0.7)
- **Glow Yellow**: rgba(255, 255, 0, 0.3-0.5)
- **Glow Red**: rgba(255, 0, 0, 0.3-0.6)

## Typography

### Font Settings
- **Family**: Orbitron (monospace, military aesthetic)
- **Letter Spacing**: 1.5px - 4px (varies by element)
- **Text Shadows**: Multi-layer glows (0-30px)

### Size Hierarchy
- **Main Title**: 26px
- **Modal Titles**: 20-24px
- **Section Headers**: 11px
- **Body Text**: 10-11px
- **Small Labels**: 8-9px

## Animation & Transitions

### Timing
- **Standard**: 0.3s ease
- **Quick**: 0.2s ease

### Effects
- **Hover lift**: translateY(-2px)
- **Hover slide**: translateX(3px)
- **Glow intensify**: Increased shadow radius
- **Background brighten**: Increased RGBA alpha

### Pulsing Animation
- **Recording button**: 1s infinite pulse (opacity 1 → 0.6 → 1)

## Best Practices Applied

1. **Layered Depth**: Multiple box-shadow layers create 3D depth
2. **Consistent Rounding**: 3-8px radius throughout (smaller for small elements)
3. **Glow Intensity Hierarchy**: Most important elements glow brightest
4. **Responsive Feedback**: All interactive elements respond to hover/focus
5. **Color Coding**: Asset types maintain distinct color identities
6. **Accessibility**: High contrast maintained (green on black)
7. **Visual Cohesion**: Consistent spacing, borders, and effects

## Performance Considerations

- Glow effects use CSS box-shadow (GPU accelerated)
- Transitions are hardware-accelerated (transform, opacity)
- No heavy image assets, all vector/CSS based
- Efficient re-renders with React optimization

---

**Result**: A polished, professional military radar interface with premium visual effects that enhance usability while maintaining the tactical aesthetic.
