import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MemoryDetail as MemoryDetailType } from '../../../shared/types'
import { categoryDefinition, categoryForKind } from '../../../shared/memory-taxonomy'
import { formatDate, kindLabel, uniqueSources } from '../lib/format'
import { AgentLogo } from './AgentLogo'
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  CollapseIcon,
  CloseIcon,
  CopyIcon,
  ExpandIcon,
  FolderIcon,
  OutlineCollapseIcon,
  OutlineExpandIcon
} from './Icons'

type OutlineItem = {
  id: string
  level: number
  text: string
}

export function MemoryDetail({
  memory,
  expanded,
  onToggleExpanded,
  onClose,
  onArchive,
  onReveal,
  onToast
}: {
  memory: MemoryDetailType
  expanded: boolean
  onToggleExpanded: () => void
  onClose: () => void
  onArchive: () => void
  onReveal: (path: string) => void
  onToast: (message: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const proseRef = useRef<HTMLDivElement>(null)
  const outlineJumpRef = useRef<string | null>(null)
  const outlineJumpTimer = useRef<number | null>(null)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const sources = uniqueSources(memory.sources)
  const category = categoryDefinition(categoryForKind(memory.kind))

  useEffect(() => {
    setOutlineCollapsed(false)
  }, [memory.id])

  useEffect(
    () => () => {
      if (outlineJumpTimer.current) window.clearTimeout(outlineJumpTimer.current)
    },
    []
  )

  useEffect(() => {
    const root = proseRef.current
    const scroller = scrollRef.current
    if (!root || !scroller) return

    const entries = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4')).map(
      (element, index) => {
        const id = `memory-section-${index + 1}`
        element.id = id
        return {
          element,
          item: {
            id,
            level: Number(element.tagName.slice(1)),
            text: element.textContent?.trim() || `Section ${index + 1}`
          }
        }
      }
    )

    setOutline(entries.map(({ item }) => item))
    setActiveOutlineId(entries[0]?.item.id ?? null)
    if (entries.length === 0) return

    const updateActiveHeading = () => {
      if (outlineJumpRef.current) return
      const scrollerTop = scroller.getBoundingClientRect().top
      let activeId = entries[0].item.id
      for (const { element, item } of entries) {
        if (element.getBoundingClientRect().top - scrollerTop <= 64) activeId = item.id
        else break
      }
      setActiveOutlineId(activeId)
    }

    updateActiveHeading()
    scroller.addEventListener('scroll', updateActiveHeading, { passive: true })
    return () => scroller.removeEventListener('scroll', updateActiveHeading)
  }, [memory.content, memory.id])

  const jumpToHeading = (id: string) => {
    const scroller = scrollRef.current
    const target = document.getElementById(id)
    if (!scroller || !target) return

    outlineJumpRef.current = id
    if (outlineJumpTimer.current) window.clearTimeout(outlineJumpTimer.current)
    outlineJumpTimer.current = window.setTimeout(() => {
      outlineJumpRef.current = null
      outlineJumpTimer.current = null
    }, 800)
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      24
    scroller.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
    setActiveOutlineId(id)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(`# ${memory.title}\n\n${memory.content}`)
    onToast('Memory copied to clipboard')
  }

  return (
    <aside className={`detail ${expanded ? 'is-expanded' : ''}`} aria-label="Memory detail">
      <div className="detail-top">
        <div className="detail-kicker">
          <span
            className="detail-category"
            style={{ '--category-color': category.color } as CSSProperties}
          >
            <span className="meta-key">Type</span>
            {category.label}
          </span>
          <span className="kicker-sep" />
          <span className="detail-kind">{kindLabel(memory.kind)}</span>
          <span className="kicker-sep" />
          <span>Updated {formatDate(memory.updatedAt)}</span>
        </div>
        <div className="detail-top-actions">
          <button
            className="icon-button"
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Collapse memory' : 'Expand memory'}
            aria-pressed={expanded}
            title={expanded ? 'Collapse memory' : 'Read in full view'}
          >
            {expanded ? <CollapseIcon size={15} /> : <ExpandIcon size={15} />}
          </button>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close detail">
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <div className="detail-body">
        {outline.length > 0 && (
          <nav
            className={`memory-outline ${outlineCollapsed ? 'is-collapsed' : ''}`}
            aria-label="Memory contents"
          >
            <div className="memory-outline-head">
              {!outlineCollapsed && <span>Contents</span>}
              <button
                className="memory-outline-toggle"
                type="button"
                onClick={() => setOutlineCollapsed((current) => !current)}
                aria-label={outlineCollapsed ? 'Expand contents' : 'Collapse contents'}
                aria-expanded={!outlineCollapsed}
                title={outlineCollapsed ? 'Expand contents' : 'Collapse contents'}
              >
                {outlineCollapsed ? (
                  <OutlineExpandIcon size={15} />
                ) : (
                  <OutlineCollapseIcon size={15} />
                )}
              </button>
            </div>
            {!outlineCollapsed && (
              <div className="memory-outline-list">
                {outline.map((item) => (
                  <button
                    className={`memory-outline-item ${
                      activeOutlineId === item.id ? 'is-active' : ''
                    }`}
                    style={{ '--outline-depth': Math.max(0, item.level - 1) } as CSSProperties}
                    type="button"
                    key={item.id}
                    onClick={() => jumpToHeading(item.id)}
                    aria-current={activeOutlineId === item.id ? 'location' : undefined}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            )}
          </nav>
        )}

        <div className="detail-scroll" ref={scrollRef}>
          <h2>{memory.title}</h2>
          <div className="detail-meta">
            {memory.project && (
              <span className="tag project-tag">
                <FolderIcon size={12} />
                <span className="meta-key">Scope</span>
                {memory.project}
              </span>
            )}
            {memory.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className="prose" ref={proseRef}>
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
