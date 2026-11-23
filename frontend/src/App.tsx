import { useEffect, useState } from 'react';
import { api } from './api';
import { filterTasks, isOverdue, localDate, type Filters, type Task, type View } from './tasks';
import Icon from './components/Icon';
import Modal from './components/Modal';
import TaskForm from './components/TaskForm';
import TaskRow from './components/TaskRow';

const nav: { view: View; name: string; icon: string }[] = [
  { view: 'all', name: 'Все задачи', icon: 'grid' },
  { view: 'today', name: 'Сегодня', icon: 'calendar' },
  { view: 'week', name: 'Ближайшие 7 дней', icon: 'clock' },
  { view: 'overdue', name: 'Просроченные', icon: 'alert' },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [filters, setFilters] = useState<Filters>({
    view: 'all',
    subject: '',
    status: '',
    search: '',
    sort: 'date',
  });
  const [form, setForm] = useState<{ task: Task | null } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function load(signal?: AbortSignal) {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.list(signal);
      if (!signal?.aborted) setTasks(result);
    } catch (e) {
      if (!signal?.aborted) setLoadError((e as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!loading && filters.subject && !tasks.some((task) => task.subject === filters.subject)) {
      setFilters((previous) => ({ ...previous, subject: '' }));
    }
  }, [tasks, filters.subject, loading]);
  const today = localDate(now);
  const subjects = [...new Set(tasks.map((t) => t.subject))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
  const visible = filterTasks(tasks, filters, now);
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const nextTask = tasks
    .filter((task) => task.status !== 'done')
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)[0];
  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }
  function saved(task: Task) {
    const editing = form?.task;
    setTasks((prev) =>
      editing ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task],
    );
    setForm(null);
    setToast(editing ? 'Изменения сохранены' : 'Задача добавлена');
  }
  async function toggle(task: Task) {
    setPending(task.id);
    setActionError('');
    try {
      const updated = await api.status(task.id, task.status === 'done' ? 'todo' : 'done');
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setToast(
        updated.status === 'done'
          ? 'Задание отмечено выполненным'
          : 'Задача возвращена к выполнению',
      );
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  async function remove() {
    if (!deleting) return;
    setPending(deleting.id);
    setActionError('');
    try {
      await api.remove(deleting.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleting.id));
      setDeleting(null);
      setToast('Задача удалена');
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="StudyFlow — главная">
          <span className="brand-mark">
            <Icon name="check" size={26} />
          </span>
          Study<span>Flow</span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">
            <Icon name="book" />
          </div>
          <div>
            <strong>Моё обучение</strong>
            <span>Личное пространство</span>
          </div>
        </div>
        <p className="nav-label">ПЛАНИРОВАНИЕ</p>
        <nav className="main-nav" aria-label="Планирование">
          {nav.map((item) => (
            <button
              key={item.view}
              className={filters.view === item.view && !filters.subject ? 'active' : ''}
              onClick={() => setFilters((prev) => ({ ...prev, view: item.view, subject: '' }))}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
              {item.view === 'overdue' && overdue > 0 && (
                <span className="nav-count">{overdue}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="subject-heading">
          <p className="nav-label">ПРЕДМЕТЫ</p>
          <span>{subjects.length}</span>
        </div>
        <nav className="subject-nav" aria-label="Предметы">
          {subjects.length === 0 ? (
            <p className="subject-empty">Предметы появятся вместе с первыми задачами</p>
          ) : (
            subjects.map((subject, i) => (
              <button
                key={subject}
                className={filters.subject === subject ? 'active' : ''}
                onClick={() => setFilters((prev) => ({ ...prev, subject, view: 'all' }))}
              >
                <span className={`subject-dot dot-${i % 5}`} />
                <span>{subject}</span>
                <small>
                  {tasks.filter((t) => t.subject === subject && t.status !== 'done').length}
                </small>
              </button>
            ))
          )}
        </nav>
        <section className="sidebar-note" aria-label="Ближайший срок">
          <Icon name={nextTask && isOverdue(nextTask, today) ? 'alert' : 'calendar'} />
          <strong>
            {nextTask
              ? isOverdue(nextTask, today)
                ? 'Срок уже прошёл'
                : 'Ближайшая сдача'
              : 'Нет незавершённых задач'}
          </strong>
          <p>{nextTask ? nextTask.title : 'Новые задания появятся здесь после добавления.'}</p>
          {nextTask && (
            <small>
              {nextTask.subject} ·{' '}
              {new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(
                new Date(`${nextTask.due_date}T12:00:00`),
              )}
            </small>
          )}
        </section>
        <div className="profile">
          <div className="avatar">Я</div>
          <div>
            <strong>Мой учебный план</strong>
            <span>Предметы и сроки сдачи</span>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Моё обучение <span>/</span>
            <strong>{filters.subject || nav.find((n) => n.view === filters.view)?.name}</strong>
          </div>
          <div className="top-date">
            <Icon name="calendar" size={17} />
            {new Intl.DateTimeFormat('ru', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(now)}
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">УЧЕБНЫЙ ПЛАН</div>
              <h1>
                {filters.subject ||
                  (filters.view === 'all'
                    ? 'Учебные задачи'
                    : nav.find((n) => n.view === filters.view)?.name)}
              </h1>
              <p>Лабораторные, практические и подготовка к занятиям.</p>
            </div>
            <button
              className="button primary add-task"
              disabled={loading || !!loadError}
              onClick={() => setForm({ task: null })}
            >
              <Icon name="plus" />
              Новая задача
            </button>
          </section>
          <section className="stats" aria-label="Статистика задач">
            <div className="stat">
              <div className="stat-top">
                <span>Всего задач</span>
                <span className="stat-icon purple">
                  <Icon name="book" />
                </span>
              </div>
              <strong>{loading ? '—' : tasks.length}</strong>
              <small>По всем предметам</small>
            </div>
            <div className="stat">
              <div className="stat-top">
                <span>В процессе</span>
                <span className="stat-icon blue">
                  <Icon name="clock" />
                </span>
              </div>
              <strong>
                {loading ? '—' : tasks.filter((t) => t.status === 'in_progress').length}
              </strong>
              <small>Начатые, но ещё не сданные</small>
            </div>
            <div className="stat">
              <div className="stat-top">
                <span>Выполнено</span>
                <span className="stat-icon green">
                  <Icon name="check" />
                </span>
              </div>
              <strong>
                {loading ? '—' : done}
                <span className="stat-percent">{progress}%</span>
              </strong>
              <div className="progress-track">
                <div style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button
              className={`stat overdue-stat ${overdue ? 'has-overdue' : ''}`}
              onClick={() =>
                setFilters((prev) => ({ ...prev, view: 'overdue', status: '', subject: '' }))
              }
            >
              <div className="stat-top">
                <span>Просрочено</span>
                <span className="stat-icon red">
                  <Icon name="alert" />
                </span>
              </div>
              <strong>{loading ? '—' : overdue}</strong>
              <small>
                {overdue ? 'Незавершённые задания с прошедшим сроком' : 'Нет пропущенных сроков'}
              </small>
            </button>
          </section>
          <section className="task-panel" aria-label="Список задач">
            <div className="panel-heading">
              <div>
                <h2>
                  Мои задачи <span>{visible.length}</span>
                </h2>
                <p>
                  {filters.view === 'week'
                    ? 'Сегодня и ближайшие шесть дней'
                    : 'Нажми на название задания, чтобы изменить его.'}
                </p>
              </div>
              <label className="search">
                <Icon name="search" size={18} />
                <input
                  aria-label="Поиск задач"
                  placeholder="Найти задачу…"
                  value={filters.search}
                  onChange={(e) => filter('search', e.target.value)}
                />
              </label>
            </div>
            <div className="toolbar">
              <div className="tabs" role="group" aria-label="Статус задач">
                {[
                  ['', 'Все'],
                  ['todo', 'К выполнению'],
                  ['in_progress', 'В процессе'],
                  ['done', 'Готово'],
                ].map(([v, name]) => (
                  <button
                    key={v}
                    aria-pressed={filters.status === v}
                    className={filters.status === v ? 'selected' : ''}
                    onClick={() => filter('status', v)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="select-filters">
                <select
                  aria-label="Фильтр по предмету"
                  value={filters.subject}
                  onChange={(e) => filter('subject', e.target.value)}
                >
                  <option value="">Все предметы</option>
                  {subjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Сортировка"
                  value={filters.sort}
                  onChange={(e) => filter('sort', e.target.value)}
                >
                  <option value="date">По сроку сдачи</option>
                  <option value="priority">По приоритету</option>
                  <option value="newest">Сначала новые</option>
                </select>
              </div>
            </div>
            {actionError && !deleting && (
              <div className="error-banner" role="alert">
                {actionError}
                <button
                  onClick={() => {
                    setActionError('');
                    void load();
                  }}
                >
                  Обновить список
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty-state">
                <span className="loader" />
                <h3>Загрузка заданий…</h3>
              </div>
            ) : loadError ? (
              <div className="empty-state">
                <Icon name="alert" size={32} />
                <h3>Не удалось загрузить задачи</h3>
                <p>{loadError}</p>
                <button className="button secondary" onClick={() => void load()}>
                  Попробовать ещё раз
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="book" size={30} />
                </div>
                <h3>{tasks.length ? 'Здесь пока нет задач' : 'Пока нет заданий'}</h3>
                <p>
                  {tasks.length
                    ? 'Попробуй изменить фильтры или добавить новую задачу.'
                    : 'Укажи предмет, название работы и срок сдачи.'}
                </p>
                <button className="button secondary" onClick={() => setForm({ task: null })}>
                  <Icon name="plus" size={17} />
                  Добавить задачу
                </button>
              </div>
            ) : (
              <div className="task-list">
                <div className="table-labels">
                  <span>ЗАДАЧА</span>
                  <span>СРОК СДАЧИ</span>
                  <span>ПРИОРИТЕТ</span>
                  <span>СТАТУС</span>
                  <span />
                </div>
                {visible.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    subjectIndex={subjects.indexOf(task.subject) % 5}
                    busy={pending !== null}
                    onToggle={() => void toggle(task)}
                    onEdit={() => setForm({ task })}
                    onDelete={() => {
                      setActionError('');
                      setDeleting(task);
                    }}
                  />
                ))}
              </div>
            )}
            <div className="panel-footer">
              <span>Выполненную задачу можно вернуть в работу.</span>
              <span>
                {visible.length} из {tasks.length}
              </span>
            </div>
          </section>
          <footer className="page-footer">
            <span>StudyFlow</span>Учебный планировщик
          </footer>
        </main>
      </div>
      {form && (
        <TaskForm
          task={form.task}
          subjects={subjects}
          onSave={saved}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Удалить задачу?"
          onClose={() => {
            if (pending === null) setDeleting(null);
          }}
        >
          <p className="delete-description">
            «{deleting.title}» будет удалена. Вернуть её после удаления не получится.
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={pending !== null}
              onClick={() => setDeleting(null)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              disabled={pending !== null}
              onClick={() => void remove()}
            >
              {pending !== null ? 'Удаляем…' : 'Удалить задачу'}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
