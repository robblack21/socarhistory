export function initUI() {
    console.log("UI Initialized (No-op)");
    // Updated Vignette (Thicker)
    const vignette = document.createElement('div');
    vignette.style.position = 'absolute';
    vignette.style.top = '0';
    vignette.style.left = '0';
    vignette.style.width = '100%';
    vignette.style.height = '100%';
    vignette.style.pointerEvents = 'none';
    vignette.style.background = 'radial-gradient(circle, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 90%)';
    vignette.style.zIndex = '900';
    document.body.appendChild(vignette);
}
