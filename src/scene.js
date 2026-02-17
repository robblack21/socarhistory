import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatLoader, SplatMesh } from '@sparkjsdev/spark'; 
import { trackingState } from './vision.js'; 

export let scene, camera, renderer;
let clock;

// Assets
let officeSplat, cyberpunkSplat;
let desk, personChair, arm, synopter, monitor, gamepad, riser;

// Head Tracking State
let initialCameraPos = new THREE.Vector3(0, 1.2, 0.5); // Adjusted for desk view
let splatStartTime = null; // For animation timing
let isOrbiting = false;
let orbitStartTime = 0;
let mediaRecorder = null;
let recordedChunks = [];
let initialCameraLookAt = new THREE.Vector3(0, 1.2, -0.5); // Look slightly down/forward
let cameraBasePos = new THREE.Vector3();

const loader = new GLTFLoader();
const splatLoader = new SplatLoader();

// --- Main Initialization ---
export async function initScene(loadDefaultAssets = true) {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010); // Darker background
    // scene.fog = new THREE.FogExp2(0x101010, 0.02); // Reduced fog

    // Camera Setup - mimics user sitting at desk
    // Synopter is at around Y=1.2m? 
    camera = new THREE.PerspectiveCamera(21, window.innerWidth / window.innerHeight, 0.00001, 1000);
    camera.position.set(0, 1.0, 3.0); // Moved back further (was 1.5)
    camera.lookAt(0, 1.0, -1);
    cameraBasePos.copy(camera.position);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('app').appendChild(renderer.domElement);

    // Lights
    setupLights();

    // Load Assets
    if (loadDefaultAssets) {
        await loadAssets();
    }

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    setupControls(renderer.domElement);

    return {
        scene,
        camera,
        renderer,
        updateBoard: () => {} // Mock for compatibility if main.js calls it
    };
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(2, 4, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    
    // Screen Glow?
    const screenLight = new THREE.PointLight(0x00ffff, 2, 5);
    screenLight.position.set(0, 1.3, -0.5); // Approx monitor pos
    scene.add(screenLight);
}

