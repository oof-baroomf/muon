const { ipcRenderer } = require('electron');

// We'll add drag/resize handlers here in a future update
// For now just make the titlebar interactive
document.addEventListener('mousedown', e => {
  e.preventDefault();
});
