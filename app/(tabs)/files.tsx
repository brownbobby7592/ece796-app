import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/AppContext';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export default function FilesScreen() {
  const { sessions, deleteSession, exportSession } = useApp();

  const totalSize = sessions.reduce((sum, session) => sum + session.fileSize, 0);
  const totalSamples = sessions.reduce((sum, session) => sum + session.samples, 0);

  const onExport = async (id: string) => {
    try {
      await exportSession(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export session';
      Alert.alert('Export failed', message);
    }
  };

  const onDelete = (id: string) => {
    Alert.alert('Delete Session', 'Remove this recorded session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recorded Sessions</Text>
        <View style={styles.storageCard}>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Storage</Text>
            <Text style={styles.storageValue}>{totalSize.toFixed(1)} MB / 100 MB</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: `${Math.min(100, totalSize)}%` }]} />
          </View>
          <Text style={styles.storageMeta}>
            {sessions.length} sessions • {totalSamples.toLocaleString()} samples
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>No recorded sessions. Start recording from the Live tab.</Text>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <Text style={styles.sessionTitle}>Session {session.id}</Text>
                <Text style={styles.sessionSize}>{session.fileSize.toFixed(1)} MB</Text>
              </View>
              <Text style={styles.sessionTimestamp}>{session.timestamp}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>{formatDuration(session.duration)}</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>Rate</Text>
                  <Text style={styles.statValue}>{session.sampleRate} Hz</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>Samples</Text>
                  <Text style={styles.statValue}>{session.samples.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable style={styles.exportButton} onPress={() => onExport(session.id)}>
                  <Text style={styles.exportText}>Export CSV</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => onDelete(session.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 10,
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  storageCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storageLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  storageValue: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
  },
  progressValue: {
    height: 8,
    backgroundColor: '#3b82f6',
  },
  storageMeta: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 11,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  empty: {
    marginTop: 80,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
  },
  sessionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionSize: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sessionTimestamp: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 10,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  exportButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  exportText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    borderRadius: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
});
