import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import pdfParse from 'pdf-parse'
import { z } from 'zod'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setupIPCHandlers } from './ipcHandlers'
import { setupUnifiedIPCHandlers } from './ipcHandlersUnified'

dotenv.config()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI ?? "");

// グローバルでMCPサーバーのインスタンスを保持
let mcpServer: McpServer | null = null
let pdfContexts: { [pdfPath: string]: string } = {} // PDFファイルパス→テキストコンテンツ
let pdfSummaries: { [pdfPath: string]: { summary: string; contextId: string } } = {}

async function createMcpServer(): Promise<void> {
  if (mcpServer) return // 既に作成済み

  // MCPサーバーを作成
  mcpServer = new McpServer({
    name: 'pdf-analyzer-server',
    version: '1.0.0'
  })

  // PDFテキスト取得ツールを登録
  mcpServer.registerTool('get-pdf-content',
    {
      title: 'Get PDF Content',
      description: 'Get the text content of a PDF file',
      inputSchema: {
        pdfPath: z.string()
      }
    },
    async ({ pdfPath }) => {
      const content = pdfContexts[pdfPath]
      if (!content) {
        return {
          content: [{ type: 'text', text: 'PDF not found or not loaded' }]
        }
      }
      return {
        content: [{ type: 'text', text: content }]
      }
    }
  )

  // PDF要約ツールを登録
  mcpServer.registerTool('summarize-pdf',
      {
      title: 'Summarize PDF',
      description: 'Summarize the content of a PDF file',
      inputSchema: {
        pdfPath: z.string(),
        prompt: z.string().optional()
      }
    },
    async ({ pdfPath, prompt }) => {
      const content = pdfContexts[pdfPath]
      if (!content) {
        return {
          content: [{ type: 'text', text: 'PDF not found or not loaded' }]
        }
      }

      // Gemini呼び出し
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      const promptText = `以下のPDF内容を要約してください。\n${prompt ?? content}`
      const result = await model.generateContent(promptText)
      const response = await result.response.text()
      console.log("¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥¥")
      console.log('Summarize PDF response:', response)

      return {
        content: [{ type: 'text', text: response }]
      }
    }
  )

  // PDFリストツールを登録
  mcpServer.registerTool('list-pdfs',
    {
      title: 'List PDFs',
      description: 'List all loaded PDF files',
      inputSchema: {}
    },
    async () => {
      const pdfList = Object.keys(pdfContexts).map(pdfPath => ({
        path: pdfPath,
        name: path.basename(pdfPath),
        size: pdfContexts[pdfPath].length
      }))
      console.log('PDF List:', pdfList)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(pdfList, null, 2)
        }]
      }
    }
  )

  console.log('MCP Server created with PDF tools')
}

// 1. 各PDFをGeminiで要約し、MCPサーバーに登録
async function preloadAllPdfsToGemini(llm: string = 'gemini-1.5-flash'): Promise<{ success: boolean; results: { file: string; summary: string; contextId: string }[]; error?: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: llm })
    const MAX_LENGTH = 4000
    const results: { file: string; summary: string; contextId: string }[] = []

    for (const [pdfPath, contentRaw] of Object.entries(pdfContexts)) {
      let content = contentRaw
      if (content.length > MAX_LENGTH) {
        content = content.slice(0, MAX_LENGTH) + '\n...（省略されています）'
      }
      const promptText = `
ファイル名: ${path.basename(pdfPath)}
----------------------------
${content}
----------------------------
このPDFの要点を一文でまとめてください。またのちほどデータに対して[ファイル名:]がついていない形式で質問します。
`.trim()
      try {
        // 1. Geminiで要約
        const result = await model.generateContent(promptText)
        const summary = await result.response.text()

        // 2. MCPサーバーに要約＋メタデータで登録
        // ここではregisterToolやregisterContext等、MCPサーバーのAPIに合わせてください
        // 例: mcpServer.registerTool('pdf-summary', ...) ではなく、context登録APIを仮定
        let contextId = ''
        if (mcpServer && typeof (mcpServer as any).createContext === 'function') {
          const ctx = await (mcpServer as any).createContext({
            content: summary,
            metadata: {
              source: path.basename(pdfPath),
              type: 'pdf'
            }
          })
          contextId = ctx?.id ?? ''
        }
        pdfSummaries[pdfPath] = { summary, contextId }
        results.push({ file: pdfPath, summary, contextId })
        console.log(`[MCP preload] ${pdfPath}: summary="${summary}", contextId=${contextId}`)
      } catch (e) {
        results.push({ file: pdfPath, summary: 'Gemini要約失敗', contextId: '' })
        console.error(`[Gemini preload error] ${pdfPath}:`, e)
      }
    }
    return { success: true, results }
  } catch (error) {
    return { success: false, results: [], error: error instanceof Error ? error.message : String(error) }
  }
}

