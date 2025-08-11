import React from 'react'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  from: string
  timestamp: Date
}

interface ConversationDisplayProps {
  messages: ConversationMessage[]
  isLoading: boolean
}

export const ConversationDisplay: React.FC<ConversationDisplayProps> = ({ messages, isLoading }) => {
  return (
    <div className="conversation-display">
      <h3>AI Conversation Chain</h3>
      {messages.length === 0 && !isLoading && (
        <p className="no-messages">No conversation yet. Start by entering a question above.</p>
      )}

      {messages.map((message, index) => (
        <div key={index} className={`message ${message.role} ${message.from}`}>
          <div className="message-header">
            <span className="message-from">
              {message.from === 'gemini' ? '🤖 Gemini' : 
               message.from === 'claude' ? '🧠 Claude' :
               message.from === 'cohere' ? '🎯 Cohere' :
               message.from === 'huggingface' ? '🤗 HuggingFace' :
               `💬 ${message.from}`}
            </span>
            <span className="message-role">
              {message.role === 'user' ? 'Asking' : 'Responding'}
            </span>
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="message-content">
            {message.content}
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Processing conversation...</span>
        </div>
      )}
      
      <style>{`
        .conversation-display {
          max-width: 800px;
          margin: 20px auto;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        
        .conversation-display h3 {
          margin-bottom: 20px;
          color: #333;
        }
        
        .no-messages {
          text-align: center;
          color: #666;
          padding: 40px;
        }
        
        .message {
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .message.user.gemini {
          border-left: 4px solid #4285f4;
        }
        
        .message.assistant.claude {
          border-left: 4px solid #ff6b6b;
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 0.9em;
          color: #666;
        }
        
        .message-from {
          font-weight: bold;
        }
        
        .message-content {
          color: #333;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #666;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 10px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}