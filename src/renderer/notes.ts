import {createEditor} from 'lexical';
import {registerHistory, createEmptyHistoryState} from '@lexical/history';
import {registerRichText} from '@lexical/rich-text';
import {registerMarkdownShortcuts, $convertFromMarkdownString, $convertToMarkdownString} from '@lexical/markdown';
import {mergeRegister} from '@lexical/utils';

export function sanitizeNotePath(input: string): string {
  let p = input.replace(/[^a-zA-Z0-9\-_./]/g, '');
  p = p.replace(/^\.+/, '').replace(/^\/+/, '');
  if (!p.endsWith('.md')) p += '.md';
  return p;
}

export async function setupNoteEditor(container: HTMLElement, notePath: string) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'muon-note-editor';
  root.style.outline = 'none';
  root.style.height = '100%';
  root.style.overflow = 'auto';
  root.style.padding = '8px';
  root.style.fontSize = '13px';

  const editor = createEditor({
    namespace: 'muon-note',
    onError: (e: Error) => {
      throw e;
    }
  });

  editor.setRootElement(root);

  mergeRegister(
    registerRichText(editor),
    registerHistory(editor, createEmptyHistoryState()),
    registerMarkdownShortcuts(editor)
  );

  const markdown = await window.electronAPI.readNote(notePath);
  editor.update(() => {
    $convertFromMarkdownString(markdown);
  });

  editor.registerUpdateListener(({editorState}) => {
    editorState.read(() => {
      const md = $convertToMarkdownString();
      window.electronAPI.writeNote(notePath, md);
    });
  });

  container.appendChild(root);
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
