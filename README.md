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

**Antivirus Warning**: Some antivirus software may block or quarantine `start-server.bat` shortly after it runs. If you experience issues (such as images not loading or the app behaving unexpectedly):
1. Add an exception for `start-server.bat` in your antivirus software
2. Close the command window running the server
3. Double-click `start-server.bat` again to restart

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
| SPACEBAR (hold) | Push-to-talk radio transmission (student mode) |
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

**Version**: 3.4
**Last Updated**: February 7, 2026
**Status**: Production Ready

## Recent Updates

### Version 3.4 (February 2026)

#### AW (Alpha Whiskey) Communication System
- **Check Print Voice Command**: Request track identification from Air Defense Warfare Commander
  - Format: "Alpha Whiskey, [callsign], Track [number], check print Line [1/8/9], recommend hostile, over"
  - Supports multiple tracks: "Track 6001, Track 6002" or "Tracks 6001, 6002"
  - Check Print Lines:
    - **Line 1**: Electronic Support (ES) - radar emissions detected
    - **Line 8**: No IFF - target not squawking
    - **Line 9**: VID - visual identification
  - AW responds with identity assignment based on Warning Weapon Status

- **Warning Weapon Status (WWS) Identity Rules**:
  | WWS Status | Line 1 + Line 8 (ES + No IFF) | Line 8 Only (No IFF) | Line 9 (VID) |
  |------------|-------------------------------|---------------------|--------------|
  | White/Safe | Bandit | Unknown | Unknown |
  | Yellow/Tight | Hostile | Unknown | Hostile |
  | Red/Tight | Hostile | Unknown | Hostile |

- **Scenario Settings** (Pause Menu → SCENARIO):
  - Warning Weapon Status selector (White/Safe, Yellow/Tight, Red/Tight)
  - Ownship Tactical Callsign text input
  - Air Defense Callsign dropdown (Tango, Uniform, Victor)

- **Voice Recognition Improvements**:
  - "apple whiskey" → "alpha whiskey" normalization
  - "checkpoint" / "check point" → "check print" normalization
  - Multiple track number parsing with repeated "track" keyword

### Version 3.3 (January 2026)

#### AIC Debrief System
- **Automatic Intercept Tracking**: System tracks each intercept from commit to reset
  - Commit range and grade (Excellent/Good/Late based on group count)
  - Labeled picture validation (correct format and group identification)
  - TAC range calls tracking
  - Maneuver recognition with response time measurement
  - Vanish call assessment

- **Maneuver Recognition**:
  - Detects when groups change heading (>44 degree turn)
  - Tracks AIC response time to maneuvers
  - Grades as Good (≤30s), Acceptable (≤60s), Slow (>60s), or Missed
  - Supports proactive calls (AIC calls maneuver before system detects it)
  - Handles all group types: single, north/south, lead/trail, etc.

- **Debrief Panel** (Pause Menu):
  - Shows intercept history with expandable details
  - Commit grade with distance and group count
  - Picture type validation
  - Maneuver response times with grades
  - Missed events tracking (TAC range, maneuvers, threats)

- **FOX-3 Two-Ship Engagement**:
  - Fighters fire at ALL contacts in a multi-contact group
  - Radio call: "fox-3 two ship" for 2+ contact groups
  - Timeout call waits for all missiles to impact
  - Single "timeout, two ship" call after all targets destroyed

- **RESET Command Auto-Select**:
  - "reset say state" without CAP name finds nearest CAP station
  - Works with both named and unnamed CAP stations
  - Readback includes station name if available

#### Voice Recognition Improvements
- "trailer group" accepted as "trail group"
- Better handling of common voice recognition errors

### Version 3.2 (January 2026)

#### AIC Training Mode - Complete Intercept Flow
- **Automated Fighter Behavior**: Fighters respond realistically to AIC commands throughout the intercept
  - Broadcast acknowledgment when AIC announces groups
  - Commit response with intercept heading when directed to engage
  - Automatic declare calls at 28nm from target
  - Automatic FOX-3 calls at 25nm with separation requests for multi-group scenarios
  - Automatic timeout calls after 60 seconds post-missile
  - Picture clean acknowledgment and reset to CAP station

