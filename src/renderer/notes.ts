export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

export async function setupNoteEditor(container: HTMLElement, notePath: string) {
  container.innerHTML = '';
  const editor = document.createElement('div');
  editor.className = 'muon-note-editor';
  editor.contentEditable = 'true';
  editor.style.outline = 'none';
  editor.style.height = '100%';
  editor.style.overflow = 'auto';
  editor.style.padding = '8px';
  const text = await window.electronAPI.readNote(notePath);
  editor.innerHTML = text;
  editor.addEventListener('input', () => {
    window.electronAPI.writeNote(notePath, editor.innerHTML);
  });
  container.appendChild(editor);
}


export function rerenderVisibleNotes(): void {
  const editors = document.querySelectorAll('.muon-note-editor') as NodeListOf<HTMLElement>;
  editors.forEach(editor => {
    if (editor.offsetParent) {
      const originalDisplay = editor.style.display;
      editor.style.display = 'none';
      void editor.offsetHeight;
      editor.style.display = originalDisplay;
    }
  });
}
