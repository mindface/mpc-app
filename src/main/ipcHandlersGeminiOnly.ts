import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { LLMChainGeminiOnly, ConversationMessage } from './module/llmChainGeminiOnly'

let llmChain: LLMChainGeminiOnly | null = null

export interface ConversationResult {
  success: boolean
  conversation?: ConversationMessage[]
  error?: string
}

export function setupGeminiOnlyIPCHandlers(): void {
  // Initialize Gemini-only Chain with API key
  ipcMain.handle('init-gemini-chain', async (_event: IpcMainInvokeEvent, geminiApiKey: string) => {
    try {
      llmChain = new LLMChainGeminiOnly({ geminiApiKey })
      return { success: true }
    } catch (error) {
      console.error('Failed to initialize Gemini Chain:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Start Gemini conversation
  ipcMain.handle('start-gemini-conversation', async (_event: IpcMainInvokeEvent, initialQuestion: string): Promise<ConversationResult> => {
    if (!llmChain) {
      return { 
        success: false, 
        error: 'Gemini Chain not initialized. Please provide API key first.' 
      }
    }

    try {
      console.log('Starting Gemini conversation with question:', initialQuestion)
      const conversation = await llmChain.runConversationChain(initialQuestion)
      return { success: true, conversation }
    } catch (error) {
      console.error('Conversation error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get conversation history
  ipcMain.handle('get-gemini-history', async (): Promise<ConversationMessage[]> => {
    if (!llmChain) {
      return []
    }
    return llmChain.getHistory()
  })

  // Clear conversation history
  ipcMain.handle('clear-gemini-history', async (): Promise<void> => {
    if (llmChain) {
      llmChain.clearHistory()
    }
  })
}