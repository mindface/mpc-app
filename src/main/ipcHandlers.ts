import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { LLMChain, ConversationMessage } from './module/llmChain'

let llmChain: LLMChain | null = null

export interface ConversationResult {
  success: boolean
  conversation?: ConversationMessage[]
  error?: string
}

export function setupIPCHandlers(): void {
  // Initialize LLM Chain with API keys
  ipcMain.handle('init-llm-chain', async (_event: IpcMainInvokeEvent, geminiApiKey: string, claudeApiKey: string) => {
    try {
      llmChain = new LLMChain({ geminiApiKey, claudeApiKey })
      return { success: true }
    } catch (error) {
      console.error('Failed to initialize LLM Chain:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Start AI conversation
  ipcMain.handle('start-ai-conversation', async (_event: IpcMainInvokeEvent, initialQuestion: string): Promise<ConversationResult> => {
    if (!llmChain) {
      return { 
        success: false, 
        error: 'LLM Chain not initialized. Please provide API keys first.' 
      }
    }

    try {
      console.log('Starting AI conversation with question:', initialQuestion)
      const conversation = await llmChain.runConversationChain(initialQuestion)
      return { success: true, conversation }
    } catch (error) {
      console.error('Conversation error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get conversation history
  ipcMain.handle('get-conversation-history', async (): Promise<ConversationMessage[]> => {
    if (!llmChain) {
      return []
    }
    return llmChain.getHistory()
  })

  // Clear conversation history
  ipcMain.handle('clear-conversation-history', async (): Promise<void> => {
    if (llmChain) {
      llmChain.clearHistory()
    }
  })
}