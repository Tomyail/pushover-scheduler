import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, deleteTask, listTasks, getTaskLogs, login } from './api';
import type { ScheduleRequest, ScheduleType, Task, ExecutionLog } from './types';

const defaultSchedule = (): ScheduleRequest => ({
  message: '',
  title: '',
  schedule: {
    type: 'once',
  },
  pushover: {},
});

function formatDateTime(value?: string) {
  if (!value) return '-';
  return value.replace('T', ' ').replace('Z', ' UTC');
}

export default function App() {
  const [form, setForm] = useState<ScheduleRequest>(() => defaultSchedule());
  const [cronValue, setCronValue] = useState('0 9 * * *');
  const [datetimeValue, setDatetimeValue] = useState('');
  const [sendingExtras, setSendingExtras] = useState('{"sound":"pushover"}');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
    enabled: isLoggedIn,
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setForm(defaultSchedule());
      setDatetimeValue('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const loginMutation = useMutation({
    mutationFn: () => login(password),
    onSuccess: () => {
      setIsLoggedIn(true);
      setPassword('');
    },
  });

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

    createMutation.mutate({
      message: form.message.trim(),
      title: form.title?.trim() || undefined,
      schedule,
      pushover,
    });
  };

  const isFormValid = form.message.trim() &&
    (scheduleType === 'once' ? datetimeValue : cronValue.trim());

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-semibold text-neutral-900 text-center mb-6">🔐 Login</h1>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm mb-4">
              Authentication required
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }} className="space-y-4">
            <label className="block">
              <span className="text-sm text-neutral-700 mb-2 block">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white py-3 rounded-2xl font-semibold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
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
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <header className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Pushover Scheduler</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-neutral-900 md:text-5xl">
              Ship precise notifications with a calmer dashboard.
            </h1>
            <p className="mt-4 max-w-lg text-base text-neutral-600">
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
                className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
                type="button"
                onClick={() => {
                  document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                  setIsLoggedIn(false);
                  window.location.href = '/';
                }}
              >
                Logout
              </button>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Use <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">/schedule</code> and{' '}
              <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs">/tasks</code> for API access.
            </p>
            <p className="mt-2 text-xs text-neutral-500">Timezone is configured on the server.</p>
          </div>
        </header>

        <main className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-black/10 bg-white/95 p-6 shadow-[0_24px_55px_rgba(19,21,26,0.12)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-900">Create a task</h2>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold tracking-wide">
                {scheduleType === 'repeat' ? 'Repeat' : 'Once'}
              </span>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
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
              <div className="grid gap-2 text-sm text-neutral-700">
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
                  <span>Run at (server timezone)</span>
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
                  <span>Cron (server timezone)</span>
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
                className="rounded-2xl bg-gradient-to-br from-[#ff7a59] to-[#ff5530] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,85,48,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isFormValid || createMutation.isPending}
              >
                {createMutation.isPending ? 'Scheduling...' : 'Schedule notification'}
              </button>
              {createMutation.isError && (
                <p className="text-sm text-red-600">Failed to create task. Check worker logs.</p>
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
                {isLoading ? (
                  <p className="text-sm text-neutral-500">Loading tasks...</p>
                ) : error ? (
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
                        isExpanded={expandedTaskId === task.id}
                        onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                        logs={task.id === expandedTaskId ? logs : []}
                        logsLoading={logsLoading}
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
  isExpanded, 
  onToggle,
  logs,
  logsLoading 
}: { 
  task: Task; 
  onDelete: (id: string) => void; 
  deleting: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  logs: ExecutionLog[];
  logsLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[#faf9f7]">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{task.title || task.message}</p>
            {task.executionHistory && task.executionHistory.length > 0 && (
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                {task.executionHistory.length} runs
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">{task.schedule.type === 'once' ? 'Once' : 'Repeat'}</p>
          {task.lastRun && (
            <p className="text-xs text-neutral-400 mt-1">Last run: {formatDateTime(task.lastRun)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 md:items-end">
          <span>{formatDateTime(task.schedule.datetime || task.schedule.cron)}</span>
          <button
            className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
            type="button"
            onClick={onToggle}
          >
            {isExpanded ? 'Hide Logs' : 'View Logs'}
          </button>
          <button
            className="rounded-full bg-neutral-900 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white"
            type="button"
            onClick={() => onDelete(task.id)}
            disabled={deleting}
          >
            Delete
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-black/10 p-4 bg-neutral-50/50">
          <h4 className="text-xs font-semibold text-neutral-700 mb-3">Execution History</h4>
          {logsLoading ? (
            <p className="text-xs text-neutral-500">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-neutral-500">No execution logs yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {logs.slice().reverse().map((log, index) => (
                <div key={index} className="rounded-lg border border-black/5 bg-white p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-semibold ${
                      log.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {log.status === 'success' ? '✓ Success' : '✗ Failed'}
                    </span>
                    <span className="text-[10px] text-neutral-400">{formatDateTime(log.executedAt)}</span>
                  </div>
                  {log.response && (
                    <p className="text-[10px] text-neutral-600">{log.response}</p>
                  )}
                  {log.error && (
                    <p className="text-[10px] text-red-600 mt-1">{log.error}</p>
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