- **Voice Commands for Intercept Control**:
  - **Broadcast**: "Closeout, group Rock 045/30, twenty-five thousand, track west, hostile" - fighters acknowledge
  - **Commit**: "Showtime, commit group Rock 045/30" - fighter commits and turns to intercept
  - **Labeled Picture (Multi-group)**: "Closeout, 2 groups range 10, north group Rock 045/30, south group Rock 055/25" - fighter targets priority group
  - **Labeled Picture (Single group)**: "Closeout, single group track west" - fighter acknowledges single group
  - **Tac Range**: "Showtime, north group 30 miles" - fighter acknowledges range update
  - **Declare Response**: "Closeout, north group Rock 045/28, hostile" - fighter acknowledges declaration
  - **Separation**: "Closeout, south group Rock 055/20, hostile" - fighter retargets to new group
  - **Vanished**: "Closeout, north group vanished, target south group Rock 055/18" - fighter switches targets
  - **Picture Clean + Reset**: "Closeout picture clean, Showtime reset Tampa say state" - fighter resets to CAP

- **Intercept Targeting Rules**:
  - Range/Ladder/Vic pictures: Always target lead group
  - Azimuth/Wall/Champagne pictures: Target first group AIC calls (AIC determines priority)
  - Single group: Target "single group"

- **ElevenLabs TTS Integration**:
  - High-quality realistic pilot voices via ElevenLabs API
  - Configure API key and voice ID in Sound Settings (pause menu)
  - Falls back to browser TTS if ElevenLabs unavailable

- **Radio Voice Effects**:
  - Realistic military radio transmission sound effects
  - Web Audio API bandpass filtering (300Hz-3400Hz voice band)
  - Adjustable effect intensity (subtle to heavy)
  - Toggle on/off in Sound Settings

- **Smart Voice Recognition**:
  - Handles common mishearings: "shingle" → "single", "lee group" → "lead group"
  - Bullseye format parsing with various speech patterns
  - Tactical terminology normalization

#### Voice Recognition & Radio Communication System
- **Push-to-Talk Radio**: Hold SPACEBAR to transmit voice commands to friendly assets
  - Visual TX/RX indicator shows transmission status (red when transmitting, green when receiving)
  - Radio log window displays all communications with timestamps
  - Draggable, resizable, and minimizable radio log window

- **Voice Commands for Asset Control**:
  - **Heading**: "Heat one one turn right heading one eight zero" or "Heat one one flow two seven zero"
  - **Speed**: "Heat one one speed three five zero"
  - **Altitude (Angels)**: "Heat one one climb to angels two four" (24,000 ft)
  - **Altitude (Flight Level)**: "Heat one one climb to flight level two four zero" (24,000 ft)
  - **SET (Orbit at CAP)**: "Heat one one set Chargers" - sends asset to orbit at named CAP station
  - **RESET (Re-orbit)**: "Heat one one reset Chargers" - same as SET, or "reset say state" to auto-select nearest CAP
  - **Say State**: Add "say state" to SET/RESET for fuel status response (e.g., "state green")

- **Proper Radio Terminology**:
  - Callsigns spoken as individual digits ("Heat one one" not "Heat eleven")
  - Headings with leading zeros ("zero niner zero" for 090)
  - Uses "niner" for 9 (standard radio phonetics)

- **Asset Voice Responses**:
  - Assets read back commands using text-to-speech
  - Proper radio format: "Heat one one, turning heading one eight zero"
  - SET/RESET responses: "Heat one one, setting Chargers, state green"

- **Smart Speech Recognition**:
  - Handles common mishearings ("won" → "one", "too" → "two", "ate" → "eight")
  - Fuzzy callsign matching (handles truncated names like "eat" → "Heat")
  - Military pronunciations supported ("niner", "tree", "fife")

- **Orbit System** (merged from orbit branch):
  - Right-click on map → "Orbit" to send asset to orbit at location
  - Assets continuously turn right in standard rate orbit when at orbit point
  - Orbit point shown as circle with "ORBIT" label
  - New waypoints or heading commands exit orbit mode

- **Browser Requirements**:
  - Voice recognition requires Chrome or Edge browser
  - Microphone permission required for voice commands
  - Student mode only (voice commands disabled in instructor mode)

### Version 3.1 (January 2026)

