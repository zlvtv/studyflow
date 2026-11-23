export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in_progress' | 'done';
export type TaskInput = {
  title: string;
  subject: string;
  description: string;
  due_date: string;
  priority: Priority;
  status: Status;
};
export type Task = TaskInput & { id: number; created_at: string; updated_at: string };
export type View = 'all' | 'today' | 'week' | 'overdue';
export type Filters = { subject: string; status: string; search: string; view: View; sort: string };
export const statusNames: Record<Status, string> = {
  todo: 'К выполнению',
  in_progress: 'В процессе',
  done: 'Готово',
};
export const priorityNames: Record<Priority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isOverdue(task: TaskInput, today: string): boolean {
  return task.status !== 'done' && task.due_date < today;
}

export function filterTasks(tasks: Task[], filters: Filters, now = new Date()): Task[] {
  const today = localDate(now);
  const week = new Date(now);
  week.setDate(week.getDate() + 6);
  const query = filters.search.trim().toLocaleLowerCase('ru');
  return tasks
    .filter(
      (t) =>
        (!filters.subject || t.subject === filters.subject) &&
        (!filters.status || t.status === filters.status) &&
        (!query || `${t.title} ${t.subject}`.toLocaleLowerCase('ru').includes(query)) &&
        (filters.view !== 'today' || (t.due_date === today && t.status !== 'done')) &&
        (filters.view !== 'week' ||
          (t.due_date >= today && t.due_date <= localDate(week) && t.status !== 'done')) &&
        (filters.view !== 'overdue' || isOverdue(t, today)),
    )
    .sort((a, b) => {
      if (filters.sort === 'priority') {
        const rank = { high: 0, medium: 1, low: 2 };
        return (
          rank[a.priority] - rank[b.priority] || a.due_date.localeCompare(b.due_date) || a.id - b.id
        );
      }
      if (filters.sort === 'newest') return b.id - a.id;
      return a.due_date.localeCompare(b.due_date) || a.id - b.id;
    });
}

export function validateTask(task: TaskInput): string | null {
  if (!task.title.trim()) return 'Напиши название задачи.';
  if (!task.subject.trim()) return 'Укажи учебный предмет.';
  if (task.title.trim().length > 200 || task.subject.trim().length > 100)
    return 'Название или предмет слишком длинные.';
  if (task.description.length > 5000) return 'Описание должно быть не длиннее 5000 символов.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.due_date)) return 'Укажи срок сдачи.';
  const parsed = new Date(`${task.due_date}T12:00:00`);
  if (Number.isNaN(parsed.getTime()) || localDate(parsed) !== task.due_date)
    return 'Укажи существующую дату.';
  return null;
}
