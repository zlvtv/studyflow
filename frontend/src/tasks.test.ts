import { describe, expect, it } from 'vitest';
import { filterTasks, isOverdue, localDate, validateTask, type Task, type Filters } from './tasks';

const base: Task = {
  id: 1,
  title: 'Лабораторная',
  subject: 'Базы данных',
  description: '',
  due_date: '2026-11-22',
  priority: 'medium',
  status: 'todo',
  created_at: '',
  updated_at: '',
};
const filters: Filters = { subject: '', status: '', search: '', view: 'all', sort: 'date' };
const now = new Date(2026, 10, 22, 12);
const tasks: Task[] = [
  base,
  { ...base, id: 2, due_date: '2026-11-21', priority: 'high', subject: 'DevOps' },
  { ...base, id: 3, due_date: '2026-11-20', status: 'done' },
  { ...base, id: 4, due_date: '2026-11-28', status: 'in_progress' },
  { ...base, id: 5, due_date: '2026-11-29' },
];

describe('Сроки', () => {
  it('не считает просроченными сегодняшние и выполненные задачи', () => {
    expect(isOverdue(base, '2026-11-22')).toBe(false);
    expect(isOverdue(tasks[1], '2026-11-22')).toBe(true);
    expect(isOverdue(tasks[2], '2026-11-22')).toBe(false);
  });
  it('использует локальную календарную дату', () => {
    expect(localDate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});

describe('Фильтрация и сортировка', () => {
  it('совмещает предмет и статус', () =>
    expect(
      filterTasks(tasks, { ...filters, subject: 'Базы данных', status: 'done' }, now).map(
        (t) => t.id,
      ),
    ).toEqual([3]));
  it('ищет без учёта регистра и пробелов по краям', () =>
    expect(filterTasks(tasks, { ...filters, search: '  DEVops ' }, now).map((t) => t.id)).toEqual([
      2,
    ]));
  it('показывает просроченные', () =>
    expect(filterTasks(tasks, { ...filters, view: 'overdue' }, now).map((t) => t.id)).toEqual([2]));
  it('показывает задачи на сегодня', () =>
    expect(filterTasks(tasks, { ...filters, view: 'today' }, now).map((t) => t.id)).toEqual([1]));
  it('считает неделю как сегодня и шесть следующих дней', () =>
    expect(filterTasks(tasks, { ...filters, view: 'week' }, now).map((t) => t.id)).toEqual([1, 4]));
  it('сортирует высокий приоритет первым', () =>
    expect(filterTasks(tasks, { ...filters, sort: 'priority' }, now)[0].id).toBe(2));
  it('возвращает пустой список, когда совпадений нет', () =>
    expect(filterTasks(tasks, { ...filters, subject: 'Физика' }, now)).toEqual([]));
  it('не меняет исходный массив', () => {
    filterTasks(tasks, filters, now);
    expect(tasks[0]).toBe(base);
  });
});

describe('Ввод', () => {
  it('принимает корректную задачу, в том числе с прошедшим сроком', () =>
    expect(validateTask(base)).toBeNull());
  it.each([
    { title: ' ' },
    { subject: '' },
    { due_date: '' },
    { due_date: '2026-02-30' },
    { description: 'a'.repeat(5001) },
  ])('отклоняет неверные данные %o', (patch) =>
    expect(validateTask({ ...base, ...patch })).toBeTruthy(),
  );
});
