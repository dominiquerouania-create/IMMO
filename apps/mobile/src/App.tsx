import { CLOSED_STATUSES, PRIORITY_LABELS, rankTasks, DEFAULT_CATEGORIES } from '@kairos/core';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from './store';

const palette = {
  light: { bg: '#F6F8FB', surface: '#FFFFFF', text: '#0F172A', text2: '#475569', border: '#E2E8F0', primary: '#1D4ED8', critical: '#B91C1C' },
  dark: { bg: '#0B1120', surface: '#111827', text: '#F1F5F9', text2: '#CBD5E1', border: '#1F2A3D', primary: '#3B82F6', critical: '#F87171' },
};

export default function App() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = palette[scheme];
  const { tasks, plan, quickAdd, toggleDone, replan, sync } = useStore();
  const [text, setText] = useState('');

  useEffect(() => {
    replan();
    void sync();
    const t = setInterval(() => void sync(), 60_000);
    return () => clearInterval(t);
  }, [replan, sync]);

  const ranked = useMemo(() => rankTasks(tasks.filter((t) => !CLOSED_STATUSES.includes(t.status)), new Date(), DEFAULT_CATEGORIES), [tasks]);
  const today = plan?.blocks.filter((b) => new Date(b.start).toDateString() === new Date().toDateString()) ?? [];

  const submit = () => {
    if (!text.trim()) return;
    const t = quickAdd(text.trim());
    Speech.speak(`Tâche ajoutée : ${t.title}`, { language: 'fr-FR' });
    setText('');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Text style={[styles.h1, { color: c.text }]}>Aujourd'hui</Text>
        <Text style={{ color: c.text2, marginBottom: 12 }}>
          {today.filter((b) => b.kind === 'TASK_BLOCK').length} sessions planifiées · {plan?.atRisk.length ?? 0} à risque
        </Text>

        <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="Appeler la banque demain 10h #sci !urgent"
            placeholderTextColor={c.text2}
            style={{ flex: 1, color: c.text, fontSize: 15 }}
            returnKeyType="done"
          />
          <Pressable onPress={submit} style={[styles.add, { backgroundColor: c.primary }]} accessibilityLabel="Ajouter">
            <Text style={{ color: '#fff', fontSize: 20 }}>+</Text>
          </Pressable>
        </View>

        <FlatList
          data={ranked}
          keyExtractor={(r) => r.task.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={{ color: c.text2, textAlign: 'center', marginTop: 40 }}>Aucune tâche. Ajoutez-en une ci-dessus.</Text>}
          renderItem={({ item: { task, breakdown } }) => {
            const cat = DEFAULT_CATEGORIES.find((x) => x.id === task.categoryId);
            return (
              <Pressable onPress={() => toggleDone(task.id)} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={[styles.dot, { backgroundColor: cat?.color ?? c.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{task.title}</Text>
                  <Text style={{ color: breakdown.overdue ? c.critical : c.text2, fontSize: 12, marginTop: 2 }}>
                    {cat?.name} · {PRIORITY_LABELS[task.priority]}
                    {task.scheduledStart ? ` · ${new Date(task.scheduledStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                </View>
                <Text style={{ color: c.text2, fontSize: 12 }}>{breakdown.score}</Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  h1: { fontSize: 28, fontWeight: '700', marginTop: 12 },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 6, height: 52, marginBottom: 14 },
  add: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
