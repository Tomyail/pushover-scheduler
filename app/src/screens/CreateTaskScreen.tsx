import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, updateTask, getDefaultExtras, parseInput } from '../api';
import type { ScheduleType, RootStackParamList, Task } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTask'>;

const DEFAULT_CRON = '0 9 * * *';

export default function CreateTaskScreen({ navigation, route }: Props) {
  const editingTask = route.params?.task;
  const queryClient = useQueryClient();
  
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('once');
  const [datetime, setDatetime] = useState('');
  const [cron, setCron] = useState('');
  const [pushoverJson, setPushoverJson] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const { data: defaultExtras } = useQuery({
    queryKey: ['defaultExtras'],
    queryFn: getDefaultExtras,
  });

  useEffect(() => {
    if (editingTask) {
      setMessage(editingTask.message || '');
      setTitle(editingTask.title || '');
      setScheduleType(editingTask.schedule.type);
      setDatetime(editingTask.schedule.datetime || '');
      setCron(editingTask.schedule.cron || '');
      setPushoverJson(editingTask.pushover ? JSON.stringify(editingTask.pushover, null, 2) : '');
      setAiPrompt(editingTask.aiPrompt || '');
      setAiModel(editingTask.aiModel || '');
      setAiSystemPrompt(editingTask.aiSystemPrompt || '');
      setUseAi(!!editingTask.aiPrompt);
    } else if (defaultExtras) {
      setCron(defaultExtras.defaultCron || DEFAULT_CRON);
      setAiModel(defaultExtras.defaultAiModel || '');
      setAiSystemPrompt(defaultExtras.defaultAiSystemPrompt || '');
      if (defaultExtras.defaultExtras) {
        setPushoverJson(JSON.stringify(defaultExtras.defaultExtras, null, 2));
      }
    }
  }, [editingTask, defaultExtras]);

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to create task');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: any }) => updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update task');
    },
  });

  const handleParseCron = useCallback(async () => {
    if (!cron.trim()) return;
    if (cron.split(' ').length === 5 && /^[*0-9,/-]+$/.test(cron.replace(/\s+/g, ''))) {
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseInput(cron);
      if (result.schedule?.cron) {
        setCron(result.schedule.cron);
      }
    } catch (err) {
      Alert.alert('Parse Error', 'Could not parse the cron expression');
    } finally {
      setIsParsing(false);
    }
  }, [cron]);

  const handleSubmit = useCallback(() => {
    if (!message.trim() && !aiPrompt.trim()) {
      Alert.alert('Error', 'Please enter a message or AI prompt');
      return;
    }

    const schedule = scheduleType === 'repeat'
      ? { type: 'repeat' as const, cron: cron.trim() }
      : { type: 'once' as const, datetime: datetime };

    let parsedPushover: Record<string, any> | undefined;
    if (pushoverJson.trim()) {
      try {
        parsedPushover = JSON.parse(pushoverJson);
      } catch {
        Alert.alert('Error', 'Invalid JSON in Pushover extras');
        return;
      }
    }

    const payload = {
      message: message.trim() || (aiPrompt ? 'AI Generated' : ''),
      title: title.trim() || undefined,
      aiPrompt: useAi ? aiPrompt.trim() || undefined : undefined,
      aiModel: useAi ? aiModel.trim() || undefined : undefined,
      aiSystemPrompt: useAi ? aiSystemPrompt.trim() || undefined : undefined,
      schedule,
      pushover: parsedPushover,
    };

    if (editingTask) {
      updateMutation.mutate({ taskId: editingTask.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [message, title, scheduleType, datetime, cron, pushoverJson, aiPrompt, aiModel, aiSystemPrompt, useAi, editingTask, createMutation, updateMutation]);

  const setNow = useCallback(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setDatetime(localISOTime);
  }, []);

  const isFormValid = (message.trim() || aiPrompt.trim()) &&
    (scheduleType === 'once' ? datetime : cron.trim());

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {editingTask ? 'Edit Task' : 'Create Task'}
          </Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Use AI Generation</Text>
            <Switch
              value={useAi}
              onValueChange={setUseAi}
              trackColor={{ false: '#e5e7eb', true: '#ff5530' }}
            />
          </View>
        </View>

        {useAi ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>AI Prompt *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder="Ask AI to generate message content..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Static notification title"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>AI Model (optional)</Text>
              <TextInput
                style={styles.input}
                value={aiModel}
                onChangeText={setAiModel}
                placeholder="@cf/meta/llama-3.1-8b-instruct-fast"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>System Prompt (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={aiSystemPrompt}
                onChangeText={setAiSystemPrompt}
                placeholder="You are a helpful assistant..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Message *</Text>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Your notification message"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Short title"
                placeholderTextColor="#999"
              />
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Schedule Type</Text>
          <View style={styles.segmentControl}>
            <Pressable
              onPress={() => setScheduleType('once')}
              style={[styles.segment, scheduleType === 'once' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, scheduleType === 'once' && styles.segmentTextActive]}>
                Once
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScheduleType('repeat')}
              style={[styles.segment, scheduleType === 'repeat' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, scheduleType === 'repeat' && styles.segmentTextActive]}>
                Repeat
              </Text>
            </Pressable>
          </View>
        </View>

        {scheduleType === 'once' ? (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Run at</Text>
              <Pressable onPress={setNow}>
                <Text style={styles.nowButton}>Set to Now</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={datetime}
              onChangeText={setDatetime}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor="#999"
            />
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Cron Expression</Text>
              <Pressable 
                onPress={handleParseCron}
                disabled={isParsing || !cron.trim()}
              >
                {isParsing ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text style={styles.parseButton}>✨ Parse</Text>
                )}
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={cron}
              onChangeText={setCron}
              placeholder="e.g. 'Every Monday at 9am' or '0 9 * * *'"
              placeholderTextColor="#999"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Pushover Extras (JSON)</Text>
          <TextInput
            style={[styles.input, styles.textArea, styles.codeInput]}
            value={pushoverJson}
            onChangeText={setPushoverJson}
            placeholder={'{\n  "sound": "pushover"\n}'}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
            (!isFormValid || isSubmitting) && styles.buttonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {editingTask ? 'Update Task' : 'Create Task'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    padding: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nowButton: {
    fontSize: 13,
    color: '#ff5530',
    fontWeight: '600',
  },
  parseButton: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  codeInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#1f2937',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#ff5530',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ff5530',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