#### Student/Instructor Mode Improvements
- **Dead Reckoning for Destroyed Assets**: When a weapon destroys an asset in student mode, the student track continues to dead reckon based on the last known course and speed until it ages after 2 sweeps
- **Aged Track Selection**: Gray (aged) tracks can now be properly selected and deleted by students
- **Track Selection UI**: Fixed track selection to properly show the SELECTED TRACK panel and hide SYSTEMS/ASSETS panels
- **Context Menu for Tracks**: "Go To", "Add Waypoint", and "Engage with" options now work properly when selecting friendly tracks in student mode
- **Fixed Mode Switching Errors**: Resolved crashes when selecting tracks while other UI elements (like ESM lines) were selected
- **Friendly Track Controls**: Students can now set heading, speed, and altitude for friendly tracks via the track panel

#### Operator Track System
- **Create Operator Tracks**: Right-click on empty space in student mode to create manual operator tracks
- **Domain Selection**: Choose Air, Surface, or Subsurface domain when creating operator tracks
- **Default Values**: New operator tracks start with heading 360°, speed 0 kts, altitude/depth 0 ft
- **Editable Properties**: Manually enter course, speed, altitude, and depth for operator tracks
- **Draggable Tracks**: Select an operator track and drag it to reposition
- **Track Fusion**: Select operator track, right-click radar track, choose "Fuse Track" to combine them
  - Fused track uses radar's position/speed/heading but retains operator track's label and identity

#### New Behavior Actions
- **Make Visible**: New behavior action that unchecks the HIDDEN box, making the asset visible to students
- **Make Invisible**: New behavior action that checks the HIDDEN box, making the asset invisible to students
- These actions allow instructors to create scenarios where assets appear or disappear based on triggers (mission time, distance, or waypoint arrival)

#### Waypoint Wrapping
- **Wrap Waypoints**: Right-click on any waypoint (except the first) to select "Wrap Waypoint"
- **Back-and-Forth Navigation**: Wrapped waypoints cause assets to continuously fly between two waypoints
- **Visual Indicator**: Solid line between wrapped waypoints (instead of dashed) indicates wrap state
- **Unwrap Option**: Right-click on a wrapped waypoint to select "Unwrap Waypoint"
- **Resume Navigation**: After unwrapping, asset continues to subsequent waypoints
- **Works in Both Modes**: Available in instructor mode and student mode (friendly tracks only)

#### Mission Products
- **File Attachments**: Attach mission briefs, orders, and reference documents to scenarios
- **Supported Formats**: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx)
- **Access**: Press ESC to open pause menu, click "MISSION PRODUCTS" button
- **Add Files**: Click "ADD FILE" to browse and attach documents (max 10 MB each)
- **View/Download**: Click "VIEW" to download and open attached files
- **Delete Files**: Click "DELETE" to remove files from the scenario
- **Persistent Storage**: Files are embedded in scenario JSON and saved/loaded with scenarios

#### UI Improvements
- **Styled Alert Dialogs**: Datalink validation messages now use styled popups instead of browser alerts
- **Rounded Values**: Track panel heading, speed, and altitude fields display whole numbers only
- **Cursor Bearing/Range**: Fixed bearing and range readout from cursor when a track is selected

#### Bug Fixes
- Fixed datalink track block initialization when loading saved scenarios
- Fixed friendly track lat/lon format to use DMM format matching instructor mode
- Changed track generation threshold from 2-4 to 2-3 sweeps for more consistent track creation
- Fixed weapon color (blue/red) to be based on student track identity rather than instructor asset identity
- Fixed context menu restrictions so non-friendly tracks cannot access "Engage with" function
- Fixed friendly track heading/speed/altitude controls not applying values when SET button clicked

### Version 3.0 (January 2026)

#### Student/Instructor Mode System
- **Dual-Mode Operation**: Revolutionary training system with separate Instructor and Student modes
  - Mode selection before simulation starts
  - Complete functional separation between modes
  - Realistic radar operator training environment
  - Scenario-building capabilities for instructors

#### Instructor Mode (Master Mode)
- **Full Simulator Control**: Retains all existing functionality
  - Complete asset creation, editing, and deletion
  - Full access to all tabs and controls
  - Scenario building and configuration
  - All sensor systems and weapons available

