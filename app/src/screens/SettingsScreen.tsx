import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDefaultExtras, setDefaultExtras } from '../api';
import type { Settings } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [defaultAiModel, setDefaultAiModel] = useState('');
  const [defaultAiSystemPrompt, setDefaultAiSystemPrompt] = useState('');
  const [defaultCron, setDefaultCron] = useState('');
  const [defaultExtrasText, setDefaultExtrasText] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['defaultExtras'],
    queryFn: getDefaultExtras,
  });

  useEffect(() => {
    if (settings) {
      setDefaultAiModel(settings.defaultAiModel || '');
      setDefaultAiSystemPrompt(settings.defaultAiSystemPrompt || '');
      setDefaultCron(settings.defaultCron || '');
      setDefaultExtrasText(settings.defaultExtras ? JSON.stringify(settings.defaultExtras, null, 2) : '');
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (newSettings: Settings) => setDefaultExtras(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defaultExtras'] });
      Alert.alert('Success', 'Settings saved successfully');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save settings');
    },
  });

  const handleSave = () => {
    try {
      const parsedExtras = defaultExtrasText.trim() ? JSON.parse(defaultExtrasText) : {};
      const newSettings: Settings = {
        defaultExtras: parsedExtras,
        defaultAiModel: defaultAiModel.trim() || undefined,
        defaultAiSystemPrompt: defaultAiSystemPrompt.trim() || undefined,
        defaultCron: defaultCron.trim() || undefined,
      };
      mutation.mutate(newSettings);
    } catch {
      Alert.alert('Error', 'Invalid JSON in Pushover Extras');
    }
  };

  const addExampleParams = () => {
    try {
      const current = defaultExtrasText.trim() ? JSON.parse(defaultExtrasText) : {};
      const updated = { ...current, priority: 1, sound: 'alien' };
      setDefaultExtrasText(JSON.stringify(updated, null, 2));
    } catch {
      setDefaultExtrasText(JSON.stringify({ priority: 1, sound: 'alien' }, null, 2));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff5530" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Generation Defaults</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Default AI Model</Text>
          <TextInput
            style={styles.input}
            value={defaultAiModel}
            onChangeText={setDefaultAiModel}
            placeholder="@cf/meta/llama-3.1-8b-instruct-fast"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Default System Prompt</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={defaultAiSystemPrompt}
            onChangeText={setDefaultAiSystemPrompt}
            placeholder="You are a helpful assistant..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Default Cron Schedule</Text>
          <TextInput
            style={styles.input}
            value={defaultCron}
            onChangeText={setDefaultCron}
            placeholder="0 9 * * *"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pushover Extras</Text>
          <Pressable onPress={addExampleParams}>
            <Text style={styles.addExample}>+ Add Example</Text>
          </Pressable>
        </View>
        
        <Text style={styles.description}>
          These JSON parameters will be merged into every new notification by default.
        </Text>

        <TextInput
          style={[styles.input, styles.textArea, styles.codeInput]}
          value={defaultExtrasText}
          onChangeText={setDefaultExtrasText}
          placeholder={'{\n  "sound": "pushover"\n}'}
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
        />

        <View style={styles.reference}>
          <Text style={styles.referenceTitle}>Quick Reference</Text>
          <View style={styles.referenceGrid}>
            <View style={styles.referenceItem}>
              <Text style={styles.referenceKey}>priority</Text>
              <Text style={styles.referenceValue}>-2 to 2</Text>
            </View>
            <View style={styles.referenceItem}>
              <Text style={styles.referenceKey}>sound</Text>
              <Text style={styles.referenceValue}>tone name</Text>
            </View>
            <View style={styles.referenceItem}>
              <Text style={styles.referenceKey}>device</Text>
              <Text style={styles.referenceValue}>target device</Text>
            </View>
            <View style={styles.referenceItem}>
              <Text style={styles.referenceKey}>html</Text>
              <Text style={styles.referenceValue}>1 (enable)</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={handleSave}
        disabled={mutation.isPending}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.buttonPressed,
          mutation.isPending && styles.buttonDisabled,
        ]}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Settings</Text>
        )}
      </Pressable>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addExample: {
    fontSize: 13,
    color: '#ff5530',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  reference: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  referenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  referenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  referenceItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingRight: 12,
  },
  referenceKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  referenceValue: {
    fontSize: 13,
    color: '#9ca3af',
  },
  saveButton: {
    backgroundColor: '#ff5530',
    borderRadius: 12,
    paddingVertical: 16,
    margin: 20,
    alignItems: 'center',
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
