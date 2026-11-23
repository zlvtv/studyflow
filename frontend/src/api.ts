import type { Task, TaskInput, Status } from './tasks';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Нет соединения с сервером. Проверь подключение и попробуй ещё раз.');
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error('Задача уже удалена. Обнови список.');
    if (response.status === 422) throw new Error('Проверь поля формы: сервер не принял данные.');
    throw new Error('Не удалось выполнить действие. Попробуй ещё раз.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  list: (signal?: AbortSignal) => request<Task[]>('/api/tasks', { signal }),
  create: (data: TaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: TaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  status: (id: number, status: Status) =>
    request<Task>(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};
