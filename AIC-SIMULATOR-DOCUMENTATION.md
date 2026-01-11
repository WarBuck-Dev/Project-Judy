# AIC Simulator - Requirements & Features Documentation

**Air Intercept Control Simulator**
Version 2.5
Last Updated: January 10, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Technical Architecture](#technical-architecture)
4. [Core Features](#core-features)
5. [User Interface](#user-interface)
6. [Asset Management](#asset-management)
7. [Navigation System](#navigation-system)
8. [Physics & Simulation](#physics--simulation)
9. [Display & Visualization](#display--visualization)
10. [Data Management](#data-management)
11. [Controls Reference](#controls-reference)
12. [Performance Requirements](#performance-requirements)
13. [Future Enhancements](#future-enhancements)

---

## Overview

The AIC Simulator is a web-based tactical air intercept control training application designed to simulate real-time air operations in the Persian Gulf region. It provides instructors and students with a realistic radar scope interface for practicing air intercept control procedures.

### Purpose
- Train Air Intercept Controllers (AICs)
- Practice tactical decision-making
- Simulate multi-asset scenarios
- Record and review training sessions

### Target Users
- Military aviation students
- Air intercept control instructors
- Tactical training coordinators

---

## System Requirements

### Browser Compatibility
- **Recommended**: Google Chrome 90+, Microsoft Edge 90+
- **Supported**: Firefox 88+ (limited recording support)
- **Not Supported**: Safari (no screen recording API)

### Minimum System Specifications
- **Processor**: Dual-core 2.0 GHz or higher
- **RAM**: 4 GB minimum, 8 GB recommended
- **Display**: 1920x1080 resolution or higher
- **Storage**: 100 MB for application and saved scenarios
- **Network**: Not required (runs offline after initial load)

### Required Permissions (for recording)
- Screen capture permission
- Microphone access permission
- System audio capture (browser dependent)

---

## Technical Architecture

### Technology Stack
- **Framework**: React 18
- **Language**: JavaScript (JSX)
- **UI Components**: Lucide React icons
- **Graphics**: SVG for radar display
- **Styling**: Custom CSS (green phosphor radar aesthetic)
- **Fonts**: Orbitron (Google Fonts)

### State Management
- React hooks (useState, useEffect, useRef, useCallback, useMemo)
- LocalStorage for persistent in-app saves
- JSON file format for export/import

### Performance
- **Physics Update Rate**: 60 Hz (60 FPS)
- **Display Refresh Rate**: ~30 FPS
- **Animation**: RequestAnimationFrame for smooth rendering

---

## Core Features

### 1. Real-Time Simulation
- ✅ Physics-based movement calculations
- ✅ Continuous asset position updates
- ✅ Gradual parameter changes (heading, speed, altitude)
- ✅ Automatic waypoint navigation
- ✅ Collision-free operation
- ✅ Simulated radar returns (10-second interval, 30-second fade)
- ✅ Mission time tracking (HH:MM:SS format)

### 2. Multi-Asset Management
- ✅ Unlimited number of assets
- ✅ 5 distinct asset classifications
- ✅ Individual asset control
- ✅ Batch scenario management
- ✅ Asset creation at any map location

### 3. Tactical Display
- ✅ Radar scope interface with clean black background
- ✅ MIL-STD-2525 compliant symbology (top-half air tracks)
- ✅ Bearing/Range (BRG/RNG) position format
- ✅ Bullseye reference system with custom naming
- ✅ Persian Gulf geographic region
- ✅ Visual selection indicators for assets and bullseye
- ✅ Fading white radar return trails

### 4. Navigation Control
- ✅ Waypoint-based navigation
- ✅ Multi-waypoint route planning
- ✅ Direct-to commands
- ✅ Visual path indicators
- ✅ Automatic heading management

### 5. Data Persistence
- ✅ Save scenarios to browser localStorage
- ✅ Export scenarios to JSON files
- ✅ Import scenarios from files
- ✅ Multiple scenario storage
- ✅ Timestamped saves

### 6. Session Recording
- ✅ Screen video capture
- ✅ System audio recording
- ✅ Microphone audio capture
- ✅ WebM format output
- ✅ Automatic download on stop

---

## User Interface

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  [RECORD]                        [STATUS] [SCALE]       │
│                                                          │
│                                                          │
│                 RADAR DISPLAY                            │
│              (Tactical Map View)                         │
│                                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
                                    ┌──────────────────────┐
                                    │  CONTROL PANEL       │
                                    │  ─────────────────   │
                                    │  Title               │
                                    │  Playback Controls   │
                                    │  Cursor Position     │
                                    │  Asset List          │
                                    │  Selected Asset      │
                                    │  Add Asset           │
                                    └──────────────────────┘
```

### Color Scheme
- **Background**: Black (#000000)
- **Primary**: Green (#00FF00) - Radar phosphor
- **Grid**: Dim green (#00FF00 @ 15% opacity)
- **Text**: Bright green (#00FF00)
- **Accents**: Asset type colors (see Asset Types section)

### Typography
- **Font Family**: Orbitron (monospace military aesthetic)
- **Sizes**: 
  - Title: 24px bold
  - Headers: 12px bold
  - Body: 10-11px regular
  - Labels: 8-9px

### Visual Design
- Minimalist radar scope aesthetic
- High contrast for visibility
- No unnecessary decorations
- Functional, military-style interface

---

## Asset Management

### Asset Types

| Type | Color | Symbol | Badge | Description |
|------|-------|--------|-------|-------------|
| **Friendly** | Light Blue (#00BFFF) | Circle | FRD | Allied forces |
| **Hostile** | Red (#FF0000) | Diamond | HST | Enemy forces |
| **Neutral** | Green (#00FF00) | Circle | NEU | Non-combatants |
| **Unknown** | Yellow (#FFFF00) | Circle | UNK | Unidentified, evaluated |
| **Unknown Unevaluated** | Orange (#FFA500) | Circle | UNU | Unidentified, not evaluated |

### Asset Properties

#### Identification
- **ID**: Unique integer identifier (auto-assigned)
- **Name**: User-defined string (editable)
- **Type**: Classification (5 options)
- **Track Number**: Optional TN# assignment (starts at 6000)

#### Position
- **Latitude**: Decimal degrees
- **Longitude**: Decimal degrees
- **Heading**: 0-359 degrees (true north)
- **Altitude**: Feet MSL (displayed as Flight Level)

#### Performance
- **Speed**: Knots True Airspeed (KTAS)
- **Target Heading**: Desired heading (null if none)
- **Target Speed**: Desired speed (null if none)
- **Target Altitude**: Desired altitude (null if none)

#### Navigation
- **Waypoints**: Array of lat/lon coordinates
- **Current Waypoint**: First in array (if exists)
- **Waypoint Proximity**: 0.5 NM arrival radius

### Asset Operations

#### Create Asset
**Method 1**: Add Asset Button
1. Click "+ ADD" in control panel
2. Fill in asset details dialog
3. Asset appears at default location (bullseye)

**Method 2**: Right-Click Add
1. Right-click on map (no asset selected)
2. Choose "Add Asset"
3. Asset appears at clicked location

#### Edit Asset
1. Select asset (left-click or from list)
2. Edit fields in "Selected Asset" panel
3. For heading/speed/altitude: Type value → Press Enter
4. For name/type: Type value → Auto-saves

#### Delete Asset
1. Select asset
2. Click "DELETE" button in selected asset panel

#### Report Track
1. Select asset
2. Click "REPORT TRACK" button
3. Track number assigned (TN#6000, 6001, etc.)
4. Number displayed on map below altitude

---

## Navigation System

### Waypoint Mechanics

#### Waypoint Creation
- **Go To** (First waypoint): Right-click → "Go to"
- **Add Waypoint** (Additional): Right-click → "Add waypoint"
- **Automatic Heading**: Sets target heading to waypoint bearing

#### Waypoint Management
- **Sequential Navigation**: Asset flies to WP1, then WP2, then WP3...
- **Visual Indicators**: Dashed lines between waypoints
- **Labels**: WP1, WP2, WP3... displayed at each point
- **Repositioning**: Drag waypoint markers to new location
- **Deletion**: Right-click waypoint → "Delete waypoint"

#### Waypoint Arrival
- **Proximity Threshold**: 0.5 nautical miles
- **Automatic Removal**: WP1 removed when reached
- **Heading Update**: Auto-turns to next waypoint
- **Final Waypoint**: Clears all targets when last WP reached

### Navigation Display

#### Path Visualization
```
Asset -----> WP1 -----> WP2 -----> WP3
  ○          ✕           ✕           ✕
             (dashed lines connecting each)
```

#### Line Styles
- **Color**: Matches asset type color
- **Style**: Dashed (5px dash, 5px gap)
- **Width**: 1-2 pixels
- **Markers**: X symbol at each waypoint

---

## Physics & Simulation

### Movement Calculation

#### Position Update (60 Hz)
```
speed_nm_per_second = speed_knots / 3600
distance = speed_nm_per_second × delta_time

delta_lat = (distance × cos(heading)) / 60
delta_lon = (distance × sin(heading)) / (60 × cos(latitude))

new_lat = current_lat + delta_lat
new_lon = current_lon + delta_lon
```

#### Bearing Calculation (Haversine Formula)
```
Uses spherical earth model for accurate bearing/range
Accounts for earth curvature
Results in degrees true and nautical miles
```

### Gradual Parameter Changes

#### Heading Changes
- **Rate**: 15 degrees per second
- **Direction**: Shortest turn (clockwise or counterclockwise)
- **Normalization**: Maintains 0-359 degree range
- **Completion**: Clears target when within 1 degree

#### Speed Changes
- **Rate**: 10 knots per second
- **Direction**: Acceleration or deceleration
- **Completion**: Clears target when within 1 knot

#### Altitude Changes
- **Rate**: 6000 feet per minute (100 ft/sec)
- **Direction**: Climb or descent
- **Completion**: Clears target when within 1 foot

### Weapon Physics (Version 2.5+)

#### Weapon System Architecture

**Individual Weapon Variants**
- Transitioned from 5 generic weapon types to 30+ individual weapon variants
- Each weapon has unique performance characteristics from [weapons.json](weapons.json)
- Weapons include: maxSpeed, maxRange, maxAcceleration, targetType, symbol
- Platform weapons array specifies available weapon variants
- Weapon selection uses first matching variant from platform

**Weapon Variant Selection**
```javascript
// Example: MiG-29 platform configuration
{
  "name": "MiG-29",
  "weapons": ["R-27 (AA-10)", "R-73 (AA-11)"],
  "numberOfAAM": 6
}

// When firing AAM:
// 1. Check platform.weapons array
// 2. Find first weapon where type === "AAM"
// 3. Returns "R-27 (AA-10)"
// 4. Use R-27 ballistics (maxSpeed: 2300, maxRange: 43nm)
```

**Platform-Based Inventory System**
- numberOfAAM: Air-to-air missile count
- numberOfAGM: Air-to-ground missile count
- numberOfASM: Anti-ship missile count
- numberOfSAM: Surface-to-air missile count
- numberOfTorpedo: Torpedo count
- Ownship inventory initialized from platform configuration
- Non-ownship assets have unlimited weapons
- UI displays TYPE-based inventory (not individual variants)

**Weapon Symbology**
- SVG path-based rendering for realistic weapon symbols
- Friendly missile: Blue (#00BFFF) arc-topped symbol
- Hostile weapon: Red (#FF0000) diamond-shaped symbol
- Friendly torpedo: Blue (#0054b0) horizontal symbol
- North-up orientation (symbols don't rotate with heading)
- Solid direction line shows actual heading (30px length)
- Size matched to air track symbols (scale: 0.114)

#### Fuel/Energy System
All weapon variants implement a three-phase propulsion model:

**Phase 1: Booster Phase**
- High-thrust initial acceleration (boosterAcceleration parameter)
- Duration: 10-20% of total fuel time
- Console logging when booster burns out
- Example durations:
  - Short-range AAM (AIM-9): 8 seconds
  - Medium-range AAM (AIM-120): 15 seconds
  - Anti-ship missile (Harpoon): 60 seconds
  - Torpedo (Mk 46): 60 seconds
  - Long-range cruise (Kh-101): 180 seconds

**Phase 2: Cruise Phase**
- Sustained thrust using maxAcceleration parameter
- Maintains max speed until fuel depletion
- Fuel consumption tracked via mission time
- Duration: fuelTime parameter (calculated per weapon)

**Phase 3: Energy Bleed-Off**
- Unpowered flight after fuel depletion
- 50 knots/sec deceleration due to drag
- Weapons below 10 knots fall and self-destruct
- Console logging for energy depletion

**Self-Destruct System**
- Maximum flight time: selfDestructTime parameter (2x fuelTime)
- Automatic detonation when timer expires
- Prevents runaway weapons
- Console logging for all self-destruct events

#### Fuel Calculation Formula
```
baseTime = maxRange / (maxSpeed / 3600)
fuelTime = baseTime × 1.2  (20% maneuvering margin)
boosterTime = fuelTime × 0.10-0.20  (weapon-dependent)
selfDestructTime = fuelTime × 2.0
```

#### Weapon Guidance
- **Method**: Proportional navigation (bearing-to-waypoint)
- **Turn Rate**: 30 degrees per second (fixed)
- **Acceleration**: Booster or cruise (phase-dependent)
- **Impact Threshold**: 0.1 NM range to target
- **Fuel Impact**: Maneuvering doesn't directly consume fuel (time-based only)

#### Weapon Termination Conditions
1. **Successful Impact**: Range to target < 0.1 NM
2. **Self-Destruct**: Mission time >= selfDestructTime
3. **Energy Loss**: Speed < 10 knots after fuel depletion
4. **Target Loss**: Continues on last heading until fuel/self-destruct

#### Fuel Parameters by Weapon Type

**Air-to-Air Missiles (AAM)**
- R-60 (AA-8): 13s fuel, 26s max flight
- AIM-9 Sidewinder: 46s fuel, 92s max flight
- R-73 (AA-11): 41s fuel, 82s max flight
- AIM-7 Sparrow: 81s fuel, 162s max flight
- R-27 (AA-10): 81s fuel, 162s max flight
- AIM-120 AMRAAM: 130s fuel, 260s max flight
- AIM-54 Phoenix: 144s fuel, 288s max flight

**Air-to-Ground Missiles (AGM)**
- FAB-500: 22s fuel, 44s max flight
- Kh-25: 36s fuel, 72s max flight
- AGM-65 Maverick: 88s fuel, 176s max flight
- Kh-55: 3.35hr fuel, 6.7hr max flight
- Kh-101: 5.6hr fuel, 11.2hr max flight

**Anti-Ship Missiles (ASM)**
- C-701: 110s fuel, 220s max flight
- SS-N-22: 220s fuel, 440s max flight
- SS-N-14: 219s fuel, 438s max flight
- SS-N-2 Styx: 336s fuel, 672s max flight
- HY-2: 395s fuel, 790s max flight
- 3M-54 Klub: 396s fuel, 792s max flight
- SS-N-9: 475s fuel, 950s max flight
- AGM-84 Harpoon: 538s fuel, 1076s max flight
- Harpoon: 538s fuel, 1076s max flight
- C-802: 548s fuel, 1096s max flight

**Surface-to-Air Missiles (SAM)**
- SA-N-9: 14s fuel, 28s max flight
- RIM-7 Sea Sparrow: 16s fuel, 32s max flight
- SA-N-4: 20s fuel, 40s max flight
- SA-N-7: 24s fuel, 48s max flight
- SM-1: 41s fuel, 82s max flight

**Torpedoes**
- Mk 46 Torpedo: 576s fuel, 1152s max flight (9.6min / 19.2min)
- 53-56 Torpedo: 864s fuel, 1728s max flight (14.4min / 28.8min)
- 53-65 Torpedo: 1188s fuel, 2376s max flight (19.8min / 39.6min)

### State Preservation

All parameter values maintain fractional precision internally:
- **Internal**: 90.25°, 450.73 knots, 25,127.5 feet
- **Display**: 90°, 451 KTAS, FL251 (rounded)
- **Purpose**: Smooth incremental changes without rounding errors

---

## Display & Visualization

### Radar Display Elements

#### Grid System
- **Type**: Cartesian grid overlay
- **Color**: Green (#00FF00) @ 15% opacity
- **Spacing**: Dynamic based on zoom level
- **Style**: Thin lines (0.5px width)

#### Compass Rose
- **Cardinals**: N, E, S, W at map edges
- **Font**: Orbitron 12px
- **Color**: Green (#00FF00)
- **Position**: Edge centers

#### Bullseye Marker
- **Symbol**: Circle with crosshairs
- **Size**: 16px diameter
- **Color**: Green (#00FF00)
- **Label**: "BE" above marker
- **Location**: 26.5°N, 54.0°E (Persian Gulf)

#### Temporary Mark
- **Symbol**: Circle with crosshairs
- **Size**: 12px diameter
- **Color**: Yellow (#FFFF00)
- **Purpose**: Reference point for measurements
- **Activation**: Left-click on empty map space

### Asset Symbology (MIL-STD-2525)

#### Friendly/Neutral/Unknown (Circle)
```
     ↑ (heading line)
     |
    ╱ ╲
   │   │  ← Circle (color-coded)
    ╲ ╱
```

#### Hostile (Diamond)
```
     ↑ (heading line)
     |
     ╱╲
    ╱  ╲  ← Diamond (red)
    ╲  ╱
     ╲╱
```

#### Asset Labels
**Above Symbol:**
- Asset name (color-coded)

**Below Symbol:**
- Flight level (e.g., "FL250")
- Track number if assigned (e.g., "TN#6000")

#### Selection Indicator
- **Ring**: Larger circle/diamond when selected
- **Width**: 2.5px vs 2px normal
- **Size**: 32px vs 24px normal

### Map Interactions

#### Zoom Levels
- **Range**: 10 - 360 nautical miles
- **Default**: 100 NM
- **Increment**: 10 NM per scroll
- **Display**: "SCALE: XX NM" indicator

#### Pan Controls
- **Method**: Click and drag map
- **Constraints**: None (unlimited pan)
- **Reset**: Restart button centers view

### Information Displays

#### Cursor Position Display
**Primary (Green border):**
- FROM BULLSEYE
- Format: BRG/RNG (e.g., "304/52")
- Always visible

**Secondary (Yellow border):**
- FROM MARK or FROM SELECTED
- Format: BRG/RNG (e.g., "270/8")
- Only when mark placed or asset selected

#### Status Indicators
**Top Right:**
- Recording status: "● REC 00:00" or "○ RECORD"
- Simulation state: "● RUNNING" or "○ PAUSED"
- Scale: "SCALE: XXX NM"

---

## Data Management

### Save File Format (JSON)

```json
{
  "version": "1.0",
  "timestamp": "2025-12-30T12:34:56.789Z",
  "assets": [
    {
      "id": 1,
      "name": "F-16A",
      "type": "friendly",
      "lat": 26.7,
      "lon": 53.8,
      "heading": 90.5,
      "speed": 450.3,
      "altitude": 25000,
      "targetHeading": 120,
      "targetSpeed": null,
      "targetAltitude": null,
      "waypoints": [
        {"lat": 26.5, "lon": 54.0}
      ],
      "trackNumber": 6000
    }
  ],
  "bullseye": {"lat": 26.5, "lon": 54.0},
  "scale": 100,
  "mapOffset": {"x": 0, "y": 0},
  "tempMark": {"lat": 26.3, "lon": 54.2},
  "nextTrackNumber": 6001
}
```

### Save Options

#### Option 1: Save to Application (localStorage)
- **Storage**: Browser localStorage
- **Key Format**: `aic-scenario-{name}`
- **Limit**: ~5-10 MB total (browser dependent)
- **Persistence**: Until browser data cleared
- **Benefits**: Quick access, no files to manage
- **Drawbacks**: Browser-specific, vulnerable to data loss

#### Option 2: Download to Computer
- **Format**: JSON file (.json extension)
- **Naming**: User-defined with timestamp
- **Size**: Unlimited
- **Benefits**: Shareable, backup-friendly, portable
- **Drawbacks**: Requires file management

### Load Options

#### Load from Application
- **Source**: localStorage
- **Display**: List of saved scenarios with timestamps
- **Features**: 
  - Click to load
  - Trash icon to delete
  - Sorted by most recent first

#### Load from Computer
- **Method**: File browser dialog
- **Format**: .json files only
- **Validation**: Checks for valid structure
- **Error Handling**: Alert if invalid format

---

## Controls Reference

### Mouse Controls

| Action | Control | Description |
|--------|---------|-------------|
| Select Asset | Left-click on asset | Highlights asset, shows in panel |
| Drop Mark | Left-click on empty space | Places yellow temporary reference mark |
| Pan Map | Click + Drag | Moves map view in any direction |
| Zoom In | Mouse Wheel Up | Decreases scale (more detail) |
| Zoom Out | Mouse Wheel Down | Increases scale (less detail) |
| Context Menu | Right-click | Shows options based on context |
| Move Asset | Click + Drag asset | Repositions asset (not implemented) |
| Move Waypoint | Click + Drag waypoint | Repositions waypoint marker |

### Context Menu Options

| Context | Option | Action |
|---------|--------|--------|
| No selection | Add Asset | Creates asset at clicked location |
| Asset selected, no waypoints | Go to | Sets first waypoint, turns toward it |
| Asset selected, has waypoints | Add waypoint | Adds additional waypoint to route |
| Click on waypoint | Delete waypoint | Removes that specific waypoint |

### Keyboard Controls

| Key | Action |
|-----|--------|
| ESC | Opens pause menu |
| Enter | Apply value in input field (heading/speed/altitude) |

### Button Controls

#### Playback Controls
- **PLAY/PAUSE**: Toggle simulation running state
- **RESTART**: Reset simulation (clears waypoints, stops movement)

#### Asset Management
- **+ ADD**: Open asset creation dialog
- **DELETE**: Remove selected asset
- **REPORT TRACK**: Assign track number to selected asset

#### File Management
- **SAVE**: Open save dialog (app or computer)
- **LOAD**: Open load dialog (app or computer)

#### Pause Menu
- **RESUME**: Close menu, continue simulation
- **SAVE FILE**: Open save dialog
- **LOAD FILE**: Open load dialog
- **CONTROLS**: View controls documentation
- **QUIT**: Close application (with confirmation)

### Recording Controls
- **RECORD**: Start screen/audio recording
- **STOP**: Stop recording and download file

---

## Performance Requirements

### Frame Rates
- **Physics Updates**: 60 Hz (16.67ms intervals)
- **Display Rendering**: ~30 FPS (33ms intervals)
- **User Input**: Real-time (event-driven)

### Latency
- **Mouse Click Response**: < 50ms
- **Asset Selection**: Immediate
- **Pan/Zoom**: Smooth, no lag
- **Playback Toggle**: Instant

### Scalability
- **Maximum Assets**: 50+ without performance degradation
- **Maximum Waypoints per Asset**: 20+
- **Map Size**: Unlimited pan range
- **Saved Scenarios**: Limited by storage (100+ in localStorage)

### Memory Usage
- **Typical Session**: < 100 MB RAM
- **With Recording**: < 500 MB RAM
- **Storage per Scenario**: < 50 KB

---

## Future Enhancements

### Planned Features (Not Yet Implemented)

#### Enhanced Asset Management
- [ ] Drag and drop asset repositioning on map
- [ ] Multi-asset selection
- [ ] Asset grouping/formations
- [ ] Copy/paste assets
- [ ] Bulk property editing

#### Advanced Navigation
- [ ] Holding patterns
- [ ] Orbit points
- [ ] Combat Air Patrol (CAP) routes
- [ ] Speed/altitude restrictions at waypoints
- [ ] Time-on-target calculations

#### Geographic Features
- [ ] Persian Gulf coastline rendering
- [ ] Major city markers (Dubai, Abu Dhabi, etc.)
- [ ] Restricted airspace zones
- [ ] Geographical landmarks
- [ ] Elevation data

#### Training Tools
- [ ] Scenario templates
- [ ] Mission briefing notes
- [ ] Performance scoring
- [ ] Replay functionality
- [ ] Training mode with hints

#### Communication
- [ ] Simulated radio calls
- [ ] Text-to-speech for callouts
- [ ] Communication log
- [ ] Standard phraseology templates

#### Data Export
- [ ] Mission reports
- [ ] Track history export
- [ ] Screenshot capture
- [ ] CSV data export

#### User Interface
- [ ] Customizable color schemes
- [ ] Multiple display layouts
- [ ] Keyboard shortcuts
- [ ] Touch screen support

#### Multiplayer
- [ ] Network synchronization
- [ ] Multi-user scenarios
- [ ] Instructor/student modes
- [ ] Observer mode

---

## Appendices

### A. Coordinate System

**Bullseye Reference Point:**
- Latitude: 26.5°N
- Longitude: 54.0°E
- Location: Central Persian Gulf

**Bearing Convention:**
- 000° = North
- 090° = East
- 180° = South
- 270° = West
- True bearing (not magnetic)

**Range Units:**
- Nautical Miles (NM)
- 1 NM = 1.852 kilometers
- 1 NM = 1.15078 statute miles

### B. Flight Level Conversion

Flight Level (FL) = Altitude in feet / 100

Examples:
- 25,000 feet = FL250
- 30,000 feet = FL300
- 35,000 feet = FL350

### C. Typical Aircraft Performance

| Aircraft Type | Typical Speed | Typical Altitude |
|---------------|---------------|------------------|
| Fighter (F-16) | 400-500 KTAS | FL250-FL400 |
| Fighter (MIG-29) | 450-550 KTAS | FL280-FL450 |
| Interceptor | 500-600 KTAS | FL300-FL500 |
| Patrol | 250-350 KTAS | FL200-FL300 |

### D. Training Scenarios

**Basic Intercept:**
- 2 assets: 1 friendly, 1 hostile
- Friendly intercepts hostile
- Practice: Vectoring, speed control

**CAP Scenario:**
- Multiple friendlies on patrol
- Hostile penetration
- Practice: Coordination, prioritization

**Multi-Threat:**
- Multiple hostile assets
- Limited friendly assets
- Practice: Threat assessment, asset allocation

### E. Glossary

- **AIC**: Air Intercept Controller
- **BE**: Bullseye (reference point)
- **BRG**: Bearing (direction in degrees)
- **CAP**: Combat Air Patrol
- **FL**: Flight Level
- **KTAS**: Knots True Airspeed
- **MIL-STD-2525**: Military Standard for tactical symbols
- **NM**: Nautical Mile
- **RNG**: Range (distance in nautical miles)
- **TN**: Track Number
- **WP**: Waypoint

---

## Version 2.0 Updates

### New Features (January 2026)

#### Bullseye Customization
- Click bullseye symbol to select and edit
- Custom name field in control panel
- Name appears on map label (e.g., "VEGAS" instead of "BE")
- Name appears in position displays ("FROM VEGAS" instead of "FROM BULLSEYE")
- Visual selection ring when bullseye is selected
- Persists in save/load scenarios

#### Radar Return System
- Simulated radar returns appear every 10 seconds
- White circular dots (4px radius, 70% opacity)
- Fade linearly over 30 seconds
- Positioned beneath asset symbols
- Pause-aware: returns freeze when simulation paused
- Show historical track trail for situational awareness
- Based on mission time, not real-world time

#### Mission Time Display
- HH:MM:SS format in top status bar
- Counts up while simulation running
- Fixed-width display prevents layout shifts
- Resets with RESTART button
- Persists in save/load scenarios
- Pauses when simulation paused

#### MIL-STD-2525 Symbology
- Aircraft symbols now use military standard (top-half only)
- Friendly: semicircle (top half of circle)
- Hostile: triangle (top half of diamond)
- Neutral/Unknown: square top (top half of square)
- Maintains color coding for quick identification

### UI/UX Improvements

#### Visual Enhancements
- Removed green radial gradient from map background
- Clean solid black background for better contrast
- Selection ring indicators for bullseye and assets
- Temp mark clears automatically when selecting objects
- Identity field label (changed from "Type")

#### Control Panel Updates
- File management (SAVE/LOAD) only visible before starting
- Bullseye editor panel when bullseye selected
- Asset list hidden when asset or bullseye selected
- Improved panel state management
- Better visual hierarchy

#### Interaction Improvements
- Drag selected assets to reposition on map
- Click detection improved for bullseye selection
- Prevent accidental temp mark placement on selections
- Smoother asset selection workflow

### Technical Improvements
- Mission time uses 1-second interval for accuracy
- Radar returns use mission time for pause compatibility
- Fixed dependency arrays to prevent interval recreation
- Optimized state updates for radar return cleanup
- Improved save/load data structure

---

## Document Metadata

**Document Version**: 2.0
**Application Version**: 2.0
**Created**: December 30, 2025
**Last Updated**: January 3, 2026
**Author**: AIC Simulator Development Team
**Status**: Production

---

**End of Document**
