import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SplatLoader, SplatMesh } from '@sparkjsdev/spark'; 
import { slides } from './presentation_data.js';
import { trackingState, listVideoDevices, setVideoSource } from './vision.js';

export class PresentationController {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Audio Listener
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.audioContext = this.listener.context; 
        
        // Audio Loading (Preload)
        this.bgMusic = new THREE.Audio(this.listener);
        this.narration = new THREE.Audio(this.listener);
        this.initAudio(); // Start loading immediately
        
        this.currentSlideIndex = -1;
        this.slideStartTime = 0;
        this.isPlaying = false;
        this.manualRotation = false; 
        this.enableAssetAnim = true; 
        this.enableHeadTracking = true; // Default ON
        
        this.loaders = {
            gltf: new GLTFLoader(),
            splat: new SplatLoader(),
            texture: new THREE.TextureLoader()
        };
        
        this.assets = {}; 
        this.currentObject = null;
        
        this.ui = {};
        this.initUI();
        this.initSettingsUI(); // New Settings UI
        this.initControls(); 
        this.initDebugUI();  
        
        // Continuous Subtitles Setup
        this.allWords = slides.map(s => s.text).join(' ').split(' ');
        this.wordIndex = 0;
        this.subtitleInterval = null;

        // Head Tracking State
        this.currentTrackingOffset = new THREE.Vector3();
        this.lastTrackingOffset = new THREE.Vector3();
        this.lastTrackingQuat = new THREE.Quaternion();
        
