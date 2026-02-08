# Voice Recognition & Radio Communication System for Project Judy

## Overview

Add voice-based radio communication to allow students to issue verbal commands to assets and communicate with an AI-controlled Air Warfare Commander (AW/Alpha Whiskey).

## Technical Approach

### Web Speech API (Built-in Browser API)

The implementation will use the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API), which provides:

1. **[SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)** - Converts spoken words to text
2. **[SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)** - Converts text to spoken audio (asset responses)

**Browser Support**: Chrome and Edge (already the recommended browsers for this simulator) - see [Chrome's Web Speech API guide](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api/)

**Advantages**:
- No external dependencies or API keys required
- Works entirely in-browser
- Already compatible with the simulator's target browsers
- Free to use

### Key Components

#### 1. Push-to-Talk (Spacebar)
- Hold spacebar to transmit (like a real radio)
- Visual indicator shows when transmitting (red "TX" indicator)
- Audio feedback (click sound) on press/release

#### 2. Asset Voice Commands
Parse natural language commands to control assets:

| Spoken Command | Parsed Action |
|----------------|---------------|
| "Viper 11 turn right heading 1-8-0" | Set Viper 11 targetHeading = 180 |
| "Viper 11 turn left 2-7-0" | Set targetHeading = 270 |
| "Viper 11 speed 3-5-0" | Set targetSpeed = 350 |
| "Viper 11 angels 2-5" | Set targetAltitude = 25000 |
| "Viper 11 descend angels 1-5" | Set targetAltitude = 15000 |

#### 3. Asset Voice Responses
Using [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), assets read back commands:
- "Viper 11, turning right heading 1-8-0"
- "Viper 11, speed 3-5-0"
- "Viper 11, climbing angels 2-5"

#### 4. AW (Alpha Whiskey) AI Controller
A conversational agent for:
- Threat warnings and calls
- Tactical information requests ("picture", "bogey dope")
- Coordination with other assets

---

## Implementation Plan

### Phase 1: Core Voice Infrastructure
**File**: `app.js`

1. **Add state variables** (~line 1075):
   ```javascript
   const [isTransmitting, setIsTransmitting] = useState(false);
   const [lastTranscript, setLastTranscript] = useState('');
   const [radioEnabled, setRadioEnabled] = useState(true);
   const [radioLog, setRadioLog] = useState([]); // Communication history
   ```

2. **Initialize Web Speech API** (new useEffect):
   ```javascript
   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
   const recognition = new SpeechRecognition();
   recognition.continuous = false;
   recognition.interimResults = true;
   recognition.lang = 'en-US';
   ```

3. **Add spacebar event handlers** (modify existing keydown handler at line 4360):
   ```javascript
   // Keydown - start listening
   if (e.code === 'Space' && !isTransmitting && radioEnabled && !e.repeat) {
       e.preventDefault();
       setIsTransmitting(true);
       recognition.start();
   }

   // Keyup - stop listening and process
   if (e.code === 'Space' && isTransmitting) {
       setIsTransmitting(false);
       recognition.stop();
   }
   ```

### Phase 2: Command Parser
**File**: `app.js` (new function after line ~2800)

```javascript
function parseVoiceCommand(transcript, assets) {
    const text = transcript.toLowerCase();

    // Find asset by name (fuzzy match using Levenshtein distance or simple includes)
    const asset = findAssetByCallsign(text, assets);
    if (!asset) return { type: 'unknown', transcript };

    // Parse command type and value
    const headingMatch = text.match(/(?:turn|heading|head)\s*(?:to|right|left)?\s*(\d[\d\s-]*)/i);
    const speedMatch = text.match(/(?:speed|velocity)\s*(\d[\d\s-]*)/i);
    const altMatch = text.match(/(?:angels?|altitude|climb|descend)\s*(\d[\d\s-]*)/i);

    if (headingMatch) {
        return { type: 'heading', asset, value: parseSpokenNumber(headingMatch[1]) };
    }
    if (speedMatch) {
        return { type: 'speed', asset, value: parseSpokenNumber(speedMatch[1]) };
    }
    if (altMatch) {
        const angels = parseSpokenNumber(altMatch[1]);
        return { type: 'altitude', asset, value: angels * 1000 }; // Convert angels to feet
    }

    // Check for AW commands
    if (text.includes('alpha whiskey') || text.includes('aw')) {
        return { type: 'aw', transcript };
    }

    return { type: 'unknown', asset, transcript };
}

function parseSpokenNumber(spoken) {
    // Handle "one eight zero" -> 180, "1-8-0" -> 180, "180" -> 180
    const cleaned = spoken.replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
}

function findAssetByCallsign(text, assets) {
    // Normalize text and find matching asset name
    for (const asset of assets) {
        if (!asset.name) continue;
        const normalizedName = asset.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedText = text.replace(/[^a-z0-9]/g, '');
        if (normalizedText.includes(normalizedName)) {
            return asset;
        }
    }
    return null;
}
```

### Phase 3: Voice Response System
**File**: `app.js` (new functions)

```javascript
function speakResponse(text, voiceOptions = {}) {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();

    // Use a male voice if available for military feel
    const preferredVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David'));
    utterance.voice = preferredVoice || voices[0];
    utterance.rate = voiceOptions.rate || 1.1;  // Slightly faster for radio feel
    utterance.pitch = voiceOptions.pitch || 1.0;
    utterance.volume = voiceOptions.volume || 1.0;

    speechSynthesis.speak(utterance);
}

function generateReadback(assetName, commandType, value) {
    switch (commandType) {
        case 'heading':
            return `${assetName}, turning heading ${spellOutNumber(value)}`;
        case 'speed':
            return `${assetName}, speed ${spellOutNumber(value)}`;
        case 'altitude':
            return `${assetName}, angels ${Math.round(value / 1000)}`;
        default:
            return `${assetName}, copy`;
    }
}

function spellOutNumber(num) {
    // Convert 180 to "one eight zero" for radio clarity
    return num.toString().split('').join(' ');
}
```

### Phase 4: UI Indicators
**Files**: `app.js`, `styles.css`

**Add to HUD area** (near mission time display, ~line 6550):
```jsx
{/* Radio/PTT Indicator */}
<div className={`radio-indicator ${isTransmitting ? 'transmitting' : ''}`}>
    <div className="radio-status">{isTransmitting ? '● TX' : '○ RX'}</div>
    {radioEnabled && <div className="radio-hint">Hold SPACE to transmit</div>}
</div>

{/* Transcript display */}
{lastTranscript && (
    <div className="transcript-display">
        "{lastTranscript}"
    </div>
)}
```

**CSS additions** (`styles.css`):
```css
.radio-indicator {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #00FF00;
    padding: 5px 15px;
    border-radius: 3px;
    z-index: 1000;
}

.radio-indicator.transmitting {
    border-color: #FF0000;
    background: rgba(255, 0, 0, 0.2);
}

.radio-indicator.transmitting .radio-status {
    color: #FF0000;
    animation: pulse 0.5s infinite;
}

.transcript-display {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid #FFFF00;
    padding: 10px 20px;
    color: #FFFF00;
    font-family: monospace;
    max-width: 600px;
}
```

### Phase 5: AW (Alpha Whiskey) System
**File**: `app.js` (new functions)

**Rule-Based Implementation** (initial version):
```javascript
const AW_RESPONSES = {
    'picture': (assets) => {
        const hostiles = assets.filter(a => a.identity === 'hostile' && !a.hidden);
        if (hostiles.length === 0) return "Alpha Whiskey, picture clean";

        const groups = hostiles.map(h => {
            const bearing = Math.round(calculateBearingFromBullseye(h));
            const range = Math.round(calculateRangeFromBullseye(h));
            return `group bullseye ${bearing} for ${range}`;
        });
        return `Alpha Whiskey, picture ${hostiles.length} group${hostiles.length > 1 ? 's' : ''}, ${groups.join(', ')}`;
    },

    'bogey dope': (assets, callingAsset) => {
        const hostiles = assets.filter(a => a.identity === 'hostile' && !a.hidden);
        if (hostiles.length === 0) return "Alpha Whiskey, clean";

        // Find nearest hostile to calling asset
        const nearest = findNearestAsset(callingAsset, hostiles);
        const bearing = Math.round(calculateBearing(callingAsset.lat, callingAsset.lon, nearest.lat, nearest.lon));
        const range = Math.round(calculateDistance(callingAsset.lat, callingAsset.lon, nearest.lat, nearest.lon));

        return `Alpha Whiskey, bogey dope, ${bearing} for ${range}, hot`;
    },

    'declare': () => "Alpha Whiskey, hostile",

    'weapons free': () => "Alpha Whiskey, weapons free, I repeat, weapons free",

    'splash': () => "Alpha Whiskey, copy splash",

    'bingo': () => "Alpha Whiskey, copy bingo, RTB approved",
};

function handleAWCommand(transcript, assets, callingAsset) {
    const text = transcript.toLowerCase();

    for (const [keyword, handler] of Object.entries(AW_RESPONSES)) {
        if (text.includes(keyword)) {
            const response = typeof handler === 'function'
                ? handler(assets, callingAsset)
                : handler;
            return response;
        }
    }

    return "Alpha Whiskey, say again";
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `app.js` | Voice state variables, Speech API initialization, command parser, response generator, keyboard handlers (spacebar), UI components for radio indicator |
| `styles.css` | Radio indicator styles, transcript display styles, transmit animation |

---

## Testing & Verification

1. **Spacebar PTT**: Hold spacebar, verify red TX indicator appears
2. **Speech Recognition**: Speak "Viper 11 turn right 180", verify transcript appears
3. **Command Parsing**: Verify asset named "Viper 11" heading changes to 180
4. **Voice Response**: Verify "Viper 11, turning heading 1 8 0" is spoken
5. **AW Commands**: Test "Alpha Whiskey, picture" and verify tactical response
6. **Edge Cases**: Test with no matching asset, invalid commands, AW unknown commands

---

## User Requirements (Confirmed)

1. **Asset response scope**: Only **friendly** assets respond to voice commands (realistic radio behavior)
2. **AW communication**: User will provide specific example scripts (file to be shared before implementation)
   - Start with basic brevity codes (picture, bogey dope, declare, etc.)
   - Extend with user-provided scripts when available
3. **Radio communication log**: Yes - include scrollable history of all radio communications
4. **Audio effects**: Yes - add radio click sounds on PTT press/release

---

## Additional UI Component: Radio Log

```jsx
{/* Radio Communication Log */}
<div className="radio-log">
    <div className="radio-log-header">RADIO LOG</div>
    <div className="radio-log-messages">
        {radioLog.map((entry, idx) => (
            <div key={idx} className={`radio-entry ${entry.type}`}>
                <span className="radio-time">{entry.time}</span>
                <span className="radio-callsign">{entry.callsign}:</span>
                <span className="radio-message">{entry.message}</span>
            </div>
        ))}
    </div>
</div>
```

## Audio Effects

Will use Web Audio API to play short click sounds:
- PTT press: "click on" sound
- PTT release: "click off" sound
- Optional: light static/hiss during transmission
