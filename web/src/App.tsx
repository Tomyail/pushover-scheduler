import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, updateTask, deleteTask, listTasks, getTaskLogs, login, logout, triggerTask } from './api';
import type { ScheduleRequest, ScheduleType, Task, ExecutionLog } from './types';

const defaultSchedule = (): ScheduleRequest => ({
  message: '',
  title: '',
  schedule: {
    type: 'once',
  },
  pushover: {},
});

const SERVER_TIMEZONE = 'Asia/Shanghai'; // This should ideally come from an API, but for now we match wrangler.toml

function formatDateTime(value?: string) {
  if (!value) return '-';
  
  // If it looks like a cron expression (contains spaces and doesn't look like an ISO date)
  if (value.includes(' ') && !value.includes('T') && !value.includes('-')) {
    return value;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return value;

  // For ISO strings that end with Z or have an offset, they are absolute times.
  // We want to show them in the user's local browser time.
  // For datetime-local inputs (which might not have Z), we should be careful.
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default function App() {
  const [form, setForm] = useState<ScheduleRequest>(() => defaultSchedule());
  const [cronValue, setCronValue] = useState('0 9 * * *');
  const [datetimeValue, setDatetimeValue] = useState('');
  const [sendingExtras, setSendingExtras] = useState('{"sound":"pushover"}');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false); // Default to false to prevent flicker
  const queryClient = useQueryClient();

  // Check Auth Query - runs on mount
  const { isLoading: isAuthChecking, isError: isNotAuthenticated } = useQuery({
    queryKey: ['checkAuth'],
    queryFn: async () => {
      await listTasks();
      return true;
    },
    retry: false,
    staleTime: Infinity,
  });

  // Decide what to show based on auth check
  const effectiveShowLogin = showLogin || isNotAuthenticated;

  // Tasks Query - only runs if authenticated
  const { data: tasks = [], isLoading: isTasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await listTasks();
      // Sort tasks by createdAt descending (newest first)
      return [...data].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    },
    enabled: !effectiveShowLogin && !isAuthChecking,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setForm(defaultSchedule());
      setDatetimeValue('');
      setCronValue('0 9 * * *');
      setSendingExtras('{"sound":"pushover"}');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: ScheduleRequest }) => updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTaskId(null);
      setForm(defaultSchedule());
      setDatetimeValue('');
      setCronValue('0 9 * * *');
      setSendingExtras('{"sound":"pushover"}');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  
  const triggerMutation = useMutation({
    mutationFn: triggerTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
    },
  });

  const loginMutation = useMutation({
    mutationFn: (pwd: string) => login(pwd),
    onSuccess: () => {
      setShowLogin(false);
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['checkAuth'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      setShowLogin(true);
      queryClient.clear();
    },
  });

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setForm({
      message: task.message,
      title: task.title,
      aiPrompt: task.aiPrompt,
      aiModel: task.aiModel,
      aiSystemPrompt: task.aiSystemPrompt,
      schedule: task.schedule,
      pushover: task.pushover,
    });
    if (task.schedule.type === 'repeat' && task.schedule.cron) {
      setCronValue(task.schedule.cron);
    } else if (task.schedule.type === 'once' && task.schedule.datetime) {
      setDatetimeValue(task.schedule.datetime);
    }
    if (task.pushover) {
      setSendingExtras(JSON.stringify(task.pushover, null, 2));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setForm(defaultSchedule());
    setDatetimeValue('');
    setCronValue('0 9 * * *');
    setSendingExtras('{"sound":"pushover"}');
  };

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['taskLogs', expandedTaskId],
    queryFn: () => expandedTaskId ? getTaskLogs(expandedTaskId) : Promise.resolve([]),
    enabled: !!expandedTaskId,
    refetchInterval: expandedTaskId ? 5000 : false,
  });

  const scheduleType = form.schedule.type;

  const payloadPreview = useMemo(() => {
    const schedule = scheduleType === 'repeat'
      ? { type: 'repeat' as ScheduleType, cron: cronValue }
      : { type: 'once' as ScheduleType, datetime: datetimeValue };

    let pushover: Record<string, string | number | boolean> | undefined;
    if (sendingExtras.trim()) {
      try {
        const parsed = JSON.parse(sendingExtras);
        if (parsed && typeof parsed === 'object') {
          pushover = parsed;
        }
      } catch {
        pushover = undefined;
      }
    }

    return {
      ...form,
      schedule,
      pushover,
    };
  }, [cronValue, datetimeValue, form, scheduleType, sendingExtras]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const schedule = scheduleType === 'repeat'
      ? { type: 'repeat' as ScheduleType, cron: cronValue.trim() }
      : { type: 'once' as ScheduleType, datetime: datetimeValue };

    let pushover: Record<string, string | number | boolean> | undefined;
    if (sendingExtras.trim()) {
      try {
        pushover = JSON.parse(sendingExtras);
      } catch {
        alert('Pushover extras must be valid JSON.');
        return;
      }
    }

    const payload = {
      message: form.message.trim() || (form.aiPrompt ? 'AI Generated' : ''),
      title: form.title?.trim() || undefined,
      aiPrompt: form.aiPrompt?.trim() || undefined,
      aiModel: form.aiModel?.trim() || undefined,
      aiSystemPrompt: form.aiSystemPrompt?.trim() || undefined,
      schedule,
      pushover,
    };

    if (editingTaskId) {
      updateMutation.mutate({ taskId: editingTaskId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isFormValid = (form.message.trim() || form.aiPrompt?.trim()) &&
    (scheduleType === 'once' ? datetimeValue : cronValue.trim());

  // While checking auth, show nothing or a subtle loader to prevent flickering
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-pulse text-sm text-neutral-400 font-medium tracking-widest uppercase">Initializing...</div>
      </div>
    );
  }

  if (effectiveShowLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="bg-white rounded-[28px] border border-black/10 p-8 w-full max-w-md shadow-[0_24px_55px_rgba(19,21,26,0.12)]">
          <h1 className="text-2xl font-semibold text-neutral-900 text-center mb-6">🔐 Login</h1>
          {isNotAuthenticated && !loginMutation.isPending && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm mb-4">
              Authentication required
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(password); }} className="space-y-4">
            <label className="block">
              <span className="text-sm text-neutral-700 mb-2 block">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                required
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="w-full bg-linear-to-br from-[#ff7a59] to-[#ff5530] text-white py-3 rounded-2xl font-semibold shadow-[0_16px_32px_rgba(255,85,48,0.25)] hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10">
        <header className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Pushover Scheduler</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-neutral-900 md:text-5xl">
              Ship precise notifications with a calmer dashboard.
            </h1>
            <p className="mt-4 max-w-xl text-base text-neutral-600">
              Manage one-off reminders and repeating alerts on the same endpoint,
              now with a lightweight control surface.
            </p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_20px_50px_rgba(19,21,26,0.15)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.25)]" />
                <strong className="text-sm tracking-wide text-neutral-800">Worker status</strong>
              </div>
              <button
                className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Signing out...' : 'Logout'}
              </button>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Use <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">/schedule</code> and{' '}
              <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">/tasks</code> for API access.
            </p>
            <p className="mt-2 text-xs text-neutral-500">Scheduled times are based on server timezone: <span className="font-semibold text-neutral-700">{SERVER_TIMEZONE}</span></p>
          </div>
        </header>

        <main className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-[28px] border border-black/10 bg-white/95 p-6 shadow-[0_24px_55px_rgba(19,21,26,0.12)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-900">{editingTaskId ? 'Edit task' : 'Create a task'}</h2>
              {editingTaskId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel Edit
                </button>
              )}
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold tracking-wide">
                {scheduleType === 'repeat' ? 'Repeat' : 'Once'}
              </span>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <div className="grid gap-2 text-sm text-neutral-700">
                <span>Content type</span>
                <div className="inline-flex gap-2 rounded-full bg-neutral-100 p-1 w-fit">
                  <button
                    type="button"
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                      !form.aiPrompt && form.aiPrompt !== '' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, aiPrompt: undefined, aiModel: undefined, aiSystemPrompt: undefined }))}
                  >
                    Simple Text
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                      typeof form.aiPrompt === 'string' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, aiPrompt: '', title: undefined }))}
                  >
                    AI Generation
                  </button>
                </div>
              </div>

              {typeof form.aiPrompt !== 'string' ? (
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm text-neutral-700">
                    <span>Message</span>
                    <input
                      value={form.message}
                      onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                      placeholder="Your notification message"
                      required
                      className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-neutral-700">
                    <span>Title (optional)</span>
                    <input
                      value={form.title ?? ''}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Short title"
                      className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm text-neutral-700">
                    <span>AI Prompt</span>
                    <textarea
                      value={form.aiPrompt ?? ''}
                      onChange={(event) => setForm((prev) => ({ ...prev, aiPrompt: event.target.value }))}
                      placeholder="Ask AI to generate message content (e.g. 'Write a funny morning greeting')"
                      rows={2}
                      required
                      className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                    />
                  </label>
                  <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-neutral-700">
                      <span className="flex items-center justify-between">
                        AI Model (optional)
                        <a 
                          href="https://developers.cloudflare.com/workers-ai/models/" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] font-medium text-neutral-400 hover:text-neutral-900 underline underline-offset-2"
                        >
                          View supported models
                        </a>
                      </span>
                      <input
                        value={form.aiModel ?? ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, aiModel: event.target.value }))}
                        placeholder="@cf/meta/llama-3.1-8b-instruct-fast"
                        className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-700">
                      <span>AI System Prompt (optional)</span>
                      <textarea
                        value={form.aiSystemPrompt ?? ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, aiSystemPrompt: event.target.value }))}
                        placeholder="You are a helpful assistant generating short notification messages. Always respond in the same language as the user's prompt."
                        rows={2}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="grid gap-2 text-sm text-neutral-700 mt-2">
                <span>Schedule type</span>
                <div className="inline-flex gap-2 rounded-full bg-neutral-100 p-1">
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm ${
                      scheduleType === 'once' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, schedule: { type: 'once' } }))}
                  >
                    Once
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm ${
                      scheduleType === 'repeat' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, schedule: { type: 'repeat' } }))}
                  >
                    Repeat
                  </button>
                </div>
              </div>
              {scheduleType === 'once' ? (
                <label className="grid gap-2 text-sm text-neutral-700">
                  <div className="flex items-center justify-between">
                    <span>Run at ({SERVER_TIMEZONE})</span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const offset = now.getTimezoneOffset() * 60000;
                        const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
                        setDatetimeValue(localISOTime);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      Set to Now
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={datetimeValue}
                    onChange={(event) => setDatetimeValue(event.target.value)}
                    required
                    className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                  />
                </label>
              ) : (
                <label className="grid gap-2 text-sm text-neutral-700">
                                    <span>Cron ({SERVER_TIMEZONE})</span>
                  <input
                    value={cronValue}
                    onChange={(event) => setCronValue(event.target.value)}
                    placeholder="0 9 * * *"
                    required
                    className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                  />
                </label>
              )}
              <label className="grid gap-2 text-sm text-neutral-700">
                <span>Pushover extras (JSON)</span>
                <textarea
                  value={sendingExtras}
                  onChange={(event) => setSendingExtras(event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-2xl bg-linear-to-br from-[#ff7a59] to-[#ff5530] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,85,48,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingTaskId ? 'Update task' : 'Schedule notification'}
              </button>
              {createMutation.isError && !editingTaskId && (
                <p className="text-sm text-red-600">Failed to create task. Check worker logs.</p>
              )}
              {updateMutation.isError && editingTaskId && (
                <p className="text-sm text-red-600">Failed to update task. Check worker logs.</p>
              )}
            </form>
            <div className="mt-6 rounded-2xl border border-black/10 bg-[#f5f2ee] p-4">
              <h3 className="text-sm font-semibold text-neutral-800">Payload preview</h3>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-neutral-700">
                {JSON.stringify(payloadPreview, null, 2)}
              </pre>
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-black/10 bg-white/95 p-6 shadow-[0_24px_55px_rgba(19,21,26,0.12)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-900">Active tasks</h2>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600"
                  type="button"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
                >
                  Refresh
                </button>
              </div>
              <div className="mt-5">
                {isTasksLoading ? (
                  <p className="text-sm text-neutral-500">Loading tasks...</p>
                ) : tasksError ? (
                  <p className="text-sm text-red-600">Unable to load tasks.</p>
                ) : tasks.length === 0 ? (
                  <p className="text-sm text-neutral-500">No tasks scheduled yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onDelete={deleteMutation.mutate}
                        deleting={deleteMutation.isPending}
                        onTrigger={triggerMutation.mutate}
                        triggering={triggerMutation.isPending && triggerMutation.variables === task.id}
                        isExpanded={expandedTaskId === task.id}
                        onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                        logs={task.id === expandedTaskId ? logs : []}
                        logsLoading={logsLoading}
                        onEdit={handleEditTask}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/10 bg-white/95 p-6 shadow-[0_24px_55px_rgba(19,21,26,0.12)]">
              <h2 className="text-xl font-semibold text-neutral-900">Pushover extras</h2>
              <p className="mt-3 text-sm text-neutral-600">
                The JSON below is passed directly to the Pushover API. See the full list of optional parameters at{' '}
                <a
                  className="font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-4"
                  href="https://pushover.net/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  pushover.net/api
                </a>.
              </p>
              <div className="mt-4 rounded-2xl border border-black/10 bg-neutral-50 p-4 text-xs text-neutral-600">
                <div className="grid gap-2">
                  <p><span className="font-semibold text-neutral-800">priority</span> −2..2, with 2 requiring <code className="rounded bg-neutral-100 px-1">retry</code> + <code className="rounded bg-neutral-100 px-1">expire</code></p>
                  <p><span className="font-semibold text-neutral-800">sound</span> custom alert tone</p>
                  <p><span className="font-semibold text-neutral-800">device</span> target device name</p>
                  <p><span className="font-semibold text-neutral-800">url</span> &amp; <span className="font-semibold text-neutral-800">url_title</span> link attachments</p>
                  <p><span className="font-semibold text-neutral-800">html</span> enable HTML formatting (1)</p>
                  <p><span className="font-semibold text-neutral-800">ttl</span> discard message after N seconds</p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onDelete,
  deleting,
  onTrigger,
  triggering,
  isExpanded,
  onToggle,
  logs,
  logsLoading,
  onEdit
}: {
  task: Task;
  onDelete: (id: string) => void;
  deleting: boolean;
  onTrigger: (id: string) => void;
  triggering: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  logs: ExecutionLog[];
  logsLoading: boolean;
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-black/10 bg-white transition-all hover:border-black/20 hover:shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Header: Title/Message */}
            <h3 className="text-base font-semibold text-neutral-900 leading-tight line-clamp-2" title={task.title || task.message}>
              {task.title || task.message}
            </h3>
            
            {/* Meta tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                task.schedule.type === 'repeat' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-orange-50 text-orange-600'
              }`}>
                {task.schedule.type}
              </span>
              
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDateTime(task.schedule.datetime || task.schedule.cron)}
              </span>

              {task.executionHistory && task.executionHistory.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                  {task.executionHistory.length} runs
                </span>
              )}
            </div>

            {task.lastRun && (
              <p className="mt-2 text-[11px] text-neutral-400">
                Last run: <span className="text-neutral-600">{formatDateTime(task.lastRun)}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0 md:flex-row md:items-center">
             <button
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-50"
              type="button"
              onClick={() => onTrigger(task.id)}
              disabled={triggering}
            >
              {triggering ? 'Running...' : 'Run Now'}
            </button>
             <button
              className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-600 hover:bg-neutral-50"
              type="button"
              onClick={onToggle}
            >
              {isExpanded ? 'Hide Logs' : 'Logs'}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-600 hover:bg-neutral-50"
              type="button"
              onClick={() => onEdit(task)}
            >
              Edit
            </button>
            <button
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-neutral-800"
              type="button"
              onClick={() => onDelete(task.id)}
              disabled={deleting}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-black/5 bg-neutral-50/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500">Execution History</h4>
            {logs.length > 0 && <span className="text-[10px] text-neutral-400">Showing last {logs.length} runs</span>}
          </div>
          
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-xs text-neutral-400">Loading logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center">
              <p className="text-xs text-neutral-400">No logs recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {logs.slice().reverse().map((log, index) => (
                <div key={index} className="group/log rounded-xl border border-black/5 bg-white p-3 transition-colors hover:border-black/10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        <span className={`text-[11px] font-bold uppercase tracking-tight ${
                          log.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {log.status === 'success' ? 'Delivered' : 'Failed'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400">{formatDateTime(log.executedAt)}</p>
                    </div>
                    {log.response && (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-mono text-neutral-500">{log.response}</span>
                    )}
                  </div>
                  
                  {log.aiGeneratedMessage && (
                    <div className="mt-3 relative rounded-lg bg-neutral-50 p-2.5 border border-black/5">
                      <div className="absolute -top-2 left-3 bg-neutral-50 px-1 text-[8px] font-bold uppercase tracking-tighter text-neutral-400">AI Preview</div>
                      <p className="text-[11px] text-neutral-700 leading-relaxed italic">“{log.aiGeneratedMessage}”</p>
                    </div>
                  )}
                  
                  {log.error && (
                    <div className="mt-2 rounded-lg bg-red-50 p-2 border border-red-100">
                      <p className="text-[10px] text-red-600 font-medium">{log.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
