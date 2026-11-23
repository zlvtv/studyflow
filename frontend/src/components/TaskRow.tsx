import { isOverdue, priorityNames, statusNames, type Task } from '../tasks';
import Icon from './Icon';

type Props = {
  task: Task;
  today: string;
  subjectIndex: number;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function TaskRow({
  task,
  today,
  subjectIndex,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const late = isOverdue(task, today);
  const deadline = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'short',
    ...(task.due_date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' as const } : {}),
  }).format(new Date(`${task.due_date}T12:00:00`));

  return (
    <article
      className={`task-row ${task.status === 'done' ? 'completed' : ''} ${late ? 'late' : ''}`}
    >
      <div className="task-main">
        <button
          className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
          disabled={busy}
          onClick={onToggle}
          aria-label={`${task.status === 'done' ? 'Вернуть к выполнению' : 'Отметить выполненной'}: ${task.title}`}
        >
          {task.status === 'done' && <Icon name="check" size={14} />}
        </button>
        <div className="task-copy">
          <button className="task-title" onClick={onEdit} disabled={busy}>
            {task.title}
          </button>
          <div className="task-subject">
            <span className={`subject-dot dot-${subjectIndex}`} />
            {task.subject}
          </div>
          {task.description && <p className="task-description">{task.description}</p>}
        </div>
      </div>
      <div className={`task-date ${late ? 'late-date' : ''}`}>
        <span>
          <Icon name={late ? 'alert' : 'calendar'} size={14} />
          {deadline}
        </span>
        {late ? (
          <small>Просрочено</small>
        ) : task.due_date === today && task.status !== 'done' ? (
          <small className="today-label">Сегодня</small>
        ) : null}
      </div>
      <div>
        <span className={`priority priority-${task.priority}`}>
          <span />
          {priorityNames[task.priority]}
        </span>
      </div>
      <div>
        <span className={`status status-${task.status}`}>
          <span />
          {statusNames[task.status]}
        </span>
      </div>
      <div className="row-actions">
        <button
          className="icon-button"
          disabled={busy}
          aria-label={`Редактировать: ${task.title}`}
          onClick={onEdit}
        >
          <Icon name="edit" size={17} />
        </button>
        <button
          className="icon-button delete-action"
          disabled={busy}
          aria-label={`Удалить: ${task.title}`}
          onClick={onDelete}
        >
          <Icon name="trash" size={17} />
        </button>
      </div>
    </article>
  );
}
