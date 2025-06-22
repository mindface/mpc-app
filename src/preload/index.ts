import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ipcRenderer } from 'electron'

// PDFフォルダ選択・MCPリクエスト用APIをexpose
const api = {
  selectPDFFolder: () => ipcRenderer.invoke('select-pdf-folder'),
  mcpRequest: (args: { llm: string; pdfPath: string }) => ipcRenderer.invoke('mcp-request', args)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: {
        ...electronAPI.ipcRenderer,
        invoke: ipcRenderer.invoke.bind(ipcRenderer),
        send: ipcRenderer.send.bind(ipcRenderer)
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    ipcRenderer: ipcRenderer
  }
  // @ts-ignore (define in dts)
  window.api = api
}
