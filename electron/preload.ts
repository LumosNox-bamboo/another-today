import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('save:load'),
  save: (state: unknown) => ipcRenderer.invoke('save:write', state),
  exportSave: (state: unknown) => ipcRenderer.invoke('save:export', state),
  importSave: () => ipcRenderer.invoke('save:import'),
  compact: (value: boolean) => ipcRenderer.invoke('window:compact', value),
  paths: () => ipcRenderer.invoke('app:paths'),
  onClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('prepare-close', listener);
    return () => ipcRenderer.removeListener('prepare-close', listener);
  },
});
