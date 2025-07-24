export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

import { marked } from 'marked';
import DOMPurify from 'dompurify';

export async function setupNoteEditor(container: HTMLElement, notePath: string) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'muon-note-editor';
  wrapper.style.display = 'flex';
  wrapper.style.height = '100%';

  const textarea = document.createElement('textarea');
  textarea.className = 'muon-note-text';
  textarea.style.flex = '1 1 50%';
  textarea.style.background = '#1e1e1e';
  textarea.style.color = '#e5e5e5';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.padding = '8px';
  textarea.style.resize = 'none';
  textarea.style.height = '100%';

  const preview = document.createElement('div');
  preview.className = 'muon-note-preview';
  preview.style.flex = '1 1 50%';
  preview.style.overflow = 'auto';
  preview.style.padding = '8px';
  preview.style.background = '#1e1e1e';
  preview.style.color = '#e5e5e5';

  const text = await window.electronAPI.readNote(notePath);
  textarea.value = text;
  preview.innerHTML = DOMPurify.sanitize(marked.parse(text));

  textarea.addEventListener('input', () => {
    const md = textarea.value;
    window.electronAPI.writeNote(notePath, md);
    preview.innerHTML = DOMPurify.sanitize(marked.parse(md));
  });

  wrapper.appendChild(textarea);
  wrapper.appendChild(preview);
  container.appendChild(wrapper);
}


export function rerenderVisibleNotes(): void {
  const previews = document.querySelectorAll('.muon-note-preview') as NodeListOf<HTMLElement>;
  previews.forEach(preview => {
    if (preview.offsetParent) {
      const originalDisplay = preview.style.display;
      preview.style.display = 'none';
      preview.offsetHeight;
      preview.style.display = originalDisplay;
    }
  });
}
