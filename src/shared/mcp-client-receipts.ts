import fs from 'node:fs'
import path from 'node:path'

export interface McpClientReceipt {
  name: string
  version: string | null
  connectedAt: number
}

const receiptFile = 'mcp-clients.jsonl'

export function mcpClientReceiptPath(dataDir: string): string {
  return path.join(dataDir, receiptFile)
}

export function appendMcpClientReceipt(
  dataDir: string,
  input: { name: string; version?: string | null; connectedAt?: number }
): McpClientReceipt {
  const receipt: McpClientReceipt = {
    name: input.name.trim().slice(0, 160),
    version: input.version?.trim().slice(0, 80) || null,
    connectedAt: input.connectedAt ?? Date.now()
  }
  fs.mkdirSync(dataDir, { recursive: true })
  fs.appendFileSync(mcpClientReceiptPath(dataDir), `${JSON.stringify(receipt)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  return receipt
}

export function readMcpClientReceipts(dataDir: string): McpClientReceipt[] {
  try {
    const raw = fs.readFileSync(mcpClientReceiptPath(dataDir), 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line) as Partial<McpClientReceipt>
          if (
            typeof parsed.name !== 'string' ||
            !parsed.name.trim() ||
            typeof parsed.connectedAt !== 'number'
          ) {
            return []
          }
          return [
            {
              name: parsed.name,
              version: typeof parsed.version === 'string' ? parsed.version : null,
              connectedAt: parsed.connectedAt
            }
          ]
        } catch {
          return []
        }
      })
      .sort((a, b) => a.connectedAt - b.connectedAt)
  } catch {
    return []
  }
}

export function isClientForAgent(agentId: string, clientName: string): boolean {
  if (agentId === 'doubao') return /doubao|豆包/i.test(clientName)
  return clientName.toLowerCase().includes(agentId.toLowerCase())
}

export function latestMcpClientReceipt(
  dataDir: string,
  agentId: string
): McpClientReceipt | null {
  const receipts = readMcpClientReceipts(dataDir)
  for (let index = receipts.length - 1; index >= 0; index -= 1) {
    if (isClientForAgent(agentId, receipts[index].name)) return receipts[index]
  }
  return null
}
