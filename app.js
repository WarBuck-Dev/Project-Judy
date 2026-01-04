const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const BULLSEYE = { lat: 26.5, lon: 54.0 };
const INITIAL_SCALE = 100; // nautical miles
const MIN_SCALE = 10;
const MAX_SCALE = 360;
const PHYSICS_UPDATE_RATE = 1000 / 60; // 60 Hz
const WAYPOINT_ARRIVAL_THRESHOLD = 0.5; // nautical miles

// Asset type configurations
const ASSET_TYPES = {
    friendly: { color: '#00BFFF', badge: 'FRD', shape: 'circle' },
    hostile: { color: '#FF0000', badge: 'HST', shape: 'diamond' },
    neutral: { color: '#00FF00', badge: 'NEU', shape: 'square' },
    unknown: { color: '#FFFF00', badge: 'UNK', shape: 'square' },
    unknownUnevaluated: { color: '#FFA500', badge: 'UNU', shape: 'square' }
};

// Turn/climb/speed rates
const TURN_RATE = 15; // degrees per second
const SPEED_RATE = 10; // knots per second
const CLIMB_RATE = 100; // feet per second (6000 ft/min)

// ============================================================================
// UTILITY FUNCTIONS - NAVIGATION AND PHYSICS
// ============================================================================

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
    const [assets, setAssets] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [scale, setScale] = useState(INITIAL_SCALE);
    const [mapCenter, setMapCenter] = useState(BULLSEYE);
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
    const [bullseyeSelected, setBullseyeSelected] = useState(false);
    const [radarReturns, setRadarReturns] = useState([]);

    // Refs
    const svgRef = useRef(null);
    const physicsIntervalRef = useRef(null);
    const recordingStartTimeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const missionTimeIntervalRef = useRef(null);
    const radarReturnIntervalRef = useRef(null);

    // Get selected asset
    const selectedAsset = useMemo(() =>
        assets.find(a => a.id === selectedAssetId),
        [assets, selectedAssetId]
    );

    // ========================================================================
    // PHYSICS ENGINE
    // ========================================================================

    const updatePhysics = useCallback(() => {
        setAssets(prevAssets => prevAssets.map(asset => {
            let updated = { ...asset };
            const deltaTime = PHYSICS_UPDATE_RATE / 1000; // seconds

            // Update heading
            if (asset.targetHeading !== null) {
                const turnAmount = shortestTurn(asset.heading, asset.targetHeading);
                if (Math.abs(turnAmount) > 1) {
                    const turnDelta = Math.sign(turnAmount) * TURN_RATE * deltaTime;
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
                    const speedDelta = Math.sign(speedDiff) * SPEED_RATE * deltaTime;
                    updated.speed = asset.speed + speedDelta;
                } else {
                    updated.speed = asset.targetSpeed;
                    updated.targetSpeed = null;
                }
            }

            // Update altitude
            if (asset.targetAltitude !== null) {
                const altDiff = asset.targetAltitude - asset.altitude;
                if (Math.abs(altDiff) > 1) {
                    const altDelta = Math.sign(altDiff) * CLIMB_RATE * deltaTime;
                    updated.altitude = asset.altitude + altDelta;
                } else {
                    updated.altitude = asset.targetAltitude;
                    updated.targetAltitude = null;
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
    }, []);

    // Start/stop physics engine
    useEffect(() => {
        if (isRunning) {
            setHasStarted(true);
            physicsIntervalRef.current = setInterval(updatePhysics, PHYSICS_UPDATE_RATE);
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

    // Radar return generation - create returns every 10 seconds, fade over 30 seconds
    useEffect(() => {
        if (isRunning) {
            // Create initial radar returns immediately when starting
            const createRadarReturns = () => {
                setAssets(currentAssets => {
                    setMissionTime(currentMissionTime => {
                        const newReturns = currentAssets.map(asset => ({
                            assetId: asset.id,
                            lat: asset.lat,
                            lon: asset.lon,
                            missionTime: currentMissionTime,
                            id: `${asset.id}-${currentMissionTime}`
                        }));
                        setRadarReturns(prev => [...prev, ...newReturns]);
                        return currentMissionTime;
                    });
                    return currentAssets;
                });
            };

            createRadarReturns();

            // Create radar returns every 10 seconds
            radarReturnIntervalRef.current = setInterval(createRadarReturns, 10000);
        } else {
            if (radarReturnIntervalRef.current) {
                clearInterval(radarReturnIntervalRef.current);
            }
        }

        return () => {
            if (radarReturnIntervalRef.current) {
                clearInterval(radarReturnIntervalRef.current);
            }
        };
    }, [isRunning]);

    // Clean up old radar returns (older than 30 seconds of mission time)
    useEffect(() => {
        if (isRunning) {
            setRadarReturns(prev => prev.filter(ret => missionTime - ret.missionTime < 30));
        }
    }, [missionTime, isRunning]);

    // ========================================================================
    // ASSET MANAGEMENT
    // ========================================================================

    const addAsset = useCallback((assetData) => {
        const newAsset = {
            id: nextAssetId,
            name: assetData.name || `Asset ${nextAssetId}`,
            type: assetData.type || 'unknown',
            lat: assetData.lat || BULLSEYE.lat,
            lon: assetData.lon || BULLSEYE.lon,
            heading: assetData.heading || 0,
            speed: assetData.speed !== undefined ? assetData.speed : 350,
            altitude: assetData.altitude !== undefined ? assetData.altitude : 25000,
            targetHeading: null,
            targetSpeed: null,
            targetAltitude: null,
            waypoints: [],
            trackNumber: null
        };

        setAssets(prev => [...prev, newAsset]);
        setNextAssetId(prev => prev + 1);
        setSelectedAssetId(newAsset.id);
    }, [nextAssetId]);

    const deleteAsset = useCallback((assetId) => {
        setAssets(prev => prev.filter(a => a.id !== assetId));
        if (selectedAssetId === assetId) {
            setSelectedAssetId(null);
        }
    }, [selectedAssetId]);

    const centerMapOnAsset = useCallback((assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            setMapCenter({ lat: asset.lat, lon: asset.lon });
        }
    }, [assets]);

    const updateAsset = useCallback((assetId, updates) => {
        setAssets(prev => prev.map(a =>
            a.id === assetId ? { ...a, ...updates } : a
        ));
    }, []);

    const reportTrack = useCallback((assetId) => {
        const asset = assets.find(a => a.id === assetId);
        // Only assign a track number if the asset doesn't already have one
        if (asset && asset.trackNumber === null) {
            updateAsset(assetId, { trackNumber: nextTrackNumber });
            setNextTrackNumber(prev => prev + 1);
        }
    }, [nextTrackNumber, updateAsset, assets]);

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
            bullseye: BULLSEYE,
            bullseyeName,
            scale,
            mapCenter,
            tempMark,
            nextTrackNumber,
            missionTime
        };

        localStorage.setItem(`aic-scenario-${name}`, JSON.stringify(saveData));
        alert(`Scenario saved to application: ${name}`);
    }, [assets, bullseyeName, scale, mapCenter, tempMark, nextTrackNumber, missionTime]);

    const saveToFile = useCallback((name) => {
        const saveData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            assets,
            bullseye: BULLSEYE,
            bullseyeName,
            scale,
            mapCenter,
            tempMark,
            nextTrackNumber,
            missionTime
        };

        const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [assets, bullseyeName, scale, mapCenter, tempMark, nextTrackNumber, missionTime]);

    const loadFromLocalStorage = useCallback((name) => {
        const data = localStorage.getItem(`aic-scenario-${name}`);
        if (data) {
            const saveData = JSON.parse(data);
            setAssets(saveData.assets || []);
            setScale(saveData.scale || INITIAL_SCALE);
            setMapCenter(saveData.mapCenter || BULLSEYE);
            setTempMark(saveData.tempMark || null);
            setNextTrackNumber(saveData.nextTrackNumber || 6000);
            setSelectedAssetId(null);
            setBullseyeSelected(false);
            setHasStarted(true);
            setMissionTime(saveData.missionTime || 0);
            setBullseyeName(saveData.bullseyeName || '');

            // Find max asset ID
            const maxId = saveData.assets.reduce((max, a) => Math.max(max, a.id), 0);
            setNextAssetId(maxId + 1);

            // Save as initial scenario for restart
            setInitialScenario({
                assets: JSON.parse(JSON.stringify(saveData.assets || [])),
                scale: saveData.scale || INITIAL_SCALE,
                mapCenter: saveData.mapCenter || BULLSEYE,
                tempMark: saveData.tempMark || null,
                nextTrackNumber: saveData.nextTrackNumber || 6000,
                nextAssetId: maxId + 1
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
                    setAssets(saveData.assets || []);
                    setScale(saveData.scale || INITIAL_SCALE);
                    setMapCenter(saveData.mapCenter || BULLSEYE);
                    setTempMark(saveData.tempMark || null);
                    setNextTrackNumber(saveData.nextTrackNumber || 6000);
                    setSelectedAssetId(null);
                    setBullseyeSelected(false);
                    setHasStarted(true);
                    setMissionTime(saveData.missionTime || 0);
                    setBullseyeName(saveData.bullseyeName || '');

                    const maxId = saveData.assets.reduce((max, a) => Math.max(max, a.id), 0);
                    setNextAssetId(maxId + 1);

                    // Save as initial scenario for restart
                    setInitialScenario({
                        assets: JSON.parse(JSON.stringify(saveData.assets || [])),
                        scale: saveData.scale || INITIAL_SCALE,
                        mapCenter: saveData.mapCenter || BULLSEYE,
                        tempMark: saveData.tempMark || null,
                        nextTrackNumber: saveData.nextTrackNumber || 6000,
                        nextAssetId: maxId + 1
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
            setSelectedAssetId(null);
            setIsRunning(false);
            setMissionTime(0);
            setRadarReturns([]);
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

        // Check if clicking on the bullseye
        const bullseyePos = latLonToScreen(BULLSEYE.lat, BULLSEYE.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        const bullseyeDist = Math.sqrt((x - bullseyePos.x) ** 2 + (y - bullseyePos.y) ** 2);
        if (bullseyeDist < 15) {
            // Already handled in handleMouseDown, don't do anything
            return;
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

        if (clickedAsset) {
            setSelectedAssetId(clickedAsset.id);
            setBullseyeSelected(false);
            setTempMark(null);
        } else {
            // Place temporary mark
            const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
            setTempMark(latLon);
            setSelectedAssetId(null);
            setBullseyeSelected(false);
        }
    }, [assets, contextMenu, mapCenter, scale]);

    const handleSVGRightClick = useCallback((e) => {
        e.preventDefault();

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);

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

        // Context menu for asset or empty space
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: selectedAsset ? 'asset' : 'empty',
            lat: latLon.lat,
            lon: latLon.lon
        });
    }, [selectedAsset, assets, mapCenter, scale]);

    const handleMouseMove = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const latLon = screenToLatLon(x, y, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        setCursorPos(latLon);

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
    }, [mapCenter, scale, isDragging, dragStart, draggedWaypoint, draggedAssetId, assets, moveWaypoint, updateAsset]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return; // Only left click

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on the bullseye
        const bullseyePos = latLonToScreen(BULLSEYE.lat, BULLSEYE.lon, mapCenter.lat, mapCenter.lon, scale, rect.width, rect.height);
        const bullseyeDist = Math.sqrt((x - bullseyePos.x) ** 2 + (y - bullseyePos.y) ** 2);
        if (bullseyeDist < 15) {
            setBullseyeSelected(true);
            setSelectedAssetId(null);
            setTempMark(null);
            return;
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
                break;
            }
        }

        if (!clickedAsset) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX,
                y: e.clientY,
                centerLat: mapCenter.lat,
                centerLon: mapCenter.lon
            });
        }
    }, [assets, selectedAsset, mapCenter, scale]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragStart(null);
        setDraggedWaypoint(null);
        setDraggedAssetId(null);
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

    // Persian Gulf coastline data (simplified key points)
    const PERSIAN_GULF_COASTLINE = [
        // Kuwait/Iraq coast
        [30.0, 47.8], [29.8, 48.1], [29.5, 48.5], [29.3, 48.8],
        // Saudi Arabia eastern coast
        [28.8, 49.0], [28.0, 49.3], [27.5, 49.5], [27.0, 49.7], [26.6, 50.0], [26.2, 50.1], [25.8, 50.3],
        // Qatar peninsula
        [25.5, 51.0], [25.3, 51.3], [25.0, 51.5], [24.7, 51.4], [24.5, 51.2], [24.5, 51.0],
        // UAE coast
        [24.6, 51.5], [24.7, 52.5], [24.9, 53.5], [25.0, 54.0], [25.2, 54.5], [25.3, 55.0], [25.4, 55.5], [25.6, 56.0], [25.8, 56.3],
        // Strait of Hormuz - Oman side
        [25.9, 56.5], [26.0, 56.7], [26.2, 57.0], [26.5, 57.2],
        // Oman northern coast (back along strait)
        [26.3, 56.8], [26.0, 56.5], [25.8, 56.2],
        // Iran southern coast (Strait of Hormuz)
        [26.5, 56.0], [26.8, 55.5], [27.0, 55.0], [27.2, 54.5], [27.3, 54.0],
        // Iran western coast
        [27.5, 53.0], [27.8, 52.5], [28.0, 52.0], [28.5, 51.5], [29.0, 51.0], [29.5, 50.5], [29.8, 50.0], [30.0, 49.5], [30.2, 49.0], [30.3, 48.5], [30.2, 48.0], [30.0, 47.8]
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
        const pos = latLonToScreen(BULLSEYE.lat, BULLSEYE.lon, mapCenter.lat, mapCenter.lon, scale, width, height);
        const displayName = bullseyeName && bullseyeName.trim() ? bullseyeName.toUpperCase() : 'BE';

        return (
            <g>
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
        return (
            <g>
                {radarReturns.map(ret => {
                    const age = missionTime - ret.missionTime; // Age in seconds
                    const opacity = Math.max(0, 1 - (age / 30)); // Fade from 1 to 0 over 30 seconds
                    const pos = latLonToScreen(ret.lat, ret.lon, mapCenter.lat, mapCenter.lon, scale, width, height);

                    return (
                        <circle
                            key={ret.id}
                            cx={pos.x}
                            cy={pos.y}
                            r={4}
                            fill="#FFFFFF"
                            opacity={opacity * 0.7}
                        />
                    );
                })}
            </g>
        );
    };

    const renderAsset = (asset, width, height) => {
        const config = ASSET_TYPES[asset.type];
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

                {/* Asset symbol - MIL-STD-2525 air track (top half only) */}
                {config.shape === 'circle' ? (
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
                ) : (
                    // Neutral/Unknown/Unknown Unevaluated: Top half of square
                    <path
                        d={`M ${pos.x - size} ${pos.y} L ${pos.x - size} ${pos.y - size} L ${pos.x + size} ${pos.y - size} L ${pos.x + size} ${pos.y}`}
                        fill="none"
                        stroke={config.color}
                        strokeWidth={strokeWidth}
                    />
                )}

                {/* Name label above */}
                <text x={pos.x} y={pos.y-size-5} fill={config.color} fontSize="10"
                      textAnchor="middle" fontWeight="700">
                    {asset.name}
                </text>

                {/* Flight level and track number below */}
                <text x={pos.x} y={pos.y+size+15} fill={config.color} fontSize="9"
                      textAnchor="middle" fontWeight="700">
                    FL{Math.round(asset.altitude/100)}
                </text>
                {asset.trackNumber && (
                    <text x={pos.x} y={pos.y+size+27} fill={config.color} fontSize="8"
                          textAnchor="middle" fontWeight="700">
                        TN#{asset.trackNumber}
                    </text>
                )}

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
                            {renderCities(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderCompass(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderBullseye(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderTempMark(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {renderRadarReturns(svgRef.current.clientWidth, svgRef.current.clientHeight)}
                            {assets.map(asset => renderAsset(asset, svgRef.current.clientWidth, svgRef.current.clientHeight))}
                        </>
                    )}
                </svg>

                {/* Cursor Position Display */}
                {cursorPos && (
                    <div className="cursor-info">
                        <div className="position-box">
                            <div className="position-label">FROM {bullseyeName && bullseyeName.trim() ? bullseyeName.toUpperCase() : 'BULLSEYE'}</div>
                            <div className="position-value">
                                {Math.round(calculateBearing(BULLSEYE.lat, BULLSEYE.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/
                                {Math.round(calculateDistance(BULLSEYE.lat, BULLSEYE.lon, cursorPos.lat, cursorPos.lon))}
                            </div>
                        </div>

                        {(tempMark || selectedAsset) && (
                            <div className="position-box secondary">
                                <div className="position-label">
                                    {selectedAsset ?
                                        (selectedAsset.name && selectedAsset.name.trim() ? `FROM ${selectedAsset.name.toUpperCase()}` : 'FROM SELECTION')
                                        : 'FROM MARK'}
                                </div>
                                <div className="position-value">
                                    {selectedAsset ?
                                        `${Math.round(calculateBearing(selectedAsset.lat, selectedAsset.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/${Math.round(calculateDistance(selectedAsset.lat, selectedAsset.lon, cursorPos.lat, cursorPos.lon))}` :
                                        `${Math.round(calculateBearing(tempMark.lat, tempMark.lon, cursorPos.lat, cursorPos.lon)).toString().padStart(3, '0')}/${Math.round(calculateDistance(tempMark.lat, tempMark.lon, cursorPos.lat, cursorPos.lon))}`
                                    }
                                </div>
                            </div>
                        )}
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
                />
            )}

            {/* Add Asset Dialog */}
            {showAddAssetDialog && (
                <AddAssetDialog
                    initialData={showAddAssetDialog}
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
    restartSimulation, hasStarted, bullseyeSelected, bullseyeName, setBullseyeName
}) {
    const [editValues, setEditValues] = useState({});
    const selectedAssetIdRef = useRef(null);

    // Only update edit values when asset is first selected or when switching assets
    useEffect(() => {
        if (selectedAsset && selectedAsset.id !== selectedAssetIdRef.current) {
            selectedAssetIdRef.current = selectedAsset.id;
            setEditValues({
                name: selectedAsset.name,
                heading: Math.round(selectedAsset.heading),
                speed: Math.round(selectedAsset.speed),
                altitude: Math.round(selectedAsset.altitude)
            });
        }
    }, [selectedAsset?.id]); // Only depend on ID, not the whole asset object

    const handleUpdate = (field, value) => {
        if (field === 'name') {
            updateAsset(selectedAsset.id, { name: value });
            setEditValues(prev => ({ ...prev, name: value }));
        } else if (field === 'type') {
            updateAsset(selectedAsset.id, { type: value });
        } else {
            // For heading, speed, altitude - just update local state
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
                    <div className="input-group" style={{ marginTop: '10px', fontSize: '9px', opacity: 0.7 }}>
                        Reference point for all position calls. Enter a custom name or leave blank for default "BULLSEYE".
                    </div>
                </div>
            )}

            {/* Asset List - Only show when no asset is selected and bullseye is not selected */}
            {!selectedAsset && !bullseyeSelected && (
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
                        onClick={() => setShowAddAssetDialog({ lat: BULLSEYE.lat, lon: BULLSEYE.lon })}
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
                            value={selectedAsset.type}
                            onChange={(e) => updateAsset(selectedAsset.id, { type: e.target.value })}
                        >
                            <option value="friendly">Friendly</option>
                            <option value="hostile">Hostile</option>
                            <option value="neutral">Neutral</option>
                            <option value="unknown">Unknown</option>
                            <option value="unknownUnevaluated">Unknown Unevaluated</option>
                        </select>
                    </div>

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
                                onChange={(e) => handleUpdate('heading', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyTarget('heading')}
                                style={{ flex: 1 }}
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
                                onChange={(e) => handleUpdate('speed', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyTarget('speed')}
                                style={{ flex: 1 }}
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
                                onChange={(e) => handleUpdate('altitude', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyTarget('altitude')}
                                style={{ flex: 1 }}
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

                    <div className="playback-controls" style={{ marginTop: '10px' }}>
                        <button className="control-btn" onClick={() => reportTrack(selectedAsset.id)}>
                            REPORT TRACK
                        </button>
                        <button className="control-btn danger" onClick={() => deleteAsset(selectedAsset.id)}>
                            DELETE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

function ContextMenu({ contextMenu, setContextMenu, selectedAsset, addAsset, addWaypoint, deleteWaypoint }) {
    if (!contextMenu) return null;

    const handleClick = (action) => {
        switch (action) {
            case 'addAsset':
                addAsset({ lat: contextMenu.lat, lon: contextMenu.lon });
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
        }
        setContextMenu(null);
    };

    return (
        <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
        >
            {contextMenu.type === 'empty' && (
                <div className="context-menu-item" onClick={() => handleClick('addAsset')}>
                    Add Asset Here
                </div>
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
        </div>
    );
}

// ============================================================================
// DIALOG COMPONENTS
// ============================================================================

function AddAssetDialog({ initialData, onClose, onAdd }) {
    const [formData, setFormData] = useState({
        name: `Asset ${Date.now()}`,
        type: 'unknown',
        heading: 0,
        speed: 350,
        altitude: 25000,
        ...initialData
    });

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
                    />
                </div>

                <div className="modal-buttons">
                    <button className="control-btn" onClick={onClose}>CANCEL</button>
                    <button className="control-btn primary" onClick={() => onAdd(formData)}>ADD</button>
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
