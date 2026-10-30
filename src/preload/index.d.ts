import type { dachshundApi } from './index'

declare global {
  interface Window {
    dachshund: dachshundApi
  }
}

export {}
