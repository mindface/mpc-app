import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: 'gemini' | 'claude'
  timestamp: Date
}

export interface LLMConfig {
  geminiApiKey: string
  claudeApiKey: string
}

export class LLMChain {
  private gemini: GoogleGenerativeAI
  private claude: Anthropic
  private conversationHistory: ConversationMessage[] = []

  constructor(config: LLMConfig) {
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey)
    this.claude = new Anthropic({ apiKey: config.claudeApiKey })
  }

  private async askGemini(prompt: string): Promise<string> {
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      const response = result.response
      return response.text()
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Gemini API failed: ${(error as Error).message}`)
    }
  }

  private async askClaude(prompt: string): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
      
      if (response.content[0].type === 'text') {
        return response.content[0].text
      }
      throw new Error('Unexpected response format from Claude')
    } catch (error) {
      console.error('Claude API error:', error)
      throw new Error(`Claude API failed: ${(error as Error).message}`)
    }
  }

  async runConversationChain(initialQuestion: string): Promise<ConversationMessage[]> {
    this.conversationHistory = []

    // Round 1: Gemini -> Claude (fallback to Gemini if Claude fails)
    console.log('Round 1: Gemini asking Claude...')
    this.conversationHistory.push({
      role: 'user',
      content: initialQuestion,
      from: 'gemini',
      timestamp: new Date()
    })

    let claudeResponse1: string
    try {
      claudeResponse1 = await this.askClaude(initialQuestion)
    } catch (error) {
      console.log('Claude API failed, using Gemini fallback...')
      claudeResponse1 = await this.askGemini(`この質問に回答してください: ${initialQuestion}`)
    }
    this.conversationHistory.push({
      role: 'assistant',
      content: claudeResponse1,
      from: 'claude',
      timestamp: new Date()
    })

    // Round 2: Based on Claude's response, Gemini formulates a follow-up
    const geminiFollowUp = `あなたの回答に基づいた返答: "${claudeResponse1.substring(0, 100)}...", 
    この概念の実際的な意味と現実世界での応用は何でしょうか?`

    console.log('Round 2: Gemini generating follow-up response...')
    const geminiResponse2 = await this.askGemini(geminiFollowUp)
    this.conversationHistory.push({
      role: 'assistant',
      content: geminiResponse2,
      from: 'gemini',
      timestamp: new Date()
    })
    
    // Round 3: Claude asks final question based on Gemini's response
    const claudeFollowUp = `あなたの分析に基づいて: "${geminiResponse2.substring(0, 100)}...",
    これらの概念を実際に示す具体的な例やケーススタディを提供できますか?`;

    console.log('Round 3: Claude asking final question...')
    this.conversationHistory.push({
      role: 'user',
      content: claudeFollowUp,
      from: 'claude',
      timestamp: new Date()
    })

    const geminiFinalResponse = await this.askGemini(claudeFollowUp)
    this.conversationHistory.push({
      role: 'assistant',
      content: geminiFinalResponse,
      from: 'gemini',
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