import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getTask, getTaskLogs } from '../api';
import { LogItem } from '../components/LogItem';
import type { RootStackParamList } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

function formatDateTime(value?: string): string {
  if (!value) return '-';
  
  if (value.includes(' ') && !value.includes('T') && !value.includes('-')) {
    return value;
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function TaskDetailScreen({ route }: Props) {
  const { taskId } = route.params;

  const { data: task, isLoading: isTaskLoading, refetch: refetchTask } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
  });

  const { data: logs = [], isLoading: isLogsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['taskLogs', taskId],
    queryFn: () => getTaskLogs(taskId),
    refetchInterval: 5000,
  });

  const onRefresh = async () => {
    await refetchTask();
    await refetchLogs();
  };

  if (isTaskLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff5530" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Task not found</Text>
      </View>
    );
  }

  const isRecurring = task.schedule.type === 'repeat';
  const runCount = task.executionHistory?.length ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isTaskLoading} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, isRecurring ? styles.badgeRecurring : styles.badgeOnce]}>
            <Text style={[styles.badgeText, isRecurring ? styles.badgeTextRecurring : styles.badgeTextOnce]}>
              {isRecurring ? 'RECURRING' : 'ONE-TIME'}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{task.title || task.message}</Text>
        {!task.title && task.aiPrompt && (
          <Text style={styles.aiIndicator}>🤖 AI Generated</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Message</Text>
          <Text style={styles.detailValue}>{task.message}</Text>
        </View>

        {task.aiPrompt && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>AI Prompt</Text>
              <Text style={styles.detailValue}>{task.aiPrompt}</Text>
            </View>
            {task.aiModel && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>AI Model</Text>
                <Text style={styles.detailValue}>{task.aiModel}</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Schedule</Text>
          <Text style={styles.detailValue}>
            {formatDateTime(task.schedule.datetime || task.schedule.cron)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{formatDateTime(task.createdAt)}</Text>
        </View>

        {task.lastRun && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Run</Text>
            <Text style={styles.detailValue}>{formatDateTime(task.lastRun)}</Text>
          </View>
        )}

        {task.pushover && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pushover Config</Text>
            <Text style={[styles.detailValue, styles.codeValue]}>
              {JSON.stringify(task.pushover, null, 2)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Execution Logs</Text>
          {runCount > 0 && (
            <View style={styles.runBadge}>
              <Text style={styles.runBadgeText}>{runCount}</Text>
            </View>
          )}
        </View>

        {isLogsLoading ? (
          <ActivityIndicator style={styles.logsLoading} color="#ff5530" />
        ) : logs.length === 0 ? (
          <Text style={styles.emptyText}>No execution logs yet</Text>
        ) : (
          logs.map((log, index) => (
            <LogItem key={`${log.executedAt}-${index}`} log={log} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  badgeContainer: {
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeOnce: {
    backgroundColor: '#fff7ed',
  },
  badgeRecurring: {
    backgroundColor: '#eff6ff',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextOnce: {
    color: '#ea580c',
  },
  badgeTextRecurring: {
    color: '#2563eb',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 28,
  },
  aiIndicator: {
    fontSize: 14,
    color: '#0284c7',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  runBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  runBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 20,
  },
  codeValue: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  logsLoading: {
    marginVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
});
