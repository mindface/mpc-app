import React, { useState, useEffect } from 'react'

interface SearchResult {
  filename: string
  docId: string
  filePath: string
  totalMatches: number
  matches: {
    position: number
    context: string
    preview: string
  }[]
  metadata: {
    pages: number
    size: number
    createdAt: string
  }
}

interface PDFDocument {
  docId: string
  filename: string
  filePath: string
  pages: number
  contentLength: number
  createdAt: string
}

export const PDFSearchComponent: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [registeredPDFs, setRegisteredPDFs] = useState<PDFDocument[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load registered PDFs on component mount
  useEffect(() => {
    loadRegisteredPDFs()
  }, [])

  const loadRegisteredPDFs = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('get-registered-pdfs')
      if (result.success) {
        setRegisteredPDFs(result.documents)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load registered PDFs')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('search-pdf-documents', searchQuery, 10)
      
      if (result.success) {
        setSearchResults(result.results)
        if (result.results.length === 0) {
          setError(`No results found for "${searchQuery}"`)
        }
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="pdf-search-component">
      <div className="search-section">
        <h3>PDF Document Search</h3>
        
        <div className="search-input-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search within PDF documents..."
            className="search-input"
            disabled={isSearching}
          />
          <button 
            onClick={handleSearch} 
            disabled={isSearching || !searchQuery.trim()}
            className="search-button"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="pdf-stats">
          <span>{registeredPDFs.length} PDF documents registered</span>
          <button onClick={loadRegisteredPDFs} className="refresh-button">
            Refresh
          </button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
      </div>

      <div className="results-section">
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results ({searchResults.length} documents found)</h4>

            {searchResults.map((result, index) => {
              console.log('Search result:', result)
              return (
                <div key={index} className="result-item">
                  <div className="result-header">
                    <h5>{result.filename}</h5>
                    <span className="match-count">
                      {result.totalMatches} match{result.totalMatches !== 1 ? 'es' : ''} found
                    </span>
                  </div>

                  <div className="result-metadata">
                    <span>Pages: {result.metadata.pages}</span>
                    <span>Size: {Math.round(result.metadata.size / 1024)}KB</span>
                  </div>

                  <div className="matches">
                    {result.matches.map((match, matchIndex) => (
                      <div key={matchIndex} className="match-item">
                        <div className="match-context">
                          {match.preview}
                        </div>
                        <div className="match-position">
                          Position: {match.position}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="registered-pdfs">
          <h4>Registered PDF Documents ({registeredPDFs.length})</h4>
          {registeredPDFs.length > 0 ? (
            <div className="pdf-list">
              {registeredPDFs.map((pdf, index) => (
                <div key={index} className="pdf-item">
                  <div className="pdf-name">{pdf.filename}</div>
                  <div className="pdf-details">
                    <span>Pages: {pdf.pages}</span>
                    <span>Content: {Math.round(pdf.contentLength / 1024)}KB</span>
                    <span>Added: {new Date(pdf.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No PDFs registered. Place PDF files in the 'data' folder and restart the app.</p>
          )}
        </div>
      </div>

      <style>{`
        .pdf-search-component {
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }

        .search-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }

        .search-input-group {
          display: flex;
          gap: 10px;
          margin: 15px 0;
        }

        .search-input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .search-button {
          padding: 10px 20px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .search-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .pdf-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #666;
        }

        .refresh-button {
          padding: 5px 10px;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
        }

        .results-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .result-item {
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .result-header h5 {
          margin: 0;
          color: #333;
        }

        .match-count {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .result-metadata {
          display: flex;
          gap: 15px;
          font-size: 12px;
          color: #666;
          margin-bottom: 15px;
        }

        .match-item {
          background: #f9f9f9;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .match-context {
          font-family: monospace;
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 5px;
          white-space: pre-wrap;
          color: #333;
        }

        .match-position {
          font-size: 11px;
          color: #888;
        }

        .registered-pdfs {
          margin-top: 30px;
        }

        .pdf-list {
          display: grid;
          gap: 10px;
        }

        .pdf-item {
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 4px;
          background: #fafafa;
          font-weight: 500;
          margin-bottom: 5px;
        }

        .pdf-details {
          display: flex;
          gap: 15px;
          font-size: 12px;
          color: #666;
        }

        h3, h4, h5 {
          color: #333;
          margin-top: 0;
        }
      `}</style>
    </div>
  )
}