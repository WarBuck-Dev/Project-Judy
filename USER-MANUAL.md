# AIC Simulator User Manual

**Version 3.2** | For AIC Trainees

---

## Table of Contents

1. [Introduction & Getting Started](#1-introduction--getting-started)
2. [Interface Overview](#2-interface-overview)
3. [Basic Controls](#3-basic-controls)
4. [Working with Assets](#4-working-with-assets)
5. [Navigation & Waypoints](#5-navigation--waypoints)
6. [Geo-Points & Shapes](#6-geo-points--shapes)
7. [Sensor Systems](#7-sensor-systems)
8. [Simulator Modes](#8-simulator-modes)
9. [Voice Commands](#9-voice-commands)
10. [Save/Load & Recording](#10-saveload--recording)
11. [Behaviors (Instructor Mode)](#11-behaviors-instructor-mode)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference](#13-quick-reference)

---

## 1. Introduction & Getting Started

### What is the AIC Simulator?

The AIC Simulator is a web-based tactical training application for practicing Air Intercept Control procedures. It provides:

- Realistic radar display with rotating sweep and return generation
- Voice-activated fighter control with automated responses
- Complete intercept flow simulation (broadcast → commit → engagement → reset)
- Multiple sensor systems (RADAR, ESM, IFF, DATALINK, EO/IR, ISAR, SONO, WEAPON)
- Instructor and Student training modes
- Scenario building and saving capabilities

### System Requirements

| Requirement | Specification |
|-------------|---------------|
| **Browser** | Chrome 90+ or Edge 90+ (required for voice commands) |
| **Display** | 1920x1080 or higher recommended |
| **RAM** | 4 GB minimum, 8 GB recommended |
| **Server** | Python 3.x OR Node.js (for local file serving) |
| **Microphone** | Required for voice commands (Student mode) |

### Quick Start

**Method 1: Start Server Script (Recommended)**

1. Double-click `start-server.bat` in the AIC Simulator v2 folder
2. The simulator opens automatically in your default browser
3. Select **Instructor** or **Student** mode
4. Click **PLAY** to start the simulation

**Method 2: Manual Server**

1. Open Command Prompt in the simulator folder
2. Run: `python -m http.server 8000`
3. Open browser to: `http://localhost:8000`

> **Note**: A local server is required because browsers block loading local JavaScript files for security (CORS policy).

### Selecting Your Mode

Before the simulation starts, you must choose a mode:

| Mode | Purpose |
|------|---------|
| **Instructor** | Full control - create scenarios, manage all assets, configure behaviors |
| **Student** | Training mode - realistic radar operator experience with voice commands |

The mode selection is locked once you click PLAY.

---

## 2. Interface Overview

### Main Display Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [REC] [● RUNNING]                              [Scale: 60 NM]   │  ← Top HUD
├───────────────────────────────────────┬─────────────────────────┤
│                                       │  MODE: INSTRUCTOR       │
│                                       │  ─────────────────────  │
│                                       │  [PLAY] [RESTART]       │
│                                       │  ─────────────────────  │
│         RADAR DISPLAY                 │  SYSTEMS                │
│                                       │  [RADAR][ESM][IFF]...   │
│            (Map Area)                 │  ─────────────────────  │
│                                       │  SELECTED ASSET         │
│                                       │  Name: ___________      │
│                                       │  Identity: [Friendly]   │
│                                       │  ...                    │
├───────────────────────────────────────┴─────────────────────────┤
│ [FROM BE: 045/30]  [FROM MARK: 090/15]           [00:05:32]     │  ← Bottom HUD
└─────────────────────────────────────────────────────────────────┘
```

### Control Panel Sections

| Section | Description |
|---------|-------------|
| **Mode Display** | Shows current mode (Instructor/Student) |
| **Playback Controls** | PLAY/PAUSE and RESTART buttons |
| **Systems Tabs** | RADAR, ESM, IFF, DATALINK, EO/IR, ISAR, SONO, WEAPON |
| **Selected Asset/Track** | Properties of currently selected item |
| **Asset List** | All assets in the scenario (Instructor mode) |

### HUD Elements

| Element | Location | Description |
|---------|----------|-------------|
| **Record Button** | Top-left | Start/stop session recording |
| **Status Indicator** | Top-left | ● RUNNING (green) or ○ PAUSED (red) |
| **Scale** | Top-right | Current zoom level (5-360 NM) |
| **Mission Time** | Bottom-right | Elapsed time (HH:MM:SS) |
| **FROM BE** | Bottom-left (green) | Cursor bearing/range from Bullseye |
| **FROM [object]** | Bottom-left (yellow) | Cursor bearing/range from selected item |

### Color Coding System

**Asset/Track Identity Colors:**

| Identity | Color | Usage |
|----------|-------|-------|
| **Friendly** | Light Blue (#00BFFF) | Allied forces |
| **Hostile** | Red (#FF0000) | Enemy forces |
| **Neutral** | Green (#00FF00) | Non-combatants |
| **Unknown** | Yellow (#FFFF00) | Identified, under evaluation |
| **Unknown Unevaluated** | Orange (#FFA500) | Not yet evaluated |

**System Indicators:**

| Color | Meaning |
|-------|---------|
| **Red tab** | System OFF |
| **Yellow tab** | System ON, not ready/safe |
| **Green tab** | System ON and ready/armed |

---

## 3. Basic Controls

### Mouse Controls

| Action | Result |
|--------|--------|
| **Left-click on asset** | Select asset for editing |
| **Left-click on track** | Select student track (Student mode) |
| **Left-click on geo-point** | Select geo-point for editing |
| **Left-click on shape** | Select shape for editing |
| **Left-click on bullseye** | Customize bullseye name |
| **Left-click on empty space** | Place temporary reference mark |
| **Right-click anywhere** | Open context menu |
| **Click + Drag on map** | Pan the view |
| **Mouse wheel** | Zoom in/out (5-360 NM) |
| **Drag selected asset** | Reposition asset |
| **Drag waypoint marker** | Reposition waypoint |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **ESC** | Open pause menu (save/load, settings, mission products) |
| **Enter** | Apply typed values (heading, speed, altitude, coordinates) |
| **Spacebar (hold)** | Push-to-talk for voice commands (Student mode only) |

### Context Menu Options

**Right-click on empty space:**
- Create Asset → [Domain] → [Platform]
- Create Geo-Point → [Type]
- Create Shape → [Type]
- Create Operator Track (Student mode)

**Right-click on asset:**
- Go To (first waypoint)
- Add Waypoint
- Orbit
- Clear All Waypoints
- Engage With (Student mode, friendly only)

**Right-click on waypoint:**
- Delete Waypoint
- Wrap Waypoint / Unwrap Waypoint

---

## 4. Working with Assets

### Creating Assets

**Method 1: Add Asset Button**
1. Click **+ ADD ASSET** in the control panel
2. Enter asset name
3. Select identity (Friendly, Hostile, etc.)
4. Select domain (Air, Surface, Sub-Surface)
5. Set initial heading, speed, altitude
6. Click **CREATE**

**Method 2: Right-Click on Map**
1. Right-click at desired location
2. Select **Create Asset** → **[Domain]**
3. Choose platform from dialog (or "None - Generic")
4. Asset appears at clicked location

### Asset Properties

| Property | Description | How to Edit |
|----------|-------------|-------------|
| **Name** | Asset identifier | Type in field |
| **Identity** | Friend/Hostile/etc. | Dropdown selection |
| **Domain** | Air/Surface/Sub-Surface | Dropdown (locked for Ownship) |
| **Platform** | Specific aircraft/ship type | Dropdown selection |
| **Heading** | Direction (0-359°) | Type value + Enter |
| **Speed** | Velocity in knots | Type value + Enter |
| **Altitude** | Feet MSL (Air only) | Type value + Enter |
| **Depth** | Feet (Sub-Surface only) | Type value + Enter |
| **Hidden** | Invisible to students | Checkbox (Instructor only) |
| **Track File** | Show track on scope | Checkbox (Instructor only) |

### Domain Specifications

| Domain | Max Speed | Turn Rate | Special Attribute |
|--------|-----------|-----------|-------------------|
| **Air** | 999 kts (or platform limit) | 15°/sec | Altitude (FL) |
| **Surface** | 30 kts | 1°/sec | None |
| **Sub-Surface** | 30 kts | 1°/sec | Depth |
| **Land** | 0 kts (stationary) | N/A | SAM systems |

### Ownship

The gray circle with crosshair is **Ownship** - your platform:
- Always present, cannot be deleted
- Default position: 50 NM south of bullseye
- Max speed: 220 kts, Max altitude: 27,000 ft
- Radar sweep originates from Ownship position
- Full waypoint and control support

### Deleting Assets

**Method 1:** Select asset → Click **DELETE ASSET** button
**Method 2:** Right-click asset → Select **Delete Asset**

> **Note**: Ownship cannot be deleted.

---

## 5. Navigation & Waypoints

### Creating Waypoints

**First Waypoint (Go To):**
1. Select an asset
2. Right-click on destination
3. Select **Go To**
4. Asset turns toward waypoint

**Additional Waypoints:**
1. Asset must have at least one waypoint
2. Right-click on next destination
3. Select **Add Waypoint**
4. Waypoints are numbered WP1, WP2, WP3...

### Waypoint Behavior

- Assets automatically navigate through waypoints in sequence
- Arrival threshold: 0.5 NM from waypoint center
- Reached waypoints are automatically hidden from the display
- After reaching final waypoint, asset maintains last heading

### Wrap/Unwrap Waypoints

**Wrap** creates a continuous back-and-forth patrol:
1. Asset has at least 2 waypoints
2. Right-click on any waypoint except WP1
3. Select **Wrap Waypoint**
4. Asset will patrol between wrapped waypoints indefinitely

**Unwrap** returns to normal navigation:
1. Right-click on wrapped waypoint
2. Select **Unwrap Waypoint**

Visual indicator: Solid line between wrapped waypoints (vs. dashed for normal)

### Clearing Waypoints

1. Right-click on asset
2. Select **Clear All Waypoints**
3. Confirm in dialog

### Orbit Points

Send an asset to orbit at a CAP station:

**Via Voice Command:**
- "Heat one one set Tampa" (send to CAP station "Tampa")
- "Heat one one reset Tampa say state" (return to CAP with fuel state)

**Via Context Menu:**
1. Right-click on map location
2. Select **Orbit**
3. Asset turns toward location and orbits continuously

To exit orbit: Issue new heading command or add waypoint.

---

## 6. Geo-Points & Shapes

### Geo-Point Types

| Type | Symbol | Purpose |
|------|--------|---------|
| **CAP Station** | Crosshair | Combat Air Patrol reference point |
| **Airfield** | Parallel lines | Airport/airbase marker |
| **SAM Site** | Triangle | Surface-to-Air Missile site |
| **Mark** | Rectangle | General reference point |

### Creating Geo-Points

1. Right-click on map
2. Select **Create Geo-Point** → **[Type]**
3. Geo-point appears at clicked location
4. Edit name and properties in control panel

### Editing Geo-Points

| Property | How to Edit |
|----------|-------------|
| **Name** | Type in field (used for voice commands: "set Tampa") |
| **Type** | Dropdown selection |
| **Identity** | Dropdown (affects color) |
| **Latitude/Longitude** | Type value + Enter |

### Shape Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Line Segment** | Multi-point connected lines | Flight corridors, boundaries |
| **Circle** | Circular area | Engagement zones, SAM rings |

### Creating Shapes

**Line Segment:**
1. Right-click → **Create Shape** → **Line Segment**
2. Click points on map to define the path
3. Minimum 2 points required
4. Click **APPLY** when finished

**Circle:**
1. Right-click → **Create Shape** → **Circle**
2. Circle appears at clicked location (default 10 NM radius)
3. Adjust radius in control panel

### Editing Shapes

- **Drag points**: Reposition individual line segment points
- **Drag shape**: Move entire shape
- **Edit coordinates**: Type values in control panel + Enter
- **Add points**: Click **+ ADD POINT** for line segments
- **Change radius**: Edit radius field for circles
- **Change identity**: Dropdown affects color

### Deleting Geo-Points/Shapes

- Right-click → **Delete Geo-Point** / **Delete Shape**
- Or select and click **DELETE** button in control panel

---

## 7. Sensor Systems

Access sensor systems via the **SYSTEMS** tabs in the control panel.

### RADAR Tab

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable radar system |
| **Sweep Opacity** | 0-100% visibility of rotating sweep |
| **Return Decay** | 10-60 seconds before returns fade |
| **Return Intensity** | 1-100% brightness of radar returns |

**Radar Characteristics:**
- 360° sweep every 10 seconds
- Maximum range: 320 NM
- Returns show as white dots with azimuth spread
- Radar horizon based on Ownship and target altitudes

### ESM Tab (Electronic Support Measures)

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable passive detection |
| **BEARING LINE** | Create manual bearing snapshot |
| **VIS checkbox** | Show/hide individual emitter LOBs |

**ESM Features:**
- Automatic detection of radar emitters within 320 NM
- Orange lines of bearing (LOB) from Ownship
- Emitter labels (E01, E02...) with threat level sorting
- AGE timer shows time since last detection (green=active, red=inactive)
- Manual bearing lines (cyan, dashed) for triangulation

### IFF Tab (Identify Friend or Foe)

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable IFF interrogation |
| **MODE I** | 2-digit octal code (0-7) |
| **MODE II** | 4-digit octal code |
| **MODE III** | 4-digit octal code |
| **MODE IV** | ON/OFF encrypted mode |
| **Return Intensity** | 1-100% brightness |

**Per-Asset IFF:**
- Configure squawk codes in asset's IFF tab
- Toggle squawk ON/OFF per asset
- IFF returns shown as green overlay on radar returns

### DATALINK Tab

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable datalink |
| **NET** | Network ID (1-127) |
| **JU** | Joint Unit code (5 digits) |
| **Track Block Start/End** | Track number range allocation |

**Usage:**
1. Configure NET and JU
2. Set track block range
3. Select asset → Click **REPORT TRACK** to assign track number
4. Assets on same NET automatically become friendly

### EO/IR Tab (Electro-Optical/Infrared)

1. Enable EO/IR system (ON/OFF)
2. Select asset with platform image
3. Click **VIEW EO/IR** button
4. Popup shows platform identification image

**Popup Controls:**
- Drag header bar to move window
- Drag edges to resize (min 300x200)
- Click X to close

### ISAR Tab (Inverse Synthetic Aperture Radar)

**Flight Profile Requirements (all must be met):**

| Requirement | Specification |
|-------------|---------------|
| **Altitude** | 5,000 - 35,000 ft MSL |
| **Groundspeed** | 180 - 250 kts |
| **Wings Level** | 15+ seconds continuous |
| **Grazing Angle** | 0.01° - 4.0° |
| **Slant Range** | Altitude-dependent envelope |

**Status Display:**
- **READY** (green): All requirements met
- **NOT READY** (orange): One or more requirements failed
- Individual parameter status shown with color coding

### SONO Tab (Sonobuoy System)

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable sonobuoy system |
| **Master Arm** | SAFE/ARMED (lift guard first) |
| **DEPLOY** | Drop sonobuoy at Ownship position |
| **Inventory** | 30 buoys available per mission |

**Sonobuoy Features:**
- Detection range: 4 NM for submarines
- Red bearing lines from buoy to detected submarine
- Submarines must be >15 ft depth to be detected
- Buoy labels: S01, S02...

### WEAPON Tab

| Control | Function |
|---------|----------|
| **ON/OFF** | Enable/disable weapons system |
| **Master Arm** | SAFE/ARMED (lift guard first) |
| **Weapon Select** | Choose weapon type |
| **Target Select** | Choose target asset |
| **FIRE** | Launch weapon |

**Weapon Categories:**
- AAM (Air-to-Air Missile)
- AGM (Air-to-Ground Missile)
- ASM (Anti-Ship Missile)
- SAM (Surface-to-Air Missile)
- Torpedo

**Weapon Behavior:**
- Realistic fuel consumption and flight times
- Booster phase → Cruise phase → Energy bleed-off
- Self-destruct after maximum flight time
- Active weapons shown on display with heading indicator

---

## 8. Simulator Modes

### Instructor Mode

**Full control over the simulation:**

| Capability | Description |
|------------|-------------|
| Create/Edit/Delete all assets | Complete scenario control |
| HIDDEN checkbox | Make assets invisible to students |
| TRACK FILE checkbox | Control track file generation |
| BEHAVIORS tab | Create automated trigger-action sequences |
| All system access | Full sensor and weapon control |

**Building Scenarios:**
1. Create assets at desired positions
2. Set HIDDEN=true for assets that should appear later
3. Configure behaviors for automated actions
4. Save scenario for student use

### Student Mode

**Realistic radar operator training:**

| Feature | Description |
|---------|-------------|
| Automatic track generation | 2-3 radar returns creates track |
| Track aging | 2 missed sweeps → gray (aged) track |
| Dead reckoning | Tracks estimate position between sweeps |
| Manual track numbers | Must use REPORT TRACK button |
| Voice commands | Full intercept flow control |
| Limited asset control | Friendly assets and Ownship only |

**Track Management:**
- Tracks default to "Unknown Unevaluated" (orange)
- Edit identity via dropdown
- Add labels for documentation
- DELETE TRACK removes track (not the underlying asset)
- Radar will regenerate track after 2-3 returns

**Coordinate Format:** DMM (N26 30.0, E054 00.0)

### Track Aging

| State | Appearance | Cause |
|-------|------------|-------|
| **Active** | Normal color | Within radar detection |
| **Aged** | Gray | 2 missed sweeps (~20 seconds) |

Tracks age when:
- Asset moves out of radar range
- Radar is turned OFF
- Instructor toggles HIDDEN ON
- Asset is destroyed

---

## 9. Voice Commands

### Activation

1. Must be in **Student Mode**
2. Hold **SPACEBAR** to transmit
3. Release SPACEBAR when finished speaking
4. Watch TX/RX indicator: Red = transmitting, Green = receiving

**Browser Requirement:** Chrome or Edge (voice recognition not supported in Firefox/Safari)

### Asset Control Commands

**Heading:**
```
"Heat one one turn right heading one eight zero"
"Heat one one flow two seven zero"
```

**Speed:**
```
"Heat one one speed three five zero"
```

**Altitude:**
```
"Heat one one climb to angels two four"      (angels = thousands: 24,000 ft)
"Heat one one descend to flight level one five zero"    (FL = hundreds: 15,000 ft)
```

**Orbit at CAP Station:**
```
"Heat one one set Tampa"
"Heat one one reset Tampa"
"Heat one one reset Tampa say state"    (includes fuel state response)
```

### AIC Training Mode Commands

**Broadcast (announce group):**
```
"Closeout, group Rock zero four five slash thirty, twenty-five thousand, track west, hostile"
```
Fighter acknowledges with callsign.

**Commit (direct to intercept):**
```
"Showtime commit group Rock zero four five slash thirty"
```
Fighter responds "commit" and turns to intercept.

**Labeled Picture (multi-group):**
```
"Closeout, two groups range ten, lead group Rock zero four five slash thirty, trail group Rock zero five five slash twenty-five"
```
Fighter responds "target lead group" (or first mentioned for azimuth).

**Labeled Picture (single group):**
```
"Closeout, single group track west"
```
Fighter acknowledges single group.

**Tac Range:**
```
"Showtime, lead group thirty miles"
```
Fighter acknowledges range update.

**Declare Response:**
```
"Closeout, lead group Rock zero four five slash twenty-eight, twenty-five thousand, track west, hostile"
```
Fighter acknowledges declaration.

**Separation:**
```
"Closeout, trail group Rock zero five five slash twenty, hostile"
```
Fighter retargets to new group.

**Vanished:**
```
"Closeout, lead group vanished, target trail group Rock zero five five slash eighteen"
```
Fighter switches to new target.

**Picture Clean + Reset:**
```
"Closeout picture clean, Showtime reset Tampa say state"
```
Fighter returns to CAP station orbit.

### Voice Recognition Tips

- Speak clearly and at moderate pace
- Use phonetic numbers: "one eight zero" not "one eighty"
- Use "niner" for 9
- Pause briefly between major elements
- Common mishearings are auto-corrected:
  - "shingle" → "single"
  - "lee group" → "lead group"
  - "hostel" → "hostile"

### Sound Settings

Access via **ESC** → **SOUND** button:

| Setting | Description |
|---------|-------------|
| **ElevenLabs API Key** | Optional high-quality TTS |
| **Voice ID** | ElevenLabs voice selection |
| **Radio Effects** | ON/OFF for radio band filtering |
| **Effect Intensity** | Subtle to heavy radio effect |

---

## 10. Save/Load & Recording

### Saving Scenarios

1. Press **ESC** to open pause menu
2. Click **SAVE FILE**
3. Choose save method:

| Method | Description |
|--------|-------------|
| **Save to Application** | Browser localStorage (quick access) |
| **Download to Computer** | JSON file (shareable, permanent) |

4. Enter scenario name
5. Click **SAVE**

### Loading Scenarios

1. Press **ESC** to open pause menu
2. Click **LOAD FILE**
3. Choose load method:

| Method | Description |
|--------|-------------|
| **Load from Application** | Select from saved list |
| **Load from Computer** | Browse for JSON file |

4. Select scenario
5. Click **LOAD**

### Mission Products

Attach reference documents to scenarios:

1. Press **ESC** → **MISSION PRODUCTS**
2. Click **ADD FILE**
3. Select document (PDF, Word, Excel, PowerPoint)
4. Maximum 10 MB per file
5. Files saved with scenario (Download method only)

### Recording Sessions

**Start Recording:**
1. Click **○ RECORD** (top-left)
2. Grant screen capture permission
3. Select screen/window to capture
4. Grant microphone permission (optional)

**Stop Recording:**
1. Click **● REC** while recording
2. Video downloads automatically as .webm file

**Use Cases:**
- Session review and debriefing
- Proficiency evaluation
- Communications quality assessment

---

## 11. Behaviors (Instructor Mode)

Behaviors automate asset actions based on triggers.

### Creating a Behavior

1. Select asset
2. Click **BEHAVIORS** tab
3. Click **NEW**
4. Configure trigger type
5. Add one or more actions
6. Click **SAVE**

### Trigger Types

| Trigger | Configuration | Fires When |
|---------|---------------|------------|
| **Mission Time** | HH:MM:SS | Specified time reached |
| **Distance from Asset** | Asset + distance (NM) | Target asset within range |
| **At Waypoint** | Waypoint selection | Asset reaches waypoint |

### Action Types

| Action | Description |
|--------|-------------|
| **Change Heading** | Set heading to value (0-359°) |
| **Change Speed** | Set speed to value (knots) |
| **Change Altitude** | Set altitude to value (feet) |
| **Turn Emitter On** | Activate selected radar |
| **Turn Emitter Off** | Deactivate selected radar |
| **Make Visible** | Uncheck HIDDEN (reveal to students) |
| **Make Invisible** | Check HIDDEN (hide from students) |

### Behavior Management

| Button | Function |
|--------|----------|
| **Next/Back** | Browse through behaviors |
| **NEW** | Create new behavior |
| **EDIT** | Modify existing behavior |
| **DELETE** | Remove behavior (with confirmation) |

**Status Indicators:**
- **ACTIVE** - Behavior waiting to trigger
- **FIRED** - Behavior has executed

---

## 12. Troubleshooting

### Assets Not Moving

| Issue | Solution |
|-------|----------|
| Simulation paused | Click PLAY button |
| Speed is 0 | Set speed > 0 in asset panel |
| No heading set | Enter heading value + press Enter |

### Voice Commands Not Working

| Issue | Solution |
|-------|----------|
| Wrong browser | Use Chrome or Edge |
| Not in Student mode | Select Student mode before starting |
| Microphone blocked | Grant permission in browser settings |
| Not holding Spacebar | Hold SPACEBAR while speaking |

### Recording Not Working

| Issue | Solution |
|-------|----------|
| Permission denied | Grant screen capture permission |
| No audio | Grant microphone permission |
| Wrong browser | Use Chrome or Edge |

### Scenario Won't Load

| Issue | Solution |
|-------|----------|
| Invalid file | Ensure file is valid JSON |
| Wrong format | File must be from AIC Simulator |
| Corrupted data | Try different scenario |

### Map Display Issues

| Issue | Solution |
|-------|----------|
| Map blank | Zoom out (scroll wheel down) |
| Wrong area | Click RESTART to reset view |
| Assets missing | Check HIDDEN checkbox (Instructor mode) |

### Performance Issues

| Issue | Solution |
|-------|----------|
| Slow/laggy | Reduce number of assets |
| Browser warning | Close other tabs |
| High memory | Restart browser |

---

## 13. Quick Reference

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **ESC** | Pause menu |
| **Enter** | Apply value |
| **Spacebar (hold)** | Push-to-talk |
| **Mouse Wheel** | Zoom |

### Voice Command Cheat Sheet

| Command Type | Example |
|--------------|---------|
| **Heading** | "Heat one one heading two seven zero" |
| **Speed** | "Heat one one speed three five zero" |
| **Altitude** | "Heat one one angels two four" |
| **Set CAP** | "Heat one one set Tampa" |
| **Reset** | "Heat one one reset Tampa say state" |
| **Commit** | "Showtime commit group Rock zero four five slash thirty" |
| **Picture** | "Closeout two groups range ten..." |
| **Single** | "Closeout single group track west" |
| **Vanished** | "Closeout lead group vanished target trail group..." |
| **Clean** | "Closeout picture clean Showtime reset Tampa" |

### Identity Colors

| Identity | Color | Hex Code |
|----------|-------|----------|
| Friendly | Light Blue | #00BFFF |
| Hostile | Red | #FF0000 |
| Neutral | Green | #00FF00 |
| Unknown | Yellow | #FFFF00 |
| Unknown Unevaluated | Orange | #FFA500 |

### Domain Specifications

| Domain | Turn Rate | Speed Change | Max Speed |
|--------|-----------|--------------|-----------|
| Air | 15°/sec | 10 kts/sec | 999 kts |
| Surface | 1°/sec | 2 kts/sec | 30 kts |
| Sub-Surface | 1°/sec | 2 kts/sec | 30 kts |
| Land | N/A | N/A | 0 kts |

### System Tab Colors

| Color | Meaning |
|-------|---------|
| Red | System OFF |
| Yellow | System ON, SAFE |
| Green | System ON, ARMED/READY |

### Bullseye Reference

- Default location: 26.5°N, 54.0°E (Central Persian Gulf)
- Click bullseye to customize name
- All positions referenced as BRG/RNG from bullseye

---

## Document Information

**AIC Simulator Version:** 3.2
**Manual Version:** 1.0
**Last Updated:** January 2026

For additional support, refer to:
- `README.md` - Technical overview and version history
- `AIC-SIMULATOR-DOCUMENTATION.md` - Detailed technical documentation

---

*Good hunting, Controllers!*