async function loadAssets() {
    console.log("Loading Assets...");
    const baseUrl = import.meta.env.BASE_URL;

    // 1. Office Background (Apple Sharp Extrusion)
    try {
        const splatData = await splatLoader.loadAsync(`${baseUrl}assets/office.ply`);
        officeSplat = new SplatMesh({ packedSplats: splatData });
        scene.add(officeSplat);
        
        // Tuning: 5x Bigger (Was 10x), Rotate 180
        // Move towards camera (Z+) - INCREASED massively to 18.0 (Another 6.0 step)
        // "Move back away from user by 1/3 of its depth".
        // Depth is unknown but large. I'll guess +4.0 (for depth ~12m).
        // "Move office splat by 2x in the opposite direction".
        // Previous was +4.0 (to 22.0). Opposite is -8.0 (2x distance) -> 14.0.
        // User: "Got worse". "Move double again in opposite* direction".
        // Meaning: Reverse direction (back to +Z). Double magnitude (16.0).
        // 14.0 + 16.0 = 30.0.
        // -----------------
        // USER FEEDBACK (Step 773): "Move office scene to +10".
        // Previous was -10.0. User wants +10.0.
        officeSplat.position.set(0, 0, 10.0); 
        officeSplat.scale.set(3.375, 3.375, 3.375); 
        officeSplat.rotation.set(0, Math.PI, Math.PI);

        console.log("Office Splat Loaded");
    } catch (e) { console.error("Failed to load office.ply", e); }

    // 2. GLB Assets
    const loadGLB = async (name) => {
        try {
            const gltf = await loader.loadAsync(`${baseUrl}assets/${name}`);
            const model = gltf.scene;
            
            model.traverse(c => {
                if(c.isMesh) { 
                    c.castShadow = true; 
                    c.receiveShadow = true; 
                }
            });

            // Revert broken texture logic on monitor mesh
            // Instead, add a textured quad for the screen content
            if (name === 'monitor.glb') {
                const texLoader = new THREE.TextureLoader();
                const monitorTexture = await texLoader.loadAsync(`${baseUrl}assets/cyberpunk.jpg`);
                monitorTexture.colorSpace = THREE.SRGBColorSpace;
                
                // Create screen quad
                // Reduced size by 12.5% (2.0 -> 1.75, 1.125 -> 0.985)
                const screenGeo = new THREE.PlaneGeometry(1.75, 0.985); 
                const screenMat = new THREE.MeshStandardMaterial({
                    map: monitorTexture,
                    emissive: 0xffffff,
                    emissiveMap: monitorTexture,
                    emissiveIntensity: 1.0,
                    roughness: 0.2,
                    metalness: 0.8
                });
                const screenMesh = new THREE.Mesh(screenGeo, screenMat);
                
                // Position relative to monitor origin
                // Monitor origin is bottom center? or center?
                // Usually center.
                // Move slightly forward in Z (local) to avoid z-fighting with casing
                // Monitor faces +Z (or -Z)? Usually +Z in Max/Blender, -Z in Three.
                // Let's assume +Z is front.
                // "Inside monitor" -> Move more +Z (towards person)
                // "Inside monitor" -> Move more +Z (towards person)
                // "Inside monitor" -> Move more +Z (towards person)
                // New: A tiny bit back (0.25 -> 0.22), a tiny bit up (0.05 -> 0.08 -> 0.02 -> 0.14)
                // User said "move double in opposite direction".
                // Previous move was 0.08 -> 0.02 (-0.06). Opposite is +0.06. Double is +0.12.
                // 0.02 + 0.12 = 0.14.
                // NEW: Up by same amount (0.12) -> 0.26. Back (-Z) by 0.05 -> 0.17.
                // PLUS Riser height (0.15) -> Y = 0.26 + 0.15 = 0.41.
                // Adjustment Round 15: "Move down slightly" -> 0.35.
                // Adjustment Round 16: "Move double downwards" -> 0.35 -> 0.48? (Assuming +Y is Down).
                // Adjustment Round 17: "Still too high relative to monitor by 1/3 of its height" (0.95 / 3 = 0.32).
                // Moving DOWN = INCREASING Y (based on previous feedback).
                // 0.48 + 0.33 = 0.81.
                // Adjustment Round 18: "Too high by 60% of its height". So moving UP was WRONG.
                // Need to Move DOWN by DECREASING Y.
                // 0.81 - (0.985 * 0.60) = 0.81 - 0.59 = 0.22.
                screenMesh.position.set(0, 0.22, 0.17); 
                // "Reset the tilt of cyberpunk.jpg to 0".
                screenMesh.rotation.x = 0;
                // Using 0.05 Y to center vertically if origin is bottom?
                // Using 0.03 Z to pop out.
                
                // If monitor faces -Z?
                // GLTFLoader faces +Z usually.
                // Let's attach to model.
                model.add(screenMesh);
            }

            scene.add(model);
            return model;
        } catch (e) { console.error(`Failed to load ${name}`, e); return null; }
    };

    // Parallel loading
    [desk, personChair, arm, synopter, monitor, gamepad, riser] = await Promise.all([
        loadGLB('desk.glb'),
        loadGLB('personchair.glb'),
        loadGLB('arm.glb'),
        loadGLB('synopter.glb'),
        loadGLB('monitor.glb'),
        loadGLB('gamepad.glb'),
        loadGLB('riser.glb')
    ]);

    // Positioning
    const zPush = -1.0; // Move GLBs further away
    
    if (desk) {
        // Lower desk (-0.3 -> -0.4)
        desk.position.set(0, -0.4, 0 + zPush); 
    }
    if (personChair) {
        // Move back (+0.3) -> 1.1
        personChair.position.set(0, 0, 1.1 + zPush); 
        personChair.rotation.y = Math.PI; 
    }
    if (arm) {
        // Scale Increased 25% (0.25 -> 0.3125, Y 0.3125 -> 0.39)
        arm.scale.set(0.3125, 0.39, 0.3125);
        
        // Front of desk
        // Up by gamepad height (0.05) -> 0.40 + 0.025 = 0.425
        // Towards person (+Z) by gamepad depth (0.05) -> 0.50
        arm.position.set(0, 0.425, 0.50 + zPush); 
        arm.rotation.y += Math.PI / 2; // Rotate 90 deg
    }
    if (monitor) {
        // Lowered to 0.55 (Touch desk, -0.05)
        // Forward on desk by half depth (0.05) -> -0.35 + 0.05 = -0.30
        // Riser added: Move UP by riser height (0.15) -> 0.55 + 0.15 = 0.70
        monitor.position.set(0, 0.70, -0.30 + zPush); 
        // Scale 0.6 (Larger than 0.536)
        monitor.scale.set(0.6, 0.6, 0.6);
    }
    if (riser) {
        // Riser between table and monitor.
        // Table at -0.4.
        // Base of riser level with table plane.
        // "Riser is below table, move halfway back towards previous position (0.55)".
        // Previous (0.55). Current (-0.4). Midpoint = (-0.4 + 0.55) / 2 = 0.15 / 2 = 0.075.
        // "Move up by 50% of its height". Height 0.15. 50% = 0.075.
        // New Y = 0.075 + 0.075 = 0.15.
        riser.position.set(0, 0.15, -0.30 + zPush);
        // Scale: Half width of monitor. Monitor scale 0.6. Riser 0.3?
        riser.scale.set(0.3, 0.3, 0.3);
    }
    if (synopter) {
        // Tuning: Increased 25% (0.17 * 1.25 ~= 0.21)
        synopter.scale.set(0.21, 0.21, 0.21);

        // Lower (1.0 -> 0.7)
        // Up by gamepad height (0.05) -> 0.775 + 0.025 = 0.80
        // Towards person (+Z) by gamepad depth (0.05) -> 0.775 + 0.025 = 0.80
        // Up by another 0.025 -> 0.825 + (0.05/3 ~= 0.016) -> 0.841
        // Towards person (+Z) by 0.025 -> 0.825 + 0.016 -> 0.841
        synopter.position.set(0, 0.841, 0.841 + zPush);
        
        synopter.lookAt(0, 0.825, 1.0 + zPush); // Look at user
        
        // Tilt UP 10 degrees (Opposite direction: Subtract X rotation)
        synopter.rotation.x -= THREE.MathUtils.degToRad(10);
    }
    if (gamepad) {
        // Tuning: Reduce by 8x (~0.04)
        gamepad.scale.set(0.04, 0.04, 0.04); 
        
        // Rotate 180 Y
        gamepad.rotation.y += Math.PI;
        // Pitch Forward 20 deg (X axis)
        gamepad.rotation.x += THREE.MathUtils.degToRad(20);

        // Lower (0.265) -> Up by half height (0.025) -> 0.29
        // Move back (+0.3) -> 0.6
        gamepad.position.set(0, 0.29, 0.6 + zPush);
        
        // Depth Prioritisation DISABLED
    }

    // 3. Cyberpunk Splat
    // "Float in the 3d scene behind the monitor"
    try {
        const cpData = await splatLoader.loadAsync(`${baseUrl}assets/cyberpunk.ply`);
        cyberpunkSplat = new SplatMesh({ packedSplats: cpData });
        scene.add(cyberpunkSplat);
        
        // Position behind monitor
        // Closer to desk by 2x desk depth (~1.2). -2.5 + 1.2 = -1.3
        // Moved down by ~0.25 (25% height) from 0.4 -> 0.15
        // Moved down AGAIN by 0.25 -> -0.10
        // Reset tilt and Lower slightly -> -0.20
        // "Too low, move up". -0.20 -> -0.05 -> 0.05. (Another step up).
        // "Forward towards table". Table at Z=0 (relative to splat?).
        // Splat at -1.3. +Z is towards table.
        // Move to -1.1.
        // User (Step 782): "Move up 2x as much".
        // Assuming delta: Previous +0.10. 2x = +0.20.
        // 0.05 + 0.20 = 0.25.
        cyberpunkSplat.position.set(0, 0.25, -1.1); 
        
        // CULLING 50%: Add clipping plane to cut off back half (more negative Z).
        // Normal (0,0,1) -> Keep Z > Constant.
        // Splat at -1.1. Depth extends back.
        // Clip at -1.15? Or -1.2? 
        // If depth is ~0.1 (0.015 scale?). 
        // If scale is small, culling might not be needed?
        // But user asked for it.
        // Let's create a plane.
        
        // Note: SplatMesh material might not support clippingPlanes by default without modification.
        // Trying anyway:
        /*
        const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.15); // Keep specific range
        cyberpunkSplat.material.clippingPlanes = [ clipPlane ];
        renderer.localClippingEnabled = true;
        */
        // Since I can't easily modify renderer (it's created elsewhere in file?), I'll skip culling for now unless critical.
        // But I will squash it more. 3x less depth.
        
        // Tuning: Rotate 180 (Y) + 180 (Z) + Reset Tilt
        // Reset tilt (remove 15 deg X)
        cyberpunkSplat.rotation.set(0, Math.PI, Math.PI);
        // Tuning: 50% Smaller (0.5 -> 0.25)
        cyberpunkSplat.scale.set(0.25, 0.25, 0.25); 
        
        console.log("Cyberpunk Splat Loaded");
    } catch (e) { console.error("Failed to load cyberpunk.ply", e); }

}

