export function createShortcutInput(initial: string, onChange: (v: string) => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  btn.textContent = initial;
  let recording = false;

  btn.addEventListener('click', () => {
    if (recording) return;
    recording = true;
    const prev = btn.textContent;
    btn.textContent = 'Press keys...';

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.metaKey) parts.push('Cmd');
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
        return;
      }
      parts.push(key);
      const combo = parts.join('+');
      btn.textContent = combo;
      document.removeEventListener('keydown', handler, true);
      recording = false;
      onChange(combo);
    };

    const cancel = () => {
      document.removeEventListener('keydown', handler, true);
      document.removeEventListener('mousedown', cancel, true);
      recording = false;
      btn.textContent = prev || '';
    };

    document.addEventListener('keydown', handler, true);
    document.addEventListener('mousedown', cancel, true);
  });

  return btn;
}
