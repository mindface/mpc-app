import { GoogleGenerativeAI } from '@google/generative-ai'
import { CohereClient } from 'cohere-ai'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: 'gemini' | 'cohere'
  timestamp: Date
}

export interface LLMConfig {
  geminiApiKey: string
  cohereApiKey: string
}

export class LLMChainWithCohere {
  private gemini: GoogleGenerativeAI
  private cohere: CohereClient
  private conversationHistory: ConversationMessage[] = []

  constructor(config: LLMConfig) {
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey)
    this.cohere = new CohereClient({
      token: config.cohereApiKey,
    })
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

  private async askCohere(prompt: string): Promise<string> {
    try {
      console.log('Calling Cohere API...')
      
      // Use Cohere's generate endpoint (free tier available)
      const response = await this.cohere.generate({
        model: 'command-light', // Free model
        prompt: prompt,
        maxTokens: 300,
        temperature: 0.7,
        k: 0,
        p: 0.95,
        stopSequences: [],
        returnLikelihoods: 'NONE'
      })

      if (response.generations && response.generations.length > 0) {
        console.log('Cohere API successful')
        return response.generations[0].text.trim()
      }
      
      throw new Error('No response from Cohere')
    } catch (error) {
      console.error('Cohere API error:', error)
      
      // Try chat endpoint as fallback
      try {
        console.log('Trying Cohere chat endpoint...')
        const chatResponse = await this.cohere.chat({
          model: 'command-light',
          message: prompt,
        })
        
        if (chatResponse.text) {
          return chatResponse.text
        }
      } catch (chatError) {
        console.error('Cohere chat also failed:', chatError)
      }
      
      throw new Error(`Cohere API failed: ${(error as Error).message}`)
    }
  }

  async runConversationChain(initialQuestion: string): Promise<ConversationMessage[]> {
    this.conversationHistory = []
    
    // Round 1: Gemini -> Cohere
    console.log('Round 1: Gemini asking Cohere...')
    this.conversationHistory.push({
      role: 'user',
      content: initialQuestion,
      from: 'gemini',
      timestamp: new Date()
    })
    
    let cohereResponse1: string
    try {
      cohereResponse1 = await this.askCohere(initialQuestion)
    } catch (error) {
      console.log('Cohere failed, using Gemini as fallback')
      cohereResponse1 = await this.askGemini(`Please answer: ${initialQuestion}`)
    }
    
    this.conversationHistory.push({
      role: 'assistant',
      content: cohereResponse1,
      from: 'cohere',
      timestamp: new Date()
    })

    // Round 2: Gemini responds and asks follow-up
    const geminiFollowUp = `Based on your response: "${cohereResponse1.substring(0, 100)}...", 
    what are the practical implications and real-world applications of this concept?`
    
    console.log('Round 2: Gemini generating follow-up response...')
    const geminiResponse2 = await this.askGemini(geminiFollowUp)
    this.conversationHistory.push({
      role: 'user',
      content: geminiFollowUp,
      from: 'gemini',
      timestamp: new Date()
    })
    this.conversationHistory.push({
      role: 'assistant',
      content: geminiResponse2,
      from: 'gemini',
      timestamp: new Date()
    })

    // Round 3: Cohere asks final question based on Gemini's response
    const cohereFollowUp = `Based on your analysis: "${geminiResponse2.substring(0, 100)}...", 
    can you provide specific examples or case studies?`

    console.log('Round 3: Cohere asking final question...')
    this.conversationHistory.push({
      role: 'user',
      content: cohereFollowUp,
      from: 'cohere',
      timestamp: new Date()
    })

    const geminiFinalResponse = await this.askGemini(cohereFollowUp)
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