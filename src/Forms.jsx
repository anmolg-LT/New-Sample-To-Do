import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sample-form-entries'

// Field definitions drive both the form inputs and the detail view, so the
// two never drift out of sync.
const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'Jane Doe', required: true },
  { key: 'age', label: 'Age', type: 'number', placeholder: '30' },
  { key: 'city', label: 'City', type: 'text', placeholder: 'Berlin' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
]

const emptyDraft = () => ({ name: '', age: '', city: '', email: '' })

const formatCreated = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

export default function Forms() {
  const [entries, setEntries] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  // view: { mode } where mode is 'list' | 'new' | 'detail' | 'edit', plus an
  // optional id for the entry the detail/edit view is acting on.
  const [view, setView] = useState({ mode: 'list', id: null })
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const selected = view.id != null ? entries.find(e => e.id === view.id) : null

  // If the entry behind a detail/edit view disappears (e.g. deleted), fall
  // back to the list so we never render a dangling reference.
  useEffect(() => {
    if ((view.mode === 'detail' || view.mode === 'edit') && !selected) {
      setView({ mode: 'list', id: null })
    }
  }, [view, selected])

  const openList = () => setView({ mode: 'list', id: null })

  const openNew = () => {
    setDraft(emptyDraft())
    setError('')
    setView({ mode: 'new', id: null })
  }

  const openDetail = (id) => setView({ mode: 'detail', id })

  const openEdit = (entry) => {
    setDraft({ name: entry.name, age: entry.age, city: entry.city, email: entry.email })
    setError('')
    setView({ mode: 'edit', id: entry.id })
  }

  const updateField = (key, value) => setDraft(d => ({ ...d, [key]: value }))

  const validate = () => {
    if (!draft.name.trim()) return 'Name is required.'
    if (draft.age && (Number.isNaN(Number(draft.age)) || Number(draft.age) < 0)) {
      return 'Enter a valid age.'
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      return 'Enter a valid email address.'
    }
    return ''
  }

  const submit = (e) => {
    e.preventDefault()
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    const cleaned = {
      name: draft.name.trim(),
      age: String(draft.age).trim(),
      city: draft.city.trim(),
      email: draft.email.trim(),
    }
    if (view.mode === 'edit') {
      setEntries(entries.map(en => (en.id === view.id ? { ...en, ...cleaned } : en)))
      setView({ mode: 'detail', id: view.id })
    } else {
      const id = Date.now()
      setEntries([...entries, { id, ...cleaned, createdAt: new Date().toISOString() }])
      setView({ mode: 'detail', id })
    }
  }

  const remove = (id) => {
    setEntries(entries.filter(e => e.id !== id))
    setView({ mode: 'list', id: null })
  }

  const editing = view.mode === 'new' || view.mode === 'edit'

  return (
    <>
      <aside className="sidebar">
        <nav className="filters">
          <p className="sidebar-label">Forms</p>
          <button
            className={`filter-btn ${view.mode === 'list' ? 'active' : ''}`}
            onClick={openList}
          >
            <span>Saved forms</span>
            <span className="count">{entries.length}</span>
          </button>
          <button className="filter-btn new-form-btn" onClick={openNew}>
            <span>+ New form</span>
          </button>
        </nav>
      </aside>

      <main className="main">
        <div className="card">
          {editing && (
            <>
              <h1>{view.mode === 'edit' ? 'Edit form' : 'New form'}</h1>
              <form className="entry-form" onSubmit={submit}>
                {FIELDS.map(field => (
                  <label key={field.key} className="field">
                    <span className="field-label">
                      {field.label}
                      {field.required && <span className="required"> *</span>}
                    </span>
                    <input
                      type={field.type}
                      className="text-input"
                      value={draft[field.key]}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      aria-label={field.label}
                    />
                  </label>
                ))}
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions">
                  <button type="submit">
                    {view.mode === 'edit' ? 'Save changes' : 'Save form'}
                  </button>
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={view.mode === 'edit' ? () => openDetail(view.id) : openList}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}

          {view.mode === 'detail' && selected && (
            <>
              <h1>{selected.name}</h1>
              <dl className="entry-detail">
                {FIELDS.map(field => (
                  <div key={field.key} className="detail-row">
                    <dt>{field.label}</dt>
                    <dd>{selected[field.key] || <span className="muted">—</span>}</dd>
                  </div>
                ))}
                <div className="detail-row">
                  <dt>Saved</dt>
                  <dd>{formatCreated(selected.createdAt)}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <button type="button" onClick={() => openEdit(selected)}>Edit</button>
                <button
                  type="button"
                  className="clear-btn danger"
                  onClick={() => remove(selected.id)}
                >
                  Delete
                </button>
                <button type="button" className="clear-btn" onClick={openList}>
                  Back
                </button>
              </div>
            </>
          )}

          {view.mode === 'list' && (
            <>
              <h1>Saved forms</h1>
              <ul className="todo-list">
                {entries.map(entry => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="entry-summary"
                      onClick={() => openDetail(entry.id)}
                    >
                      <span className="entry-name">{entry.name}</span>
                      <span className="entry-meta">
                        {[entry.city, entry.age && `${entry.age} yrs`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                    <button
                      className="delete"
                      onClick={() => remove(entry.id)}
                      aria-label={`Delete ${entry.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {entries.length === 0 && (
                <p className="status empty">
                  No saved forms yet — create one with “+ New form”.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </>
  )
}
