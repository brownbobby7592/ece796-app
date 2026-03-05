import Constants from 'expo-constants';

export type BlePacketMode = 'auto' | 'csv' | 'json' | 'kv' | 'binary-int16' | 'lab2-33';

interface BleConfig {
  serviceUuid: string;
  dataCharacteristicUuid: string;
  controlCharacteristicUuid?: string;
  protocol?: Partial<BleProtocolConfig>;
  commandStart?: string;
  commandStop?: string;
}

export interface BleProtocolConfig {
  packetMode: BlePacketMode;
  textDelimiter: string;
  csvHasTimestamp: boolean;
  binaryPayloadBytes: number;
  binaryHeaderHex?: string;
  binaryEndian: 'little' | 'big';
  accelScale: number;
  gyroScale: number;
  eulerScale: number;
}

const fallbackProtocolConfig: BleProtocolConfig = {
  packetMode: 'auto',
  textDelimiter: '\n',
  csvHasTimestamp: false,
  binaryPayloadBytes: 18,
  binaryHeaderHex: undefined,
  binaryEndian: 'little',
  accelScale: 1,
  gyroScale: 1,
  eulerScale: 1,
};

const fallbackConfig: BleConfig = {
  serviceUuid: '00000000-0000-0000-0000-000000000000',
  dataCharacteristicUuid: '00000000-0000-0000-0000-000000000001',
  controlCharacteristicUuid: '00000000-0000-0000-0000-000000000002',
};

export function getBleConfig(): BleConfig {
  const extra = Constants.expoConfig?.extra as { ble?: Partial<BleConfig> } | undefined;

  return {
    serviceUuid: extra?.ble?.serviceUuid ?? fallbackConfig.serviceUuid,
    dataCharacteristicUuid:
      extra?.ble?.dataCharacteristicUuid ?? fallbackConfig.dataCharacteristicUuid,
    controlCharacteristicUuid:
      extra?.ble?.controlCharacteristicUuid ?? fallbackConfig.controlCharacteristicUuid,
    protocol: extra?.ble?.protocol,
    commandStart: extra?.ble?.commandStart,
    commandStop: extra?.ble?.commandStop,
  };
}

export function getBleProtocolConfig(): BleProtocolConfig {
  const config = getBleConfig();
  const protocol = config.protocol;

  return {
    packetMode: protocol?.packetMode ?? fallbackProtocolConfig.packetMode,
    textDelimiter: protocol?.textDelimiter ?? fallbackProtocolConfig.textDelimiter,
    csvHasTimestamp: protocol?.csvHasTimestamp ?? fallbackProtocolConfig.csvHasTimestamp,
    binaryPayloadBytes: protocol?.binaryPayloadBytes ?? fallbackProtocolConfig.binaryPayloadBytes,
    binaryHeaderHex: protocol?.binaryHeaderHex ?? fallbackProtocolConfig.binaryHeaderHex,
    binaryEndian: protocol?.binaryEndian ?? fallbackProtocolConfig.binaryEndian,
    accelScale: protocol?.accelScale ?? fallbackProtocolConfig.accelScale,
    gyroScale: protocol?.gyroScale ?? fallbackProtocolConfig.gyroScale,
    eulerScale: protocol?.eulerScale ?? fallbackProtocolConfig.eulerScale,
  };
}

export function hasConfiguredBleUuids(config: BleConfig): boolean {
  const isPlaceholder = (value: string | undefined) =>
    !value || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);

  return !isPlaceholder(config.serviceUuid) && !isPlaceholder(config.dataCharacteristicUuid);
}
