import { useState, useEffect, useRef } from 'react'
import Forms from './Forms.jsx'
import './App.css'

const STORAGE_KEY = 'sample-todo-items'
const FILTERS = ['All', 'Active', 'Completed']
const UNDO_DURATION_MS = 5000

// Vite injects the deploy base ('/New-Sample-To-Do/' in prod, '/' in dev).
const BASE = import.meta.env.BASE_URL

// Map the current pathname to a route. Anything under <base>/Forms is the
// forms view; everything else is the tasks view.
const routeFromPath = () => {
  const path = window.location.pathname
  const rest = (path.startsWith(BASE) ? path.slice(BASE.length) : path).replace(/^\/+/, '')
  return rest.toLowerCase().startsWith('forms') ? 'forms' : 'tasks'
}

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const isOverdue = (todo) => {
  if (!todo.dueDate || todo.done) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = todo.dueDate.split('-').map(Number)
  return new Date(y, m - 1, d) < today
}

export default function App() {
  const [todos, setTodos] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filter, setFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [undo, setUndo] = useState(null)
  const [route, setRoute] = useState(routeFromPath)
  const editInputRef = useRef(null)
  const toggleAllRef = useRef(null)

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (target) => {
    const url = target === 'forms' ? `${BASE}Forms` : BASE
    window.history.pushState({}, '', url)
    setRoute(target)
  }

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (!undo) return
    const remaining = undo.expiresAt - Date.now()
    if (remaining <= 0) {
      setUndo(null)
      return
    }
    const timer = setTimeout(() => setUndo(null), remaining)
    return () => clearTimeout(timer)
  }, [undo])

  const addTodo = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setTodos([
      ...todos,
      { id: Date.now(), text, done: false, dueDate: dueDate || null },
    ])
    setInput('')
    setDueDate('')
  }

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const deleteTodo = (id) => {
    const index = todos.findIndex(t => t.id === id)
    if (index === -1) return
    const removed = todos[index]
    setTodos(todos.filter(t => t.id !== id))
    setUndo({
      todo: removed,
      index,
      expiresAt: Date.now() + UNDO_DURATION_MS,
    })
  }

  const restoreUndo = () => {
    if (!undo) return
    const { todo, index } = undo
    setTodos(prev => {
      const next = [...prev]
      next.splice(Math.min(index, next.length), 0, todo)
      return next
    })
    setUndo(null)
  }

  const clearCompleted = () => {
    setTodos(todos.filter(t => !t.done))
  }

  const startEdit = (todo) => {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const commitEdit = () => {
    if (editingId === null) return
    const next = editingText.trim()
    if (!next) {
      cancelEdit()
      return
    }
    setTodos(todos.map(t => t.id === editingId ? { ...t, text: next } : t))
    cancelEdit()
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const remaining = todos.filter(t => !t.done).length
  const completed = todos.length - remaining

  const visibleTodos = todos.filter(t => {
    if (filter === 'Active') return !t.done
    if (filter === 'Completed') return t.done
    return true
  })

  const counts = { All: todos.length, Active: remaining, Completed: completed }

  const visibleDone = visibleTodos.filter(t => t.done).length
  const allVisibleDone = visibleTodos.length > 0 && visibleDone === visibleTodos.length
  const someVisibleDone = visibleDone > 0 && visibleDone < visibleTodos.length

  useEffect(() => {
    if (toggleAllRef.current) {
      toggleAllRef.current.indeterminate = someVisibleDone
    }
  })

  const toggleAll = () => {
    const targetDone = !allVisibleDone
    const visibleIds = new Set(visibleTodos.map(t => t.id))
    setTodos(todos.map(t => visibleIds.has(t.id) ? { ...t, done: targetDone } : t))
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="logo">✓</span>
          <span className="brand-name">Sample To-Do</span>
        </div>
        <nav className="topbar-nav">
          <button
            className={`nav-link ${route === 'tasks' ? 'active' : ''}`}
            onClick={() => navigate('tasks')}
          >
            Tasks
          </button>
          <button
            className={`nav-link ${route === 'forms' ? 'active' : ''}`}
            onClick={() => navigate('forms')}
          >
            Forms
          </button>
        </nav>
        {route === 'tasks' && (
          <div className="topbar-stats">
            <span className="stat">
              <strong>{remaining}</strong> remaining
            </span>
            <span className="stat-divider" />
            <span className="stat">
              <strong>{todos.length}</strong> total
            </span>
          </div>
        )}
      </header>

      {route === 'forms' ? (
        <Forms />
      ) : (
        <>
      <aside className="sidebar">
        <nav className="filters">
          <p className="sidebar-label">Filters</p>
          {FILTERS.map(name => (
            <button
              key={name}
              className={`filter-btn ${filter === name ? 'active' : ''}`}
              onClick={() => setFilter(name)}
            >
              <span>{name}</span>
              <span className="count">{counts[name]}</span>
            </button>
          ))}
        </nav>

      </aside>

      <main className="main">
        <div className="card">
          <h1>{filter} tasks</h1>

          <form className="add-form" onSubmit={addTodo}>
            <input
              type="text"
              className="text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
            <input
              type="date"
              className="date-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
            />
            <button type="submit">Add</button>
          </form>

          {visibleTodos.length > 0 && (
            <div className="list-toolbar">
              <label className="toggle-all">
                <input
                  ref={toggleAllRef}
                  type="checkbox"
                  checked={allVisibleDone}
                  onChange={toggleAll}
                  aria-label="Toggle all visible tasks"
                />
                <span>
                  {allVisibleDone ? 'Mark all as active' : 'Mark all as complete'}
                </span>
              </label>
              <span className="toolbar-count" aria-label="Completed of visible">
                {visibleDone} / {visibleTodos.length}
              </span>
            </div>
          )}

          <ul className="todo-list">
            {visibleTodos.map(todo => (
              <li key={todo.id} className={todo.done ? 'done' : ''}>
                {editingId === todo.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="edit-input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKeyDown}
                    aria-label="Edit task"
                  />
                ) : (
                  <>
                    <div className="todo-main">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggleTodo(todo.id)}
                        aria-label={`Mark "${todo.text}" complete`}
                      />
                      <span
                        className="todo-text"
                        onDoubleClick={() => startEdit(todo)}
                        title="Double-click to edit"
                      >
                        {todo.text}
                      </span>
                    </div>
                    {todo.dueDate && (
                      <span className={`due-date ${isOverdue(todo) ? 'overdue' : ''}`}>
                        {formatDate(todo.dueDate)}
                      </span>
                    )}
                    <button
                      className="delete"
                      onClick={() => deleteTodo(todo.id)}
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {visibleTodos.length === 0 && (
            <p className="status empty">
              {todos.length === 0
                ? 'No items yet — add one above.'
                : `No ${filter.toLowerCase()} tasks.`}
            </p>
          )}

          {filter === 'Completed' && (
            <div className="card-actions">
              <button
                className="clear-btn"
                onClick={clearCompleted}
                disabled={completed === 0}
              >
                Clear completed
              </button>
            </div>
          )}
        </div>

        {undo && (
          <div className="undo-toast" role="status" aria-live="polite">
            <span className="undo-message">
              Deleted “{undo.todo.text}”
            </span>
            <button className="undo-btn" onClick={restoreUndo}>
              Undo
            </button>
          </div>
        )}
      </main>
        </>
      )}
    </div>
  )
}
