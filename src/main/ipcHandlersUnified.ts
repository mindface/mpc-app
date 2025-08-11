import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { LLMChain } from './module/llmChain'
import { LLMChainGeminiOnly } from './module/llmChainGeminiOnly'
import { LLMChainWithHuggingFace } from './module/llmChainWithHuggingFace'
import { LLMChainWithCohere } from './module/llmChainWithCohere'

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  from: string
  timestamp: Date
}

let currentChain: LLMChain | LLMChainGeminiOnly | LLMChainWithHuggingFace | LLMChainWithCohere | null = null
let chainType: 'claude-gemini' | 'gemini-only' | 'huggingface-gemini' | 'cohere-gemini' | null = null

export interface ConversationResult {
  success: boolean
  conversation?: ConversationMessage[]
  error?: string
}

export function setupUnifiedIPCHandlers(): void {
  // Initialize chain based on available API keys
  ipcMain.handle('init-llm-unified', async (
    _event: IpcMainInvokeEvent, 
    type: 'claude-gemini' | 'gemini-only' | 'huggingface-gemini' | 'cohere-gemini',
    keys: { geminiApiKey?: string; claudeApiKey?: string; huggingFaceApiKey?: string; cohereApiKey?: string }
  ) => {
    try {
      chainType = type
      
      switch (type) {
        case 'claude-gemini':
          if (!keys.geminiApiKey || !keys.claudeApiKey) {
            throw new Error('Both Gemini and Claude API keys are required')
          }
          currentChain = new LLMChain({ 
            geminiApiKey: keys.geminiApiKey, 
            claudeApiKey: keys.claudeApiKey 
          })
          break
          
        case 'gemini-only':
          if (!keys.geminiApiKey) {
            throw new Error('Gemini API key is required')
          }
          currentChain = new LLMChainGeminiOnly({ 
            geminiApiKey: keys.geminiApiKey 
          })
          break
          
        case 'huggingface-gemini':
          if (!keys.geminiApiKey || !keys.huggingFaceApiKey) {
            throw new Error('Both Gemini and HuggingFace API keys are required')
          }
          currentChain = new LLMChainWithHuggingFace({ 
            geminiApiKey: keys.geminiApiKey,
            huggingFaceApiKey: keys.huggingFaceApiKey 
          })
          break
          
        case 'cohere-gemini':
          if (!keys.geminiApiKey || !keys.cohereApiKey) {
            throw new Error('Both Gemini and Cohere API keys are required')
          }
          currentChain = new LLMChainWithCohere({ 
            geminiApiKey: keys.geminiApiKey,
            cohereApiKey: keys.cohereApiKey 
          })
          break
          
        default:
          throw new Error('Invalid chain type')
      }
      
      return { success: true, chainType: type }
    } catch (error) {
      console.error('Failed to initialize LLM Chain:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Start conversation with any chain
  ipcMain.handle('start-unified-conversation', async (
    _event: IpcMainInvokeEvent, 
    initialQuestion: string
  ): Promise<ConversationResult> => {
    if (!currentChain) {
      return { 
        success: false, 
        error: 'No LLM Chain initialized. Please provide API keys first.' 
      }
    }

    try {
      console.log(`Starting ${chainType} conversation with question:`, initialQuestion)
      const conversation = await currentChain.runConversationChain(initialQuestion)
      return { success: true, conversation }
    } catch (error) {
      console.error('Conversation error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get conversation history
  ipcMain.handle('get-unified-history', async (): Promise<ConversationMessage[]> => {
    if (!currentChain) {
      return []
    }
    return currentChain.getHistory()
  })

  // Clear conversation history
  ipcMain.handle('clear-unified-history', async (): Promise<void> => {
    if (currentChain) {
      currentChain.clearHistory()
    }
  })

  // Get current chain type
  ipcMain.handle('get-chain-type', async (): Promise<string | null> => {
    return chainType
  })
}