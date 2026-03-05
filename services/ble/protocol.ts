export interface IMUData {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  euler: { roll: number; pitch: number; yaw: number };
}

export interface DecodeProtocolOptions {
  packetMode: 'auto' | 'csv' | 'json' | 'kv' | 'binary-int16' | 'lab2-33';
  csvHasTimestamp: boolean;
  binaryPayloadBytes: number;
  binaryHeaderHex?: string;
  binaryEndian: 'little' | 'big';
  accelScale: number;
  gyroScale: number;
  eulerScale: number;
}

// Utility conversion with NaN/Infinity guard for parsed text payload values.
function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Build canonical IMU sample shape from a flat 9-value array.
function toImuData(timestamp: number, values: number[]): IMUData {
  return {
    timestamp,
    accel: { x: values[0], y: values[1], z: values[2] },
    gyro: { x: values[3], y: values[4], z: values[5] },
    euler: { roll: values[6], pitch: values[7], yaw: values[8] },
  };
}

/**
 * Parse JSON object using either nested shape (`accel/gyro/euler`) or flat aliases.
 */
function fromFlatMap(timestamp: number, parsed: Record<string, unknown>): IMUData | null {
  const aliases: Record<string, string> = {
    accelX: 'ax',
    accelY: 'ay',
    accelZ: 'az',
    gyroX: 'gx',
    gyroY: 'gy',
    gyroZ: 'gz',
    roll: 'roll',
    pitch: 'pitch',
    yaw: 'yaw',
  };

  const read = (primary: string, alias: string) => {
    const value = parsed[primary] ?? parsed[alias];
    return value === undefined ? null : toNumber(value);
  };

  const values = [
    read('accelX', aliases.accelX),
    read('accelY', aliases.accelY),
    read('accelZ', aliases.accelZ),
    read('gyroX', aliases.gyroX),
    read('gyroY', aliases.gyroY),
    read('gyroZ', aliases.gyroZ),
    read('roll', aliases.roll),
    read('pitch', aliases.pitch),
    read('yaw', aliases.yaw),
  ];

  if (values.some((value) => value === null)) {
    return null;
  }

  return toImuData(timestamp, values as number[]);
}

// Decode JSON payload variant.
function decodeJsonPayload(trimmed: string, timestamp: number): IMUData | null {
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const accel = parsed.accel as Record<string, unknown> | undefined;
  const gyro = parsed.gyro as Record<string, unknown> | undefined;
  const euler = parsed.euler as Record<string, unknown> | undefined;

  if (accel && gyro && euler) {
    return {
      timestamp,
      accel: {
        x: toNumber(accel.x),
        y: toNumber(accel.y),
        z: toNumber(accel.z),
      },
      gyro: {
        x: toNumber(gyro.x),
        y: toNumber(gyro.y),
        z: toNumber(gyro.z),
      },
      euler: {
        roll: toNumber(euler.roll),
        pitch: toNumber(euler.pitch),
        yaw: toNumber(euler.yaw),
      },
    };
  }

  return fromFlatMap(timestamp, parsed);
}

