import {
  SHARED_MEMORY_MANAGED_BLOCK,
  mergeSharedMemoryInstructions,
  stripSharedMemoryInstructions
} from './shared-memory-instructions'

export const DEEPSEEK_MANAGED_BLOCK = SHARED_MEMORY_MANAGED_BLOCK
export const mergeDeepSeekInstructions = mergeSharedMemoryInstructions
export const stripDeepSeekInstructions = stripSharedMemoryInstructions
