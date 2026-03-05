import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/AppContext';

function getSignalBars(rssi: number): number {
  if (rssi > -50) return 4;
  if (rssi > -60) return 3;
  if (rssi > -70) return 2;
  return 1;
}

export default function ScanScreen() {
  const {
    connectionStatus,
    connectedDevice,
    scannedDevices,
    isScanning,
    errorMessage,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
  } = useApp();

  const statusText =
    connectionStatus === 'connected'
      ? `Connected to ${connectedDevice?.name ?? 'device'}`
      : connectionStatus === 'connecting'
        ? `Connecting to ${connectedDevice?.name ?? 'device'}...`
        : 'Disconnected';

  const statusColor =
    connectionStatus === 'connected'
      ? '#16a34a'
      : connectionStatus === 'connecting'
        ? '#eab308'
        : '#64748b';

  const shouldShowOpenSettings =
    !!errorMessage &&
    /(permission|bluetooth|nearby devices|settings)/i.test(errorMessage);

  const shouldShowBluetoothSettings =
    !!errorMessage && /(bluetooth is turned off|bluetooth is not ready|bluetooth)/i.test(errorMessage);

  const openAppSettings = () => {
    void Linking.openSettings();
  };

  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      void Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
      return;
    }

    void Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBanner}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        {connectionStatus === 'connected' && (
          <Pressable style={styles.disconnectButton} onPress={() => void disconnect()}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Scan for Devices</Text>
        <Text style={styles.subtitle}>Discover nearby IMU sensors</Text>

        <View style={styles.scanActions}>
          <Pressable
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={() => void startScan()}
            disabled={isScanning}>
            <Text style={styles.scanButtonText}>{isScanning ? 'Scanning...' : 'Start Scan'}</Text>
          </Pressable>
          {isScanning && (
            <Pressable style={styles.stopButton} onPress={stopScan}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </Pressable>
          )}
        </View>

        {errorMessage ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            {shouldShowOpenSettings ? (
              <Pressable style={styles.settingsButton} onPress={openAppSettings}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </Pressable>
            ) : null}
            {shouldShowBluetoothSettings ? (
              <Pressable style={styles.settingsButton} onPress={openBluetoothSettings}>
                <Text style={styles.settingsButtonText}>Bluetooth Settings</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {scannedDevices.length === 0 && !isScanning ? (
          <Text style={styles.placeholder}>No devices found. Tap Start Scan to begin.</Text>
        ) : (
          scannedDevices.map((device) => {
            const isConnectedDevice = connectedDevice?.id === device.id;
            const signalBars = getSignalBars(device.rssi);

            return (
              <View key={device.id} style={[styles.deviceCard, isConnectedDevice && styles.deviceCardActive]}>
                <View style={styles.deviceRow}>
                  <View>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceMeta}>{device.mac}</Text>
                    <Text style={styles.deviceMeta}>RSSI: {device.rssi} dBm</Text>
                  </View>
                  <View style={styles.signalRow}>
                    {[0, 1, 2, 3].map((index) => (
                      <View
                        key={index}
                        style={[
                          styles.signalBar,
                          { height: 5 + index * 5 },
                          index < signalBars ? styles.signalBarOn : styles.signalBarOff,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <Pressable
                  style={[styles.connectButton, isConnectedDevice && styles.connectButtonActive]}
                  onPress={() => void connectToDevice(device)}
                  disabled={connectionStatus === 'connecting' || isConnectedDevice}>
                  <Text style={styles.connectText}>{isConnectedDevice ? 'Connected' : 'Connect'}</Text>
                </Pressable>
              </View>
            );
          })
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
  statusBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#b91c1c',
  },
  disconnectButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  scanActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  stopButton: {
    borderRadius: 10,
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  stopButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  errorBlock: {
    gap: 8,
  },
  settingsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  settingsButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  placeholder: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 80,
  },
  deviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    padding: 12,
    gap: 10,
  },
  deviceCardActive: {
    borderColor: '#2563eb',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  deviceMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 24,
  },
  signalBar: {
    width: 4,
    borderRadius: 99,
  },
  signalBarOn: {
    backgroundColor: '#3b82f6',
  },
  signalBarOff: {
    backgroundColor: '#334155',
  },
  connectButton: {
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  connectButtonActive: {
    backgroundColor: '#16a34a',
  },
  connectText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
  },
});