// Decode CSV-like payload variant; optionally skips first timestamp column.
function decodeCsvPayload(trimmed: string, timestamp: number, csvHasTimestamp: boolean): IMUData | null {
  const tokens = trimmed
    .split(/[;,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const values = tokens.map((value) => Number(value));
  if (!values.every((value) => Number.isFinite(value))) {
    return null;
  }

  const startIndex = csvHasTimestamp && values.length >= 10 ? 1 : 0;
  if (values.length - startIndex < 9) {
    return null;
  }

  return toImuData(timestamp, values.slice(startIndex, startIndex + 9));
}

// Decode key/value text variant (e.g., ax=.., ay=.., gx=..).
function decodeKeyValuePayload(trimmed: string, timestamp: number): IMUData | null {
  const map: Record<string, number> = {};
  const normalized = trimmed.toLowerCase();
  const matches = normalized.matchAll(/([a-z_]+)\s*[:=]\s*(-?\d*\.?\d+)/g);

  for (const match of matches) {
    map[match[1]] = Number(match[2]);
  }

  const read = (...keys: string[]) => {
    for (const key of keys) {
      if (Number.isFinite(map[key])) {
        return map[key];
      }
    }
    return null;
  };

  const values = [
    read('ax', 'accelx', 'acc_x'),
    read('ay', 'accely', 'acc_y'),
    read('az', 'accelz', 'acc_z'),
    read('gx', 'gyrox', 'gyro_x'),
    read('gy', 'gyroy', 'gyro_y'),
    read('gz', 'gyroz', 'gyro_z'),
    read('roll'),
    read('pitch'),
    read('yaw'),
  ];

  if (values.some((value) => value === null)) {
    return null;
  }

  return toImuData(timestamp, values as number[]);
}

// Convert binary string payload into bytes for binary frame parsing.
function fromBytes(payload: string): Uint8Array {
  const bytes = new Uint8Array(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    bytes[index] = payload.charCodeAt(index) & 0xff;
  }

  return bytes;
}

// Read signed 16-bit integer at byte offset in configured endianness.
function readInt16(bytes: Uint8Array, offset: number, endian: 'little' | 'big'): number {
  const low = bytes[offset];
  const high = bytes[offset + 1];
  const raw = endian === 'little' ? (high << 8) | low : (low << 8) | high;
  return raw > 0x7fff ? raw - 0x10000 : raw;
}

// Parse optional header hex string (e.g., "AA AA AA") into bytes.
function headerBytes(hex?: string): Uint8Array {
  if (!hex) {
    return new Uint8Array(0);
  }

  const clean = hex.replace(/[^0-9a-f]/gi, '');
  if (clean.length % 2 !== 0 || clean.length === 0) {
    return new Uint8Array(0);
  }

  const result = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    result[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  }

  return result;
}

// Check whether header sequence matches at a given offset.
function isHeaderAt(buffer: Uint8Array, header: Uint8Array, offset: number): boolean {
  for (let index = 0; index < header.length; index += 1) {
    if (buffer[offset + index] !== header[index]) {
      return false;
    }
  }

  return true;
}

/**
 * Decode generic binary int16 frame.
 *
 * Layout expectation: 9 consecutive int16 values in order
 * [ax, ay, az, gx, gy, gz, roll, pitch, yaw].
 */
function decodeBinaryFrame(
  frame: Uint8Array,
  timestamp: number,
  options: DecodeProtocolOptions,
): IMUData | null {
  if (frame.length < 18) {
    return null;
  }

  const values = Array.from({ length: 9 }, (_, index) =>
    readInt16(frame, index * 2, options.binaryEndian),
  );

  return {
    timestamp,
    accel: {
      x: values[0] * options.accelScale,
      y: values[1] * options.accelScale,
      z: values[2] * options.accelScale,
    },
    gyro: {
      x: values[3] * options.gyroScale,
      y: values[4] * options.gyroScale,
      z: values[5] * options.gyroScale,
    },
    euler: {
      roll: values[6] * options.eulerScale,
      pitch: values[7] * options.eulerScale,
      yaw: values[8] * options.eulerScale,
    },
  };
}

// IEEE-754 half float (float16) to JS number conversion.
function halfToFloat(value: number): number {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const fraction = value & 0x03ff;

  if (exponent === 0) {
    if (fraction === 0) {
      return sign * 0;
    }

    return sign * 2 ** -14 * (fraction / 1024);
  }

  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }

  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

// Bound a value into [minValue, maxValue].
function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

/**
 * Convert quaternion vector part (qx, qy, qz) to Euler angles in degrees.
 * qw is reconstructed from unit-norm constraint.
 */
function quaternionToEulerDegrees(qx: number, qy: number, qz: number) {
  const qwSquared = 1 - (qx * qx + qy * qy + qz * qz);
  const qw = Math.sqrt(Math.max(0, qwSquared));

  const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
  const sinPitch = clamp(2 * (qw * qy - qz * qx), -1, 1);
  const pitch = Math.asin(sinPitch);
  const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));

  const radToDeg = 180 / Math.PI;
  return {
    roll: roll * radToDeg,
    pitch: pitch * radToDeg,
    yaw: yaw * radToDeg,
  };
}

/**
 * Decode Lab2 firmware packet format (fixed 33 bytes).
 *
 * Byte layout:
 * - [0..2]   header: AA AA AA
 * - [3..6]   packet counter (unused by app)
 * - [7..14]  timestamp uint64 (microseconds)
 * - [15..20] accel int16 x/y/z
 * - [21..26] gyro int16 x/y/z
 * - [27..32] quaternion half-floats qx/qy/qz
 *
 * Output workflow:
 * 1) Validate header + frame length
 * 2) Parse fields by offset and endian
 * 3) Convert timestamp µs -> ms
 * 4) Convert quaternion -> Euler
 * 5) Apply configured accel/gyro/euler scale factors
 */
