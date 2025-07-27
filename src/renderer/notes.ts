export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

interface ToastEditor {
  getMarkdown(): string;
  layout(): void;
  on(event: string, handler: () => void): void;
}

const activeEditors = new Map<HTMLElement, ToastEditor>();

export async function setupNoteEditor(container: HTMLElement, notePath: string) {
  container.innerHTML = '';
  const holder = document.createElement('div');
  holder.className = 'muon-note-editor';
  holder.style.height = '100%';
  container.appendChild(holder);

  const markdown = await window.electronAPI.readNote(notePath);

  const editor = new window.toastui.Editor({
    el: holder,
    height: '100%',
    initialEditType: 'markdown',
    previewStyle: 'vertical',
    initialValue: markdown
  });

  editor.on('change', () => {
    window.electronAPI.writeNote(notePath, editor.getMarkdown());
  });

  activeEditors.set(holder, editor);
}


export function rerenderVisibleNotes(): void {
  for (const [el, ed] of activeEditors) {
    if (el.offsetParent) {
      ed.layout();
    }
  }
}
