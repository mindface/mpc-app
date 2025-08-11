import React, { useState } from 'react'
import { ConversationDisplay } from './ConversationDisplay'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: 'gemini' | 'claude'
  timestamp: Date
}

export const ConversationController: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialQuestion, setInitialQuestion] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const initializeLLMChain = async () => {
    if (!geminiApiKey || !claudeApiKey) {
      setError('Please provide both API keys')
      return
    }

    try {
      const result = await window.electron.ipcRenderer.invoke('init-llm-chain', geminiApiKey, claudeApiKey)
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
      const result = await window.electron.ipcRenderer.invoke('start-ai-conversation', initialQuestion)
      
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
    await window.electron.ipcRenderer.invoke('clear-conversation-history')
    setMessages([])
    setInitialQuestion('')
  }

  return (
    <div className="conversation-controller">
      {!isInitialized ? (
        <div className="api-key-setup">
          <h2>Setup API Keys</h2>
          <div className="input-group">
            <label>Gemini API Key:</label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Enter Gemini API Key"
            />
          </div>
          <div className="input-group">
            <label>Claude API Key:</label>
            <input
              type="password"
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              placeholder="Enter Claude API Key"
            />
          </div>
          <button onClick={initializeLLMChain} className="init-button">
            Initialize LLM Chain
          </button>
        </div>
      ) : (
        <div className="conversation-controls">
          <h2>Start AI Conversation Chain</h2>
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
        
        .clear-button {
          background: #f0f0f0;
          color: #333;
        }
        
        .clear-button:hover:not(:disabled) {
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