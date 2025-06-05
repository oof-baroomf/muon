import React, { useState, useRef, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import Draggable from 'react-draggable';

type Win = { id: string; url: string; x: number; y: number; w: number; h: number };

const STORAGE_KEY = 'infinite-state';

export default function App() {
  const [{ wins, scale, tx, ty }, setState] = useState(() => 
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"wins":[],"scale":1,"tx":0,"ty":0}')
  );

  const save = (partial) => setState(s => ({ ...s, ...partial }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wins, scale, tx, ty }));
  }, [wins, scale, tx, ty]);

  const canvasRef = useRef<HTMLDivElement>(null);

  useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => save({ tx: dx, ty: dy }),
      onPinch: ({ offset: [d] }) => save({ scale: Math.min(4, Math.max(0.2, d)) })
    },
    { target: canvasRef, eventOptions: { passive: false } }
  );

  const addWin = () => {
    const url = prompt('Enter URL', 'https://example.com');
    if (!url) return;
    save({
      wins: [
        ...wins,
        { id: crypto.randomUUID(), url, x: 100, y: 100, w: 800, h: 600 }
      ]
    });
  };

  return (
    <div className="w-screen h-screen bg-neutral-800 text-white select-none">
      <button
        className="fixed top-3 left-3 z-50 px-3 py-1 bg-sky-600 rounded"
        onClick={addWin}
      >
        New tab
      </button>

      <div
        ref={canvasRef}
        className="relative"
        style={{
          width: 40000,
          height: 40000,
          transform: `translate(${tx}px,${ty}px) scale(${scale})`,
          transformOrigin: '0 0'
        }}
      >
        {wins.map(w => (
          <Draggable
            key={w.id}
            defaultPosition={{ x: w.x, y: w.y }}
            onStop={(_, d) =>
              save({ wins: wins.map(x => (x.id === w.id ? { ...x, x: d.x, y: d.y } : x)) })
            }
          >
            <div className="absolute border border-neutral-600 rounded bg-black" style={{ width: w.w, height: w.h }}>
              <webview src={w.url} style={{ width: '100%', height: '100%' }}></webview>
            </div>
          </Draggable>
        ))}
      </div>
    </div>
  );
}