- **HIDDEN Checkbox**: Make assets invisible to students
  - Located in GENERAL tab for each asset
  - Assets with HIDDEN checked produce no radar returns
  - No track files generated for hidden assets
  - Track files age (2 sweeps) before disappearing when HIDDEN toggled ON during scenario
  - Default: CHECKED for new assets

- **TRACK FILE Checkbox**: Control track file display
  - Located in GENERAL tab for each asset
  - When unchecked, only radar returns shown (no track file)
  - Default: CHECKED for new assets
  - Disabled when HIDDEN is checked

- **Scenario Planning**: Build training scenarios with pre-positioned hidden assets
  - Place assets that will appear later during student training
  - Configure realistic threat scenarios
  - Save scenarios for repeated use

#### Student Mode (Training Mode)
- **Realistic Operator Experience**: Simulates actual radar operator console
  - Limited controls mimic real-world constraints
  - Automatic track generation from radar returns
  - Track aging after missed detections
  - Manual track number assignment

- **Systems Panel Access**: Full sensor system capabilities
  - RADAR tab: Complete radar control
  - ESM tab: Electronic support measures
  - IFF tab: Identification friend or foe
  - DATALINK tab: Tactical data link
  - EO/IR tab: Electro-optical/infrared imaging
  - ISAR tab: Inverse synthetic aperture radar
  - SONO tab: Sonobuoy deployment
  - WEAPON tab: Weapons management

- **Limited Asset Panel Tabs**: Restricted to relevant information
  - GENERAL tab: Identity, domain, course, speed, altitude, position
  - EO/IR tab: Visual identification images
  - ISAR tab: Radar imaging
  - Hidden tabs: IFF, DATALINK, EMITTER, BEHAVIORS (instructor only)

- **Automatic Track Generation**: Radar returns create track files
  - Random threshold: 2-3 radar returns required
  - Track appears after threshold met
  - Default identity: "unknownUnevaluated" (orange)
  - Track positioned at last radar detection
  - IFF codes captured if asset squawking
  - Datalink JU captured if available

- **Track Aging System**: Realistic track degradation
  - 2 missed radar sweeps → track turns gray (aged)
  - 20 seconds = 2 complete radar sweeps at 10-second rotation
  - Aged tracks remain on display
  - Students can still edit aged track identity
  - Track ages when radar turned OFF
  - Track ages when asset moves out of range
  - Track ages when instructor toggles HIDDEN ON

- **Dead Reckoning**: Track position updates between detections
  - Position follows instructor asset's actual movement
  - Course and speed updated from underlying asset
  - Heading indicator line shows estimated heading
  - Continues for aged tracks
  - Provides realistic tracking behavior

- **Restricted Asset Control**: Students can only modify friendly assets
  - Friendly assets: Full control (heading, speed, altitude, position, waypoints)
  - Ownship: Full control (editable heading, speed, altitude, lat/lon)
  - Non-friendly tracks: Read-only information display
    - Label and identity changeable
    - Course, speed, altitude, lat/lon visible but read-only
    - DMM coordinate format (N26 30.0, E054 00.0)

- **Manual Track Numbering**: Student must assign track numbers
  - REPORT TRACK button assigns next available track number
  - Requires datalink configuration (NET, JU, track block)
  - Track numbers drawn from configured track block
  - No automatic track number on track regeneration
  - Validates datalink system before assignment

- **Track Management**: Student controls track lifecycle
  - DELETE TRACK button removes student track file
  - Deleting track does NOT remove instructor asset
  - Radar will regenerate track after 2-3 returns
  - New track will NOT have track number (student must report again)
  - Empty space click deselects tracks

- **Student Labels**: Custom track identification
  - Label field in GENERAL tab
  - Replaces instructor asset names on map
  - Displayed above track symbol
  - Allows student documentation system

- **Waypoint Display**: Friendly track waypoints visible
  - Waypoints shown for friendly identity tracks only
  - Dashed lines connect unreached waypoints
  - Cross markers at waypoint positions
  - Waypoint labels (WP1, WP2, etc.)
  - Go To and Add Waypoint functions available
  - Waypoints pulled from underlying instructor asset

- **Context Menu Restrictions**: Limited map interactions
  - Cannot create new assets
  - Can create geo-points and shapes
  - Waypoint functions only for friendly assets and ownship
  - Engage function only for friendly assets
  - Cannot delete instructor assets