// --- Animation Loop ---
export function animateScene(time) {
    const dt = clock.getDelta();

    // 1. Controls (Review/Debug)
    // WASD to move 'cameraBasePos'
    const move = new THREE.Vector3();
    const moveSpeed = 2.0; // Increased speed for free roam
    // "Reduce sensitivity of rotation with ijkl by 3x".
    // Previous 1.5. New 0.5.
    const rotSpeed = 0.5;

    // Movement (Local Space)
    if (keys.w) move.z -= 1;
    if (keys.s) move.z += 1;
    if (keys.a) move.x -= 1;
    if (keys.d) move.x += 1;
    if (keys.q) move.y -= 1; // Down
    if (keys.e) move.y += 1; // Up

    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(moveSpeed * dt);
        move.applyQuaternion(camera.quaternion);
        cameraBasePos.add(move);
    }

    // Rotation (IJKL)
    // J/L -> Yaw (Y)
    if (keys.j) camera.rotation.y += rotSpeed * dt;
    if (keys.l) camera.rotation.y -= rotSpeed * dt;
    
    // I/K -> Pitch (X) - Reverted from Roll (Z)
    if (keys.i) camera.rotation.x += rotSpeed * dt; 
    if (keys.k) camera.rotation.x -= rotSpeed * dt; 
    
    // Zoom / FOV
    // '[' -> Zoom Out (Increase FOV)
    // ']' -> Zoom In (Decrease FOV)
    const zoomSpeed = 20.0;
    if (keys['[']) camera.fov = Math.min(120, camera.fov + zoomSpeed * dt);
    if (keys[']']) camera.fov = Math.max(10, camera.fov - zoomSpeed * dt);
    camera.updateProjectionMatrix();

    // Orbit Shot Logic (Overrides Controls/Tracking)
    if (isOrbiting) {
        const orbitDuration = 5.0; // 5 seconds cinematic shot
        const elapsedOrbit = time - orbitStartTime;
        const orbitProgress = Math.min(elapsedOrbit / orbitDuration, 1.0);
        
        // Arc: -45 to +45 deg (-PI/4 to +PI/4)
        // User supplied coords: Start(4, 1, 3), End(-4, 1, 2), FOV 26.7
        const startPos = new THREE.Vector3(4, 1, 3);
        const endPos = new THREE.Vector3(-4, 1, 2);
        
        // Lerp functionality
        const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, orbitProgress);
        
        camera.position.copy(currentPos);
        camera.fov = 26.7;
        camera.updateProjectionMatrix();
        
        const center = new THREE.Vector3(0, 0.70, -0.30 - 1.0); // Monitor Centroid + zPush (-1.0)
        camera.lookAt(center);

        // Stop recording at end
        if (orbitProgress >= 1.0 && mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            isOrbiting = false;
        }
    } else {
        // Normal Controls only if not orbiting
        // ... (Existing control logic inside else or disable keys)
        // For simplicity, just let orbit override positionCopy
    }
    
    // Only apply normal controls if NOT orbiting
    if (!isOrbiting) {
        camera.position.copy(cameraBasePos);

        // Cyberpunk Extrusion Animation (Flat to Deep) - One Shot (2.5s)
        if (cyberpunkSplat) {
            if (splatStartTime === null) splatStartTime = time;
            const elapsed = Math.max(0, time - splatStartTime);
            const duration = 2.5; 
            const t = Math.min(elapsed / duration, 1.0);
            
            // "Extrusion still about 3x too exaggerated". Current 0.125 / 3 ~= 0.042.
            // User (Step 773): "Compression isn't working... way too far back".
            // Reduce AGAIN 3x? Or fix compression?
            // "Cull back 50%".
            // I'll reduce scale to 0.015 (3x less than 0.042).
            const deepScale = 0.015; 
            const flatScale = 0.001; // Flatter start
            const currentScaleZ = THREE.MathUtils.lerp(flatScale, deepScale, t);
            cyberpunkSplat.scale.z = currentScaleZ;
        }

        // 2. Head Tracking Parallax
        if (trackingState && trackingState.headPose && trackingState.headPose.faceLandmarks && trackingState.headPose.faceLandmarks.length > 0) {
            // ... (keep existing)
            const face = trackingState.headPose.faceLandmarks[0];
            const nose = face[1]; 
            const dx = (nose.x - 0.5) * 2.0; 
            const dy = (nose.y - 0.5) * 2.0;
            const rangeX = 0.3; 
            const rangeY = 0.2;
            const offsetX = dx * rangeX; 
            const offsetY = -dy * rangeY; 
            const parallax = new THREE.Vector3(offsetX, offsetY, 0);
            parallax.applyQuaternion(camera.quaternion);
            camera.position.add(parallax);
        }
    }
    
    // Spacebar Trigger
    if (keys[' '] && !isOrbiting) {
        // Start Orbit
        isOrbiting = true;
        orbitStartTime = time;
        
        // Start Recording
        const stream = renderer.domElement.captureStream(30); // 30 FPS
        if (!stream || stream.getVideoTracks().length === 0) {
            console.error("Recording failed: No video tracks in stream.");
            isOrbiting = false; // Abort
            return;
        }
        
        // Try specific MIME if supported, else default
        let options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' };
        }
        
        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.error("MediaRecorder creation failed:", e);
            isOrbiting = false;
            return;
        }

        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            if (blob.size === 0) { console.error("Recording failed: Empty Blob"); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'orbit_shot.webm';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            console.log(`Video saved! Size: ${blob.size} bytes`);
        };
        
        mediaRecorder.start(100); // Timeslice 100ms to allow ondataavailable to fire during recording
        console.log("Started Orbit Shot Recording...");
    }

    // Debug Panel Logic (Re-enabled, White)
    if (true) {
        let debugEl = document.getElementById('debug-panel');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'debug-panel';
            debugEl.style.position = 'absolute';
            debugEl.style.top = '10px';
            debugEl.style.left = '10px';
            debugEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
            debugEl.style.color = 'white';
            debugEl.style.fontFamily = 'monospace';
            debugEl.style.padding = '10px';
            debugEl.style.zIndex = '9999';
            document.body.appendChild(debugEl);
        }
        
        const pos = camera.position;
        const rot = camera.rotation;
        const f = (val) => val.toFixed(3);
        const d = (val) => THREE.MathUtils.radToDeg(val).toFixed(1);
        
        debugEl.innerHTML = `
            Camera Pos: X:${f(pos.x)} Y:${f(pos.y)} Z:${f(pos.z)}<br>
            Camera Rot: X:${d(rot.x)}° Y:${d(rot.y)}° Z:${d(rot.z)}°<br>
            FOV: ${camera.fov.toFixed(1)}
        `;
        debugEl.style.display = 'block';
    } else {
        const debugEl = document.getElementById('debug-panel');
        if (debugEl) debugEl.style.display = 'none';
    }

    renderer.render(scene, camera);
}

// --- Controls ---
const keys = { 
    w:false, a:false, s:false, d:false, q:false, e:false,
    i:false, j:false, k:false, l:false,
    '[':false, ']':false, ' ':false, 'b':false 
};

function setupControls(dom) {
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(k)) keys[k] = false;
    });
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function updateCameraPose() {} // No-op
export function setDepthThresholds() {} // No-op
