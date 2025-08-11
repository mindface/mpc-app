import React, { useState } from 'react'
import { ConversationDisplay } from './ConversationDisplay'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: string
  timestamp: Date
}

type ChainType = 'claude-gemini' | 'gemini-only' | 'huggingface-gemini' | 'cohere-gemini'

export const UnifiedConversationController: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialQuestion, setInitialQuestion] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [huggingFaceApiKey, setHuggingFaceApiKey] = useState('')
  const [cohereApiKey, setCohereApiKey] = useState('')
  const [chainType, setChainType] = useState<ChainType>('gemini-only')
  const [isInitialized, setIsInitialized] = useState(false)

  const initializeLLMChain = async () => {
    const keys: any = { geminiApiKey }
    
    switch (chainType) {
      case 'claude-gemini':
        if (!geminiApiKey || !claudeApiKey) {
          setError('Please provide both Gemini and Claude API keys')
          return
        }
        keys.claudeApiKey = claudeApiKey
        break
        
      case 'huggingface-gemini':
        if (!geminiApiKey || !huggingFaceApiKey) {
          setError('Please provide both Gemini and HuggingFace API keys')
          return
        }
        keys.huggingFaceApiKey = huggingFaceApiKey
        break
        
      case 'cohere-gemini':
        if (!geminiApiKey || !cohereApiKey) {
          setError('Please provide both Gemini and Cohere API keys')
          return
        }
        keys.cohereApiKey = cohereApiKey
        break
        
      case 'gemini-only':
        if (!geminiApiKey) {
          setError('Please provide Gemini API key')
          return
        }
        break
    }

    try {
      const result = await window.electron.ipcRenderer.invoke('init-llm-unified', chainType, keys)
      if (result.success) {
        setIsInitialized(true)
        setError(null)
      } else {
        setError(result.error || 'Failed to initialize')
      }
    } catch (err) {
      setError('Failed to initialize LLM chain')
    }
  }

  const startConversation = async () => {
    if (!initialQuestion.trim()) {
      setError('Please enter a question')
      return
    }

    if (!isInitialized) {
      setError('Please initialize with API keys first')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('start-unified-conversation', initialQuestion)
      
      if (result.success && result.conversation) {
        setMessages(result.conversation)
      } else {
        setError(result.error || 'Failed to start conversation')
      }
    } catch (err) {
      setError('Error starting conversation')
    } finally {
      setIsLoading(false)
    }
  }

  const clearConversation = async () => {
    await window.electron.ipcRenderer.invoke('clear-unified-history')
    setMessages([])
    setInitialQuestion('')
  }

  const getChainLabel = (type: ChainType): string => {
    switch (type) {
      case 'claude-gemini':
        return 'Claude + Gemini (Paid)'
      case 'huggingface-gemini':
        return 'HuggingFace + Gemini (Free - Currently Unstable)'
      case 'cohere-gemini':
        return 'Cohere + Gemini (Free)'
      case 'gemini-only':
        return 'Gemini Only (Free)'
    }
  }

  return (
    <div className="conversation-controller">
      {!isInitialized ? (
        <div className="api-key-setup">
          <h2>Setup AI Conversation Chain</h2>
          
          <div className="input-group">
            <label>Select Chain Type:</label>
            <select 
              value={chainType} 
              onChange={(e) => setChainType(e.target.value as ChainType)}
              className="chain-select"
            >
              <option value="gemini-only">Gemini Only (Free - Single API)</option>
              <option value="cohere-gemini">Cohere + Gemini (Free - Recommended)</option>
              <option value="huggingface-gemini">HuggingFace + Gemini (Free - Currently Unstable)</option>
              <option value="claude-gemini">Claude + Gemini (Paid Claude API)</option>
            </select>
          </div>

          {(chainType === 'gemini-only' || chainType === 'huggingface-gemini' || chainType === 'claude-gemini' || chainType === 'cohere-gemini') && (
            <div className="input-group">
              <label>Gemini API Key:</label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter Gemini API Key (Free tier available)"
              />
              <small>Get it from: <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></small>
            </div>
          )}

          {chainType === 'cohere-gemini' && (
            <div className="input-group">
              <label>Cohere API Key:</label>
              <input
                type="password"
                value={cohereApiKey}
                onChange={(e) => setCohereApiKey(e.target.value)}
                placeholder="Enter Cohere API Key (Free tier available)"
              />
              <small>Get it from: <a href="https://dashboard.cohere.com/api-keys" target="_blank">Cohere Dashboard</a></small>
            </div>
          )}

          {chainType === 'huggingface-gemini' && (
            <div className="input-group">
              <label>HuggingFace API Key:</label>
              <input
                type="password"
                value={huggingFaceApiKey}
                onChange={(e) => setHuggingFaceApiKey(e.target.value)}
                placeholder="Enter HuggingFace API Key (Free tier available)"
              />
              <small>Get it from: <a href="https://huggingface.co/settings/tokens" target="_blank">HuggingFace Settings</a></small>
            </div>
          )}

          {chainType === 'claude-gemini' && (
            <div className="input-group">
              <label>Claude API Key:</label>
              <input
                type="password"
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                placeholder="Enter Claude API Key (Paid - requires credits)"
              />
              <small>Get it from: <a href="https://console.anthropic.com" target="_blank">Anthropic Console</a> (Requires payment)</small>
            </div>
          )}

          <button onClick={initializeLLMChain} className="init-button">
            Initialize {getChainLabel(chainType)}
          </button>
        </div>
      ) : (
        <div className="conversation-controls">
          <h2>AI Conversation Chain ({getChainLabel(chainType)})</h2>
          <div className="input-group">
            <textarea
              value={initialQuestion}
              onChange={(e) => setInitialQuestion(e.target.value)}
              placeholder="Enter your initial question for the AI conversation..."
              rows={3}
              disabled={isLoading}
            />
          </div>
          <div className="button-group">
            <button 
              onClick={startConversation} 
              disabled={isLoading || !initialQuestion.trim()}
              className="start-button"
            >
              {isLoading ? 'Processing...' : 'Start 3-Round Conversation'}
            </button>
            <button 
              onClick={clearConversation} 
              disabled={isLoading}
              className="clear-button"
            >
              Clear
            </button>
            <button 
              onClick={() => {
                setIsInitialized(false)
                setMessages([])
              }} 
              disabled={isLoading}
              className="reset-button"
            >
              Change API Keys
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <ConversationDisplay messages={messages} isLoading={isLoading} />

      <style>{`
        .conversation-controller {
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        
        .api-key-setup, .conversation-controls {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .chain-select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
        }
        
        .input-group {
          margin-bottom: 15px;
        }
        
        .input-group label {
          display: block;
          margin-bottom: 5px;
          color: #333;
          font-weight: 500;
        }
        
        .input-group input,
        .input-group textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .input-group small {
          display: block;
          margin-top: 5px;
          color: #666;
          font-size: 12px;
        }
        
        .input-group small a {
          color: #4285f4;
          text-decoration: none;
        }
        
        .input-group small a:hover {
          text-decoration: underline;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
        }
        
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .init-button, .start-button {
          background: #4285f4;
          color: white;
        }
        
        .init-button:hover, .start-button:hover:not(:disabled) {
          background: #357ae8;
        }
        
        .clear-button, .reset-button {
          background: #f0f0f0;
          color: #333;
        }
        
        .clear-button:hover:not(:disabled), .reset-button:hover:not(:disabled) {
          background: #e0e0e0;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        h2 {
          margin-bottom: 20px;
          color: #333;
        }
      `}</style>
    </div>
  )
}