#### Technical Implementation
- **Mode State Management**: React state-based mode switching
  - `simulatorMode` state: 'instructor' | 'student'
  - Mode locked after simulation starts
  - Mode selection UI hidden after start

- **Student Track Data Structure**:
  ```javascript
  {
    id: number,                    // Unique track file ID
    assetId: number,               // Reference to instructor asset
    lat: number,                   // Last known position
    lon: number,
    domain: string,                // 'air' | 'surface' | 'subSurface' | 'land'
    identity: string,              // Default 'unknownUnevaluated'
    label: string,                 // Student-defined label
    trackNumber: number | null,    // Assigned via Report Track
    isAged: boolean,               // Aged after 2 missed sweeps
    lastDetectionTime: number,     // Mission time of last detection
    creationTime: number,          // Mission time when created
    estimatedHeading: number,      // For dead reckoning
    estimatedSpeed: number,        // For dead reckoning
    iffModeI: string,              // Read-only IFF codes
    iffModeII: string,
    iffModeIII: string,
    datalinkJU: string             // Read-only JU
  }
  ```

- **Extended Asset Properties**:
  - `hidden`: Boolean (instructor only, default false)
  - `trackFileEnabled`: Boolean (instructor only, default true)
  - `studentLabel`: String (student mode label)

- **Radar Detection Counting**: Automatic track generation
  - `radarDetectionCounts` state tracks detections per asset
  - Random threshold (2-4) per asset
  - Track created when threshold reached
  - Only for non-hidden assets in student mode

- **Track Aging Logic**: Time-based aging system
  - `trackAgingTimers` state tracks missed sweeps
  - 20 seconds without detection → aged
  - Resets on radar detection
  - Increments when out of range or HIDDEN

- **Dead Reckoning Implementation**: Position synchronization
  - Direct position copy from instructor asset
  - Course/speed updated from asset values
  - Position change detection (0.0001° threshold)
  - Prevents continuous state updates for performance

- **Coordinate Format Functions**:
  - `decimalToDMM()`: Convert decimal degrees to DMM format
  - `dmmToDecimal()`: Parse DMM format to decimal
  - Format: "N26 30.0" (degrees, space, minutes.decimal)

- **Save/Load Integration**: Full state persistence
  - Simulator mode saved with scenario
  - Student tracks array saved
  - Detection counts and aging timers preserved
  - Backward compatibility with old save files
  - Version 1.1 save format

#### Use Cases
- **Flight School Training**: Realistic radar operator training
  - Students practice track management
  - Manual track number assignment
  - Identity determination skills
  - Sensor correlation exercises

- **Tactical Scenario Training**: Pre-built training scenarios
  - Instructors create realistic threat environments
  - Hidden assets appear at planned times
  - Students react to developing situations
  - Performance evaluation and debrief

- **Proficiency Evaluation**: Standardized testing
  - Consistent scenario replay
  - Objective performance metrics
  - Track management skills assessment
  - Decision-making under pressure

### Version 2.6.6 (January 2026)

#### ISAR Flight Profile Requirements
- **Realistic ISAR Acquisition Constraints**: MCS E-PCL Page N6 parameter validation
  - **Altitude Requirement**: 5,000' to 35,000' MSL
    - ISAR system disabled below 5,000' (insufficient altitude for proper geometry)
    - ISAR system disabled above 35,000' (beyond operational envelope)
  - **Groundspeed Requirement**: >180 and <250 knots
    - Minimum 180 knots for stable platform and adequate relative motion
    - Maximum 250 knots to prevent excessive target smear
  - **Wings Level Requirement**: Minimum 15 seconds continuous level flight
    - Internal timer tracks wings level duration
    - Timer resets on any heading change or banking maneuver
    - Timer pauses when simulation pauses (preserves progress)
    - No timer display in UI (tracked internally only)
  - **Grazing Angle Requirement**: 0.01° to 4.0°
    - Calculated from ownship altitude and slant range to target
    - Optimal imaging at shallow grazing angles (1-2°)
    - Steep angles (>4°) cause geometry errors
  - **Slant Range Limits**: Altitude-dependent range envelope
    - At 5,000': 15-150 NM valid range
    - At 15,000': 21-210 NM valid range
    - At 35,000': 37-330 NM valid range
    - Linear interpolation between altitude values

