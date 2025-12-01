import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopState } from './renderer/state';
import type { AppConfig } from './config';

const allowedSendChannels = new Set([
  'state:save',
  'note:write',
  'view:create',
  'view:destroy',
  'view:set-bounds',
  'view:back',
  'view:forward',
  'view:reload',
  'view:stop',
  'view:load-url',
  'view:set-zoom-factor',
  'overlay:show',
  'overlay:hide'
]);

const allowedReceiveExact = new Set<string>([]);

const allowedReceivePrefixes = [
  'view:did-navigate:',
  'view:did-navigate-in-page:',
  'view:page-title-updated:',
  'view:did-finish-load:'
];

function ensureAllowedSend(channel: string) {
  if (!allowedSendChannels.has(channel)) {
    throw new Error(`Blocked IPC send on disallowed channel: ${channel}`);
  }
}

function ensureAllowedReceive(channel: string) {
  if (allowedReceiveExact.has(channel)) return;
  if (allowedReceivePrefixes.some(prefix => channel.startsWith(prefix))) return;
  throw new Error(`Blocked IPC receive on disallowed channel: ${channel}`);
}

contextBridge.exposeInMainWorld('electronAPI', {
  loadState: (): Promise<DesktopState> => ipcRenderer.invoke('state:load'),
  saveState: (state: DesktopState) => {
    ensureAllowedSend('state:save');
    ipcRenderer.send('state:save', state);
  },
  loadConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),
  configPath: (): Promise<string> => ipcRenderer.invoke('config:path'),
  send: <T extends unknown[]>(channel: string, ...args: T) => {
    ensureAllowedSend(channel);
    ipcRenderer.send(channel, ...args);
  },
  receive: <T extends unknown[]>(channel: string, func: (...args: T) => void) => {
    ensureAllowedReceive(channel);
    const subscription = (_event: unknown, ...args: T) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  readNote: (path: string): Promise<string> => ipcRenderer.invoke('note:read', path),
  writeNote: (path: string, content: string) => {
    ensureAllowedSend('note:write');
    ipcRenderer.send('note:write', path, content);
  }
});
