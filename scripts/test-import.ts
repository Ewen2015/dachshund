import { Store } from '../src/main/store'

async function main(): Promise<void> {
  const store = new Store('0.1.0-test')
  store.init()
  const state = await store.scan((progress) => {
    console.error(
      `[scan] ${progress.agentName}: ${progress.status}${progress.memories ? ` (${progress.memories})` : ''}`
    )
  })

  console.log(
    JSON.stringify(
      {
        counts: state.counts,
        agents: state.agents
          .filter((agent) => agent.installed)
          .map((agent) => ({
            id: agent.id,
            memories: agent.memoryCount,
            sources: agent.sourceCount,
            mcp: agent.mcpInstalled
          })),
        kinds: state.memories.reduce<Record<string, number>>((acc, memory) => {
          acc[memory.kind] = (acc[memory.kind] ?? 0) + 1
          return acc
        }, {})
      },
      null,
      2
    )
  )

  store.db.close()
}

void main()
