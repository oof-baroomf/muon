document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const backButton = document.getElementById('backButton');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && urlInput.value.trim() !== '') {
            window.electronAPI.loadUrl(urlInput.value.trim());
        }
    });

    backButton.addEventListener('click', () => {
        window.electronAPI.goBack();
    });

    let currentZoom = 1.0;
    const zoomStep = 0.1;
    const minZoom = 0.3;
    const maxZoom = 3.0;

    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
            } else {
                currentZoom = Math.max(minZoom, currentZoom - zoomStep);
            }
            window.electronAPI.setZoom(currentZoom);
        }
    }, { passive: false });

    minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    maximizeBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());
    closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
});
