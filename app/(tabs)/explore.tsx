import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/AppContext';

export default function LiveScreen() {
  const {
    connectionStatus,
    connectedDevice,
    currentIMUData,
    isRecording,
    sampleRate,
    startRecording,
    stopRecording,
  } = useApp();

  const isConnected = connectionStatus === 'connected';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Data Stream</Text>
        <Text style={styles.headerSubtitle}>
          {isConnected ? connectedDevice?.name : 'No device connected'}
        </Text>
        {isConnected ? <Text style={styles.sampleRate}>{sampleRate} Hz</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isConnected ? (
          <Text style={styles.placeholder}>Connect to a device to view live data.</Text>
        ) : (
          <>
            <SensorSection
              title="Acceleration (m/s²)"
              color="#3b82f6"
              labels={['X', 'Y', 'Z']}
              values={[
                currentIMUData.accel.x.toFixed(3),
                currentIMUData.accel.y.toFixed(3),
                currentIMUData.accel.z.toFixed(3),
              ]}
            />

            <SensorSection
              title="Gyroscope (°/s)"
              color="#a855f7"
              labels={['X', 'Y', 'Z']}
              values={[
                currentIMUData.gyro.x.toFixed(2),
                currentIMUData.gyro.y.toFixed(2),
                currentIMUData.gyro.z.toFixed(2),
              ]}
            />

            <SensorSection
              title="Euler Angles (°)"
              color="#f97316"
              labels={['Roll', 'Pitch', 'Yaw']}
              values={[
                currentIMUData.euler.roll.toFixed(1),
                currentIMUData.euler.pitch.toFixed(1),
                currentIMUData.euler.yaw.toFixed(1),
              ]}
            />

            <View style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Recording</Text>
                {isRecording ? <Text style={styles.recordIndicator}>REC</Text> : null}
              </View>
              <Pressable
                style={[styles.recordButton, isRecording ? styles.stopButton : styles.startButton]}
                onPress={() => void (isRecording ? stopRecording() : startRecording())}>
                <Text style={styles.recordButtonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SensorSection({
  title,
  color,
  labels,
  values,
}: {
  title: string;
  color: string;
  labels: [string, string, string];
  values: [string, string, string];
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={styles.metricRow}>
        {labels.map((label, index) => (
          <View key={label} style={styles.metricCell}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{values[index]}</Text>
          </View>
        ))}
      </View>
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
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 13,
  },
  sampleRate: {
    marginTop: 4,
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  placeholder: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCell: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    padding: 10,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  metricValue: {
    color: '#f8fafc',
    marginTop: 3,
    fontSize: 16,
    fontWeight: '700',
  },
  recordCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  recordIndicator: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 12,
  },
  recordButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#2563eb',
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  recordButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
});