function decodeLab2Packet(
  frame: Uint8Array,
  fallbackTimestamp: number,
  options: DecodeProtocolOptions,
): IMUData | null {
  const expectedLength = 33;
  if (frame.length < expectedLength) {
    return null;
  }

  if (frame[0] !== 0xaa || frame[1] !== 0xaa || frame[2] !== 0xaa) {
    return null;
  }

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const packetTimestampRaw = view.getBigUint64(7, options.binaryEndian === 'little');

  const safePacketTimestamp =
    packetTimestampRaw <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(packetTimestampRaw)
      : fallbackTimestamp;

  const normalizedTimestamp = Math.floor(safePacketTimestamp / 1000);

  const accelRaw = [
    readInt16(frame, 15, options.binaryEndian),
    readInt16(frame, 17, options.binaryEndian),
    readInt16(frame, 19, options.binaryEndian),
  ];

  const gyroRaw = [
    readInt16(frame, 21, options.binaryEndian),
    readInt16(frame, 23, options.binaryEndian),
    readInt16(frame, 25, options.binaryEndian),
  ];

  const qx = halfToFloat(view.getUint16(27, options.binaryEndian === 'little'));
  const qy = halfToFloat(view.getUint16(29, options.binaryEndian === 'little'));
  const qz = halfToFloat(view.getUint16(31, options.binaryEndian === 'little'));
  const euler = quaternionToEulerDegrees(qx, qy, qz);

  return {
    timestamp: normalizedTimestamp,
    accel: {
      x: accelRaw[0] * options.accelScale,
      y: accelRaw[1] * options.accelScale,
      z: accelRaw[2] * options.accelScale,
    },
    gyro: {
      x: gyroRaw[0] * options.gyroScale,
      y: gyroRaw[1] * options.gyroScale,
      z: gyroRaw[2] * options.gyroScale,
    },
    euler: {
      roll: euler.roll * options.eulerScale,
      pitch: euler.pitch * options.eulerScale,
      yaw: euler.yaw * options.eulerScale,
    },
  };
}

// Dispatch text payload decode according to configured packet mode.
function decodeTextPayload(trimmed: string, timestamp: number, options: DecodeProtocolOptions): IMUData | null {
  if (options.packetMode === 'json') {
    return decodeJsonPayload(trimmed, timestamp);
  }

  if (options.packetMode === 'csv') {
    return decodeCsvPayload(trimmed, timestamp, options.csvHasTimestamp);
  }

  if (options.packetMode === 'kv') {
    return decodeKeyValuePayload(trimmed, timestamp);
  }

  if (options.packetMode === 'auto') {
    try {
      const jsonValue = decodeJsonPayload(trimmed, timestamp);
      if (jsonValue) {
        return jsonValue;
      }
    } catch {
      // Intentionally continue to fallback formats.
    }

    const keyValue = decodeKeyValuePayload(trimmed, timestamp);
    if (keyValue) {
      return keyValue;
    }

    return decodeCsvPayload(trimmed, timestamp, options.csvHasTimestamp);
  }

  return null;
}

/**
 * Main decode entrypoint used by BLE client.
 *
 * Supports text and binary protocols, with optional header search for binary
 * modes. Returns `null` for invalid/incomplete payloads.
 */
export function decodeImuPayload(
  payload: string,
  timestamp: number,
  options: DecodeProtocolOptions,
): IMUData | null {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }

  if (options.packetMode === 'binary-int16' || options.packetMode === 'lab2-33') {
    const bytes = fromBytes(payload);
    const header = headerBytes(options.binaryHeaderHex);
    const payloadBytes = options.packetMode === 'lab2-33' ? 33 : Math.max(18, options.binaryPayloadBytes);

    if (header.length > 0) {
      const maxOffset =
        options.packetMode === 'lab2-33'
          ? bytes.length - payloadBytes
          : bytes.length - header.length - payloadBytes;

      for (let offset = 0; offset <= maxOffset; offset += 1) {
        if (isHeaderAt(bytes, header, offset)) {
          const start = options.packetMode === 'lab2-33' ? offset : offset + header.length;
          const frame = bytes.slice(start, start + payloadBytes);
          return options.packetMode === 'lab2-33'
            ? decodeLab2Packet(frame, timestamp, options)
            : decodeBinaryFrame(frame, timestamp, options);
        }
      }

      return null;
    }

    if (bytes.length < payloadBytes) {
      return null;
    }

    const frame = bytes.slice(0, payloadBytes);
    return options.packetMode === 'lab2-33'
      ? decodeLab2Packet(frame, timestamp, options)
      : decodeBinaryFrame(frame, timestamp, options);
  }

  return decodeTextPayload(trimmed, timestamp, options);
}
