# Skate Flow & Cold Ops Reference

## Overview
Skate flow and cold ops are intercept procedures where fighters employ weapons and then flow cold (turn away from the threat) instead of continuing to the merge. This gives fighters range separation to re-attack remaining groups in the picture.

---

## Planned Flow Types

When targeting groups, fighters provide a **planned flow** for that group. The two options are:

### Skate Flow
- **Definition**: Launch and leave tactic. Fighters employ weapons (FOX-3), then execute an out maneuver (flow cold) once missiles go active.
- **Purpose**: Prevents fighters from having to continue hot to the bandits. Gives range to target additional groups on subsequent re-attacks.
- **Radio call**: "[Callsign] target [group], plan skate"
- **Execute call**: "[Callsign] skate [left/right], pitbull single only [group]"

### Banzai Flow
- **Definition**: Fighters decide to go to the merge with the target group.
- **Radio call**: "[Callsign] target [group], plan banzai"
- **Execute call**: "[Callsign] banzai"

---

## Flow Decision Criteria

### When to Skate
Two situations drive fighters to execute skate flow:

1. **Any picture with an azimuth component:**
   - 2 groups azimuth
   - 3 group wall
   - 3 group champagne

2. **Any picture with a range component less than Factor Range:**
   - 2 groups range (< Factor Range)
   - 3 group vic (< Factor Range)

### When to Banzai
Two situations drive fighters to execute banzai flow:

1. **Any single group picture**

2. **Any picture with a range component greater than or equal to Factor Range:**
   - Leading edge single group (>= Factor Range)

---

## Cold Ops Procedures

After fighters execute a skate, they enter **Cold Ops**:

1. **Fighters are no longer pointed at bandits** - they have no radar SA to the picture
2. **Fighters are reliant on AIC** to help make a sound targeting decision on re-attack
3. **Sequence of events:**
   a. Fighter calls timeout when weapon impacts: "[Callsign] timeout, [altitude] [group name]"
   b. Fighter waits approximately 5 seconds
   c. Fighter requests picture: "[AIC callsign], [callsign] picture"
   d. AIC provides vanished assessments and new picture

---

## AIC New Picture Call (Cold Ops)

When the fighter requests a picture during cold ops, AIC provides:

1. **Vanished assessments** for destroyed groups: "[group name] vanished"
2. **"New picture" call** with updated group names and labels:
   - "[vanished group] vanished. New picture, [count] groups [type], [group details with bullseye]"

### Group Renaming on Re-Attack
When providing the new picture, AIC re-runs the group naming system:
- **Remaining groups get new names** based on the reduced picture geometry
- Example: 3-group wall where south group vanishes:
  - Original: North Group, Middle Group, South Group
  - After south vanishes: "New picture, 2 groups azimuth" -> old Middle Group becomes **South Group**, old North Group stays **North Group**
- Example: 2-group azimuth where south group vanishes:
  - "New picture, single group" -> remaining group becomes **Single Group**
- Example: 2-group range where lead group vanishes:
  - "New picture, single group" -> trail becomes **Single Group**

---

## Fighter Re-Attack Flow

After receiving the new picture:

1. Fighter makes targeting decision: "[Callsign] target [new group name], plan [skate/banzai]"
2. Fighter calls in: "[Callsign] in [left/right]"
3. Fighter turns back toward the new target
4. Normal intercept flow resumes (declare, FOX-3, etc.)
5. If plan skate: repeat cold ops cycle
6. If plan banzai: flow to the merge

---

## "Threat To" and "Leaning On" Fill-ins

During cold ops, AIC assesses threats to the fighters:

### Threat To
- AIC assesses if any groups are **at or within threat range** to a fighter
- Added as fill-in during the new picture call
- Example: "South group Rock 260/30, 25K hostile robin, **threat to Showtime 11**"

### Leaning On
- AIC assesses if a group is **favoring/tracking toward the fighters** over time
- Added as fill-in during the new picture call
- Example: "South group Rock 260/30, 25K hostile robin, **leaning on Showtime 11**"

