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

### Edit Asset
1. Select asset by clicking on it
2. Modify properties in "SELECTED ASSET" panel:
   - **Name**: Custom identifier
   - **Identity**: Friendly, Hostile, Neutral, Unknown, Unknown Unevaluated
   - **Domain**: Air, Surface, or Sub-Surface (cannot change for Ownship)
   - **Heading**: Direction in degrees (0-359)
   - **Speed**: Velocity in knots (max varies by domain)
   - **Altitude**: For air domain only (in feet, displayed as FL)
   - **Depth**: For sub-surface domain only (in feet)
3. For heading/speed/altitude/depth: Enter value and press Enter or click SET
4. Changes apply gradually at domain-specific realistic rates

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

**Version**: 2.2
**Last Updated**: January 4, 2026
**Status**: Production Ready

## Recent Updates

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
- **Ownship Asset**: Dedicated ownship aircraft (gray circle with crosshair symbol)
  - Spawns 50 NM south of bullseye on initial load
  - Maximum speed: 220 knots, Maximum altitude: 27,000 feet
  - Cannot be deleted or created by user (always present)
  - Full waypoint and control support like other assets
- **Radar Sweep System**: Realistic rotating radar sweep from ownship
  - 360° rotation every 10 seconds
  - 320 NM maximum range
  - 40-degree sweep trail with 60-segment smooth gradient
  - Sweep-based radar return generation
- **Radar Controls Panel**: Adjustable radar settings
  - ON/OFF toggle for radar system (red when disabled)
  - Sweep opacity control (0-100% in 1% increments)
  - Return decay time (10-60 seconds in 1-second increments)
  - Access via RADAR button in SYSTEMS section
  - Radar returns decay naturally when radar is turned off
  - New returns only generate when radar is enabled
- **Bullseye Customization**: Click bullseye to set custom name (e.g., "VEGAS")
- **Radar Returns**: Simulated radar returns synchronized with sweep rotation
- **Mission Time Clock**: HH:MM:SS display shows elapsed mission time
- **MIL-STD-2525 Symbology**: Aircraft symbols now use military standard (top-half only)
- **Improved Asset Dragging**: Drag selected assets to reposition on map
- **Selection Indicators**: Visual feedback when bullseye or assets are selected

### UI Improvements
- SYSTEMS section added under PLAYBACK controls
- RADAR control panel integrates with existing UI pattern
- Fixed mission time box width to prevent layout shifts
- Removed green glow from map background for cleaner display
- Temp mark now clears when selecting assets or bullseye
- Identity field (formerly "Type") for clearer terminology
- File management only visible before simulation starts
- Custom slider styling with green glow effects

---

**Good hunting, Controllers!** 🎯
