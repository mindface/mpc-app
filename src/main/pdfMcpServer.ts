import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'

import { PDFDocument, SearchMatch, SearchResult } from './types/pdfTypes'

let pdfMcpServer: McpServer | null = null
let pdfDocuments: { [id: string]: PDFDocument } = {}

export async function createPDFMcpServer(): Promise<McpServer> {
  if (pdfMcpServer) return pdfMcpServer

  pdfMcpServer = new McpServer({
    name: 'pdf-search-server',
    version: '1.0.0'
  })

  // PDF登録ツール
  pdfMcpServer.registerTool('register-pdf',
    {
      title: 'Register PDF Document',
      description: 'Register a PDF document for search and retrieval',
      inputSchema: {
        filePath: z.string().describe('Path to the PDF file')
      }
    },
    async ({ filePath }) => {
      try {
        const buffer = fs.readFileSync(filePath)
        const parsed = await pdfParse(buffer)
        
        const docId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const filename = path.basename(filePath)
        
        const document: PDFDocument = {
          id: docId,
          filePath,
          filename,
          content: parsed.text,
          metadata: {
            pages: parsed.numpages || 0,
            size: buffer.length,
            createdAt: new Date(),
            info: parsed.info
          }
        }
        
        pdfDocuments[docId] = document
        
        console.log(`PDF registered: ${filename} (${parsed.text.length} characters)`)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              docId,
              filename,
              pages: document.metadata.pages,
              contentLength: parsed.text.length
            }, null, 2)
          }]
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message
            }, null, 2)
          }]
        }
      }
    }
  )

  // PDF検索ツール
  pdfMcpServer.registerTool('search-pdfs',
    {
      title: 'Search PDF Documents',
      description: 'Search for text within registered PDF documents',
      inputSchema: {
        query: z.string().describe('Search query'),
        maxResults: z.number().optional().describe('Maximum number of results (default: 10)'),
        contextLength: z.number().optional().describe('Length of context around matches (default: 200)')
      }
    },
    async ({ query, maxResults = 10, contextLength = 200 }) => {
      const results: SearchResult[] = []
      const queryLower = query.toLowerCase()
      
      for (const doc of Object.values(pdfDocuments)) {
        const contentLower = doc.content.toLowerCase()
        const matches: SearchMatch[] = []
        let startIndex = 0
        
        // Find all occurrences of the query
        while (startIndex < contentLower.length) {
          const index = contentLower.indexOf(queryLower, startIndex)
          if (index === -1) break
          
          // Extract context around the match
          const contextStart = Math.max(0, index - contextLength)
          const contextEnd = Math.min(doc.content.length, index + query.length + contextLength)
          const context = doc.content.substring(contextStart, contextEnd)
          
          matches.push({
            position: index,
            context: context.trim(),
            preview: context.replace(new RegExp(query, 'gi'), `**${query}**`)
          })
          
          startIndex = index + query.length
          
          if (matches.length >= maxResults) break
        }
        
        if (matches.length > 0) {
          results.push({
            docId: doc.id,
            filename: doc.filename,
            totalMatches: matches.length,
            matches: matches.slice(0, Math.min(matches.length, maxResults)),
            metadata: doc.metadata
          })
        }
        
        if (results.length >= maxResults) break
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            totalDocuments: Object.keys(pdfDocuments).length,
            resultsFound: results.length,
            results
          }, null, 2)
        }]
      }
    }
  )

  // PDF全文取得ツール
  pdfMcpServer.registerTool('get-pdf-content',
    {
      title: 'Get Full PDF Content',
      description: 'Get the complete text content of a registered PDF',
      inputSchema: {
        docId: z.string().describe('Document ID'),
        startChar: z.number().optional().describe('Start character position (default: 0)'),
        length: z.number().optional().describe('Length of text to return (default: full content)')
      }
    },
    async ({ docId, startChar = 0, length }) => {
      const doc = pdfDocuments[docId]
      if (!doc) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Document not found'
            }, null, 2)
          }]
        }
      }
      
      const content = length 
        ? doc.content.substring(startChar, startChar + length)
        : doc.content.substring(startChar)
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            docId: doc.id,
            filename: doc.filename,
            startChar,
            contentLength: content.length,
            content
          }, null, 2)
        }]
      }
    }
  )

  // PDF一覧取得ツール
  pdfMcpServer.registerTool('list-pdfs',
    {
      title: 'List PDF Documents',
      description: 'List all registered PDF documents',
      inputSchema: {}
    },
    async () => {
      const documentList = Object.values(pdfDocuments).map(doc => ({
        docId: doc.id,
        filename: doc.filename,
        pages: doc.metadata.pages,
        contentLength: doc.content.length,
        createdAt: doc.metadata.createdAt,
        filePath: doc.filePath
      }))
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalDocuments: documentList.length,
            documents: documentList
          }, null, 2)
        }]
      }
    }
  )

  // PDF削除ツール
  pdfMcpServer.registerTool('remove-pdf',
    {
      title: 'Remove PDF Document',
      description: 'Remove a PDF document from the search index',
      inputSchema: {
        docId: z.string().describe('Document ID to remove')
      }
    },
    async ({ docId }) => {
      const doc = pdfDocuments[docId]
      if (!doc) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Document not found'
            }, null, 2)
          }]
        }
      }
      
      const filename = doc.filename
      delete pdfDocuments[docId]
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Document ${filename} removed successfully`,
            docId
          }, null, 2)
        }]
      }
    }
  )

  console.log('PDF MCP Server created with search capabilities')
  return pdfMcpServer
}

// フォルダ内のすべてのPDFを自動登録
export async function registerPDFsFromFolder(folderPath: string): Promise<string[]> {
  if (!pdfMcpServer) {
    await createPDFMcpServer()
  }
  
  const registeredIds: string[] = []
  
  try {
    if (!fs.existsSync(folderPath)) {
      console.log(`Directory ${folderPath} does not exist`)
      return registeredIds
    }

    const files = fs.readdirSync(folderPath)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(folderPath, f))

    for (const pdfPath of files) {
      try {
        const buffer = fs.readFileSync(pdfPath)
        const parsed = await pdfParse(buffer)
        
        const docId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const filename = path.basename(pdfPath)
        
        const document: PDFDocument = {
          id: docId,
          filePath: pdfPath,
          filename,
          content: parsed.text,
          metadata: {
            pages: parsed.numpages || 0,
            size: buffer.length,
            createdAt: new Date(),
            info: parsed.info
          }
        }
        
        pdfDocuments[docId] = document
        registeredIds.push(docId)
        
        console.log(`PDF registered: ${filename} (${parsed.text.length} characters)`)
      } catch (error) {
        console.error(`Error loading PDF ${pdfPath}:`, error)
      }
    }
    
    console.log(`Registered ${registeredIds.length} PDF documents`)
  } catch (error) {
    console.error('Error registering PDFs from folder:', error)
  }
  
  return registeredIds
}

export function getPDFDocuments(): { [id: string]: PDFDocument } {
  return pdfDocuments
}

export function getPDFMcpServer(): McpServer | null {
  return pdfMcpServer
}