import {createEditor} from 'lexical';
import {registerHistory, createEmptyHistoryState} from '@lexical/history';
import {registerRichText, HeadingNode, QuoteNode} from '@lexical/rich-text';
import {registerList} from '@lexical/list';
import {ListNode, ListItemNode} from '@lexical/list';
import {CodeNode} from '@lexical/code';
import {LinkNode} from '@lexical/link';
import {
  registerMarkdownShortcuts,
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS
} from '@lexical/markdown';
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
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode
    ]
  });

  editor.setRootElement(root);
  editor.setEditable(true);

  mergeRegister(
    registerRichText(editor),
    registerHistory(editor, createEmptyHistoryState(), 1000),
    registerList(editor),
    registerMarkdownShortcuts(editor, TRANSFORMERS)
  );

  const markdown = await window.electronAPI.readNote(notePath);
  editor.update(() => {
    $convertFromMarkdownString(markdown, TRANSFORMERS);
  });

  // allow immediate editing after loading
  editor.focus();

  editor.registerUpdateListener(({editorState}) => {
    editorState.read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS);
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
