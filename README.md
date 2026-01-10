# AIC Simulator - Air Intercept Control Training

A web-based tactical air intercept control training application designed for military aviation students to practice real-time air operations in the Persian Gulf region.

## Quick Start

### Option 1: Using the Start Server Script (Recommended)

1. **Double-click** `start-server.bat` in the AIC Simulator v2 folder
2. The simulator will automatically open in your default browser
3. Start creating scenarios by clicking "+ ADD ASSET" or right-clicking on the map
4. Click "PLAY" to start the physics simulation
5. When finished, close the browser and press Ctrl+C in the command window

**Note**: This requires either Python 3 or Node.js installed on your computer. If you don't have either:
- Download Python from https://www.python.org/downloads/
- Or download Node.js from https://nodejs.org/

### Option 2: Manual Python Server

1. Open Command Prompt in the simulator folder
2. Run: `python -m http.server 8000`
3. Open your browser to: http://localhost:8000
4. Press Ctrl+C in the command prompt when done

### Why Use a Server?

Modern browsers block loading local JavaScript files for security reasons (CORS policy). Running a local web server solves this issue.

## Basic Controls

### Mouse Controls
- **Left-click on asset**: Select asset to view/edit details
- **Left-click on geo-point**: Select geo-point to view/edit details
- **Left-click on shape**: Select shape to view/edit details
- **Left-click on bullseye**: Select bullseye to customize name
- **Left-click on empty space**: Place yellow reference mark
- **Right-click**: Open context menu (add assets, geo-points, shapes, waypoints, etc.)
- **Click + Drag**: Pan the map view
- **Mouse Wheel**: Zoom in/out (10-360 NM scale)
- **Drag waypoint markers**: Reposition waypoints
- **Drag assets**: Reposition selected asset on map
- **Drag geo-points**: Reposition selected geo-point on map
- **Drag shape points**: Reposition individual line segment points
- **Drag shapes**: Reposition entire shape on map

### Keyboard Controls
- **ESC**: Open pause menu
- **Enter**: Apply value changes (heading, speed, altitude, geo-point coordinates, shape point coordinates)

### Playback Controls
- **PLAY/PAUSE**: Toggle simulation running state
- **RESTART**: Reset simulation to initial state

## Creating and Managing Assets

### Add Asset
**Method 1**: Click "+ ADD ASSET" button in control panel
- Fill in asset details (name, identity, domain, heading, speed, altitude/depth)
- Asset appears at bullseye by default

**Method 2**: Right-click on map
- Hover over "Create Asset"
- Select domain from submenu (Air, Surface, or Sub-Surface)
- Asset appears at clicked location

### Asset Domains
Assets are organized by operational domain with domain-specific symbology and constraints:

**Air Domain**
- MIL-STD-2525 symbology: Top-half shapes (semicircle, triangle, square top)
- Maximum speed: 999 knots
- Turn rate: 15°/second (standard rate)
- Speed change: 10 knots/second
- Has altitude attribute (displayed as Flight Level)

**Surface Domain**
- MIL-STD-2525 symbology: Whole shapes (full circle, diamond, square)
- Maximum speed: 30 knots
- Turn rate: 1°/second
- Speed change: 2 knots/second
- No altitude attribute

**Sub-Surface Domain**
- MIL-STD-2525 symbology: Bottom-half shapes (inverted semicircle, triangle, square bottom)
- Maximum speed: 30 knots
- Turn rate: 1°/second
- Speed change: 2 knots/second
- Has depth attribute (displayed in feet)
- Depth change: 10 feet/second

### Asset Identities
Each asset can have one of five identity types (same across all domains):
- **Friendly** (Light Blue): Allied forces
- **Hostile** (Red): Enemy forces
- **Neutral** (Green): Non-combatants
- **Unknown** (Yellow): Unidentified, evaluated
- **Unknown Unevaluated** (Orange): Unidentified, not evaluated

### Platform Assignment
Platforms allow you to assign specific aircraft, ships, or submarines to assets with realistic performance characteristics and capabilities.