- **ISAR Tab Flight Profile Status Display**:
  - Real-time validation status in SYSTEMS → ISAR tab
  - "READY" (green) when all requirements met
  - "NOT READY" (orange) when any requirement fails
  - Individual status indicators for altitude, groundspeed, wings level
  - Color-coded parameter display (green = OK, red = failed)
  - Updates continuously as flight parameters change

- **ISAR Window Acquisition Feedback**:
  - "ISAR ACQUISITION FAILED" message when out of profile
  - Detailed breakdown of all five requirements
  - Current values vs. required values for each parameter
  - Individual color coding (green = pass, red = fail)
  - Automatically switches to image when all requirements met
  - Real-time updates without closing/reopening window

- **Tab Color Coding**:
  - ISAR tab background changes based on flight profile status
  - Red: System OFF
  - Orange: System ON but out of profile
  - Green: System ON and flight profile valid
  - Text color automatically adjusts for readability
    - Black text on colored background when tab selected
    - Colored text on transparent background when unselected

- **ISAR Button Enhancements**:
  - Button text shows "VIEW ISAR" when profile valid (green)
  - Button text shows "ISAR (OUT OF PROFILE)" when invalid (orange)
  - Still clickable when out of profile (shows detailed error message)
  - Visual feedback before opening ISAR window

- **Technical Implementation**:
  - `calculateGrazingAngle()`: Arctan-based geometry calculation
  - `getIsarRangeLimits()`: MCS E-PCL table interpolation
  - `validateIsarFlightProfile()`: Comprehensive 5-parameter validation
  - Wings level tracking with mission time-based duration
  - Optimal dummy target positioning for status validation
  - React useCallback hook for memoized validation function

### Version 2.6.5 (January 2026)

#### Land Domain for SAM Sites
- **Land-Based SAM Systems**: Stationary Surface-to-Air Missile sites
  - New "Land" domain added to DOMAIN_TYPES (air, surface, sub-surface, land)
  - 6 SAM platform types: SA-2 Guideline, SA-3 Goa, SA-5 Gammon, SA-6 Gainful, SA-8 Gecko, EW Radar
  - MIL-STD-2525 land symbology (square with clipped corners)
  - Stationary behavior: maxSpeed=0, no movement, no waypoints
  - Speed and heading controls hidden for land domain assets
  - No heading indicator line (stationary installations)

- **SAM Missile Systems**:
  - 5 Soviet/Russian SAM missiles added to weapons database
  - S-75 Dvina (SA-2): 25 NM range, Mach 3.8
  - S-125 Neva (SA-3): 15 NM range, Mach 3.4
  - S-200 Angara (SA-5): 150 NM range, Mach 7.0 (long-range strategic)
  - 2K12 Kub (SA-6): 12 NM range, Mach 2.7
  - 9K33 Osa (SA-8): 9 NM range, Mach 2.4 (point defense)
  - All missiles feature realistic fuel consumption, booster phases, and self-destruct timers

- **Radar and Sensor Behavior**:
  - Land assets generate no radar returns (ground clutter exclusion)
  - Land assets generate no IFF returns (no airborne transponders)
  - No ISAR imaging capability for land installations
  - Emitter systems fully functional (FAN SONG, LOW BLOW, SQUARE PAIR, STRAIGHT FLUSH, LAND ROLL)
  - Early Warning radars: BIG BIRD, TALL KING, SPOON REST

- **Physics and Movement**:
  - Position updates skipped for land domain (enforced at physics level)
  - Waypoint processing disabled for stationary assets
  - Speed locked at 0 knots, heading locked at 0 degrees on creation
  - Land assets remain at placement coordinates throughout simulation

- **Platform Database Expansion**:
  - Total platforms increased from 31 to 37
  - Land domain platforms use NATO reporting names for emitters
  - All land platforms have threatLevel=1 (hostile)
  - No datalink capability for land installations
  - Platform-specific missile loadouts (4-6 SAMs per site)

### Version 2.6 (January 2026)

#### Asset Behaviors System
- **Automated Trigger-Action System**: Define complex automated behaviors for assets
  - BEHAVIORS tab in asset control panel for behavior management
  - Create, edit, and delete behaviors with visual interface
  - Multiple behaviors per asset with navigation controls
  - Behaviors persist in save files and load with scenarios

