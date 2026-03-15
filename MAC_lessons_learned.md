# MAC (Maritime Air Control) Lessons Learned & Reference

## Overview
Maritime Air Control (MAC) is the air control function for Surface Surveillance Coordination (SSC) missions. The MAC controller directs aircraft to investigate, classify, and identify surface contacts to establish the Recognized Maritime Picture (RMP).

## MAC Communication Format
**"Hey You, This is Me" Format:**
```
[Callsign], [MAC Callsign], [Tasking], surface track [XXXX], [Anchor], track [direction], [declaration], [fill-ins]
```

**Example:**
```
"Chippy 11, Closeout, investigate surface track 6001, Rock 270/30, track north, skunk"
```

### Components:
1. **Callsign** — The controlled asset's callsign (e.g., "Chippy 11")
2. **MAC Callsign** — Your callsign as MAC controller (e.g., "Closeout")
3. **Tasking** — Type of surface task (investigate, target, smack)
4. **Track Number** — Surface track number (e.g., "track 6001")
5. **Anchor** — Bullseye position (e.g., "Rock 270/30")
6. **Track Direction** — Contact's direction of travel (north, south, east, west)
7. **Declaration** — Surface contact classification
8. **Fill-ins** — Additional info (follow-on tracks, possible platform type, etc.)

## Surface Declarations
| Declaration | Meaning | AIC Equivalent |
|-------------|---------|----------------|
| **Skunk** | Unknown surface contact | Bogey Spades |
| **Robber** | Positively identified enemy surface vessel | Bandit |
| **Hostile** | Enemy surface vessel, weapons free criteria met | Hostile |

## Surface Tasking Types
| Type | Description | When Used |
|------|-------------|-----------|
| **Investigate** | Identify the contact | COI needs classification/ID |
| **Target** | ROE/PID requirements solved | CCOI, weapons direction needed |
| **Smack** | Weapons free on contact | Hostile, cleared to engage |

## Follow-On Tracks
MAC can assign multiple tracks for sequential investigation:
```
"Chippy 11, Closeout, investigate surface track 6001, Rock 270/30, track north, skunk,
follow on tracks 6002 and 6003"
```
Asset will investigate each track in order, reporting ID before proceeding to next.

## SSC Report Format (Asset Reports Back)
After the asset identifies a contact, they report:
```
"Closeout, Chippy 11, surface track 6001 is a [platform type], course [XXX] at [X] knots"
```

**Full VID Report:**
```
"Closeout, Chippy 11, VID track 6001, Cardinal Manson"
```

**Surface Contact Report:**
```
"Track 6001 is a group 3 tanker, Panamanian flag, course 220 at 8 knots"
```

## Platform ID Ranges
| Platform Type | ID Range | Examples |
|--------------|----------|----------|
| **Fighter Aircraft** | 15 nm | F-18E/F, F-16, F-15 |
| **Maritime Patrol Aircraft (MPA)** | 30 nm | P-3 Orion, P-8 Poseidon |

## Military Vessel Standoff
- **10 nm standoff** from identified military vessels during transit to follow-on tracks
- Assets should route around hostile surface contacts when proceeding between investigation points

## Contact of Interest (COI) vs Critical COI (CCOI)
- **COI** — Contact requiring further investigation to determine identity/intent
- **CCOI** — Contact of significant tactical importance requiring immediate attention/action

## SSC Mission Types
1. **Area Search** — Systematic search of assigned area
2. **Barrier Search** — Search along a line/barrier to detect transiting contacts
3. **Point Search** — Focused search around a specific point/contact

## Key Procedures
1. MAC issues investigate command with track number and bullseye anchor
2. Asset acknowledges and proceeds to standoff range (15nm fighters / 30nm MPA)
3. Asset establishes orbit at standoff distance
4. Asset identifies contact and reports platform type, course, and speed
5. If follow-on tracks assigned, asset proceeds to next track
6. Asset maintains 10nm standoff from military vessels during transit

## WAS (Wide Area Search) Strike
When a CCOI is identified and engagement is authorized:
1. MAC issues "target" or "smack" command
2. Asset proceeds to weapons release range
3. Asset engages with appropriate weapon (Harpoon, torpedo, etc.)
4. Asset reports BDA (Battle Damage Assessment)

## Common NATO Reporting Names (Surface)
Used when reporting VID of surface contacts:
- **Osa** — Missile patrol boat
- **Nanuchka** — Missile corvette
- **Kilo** — Submarine (diesel)
- **Sovremenny** — Destroyer
- **Slava** — Cruiser
- **Kirov** — Battlecruiser
