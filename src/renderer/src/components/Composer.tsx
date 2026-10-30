import { useEffect, useRef, useState } from 'react'
import type { CreateMemoryInput } from '../../../shared/types'
import { CloseIcon, SparkIcon } from './Icons'

const kinds = ['fact', 'preference', 'project', 'lesson', 'rule', 'profile']

export function Composer({
  onClose,
  onSave
}: {
  onClose: () => void
  onSave: (input: CreateMemoryInput) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('fact')
  const [project, setProject] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    contentRef.current?.focus()
  }, [])

  const submit = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
        kind,
        project: project.trim() || null,
        tags: tags
          .split(',')
          .map((tag) => tag.trim().replace(/^#/, ''))
          .filter(Boolean)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="composer"
        role="dialog"
        aria-modal="true"
        aria-label="New memory"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <div className="composer-head">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              Shared memory
            </p>
            <h2>Write it down once.</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close composer">
            <CloseIcon size={16} />
          </button>
        </div>

        <input
          className="title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Give it a short name"
          aria-label="Memory title"
        />
        <textarea
          ref={contentRef}
          className="content-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="What should every agent remember?"
          rows={8}
          aria-label="Memory content"
        />

        <div className="composer-kinds" role="group" aria-label="Memory kind">
          {kinds.map((item) => (
            <button
              key={item}
              type="button"
              className={kind === item ? 'active' : ''}
              onClick={() => setKind(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="composer-fields">
          <label>
            <span>Project</span>
            <input
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label>
            <span>Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="design, roadmap"
            />
          </label>
        </div>

        <div className="composer-foot">
          <span className="composer-note">
            <SparkIcon size={14} />
            Saved as Markdown in your library. Every connected agent can recall it.
          </span>
          <div className="composer-actions">
            <button className="ghost-button small" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button small"
              type="button"
              onClick={() => void submit()}
              disabled={!content.trim() || saving}
            >
              {saving ? 'Saving…' : 'Remember this'}
              <kbd>⌘↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
