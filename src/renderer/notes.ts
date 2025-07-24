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
  wrapper.style.position = 'relative';
  wrapper.style.height = '100%';
  wrapper.style.width = '100%';

  const textarea = document.createElement('textarea');
  textarea.className = 'muon-note-text';
  textarea.style.position = 'absolute';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.right = '0';
  textarea.style.bottom = '0';
  textarea.style.background = 'transparent';
  textarea.style.color = 'transparent';
  textarea.style.caretColor = '#e5e5e5';
  textarea.style.border = '1px solid #444';
  textarea.style.outline = 'none';
  textarea.style.padding = '8px';
  textarea.style.resize = 'none';
  textarea.style.height = '100%';
  textarea.style.boxSizing = 'border-box';

  const preview = document.createElement('div');
  preview.className = 'muon-note-preview';
  preview.style.position = 'absolute';
  preview.style.top = '0';
  preview.style.left = '0';
  preview.style.right = '0';
  preview.style.bottom = '0';
  preview.style.overflow = 'auto';
  preview.style.padding = '8px';
  preview.style.background = '#1e1e1e';
  preview.style.color = '#e5e5e5';
  preview.style.border = '1px solid #444';
  preview.style.boxSizing = 'border-box';
  preview.style.pointerEvents = 'none';

  const text = await window.electronAPI.readNote(notePath);
  textarea.value = text;
  preview.innerHTML = DOMPurify.sanitize(
    marked.parse(text, { async: false }) as string
  );

  textarea.addEventListener('input', () => {
    const md = textarea.value;
    window.electronAPI.writeNote(notePath, md);
    preview.innerHTML = DOMPurify.sanitize(
      marked.parse(md, { async: false }) as string
    );
  });

  wrapper.appendChild(preview);
  wrapper.appendChild(textarea);
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
