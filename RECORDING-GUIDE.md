# Project Judy - Recording Guide

## Audio Recording Fix

The recording feature has been updated to properly capture both system audio and microphone audio.

## How to Record with Audio

### Step 1: Start Recording
1. Click the **"○ RECORD"** button in the top-left corner
2. A browser permission dialog will appear

### Step 2: Select What to Share
When the screen sharing dialog appears, you'll see options:

#### **Chrome Tab** (Recommended)
- ✅ Select "Chrome Tab"
- ✅ Choose the Project Judy tab
- ✅ **IMPORTANT**: Check the box "Share tab audio" at the bottom
- ✅ Click "Share"

#### **Entire Screen** (Alternative)
- Select "Entire Screen"
- Choose your monitor
- **IMPORTANT**: Check the box "Share system audio" at the bottom
- Click "Share"

#### **Window** (Not Recommended)
- Window capture typically doesn't support audio
- Use Chrome Tab or Entire Screen instead

### Step 3: Grant Microphone Access (Optional)
- A second dialog will ask for microphone access
- Click "Allow" to include your voice in the recording
- Click "Block" if you only want system audio

### Step 4: Record Your Session
- The button will change to **"● REC 0:00"** with a timer
- The button will pulse red while recording
- Conduct your AIC training exercise
- Speak your commands and instructions

### Step 5: Stop Recording
- Click the **"● REC"** button again
- The recording will automatically download as a .webm file
- File name format: `AIC-Recording-YYYY-MM-DDTHH-MM-SS.webm`

## Troubleshooting Audio Issues

### ❌ No Audio in Recording

**Problem**: Recording plays but has no sound

**Solutions**:
1. **Most Common Issue**: You didn't check "Share tab audio" or "Share system audio"
   - When starting recording, the browser shows a checkbox at the bottom
   - Make sure it's checked before clicking "Share"

2. **Browser Tab Audio**:
   - Chrome Tab sharing is best for capturing audio
   - Select the tab, not the window

3. **System Audio**:
   - If using "Entire Screen", check "Share system audio"
   - Some systems may not support system audio capture

4. **Test Your Audio**:
   - Play some audio in the browser tab before recording
   - If you can't hear audio in the tab, the recording won't capture it either

### ❌ "Share Audio" Checkbox Not Visible

**Problem**: You don't see an option to share audio

**Solutions**:
1. **Update Your Browser**:
   - Chrome/Edge version 94+ required for best audio support
   - Update to the latest version

2. **Use Chrome Tab Instead of Window**:
   - Chrome Tab sharing always shows audio option
   - Window sharing may not support audio

3. **Try Different Share Method**:
   - Switch from Window → Chrome Tab
   - Or try Entire Screen instead

### ❌ Microphone Not Working

**Problem**: Your voice isn't in the recording

**Solutions**:
1. **Grant Microphone Permission**:
   - Look for the second permission dialog
   - Click "Allow" when asked for microphone access

2. **Check Browser Permissions**:
   - Click the lock icon in the address bar
   - Ensure Microphone is set to "Allow"

3. **Test Microphone**:
   - Make sure your microphone works in other apps
   - Check system microphone settings

### ❌ Browser Not Supported

**Problem**: Recording doesn't work at all

**Solutions**:
1. **Use Supported Browser**:
   - ✅ Chrome 90+ (Best support)
   - ✅ Edge 90+ (Best support)
   - ⚠️ Firefox 88+ (Limited audio support)
   - ❌ Safari (Not supported)

2. **Update Your Browser**:
   - Go to browser settings
   - Check for updates
   - Restart after updating

## Audio Mixing Details

The simulator now uses **Web Audio API** to mix audio streams:

### What Gets Recorded:
1. **System Audio** (if "Share tab/system audio" is checked)
   - Sounds from the browser tab
   - Any audio playing in the simulator
   - Background music or sound effects (if added)

2. **Microphone Audio** (if permission granted)
   - Your voice commands
   - Instructions to students
   - Tactical communications practice

### Audio Quality:
- **Sample Rate**: 44,100 Hz (CD quality)
- **Codec**: Opus (efficient, high quality)
- **Echo Cancellation**: Enabled for microphone
- **Noise Suppression**: Enabled for microphone
- **Format**: WebM container with VP9/VP8 video + Opus audio

## Best Practices

### For Instructors:
1. ✅ Use **Chrome Tab** sharing for best audio capture
2. ✅ Always check **"Share tab audio"** checkbox
3. ✅ Grant microphone access to record your instructions
4. ✅ Test a short recording first to verify audio
5. ✅ Speak clearly and at normal volume
6. ✅ Stop recording before closing the browser

### For Students:
1. ✅ Record your practice sessions for self-review
2. ✅ Use microphone to practice radio communications
3. ✅ Review recordings to identify areas for improvement
4. ✅ Share recordings with instructors for feedback

### Recording Tips:
- 🎤 Position microphone 6-12 inches from your mouth
- 🔊 Ensure system volume is at comfortable level
- 🎬 Start recording, then begin your exercise (not vice versa)
- ⏱️ Keep sessions under 30 minutes for manageable file sizes
- 💾 File sizes: ~10-20 MB per minute of recording
- 📁 Organize recordings by date or exercise type

## Keyboard Shortcuts Reference

- **Start/Stop Recording**: Click "RECORD" button (no keyboard shortcut)
- **ESC**: Open pause menu (pauses simulation, not recording)
- **Play/Pause**: Affects simulation only, not recording

## Technical Notes

### Audio Context Mixing:
The recording system creates a virtual audio mixer that combines:
- System audio from the screen capture
- Microphone audio from user input
- Both streams are merged in real-time

### Why This Approach:
- Ensures both audio sources are captured
- Prevents audio conflicts
- Better quality than simple stream combination
- Works across different browsers

### Browser Limitations:
- **Chrome/Edge**: Full support for tab audio + microphone
- **Firefox**: Limited system audio support
- **Safari**: No MediaRecorder API support

## Debugging Console Messages

When recording, check browser console (F12) for helpful messages:

```
Recording started successfully
System audio connected          ← Good! Tab audio is working
Microphone audio connected      ← Good! Mic is working
Using codec: video/webm;codecs=vp9,opus
Recorded chunk: 12345 bytes    ← Recording is capturing data
Recording stopped, total chunks: 234
Final blob size: 2847392 bytes ← File created successfully
Recording cleanup complete
```

If you see warnings:
```
No system audio track available  ← You didn't check "Share audio"
Microphone access denied        ← You blocked microphone
```

## File Format Information

### Output Format: WebM
- **Video**: VP9 or VP8 codec
- **Audio**: Opus codec
- **Container**: WebM
- **Playback**: VLC, Chrome, Edge, Firefox, most modern players

### Converting to Other Formats:
If you need MP4 or other formats, use free tools:
- **HandBrake** (https://handbrake.fr/)
- **VLC Media Player** (File → Convert)
- **FFmpeg** (command line)

Example FFmpeg command:
```bash
ffmpeg -i AIC-Recording.webm -c:v libx264 -c:a aac AIC-Recording.mp4
```

## Privacy & Security

- ✅ All recording happens locally in your browser
- ✅ No data is uploaded to any server
- ✅ Files are saved directly to your Downloads folder
- ✅ You control what gets recorded
- ✅ Browser asks permission before accessing camera/mic
- ✅ You can revoke permissions anytime

---

**Need Help?** Check the browser console (F12) for detailed error messages and status updates.
