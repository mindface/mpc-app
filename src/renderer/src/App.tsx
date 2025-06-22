import React, { useState, useEffect } from 'react'
import Versions from './components/Versions'

function App(): React.JSX.Element {
  const [selectedLLM, setSelectedLLM] = useState('gpt-4')
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [llmKey, setLlmKey] = useState<string>('')
  const [requestText, setRequestText] = useState<string>('')
  const [response, setResponse] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [pdfList, setPdfList] = useState<string[]>([])
  const llmOptions = [
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'Claude 3', value: 'claude-3' },
    { label: 'Gemini 1.5', value: 'gemini-1.5' }
  ]

  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  // PDFファイル選択ダイアログを開く → フォルダ内PDF一覧を取得
  const handleSelectPDF = async () => {
    // 'select-pdf-folder' でフォルダ選択ダイアログを開き、PDF一覧を取得
    const result = await window.electron.ipcRenderer.invoke('select-pdf-folder')
    if (result && Array.isArray(result.pdfFiles)) {
      // 最初のPDFを自動選択（必要に応じて変更可）
      setPdfPath(result.pdfFiles[0] || null)
      setPdfList(result.pdfFiles)
    }
  }

  const handleSnedAction = async () => {
    const result = await window.electron.ipcRenderer.invoke('mcp-request', {
      llm: 'gemini-1.5-flash',//selectedLLM,
      pdfPath,
      prompt: requestText
    })
    console.log('選択されたPDF:', result)
  }

  const initSelectAllPDF = async () => {
    // 'all-pdf-folder' でフォルダ選択ダイアログを開き、全PDF一覧を取得
    const result = await window.electron.ipcRenderer.invoke('all-pdf-folder')
    console.log('選択されたPDFフォルダ:', result)
    if (result && Array.isArray(result.allFiles)) {
      // フォルダごとにPDFファイルをフラットなリストに変換
      const allPdfFiles = result.allFiles.flatMap(folder => folder.files)
      // 最初のPDFを自動選択（必要に応じて変更可）
      setPdfList(allPdfFiles)
    }
  }

  // LLM+PDFでMCPリクエスト
  const handleSend = async () => {
    if (!pdfPath) return
    setLoading(true)
    setResponse('')
    try {
      const res = await window.electron.ipcRenderer.invoke('mcp-request', {
        llm: selectedLLM,
        pdfPath
      })
      setResponse(res)
    } catch (e) {
      setResponse('エラーが発生しました')
    }
    setLoading(false)
  }

  useEffect(() => {
    initSelectAllPDF()
  }, [])

  return (
    <>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <Versions></Versions>
      <div style={{ margin: '2em 0', padding: '1em', border: '1px solid #ccc', borderRadius: 8 }}>
        <div style={{ marginBottom: 12 }}>
          <label>LLMを選択: </label>
          <select value={selectedLLM} onChange={e => setSelectedLLM(e.target.value)}>
            {llmOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>APIキー: </label>
          <input
            type="text"
            value={llmKey}
            onChange={e => setLlmKey(e.target.value)}
            placeholder="APIキーを入力"
            style={{ width: '300px' }}
          />
        </div>
        { pdfList.length === 0 && 
          <div style={{ marginBottom: 12 }}>
            <button onClick={handleSelectPDF}>PDFフォルダを選択</button>
            <span style={{ marginLeft: 8 }}>{pdfList.length > 0 ? `${pdfList.length}件` : '未選択'}</span>
          </div>}
        {pdfList.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>PDFファイルを選択: </label>
            <select value={pdfPath || ''} onChange={e => setPdfPath(e.target.value)}>
              {pdfList.map(f => (
                <option key={f} value={f}>{f.split('/').pop()}</option>
              ))}
            </select>
          </div>
        )}
        <div className="text-input">
          <label>LLMリクエスト:</label>
          <textarea
            value={requestText}
            onChange={e => setRequestText(e.target.value)}
            style={{ width: '100%', height: 100, marginTop: 8, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <button onClick={handleSnedAction}>action</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <button onClick={handleSend} disabled={pdfList.length !== 0 || loading}>
            {loading ? '送信中...' : 'MCPリクエスト送信'}
          </button>
        </div>
        <div style={{ minHeight: 60, background: '#f9f9f9', padding: 8, borderRadius: 4 }}>
          <b>レスポンス:</b>
          <div style={{ whiteSpace: 'pre-wrap' }}>{response}</div>
        </div>
      </div>
    </>
  )
}

export default App
