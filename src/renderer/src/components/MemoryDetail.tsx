import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MemoryDetail as MemoryDetailType } from '../../../shared/types'
import { formatDate, kindLabel, uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  CloseIcon,
  CopyIcon,
  FolderIcon
} from './Icons'

export function MemoryDetail({
  memory,
  onClose,
  onArchive,
  onReveal,
  onToast
}: {
  memory: MemoryDetailType
  onClose: () => void
  onArchive: () => void
  onReveal: (path: string) => void
  onToast: (message: string) => void
}) {
  const sources = uniqueSources(memory.sources)

  const copy = async () => {
    await navigator.clipboard.writeText(`# ${memory.title}\n\n${memory.content}`)
    onToast('Memory copied to clipboard')
  }

  return (
    <aside className="detail" aria-label="Memory detail">
      <div className="detail-top">
        <div className="detail-kicker">
          <span className="detail-kind">{kindLabel(memory.kind)}</span>
          <span className="kicker-sep" />
          <span>Updated {formatDate(memory.updatedAt)}</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close detail">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="detail-scroll">
        <h2>{memory.title}</h2>
        <div className="detail-meta">
          {memory.project && (
            <span className="tag project-tag">
              <FolderIcon size={12} />
              {memory.project}
            </span>
          )}
          {memory.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{memory.content}</ReactMarkdown>
        </div>

        <section className="sources">
          <div className="section-label">
            <span>Remembered by</span>
            <span className="section-count">{sources.length}</span>
          </div>
          <div className="source-list">
            {sources.map((source) => (
              <div className="source-row" key={`${source.agentId}-${source.path}`}>
                <AgentLogo
                  agentId={source.agentId}
                  agentName={source.agentName}
                  size={22}
                  className="source-avatar"
                />
                <div className="source-copy">
                  <strong>{source.agentName}</strong>
                  <span title={source.path}>
                    {source.path.replace(/^\/Users\/[^/]+/, '~')}
                  </span>
                </div>
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => onReveal(source.path)}
                  aria-label={`Reveal ${source.agentName} source`}
                >
                  <ArrowUpRightIcon size={13} />
                </button>
              </div>
            ))}
          </div>
          {memory.echoCount > 1 && (
            <p className="echo-note">
              This memory appeared independently in {memory.echoCount} agents. dachshund keeps one
              copy and remembers where each came from.
            </p>
          )}
        </section>
      </div>

      <div className="detail-actions">
        <button className="ghost-button small" type="button" onClick={() => void copy()}>
          <CopyIcon size={14} />
          Copy
        </button>
        <button className="ghost-button small danger" type="button" onClick={onArchive}>
          <ArchiveIcon size={14} />
          Forget
        </button>
      </div>
    </aside>
  )
}
