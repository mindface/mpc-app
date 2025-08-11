export interface PDFDocument {
  id: string
  filePath: string
  filename: string
  content: string
  metadata: {
    pages: number
    size: number
    createdAt: Date
    info?: any
  }
}

export interface SearchMatch {
  position: number
  context: string
  preview: string
}

export interface SearchResult {
  docId: string
  filename: string
  totalMatches: number
  matches: SearchMatch[]
  metadata: {
    pages: number
    size: number
    createdAt: Date
    info?: any
  }
}

export interface SearchResultForRenderer {
  filename: string
  docId: string
  filePath: string
  totalMatches: number
  matches: SearchMatch[]
  metadata: {
    pages: number
    size: number
    createdAt: string
  }
}

export interface PDFDocumentForRenderer {
  docId: string
  filename: string
  filePath: string
  pages: number
  contentLength: number
  createdAt: string
}

export interface SearchResponse {
  success: boolean
  query?: string
  totalDocuments?: number
  resultsFound?: number
  results?: SearchResultForRenderer[]
  error?: string
}

export interface PDFListResponse {
  success: boolean
  totalDocuments?: number
  documents?: PDFDocumentForRenderer[]
  error?: string
}