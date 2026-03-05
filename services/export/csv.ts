import * as FileSystem from 'expo-file-system/legacy';

import type { IMUData } from '@/services/ble/protocol';

export interface RecordedSession {
  id: string;
  timestamp: string;
  duration: number;
  sampleRate: number;
  fileSize: number;
  samples: number;
  records: IMUData[];
}

/**
 * Convert one recorded session into CSV rows.
 *
 * Output columns are aligned to Live/Plots metrics so exported datasets can be
 * analyzed directly in Python/Excel/MATLAB.
 */
function rowsForSession(session: RecordedSession): string[] {
  const header = 'timestamp,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,roll,pitch,yaw';
  const rows = session.records.map((entry) =>
    [
      entry.timestamp,
      entry.accel.x,
      entry.accel.y,
      entry.accel.z,
      entry.gyro.x,
      entry.gyro.y,
      entry.gyro.z,
      entry.euler.roll,
      entry.euler.pitch,
      entry.euler.yaw,
    ].join(','),
  );

  return [header, ...rows];
}

// Build final CSV string payload (header + all rows).
export function buildSessionCsv(session: RecordedSession): string {
  return rowsForSession(session).join('\n');
}

/**
 * Persist session CSV in app cache and invoke platform share sheet when possible.
 *
 * Returns file URI regardless of sharing availability, so caller can still use
 * the exported path in restricted runtimes.
 */
export async function exportSessionCsv(session: RecordedSession): Promise<string> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error('Cache directory unavailable on this device');
  }

  const fileName = `imu_session_${session.id}.csv`;
  const fileUri = `${directory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, buildSessionCsv(session), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    // Lazy import keeps runtime resilient where expo-sharing is unavailable.
    const Sharing = await import('expo-sharing');
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: `Export ${fileName}`,
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch {
    // Share sheet unavailable in current runtime; keep CSV file on disk.
  }

  return fileUri;
}