**Creating Asset with Platform**:
1. Right-click on map
2. Hover over "Create Asset"
3. Click desired domain (Air, Surface, Sub-Surface)
4. A platform selection dialog will appear
5. Select platform from the list or "None (Generic)" for unspecified platform

**Available Platforms** (configurable via platforms.json):

**Air Platforms**:
- Fighter aircraft: F-16C, FA-18E, F-15C, F-22A, F-35A, MiG-29, Su-27, Su-35, J-20, Rafale, Eurofighter Typhoon
- AWACS: E-2D Hawkeye, E-3 Sentry
- Support: KC-135 Stratotanker
- Strike: B-52H, A-10C

**Surface Platforms**:
- Destroyers: Arleigh Burke (DDG), Ticonderoga (CG), Type 052D, Type 055, Slava
- Cruisers: Kirov (CGN)
- Carriers: Nimitz CVN, Admiral Kuznetsov
- Frigates: FREMM Frigate, LCS Freedom
- Small craft: Patrol Boat, Fast Attack Craft

**Sub-Surface Platforms**:
- Nuclear submarines: Virginia SSN, Los Angeles SSN, Seawolf SSN, Akula SSN, Yasen SSGN, Type 093 SSN, Type 095 SSN, Astute SSN, Barracuda SSN
- Diesel submarines: Kilo SSK, Type 212 SSK
- Missile submarines: Ohio SSGN

**Platform Specifications**:
Each platform defines:
- **Max Speed**: Platform maximum velocity in knots
- **Max Altitude**: Ceiling for air platforms (feet)
- **Max Climb**: Maximum climb rate (feet/minute)
- **Max Turn**: Turn rate (degrees/second)
- **Weapons**: Available weapon systems (missiles, torpedoes, bombs)
- **Emitters**: Radar and sensor systems

When a platform is assigned:
- Speed limits automatically apply based on platform max speed
- Altitude limits apply based on platform ceiling
- Turn rates use platform-specific agility
- Climb rates use platform-specific performance
- Platform name is shown in the "SELECTED ASSET" panel

**Changing Platform**:
1. Select asset
2. Choose new platform from "Platform" dropdown in control panel
3. Platform constraints apply automatically

**Developer Note**: Add custom platforms by editing [platforms.json](platforms.json) with the same attribute structure.

### Edit Asset
1. Select asset by clicking on it
2. Modify properties in "SELECTED ASSET" panel:
   - **Name**: Custom identifier
   - **Identity**: Friendly, Hostile, Neutral, Unknown, Unknown Unevaluated
   - **Domain**: Air, Surface, or Sub-Surface (cannot change for Ownship)
   - **Platform**: Select specific platform or "None (Generic)" (changes platform constraints apply automatically)
   - **Heading**: Direction in degrees (0-359)
   - **Speed**: Velocity in knots (max varies by domain/platform)
   - **Altitude**: For air domain only (in feet, displayed as FL)
   - **Depth**: For sub-surface domain only (in feet)
3. For heading/speed/altitude/depth: Enter value and press Enter or click SET
4. Changes apply gradually at domain/platform-specific realistic rates
5. Platform specifications (max speed, altitude, turn rate, weapons, emitters) are displayed when a platform is assigned