        this.narrationData = null; 
        this.loadNarration();
    }
    
    async loadNarration() {
        try {
            const response = await fetch('assets/narration.json');
            this.narrationData = await response.json();
            console.log("Narration Loaded", this.narrationData);
            this.syncSlides();
        } catch(e) {
            console.error("Failed to load narration.json", e);
        }
    }

    async syncSlides() {
        if (!this.narrationData) return;
        
        console.log("Syncing slides with narration...");
        const segments = this.narrationData.segments;
        
        const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
        const allWords = [];
        this.narrationData.segments.forEach(seg => {
             if (seg.words) allWords.push(...seg.words);
        });
        
        
        console.log(`Syncing ${slides.length} slides against ${allWords.length} words...`);

        // OFFSET CORRECTION: The audio file has a ~12s silence/intro.
        // We offset all narration data by 12s so that the start aligns with Intro end.
        const offset = 12.0;
        this.narrationData.segments.forEach(seg => {
             if (seg.start_time) seg.start_time += offset;
             if (seg.end_time) seg.end_time += offset;
             if (seg.words) seg.words.forEach(w => {
                 w.start_time += offset;
                 w.end_time += offset;
             });
        });

        // Re-populate allWords with offset values
        const offsetWords = [];     
        this.narrationData.segments.forEach(seg => {
             if (seg.words) offsetWords.push(...seg.words);
        });
        
        slides.forEach(slide => {
             // If startTime is already hardcoded (manual override based on user feedback), skip fuzzy
             if (slide.startTime !== undefined) {
                 console.log(`Using hardcoded time for "${slide.year}": ${slide.startTime}s`);
                 return;
             }
             
             // Fuzzy Logic Fallback
             const searchWords = slide.text.split(' ').slice(0, 4).join(' '); 
             const searchNorm = normalize(searchWords);
             
             for (let i = 0; i < offsetWords.length - 3; i++) {
                 let windowText = "";
                 for(let j=0; j<6; j++) { 
                     if(i+j < offsetWords.length) windowText += offsetWords[i+j].text + " ";
                 }
                 const windowNorm = normalize(windowText);
                 
                 if (windowNorm.includes(searchNorm)) {
                     slide.startTime = offsetWords[i].start_time;
                     console.log(`Matched "${slide.year}" to ${slide.startTime}s`);
                     break; 
                 }
             }
        });
        
        // Fallback for first slide -> 0
        if (slides[0] && !slides[0].startTime) slides[0].startTime = 0;
        
        // Sort slides by startTime
        slides.sort((a,b) => (a.startTime || 9999) - (b.startTime || 9999));
        
        // Calc durations based on next slide
        for (let i = 0; i < slides.length; i++) {
             if (i < slides.length - 1) {
                 const nextStart = slides[i+1].startTime;
                 if (nextStart !== undefined && slides[i].startTime !== undefined) {
                     slides[i].duration = nextStart - slides[i].startTime;
                 }
             } 
             // Keep manual duration if last slide or calc failed
        }
        
        console.log("Slides Synced & Sorted", slides);
        
        // ---------------------------------------------------------
        // CRITICAL FIX: RE-INIT OR UPDATE UI AFTER SORTING
        // Because "slides" array is mutated and sorted in place,
        // any index-based reference might be stale if initUI ran before.
        // But initUI runs *before* this sync. 
        // We need to REBUILD specific UI parts that depend on slide order.
        // ---------------------------------------------------------
        // Refresh Timeline UI if it exists
        if (this.ui.timeline) {
            
            // Clear existing dots
            if (this.ui.timelineDots) {
                this.ui.timelineDots.forEach(d => {
                    if (d.container && d.container.parentNode) {
                        d.container.parentNode.removeChild(d.container);
                    }
                });
            }
            this.ui.timelineDots = [];
            
            // Rebuild
            const timelineEl = this.ui.timeline;
            const yearSlides = slides.filter(s => s.year);
            const segmentWidth = 100 / (yearSlides.length - 1);
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
                container.style.zIndex = '2005'; 
                container.style.padding = '10px 5px';
                container.style.pointerEvents = 'auto';
                
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
                   if (this.narration && slide.startTime !== undefined) {
                       this.narration.stop();
                       this.narration.offset = slide.startTime;
                       this.narration.play();
                   }
                   this.jumpToSlide(idx);
                };
                
                timelineEl.appendChild(container);
                
                this.ui.timelineDots.push({
                    index: idx,
                    label: label,
                    container: container,
                    leftPercent: visualIdx * segmentWidth
                });
                visualIdx++;
            });
        }
    }

    async initSettingsUI() {
        // Settings Icon (Gear) - Top Left
        const settingsBtn = document.createElement('div');
        settingsBtn.style.position = 'absolute';
        settingsBtn.style.top = '20px';
        settingsBtn.style.left = '60px'; // Next to Pause (20px) + Gap
        settingsBtn.style.width = '24px';
        settingsBtn.style.height = '24px';
        settingsBtn.style.cursor = 'pointer';
        settingsBtn.style.zIndex = '2001';
        
        const gearSvg = `<svg viewBox="0 0 24 24" fill="white"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
        settingsBtn.innerHTML = gearSvg;
        settingsBtn.onclick = () => {
             const display = this.ui.settingsPanel.style.display;
             this.ui.settingsPanel.style.display = (display === 'none') ? 'block' : 'none';
        }
        document.body.appendChild(settingsBtn);
        this.ui.settingsBtn = settingsBtn;

        // Settings Panel
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.top = '60px';
        panel.style.left = '20px';
        panel.style.width = '280px';
        panel.style.backgroundColor = 'rgba(0,0,0,0.9)';
        panel.style.border = '1px solid #444';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.color = 'white';
        panel.style.fontFamily = 'sans-serif';
        panel.style.fontSize = '14px';
        panel.style.display = 'none'; // Hidden by default
        panel.style.zIndex = '2002';
        
        // 1. Camera Source
        const camLabel = document.createElement('div');
        camLabel.textContent = "Camera Source";
        camLabel.style.marginBottom = '5px';
        camLabel.style.fontWeight = 'bold';
        panel.appendChild(camLabel);
        
        const camSelect = document.createElement('select');
        camSelect.style.width = '100%';
        camSelect.style.marginBottom = '15px';
        camSelect.style.padding = '5px';
        camSelect.style.backgroundColor = '#222';
        camSelect.style.color = 'white';
        camSelect.style.border = '1px solid #555';
        

        // Populate Cameras
        const refreshCameras = async () => {
            // Keep selected value if possible
            const currentVal = camSelect.value;
            camSelect.innerHTML = '';
            const devices = await listVideoDevices();
            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Camera ${d.deviceId.substr(0,4)}...`;
                camSelect.appendChild(opt);
            });
            if (currentVal) camSelect.value = currentVal;
        };
        
        settingsBtn.onclick = () => {
             const display = this.ui.settingsPanel.style.display;
             const isHidden = (display === 'none');
             this.ui.settingsPanel.style.display = isHidden ? 'block' : 'none';
             if (isHidden) refreshCameras();
        }

        // ... inside Settings Panel ...
        // (We need to update the onclick handler we just defined above, or just redefine refreshCameras at broader scope?
        // Actually, initSettingsUI is one big function. I can just update the code block.)
        
        // 2. Music Volume
        const musicLabel = document.createElement('div');
        musicLabel.textContent = "Music Volume";
        musicLabel.style.marginBottom = '5px';
        musicLabel.style.fontWeight = 'bold';
        panel.appendChild(musicLabel);
        
        const musicSlider = document.createElement('input');
        musicSlider.type = 'range';
        musicSlider.min = '0';
        musicSlider.max = '1';
        musicSlider.step = '0.1';
        this.musicVolume = 0.3; // Default
        musicSlider.value = this.musicVolume;
        musicSlider.style.width = '100%';
        musicSlider.style.marginBottom = '15px';
        musicSlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (!isFinite(val)) return; // prevent NaN
            this.musicVolume = val;
            if (this.bgMusic) this.bgMusic.setVolume(this.musicVolume);
            if (this.isMuted && this.musicVolume > 0) this.toggleMute(); // Unmute if sliding
        };
        panel.appendChild(musicSlider);
        this.ui.musicSlider = musicSlider; // Store ref
        
        // 3. Narration Volume
        const narrLabel = document.createElement('div');
        narrLabel.textContent = "Narration Volume";
        narrLabel.style.marginBottom = '5px';
        narrLabel.style.fontWeight = 'bold';
        panel.appendChild(narrLabel);
        
        const narrSlider = document.createElement('input');
        narrSlider.type = 'range';
        narrSlider.min = '0';
        narrSlider.max = '1';
        narrSlider.step = '0.1';
        this.narrationVolume = 1.0; // Default
        narrSlider.value = this.narrationVolume;
        narrSlider.style.width = '100%';
        narrSlider.style.marginBottom = '15px';
        narrSlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (!isFinite(val)) return; // prevent NaN
            this.narrationVolume = val;
            if (this.narration) this.narration.setVolume(this.narrationVolume);
            if (this.isMuted && this.narrationVolume > 0) this.toggleMute(); // Unmute
        };
        panel.appendChild(narrSlider);
        this.ui.narrSlider = narrSlider; // Store ref


        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '5px 10px';
        closeBtn.style.backgroundColor = '#444';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.float = 'right';
        closeBtn.onclick = () => {
            panel.style.display = 'none';
        };
        panel.appendChild(closeBtn);

        document.body.appendChild(panel);
        this.ui.settingsPanel = panel;
    }

    async initAudio() {
        const audioLoader = new THREE.AudioLoader();
        try {
            // Load Music
            audioLoader.load('assets/socarmusic.mp3', (buffer) => {
                this.bgMusic.setBuffer(buffer);
                this.bgMusic.setLoop(true);
                this.bgMusic.setVolume(this.isMuted ? 0 : this.musicVolume); // Use stored
            });
            // Load Narration
            audioLoader.load('assets/narration.mp3', (buffer) => {
                this.narration.setBuffer(buffer);
                this.narration.setLoop(false);
                this.narration.setVolume(this.isMuted ? 0 : this.narrationVolume); // Use stored
            });
        } catch(e) { console.error("Failed to load audio", e); }
    }

    async start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        console.log("Starting Presentation... CTX State:", this.audioContext.state);
        if (this.ui.startOverlay) this.ui.startOverlay.style.display = 'none';
        
        // this.startSubtitleStream(); // DISABLED: Using JSON-based subtitles in update()
        
        await this.audioContext.resume();
        this.narrationStartTime = this.audioContext.currentTime; 
        console.log(`Narration Start Time set to: ${this.narrationStartTime}`);


        try {
            // Logic to handle "Double Click" issue:
            // Ensure context is resumed.
            if (this.audioContext.state === 'suspended') {
                 await this.audioContext.resume();
            }
            
            // Wait slightly for buffers if loop loaded fast? 
            // setBuffer is synchronous once load finishes. 
            // If user clicks FAST, buffer might be null.
            // Check if buffer exists, if not wait?
            if (!this.bgMusic.buffer || !this.narration.buffer) {
                 console.log("Audio buffering...");
                 // Simple wait loop (fallback)
                 let attempts = 0;
                 while((!this.bgMusic.buffer || !this.narration.buffer) && attempts < 20) {
                     await new Promise(r => setTimeout(r, 200));
                     attempts++;
                 }
            }
            
            if (this.bgMusic && this.bgMusic.buffer) {
                 this.bgMusic.play();
            }
            
            if (this.narration && this.narration.buffer) {
                setTimeout(() => {
                    if (this.isPlaying && this.narration.buffer) {
                         this.narration.play();
                    }
                }, 12000); // 12s delay for Intro
            }
        } catch (e) {
            console.error("Audio Start Failed", e);
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
        // Debug Panel
        const debugPanel = document.createElement('div');
        debugPanel.style.position = 'absolute';
        debugPanel.style.top = '20px'; 
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
        
        // Add Animation Toggle
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
        // --- 1. REVERT PREVIOUS HEAD TRACKING ---
        // Undo Position
        if (this.lastTrackingOffset) {
            this.camera.position.sub(this.lastTrackingOffset);
        }
        // Undo Rotation (Critical for IJKL stability)
        if (this.lastTrackingQuat) {
             const inverse = this.lastTrackingQuat.clone().invert();
             this.camera.quaternion.multiply(inverse);
        }
        // ----------------------------------------
        
        const dt = 0.016; 
        const moveSpeed = this.keys && this.keys.shift ? 10.0 : 5.0; 
        const rotSpeed = 1.5;
        
        // Manual Controls
        // If Q/E (Titan/Strafing) are pressed, force Manual Rotation to prevent LookAt fighting
        if (this.keys.q || this.keys.e) {
            this.manualRotation = true;
        }

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
        
        // Asset Animation
        if (this.currentObject && this.enableAssetAnim) {
            this.currentObject.position.z += (0.05 * 0.016); 
            if (slide.animation === 'scale_up') {
                const duration = 12.0; 
                const t = Math.min(elapsed / duration, 1.0);
                const ease = 1 - Math.pow(1 - t, 3); 
                const s = ease * 0.5; 
                this.currentObject.scale.set(s, s, s);
            }
        }
        
        // Camera Animation (LookAt)
        if (this.isPlaying && !this.manualRotation && this.enableAssetAnim) {
            const freq = 0.1 * 0.85; // Reduced 50% (was 0.2)
            const t = time * 0.001 * freq;
            
            const speedScale = slide.speedScale || 1.0;
            const globalSpeed = 0.85; // Stretch animation to match 15% longer duration
            
            if (slide.animation === 'strafe_down') {
                const speed = 0.2 * speedScale * globalSpeed;
                this.camera.position.y -= speed * dt;
                this.camera.lookAt(0, 1.75, -0.5); 
            } 
            else if (slide.animation === 'strafe_down_pitch') {
                const speed = 0.266 * speedScale * globalSpeed; 
                this.camera.position.y -= speed * dt;
                
                // Slowly look up (increase parallax) - Reduced tilt significantly
                const lookUpOffset = elapsed * 0.02; 
                this.camera.lookAt(0, 1.75 + lookUpOffset, -0.5);
            } 
            else if (slide.animation === 'zolly_in_strafe') {
                 // Reduced zoom speed + Slight right strafe
                 let speed = 0.15; // Half of normal 0.3
                 speed *= speedScale * globalSpeed;
                 this.camera.position.z -= speed * dt;
                 this.camera.position.x += 0.1 * speed * dt; // Slight right
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'orbit_right') {
                 const speed = 0.3 * speedScale * globalSpeed;
                 this.camera.position.x += speed * dt; // Move camera right -> Orbits around looked-at point
                 this.camera.lookAt(0, 1.75, -0.5);
            } 
            else if (slide.animation === 'strafe_up') {
                 const speed = 0.2 * speedScale * globalSpeed;
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
                if (slide.animation === 'zolly_in_fast') speed = 0.5; 
                speed *= speedScale * globalSpeed; 
                this.camera.position.z -= speed * dt;
                 this.camera.lookAt(0, 1.75, -0.5);
            }
            else if (slide.animation === 'zolly_out') {
                const speed = 0.3 * speedScale * globalSpeed;
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
        
        // --- 2. APPLY HEAD TRACKING ---
        if (this.enableHeadTracking) {
             const targetTrackingVector = new THREE.Vector3();
             if (trackingState && trackingState.headPose && trackingState.headPose.faceLandmarks && trackingState.headPose.faceLandmarks.length > 0) {
                 const face = trackingState.headPose.faceLandmarks[0];
                 const nose = face[1]; 
                 const dx = (nose.x - 0.5) * 2.0; 
                 const dy = (nose.y - 0.5) * 2.0;
                 
                 const rangeX = 0.8; 
                 const rangeY = 0.6; 
                 targetTrackingVector.set(dx * rangeX, -dy * rangeY, 0);
             }
             
             // Smooth dampening
             const smoothFactor = 0.1; 
             this.currentTrackingOffset.lerp(targetTrackingVector, smoothFactor);
             
             // A. Position Offset
             // Must apply in Camera Local space (Quat) BUT we haven't applied rot offset yet.
             // Apply based on PRESENTATION rotation.
             const appliedOffset = this.currentTrackingOffset.clone();
             appliedOffset.applyQuaternion(this.camera.quaternion); 
             this.camera.position.add(appliedOffset);
             this.lastTrackingOffset.copy(appliedOffset);
             
             // B. Rotation Offset (Counter-Rotate)
             const rotX = this.currentTrackingOffset.y * -0.2; 
             const rotY = this.currentTrackingOffset.x * 0.2; 
             
             // Create Quaternion for this frame's tracking rotation
             const trackingQuat = new THREE.Quaternion();
             // Euler order YX? 
             const euler = new THREE.Euler(rotX, rotY, 0, 'YXZ');
             trackingQuat.setFromEuler(euler);
             
             this.camera.quaternion.multiply(trackingQuat);
             this.lastTrackingQuat.copy(trackingQuat);
        } else {
             // If disabled, reset trackers
             this.lastTrackingOffset.set(0,0,0);
             this.lastTrackingQuat.identity();
             this.currentTrackingOffset.set(0,0,0);
        }
        // -----------------------------
        
        // 3. Timeline & Audio Sync
        let currentAudioTime = 0;
        if (this.narration && this.narration.isPlaying) {
            // approximate
            // ThreeJS audio doesn't expose extract current playback time easily if looped=false without some math 
            // context.currentTime is global. 
            // We need start time of the audio.
            // Let's assume we handle 'audioStartTime' when we play.
        }
        
        // REVISED STRATEGY: 
        // We use the `this.narration` object. 
        // If playing, we calculate time.
        // Actually, let's just use a main presentation timer that mirrors the audio.
        // Or if audio is playing, use that.
        
        let presentationTime = 0;
        if (this.isPlaying && this.slideStartTime > 0) {
             // We need a Global Time for the presentation, not just per slide.
             // But existing logic is per slide.
             // If we have proper startTimes, we should use Global Time.
             
             // Let's introduce `this.globalStartTime`.  
             if (!this.globalStartTime) {
                 // Init on first update after play?
             }
        }
        
        // BETTER: Use the Audio Context Time (if audio is running)
        if (this.narration && this.isPlaying && this.narrationSource) {
             // We need to capture the source node or track start time.
             // ThreeJS Audio `play()` creates a source. `this.narration.source`.
             // Time = context.currentTime - startTime + offset
             // Accessing private/internal properties of Three Audio is risky.
             
             // ALTERNATIVE: Just trust the elapsed time deltas if we aren't pausing much.
             // OR: Use the `narration.json` effectively.
             
             // Let's use a robust approach:
             // Maintain `this.presentationTime` accumulator.
             // Sync it to Audio if possible.
        }
        
        // SIMPLIFIED APPROACH:
        // Since we are forcing the audio to start at specific times or continuous?
        // Narration is ONE big file.
        // So we just need to track "How long has narration been playing?"
        
        if (this.isPlaying) {
             if (this.narrationStartTime !== undefined) {
                 // Calculate time based on Audio Context (most accurate for sync)
                 currentAudioTime = this.audioContext.currentTime - this.narrationStartTime;
                 
                 // CORRECTION: Narration start offset
                 // We delay narration by 8s (see start method). 
                 // But slides are synced to 8s offset.
                 // So if T=0 is when we clicked start, and Audio starts at T=8...
                 // The narration.json times are shifted by +8.
                 // So `currentTime` should be relative to "Start Click".
                 // YES. `narrationStartTime` is set at `start()`.
             } else {
                 // Fallback: Use simple elapsed time if audio context is weird
                 currentAudioTime = time * 0.001; 
             }
        }

        // DEBUG: Log timing every 100 frames (~1.6s)
        if (this.isPlaying && this.renderer && this.renderer.info.render.frame % 100 === 0) {
             console.log(`Time: ${currentAudioTime.toFixed(2)}s, Slide: ${this.currentSlideIndex}`);
        }
        
        // Update Subtitles (Word-Level Glow)
        this.updateSubtitles(currentAudioTime);

        // Timeline visualization
        const totalDuration = slides[slides.length-1].startTime + (slides[slides.length-1].duration || 10);
        const globalProgress = Math.min(currentAudioTime / totalDuration, 1.0);
        
        // Update Playhead (Global)
        if (this.ui.playhead) {
            this.ui.playhead.style.left = `${globalProgress * 100}%`;
        }

        // Highlight Active Year
        if (this.ui.timelineDots) {
             this.ui.timelineDots.forEach(dot => {
                const s = slides[dot.index];
                if (currentAudioTime >= s.startTime && currentAudioTime < s.startTime + s.duration) {
                     dot.label.style.color = 'white';
                     dot.label.style.transform = 'scale(1.3)';
                 } else {
                     dot.label.style.color = 'rgba(255,255,255,0.5)';
                     dot.label.style.transform = 'scale(1)';
                 }
             });
        }
        
        // 4. Slide Transition Logic (Time-Based)
        // Check if we reached the NEXT slide's start time
        const nextIndex = this.currentSlideIndex + 1;
        if (nextIndex < slides.length) {
            const nextSlide = slides[nextIndex];
            // If Text Match failed, nextSlide.startTime might be undefined/invalid.
            // But we sorted, so it should be monotonically increasing.
            // Threshold: 0.1s tolerance
            if (nextSlide.startTime !== undefined && currentAudioTime >= nextSlide.startTime) {
                 this.nextSlide();
            }
        }
    }

    updateSubtitles(time) {
        if (!this.narrationData || !this.ui.subtitles) return;
        
        // Find current segment
        const segment = this.narrationData.segments.find(s => time >= s.start_time && time <= s.end_time);
        
        if (segment) {
            // Find current word
            const currentWord = segment.words ? segment.words.find(w => time >= w.start_time && time <= w.end_time) : null;
            
            let html = "";
            if (segment.words) {
                html = segment.words.map((w, idx) => {
                    const isCurrent = (currentWord === w);
                    
                    // Style Logic:
                    // Active: Slightly larger (1pt approx), subtle glow, minimal margin expansion
                    
                    const baseStyle = "transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: inline-block; vertical-align: middle;";
                    
                    let specializedStyle = "color: rgba(255,255,255,0.6);";
                    if (isCurrent) {
                        specializedStyle = `
                            text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6), 0 0 5px rgba(255,255,255,0.8);
                            color: #ffffff; 
                            font-weight: 600;
                            margin: 0 4px; 
                        `;
                    }
                    
                    return `<span style="${baseStyle} ${specializedStyle}">${w.text}</span>`;
                }).join(' ');
            } else {
                html = segment.text; 
            }
            
            if (this.ui.subtitles.innerHTML !== html) {
                this.ui.subtitles.innerHTML = html;
            }
            this.ui.subtitles.style.opacity = '1';
        } else {
            this.ui.subtitles.style.opacity = '0'; // Hide if silence
        }
    }
    
    updateDebug(slide, elapsed) {
        if (!this.ui.debugPanel || this.ui.debugPanel.style.display === 'none') return;
        if (!this.ui.debugContent) return; // Wait for init
        
        const cPos = this.camera.position;
        const cRot = this.camera.rotation;
        
        const text = `
=== CAMERA ===
Pos:  ${cPos.x.toFixed(2)}, ${cPos.y.toFixed(2)}, ${cPos.z.toFixed(2)}
Rot:  ${cRot.x.toFixed(2)}, ${cRot.y.toFixed(2)}, ${cRot.z.toFixed(2)}
FOV:  ${this.camera.fov.toFixed(1)}

Slide: ${this.currentSlideIndex} / ${slides.length}
Name: ${slide.path}
Anim: ${slide.animation || 'None'}
Tracking: ${this.enableHeadTracking ? 'ON' : 'OFF'}
Manual: ${this.manualRotation}
        `.trim();
        
        this.ui.debugContent.textContent = text;
    }
    
    async loadAsset(index) {
        if (index < 0 || index >= slides.length) return null;
        const slide = slides[index];
        
        // Check Cache
        if (this.assets[slide.path]) return this.assets[slide.path];
        
        console.log(`Loading asset: ${slide.path} (${slide.type})`);
        
        try {
            if (slide.type === 'glb') {
                const gltf = await this.loaders.gltf.loadAsync(`assets/${slide.path}`);
                const model = gltf.scene;
                this.assets[slide.path] = model;
                return model;
            } 
            else if (slide.type === 'spz') {
                try {
                    const splat = await this.loaders.splat.loadAsync(`assets/${slide.path}`);
                    const mesh = new SplatMesh({ packedSplats: splat }); // Use object signature like scene.js
                    this.assets[slide.path] = mesh;
                    // console.log(`[DEBUG] Loaded Splat: ${slide.path}. Mesh ID: ${mesh.id}`);
                    return mesh;
                } catch (err) {
                    console.error(`[DEBUG] Failed to load splat ${slide.path}`, err);
                    return null;
                }
            }
            else if (slide.type === 'img') {
                const tex = await this.loaders.texture.loadAsync(`assets/${slide.path}`);
                const geometry = new THREE.PlaneGeometry(1.6 * 2, 0.9 * 2); // 16:9 Aspect
                const material = new THREE.MeshBasicMaterial({ 
                    map: tex, 
                    transparent: true,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geometry, material);
                this.assets[slide.path] = mesh;
                return mesh;
            }
        } catch(e) {
            console.error(`Failed to load asset ${slide.path}`, e);
            return null;
        }
    }

    async jumpToSlide(index) {
        // Reset state
        if (this.currentObject) {
            this.scene.remove(this.currentObject);
            this.currentObject = null;
        }
        this.currentSlideIndex = index - 1; // nextSlide will increment
        await this.nextSlide();
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
        // Cleanup previous
        if (this.currentObject) {
            console.log("Disposing previous asset:", this.currentObject);
            this.scene.remove(this.currentObject);
            
            // Extra cleanup for Overlay issues: Remove ANY Mesh/Points that isn't currentObject (if any left)
            // This ensures Maps don't linger over SPZs or vice versa
            this.scene.children.forEach(child => {
                if ((child.isMesh || child.isPoints) && child !== this.currentObject) {
                    // Ignore things like UI/Helpers if they are meshes? 
                    // Assuming scene only has Assets + Lights.
                    // But be careful of debug panel? (It's DOM usually).
                    // Just removing from scene.
                    this.scene.remove(child);
                }
            });
            
            // Deep dispose
            this.currentObject.traverse((params) => {
                if (params.isMesh) {
                     if (params.geometry) params.geometry.dispose();
                     if (params.material) {
                         if (Array.isArray(params.material)) {
                             params.material.forEach(m => m.dispose());
                         } else {
                             params.material.dispose();
                         }
                     }
                }
            });
            // Specific dispose for custom objects like SplatMesh if they have one
            if (this.currentObject.dispose) {
                this.currentObject.dispose();
            }
            this.currentObject = null;
        } else {
            console.log("No previous asset to dispose.");
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
        
        // Reset tracking history too to prevent jumps
        this.lastTrackingOffset.set(0,0,0);
        this.lastTrackingQuat.identity();
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
        // Toggle Icon (Top Center)
        const toggleEl = document.createElement('div');
        toggleEl.style.position = 'absolute';
        toggleEl.style.top = '20px';
        toggleEl.style.left = '50%';
        toggleEl.style.transform = 'translateX(-50%)';
        toggleEl.style.width = '30px'; 
        toggleEl.style.height = '30px';
        toggleEl.style.cursor = 'pointer';
        toggleEl.style.zIndex = '1001';
        toggleEl.title = "Toggle Head Tracking";
        
        const eyeSvg = `<svg viewBox="0 0 24 24" fill="white"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        const eyeOffSvg = `<svg viewBox="0 0 24 24" fill="gray"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-4 .7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
        
        toggleEl.innerHTML = eyeSvg;
        toggleEl.onclick = () => {
            this.enableHeadTracking = !this.enableHeadTracking;
            toggleEl.innerHTML = this.enableHeadTracking ? eyeSvg : eyeOffSvg;
            toggleEl.querySelector('svg').style.fill = this.enableHeadTracking ? 'white' : 'gray';
        };
        
        document.body.appendChild(toggleEl);
        this.ui.trackingToggle = toggleEl;
        
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
        
        /* 
    // Start Button Overlay REMOVED - Managed by main.js / index.html
    const startOverlay = document.createElement('div');
    // ...
    this.ui.startOverlay = startOverlay;
    */

        
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
            container.style.zIndex = '2005'; // Higher Z-Index
            container.style.padding = '10px 5px'; // Increase hit area
            container.style.pointerEvents = 'auto'; // Ensure clickable
            
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
        if (this.bgMusic) this.bgMusic.setVolume(this.isMuted ? 0 : this.musicVolume);
        if (this.narration) this.narration.setVolume(this.isMuted ? 0 : this.narrationVolume);
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
}
