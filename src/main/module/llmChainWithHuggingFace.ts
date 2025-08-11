import { GoogleGenerativeAI } from '@google/generative-ai'
import { HfInference } from '@huggingface/inference'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: 'gemini' | 'huggingface'
  timestamp: Date
}

export interface LLMConfig {
  geminiApiKey: string
  huggingFaceApiKey: string
}

export class LLMChainWithHuggingFace {
  private gemini: GoogleGenerativeAI
  private huggingface: HfInference
  private conversationHistory: ConversationMessage[] = []

  constructor(config: LLMConfig) {
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey)
    this.huggingface = new HfInference(config.huggingFaceApiKey)
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

  private async askHuggingFace(prompt: string): Promise<string> {
    // Simplified approach using only text generation API
    const models = [
      'google/flan-t5-large',                 // Google's Flan-T5
      'gpt2',                                  // Standard GPT-2
      'EleutherAI/gpt-j-6B',                  // GPT-J
      'bigscience/bloom-560m',                // BLOOM small
    ]

    for (const modelName of models) {
      try {
        console.log(`Trying HuggingFace model: ${modelName}`)
        
        const response = await this.huggingface.textGeneration({
          model: modelName,
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.7,
            top_p: 0.95,
            return_full_text: false,
            do_sample: true
          }
        })
        
        if (response.generated_text) {
          console.log(`Successfully used model: ${modelName}`)
          return response.generated_text
        }
      } catch (error) {
        console.log(`Model ${modelName} failed: ${(error as Error).message}`)
        continue
      }
    }

    // If all models fail, return a fallback message
    console.error('All HuggingFace models failed')
    return `HuggingFace API is currently experiencing issues. Please use Cohere or Gemini-only mode instead.`
  }

  async runConversationChain(initialQuestion: string): Promise<ConversationMessage[]> {
    this.conversationHistory = []
    
    // Round 1: Gemini -> HuggingFace
    console.log('Round 1: Gemini asking HuggingFace...')
    this.conversationHistory.push({
      role: 'user',
      content: initialQuestion,
      from: 'gemini',
      timestamp: new Date()
    })
    
    const huggingfaceResponse1 = await this.askHuggingFace(initialQuestion)
    this.conversationHistory.push({
      role: 'assistant',
      content: huggingfaceResponse1,
      from: 'huggingface',
      timestamp: new Date()
    })

    // Round 2: Gemini responds and asks follow-up
    const geminiFollowUp = `この質問の回答。: "${huggingfaceResponse1.substring(0, 100)}...", 
    この概念の実践的な意味合いと現実的な応用例は何ですか？`
    
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

    // Round 3: HuggingFace asks final question based on Gemini's response
    const huggingfaceFollowUp = `あなたの分析に基づいて: "${geminiResponse2.substring(0, 100)}...", 
    これらの概念を実際に示す具体的な例やケーススタディを提供できますか?`

    console.log('Round 3: HuggingFace asking final question...')
    this.conversationHistory.push({
      role: 'user',
      content: huggingfaceFollowUp,
      from: 'huggingface',
      timestamp: new Date()
    })

    const geminiFinalResponse = await this.askGemini(huggingfaceFollowUp)
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