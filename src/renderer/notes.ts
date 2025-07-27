import { renderMarkdown } from './simpleMarkdown';

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
  preview.style.outline = 'none';
  preview.style.height = '100%';
  preview.style.overflow = 'auto';
  preview.style.padding = '8px';
  preview.style.fontSize = '13px';

  const textarea = document.createElement('textarea');
  textarea.className = 'muon-note-editor';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  textarea.style.height = '100%';
  textarea.style.width = '100%';
  textarea.style.overflow = 'auto';
  textarea.style.padding = '8px';
  textarea.style.fontSize = '13px';
  textarea.style.display = 'none';

  const text = await window.electronAPI.readNote(notePath);
  textarea.value = text;
  preview.innerHTML = renderMarkdown(text);

  container.appendChild(preview);
  container.appendChild(textarea);

  let editing = false;

  const showPreview = () => {
    if (!editing) return;
    preview.innerHTML = renderMarkdown(textarea.value);
    window.electronAPI.writeNote(notePath, textarea.value);
    textarea.style.display = 'none';
    preview.style.display = '';
    editing = false;
  };

  const showEditor = () => {
    if (editing) return;
    textarea.style.display = '';
    preview.style.display = 'none';
    textarea.focus();
    editing = true;
  };

  preview.addEventListener('dblclick', showEditor);
  textarea.addEventListener('blur', showPreview);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      showPreview();
    }
  });
}

export function rerenderVisibleNotes(): void {
  const elems = document.querySelectorAll('.muon-note-preview, .muon-note-editor') as NodeListOf<HTMLElement>;
  elems.forEach(el => {
    if (el.offsetParent) {
      const originalDisplay = el.style.display;
      el.style.display = 'none';
      void el.offsetHeight;
      el.style.display = originalDisplay;
    }
  });
}