async function prepareMcpContexts(targetFolder: string): Promise<void> {
  try {
    // MCPサーバーを作成・起動
    await createMcpServer()

    // ./data フォルダ内の全PDFを取得
    const dataDir = path.join(process.cwd(), targetFolder)
    if (!fs.existsSync(dataDir)) {
      console.log(`Directory ${dataDir} does not exist`)
      return
    }

    const files = fs.readdirSync(dataDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(dataDir, f))

    // 各PDFを読み込んでメモリに保存
    for (const pdfPath of files) {
      try {
        const buffer = fs.readFileSync(pdfPath)
        const parsed = await pdfParse(buffer)
        pdfContexts[pdfPath] = parsed.text
        console.log(`PDF loaded: ${path.basename(pdfPath)} (${parsed.text.length} characters)`)
      } catch (error) {
        console.error(`Error loading PDF ${pdfPath}:`, error)
      }
    }

    console.log(`Loaded ${Object.keys(pdfContexts).length} PDF files`)
  } catch (error) {
    console.error('Error preparing MCP contexts:', error)
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then( async () => {
  await prepareMcpContexts('data')
  await preloadAllPdfsToGemini() 
  
  // Setup IPC handlers for LLM Chain
  setupIPCHandlers()
  setupUnifiedIPCHandlers()
  
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // PDFファイル選択ダイアログ
  ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { filePath: null }
    }
    return { filePath: result.filePaths[0] }
  })


  // ipcMain.handle('prepare-mcp-contexts', async (_event, { folderPath, llm }) => {
  //   try {
  //     const pdfFiles = fs.readdirSync(folderPath)
  //       .filter(f => f.endsWith('.pdf'))
  //       .map(f => path.join(folderPath, f))

  //     mcpClient = new ModelContextClient({ baseUrl: 'http://localhost:8700' })

  //     globalContextIds = []

  //     for (const pdfPath of pdfFiles) {
  //       const buffer = fs.readFileSync(pdfPath)
  //       const parsed = await pdfParse(buffer)

  //       const ctx = await mcpClient.contexts.create({
  //         content: parsed.text,
  //         metadata: {
  //           source: path.basename(pdfPath),
  //           type: 'pdf'
  //         }
  //       })

  //       globalContextIds.push(ctx.id)
  //       console.log(`Context created: ${ctx.id} (${pdfPath})`)
  //     }

  //     return {
  //       success: true,
  //       contextCount: globalContextIds.length
  //     }

  //   } catch (e) {
  //     console.error('[prepare-mcp-contexts ERROR]', e)
  //     return { success: false, error: e.message }
  //   }
  // })

  // PDFフォルダ選択ダイアログ
  ipcMain.handle('select-pdf-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { pdfFiles: [] }
    }
    const folderPath = result.filePaths[0]
    const files = fs.readdirSync(folderPath)
    const pdfFiles = files
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => path.join(folderPath, f))
    return { pdfFiles }
  })

  ipcMain.handle('all-pdf-folder', async () => {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      return { allFiles: [] }
    }
    const files = fs.readdirSync(dataDir)
    const allFiles = [{
      folder: dataDir,
      files: files.map(f => path.join(dataDir, f))
    }]
    // ログ出力で確認
    allFiles.forEach(({ folder, files }) => {
      console.log(`フォルダ: ${folder}`)
      files.forEach(f => console.log(`  ${f}`))
    })
    console.log('pdfContexts:', pdfContexts)
    return { allFiles }
  })

  // MCPリクエスト: PDF解析→LLM/MCPサーバー呼び出し
  ipcMain.handle('mcp-request', async (_event, { llm, pdfPath, prompt }) => {
    console.log('MCP request received:', { llm, pdfPath, prompt })
    try {
      if (!mcpServer || !pdfContexts[pdfPath]) {
        return {
          success: false,
          error: 'MCPサーバーが未起動、またはPDFが未登録です'
        }
      }

    const model = genAI.getGenerativeModel({ model: llm || 'gemini-1.5-flash' })
    const fileName = path.basename(pdfPath)
    let content = pdfContexts[pdfPath]

    // 上限（例: 4000文字）を超える場合は先頭のみ利用
    const MAX_LENGTH = 4000
    if (content.length > MAX_LENGTH) {
      content = content.slice(0, MAX_LENGTH) + '\n...（省略されています）'
    }

    // Geminiに送るプロンプトは「質問のみ」
    const promptText = `
ファイル名:  ${fileName}
----------------------------
${content}
----------------------------
質問: ${prompt}
`.trim()

      const result = await model.generateContent(promptText)
      const responseText = await result.response.text()
      console.log('MCP response:', responseText)

      return {
        success: true,
        data: responseText
      }
    } catch (error) {
      console.error('MCP request error:', error)
      return {
        success: false,
        error: 'MCPリクエストでエラーが発生しました: '
      }
    }
  })

  // フォルダからPDFを再読み込み
  ipcMain.handle('reload-pdfs', async (_event, folderPath) => {
    try {
      await prepareMcpContexts(folderPath)
      await preloadAllPdfsToGemini() 
      return {
        success: true,
        count: Object.keys(pdfContexts).length
      }
    } catch (error) {
      return {
        success: false,
        error: error
      }
    }
  })

  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
