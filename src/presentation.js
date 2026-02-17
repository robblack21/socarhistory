import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatLoader, SplatMesh } from '@sparkjsdev/spark'; 
import { slides } from './presentation_data.js';
import { trackingState } from './vision.js';

export class PresentationController {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Audio Listener
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.audioContext = this.listener.context; 
        
        this.currentSlideIndex = -1;
        this.slideStartTime = 0;
        this.isPlaying = false;
        this.manualRotation = false; 
        this.enableAssetAnim = true; // Default Enabled
        
        this.loaders = {
            gltf: new GLTFLoader(),
            splat: new SplatLoader(),
            texture: new THREE.TextureLoader()
        };
        
        this.assets = {}; 
        this.currentObject = null;
        
        this.bgMusic = null;
        this.narration = null;
        
        this.ui = {};
        this.initUI();
        this.initControls(); 
        this.initDebugUI();  
        
        // Continuous Subtitles Setup
        this.allWords = slides.map(s => s.text).join(' ').split(' ');
        this.wordIndex = 0;
        this.subtitleInterval = null;

        // Head Tracking State for Smoothing
        this.currentTrackingOffset = new THREE.Vector3();
    }
    
    async start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        console.log("Starting Presentation...");
        if (this.ui.startOverlay) this.ui.startOverlay.style.display = 'none';
        
        this.startSubtitleStream();

        try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                 this.audioContext.resume().catch(e => console.warn("Audio Resume Failed", e));
            }
            await this.initAudio();
        } catch (e) {
            console.error("Audio Init Failed", e);
        }
        
        if (this.bgMusic) {
             this.bgMusic.play();
             this.bgMusic.setVolume(this.isMuted ? 0 : 0.5);
        }
        
        if (this.narration) {
            setTimeout(() => {
                if (this.isPlaying) {
                     this.narration.play();
                     this.narration.setVolume(this.isMuted ? 0 : 1.0);
                }
            }, 12000); 
        }

        await this.nextSlide();
    }
    
    startSubtitleStream() {
        const fullText = slides.map(s => s.text).join(' '); 
        const sentences = fullText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
        
        this.subtitleState = {
            sentenceIndex: 0,
            charIndex: 0,
            timer: null
        };
        
        const typeChar = () => {
            if (!this.isPlaying) return;
            if (this.subtitleState.sentenceIndex >= sentences.length) return;
            
            const sentence = sentences[this.subtitleState.sentenceIndex].trim();
            const displaySentence = sentence.replace(/[.!?]+$/, ''); 
            
            if (this.subtitleState.charIndex === 0) {
                 if (this.ui.subtitles) this.ui.subtitles.textContent = '';
            }
            
            if (this.subtitleState.charIndex < displaySentence.length) {
                const char = displaySentence[this.subtitleState.charIndex];
                if (this.ui.subtitles) {
                    this.ui.subtitles.textContent += char;
                }
                this.subtitleState.charIndex++;
                
                const delay = (char === ' ') ? 40 : 42;
                this.subtitleState.timer = setTimeout(typeChar, delay);
            } 
            else {
                this.subtitleState.timer = setTimeout(() => {
                    if (this.ui.subtitles) this.ui.subtitles.textContent = ''; 
                    this.subtitleState.sentenceIndex++;
                    this.subtitleState.charIndex = 0;
                    typeChar();
                }, 1000);
            }
        };
        
        if (this.ui.subtitles) this.ui.subtitles.innerHTML = '';
        typeChar();
    }

    initDebugUI() {
        // Removed Ladybird Icon as requested.
        // Toggle via 'b' key only (handled in initControls).

        // Debug Panel (Enhanced)
        const debugPanel = document.createElement('div');
        debugPanel.style.position = 'absolute';
        debugPanel.style.top = '20px'; // Higher now
        debugPanel.style.left = '50%';
        debugPanel.style.transform = 'translateX(-50%)';
        debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; 
        debugPanel.style.color = 'white'; 
        debugPanel.style.padding = '15px';
        debugPanel.style.borderRadius = '8px';
        debugPanel.style.fontFamily = 'monospace';
        debugPanel.style.fontSize = '14px';
        debugPanel.style.whiteSpace = 'pre';
        debugPanel.style.display = 'none'; 
        debugPanel.style.zIndex = '2001';
        debugPanel.style.textAlign = 'left';
        debugPanel.style.minWidth = '300px'; 
        
        // Add Animation Toggle inside Panel
        const animToggle = document.createElement('div');
        animToggle.textContent = 'Toggle Animations';
        animToggle.style.cursor = 'pointer';
        animToggle.style.color = '#ffff00';
        animToggle.style.marginBottom = '10px';
        animToggle.style.borderBottom = '1px solid #555';
        animToggle.onclick = () => {
            this.enableAssetAnim = !this.enableAssetAnim;
            animToggle.textContent = `Toggle Animations: ${this.enableAssetAnim ? 'ON' : 'OFF'}`;
        };
        debugPanel.appendChild(animToggle);

        const debugContent = document.createElement('div');
        this.ui.debugContent = debugContent;
        debugPanel.appendChild(debugContent);

        document.body.appendChild(debugPanel);
        this.ui.debugPanel = debugPanel;
    }

    initControls() {
        this.keys = { 
            w:false, a:false, s:false, d:false, q:false, e:false,
            i:false, j:false, k:false, l:false,
            '[':false, ']':false, 
            shift: false
        };
        
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
            if (e.key === 'Shift') this.keys.shift = true;
            if (e.key === '>') this.nextSlide();
            
            // Toggle debug with 'b'
            if (k === 'b') {
                const display = this.ui.debugPanel.style.display;
                this.ui.debugPanel.style.display = (display === 'none') ? 'block' : 'none';
            }
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) this.keys[k] = false;
            if (e.key === 'Shift') this.keys.shift = false;
        });
        console.log("Controls Initialized");
    }

    update(time) {
        const dt = 0.016; 
        const moveSpeed = this.keys && this.keys.shift ? 10.0 : 5.0; 
        const rotSpeed = 1.5;
        
        // Manual
        if (this.keys.w) this.camera.translateZ(-moveSpeed * dt);
        if (this.keys.s) this.camera.translateZ(moveSpeed * dt);
        if (this.keys.a) this.camera.translateX(-moveSpeed * dt);
        if (this.keys.d) this.camera.translateX(moveSpeed * dt);
        if (this.keys.q) this.camera.position.y -= moveSpeed * dt;
        if (this.keys.e) this.camera.position.y += moveSpeed * dt;
        
        // Rotation
        if (this.keys.j) { this.camera.rotation.y += rotSpeed * dt; this.manualRotation = true; }
        if (this.keys.l) { this.camera.rotation.y -= rotSpeed * dt; this.manualRotation = true; }
        if (this.keys.i) { this.camera.rotation.x += rotSpeed * dt; this.manualRotation = true; }
        if (this.keys.k) { this.camera.rotation.x -= rotSpeed * dt; this.manualRotation = true; }

        // Zoom
        const zoomSpeed = 20.0;
        if (this.keys['[']) { this.camera.fov = Math.min(120, this.camera.fov + zoomSpeed * dt); this.camera.updateProjectionMatrix(); }
        if (this.keys[']']) { this.camera.fov = Math.max(10, this.camera.fov - zoomSpeed * dt); this.camera.updateProjectionMatrix(); }

        if (this.currentSlideIndex === -1) return;
        
        const slide = slides[this.currentSlideIndex];
        const elapsed = (time - this.slideStartTime) / 1000;
        
        // 1. Asset Animation Logic
        if (this.currentObject && this.enableAssetAnim) {
            // Apply Dolly
            this.currentObject.position.z += (0.05 * 0.016); 
            
            if (slide.animation === 'scale_up') {
                const duration = 12.0; 
                const t = Math.min(elapsed / duration, 1.0);
                const ease = 1 - Math.pow(1 - t, 3); 
                const s = ease * 0.5; 
                this.currentObject.scale.set(s, s, s);
            }
        }
        
        // 2. Camera Animation Logic
        if (this.isPlaying && !this.manualRotation && this.enableAssetAnim) {
            const freq = 0.2;
            const t = time * 0.001 * freq;
            
            if (slide.animation === 'strafe_down') {
                const speed = 0.2;
                this.camera.position.y -= speed * dt;
                this.camera.lookAt(0, 1.75, -0.5); 
            } 
            else if (slide.animation === 'strafe_up') {
                 const speed = 0.2;
                 this.camera.position.y += speed * dt;
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'pan_horizontal') {
                const amp = 1.5;
                this.camera.position.x = Math.sin(t) * amp;
                this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'orbit_horizontal') {
                 const ampX = 1.0; 
                 this.camera.position.x = Math.cos(t) * ampX;
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'zolly_in' || slide.animation === 'zolly_in_gentle' || slide.animation === 'zolly_in_fast') {
                let speed = 0.3;
                if (slide.animation === 'zolly_in_gentle') speed = 0.1;
                if (slide.animation === 'zolly_in_fast') speed = 0.5; // Increased for 2billion
                this.camera.position.z -= speed * dt;
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'zolly_out') {
                const speed = 0.3;
                this.camera.position.z += speed * dt;
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else {
                const orbitScale = (slide.orbitScale !== undefined) ? slide.orbitScale : 1.0;
                if (orbitScale > 0) {
                     const isVertical = this.currentSlideIndex % 2 !== 0;
                     if (isVertical) {
                        const ampY = 0.6 * orbitScale; 
                        this.camera.position.y -= Math.sin(t) * ampY * 0.01; 
                    } else {
                        const ampX = 1.0 * orbitScale; 
                        this.camera.position.x -= Math.cos(t) * ampX * 0.01; 
                    }
                    this.camera.lookAt(0, 1.75, -0.5);
                } else {
                     if (!slide.camera) {
                        this.camera.lookAt(0, 1.75, -0.5);
                    }
                }
            }
        }
        
        // 2b. Additive Head Tracking with Smoothing & Counter-Rotation
        if (!this.lastTrackingOffset) this.lastTrackingOffset = new THREE.Vector3();
        // Remove old offset before calculating new one
        this.camera.position.sub(this.lastTrackingOffset);
        
        const targetTrackingVector = new THREE.Vector3();
        if (trackingState && trackingState.headPose && trackingState.headPose.faceLandmarks && trackingState.headPose.faceLandmarks.length > 0) {
            const face = trackingState.headPose.faceLandmarks[0];
            const nose = face[1]; 
            const dx = (nose.x - 0.5) * 2.0; 
            const dy = (nose.y - 0.5) * 2.0;
            
            // "make it look up and down more, moving camera slightly up and pointing it downwards"
            // "or lowering it and pointing it upwards"
            // If nose.y goes UP (negative dy?), camera goes UP, Rotation X goes DOWN (positive?)
            
            const rangeX = 0.8; 
            const rangeY = 0.6; // Increased from 0.3
            
            targetTrackingVector.set(dx * rangeX, -dy * rangeY, 0);
            
            // We do NOT apply quaternion here immediately b/c we want to separate Position shift from Rotation shift?
            // Actually, if we translate camera, we must ensure rotation compensates.
            // Let's smooth the Vector first.
        }
        
        // Smooth dampening
        const smoothFactor = 0.1; // Lower = smoother/slower
        this.currentTrackingOffset.lerp(targetTrackingVector, smoothFactor);
        
        // Apply Smoothed Position Offset
        const appliedOffset = this.currentTrackingOffset.clone();
        appliedOffset.applyQuaternion(this.camera.quaternion); // Align to camera space
        this.camera.position.add(appliedOffset);
        this.lastTrackingOffset.copy(appliedOffset);
        
        // Apply Counter-Rotation based on offset
        // If we move UP (+Y local), we want to look DOWN (-X local rotation).
        // If we move RIGHT (+X local), we want to look LEFT (+Y or -Y local rotation?).
        
        // Store original rotation to restore next frame? 
        // Or just apply as additive to a 'base' rotation?
        // Since camera logic above sets LookAt or rotation every frame, we can just add to it here.
        // BUT lookingAt resets rotation. So we update rotation AFTER lookAt logic.
        
        const rotX = this.currentTrackingOffset.y * -0.2; // Move Up -> Rot Down
        const rotY = this.currentTrackingOffset.x * 0.2; // Move Right -> Rot Left? (Check sign)
        
        this.camera.rotateX(rotX);
        this.camera.rotateY(rotY);
        
        // 3. Timeline
        if (this.ui.playhead && this.ui.timelineDots.length > 0) {
             this.ui.timelineDots.forEach(dot => {
                if (dot.index === this.currentSlideIndex) {
                    dot.label.style.color = 'white';
                    dot.label.style.transform = 'scale(1.3)';
                    dot.label.style.fontWeight = 'bold';
                } else {
                    dot.label.style.color = 'rgba(255,255,255,0.5)';
                    dot.label.style.transform = 'scale(1)';
                    dot.label.style.fontWeight = '300';
                }
            });

            const progress = Math.min(elapsed / slide.duration, 1.0);
            const segmentWidth = 100 / (this.ui.timelineDots.length - 1);
            const currentPos = this.currentSlideIndex * segmentWidth;
            let interpolated = currentPos;
            if (this.currentSlideIndex < this.ui.timelineDots.length - 1) {
                interpolated = currentPos + (progress * segmentWidth);
            }
            this.ui.playhead.style.left = `${interpolated}%`;
        }
        
        // 4. Next Slide
        if (elapsed > slide.duration) {
            this.nextSlide();
        }
        
        this.updateDebug(slide, elapsed);
    }
    
    updateDebug(slide, elapsed) {
        if (!this.ui.debugPanel || this.ui.debugPanel.style.display === 'none') return;
        if (!this.ui.debugContent) return; // Wait for init
        
        const cPos = this.camera.position;
        const cRot = this.camera.rotation;
        const oPos = this.currentObject ? this.currentObject.position : {x:0, y:0, z:0};
        const oRot = this.currentObject ? this.currentObject.rotation : {x:0, y:0, z:0};
        const oScale = this.currentObject ? this.currentObject.scale : {x:0, y:0, z:0};
        
        const text = `
=== CAMERA ===
Pos:  ${cPos.x.toFixed(2)}, ${cPos.y.toFixed(2)}, ${cPos.z.toFixed(2)}
Rot:  ${cRot.x.toFixed(2)}, ${cRot.y.toFixed(2)}, ${cRot.z.toFixed(2)}
FOV:  ${this.camera.fov.toFixed(1)}

=== OBJECT (${slide.type}) ===
Pos:  ${oPos.x.toFixed(2)}, ${oPos.y.toFixed(2)}, ${oPos.z.toFixed(2)}
Rot:  ${oRot.x.toFixed(2)}, ${oRot.y.toFixed(2)}, ${oRot.z.toFixed(2)}
Scl:  ${oScale.x.toFixed(2)}, ${oScale.y.toFixed(2)}, ${oScale.z.toFixed(2)}

Slide: ${this.currentSlideIndex} / ${slides.length}
Name: ${slide.path}
Anim: ${slide.animation || 'None'}
Time: ${elapsed.toFixed(1)}s / ${slide.duration}s
Manual: ${this.manualRotation}
Anim Enabled: ${this.enableAssetAnim}
        `.trim();
        
        this.ui.debugContent.textContent = text;
    }
    
    async nextSlide() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        const index = this.currentSlideIndex + 1;
        console.log(`Transitioning to slide ${index}`);
        
        // 1. Fade OUT (Go to Black)
        if (this.ui.fade) this.ui.fade.style.opacity = '1';
        
        await new Promise(r => setTimeout(r, 2500)); 
        
        // 2. Remove Old Asset
        if (this.currentObject) {
            this.scene.remove(this.currentObject);
             if (this.currentObject.dispose) this.currentObject.dispose();
             this.currentObject = null; 
        }
        
        if (index >= slides.length) {
            console.log("Presentation Finished");
            this.isPlaying = false;
            return; 
        }

        // --- RESET CAMERA BETWEEN SLIDES ---
        this.camera.position.set(0, 1.6, 5);
        this.camera.rotation.set(0, 0, 0);
        this.manualRotation = false; 
        // -----------------------------------

        this.currentSlideIndex = index;
        const slide = slides[index];
        console.log(`Loading slide ${index}: ${slide.path}`);

        let object = null;
        try {
             object = await this.loadAsset(index);
        } catch(e) { console.error("Error loading asset", e); }
        
        this.currentObject = object;
        
        if (object) {
            if (slide.transform) {
                object.position.set(...slide.transform.position);
                object.scale.set(...slide.transform.scale);
                object.rotation.set(...slide.transform.rotation);
            }
            this.scene.add(object);
        }
        
        if (slide.camera) {
             this.camera.position.set(...slide.camera.position);
             this.camera.rotation.set(...slide.camera.rotation);
             if (slide.camera.fov) {
                 this.camera.fov = slide.camera.fov;
                 this.camera.updateProjectionMatrix();
             }
        }
        
        this.slideStartTime = performance.now();
        await new Promise(r => setTimeout(r, 100)); 

        // 3. Fade IN (Reveal)
        if (this.ui.fade) this.ui.fade.style.opacity = '0';
        
        this.isTransitioning = false;
        
        this.loadAsset(index + 1);
        this.loadAsset(index + 2);
    }
    
    initUI() {
        // Simple Fade Overlay
        const fadeEl = document.createElement('div');
        fadeEl.style.position = 'absolute';
        fadeEl.style.top = '0';
        fadeEl.style.left = '0';
        fadeEl.style.width = '100%';
        fadeEl.style.height = '100%';
        fadeEl.style.backgroundColor = 'black';
        fadeEl.style.opacity = '1'; // Start Black
        fadeEl.style.pointerEvents = 'none';
        fadeEl.style.transition = 'opacity 2.5s ease-in-out'; // Matches 2.5s requirement
        fadeEl.style.zIndex = '10'; // Above Canvas (0), Below UI (1000+)
        document.body.appendChild(fadeEl);
        this.ui.fade = fadeEl;
        
        // Start Button Overlay
        const startOverlay = document.createElement('div');
        startOverlay.style.position = 'absolute';
        startOverlay.style.top = '0';
        startOverlay.style.left = '0';
        startOverlay.style.width = '100%';
        startOverlay.style.height = '100%';
        startOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        startOverlay.style.display = 'flex';
        startOverlay.style.justifyContent = 'center';
        startOverlay.style.alignItems = 'center';
        startOverlay.style.zIndex = '2000';
        
        const startBtn = document.createElement('button');
        startBtn.textContent = 'START SOÇAR 1972';
        startBtn.style.padding = '20px 40px';
        startBtn.style.fontSize = '24px';
        startBtn.style.fontFamily = '"Helvetica Neue", sans-serif';
        startBtn.style.fontWeight = '300';
        startBtn.style.letterSpacing = '2px';
        startBtn.style.color = 'white';
        startBtn.style.background = 'transparent';
        startBtn.style.border = '1px solid white';
        startBtn.style.cursor = 'pointer';
        startBtn.style.textTransform = 'uppercase';
        startBtn.onclick = () => this.start();
        
        startOverlay.appendChild(startBtn);
        document.body.appendChild(startOverlay);
        this.ui.startOverlay = startOverlay;
        
        // Subtitles (Updated Style: Bigger, Heavier -> REDUCED WEIGHT to 400)
        const subEl = document.createElement('div');
        subEl.style.position = 'absolute';
        subEl.style.bottom = '15%'; 
        subEl.style.left = '50%';
        subEl.style.transform = 'translateX(-50%)';
        subEl.style.width = '80%';
        subEl.style.textAlign = 'center';
        subEl.style.color = 'white';
        subEl.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
        subEl.style.fontWeight = '400'; // REDUCED from 600
        subEl.style.fontSize = '32px'; // Bigger (was 24px)
        subEl.style.textShadow = '0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6), 0 4px 4px rgba(0,0,0,0.8)';
        subEl.style.backgroundColor = 'transparent'; 
        subEl.style.padding = '15px 30px';
        subEl.style.zIndex = '1000';
        subEl.style.opacity = '1'; 
        subEl.style.transition = 'opacity 0.5s';
        document.body.appendChild(subEl);
        this.ui.subtitles = subEl;

        // Timeline
        const timelineEl = document.createElement('div');
        timelineEl.style.position = 'absolute';
        timelineEl.style.bottom = '10px'; 
        timelineEl.style.left = '50%';
        timelineEl.style.transform = 'translateX(-50%)';
        timelineEl.style.width = '90%';
        timelineEl.style.height = '60px'; 
        timelineEl.style.display = 'flex';
        timelineEl.style.justifyContent = 'space-between';
        timelineEl.style.alignItems = 'flex-start'; 
        timelineEl.style.zIndex = '1001';
        
        const lineEl = document.createElement('div');
        lineEl.style.position = 'absolute';
        lineEl.style.top = '0';
        lineEl.style.left = '0';
        lineEl.style.width = '100%';
        lineEl.style.height = '2px';
        lineEl.style.backgroundColor = 'rgba(255,255,255,0.5)';
        timelineEl.appendChild(lineEl);
        
        const playheadEl = document.createElement('div');
        playheadEl.style.position = 'absolute';
        playheadEl.style.top = '-4px'; 
        playheadEl.style.left = '0'; 
        playheadEl.style.width = '10px';
        playheadEl.style.height = '10px';
        playheadEl.style.backgroundColor = 'white';
        playheadEl.style.borderRadius = '50%';
        playheadEl.style.boxShadow = '0 0 10px white';
        playheadEl.style.transition = 'left 0.5s ease-in-out';
        playheadEl.style.zIndex = '1002'; 
        timelineEl.appendChild(playheadEl);
        this.ui.playhead = playheadEl;
        
        const yearSlides = slides.filter(s => s.year);
        const segmentWidth = 100 / (yearSlides.length - 1);
        this.ui.timelineDots = [];
        let visualIdx = 0;
        slides.forEach((slide, idx) => {
            if (!slide.year) return; 
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = `${visualIdx * segmentWidth}%`;
            container.style.transform = 'translateX(-50%)';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.cursor = 'pointer';
            
            const tick = document.createElement('div');
            tick.style.width = '2px';
            tick.style.height = '10px';
            tick.style.backgroundColor = 'white';
            tick.style.marginBottom = '5px';
            container.appendChild(tick);
            
            const label = document.createElement('div');
            label.innerText = slide.year;
            label.style.color = 'rgba(255,255,255,0.7)';
            label.style.fontFamily = '"Helvetica Neue", sans-serif';
            label.style.fontSize = '16px'; 
            label.style.fontWeight = '500';
            label.style.whiteSpace = 'nowrap';
            label.style.transition = 'color 0.3s, transform 0.3s';
            container.appendChild(label);
            
            container.onclick = () => {
                this.currentSlideIndex = idx - 1;
                this.nextSlide();
            };
            timelineEl.appendChild(container);
            this.ui.timelineDots.push({
                index: idx,
                label: label,
                leftPercent: visualIdx * segmentWidth
            });
            visualIdx++;
        });
        document.body.appendChild(timelineEl);
        this.ui.timeline = timelineEl;

        const pauseEl = document.createElement('div');
        pauseEl.style.position = 'absolute';
        pauseEl.style.top = '20px';
        pauseEl.style.left = '20px';
        pauseEl.style.width = '30px';
        pauseEl.style.height = '30px';
        pauseEl.style.cursor = 'pointer';
        pauseEl.style.zIndex = '1001';
        
        const pauseSvg = `<svg viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        pauseEl.innerHTML = pauseSvg;
        
        pauseEl.onclick = () => this.togglePause();
        this.ui.pauseIcon = pauseEl;
        document.body.appendChild(pauseEl);

        const muteEl = document.createElement('div');
        muteEl.style.position = 'absolute';
        muteEl.style.top = '20px';
        muteEl.style.right = '20px'; 
        muteEl.style.width = '20px'; 
        muteEl.style.height = '20px';
        muteEl.style.cursor = 'pointer';
        muteEl.style.zIndex = '1001';
        muteEl.onclick = () => this.toggleMute();
        this.ui.muteIcon = muteEl;
        document.body.appendChild(muteEl);
        this.isMuted = false;
        this.updateMuteIcon(); 
        
        if (!this.ui) this.ui = {}; 
    }
    
    updateMuteIcon() {
        if (!this.ui.muteIcon) return;
        const iconColor = 'white';
        const volSvg = `<svg viewBox="0 0 24 24" fill="${iconColor}"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        const muteSvg = `<svg viewBox="0 0 24 24" fill="${iconColor}"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        this.ui.muteIcon.innerHTML = this.isMuted ? muteSvg : volSvg;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgMusic) this.bgMusic.setVolume(this.isMuted ? 0 : 0.3);
        if (this.narration) this.narration.setVolume(this.isMuted ? 0 : 1.0);
        this.updateMuteIcon();
    }

    togglePause() {
        this.isPlaying = !this.isPlaying;
        if (this.ui.pauseIcon) {
             const pauseSvg = `<svg viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
             const playSvg = `<svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>`;
             this.ui.pauseIcon.innerHTML = this.isPlaying ? pauseSvg : playSvg;
        }
        
        if (this.isPlaying) {
             if (this.bgMusic && !this.isMuted) this.bgMusic.setVolume(0.3);
             if (this.narration && !this.isMuted) this.narration.setVolume(1.0);
        } else {
             if (this.bgMusic) this.bgMusic.setVolume(0); 
             if (this.narration) this.narration.setVolume(0);
        }
    }

    async initAudio() {
        const audioLoader = new THREE.AudioLoader();
        
        this.bgMusic = new THREE.Audio(this.listener);
        try {
            const buffer = await audioLoader.loadAsync('assets/socarmusic.mp3');
            this.bgMusic.setBuffer(buffer);
            this.bgMusic.setLoop(true);
            this.bgMusic.setVolume(this.isMuted ? 0 : 0.3); 
        } catch(e) { console.error("Failed to load music", e); }
        
        this.narration = new THREE.Audio(this.listener);
        try {
            const buffer = await audioLoader.loadAsync('assets/narration.mp3');
            this.narration.setBuffer(buffer);
            this.narration.setLoop(false);
            this.narration.setVolume(this.isMuted ? 0 : 1.0);
        } catch(e) { console.error("Failed to load narration", e); }
    }
    
    async loadAsset(index) {
        if (this.assets[index]) return this.assets[index];
        if (index >= slides.length) return null; 

        const slide = slides[index];
        const url = `assets/${slide.path}`;
        let object = null;
        
        try {
            if (slide.type === 'glb') {
                const gltf = await this.loaders.gltf.loadAsync(url);
                object = gltf.scene;
            } else if (slide.type === 'spz') {
                const buffer = await this.loaders.splat.loadAsync(url);
                object = new SplatMesh({ packedSplats: buffer });
            } else if (slide.type === 'img') {
                const tex = await this.loaders.texture.loadAsync(url);
                tex.colorSpace = THREE.SRGBColorSpace;
                
                // Fix aspect ratio
                const aspect = tex.image.width / tex.image.height;
                const height = 2.0; // Base height
                const width = height * aspect;
                
                const geo = new THREE.PlaneGeometry(width, height); 
                const mat = new THREE.MeshBasicMaterial({ 
                    map: tex, 
                    transparent: true,
                    side: THREE.DoubleSide
                });
                object = new THREE.Mesh(geo, mat);
            }
            
            if (object) {
                if (slide.transform) {
                    object.position.set(...slide.transform.position);
                    object.scale.set(...slide.transform.scale);
                    object.rotation.set(...slide.transform.rotation);
                }
                this.assets[index] = object;
            }
        } catch(e) {
            console.error(`Failed to load asset ${slide.path}`, e);
        }
        
        return object;
    }
}
