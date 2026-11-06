import { useState, type CSSProperties } from 'react'
import memoryTaxonomyFigure from '../assets/memory-taxonomy.svg?raw'
import {
  AUXILIARY_CATEGORIES,
  MEMORY_CATEGORIES,
  kindLabel,
  type MemoryCategoryId
} from '../../../shared/memory-taxonomy'

const categoryExamples: Record<string, string> = {
  identity: 'Role, expertise, language, durable personal context.',
  guidance: 'A default, an explicit rule, or a repeatable way to work.',
  knowledge: 'A fact worth keeping, a source to revisit, or a lesson learned.',
  current: 'A live goal, a hard constraint, or a decision already made.'
}

const dimensions = [
  {
    label: 'Scope',
    values: 'User · Project · Workspace · Path · Session',
    copy: 'Where the memory applies. A project label is not a category.'
  },
  {
    label: 'Authority',
    values: 'Explicit · Declared · Observed · Inferred',
    copy: 'How strongly the source supports the claim. Imports do not become rules by accident.'
  },
  {
    label: 'Status',
    values: 'Active · Superseded · Archived',
    copy: 'Whether the memory still participates in recall, without deleting its provenance.'
  }
]

const rules = [
  {
    number: '01',
    title: 'The agent is provenance, not a category.',
    copy: 'Claude, Codex, WorkBuddy and the rest remain visible as sources. Their names never become filing bins of their own.'
  },
  {
    number: '02',
    title: 'Kind is the concrete label; category is the stable shelf.',
    copy: 'Ten durable kinds map into four fixed categories. A native label may normalize into a different kind when its content clearly says something else.'
  },
  {
    number: '03',
    title: 'Evidence stays evidence.',
    copy: 'Session summaries, rollouts, compactions and logs preserve what happened. They do not silently become durable knowledge.'
  },
  {
    number: '04',
    title: 'Untyped still gets a shelf.',
    copy: 'When no native type exists, dachshund resolves the content into the closest durable kind. Generic observations become Fact; paths and source material become Reference.'
  }
]

export function GuideView() {
  const [focused, setFocused] = useState<MemoryCategoryId | null>(null)
  const activeCategory = MEMORY_CATEGORIES.find((category) => category.id === focused)

  return (
    <div className="page guide-page">
      <section className="page-head guide-head">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Memory guide
        </p>
        <h1>One memory model, explained from the filing bench up.</h1>
        <p className="page-copy">
          Agents name memory differently. dachshund keeps the original source, resolves the
          content to a durable kind, then files it by what the memory is for.
        </p>
        <div className="guide-principle">
          <span>Fixed categories</span>
          <p>
            Four durable shelves are always in the same order. Evidence sits outside them
            as the only supporting layer.
          </p>
        </div>
      </section>

      <section className="guide-figure-panel" aria-labelledby="guide-figure-title">
        <div className="guide-figure-head">
          <div>
            <p className="section-label">How a memory is filed</p>
            <h2 id="guide-figure-title">Native signal → kind → category.</h2>
          </div>
          <span className="guide-figure-note">Hover or focus a shelf to isolate it</span>
        </div>
        <div
          className="guide-figure"
          data-focus={focused ?? 'all'}
          onMouseLeave={() => setFocused(null)}
        >
          <div
            className="guide-figure-svg"
            dangerouslySetInnerHTML={{ __html: memoryTaxonomyFigure }}
          />
        </div>
        <div className="guide-figure-readout" aria-live="polite">
          {activeCategory ? (
            <>
              <span style={{ background: activeCategory.color }} />
              <strong>{activeCategory.label}</strong>
              <p>{activeCategory.description}</p>
              <small>{activeCategory.kinds.map(kindLabel).join(' · ')}</small>
            </>
          ) : (
            <>
              <span className="guide-readout-dot" />
              <strong>Every durable memory has one category.</strong>
              <p>
                The category answers how this memory will be reused. Kind adds the concrete
                type inside that shelf.
              </p>
              <small>Identity · Guidance · Knowledge · Current work</small>
            </>
          )}
        </div>
      </section>

      <section className="guide-categories-section" aria-labelledby="guide-categories-title">
        <div className="guide-section-head">
          <div>
            <p className="section-label">The four durable shelves</p>
            <h2 id="guide-categories-title">Filed by the next use, not by the agent.</h2>
          </div>
          <p>Select a category to keep its route highlighted in the diagram.</p>
        </div>
        <div className="guide-category-grid">
          {MEMORY_CATEGORIES.map((category) => {
            const active = focused === category.id
            return (
              <button
                className={`guide-category-card ${active ? 'is-active' : ''}`}
                key={category.id}
                type="button"
                aria-pressed={active}
                style={{ '--guide-color': category.color } as CSSProperties}
                onMouseEnter={() => setFocused(category.id)}
                onFocus={() => setFocused(category.id)}
                onBlur={() => setFocused(null)}
                onClick={() => setFocused(category.id)}
              >
                <span className="guide-category-index">0{MEMORY_CATEGORIES.indexOf(category) + 1}</span>
                <span className="guide-category-name">
                  <i />
                  {category.label}
                </span>
                <span className="guide-category-description">{category.description}</span>
                <span className="guide-category-example">{categoryExamples[category.id]}</span>
                <span className="guide-kind-row">
                  {category.kinds.map((kind) => (
                    <code key={kind}>{kindLabel(kind)}</code>
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <div className="guide-aux-row">
          {AUXILIARY_CATEGORIES.map((category) => (
            <div className="guide-aux-card" key={category.id}>
              <span style={{ background: category.color }} />
              <div>
                <strong>{category.label}</strong>
                <p>{category.description}</p>
              </div>
              <small>{category.kinds.map(kindLabel).join(' · ')}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="guide-dimensions-section" aria-labelledby="guide-dimensions-title">
        <div className="guide-section-head">
          <div>
            <p className="section-label">Not every label is a category</p>
            <h2 id="guide-dimensions-title">Three dimensions travel with the memory.</h2>
          </div>
          <p>Scope, authority and status stay independent from the category shelf.</p>
        </div>
        <div className="guide-dimension-grid">
          {dimensions.map((dimension, index) => (
            <article key={dimension.label}>
              <span>0{index + 1}</span>
              <h3>{dimension.label}</h3>
              <strong>{dimension.values}</strong>
              <p>{dimension.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-rules-section" aria-labelledby="guide-rules-title">
        <div className="guide-section-head">
          <div>
            <p className="section-label">Filing rules</p>
            <h2 id="guide-rules-title">The guardrails that keep the library useful.</h2>
          </div>
        </div>
        <div className="guide-rule-list">
          {rules.map((rule) => (
            <article key={rule.number}>
              <span>{rule.number}</span>
              <div>
                <h3>{rule.title}</h3>
                <p>{rule.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
