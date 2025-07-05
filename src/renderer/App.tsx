import React, { useEffect, useRef } from 'react';
import init from './rendererCore';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      init(containerRef.current);
    }
  }, []);
  return <div ref={containerRef} id="muon-root" className="w-full h-full" />;
};

export default App;
