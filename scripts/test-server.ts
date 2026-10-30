import { Store } from '../src/main/store'
import { startHttpServer } from '../src/main/server'

async function main(): Promise<void> {
  const store = new Store('0.1.0-test')
  store.init()
  const server = await startHttpServer(store, '0.1.0-test')
  console.log(JSON.stringify({ ready: true, runtime: server.runtime }))
  const shutdown = (): void => {
    server.close()
    store.db.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

void main()