### Combined
- Both can be combined when conditions are met:
- "South group Rock 260/30, 25K hostile robin, **threat to and leaning on Showtime 11**"

---

## Banzai QA (AIC Responsibility)

When fighters call banzai, AIC must QA factor range to follow-on groups:

### If follow-on groups are OUTSIDE factor range:
- AIC simply responds with their callsign (acknowledgement)
- Example: FTR: "Showtime 11 banzai" -> AIC: "Closeout"

### If follow-on groups are INSIDE factor range (no factor range):
- AIC provides separation call to follow-on group as SA
- Fighter should abort based on this information
- Example: FTR: "Showtime 11 banzai" -> AIC: "Closeout, trail group separation 15"
- Fighter response: "Showtime abort right"

---

## Complete Skate Flow Example: 2 Groups Azimuth

1. **Post-commit picture**: "2 groups azimuth 10, track east. South Group Rock 220/40, 25K hostile Robin. North Group 25K hostile Robin"
2. **Fighter targets**: "Showtime target south group, plan skate"
3. **Tac range**: AIC: "Showtime 11, south group 30 miles"
4. **Declare**: Fighter declares south group -> AIC confirms hostile
5. **FOX-3**: "Showtime 11 FOX-3 south group. Closeout say separation north group"
6. **AIC separation**: "North group separation 10, 25K track east hostile Robin"
7. **Skate**: "Showtime 11 skate left, pitbull single only south group"
8. **Timeout**: "Showtime 11 timeout, 25K south group"
9. **(Wait ~5 seconds)**
10. **Picture request**: "Closeout, Showtime 11 picture"
11. **AIC new picture**: "South group vanished. New picture, single group Rock 270/20, 25K track east hostile Robin"
12. **Re-target**: "Showtime target single group, plan banzai"
13. **Re-attack**: "Showtime in left"
14. **FOX-3**: "Showtime 11 FOX-3 single group"
15. **Vanished**: AIC: "Single group vanished" -> FTR: "Showtime 11"
16. **Picture clean**: FTR requests picture -> AIC: "Picture clean, Showtime reset [station] say state"

## Complete Skate Flow Example: 3 Group Wall

1. **Post-commit picture**: "3 group wall, 10 wide track east. South Group Rock 220/40, 25K hostile robin. Middle Group separation 5, 25K hostile robin. North Group 25K hostile robin"
2. **Fighter targets**: "Showtime target south group, plan skate"
3. **Tac range / Declare / FOX-3**: Normal flow targeting south group
4. **Skate**: "Showtime 11 skate left, pitbull single only south group"
5. **Cold ops timeout + picture request**
6. **AIC new picture**: "South group vanished. New picture, 2 groups azimuth 5 track east. South group Rock 260/30, 25K hostile robin. North group 25K hostile robin"
   - Note: Old middle group is now called **south group**, old north stays **north group**
7. **Fighter re-targets**: "Showtime target south group, plan skate"
8. **Re-attack**: Normal intercept flow for new south group
9. **Skate again**: After FOX-3 on new south group
10. **AIC new picture**: "South group vanished. New picture, single group Rock 300/10, 25K track east hostile robin"
11. **Fighter re-targets**: "Showtime target single group, plan banzai" (single group = banzai)
12. **Final engagement to the merge**
13. **Picture clean / Reset**

---

## Simulator Implementation Notes

### Fighter Heading During Skate
- When fighters skate, their heading should be **180 degrees opposite** of the threat aircraft they employed weapons on
- Heading = (bearing to threat + 180) % 360
- Fighters wait 10 seconds after FOX-3 before executing the skate turn

### Timeout Behavior
- Fighters still call timeout when weapons impact the target
- After timeout, fighters wait **5 seconds** before requesting a picture from AIC

### Group Renaming
- On the new picture call, the group naming system should be re-run
- New group names are assigned based on the remaining group geometry
- The simulator should assign new group names for the re-attack

### Toggle Lock
- The Skate Flow Enable switch cannot be toggled during an active intercept
- It becomes available again after AIC calls "reset" or "picture clean"