- **Three Trigger Types**:
  - **Mission Time**: Execute actions when specified mission time is reached
    - Time input in HH:MM:SS format for easy configuration
    - Triggers once at exact mission time
  - **Distance from Asset**: Execute when selected asset is within specified distance
    - Target asset selection dropdown
    - Distance threshold in nautical miles
    - Triggers once when distance threshold is met
  - **At Waypoint**: Execute when asset reaches a specified waypoint
    - Waypoint selection dropdown (shows only unreached waypoints)
    - Triggers when asset arrives within 0.5 NM of waypoint
    - Waypoint numbering preserved after completion

- **Seven Action Types**:
  - **Change Heading**: Set asset heading to specified value (0-359°)
  - **Change Speed**: Set asset speed to specified value (knots)
  - **Change Altitude**: Set asset altitude to specified value (feet, air domain only)
  - **Turn Emitter On**: Activate specified radar emitter
  - **Turn Emitter Off**: Deactivate specified radar emitter
  - **Make Visible**: Uncheck HIDDEN box, making asset visible to students
  - **Make Invisible**: Check HIDDEN box, making asset invisible to students

- **Multiple Actions Per Trigger**:
  - Execute unlimited actions simultaneously when trigger fires
  - Add/remove actions with visual form controls
  - Each action independently configured
  - Real-time validation for action parameters

- **Behavior Management**:
  - Next/Back buttons to browse through behaviors
  - NEW button to create fresh behavior
  - EDIT button to modify existing behaviors
  - DELETE button with confirmation dialog
  - SAVE/CANCEL buttons for form control
  - View mode shows trigger type, configuration, and action list
  - Status indicator shows FIRED/ACTIVE state

- **Smart Behavior Execution**:
  - Behaviors fire once and are marked as FIRED
  - Continuous checking during simulation
  - Console logging for debugging
  - Behaviors preserved across save/load cycles
  - No performance impact on simulation

#### Waypoint Visibility Enhancement
- **Reached Waypoint Auto-Hide**: Completed waypoints automatically removed from map
  - Waypoints marked as reached disappear immediately
  - Reduces visual clutter during long missions
  - Waypoint numbering preserved (WP2 stays WP2 even after WP1 is reached)
  - Dashed lines connect only unreached waypoints

- **Clear All Waypoints**: Context menu option to reset flight path
  - Available when asset has waypoints assigned
  - Confirmation dialog prevents accidental deletion
  - Resets waypoint numbering for fresh flight path
  - Clears all waypoints and resets heading control

- **Behaviors Integration**:
  - Waypoint dropdown in behaviors shows only unreached waypoints
  - Consistent waypoint numbering across map and UI
  - Behaviors correctly reference waypoints by array index
  - Waypoint triggers fire when reached flag is set

### Version 2.5 (January 2026)

#### Weapon System Overhaul
- **Individual Weapon Variants**: Complete redesign from generic weapon types to specific variants
  - Transitioned from 5 generic types (AAM, AGM, ASM, SAM, Torpedo) to 30+ individual weapons
  - Each weapon has unique performance characteristics (speed, range, acceleration)
  - MiG-29 firing R-27 uses R-27 ballistics, not AIM-120
  - F-18E firing AIM-120 uses AIM-120 ballistics, not R-27
  - Platform-specific weapon loadouts determine available missiles
  - Realistic weapon selection based on platform configuration

- **Platform-Based Weapon Inventory**:
  - numberOfAAM, numberOfAGM, numberOfASM, numberOfSAM, numberOfTorpedo attributes
  - Ownship inventory initialized from platform configuration
  - All 31 platforms updated with weapon counts
  - Backward compatibility for old platforms/scenarios
  - UI tracks inventory by TYPE (not individual variants)

