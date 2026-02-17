import * as THREE from 'three';
import { initScene, animateScene, updateCameraPose } from "./scene.js";
import { initVision, updateVision } from "./vision.js"; 
// import { initVideo, getRemoteVideoElement } from "./video.js"; 
import { initInteraction, updateInteraction } from "./interaction.js";
import { initDepthProcessor } from "./depth.js";
import { initUI } from "./ui.js"; 
import { PresentationController } from './presentation.js';

const loadingUi = document.getElementById("loading");
const loadingDetails = document.getElementById("loading-details");
const startBtn = document.getElementById("start-btn");
const failsafe = document.getElementById("failsafe-error");

// Global Error Handler
window.onerror = function(msg, url, line, col, error) {
    if (failsafe) {
        failsafe.style.display = 'block';
        failsafe.innerHTML += `<div>Error: ${msg} (Line ${line})</div>`;
    }
    console.error("Global Error:", msg, error);
};
window.onunhandledrejection = function(event) {
     if (failsafe) {
        failsafe.style.display = 'block';
        failsafe.innerHTML += `<div>Promise Rejection: ${event.reason}</div>`;
    }
};

async function main() {
  let sceneContext; 
  let presentation;
  
  try {
    if (loadingDetails) loadingDetails.style.display = 'none'; // Hide text details
    
    initUI(); 
    // Initialize scene WITHOUT default office assets
    sceneContext = await initScene(false);

    // Check for Role in URL
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'w'; // Default to White
    console.log("Setting Role:", role);
    updateCameraPose(role);

    presentation = new PresentationController(sceneContext.scene, sceneContext.camera, sceneContext.renderer);
    
    // ready to start
    startBtn.classList.remove("hidden"); // Show Button
    startBtn.style.display = "flex";
    
    // Debug Access
    window.app = {
        scene: sceneContext.scene,
        camera: sceneContext.camera,
        presentation: presentation
    };
    
    const hideLoading = () => {
        loadingUi.style.display = 'none';
        loadingUi.style.visibility = 'hidden';
        loadingUi.classList.add('hidden');
        document.body.removeChild(loadingUi); 
    };

    startBtn.addEventListener('click', async () => {
        console.log("Start button clicked");
        
        hideLoading();

        // Resume Audio Context if suspended
        if (THREE.AudioContext) { // Safety check incase import fails (unlikely)
             const ctx = new THREE.AudioContext(); // Wait, THREE.AudioContext is weird. 
             // Standard is THREE.AudioContext.getContext() but checking docs/usage
             const audioCtx = THREE.AudioContext.getContext();
             if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
             }
        }
        
        if (window.presentation) {
            window.presentation.start();
        } else {
            console.error("Presentation controller not found on window");
        }
        
        requestAnimationFrame(loop);
    });
    
    // Global Access
    window.presentation = presentation;

    // Vision - RESTORED
    const autoJoin = async () => {
      // loadingDetails.textContent = "Initializing Vision..."; // REMOVED
      console.log("Starting Auto-Join sequence...");
      
      try {
        // Init Vision 
        try {
            console.log("Calling initVision...");
            await initVision(sceneContext); 
            console.log("initVision complete.");
        } catch(e) { console.error("Vision Init Failed", e); }
        
        // Setup local webcam for head tracking
        const webcamVideo = document.getElementById('webcam');
        if (webcamVideo) {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamVideo.srcObject = stream;
                webcamVideo.play();
                console.log("Webcam enabled for Head Tracking");
             } catch(e) {
                 console.warn("Webcam access denied or failed", e);
             }
        }
      } catch (e) {
          console.error("Setup Failed", e);
      }
    };
    
    // Trigger immediately
    autoJoin();

    function loop(time) {
      updateVision();
      
      if (presentation) {
          presentation.update(time);
      }
      
      // Render
      if (sceneContext && sceneContext.renderer) {
          sceneContext.renderer.render(sceneContext.scene, sceneContext.camera);
      }
      
      requestAnimationFrame(loop);
    }
  } catch (err) {
    if (failsafe) failsafe.innerHTML += `<div>Fatal: ${err.message}</div>`;
    console.error(err);
  }
}

main();
