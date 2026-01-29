import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ExecutionLog } from '../types';

interface LogItemProps {
  log: ExecutionLog;
}

function formatDateTime(value: string): string {
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

function LogItemComponent({ log }: LogItemProps) {
  const isSuccess = log.status === 'success';
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, isSuccess ? styles.statusSuccess : styles.statusFailed]}>
          <Text style={[styles.statusText, isSuccess ? styles.statusTextSuccess : styles.statusTextFailed]}>
            {isSuccess ? '✓' : '✗'}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatDateTime(log.executedAt)}</Text>
      </View>
      
      {log.aiGeneratedMessage && (
        <View style={styles.aiMessage}>
          <Text style={styles.aiLabel}>AI Generated:</Text>
          <Text style={styles.aiContent} numberOfLines={2}>
            {log.aiGeneratedMessage}
          </Text>
        </View>
      )}
      
      {log.response && (
        <Text style={styles.response} numberOfLines={1}>
          Response: {log.response}
        </Text>
      )}
      
      {log.error && (
        <Text style={styles.error} numberOfLines={2}>
          Error: {log.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusFailed: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextSuccess: {
    color: '#16a34a',
  },
  statusTextFailed: {
    color: '#dc2626',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  aiMessage: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiContent: {
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 18,
  },
  response: {
    fontSize: 12,
    color: '#666',
  },
  error: {
    fontSize: 12,
    color: '#dc2626',
  },
});

export const LogItem = memo(LogItemComponent);
