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
- **Left-click on empty space**: Place yellow reference mark
- **Right-click**: Open context menu (add assets, waypoints, etc.)
- **Click + Drag**: Pan the map view
- **Mouse Wheel**: Zoom in/out (10-360 NM scale)
- **Drag waypoint markers**: Reposition waypoints

### Keyboard Controls
- **ESC**: Open pause menu
- **Enter**: Apply value changes (heading, speed, altitude)

### Playback Controls
- **PLAY/PAUSE**: Toggle simulation running state
- **RESTART**: Reset simulation to initial state

## Creating and Managing Assets

### Add Asset
**Method 1**: Click "+ ADD ASSET" button in control panel
- Fill in asset details (name, type, heading, speed, altitude)
- Asset appears at bullseye by default

**Method 2**: Right-click on map
- Select "Add Asset Here"
- Asset appears at clicked location

### Asset Types
- **Friendly** (Light Blue): Allied forces
- **Hostile** (Red): Enemy forces
- **Neutral** (Green): Non-combatants
- **Unknown** (Yellow): Unidentified, evaluated
- **Unknown Unevaluated** (Orange): Unidentified, not evaluated

### Edit Asset
1. Select asset by clicking on it
2. Modify properties in "SELECTED ASSET" panel
3. For heading/speed/altitude: Enter value and press Enter
4. Changes apply gradually at realistic rates

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

## Position Information

### Cursor Display (Bottom Left)
- **Green Box**: Bearing/Range from Bullseye
- **Yellow Box**: Bearing/Range from Mark or Selected Asset
- Format: BRG/RNG (e.g., "304/52" = 304° at 52 NM)

### Bullseye Reference Point
- Location: 26.5°N, 54.0°E (Central Persian Gulf)
- Marked with green crosshair symbol
- All positions referenced from this point

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
- **Heading changes**: 15°/second (standard rate turn)
- **Speed changes**: 10 knots/second
- **Altitude changes**: 6,000 feet/minute (100 ft/sec)

### Physics Simulation
- 60 Hz update rate for smooth movement
- Haversine formula for accurate lat/lon calculations
- Automatic waypoint arrival detection
- Maintains fractional precision for smooth transitions

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

**Version**: 1.0
**Last Updated**: December 30, 2025
**Status**: Production Ready

---

**Good hunting, Controllers!** 🎯
