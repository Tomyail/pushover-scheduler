import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onTrigger: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isTriggering: boolean;
  isDeleting: boolean;
}

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

function TaskCardComponent({
  task,
  onPress,
  onTrigger,
  onDelete,
  onEdit,
  isTriggering,
  isDeleting,
}: TaskCardProps) {
  const isRecurring = task.schedule.type === 'repeat';
  const runCount = task.executionHistory?.length ?? 0;
  
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title || task.message}
        </Text>
        <View style={[styles.badge, isRecurring ? styles.badgeRecurring : styles.badgeOnce]}>
          <Text style={[styles.badgeText, isRecurring ? styles.badgeTextRecurring : styles.badgeTextOnce]}>
            {isRecurring ? 'REPEAT' : 'ONCE'}
          </Text>
        </View>
      </View>
      
      <View style={styles.meta}>
        <Text style={styles.metaText}>⏰ {formatDateTime(task.schedule.datetime || task.schedule.cron)}</Text>
        {runCount > 0 && (
          <View style={styles.runBadge}>
            <Text style={styles.runBadgeText}>{runCount} runs</Text>
          </View>
        )}
      </View>
      
      {task.lastRun && (
        <Text style={styles.lastRun}>Last run: {formatDateTime(task.lastRun)}</Text>
      )}
      
      <View style={styles.actions}>
        <Pressable 
          onPress={(e) => { e.stopPropagation(); onTrigger(); }}
          disabled={isTriggering}
          style={({ pressed }) => [
            styles.button,
            styles.triggerButton,
            pressed && styles.buttonPressed,
            isTriggering && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.triggerButtonText}>
            {isTriggering ? 'Running...' : 'Run Now'}
          </Text>
        </Pressable>
        
        <Pressable 
          onPress={(e) => { e.stopPropagation(); onEdit(); }}
          style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </Pressable>
        
        <Pressable 
          onPress={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={isDeleting}
          style={({ pressed }) => [
            styles.button,
            styles.deleteButton,
            pressed && styles.buttonPressed,
            isDeleting && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.deleteButtonText}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  pressed: {
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  badge: {
    paddingHorizontal: 8,
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  runBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  runBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
  },
  lastRun: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  triggerButton: {
    backgroundColor: '#10b981',
  },
  triggerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#1f2937',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export const TaskCard = memo(TaskCardComponent);