- **Weapon Symbology System**:
  - SVG-based weapon symbols (friendly missile, hostile weapon, friendly torpedo)
  - North-up orientation with heading indicator lines
  - Size matched to air track symbols (12px diameter)
  - Solid direction lines (30px length)
  - Smart torpedo detection for different symbols
  - Blue friendly missiles (#00BFFF), red hostile weapons (#FF0000)

#### Weapon Fuel/Energy System
- **Realistic Fuel Consumption**: All 30+ weapon variants now have finite flight times
  - Time-based fuel model with configurable parameters per weapon
  - Fuel time calculated as (maxRange / maxSpeed) × 1.2 for 20% maneuvering margin
  - Two-phase propulsion system: booster + cruise
  - Energy bleed-off after fuel depletion (50 knots/sec drag)
  - Self-destruct timer prevents infinite flight (2x fuel time)

- **Booster Phase System**:
  - High-thrust initial acceleration phase (10-20% of total fuel time)
  - Booster acceleration typically 2x cruise acceleration
  - Console logging when booster burns out
  - Different booster durations per weapon type
    - Short-range AAM (AIM-9): 8 seconds
    - Medium-range AAM (AIM-120): 15 seconds
    - Long-range cruise missiles (Kh-101): 180 seconds
    - Torpedoes (Mk 46): 60 seconds

- **Cruise Phase System**:
  - Sustained thrust maintains max speed until fuel depletion
  - Standard acceleration using maxAcceleration parameter
  - Fuel consumption tracked via mission time
  - Proportional navigation guidance continues normally

- **Energy Bleed-Off Phase**:
  - Unpowered flight after fuel depletion
  - 50 knots/sec deceleration due to drag
  - Weapons below 10 knots fall and self-destruct
  - Console logging for energy depletion events

- **Self-Destruct System**:
  - Automatic detonation after maximum flight time exceeded
  - Prevents runaway weapons from flying indefinitely
  - Safety margin: 2x fuel time
  - Console logging for self-destruct events
  - Weapons removed from simulation on self-destruct

- **Realistic Weapon Behavior**:
  - Maneuvering targets at max range cause fuel exhaustion
  - Target loss doesn't prevent fuel consumption
  - Weapons can't chase targets indefinitely
  - Distance-appropriate fuel parameters
    - Short-range (R-60): 13s fuel, 26s max flight
    - Medium-range (AIM-120): 130s fuel, 260s max flight
    - Long-range cruise (Kh-101): 5.6hr fuel, 11.2hr max flight
    - Anti-ship (Harpoon): 9min fuel, 18min max flight
    - Torpedoes (Mk 46): 9.6min fuel, 19.2min max flight

- **Weapon Database Updates** ([weapons.json](weapons.json)):
  - All 30+ weapons have fuelTime, boosterTime, boosterAcceleration, selfDestructTime
  - 8 AAM variants (AIM-120, AIM-9, AIM-7, AIM-54, R-27, R-73, R-60, R-3S)
  - 5 AGM variants (AGM-65, Kh-25, Kh-55, Kh-101, FAB-500)
  - 10 ASM variants (AGM-84, Harpoon, C-802, C-701, HY-2, SS-N-2, SS-N-9, SS-N-14, SS-N-22, 3M-54 Klub)
  - 5 SAM variants (SM-1, RIM-7, SA-N-4, SA-N-7, SA-N-9)
  - 3 Torpedo variants (Mk 46, 53-65, 53-56)

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
- **37 Military Platforms** across air, surface, sub-surface, and land domains
  - **Air Domain (13 platforms)**:
    - US/Allied: F-18E, F-18F, F-16, F-15, F-5, F-4, F-14, P-3
    - Enemy: MiG-21, MiG-29, Su-24, Tu-95
    - Civilian: Com-Air (commercial aircraft)
  - **Surface Domain (16 platforms)**:
    - US/Allied: Perry FFG, Arleigh Burke DDG, Ticonderoga CG, Nimitz CVN
    - Enemy: Combattante, Houdong, Huangfen, Krivak, Najin, Nanuchka, Osa, Sovremenny, Udaloy
    - Civilian: Container-Ship, Dhow, Cruise-Ship, Oil-Tanker, Fishing-Vessel, Freighter
  - **Sub-Surface Domain (2 platforms)**:
    - Enemy: Kilo, Romeo (diesel-electric submarines)
  - **Land Domain (6 platforms)**:
    - Enemy SAM Sites: SA-2 Guideline, SA-3 Goa, SA-5 Gammon, SA-6 Gainful, SA-8 Gecko
    - Enemy Early Warning: EW Radar (BIG BIRD, TALL KING, SPOON REST)
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