### Report Track
1. Select an asset
2. Click "REPORT TRACK" button
3. Assigns track number (TN#6000, 6001, etc.)

## Navigation and Waypoints

### Create Waypoints
1. Select an asset
2. Right-click on desired location
3. Choose "Go To" (first waypoint) or "Add Waypoint" (additional)

### Waypoint Behavior
- Asset automatically turns toward first waypoint
- Arrives when within 0.5 NM
- Automatically proceeds to next waypoint
- Visual path shown with dashed lines

### Delete Waypoint
- Right-click on waypoint marker
- Select "Delete Waypoint"

## Geo-Points

Geo-points are fixed reference locations on the map used for navigation, threat tracking, and operational planning.

### Create Geo-Point
1. Right-click on desired map location
2. Hover over "Create Geo-Point"
3. Select geo-point type from submenu:
   - **CAP Station**: Combat Air Patrol station (crosshair symbol)
   - **Airfield**: Airport or airbase (parallel lines symbol)
   - **SAM Site**: Surface-to-Air Missile site (triangle symbol)
   - **Mark**: General reference point (rectangle with bracket symbol)

### Geo-Point Properties
Each geo-point has customizable attributes:
- **Name**: Custom label (blank by default)
- **Type**: CAP Station, Airfield, SAM Site, or Mark
- **Identity**: Friendly, Hostile, Neutral, Unknown, or Unknown Unevaluated
- **Coordinates**: Latitude and Longitude (editable)

### Edit Geo-Point
1. Click on geo-point to select it
2. Modify properties in "GEO-POINT" panel:
   - Enter custom name
   - Change type from dropdown
   - Change identity (affects color)
   - Edit coordinates (press Enter to apply changes)
3. Drag geo-point to reposition on map

### Geo-Point Identity Colors
Geo-points use the same color coding as assets:
- **Friendly** (Light Blue): Allied locations
- **Hostile** (Red): Enemy locations
- **Neutral** (Green): Non-combatant locations
- **Unknown** (Yellow): Identified, under evaluation
- **Unknown Unevaluated** (Orange): Not yet evaluated

### Delete Geo-Point
**Method 1**: Right-click on geo-point and select "Delete Geo-Point"
**Method 2**: Select geo-point and click "DELETE GEO-POINT" button in control panel

### Geo-Point Uses
- **CAP Stations**: Define patrol areas for fighters
- **Airfields**: Mark friendly/hostile airbases
- **SAM Sites**: Track surface threats
- **Marks**: General reference points for navigation

## Shapes

Shapes are tactical drawing tools that allow you to create visual representations on the map for mission planning, threat zones, and operational boundaries.

### Create Shape

1. Right-click on desired map location
2. Hover over "Create Shape"
3. Select shape type from submenu:
   - **Line Segment**: Multi-point connected lines
   - **Circle**: Circular area with customizable radius

### Shape Types

**Line Segment**
- Create by clicking multiple points on the map
- Press "APPLY" when finished (minimum 2 points required)
- Each point can have a custom name (optional)
- Names display above points on the map
- Perfect for: flight paths, boundaries, threat corridors

**Circle**
- Created instantly at clicked location
- Default radius: 10 NM
- Radius adjustable in control panel
- Perfect for: engagement zones, no-fly areas, CAP stations

### Shape Properties

All shapes have customizable attributes:
- **Identity**: Friendly, Hostile, Neutral, Unknown, or Unknown Unevaluated
- **Color**: Matches identity (same as assets and geo-points)
- **No Name**: Shapes themselves don't have names (line segment points can be named)

### Edit Shape - Line Segments

1. Click on line segment to select it
2. Modify properties in "SHAPE" panel:
   - Change identity (affects color)
   - Edit individual point names
   - Edit point coordinates (press Enter to apply)
   - Add new points with "+ ADD POINT" button
3. Drag individual points to reposition on map
4. Drag anywhere on the line to move entire shape

### Edit Shape - Circles

1. Click on circle edge to select it
2. Modify properties in "SHAPE" panel:
   - Change identity (affects color)
   - Edit center coordinates
   - Adjust radius (in nautical miles)
3. Drag circle (by edge) to reposition on map

### Shape Interaction

- **Select**: Click on shape edge (circles) or points (line segments)
- **Drag Points**: Click and drag individual line segment points
- **Drag Shape**: Click and drag to move entire shape
- **Delete**: Right-click on shape and select "Delete Shape", or use DELETE SHAPE button

### Shape Identity Colors

Shapes use the same color coding as assets and geo-points:
- **Friendly** (Light Blue): Allied areas
- **Hostile** (Red): Enemy areas/threats
- **Neutral** (Green): Non-combatant zones
- **Unknown** (Yellow): Unidentified areas
- **Unknown Unevaluated** (Orange): Not yet evaluated

### Shape Uses

- **Line Segments**: Flight corridors, threat axes, patrol routes, boundaries
- **Circles**: Engagement zones, CAP stations, SAM ranges, no-fly zones
- **Mission Planning**: Pre-brief tactical overlays
- **Threat Depiction**: Show enemy SAM ranges, fighter CAPs
- **Friendly Boundaries**: Delineate operational areas

## Position Information

### Cursor Display (Bottom Left)
- **Green Box**: Bearing/Range from Bullseye
- **Yellow Box**: Bearing/Range from Mark, Selected Asset, or Selected Geo-Point
- Format: BRG/RNG (e.g., "304/52" = 304° at 52 NM)
- When geo-point is selected, displays "FROM GEO-POINT" or geo-point name

### Bullseye Reference Point
- Location: 26.5°N, 54.0°E (Central Persian Gulf)
- Marked with green crosshair symbol (labeled "BE" or custom name)
- All positions referenced from this point
- Click bullseye to customize its name (e.g., "VEGAS", "ALPHA")
- Custom name appears in position displays and on map

## Save and Load Scenarios

### Save Options
**Option 1: Save to Application**
- Stores in browser localStorage
- Quick access for practice sessions
- Note: Cleared if browser data is cleared

**Option 2: Download to Computer**
- Saves as JSON file
- Shareable with instructors/students
- Permanent backup

### Load Options
- Load from application: Select from saved scenarios list
- Load from computer: Choose .json file from your computer

## Recording Sessions

### Start Recording
1. Click "○ RECORD" button
2. Grant screen capture and microphone permissions
3. Select which screen/window to capture
4. Recording indicator shows elapsed time

### Stop Recording
1. Click "● REC" button while recording
2. Video file automatically downloads as .webm format
3. Review your AIC performance

**Note**: Recording requires Chrome or Edge browser

## Flight Dynamics

### Realistic Movement Rates

**Air Domain Assets:**
- **Heading changes**: 15°/second (standard rate turn)
- **Speed changes**: 10 knots/second
- **Altitude changes**: 6,000 feet/minute (100 ft/sec)
- **Maximum speed**: 999 knots

**Surface Domain Assets:**
- **Heading changes**: 1°/second
- **Speed changes**: 2 knots/second
- **Maximum speed**: 30 knots

**Sub-Surface Domain Assets:**
- **Heading changes**: 1°/second
- **Speed changes**: 2 knots/second
- **Depth changes**: 600 feet/minute (10 ft/sec)
- **Maximum speed**: 30 knots

### Physics Simulation
- 60 Hz update rate for smooth movement
- Haversine formula for accurate lat/lon calculations
- Automatic waypoint arrival detection
- Maintains fractional precision for smooth transitions

### Radar Returns
- White dots appear under each asset every 10 seconds while running
- Fade over 30 seconds with realistic decay
- Pausing simulation freezes radar returns
- Shows historical track trail for situational awareness

## Typical Training Scenarios

### Basic Intercept
1. Create one friendly fighter (400 KTAS, FL250)
2. Create one hostile aircraft (450 KTAS, FL280)
3. Practice vectoring friendly to intercept hostile
4. Use bearing/range calls from bullseye

### Combat Air Patrol (CAP)
1. Create multiple friendly assets on patrol routes
2. Add hostile penetrating the area
3. Practice coordinating multiple assets
4. Assign priorities and manage engagements

### Multi-Threat
1. Create multiple hostile assets from different vectors
2. Limited friendly assets to manage
3. Practice threat assessment
4. Allocate assets efficiently

## Tips for Students

1. **Use the bullseye system**: All position calls reference the bullseye (BE)
2. **Report tracks early**: Assign track numbers to maintain situational awareness
3. **Plan ahead**: Set waypoints in advance to reduce workload
4. **Use reference marks**: Place marks to measure distances quickly
5. **Practice standard phraseology**: Record sessions to review communication
6. **Save scenarios**: Build a library of training scenarios for different situations

## Tips for Instructors

1. **Pre-build scenarios**: Create and save standard training scenarios
2. **Share files**: Distribute .json scenario files to students
3. **Review recordings**: Have students record sessions for after-action review
4. **Progressive difficulty**: Start simple, add complexity gradually
5. **Realistic parameters**: Use appropriate speeds/altitudes for aircraft types

## Keyboard Shortcuts Summary

| Key | Action |
|-----|--------|
| ESC | Pause menu |
| Enter | Apply input value |
| Mouse Wheel | Zoom in/out |

## Browser Compatibility

- ✅ **Google Chrome 90+** (Recommended)
- ✅ **Microsoft Edge 90+** (Recommended)
- ⚠️ **Firefox 88+** (Limited recording support)
- ❌ **Safari** (No recording support)

## Troubleshooting

### Assets not moving
- Ensure simulation is in PLAY mode (● RUNNING indicator)
- Check that asset has speed > 0
- Verify heading is set

### Recording not working
- Use Chrome or Edge browser
- Grant screen capture permissions when prompted
- Grant microphone permissions for audio

### Scenario won't load
- Ensure file is valid JSON format
- Check file was saved from AIC Simulator
- Try loading a different scenario to test

### Map is blank
- Try zooming out (scroll mouse wheel down)
- Click RESTART to reset view
- Check scale indicator (should be 10-360 NM)

## System Requirements

- **Browser**: Chrome 90+ or Edge 90+
- **Display**: 1920x1080 or higher recommended
- **RAM**: 4 GB minimum, 8 GB recommended
- **Processor**: Dual-core 2.0 GHz or higher

## Support

For issues or questions, refer to the complete documentation in `AIC-SIMULATOR-DOCUMENTATION.md`

## Version

**Version**: 2.4
**Last Updated**: January 10, 2026
**Status**: Production Ready

## Recent Updates

### Version 2.4 (January 2026)

#### Sonobuoy Anti-Submarine Warfare System
- **SONOBUOY Deployment System**: Active submarine detection and tracking
  - SONO tab in SYSTEMS section with tri-color state indicator
    - RED: System powered OFF
    - YELLOW: System ON, master arm SAFE
    - GREEN: System ON, master arm ARMED
  - Power ON/OFF toggle for sonobuoy system
  - 3D master arm switch with safety guard
    - Realistic toggle switch with red safety cover
    - Guard must be lifted before switch can be armed
    - 3D perspective effects with metallic styling
    - Yellow/black hazard stripe background panel
    - Red indicator light illuminates when armed
    - Closing guard automatically returns switch to SAFE
  - 30 sonobuoys available per mission
  - DEPLOY button (requires: Power ON + Armed + Buoys remaining)
  - Color-coded buoy counter (green >10, yellow 1-10, red 0)
  - Deployed buoys list with elapsed time display

- **Submarine Detection**:
  - Automatic detection of submarines within 4nm range
  - Red bearing lines from sonobuoy to submarine direction
  - Bearing lines update continuously while submarine in range
  - Lines disappear immediately when submarine exits 4nm range
  - Multiple sonobuoys can detect same submarine independently
  - Submarines deeper than 15 feet invisible to radar/IFF (fully submerged)

- **Sonobuoy Visualization**:
  - Light blue sonobuoy symbols on map
  - Circle with vertical line and horizontal flag design
  - Serial number labels (S01, S02, etc.)
  - Visible at all zoom levels
  - No radar returns generated for sonobuoys
  - Buoys operate indefinitely (no battery limit)

#### Enhanced Zoom System
- **5nm Minimum Zoom**: Reduced from 10nm to 5nm for closer tactical view
- **Yard Display at 5nm**: Distance measurements converted to yards at closest zoom
  - FROM MARK displays in yards (XXX/YYYY yds format)
  - FROM BULLSEYE remains in nautical miles at all zoom levels
  - Conversion: 1 nautical mile = 2025.37 yards
  - FROM MARK returns to nautical miles at zoom levels >5nm

#### Bug Fixes & Improvements
- Fixed depth display to show whole feet only (no decimal places)
- Subsurface assets deeper than 15ft no longer produce radar or IFF returns
- Improved SONO tab layout with proper spacing
- SYSTEMS tabs reorganized into two rows for better organization

### Version 2.3 (January 2026)
- **Platform System**: Assign specific aircraft, ships, and submarines to assets
  - Platform configuration file ([platforms.json](platforms.json)) with 40+ military platforms
  - Three-level context menu: Create Asset → Domain → Platform selection
  - Air platforms: F-16C, FA-18E, F-15C, F-22A, F-35A, MiG-29, Su-27, Su-35, J-20, Rafale, Eurofighter, E-2D, E-3, KC-135, B-52H, A-10C
  - Surface platforms: Arleigh Burke, Ticonderoga, Nimitz CVN, Type 052D, Type 055, Slava, Kirov, Admiral Kuznetsov, FREMM, LCS Freedom, and more
  - Sub-surface platforms: Virginia SSN, Los Angeles SSN, Seawolf SSN, Ohio SSGN, Kilo SSK, Akula SSN, Yasen SSGN, Type 093/095 SSN, Astute SSN, and more
  - Platform-specific performance constraints: max speed, max altitude, turn rate, climb rate
  - Platform weapons and emitters displayed in asset panel
  - Physics engine uses platform-specific turn rates and climb rates
  - Developer-configurable: add custom platforms via JSON file
  - Platform specifications panel shows real-time capabilities
  - Automatic speed/altitude limiting based on platform constraints

### Version 2.2 (January 2026)
- **Domain-Based Asset System**: Multi-domain operations with Air, Surface, and Sub-Surface assets
  - Three operational domains with domain-specific MIL-STD-2525 symbology
  - Air: Top-half symbols, 999kt max speed, 15°/sec turn rate, altitude attribute
  - Surface: Whole symbols, 30kt max speed, 1°/sec turn rate, no altitude
  - Sub-Surface: Bottom-half symbols, 30kt max speed, 1°/sec turn rate, depth attribute
  - Domain selector in asset editor panel with live domain switching
  - Conditional UI fields (altitude for air, depth for sub-surface)
  - Domain-aware physics engine with appropriate movement constraints
  - "Create Asset" context menu with domain submenu selection
  - Depth display for submarines (feet), flight level for aircraft
- **High-Resolution Map**: Enhanced Persian Gulf cartography with detailed coastlines and islands
  - Imported high-resolution coastline data from KML source
  - Added 10 major islands including Bahrain, Qeshm, Abu Musa, and smaller islands
  - Outline-only rendering style for islands matching coastline appearance
  - Hundreds of precise coordinate points for accurate geographic representation
  - Improved tactical situational awareness with realistic geography
- **Shapes System**: Tactical drawing tools for mission planning and threat depiction
  - Two shape types: Line Segment (multi-point paths) and Circle (range rings)
  - Multi-point line segment creation with interactive Apply/Cancel workflow
  - Individual point naming for line segments (optional, blank by default)
  - Point names display above points on the map
  - Drag individual line segment points to reposition
  - Drag entire shapes to relocate
  - Circle selection by edge (no center dot for cleaner appearance)
  - "+ ADD POINT" button to extend line segments
  - Editable coordinates with Enter-to-apply (consistent with geo-points)
  - Fully editable properties: identity, coordinates, radius (circles)
  - Identity-based color coding matching assets and geo-points
  - Integrated with save/load system
  - Right-click context menu with Create Shape submenu
  - SHAPE editor panel with scrollable point list

### Version 2.1 (January 2026)
- **Geo-Points System**: Fixed reference locations for tactical planning
  - Four geo-point types: CAP Station, Airfield, SAM Site, Mark
  - Custom SVG symbols for each type (crosshair, parallel lines, triangle, rectangle)
  - Fully editable properties: name, type, identity, coordinates
  - Right-click context menu with type submenu
  - Drag-and-drop repositioning
  - Identity-based color coding (friendly/hostile/neutral/unknown)
  - Integrated with save/load system
  - Cursor position display shows bearing/range from selected geo-point
  - Coordinates editable with Enter key confirmation
  - SYSTEMS section auto-hides when geo-point or shape selected for cleaner UI

### Version 2.0 (January 2026)

#### Core Systems
- **Ownship Asset**: Dedicated ownship aircraft (gray circle with crosshair symbol)
  - Spawns 50 NM south of bullseye on initial load
  - Maximum speed: 220 knots, Maximum altitude: 27,000 feet
  - Cannot be deleted or created by user (always present)
  - Full waypoint and control support like other assets
- **MIL-STD-2525 Symbology**: Aircraft symbols now use military standard (top-half only)
- **Bullseye Customization**: Click bullseye to set custom name (e.g., "VEGAS")
- **Mission Time Clock**: HH:MM:SS display shows elapsed mission time
- **Improved Asset Dragging**: Drag selected assets to reposition on map
- **Selection Indicators**: Visual feedback when bullseye or assets are selected

#### Sensor Systems
- **Radar Sweep System**: Realistic rotating radar sweep from ownship
  - 360° rotation every 10 seconds
  - 320 NM maximum range
  - 40-degree sweep trail with 60-segment smooth gradient
  - Sweep-based radar return generation
- **Realistic Radar Returns**: Advanced radar physics simulation
  - Banana-shaped returns with azimuth spreading (increases with distance)
  - Distance-based resolution degradation (farther = longer returns)
  - Stationary fuzziness/noise for realistic appearance
  - Zoom-adaptive density (more segments when zoomed in)
  - Radar horizon calculation: d = 1.23 × (√h_radar + √h_target)
  - Surface/subsurface targets limited by horizon (h_target = 0)
  - Air targets detected based on altitude
  - Returns align precisely with track symbols
- **Radar Controls Panel**: Adjustable radar settings
  - ON/OFF toggle for radar system (red when disabled)
  - Sweep opacity control (0-100% in 1% increments)
  - Return decay time (10-60 seconds in 1-second increments)
  - Return intensity control (1-100% in 1% increments)
  - Access via RADAR button in SYSTEMS section
  - Radar returns decay naturally when radar is turned off
  - New returns only generate when radar is enabled
- **ESM (Electronic Support Measures) System**: Passive emitter detection and tracking
  - ON/OFF toggle for ESM system
  - Automatic detection of active radar emitters within 320 NM
  - Orange lines of bearing (LOB) from ownship to detected emitters
  - Gray LOB and labels for inactive emitters (last seen position)
  - ESM contact labels (E01, E02, etc.) with white border when selected
  - Serial number labels displayed in orange for auto-detected emitters
  - Serial number labels displayed in cyan for manual bearing lines (M01, M02, etc.)
  - Emitter names shown in 12px font for better readability
  - VIS checkbox per emitter to show/hide individual LOBs
  - AGE timer (MM+SS format) tracks time since last detection
    - Right-justified display with 12px bold font
    - Green color when emitter is active (00+00)
    - Red color when timer counts up (inactive emitters)
  - Bearing information displayed in 10px font
  - Threat level sorting: Level 1 (enemy) at top, then 2 (friendly), then 3 (civilian)
  - Manual bearing lines for triangulation
    - Manual lines create fixed reference snapshots from ownship position
    - Cyan dashed styling for manual lines vs orange/gray auto lines
    - Right-click context menu to delete manual bearing lines
    - Click manual line to select and open ESM tab
  - BEARING LINE button to create manual bearing snapshots
  - Clicking ESM emitter label on map opens ESM tab in SYSTEMS section
  - ESM list displays both auto-detected emitters and manual lines
  - Bearing lines dynamically recalculate as ownship moves
  - Access via ESM tab in SYSTEMS section
- **EO/IR (Electro-Optical/Infrared) System**: Visual imaging of platform targets
  - EO/IR button displayed in asset control panel for platforms with images
  - Click EO/IR button to open popup window with platform image
  - Draggable window: Click and drag header bar to reposition
  - Resizable window: Drag edges/corners to adjust size
  - Minimum window size: 300px × 200px
  - Default size: 400px × 500px
  - Image scales to fit window with proper aspect ratio (object-fit: contain)
  - Close button (×) to dismiss window
  - Only available for platforms with assigned image files
  - Platform images stored in EO-IR/ folder

#### Communications & Identification Systems
- **IFF (Identify Friend or Foe) System**: Interrogation and identification system
  - ON/OFF toggle for IFF system (OFF by default)
  - Ownship IFF code configuration (MODE I, II, III, IV)
  - MODE I: 2-digit octal code (0-7)
  - MODE II: 4-digit octal code (0-7)
  - MODE III: 4-digit octal code (0-7)
  - MODE IV: ON/OFF encrypted mode
  - Per-asset IFF configuration with squawk toggle
  - Auto-padding: partial codes filled with zeros (e.g., "7" → "07", "12" → "0012")
  - IFF codes displayed on map when squawking (M1:, M2:, M3:, ALT:)
  - Neon green IFF returns overlay radar returns
  - IFF returns offset toward ownship to prevent overlap with radar
  - Return intensity control (1-100% in 1% increments)
  - Uses same radar horizon physics as radar system
  - 320 NM maximum interrogation range
  - Access via IFF button in SYSTEMS section
- **Datalink System**: Tactical data link network for track sharing
  - ON/OFF toggle for datalink system
  - NET configuration (1-127)
  - JU (Joint Unit) code (5 digits)
  - Track block assignment (start/end ranges, 5 digits each)
  - Automatic track number assignment from available block
  - Automatic identity assignment (assets on same NET become friendly)
  - Per-asset datalink configuration
  - Track numbers displayed on map (TN#XXXXX)
  - Report track function to add assets to datalink
  - Access via DATALINK button in SYSTEMS section

### Platform Database
- **31 Military Platforms** across air, surface, and subsurface domains
  - **Air Domain (13 platforms)**:
    - US/Allied: F-18E, F-18F, F-16, F-15, F-5, F-4, F-14, P-3
    - Enemy: MiG-21, MiG-29, Su-24, Tu-95
    - Civilian: Com-Air (commercial aircraft)
  - **Surface Domain (16 platforms)**:
    - US/Allied: Perry FFG
    - Enemy: Combattante, Houdong, Huangfen, Krivak, Najin, Nanuchka, Osa, Sovremenny, Udaloy
    - Civilian: Container-Ship, Dhow, Cruise-Ship, Oil-Tanker, Fishing-Vessel, Freighter
  - **Sub-Surface Domain (2 platforms)**:
    - Enemy: Kilo, Romeo (diesel-electric submarines)
- **Platform Attributes**:
  - Name, domain, weapons loadout, emitters (radar systems)
  - Performance: max speed, max altitude/depth, climb rate, turn rate
  - Image file for EO/IR visual identification
  - Threat level classification (1=enemy, 2=friendly, 3=civilian)
- **Threat Level System**:
  - Level 1 (Enemy): Soviet/Russian/Chinese military platforms - highest priority
  - Level 2 (Friendly): US/Allied military platforms - medium priority
  - Level 3 (Civilian): Commercial vessels and aircraft - lowest priority
  - Used for automatic sorting in ESM contacts list
  - Enables threat-based prioritization and filtering

### UI Improvements
- SYSTEMS section added under PLAYBACK controls
- RADAR control panel integrates with existing UI pattern
- ESM control panel with tabbed interface (RADAR/ESM/IFF/DATALINK)
- IFF control panel with ownship code configuration
- DATALINK control panel with NET/JU/Track Block configuration
- Tabbed asset control panel (GENERAL, IFF, DATALINK, EMITTER)
- Blue text indicators for uncommitted values (press Enter to commit)
- Dynamic label positioning on map (no gaps when fields are blank)
- Fixed mission time box width to prevent layout shifts
- Removed green glow from map background for cleaner display
- Temp mark now clears when selecting assets or bullseye
- Identity field (formerly "Type") for clearer terminology
- File management only visible before simulation starts
- Custom slider styling with green glow effects
- EO/IR popup window with drag-and-drop and resize functionality
- Enhanced ESM tab with improved typography and color-coded age display
- Clicking ESM labels on map opens ESM tab (not duplicate panel)
- Null-safe rendering prevents crashes when selecting assets without platforms

---

**Good hunting, Controllers!** 🎯
