const editorEl = document.getElementById('editor') as HTMLElement;
const params = new URLSearchParams(location.search);
const noteId = params.get('note') || '1';
const storageKey = 'muon_note_' + noteId;

import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode
} from 'lexical';
import { registerPlainText } from '@lexical/plain-text';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS
} from '@lexical/markdown';

function init() {

  const editor = createEditor();
  editor.setRootElement(editorEl);
  registerPlainText(editor);
  editor.focus();
  editorEl.focus();

  const initial = localStorage.getItem(storageKey);
  editor.update(() => {
    if (initial) {
      $convertFromMarkdownString(initial, TRANSFORMERS);
    } else {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode().append($createTextNode('')));
    }
  });

  editor.registerUpdateListener(({editorState}) => {
    editorState.read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS);
      localStorage.setItem(storageKey, md);
    });
  });

  window.addEventListener('storage', (e) => {
    if (e.key === storageKey && e.newValue !== null) {
      editor.update(() => {
        $getRoot().clear();
        $convertFromMarkdownString(e.newValue as string, TRANSFORMERS);
      });
    }
  });
}

init();
