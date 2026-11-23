import { useState, type FormEvent } from 'react';
import { api } from '../api';
import {
  localDate,
  priorityNames,
  statusNames,
  validateTask,
  type Status,
  type Task,
  type TaskInput,
} from '../tasks';
import Modal from './Modal';

export default function TaskForm({
  task,
  subjects,
  onSave,
  onClose,
}: {
  task: Task | null;
  subjects: string[];
  onSave: (task: Task) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<TaskInput>(
    task ?? {
      title: '',
      subject: '',
      description: '',
      due_date: localDate(),
      priority: 'medium',
      status: 'todo',
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function field<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateTask(data);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    const payload: TaskInput = {
      title: data.title.trim(),
      subject: data.subject.trim(),
      description: data.description.trim(),
      due_date: data.due_date,
      priority: data.priority,
      status: data.status,
    };
    try {
      onSave(task ? await api.update(task.id, payload) : await api.create(payload));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-intro">
        Название, предмет и срок обязательны. К заданию можно добавить заметку.
      </p>
      <form onSubmit={submit}>
        <label>
          Название задачи
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="Например, подготовить лабораторную"
            value={data.title}
            onChange={(e) => field('title', e.target.value)}
          />
        </label>
        <label>
          Предмет
          <input
            required
            maxLength={100}
            list="subjects"
            placeholder="Например, Базы данных"
            value={data.subject}
            onChange={(e) => field('subject', e.target.value)}
          />
          <datalist id="subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="form-row">
          <label>
            Срок сдачи
            <input
              type="date"
              required
              value={data.due_date}
              onInput={(e) => field('due_date', e.currentTarget.value)}
              onChange={(e) => field('due_date', e.target.value)}
            />
          </label>
          <label>
            Приоритет
            <select
              value={data.priority}
              onChange={(e) => field('priority', e.target.value as TaskInput['priority'])}
            >
              {Object.entries(priorityNames).map(([v, name]) => (
                <option key={v} value={v}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Статус
          <select value={data.status} onChange={(e) => field('status', e.target.value as Status)}>
            {Object.entries(statusNames).map(([v, name]) => (
              <option key={v} value={v}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Заметка <span className="optional">необязательно</span>
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="Номер варианта, ссылка на методичку или требования к отчёту"
            value={data.description}
            onChange={(e) => field('description', e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить задачу'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
