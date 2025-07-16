const editorEl = document.getElementById('editor') as HTMLElement;
const params = new URLSearchParams(location.search);
const noteId = params.get('note') || '1';
const storageKey = 'muon_note_' + noteId;

async function init() {
  const {createEditor, $getRoot, $createParagraphNode, $createTextNode} = await import('https://cdn.jsdelivr.net/npm/lexical@0.13.1/+esm');
  const registerPlainText = (await import('https://cdn.jsdelivr.net/npm/@lexical/plain-text@0.13.1/+esm')).default;
  const { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } = await import('https://cdn.jsdelivr.net/npm/@lexical/markdown@0.13.1/+esm');

  const editor = createEditor();
  editor.setRootElement(editorEl);
  registerPlainText(editor);

  const initial = localStorage.getItem(storageKey);
  editor.update(() => {
    if (initial) {
      $convertFromMarkdownString(initial, TRANSFORMERS, editor);
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
        $convertFromMarkdownString(e.newValue as string, TRANSFORMERS, editor);
      });
    }
  });
}

init();
