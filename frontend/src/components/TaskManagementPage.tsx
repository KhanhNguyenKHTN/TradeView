import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  DeleteTaskDialog,
  TaskDialog,
  TaskStatusPriorityDialog,
} from './AppDialogs';
import { formatDateTime, toDateTimeLocalValue } from '../utils/appFormatters';
import type {
  TaskEditableField,
  TaskFormValues,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TaskSummary,
  TaskViewFilter,
  TaskViewMode,
} from '../types/app';

type TaskManagementPageProps = {
  tasks: TaskItem[];
  summary: TaskSummary;
  activeFilter: TaskViewFilter;
  viewMode: TaskViewMode;
  submitting: boolean;
  onFilterChange: (filter: TaskViewFilter) => void;
  onViewModeChange: (mode: TaskViewMode) => void;
  onCreateTask: (values: TaskFormValues) => void;
  onTaskChange: (
    taskId: number,
    field: TaskEditableField,
    value: string | boolean,
  ) => void;
  onDeleteTask: (taskId: number) => void;
};

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'TODO', label: 'Cần làm' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'DONE', label: 'Hoàn thành' },
  { value: 'BLOCKED', label: 'Tạm dừng' },
];

const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const statusOrder: Record<TaskStatus, number> = {
  IN_PROGRESS: 0,
  BLOCKED: 1,
  TODO: 2,
  DONE: 3,
};

const priorityOrder: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const filterOptions: Array<{ value: TaskViewFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'TODO', label: 'Cần làm' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'DONE', label: 'Hoàn thành' },
  { value: 'BLOCKED', label: 'Tạm dừng' },
];

const viewModeOptions: Array<{ value: TaskViewMode; label: string }> = [
  { value: 'CARD', label: 'Dạng card' },
  { value: 'GRID', label: 'Dạng grid' },
];

const emptyTaskForm = (): TaskFormValues => ({
  title: '',
  description: '',
  note: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: toDateTimeLocalValue(),
  owner: '',
  category: '',
  isFinancialPlan: false,
  financialTargetAmount: '0',
  financialCurrentAmount: '0',
  progress: '0',
});

