import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

export async function setupNoteEditor(container: HTMLElement, notePath: string) {
  container.innerHTML = '';

  const preview = document.createElement('div');
  preview.className = 'muon-note-preview';
  preview.style.height = '100%';

  const editor = document.createElement('textarea');
  editor.className = 'muon-note-editor';
  editor.style.display = 'none';

  const updatePreview = () => {
    preview.innerHTML = DOMPurify.sanitize(
      marked.parse(editor.value) as string,
      { USE_PROFILES: { html: true } }
    );
  };

  const text = await window.electronAPI.readNote(notePath);
  editor.value = text;
  updatePreview();

  editor.addEventListener('input', () => {
    window.electronAPI.writeNote(notePath, editor.value);
    updatePreview();
  });

  preview.addEventListener('dblclick', () => {
    preview.style.display = 'none';
    editor.style.display = 'block';
    editor.focus();
  });

  editor.addEventListener('blur', () => {
    editor.style.display = 'none';
    preview.style.display = 'block';
  });

  container.appendChild(preview);
  container.appendChild(editor);
}


export function rerenderVisibleNotes(): void {
  const elements = document.querySelectorAll('.muon-note-preview, .muon-note-editor') as NodeListOf<HTMLElement>;
  elements.forEach(el => {
    if (el.offsetParent) {
      const originalDisplay = el.style.display;
      el.style.display = 'none';
      void el.offsetHeight;
      el.style.display = originalDisplay;
    }
  });
}
