export {};

declare global {
  interface Window {
    electronAPI: {
      loadState(): Promise<import('../renderer/state').DesktopState>;
      saveState(state: import('../renderer/state').DesktopState): void;
      loadConfig(): Promise<import('../config').AppConfig>;
      saveConfig(cfg: import('../config').AppConfig): void;
      send<T extends unknown[]>(channel: string, ...args: T): void;
      receive<T extends unknown[]>(channel: string, func: (...args: T) => void): () => void;
      readNote(path: string): Promise<string>;
      writeNote(path: string, content: string): void;
    };
    toastui: {
      Editor: new (options: unknown) => {
        getMarkdown(): string;
        layout(): void;
        on(event: string, handler: () => void): void;
      };
    };
  }

  // Extend CSSStyleDeclaration to include non-standard 'zoom' property used in renderer code
  interface CSSStyleDeclaration {
    /**
     * Non-standard zoom style (supported by Chromium, Safari, etc.).
     * Declared here so TypeScript accepts `element.style.zoom`.
     */
    zoom?: string | number;
  }
}
