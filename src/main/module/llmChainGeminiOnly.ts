import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: 'gemini-1' | 'gemini-2'
  timestamp: Date
}

export interface LLMConfig {
  geminiApiKey: string
}

export class LLMChainGeminiOnly {
  private gemini: GoogleGenerativeAI
  private conversationHistory: ConversationMessage[] = []

  constructor(config: LLMConfig) {
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey)
  }

  private async askGemini(prompt: string, modelVersion: string = 'gemini-1.5-flash'): Promise<string> {
    try {
      const model = this.gemini.getGenerativeModel({ model: modelVersion })
      const result = await model.generateContent(prompt)
      const response = result.response
      return response.text()
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Gemini API failed: ${(error as Error).message}`)
    }
  }

  async runConversationChain(initialQuestion: string): Promise<ConversationMessage[]> {
    this.conversationHistory = []

    // Round 1: Gemini-1 asks the initial question
    console.log('Round 1: Gemini-1 processing initial question...')
    this.conversationHistory.push({
      role: 'user',
      content: initialQuestion,
      from: 'gemini-1',
      timestamp: new Date()
    })
    
    // Gemini-2 responds with a different perspective
    const gemini2Response1 = await this.askGemini(
      `この質問を実践的な観点から回答してください: ${initialQuestion}`
    )
    this.conversationHistory.push({
      role: 'assistant',
      content: gemini2Response1,
      from: 'gemini-2',
      timestamp: new Date()
    })
    
    // Round 2: Gemini-1 asks follow-up based on Gemini-2's response
    const gemini1FollowUp = `ご回答に基づいた回答: "${gemini2Response1.substring(0, 100)}...", 
    考慮すべき潜在的な課題や制限は何でしょうか？`

    console.log('Round 2: Gemini-1 asking follow-up...')
    this.conversationHistory.push({
      role: 'user',
      content: gemini1FollowUp,
      from: 'gemini-1',
      timestamp: new Date()
    })

    const gemini2Response2 = await this.askGemini(gemini1FollowUp)
    this.conversationHistory.push({
      role: 'assistant',
      content: gemini2Response2,
      from: 'gemini-2',
      timestamp: new Date()
    })
    
    // Round 3: Final exchange
    const gemini1FinalQuestion = `あなたが言及した課題に基づいて: "${gemini2Response2.substring(0, 100)}...",
    これらの問題に対処するためのベストプラクティスや解決策は何でしょうか？`

    console.log('Round 3: Final exchange...')
    this.conversationHistory.push({
      role: 'user',
      content: gemini1FinalQuestion,
      from: 'gemini-1',
      timestamp: new Date()
    })

    const gemini2FinalResponse = await this.askGemini(gemini1FinalQuestion)
    this.conversationHistory.push({
      role: 'assistant',
      content: gemini2FinalResponse,
      from: 'gemini-2',
      timestamp: new Date()
    })

    console.log('Conversation chain completed!')
    return this.conversationHistory
  }

  getHistory(): ConversationMessage[] {
    return this.conversationHistory
  }

  clearHistory(): void {
    this.conversationHistory = []
  }
}