const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

// BULLSEYE position is now stored in state (bullseyePosition)
const INITIAL_SCALE = 100; // nautical miles
const MIN_SCALE = 5;
const MAX_SCALE = 360;
const PHYSICS_UPDATE_RATE = 1000 / 60; // 60 Hz
const WAYPOINT_ARRIVAL_THRESHOLD = 0.5; // nautical miles
const SONOBUOY_DETECTION_RANGE = 4; // nautical miles
const YARDS_PER_NAUTICAL_MILE = 2025.37;

// Asset type configurations
const ASSET_TYPES = {
    friendly: { color: '#00BFFF', badge: 'FRD', shape: 'circle' },
    hostile: { color: '#FF0000', badge: 'HST', shape: 'diamond' },
    neutral: { color: '#00FF00', badge: 'NEU', shape: 'square' },
    unknown: { color: '#FFFF00', badge: 'UNK', shape: 'square' },
    unknownUnevaluated: { color: '#FFA500', badge: 'UNU', shape: 'square' },
    ownship: { color: '#808080', badge: 'OWN', shape: 'ownship' }
};

// Geo-point type configurations
const GEOPOINT_TYPES = {
    capStation: { label: 'CAP Station', icon: 'crosshair' },
    airfield: { label: 'Airfield', icon: 'airfield' },
    samSite: { label: 'SAM Site', icon: 'samsite' },
    mark: { label: 'Mark', icon: 'mark' }
};

// Shape type configurations
const SHAPE_TYPES = {
    lineSegment: { label: 'Line Segment' },
    circle: { label: 'Circle' }
};

// Domain configurations
const DOMAIN_TYPES = {
    air: {
        label: 'Air',
        maxSpeed: 999,
        turnRate: 15, // degrees per second
        speedRate: 10, // knots per second
        hasAltitude: true,
        hasDepth: false
    },
    surface: {
        label: 'Surface',
        maxSpeed: 30,
        turnRate: 1, // degrees per second
        speedRate: 2, // knots per second
        hasAltitude: false,
        hasDepth: false
    },
    subSurface: {
        label: 'Sub-Surface',
        maxSpeed: 30,
        turnRate: 1, // degrees per second
        speedRate: 2, // knots per second
        hasAltitude: false,
        hasDepth: true
    }
};

// Turn/climb/speed rates (default for air assets)
const TURN_RATE = 15; // degrees per second
const SPEED_RATE = 10; // knots per second
const CLIMB_RATE = 100; // feet per second (6000 ft/min)

// ============================================================================
// UTILITY FUNCTIONS - NAVIGATION AND PHYSICS
// ============================================================================

// Convert decimal degrees to DMM format (Degrees & Decimal Minutes)
// Format: NXX XX.X for latitude (2 digits), EXXX XX.X for longitude (3 digits)
// Example: 26.5 -> "N26 30.0", 5.092 -> "E005 05.5"
function decimalToDMM(decimal, isLatitude) {
    const isNegative = decimal < 0;
    const absDecimal = Math.abs(decimal);
    const degrees = Math.floor(absDecimal);
    const minutes = (absDecimal - degrees) * 60;

    let direction;
    if (isLatitude) {
        direction = isNegative ? 'S' : 'N';
    } else {
        direction = isNegative ? 'W' : 'E';
    }

    // Format degrees: 2 digits for latitude, 3 digits for longitude
    const degreesPadded = isLatitude ? degrees.toString().padStart(2, '0') : degrees.toString().padStart(3, '0');

    // Format minutes: always 2 digits before decimal, 1 after (XX.X)
    const minutesPadded = minutes.toFixed(1).padStart(4, '0');

    return `${direction}${degreesPadded} ${minutesPadded}`;
}

// Convert DMM format to decimal degrees
// Example: "N26 30.0" -> 26.5 or "S26 30.0" -> -26.5
function dmmToDecimal(dmm) {
    // Match patterns like "N26 30.0", "S26 30.0", "E126 45.2", "W126 45.2"
    const match = dmm.trim().match(/^([NSEW])(\d+)\s+(\d+\.?\d*)$/i);
    if (!match) return null;

    const direction = match[1].toUpperCase();
    const degrees = parseInt(match[2]);
    const minutes = parseFloat(match[3]);

    if (minutes >= 60) return null; // Invalid minutes

    let decimal = degrees + (minutes / 60);

    // Apply negative sign for South and West
    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

// Calculate bearing between two lat/lon points (in degrees)
function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
}

// Calculate distance between two lat/lon points (in nautical miles)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const R = 3440.065; // Earth radius in nautical miles
    return R * c;
}

// Get SONO tab color based on power and armed state
function getSonoTabColor(enabled, armed) {
    if (!enabled) return '#FF0000'; // RED when OFF
    if (!armed) return '#FFFF00';   // YELLOW when ON but SAFE
    return '#00FF00';                // GREEN when ON and ARMED
}

// Get WEAPON tab color based on power and armed state
function getWeaponTabColor(enabled, armed) {
    if (!enabled) return '#FF0000'; // RED when OFF
    if (!armed) return '#FFFF00';   // YELLOW when ON but SAFE
    return '#00FF00';                // GREEN when ON and ARMED
}

// Helper function to classify weapon name to type by looking up in weaponConfigs
function classifyWeaponType(weaponName, weaponConfigs) {
    // If weaponConfigs provided, look up the weapon's type directly
    if (weaponConfigs && weaponConfigs[weaponName]) {
        return weaponConfigs[weaponName].type;
    }

    // Fallback to pattern matching if weapon not found in configs (for backwards compatibility)
    if (weaponName.includes('Harpoon') || weaponName.includes('C-802') || weaponName.includes('SS-N-') ||
        weaponName.includes('HY-') || weaponName.includes('C-701') || weaponName.includes('3M-54') ||
        weaponName.includes('Klub')) return 'ASM';

    if (weaponName.includes('AIM-') || weaponName.includes('R-')) return 'AAM';
    if (weaponName.includes('AGM-') || weaponName.includes('Kh-') || weaponName.includes('Maverick') || weaponName.includes('FAB-')) return 'AGM';
    if (weaponName.includes('SM-') || weaponName.includes('SA-N-') || weaponName.includes('RIM-')) return 'SAM';
    if (weaponName.includes('Torpedo') || weaponName.includes('53-') || weaponName.includes('Mk 46') ||
        weaponName.includes('Mk 50')) return 'Torpedo';
    return null;
}

// Check if weapon can engage target domain
function canEngageTarget(weaponType, targetDomain, weaponConfigs) {
    // Find first weapon of this type to check targetType
    const sampleWeapon = Object.values(weaponConfigs).find(w => w.type === weaponType);
    if (!sampleWeapon) return false;

    const targetType = sampleWeapon.targetType;

    if (targetType === 'air' && targetDomain === 'air') return true;
    if (targetType === 'surface' && (targetDomain === 'surface' || targetDomain === 'subSurface')) return true;
    if (targetType === 'subSurface' && targetDomain === 'subSurface') return true;

    return false;
}

// Get available weapons for engagement
function getAvailableWeapons(firingAsset, targetAsset, weaponInventory, weaponConfigs) {
    const availableWeapons = [];
    let weaponList = [];

    if (firingAsset.type === 'ownship') {
        weaponList = Object.keys(weaponInventory).filter(key => weaponInventory[key] > 0);
    } else if (firingAsset.platform?.weapons) {
        // Use helper function to classify weapons by looking up in weaponConfigs
        weaponList = firingAsset.platform.weapons
            .map(weaponName => classifyWeaponType(weaponName, weaponConfigs))
            .filter(w => w !== null);
    }

    for (const weaponType of weaponList) {
        if (canEngageTarget(weaponType, targetAsset.domain, weaponConfigs)) {
            availableWeapons.push(weaponType);
        }
    }

    return [...new Set(availableWeapons)];
}

// Format distance based on current zoom scale
function formatDistance(distanceNM, currentScale) {
    if (currentScale <= 5) {
        return Math.round(distanceNM * YARDS_PER_NAUTICAL_MILE).toString();
    }
    return Math.round(distanceNM).toString();
}

// Get distance unit suffix based on current zoom scale
function getDistanceUnit(currentScale) {
    return currentScale <= 5 ? ' yds' : '';
}

// Normalize heading to 0-359 range
function normalizeHeading(heading) {
    heading = heading % 360;
    if (heading < 0) heading += 360;
    return heading;
}

// Calculate shortest turn direction
function shortestTurn(current, target) {
    current = normalizeHeading(current);
    target = normalizeHeading(target);

    const diff = target - current;
    if (Math.abs(diff) <= 180) {
        return diff;
    } else if (diff > 180) {
        return diff - 360;
    } else {
        return diff + 360;
    }
}

// Convert lat/lon to screen coordinates
function latLonToScreen(lat, lon, centerLat, centerLon, scale, width, height) {
    // Calculate distance from center in NM
    const bearing = calculateBearing(centerLat, centerLon, lat, lon);
    const distance = calculateDistance(centerLat, centerLon, lat, lon);

    // Convert to screen coordinates
    const pixelsPerNM = Math.min(width, height) / scale;
    const x = width / 2 + distance * pixelsPerNM * Math.sin(bearing * Math.PI / 180);
    const y = height / 2 - distance * pixelsPerNM * Math.cos(bearing * Math.PI / 180);

    return { x, y };
}

// Convert screen coordinates to lat/lon
function screenToLatLon(x, y, centerLat, centerLon, scale, width, height) {
    const pixelsPerNM = Math.min(width, height) / scale;

    // Calculate distance and bearing from center
    const dx = x - width / 2;
    const dy = height / 2 - y;
    const distance = Math.sqrt(dx * dx + dy * dy) / pixelsPerNM;
    const bearing = Math.atan2(dx, dy) * 180 / Math.PI;

    // Convert to lat/lon
    const φ1 = centerLat * Math.PI / 180;
    const λ1 = centerLon * Math.PI / 180;
    const θ = bearing * Math.PI / 180;
    const δ = distance / 3440.065; // Angular distance

    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

    return {
        lat: φ2 * 180 / Math.PI,
        lon: λ2 * 180 / Math.PI
    };
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

function AICSimulator() {
    // State management
    const [assets, setAssets] = useState([
        {
            id: 0,
            name: 'OWNSHIP',
            type: 'ownship',
            domain: 'air',
            platform: null,
            lat: 26.5 - (50 / 60), // 50 NM south of bullseye (initial position)
            lon: 54.0,
            heading: 0,
            speed: 150,
            altitude: 15000,
            depth: null,
            targetHeading: null,
            targetSpeed: null,
            targetAltitude: null,
            targetDepth: null,
            waypoints: [],
            trackNumber: null
        }
    ]);
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [selectedAssetTab, setSelectedAssetTab] = useState('general');
    const [selectedSystemTab, setSelectedSystemTab] = useState('radar');
    const [isRunning, setIsRunning] = useState(false);
    const [scale, setScale] = useState(INITIAL_SCALE);
    const [mapCenter, setMapCenter] = useState({ lat: 26.5, lon: 54.0 });
    const [tempMark, setTempMark] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [cursorPos, setCursorPos] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [showAddAssetDialog, setShowAddAssetDialog] = useState(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [showControlsDialog, setShowControlsDialog] = useState(false);
    const [nextAssetId, setNextAssetId] = useState(1);
    const [nextTrackNumber, setNextTrackNumber] = useState(6000);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [draggedWaypoint, setDraggedWaypoint] = useState(null);
    const [draggedAssetId, setDraggedAssetId] = useState(null);
    const [initialScenario, setInitialScenario] = useState(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [missionTime, setMissionTime] = useState(0);
    const [bullseyeName, setBullseyeName] = useState('');
    const [bullseyePosition, setBullseyePosition] = useState({ lat: 26.5, lon: 54.0 });
    const [bullseyeLatInput, setBullseyeLatInput] = useState('N26 30.0');
    const [bullseyeLonInput, setBullseyeLonInput] = useState('E054 00.0');
    const [bullseyeSelected, setBullseyeSelected] = useState(false);
    const [draggedBullseye, setDraggedBullseye] = useState(false);
    const [radarControlsSelected, setRadarControlsSelected] = useState(false);
    const [radarReturns, setRadarReturns] = useState([]);
    const [radarSweepAngle, setRadarSweepAngle] = useState(0); // Current radar sweep angle in degrees
    const [radarEnabled, setRadarEnabled] = useState(true); // Radar ON/OFF state
    const [radarSweepOpacity, setRadarSweepOpacity] = useState(0.12); // Radar sweep opacity (0-1) - default 12%
    const [radarReturnDecay, setRadarReturnDecay] = useState(11); // Radar return decay time in seconds - default 11s
    const [radarReturnIntensity, setRadarReturnIntensity] = useState(10); // Radar return intensity (1-100%) - default 10%
    const [esmEnabled, setEsmEnabled] = useState(false); // ESM ON/OFF state (OFF by default)
    const [esmControlsSelected, setEsmControlsSelected] = useState(false); // ESM controls page selected
    const [detectedEmitters, setDetectedEmitters] = useState([]); // List of detected emitters: { id, assetId, emitterName, bearing, visible, serialNumber }
    const [selectedEsmId, setSelectedEsmId] = useState(null); // Selected ESM contact ID
    const [nextEsmSerialNumber, setNextEsmSerialNumber] = useState(1); // Counter for ESM serial numbers
    const [manualBearingLines, setManualBearingLines] = useState([]); // Manual bearing lines: { id, bearing, serialNumber, lat, lon, emitterName }
    const [nextManualLineSerialNumber, setNextManualLineSerialNumber] = useState(1); // Counter for manual line serial numbers
    const [iffEnabled, setIffEnabled] = useState(false); // IFF ON/OFF state (OFF by default)
    const [iffControlsSelected, setIffControlsSelected] = useState(false); // IFF controls page selected
    const [iffOwnshipModeI, setIffOwnshipModeI] = useState(''); // Ownship MODE I (2 digit octal)
    const [iffOwnshipModeII, setIffOwnshipModeII] = useState(''); // Ownship MODE II (4 digit octal)
    const [iffOwnshipModeIII, setIffOwnshipModeIII] = useState(''); // Ownship MODE III (4 digit octal)
    const [iffOwnshipModeIV, setIffOwnshipModeIV] = useState(false); // Ownship MODE IV ON/OFF
    const [iffReturns, setIffReturns] = useState([]); // IFF returns similar to radar returns
    const [iffReturnIntensity, setIffReturnIntensity] = useState(10); // IFF return intensity (1-100%) - default 10%
    const [datalinkEnabled, setDatalinkEnabled] = useState(false); // Datalink ON/OFF state (OFF by default)
    const [datalinkControlsSelected, setDatalinkControlsSelected] = useState(false); // Datalink controls page selected
    const [datalinkNet, setDatalinkNet] = useState(''); // User's NET (1-127)
    const [datalinkJU, setDatalinkJU] = useState(''); // User's 6 digit JU code
    const [datalinkTrackBlockStart, setDatalinkTrackBlockStart] = useState(''); // Track block start (e.g., 6000)
    const [datalinkTrackBlockEnd, setDatalinkTrackBlockEnd] = useState(''); // Track block end (e.g., 6200)
    const [nextDatalinkTrackNumber, setNextDatalinkTrackNumber] = useState(null); // Next track number to assign
    const [eoirEnabled, setEoirEnabled] = useState(false); // EO/IR system ON/OFF state (OFF by default)
    const [eoirSelectedAssetId, setEoirSelectedAssetId] = useState(null); // Asset selected for EO/IR viewing
    const [eoirWindowPos, setEoirWindowPos] = useState({ x: 20, y: 20 }); // EO/IR window position
    const [eoirWindowSize, setEoirWindowSize] = useState({ width: 400, height: 500 }); // EO/IR window size
    const [eoirDragging, setEoirDragging] = useState(false); // EO/IR window dragging state
    const [eoirDragOffset, setEoirDragOffset] = useState({ x: 0, y: 0 }); // EO/IR drag offset
    const [eoirImageErrors, setEoirImageErrors] = useState(new Set()); // Track which asset IDs have EO/IR image load errors
    const [isarEnabled, setIsarEnabled] = useState(false); // ISAR system ON/OFF state (OFF by default)
    const [isarSelectedAssetId, setIsarSelectedAssetId] = useState(null); // Asset selected for ISAR viewing
    const [isarWindowPos, setIsarWindowPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 420 : 20, y: 20 }); // ISAR window position (upper right)
    const [isarWindowSize, setIsarWindowSize] = useState({ width: 400, height: 500 }); // ISAR window size
    const [isarDragging, setIsarDragging] = useState(false); // ISAR window dragging state
    const [isarDragOffset, setIsarDragOffset] = useState({ x: 0, y: 0 }); // ISAR drag offset
    const [isarImageErrors, setIsarImageErrors] = useState(new Set()); // Track which asset IDs have ISAR image load errors

    // SONOBUOY SYSTEM STATE
    const [sonoEnabled, setSonoEnabled] = useState(false);
    const [sonoArmed, setSonoArmed] = useState(false);
    const [sonobuoys, setSonobuoys] = useState([]);
    const [sonobuoyCount, setSonobuoyCount] = useState(30);
    const [nextSonobuoyId, setNextSonobuoyId] = useState(1);
    const [sonoDetections, setSonoDetections] = useState([]);
    const [sonoGuardOpen, setSonoGuardOpen] = useState(false);

    // WEAPON SYSTEM STATE
    const [weaponEnabled, setWeaponEnabled] = useState(false);
    const [weaponArmed, setWeaponArmed] = useState(false);
    const [weaponGuardOpen, setWeaponGuardOpen] = useState(false);
    const [weapons, setWeapons] = useState([]); // Active weapons in flight
    const [nextWeaponId, setNextWeaponId] = useState(1);
    const [weaponInventory, setWeaponInventory] = useState({
        ASM: 0,
        AAM: 0,
        AGM: 0,
        SAM: 0,
        Torpedo: 0
    });
    const [weaponConfigs, setWeaponConfigs] = useState({});
    const [selectedTargetAssetId, setSelectedTargetAssetId] = useState(null);
    const [selectedWeaponType, setSelectedWeaponType] = useState(null);
    const [showRangeWarning, setShowRangeWarning] = useState(false);

    const [geoPoints, setGeoPoints] = useState([]); // Geo-points on the map
    const [nextGeoPointId, setNextGeoPointId] = useState(1);
    const [selectedGeoPointId, setSelectedGeoPointId] = useState(null);
    const [draggedGeoPointId, setDraggedGeoPointId] = useState(null);
    const [shapes, setShapes] = useState([]); // Shapes on the map
    const [nextShapeId, setNextShapeId] = useState(1);
    const [selectedShapeId, setSelectedShapeId] = useState(null);
    const [draggedShapeId, setDraggedShapeId] = useState(null);
    const [draggedShapePointIndex, setDraggedShapePointIndex] = useState(null); // For dragging individual line segment points
    const [creatingShape, setCreatingShape] = useState(null); // { type: 'lineSegment' | 'circle', points: [] }
    const [platforms, setPlatforms] = useState({ air: [], surface: [], subSurface: [] }); // Platform configurations
    const [showPlatformDialog, setShowPlatformDialog] = useState(null); // { domain: string, lat: number, lon: number }

    // Refs
    const svgRef = useRef(null);
    const physicsIntervalRef = useRef(null);
    const recordingStartTimeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const missionTimeIntervalRef = useRef(null);

    // Get selected asset
    const selectedAsset = useMemo(() =>
        assets.find(a => a.id === selectedAssetId),
        [assets, selectedAssetId]
    );

    // ========================================================================
    // LOAD PLATFORM CONFIGURATIONS
    // ========================================================================

    useEffect(() => {
        // Load platform configurations from platforms.json
        // Add timestamp to URL to prevent caching
        fetch(`platforms.json?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        })
            .then(response => response.json())
            .then(data => {
                setPlatforms(data);
            })
            .catch(error => {
                console.error('Error loading platforms:', error);
                // Set empty arrays if loading fails
                setPlatforms({ air: [], surface: [], subSurface: [] });
            });
    }, []);

    // Load weapon configurations from weapons.json
    useEffect(() => {
        fetch(`weapons.json?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        })
            .then(response => response.json())
            .then(data => setWeaponConfigs(data))
            .catch(error => {
                console.error('Error loading weapons:', error);
                setWeaponConfigs({});
            });
    }, []);

    // Assign "Ownship" platform to ownship asset when platforms are loaded
    useEffect(() => {
        if (platforms.air && platforms.air.length > 0) {
            const ownshipPlatform = platforms.air.find(p => p.name === 'Ownship');
            if (ownshipPlatform) {
                setAssets(prev => prev.map(asset => {
                    if (asset.type === 'ownship' && !asset.platform) {
                        return { ...asset, platform: ownshipPlatform };
                    }
                    return asset;
                }));
            }
        }
    }, [platforms]);

    // Initialize ownship weapon inventory when ownship platform is assigned
    useEffect(() => {
        const ownship = assets.find(a => a.type === 'ownship');
        if (ownship && ownship.platform) {
            const platform = ownship.platform;

            // Check if platform has numberOfX attributes
            if (platform.numberOfAAM !== undefined || platform.numberOfAGM !== undefined ||
                platform.numberOfASM !== undefined || platform.numberOfSAM !== undefined ||
                platform.numberOfTorpedo !== undefined) {

                const initialInventory = {
                    AAM: platform.numberOfAAM || 0,
                    AGM: platform.numberOfAGM || 0,
                    ASM: platform.numberOfASM || 0,
                    SAM: platform.numberOfSAM || 0,
                    Torpedo: platform.numberOfTorpedo || 0
                };

                setWeaponInventory(initialInventory);
            }
        }
    }, [assets]);

    // ========================================================================
    // EO/IR WINDOW DRAGGING
    // ========================================================================

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (eoirDragging) {
                setEoirWindowPos({
                    x: e.clientX - eoirDragOffset.x,
                    y: e.clientY - eoirDragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setEoirDragging(false);
        };

        if (eoirDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [eoirDragging, eoirDragOffset]);

    // ========================================================================
    // ISAR WINDOW DRAGGING
    // ========================================================================

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isarDragging) {
                setIsarWindowPos({
                    x: e.clientX - isarDragOffset.x,
                    y: e.clientY - isarDragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsarDragging(false);
        };

        if (isarDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isarDragging, isarDragOffset]);


    // ========================================================================
    // PHYSICS ENGINE
    // ========================================================================

    const updatePhysics = useCallback(() => {
        setAssets(prevAssets => prevAssets.map(asset => {
            let updated = { ...asset };
            const deltaTime = PHYSICS_UPDATE_RATE / 1000; // seconds

            // Get domain-specific configuration
            const domainConfig = DOMAIN_TYPES[asset.domain || 'air'];

            // Get platform-specific values or use domain defaults
            const turnRate = asset.platform ? asset.platform.maxTurn : domainConfig.turnRate;
            const climbRate = asset.platform && asset.platform.maxClimb ? (asset.platform.maxClimb / 60) : CLIMB_RATE; // Convert ft/min to ft/sec

            // Update heading
            if (asset.targetHeading !== null) {
                const turnAmount = shortestTurn(asset.heading, asset.targetHeading);
                if (Math.abs(turnAmount) > 1) {
                    const turnDelta = Math.sign(turnAmount) * turnRate * deltaTime;
                    updated.heading = normalizeHeading(asset.heading + turnDelta);
                } else {
                    updated.heading = asset.targetHeading;
                    updated.targetHeading = null;
                }
            }

            // Update speed
            if (asset.targetSpeed !== null) {
                const speedDiff = asset.targetSpeed - asset.speed;
                if (Math.abs(speedDiff) > 1) {
                    const speedDelta = Math.sign(speedDiff) * domainConfig.speedRate * deltaTime;
                    updated.speed = asset.speed + speedDelta;
                } else {
                    updated.speed = asset.targetSpeed;
                    updated.targetSpeed = null;
                }
            }

            // Update altitude (only for air domain)
            if (domainConfig.hasAltitude && asset.targetAltitude !== null) {
                const altDiff = asset.targetAltitude - asset.altitude;
                if (Math.abs(altDiff) > 1) {
                    const altDelta = Math.sign(altDiff) * climbRate * deltaTime;
                    updated.altitude = asset.altitude + altDelta;
                } else {
                    updated.altitude = asset.targetAltitude;
                    updated.targetAltitude = null;
                }
            }

            // Update depth (only for sub-surface domain)
            if (domainConfig.hasDepth && asset.targetDepth !== null) {
                const depthDiff = asset.targetDepth - asset.depth;
                if (Math.abs(depthDiff) > 1) {
                    const depthDelta = Math.sign(depthDiff) * 10 * deltaTime; // 10 ft/sec depth change rate
                    updated.depth = asset.depth + depthDelta;
                } else {
                    updated.depth = asset.targetDepth;
                    updated.targetDepth = null;
                }
            }

            // Update position based on speed and heading
            const speedNMPerSec = asset.speed / 3600;
            const distance = speedNMPerSec * deltaTime;

            const headingRad = asset.heading * Math.PI / 180;
            const latRad = asset.lat * Math.PI / 180;

            const deltaLat = (distance * Math.cos(headingRad)) / 60;
            const deltaLon = (distance * Math.sin(headingRad)) / (60 * Math.cos(latRad));

            updated.lat = asset.lat + deltaLat;
            updated.lon = asset.lon + deltaLon;

            // Check waypoint arrival
            if (asset.waypoints.length > 0) {
                const wp = asset.waypoints[0];
                const distToWP = calculateDistance(updated.lat, updated.lon, wp.lat, wp.lon);

                if (distToWP < WAYPOINT_ARRIVAL_THRESHOLD) {
                    // Remove current waypoint
                    updated.waypoints = asset.waypoints.slice(1);

                    // Set heading to next waypoint if exists
                    if (updated.waypoints.length > 0) {
                        const nextWP = updated.waypoints[0];
                        updated.targetHeading = calculateBearing(updated.lat, updated.lon, nextWP.lat, nextWP.lon);
                    } else {
                        // No more waypoints, clear targets
                        updated.targetHeading = null;
                    }
                }
            }

            return updated;
        }));

        // Update weapons (proportional navigation guidance)
        setWeapons(prevWeapons => {
            let currentAssets = assets; // Store reference to current assets
            const updatedWeapons = prevWeapons.map(weapon => {
                let updated = { ...weapon };
                const deltaTime = PHYSICS_UPDATE_RATE / 1000;

                const target = currentAssets.find(a => a.id === weapon.targetId);

                if (!target) {
                    // Target lost, continue on last heading
                    const speedNMPerSec = weapon.speed / 3600;
                    const distance = speedNMPerSec * deltaTime;
                    const headingRad = weapon.heading * Math.PI / 180;
                    const latRad = weapon.lat * Math.PI / 180;

                    const deltaLat = (distance * Math.cos(headingRad)) / 60;
                    const deltaLon = (distance * Math.sin(headingRad)) / (60 * Math.cos(latRad));

                    updated.lat = weapon.lat + deltaLat;
                    updated.lon = weapon.lon + deltaLon;
                    return updated;
                }

                // Proportional navigation
                const bearing = calculateBearing(weapon.lat, weapon.lon, target.lat, target.lon);
                const distance = calculateDistance(weapon.lat, weapon.lon, target.lat, target.lon);

                // Accelerate to max speed
                // Use weaponName if available (new system), fallback to weaponType (old saves)
                const configKey = weapon.weaponName || weapon.weaponType;
                const config = weaponConfigs[configKey];
                if (config && weapon.speed < config.maxSpeed) {
                    const accel = Math.min(config.maxAcceleration * deltaTime, config.maxSpeed - weapon.speed);
                    updated.speed = weapon.speed + accel;
                }

                // Update heading (max turn rate 30°/sec)
                const turnAmount = shortestTurn(weapon.heading, bearing);
                const maxTurnRate = 30;
                const turnDelta = Math.sign(turnAmount) * Math.min(Math.abs(turnAmount), maxTurnRate * deltaTime);
                updated.heading = normalizeHeading(weapon.heading + turnDelta);

                // Update position
                const speedNMPerSec = updated.speed / 3600;
                const travelDistance = speedNMPerSec * deltaTime;
                const headingRad = updated.heading * Math.PI / 180;
                const latRad = updated.lat * Math.PI / 180;

                const deltaLat = (travelDistance * Math.cos(headingRad)) / 60;
                const deltaLon = (travelDistance * Math.sin(headingRad)) / (60 * Math.cos(latRad));

                updated.lat = weapon.lat + deltaLat;
                updated.lon = weapon.lon + deltaLon;

                // Check for impact (0.1 NM threshold)
                if (distance < 0.1) {
                    updated.impact = true;
                    updated.impactTargetId = weapon.targetId;
                }

                return updated;
            });

            // Remove impacted weapons and their targets
            const impactedWeapons = updatedWeapons.filter(w => w.impact);
            if (impactedWeapons.length > 0) {
                const targetIdsToRemove = impactedWeapons.map(w => w.impactTargetId);
                setAssets(prevAssets => prevAssets.filter(a => !targetIdsToRemove.includes(a.id)));
            }

            return updatedWeapons.filter(w => !w.impact);
        });
    }, [weaponConfigs, assets]);

    // Start/stop physics engine
    useEffect(() => {
        if (isRunning) {
            setHasStarted(true);
            physicsIntervalRef.current = setInterval(() => {
                updatePhysics();
                // Update radar sweep angle - 360 degrees in 10 seconds = 36 deg/sec
                // At 60Hz: 36/60 = 0.6 degrees per frame
                setRadarSweepAngle(prev => (prev + 0.6) % 360);
            }, PHYSICS_UPDATE_RATE);
        } else {
            if (physicsIntervalRef.current) {
                clearInterval(physicsIntervalRef.current);
            }
        }

        return () => {
            if (physicsIntervalRef.current) {
                clearInterval(physicsIntervalRef.current);
            }
        };
    }, [isRunning, updatePhysics]);

    // Mission time clock
    useEffect(() => {
        if (isRunning) {
            missionTimeIntervalRef.current = setInterval(() => {
                setMissionTime(prev => prev + 1);
            }, 1000);
        } else {
            if (missionTimeIntervalRef.current) {
                clearInterval(missionTimeIntervalRef.current);
            }
        }

        return () => {
            if (missionTimeIntervalRef.current) {
                clearInterval(missionTimeIntervalRef.current);
            }
        };
    }, [isRunning]);

    // Radar return generation - create returns when sweep passes over assets
    useEffect(() => {
        if (isRunning && radarEnabled) {
            const ownship = assets.find(a => a.type === 'ownship');
            if (!ownship) return;

            // Check each asset to see if the sweep just passed over it
            assets.forEach(asset => {
                // Skip ownship itself
                if (asset.type === 'ownship') return;

                // Skip subsurface assets deeper than 15 feet (fully submerged)
                if (asset.domain === 'subSurface' && asset.depth > 15) return;

                // Calculate bearing from ownship to asset
                const bearing = calculateBearing(ownship.lat, ownship.lon, asset.lat, asset.lon);
                const distance = calculateDistance(ownship.lat, ownship.lon, asset.lat, asset.lon);

                // Skip if asset is beyond 320 NM range
                if (distance > 320) return;

                // Calculate radar horizon
                // d_total ≈ 1.23 × (√h_radar_ft + √h_target_ft)
                // For surface/subsurface assets, target height is 0
                const ownshipAltFt = ownship.altitude || 0;
                const targetAltFt = asset.domain === 'air' ? (asset.altitude || 0) : 0;
                const radarHorizonNM = 1.23 * (Math.sqrt(ownshipAltFt) + Math.sqrt(targetAltFt));

                // Skip if target is beyond radar horizon
                if (distance > radarHorizonNM) return;

                // Check if sweep angle just passed over this bearing (within 0.6 degrees)
                // We use a tolerance of 1 degree to account for timing
                const angleDiff = Math.abs(((bearing - radarSweepAngle + 540) % 360) - 180);

                if (angleDiff < 1) {
                    // Create radar return for this asset
                    const newReturn = {
                        assetId: asset.id,
                        lat: asset.lat,
                        lon: asset.lon,
                        ownshipLat: ownship.lat,  // Store ownship position at time of detection
                        ownshipLon: ownship.lon,  // Store ownship position at time of detection
                        bearing: bearing,
                        distance: distance,
                        missionTime: missionTime,
                        id: `${asset.id}-${missionTime}-${Math.random()}`
                    };
                    setRadarReturns(prev => [...prev, newReturn]);
                }
            });
        }
    }, [isRunning, radarEnabled, radarSweepAngle, assets, missionTime]);

    // Clean up old radar returns based on decay setting
    useEffect(() => {
        if (isRunning) {
            setRadarReturns(prev => prev.filter(ret => missionTime - ret.missionTime < radarReturnDecay));
        }
    }, [missionTime, isRunning, radarReturnDecay]);

    // ========================================================================
    // IFF SYSTEM - Generate IFF returns for squawking assets
    // ========================================================================

    // IFF return generation - create returns when sweep passes over squawking assets
    useEffect(() => {
        if (isRunning && iffEnabled) {
            const ownship = assets.find(a => a.type === 'ownship');
            if (!ownship) return;

            // Check each asset to see if the sweep just passed over it and it's squawking IFF
            assets.forEach(asset => {
                // Skip ownship itself
                if (asset.type === 'ownship') return;

                // Skip subsurface assets deeper than 15 feet (fully submerged)
                if (asset.domain === 'subSurface' && asset.depth > 15) return;

                // Skip assets not squawking IFF
                if (!asset.iffSquawking) return;

                // Calculate bearing from ownship to asset
                const bearing = calculateBearing(ownship.lat, ownship.lon, asset.lat, asset.lon);
                const distance = calculateDistance(ownship.lat, ownship.lon, asset.lat, asset.lon);

                // Skip if asset is beyond 320 NM range
                if (distance > 320) return;

                // Calculate radar horizon (IFF uses same horizon as radar)
                const ownshipAltFt = ownship.altitude || 0;
                const targetAltFt = asset.domain === 'air' ? (asset.altitude || 0) : 0;
                const iffHorizonNM = 1.23 * (Math.sqrt(ownshipAltFt) + Math.sqrt(targetAltFt));

                // Skip if target is beyond IFF horizon
                if (distance > iffHorizonNM) return;

                // Check if sweep angle just passed over this bearing
                const angleDiff = Math.abs(((bearing - radarSweepAngle + 540) % 360) - 180);

                if (angleDiff < 1) {
                    // Create IFF return for this asset
                    const newReturn = {
                        assetId: asset.id,
                        lat: asset.lat,
                        lon: asset.lon,
                        ownshipLat: ownship.lat,  // Store ownship position at time of interrogation
                        ownshipLon: ownship.lon,  // Store ownship position at time of interrogation
                        bearing: bearing,
                        distance: distance,
                        missionTime: missionTime,
                        modeI: asset.iffModeI,
                        modeII: asset.iffModeII,
                        modeIII: asset.iffModeIII,
                        id: `${asset.id}-${missionTime}-${Math.random()}`
                    };
                    setIffReturns(prev => [...prev, newReturn]);
                }
            });
        }
    }, [isRunning, iffEnabled, radarSweepAngle, assets, missionTime]);

    // Clean up old IFF returns based on radar decay setting (IFF returns use same decay)
    useEffect(() => {
        if (isRunning) {
            setIffReturns(prev => prev.filter(ret => missionTime - ret.missionTime < radarReturnDecay));
        }
    }, [missionTime, isRunning, radarReturnDecay]);

    // ========================================================================
    // DATALINK SYSTEM - Automatic friendly identity for same NET assets
    // ========================================================================

    useEffect(() => {
        if (!datalinkEnabled || !datalinkNet) return;

        // Check all assets and update identity based on datalink participation
        setAssets(prevAssets => {
            return prevAssets.map(asset => {
                // Skip ownship
                if (asset.type === 'ownship') return asset;

                // Convert both to strings for comparison to handle number vs string
                const userNet = String(datalinkNet);
                const assetNet = String(asset.datalinkNet);

                // Check if asset is participating in datalink on same NET (5 digits for JU now)
                const assetInDatalink = (assetNet === userNet &&
                                        assetNet !== '' && // Must have a NET set
                                        !!asset.datalinkJU &&
                                        asset.datalinkJU.length === 5 &&
                                        !!asset.datalinkTrackBlockStart &&
                                        !!asset.datalinkTrackBlockEnd);

                if (assetInDatalink) {
                    // Mark asset as active in datalink and set identity to friendly
                    if (asset.identity !== 'friendly' || !asset.datalinkActive || asset.trackNumber !== asset.datalinkJU) {
                        return {
                            ...asset,
                            identity: 'friendly',
                            datalinkActive: true,
                            trackNumber: asset.datalinkJU // Use JU as track number
                        };
                    }
                } else {
                    // Asset not in datalink on same NET, mark as inactive
                    if (asset.datalinkActive) {
                        return {
                            ...asset,
                            datalinkActive: false
                        };
                    }
                }

                return asset;
            });
        });
    }, [datalinkEnabled, datalinkNet]);

    // Check asset datalink configuration changes and update identity accordingly
    // Track previous asset datalink state to detect changes
    const prevAssetDatalinkRef = useRef(new Map());

    useEffect(() => {
        if (!datalinkEnabled || !datalinkNet) return;

        const userNet = String(datalinkNet);
        const currentAssetDatalink = new Map();

        setAssets(prevAssets => {
            let hasChanges = false;
            const updatedAssets = prevAssets.map(asset => {
                if (asset.type === 'ownship') return asset;

                // Ensure old assets have identity field
                const currentIdentity = asset.identity || 'unknown';

                // Track current state
                const stateKey = `${asset.id}`;
                const currentState = {
                    net: asset.datalinkNet,
                    ju: asset.datalinkJU,
                    start: asset.datalinkTrackBlockStart,
                    end: asset.datalinkTrackBlockEnd
                };
                currentAssetDatalink.set(stateKey, currentState);

                const assetNet = String(asset.datalinkNet);
                const assetInDatalink = (assetNet === userNet &&
                                        assetNet !== '' &&
                                        !!asset.datalinkJU &&
                                        asset.datalinkJU.length === 5 &&
                                        !!asset.datalinkTrackBlockStart &&
                                        !!asset.datalinkTrackBlockEnd);

                // Only log if state changed
                const prevState = prevAssetDatalinkRef.current.get(stateKey);
                const stateChanged = !prevState ||
                    prevState.net !== currentState.net ||
                    prevState.ju !== currentState.ju ||
                    prevState.start !== currentState.start ||
                    prevState.end !== currentState.end;

                if (asset.name && asset.datalinkNet && stateChanged) {
                    console.log('Datalink Check:', {
                        name: asset.name,
                        userNet: userNet,
                        assetNet: assetNet,
                        assetInDatalink: assetInDatalink,
                        currentIdentity: currentIdentity,
                        datalinkJU: asset.datalinkJU,
                        datalinkJULength: asset.datalinkJU?.length,
                        trackBlockStart: asset.datalinkTrackBlockStart,
                        trackBlockEnd: asset.datalinkTrackBlockEnd
                    });
                }

                if (assetInDatalink && (currentIdentity !== 'friendly' || !asset.datalinkActive || asset.trackNumber !== asset.datalinkJU)) {
                    console.log('✓ Setting asset to friendly:', asset.name);
                    hasChanges = true;
                    return {
                        ...asset,
                        identity: 'friendly',
                        datalinkActive: true,
                        trackNumber: asset.datalinkJU
                    };
                } else if (!assetInDatalink && asset.datalinkActive) {
                    hasChanges = true;
                    return {
                        ...asset,
                        datalinkActive: false
                    };
                } else if (asset.identity === undefined) {
                    // Fix old assets missing identity field
                    hasChanges = true;
                    return {
                        ...asset,
                        identity: 'unknown'
                    };
                }

                return asset;
            });

            // Update ref for next comparison
            prevAssetDatalinkRef.current = currentAssetDatalink;

            if (hasChanges) {
                console.log('Updating assets with new datalink identities');
                return updatedAssets;
            }
            return prevAssets;
        });
    }, [assets, datalinkEnabled, datalinkNet]);

    // ========================================================================
    // ESM SYSTEM - Detect active emitters
    // ========================================================================

    useEffect(() => {
        if (!esmEnabled) {
            // Clear detected emitters when ESM is off
            setDetectedEmitters([]);
            setNextEsmSerialNumber(1);
            return;
        }

        const ownship = assets.find(a => a.type === 'ownship');
        if (!ownship) return;

        // Build list of all active emitters from other assets
        const activeEmitters = [];
        assets.forEach(asset => {
            // Skip ownship
            if (asset.type === 'ownship') return;

            // Skip assets without platforms or emitters
            if (!asset.platform || !asset.platform.emitters || asset.platform.emitters.length === 0) return;

            // Check each emitter
            asset.platform.emitters.forEach(emitterName => {
                // Check if this emitter is turned ON
                if (asset.emitterStates && asset.emitterStates[emitterName]) {
                    // Calculate bearing from ownship to this asset
                    const bearing = calculateBearing(ownship.lat, ownship.lon, asset.lat, asset.lon);

                    // Create unique ID for this emitter
                    const emitterId = `${asset.id}-${emitterName}`;

                    activeEmitters.push({
                        id: emitterId,
                        assetId: asset.id,
                        emitterName: emitterName,
                        bearing: bearing,
                        lat: asset.lat,
                        lon: asset.lon,
                        threatLevel: asset.platform.threatLevel || 3 // Default to 3 if not specified
                    });
                }
            });
        });

        // Update detected emitters list, preserving serial numbers, visibility states, and age tracking
        setDetectedEmitters(prev => {
            const updated = [];
            const prevMap = new Map(prev.map(e => [e.id, e]));
            const activeEmitterIds = new Set(activeEmitters.map(e => e.id));

            // Add currently active emitters
            activeEmitters.forEach(emitter => {
                const existing = prevMap.get(emitter.id);
                if (existing) {
                    // Keep existing emitter with updated bearing and position, reset lastSeenTime
                    updated.push({
                        ...existing,
                        bearing: emitter.bearing,
                        lat: emitter.lat,
                        lon: emitter.lon,
                        lastSeenTime: missionTime, // Reset last seen time
                        active: true
                    });
                } else {
                    // New emitter detected - assign serial number
                    const serialNumber = prev.length > 0 ? Math.max(...prev.map(e => e.serialNumber)) + 1 : nextEsmSerialNumber;
                    updated.push({
                        ...emitter,
                        serialNumber: serialNumber,
                        visible: true, // Default to visible
                        lastSeenTime: missionTime,
                        active: true
                    });
                    setNextEsmSerialNumber(serialNumber + 1);
                }
            });

            // Keep previously detected emitters that are no longer active (for age tracking)
            prev.forEach(prevEmitter => {
                if (!activeEmitterIds.has(prevEmitter.id)) {
                    // Emitter no longer active, but keep it in the list
                    updated.push({
                        ...prevEmitter,
                        active: false
                    });
                }
            });

            return updated;
        });
    }, [esmEnabled, assets, nextEsmSerialNumber, missionTime]);

    // ========================================================================
    // SONOBUOY DETECTION SYSTEM
    // ========================================================================

    useEffect(() => {
        if (!sonoEnabled || sonobuoys.length === 0) {
            setSonoDetections([]);
            return;
        }

        const submarines = assets.filter(a => a.domain === 'subSurface');
        if (submarines.length === 0) {
            setSonoDetections([]);
            return;
        }

        const detections = [];
        sonobuoys.forEach(sono => {
            submarines.forEach(sub => {
                const distance = calculateDistance(sono.lat, sono.lon, sub.lat, sub.lon);
                if (distance <= SONOBUOY_DETECTION_RANGE) {
                    const bearing = calculateBearing(sono.lat, sono.lon, sub.lat, sub.lon);
                    detections.push({
                        id: `sono-${sono.id}-sub-${sub.id}`,
                        sonobuoyId: sono.id,
                        submarineId: sub.id,
                        bearing: bearing,
                        sonoLat: sono.lat,
                        sonoLon: sono.lon,
                        subLat: sub.lat,
                        subLon: sub.lon
                    });
                }
            });
        });

        setSonoDetections(detections);
    }, [sonoEnabled, sonobuoys, assets, missionTime]);

    // ========================================================================
    // ASSET MANAGEMENT
    // ========================================================================

    const addAsset = useCallback((assetData) => {
        // Determine domain (default to 'air' if not specified)
        const domain = assetData.domain || 'air';
        const domainConfig = DOMAIN_TYPES[domain];

        // Get platform if specified
        const platform = assetData.platform || null;

        // Set default values based on domain and platform
        let speed = assetData.speed !== undefined ? assetData.speed : (domain === 'air' ? 350 : 15);
        let altitude = assetData.altitude !== undefined ? assetData.altitude : (domain === 'air' ? 25000 : 0);
        let depth = assetData.depth !== undefined ? assetData.depth : (domain === 'subSurface' ? 50 : null);

        // Apply ownship limits if creating ownship
        if (assetData.type === 'ownship') {
            speed = Math.min(220, speed);
            altitude = Math.min(27000, altitude);
        }

        // Apply platform-specific limits if platform is assigned
        if (platform) {
            speed = Math.min(platform.maxSpeed, speed);
            if (domainConfig.hasAltitude) {
                altitude = Math.min(platform.maxAltitude, altitude);
            }
        } else {
            // Apply domain-specific speed limits if no platform
            speed = Math.min(domainConfig.maxSpeed, speed);
        }

        // Initialize emitter states (all emitters off by default)
        const emitterStates = {};
        if (platform && platform.emitters && platform.emitters.length > 0) {
            platform.emitters.forEach(emitter => {
                emitterStates[emitter] = false; // default: off
            });
        }

        // Initialize weapon inventory for ownship
        if (assetData.type === 'ownship' && platform?.weapons) {
            let initialInventory = {
                ASM: 0, AAM: 0, AGM: 0, SAM: 0, Torpedo: 0
            };

            // NEW SYSTEM: Check if platform has numberOfX attributes
            if (platform.numberOfAAM !== undefined || platform.numberOfAGM !== undefined ||
                platform.numberOfASM !== undefined || platform.numberOfSAM !== undefined ||
                platform.numberOfTorpedo !== undefined) {

                // Use platform-specified counts
                initialInventory.AAM = platform.numberOfAAM || 0;
                initialInventory.AGM = platform.numberOfAGM || 0;
                initialInventory.ASM = platform.numberOfASM || 0;
                initialInventory.SAM = platform.numberOfSAM || 0;
                initialInventory.Torpedo = platform.numberOfTorpedo || 0;

            } else {
                // BACKWARD COMPATIBILITY: Use old pattern matching
                platform.weapons.forEach(weaponName => {
                    const weaponType = classifyWeaponType(weaponName, weaponConfigs);
                    if (weaponType === 'AAM') initialInventory.AAM += 4;
                    if (weaponType === 'ASM') initialInventory.ASM += 2;
                    if (weaponType === 'AGM') initialInventory.AGM += 2;
                    if (weaponType === 'Torpedo') initialInventory.Torpedo += 4;
                    if (weaponType === 'SAM') initialInventory.SAM += 4;
                });
            }

            setWeaponInventory(initialInventory);
        }

        const newAsset = {
            id: nextAssetId,
            name: assetData.name || `Asset ${nextAssetId}`,
            type: assetData.type || 'unknown',
            identity: assetData.identity || 'unknown', // friendly, hostile, neutral, unknown, unknownUnevaluated
            domain: domain,
            platform: platform,
            lat: assetData.lat || bullseyePosition.lat,
            lon: assetData.lon || bullseyePosition.lon,
            heading: assetData.heading || 0,
            speed: speed,
            altitude: domainConfig.hasAltitude ? altitude : 0,
            depth: domainConfig.hasDepth ? depth : null,
            targetHeading: null,
            targetSpeed: null,
            targetAltitude: domainConfig.hasAltitude ? null : null,
            targetDepth: domainConfig.hasDepth ? null : null,
            waypoints: [],
            trackNumber: null,
            emitterStates: emitterStates,
            iffModeI: assetData.iffModeI || '',
            iffModeII: assetData.iffModeII || '',
            iffModeIII: assetData.iffModeIII || '',
            iffSquawking: assetData.iffSquawking !== undefined ? assetData.iffSquawking : false,
            datalinkNet: assetData.datalinkNet || '',
            datalinkJU: assetData.datalinkJU || '',
            datalinkTrackBlockStart: assetData.datalinkTrackBlockStart || '',
            datalinkTrackBlockEnd: assetData.datalinkTrackBlockEnd || '',
            datalinkActive: false, // Whether asset is active in datalink
            datalinkAssignedTrack: null // Track number assigned when reported to datalink
        };

        setAssets(prev => [...prev, newAsset]);
        setNextAssetId(prev => prev + 1);
        setSelectedAssetId(newAsset.id);
    }, [nextAssetId, bullseyePosition]);

    const deleteAsset = useCallback((assetId) => {
        // Prevent deletion of ownship
        const asset = assets.find(a => a.id === assetId);
        if (asset && asset.type === 'ownship') {
            alert('Ownship cannot be deleted');
            return;
        }

        setAssets(prev => prev.filter(a => a.id !== assetId));
        if (selectedAssetId === assetId) {
            setSelectedAssetId(null);
        }
    }, [selectedAssetId, assets]);

    const centerMapOnAsset = useCallback((assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            setMapCenter({ lat: asset.lat, lon: asset.lon });
        }
    }, [assets]);

    const fireWeapon = useCallback((firingAssetId, targetAssetId, weaponType) => {
        console.log('fireWeapon called:', { firingAssetId, targetAssetId, weaponType });

        const firingAsset = assets.find(a => a.id === firingAssetId);
        const targetAsset = assets.find(a => a.id === targetAssetId);

        console.log('Assets found:', { firingAsset: firingAsset?.name, targetAsset: targetAsset?.name });

        if (!firingAsset || !targetAsset) {
            console.warn('Missing firing asset or target asset');
            return;
        }

        // === NEW: SELECT WEAPON VARIANT ===
        let selectedWeaponName = null;

        console.log('Firing asset platform:', firingAsset.platform?.name);
        console.log('Platform weapons:', firingAsset.platform?.weapons);
        console.log('Available weaponConfigs:', Object.keys(weaponConfigs));

        // For both ownship and non-ownship: Select FIRST weapon variant from platform that matches type
        if (firingAsset.platform?.weapons) {
            selectedWeaponName = firingAsset.platform.weapons.find(weaponName => {
                const config = weaponConfigs[weaponName];
                console.log(`Checking weapon ${weaponName}: config exists=${!!config}, type=${config?.type}, matches=${config?.type === weaponType}`);
                return config && config.type === weaponType;
            });
        }

        console.log('Selected weapon name:', selectedWeaponName);

        if (!selectedWeaponName) {
            console.warn(`No weapon variant found for type ${weaponType}`);
            console.warn('Platform weapons:', firingAsset.platform?.weapons);
            console.warn('Weapon configs available:', Object.keys(weaponConfigs));
            return;
        }

        const config = weaponConfigs[selectedWeaponName];
        if (!config) {
            console.warn(`Weapon config not found for ${selectedWeaponName}`);
            return;
        }

        console.log('Using weapon config:', config);
        // === END NEW CODE ===

        const range = calculateDistance(firingAsset.lat, firingAsset.lon, targetAsset.lat, targetAsset.lon);

        if (range > config.maxRange) {
            setShowRangeWarning(true);
            setTimeout(() => setShowRangeWarning(false), 2000);
            return;
        }

        const affiliation = firingAsset.identity === 'friendly' || firingAsset.type === 'ownship' ? 'friendly' : 'hostile';

        const newWeapon = {
            id: nextWeaponId,
            weaponType: weaponType,              // Keep for UI/inventory tracking
            weaponName: selectedWeaponName,      // NEW: Store actual weapon variant
            lat: firingAsset.lat,
            lon: firingAsset.lon,
            heading: calculateBearing(firingAsset.lat, firingAsset.lon, targetAsset.lat, targetAsset.lon),
            speed: 100,
            altitude: firingAsset.altitude || 0,
            targetId: targetAssetId,
            firingAssetId: firingAssetId,
            affiliation: affiliation,
            launchTime: missionTime
        };

        setWeapons(prev => [...prev, newWeapon]);
        setNextWeaponId(prev => prev + 1);

        if (firingAsset.type === 'ownship') {
            setWeaponInventory(prev => ({
                ...prev,
                [weaponType]: Math.max(0, prev[weaponType] - 1)
            }));
        }
    }, [assets, weaponConfigs, nextWeaponId, missionTime]);

    const updateAsset = useCallback((assetId, updates) => {
        setAssets(prev => prev.map(a => {
            if (a.id !== assetId) return a;

            // Prevent changing type to or from ownship
            if (updates.type !== undefined) {
                if (a.type === 'ownship' || updates.type === 'ownship') {
                    alert('Ownship type cannot be changed');
                    return a;
                }
            }

            const updatedAsset = { ...a, ...updates };

            // Apply ownship limits
            if (updatedAsset.type === 'ownship') {
                if (updates.targetSpeed !== undefined) {
                    updatedAsset.targetSpeed = Math.min(220, updates.targetSpeed);
                }
                if (updates.targetAltitude !== undefined) {
                    updatedAsset.targetAltitude = Math.min(27000, updates.targetAltitude);
                }
                // Also limit current values if they exceed limits
                if (updatedAsset.speed > 220) {
                    updatedAsset.speed = 220;
                }
                if (updatedAsset.altitude > 27000) {
                    updatedAsset.altitude = 27000;
                }
            }

            return updatedAsset;
        }));
    }, []);

    const reportTrack = useCallback((assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        // Don't allow reporting ownship
        if (asset.type === 'ownship') {
            alert('Cannot report ownship track');
            return;
        }

        // Check if datalink is active (5 digits for JU now)
        const datalinkActive = datalinkEnabled &&
                               datalinkNet &&
                               datalinkJU.length === 5 &&
                               datalinkTrackBlockStart &&
                               datalinkTrackBlockEnd;

        if (!datalinkActive) {
            alert('Datalink must be powered on with NET, JU, and Track Block configured');
            return;
        }

        // Check if asset is already in datalink with same NET - silently skip
        if (asset.datalinkNet === datalinkNet &&
            asset.datalinkJU &&
            asset.datalinkJU.length === 5 &&
            asset.datalinkTrackBlockStart &&
            asset.datalinkTrackBlockEnd) {
            return; // Removed alert - just silently ignore
        }

        // Check if we have tracks available in the block
        if (nextDatalinkTrackNumber === null) {
            alert('Track block start must be configured');
            return;
        }

        const trackBlockEnd = parseInt(datalinkTrackBlockEnd);
        if (nextDatalinkTrackNumber > trackBlockEnd) {
            alert('Track block exhausted. No more tracks available.');
            return;
        }

        // Assign track number from datalink track block
        updateAsset(assetId, {
            trackNumber: nextDatalinkTrackNumber,
            datalinkAssignedTrack: nextDatalinkTrackNumber
        });

        // Increment to next track number
        setNextDatalinkTrackNumber(prev => prev + 1);
    }, [assets, updateAsset, datalinkEnabled, datalinkNet, datalinkJU, datalinkTrackBlockStart, datalinkTrackBlockEnd, nextDatalinkTrackNumber]);

    // ========================================================================
    // WAYPOINT MANAGEMENT
    // ========================================================================

    const addWaypoint = useCallback((assetId, lat, lon, isFirst = false) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id !== assetId) return asset;

            const newWaypoint = { lat, lon };
            const newWaypoints = isFirst ? [newWaypoint] : [...asset.waypoints, newWaypoint];

            // If first waypoint, set heading toward it
            let updates = { waypoints: newWaypoints };
            if (newWaypoints.length === 1) {
                updates.targetHeading = calculateBearing(asset.lat, asset.lon, lat, lon);
            }

            return { ...asset, ...updates };
        }));
    }, []);

    const deleteWaypoint = useCallback((assetId, wpIndex) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id !== assetId) return asset;

            const newWaypoints = asset.waypoints.filter((_, i) => i !== wpIndex);

            // If deleted first waypoint and there's another, update heading
            let updates = { waypoints: newWaypoints };
            if (wpIndex === 0 && newWaypoints.length > 0) {
                updates.targetHeading = calculateBearing(
                    asset.lat, asset.lon,
                    newWaypoints[0].lat, newWaypoints[0].lon
                );
            }

            return { ...asset, ...updates };
        }));
    }, []);

    const moveWaypoint = useCallback((assetId, wpIndex, lat, lon) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id !== assetId) return asset;

            const newWaypoints = [...asset.waypoints];
            newWaypoints[wpIndex] = { lat, lon };

            // If moved first waypoint, update heading
            let updates = { waypoints: newWaypoints };
            if (wpIndex === 0) {
                updates.targetHeading = calculateBearing(asset.lat, asset.lon, lat, lon);
            }

            return { ...asset, ...updates };
        }));
    }, []);

    // ========================================================================
    // GEO-POINT MANAGEMENT
    // ========================================================================

    const addGeoPoint = useCallback((lat, lon, geoPointType) => {
        const newGeoPoint = {
            id: nextGeoPointId,
            name: '', // Blank name by default
            type: geoPointType,
            lat: lat,
            lon: lon,
            identity: 'unknown' // Default identity
        };

        setGeoPoints(prev => [...prev, newGeoPoint]);
        setNextGeoPointId(prev => prev + 1);
        setSelectedGeoPointId(newGeoPoint.id);
        setSelectedAssetId(null);
        setBullseyeSelected(false);
        setRadarControlsSelected(false);
    }, [nextGeoPointId]);

    const deleteGeoPoint = useCallback((geoPointId) => {
        setGeoPoints(prev => prev.filter(gp => gp.id !== geoPointId));
        if (selectedGeoPointId === geoPointId) {
            setSelectedGeoPointId(null);
        }
    }, [selectedGeoPointId]);

    const updateGeoPoint = useCallback((geoPointId, updates) => {
        setGeoPoints(prev => prev.map(gp => {
            if (gp.id !== geoPointId) return gp;
            return { ...gp, ...updates };
        }));
    }, []);

    // ========================================================================
    // SHAPE MANAGEMENT
    // ========================================================================

    const startCreatingShape = useCallback((shapeType, lat, lon) => {
        if (shapeType === 'lineSegment') {
            // Start line segment with first point (with blank name)
            setCreatingShape({
                type: 'lineSegment',
                points: [{ lat, lon, name: '' }]
            });
        } else if (shapeType === 'circle') {
            // Create circle immediately at clicked location with default radius
            const newShape = {
                id: nextShapeId,
                type: 'circle',
                centerLat: lat,
                centerLon: lon,
                radius: 10, // Default 10 NM radius
                identity: 'unknown'
            };
            setShapes(prev => [...prev, newShape]);
            setNextShapeId(prev => prev + 1);
            setSelectedShapeId(newShape.id);
            setSelectedAssetId(null);
            setSelectedGeoPointId(null);
            setBullseyeSelected(false);
            setRadarControlsSelected(false);
        }
        setContextMenu(null);
    }, [nextShapeId]);

    const addLineSegmentPoint = useCallback((lat, lon) => {
        if (!creatingShape || creatingShape.type !== 'lineSegment') return;

        setCreatingShape(prev => ({
            ...prev,
            points: [...prev.points, { lat, lon, name: '' }]
        }));
    }, [creatingShape]);

    const finishLineSegment = useCallback(() => {
        if (!creatingShape || creatingShape.type !== 'lineSegment' || creatingShape.points.length < 2) {
            setCreatingShape(null);
            return;
        }

        const newShape = {
            id: nextShapeId,
            type: 'lineSegment',
            points: creatingShape.points,
            identity: 'unknown'
        };
        setShapes(prev => [...prev, newShape]);
        setNextShapeId(prev => prev + 1);
        setSelectedShapeId(newShape.id);
        setCreatingShape(null);
        setSelectedAssetId(null);
        setSelectedGeoPointId(null);
        setBullseyeSelected(false);
        setRadarControlsSelected(false);
    }, [creatingShape, nextShapeId]);

    const cancelShapeCreation = useCallback(() => {
        setCreatingShape(null);
    }, []);

    const deleteShape = useCallback((shapeId) => {
        setShapes(prev => prev.filter(s => s.id !== shapeId));
        if (selectedShapeId === shapeId) {
            setSelectedShapeId(null);
        }
    }, [selectedShapeId]);

    const deleteManualBearingLine = useCallback((lineId) => {
        setManualBearingLines(prev => prev.filter(l => l.id !== lineId));
        if (selectedEsmId === lineId) {
            setSelectedEsmId(null);
        }
    }, [selectedEsmId]);

    const updateShape = useCallback((shapeId, updates) => {
        setShapes(prev => prev.map(s => {
            if (s.id !== shapeId) return s;
            return { ...s, ...updates };
        }));
    }, []);

    // ========================================================================
    // RECORDING FUNCTIONALITY
    // ========================================================================

    const startRecording = useCallback(async () => {
        try {
            // Request screen capture with system audio
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    cursor: 'always'
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    sampleRate: 44100
                }
            });

            // Request microphone audio
            let micStream = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });
            } catch (e) {
                console.warn('Microphone access denied, recording without mic audio');
            }

            // Create audio context to mix audio streams
            const audioContext = new AudioContext();
            const audioDestination = audioContext.createMediaStreamDestination();

            // Add system audio if available
            const systemAudioTracks = displayStream.getAudioTracks();
            if (systemAudioTracks.length > 0) {
                const systemAudioSource = audioContext.createMediaStreamSource(
                    new MediaStream(systemAudioTracks)
                );
                systemAudioSource.connect(audioDestination);
                console.log('System audio connected');
            } else {
                console.warn('No system audio track available');
            }

            // Add microphone audio if available
            if (micStream) {
                const micAudioSource = audioContext.createMediaStreamSource(micStream);
                micAudioSource.connect(audioDestination);
                console.log('Microphone audio connected');
            }

            // Combine video from display stream with mixed audio
            const videoTrack = displayStream.getVideoTracks()[0];
            const combinedStream = new MediaStream([
                videoTrack,
                ...audioDestination.stream.getTracks()
            ]);

            // Determine best supported codec
            let options = { mimeType: 'video/webm;codecs=vp9,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm;codecs=vp8,opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm' };
                }
            }
            console.log('Using codec:', options.mimeType);

            const mediaRecorder = new MediaRecorder(combinedStream, options);

            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    console.log('Recorded chunk:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.onstop = () => {
                console.log('Recording stopped, total chunks:', recordedChunksRef.current.length);

                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                console.log('Final blob size:', blob.size, 'bytes');

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `AIC-Recording-${new Date().toISOString().replace(/:/g, '-')}.webm`;
                a.click();
                URL.revokeObjectURL(url);

                // Clean up streams and audio context
                combinedStream.getTracks().forEach(track => track.stop());
                displayStream.getTracks().forEach(track => track.stop());
                if (micStream) {
                    micStream.getTracks().forEach(track => track.stop());
                }
                audioContext.close();

                console.log('Recording cleanup complete');
            };

            // Start recording with data available every 100ms
            mediaRecorder.start(100);
            mediaRecorderRef.current = mediaRecorder;
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);

            console.log('Recording started successfully');

        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Failed to start recording. Please ensure you:\n1. Grant screen capture permissions\n2. Select "Share system audio" when prompted\n3. Grant microphone access (optional)');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingTime(0);
        }
    }, []);

    // Update recording time
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // ========================================================================
    // SAVE/LOAD FUNCTIONALITY
    // ========================================================================

    const saveToLocalStorage = useCallback((name) => {
        const saveData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            assets,
            bullseye: bullseyePosition,
            bullseyeName,
            scale,
            mapCenter,
            tempMark,
            nextTrackNumber,
            missionTime,
            geoPoints,
            nextGeoPointId,
            shapes,
            nextShapeId,
            sonobuoys,
            sonobuoyCount,
            nextSonobuoyId,
            weapons,
            weaponInventory,
            nextWeaponId,
            weaponEnabled,
            weaponArmed,
            selectedWeaponType
        };

        localStorage.setItem(`aic-scenario-${name}`, JSON.stringify(saveData));
        alert(`Scenario saved to application: ${name}`);
    }, [assets, bullseyePosition, bullseyeName, scale, mapCenter, tempMark, nextTrackNumber, missionTime, geoPoints, nextGeoPointId, shapes, nextShapeId, sonobuoys, sonobuoyCount, nextSonobuoyId, weapons, weaponInventory, nextWeaponId, weaponEnabled, weaponArmed, selectedWeaponType]);

    const saveToFile = useCallback((name) => {
        const saveData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            assets,
            bullseye: bullseyePosition,
            bullseyeName,
            scale,
            mapCenter,
            tempMark,
            nextTrackNumber,
            missionTime,
            geoPoints,
            nextGeoPointId,
            shapes,
            nextShapeId,
            sonobuoys,
            sonobuoyCount,
            nextSonobuoyId,
            weapons,
            weaponInventory,
            nextWeaponId,
            weaponEnabled,
            weaponArmed,
            selectedWeaponType
        };

        const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [assets, bullseyePosition, bullseyeName, scale, mapCenter, tempMark, nextTrackNumber, missionTime, geoPoints, nextGeoPointId, shapes, nextShapeId, sonobuoys, sonobuoyCount, nextSonobuoyId, weapons, weaponInventory, nextWeaponId, weaponEnabled, weaponArmed, selectedWeaponType]);

    const loadFromLocalStorage = useCallback((name) => {
        const data = localStorage.getItem(`aic-scenario-${name}`);
        if (data) {
            const saveData = JSON.parse(data);

            // Ensure ownship is always present
            let loadedAssets = saveData.assets || [];

            // Migrate old assets to include domain and platform properties (backward compatibility)
            loadedAssets = loadedAssets.map(asset => {
                const migrated = { ...asset };

                // Add domain if missing
                if (!migrated.domain) {
                    migrated.domain = 'air';
                    migrated.depth = null;
                    migrated.targetDepth = null;
                    migrated.altitude = asset.altitude !== undefined ? asset.altitude : 25000;
                    migrated.targetAltitude = asset.targetAltitude !== undefined ? asset.targetAltitude : null;
                }

                // Add platform if missing
                if (migrated.platform === undefined) {
                    migrated.platform = null;
                }

                return migrated;
            });

            const ownshipIndex = loadedAssets.findIndex(a => a.id === 0 || a.type === 'ownship');

            // Load bullseye position (with fallback to default)
            const loadedBullseye = saveData.bullseye || { lat: 26.5, lon: 54.0 };
            setBullseyePosition(loadedBullseye);
            setBullseyeLatInput(decimalToDMM(loadedBullseye.lat, true));
            setBullseyeLonInput(decimalToDMM(loadedBullseye.lon, false));

            if (ownshipIndex === -1) {
                // No ownship found, add default ownship 50 NM south of bullseye
                loadedAssets = [{
                    id: 0,
                    name: 'OWNSHIP',
                    type: 'ownship',
                    domain: 'air',
                    platform: null,
                    lat: loadedBullseye.lat - (50 / 60),
                    lon: loadedBullseye.lon,
                    heading: 0,
                    speed: 150,
                    altitude: 15000,
                    depth: null,
                    targetHeading: null,
                    targetSpeed: null,
                    targetAltitude: null,
                    targetDepth: null,
                    waypoints: [],
                    trackNumber: null
                }, ...loadedAssets];
            } else if (loadedAssets[ownshipIndex].id !== 0) {
                // Ownship exists but has wrong ID, fix it
                loadedAssets[ownshipIndex].id = 0;
            }

            setAssets(loadedAssets);
            setScale(saveData.scale || INITIAL_SCALE);
            setMapCenter(saveData.mapCenter || loadedBullseye);
            setTempMark(saveData.tempMark || null);
            setNextTrackNumber(saveData.nextTrackNumber || 6000);
            setSelectedAssetId(null);
            setBullseyeSelected(false);
            setSelectedGeoPointId(null);
            setSelectedShapeId(null);
            setHasStarted(true);
            setMissionTime(saveData.missionTime || 0);
            setBullseyeName(saveData.bullseyeName || '');
            setGeoPoints(saveData.geoPoints || []);
            setNextGeoPointId(saveData.nextGeoPointId || 1);
            setShapes(saveData.shapes || []);
            setNextShapeId(saveData.nextShapeId || 1);
            setSonobuoys(saveData.sonobuoys || []);
            setSonobuoyCount(saveData.sonobuoyCount !== undefined ? saveData.sonobuoyCount : 30);
            setNextSonobuoyId(saveData.nextSonobuoyId || 1);
            setWeapons(saveData.weapons || []);
            setWeaponInventory(saveData.weaponInventory || { ASM: 0, AAM: 0, AGM: 0, SAM: 0, Torpedo: 0 });
            setNextWeaponId(saveData.nextWeaponId || 1);
            setWeaponEnabled(saveData.weaponEnabled || false);
            setWeaponArmed(saveData.weaponArmed || false);
            setWeaponGuardOpen(false);
            setSelectedTargetAssetId(null);
            setSelectedWeaponType(saveData.selectedWeaponType || null);

            // Find max asset ID
            const maxId = loadedAssets.reduce((max, a) => Math.max(max, a.id), 0);
            setNextAssetId(maxId + 1);

            // Save as initial scenario for restart
            setInitialScenario({
                assets: JSON.parse(JSON.stringify(loadedAssets)),
                scale: saveData.scale || INITIAL_SCALE,
                mapCenter: saveData.mapCenter || loadedBullseye,
                tempMark: saveData.tempMark || null,
                nextTrackNumber: saveData.nextTrackNumber || 6000,
                nextAssetId: maxId + 1,
                geoPoints: JSON.parse(JSON.stringify(saveData.geoPoints || [])),
                nextGeoPointId: saveData.nextGeoPointId || 1,
                shapes: JSON.parse(JSON.stringify(saveData.shapes || [])),
                nextShapeId: saveData.nextShapeId || 1,
                sonobuoys: JSON.parse(JSON.stringify(saveData.sonobuoys || [])),
                sonobuoyCount: saveData.sonobuoyCount !== undefined ? saveData.sonobuoyCount : 30,
                nextSonobuoyId: saveData.nextSonobuoyId || 1
            });
        }
    }, []);

    const loadFromFile = useCallback((event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const saveData = JSON.parse(e.target.result);

                    // Ensure ownship is always present
                    let loadedAssets = saveData.assets || [];

                    // Migrate old assets to include domain and platform properties (backward compatibility)
                    loadedAssets = loadedAssets.map(asset => {
                        const migrated = { ...asset };

                        // Add domain if missing
                        if (!migrated.domain) {
                            migrated.domain = 'air';
                            migrated.depth = null;
                            migrated.targetDepth = null;
                            migrated.altitude = asset.altitude !== undefined ? asset.altitude : 25000;
                            migrated.targetAltitude = asset.targetAltitude !== undefined ? asset.targetAltitude : null;
                        }

                        // Add platform if missing
                        if (migrated.platform === undefined) {
                            migrated.platform = null;
                        }

                        return migrated;
                    });

                    const ownshipIndex = loadedAssets.findIndex(a => a.id === 0 || a.type === 'ownship');

                    // Load bullseye position (with fallback to default)
                    const loadedBullseye = saveData.bullseye || { lat: 26.5, lon: 54.0 };
                    setBullseyePosition(loadedBullseye);
                    setBullseyeLatInput(decimalToDMM(loadedBullseye.lat, true));
                    setBullseyeLonInput(decimalToDMM(loadedBullseye.lon, false));

                    if (ownshipIndex === -1) {
                        // No ownship found, add default ownship 50 NM south of bullseye
                        loadedAssets = [{
                            id: 0,
                            name: 'OWNSHIP',
                            type: 'ownship',
                            domain: 'air',
                            platform: null,
                            lat: loadedBullseye.lat - (50 / 60),
                            lon: loadedBullseye.lon,
                            heading: 0,
                            speed: 150,
                            altitude: 15000,
                            depth: null,
                            targetHeading: null,
                            targetSpeed: null,
                            targetAltitude: null,
                            targetDepth: null,
                            waypoints: [],
                            trackNumber: null
                        }, ...loadedAssets];
                    } else if (loadedAssets[ownshipIndex].id !== 0) {
                        // Ownship exists but has wrong ID, fix it
                        loadedAssets[ownshipIndex].id = 0;
                    }

                    setAssets(loadedAssets);
                    setScale(saveData.scale || INITIAL_SCALE);
                    setMapCenter(saveData.mapCenter || loadedBullseye);
                    setTempMark(saveData.tempMark || null);
                    setNextTrackNumber(saveData.nextTrackNumber || 6000);
                    setSelectedAssetId(null);
                    setBullseyeSelected(false);
                    setSelectedGeoPointId(null);
                    setSelectedShapeId(null);
                    setHasStarted(true);
                    setMissionTime(saveData.missionTime || 0);
                    setBullseyeName(saveData.bullseyeName || '');
                    setGeoPoints(saveData.geoPoints || []);
                    setNextGeoPointId(saveData.nextGeoPointId || 1);
                    setShapes(saveData.shapes || []);
                    setNextShapeId(saveData.nextShapeId || 1);
                    setSonobuoys(saveData.sonobuoys || []);
                    setSonobuoyCount(saveData.sonobuoyCount !== undefined ? saveData.sonobuoyCount : 30);
                    setNextSonobuoyId(saveData.nextSonobuoyId || 1);
                    setWeapons(saveData.weapons || []);
                    setWeaponInventory(saveData.weaponInventory || { ASM: 0, AAM: 0, AGM: 0, SAM: 0, Torpedo: 0 });
                    setNextWeaponId(saveData.nextWeaponId || 1);
                    setWeaponEnabled(saveData.weaponEnabled || false);
                    setWeaponArmed(saveData.weaponArmed || false);
                    setWeaponGuardOpen(false);
                    setSelectedTargetAssetId(null);
                    setSelectedWeaponType(saveData.selectedWeaponType || null);

                    const maxId = loadedAssets.reduce((max, a) => Math.max(max, a.id), 0);
                    setNextAssetId(maxId + 1);

                    // Save as initial scenario for restart
                    setInitialScenario({
                        assets: JSON.parse(JSON.stringify(loadedAssets)),
                        scale: saveData.scale || INITIAL_SCALE,
                        mapCenter: saveData.mapCenter || loadedBullseye,
                        tempMark: saveData.tempMark || null,
                        nextTrackNumber: saveData.nextTrackNumber || 6000,
                        nextAssetId: maxId + 1,
                        geoPoints: JSON.parse(JSON.stringify(saveData.geoPoints || [])),
                        nextGeoPointId: saveData.nextGeoPointId || 1,
                        shapes: JSON.parse(JSON.stringify(saveData.shapes || [])),
                        nextShapeId: saveData.nextShapeId || 1,
                        sonobuoys: JSON.parse(JSON.stringify(saveData.sonobuoys || [])),
                        sonobuoyCount: saveData.sonobuoyCount !== undefined ? saveData.sonobuoyCount : 30,
                        nextSonobuoyId: saveData.nextSonobuoyId || 1
                    });

                    alert('Scenario loaded successfully!');
                } catch (error) {
                    alert('Failed to load scenario: Invalid file format');
                }
            };
            reader.readAsText(file);
        }
    }, []);

    const deleteFromLocalStorage = useCallback((name) => {
        localStorage.removeItem(`aic-scenario-${name}`);
    }, []);

    const restartSimulation = useCallback(() => {
        if (initialScenario) {
            // Restart to loaded scenario
            setAssets(JSON.parse(JSON.stringify(initialScenario.assets)));
            setScale(initialScenario.scale);
            setMapCenter(initialScenario.mapCenter);
            setTempMark(initialScenario.tempMark);
            setNextTrackNumber(initialScenario.nextTrackNumber);
            setNextAssetId(initialScenario.nextAssetId);
            setGeoPoints(JSON.parse(JSON.stringify(initialScenario.geoPoints || [])));
            setNextGeoPointId(initialScenario.nextGeoPointId || 1);
            setShapes(JSON.parse(JSON.stringify(initialScenario.shapes || [])));
            setNextShapeId(initialScenario.nextShapeId || 1);
            setSonobuoys(JSON.parse(JSON.stringify(initialScenario.sonobuoys || [])));
            setSonobuoyCount(initialScenario.sonobuoyCount !== undefined ? initialScenario.sonobuoyCount : 30);
            setNextSonobuoyId(initialScenario.nextSonobuoyId || 1);
            setSelectedAssetId(null);
            setSelectedGeoPointId(null);
            setSelectedShapeId(null);
            setIsRunning(false);
            setMissionTime(0);
            setRadarReturns([]);
            setRadarSweepAngle(0);
        } else {
            // No scenario loaded, do a full page reload
            window.location.reload();
        }
    }, [initialScenario]);

    const getSavedScenarios = useCallback(() => {
        const scenarios = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('aic-scenario-')) {
                const name = key.replace('aic-scenario-', '');
                const data = JSON.parse(localStorage.getItem(key));
                scenarios.push({ name, timestamp: data.timestamp });
            }
        }
        return scenarios.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, []);

    // ========================================================================
    // MOUSE/INTERACTION HANDLERS
    // ========================================================================

    const handleSVGClick = useCallback((e) => {
        if (contextMenu) {
            setContextMenu(null);
            return;
        }

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // If creating a line segment, add point on click
        if (creatingShape && creatingShape.type === 'lineSegment') {
            const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            addLineSegmentPoint(latLon.lat, latLon.lon);
            return;
        }

        // Check if clicking on the bullseye
        const bullseyePos = latLonToScreen(bullseyePosition.lat, bullseyePosition.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        const bullseyeDist = Math.sqrt((x - bullseyePos.x) ** 2 + (y - bullseyePos.y) ** 2);
        if (bullseyeDist < 15) {
            // Already handled in handleMouseDown, don't do anything
            return;
        }

        // Check if clicking on a geo-point
        let clickedGeoPoint = null;
        for (const geoPoint of geoPoints) {
            const gpPos = latLonToScreen(geoPoint.lat, geoPoint.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - gpPos.x) ** 2 + (y - gpPos.y) ** 2);
            if (dist < 15) {
                clickedGeoPoint = geoPoint;
                break;
            }
        }

        // Check if clicking on an asset
        let clickedAsset = null;
        for (const asset of assets) {
            const pos = latLonToScreen(asset.lat, asset.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist < 15) {
                clickedAsset = asset;
                break;
            }
        }

        // Check if clicking on a shape
        let clickedShape = null;
        for (const shape of shapes) {
            if (shape.type === 'circle') {
                const centerPos = latLonToScreen(shape.centerLat, shape.centerLon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                const radiusInPixels = (shape.radius / scale) * Math.min(rect.width, rect.height);
                const dist = Math.sqrt((x - centerPos.x) ** 2 + (y - centerPos.y) ** 2);
                // Check if clicking near the edge of the circle (within 10 pixels of the circumference)
                if (Math.abs(dist - radiusInPixels) < 10) {
                    clickedShape = shape;
                    break;
                }
            } else if (shape.type === 'lineSegment') {
                // Check if clicking near any point in the line segment
                for (const point of shape.points) {
                    const pointPos = latLonToScreen(point.lat, point.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                    const dist = Math.sqrt((x - pointPos.x) ** 2 + (y - pointPos.y) ** 2);
                    if (dist < 10) {
                        clickedShape = shape;
                        break;
                    }
                }
            }
            if (clickedShape) break;
        }

        if (clickedGeoPoint) {
            // Geo-point clicked (already handled in handleMouseDown)
            return;
        } else if (clickedShape) {
            setSelectedShapeId(clickedShape.id);
            setSelectedAssetId(null);
            setBullseyeSelected(false);
            setSelectedGeoPointId(null);
            setRadarControlsSelected(false);
            setEsmControlsSelected(false);
            setTempMark(null);
        } else if (clickedAsset) {
            setSelectedAssetId(clickedAsset.id);
            setBullseyeSelected(false);
            setSelectedGeoPointId(null);
            setSelectedShapeId(null);
            setRadarControlsSelected(false);
            setEsmControlsSelected(false);
            setTempMark(null);
        } else {
            // Place temporary mark
            const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            setTempMark(latLon);
            setSelectedAssetId(null);
            setBullseyeSelected(false);
            setSelectedGeoPointId(null);
            setSelectedShapeId(null);
            setRadarControlsSelected(false);
            setEsmControlsSelected(false);
        }
    }, [assets, geoPoints, shapes, contextMenu, mapCenter, scale, creatingShape, addLineSegmentPoint]);

    const handleSVGRightClick = useCallback((e) => {
        e.preventDefault();

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);

        // Check if clicking on a shape
        for (const shape of shapes) {
            if (shape.type === 'circle') {
                const centerPos = latLonToScreen(shape.centerLat, shape.centerLon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                const radiusInPixels = (shape.radius / scale) * Math.min(rect.width, rect.height);
                const dist = Math.sqrt((x - centerPos.x) ** 2 + (y - centerPos.y) ** 2);
                // Check if clicking near the edge of the circle (within 10 pixels of the circumference)
                if (Math.abs(dist - radiusInPixels) < 10) {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'shape',
                        shapeId: shape.id
                    });
                    return;
                }
            } else if (shape.type === 'lineSegment') {
                for (const point of shape.points) {
                    const pointPos = latLonToScreen(point.lat, point.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                    const dist = Math.sqrt((x - pointPos.x) ** 2 + (y - pointPos.y) ** 2);
                    if (dist < 10) {
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            type: 'shape',
                            shapeId: shape.id
                        });
                        return;
                    }
                }
            }
        }

        // Check if clicking on a geo-point
        for (const geoPoint of geoPoints) {
            const gpPos = latLonToScreen(geoPoint.lat, geoPoint.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - gpPos.x) ** 2 + (y - gpPos.y) ** 2);

            if (dist < 15) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'geopoint',
                    geoPointId: geoPoint.id
                });
                return;
            }
        }

        // Check if clicking on a waypoint from ANY asset
        for (const asset of assets) {
            for (let i = 0; i < asset.waypoints.length; i++) {
                const wp = asset.waypoints[i];
                const wpPos = latLonToScreen(wp.lat, wp.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                const dist = Math.sqrt((x - wpPos.x) ** 2 + (y - wpPos.y) ** 2);

                if (dist < 10) {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'waypoint',
                        assetId: asset.id,
                        waypointIndex: i
                    });
                    return;
                }
            }
        }

        // Check if clicking on an asset for weapon engagement or targeting
        let clickedTargetAsset = null;
        for (const asset of assets) {
            const pos = latLonToScreen(asset.lat, asset.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist < 15 && asset.type !== 'ownship') {
                clickedTargetAsset = asset;
                break;
            }
        }

        // Priority 1: If a non-ownship asset is selected, always show "Engage with"
        if (clickedTargetAsset && selectedAsset && selectedAsset.type !== 'ownship') {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'engage',
                targetAssetId: clickedTargetAsset.id,
                firingAssetId: selectedAsset.id
            });
            return;
        }

        // Priority 2: If WEAPON tab is open (and no non-ownship selected), show "Target With" for ownship
        if (clickedTargetAsset && selectedSystemTab === 'weapon') {
            const ownship = assets.find(a => a.type === 'ownship');
            if (ownship) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'targetWith',
                    targetAssetId: clickedTargetAsset.id
                });
                return;
            }
        }

        // Context menu for asset or empty space
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: selectedAsset ? 'asset' : 'empty',
            lat: latLon.lat,
            lon: latLon.lon
        });
    }, [selectedAsset, assets, geoPoints, shapes, mapCenter, scale, selectedAssetId]);

    const handleMouseMove = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        setCursorPos(latLon);

        // Handle shape point dragging (individual line segment points)
        if (draggedShapeId !== null && draggedShapePointIndex !== null) {
            const draggedShape = shapes.find(s => s.id === draggedShapeId);
            if (draggedShape && draggedShape.type === 'lineSegment') {
                const newPoints = [...draggedShape.points];
                newPoints[draggedShapePointIndex] = {
                    lat: latLon.lat,
                    lon: latLon.lon,
                    name: newPoints[draggedShapePointIndex].name || ''
                };
                updateShape(draggedShapeId, { points: newPoints });
            }
            return;
        }

        // Handle shape dragging (entire shape)
        if (draggedShapeId !== null) {
            const draggedShape = shapes.find(s => s.id === draggedShapeId);
            if (draggedShape) {
                if (draggedShape.type === 'circle') {
                    updateShape(draggedShapeId, { centerLat: latLon.lat, centerLon: latLon.lon });
                } else if (draggedShape.type === 'lineSegment') {
                    // Calculate offset from first point
                    const firstPoint = draggedShape.points[0];
                    const offsetLat = latLon.lat - firstPoint.lat;
                    const offsetLon = latLon.lon - firstPoint.lon;
                    // Move all points by the offset while preserving names
                    const newPoints = draggedShape.points.map(p => ({
                        lat: p.lat + offsetLat,
                        lon: p.lon + offsetLon,
                        name: p.name || ''
                    }));
                    updateShape(draggedShapeId, { points: newPoints });
                }
            }
            return;
        }

        // Handle bullseye dragging
        if (draggedBullseye) {
            setBullseyePosition({ lat: latLon.lat, lon: latLon.lon });
            setBullseyeLatInput(decimalToDMM(latLon.lat, true));
            setBullseyeLonInput(decimalToDMM(latLon.lon, false));
            return;
        }

        // Handle geo-point dragging
        if (draggedGeoPointId !== null) {
            updateGeoPoint(draggedGeoPointId, { lat: latLon.lat, lon: latLon.lon });
            return;
        }

        // Handle asset dragging
        if (draggedAssetId !== null) {
            const draggedAsset = assets.find(a => a.id === draggedAssetId);

            // Update position
            const updates = { lat: latLon.lat, lon: latLon.lon };

            // If asset has waypoints, recalculate heading to first waypoint
            if (draggedAsset && draggedAsset.waypoints.length > 0) {
                const nextWP = draggedAsset.waypoints[0];
                const newHeading = calculateBearing(latLon.lat, latLon.lon, nextWP.lat, nextWP.lon);
                updates.targetHeading = newHeading;
            }

            updateAsset(draggedAssetId, updates);
            return;
        }

        // Handle map dragging
        if (isDragging && dragStart) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            const pixelsPerNM = Math.min(rect.width, rect.height) / scale;
            const nmDx = -dx / pixelsPerNM;
            const nmDy = dy / pixelsPerNM;

            const bearingX = 90; // East
            const bearingY = 0; // North

            const latChange = (nmDy / 60);
            const lonChange = (nmDx / (60 * Math.cos(dragStart.centerLat * Math.PI / 180)));

            setMapCenter({
                lat: dragStart.centerLat + latChange,
                lon: dragStart.centerLon + lonChange
            });
        }

        // Handle waypoint dragging
        if (draggedWaypoint !== null) {
            moveWaypoint(draggedWaypoint.assetId, draggedWaypoint.wpIndex, latLon.lat, latLon.lon);
        }
    }, [mapCenter, scale, isDragging, dragStart, draggedWaypoint, draggedAssetId, draggedGeoPointId, draggedShapeId, draggedShapePointIndex, draggedBullseye, assets, shapes, moveWaypoint, updateAsset, updateGeoPoint, updateShape, setBullseyePosition, setBullseyeLatInput, setBullseyeLonInput]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return; // Only left click

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on the bullseye
        const bullseyePos = latLonToScreen(bullseyePosition.lat, bullseyePosition.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        const bullseyeDist = Math.sqrt((x - bullseyePos.x) ** 2 + (y - bullseyePos.y) ** 2);
        if (bullseyeDist < 15) {
            // Enable dragging if already selected
            if (bullseyeSelected) {
                setDraggedBullseye(true);
            } else {
                // First click - select the bullseye
                setBullseyeSelected(true);
                setSelectedAssetId(null);
                setSelectedGeoPointId(null);
                setSelectedShapeId(null);
                setRadarControlsSelected(false);
                setEsmControlsSelected(false);
                setIffControlsSelected(false);
                setTempMark(null);
            }
            return;
        }

        // Check if clicking on a shape
        for (const shape of shapes) {
            if (shape.type === 'circle') {
                const centerPos = latLonToScreen(shape.centerLat, shape.centerLon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                const radiusInPixels = (shape.radius / scale) * Math.min(rect.width, rect.height);
                const dist = Math.sqrt((x - centerPos.x) ** 2 + (y - centerPos.y) ** 2);
                // Check if clicking near the edge of the circle (within 10 pixels of the circumference)
                if (Math.abs(dist - radiusInPixels) < 10) {
                    setSelectedShapeId(shape.id);
                    setSelectedAssetId(null);
                    setSelectedGeoPointId(null);
                    setBullseyeSelected(false);
                    setRadarControlsSelected(false);
                    setEsmControlsSelected(false);
                    setIffControlsSelected(false);
                    setTempMark(null);
                    // Check if this is the already-selected shape (enable dragging)
                    if (selectedShapeId === shape.id) {
                        setDraggedShapeId(shape.id);
                    }
                    return;
                }
            } else if (shape.type === 'lineSegment') {
                for (let i = 0; i < shape.points.length; i++) {
                    const point = shape.points[i];
                    const pointPos = latLonToScreen(point.lat, point.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                    const dist = Math.sqrt((x - pointPos.x) ** 2 + (y - pointPos.y) ** 2);
                    if (dist < 10) {
                        setSelectedShapeId(shape.id);
                        setSelectedAssetId(null);
                        setSelectedGeoPointId(null);
                        setBullseyeSelected(false);
                        setRadarControlsSelected(false);
                        setEsmControlsSelected(false);
                        setIffControlsSelected(false);
                        setTempMark(null);
                        // Check if this is the already-selected shape (enable dragging of this specific point)
                        if (selectedShapeId === shape.id) {
                            setDraggedShapeId(shape.id);
                            setDraggedShapePointIndex(i);
                        }
                        return;
                    }
                }
            }
        }

        // Check if clicking on a geo-point
        for (const geoPoint of geoPoints) {
            const gpPos = latLonToScreen(geoPoint.lat, geoPoint.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - gpPos.x) ** 2 + (y - gpPos.y) ** 2);

            if (dist < 15) {
                setSelectedGeoPointId(geoPoint.id);
                setSelectedAssetId(null);
                setSelectedShapeId(null);
                setBullseyeSelected(false);
                setRadarControlsSelected(false);
                setEsmControlsSelected(false);
                setIffControlsSelected(false);
                setTempMark(null);
                // Check if this is the already-selected geo-point (enable dragging)
                if (selectedGeoPointId === geoPoint.id) {
                    setDraggedGeoPointId(geoPoint.id);
                }
                return;
            }
        }

        // Check if clicking on a waypoint from ANY asset
        for (const asset of assets) {
            for (let i = 0; i < asset.waypoints.length; i++) {
                const wp = asset.waypoints[i];
                const wpPos = latLonToScreen(wp.lat, wp.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
                const dist = Math.sqrt((x - wpPos.x) ** 2 + (y - wpPos.y) ** 2);

                if (dist < 10) {
                    // Store both waypoint index and asset id
                    setDraggedWaypoint({ assetId: asset.id, wpIndex: i });
                    setSelectedAssetId(asset.id); // Auto-select the asset
                    setBullseyeSelected(false);
                    setSelectedGeoPointId(null);
                    return;
                }
            }
        }

        // Check if clicking on the selected asset (to drag it)
        if (selectedAsset) {
            const pos = latLonToScreen(selectedAsset.lat, selectedAsset.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist < 15) {
                setDraggedAssetId(selectedAsset.id);
                return;
            }
        }

        // Check if clicking on any other asset
        let clickedAsset = false;
        for (const asset of assets) {
            const pos = latLonToScreen(asset.lat, asset.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist < 15) {
                clickedAsset = true;
                setBullseyeSelected(false);
                setSelectedGeoPointId(null);
                break;
            }
        }

        if (!clickedAsset) {
            // Close control panels when clicking on empty space
            setRadarControlsSelected(false);
            setEsmControlsSelected(false);
            setIffControlsSelected(false);
            setIsDragging(true);
            setDragStart({
                x: e.clientX,
                y: e.clientY,
                centerLat: mapCenter.lat,
                centerLon: mapCenter.lon
            });
        }
    }, [assets, geoPoints, shapes, selectedAsset, selectedGeoPointId, selectedShapeId, bullseyeSelected, bullseyePosition, mapCenter, scale, setBullseyeSelected, setSelectedAssetId, setSelectedGeoPointId, setSelectedShapeId, setRadarControlsSelected, setEsmControlsSelected, setIffControlsSelected, setTempMark, setDraggedBullseye, setDraggedShapeId, setDraggedShapePointIndex, setDraggedGeoPointId, setDraggedWaypoint, setDraggedAssetId, setIsDragging, setDragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragStart(null);
        setDraggedWaypoint(null);
        setDraggedAssetId(null);
        setDraggedGeoPointId(null);
        setDraggedShapeId(null);
        setDraggedShapePointIndex(null);
        setDraggedBullseye(false);
    }, []);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 10 : -10;
        setScale(prev => Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta)));
    }, []);

    // ========================================================================
    // KEYBOARD HANDLERS
    // ========================================================================

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowPauseMenu(true);
                setIsRunning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    const renderGrid = (width, height) => {
        const lines = [];
        const spacing = 60; // pixels

        // Vertical lines
        for (let x = 0; x < width; x += spacing) {
            lines.push(
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height}
                      stroke="#00FF00" strokeWidth="0.3" opacity="0.08" />
            );
        }

        // Horizontal lines
        for (let y = 0; y < height; y += spacing) {
            lines.push(
                <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y}
                      stroke="#00FF00" strokeWidth="0.3" opacity="0.08" />
            );
        }

        return lines;
    };

    const renderCompass = (width, height) => {
        return (
            <g>
                <text x={width/2} y={20} fill="#00FF00" fontSize="12" textAnchor="middle" fontWeight="700">N</text>
                <text x={width-20} y={height/2} fill="#00FF00" fontSize="12" textAnchor="middle" fontWeight="700">E</text>
                <text x={width/2} y={height-10} fill="#00FF00" fontSize="12" textAnchor="middle" fontWeight="700">S</text>
                <text x={20} y={height/2} fill="#00FF00" fontSize="12" textAnchor="middle" fontWeight="700">W</text>
            </g>
        );
    };

    // Persian Gulf coastline data (high-resolution from KML)
    const PERSIAN_GULF_COASTLINE = [
        // Northwest coast - Kuwait/Iraq/Iran
        [29.362739979846, 47.69535012679097], [29.37103544197162, 47.78304613822219], [29.37770406779904, 47.84633405282632], [29.3427966711758, 47.82215043810503], [29.31323251782048, 47.84212913279373], [29.33373999609603, 47.91268979397509], [29.36830760966521, 47.95231944169807], [29.38183833393841, 47.99510482041345], [29.35388882189541, 48.02403319034904], [29.3473887839088, 48.08409990983223], [29.34873058689774, 48.10804901034312], [29.26398803755654, 48.09164265494383], [29.13304004967022, 48.13090865169305], [28.96276081399268, 48.17563338288667], [28.90294991082907, 48.23208949797908], [28.87707858308545, 48.27348362549785], [28.88303964200607, 48.29275789984087], [28.83752719728932, 48.2784410651974], [28.80642303785074, 48.27933277142985], [28.77000252276914, 48.29554239628539], [28.75651888466519, 48.32286758249784], [28.73971645626172, 48.3622108651301], [28.74210304746008, 48.3918714885185], [28.72995966009418, 48.38790222376635], [28.69174603130939, 48.37571373297355], [28.66489453797152, 48.38407321193832], [28.61288716868266, 48.3912424037291], [28.58644474275849, 48.39412886657468], [28.54095348797999, 48.42346606334742], [28.50349911971444, 48.4662021954838], [28.49177057094036, 48.50445354315367], [28.4608148935228, 48.50029517144102], [28.42256434270161, 48.51060940643497], [28.41276750726853, 48.54062647546603], [28.38962915920023, 48.53246370633838], [28.35330434440102, 48.51252653599371], [28.32532352989832, 48.51064044681915], [28.28783129190019, 48.53584587551601], [28.24490061311804, 48.57894506680763], [28.21895976655942, 48.61579459111213], [28.18165275046837, 48.62167730688226], [28.13971103801806, 48.60579976249522], [28.0745862355423, 48.62624526070613], [28.02370841916106, 48.65527726159259], [28.0121579017995, 48.73108912716581], [27.99736286228089, 48.78162497529257], [27.97523396932346, 48.74239838958668], [27.95030178981006, 48.74773551023988], [27.91479083877341, 48.78400267451396], [27.89902279565163, 48.79785399677196], [27.87182633659092, 48.8402718363383], [27.8494757154631, 48.85657888900477], [27.83367764560196, 48.8803134289444], [27.81265461795592, 48.8871977379292], [27.77591535950933, 48.87326624419379], [27.74874680276708, 48.88605955699737], [27.72866144093459, 48.85039624366464], [27.7857433627047, 48.85647873097405], [27.81687823926554, 48.85273151666647], [27.80275050897059, 48.83734541524424], [27.78410542601461, 48.8352692860018], [27.76567161343662, 48.83104630752973], [27.7503518728086, 48.83023288587336], [27.73531228829741, 48.82285033132209], [27.71506747110542, 48.83462542081783], [27.70397474681889, 48.84542604579657], [27.68031649728978, 48.86368375663136], [27.66226708485101, 48.87795395384002], [27.62650808877232, 48.91216769599124], [27.58767698952231, 48.89595678960478], [27.56514767372276, 48.90469349610412], [27.57459251520096, 48.92268660437383], [27.59464109995814, 48.92569004459112], [27.60639414458684, 48.93942875519843], [27.62092368795009, 48.95773401326306], [27.6201119543849, 48.97245320051514], [27.61294833014528, 48.98933688979626], [27.60524105696468, 48.99620031614153], [27.5813458256208, 49.01925475289241], [27.56822038173939, 49.0372533402556], [27.5617523774251, 49.06800447616851], [27.53968987095302, 49.10668626054857], [27.53235581568742, 49.15043293771129], [27.5414675803881, 49.17698841289483], [27.54559777651491, 49.21530265084125], [27.52629156175437, 49.23715640320451], [27.48942199307841, 49.27983792914928], [27.47266859790311, 49.30257939044667], [27.44604763213733, 49.31665941291521], [27.42635495821904, 49.30985754673539], [27.41764528286118, 49.29906662390326], [27.43467924534061, 49.29483371686963], [27.42988583757772, 49.27881232338498], [27.4267643764653, 49.26034730418309], [27.43191807585761, 49.2445991340882], [27.42366130097835, 49.23366332853881], [27.41147711179321, 49.25138460303861], [27.39752269329243, 49.26425421500796], [27.38429673150419, 49.26699448457246], [27.36620691625296, 49.24762349427508], [27.35896696507879, 49.23500704265319], [27.34257342787321, 49.24226376264184], [27.33447723221879, 49.23556500819178], [27.32240907081375, 49.22184092421178], [27.31187429808326, 49.22827167546347], [27.3126916367439, 49.2440854515757], [27.32895120371398, 49.26169958839068], [27.34337581252173, 49.27184954728768], [27.33737638273126, 49.29496086919296], [27.332214771998, 49.31217773248061], [27.28739237844328, 49.31517735880237], [27.25941611365752, 49.32778897802676], [27.23468235932625, 49.31973018786357], [27.20887020369031, 49.31724589491909], [27.19857923393602, 49.32794414477137], [27.17505879577316, 49.32964138750945], [27.16247231871798, 49.34012532208418], [27.15464526975243, 49.35440143340904], [27.1712274766907, 49.36401244645783], [27.19368108386228, 49.36391170089672], [27.19973941498024, 49.38499532166435], [27.19531574465035, 49.39970765318517], [27.1873313181851, 49.40662754667735], [27.16373829229759, 49.40639209847733], [27.14077164150095, 49.38893621998884], [27.13945529024699, 49.37232273151893], [27.11831674339943, 49.38505360794399], [27.11043880378798, 49.40925940464875], [27.13848456440684, 49.42986914592497], [27.14712075441977, 49.46662067579724], [27.1265163908605, 49.47379167011563], [27.13040381071011, 49.49733627190886], [27.15734120857412, 49.49268263290568], [27.18327132458876, 49.5260269875886], [27.16404058479086, 49.55274930335081], [27.18328673433261, 49.57846048734046], [27.16205577180805, 49.58937851341028], [27.15026963123653, 49.5739788587245], [27.12338392993765, 49.57461070687804], [27.09923643705313, 49.58167059544461], [27.06678512951412, 49.61805191186063], [27.02703358756934, 49.6442713217411],
        // Saudi Arabia eastern coast
        [27.02705324760176, 49.64442367426901], [27.02356315703405, 49.64626041170332], [27.02387110948356, 49.652561092387], [27.02285104835295, 49.66494148690342], [27.02769332323176, 49.66328227100482], [27.02973562028309, 49.66862507425854], [27.02262778445744, 49.67675114711678], [27.03246672472802, 49.68892938880483], [27.02844334464723, 49.69385692625603], [27.01856598228698, 49.68235533687436], [27.01313086266366, 49.68036688755326], [27.01034588271667, 49.66903415025619], [27.0027511416355, 49.67183349539255], [26.99609364305722, 49.67116051333321], [26.98996769142334, 49.66640361921544], [26.9811598336394, 49.67050608635027], [26.97776397933928, 49.67658282347252], [26.97905850326825, 49.68368362294901], [26.98285389075773, 49.68933214311717], [26.97644220929816, 49.69387216264155], [26.97158371460691, 49.68907333964436], [26.96243267777922, 49.69335476905932], [26.95281598942299, 49.70379288508404], [26.94881665489661, 49.71139958214718], [26.94433666763331, 49.72220797919294], [26.93907286322699, 49.73472462781469], [26.92469118948771, 49.74573281032587], [26.91064202879203, 49.76598947302106], [26.9047059931024, 49.7776836291876], [26.89307229147828, 49.8045709136645], [26.87962543539856, 49.82448375650021], [26.87720377334114, 49.83927569545293], [26.87398502653166, 49.84943975845476], [26.86491121684606, 49.86237321131537], [26.85870178039362, 49.87084534294237], [26.85546292693826, 49.90720520408686], [26.85346757632348, 49.9509049974695], [26.85103273413002, 49.95522256892664], [26.84254134600754, 49.96007426888714], [26.83670005597616, 49.97041414769412], [26.8236357041947, 49.98974505758276], [26.82069538547858, 49.99814066819934], [26.81152483475976, 50.0029302736573], [26.78253812186561, 50.02431244839551], [26.76918165331779, 50.03778046600363], [26.75968876387441, 50.04312681993306], [26.74107922812602, 50.0677661112075], [26.71821763554312, 50.08214523805297], [26.70674284268519, 50.10176677629357], [26.69999673848042, 50.10542020381371], [26.6890886817381, 50.12025190951388], [26.67700696929432, 50.13142386503071], [26.65458592218706, 50.14813163669987], [26.6479329808364, 50.16113147361743], [26.63684932643389, 50.16525411817954], [26.62730385047082, 50.16360640249039], [26.6327871301465, 50.15663807328841], [26.64698983069927, 50.14586074879975], [26.66837957674928, 50.13016216645328], [26.67735515746856, 50.11964939751313], [26.67564668018043, 50.10382987042338], [26.6853378271186, 50.08330896629561], [26.68108597580312, 50.05998720750681], [26.67161220756711, 50.043822395781], [26.67378032925328, 50.02879396197417], [26.69300955833759, 50.02934989636935], [26.73539483893357, 50.00413219130337], [26.73457053810801, 49.99302950130953], [26.71247573964558, 49.98661274454138], [26.6763014848996, 49.98932965056589], [26.65996106297644, 49.9900667985662], [26.65645405654197, 50.0118147454719], [26.64622290523995, 50.01575073725866], [26.62546301167906, 50.01319995052201], [26.60448412731834, 50.01859627615362], [26.582496808162, 50.02139082703306], [26.58838007243183, 50.03207886761251], [26.59551809075142, 50.05277598541655], [26.59826682305081, 50.07207425004555], [26.58548210906353, 50.08665935830546], [26.56473258988605, 50.09214377597122], [26.54959804777767, 50.08447271983419], [26.53657646764626, 50.07211181639144], [26.54160848964845, 50.04538158447258], [26.55166529776345, 50.03249992781566], [26.53829184396034, 50.03072343143116], [26.52949240074712, 50.04254824979882], [26.50108575664832, 50.04947609870089], [26.48041474574309, 50.06621807674384], [26.46809318321726, 50.07796759885397], [26.47993148306423, 50.08299301897371], [26.48085883996455, 50.09964161394035], [26.49262832771563, 50.1155913825037], [26.49920374165023, 50.11849396838649], [26.49843073820374, 50.13434891745401], [26.4575746080067, 50.13618566204665], [26.44632355038439, 50.14674217295631], [26.45436461495202, 50.15463109316094], [26.46755559615825, 50.16840589149142], [26.48177338913787, 50.17440420950627], [26.48987610081437, 50.17889907143893], [26.52109135016672, 50.19030261132083], [26.49751253460696, 50.22090467377168], [26.46685996915177, 50.21048710368972], [26.44279158508066, 50.20463598106671], [26.41852952432559, 50.21942469380834], [26.37188979515013, 50.24015663743656], [26.32784569402419, 50.23295797419765], [26.25733544109761, 50.22442031390927], [26.18056508399698, 50.2237260565035], [26.15808076239823, 50.19571157021147], [26.14796354881483, 50.16917658738512], [26.10176353316136, 50.16403853010091], [26.04340275857583, 50.15681248096449], [26.0231945633497, 50.13772735958902], [26.05199963459062, 50.11792634974211], [26.09879626247162, 50.11065115732928], [26.12183793961595, 50.08554474973456], [26.14876955906252, 50.06345304657461], [26.18214497207716, 50.05241091634505], [26.19797935919285, 50.02704131204388], [26.16754926105135, 50.01406124351119], [26.12606971094491, 49.99527673974687], [26.09515490156893, 49.98170627401133], [26.08287743246124, 49.9979200624599], [26.03335448480656, 49.99474045050955], [25.99143076837207, 50.00383080224352], [25.99253184986523, 50.02323272505452], [26.0028734041563, 50.05162750343987], [25.98531035198135, 50.07389293159618], [25.98247079980824, 50.11005675575576], [25.95697331334445, 50.11825084743846], [25.93197421618638, 50.12841779783417], [25.91970507031847, 50.10757877414094], [25.81084133638192, 50.14378929277124], [25.70578875670218, 50.23344186523173], [25.59922114297034, 50.2912938634102], [25.50791405622413, 50.40055968277333], [25.42724891080401, 50.46986860807198], [25.33477951233779, 50.52644690263656], [25.19995072995599, 50.54418033652198], [25.06988981871546, 50.5829391335044], [24.93546944067575, 50.66697122395959], [24.82983648365879, 50.74301464182899], [24.76647221967511, 50.74880828559648], [24.73554432503348, 50.78655894653473], [24.74332311272736, 50.82210562285611], [24.77351872668544, 50.85669515487564], [24.86099893055199, 50.85132358508607], [24.95898790007987, 50.80937265439603], [25.06211520565489, 50.79790223689832], [25.1540174114601, 50.76779932224112], [25.25967035086254, 50.7667514668296], [25.44949328486212, 50.76859971220759], [25.53304911153838, 50.78752005177065], [25.47141379466137, 50.83629942841311], [25.5723418458954, 50.82975619871582], [25.61944968636911, 50.79497905967578], [25.60757107349294, 50.87702311664493], [25.51757213892248, 50.8957439024573], [25.59028957421601, 50.92396888667346], [25.60253574250321, 50.95667776686696], [25.63135652112587, 50.97925366871092], [25.6352323047664, 50.94711364233711], [25.62505702203529, 50.93133440319193], [25.63155678492307, 50.91506163873182], [25.65641015856653, 50.90049733282035],
        // UAE coast
        [25.65716083275897, 50.90170575990749], [25.68147696492986, 50.89773161034381], [25.71857479225816, 50.8954911439477], [25.73949294722928, 50.91686676106349], [25.75871945836478, 50.91008866909237], [25.7845751252068, 50.90836702545932], [25.79460915983987, 50.92274696351791], [25.80887571369417, 50.93098415085969], [25.80629389630451, 50.94663737233623], [25.79239730882586, 50.95719817710234], [25.77600525825683, 50.96257652228878], [25.76452660286184, 50.95584316275358], [25.77463157973698, 50.97567480371352], [25.78237282687364, 50.98648588513267], [25.78982235797762, 50.98246344811772], [25.80136570299747, 50.99099761934627], [25.8210458515305, 50.98515757250075], [25.82759528044297, 50.96077005468135], [25.85835092454429, 50.9552759557918], [25.88996810471103, 50.97901883341721], [25.91380775540743, 50.99537525248765], [25.95574954963699, 50.98876030091325], [25.98416736628879, 50.99214776651995], [25.95380103698773, 51.01227399193174], [25.98763438369054, 51.0319745498081], [26.01938296207173, 51.03962313130463], [26.04188184540632, 51.0380355164092], [26.07554628555181, 51.09440849099342], [26.07648578114036, 51.12577648644566], [26.09879289099162, 51.15138177526531], [26.12753975086157, 51.17380600398057], [26.15223756264971, 51.211812976254], [26.15592700396044, 51.25450597631675], [26.14049608217642, 51.2921248651346], [26.11742241367045, 51.34005046723046], [26.07698459956022, 51.35796485026632], [26.04493410516451, 51.36323832953113], [26.02074062295535, 51.38183384289891], [25.99588583240877, 51.40673409444089], [25.96032439465812, 51.4116489197141], [25.9513835549339, 51.44632708077301], [25.95407437271502, 51.49351180974647], [25.94118643738382, 51.53697138554566], [25.90479771242735, 51.57708110954022], [25.85209225558815, 51.585254408003], [25.77901047581922, 51.60274952543374], [25.71986997723302, 51.58911200442687], [25.67696137256, 51.58782006283973], [25.65433845256044, 51.55749189795174], [25.6192528038682, 51.55374295568902], [25.59746833563727, 51.50444468137229], [25.58200294407754, 51.48970981978584], [25.52375027303368, 51.48931340834976], [25.4952407939834, 51.49459332696657], [25.46076933558775, 51.52085151714988], [25.41677524186116, 51.5335715259009], [25.35529783250155, 51.5341166354718], [25.32313602031736, 51.53749847889264], [25.29985305497469, 51.52549367837054], [25.28149461910185, 51.55418734014507], [25.29664179276036, 51.59079490862999], [25.29717906865323, 51.61291850248678], [25.27223266822733, 51.62260132844945], [25.25300592823463, 51.63093053622866], [25.23570164949857, 51.60955098042518], [25.19727979487261, 51.61980799441835], [25.13870117139228, 51.62043745509212], [25.07516567588837, 51.62048061121978], [25.02735892340913, 51.60831099770498], [24.94167176968926, 51.58939425675127], [24.87210694829982, 51.53409303749797], [24.8339275779665, 51.50028446266774], [24.74043284328953, 51.48454260719361], [24.69425854974229, 51.45252618738996], [24.64903360408211, 51.43448291475705], [24.62212222383731, 51.43841916181864], [24.59864433331233, 51.46903422450045], [24.58521979076352, 51.50909865350522], [24.5409587640296, 51.44979843608721], [24.46239652420145, 51.38007676632328], [24.41280482379771, 51.32790685112604], [24.28630356933485, 51.29794655616669], [24.28823051520193, 51.38088267518725], [24.3157954794711, 51.48299934710469], [24.25502129294205, 51.52900870761734], [24.25792848675743, 51.58303055210015], [24.34570649461978, 51.56851745070327], [24.33607808497208, 51.6294320314971], [24.28129244162631, 51.71320543581783], [24.28539429263386, 51.76493911677075], [24.19000585862705, 51.78547655018865], [24.12536403045356, 51.78607153918119], [24.03630047799832, 51.80261147634531], [24.00207045012229, 51.8239539881333], [23.98694115810612, 51.89145527968929], [23.99887391673576, 51.9818984810119], [23.94740834419009, 52.09964400837178], [23.95927597444117, 52.22900903622538], [24.00239933432923, 52.32151301308593], [24.06418944880516, 52.43927197088093], [24.12381621453524, 52.50389022176298], [24.15181604923597, 52.54797305104738], [24.19771926694004, 52.59954347599109], [24.15258458482505, 52.67062646025488], [24.12975489817441, 52.7560273881566], [24.13357170488513, 52.91523082618594], [24.14328810102479, 53.02462099067551], [24.12461292720342, 53.22600514715216],
        // Oman coast
        [24.12600295303031, 53.21875506318923], [24.11969795245916, 53.38428100695228], [24.04721712584968, 53.64503491358433], [24.07666292010559, 53.98852851822995], [24.14578023665765, 54.07853357180954], [24.19071860926684, 54.16436601736762], [24.24767674715092, 54.10004423421276], [24.31913766693351, 54.1193589470617], [24.37603760160576, 54.1996301067178], [24.55497758941722, 54.43033608066978], [24.63921724096035, 54.58212687745649], [24.81977579615055, 54.70928348122087], [24.8990592873844, 54.89587992757362], [25.00774310505677, 55.04093282880707], [25.10222948954171, 55.15398339822956], [25.28263621097551, 55.29544231249609], [25.45335911797874, 55.49358435430156], [25.61227126823007, 55.63524118052776], [25.73036359555809, 55.83127146206406], [25.81210026208424, 55.94981716131406], [26.01876526738378, 56.05982011711189], [26.17104933396902, 56.15871045137941], [26.23402192447403, 56.20354154180887], [26.22605661534324, 56.29221407615344], [26.29506556693573, 56.32278135402083], [26.40097525139682, 56.3957804745719], [26.29842205038239, 56.48872316985324], [26.17020649441785, 56.40948438659446], [26.01674011658505, 56.46298204844459], [25.87913267153234, 56.40184413185427], [25.77981451908449, 56.34760732875994], [25.7198931888227, 56.29315800626342], [25.64298160849766, 56.27706028024411], [25.60658979974734, 56.3182912672122], [25.59562210706842, 56.35786521335482], [25.52738734627675, 56.36448296635899], [25.22355775000066, 56.37854255608811], [25.01342218186323, 56.39031927634742], [24.83217361399143, 56.42696688025775], [24.68563586398005, 56.49494443453508], [24.5123943797098, 56.61338344388702], [24.39743420930938, 56.75028722231026], [24.26037375864488, 56.82055733279176], [24.10511334138644, 56.95549851035566], [23.9785028809605, 57.1154069937874], [23.8939578702375, 57.32686956564233], [23.81838965392729, 57.51601313901853], [23.75338176737095, 57.76430202922494], [23.71345890168819, 57.89905423026545], [23.70880126452129, 58.07945161406328], [23.68999414983332, 58.1588867385672], [23.64144506066609, 58.24362449017362], [23.59612387968723, 58.35227494176036], [23.61350557208782, 58.47739790442857], [23.63081834899839, 58.57917213211036], [23.57024508907826, 58.61716897572633], [23.54120802475841, 58.68268739696241], [23.5155793080001, 58.77175248837404], [23.44841021960845, 58.78903013870592], [23.39547991624105, 58.8144833396139], [23.33851323609182, 58.88224214089382], [23.30288197906548, 58.93121843983869], [23.22927718122163, 58.97071134170092], [23.15219985334388, 59.02547686546213], [23.07250679443032, 59.05793162632275], [23.00978828397068, 59.11861544631587], [22.97782030957097, 59.17857338061201], [22.89166714911653, 59.22781385534368], [22.85060184714803, 59.25581452324819], [22.84027207263209, 59.26471451491503], [22.80346003345322, 59.27123470002081], [22.76521112766059, 59.29196694153022], [22.74808179325468, 59.3518979540049], [22.70587160929718, 59.35433671724378], [22.6726774318342, 59.40938108897883], [22.60969901190415, 59.47751936966715], [22.57614659425485, 59.55193956370838], [22.56680214541115, 59.64182318149508], [22.54141784546401, 59.7269234617026], [22.54555800927798, 59.80033697136992], [22.48992793314173, 59.83701284863444], [22.42698204097238, 59.84359660159816], [22.40299778525068, 59.82352173720727], [22.36955172669856, 59.82280919481883], [22.33638306051496, 59.82209920272869], [22.30595471402026, 59.82694466610727], [22.25474409039142, 59.81466625238687], [22.20951458242703, 59.81200244473902], [22.16842869340804, 59.7618683076447], [22.06238417585248, 59.69114853976341], [21.99367739562976, 59.68263230887212], [21.90517008528615, 59.60328734733515], [21.85484471500446, 59.57163215439429], [21.77644356883025, 59.51569206570088], [21.72640052055073, 59.47054075762176], [21.68221242086886, 59.48030074477698], [21.62291201439212, 59.44540394041023], [21.51967099191064, 59.38719120959387], [21.45400727608873, 59.34616075355449], [21.42242884873736, 59.35282819168365], [21.38085759432982, 59.21879232410884], [21.27066252940752, 59.08430707021286], [21.16357435231987, 58.98118031557114], [21.08219111294111, 58.87521155099487], [20.98482315254149, 58.81031369694297], [20.9034426993566, 58.77968635108223], [20.84409485324602, 58.74575818509442], [20.68868188988185, 58.68794550677072], [20.592097324215, 58.60487316623752], [20.39893019065922, 58.50676482546261], [20.33509944581309, 58.38022208655958], [20.34502111408592, 58.28307840799782], [20.38792052904004, 58.19401728469271], [20.53450014495201, 58.25764702382457], [20.5933404806687, 58.25379392450553], [20.58169020973466, 58.12703766007976], [20.46628755593003, 58.04030699051958], [20.39093457173872, 57.9178976667525], [20.34061224625737, 57.98508770132828], [20.2449821859652, 57.90447086268667], [20.19777443203797, 57.84611846918035], [20.09598922660533, 57.84435857896525], [19.9470375630924, 57.80535612640626], [19.74717670558265, 57.69295318515986], [19.67177734065442, 57.71242970694491], [19.60120078108847, 57.71774439427388], [19.49124535323894, 57.74418893797834], [19.40247897874353, 57.78166692478845], [19.28569674153302, 57.75840800325311], [19.17050617294811, 57.75449123883461], [19.08029151370868, 57.83085178178512], [18.97647205063426, 57.85043278911841], [18.9436575263467, 57.73642401419902], [18.92335115939865, 57.49953901876331], [18.89951312802856, 57.27334775416995], [18.83737177270126, 56.99060524967425], [18.73033701387041, 56.77991641316688], [18.57764071739604, 56.63193288719062], [18.43270037907126, 56.6163845913357], [18.14543285909993, 56.56130056285922], [18.05660503306663, 56.49114326884407], [17.95672366264127, 56.39850728261833], [17.88214183758977, 56.33274491125525], [17.9233037207081, 56.16485319929691], [17.89872678362541, 55.88140674586849], [17.87813899267141, 55.80555896238968], [17.85993064426301, 55.60295924456074], [17.7879040669914, 55.42383545369876], [17.69591026787856, 55.37464750464634], [17.60856448349606, 55.28041335521699], [17.4928528853832, 55.23242904540757], [17.36535090399545, 55.31160529262832], [17.22198254489751, 55.25790103270338], [17.10339746684913, 55.14113866752108], [16.98199074507732, 54.98690840157447], [16.92624220623773, 54.80462471314694], [16.95867808035771, 54.68655865697966], [17.01653434119351, 54.54718806179453], [16.98491663887042, 54.21390918333228], [16.91369010900253, 53.96103915889694], [16.84685087595318, 53.70366128481261], [16.75487222290486, 53.54809749772002], [16.62451821561428, 53.01518392073681], [16.39231965526736, 52.41519362927499], [16.20861035907269, 52.25071272840481], [15.91537218831226, 52.16012065162831], [15.75752534416388, 52.21586190743519], [15.62507690720476, 52.21887921160111], [15.42295455714522, 51.73141089297204], [15.27746934225289, 51.57567020314605], [15.08133588195167, 50.77603819373101], [14.88317458450164, 50.29751572348729], [14.75987521349425, 50.00572976044891], [14.69455091668209, 49.44937455858641], [14.40967912695764, 48.99098914024431], [14.04741809429719, 48.80825765934281], [14.00538481132088, 48.49219128686244], [13.96054938081848, 48.30466512483947], [14.01436301157167, 48.0271980789074], [13.89149770225559, 47.7169327604364], [13.730038012432, 47.50397786007001], [13.62239471057608, 47.27173915582942], [13.55709260552895, 46.98355351388067], [13.39937717054382, 46.71978998771436], [13.39834909265336, 46.400647070773], [13.40698855282875, 45.98228213006319], [13.36315070943404, 45.72119509065502], [13.22718006748132, 45.55637083423315], [13.04977543253555, 45.3798546712183], [12.98822662299519, 45.19180878230444], [12.91456953342253, 45.08143130346485], [12.80770039372491, 45.05263303734816], [12.70066252078245, 44.91174635432694], [12.72096832384785, 44.81434854016933], [12.78376558876294, 44.67972214448321], [12.80468343586951, 44.48511478064076], [12.66870892494596, 44.43926391617336], [12.63096804173576, 44.26935014081417], [12.62850362518602, 44.14229353197928], [12.60106767181025, 43.94084563114711], [12.69387595436122, 43.66713762239474], [12.67948497241076, 43.49429665392366], [12.73573436061859, 43.45410463921739], [12.80678734457007, 43.47535670788859], [12.90141016226668, 43.4100218123311], [13.06818861689249, 43.31792832703051], [13.25622293840067, 43.21020880387223], [13.48871093107565, 43.24972344780964], [13.71303910980416, 43.27492143291563], [14.08563271638416, 43.10955809613814], [14.57914144879683, 42.98773287744154], [14.91013226727155, 42.9276399806002], [15.16717339800771, 42.81961910523754], [15.47061207274044, 42.7599375781096], [15.67517739735908, 42.67909657330632], [15.93627880017615, 42.77641551301811], [16.16767690867453, 42.8221909255651], [16.54316344044027, 42.69258839923752], [16.76717091764869, 42.60671179225586], [16.93931891813185, 42.49921271993629], [17.0991101587453, 42.35944949941342], [17.41311275853257, 42.24490890679058], [17.70958185617155, 41.97807655591547], [17.85997224072822, 41.69099544730513], [18.35456456130659, 41.43444449563136], [18.67234325785721, 41.1918070405668], [18.9951831819738, 41.14314886480423], [19.47150716821487, 40.9340980219759], [19.69494237820877, 40.73085852235353], [19.93388863873991, 40.49281271780466], [20.15642997495969, 40.11723093811415], [20.31748640062717, 39.78377256309595], [20.71837114620712, 39.47008282536585], [20.98806161686894, 39.23048918958775], [21.35712024784057, 39.10077791445759], [21.62294712628709, 39.13369368201644], [21.85765124068651, 38.98160581002888], [22.06620322272934, 38.93575161210267], [22.27545506071028, 39.09888376014094], [22.52234677262776, 39.05252711911346], [22.75986848147541, 38.93195765478242], [23.13523208504303, 38.7622494622737], [23.49507975960375, 38.52527621997542], [23.78049587592655, 38.35666979598054], [23.95871015327163, 38.12062662627488], [24.15363665094105, 37.8133926704734], [24.23316896047933, 37.54349018876129], [24.48869215299895, 37.38795950880032], [24.71905649398416, 37.12350375131982], [25.09300991048885, 37.22737860652139], [25.34286680267843, 37.06126755996095], [25.72733732995582, 36.74669116669126], [26.08798162862558, 36.54002361664909], [26.56917738597021, 36.22859646070088], [26.89853608448528, 35.97413009945547], [27.15461246931732, 35.86362190550097], [27.50218537232056, 35.54866889361511], [27.8911073489466, 35.32233378444313],
        // Iran coast
        [29.3630710093784, 47.69451494467255], [29.48853279202578, 47.85791469567905], [29.55065101534365, 48.00213064546049], [29.52541632590453, 48.14633315408413], [29.5501818397548, 48.26220164516374], [29.66620981664044, 48.3515812504459], [29.75341402668571, 48.39229938550303], [29.8271655681501, 48.37169750497442], [29.89836843415788, 48.42363782130669], [29.84573587742652, 48.55125295701794], [29.80507565315308, 48.62504992376957], [29.92351663509372, 48.71263873876262], [30.05487699053969, 48.75017105743748], [30.00311089241972, 48.94875629454575], [30.08739095470234, 49.16621667291098], [30.15047701412148, 49.33548674041883], [30.09644916846861, 49.4800228141493], [29.95293809179967, 49.53143448712704], [30.08897585006953, 49.74595878988058], [30.2014066293587, 50.00307312621057], [30.00308855059386, 50.13742303438497], [29.8587605287009, 50.22950859757266], [29.66995756929751, 50.34847936790843], [29.51130257883906, 50.51984004797619], [29.40711372717061, 50.63916623134492], [29.29882105033526, 50.65352650910498], [29.1095213310015, 50.63958691508223], [29.08310381624124, 50.72661405752098], [29.02801717386986, 50.85193202555166], [28.87669361474165, 50.82285544196534], [28.80714001911365, 50.93205219065609], [28.81672290316913, 51.00410864232614], [28.65285812966256, 51.08072448198459], [28.54437997158361, 51.07024230701319], [28.38684654293765, 51.12756787659696], [28.24916656225347, 51.26936617981935], [28.15017516249074, 51.26172633371365], [28.02508877186577, 51.30270813580739], [27.86938224806243, 51.46279959198267], [27.81359690493269, 51.60592934277918], [27.82421934115606, 51.75672538608204], [27.81421163956926, 51.96830953156027], [27.7547074378825, 52.15769593911217], [27.63402889683396, 52.38470137172195], [27.57952789096283, 52.5016271770395], [27.52244495258446, 52.56131676183366], [27.46833594325748, 52.59640993425518], [27.45637043101377, 52.66538582924098], [27.439220807907, 52.67934382424742], [27.41652704005346, 52.68055896898925], [27.40325309039391, 52.66619402382143], [27.39980811895161, 52.62966083935505], [27.39232713960945, 52.58877660011269], [27.36077063392259, 52.58238593597597], [27.33467459619699, 52.63250494693976], [27.23675708652958, 52.77436638424268], [27.1833350803638, 52.87907966681657], [27.14361121133904, 52.97334448618098], [27.0826512021152, 53.10220097705729], [27.03067883762564, 53.26683566013406], [26.98504084867555, 53.43367460822587], [26.95708562742175, 53.47772103624161], [26.88618501797854, 53.48084684395054], [26.84478622518554, 53.46818658342936], [26.78459399488427, 53.55838675876784], [26.74707057180788, 53.66530523223739], [26.69700920416602, 53.7443296808179], [26.71737879232177, 53.81180287566916], [26.70511455617534, 53.92826708420071], [26.74500392847064, 54.01094779023265], [26.72187193391018, 54.07220011374579], [26.70349433322481, 54.19431854801385], [26.71164517919444, 54.28805948978821], [26.66740545755421, 54.34879610123444], [26.59727091789129, 54.37114342369616], [26.56755308071338, 54.46167867716807], [26.57294383504277, 54.46649030756285], [26.59645693690799, 54.50971835457999], [26.55437154162193, 54.57770371575072], [26.50292792214704, 54.59527159457734], [26.48385754314626, 54.6526438165907], [26.49994010826835, 54.73495604407796], [26.49314103811355, 54.82707495936909], [26.53760643182775, 54.88952689136505], [26.63446452293726, 55.0498402583292], [26.72930732162522, 55.19801021960766], [26.78679170679406, 55.28137441580423], [26.73781552756882, 55.3885825499053], [26.73507604630702, 55.4777850388919], [26.79995556876605, 55.55998251494675], [26.88306007976158, 55.56952637058873], [26.96516360057058, 55.64280868317915], [26.97748361447425, 55.69062354042335], [26.97491377229831, 55.75498359405034], [27.00029598487352, 55.87743321828322], [27.03229072017202, 55.96515038670886], [27.09351906209925, 56.05592048396039], [27.13465062100578, 56.1379173830131], [27.13431034948272, 56.20349100465665], [27.18000393323535, 56.28085111644454], [27.17984753011914, 56.41076691710177], [27.17048519872868, 56.5065629682727], [27.13643716831453, 56.65480260072563], [27.10709610945206, 56.76585820738133], [27.05086270054153, 56.83164956169606], [26.96767735023004, 56.87945914629153], [26.90208240427064, 56.94708641161004], [26.7664622744992, 57.03184820378203], [26.63644229571843, 57.07159039195999], [26.54387833533174, 57.07373989761491], [26.45493174059408, 57.05637215737326], [26.40994719679288, 57.05763626137524], [26.30616925256406, 57.08903587474401], [26.2196690489094, 57.15204853548445], [26.17456222731467, 57.21351882727667], [26.11616633673311, 57.20021676048563], [26.05916982883493, 57.17193313919983], [25.99010901607023, 57.21534605031251], [25.91843709247698, 57.27118648811474], [25.82847481728753, 57.29620474977246], [25.77924663019112, 57.31016722182316], [25.75088589762288, 57.39016472425579], [25.72517223395861, 57.48356530705881], [25.72351690256618, 57.60982348573911], [25.73624513668782, 57.7162711812622], [25.71143812184033, 57.77887997013941], [25.67526887318747, 57.77501758561984], [25.63711737860162, 57.77296441586197], [25.66440951654259, 57.84206431103741], [25.70257357729536, 57.94934828905214], [25.64984625353484, 57.98831055685201], [25.59766474262654, 58.03380092696658], [25.5587194250462, 58.09551900472627], [25.55161924316254, 58.19118407012643], [25.58283501703418, 58.29937010146961], [25.57844999150313, 58.40634475432664], [25.58967585023337, 58.52169603060784], [25.57920899411008, 58.62919889668636], [25.56405276998438, 58.72942742454251], [25.55269679602731, 58.82916071033503], [25.50150145249253, 58.92577474296734], [25.4093849786299, 58.99803768511836], [25.39738111359589, 59.06517300951521], [25.41956135625875, 59.21741038426578], [25.46303978993082, 59.38446759163087], [25.46709984114972, 59.48158382780842], [25.40555613880148, 59.55413467287399], [25.37317724378437, 59.65420326558646], [25.39403112354373, 59.78457634604131], [25.37557683380098, 59.87743087228911], [25.32413554566648, 59.92159253108085], [25.36690855584364, 60.02210310716298], [25.37239038330973, 60.14961427991444], [25.31438095658749, 60.18073231750654], [25.31879403601722, 60.23480787493573], [25.30783226757908, 60.32666736434062], [25.2826974958503, 60.46024875741683], [25.33777822538197, 60.46932580288419], [25.41720338908695, 60.46667733202413], [25.41967793816732, 60.52563408655871], [25.4036629960377, 60.57563281437923], [25.33045686416508, 60.60377706800878], [25.28513828944039, 60.61221287480942], [25.26513915051925, 60.70199640292811], [25.23644906686477, 60.86943124268315], [25.19805684358304, 61.04542060052387], [25.17398386072594, 61.17102139104072], [25.1163395232857, 61.19512014658614], [25.09969455687396, 61.31214223335321], [25.05696236992723, 61.42136359921648], [25.07167518951855, 61.45498875650313], [25.12624158843075, 61.48689833088201], [25.19280195727439, 61.56237671017712], [25.1684889242197, 61.73749669402574], [25.09926371079637, 61.76455053752932], [25.00679881492831, 61.71177687426213], [25.03355956054709, 61.86781568983672], [25.10135098314649, 61.92392845167268], [25.08172713190866, 62.04502924100066], [25.15552555123407, 62.13244302568882], [25.10498882117048, 62.35768851634887], [25.14449101067548, 62.48661070287343]
    ];

    // Persian Gulf islands (polygon data from KML)
    const PERSIAN_GULF_ISLANDS = [
        // Bahrain Island
        {
            name: 'Bahrain',
            coords: [[26.21158076085144, 50.44904140617817], [26.145795330529, 50.45377293095993], [26.10650872584712, 50.46802717193115], [26.0486135593043, 50.49048419453226], [26.00014323610603, 50.46840300139103], [25.95508018225988, 50.4626426129817], [25.89816190262174, 50.51265935432144], [25.84982497504657, 50.55426481731233], [25.80519802971526, 50.55566206981238], [25.8268131291337, 50.59741509628352], [25.90276425391711, 50.60978648918623], [26.04135089819455, 50.62595948373382], [26.08790934342911, 50.62822031194712], [26.12799644590575, 50.64111105801801], [26.16802847465339, 50.6488644738956], [26.18381529693509, 50.61134004691819], [26.15838163775846, 50.59971939419088], [26.16589484050712, 50.57964887520752], [26.21005716265903, 50.56425515010056], [26.20175564670953, 50.59387006775965], [26.20610111798225, 50.61286207015765], [26.21757460941406, 50.62475106096326], [26.21643926768818, 50.64748776444594], [26.18800416289922, 50.65758527219823], [26.18365929967413, 50.71346324347847], [26.19843421714662, 50.71091021449825], [26.25703879160896, 50.68261802780393], [26.30991662195854, 50.66439064371975], [26.34221700781433, 50.63906516915476], [26.31994405633532, 50.61339727723693], [26.29765688940334, 50.60103021090458], [26.27764745448378, 50.5881600871661], [26.26054084512792, 50.58449010825002], [26.24607915504753, 50.56798590667248], [26.23715169068669, 50.51373651870533], [26.23232099609534, 50.47262492077736], [26.21158076085144, 50.44904140617817]]
        },
        // Qeshm Island (large island near Iran coast)
        {
            name: 'Qeshm',
            coords: [[26.83388924742226, 53.16098106316301], [26.80617786808167, 53.20020059631184], [26.78689938755063, 53.26625548699486], [26.79666708183217, 53.39115802173977], [26.81574982191229, 53.36879997181979], [26.82320791987785, 53.31253550085479], [26.82437198344675, 53.26790876053762], [26.8391118432424, 53.22053133823228], [26.84923243603059, 53.18351670921976], [26.84701118204462, 53.15989865213155], [26.8326749301317, 53.16141789414311]]
        },
        // Small island near Qeshm
        {
            name: 'Hengam',
            coords: [[26.69426744127513, 53.62994020242423], [26.69452908606819, 53.59666028371338], [26.66376605442796, 53.5971797600231], [26.65551114045004, 53.63166997231118], [26.6597276723581, 53.65891848620582], [26.67802899356301, 53.67425313335964], [26.68462117445997, 53.65595172171258], [26.69426744127513, 53.62994020242423]]
        },
        // Island near Iran coast
        {
            name: 'Lavan',
            coords: [[26.5737542873899, 53.93059762497573], [26.54476296254101, 53.904468460419], [26.5138498405523, 53.91321224974693], [26.48659970141385, 53.96293249644906], [26.49814855709469, 54.03176467937006], [26.50316525585812, 54.05225794362083], [26.5322813123808, 54.03813786430419], [26.55434731835557, 54.02238803380176], [26.56823420541257, 54.00836720500337], [26.56873156787647, 53.97192759276769], [26.5737542873899, 53.93059762497573]]
        },
        // Small island
        {
            name: 'Kish',
            coords: [[25.92867115714347, 54.52015268333167], [25.91458196976378, 54.49091223163849], [25.89630024458794, 54.50217314249816], [25.89443956931029, 54.53716361443293], [25.89223533686929, 54.55052462392931], [25.9009786527957, 54.55612427394029], [25.91895172224276, 54.55284382535847], [25.93526341824623, 54.54454503039353], [25.92867115714347, 54.52015268333167]]
        },
        // Another small island
        {
            name: 'Farur',
            coords: [[26.28941065317824, 54.48750861225877], [26.25105005422746, 54.50856948148449], [26.25716846607932, 54.5313514366356], [26.28141367300959, 54.54101179024482], [26.29776255740658, 54.539214823041], [26.31341290781354, 54.52698480377233], [26.31459669828744, 54.50731693492963], [26.31006201204513, 54.49660516150107], [26.30153786873354, 54.48740418042051], [26.28941065317824, 54.48750861225877]]
        },
        // Abu Musa Island complex
        {
            name: 'Abu Musa',
            coords: [[26.64648100001668, 55.27061625633356], [26.60520583140887, 55.28322723119292], [26.57544436478787, 55.27050563584215], [26.53908768751683, 55.28329002529458], [26.55078772417604, 55.32178711278626], [26.56879148249399, 55.39187964372393], [26.59159387336079, 55.47457652016706], [26.59513355766708, 55.51537593202837], [26.62673731222865, 55.57064845950178], [26.6450611953662, 55.63095370704807], [26.6723232927203, 55.67589295174268], [26.68511722734495, 55.7183515307997], [26.67517423448804, 55.7520265082375], [26.70468649241814, 55.81274743132424], [26.73153507716781, 55.86983243480079], [26.71562975146874, 55.89768337780897], [26.69215034142376, 55.9164318743185], [26.68723432526954, 55.95123760720653], [26.73962041468588, 56.01106175945011], [26.77521909493712, 56.0742528845014], [26.81058980655743, 56.11389994505498], [26.85497371345791, 56.14708690985186], [26.88513666639687, 56.15846780859502], [26.91351395110531, 56.1746050962137], [26.92699101694767, 56.25928102711272], [26.93920158922994, 56.28926863010306], [26.96177969776384, 56.27831257827953], [26.98877739175334, 56.25194543883838], [27.00410026807858, 56.18008602902872], [26.98978304905616, 56.12755395176879], [26.9717561275448, 56.07966717134555], [26.95314825749033, 56.02957680796113], [26.94183049665427, 55.97762502844783], [26.92139759999326, 55.94116477664281], [26.90283539040666, 55.89558842310549], [26.89593697924045, 55.86407814551321], [26.91415335627046, 55.83749143109927], [26.93836093311463, 55.79835805744743], [26.95331489509487, 55.75629044717162], [26.94023220485303, 55.73609893632416], [26.92549494444031, 55.73047518314532], [26.9070241879817, 55.7519391669178], [26.88202013978468, 55.77409191162439], [26.86730262468205, 55.77719718740764], [26.85166861024301, 55.77344221103766], [26.84183641341258, 55.78913442116507], [26.82038127287317, 55.79469276924598], [26.78861878150391, 55.78449505495226], [26.77803558091355, 55.75925918450748], [26.76925004235819, 55.73068082775433], [26.77300500734598, 55.70197305967162], [26.77404667032663, 55.6655127325816], [26.75392354594988, 55.62910172971372], [26.7304358647133, 55.59559972325718], [26.71642187130794, 55.56334654089687], [26.70157536906956, 55.51582022137107], [26.69272935301808, 55.48461191556468], [26.67589107410117, 55.44760864872644], [26.67114797086286, 55.42522927050679], [26.6736876838568, 55.41610632355883], [26.66083158501464, 55.39005824504459], [26.64497108490972, 55.36099577103231], [26.6391493999986, 55.33551737754241], [26.65035116547406, 55.29868263204291], [26.66163260975952, 55.27732912508017], [26.65964489132988, 55.26107785969744], [26.64648100001668, 55.27061625633356]]
        },
        // Small island near Abu Musa
        {
            name: 'Sirri',
            coords: [[26.65718343571423, 55.86515805166017], [26.63425017663331, 55.84927395677903], [26.61905588788657, 55.84620848553081], [26.61060307629871, 55.8729715554396], [26.6157271578014, 55.89685847173791], [26.664438115674, 55.91564650486005], [26.67964559770322, 55.88936183722537], [26.65718343571423, 55.86515805166017]]
        },
        // Islands near UAE coast
        {
            name: 'Tunb',
            coords: [[26.87580999530999, 56.33372875199923], [26.85564910575896, 56.3211491718415], [26.8363693648961, 56.3128049250025], [26.82360670654775, 56.32418637720839], [26.82296035229849, 56.3476139906311], [26.83884618702761, 56.38181605176774], [26.85502932942303, 56.40972565532157], [26.87158596622398, 56.40895446210767], [26.88335576640968, 56.4005019828409], [26.88526777325522, 56.37142857279968], [26.88889681913611, 56.35442133411979], [26.87580999530999, 56.33372875199923]]
        },
        {
            name: 'Greater Tunb',
            coords: [[27.0850679694066, 56.43976693534419], [27.07386664093139, 56.42668459535815], [27.05872747815262, 56.4226836261759], [27.04012705901408, 56.4269050908211], [27.03417380624986, 56.45988358465255], [27.03759454644505, 56.48888009065269], [27.05082966199624, 56.49923336370116], [27.07137873689881, 56.49816344412518], [27.08237212665431, 56.48867655336879], [27.09431327190706, 56.45811333379947], [27.0850679694066, 56.43976693534419]]
        }
    ];

    // Major cities in the Persian Gulf region
    const PERSIAN_GULF_CITIES = [
        { name: 'Kuwait City', lat: 29.3759, lon: 47.9774 },
        { name: 'Basra', lat: 30.5085, lon: 47.7835 },
        { name: 'Doha', lat: 25.2854, lon: 51.5310 },
        { name: 'Abu Dhabi', lat: 24.4539, lon: 54.3773 },
        { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
        { name: 'Sharjah', lat: 25.3463, lon: 55.4209 },
        { name: 'Manama', lat: 26.2285, lon: 50.5860 },
        { name: 'Dammam', lat: 26.4207, lon: 50.0888 },
        { name: 'Dhahran', lat: 26.2361, lon: 50.0393 },
        { name: 'Al Jubail', lat: 27.0174, lon: 49.6572 },
        { name: 'Bandar Abbas', lat: 27.1865, lon: 56.2808 },
        { name: 'Bushehr', lat: 28.9684, lon: 50.8385 },
        { name: 'Muscat', lat: 23.6100, lon: 58.5400 },
        { name: 'Khasab', lat: 26.2096, lon: 56.2503 }
    ];

    const renderCoastline = (width, height) => {
        const points = PERSIAN_GULF_COASTLINE.map(([lat, lon]) => {
            const pos = latLonToScreen(lat, lon, mapCenter.lat, mapCenter.lon, scale, width, height);
            return `${pos.x},${pos.y}`;
        }).join(' ');

        return (
            <g>
                <polyline
                    points={points}
                    fill="none"
                    stroke="#808080"
                    strokeWidth="1.5"
                    opacity="0.5"
                />
            </g>
        );
    };

    const renderIslands = (width, height) => {
        return (
            <g>
                {PERSIAN_GULF_ISLANDS.map((island, idx) => {
                    const points = island.coords.map(([lat, lon]) => {
                        const pos = latLonToScreen(lat, lon, mapCenter.lat, mapCenter.lon, scale, width, height);
                        return `${pos.x},${pos.y}`;
                    }).join(' ');

                    return (
                        <polygon
                            key={idx}
                            points={points}
                            fill="none"
                            stroke="#808080"
                            strokeWidth="1.5"
                            opacity="0.5"
                        />
                    );
                })}
            </g>
        );
    };

    const renderCities = (width, height) => {
        return (
            <g>
                {PERSIAN_GULF_CITIES.map(city => {
                    const pos = latLonToScreen(city.lat, city.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    // Only render if within bounds
                    if (pos.x < -50 || pos.x > width + 50 || pos.y < -50 || pos.y > height + 50) {
                        return null;
                    }

                    return (
                        <g key={city.name}>
                            {/* City marker */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={3}
                                fill="#FFFF00"
                                opacity="0.7"
                            />
                            {/* City name */}
                            <text
                                x={pos.x + 6}
                                y={pos.y - 6}
                                fill="#FFFF00"
                                fontSize="8"
                                fontWeight="600"
                                opacity="0.6"
                            >
                                {city.name}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderBullseye = (width, height) => {
        const pos = latLonToScreen(bullseyePosition.lat, bullseyePosition.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
        const displayName = bullseyeName && bullseyeName.trim() ? bullseyeName.toUpperCase() : 'BE';

        return (
            <g style={{ cursor: 'pointer' }}>
                {/* Selection ring when bullseye is selected */}
                {bullseyeSelected && (
                    <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={18}
                        fill="none"
                        stroke="#00FF00"
                        strokeWidth="2"
                        opacity="0.6"
                        strokeDasharray="4,4"
                    />
                )}
                <circle cx={pos.x} cy={pos.y} r={8} fill="none" stroke="#00FF00" strokeWidth="2" />
                <line x1={pos.x-12} y1={pos.y} x2={pos.x+12} y2={pos.y} stroke="#00FF00" strokeWidth="2" />
                <line x1={pos.x} y1={pos.y-12} x2={pos.x} y2={pos.y+12} stroke="#00FF00" strokeWidth="2" />
                <text x={pos.x} y={pos.y-15} fill="#00FF00" fontSize="10" textAnchor="middle" fontWeight="700">{displayName}</text>
            </g>
        );
    };

    const renderTempMark = (width, height) => {
        if (!tempMark) return null;

        const pos = latLonToScreen(tempMark.lat, tempMark.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

        return (
            <g>
                <circle cx={pos.x} cy={pos.y} r={6} fill="none" stroke="#FFFF00" strokeWidth="2" />
                <line x1={pos.x-9} y1={pos.y} x2={pos.x+9} y2={pos.y} stroke="#FFFF00" strokeWidth="2" />
                <line x1={pos.x} y1={pos.y-9} x2={pos.x} y2={pos.y+9} stroke="#FFFF00" strokeWidth="2" />
            </g>
        );
    };

    const renderRadarReturns = (width, height) => {
        const ownship = assets.find(a => a.type === 'ownship');
        if (!ownship) return null;

        const ownshipPos = latLonToScreen(ownship.lat, ownship.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

        // Simple seeded random function for consistent fuzziness
        const seededRandom = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        return (
            <g>
                {radarReturns.map(ret => {
                    const age = missionTime - ret.missionTime; // Age in seconds
                    const baseOpacity = Math.max(0, 1 - (age / radarReturnDecay)); // Fade based on decay setting
                    const opacity = baseOpacity * (radarReturnIntensity / 100); // Apply intensity setting

                    // Get the actual target position - this is the center of the radar return
                    const targetPos = latLonToScreen(ret.lat, ret.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    // Calculate azimuth spread based on distance (longer at farther ranges)
                    // Typical radar azimuth resolution degrades with distance
                    const azimuthSpreadDegrees = 0.5 + (ret.distance / 50); // Increases with distance

                    // Calculate banana shape - arc that curves toward ownship
                    // More segments for solid/hazy appearance - scale with zoom level
                    const pixelsPerNM = Math.min(width, height) / scale;
                    const baseSegments = Math.max(15, Math.floor(azimuthSpreadDegrees * 8));
                    // Add extra segments based on zoom level for smooth appearance when zoomed in
                    const numSegments = Math.floor(baseSegments * (1 + pixelsPerNM / 50));
                    const segments = [];

                    // Create a hash from the return ID for seeding
                    let idHash = 0;
                    for (let c = 0; c < ret.id.length; c++) {
                        idHash = ((idHash << 5) - idHash) + ret.id.charCodeAt(c);
                        idHash = idHash & idHash;
                    }

                    // Calculate angle from ownship (at time of detection) to target for perpendicular spread
                    // Use stored ownship position so returns don't move when ownship moves
                    const returnOwnshipPos = latLonToScreen(ret.ownshipLat, ret.ownshipLon, mapCenter.lat, mapCenter.lon, scale, width, height);
                    const bearingToTarget = Math.atan2(targetPos.y - returnOwnshipPos.y, targetPos.x - returnOwnshipPos.x);

                    for (let i = 0; i < numSegments; i++) {
                        // Spread segments perpendicular to the bearing from ownship
                        const spreadFactor = ((i - numSegments / 2) / numSegments);
                        const azimuthOffsetRadians = spreadFactor * azimuthSpreadDegrees * Math.PI / 180;

                        // Rotate perpendicular to bearing (90 degrees offset)
                        const perpAngle = bearingToTarget + Math.PI / 2;
                        const spreadDistance = ret.distance * Math.tan(azimuthOffsetRadians) * pixelsPerNM;

                        // Position spread perpendicular to bearing
                        const spreadX = spreadDistance * Math.cos(perpAngle);
                        const spreadY = spreadDistance * Math.sin(perpAngle);

                        // Very slight curve toward ownship (banana shape)
                        const curveAmount = Math.abs(spreadFactor) * 0.5; // Pixels
                        const curveX = -curveAmount * Math.cos(bearingToTarget);
                        const curveY = -curveAmount * Math.sin(bearingToTarget);

                        const segmentX = targetPos.x + spreadX + curveX;
                        const segmentY = targetPos.y + spreadY + curveY;

                        // Add stationary fuzziness using seeded random
                        const fuzzSeed = idHash + i * 100;
                        const fuzzX = (seededRandom(fuzzSeed) - 0.5) * 3;
                        const fuzzY = (seededRandom(fuzzSeed + 50) - 0.5) * 3;

                        segments.push({
                            x: segmentX + fuzzX,
                            y: segmentY + fuzzY,
                            opacity: opacity * (0.4 + seededRandom(fuzzSeed + 25) * 0.4),
                            radius: 3 + seededRandom(fuzzSeed + 75) * 2 // Larger, more variable circles
                        });
                    }

                    return (
                        <g key={ret.id}>
                            {segments.map((seg, idx) => (
                                <circle
                                    key={`${ret.id}-${idx}`}
                                    cx={seg.x}
                                    cy={seg.y}
                                    r={seg.radius}
                                    fill="#FFFFFF"
                                    opacity={seg.opacity}
                                />
                            ))}
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderIFFReturns = (width, height) => {
        const ownship = assets.find(a => a.type === 'ownship');
        if (!ownship) return null;

        const ownshipPos = latLonToScreen(ownship.lat, ownship.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

        // Simple seeded random function for consistent fuzziness
        const seededRandom = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        return (
            <g>
                {iffReturns.map(ret => {
                    const age = missionTime - ret.missionTime;
                    const baseOpacity = Math.max(0, 1 - (age / radarReturnDecay));
                    const opacity = baseOpacity * (iffReturnIntensity / 100);

                    // Get the actual target position
                    const targetPos = latLonToScreen(ret.lat, ret.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    // Calculate azimuth spread (same as radar)
                    const azimuthSpreadDegrees = 0.5 + (ret.distance / 50);

                    // Calculate segments for solid/hazy appearance (same density as radar)
                    const pixelsPerNM = Math.min(width, height) / scale;
                    const baseSegments = Math.max(15, Math.floor(azimuthSpreadDegrees * 8));
                    const numSegments = Math.floor(baseSegments * (1 + pixelsPerNM / 50));
                    const segments = [];

                    // Create hash from return ID for seeding
                    let idHash = 0;
                    for (let c = 0; c < ret.id.length; c++) {
                        idHash = ((idHash << 5) - idHash) + ret.id.charCodeAt(c);
                        idHash = idHash & idHash;
                    }

                    // Calculate angle from ownship (at time of interrogation) to target
                    // Use stored ownship position so IFF returns don't move when ownship moves
                    const returnOwnshipPos = latLonToScreen(ret.ownshipLat, ret.ownshipLon, mapCenter.lat, mapCenter.lon, scale, width, height);
                    const bearingToTarget = Math.atan2(targetPos.y - returnOwnshipPos.y, targetPos.x - returnOwnshipPos.x);

                    // Offset IFF return toward ownship by approximately the radar return width
                    // This prevents overlap with radar returns
                    const offsetDistance = 8; // pixels - approximately one radar return width
                    const iffOffsetX = -offsetDistance * Math.cos(bearingToTarget);
                    const iffOffsetY = -offsetDistance * Math.sin(bearingToTarget);

                    for (let i = 0; i < numSegments; i++) {
                        const spreadFactor = ((i - numSegments / 2) / numSegments);
                        const azimuthOffsetRadians = spreadFactor * azimuthSpreadDegrees * Math.PI / 180;

                        const perpAngle = bearingToTarget + Math.PI / 2;
                        const spreadDistance = ret.distance * Math.tan(azimuthOffsetRadians) * pixelsPerNM;

                        const spreadX = spreadDistance * Math.cos(perpAngle);
                        const spreadY = spreadDistance * Math.sin(perpAngle);

                        // Very slight curve toward ownship
                        const curveAmount = Math.abs(spreadFactor) * 0.5;
                        const curveX = -curveAmount * Math.cos(bearingToTarget);
                        const curveY = -curveAmount * Math.sin(bearingToTarget);

                        const segmentX = targetPos.x + spreadX + curveX + iffOffsetX;
                        const segmentY = targetPos.y + spreadY + curveY + iffOffsetY;

                        // Add stationary fuzziness
                        const fuzzSeed = idHash + i * 100;
                        const fuzzX = (seededRandom(fuzzSeed) - 0.5) * 3;
                        const fuzzY = (seededRandom(fuzzSeed + 50) - 0.5) * 3;

                        segments.push({
                            x: segmentX + fuzzX,
                            y: segmentY + fuzzY,
                            opacity: opacity * (0.4 + seededRandom(fuzzSeed + 25) * 0.4),
                            radius: 3 + seededRandom(fuzzSeed + 75) * 2
                        });
                    }

                    return (
                        <g key={ret.id}>
                            {segments.map((seg, idx) => (
                                <circle
                                    key={`${ret.id}-${idx}`}
                                    cx={seg.x}
                                    cy={seg.y}
                                    r={seg.radius}
                                    fill="#00FF00"
                                    opacity={seg.opacity}
                                />
                            ))}
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderRadarSweep = (width, height) => {
        const ownship = assets.find(a => a.type === 'ownship');
        // Don't show radar sweep until user has started simulation at least once, or if radar is disabled
        if (!ownship || !hasStarted || !radarEnabled) return null;

        const ownshipPos = latLonToScreen(ownship.lat, ownship.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

        // Calculate the 320 NM range in screen pixels
        const rangeInPixels = (320 / scale) * Math.min(width, height);

        // Create multiple wedges with decreasing opacity to simulate angular gradient
        const wedges = [];
        const numWedges = 60; // Number of segments to create ultra-smooth fade
        const totalSpan = 40; // Total degrees of sweep trail
        const segmentSize = totalSpan / numWedges; // Size of each segment

        // Create wedges from trailing edge to leading edge
        for (let i = 0; i < numWedges; i++) {
            const startAngle = radarSweepAngle - totalSpan + (i * segmentSize);
            const endAngle = startAngle + segmentSize;

            // Calculate opacity - increases towards leading edge, scaled by user setting
            const opacity = (i / numWedges) * radarSweepOpacity;

            // Convert to radians for drawing (0° is north, clockwise)
            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;

            // Create points for the wedge path
            const startX = ownshipPos.x + rangeInPixels * Math.cos(startRad);
            const startY = ownshipPos.y + rangeInPixels * Math.sin(startRad);
            const endX = ownshipPos.x + rangeInPixels * Math.cos(endRad);
            const endY = ownshipPos.y + rangeInPixels * Math.sin(endRad);

            // Create the path for this segment
            const pathData = `
                M ${ownshipPos.x},${ownshipPos.y}
                L ${startX},${startY}
                A ${rangeInPixels},${rangeInPixels} 0 0 1 ${endX},${endY}
                Z
            `;

            wedges.push(
                <path
                    key={i}
                    d={pathData}
                    fill="#FFFFFF"
                    opacity={opacity}
                />
            );
        }

        // Calculate leading edge line endpoint
        const leadingRad = (radarSweepAngle - 90) * Math.PI / 180;
        const leadingX = ownshipPos.x + rangeInPixels * Math.cos(leadingRad);
        const leadingY = ownshipPos.y + rangeInPixels * Math.sin(leadingRad);

        return (
            <g>
                {/* Render all wedge segments */}
                {wedges}
                {/* Leading edge line - bright white */}
                <line
                    x1={ownshipPos.x}
                    y1={ownshipPos.y}
                    x2={leadingX}
                    y2={leadingY}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    opacity={0.9}
                />
            </g>
        );
    };

    const renderEsmLines = (width, height) => {
        const ownship = assets.find(a => a.type === 'ownship');
        if (!ownship || !esmEnabled) return null;

        const ownshipPos = latLonToScreen(ownship.lat, ownship.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

        return (
            <g>
                {detectedEmitters.filter(emitter => emitter.visible).map(emitter => {
                    // Calculate end point of LOB line (extend to edge of screen)
                    const bearingRad = (emitter.bearing - 90) * Math.PI / 180; // Convert to radians (0° is north)

                    // Find intersection with screen edges
                    const cos = Math.cos(bearingRad);
                    const sin = Math.sin(bearingRad);

                    // Calculate distances to each edge
                    let tMin = Infinity;

                    // Check right edge (x = width)
                    if (cos > 0) {
                        const t = (width - ownshipPos.x) / cos;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check left edge (x = 0)
                    if (cos < 0) {
                        const t = -ownshipPos.x / cos;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check bottom edge (y = height)
                    if (sin > 0) {
                        const t = (height - ownshipPos.y) / sin;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check top edge (y = 0)
                    if (sin < 0) {
                        const t = -ownshipPos.y / sin;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }

                    const endX = ownshipPos.x + tMin * cos;
                    const endY = ownshipPos.y + tMin * sin;

                    // Inset label from edge - increased by 50% for better spacing
                    let inset = 37.5; // Increased from 25
                    // If label is near the top edge (within 90px), inset more to avoid status indicators
                    if (endY < 90) {
                        inset = 90; // Increased from 60
                    }
                    // If label is near the bottom edge, double the inset (2x = 75px)
                    if (endY > height - 90) {
                        inset = 75; // 2x the base inset
                    }
                    const labelX = endX - inset * cos;
                    const labelY = endY - inset * sin;

                    const isSelected = selectedEsmId === emitter.id;
                    const isActive = emitter.active;

                    // Colors based on active state: Orange for active, Gray for inactive
                    const lineColor = isActive ? '#FF8800' : '#888888';
                    const boxColor = isActive ? '#FF8800' : '#888888';
                    const textColor = '#000000';

                    const handleEsmClick = (e) => {
                        e.stopPropagation();
                        setSelectedSystemTab('esm');
                        setSelectedEsmId(emitter.id);
                    };

                    return (
                        <g key={emitter.id}>
                            {/* LOB Line - only show when selected */}
                            {isSelected && (
                                <>
                                    <line
                                        x1={ownshipPos.x}
                                        y1={ownshipPos.y}
                                        x2={endX}
                                        y2={endY}
                                        stroke={lineColor}
                                        strokeWidth={2}
                                        opacity={isActive ? 0.8 : 0.6}
                                        style={{ cursor: 'pointer' }}
                                        onClick={handleEsmClick}
                                    />
                                    {/* Invisible wider line for easier clicking */}
                                    <line
                                        x1={ownshipPos.x}
                                        y1={ownshipPos.y}
                                        x2={endX}
                                        y2={endY}
                                        stroke="transparent"
                                        strokeWidth={10}
                                        style={{ cursor: 'pointer' }}
                                        onClick={handleEsmClick}
                                    />
                                </>
                            )}
                            {/* Label Box */}
                            <g
                                style={{ cursor: 'pointer' }}
                                onClick={handleEsmClick}
                            >
                                <rect
                                    x={labelX - 18}
                                    y={labelY - 9}
                                    width={36}
                                    height={18}
                                    fill={boxColor}
                                    stroke={isSelected ? '#FFFFFF' : boxColor}
                                    strokeWidth={isSelected ? 2 : 1}
                                    rx="2"
                                    ry="2"
                                />
                                <text
                                    x={labelX}
                                    y={labelY + 4}
                                    fontSize="11"
                                    fill={textColor}
                                    textAnchor="middle"
                                    fontWeight="bold"
                                >
                                    E{emitter.serialNumber.toString().padStart(2, '0')}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderManualBearingLines = (width, height) => {
        if (manualBearingLines.length === 0) return null;

        return (
            <g className="manual-bearing-lines">
                {manualBearingLines.map((line) => {
                    // Draw from the stored ownship position at time of creation
                    const lineStartPos = latLonToScreen(line.ownshipLat, line.ownshipLon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    // Use the fixed bearing from when the line was created
                    const bearingRad = (line.bearing - 90) * Math.PI / 180; // Convert to radians (0° is north)

                    // Find intersection with screen edges
                    const cos = Math.cos(bearingRad);
                    const sin = Math.sin(bearingRad);

                    // Calculate distances to each edge
                    let tMin = Infinity;

                    // Check right edge (x = width)
                    if (cos > 0) {
                        const t = (width - lineStartPos.x) / cos;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check left edge (x = 0)
                    if (cos < 0) {
                        const t = -lineStartPos.x / cos;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check bottom edge (y = height)
                    if (sin > 0) {
                        const t = (height - lineStartPos.y) / sin;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }
                    // Check top edge (y = 0)
                    if (sin < 0) {
                        const t = -lineStartPos.y / sin;
                        if (t > 0) tMin = Math.min(tMin, t);
                    }

                    const endX = lineStartPos.x + tMin * cos;
                    const endY = lineStartPos.y + tMin * sin;

                    // Inset label from edge - increased by 50% for better spacing
                    let inset = 37.5; // Increased from 25
                    if (endY < 90) {
                        inset = 90; // Increased from 60
                    }
                    // If label is near the bottom edge, double the inset (2x = 75px)
                    if (endY > height - 90) {
                        inset = 75; // 2x the base inset
                    }
                    const labelX = endX - inset * cos;
                    const labelY = endY - inset * sin;

                    const isSelected = selectedEsmId === line.id;

                    // Manual lines are cyan/blue color
                    const lineColor = '#00CCFF';
                    const boxColor = '#00CCFF';
                    const textColor = '#000000';

                    const handleManualLineClick = (e) => {
                        e.stopPropagation();
                        setSelectedEsmId(line.id);
                        setSelectedSystemTab('esm');
                        setSelectedAssetId(null);
                        setSelectedGeoPointId(null);
                        setSelectedShapeId(null);
                        setBullseyeSelected(false);
                    };

                    const handleManualLineRightClick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            type: 'manualBearingLine',
                            id: line.id,
                            serialNumber: line.serialNumber
                        });
                    };

                    return (
                        <g key={line.id}>
                            {/* Line - always show for manual bearing lines */}
                            <line
                                x1={lineStartPos.x}
                                y1={lineStartPos.y}
                                x2={endX}
                                y2={endY}
                                stroke={lineColor}
                                strokeWidth={isSelected ? 3 : 2}
                                strokeDasharray="5,5"
                                opacity={isSelected ? 1 : 0.8}
                            />
                            {/* Invisible thick line for easier clicking */}
                            <line
                                x1={lineStartPos.x}
                                y1={lineStartPos.y}
                                x2={endX}
                                y2={endY}
                                stroke="transparent"
                                strokeWidth={10}
                                style={{ cursor: 'pointer' }}
                                onClick={handleManualLineClick}
                                onContextMenu={handleManualLineRightClick}
                            />
                            {/* Label Box */}
                            <g
                                style={{ cursor: 'pointer' }}
                                onClick={handleManualLineClick}
                                onContextMenu={handleManualLineRightClick}
                            >
                                <rect
                                    x={labelX - 18}
                                    y={labelY - 9}
                                    width={36}
                                    height={18}
                                    fill={boxColor}
                                    stroke={isSelected ? '#FFFFFF' : boxColor}
                                    strokeWidth={isSelected ? 2 : 1}
                                    rx="2"
                                    ry="2"
                                />
                                <text
                                    x={labelX}
                                    y={labelY + 4}
                                    fontSize="11"
                                    fill={textColor}
                                    textAnchor="middle"
                                    fontWeight="bold"
                                >
                                    M{line.serialNumber.toString().padStart(2, '0')}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderAsset = (asset, width, height) => {
        // Use 'ownship' if type is ownship, otherwise use identity for symbol
        const symbolType = asset.type === 'ownship' ? 'ownship' : (asset.identity || 'unknown');
        const config = ASSET_TYPES[symbolType];
        const pos = latLonToScreen(asset.lat, asset.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
        const isSelected = asset.id === selectedAssetId;
        const size = 12; // Consistent size for all assets
        const strokeWidth = 2;

        // Heading line
        const headingLength = 30;
        const headingRad = asset.heading * Math.PI / 180;
        const headingX = pos.x + headingLength * Math.sin(headingRad);
        const headingY = pos.y - headingLength * Math.cos(headingRad);

        return (
            <g key={asset.id}>
                {/* Selection ring - rendered first (behind asset) */}
                {isSelected && (
                    <>
                        {/* Outer glow ring */}
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={22}
                            fill="none"
                            stroke={config.color}
                            strokeWidth="1.5"
                            opacity="0.4"
                        />
                        {/* Main selection ring */}
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={20}
                            fill="none"
                            stroke={config.color}
                            strokeWidth="2.5"
                            strokeDasharray="4,3"
                            opacity="0.9"
                        >
                            {/* Rotating animation */}
                            <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 ${pos.x} ${pos.y}`}
                                to={`360 ${pos.x} ${pos.y}`}
                                dur="4s"
                                repeatCount="indefinite"
                            />
                        </circle>
                        {/* Inner ring */}
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={18}
                            fill="none"
                            stroke={config.color}
                            strokeWidth="1"
                            opacity="0.3"
                        />
                    </>
                )}

                {/* Heading line */}
                <line x1={pos.x} y1={pos.y} x2={headingX} y2={headingY}
                      stroke={config.color} strokeWidth="2" />

                {/* Asset symbol - MIL-STD-2525 symbology based on domain */}
                {asset.domain === 'air' ? (
                    // AIR DOMAIN - Top half only
                    config.shape === 'circle' ? (
                        // Friendly: Top half of circle (arc)
                        <path
                            d={`M ${pos.x - size} ${pos.y} A ${size} ${size} 0 0 1 ${pos.x + size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : config.shape === 'diamond' ? (
                        // Hostile: Top half of diamond (triangle without bottom line)
                        <path
                            d={`M ${pos.x - size} ${pos.y} L ${pos.x} ${pos.y - size} L ${pos.x + size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : config.shape === 'ownship' ? (
                        // Ownship: Circle with crosshair
                        <g>
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={size}
                                fill="none"
                                stroke={config.color}
                                strokeWidth={strokeWidth}
                            />
                            <line
                                x1={pos.x - size}
                                y1={pos.y}
                                x2={pos.x + size}
                                y2={pos.y}
                                stroke={config.color}
                                strokeWidth={strokeWidth}
                            />
                            <line
                                x1={pos.x}
                                y1={pos.y - size}
                                x2={pos.x}
                                y2={pos.y + size}
                                stroke={config.color}
                                strokeWidth={strokeWidth}
                            />
                        </g>
                    ) : (
                        // Neutral/Unknown/Unknown Unevaluated: Top half of square
                        <path
                            d={`M ${pos.x - size} ${pos.y} L ${pos.x - size} ${pos.y - size} L ${pos.x + size} ${pos.y - size} L ${pos.x + size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    )
                ) : asset.domain === 'surface' ? (
                    // SURFACE DOMAIN - Whole shape
                    config.shape === 'circle' ? (
                        // Friendly: Full circle
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={size}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : config.shape === 'diamond' ? (
                        // Hostile: Full diamond
                        <path
                            d={`M ${pos.x} ${pos.y - size} L ${pos.x + size} ${pos.y} L ${pos.x} ${pos.y + size} L ${pos.x - size} ${pos.y} Z`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : (
                        // Neutral/Unknown/Unknown Unevaluated: Full square
                        <rect
                            x={pos.x - size}
                            y={pos.y - size}
                            width={size * 2}
                            height={size * 2}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    )
                ) : (
                    // SUB-SURFACE DOMAIN - Bottom half only
                    config.shape === 'circle' ? (
                        // Friendly: Bottom half of circle (arc)
                        <path
                            d={`M ${pos.x + size} ${pos.y} A ${size} ${size} 0 0 1 ${pos.x - size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : config.shape === 'diamond' ? (
                        // Hostile: Bottom half of diamond (inverted triangle)
                        <path
                            d={`M ${pos.x - size} ${pos.y} L ${pos.x} ${pos.y + size} L ${pos.x + size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    ) : (
                        // Neutral/Unknown/Unknown Unevaluated: Bottom half of square
                        <path
                            d={`M ${pos.x - size} ${pos.y} L ${pos.x - size} ${pos.y + size} L ${pos.x + size} ${pos.y + size} L ${pos.x + size} ${pos.y}`}
                            fill="none"
                            stroke={config.color}
                            strokeWidth={strokeWidth}
                        />
                    )
                )}

                {/* Name label above */}
                <text x={pos.x} y={pos.y-size-5} fill={config.color} fontSize="10"
                      textAnchor="middle" fontWeight="700">
                    {asset.name}
                </text>

                {/* Labels below asset - dynamically positioned */}
                {(() => {
                    let currentY = pos.y + size + 15;
                    const lineSpacing = 12;
                    const labels = [];

                    // Track number
                    if (asset.trackNumber) {
                        labels.push(
                            <text key="tn" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                  textAnchor="middle" fontWeight="700">
                                TN#{asset.trackNumber}
                            </text>
                        );
                        currentY += lineSpacing;
                    }

                    // IFF Codes - only when squawking
                    if (asset.iffSquawking) {
                        if (asset.iffModeI) {
                            labels.push(
                                <text key="m1" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                      textAnchor="middle" fontWeight="700">
                                    M1: {asset.iffModeI}
                                </text>
                            );
                            currentY += lineSpacing;
                        }
                        if (asset.iffModeII) {
                            labels.push(
                                <text key="m2" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                      textAnchor="middle" fontWeight="700">
                                    M2: {asset.iffModeII}
                                </text>
                            );
                            currentY += lineSpacing;
                        }
                        if (asset.iffModeIII) {
                            labels.push(
                                <text key="m3" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                      textAnchor="middle" fontWeight="700">
                                    M3: {asset.iffModeIII}
                                </text>
                            );
                            currentY += lineSpacing;
                        }
                    }

                    // Altitude / Depth - always shown
                    if (asset.domain === 'air') {
                        labels.push(
                            <text key="alt" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                  textAnchor="middle" fontWeight="700">
                                ALT: FL{Math.round(asset.altitude/100)}
                            </text>
                        );
                    } else if (asset.domain === 'subSurface' && asset.depth !== null) {
                        labels.push(
                            <text key="depth" x={pos.x} y={currentY} fill={config.color} fontSize="10"
                                  textAnchor="middle" fontWeight="700">
                                DEPTH: {Math.round(asset.depth)}ft
                            </text>
                        );
                    }

                    return <g>{labels}</g>;
                })()}

                {/* Waypoints */}
                {asset.waypoints.map((wp, i) => {
                    const wpPos = latLonToScreen(wp.lat, wp.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    // Line from asset or previous waypoint
                    const prevPos = i === 0 ? pos : latLonToScreen(
                        asset.waypoints[i-1].lat,
                        asset.waypoints[i-1].lon,
                        mapCenter.lat, mapCenter.lon, scale, width, height
                    );

                    return (
                        <g key={i}>
                            <line x1={prevPos.x} y1={prevPos.y} x2={wpPos.x} y2={wpPos.y}
                                  stroke={config.color} strokeWidth="1" strokeDasharray="5,5" />
                            <g transform={`translate(${wpPos.x}, ${wpPos.y}) rotate(45)`}>
                                <line x1={-6} y1={0} x2={6} y2={0} stroke={config.color} strokeWidth="2" />
                                <line x1={0} y1={-6} x2={0} y2={6} stroke={config.color} strokeWidth="2" />
                            </g>
                            <text x={wpPos.x} y={wpPos.y-10} fill={config.color} fontSize="8"
                                  textAnchor="middle" fontWeight="700">
                                WP{i+1}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderSonobuoys = (width, height) => {
        if (sonobuoys.length === 0) return null;

        return (
            <g className="sonobuoys">
                {sonobuoys.map(sono => {
                    const pos = latLonToScreen(sono.lat, sono.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
                    const sonoColor = '#00BFFF'; // Friendly asset light blue color
                    const circleRadius = 9; // 1.5x larger (was 6)
                    const lineHeight = 18; // 1.5x larger (was 12)
                    const horizontalLineLength = 9; // Length of horizontal line at top

                    return (
                        <g key={`sono-${sono.id}`}>
                            {/* Vertical line extending upward from circle */}
                            <line
                                x1={pos.x}
                                y1={pos.y - circleRadius}
                                x2={pos.x}
                                y2={pos.y - circleRadius - lineHeight}
                                stroke={sonoColor}
                                strokeWidth={2}
                            />
                            {/* Horizontal line extending to the right from top of vertical line */}
                            <line
                                x1={pos.x}
                                y1={pos.y - circleRadius - lineHeight}
                                x2={pos.x + horizontalLineLength}
                                y2={pos.y - circleRadius - lineHeight}
                                stroke={sonoColor}
                                strokeWidth={2}
                            />
                            {/* Circle */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r={circleRadius}
                                fill="none"
                                stroke={sonoColor}
                                strokeWidth={2}
                            />
                            {/* Label */}
                            <text
                                x={pos.x}
                                y={pos.y - circleRadius - lineHeight - 4}
                                fill={sonoColor}
                                fontSize="8"
                                textAnchor="middle"
                                fontWeight="bold"
                            >
                                S{sono.id.toString().padStart(2, '0')}
                            </text>
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderSonobuoyDetections = (width, height) => {
        if (sonoDetections.length === 0) return null;

        return (
            <g className="sonobuoy-detections">
                {sonoDetections.map(detection => {
                    const sonoPos = latLonToScreen(detection.sonoLat, detection.sonoLon, mapCenter.lat, mapCenter.lon, scale, width, height);
                    const bearingRad = (detection.bearing - 90) * Math.PI / 180;

                    // Calculate line to screen edge
                    const cos = Math.cos(bearingRad);
                    const sin = Math.sin(bearingRad);
                    let tMin = Infinity;

                    if (cos > 0) tMin = Math.min(tMin, (width - sonoPos.x) / cos);
                    if (cos < 0) tMin = Math.min(tMin, -sonoPos.x / cos);
                    if (sin > 0) tMin = Math.min(tMin, (height - sonoPos.y) / sin);
                    if (sin < 0) tMin = Math.min(tMin, -sonoPos.y / sin);

                    const endX = sonoPos.x + tMin * cos;
                    const endY = sonoPos.y + tMin * sin;

                    return (
                        <g key={detection.id}>
                            <line x1={sonoPos.x} y1={sonoPos.y} x2={endX} y2={endY} stroke="#FF0000" strokeWidth={2} opacity={0.8} />
                        </g>
                    );
                })}
            </g>
        );
    };

    const renderWeapons = (width, height) => {
        if (weapons.length === 0) return null;

        return (
            <g className="weapons">
                {weapons.map(wpn => {
                    const pos = latLonToScreen(wpn.lat, wpn.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
                    const color = wpn.affiliation === 'friendly' ? '#00BFFF' : '#FF0000';
                    const headingRad = (wpn.heading - 90) * Math.PI / 180;

                    // Direction of travel indicator line (solid)
                    const lineLength = 30; // Same as air track heading line
                    const lineEndX = pos.x + lineLength * Math.cos(headingRad);
                    const lineEndY = pos.y + lineLength * Math.sin(headingRad);

                    // Determine weapon symbol type
                    const configKey = wpn.weaponName || wpn.weaponType;
                    const config = weaponConfigs[configKey];
                    const isTorpedo = config && config.type === 'Torpedo';

                    if (wpn.affiliation === 'friendly') {
                        // Scale factor to match air track size (12)
                        const symbolScale = 0.114; // Adjusted to make symbol size = 12

                        let svgPath;
                        if (isTorpedo) {
                            // Friendly torpedo SVG path
                            svgPath = "m 11.301968,183.90024 c -5.3e-4,-23.91753 0.061,-28.57252 0.41352,-31.35312 1.99502,-15.73583 9.30443,-31.67588 20.36361,-44.40813 2.66402,-3.06703 8.5419,-8.822942 11.23697,-11.003786 12.91775,-10.453023 26.9367,-17.032038 42.73021,-20.053061 17.499182,-3.347289 35.133772,-1.86418 51.990622,4.37253 4.76869,1.764324 12.75667,5.737913 17.38851,8.649856 21.31161,13.398151 36.32717,34.799871 40.68364,57.986551 1.09662,5.83662 1.18385,8.53985 1.18927,36.85971 l 0.005,27.20243 -3.63803,-0.0826 -3.63802,-0.0826 -0.14366,-29.10417 c -0.13975,-28.37376 -0.15769,-29.1806 -0.71403,-32.14694 C 186.23395,135.08427 178.82853,120.87506 167.54074,109.2363 155.26815,96.582143 139.19217,87.692953 122.28845,84.214116 115.0797,82.730534 113.65203,82.605807 104.038,82.6197 c -8.519012,0.0123 -9.215772,0.05062 -13.144992,0.722828 -10.456,1.78879 -17.75215,4.15435 -26.49246,8.589388 -12.06125,6.120164 -22.9434,15.311874 -30.77767,25.996664 -6.21467,8.47587 -10.92082,18.52008 -13.19303,28.15752 -1.62733,6.90221 -1.54462,5.11703 -1.70496,36.79768 l -0.14731,29.10417 h -3.63754 -3.63754 z m 37.49111,-6.38444 c -2.00812,-3.01396 -5.12383,-7.6381 -6.9238,-10.27586 l -3.27268,-4.79592 2.97474,-4.46449 c 1.63611,-2.45548 4.7322,-7.17317 6.8802,-10.48377 l 3.90546,-6.01927 h 46.79701 46.797012 l 1.53304,2.38858 c 0.84318,1.31372 3.182,4.90617 5.19738,7.98321 l 3.66434,5.59463 1.60578,-2.4931 c 2.66867,-4.14332 6.83175,-10.84543 6.98531,-11.24558 0.11229,-0.29267 0.78081,-0.37565 3.02625,-0.37565 h 2.88211 v 19.04999 19.05 h -2.78596 -2.78595 l -1.74527,-2.71198 c -4.7394,-7.36453 -7.31421,-11.31093 -7.37977,-11.31093 -0.0398,0 -0.76488,1.10133 -1.61123,2.44739 -0.84636,1.34607 -2.8972,4.53099 -4.55742,7.07761 -1.66023,2.54661 -3.21082,4.95687 -3.44577,5.35614 l -0.42717,0.72593 -46.831252,-0.008 -46.83125,-0.008 -3.65111,-5.47993 z m 98.028462,-6.869 c 2.38508,-3.60164 4.59387,-6.97101 4.90843,-7.4875 l 0.57192,-0.93906 -4.92133,-7.46146 -4.92132,-7.46145 H 99.136088 55.812938 l -1.58237,2.44739 c -0.8703,1.34607 -3.09032,4.74713 -4.93339,7.55791 l -3.35102,5.1105 2.05839,3.02223 c 1.13212,1.66222 3.36808,4.97895 4.96881,7.3705 l 2.91042,4.34828 43.30062,0.0206 43.300632,0.0205 z m 17.87991,-11.49375 -0.0739,-3.52135 -0.8976,1.32292 c -0.49369,0.7276 -1.47799,2.24761 -2.18736,3.37779 -1.50598,2.39939 -1.60891,1.8983 1.30175,6.33778 l 1.78321,2.71984 0.0739,-3.35782 c 0.0407,-1.8468 0.0407,-4.94242 0,-6.87916 z";
                        } else {
                            // Friendly missile SVG path
                            svgPath = "m 80.319942,250.63642 c 0,-0.29758 -1.736934,-16.13445 -2.500884,-22.80233 -0.516284,-4.50623 -0.9387,-8.52238 -0.9387,-8.92479 0,-0.54017 1.015588,-2.0313 3.880493,-5.69749 2.134272,-2.73121 4.383892,-5.56114 4.999162,-6.28875 l 1.11867,-1.32291 0.29265,-10.58333 c 0.16096,-5.82084 0.40894,-16.71506 0.55107,-24.20938 0.14212,-7.49432 0.31953,-16.30495 0.39422,-19.57916 0.0747,-3.27422 0.19834,-9.04875 0.27475,-12.8323 0.0764,-3.78354 0.26784,-12.11044 0.4254,-18.50422 l 0.28648,-11.62505 4.688784,-8.0864 c 2.57882,-4.447533 5.73412,-9.902413 7.011763,-12.12196 1.27763,-2.219556 2.4182,-4.094404 2.53458,-4.166333 0.11638,-0.07193 0.96037,1.029697 1.87554,2.448054 0.91516,1.418359 4.31482,6.654706 7.55481,11.636336 l 5.89088,9.057503 0.26915,28.77791 c 0.14803,15.82785 0.34962,38.38049 0.44798,50.11697 l 0.17882,21.33905 5.2794,4.96857 5.27939,4.96856 -0.16893,3.06113 c -0.1747,3.16565 -0.45554,9.68834 -0.95769,22.24342 -0.16005,4.00182 -0.37086,7.48192 -0.46846,7.73354 -0.1764,0.45478 -2.29873,-1.51028 -16.18474,-14.98539 -1.96453,-1.90641 -4.54898,-4.404 -5.74322,-5.55023 l -2.17135,-2.08403 -7.353183,7.11233 c -4.04425,3.91178 -9.388264,9.10662 -11.875564,11.54409 -3.941846,3.86288 -4.871271,4.6941 -4.871271,4.35659 z m 15.201175,-25.72169 c 4.749683,-4.51114 8.750943,-8.2423 8.891703,-8.29146 0.14075,-0.0492 3.14014,2.68927 6.6653,6.08541 8.89398,8.56847 10.13947,9.74668 10.30332,9.74668 0.0788,0 0.22353,-2.35149 0.3216,-5.22553 0.0981,-2.87403 0.23025,-5.52317 0.29373,-5.88697 0.10004,-0.57325 -0.5853,-1.31336 -5.13888,-5.54963 l -5.25432,-4.88816 -0.17735,-19.98267 c -0.0976,-10.99047 -0.28895,-31.71032 -0.42535,-46.04412 -0.1364,-14.33381 -0.24931,-28.21543 -0.25092,-30.84807 l -0.003,-4.78661 -3.46379,-5.46599 c -1.90509,-3.0063 -3.5422,-5.461923 -3.63803,-5.456933 -0.0958,0.005 -1.67455,2.535073 -3.50827,5.622403 l -3.334063,5.61332 -0.17631,9.78959 c -0.44316,24.60572 -1.27844,65.72421 -1.66479,81.95283 l -0.17476,7.34035 -3.15146,3.90444 c -1.7333,2.14745 -3.898704,4.85695 -4.811994,6.02112 l -1.66052,2.11667 0.60937,5.95312 c 0.33515,3.27422 0.61468,6.11188 0.62116,6.3059 0.006,0.19403 0.11978,0.3131 0.25178,0.26459 0.13199,-0.0485 4.126094,-3.77913 8.875764,-8.29028 z m 84.546743,-63.44711 c 0,-15.85722 -0.11042,-27.96995 -0.27435,-30.09635 C 178.86818,119.36869 174.54175,106.8975 167.77393,96.724107 162.39297,88.63546 154.45671,80.717737 146.65058,75.650106 136.51824,69.07234 126.54549,65.307407 114.35494,63.457792 109.76283,62.761054 98.091167,62.840485 93.152237,63.602085 79.181955,65.756349 66.68491,71.229623 55.945709,79.897258 52.260695,82.871439 46.378638,88.96165 43.474468,92.809817 36.886277,101.53951 32.304006,111.46376 30.011429,121.96796 c -1.40471,6.43616 -1.374275,5.6964 -1.478735,35.94104 l -0.09755,28.24427 h -3.690929 -3.690932 l -0.0074,-2.57968 c -0.0041,-1.41883 -0.04714,-11.80703 -0.09568,-23.0849 -0.127434,-29.61125 0.127167,-34.09657 2.450671,-43.17362 2.378866,-9.29332 6.82162,-18.806923 12.445809,-26.651133 5.373487,-7.494601 12.7502,-14.689751 20.660757,-20.152272 17.567375,-12.130891 40.376717,-17.173122 61.5417,-13.604398 16.65612,2.808465 31.79934,10.355855 43.96158,21.910489 14.96652,14.218811 23.59917,31.995844 25.19211,51.877594 0.16397,2.04655 0.27336,14.19589 0.27336,30.36093 v 26.94908 h -3.70416 -3.70417 z";
                        }

                        return (
                            <g key={`weapon-${wpn.id}`}>
                                {/* Direction of travel line (solid) */}
                                <line
                                    x1={pos.x}
                                    y1={pos.y}
                                    x2={lineEndX}
                                    y2={lineEndY}
                                    stroke={color}
                                    strokeWidth={2}
                                />

                                {/* Weapon symbol from SVG */}
                                <path
                                    d={svgPath}
                                    fill={color}
                                    fillOpacity={1}
                                    transform={`translate(${pos.x}, ${pos.y}) scale(${symbolScale}) translate(-105, -150)`}
                                />
                            </g>
                        );
                    } else {
                        // Hostile weapon: use hostile missile SVG
                        const symbolScale = 0.114; // Same scale as friendly to match size = 12
                        const hostileSvgPath = "m 93.421108,236.66603 c -1.6247,-11.61773 -3.41622,-24.52041 -3.70161,-26.65915 l -0.36522,-2.73702 0.68945,-0.81475 c 0.3792,-0.44811 2.56128,-3.14551 4.84906,-5.99423 l 4.1596,-5.17949 0.008,-3.96875 c 0.005,-2.18281 0.1817,-11.52921 0.39344,-20.76979 0.21175,-9.24057 0.50916,-23.05182 0.660912,-30.69166 0.15176,-7.63985 0.33243,-15.60154 0.40149,-17.69265 l 0.12555,-3.80202 1.8253,-3.07715 c 2.50611,-4.22488 10.50522,-18.272 10.90655,-19.152807 0.32179,-0.70625 0.35356,-0.66925 2.16392,2.520067 2.41668,4.25748 8.07682,13.95299 10.01015,17.14686 l 1.53324,2.53292 0.53984,19.82437 c 0.54995,20.19548 0.86619,31.43407 1.36133,48.37886 0.15276,5.22748 0.38924,9.71285 0.52553,9.96751 0.13628,0.25465 0.51643,0.68665 0.84477,0.96 0.32835,0.27336 2.53911,2.46742 4.9128,4.8757 l 4.31582,4.37869 -1.22493,11.48284 c -0.67372,6.31556 -1.42521,13.18836 -1.66999,15.27288 l -0.44505,3.79004 -10.84791,-10.59351 -10.84792,-10.59351 -2.78783,2.83472 c -2.57188,2.61515 -12.811472,13.26599 -16.566502,17.23187 l -1.60691,1.69714 -0.16334,-1.16798 z m 13.451662,-23.92129 7.40833,-7.75458 7.85947,7.83208 c 5.06036,5.04273 7.90194,7.69556 7.97871,7.44874 0.0656,-0.21083 0.31221,-2.28834 0.54804,-4.61667 0.23584,-2.32833 0.49458,-4.71185 0.57498,-5.2967 0.14456,-1.05158 0.11925,-1.0897 -2.2835,-3.43958 -1.33632,-1.30692 -3.46474,-3.50813 -4.72982,-4.89158 l -2.30014,-2.51536 -0.46446,-20.90027 c -0.25545,-11.49514 -0.57243,-24.82932 -0.7044,-29.63151 -0.13197,-4.80219 -0.32183,-13.36557 -0.42189,-19.02974 l -0.18195,-10.2985 -1.00877,-1.74004 c -0.55482,-0.95703 -1.93624,-3.37456 -3.06981,-5.37229 -1.13357,-1.99773 -2.14139,-3.63484 -2.2396,-3.63802 -0.0982,-0.003 -0.79981,1.09555 -1.55914,2.44161 -0.75932,1.34607 -2.12415,3.75709 -3.03294,5.35782 l -1.65236,2.91041 -0.17308,10.31875 c -0.2832,16.88441 -0.64138,36.57292 -0.96747,53.18125 l -0.3065,15.61042 -0.82234,1.05833 c -0.45229,0.58208 -2.39847,2.98231 -4.32484,5.33383 l -3.502502,4.27549 0.65832,4.98492 c 0.74331,5.62853 0.84438,6.18561 1.11593,6.15066 0.10637,-0.0137 3.527152,-3.51445 7.601732,-7.77947 z M 40.859228,157.4562 c 0,-30.15835 0.0334,-32.64889 0.44209,-32.9846 0.51301,-0.42137 8.99644,-9.52769 27.07458,-29.062477 7.05776,-7.626446 16.16604,-17.45176 20.24062,-21.834035 4.07459,-4.382275 10.26583,-11.049304 13.758332,-14.815616 10.16582,-10.962822 11.56005,-12.438485 11.7521,-12.438485 0.34853,0 36.05794,38.06357 59.58149,63.509423 2.4167,2.61419 6.55412,7.06761 9.19427,9.89648 l 4.80026,5.14341 v 32.60547 32.60547 l -1.78593,-0.50167 c -0.98227,-0.27592 -2.8575,-0.78446 -4.16719,-1.13009 l -2.38125,-0.62842 -0.0673,-29.84569 -0.0673,-29.8457 -1.12334,-1.21964 c -1.57488,-1.7099 -13.53295,-14.58011 -20.17334,-21.71213 -3.05594,-3.28219 -10.25922,-11.021997 -16.00729,-17.199574 -13.67552,-14.697381 -27.5661,-29.487906 -27.77854,-29.578272 -0.0928,-0.03947 -1.70894,1.625685 -3.59144,3.700346 -1.8825,2.074659 -4.43476,4.847791 -5.67169,6.162513 -1.23692,1.314723 -4.987392,5.362686 -8.334372,8.995471 -7.46324,8.100543 -14.41222,15.614019 -22.75416,24.602566 -6.59291,7.10394 -11.46667,12.3914 -16.22051,17.59732 -1.52816,1.67349 -4.01034,4.3664 -5.51596,5.98424 l -2.73749,2.94152 v 29.67667 c 0,24.17431 -0.0641,29.70126 -0.34551,29.80926 -0.19003,0.0729 -2.09503,0.59499 -4.23333,1.16015 l -3.88783,1.02756 z";

                        return (
                            <g key={`weapon-${wpn.id}`}>
                                {/* Direction of travel line (solid) */}
                                <line
                                    x1={pos.x}
                                    y1={pos.y}
                                    x2={lineEndX}
                                    y2={lineEndY}
                                    stroke={color}
                                    strokeWidth={2}
                                />

                                {/* Hostile weapon symbol from SVG */}
                                <path
                                    d={hostileSvgPath}
                                    fill={color}
                                    fillOpacity={1}
                                    transform={`translate(${pos.x}, ${pos.y}) scale(${symbolScale}) translate(-105, -150)`}
                                />
                            </g>
                        );
                    }
                })}
            </g>
        );
    };

    const renderGeoPoint = (geoPoint, width, height) => {
        const pos = latLonToScreen(geoPoint.lat, geoPoint.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
        const isSelected = geoPoint.id === selectedGeoPointId;
        const config = GEOPOINT_TYPES[geoPoint.type];
        const identityColor = ASSET_TYPES[geoPoint.identity]?.color || '#FFFF00';

        return (
            <g key={geoPoint.id}>
                {/* Selection ring for selected geo-point */}
                {isSelected && (
                    <>
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={18}
                            fill="none"
                            stroke={identityColor}
                            strokeWidth="1.5"
                            opacity="0.4"
                        />
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={16}
                            fill="none"
                            stroke={identityColor}
                            strokeWidth="2"
                            strokeDasharray="4,3"
                            opacity="0.9"
                        >
                            <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 ${pos.x} ${pos.y}`}
                                to={`360 ${pos.x} ${pos.y}`}
                                dur="4s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </>
                )}

                {/* Geo-point icon */}
                {config.icon === 'crosshair' ? (
                    // CAP Station: Crosshair symbol (circle with cross)
                    <g>
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={8}
                            fill="none"
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x - 12}
                            y1={pos.y}
                            x2={pos.x + 12}
                            y2={pos.y}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x}
                            y1={pos.y - 12}
                            x2={pos.x}
                            y2={pos.y + 12}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                    </g>
                ) : config.icon === 'airfield' ? (
                    // Airfield: Two parallel diagonal lines with horizontal line
                    <g>
                        <line
                            x1={pos.x - 10}
                            y1={pos.y + 8}
                            x2={pos.x + 2}
                            y2={pos.y - 8}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x - 2}
                            y1={pos.y + 8}
                            x2={pos.x + 10}
                            y2={pos.y - 8}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x - 10}
                            y1={pos.y}
                            x2={pos.x + 10}
                            y2={pos.y}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                    </g>
                ) : config.icon === 'samsite' ? (
                    // SAM Site: Right triangle (7 shape)
                    <g>
                        <line
                            x1={pos.x - 10}
                            y1={pos.y + 8}
                            x2={pos.x}
                            y2={pos.y - 8}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x - 10}
                            y1={pos.y + 8}
                            x2={pos.x + 8}
                            y2={pos.y + 8}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                    </g>
                ) : config.icon === 'mark' ? (
                    // Mark: Rectangle with dot in center
                    <g>
                        <rect
                            x={pos.x - 10}
                            y={pos.y - 6}
                            width="20"
                            height="12"
                            fill="none"
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={2}
                            fill={identityColor}
                        />
                        <line
                            x1={pos.x - 10}
                            y1={pos.y - 6}
                            x2={pos.x - 10}
                            y2={pos.y - 10}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x + 10}
                            y1={pos.y - 6}
                            x2={pos.x + 10}
                            y2={pos.y - 10}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x - 10}
                            y1={pos.y + 6}
                            x2={pos.x - 10}
                            y2={pos.y + 10}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                        <line
                            x1={pos.x + 10}
                            y1={pos.y + 6}
                            x2={pos.x + 10}
                            y2={pos.y + 10}
                            stroke={identityColor}
                            strokeWidth="2"
                        />
                    </g>
                ) : (
                    // Fallback: Text icon (shouldn't happen)
                    <text
                        x={pos.x}
                        y={pos.y + 5}
                        fill={identityColor}
                        fontSize="16"
                        textAnchor="middle"
                        fontWeight="700"
                    >
                        {config.icon}
                    </text>
                )}

                {/* Name label below */}
                <text
                    x={pos.x}
                    y={pos.y + 25}
                    fill={identityColor}
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight="700"
                >
                    {geoPoint.name}
                </text>
            </g>
        );
    };

    const renderShape = (shape, width, height) => {
        const identityColor = ASSET_TYPES[shape.identity]?.color || '#FFFF00';
        const isSelected = shape.id === selectedShapeId;

        if (shape.type === 'circle') {
            const centerPos = latLonToScreen(shape.centerLat, shape.centerLon, mapCenter.lat, mapCenter.lon, scale, width, height);
            const radiusInPixels = (shape.radius / scale) * Math.min(width, height);

            return (
                <g key={`shape-${shape.id}`}>
                    {/* Selection ring */}
                    {isSelected && (
                        <>
                            <circle
                                cx={centerPos.x}
                                cy={centerPos.y}
                                r={radiusInPixels + 10}
                                fill="none"
                                stroke={identityColor}
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                opacity="0.5"
                            >
                                <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
                            </circle>
                        </>
                    )}
                    {/* Circle */}
                    <circle
                        cx={centerPos.x}
                        cy={centerPos.y}
                        r={radiusInPixels}
                        fill="none"
                        stroke={identityColor}
                        strokeWidth="2"
                        opacity="0.8"
                    />
                </g>
            );
        } else if (shape.type === 'lineSegment') {
            const points = shape.points.map(p => latLonToScreen(p.lat, p.lon, mapCenter.lat, mapCenter.lon, scale, width, height));
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
                <g key={`shape-${shape.id}`}>
                    {/* Line segments */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke={identityColor}
                        strokeWidth="2"
                        opacity="0.8"
                    />
                    {/* Point markers and labels */}
                    {points.map((p, i) => (
                        <g key={i}>
                            {/* Larger invisible hit area for easier clicking */}
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r="10"
                                fill="transparent"
                                style={{ cursor: isSelected ? 'move' : 'pointer' }}
                            />
                            {/* Visible marker */}
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={isSelected ? "6" : "4"}
                                fill={identityColor}
                                opacity="0.9"
                                stroke={isSelected ? "#FFFFFF" : "none"}
                                strokeWidth={isSelected ? "1" : "0"}
                                style={{ cursor: isSelected ? 'move' : 'pointer' }}
                            />
                            {/* Point name label */}
                            {shape.points[i].name && (
                                <text
                                    x={p.x}
                                    y={p.y - 12}
                                    fill={identityColor}
                                    fontSize="10"
                                    fontFamily="Orbitron, monospace"
                                    textAnchor="middle"
                                    opacity="0.9"
                                    style={{ textShadow: `0 0 4px ${identityColor}` }}
                                >
                                    {shape.points[i].name}
                                </text>
                            )}
                        </g>
                    ))}
                    {/* Selection highlight */}
                    {isSelected && (
                        <path
                            d={pathData}
                            fill="none"
                            stroke={identityColor}
                            strokeWidth="4"
                            opacity="0.3"
                            strokeDasharray="5,5"
                        >
                            <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
                        </path>
                    )}
                </g>
            );
        }
        return null;
    };

    // ========================================================================
    // COMPONENT RENDER
    // ========================================================================

    return (
        <div className="app-container">
            {/* Radar Display */}
            <div className="radar-container">
                {/* Top HUD */}
                <div className="top-hud">
                    <button
                        className={`record-button ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? `● REC ${Math.floor(recordingTime/60)}:${(recordingTime%60).toString().padStart(2,'0')}` : '○ RECORD'}
                    </button>

                    <div className="status-group">
                        <div className={`status-indicator ${isRunning ? 'running' : 'paused'}`}>
                            {isRunning ? '● RUNNING' : '○ PAUSED'}
                        </div>
                        <div className="status-indicator">
                            SCALE: {scale} NM
                        </div>
                        <div className="status-indicator">
                            MISSION TIME: {Math.floor(missionTime / 3600).toString().padStart(2, '0')}:{Math.floor((missionTime % 3600) / 60).toString().padStart(2, '0')}:{(missionTime % 60).toString().padStart(2, '0')}
                        </div>
                    </div>
                </div>

                {/* SVG Radar */}
                <svg
                    ref={svgRef}
                    className="radar-svg"
                    onClick={handleSVGClick}
                    onContextMenu={handleSVGRightClick}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                >
                    {svgRef.current && (
                        <>
                            {renderGrid(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderCoastline(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderIslands(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderCities(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderCompass(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderBullseye(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderTempMark(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderRadarSweep(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderRadarReturns(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderIFFReturns(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderSonobuoys(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderSonobuoyDetections(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderWeapons(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {shapes.map(shape => renderShape(shape, svgRef.current.clientWidth, svgRef.current.clientHeight))}
                            {/* Render line segment being created */}
                            {creatingShape && creatingShape.type === 'lineSegment' && creatingShape.points.length > 0 && (() => {
                                const points = creatingShape.points.map(p => latLonToScreen(p.lat, p.lon, mapCenter.lat, mapCenter.lon, scale, svgRef.current.clientWidth, svgRef.current.clientHeight));
                                const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                return (
                                    <g key="creating-line">
                                        <path d={pathData} fill="none" stroke="#FFFF00" strokeWidth="2" strokeDasharray="5,5" opacity="0.8" />
                                        {points.map((p, i) => (
                                            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#FFFF00" opacity="0.8" />
                                        ))}
                                    </g>
                                );
                            })()}
                            {geoPoints.map(gp => renderGeoPoint(gp, svgRef.current.clientWidth, svgRef.current.clientHeight))}
                            {assets.map(asset => renderAsset(asset, svgRef.current.clientWidth, svgRef.current.clientHeight))}
                            {renderEsmLines(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderManualBearingLines(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                        </>
                    )}
                </svg>

                {/* Line Segment Creation Controls */}
                {creatingShape && creatingShape.type === 'lineSegment' && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(0, 20, 0, 0.9))',
                        border: '2px solid #00FF00',
                        borderRadius: '8px',
                        padding: '20px',
                        boxShadow: '0 0 40px rgba(0, 255, 0, 0.5), inset 0 0 20px rgba(0, 255, 0, 0.1)',
                        zIndex: 1000,
                        minWidth: '300px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            color: '#00FF00',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginBottom: '15px',
                            textShadow: '0 0 10px rgba(0, 255, 0, 0.7)'
                        }}>
                            CREATING LINE SEGMENT
                        </div>
                        <div style={{
                            color: '#00FF00',
                            fontSize: '12px',
                            marginBottom: '20px',
                            opacity: 0.8
                        }}>
                            Points: {creatingShape.points.length}
                            <br />
                            Click map to add points
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                className="control-btn primary"
                                onClick={finishLineSegment}
                                disabled={creatingShape.points.length < 2}
                                style={{ opacity: creatingShape.points.length < 2 ? 0.5 : 1 }}
                            >
                                APPLY
                            </button>
                            <button
                                className="control-btn danger"
                                onClick={cancelShapeCreation}
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                )}

                {/* Cursor Position Display */}
                {cursorPos && (
                    <div className="cursor-info">
                        <div className="position-box">
                            <div className="position-label">FROM {bullseyeName && bullseyeName.trim() ? bullseyeName.toUpperCase() : 'BULLSEYE'}</div>
                            <div className="position-value">
                                {Math.round(calculateBearing(bullseyePosition.lat, bullseyePosition.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/
                                {Math.round(calculateDistance(bullseyePosition.lat, bullseyePosition.lon, cursorPos.lat, cursorPos.lon))}
                            </div>
                        </div>

                        {(tempMark || selectedAsset || selectedGeoPointId) && (() => {
                            const selectedGeoPoint = geoPoints.find(gp => gp.id === selectedGeoPointId);
                            return (
                                <div className="position-box secondary">
                                    <div className="position-label">
                                        {selectedGeoPoint ?
                                            (selectedGeoPoint.name && selectedGeoPoint.name.trim() ? `FROM ${selectedGeoPoint.name.toUpperCase()}` : 'FROM GEO-POINT')
                                            : selectedAsset ?
                                                (selectedAsset.name && selectedAsset.name.trim() ? `FROM ${selectedAsset.name.toUpperCase()}` : 'FROM SELECTION')
                                                : 'FROM MARK'}
                                    </div>
                                    <div className="position-value">
                                        {selectedGeoPoint ?
                                            `${Math.round(calculateBearing(selectedGeoPoint.lat, selectedGeoPoint.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/${formatDistance(calculateDistance(selectedGeoPoint.lat, selectedGeoPoint.lon, cursorPos.lat, cursorPos.lon), scale)}${getDistanceUnit(scale)}` :
                                            selectedAsset ?
                                                `${Math.round(calculateBearing(selectedAsset.lat, selectedAsset.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/${formatDistance(calculateDistance(selectedAsset.lat, selectedAsset.lon, cursorPos.lat, cursorPos.lon), scale)}${getDistanceUnit(scale)}` :
                                                `${Math.round(calculateBearing(tempMark.lat, tempMark.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/${formatDistance(calculateDistance(tempMark.lat, tempMark.lon, cursorPos.lat, cursorPos.lon), scale)}${getDistanceUnit(scale)}`
                                        }
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Control Panel */}
            <ControlPanel
                isRunning={isRunning}
                setIsRunning={setIsRunning}
                assets={assets}
                selectedAsset={selectedAsset}
                setSelectedAssetId={setSelectedAssetId}
                updateAsset={updateAsset}
                deleteAsset={deleteAsset}
                reportTrack={reportTrack}
                setShowAddAssetDialog={setShowAddAssetDialog}
                setShowSaveDialog={setShowSaveDialog}
                setShowLoadDialog={setShowLoadDialog}
                setShowPauseMenu={setShowPauseMenu}
                centerMapOnAsset={centerMapOnAsset}
                restartSimulation={restartSimulation}
                hasStarted={hasStarted}
                bullseyeSelected={bullseyeSelected}
                bullseyeName={bullseyeName}
                setBullseyeName={setBullseyeName}
                bullseyePosition={bullseyePosition}
                setBullseyePosition={setBullseyePosition}
                bullseyeLatInput={bullseyeLatInput}
                setBullseyeLatInput={setBullseyeLatInput}
                bullseyeLonInput={bullseyeLonInput}
                setBullseyeLonInput={setBullseyeLonInput}
                radarControlsSelected={radarControlsSelected}
                setRadarControlsSelected={setRadarControlsSelected}
                radarEnabled={radarEnabled}
                setRadarEnabled={setRadarEnabled}
                radarSweepOpacity={radarSweepOpacity}
                setRadarSweepOpacity={setRadarSweepOpacity}
                radarReturnDecay={radarReturnDecay}
                setRadarReturnDecay={setRadarReturnDecay}
                radarReturnIntensity={radarReturnIntensity}
                setRadarReturnIntensity={setRadarReturnIntensity}
                esmControlsSelected={esmControlsSelected}
                setEsmControlsSelected={setEsmControlsSelected}
                esmEnabled={esmEnabled}
                setEsmEnabled={setEsmEnabled}
                detectedEmitters={detectedEmitters}
                setDetectedEmitters={setDetectedEmitters}
                selectedEsmId={selectedEsmId}
                setSelectedEsmId={setSelectedEsmId}
                iffControlsSelected={iffControlsSelected}
                setIffControlsSelected={setIffControlsSelected}
                iffEnabled={iffEnabled}
                setIffEnabled={setIffEnabled}
                iffOwnshipModeI={iffOwnshipModeI}
                setIffOwnshipModeI={setIffOwnshipModeI}
                iffOwnshipModeII={iffOwnshipModeII}
                setIffOwnshipModeII={setIffOwnshipModeII}
                iffOwnshipModeIII={iffOwnshipModeIII}
                setIffOwnshipModeIII={setIffOwnshipModeIII}
                iffOwnshipModeIV={iffOwnshipModeIV}
                setIffOwnshipModeIV={setIffOwnshipModeIV}
                iffReturnIntensity={iffReturnIntensity}
                setIffReturnIntensity={setIffReturnIntensity}
                geoPoints={geoPoints}
                selectedGeoPointId={selectedGeoPointId}
                updateGeoPoint={updateGeoPoint}
                deleteGeoPoint={deleteGeoPoint}
                shapes={shapes}
                selectedShapeId={selectedShapeId}
                updateShape={updateShape}
                deleteShape={deleteShape}
                platforms={platforms}
                missionTime={missionTime}
                manualBearingLines={manualBearingLines}
                setManualBearingLines={setManualBearingLines}
                nextManualLineSerialNumber={nextManualLineSerialNumber}
                setNextManualLineSerialNumber={setNextManualLineSerialNumber}
                datalinkControlsSelected={datalinkControlsSelected}
                setDatalinkControlsSelected={setDatalinkControlsSelected}
                datalinkEnabled={datalinkEnabled}
                setDatalinkEnabled={setDatalinkEnabled}
                datalinkNet={datalinkNet}
                setDatalinkNet={setDatalinkNet}
                datalinkJU={datalinkJU}
                setDatalinkJU={setDatalinkJU}
                datalinkTrackBlockStart={datalinkTrackBlockStart}
                setDatalinkTrackBlockStart={setDatalinkTrackBlockStart}
                datalinkTrackBlockEnd={datalinkTrackBlockEnd}
                setDatalinkTrackBlockEnd={setDatalinkTrackBlockEnd}
                nextDatalinkTrackNumber={nextDatalinkTrackNumber}
                setNextDatalinkTrackNumber={setNextDatalinkTrackNumber}
                selectedAssetTab={selectedAssetTab}
                setSelectedAssetTab={setSelectedAssetTab}
                selectedSystemTab={selectedSystemTab}
                setSelectedSystemTab={setSelectedSystemTab}
                eoirEnabled={eoirEnabled}
                setEoirEnabled={setEoirEnabled}
                eoirSelectedAssetId={eoirSelectedAssetId}
                setEoirSelectedAssetId={setEoirSelectedAssetId}
                isarEnabled={isarEnabled}
                setIsarEnabled={setIsarEnabled}
                isarSelectedAssetId={isarSelectedAssetId}
                setIsarSelectedAssetId={setIsarSelectedAssetId}
                sonoEnabled={sonoEnabled}
                setSonoEnabled={setSonoEnabled}
                sonoArmed={sonoArmed}
                setSonoArmed={setSonoArmed}
                sonoGuardOpen={sonoGuardOpen}
                setSonoGuardOpen={setSonoGuardOpen}
                sonobuoys={sonobuoys}
                setSonobuoys={setSonobuoys}
                sonobuoyCount={sonobuoyCount}
                setSonobuoyCount={setSonobuoyCount}
                nextSonobuoyId={nextSonobuoyId}
                setNextSonobuoyId={setNextSonobuoyId}
                sonoDetections={sonoDetections}
                weaponEnabled={weaponEnabled}
                setWeaponEnabled={setWeaponEnabled}
                weaponArmed={weaponArmed}
                setWeaponArmed={setWeaponArmed}
                weaponGuardOpen={weaponGuardOpen}
                setWeaponGuardOpen={setWeaponGuardOpen}
                weaponInventory={weaponInventory}
                weapons={weapons}
                fireWeapon={fireWeapon}
                selectedTargetAssetId={selectedTargetAssetId}
                setSelectedTargetAssetId={setSelectedTargetAssetId}
                selectedWeaponType={selectedWeaponType}
                setSelectedWeaponType={setSelectedWeaponType}
                weaponConfigs={weaponConfigs}
            />

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    contextMenu={contextMenu}
                    setContextMenu={setContextMenu}
                    selectedAsset={selectedAsset}
                    addAsset={addAsset}
                    addWaypoint={addWaypoint}
                    deleteWaypoint={deleteWaypoint}
                    addGeoPoint={addGeoPoint}
                    deleteGeoPoint={deleteGeoPoint}
                    startCreatingShape={startCreatingShape}
                    deleteShape={deleteShape}
                    platforms={platforms}
                    setShowPlatformDialog={setShowPlatformDialog}
                    deleteManualBearingLine={deleteManualBearingLine}
                    assets={assets}
                    weaponInventory={weaponInventory}
                    weaponConfigs={weaponConfigs}
                    fireWeapon={fireWeapon}
                    setSelectedTargetAssetId={setSelectedTargetAssetId}
                    setSelectedWeaponType={setSelectedWeaponType}
                />
            )}

            {/* EO/IR Popup Window */}
            {eoirEnabled && eoirSelectedAssetId && (() => {
                const asset = assets.find(a => a.id === eoirSelectedAssetId);
                if (!asset || !asset.platform || !asset.platform.image) return null;

                const handleMouseDown = (e) => {
                    if (e.target.closest('.eoir-header') && !e.target.closest('button')) {
                        setEoirDragging(true);
                        setEoirDragOffset({
                            x: e.clientX - eoirWindowPos.x,
                            y: e.clientY - eoirWindowPos.y
                        });
                    }
                };

                return (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${eoirWindowPos.x}px`,
                            top: `${eoirWindowPos.y}px`,
                            width: `${eoirWindowSize.width}px`,
                            minWidth: '300px',
                            minHeight: '200px',
                            background: '#1a1a1a',
                            border: '2px solid #00FF00',
                            borderRadius: '5px',
                            boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                            zIndex: 1000,
                            resize: 'both',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onMouseDown={(e) => {
                            // Update size when user resizes
                            const observer = new ResizeObserver((entries) => {
                                for (let entry of entries) {
                                    setEoirWindowSize({
                                        width: entry.contentRect.width,
                                        height: entry.contentRect.height
                                    });
                                }
                            });
                            observer.observe(e.currentTarget);
                        }}
                    >
                        {/* Header */}
                        <div
                            className="eoir-header"
                            onMouseDown={handleMouseDown}
                            style={{
                                background: '#00FF00',
                                color: '#000',
                                padding: '10px',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: eoirDragging ? 'grabbing' : 'grab',
                                userSelect: 'none'
                            }}
                        >
                            <span>EO/IR - {asset.name}</span>
                            <button
                                onClick={() => setEoirSelectedAssetId(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#000',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    padding: '0 5px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Image */}
                        <div style={{
                            padding: '10px',
                            background: '#0a0a0a',
                            flex: 1,
                            overflow: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {eoirImageErrors.has(asset.id) ? (
                                <div style={{ color: '#FF0000', textAlign: 'center', padding: '50px' }}>
                                    Image not found
                                </div>
                            ) : (
                                <img
                                    key={asset.id}
                                    src={`EO-IR/${asset.platform.image}`}
                                    alt={asset.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        display: 'block',
                                        border: '1px solid #00FF00',
                                        objectFit: 'contain'
                                    }}
                                    onError={() => {
                                        setEoirImageErrors(prev => new Set([...prev, asset.id]));
                                    }}
                                />
                            )}
                        </div>

                        {/* Footer Info */}
                        <div style={{
                            padding: '10px',
                            background: '#2a2a2a',
                            color: '#00FF00',
                            fontSize: '10px',
                            borderTop: '1px solid rgba(0, 255, 0, 0.3)',
                            flexShrink: 0
                        }}>
                            <div><strong>Platform:</strong> {asset.platform.name}</div>
                            <div><strong>Domain:</strong> {asset.domain.toUpperCase()}</div>
                        </div>
                    </div>
                );
            })()}

            {/* ISAR Popup Window */}
            {isarEnabled && isarSelectedAssetId && (() => {
                const asset = assets.find(a => a.id === isarSelectedAssetId);
                if (!asset || !asset.platform || !asset.platform.isar) return null;

                const handleMouseDown = (e) => {
                    if (e.target.closest('.isar-header') && !e.target.closest('button')) {
                        setIsarDragging(true);
                        setIsarDragOffset({
                            x: e.clientX - isarWindowPos.x,
                            y: e.clientY - isarWindowPos.y
                        });
                    }
                };

                return (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${isarWindowPos.x}px`,
                            top: `${isarWindowPos.y}px`,
                            width: `${isarWindowSize.width}px`,
                            minWidth: '300px',
                            minHeight: '200px',
                            background: '#1a1a1a',
                            border: '2px solid #00FF00',
                            borderRadius: '5px',
                            boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                            zIndex: 1000,
                            resize: 'both',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onMouseDown={(e) => {
                            // Update size when user resizes
                            const observer = new ResizeObserver((entries) => {
                                for (let entry of entries) {
                                    setIsarWindowSize({
                                        width: entry.contentRect.width,
                                        height: entry.contentRect.height
                                    });
                                }
                            });
                            observer.observe(e.currentTarget);
                        }}
                    >
                        {/* Header */}
                        <div
                            className="isar-header"
                            onMouseDown={handleMouseDown}
                            style={{
                                background: '#00FF00',
                                color: '#000',
                                padding: '10px',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: isarDragging ? 'grabbing' : 'grab',
                                userSelect: 'none'
                            }}
                        >
                            <span>ISAR - {asset.name}</span>
                            <button
                                onClick={() => setIsarSelectedAssetId(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#000',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    padding: '0 5px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Image */}
                        <div style={{
                            padding: '10px',
                            background: '#0a0a0a',
                            flex: 1,
                            overflow: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {isarImageErrors.has(asset.id) ? (
                                <div style={{ color: '#FF0000', textAlign: 'center', padding: '50px' }}>
                                    ISAR image not found
                                </div>
                            ) : (
                                <img
                                    key={asset.id}
                                    src={`ISAR/${asset.platform.isar}`}
                                    alt={asset.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        display: 'block',
                                        border: '1px solid #00FF00',
                                        objectFit: 'contain'
                                    }}
                                    onError={() => {
                                        setIsarImageErrors(prev => new Set([...prev, asset.id]));
                                    }}
                                />
                            )}
                        </div>

                        {/* Footer Info */}
                        <div style={{
                            padding: '10px',
                            background: '#2a2a2a',
                            color: '#00FF00',
                            fontSize: '10px',
                            borderTop: '1px solid rgba(0, 255, 0, 0.3)',
                            flexShrink: 0
                        }}>
                            <div><strong>Platform:</strong> {asset.platform.name}</div>
                            <div><strong>Domain:</strong> {asset.domain.toUpperCase()}</div>
                            <div><strong>Type:</strong> ISAR IMAGERY</div>
                        </div>
                    </div>
                );
            })()}

            {/* Add Asset Dialog */}
            {showAddAssetDialog && (
                <AddAssetDialog
                    initialData={showAddAssetDialog}
                    platforms={platforms}
                    onClose={() => setShowAddAssetDialog(null)}
                    onAdd={(data) => {
                        addAsset(data);
                        setShowAddAssetDialog(null);
                    }}
                />
            )}

            {/* Save Dialog */}
            {showSaveDialog && (
                <SaveDialog
                    onClose={() => setShowSaveDialog(false)}
                    saveToLocalStorage={saveToLocalStorage}
                    saveToFile={saveToFile}
                />
            )}

            {/* Load Dialog */}
            {showLoadDialog && (
                <LoadDialog
                    onClose={() => setShowLoadDialog(false)}
                    loadFromLocalStorage={loadFromLocalStorage}
                    loadFromFile={loadFromFile}
                    getSavedScenarios={getSavedScenarios}
                    deleteFromLocalStorage={deleteFromLocalStorage}
                />
            )}

            {/* Pause Menu */}
            {showPauseMenu && (
                <PauseMenu
                    onResume={() => {
                        setShowPauseMenu(false);
                        setIsRunning(true);
                    }}
                    onSave={() => {
                        setShowPauseMenu(false);
                        setShowSaveDialog(true);
                    }}
                    onLoad={() => {
                        setShowPauseMenu(false);
                        setShowLoadDialog(true);
                    }}
                    onControls={() => {
                        setShowPauseMenu(false);
                        setShowControlsDialog(true);
                    }}
                />
            )}

            {showControlsDialog && (
                <ControlsDialog onClose={() => setShowControlsDialog(false)} />
            )}

            {/* Platform Selection Dialog */}
            {showPlatformDialog && (
                <PlatformSelectionDialog
                    domain={showPlatformDialog.domain}
                    platforms={platforms}
                    onClose={() => setShowPlatformDialog(null)}
                    onSelect={(platform) => {
                        addAsset({
                            lat: showPlatformDialog.lat,
                            lon: showPlatformDialog.lon,
                            domain: showPlatformDialog.domain,
                            platform: platform
                        });
                        setShowPlatformDialog(null);
                    }}
                />
            )}

            {/* Range Warning Popup */}
            {showRangeWarning && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    padding: '20px 40px',
                    background: 'rgba(255, 0, 0, 0.9)',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderRadius: '10px',
                    border: '3px solid #FF0000',
                    boxShadow: '0 0 20px rgba(255, 0, 0, 0.8)',
                    zIndex: 10000
                }}>
                    OUTSIDE MAX RANGE
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CONTROL PANEL COMPONENT
// ============================================================================

function ControlPanel({
    isRunning, setIsRunning, assets, selectedAsset, setSelectedAssetId,
    updateAsset, deleteAsset, reportTrack, setShowAddAssetDialog,
    setShowSaveDialog, setShowLoadDialog, setShowPauseMenu, centerMapOnAsset,
    restartSimulation, hasStarted, bullseyeSelected, bullseyeName, setBullseyeName,
    bullseyePosition, setBullseyePosition, bullseyeLatInput, setBullseyeLatInput,
    bullseyeLonInput, setBullseyeLonInput,
    radarControlsSelected, setRadarControlsSelected,
    radarEnabled, setRadarEnabled, radarSweepOpacity, setRadarSweepOpacity,
    radarReturnDecay, setRadarReturnDecay, radarReturnIntensity, setRadarReturnIntensity,
    esmControlsSelected, setEsmControlsSelected,
    esmEnabled, setEsmEnabled, detectedEmitters, setDetectedEmitters,
    selectedEsmId, setSelectedEsmId,
    iffControlsSelected, setIffControlsSelected,
    iffEnabled, setIffEnabled,
    iffOwnshipModeI, setIffOwnshipModeI,
    iffOwnshipModeII, setIffOwnshipModeII,
    iffOwnshipModeIII, setIffOwnshipModeIII,
    iffOwnshipModeIV, setIffOwnshipModeIV,
    iffReturnIntensity, setIffReturnIntensity,
    geoPoints, selectedGeoPointId, updateGeoPoint, deleteGeoPoint,
    shapes, selectedShapeId, updateShape, deleteShape,
    platforms, missionTime,
    manualBearingLines, setManualBearingLines, nextManualLineSerialNumber, setNextManualLineSerialNumber,
    datalinkControlsSelected, setDatalinkControlsSelected,
    datalinkEnabled, setDatalinkEnabled,
    datalinkNet, setDatalinkNet,
    datalinkJU, setDatalinkJU,
    datalinkTrackBlockStart, setDatalinkTrackBlockStart,
    datalinkTrackBlockEnd, setDatalinkTrackBlockEnd,
    nextDatalinkTrackNumber, setNextDatalinkTrackNumber,
    selectedAssetTab, setSelectedAssetTab,
    selectedSystemTab, setSelectedSystemTab,
    eoirEnabled, setEoirEnabled,
    eoirSelectedAssetId, setEoirSelectedAssetId,
    isarEnabled, setIsarEnabled,
    isarSelectedAssetId, setIsarSelectedAssetId,
    sonoEnabled, setSonoEnabled,
    sonoArmed, setSonoArmed,
    sonoGuardOpen, setSonoGuardOpen,
    sonobuoys, setSonobuoys,
    sonobuoyCount, setSonobuoyCount,
    nextSonobuoyId, setNextSonobuoyId,
    sonoDetections,
    weaponEnabled, setWeaponEnabled,
    weaponArmed, setWeaponArmed,
    weaponGuardOpen, setWeaponGuardOpen,
    weaponInventory,
    weapons,
    fireWeapon,
    selectedTargetAssetId, setSelectedTargetAssetId,
    selectedWeaponType, setSelectedWeaponType,
    weaponConfigs
}) {
    const [editValues, setEditValues] = useState({});
    const [geoPointEditValues, setGeoPointEditValues] = useState({});
    const [shapePointEditValues, setShapePointEditValues] = useState({}); // Track editing values for shape points
    const selectedAssetIdRef = useRef(null);
    const selectedGeoPointIdRef = useRef(null);

    // Only update edit values when asset is first selected or when switching assets
    useEffect(() => {
        if (selectedAsset && selectedAsset.id !== selectedAssetIdRef.current) {
            selectedAssetIdRef.current = selectedAsset.id;
            setEditValues({
                name: selectedAsset.name,
                heading: Math.round(selectedAsset.heading),
                speed: Math.round(selectedAsset.speed),
                altitude: Math.round(selectedAsset.altitude),
                depth: Math.round(selectedAsset.depth || 0),
                lat: decimalToDMM(selectedAsset.lat, true),
                lon: decimalToDMM(selectedAsset.lon, false)
            });
        }
    }, [selectedAsset?.id]); // Only depend on ID, not the whole asset object

    // Update asset LAT/LONG display when asset position changes (e.g., during dragging)
    useEffect(() => {
        if (selectedAsset) {
            setEditValues(prev => ({
                ...prev,
                lat: decimalToDMM(selectedAsset.lat, true),
                lon: decimalToDMM(selectedAsset.lon, false)
            }));
        }
    }, [selectedAsset?.lat, selectedAsset?.lon]);

    // Update geo-point edit values when geo-point is first selected, when switching geo-points, or when position changes
    useEffect(() => {
        const selectedGeoPoint = geoPoints.find(gp => gp.id === selectedGeoPointId);
        if (selectedGeoPoint) {
            // Update if switching to a different geo-point OR if the same geo-point's position changed
            const isDifferentGeoPoint = selectedGeoPoint.id !== selectedGeoPointIdRef.current;
            if (isDifferentGeoPoint) {
                selectedGeoPointIdRef.current = selectedGeoPoint.id;
            }

            // Always update the display values to reflect current position
            setGeoPointEditValues({
                lat: decimalToDMM(selectedGeoPoint.lat, true),
                lon: decimalToDMM(selectedGeoPoint.lon, false)
            });
        }
    }, [selectedGeoPointId, geoPoints]);

    // Initialize shape point edit values when a shape is selected
    useEffect(() => {
        const selectedShape = shapes.find(s => s.id === selectedShapeId);
        if (selectedShape) {
            const initialValues = {};

            if (selectedShape.type === 'lineSegment') {
                // Initialize edit values for all line segment points
                selectedShape.points.forEach((point, index) => {
                    initialValues[`${index}_lat`] = decimalToDMM(point.lat, true);
                    initialValues[`${index}_lon`] = decimalToDMM(point.lon, false);
                });
            } else if (selectedShape.type === 'circle') {
                // Initialize edit values for circle center
                initialValues.centerLat = decimalToDMM(selectedShape.centerLat, true);
                initialValues.centerLon = decimalToDMM(selectedShape.centerLon, false);
            }

            setShapePointEditValues(initialValues);
        } else {
            // Clear edit values when no shape is selected
            setShapePointEditValues({});
        }
    }, [selectedShapeId, shapes]);

    const handleUpdate = (field, value) => {
        if (field === 'name') {
            updateAsset(selectedAsset.id, { name: value });
            setEditValues(prev => ({ ...prev, name: value }));
        } else if (field === 'type') {
            updateAsset(selectedAsset.id, { type: value });
        } else {
            // For heading, speed, altitude, depth - just update local state
            setEditValues(prev => ({ ...prev, [field]: value }));
        }
    };

    const applyTarget = (field) => {
        const targetField = `target${field.charAt(0).toUpperCase()}${field.slice(1)}`;
        const value = parseFloat(editValues[field]);

        // Validate the value
        if (isNaN(value)) {
            alert(`Invalid ${field} value`);
            return;
        }

        // Apply the target value
        updateAsset(selectedAsset.id, { [targetField]: value });

        console.log(`Setting ${targetField} to ${value} for asset ${selectedAsset.id}`);
    };

    const applyAssetCoordinate = (field) => {
        const isLatitude = field === 'lat';
        const value = dmmToDecimal(editValues[field]);

        // Validate the value
        if (value === null) {
            alert(`Invalid ${field} format. Use ${isLatitude ? 'N26 30.0 or S26 30.0' : 'E054 00.0 or W054 00.0'}`);
            return;
        }

        // Apply the coordinate change
        updateAsset(selectedAsset.id, { [field]: value });
    };

    const applyGeoPointCoordinate = (field) => {
        const isLatitude = field === 'lat';
        const value = dmmToDecimal(geoPointEditValues[field]);

        // Validate the value
        if (value === null) {
            alert(`Invalid ${field} format. Use ${isLatitude ? 'N26 30.0 or S26 30.0' : 'E054 00.0 or W054 00.0'}`);
            return;
        }

        // Apply the coordinate change
        updateGeoPoint(selectedGeoPointId, { [field]: value });
    };

    const applyShapePointCoordinate = (pointIndex, field) => {
        const key = `${pointIndex}_${field}`;
        const isLatitude = field === 'lat';
        const value = dmmToDecimal(shapePointEditValues[key]);

        // Validate the value
        if (value === null) {
            alert(`Invalid ${field} format. Use ${isLatitude ? 'N26 30.0 or S26 30.0' : 'E054 00.0 or W054 00.0'}`);
            return;
        }

        // Get the selected shape
        const selectedShape = shapes.find(s => s.id === selectedShapeId);
        if (!selectedShape || selectedShape.type !== 'lineSegment') return;

        // Update the specific point's coordinate
        const newPoints = [...selectedShape.points];
        newPoints[pointIndex] = { ...newPoints[pointIndex], [field]: value };
        updateShape(selectedShapeId, { points: newPoints });
    };

    const applyCircleCoordinate = (field) => {
        const isLatitude = field === 'centerLat';
        const value = dmmToDecimal(shapePointEditValues[field]);

        // Validate the value
        if (value === null) {
            alert(`Invalid ${field} format. Use ${isLatitude ? 'N26 30.0 or S26 30.0' : 'E054 00.0 or W054 00.0'}`);
            return;
        }

        // Get the selected shape
        const selectedShape = shapes.find(s => s.id === selectedShapeId);
        if (!selectedShape || selectedShape.type !== 'circle') return;

        // Update the circle's center coordinate
        const updateField = field === 'centerLat' ? 'centerLat' : 'centerLon';
        updateShape(selectedShapeId, { [updateField]: value });
    };

    return (
        <div className="control-panel">
            <h1>AIC SIMULATOR</h1>

            {/* Playback Controls */}
            <div className="control-section">
                <div className="section-header">PLAYBACK</div>
                <div className="playback-controls">
                    <button className="control-btn primary" onClick={() => setIsRunning(!isRunning)}>
                        {isRunning ? 'PAUSE' : 'PLAY'}
                    </button>
                    <button className="control-btn" onClick={restartSimulation}>
                        RESTART
                    </button>
                </div>
            </div>

            {/* File Management - Only show before simulation has started */}
            {!hasStarted && (
                <div className="control-section">
                    <div className="section-header">FILE</div>
                    <div className="playback-controls">
                        <button className="control-btn" onClick={() => setShowSaveDialog(true)}>
                            SAVE
                        </button>
                        <button className="control-btn" onClick={() => setShowLoadDialog(true)}>
                            LOAD
                        </button>
                    </div>
                </div>
            )}

            {/* Systems Controls - Hide when asset or geo-point is selected */}
            {!selectedAsset && !selectedGeoPointId && !selectedShapeId && (
                <div className="control-section">
                    <div className="section-header">SYSTEMS</div>

                    {/* System Tab Navigation */}
                    {/* First Row: RADAR, ESM, IFF, DATALINK */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', borderBottom: '1px solid rgba(0, 255, 0, 0.3)' }}>
                        <button
                            onClick={() => setSelectedSystemTab('radar')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'radar' ? (radarEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'radar' ? '#000' : (radarEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'radar' ? `2px solid ${radarEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            RADAR
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('esm')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'esm' ? (esmEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'esm' ? '#000' : (esmEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'esm' ? `2px solid ${esmEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            ESM
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('iff')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'iff' ? (iffEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'iff' ? '#000' : (iffEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'iff' ? `2px solid ${iffEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            IFF
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('datalink')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'datalink' ? (datalinkEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'datalink' ? '#000' : (datalinkEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'datalink' ? `2px solid ${datalinkEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            DATALINK
                        </button>
                    </div>

                    {/* Second Row: EO/IR, ISAR, SONO */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', borderBottom: '1px solid rgba(0, 255, 0, 0.3)' }}>
                        <button
                            onClick={() => setSelectedSystemTab('eoir')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'eoir' ? (eoirEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'eoir' ? '#000' : (eoirEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'eoir' ? `2px solid ${eoirEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            EO/IR
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('isar')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'isar' ? (isarEnabled ? '#00FF00' : '#FF0000') : 'transparent',
                                color: selectedSystemTab === 'isar' ? '#000' : (isarEnabled ? '#00FF00' : '#FF0000'),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'isar' ? `2px solid ${isarEnabled ? '#00FF00' : '#FF0000'}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            ISAR
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('sono')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'sono' ? getSonoTabColor(sonoEnabled, sonoArmed) : 'transparent',
                                color: selectedSystemTab === 'sono' ? '#000' : getSonoTabColor(sonoEnabled, sonoArmed),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'sono' ? `2px solid ${getSonoTabColor(sonoEnabled, sonoArmed)}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            SONO
                        </button>
                        <button
                            onClick={() => setSelectedSystemTab('weapon')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedSystemTab === 'weapon' ? getWeaponTabColor(weaponEnabled, weaponArmed) : 'transparent',
                                color: selectedSystemTab === 'weapon' ? '#000' : getWeaponTabColor(weaponEnabled, weaponArmed),
                                border: 'none',
                                borderBottom: selectedSystemTab === 'weapon' ? `2px solid ${getWeaponTabColor(weaponEnabled, weaponArmed)}` : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            WEAPON
                        </button>
                    </div>

                    {/* RADAR TAB */}
                    {selectedSystemTab === 'radar' && (
                        <div>
                            {/* Radar ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${radarEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setRadarEnabled(!radarEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {radarEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Radar Controls */}
                            <div className="input-group">
                                <label className="input-label">Sweep Opacity (%)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round(radarSweepOpacity * 100)}
                                    onChange={(e) => setRadarSweepOpacity(Number(e.target.value) / 100)}
                                    className="slider"
                                />
                                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '5px' }}>
                                    {Math.round(radarSweepOpacity * 100)}%
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Return Decay (sec)</label>
                                <input
                                    type="range"
                                    min="10"
                                    max="60"
                                    value={radarReturnDecay}
                                    onChange={(e) => setRadarReturnDecay(Number(e.target.value))}
                                    className="slider"
                                />
                                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '5px' }}>
                                    {radarReturnDecay}s
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Return Intensity (%)</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={radarReturnIntensity}
                                    onChange={(e) => setRadarReturnIntensity(Number(e.target.value))}
                                    className="slider"
                                />
                                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '5px' }}>
                                    {radarReturnIntensity}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ESM TAB */}
                    {selectedSystemTab === 'esm' && (
                        <div>
                            {/* ESM ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${esmEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setEsmEnabled(!esmEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {esmEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Bearing Line Button */}
                            <button
                                className="control-btn full-width"
                                onClick={() => {
                                    if (!selectedEsmId) {
                                        alert('Please select an emitter from the list first');
                                        return;
                                    }
                                    const selectedEmitter = detectedEmitters.find(e => e.id === selectedEsmId);
                                    if (!selectedEmitter) return;

                                    const ownship = assets.find(a => a.type === 'ownship');
                                    if (!ownship) return;

                                    // Create manual bearing line - snapshot of current ownship position and bearing
                                    const newLine = {
                                        id: `manual-${nextManualLineSerialNumber}`,
                                        bearing: selectedEmitter.bearing, // Fixed bearing at time of creation
                                        serialNumber: nextManualLineSerialNumber,
                                        ownshipLat: ownship.lat, // Store ownship position at time of creation
                                        ownshipLon: ownship.lon,
                                        emitterName: selectedEmitter.emitterName
                                    };
                                    setManualBearingLines(prev => [...prev, newLine]);
                                    setNextManualLineSerialNumber(prev => prev + 1);
                                }}
                                style={{ marginBottom: '15px' }}
                                disabled={!selectedEsmId}
                            >
                                BEARING LINE
                            </button>

                            {/* ESM Contacts List */}
                            <div style={{ marginBottom: '10px', fontSize: '10px', fontWeight: 'bold', opacity: 0.7 }}>
                                CONTACTS
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {detectedEmitters
                                    .filter(e => !e.isManualLine)
                                    .sort((a, b) => (a.threatLevel || 3) - (b.threatLevel || 3)) // Sort by threat level: 1 (enemy) first, then 2 (friendly), then 3 (civilian)
                                    .map((emitter) => {
                                    // Calculate age (time since last seen)
                                    const age = emitter.active ? 0 : (missionTime - (emitter.lastSeenTime || missionTime));
                                    const ageMinutes = Math.floor(age / 60);
                                    const ageSeconds = Math.floor(age % 60);
                                    const ageDisplay = `${ageMinutes.toString().padStart(2, '0')}+${ageSeconds.toString().padStart(2, '0')}`;

                                    return (
                                        <div
                                            key={emitter.id}
                                            onClick={() => setSelectedEsmId(emitter.id)}
                                            style={{
                                                padding: '8px',
                                                marginBottom: '5px',
                                                background: selectedEsmId === emitter.id ? '#00FF0033' : '#2a2a2a',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                border: selectedEsmId === emitter.id ? '1px solid #00FF00' : '1px solid transparent',
                                                opacity: emitter.active ? 1 : 0.6
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#FF8800' }}>
                                                        E{emitter.serialNumber.toString().padStart(2, '0')}
                                                    </div>
                                                    <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '500', marginTop: '2px' }}>
                                                        {emitter.emitterName}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '8px', opacity: 0.5 }}>AGE</div>
                                                        <div style={{
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            color: emitter.active ? '#00FF00' : '#FF0000'
                                                        }}>
                                                            {ageDisplay}
                                                        </div>
                                                    </div>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={emitter.visible !== false}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                setDetectedEmitters(prev =>
                                                                    prev.map(em =>
                                                                        em.id === emitter.id ? { ...em, visible: e.target.checked } : em
                                                                    )
                                                                );
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        VIS
                                                    </label>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '10px', opacity: 0.7 }}>
                                                BRG: {Math.round(emitter.bearing)}°
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Manual Bearing Lines */}
                            {manualBearingLines.length > 0 && (
                                <>
                                    <div style={{ marginTop: '15px', marginBottom: '10px', fontSize: '10px', fontWeight: 'bold', opacity: 0.7 }}>
                                        MANUAL LINES
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {manualBearingLines.map((line) => (
                                            <div
                                                key={line.id}
                                                onClick={() => setSelectedEsmId(line.id)}
                                                style={{
                                                    padding: '8px',
                                                    marginBottom: '5px',
                                                    background: selectedEsmId === line.id ? '#00BFFF33' : '#2a2a2a',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    border: selectedEsmId === line.id ? '1px solid #00BFFF' : '1px solid transparent'
                                                }}
                                            >
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#00CCFF', marginBottom: '3px' }}>
                                                    M{line.serialNumber.toString().padStart(2, '0')}
                                                </div>
                                                <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '500', marginBottom: '3px' }}>
                                                    {line.emitterName}
                                                </div>
                                                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                                                    BRG: {Math.round(line.bearing)}°
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* IFF TAB */}
                    {selectedSystemTab === 'iff' && (
                        <div>
                            {/* IFF ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${iffEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setIffEnabled(!iffEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {iffEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Ownship IFF Codes */}
                            <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '10px', opacity: 0.7 }}>
                                    OWNSHIP CODES
                                </div>

                                {/* MODE I */}
                                <div className="input-group" style={{ marginBottom: '10px' }}>
                                    <label className="input-label">MODE I (2 digit octal)</label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={iffOwnshipModeI}
                                        key={`mode1-${iffOwnshipModeI}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,2}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,2}$/.test(val)) {
                                                    const padded = val.padStart(2, '0');
                                                    setIffOwnshipModeI(padded);
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="00 (press Enter)"
                                        maxLength="2"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* MODE II */}
                                <div className="input-group" style={{ marginBottom: '10px' }}>
                                    <label className="input-label">MODE II (4 digit octal)</label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={iffOwnshipModeII}
                                        key={`mode2-${iffOwnshipModeII}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,4}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,4}$/.test(val)) {
                                                    const padded = val.padStart(4, '0');
                                                    setIffOwnshipModeII(padded);
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="0000 (press Enter)"
                                        maxLength="4"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* MODE III */}
                                <div className="input-group" style={{ marginBottom: '10px' }}>
                                    <label className="input-label">MODE III (4 digit octal)</label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={iffOwnshipModeIII}
                                        key={`mode3-${iffOwnshipModeIII}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,4}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,4}$/.test(val)) {
                                                    const padded = val.padStart(4, '0');
                                                    setIffOwnshipModeIII(padded);
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="0000 (press Enter)"
                                        maxLength="4"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* MODE IV */}
                                <div className="input-group">
                                    <label className="input-label">MODE IV</label>
                                    <button
                                        className={`control-btn ${iffOwnshipModeIV ? 'primary' : 'danger'}`}
                                        onClick={() => setIffOwnshipModeIV(!iffOwnshipModeIV)}
                                        style={{ width: '100%' }}
                                    >
                                        {iffOwnshipModeIV ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>

                            {/* IFF Return Intensity */}
                            <div className="input-group">
                                <label className="input-label">Return Intensity (%)</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={iffReturnIntensity}
                                    onChange={(e) => setIffReturnIntensity(Number(e.target.value))}
                                    className="slider"
                                />
                                <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '5px' }}>
                                    {iffReturnIntensity}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DATALINK TAB */}
                    {selectedSystemTab === 'datalink' && (
                        <div>
                            {/* Datalink ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${datalinkEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setDatalinkEnabled(!datalinkEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {datalinkEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Datalink Configuration */}
                            <div style={{ padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                                {/* NET */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        NET (1-127)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={datalinkNet}
                                        key={`net-${datalinkNet}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^\d{0,3}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                const num = parseInt(val);
                                                if (val !== '' && num >= 1 && num <= 127) {
                                                    setDatalinkNet(val);
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    setDatalinkNet('');
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="1 (press Enter)"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* JU Code */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        JU (5 digits)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={datalinkJU}
                                        key={`ju-${datalinkJU}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^\d{0,5}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^\d{1,5}$/.test(val)) {
                                                    setDatalinkJU(val.padStart(5, '0'));
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="00000 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* Track Block Start */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        TRACK BLOCK START (5 digits)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={datalinkTrackBlockStart}
                                        key={`start-${datalinkTrackBlockStart}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^\d{0,5}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^\d{1,5}$/.test(val)) {
                                                    setDatalinkTrackBlockStart(val);
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="60100 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>

                                {/* Track Block End */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        TRACK BLOCK END (5 digits)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={datalinkTrackBlockEnd}
                                        key={`end-${datalinkTrackBlockEnd}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^\d{0,5}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                const num = parseInt(val);
                                                const startNum = parseInt(datalinkTrackBlockStart);
                                                if (/^\d{1,5}$/.test(val) && num > startNum) {
                                                    setDatalinkTrackBlockEnd(val);
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    setDatalinkTrackBlockEnd('');
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="60200 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EO/IR TAB */}
                    {selectedSystemTab === 'eoir' && (
                        <div>
                            {/* EO/IR ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${eoirEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setEoirEnabled(!eoirEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {eoirEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* EO/IR Information */}
                            <div style={{ padding: '10px', background: '#2a2a2a', borderRadius: '3px', fontSize: '10px', opacity: 0.7 }}>
                                <p style={{ margin: '0 0 10px 0' }}>Select an asset on the map, then click the EO/IR button in the asset panel to view the optical/infrared image.</p>
                                <p style={{ margin: 0 }}>System must be powered ON to view images.</p>
                            </div>
                        </div>
                    )}

                    {/* ISAR TAB */}
                    {selectedSystemTab === 'isar' && (
                        <div>
                            {/* ISAR ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${isarEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setIsarEnabled(!isarEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {isarEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* ISAR Information */}
                            <div style={{ padding: '10px', background: '#2a2a2a', borderRadius: '3px', fontSize: '10px', opacity: 0.7 }}>
                                <p style={{ margin: '0 0 10px 0' }}>ISAR (Inverse Synthetic Aperture Radar) provides high-resolution radar imagery of surface and subsurface platforms.</p>
                                <p style={{ margin: '0 0 10px 0' }}>Select a surface or subsurface asset on the map, then click the ISAR button in the asset panel to view the radar image.</p>
                                <p style={{ margin: 0 }}>System must be powered ON to view images.</p>
                            </div>
                        </div>
                    )}

                    {/* SONO TAB */}
                    {selectedSystemTab === 'sono' && (
                        <div>
                            {/* SONO Power ON/OFF Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${sonoEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setSonoEnabled(!sonoEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {sonoEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* SAFE/ARM Switch */}
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center' }}>
                                    MASTER ARM
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    opacity: sonoEnabled ? 1 : 0.4,
                                    pointerEvents: sonoEnabled ? 'auto' : 'none'
                                }}>
                                    <div style={{
                                        position: 'relative',
                                        padding: '10px',
                                        border: '1px solid #202020',
                                        borderRadius: '10px',
                                        outline: '3px solid #a1a1a1',
                                        background: 'repeating-linear-gradient(-45deg, #f5dd00, #f5dd00 12px, #101010 10px, #101010 23px)'
                                    }}>
                                        <div style={{
                                            borderRadius: '5px',
                                            border: '2px solid #202020',
                                            outline: '2px solid #a1a1a1',
                                            background: '#404040',
                                            padding: '3px',
                                            margin: 0,
                                            perspective: '300px',
                                            boxShadow: '0 0 1px #050506, inset 0 0 0 2px #050506, inset 0 3px 1px #66646c',
                                            position: 'relative',
                                            width: '50px',
                                            height: '100px'
                                        }}>
                                            {/* Guard (checkbox) */}
                                            <input
                                                type="checkbox"
                                                checked={sonoGuardOpen}
                                                onChange={(e) => {
                                                    setSonoGuardOpen(e.target.checked);
                                                    if (!e.target.checked) setSonoArmed(false);
                                                }}
                                                style={{
                                                    position: 'relative',
                                                    margin: 0,
                                                    padding: 0,
                                                    appearance: 'none',
                                                    display: 'block',
                                                    width: '50px',
                                                    height: '100px',
                                                    borderRadius: '7px',
                                                    background: sonoGuardOpen ? 'linear-gradient(180deg, rgba(166,46,41,1) 4%, rgba(210,47,41,1) 38%, rgba(237,71,65,1) 59%, rgba(242,113,108,1) 71%, rgba(242,113,108,1) 94%, rgba(210,47,41,1) 100%)' : 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 3px rgba(255,255,255,0.5)',
                                                    cursor: 'grab',
                                                    transformOrigin: '50% 0%',
                                                    transition: 'transform 0.2s ease',
                                                    transform: sonoGuardOpen ? 'rotateX(70deg)' : 'rotateX(0deg)',
                                                    border: '1px solid black',
                                                    zIndex: 3
                                                }}
                                            />

                                            {/* Guard sides */}
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: '100%',
                                                height: '100px',
                                                display: 'block',
                                                transform: sonoGuardOpen ? 'translateY(0px)' : 'translateY(45px)',
                                                transition: 'all 0.2s ease',
                                                pointerEvents: 'none'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '2px',
                                                    top: '15px',
                                                    width: '8px',
                                                    height: '40px',
                                                    background: 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 1px rgba(255,255,255,0.2), 0px 3px 3px rgba(0,0,0,0.4)'
                                                }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    right: '2px',
                                                    top: '15px',
                                                    width: '8px',
                                                    height: '40px',
                                                    background: 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 1px rgba(255,255,255,0.2), 0px 3px 3px rgba(0,0,0,0.4)'
                                                }} />
                                            </div>

                                            {/* Switch (checkbox) */}
                                            <input
                                                type="checkbox"
                                                checked={sonoArmed}
                                                onChange={(e) => sonoGuardOpen && setSonoArmed(e.target.checked)}
                                                disabled={!sonoGuardOpen}
                                                style={{
                                                    position: 'absolute',
                                                    margin: 0,
                                                    padding: 0,
                                                    appearance: 'none',
                                                    display: 'block',
                                                    background: 'linear-gradient(to left, #a1a1a1 0%, #a1a1a1 1%, #c0c0c0 26%, #b1b1b1 48%, #909090 75%, #a1a1a1 100%)',
                                                    top: '70%',
                                                    left: '50%',
                                                    transform: 'translateX(-50%) translateY(-50%) rotate(-90deg)',
                                                    width: '52px',
                                                    height: '50px',
                                                    clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                                                    zIndex: 0,
                                                    cursor: sonoGuardOpen ? 'pointer' : 'not-allowed',
                                                    filter: 'drop-shadow(1px 1px 3px rgba(255,255,255,1))'
                                                }}
                                            />

                                            {/* Knob */}
                                            <div style={{
                                                position: 'absolute',
                                                display: 'block',
                                                width: '12px',
                                                height: '25px',
                                                bottom: sonoArmed ? '13px' : '15px',
                                                left: '50%',
                                                pointerEvents: 'none',
                                                borderTopLeftRadius: '4px',
                                                borderTopRightRadius: '4px',
                                                transform: sonoArmed ? 'translateX(-50%) rotateX(0deg)' : 'translateX(-50%) translateY(-14px) rotateX(-175deg)',
                                                background: 'linear-gradient(to left, lightgrey 0%, lightgrey 1%, #e0e0e0 26%, #efefef 48%, #d9d9d9 75%, #bcbcbc 100%)',
                                                border: '1px solid #000',
                                                zIndex: 2,
                                                transition: 'all 0.2s ease',
                                                boxShadow: 'inset 0px -3px 3px rgba(0,0,0,1), inset 0px 3px 3px rgba(0,0,0,0.7)'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-10px',
                                                    left: '-2px',
                                                    width: '12px',
                                                    borderRadius: '6px',
                                                    height: sonoArmed ? '15px' : '15px',
                                                    border: '1px solid black',
                                                    borderTop: 0,
                                                    background: 'radial-gradient(ellipse at 50% -40%, rgba(38, 38, 38, 0.5), #e6e6e6 25%, #ffffff 38%, #a1a1a1 63%, #e6e6e6 87%, rgba(38, 38, 38, 1))'
                                                }} />
                                            </div>

                                            {/* Indicator Light */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-40px',
                                                display: 'block',
                                                width: '50px',
                                                height: '20px',
                                                left: '50%',
                                                padding: '2px',
                                                transform: 'translateX(-50%)',
                                                backgroundColor: sonoArmed ? '#ed4741' : 'grey',
                                                borderRadius: '7px',
                                                border: '2px ridge black',
                                                zIndex: 0,
                                                transition: 'all 0.4s ease',
                                                boxShadow: sonoArmed ? '0px 0px 10px rgba(255,0,0,1)' : 'none'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    width: '100%',
                                                    height: '100%',
                                                    left: 0,
                                                    top: 0,
                                                    opacity: sonoArmed ? 0.2 : 0.2,
                                                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 2px, transparent 0)',
                                                    backgroundSize: '5px 5px',
                                                    backgroundPosition: '-18px -15px',
                                                    zIndex: 1,
                                                    borderRadius: '7px',
                                                    outline: '2px solid #a1a1a1',
                                                    border: '1px solid rgba(0,0,0,0.5)',
                                                    transition: 'all 1s ease'
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Remaining Buoy Count */}
                            <div style={{ marginTop: '50px', marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '5px', fontWeight: 'bold' }}>
                                    REMAINING BUOYS
                                </div>
                                <div style={{
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    color: sonobuoyCount > 10 ? '#00FF00' : (sonobuoyCount > 0 ? '#FFFF00' : '#FF0000')
                                }}>
                                    {sonobuoyCount}
                                </div>
                            </div>

                            {/* DEPLOY Button */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className="control-btn primary"
                                    disabled={!sonoEnabled || !sonoArmed || sonobuoyCount === 0}
                                    onClick={() => {
                                        if (sonoEnabled && sonoArmed && sonobuoyCount > 0) {
                                            const ownship = assets.find(a => a.type === 'ownship');
                                            if (ownship) {
                                                const newSonobuoy = {
                                                    id: nextSonobuoyId,
                                                    lat: ownship.lat,
                                                    lon: ownship.lon,
                                                    deployTime: missionTime
                                                };
                                                setSonobuoys([...sonobuoys, newSonobuoy]);
                                                setSonobuoyCount(sonobuoyCount - 1);
                                                setNextSonobuoyId(nextSonobuoyId + 1);
                                            }
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        opacity: (!sonoEnabled || !sonoArmed || sonobuoyCount === 0) ? 0.4 : 1,
                                        cursor: (!sonoEnabled || !sonoArmed || sonobuoyCount === 0) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    DEPLOY
                                </button>
                            </div>

                            {/* Deployed Buoys List */}
                            {sonobuoys.length > 0 && (
                                <div style={{ marginTop: '15px' }}>
                                    <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '5px', fontWeight: 'bold' }}>
                                        DEPLOYED BUOYS ({sonobuoys.length})
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#2a2a2a', borderRadius: '3px', padding: '5px' }}>
                                        {sonobuoys.map(sono => {
                                            const elapsedSeconds = Math.floor(missionTime - sono.deployTime);
                                            const minutes = Math.floor(elapsedSeconds / 60);
                                            const seconds = elapsedSeconds % 60;
                                            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                                            return (
                                                <div key={sono.id} style={{
                                                    padding: '5px',
                                                    marginBottom: '3px',
                                                    background: '#1a1a1a',
                                                    borderRadius: '2px',
                                                    fontSize: '9px',
                                                    color: '#0080FF'
                                                }}>
                                                    <div style={{ fontWeight: 'bold' }}>S{sono.id.toString().padStart(2, '0')}</div>
                                                    <div style={{ opacity: 0.7 }}>Time: {timeStr}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* WEAPON TAB */}
                    {selectedSystemTab === 'weapon' && (
                        <div>
                            {/* Power ON/OFF */}
                            <div className="playback-controls" style={{ marginBottom: '15px' }}>
                                <button
                                    className={`control-btn ${weaponEnabled ? 'primary' : 'danger'}`}
                                    onClick={() => setWeaponEnabled(!weaponEnabled)}
                                    style={{ width: '100%' }}
                                >
                                    {weaponEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {/* Master Arm Switch (same as SONO) */}
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center' }}>
                                    MASTER ARM
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    opacity: weaponEnabled ? 1 : 0.4,
                                    pointerEvents: weaponEnabled ? 'auto' : 'none'
                                }}>
                                    <div style={{
                                        position: 'relative',
                                        padding: '10px',
                                        border: '1px solid #202020',
                                        borderRadius: '10px',
                                        outline: '3px solid #a1a1a1',
                                        background: 'repeating-linear-gradient(-45deg, #f5dd00, #f5dd00 12px, #101010 10px, #101010 23px)'
                                    }}>
                                        <div style={{
                                            borderRadius: '5px',
                                            border: '2px solid #202020',
                                            outline: '2px solid #a1a1a1',
                                            background: '#404040',
                                            padding: '3px',
                                            margin: 0,
                                            perspective: '300px',
                                            boxShadow: '0 0 1px #050506, inset 0 0 0 2px #050506, inset 0 3px 1px #66646c',
                                            position: 'relative',
                                            width: '50px',
                                            height: '100px'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={weaponGuardOpen}
                                                onChange={(e) => {
                                                    setWeaponGuardOpen(e.target.checked);
                                                    if (!e.target.checked) setWeaponArmed(false);
                                                }}
                                                style={{
                                                    position: 'relative',
                                                    margin: 0,
                                                    padding: 0,
                                                    appearance: 'none',
                                                    display: 'block',
                                                    width: '50px',
                                                    height: '100px',
                                                    borderRadius: '7px',
                                                    background: weaponGuardOpen ? 'linear-gradient(180deg, rgba(166,46,41,1) 4%, rgba(210,47,41,1) 38%, rgba(237,71,65,1) 59%, rgba(242,113,108,1) 71%, rgba(242,113,108,1) 94%, rgba(210,47,41,1) 100%)' : 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 3px rgba(255,255,255,0.5)',
                                                    cursor: 'grab',
                                                    transformOrigin: '50% 0%',
                                                    transition: 'transform 0.2s ease',
                                                    transform: weaponGuardOpen ? 'rotateX(70deg)' : 'rotateX(0deg)',
                                                    border: '1px solid black',
                                                    zIndex: 3
                                                }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: '100%',
                                                height: '100px',
                                                display: 'block',
                                                transform: weaponGuardOpen ? 'translateY(0px)' : 'translateY(45px)',
                                                transition: 'all 0.2s ease',
                                                pointerEvents: 'none'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '2px',
                                                    top: '15px',
                                                    width: '8px',
                                                    height: '40px',
                                                    background: 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 1px rgba(255,255,255,0.2), 0px 3px 3px rgba(0,0,0,0.4)'
                                                }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    right: '2px',
                                                    top: '15px',
                                                    width: '8px',
                                                    height: '40px',
                                                    background: 'linear-gradient(0deg, rgba(166,46,41,1) 0%, rgba(210,47,41,1) 6%, rgba(237,71,65,1) 16%, rgba(237,71,65,1) 27%, rgba(210,47,41,1) 68%, rgba(210,47,41,1) 100%)',
                                                    boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), inset 2px 2px 1px rgba(255,255,255,0.2), 0px 3px 3px rgba(0,0,0,0.4)'
                                                }} />
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={weaponArmed}
                                                onChange={(e) => weaponGuardOpen && setWeaponArmed(e.target.checked)}
                                                disabled={!weaponGuardOpen}
                                                style={{
                                                    position: 'absolute',
                                                    margin: 0,
                                                    padding: 0,
                                                    appearance: 'none',
                                                    display: 'block',
                                                    background: 'linear-gradient(to left, #a1a1a1 0%, #a1a1a1 1%, #c0c0c0 26%, #b1b1b1 48%, #909090 75%, #a1a1a1 100%)',
                                                    top: '70%',
                                                    left: '50%',
                                                    transform: 'translateX(-50%) translateY(-50%) rotate(-90deg)',
                                                    width: '52px',
                                                    height: '50px',
                                                    clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                                                    zIndex: 0,
                                                    cursor: weaponGuardOpen ? 'pointer' : 'not-allowed',
                                                    filter: 'drop-shadow(1px 1px 3px rgba(255,255,255,1))'
                                                }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                display: 'block',
                                                width: '12px',
                                                height: '25px',
                                                bottom: weaponArmed ? '13px' : '15px',
                                                left: '50%',
                                                pointerEvents: 'none',
                                                borderTopLeftRadius: '4px',
                                                borderTopRightRadius: '4px',
                                                transform: weaponArmed ? 'translateX(-50%) rotateX(0deg)' : 'translateX(-50%) translateY(-14px) rotateX(-175deg)',
                                                background: 'linear-gradient(to left, lightgrey 0%, lightgrey 1%, #e0e0e0 26%, #efefef 48%, #d9d9d9 75%, #bcbcbc 100%)',
                                                border: '1px solid #000',
                                                zIndex: 2,
                                                transition: 'all 0.2s ease',
                                                boxShadow: 'inset 0px -3px 3px rgba(0,0,0,1), inset 0px 3px 3px rgba(0,0,0,0.7)'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-10px',
                                                    left: '-2px',
                                                    width: '12px',
                                                    borderRadius: '6px',
                                                    height: weaponArmed ? '15px' : '15px',
                                                    border: '1px solid black',
                                                    borderTop: 0,
                                                    background: 'radial-gradient(ellipse at 50% -40%, rgba(38, 38, 38, 0.5), #e6e6e6 25%, #ffffff 38%, #a1a1a1 63%, #e6e6e6 87%, rgba(38, 38, 38, 1))'
                                                }} />
                                            </div>
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-40px',
                                                display: 'block',
                                                width: '50px',
                                                height: '20px',
                                                left: '50%',
                                                padding: '2px',
                                                transform: 'translateX(-50%)',
                                                backgroundColor: weaponArmed ? '#ed4741' : 'grey',
                                                borderRadius: '7px',
                                                border: '2px ridge black',
                                                zIndex: 0,
                                                transition: 'all 0.4s ease',
                                                boxShadow: weaponArmed ? '0px 0px 10px rgba(255,0,0,1)' : 'none'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    width: '100%',
                                                    height: '100%',
                                                    left: 0,
                                                    top: 0,
                                                    opacity: weaponArmed ? 0.2 : 0.2,
                                                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 2px, transparent 0)',
                                                    backgroundSize: '5px 5px',
                                                    backgroundPosition: '-18px -15px',
                                                    zIndex: 1,
                                                    borderRadius: '7px',
                                                    outline: '2px solid #a1a1a1',
                                                    border: '1px solid rgba(0,0,0,0.5)',
                                                    transition: 'all 1s ease'
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Target Status */}
                            <div style={{ marginTop: '50px', marginBottom: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '10px', fontWeight: 'bold' }}>
                                    TARGET STATUS
                                </div>
                                <div style={{
                                    padding: '8px',
                                    marginBottom: '5px',
                                    background: '#2a2a2a',
                                    borderRadius: '3px'
                                }}>
                                    <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '3px' }}>
                                        Target: {selectedTargetAssetId !== null
                                            ? assets.find(a => a.id === selectedTargetAssetId)?.name || 'Unknown'
                                            : 'None Selected'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#00FF00' }}>
                                        Weapon: {selectedWeaponType || 'None Selected'}
                                    </div>
                                </div>
                            </div>

                            {/* Weapon Inventory */}
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '10px', fontWeight: 'bold' }}>
                                    WEAPON INVENTORY
                                </div>
                                {(() => {
                                    const ownship = assets.find(a => a.type === 'ownship');
                                    if (!ownship || !ownship.platform || !ownship.platform.weapons) {
                                        return Object.entries(weaponInventory).map(([weaponType, count]) => (
                                            <div key={weaponType} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '8px',
                                                marginBottom: '5px',
                                                background: '#2a2a2a',
                                                borderRadius: '3px'
                                            }}>
                                                <span style={{ fontSize: '10px', color: '#00FF00' }}>{weaponType}</span>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    color: count > 0 ? '#00FF00' : '#FF0000'
                                                }}>
                                                    {count}
                                                </span>
                                            </div>
                                        ));
                                    }

                                    const ownshipWeaponTypes = new Set(
                                        ownship.platform.weapons.map(weaponName => classifyWeaponType(weaponName, weaponConfigs)).filter(t => t !== null)
                                    );

                                    return Object.entries(weaponInventory)
                                        .filter(([weaponType]) => ownshipWeaponTypes.has(weaponType))
                                        .map(([weaponType, count]) => (
                                            <div key={weaponType} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '8px',
                                                marginBottom: '5px',
                                                background: '#2a2a2a',
                                                borderRadius: '3px'
                                            }}>
                                                <span style={{ fontSize: '10px', color: '#00FF00' }}>{weaponType}</span>
                                                <span style={{
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    color: count > 0 ? '#00FF00' : '#FF0000'
                                                }}>
                                                    {count}
                                                </span>
                                            </div>
                                        ));
                                })()}
                            </div>

                            {/* Fire Buttons */}
                            <div style={{ marginTop: '20px' }}>
                                <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '10px', fontWeight: 'bold' }}>
                                    FIRE CONTROLS
                                </div>
                                {(() => {
                                    const ownship = assets.find(a => a.type === 'ownship');
                                    if (!ownship || !ownship.platform || !ownship.platform.weapons) {
                                        return Object.entries(weaponInventory).map(([weaponType, count]) => {
                                            const isTargeted = selectedTargetAssetId !== null && selectedWeaponType === weaponType;
                                            const isReady = weaponEnabled && weaponArmed && count > 0;
                                            const canFire = isReady && isTargeted;
                                            const buttonColor = isTargeted ? '#00FF00' : (isReady ? '#FFFF00' : '#666');

                                            return (
                                                <button
                                                    key={weaponType}
                                                    className="control-btn"
                                                    disabled={!canFire}
                                                    onClick={() => {
                                                        if (canFire) {
                                                            const ownship = assets.find(a => a.type === 'ownship');
                                                            if (ownship) {
                                                                fireWeapon(ownship.id, selectedTargetAssetId, weaponType);
                                                                setSelectedTargetAssetId(null);
                                                                setSelectedWeaponType(null);
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        marginBottom: '8px',
                                                        backgroundColor: canFire ? buttonColor : '#444',
                                                        color: canFire ? '#000' : (isReady ? '#FFFF00' : '#666'),
                                                        border: `2px solid ${buttonColor}`,
                                                        opacity: canFire ? 1 : (isReady ? 0.7 : 0.4),
                                                        cursor: canFire ? 'pointer' : 'not-allowed',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    FIRE {weaponType}
                                                </button>
                                            );
                                        });
                                    }

                                    const ownshipWeaponTypes = new Set(
                                        ownship.platform.weapons.map(weaponName => classifyWeaponType(weaponName, weaponConfigs)).filter(t => t !== null)
                                    );

                                    return Object.entries(weaponInventory)
                                        .filter(([weaponType]) => ownshipWeaponTypes.has(weaponType))
                                        .map(([weaponType, count]) => {
                                            const isTargeted = selectedTargetAssetId !== null && selectedWeaponType === weaponType;
                                            const isReady = weaponEnabled && weaponArmed && count > 0;
                                            const canFire = isReady && isTargeted;
                                            const buttonColor = isTargeted ? '#00FF00' : (isReady ? '#FFFF00' : '#666');

                                            return (
                                                <button
                                                    key={weaponType}
                                                    className="control-btn"
                                                    disabled={!canFire}
                                                    onClick={() => {
                                                        if (canFire) {
                                                            fireWeapon(ownship.id, selectedTargetAssetId, weaponType);
                                                            setSelectedTargetAssetId(null);
                                                            setSelectedWeaponType(null);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        marginBottom: '8px',
                                                        backgroundColor: canFire ? buttonColor : '#444',
                                                        color: canFire ? '#000' : (isReady ? '#FFFF00' : '#666'),
                                                        border: `2px solid ${buttonColor}`,
                                                        opacity: canFire ? 1 : (isReady ? 0.7 : 0.4),
                                                        cursor: canFire ? 'pointer' : 'not-allowed',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    FIRE {weaponType}
                                                </button>
                                            );
                                        });
                                })()}
                            </div>

                            {/* Active Weapons List */}
                            {(() => {
                                const ownship = assets.find(a => a.type === 'ownship');
                                if (!ownship) return null;

                                const ownshipWeapons = weapons.filter(wpn => wpn.firingAssetId === ownship.id);

                                if (ownshipWeapons.length === 0) return null;

                                return (
                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ fontSize: '10px', color: '#00FF00', marginBottom: '5px', fontWeight: 'bold' }}>
                                            ACTIVE WEAPONS ({ownshipWeapons.length})
                                        </div>
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#2a2a2a', borderRadius: '3px', padding: '5px' }}>
                                            {ownshipWeapons.map(wpn => {
                                                const target = assets.find(a => a.id === wpn.targetId);

                                                // Calculate time remaining (countdown)
                                                const configKey = wpn.weaponName || wpn.weaponType;
                                                const config = weaponConfigs[configKey];

                                                let timeRemaining = 0;
                                                if (config && target) {
                                                    const currentRange = calculateDistance(wpn.lat, wpn.lon, target.lat, target.lon);
                                                    const speedInNmPerSec = wpn.speed / 3600;
                                                    timeRemaining = Math.max(0, Math.floor(currentRange / speedInNmPerSec));
                                                }

                                                return (
                                                    <div key={wpn.id} style={{
                                                        padding: '5px',
                                                        marginBottom: '3px',
                                                        background: '#1a1a1a',
                                                        borderRadius: '2px',
                                                        fontSize: '9px',
                                                        color: wpn.affiliation === 'friendly' ? '#00BFFF' : '#FF0000'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold' }}>{wpn.weaponType} #{wpn.id}</div>
                                                        <div style={{ opacity: 0.7 }}>Target: {target ? target.name : 'LOST'}</div>
                                                        <div style={{ opacity: 0.7 }}>TTI: {timeRemaining}s</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Bullseye Editor - Only show when bullseye is selected */}
            {bullseyeSelected && (
                <div className="control-section">
                    <div className="section-header">BULLSEYE</div>
                    <div className="input-group">
                        <label className="input-label">Name</label>
                        <input
                            className="input-field"
                            type="text"
                            value={bullseyeName}
                            onChange={(e) => setBullseyeName(e.target.value)}
                            placeholder="BULLSEYE"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Latitude</label>
                        <input
                            className="input-field"
                            type="text"
                            value={bullseyeLatInput}
                            onChange={(e) => setBullseyeLatInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const lat = dmmToDecimal(bullseyeLatInput);
                                    if (lat !== null && lat >= -90 && lat <= 90) {
                                        setBullseyePosition({ ...bullseyePosition, lat });
                                    } else {
                                        alert('Invalid latitude. Format: N26 30.0 or S26 30.0');
                                        setBullseyeLatInput(decimalToDMM(bullseyePosition.lat, true));
                                    }
                                }
                            }}
                            placeholder="N26 30.0"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Longitude</label>
                        <input
                            className="input-field"
                            type="text"
                            value={bullseyeLonInput}
                            onChange={(e) => setBullseyeLonInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const lon = dmmToDecimal(bullseyeLonInput);
                                    if (lon !== null && lon >= -180 && lon <= 180) {
                                        setBullseyePosition({ ...bullseyePosition, lon });
                                    } else {
                                        alert('Invalid longitude. Format: E054 00.0 or W054 00.0');
                                        setBullseyeLonInput(decimalToDMM(bullseyePosition.lon, false));
                                    }
                                }
                            }}
                            placeholder="E054 00.0"
                        />
                    </div>
                    <div className="input-group" style={{ marginTop: '10px', fontSize: '9px', opacity: 0.7 }}>
                        Reference point for all position calls. Enter a custom name or leave blank for default "BULLSEYE". You can also drag the bullseye on the map or enter coordinates (press Enter to apply).
                    </div>
                </div>
            )}

            {/* Geo-Point Editor - Only show when geo-point is selected */}
            {(() => {
                const selectedGeoPoint = geoPoints.find(gp => gp.id === selectedGeoPointId);
                if (!selectedGeoPoint) return null;

                return (
                    <div className="control-section">
                        <div className="section-header">GEO-POINT</div>

                        <div className="input-group">
                            <label className="input-label">Name</label>
                            <input
                                className="input-field"
                                type="text"
                                value={selectedGeoPoint.name}
                                onChange={(e) => updateGeoPoint(selectedGeoPoint.id, { name: e.target.value })}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Type</label>
                            <select
                                className="input-field"
                                value={selectedGeoPoint.type}
                                onChange={(e) => updateGeoPoint(selectedGeoPoint.id, { type: e.target.value })}
                            >
                                {Object.entries(GEOPOINT_TYPES).map(([key, config]) => (
                                    <option key={key} value={key}>
                                        {config.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Identity</label>
                            <select
                                className="input-field"
                                value={selectedGeoPoint.identity}
                                onChange={(e) => updateGeoPoint(selectedGeoPoint.id, { identity: e.target.value })}
                            >
                                <option value="friendly">Friendly</option>
                                <option value="hostile">Hostile</option>
                                <option value="neutral">Neutral</option>
                                <option value="unknown">Unknown</option>
                                <option value="unknownUnevaluated">Unknown Unevaluated</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Latitude</label>
                            <input
                                type="text"
                                className="input-field"
                                value={geoPointEditValues.lat || ''}
                                onChange={(e) => setGeoPointEditValues(prev => ({ ...prev, lat: e.target.value.toUpperCase() }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        applyGeoPointCoordinate('lat');
                                    }
                                }}
                                placeholder="N26 30.0"
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Longitude</label>
                            <input
                                type="text"
                                className="input-field"
                                value={geoPointEditValues.lon || ''}
                                onChange={(e) => setGeoPointEditValues(prev => ({ ...prev, lon: e.target.value.toUpperCase() }))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        applyGeoPointCoordinate('lon');
                                    }
                                }}
                                placeholder="E054 00.0"
                            />
                        </div>

                        <button
                            className="control-btn danger full-width"
                            onClick={() => deleteGeoPoint(selectedGeoPoint.id)}
                            style={{ marginTop: '15px' }}
                        >
                            DELETE GEO-POINT
                        </button>
                    </div>
                );
            })()}

            {/* Shape Editor - Only show when shape is selected */}
            {(() => {
                const selectedShape = shapes.find(s => s.id === selectedShapeId);
                if (!selectedShape) return null;

                return (
                    <div className="control-section">
                        <div className="section-header">SHAPE</div>

                        <div className="input-group">
                            <label className="input-label">Type</label>
                            <div className="input-field" style={{ backgroundColor: 'rgba(0, 255, 0, 0.05)', cursor: 'not-allowed' }}>
                                {SHAPE_TYPES[selectedShape.type]?.label}
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Identity</label>
                            <select
                                className="input-field"
                                value={selectedShape.identity}
                                onChange={(e) => updateShape(selectedShape.id, { identity: e.target.value })}
                            >
                                <option value="friendly">Friendly</option>
                                <option value="hostile">Hostile</option>
                                <option value="neutral">Neutral</option>
                                <option value="unknown">Unknown</option>
                                <option value="unknownUnevaluated">Unknown Unevaluated</option>
                            </select>
                        </div>

                        {selectedShape.type === 'circle' && (
                            <>
                                <div className="input-group">
                                    <label className="input-label">Center Latitude</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={shapePointEditValues.centerLat !== undefined
                                            ? shapePointEditValues.centerLat
                                            : decimalToDMM(selectedShape.centerLat, true)}
                                        onChange={(e) => setShapePointEditValues(prev =>
                                            ({ ...prev, centerLat: e.target.value.toUpperCase() }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyCircleCoordinate('centerLat');
                                                e.target.blur();
                                            }
                                        }}
                                        placeholder="N26 30.0"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Center Longitude</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={shapePointEditValues.centerLon !== undefined
                                            ? shapePointEditValues.centerLon
                                            : decimalToDMM(selectedShape.centerLon, false)}
                                        onChange={(e) => setShapePointEditValues(prev =>
                                            ({ ...prev, centerLon: e.target.value.toUpperCase() }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyCircleCoordinate('centerLon');
                                                e.target.blur();
                                            }
                                        }}
                                        placeholder="E054 00.0"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Radius (NM)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        className="input-field"
                                        value={selectedShape.radius}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value) && value > 0) {
                                                updateShape(selectedShape.id, { radius: value });
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {selectedShape.type === 'lineSegment' && (
                            <div className="input-group">
                                <label className="input-label">Points</label>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(0, 255, 0, 0.3)', borderRadius: '3px', padding: '8px' }}>
                                    {selectedShape.points.map((point, index) => (
                                        <div key={index} style={{ marginBottom: '10px', padding: '8px', borderBottom: '1px solid rgba(0, 255, 0, 0.2)', backgroundColor: 'rgba(0, 20, 0, 0.3)', borderRadius: '3px' }}>
                                            <div style={{ fontSize: '10px', color: '#00FF00', fontWeight: 'bold', marginBottom: '5px' }}>Point {index + 1}</div>
                                            <div style={{ marginBottom: '5px' }}>
                                                <label style={{ fontSize: '9px', color: '#00FF00', opacity: 0.7, display: 'block', marginBottom: '2px' }}>Name</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    style={{ fontSize: '10px', padding: '4px' }}
                                                    value={point.name || ''}
                                                    onChange={(e) => {
                                                        const newPoints = [...selectedShape.points];
                                                        newPoints[index] = { ...newPoints[index], name: e.target.value };
                                                        updateShape(selectedShape.id, { points: newPoints });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                            <div style={{ marginBottom: '5px' }}>
                                                <label style={{ fontSize: '9px', color: '#00FF00', opacity: 0.7, display: 'block', marginBottom: '2px' }}>Latitude</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    style={{ fontSize: '10px', padding: '4px' }}
                                                    value={shapePointEditValues[`${index}_lat`] !== undefined ? shapePointEditValues[`${index}_lat`] : decimalToDMM(point.lat, true)}
                                                    onChange={(e) => setShapePointEditValues(prev => ({ ...prev, [`${index}_lat`]: e.target.value.toUpperCase() }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            applyShapePointCoordinate(index, 'lat');
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    placeholder="N26 30.0"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '9px', color: '#00FF00', opacity: 0.7, display: 'block', marginBottom: '2px' }}>Longitude</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    style={{ fontSize: '10px', padding: '4px' }}
                                                    value={shapePointEditValues[`${index}_lon`] !== undefined ? shapePointEditValues[`${index}_lon`] : decimalToDMM(point.lon, false)}
                                                    onChange={(e) => setShapePointEditValues(prev => ({ ...prev, [`${index}_lon`]: e.target.value.toUpperCase() }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            applyShapePointCoordinate(index, 'lon');
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    placeholder="E054 00.0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="control-btn primary full-width"
                                    onClick={() => {
                                        // Add a new point at the end of the line segment
                                        // Default to last point's coordinates offset slightly
                                        const lastPoint = selectedShape.points[selectedShape.points.length - 1];
                                        const newPoint = {
                                            lat: lastPoint.lat + 0.01, // Offset by ~0.6 NM north
                                            lon: lastPoint.lon + 0.01, // Offset by ~0.6 NM east
                                            name: ''
                                        };
                                        const newPoints = [...selectedShape.points, newPoint];
                                        updateShape(selectedShape.id, { points: newPoints });
                                    }}
                                    style={{ marginTop: '10px' }}
                                >
                                    + ADD POINT
                                </button>
                            </div>
                        )}

                        <button
                            className="control-btn danger full-width"
                            onClick={() => deleteShape(selectedShape.id)}
                            style={{ marginTop: '15px' }}
                        >
                            DELETE SHAPE
                        </button>
                    </div>
                );
            })()}

            {/* Radar Controls - Only show when radar controls are selected */}
            {radarControlsSelected && (
                <div className="control-section">
                    <div className="section-header" style={{ position: 'relative' }}>
                        RADAR
                        {/* Close Button */}
                        <button
                            onClick={() => setRadarControlsSelected(false)}
                            style={{
                                position: 'absolute',
                                right: '0',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#00FF00',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '0',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: '0.7'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Radar ON/OFF Button */}
                    <div className="playback-controls" style={{ marginBottom: '15px' }}>
                        <button
                            className={`control-btn ${radarEnabled ? 'primary' : 'danger'}`}
                            onClick={() => setRadarEnabled(!radarEnabled)}
                            style={{ width: '100%' }}
                        >
                            {radarEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Sweep Opacity Slider */}
                    <div className="input-group">
                        <label className="input-label">Sweep Opacity</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={radarSweepOpacity}
                            onChange={(e) => setRadarSweepOpacity(parseFloat(e.target.value))}
                            className="slider"
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                            {Math.round(radarSweepOpacity * 100)}%
                        </div>
                    </div>

                    {/* Radar Return Decay Slider */}
                    <div className="input-group" style={{ marginTop: '15px' }}>
                        <label className="input-label">Return Decay Time</label>
                        <input
                            type="range"
                            min="10"
                            max="60"
                            step="1"
                            value={radarReturnDecay}
                            onChange={(e) => setRadarReturnDecay(parseInt(e.target.value))}
                            className="slider"
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                            {radarReturnDecay} seconds
                        </div>
                    </div>

                    {/* Radar Return Intensity Slider */}
                    <div className="input-group" style={{ marginTop: '15px' }}>
                        <label className="input-label">Return Intensity</label>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={radarReturnIntensity}
                            onChange={(e) => setRadarReturnIntensity(parseInt(e.target.value))}
                            className="slider"
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                            {radarReturnIntensity}%
                        </div>
                    </div>
                </div>
            )}

            {/* ESM Controls - Only show when ESM controls are selected */}
            {esmControlsSelected && (
                <div className="control-section">
                    <div className="section-header" style={{ position: 'relative' }}>
                        ESM
                        {/* Close Button */}
                        <button
                            onClick={() => setEsmControlsSelected(false)}
                            style={{
                                position: 'absolute',
                                right: '0',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#00FF00',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '0',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: '0.7'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                            ✕
                        </button>
                    </div>

                    {/* ESM ON/OFF Button */}
                    <div className="playback-controls" style={{ marginBottom: '15px' }}>
                        <button
                            className={`control-btn ${esmEnabled ? 'primary' : 'danger'}`}
                            onClick={() => setEsmEnabled(!esmEnabled)}
                            style={{ width: '100%' }}
                        >
                            {esmEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Bearing Line Button */}
                    <button
                        className="control-btn full-width"
                        onClick={() => {
                            if (!selectedEsmId) {
                                alert('Please select an emitter from the list first');
                                return;
                            }
                            const selectedEmitter = detectedEmitters.find(e => e.id === selectedEsmId);
                            if (!selectedEmitter) return;

                            const ownship = assets.find(a => a.type === 'ownship');
                            if (!ownship) return;

                            // Create manual bearing line - snapshot of current ownship position and bearing
                            const newLine = {
                                id: `manual-${nextManualLineSerialNumber}`,
                                bearing: selectedEmitter.bearing, // Fixed bearing at time of creation
                                serialNumber: nextManualLineSerialNumber,
                                ownshipLat: ownship.lat, // Store ownship position at time of creation
                                ownshipLon: ownship.lon,
                                emitterName: selectedEmitter.emitterName
                            };
                            setManualBearingLines(prev => [...prev, newLine]);
                            setNextManualLineSerialNumber(prev => prev + 1);
                        }}
                        style={{ marginBottom: '15px' }}
                        disabled={!selectedEsmId}
                    >
                        BEARING LINE
                    </button>

                    {/* Detected Emitters List */}
                    <div className="input-group">
                        <label className="input-label">DETECTED EMITTERS ({detectedEmitters.filter(e => e.visible).length}/{detectedEmitters.length})</label>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '10px' }}>
                            {detectedEmitters.length === 0 && manualBearingLines.length === 0 ? (
                                <div style={{ padding: '10px', opacity: 0.5, fontSize: '10px', textAlign: 'center' }}>
                                    {esmEnabled ? 'No emitters detected' : 'ESM system is OFF'}
                                </div>
                            ) : (
                                <>
                                {detectedEmitters.map((emitter) => {
                                    // Calculate age (time since last seen)
                                    const age = emitter.active ? 0 : (missionTime - (emitter.lastSeenTime || missionTime));
                                    const ageMinutes = Math.floor(age / 60);
                                    const ageSeconds = Math.floor(age % 60);
                                    const ageDisplay = `${ageMinutes.toString().padStart(2, '0')}+${ageSeconds.toString().padStart(2, '0')}`;

                                    return (
                                        <div
                                            key={emitter.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px',
                                                marginBottom: '5px',
                                                background: selectedEsmId === emitter.id ? '#003300' : '#2a2a2a',
                                                borderRadius: '3px',
                                                border: selectedEsmId === emitter.id ? '1px solid #00FF00' : 'none',
                                                cursor: 'pointer',
                                                opacity: emitter.active ? 1 : 0.6
                                            }}
                                            onClick={() => setSelectedEsmId(emitter.id)}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#FF8800' }}>
                                                    E{emitter.serialNumber.toString().padStart(2, '0')}
                                                </div>
                                                <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '500' }}>
                                                    {emitter.emitterName}
                                                </div>
                                                <div style={{ fontSize: '8px', opacity: 0.5 }}>
                                                    BRG: {Math.round(emitter.bearing)}°
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '7px', opacity: 0.5 }}>AGE</div>
                                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: emitter.active ? '#00FF00' : '#FFAA00' }}>
                                                        {ageDisplay}
                                                    </div>
                                                </div>
                                                <label style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={emitter.visible}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            setDetectedEmitters(prev => prev.map(em =>
                                                                em.id === emitter.id ? { ...em, visible: !em.visible } : em
                                                            ));
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    VIS
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Manual Bearing Lines */}
                                {manualBearingLines.map((line) => {
                                    return (
                                        <div
                                            key={line.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px',
                                                marginBottom: '5px',
                                                background: selectedEsmId === line.id ? '#003333' : '#2a2a2a',
                                                borderRadius: '3px',
                                                border: selectedEsmId === line.id ? '1px solid #00CCFF' : 'none',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setSelectedEsmId(line.id)}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#00CCFF' }}>
                                                    M{line.serialNumber.toString().padStart(2, '0')}
                                                </div>
                                                <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '500' }}>
                                                    {line.emitterName}
                                                </div>
                                                <div style={{ fontSize: '8px', opacity: 0.5 }}>
                                                    BRG: {Math.round(line.bearing)}°
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* IFF Controls - Only show when IFF controls are selected */}
            {iffControlsSelected && (
                <div className="control-section">
                    <div className="section-header" style={{ position: 'relative' }}>
                        IFF
                        {/* Close Button */}
                        <button
                            onClick={() => setIffControlsSelected(false)}
                            style={{
                                position: 'absolute',
                                right: '0',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#00FF00',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '0',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: '0.7'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                            ✕
                        </button>
                    </div>

                    {/* IFF ON/OFF Button */}
                    <div className="playback-controls" style={{ marginBottom: '15px' }}>
                        <button
                            className={`control-btn ${iffEnabled ? 'primary' : 'danger'}`}
                            onClick={() => setIffEnabled(!iffEnabled)}
                            style={{ width: '100%' }}
                        >
                            {iffEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Ownship IFF Codes */}
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '10px', opacity: 0.7 }}>
                            OWNSHIP CODES
                        </div>

                        {/* MODE I */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">MODE I (2 digit octal)</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={iffOwnshipModeI}
                                key={`mode1-${iffOwnshipModeI}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow octal digits (0-7) and max 2 chars
                                    if (!/^[0-7]{0,2}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        if (/^[0-7]{0,2}$/.test(val)) {
                                            // Pad with zeros to 2 digits
                                            const padded = val.padStart(2, '0');
                                            setIffOwnshipModeI(padded);
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="00 (press Enter)"
                                maxLength="2"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* MODE II */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">MODE II (4 digit octal)</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={iffOwnshipModeII}
                                key={`mode2-${iffOwnshipModeII}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow octal digits (0-7) and max 4 chars
                                    if (!/^[0-7]{0,4}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        if (/^[0-7]{0,4}$/.test(val)) {
                                            // Pad with zeros to 4 digits
                                            const padded = val.padStart(4, '0');
                                            setIffOwnshipModeII(padded);
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="0000 (press Enter)"
                                maxLength="4"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* MODE III */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">MODE III (4 digit octal)</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={iffOwnshipModeIII}
                                key={`mode3-${iffOwnshipModeIII}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow octal digits (0-7) and max 4 chars
                                    if (!/^[0-7]{0,4}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        if (/^[0-7]{0,4}$/.test(val)) {
                                            // Pad with zeros to 4 digits
                                            const padded = val.padStart(4, '0');
                                            setIffOwnshipModeIII(padded);
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="0000 (press Enter)"
                                maxLength="4"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* MODE IV */}
                        <div className="input-group">
                            <label className="input-label">MODE IV</label>
                            <button
                                className={`control-btn ${iffOwnshipModeIV ? 'primary' : 'danger'}`}
                                onClick={() => setIffOwnshipModeIV(!iffOwnshipModeIV)}
                                style={{ width: '100%' }}
                            >
                                {iffOwnshipModeIV ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>

                    {/* IFF Return Intensity Slider */}
                    <div className="input-group" style={{ marginTop: '15px' }}>
                        <label className="input-label">Return Intensity</label>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={iffReturnIntensity}
                            onChange={(e) => setIffReturnIntensity(parseInt(e.target.value))}
                            className="slider"
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                            {iffReturnIntensity}%
                        </div>
                    </div>
                </div>
            )}

            {/* Datalink Controls Panel */}
            {datalinkControlsSelected && (
                <div className="control-section">
                    <div className="section-header" style={{ position: 'relative' }}>
                        DATALINK
                        {/* Close Button */}
                        <button
                            onClick={() => setDatalinkControlsSelected(false)}
                            style={{
                                position: 'absolute',
                                right: '0',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#00FF00',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '0',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: '0.7'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Datalink ON/OFF Button */}
                    <div className="playback-controls" style={{ marginBottom: '15px' }}>
                        <button
                            className={`control-btn ${datalinkEnabled ? 'primary' : 'danger'}`}
                            onClick={() => setDatalinkEnabled(!datalinkEnabled)}
                            style={{ width: '100%' }}
                        >
                            {datalinkEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Datalink Configuration */}
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '10px', opacity: 0.7 }}>
                            CONFIGURATION
                        </div>

                        {/* NET */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">NET (1-127)</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={datalinkNet}
                                key={`net-${datalinkNet}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow digits, max 3 chars
                                    if (!/^\d{0,3}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    // Blue text for uncommitted value
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        const num = parseInt(val);
                                        if (val !== '' && num >= 1 && num <= 127) {
                                            setDatalinkNet(val);
                                            e.target.style.color = '#00FF00';
                                        } else {
                                            e.target.value = '';
                                            setDatalinkNet('');
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="1 (press Enter)"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* JU Code */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">JU (5 digits)</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={datalinkJU}
                                key={`ju-${datalinkJU}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow digits, max 5 chars
                                    if (!/^\d{0,5}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    // Blue text for uncommitted value
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        if (/^\d{1,5}$/.test(val)) {
                                            // Pad to 5 digits
                                            setDatalinkJU(val.padStart(5, '0'));
                                            e.target.style.color = '#00FF00';
                                        } else {
                                            e.target.value = '';
                                            setDatalinkJU('');
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="00000 (press Enter)"
                                maxLength="5"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* Track Block Start */}
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <label className="input-label">Track Block Start</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={datalinkTrackBlockStart}
                                key={`start-${datalinkTrackBlockStart}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow digits, max 5 chars
                                    if (!/^\d{0,5}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    // Blue text for uncommitted value
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        if (/^\d{1,5}$/.test(val)) {
                                            setDatalinkTrackBlockStart(val);
                                            setNextDatalinkTrackNumber(parseInt(val));
                                            e.target.style.color = '#00FF00';
                                        } else {
                                            e.target.value = '';
                                            setDatalinkTrackBlockStart('');
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="60000 (press Enter)"
                                maxLength="5"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>

                        {/* Track Block End */}
                        <div className="input-group">
                            <label className="input-label">Track Block End</label>
                            <input
                                className="input-field"
                                type="text"
                                defaultValue={datalinkTrackBlockEnd}
                                key={`end-${datalinkTrackBlockEnd}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow digits, max 5 chars
                                    if (!/^\d{0,5}$/.test(val)) {
                                        e.target.value = e.target.value.slice(0, -1);
                                    }
                                    // Blue text for uncommitted value
                                    e.target.style.color = '#00BFFF';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.target.value;
                                        const num = parseInt(val);
                                        const startNum = parseInt(datalinkTrackBlockStart);
                                        if (/^\d{1,5}$/.test(val) && num > startNum) {
                                            setDatalinkTrackBlockEnd(val);
                                            e.target.style.color = '#00FF00';
                                        } else {
                                            e.target.value = '';
                                            setDatalinkTrackBlockEnd('');
                                            e.target.style.color = '#00FF00';
                                        }
                                    }
                                }}
                                placeholder="60200 (press Enter)"
                                maxLength="5"
                                style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00FF00' }}
                            />
                        </div>
                    </div>

                    {/* Status Info */}
                    <div style={{ fontSize: '9px', opacity: 0.7, padding: '10px', background: '#1a1a1a', borderRadius: '3px' }}>
                        <div>Status: {datalinkEnabled && datalinkNet && datalinkJU.length === 5 && datalinkTrackBlockStart && datalinkTrackBlockEnd ? 'ACTIVE' : 'INACTIVE'}</div>
                        {nextDatalinkTrackNumber !== null && (
                            <div style={{ marginTop: '5px' }}>Next Track: {nextDatalinkTrackNumber}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Asset List - Only show when no asset is selected, bullseye is not selected, geo-point is not selected, and radar/ESM/IFF/Datalink controls are not selected */}
            {!selectedAsset && !bullseyeSelected && !selectedGeoPointId && !selectedShapeId && !radarControlsSelected && !esmControlsSelected && !iffControlsSelected && !datalinkControlsSelected && (
                <div className="control-section">
                    <div className="section-header">ASSETS ({assets.length})</div>
                    <div className="asset-list">
                        {assets.length === 0 ? (
                            <div className="empty-state">No assets created</div>
                        ) : (
                            assets.map(asset => (
                                <button
                                    key={asset.id}
                                    className={`asset-item ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedAssetId(asset.id);
                                        centerMapOnAsset(asset.id);
                                    }}
                                    type="button"
                                >
                                    <div className="asset-name" style={{ color: ASSET_TYPES[asset.type].color }}>
                                        {asset.name}
                                    </div>
                                    <div className="asset-details">
                                        {ASSET_TYPES[asset.type].badge} |
                                        HDG {Math.round(asset.heading)}° |
                                        {Math.round(asset.speed)} KTAS |
                                        FL{Math.round(asset.altitude/100)}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    <button
                        className="control-btn primary full-width mb-10"
                        onClick={() => setShowAddAssetDialog({ lat: bullseyePosition.lat, lon: bullseyePosition.lon })}
                        style={{ marginTop: '10px' }}
                    >
                        + ADD ASSET
                    </button>
                </div>
            )}

            {/* Selected Asset */}
            {selectedAsset && (
                <div className="control-section">
                    <div className="section-header">SELECTED ASSET</div>

                    {/* Tab Navigation - Row 1: Configuration Tabs */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', borderBottom: '1px solid rgba(0, 255, 0, 0.3)' }}>
                        <button
                            onClick={() => setSelectedAssetTab('general')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: selectedAssetTab === 'general' ? '#00FF00' : 'transparent',
                                color: selectedAssetTab === 'general' ? '#000' : '#00FF00',
                                border: 'none',
                                borderBottom: selectedAssetTab === 'general' ? '2px solid #00FF00' : '2px solid transparent',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            GENERAL
                        </button>
                        {selectedAsset.type !== 'ownship' && (
                            <>
                                <button
                                    onClick={() => setSelectedAssetTab('iff')}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: selectedAssetTab === 'iff' ? '#00FF00' : 'transparent',
                                        color: selectedAssetTab === 'iff' ? '#000' : '#00FF00',
                                        border: 'none',
                                        borderBottom: selectedAssetTab === 'iff' ? '2px solid #00FF00' : '2px solid transparent',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    IFF
                                </button>
                                <button
                                    onClick={() => setSelectedAssetTab('datalink')}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: selectedAssetTab === 'datalink' ? '#00FF00' : 'transparent',
                                        color: selectedAssetTab === 'datalink' ? '#000' : '#00FF00',
                                        border: 'none',
                                        borderBottom: selectedAssetTab === 'datalink' ? '2px solid #00FF00' : '2px solid transparent',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    DATALINK
                                </button>
                                {selectedAsset.platform && selectedAsset.platform.emitters && selectedAsset.platform.emitters.length > 0 && (
                                    <button
                                        onClick={() => setSelectedAssetTab('emitter')}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: selectedAssetTab === 'emitter' ? '#00FF00' : 'transparent',
                                            color: selectedAssetTab === 'emitter' ? '#000' : '#00FF00',
                                            border: 'none',
                                            borderBottom: selectedAssetTab === 'emitter' ? '2px solid #00FF00' : '2px solid transparent',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        EMITTER
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Tab Navigation - Row 2: Sensor Systems */}
                    {selectedAsset.type !== 'ownship' && (selectedAsset.platform?.image || selectedAsset.platform?.isar) && (
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', borderBottom: '1px solid rgba(0, 255, 0, 0.3)' }}>
                            {selectedAsset.platform && selectedAsset.platform.image && (
                                <button
                                    onClick={() => {
                                        if (eoirEnabled) {
                                            setEoirSelectedAssetId(selectedAsset.id);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: eoirSelectedAssetId === selectedAsset.id ? '#00FF00' : 'transparent',
                                        color: eoirSelectedAssetId === selectedAsset.id ? '#000' : (eoirEnabled ? '#00FF00' : '#FF0000'),
                                        border: 'none',
                                        borderBottom: eoirSelectedAssetId === selectedAsset.id ? '2px solid #00FF00' : '2px solid transparent',
                                        cursor: eoirEnabled ? 'pointer' : 'not-allowed',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s',
                                        opacity: eoirEnabled ? 1 : 0.5
                                    }}
                                >
                                    EO/IR
                                </button>
                            )}
                            {selectedAsset.platform && selectedAsset.platform.isar && (
                                <button
                                    onClick={() => {
                                        if (isarEnabled) {
                                            setIsarSelectedAssetId(selectedAsset.id);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        background: isarSelectedAssetId === selectedAsset.id ? '#00FF00' : 'transparent',
                                        color: isarSelectedAssetId === selectedAsset.id ? '#000' : (isarEnabled ? '#00FF00' : '#FF0000'),
                                        border: 'none',
                                        borderBottom: isarSelectedAssetId === selectedAsset.id ? '2px solid #00FF00' : '2px solid transparent',
                                        cursor: isarEnabled ? 'pointer' : 'not-allowed',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s',
                                        opacity: isarEnabled ? 1 : 0.5
                                    }}
                                >
                                    ISAR
                                </button>
                            )}
                        </div>
                    )}

                    {/* GENERAL TAB */}
                    {selectedAssetTab === 'general' && (
                        <>
                            <div className="input-group">
                                <label className="input-label">Name</label>
                                <input
                                    className="input-field"
                                    type="text"
                                    value={editValues.name || ''}
                                    onChange={(e) => handleUpdate('name', e.target.value)}
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Identity</label>
                                <select
                                    className="input-field"
                                    value={selectedAsset.identity || 'unknown'}
                                    onChange={(e) => updateAsset(selectedAsset.id, { identity: e.target.value })}
                                    disabled={selectedAsset.type === 'ownship'}
                                >
                                    {selectedAsset.type === 'ownship' && <option value="ownship">Ownship</option>}
                                    <option value="friendly">Friendly</option>
                                    <option value="hostile">Hostile</option>
                                    <option value="neutral">Neutral</option>
                                    <option value="unknown">Unknown</option>
                                    <option value="unknownUnevaluated">Unknown Unevaluated</option>
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Domain</label>
                                <select
                                    className="input-field"
                                    value={selectedAsset.domain || 'air'}
                                    onChange={(e) => {
                                        const newDomain = e.target.value;
                                        const domainConfig = DOMAIN_TYPES[newDomain];
                                        const updates = {
                                            domain: newDomain,
                                            platform: null,
                                            altitude: domainConfig.hasAltitude ? selectedAsset.altitude : 0,
                                            depth: domainConfig.hasDepth ? (selectedAsset.depth || 50) : null,
                                            targetAltitude: domainConfig.hasAltitude ? selectedAsset.targetAltitude : null,
                                            targetDepth: domainConfig.hasDepth ? selectedAsset.targetDepth : null
                                        };
                                        if (selectedAsset.speed > domainConfig.maxSpeed) {
                                            updates.speed = domainConfig.maxSpeed;
                                            updates.targetSpeed = null;
                                        }
                                        updateAsset(selectedAsset.id, updates);
                                    }}
                                    disabled={selectedAsset.type === 'ownship'}
                                >
                                    <option value="air">Air</option>
                                    <option value="surface">Surface</option>
                                    <option value="subSurface">Sub-Surface</option>
                                </select>
                            </div>

                            {selectedAsset.hasOwnProperty('platform') && selectedAsset.type !== 'ownship' && (
                                <div className="input-group">
                                    <label className="input-label">Platform</label>
                                    <select
                                        className="input-field"
                                        value={selectedAsset.platform && selectedAsset.platform.name ? selectedAsset.platform.name : ''}
                                        onChange={(e) => {
                                            const platformName = e.target.value;
                                            const domain = selectedAsset.domain || 'air';
                                            const domainPlatforms = (platforms && platforms[domain]) ? platforms[domain] : [];
                                            const platform = platformName ? domainPlatforms.find(p => p.name === platformName) : null;

                                            const updates = { platform };

                                            const emitterStates = {};
                                            if (platform && platform.emitters && platform.emitters.length > 0) {
                                                platform.emitters.forEach(emitter => {
                                                    emitterStates[emitter] = false;
                                                });
                                            }
                                            updates.emitterStates = emitterStates;

                                            if (platform) {
                                                const domainConfig = DOMAIN_TYPES[domain];
                                                if (selectedAsset.speed > platform.maxSpeed) {
                                                    updates.speed = platform.maxSpeed;
                                                    updates.targetSpeed = null;
                                                }
                                                if (domainConfig.hasAltitude && selectedAsset.altitude > platform.maxAltitude) {
                                                    updates.altitude = platform.maxAltitude;
                                                    updates.targetAltitude = null;
                                                }
                                            }

                                            updateAsset(selectedAsset.id, updates);
                                        }}
                                    >
                                        <option value="">None (Generic)</option>
                                        {(platforms && platforms[selectedAsset.domain || 'air'] ? platforms[selectedAsset.domain || 'air'] : []).map((platform, idx) => (
                                            <option key={idx} value={platform.name}>{platform.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="input-group">
                                <label className="input-label">
                                    Heading (degrees)
                                    {selectedAsset && (
                                        <span style={{ float: 'right', opacity: 0.7, fontSize: '8px' }}>
                                            Current: {Math.round(selectedAsset.heading)}°
                                            {selectedAsset.targetHeading !== null && ` → ${Math.round(selectedAsset.targetHeading)}°`}
                                        </span>
                                    )}
                                </label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        className="input-field"
                                        type="number"
                                        min="0"
                                        max="359"
                                        value={editValues.heading || 0}
                                        onChange={(e) => {
                                            handleUpdate('heading', e.target.value);
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyTarget('heading');
                                                e.target.style.color = '#00FF00';
                                            }
                                        }}
                                        style={{ flex: 1, color: '#00FF00' }}
                                    />
                                    <button
                                        className="control-btn"
                                        onClick={() => applyTarget('heading')}
                                        style={{ flex: '0 0 auto', padding: '10px 15px', fontSize: '9px' }}
                                    >
                                        SET
                                    </button>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">
                                    Speed (KTAS)
                                    {selectedAsset && (
                                        <span style={{ float: 'right', opacity: 0.7, fontSize: '8px' }}>
                                            Current: {Math.round(selectedAsset.speed)} kts
                                            {selectedAsset.targetSpeed !== null && ` → ${Math.round(selectedAsset.targetSpeed)} kts`}
                                        </span>
                                    )}
                                </label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        className="input-field"
                                        type="number"
                                        min="0"
                                        value={editValues.speed || 0}
                                        onChange={(e) => {
                                            handleUpdate('speed', e.target.value);
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                applyTarget('speed');
                                                e.target.style.color = '#00FF00';
                                            }
                                        }}
                                        style={{ flex: 1, color: '#00FF00' }}
                                    />
                                    <button
                                        className="control-btn"
                                        onClick={() => applyTarget('speed')}
                                        style={{ flex: '0 0 auto', padding: '10px 15px', fontSize: '9px' }}
                                    >
                                        SET
                                    </button>
                                </div>
                            </div>

                            {(selectedAsset.domain === 'air' || !selectedAsset.domain) && (
                                <div className="input-group">
                                    <label className="input-label">
                                        Altitude (feet)
                                        {selectedAsset && (
                                            <span style={{ float: 'right', opacity: 0.7, fontSize: '8px' }}>
                                                Current: FL{Math.round(selectedAsset.altitude / 100)}
                                                {selectedAsset.targetAltitude !== null && ` → FL${Math.round(selectedAsset.targetAltitude / 100)}`}
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            className="input-field"
                                            type="number"
                                            min="0"
                                            value={editValues.altitude || 0}
                                            onChange={(e) => {
                                                handleUpdate('altitude', e.target.value);
                                                e.target.style.color = '#00BFFF';
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    applyTarget('altitude');
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }}
                                            style={{ flex: 1, color: '#00FF00' }}
                                        />
                                        <button
                                            className="control-btn"
                                            onClick={() => applyTarget('altitude')}
                                            style={{ flex: '0 0 auto', padding: '10px 15px', fontSize: '9px' }}
                                        >
                                            SET
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="input-group">
                                <label className="input-label">Latitude</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editValues.lat || ''}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, lat: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            applyAssetCoordinate('lat');
                                        }
                                    }}
                                    placeholder="N26 30.0"
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Longitude</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editValues.lon || ''}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, lon: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            applyAssetCoordinate('lon');
                                        }
                                    }}
                                    placeholder="E054 00.0"
                                />
                            </div>

                            {selectedAsset.domain === 'subSurface' && (
                                <div className="input-group">
                                    <label className="input-label">
                                        Depth (feet)
                                        {selectedAsset && (
                                            <span style={{ float: 'right', opacity: 0.7, fontSize: '8px' }}>
                                                Current: {Math.round(selectedAsset.depth || 0)}ft
                                                {selectedAsset.targetDepth !== null && ` → ${Math.round(selectedAsset.targetDepth)}ft`}
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            className="input-field"
                                            type="number"
                                            min="0"
                                            value={editValues.depth || 0}
                                            onChange={(e) => {
                                                handleUpdate('depth', e.target.value);
                                                e.target.style.color = '#00BFFF';
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    applyTarget('depth');
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }}
                                            style={{ flex: 1, color: '#00FF00' }}
                                        />
                                        <button
                                            className="control-btn"
                                            onClick={() => applyTarget('depth')}
                                            style={{ flex: '0 0 auto', padding: '10px 15px', fontSize: '9px' }}
                                        >
                                            SET
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* IFF TAB */}
                    {selectedAssetTab === 'iff' && (
                        <div className="input-group">
                            <label className="input-label">IFF Codes</label>
                            <div style={{ padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                                {/* IFF Squawking Toggle */}
                                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '10px', opacity: 0.8 }}>Squawking</span>
                                    <button
                                        className="control-btn"
                                        style={{
                                            padding: '6px 8px',
                                            fontSize: '9px',
                                            minWidth: '45px',
                                            background: selectedAsset.iffSquawking ? '#00FF00' : '#FF0000',
                                            color: '#000',
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() => {
                                            updateAsset(selectedAsset.id, { iffSquawking: !selectedAsset.iffSquawking });
                                        }}
                                    >
                                        {selectedAsset.iffSquawking ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                {/* MODE I */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        MODE I (2 digit octal)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.iffModeI || ''}
                                        key={`asset-mode1-${selectedAsset.id}-${selectedAsset.iffModeI}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,2}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,2}$/.test(val)) {
                                                    // Pad with zeros to 2 digits
                                                    const padded = val.padStart(2, '0');
                                                    updateAsset(selectedAsset.id, { iffModeI: padded });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="00 (press Enter)"
                                        maxLength="2"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* MODE II */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        MODE II (4 digit octal)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.iffModeII || ''}
                                        key={`asset-mode2-${selectedAsset.id}-${selectedAsset.iffModeII}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,4}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,4}$/.test(val)) {
                                                    // Pad with zeros to 4 digits
                                                    const padded = val.padStart(4, '0');
                                                    updateAsset(selectedAsset.id, { iffModeII: padded });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="0000 (press Enter)"
                                        maxLength="4"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* MODE III */}
                                <div>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        MODE III (4 digit octal)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.iffModeIII || ''}
                                        key={`asset-mode3-${selectedAsset.id}-${selectedAsset.iffModeIII}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!/^[0-7]{0,4}$/.test(val)) {
                                                e.target.value = e.target.value.slice(0, -1);
                                            }
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^[0-7]{0,4}$/.test(val)) {
                                                    // Pad with zeros to 4 digits
                                                    const padded = val.padStart(4, '0');
                                                    updateAsset(selectedAsset.id, { iffModeIII: padded });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="0000 (press Enter)"
                                        maxLength="4"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DATALINK TAB */}
                    {selectedAssetTab === 'datalink' && (
                        <div className="input-group">
                            <label className="input-label">Datalink</label>
                            <div style={{ padding: '10px', background: '#2a2a2a', borderRadius: '3px' }}>
                                {/* NET */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        NET (1-127)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.datalinkNet || ''}
                                        onChange={(e) => {
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                const num = parseInt(val);
                                                if (val !== '' && num >= 1 && num <= 127) {
                                                    updateAsset(selectedAsset.id, { datalinkNet: val });
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    updateAsset(selectedAsset.id, { datalinkNet: '' });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="1 (press Enter)"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* JU Code */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        JU (5 digits)
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.datalinkJU || ''}
                                        onChange={(e) => {
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^\d{1,5}$/.test(val)) {
                                                    updateAsset(selectedAsset.id, { datalinkJU: val.padStart(5, '0') });
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    updateAsset(selectedAsset.id, { datalinkJU: '' });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="00000 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* Track Block Start */}
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        Track Block Start
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.datalinkTrackBlockStart || ''}
                                        onChange={(e) => {
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                if (/^\d{1,5}$/.test(val)) {
                                                    updateAsset(selectedAsset.id, { datalinkTrackBlockStart: val });
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    updateAsset(selectedAsset.id, { datalinkTrackBlockStart: '' });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="60000 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* Track Block End */}
                                <div>
                                    <label style={{ fontSize: '9px', opacity: 0.7, display: 'block', marginBottom: '3px' }}>
                                        Track Block End
                                    </label>
                                    <input
                                        className="input-field"
                                        type="text"
                                        defaultValue={selectedAsset.datalinkTrackBlockEnd || ''}
                                        onChange={(e) => {
                                            e.target.style.color = '#00BFFF';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                const num = parseInt(val);
                                                const startNum = parseInt(selectedAsset.datalinkTrackBlockStart);
                                                if (/^\d{1,5}$/.test(val) && num > startNum) {
                                                    updateAsset(selectedAsset.id, { datalinkTrackBlockEnd: val });
                                                    e.target.style.color = '#00FF00';
                                                } else {
                                                    e.target.value = '';
                                                    updateAsset(selectedAsset.id, { datalinkTrackBlockEnd: '' });
                                                    e.target.style.color = '#00FF00';
                                                }
                                            }
                                        }}
                                        placeholder="60200 (press Enter)"
                                        maxLength="5"
                                        style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', color: '#00FF00' }}
                                    />
                                </div>

                                {/* Status */}
                                {selectedAsset.datalinkActive && (
                                    <div style={{ marginTop: '10px', fontSize: '9px', opacity: 0.7, padding: '5px', background: '#1a1a1a', borderRadius: '3px' }}>
                                        <div>Status: ACTIVE</div>
                                        {selectedAsset.datalinkAssignedTrack && (
                                            <div>Track: {selectedAsset.datalinkAssignedTrack}</div>
                                        )}
                                        {selectedAsset.datalinkJU && selectedAsset.datalinkJU.length === 5 && (
                                            <div>JU: {selectedAsset.datalinkJU}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* EMITTER TAB */}
                    {selectedAssetTab === 'emitter' && (
                        <div className="input-group">
                            <label className="input-label">Emitters</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedAsset.platform && selectedAsset.platform.emitters && selectedAsset.platform.emitters.length > 0 ? (
                                    selectedAsset.platform.emitters.map((emitter, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: '#2a2a2a', borderRadius: '3px', gap: '10px' }}>
                                            <span style={{ fontSize: '10px', opacity: 0.8, flex: 1 }}>{emitter}</span>
                                            <button
                                                className="control-btn"
                                                style={{
                                                    padding: '6px 8px',
                                                    fontSize: '9px',
                                                    minWidth: '45px',
                                                    width: '45px',
                                                    height: '28px',
                                                    background: selectedAsset.emitterStates && selectedAsset.emitterStates[emitter] ? '#00FF00' : '#FF0000',
                                                    color: '#000',
                                                    fontWeight: 'bold',
                                                    flexShrink: 0
                                                }}
                                                onClick={() => {
                                                    const newEmitterStates = {
                                                        ...(selectedAsset.emitterStates || {}),
                                                        [emitter]: !(selectedAsset.emitterStates && selectedAsset.emitterStates[emitter])
                                                    };
                                                    updateAsset(selectedAsset.id, { emitterStates: newEmitterStates });
                                                }}
                                            >
                                                {selectedAsset.emitterStates && selectedAsset.emitterStates[emitter] ? 'ON' : 'OFF'}
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '10px', opacity: 0.5, fontSize: '10px', textAlign: 'center' }}>
                                        No emitters available
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="playback-controls" style={{ marginTop: '10px' }}>
                        {selectedAsset.type !== 'ownship' && (
                            <>
                                <button className="control-btn" onClick={() => reportTrack(selectedAsset.id)}>
                                    REPORT TRACK
                                </button>
                                <button className="control-btn danger" onClick={() => deleteAsset(selectedAsset.id)}>
                                    DELETE
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

function ContextMenu({ contextMenu, setContextMenu, selectedAsset, addAsset, addWaypoint, deleteWaypoint, addGeoPoint, deleteGeoPoint, startCreatingShape, deleteShape, platforms, setShowPlatformDialog, deleteManualBearingLine, assets, weaponInventory, weaponConfigs, fireWeapon, setSelectedTargetAssetId, setSelectedWeaponType }) {
    const [showDomainSubmenu, setShowDomainSubmenu] = useState(false);
    const [showGeoPointSubmenu, setShowGeoPointSubmenu] = useState(false);
    const [showShapeSubmenu, setShowShapeSubmenu] = useState(false);
    const [showEngageSubmenu, setShowEngageSubmenu] = useState(false);

    if (!contextMenu) return null;

    const handleClick = (action, param = null) => {
        switch (action) {
            case 'selectDomain':
                // Open platform selection dialog for the selected domain
                setShowPlatformDialog({
                    domain: param,
                    lat: contextMenu.lat,
                    lon: contextMenu.lon
                });
                setContextMenu(null);
                break;
            case 'addAsset':
                // param can be { domain: 'air', platform: platformObject } or just domain string
                const domain = typeof param === 'object' ? param.domain : param;
                const platform = typeof param === 'object' ? param.platform : null;
                addAsset({ lat: contextMenu.lat, lon: contextMenu.lon, domain, platform });
                break;
            case 'goTo':
                addWaypoint(selectedAsset.id, contextMenu.lat, contextMenu.lon, true);
                break;
            case 'addWaypoint':
                addWaypoint(selectedAsset.id, contextMenu.lat, contextMenu.lon, false);
                break;
            case 'deleteWaypoint':
                deleteWaypoint(contextMenu.assetId, contextMenu.waypointIndex);
                break;
            case 'createGeoPoint':
                addGeoPoint(contextMenu.lat, contextMenu.lon, param);
                break;
            case 'deleteGeoPoint':
                deleteGeoPoint(contextMenu.geoPointId);
                break;
            case 'createShape':
                startCreatingShape(param, contextMenu.lat, contextMenu.lon);
                break;
            case 'deleteShape':
                deleteShape(contextMenu.shapeId);
                break;
            case 'deleteManualBearingLine':
                deleteManualBearingLine(contextMenu.id);
                break;
        }
        setContextMenu(null);
        setShowDomainSubmenu(false);
        setShowGeoPointSubmenu(false);
        setShowShapeSubmenu(false);
    };

    return (
        <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
        >
            {contextMenu.type === 'empty' && (
                <>
                    <div
                        className="context-menu-item context-menu-parent"
                        onMouseEnter={() => setShowDomainSubmenu(true)}
                        onMouseLeave={() => setShowDomainSubmenu(false)}
                    >
                        Create Asset ›
                        {showDomainSubmenu && (
                            <div className="context-menu-submenu">
                                {Object.entries(DOMAIN_TYPES).map(([domainKey, domainConfig]) => (
                                    <div
                                        key={domainKey}
                                        className="context-menu-item"
                                        onClick={() => handleClick('selectDomain', domainKey)}
                                    >
                                        {domainConfig.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div
                        className="context-menu-item context-menu-parent"
                        onMouseEnter={() => setShowGeoPointSubmenu(true)}
                        onMouseLeave={() => setShowGeoPointSubmenu(false)}
                    >
                        Create Geo-Point ›
                        {showGeoPointSubmenu && (
                            <div className="context-menu-submenu">
                                {Object.entries(GEOPOINT_TYPES).map(([key, config]) => (
                                    <div
                                        key={key}
                                        className="context-menu-item"
                                        onClick={() => handleClick('createGeoPoint', key)}
                                    >
                                        {config.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div
                        className="context-menu-item context-menu-parent"
                        onMouseEnter={() => setShowShapeSubmenu(true)}
                        onMouseLeave={() => setShowShapeSubmenu(false)}
                    >
                        Create Shape ›
                        {showShapeSubmenu && (
                            <div className="context-menu-submenu">
                                {Object.entries(SHAPE_TYPES).map(([key, config]) => (
                                    <div
                                        key={key}
                                        className="context-menu-item"
                                        onClick={() => handleClick('createShape', key)}
                                    >
                                        {config.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {contextMenu.type === 'asset' && !selectedAsset?.waypoints.length && (
                <div className="context-menu-item" onClick={() => handleClick('goTo')}>
                    Go To
                </div>
            )}

            {contextMenu.type === 'asset' && selectedAsset?.waypoints.length > 0 && (
                <div className="context-menu-item" onClick={() => handleClick('addWaypoint')}>
                    Add Waypoint
                </div>
            )}

            {contextMenu.type === 'waypoint' && (
                <div className="context-menu-item" onClick={() => handleClick('deleteWaypoint')}>
                    Delete Waypoint
                </div>
            )}

            {contextMenu.type === 'geopoint' && (
                <div className="context-menu-item" onClick={() => handleClick('deleteGeoPoint')}>
                    Delete Geo-Point
                </div>
            )}

            {contextMenu.type === 'shape' && (
                <div className="context-menu-item" onClick={() => handleClick('deleteShape')}>
                    Delete Shape
                </div>
            )}

            {contextMenu.type === 'manualBearingLine' && (
                <div className="context-menu-item" onClick={() => handleClick('deleteManualBearingLine')}>
                    Delete M{contextMenu.serialNumber.toString().padStart(2, '0')}
                </div>
            )}

            {contextMenu.type === 'targetWith' && (
                <div
                    className="context-menu-item context-menu-parent"
                    onMouseEnter={() => setShowEngageSubmenu(true)}
                    onMouseLeave={() => setShowEngageSubmenu(false)}
                >
                    Target With ›
                    {showEngageSubmenu && (
                        <div className="context-menu-submenu">
                            {(() => {
                                const ownship = assets.find(a => a.type === 'ownship');
                                const targetAsset = assets.find(a => a.id === contextMenu.targetAssetId);
                                if (!ownship || !targetAsset) return null;

                                const availableWeapons = getAvailableWeapons(ownship, targetAsset, weaponInventory, weaponConfigs);

                                if (availableWeapons.length === 0) {
                                    return (
                                        <div className="context-menu-item" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                            No Compatible Weapons
                                        </div>
                                    );
                                }

                                return availableWeapons.map(weaponType => (
                                    <div
                                        key={weaponType}
                                        className="context-menu-item"
                                        onClick={() => {
                                            setSelectedTargetAssetId(contextMenu.targetAssetId);
                                            setSelectedWeaponType(weaponType);
                                            setContextMenu(null);
                                            setShowEngageSubmenu(false);
                                        }}
                                    >
                                        {weaponType}
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            )}

            {contextMenu.type === 'engage' && (
                <div
                    className="context-menu-item context-menu-parent"
                    onMouseEnter={() => setShowEngageSubmenu(true)}
                    onMouseLeave={() => setShowEngageSubmenu(false)}
                >
                    Engage with ›
                    {showEngageSubmenu && (
                        <div className="context-menu-submenu">
                            {(() => {
                                const firingAsset = assets.find(a => a.id === contextMenu.firingAssetId);
                                const targetAsset = assets.find(a => a.id === contextMenu.targetAssetId);
                                if (!firingAsset || !targetAsset) return null;

                                const availableWeapons = getAvailableWeapons(firingAsset, targetAsset, weaponInventory, weaponConfigs);

                                if (availableWeapons.length === 0) {
                                    return (
                                        <div className="context-menu-item" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                            No Compatible Weapons
                                        </div>
                                    );
                                }

                                return availableWeapons.map(weaponType => (
                                    <div
                                        key={weaponType}
                                        className="context-menu-item"
                                        onClick={() => {
                                            fireWeapon(contextMenu.firingAssetId, contextMenu.targetAssetId, weaponType);
                                            setContextMenu(null);
                                            setShowEngageSubmenu(false);
                                        }}
                                    >
                                        {weaponType}
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// DIALOG COMPONENTS
// ============================================================================

function AddAssetDialog({ initialData, platforms, onClose, onAdd }) {
    const [formData, setFormData] = useState({
        name: `Asset ${Date.now()}`,
        type: 'unknown',
        domain: 'air',
        platformName: '',
        heading: 0,
        speed: 350,
        altitude: 25000,
        ...initialData
    });

    // Get platforms for selected domain
    const availablePlatforms = platforms && platforms[formData.domain] ? platforms[formData.domain] : [];

    // Handle domain change
    const handleDomainChange = (newDomain) => {
        const newPlatforms = platforms && platforms[newDomain] ? platforms[newDomain] : [];
        setFormData({
            ...formData,
            domain: newDomain,
            platformName: newPlatforms.length > 0 ? newPlatforms[0].name : '',
            // Set appropriate altitude for domain
            altitude: newDomain === 'surface' || newDomain === 'subSurface' ? 0 : 25000
        });
    };

    // Handle add with platform data
    const handleAdd = () => {
        const selectedPlatform = availablePlatforms.find(p => p.name === formData.platformName);
        onAdd({
            ...formData,
            platform: selectedPlatform
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>ADD NEW ASSET</h2>

                <div className="input-group">
                    <label className="input-label">Name</label>
                    <input
                        className="input-field"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Type</label>
                    <select
                        className="input-field"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                        <option value="friendly">Friendly</option>
                        <option value="hostile">Hostile</option>
                        <option value="neutral">Neutral</option>
                        <option value="unknown">Unknown</option>
                        <option value="unknownUnevaluated">Unknown Unevaluated</option>
                    </select>
                </div>

                <div className="input-group">
                    <label className="input-label">Domain</label>
                    <select
                        className="input-field"
                        value={formData.domain}
                        onChange={(e) => handleDomainChange(e.target.value)}
                    >
                        <option value="air">Air</option>
                        <option value="surface">Surface</option>
                        <option value="subSurface">Sub-Surface</option>
                    </select>
                </div>

                <div className="input-group">
                    <label className="input-label">Platform</label>
                    <select
                        className="input-field"
                        value={formData.platformName}
                        onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
                    >
                        {availablePlatforms.map(platform => (
                            <option key={platform.name} value={platform.name}>
                                {platform.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="input-group">
                    <label className="input-label">Heading (degrees)</label>
                    <input
                        className="input-field"
                        type="number"
                        min="0"
                        max="359"
                        value={formData.heading}
                        onChange={(e) => setFormData({ ...formData, heading: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Speed (KTAS)</label>
                    <input
                        className="input-field"
                        type="number"
                        min="0"
                        value={formData.speed}
                        onChange={(e) => setFormData({ ...formData, speed: parseFloat(e.target.value) })}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Altitude (feet)</label>
                    <input
                        className="input-field"
                        type="number"
                        min="0"
                        value={formData.altitude}
                        onChange={(e) => setFormData({ ...formData, altitude: parseFloat(e.target.value) })}
                        disabled={formData.domain === 'surface' || formData.domain === 'subSurface'}
                    />
                </div>

                <div className="modal-buttons">
                    <button className="control-btn" onClick={onClose}>CANCEL</button>
                    <button className="control-btn primary" onClick={handleAdd}>ADD</button>
                </div>
            </div>
        </div>
    );
}

function SaveDialog({ onClose, saveToLocalStorage, saveToFile }) {
    const [saveName, setSaveName] = useState(`Scenario-${new Date().toISOString().split('T')[0]}`);
    const [saveType, setSaveType] = useState('app');

    const handleSave = () => {
        if (saveType === 'app') {
            saveToLocalStorage(saveName);
        } else {
            saveToFile(saveName);
        }
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>SAVE SCENARIO</h2>

                <div className="input-group">
                    <label className="input-label">Scenario Name</label>
                    <input
                        className="input-field"
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Save Location</label>
                    <select
                        className="input-field"
                        value={saveType}
                        onChange={(e) => setSaveType(e.target.value)}
                    >
                        <option value="app">Save to Application (localStorage)</option>
                        <option value="file">Download to Computer (JSON file)</option>
                    </select>
                </div>

                <div className="modal-buttons">
                    <button className="control-btn" onClick={onClose}>CANCEL</button>
                    <button className="control-btn primary" onClick={handleSave}>SAVE</button>
                </div>
            </div>
        </div>
    );
}

function LoadDialog({ onClose, loadFromLocalStorage, loadFromFile, getSavedScenarios, deleteFromLocalStorage }) {
    const [loadType, setLoadType] = useState('app');
    const [scenarios, setScenarios] = useState([]);

    useEffect(() => {
        setScenarios(getSavedScenarios());
    }, [getSavedScenarios]);

    const handleDelete = (name, e) => {
        e.stopPropagation();
        if (confirm(`Delete scenario "${name}"?`)) {
            deleteFromLocalStorage(name);
            setScenarios(getSavedScenarios());
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>LOAD SCENARIO</h2>

                <div className="input-group">
                    <label className="input-label">Load From</label>
                    <select
                        className="input-field"
                        value={loadType}
                        onChange={(e) => setLoadType(e.target.value)}
                    >
                        <option value="app">Application (localStorage)</option>
                        <option value="file">Computer (JSON file)</option>
                    </select>
                </div>

                {loadType === 'app' ? (
                    <div className="save-list">
                        {scenarios.length === 0 ? (
                            <div className="empty-state">No saved scenarios</div>
                        ) : (
                            scenarios.map(scenario => (
                                <div
                                    key={scenario.name}
                                    className="save-item"
                                    onClick={() => {
                                        loadFromLocalStorage(scenario.name);
                                        onClose();
                                    }}
                                >
                                    <div className="save-item-info">
                                        <div className="save-item-name">{scenario.name}</div>
                                        <div className="save-item-date">
                                            {new Date(scenario.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    <button
                                        className="delete-save-btn"
                                        onClick={(e) => handleDelete(scenario.name, e)}
                                    >
                                        DELETE
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="file-input-wrapper">
                        <input
                            type="file"
                            accept=".json"
                            onChange={(e) => {
                                loadFromFile(e);
                                onClose();
                            }}
                            id="file-input"
                        />
                        <label htmlFor="file-input" className="file-input-label">
                            CHOOSE FILE
                        </label>
                    </div>
                )}

                <div className="modal-buttons">
                    <button className="control-btn full-width" onClick={onClose}>CANCEL</button>
                </div>
            </div>
        </div>
    );
}

function ControlsDialog({ onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <h2>CONTROLS & INSTRUCTIONS</h2>

                <div style={{ maxHeight: '60vh', overflowY: 'auto', fontSize: '10px', lineHeight: '1.6' }}>
                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>MOUSE CONTROLS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>Left-click on asset:</strong> Select asset to view/edit details</p>
                        <p><strong>Left-click on empty space:</strong> Place yellow reference mark</p>
                        <p><strong>Left-click + drag on selected asset:</strong> Move asset to new location</p>
                        <p><strong>Left-click + drag on waypoint:</strong> Move waypoint to new location</p>
                        <p><strong>Right-click on map:</strong> Open context menu (add assets, waypoints)</p>
                        <p><strong>Right-click on waypoint:</strong> Delete waypoint</p>
                        <p><strong>Click + drag on empty space:</strong> Pan the map view</p>
                        <p><strong>Mouse wheel:</strong> Zoom in/out (10-360 NM scale)</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>KEYBOARD SHORTCUTS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>ESC:</strong> Open pause menu</p>
                        <p><strong>Enter:</strong> Apply heading/speed/altitude value</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>ASSET MANAGEMENT</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>Add Asset:</strong> Click "+ ADD ASSET" button or right-click map → "Add Asset Here"</p>
                        <p><strong>Select Asset:</strong> Left-click on any asset symbol</p>
                        <p><strong>Edit Asset:</strong> Select asset, modify values in control panel, click SET</p>
                        <p><strong>Delete Asset:</strong> Select asset → Click "DELETE" button</p>
                        <p><strong>Move Asset:</strong> Select asset → Left-click and drag to new position</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>WAYPOINTS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>Add First Waypoint:</strong> Select asset → Right-click map → "Go To"</p>
                        <p><strong>Add Additional Waypoint:</strong> Select asset with waypoints → Right-click map → "Add Waypoint"</p>
                        <p><strong>Move Waypoint:</strong> Left-click and drag any waypoint to new location</p>
                        <p><strong>Delete Waypoint:</strong> Right-click on waypoint → "Delete Waypoint"</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>SIMULATION CONTROLS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>Play/Pause:</strong> Click PLAY/PAUSE buttons in control panel</p>
                        <p><strong>Recording:</strong> Click "○ RECORD" button in top-left to start/stop recording</p>
                        <p><strong>Save Scenario:</strong> ESC → "SAVE FILE" → Choose location</p>
                        <p><strong>Load Scenario:</strong> ESC → "LOAD FILE" → Select saved .json file</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>CURSOR READOUTS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong>FROM BULLSEYE:</strong> Bearing and range from bullseye to cursor (always visible)</p>
                        <p><strong>FROM [ASSET NAME]:</strong> Bearing and range from selected asset to cursor</p>
                        <p><strong>FROM MARK:</strong> Bearing and range from temporary mark to cursor (when no asset selected)</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>ASSET TYPES</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p><strong style={{ color: '#00BFFF' }}>Friendly:</strong> Blue circle symbol</p>
                        <p><strong style={{ color: '#FF0000' }}>Hostile:</strong> Red diamond symbol</p>
                        <p><strong style={{ color: '#FFFF00' }}>Neutral:</strong> Yellow square symbol</p>
                        <p><strong style={{ color: '#00FF00' }}>Unknown:</strong> Green triangle symbol</p>
                        <p><strong style={{ color: '#FFA500' }}>Unknown Unevaluated:</strong> Orange cross symbol</p>
                    </div>

                    <h3 style={{ color: '#00FF00', fontSize: '12px', marginTop: '15px', marginBottom: '10px' }}>TIPS</h3>
                    <div style={{ marginLeft: '10px' }}>
                        <p>• Assets default to 350 knots and 25,000 feet when created</p>
                        <p>• Selected asset shows animated selection ring</p>
                        <p>• Waypoints can be moved even if parent asset is not selected</p>
                        <p>• Dragging an asset with waypoints updates heading toward next waypoint</p>
                        <p>• Use REPORT TRACK button to get tactical air picture report</p>
                    </div>
                </div>

                <div className="modal-buttons" style={{ marginTop: '20px' }}>
                    <button className="control-btn primary full-width" onClick={onClose}>CLOSE</button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// PLATFORM SELECTION DIALOG
// ============================================================================

function PlatformSelectionDialog({ domain, platforms, onClose, onSelect }) {
    const domainConfig = DOMAIN_TYPES[domain];
    const domainPlatforms = (platforms && platforms[domain]) ? platforms[domain] : [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <h2>SELECT {domainConfig.label.toUpperCase()} PLATFORM</h2>

                <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '20px' }}>
                    {/* Option for generic asset */}
                    <div
                        className="save-item"
                        style={{ cursor: 'pointer', marginBottom: '10px' }}
                        onClick={() => onSelect(null)}
                    >
                        <div className="save-item-info">
                            <div className="save-item-name" style={{ fontWeight: 'bold' }}>None (Generic)</div>
                            <div className="save-item-date" style={{ fontSize: '9px', opacity: 0.7 }}>
                                Standard {domainConfig.label} asset with default performance
                            </div>
                        </div>
                    </div>

                    {/* Platform options */}
                    {domainPlatforms.map((platform, idx) => (
                        <div
                            key={idx}
                            className="save-item"
                            style={{ cursor: 'pointer', marginBottom: '10px' }}
                            onClick={() => onSelect(platform)}
                        >
                            <div className="save-item-info">
                                <div className="save-item-name">{platform.name}</div>
                                <div className="save-item-date" style={{ fontSize: '9px', opacity: 0.7 }}>
                                    Max Speed: {platform.maxSpeed} kts
                                    {platform.maxAltitude > 0 && ` | Max Alt: ${platform.maxAltitude} ft`}
                                    {platform.weapons && platform.weapons.length > 0 && ` | Weapons: ${platform.weapons.length}`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="modal-buttons" style={{ marginTop: '20px' }}>
                    <button className="control-btn full-width" onClick={onClose}>CANCEL</button>
                </div>
            </div>
        </div>
    );
}

function PauseMenu({ onResume, onSave, onLoad, onControls }) {
    return (
        <div className="modal-overlay">
            <div className="pause-menu">
                <h2>PAUSED</h2>
                <div className="pause-menu-buttons">
                    <button className="control-btn primary" onClick={onResume}>RESUME</button>
                    <button className="control-btn" onClick={onSave}>SAVE FILE</button>
                    <button className="control-btn" onClick={onLoad}>LOAD FILE</button>
                    <button className="control-btn" onClick={onControls}>
                        CONTROLS
                    </button>
                    <button className="control-btn danger" onClick={() => {
                        if (confirm('Quit simulator?')) window.close();
                    }}>
                        QUIT
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// RENDER APPLICATION
// ============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AICSimulator />);
