import { useState, useEffect } from 'react'
import './App.css'

const STORAGE_KEY = 'sample-todo-items'
const FILTERS = ['All', 'Active', 'Completed']

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

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

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
    setTodos(todos.filter(t => t.id !== id))
  }

  const clearCompleted = () => {
    setTodos(todos.filter(t => !t.done))
  }

  const remaining = todos.filter(t => !t.done).length
  const completed = todos.length - remaining

  const visibleTodos = todos.filter(t => {
    if (filter === 'Active') return !t.done
    if (filter === 'Completed') return t.done
    return true
  })

  const counts = { All: todos.length, Active: remaining, Completed: completed }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="logo">✓</span>
          <span className="brand-name">Sample To-Do</span>
        </div>
        <div className="topbar-stats">
          <span className="stat">
            <strong>{remaining}</strong> remaining
          </span>
          <span className="stat-divider" />
          <span className="stat">
            <strong>{todos.length}</strong> total
          </span>
        </div>
      </header>

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

          <ul className="todo-list">
            {visibleTodos.map(todo => (
              <li key={todo.id} className={todo.done ? 'done' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo.id)}
                  />
                  <span className="todo-text">{todo.text}</span>
                </label>
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
      </main>
    </div>
  )
}