function getStatusLabel(status: TaskStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function getStatusBadgeClass(status: TaskStatus) {
  switch (status) {
    case 'DONE':
      return 'badge positive';
    case 'BLOCKED':
      return 'badge negative';
    case 'IN_PROGRESS':
      return 'badge info';
    default:
      return 'badge';
  }
}

function getPriorityBadgeClass(priority: TaskPriority) {
  switch (priority) {
    case 'URGENT':
      return 'badge negative';
    case 'HIGH':
      return 'badge info';
    case 'MEDIUM':
      return 'badge';
    default:
      return 'badge positive';
  }
}

function isTaskOverdue(task: TaskItem) {
  if (task.status === 'DONE') {
    return false;
  }

  return new Date(task.dueDate).getTime() < Date.now();
}

function mapTaskToForm(task: TaskItem): TaskFormValues {
  return {
    title: task.title,
    description: task.description,
    note: task.note,
    status: task.status,
    priority: task.priority,
    dueDate: toDateTimeLocalValue(new Date(task.dueDate)),
    owner: task.owner,
    category: task.category,
    isFinancialPlan: task.isFinancialPlan,
    financialTargetAmount: String(task.financialTargetAmount ?? 0),
    financialCurrentAmount: String(task.financialCurrentAmount ?? 0),
    progress: String(task.progress ?? 0),
  };
}

export default function TaskManagementPage({
  tasks,
  summary,
  activeFilter,
  viewMode,
  submitting,
  onFilterChange,
  onViewModeChange,
  onCreateTask,
  onTaskChange,
  onDeleteTask,
}: TaskManagementPageProps) {
  const [createForm, setCreateForm] = useState<TaskFormValues>(emptyTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<TaskFormValues>(emptyTaskForm());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskItem | null>(null);
  const [statusPriorityTask, setStatusPriorityTask] = useState<TaskItem | null>(null);
  const [statusPriorityForm, setStatusPriorityForm] = useState<{
    status: TaskStatus;
    priority: TaskPriority;
  }>({
    status: 'TODO',
    priority: 'MEDIUM',
  });

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((leftTask, rightTask) => {
        const statusDiff = statusOrder[leftTask.status] - statusOrder[rightTask.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const priorityDiff =
          priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(leftTask.dueDate).getTime() - new Date(rightTask.dueDate).getTime();
      }),
    [tasks],
  );

  const resetCreateForm = () => {
    setCreateForm(emptyTaskForm());
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreateTask(createForm);
    resetCreateForm();
    setIsCreateDialogOpen(false);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingTaskId === null) {
      return;
    }

    const nextValues = editingForm;
    const currentTask = tasks.find((task) => task.id === editingTaskId);

    if (!currentTask) {
      return;
    }

    const fieldUpdates: Array<[TaskEditableField, string | boolean]> = [
      ['title', nextValues.title],
      ['description', nextValues.description],
      ['note', nextValues.note],
      ['status', nextValues.status],
      ['priority', nextValues.priority],
      ['dueDate', nextValues.dueDate],
      ['owner', nextValues.owner],
      ['category', nextValues.category],
      ['isFinancialPlan', nextValues.isFinancialPlan],
      [
        'financialTargetAmount',
        nextValues.isFinancialPlan ? nextValues.financialTargetAmount : '0',
      ],
      [
        'financialCurrentAmount',
        nextValues.isFinancialPlan ? nextValues.financialCurrentAmount : '0',
      ],
      ['progress', nextValues.isFinancialPlan ? nextValues.progress : '0'],
    ];

    fieldUpdates.forEach(([field, value]) => {
      const currentValue =
        field === 'progress'
          ? String(currentTask.progress)
          : field === 'isFinancialPlan'
            ? currentTask.isFinancialPlan
            : field === 'financialTargetAmount'
              ? String(currentTask.financialTargetAmount)
              : field === 'financialCurrentAmount'
                ? String(currentTask.financialCurrentAmount)
                : String(currentTask[field]);

      if (currentValue !== value) {
        onTaskChange(currentTask.id, field, value);
      }
    });

    setEditingTaskId(null);
    setEditingForm(emptyTaskForm());
  };

  const openStatusPriorityDialog = (task: TaskItem) => {
    setStatusPriorityTask(task);
    setStatusPriorityForm({
      status: task.status,
      priority: task.priority,
    });
  };

  const handleStatusPrioritySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!statusPriorityTask) {
      return;
    }

    if (statusPriorityTask.status !== statusPriorityForm.status) {
      onTaskChange(statusPriorityTask.id, 'status', statusPriorityForm.status);
    }

    if (statusPriorityTask.priority !== statusPriorityForm.priority) {
      onTaskChange(statusPriorityTask.id, 'priority', statusPriorityForm.priority);
    }

    setStatusPriorityTask(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTaskTarget) {
      return;
    }

    onDeleteTask(deleteTaskTarget.id);
    setDeleteTaskTarget(null);
  };

  return (
    <div className="task-page">
      <section className="section">
        <div className="section-heading row">
          
          <span className="section-kicker">Task dashboard</span>
        </div>

        <div className="stats-grid task-stats-grid">
          <article className="stat-card">
            <span className="stat-label">Tổng số task</span>
            <strong>{summary.totalTasks}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Đang làm</span>
            <strong>{summary.inProgressTasks}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Sắp đến hạn / quá hạn</span>
            <strong>{summary.dueSoonTasks}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Hoàn thành</span>
            <strong>{summary.completedTasks}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Kế hoạch tài chính</span>
            <strong>{summary.financialPlanningTasks}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">TB tiến độ tài chính</span>
            <strong>{summary.averageFinancialProgress}%</strong>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="section-heading column">
            <div>
              <span className="section-kicker">Danh sách task</span>
            </div>

            <div className="task-toolbar">
              <div className="task-toolbar-row task-toolbar-row-status">
                <div className="task-filter-select">
                  <select
                    id="task-status-filter"
                    value={activeFilter}
                    onChange={(event) => onFilterChange(event.target.value as TaskViewFilter)}
                  >
                    {filterOptions.map((filterOption) => (
                      <option key={filterOption.value} value={filterOption.value}>
                        {filterOption.label}
                      </option>
                    ))}
                  </select>
                </div>

                <ul
                  className="task-filter-list task-filter-list-status"
                  aria-label="Lọc trạng thái task"
                >
                  {filterOptions.map((filterOption) => (
                    <li key={filterOption.value}>
                      <button
                        type="button"
                        className={`filter-chip ${
                          activeFilter === filterOption.value ? 'filter-chip-active' : ''
                        }`}
                        onClick={() => onFilterChange(filterOption.value)}
                      >
                        {filterOption.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="task-toolbar-row task-toolbar-row-actions">
                <button
                  type="button"
                  className="primary-button task-add-button"
                  disabled={submitting}
                  onClick={() => setIsCreateDialogOpen(true)}
                  aria-label="Thêm task mới"
                  title="Thêm task mới"
                >
                  <span className="task-add-button-icon" aria-hidden="true">
                    ＋
                  </span>
                  <span className="task-add-button-label">Thêm task mới</span>
                </button>

                <ul
                  className="task-filter-list header-nav-tabs task-view-mode-tabs"
                  role="tablist"
                  aria-label="Chế độ hiển thị task"
                >
                  {viewModeOptions.map((option) => (
                    <li
                      key={option.value}
                      className={`header-nav-tab-item ${
                        viewMode === option.value ? 'header-nav-tab-item-active' : ''
                      }`}
                      role="tab"
                      aria-selected={viewMode === option.value}
                      tabIndex={0}
                      onClick={() => onViewModeChange(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onViewModeChange(option.value);
                        }
                      }}
                    >
                      {option.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className={viewMode === 'GRID' ? 'task-table-wrapper' : 'task-grid'}>
            {viewMode === 'CARD'
              ? sortedTasks.map((task) => {
                  const overdue = isTaskOverdue(task);

                  return (
                    <article className="task-card" key={task.id}>
                      <div className="task-card-header">
                        <div className="task-title-stack">
                          <div className="task-badge-row">
                            <span className={getStatusBadgeClass(task.status)}>
                              {getStatusLabel(task.status)}
                            </span>
                            <span className={getPriorityBadgeClass(task.priority)}>
                              {priorityLabels[task.priority]}
                            </span>
                            {task.isFinancialPlan ? (
                              <span className="badge info">Kế hoạch tài chính</span>
                            ) : null}
                          </div>
                          <h3>{task.title}</h3>
                          <p>{task.description}</p>
                        </div>

                        <div className="task-card-actions">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submitting}
                            onClick={() => openStatusPriorityDialog(task)}
                            title="Cập nhật trạng thái và ưu tiên"
                            aria-label={`Cập nhật trạng thái và ưu tiên cho ${task.title}`}
                          >
                            ♲
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submitting}
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditingForm(mapTaskToForm(task));
                            }}
                            title="Sửa task"
                            aria-label={`Sửa task ${task.title}`}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            disabled={submitting}
                            onClick={() => setDeleteTaskTarget(task)}
                            title="Xóa task"
                            aria-label={`Xóa task ${task.title}`}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <dl className="task-meta-grid">
                        <div>
                          <dt>Nhóm task</dt>
                          <dd>{task.category}</dd>
                        </div>
                        <div>
                          <dt>Phụ trách</dt>
                          <dd>{task.owner}</dd>
                        </div>
                        <div>
                          <dt>Due date</dt>
                          <dd className={overdue ? 'loss' : ''}>
                            {formatDateTime(task.dueDate)}
                          </dd>
                        </div>
                        <div>
                          <dt>Cập nhật lúc</dt>
                          <dd>{formatDateTime(task.updatedAt)}</dd>
                        </div>
                      </dl>

                      <div className="task-note-block">
                        <strong>Ghi chú</strong>
                        <p>{task.note || 'Chưa có ghi chú.'}</p>
                      </div>

                      {task.isFinancialPlan ? (
                        <div className="task-progress-block">
                          <div className="row">
                            <strong>Tiến độ kế hoạch tài chính</strong>
                            <span>{task.progress}%</span>
                          </div>
                          <div
                            className="progress-track"
                            aria-label={`Tiến độ ${task.title}: ${task.progress}%`}
                          >
                            <div
                              className="progress-value"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="task-financial-meta">
                            <span>Mục tiêu: {task.financialTargetAmount}</span>
                            <span>Hiện có: {task.financialCurrentAmount}</span>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              : null}

            {viewMode === 'GRID'
              ? tasks.length > 0
                ? (
                  <table className="task-table mt-2">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Trạng thái</th>
                        <th>Ưu tiên</th>
                        <th>Phụ trách</th>
                        <th>Nhóm</th>
                        <th>Due date</th>
                        <th>Tiến độ</th>
                        <th>Ghi chú</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTasks.map((task) => {
                        const overdue = isTaskOverdue(task);

                        return (
                          <tr key={task.id}>
                            <td>
                              <div className="task-table-title">
                                <strong>{task.title}</strong>
                                <span>{task.description}</span>
                                {task.isFinancialPlan ? (
                                  <span className="badge info">Kế hoạch tài chính</span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <span className={getStatusBadgeClass(task.status)}>
                                {getStatusLabel(task.status)}
                              </span>
                            </td>
                            <td>
                              <span className={getPriorityBadgeClass(task.priority)}>
                                {priorityLabels[task.priority]}
                              </span>
                            </td>
                            <td>{task.owner}</td>
                            <td>{task.category}</td>
                            <td>
                              <span className={overdue ? 'loss' : ''}>
                                {formatDateTime(task.dueDate)}
                              </span>
                            </td>
                            <td>
                              {task.isFinancialPlan
                                ? `${task.progress}% (${task.financialCurrentAmount}/${task.financialTargetAmount})`
                                : '-'}
                            </td>
                            <td>{task.note || '-'}</td>
                            <td>
                              <div className="task-table-actions">
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={submitting}
                                  onClick={() => openStatusPriorityDialog(task)}
                                >
                                  ♲
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={submitting}
                                  onClick={() => {
                                    setEditingTaskId(task.id);
                                    setEditingForm(mapTaskToForm(task));
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="danger-button"
                                  disabled={submitting}
                                  onClick={() => setDeleteTaskTarget(task)}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  )
                : null
              : null}

            {tasks.length === 0 ? (
              <div className="task-empty-state">
                Không có task nào theo trạng thái đang chọn.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <TaskDialog
        open={isCreateDialogOpen}
        submitting={submitting}
        title="Thêm công việc cần theo dõi"
        submitLabel="Thêm task"
        form={createForm}
        onClose={() => {
          if (!submitting) {
            setIsCreateDialogOpen(false);
          }
        }}
        onSubmit={handleCreateSubmit}
        onChange={setCreateForm}
      />

      <TaskDialog
        open={editingTaskId !== null}
        submitting={submitting}
        title="Cập nhật task"
        submitLabel="Lưu cập nhật"
        form={editingForm}
        onClose={() => {
          if (!submitting) {
            setEditingTaskId(null);
            setEditingForm(emptyTaskForm());
          }
        }}
        onSubmit={handleEditSubmit}
        onChange={setEditingForm}
      />

      <TaskStatusPriorityDialog
        open={statusPriorityTask !== null}
        task={statusPriorityTask}
        submitting={submitting}
        status={statusPriorityForm.status}
        priority={statusPriorityForm.priority}
        onClose={() => {
          if (!submitting) {
            setStatusPriorityTask(null);
          }
        }}
        onStatusChange={(status) =>
          setStatusPriorityForm((current) => ({
            ...current,
            status,
          }))
        }
        onPriorityChange={(priority) =>
          setStatusPriorityForm((current) => ({
            ...current,
            priority,
          }))
        }
        onSubmit={handleStatusPrioritySubmit}
      />

      <DeleteTaskDialog
        open={deleteTaskTarget !== null}
        task={deleteTaskTarget}
        submitting={submitting}
        onClose={() => {
          if (!submitting) {
            setDeleteTaskTarget(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
