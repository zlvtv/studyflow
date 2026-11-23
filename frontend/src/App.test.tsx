// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { api } from './api';
import type { Task } from './tasks';

vi.mock('./api', () => ({
  api: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    status: vi.fn(),
    remove: vi.fn(),
  },
}));

const task: Task = {
  id: 1,
  title: 'Отчёт по SQL',
  subject: 'Базы данных',
  description: 'Вариант 7',
  due_date: '2026-12-05',
  priority: 'medium',
  status: 'todo',
  created_at: '2026-11-23T10:00:00Z',
  updated_at: '2026-11-23T10:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.list).mockResolvedValue([task]);
  // jsdom has no native modal implementation; form and state changes remain real React.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);

async function openApp() {
  render(<App />);
  await screen.findByRole('button', { name: task.title });
}

describe('Работа с заданиями', () => {
  it('создаёт задачу с выбранной датой и приоритетом', async () => {
    await openApp();
    vi.mocked(api.create).mockImplementation(async (data) => ({ ...task, ...data, id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Новая задача' }));
    const form = within(screen.getByRole('dialog', { name: 'Новая задача' }));
    fireEvent.change(form.getByLabelText('Название задачи'), {
      target: { value: '  Доклад по графам  ' },
    });
    fireEvent.change(form.getByRole('combobox', { name: 'Предмет' }), {
      target: { value: 'Дискретная математика' },
    });
    fireEvent.input(form.getByLabelText('Срок сдачи'), { target: { value: '2026-12-12' } });
    fireEvent.change(form.getByRole('combobox', { name: 'Приоритет' }), {
      target: { value: 'high' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Сохранить задачу' }));
    await screen.findByRole('button', { name: 'Доклад по графам' });
    expect(api.create).toHaveBeenCalledWith({
      title: 'Доклад по графам',
      subject: 'Дискретная математика',
      description: '',
      due_date: '2026-12-12',
      priority: 'high',
      status: 'todo',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('редактирует существующую задачу без передачи id и служебных дат в API', async () => {
    await openApp();
    vi.mocked(api.update).mockImplementation(async (_id, data) => ({ ...task, ...data }));
    fireEvent.click(screen.getByRole('button', { name: task.title }));
    const form = within(screen.getByRole('dialog'));
    fireEvent.change(form.getByLabelText('Название задачи'), {
      target: { value: 'SQL и индексы' },
    });
    fireEvent.input(form.getByLabelText('Срок сдачи'), { target: { value: '2026-12-07' } });
    fireEvent.change(form.getByRole('combobox', { name: 'Статус' }), {
      target: { value: 'in_progress' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Сохранить задачу' }));
    await screen.findByRole('button', { name: 'SQL и индексы' });
    expect(api.update).toHaveBeenCalledWith(1, {
      title: 'SQL и индексы',
      subject: task.subject,
      description: task.description,
      due_date: '2026-12-07',
      priority: 'medium',
      status: 'in_progress',
    });
  });

  it('сохраняет введённый текст, если сервер отклонил создание', async () => {
    await openApp();
    vi.mocked(api.create).mockRejectedValue(new Error('Сервер недоступен'));
    fireEvent.click(screen.getByRole('button', { name: 'Новая задача' }));
    const form = within(screen.getByRole('dialog'));
    fireEvent.change(form.getByLabelText('Название задачи'), { target: { value: 'Эссе' } });
    fireEvent.change(form.getByRole('combobox', { name: 'Предмет' }), {
      target: { value: 'Английский язык' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Сохранить задачу' }));
    expect((await form.findByRole('alert')).textContent).toBe('Сервер недоступен');
    expect((form.getByLabelText('Название задачи') as HTMLInputElement).value).toBe('Эссе');
    expect(screen.queryByRole('button', { name: 'Эссе' })).toBeNull();
  });

  it('не отмечает задачу выполненной при ошибке сервера', async () => {
    await openApp();
    vi.mocked(api.status).mockRejectedValue(new Error('Не удалось изменить статус'));
    fireEvent.click(screen.getByRole('button', { name: `Отметить выполненной: ${task.title}` }));
    await screen.findByRole('alert');
    expect(api.status).toHaveBeenCalledWith(1, 'done');
    expect(
      screen.getByRole('button', { name: `Отметить выполненной: ${task.title}` }),
    ).toBeTruthy();
  });

  it('фильтрует завершённую задачу после успешного ответа сервера', async () => {
    await openApp();
    vi.mocked(api.status).mockResolvedValue({ ...task, status: 'done' });
    fireEvent.click(screen.getByRole('button', { name: `Отметить выполненной: ${task.title}` }));
    await screen.findByRole('button', { name: `Вернуть к выполнению: ${task.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'К выполнению' }));
    expect(screen.queryByRole('button', { name: task.title })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.getByRole('button', { name: task.title })).toBeTruthy();
  });

  it('отменяет удаление, затем удаляет последнюю задачу предмета и сбрасывает фильтр', async () => {
    await openApp();
    vi.mocked(api.remove).mockResolvedValue(undefined);
    const subject = screen.getByRole('combobox', { name: 'Фильтр по предмету' });
    fireEvent.change(subject, { target: { value: task.subject } });
    fireEvent.click(screen.getByRole('button', { name: `Удалить: ${task.title}` }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: `Удалить: ${task.title}` }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить задачу' }),
    );
    await screen.findByText('Пока нет заданий');
    expect(api.remove).toHaveBeenCalledWith(1);
    expect((subject as HTMLSelectElement).value).toBe('');
  });

  it('повторяет загрузку после ошибки', async () => {
    vi.mocked(api.list)
      .mockRejectedValueOnce(new Error('Нет соединения'))
      .mockResolvedValueOnce([task]);
    render(<App />);
    await screen.findByText('Не удалось загрузить задачи');
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать ещё раз' }));
    await screen.findByRole('button', { name: task.title });
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('выбирает для карточки срока только незавершённые задания', async () => {
    vi.mocked(api.list).mockResolvedValue([
      { ...task, id: 2, title: 'Сданный отчёт', status: 'done', due_date: '2020-01-01' },
      task,
    ]);
    await openApp();
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Ближайший срок' }).textContent).toContain(
        task.title,
      ),
    );
    expect(screen.getByRole('region', { name: 'Ближайший срок' }).textContent).not.toContain(
      'Сданный отчёт',
    );
  });
});
