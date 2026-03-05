import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { useApp } from '@/context/AppContext';

type TimeRange = 10 | 30 | 60;

const ACCEL_DOMAIN: [number, number] = [-20, 20];
const GYRO_DOMAIN: [number, number] = [-250.11, 250.11];
const EULER_DOMAIN: [number, number] = [-180, 180];
const ORIENTATION_PLATE_SIZE = 56;
const ORIENTATION_PLATE_DEPTH = 10;

export default function PlotsScreen() {
  const { connectionStatus, imuHistory, currentIMUData } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>(10);
  const [isPaused, setIsPaused] = useState(false);
  const [useSmoothing, setUseSmoothing] = useState(true);
  const [useFixedScale, setUseFixedScale] = useState(true);
  const { width } = useWindowDimensions();

  const isConnected = connectionStatus === 'connected';

  const filteredData = useMemo(() => {
    if (!isConnected || isPaused) {
      return imuHistory;
    }

    const cutoff = Date.now() - timeRange * 1000;
    return imuHistory.filter((entry) => entry.timestamp >= cutoff);
  }, [imuHistory, isConnected, isPaused, timeRange]);

  const chartData = useMemo(
    () =>
      filteredData.map((entry, index) => ({
        x: index,
        accelX: entry.accel.x,
        accelY: entry.accel.y,
        accelZ: entry.accel.z,
        gyroX: entry.gyro.x,
        gyroY: entry.gyro.y,
        gyroZ: entry.gyro.z,
        roll: entry.euler.roll,
        pitch: entry.euler.pitch,
        yaw: entry.euler.yaw,
      })),
    [filteredData],
  );

  const chartWidth = Math.max(320, width - 32);
  const chartHeight = 180;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Plots</Text>
        <View style={styles.controlsRow}>
          <View style={styles.rangeRow}>
            {[10, 30, 60].map((range) => (
              <Pressable
                key={range}
                onPress={() => setTimeRange(range as TimeRange)}
                style={[styles.rangeButton, timeRange === range && styles.rangeButtonActive]}>
                <Text style={[styles.rangeText, timeRange === range && styles.rangeTextActive]}>{range}s</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setIsPaused((previous) => !previous)}
            disabled={!isConnected}
            style={[styles.pauseButton, !isConnected && styles.buttonDisabled]}>
            <Text style={styles.pauseText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
        </View>
        <View style={styles.modeRow}>
          <View style={styles.modeGroup}>
            <Pressable
              onPress={() => setUseSmoothing(false)}
              style={[styles.modeButton, !useSmoothing && styles.modeButtonActive]}>
              <Text style={[styles.modeText, !useSmoothing && styles.modeTextActive]}>Raw</Text>
            </Pressable>
            <Pressable
              onPress={() => setUseSmoothing(true)}
              style={[styles.modeButton, useSmoothing && styles.modeButtonActive]}>
              <Text style={[styles.modeText, useSmoothing && styles.modeTextActive]}>Smoothed</Text>
            </Pressable>
          </View>
          <View style={styles.modeGroup}>
            <Pressable
              onPress={() => setUseFixedScale(false)}
              style={[styles.modeButton, !useFixedScale && styles.modeButtonActive]}>
              <Text style={[styles.modeText, !useFixedScale && styles.modeTextActive]}>Auto Scale</Text>
            </Pressable>
            <Pressable
              onPress={() => setUseFixedScale(true)}
              style={[styles.modeButton, useFixedScale && styles.modeButtonActive]}>
              <Text style={[styles.modeText, useFixedScale && styles.modeTextActive]}>Fixed Scale</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isConnected ? (
          <Text style={styles.placeholder}>Connect to a device to view plots</Text>
        ) : chartData.length === 0 ? (
          <Text style={styles.placeholder}>Waiting for data...</Text>
        ) : (
          <>
            <PlotCard title="IMU Orientation Preview">
              <OrientationPreview
                roll={currentIMUData.euler.roll}
                pitch={currentIMUData.euler.pitch}
                yaw={currentIMUData.euler.yaw}
              />
            </PlotCard>

            <PlotCard title="Acceleration (m/s²)">
              <LinePlot
                width={chartWidth}
                height={chartHeight}
                data={chartData}
                keys={['accelX', 'accelY', 'accelZ']}
                colors={['#3b82f6', '#60a5fa', '#93c5fd']}
                labels={['X', 'Y', 'Z']}
                yDomain={useFixedScale ? ACCEL_DOMAIN : undefined}
                smoothingWindow={useSmoothing ? 5 : 1}
                yAxisLabel="Y (m/s²)"
                xAxisLabel={`X (time window: ${timeRange}s)`}
              />
            </PlotCard>

            <PlotCard title="Gyroscope (°/s)">
              <LinePlot
                width={chartWidth}
                height={chartHeight}
                data={chartData}
                keys={['gyroX', 'gyroY', 'gyroZ']}
                colors={['#a855f7', '#c084fc', '#d8b4fe']}
                labels={['X', 'Y', 'Z']}
                yDomain={useFixedScale ? GYRO_DOMAIN : undefined}
                smoothingWindow={useSmoothing ? 5 : 1}
                yAxisLabel="Y (°/s)"
                xAxisLabel={`X (time window: ${timeRange}s)`}
                showLiveExtrema
              />
            </PlotCard>

            <PlotCard title="Euler Angles (°)">
              <LinePlot
                width={chartWidth}
                height={chartHeight}
                data={chartData}
                keys={['roll', 'pitch', 'yaw']}
                colors={['#f97316', '#fb923c', '#fdba74']}
                labels={['Roll', 'Pitch', 'Yaw']}
                yDomain={useFixedScale ? EULER_DOMAIN : undefined}
                smoothingWindow={useSmoothing ? 3 : 1}
                yAxisLabel="Y (°)"
                xAxisLabel={`X (time window: ${timeRange}s)`}
              />
            </PlotCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PlotCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.plotCard}>
      <Text style={styles.plotTitle}>{title}</Text>
      {children}
    </View>
  );
}

function movingAverage(values: number[], windowSize: number): number[] {
  const normalizedValues = values.map((value) => safeNumber(value, 0));

  if (windowSize <= 1 || values.length < 3) {
    return normalizedValues;
  }

  const halfWindow = Math.floor(windowSize / 2);
  return normalizedValues.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(normalizedValues.length - 1, index + halfWindow);
    let sum = 0;
    let count = 0;

    for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
      sum += normalizedValues[sampleIndex];
      count += 1;
    }

    return count > 0 ? sum / count : normalizedValues[index];
  });
}

function toPolylinePoints(
  values: number[],
  width: number,
  height: number,
  yDomain?: [number, number],
): string {
  const normalizedValues = values.map((value) => safeNumber(value, 0));

  if (normalizedValues.length < 2) {
    return '';
  }

  const minValue = yDomain ? safeNumber(yDomain[0], -1) : Math.min(...normalizedValues);
  const maxValue = yDomain ? safeNumber(yDomain[1], 1) : Math.max(...normalizedValues);
  const range = maxValue - minValue || 1;
  const yPadding = 8;
  const drawableHeight = Math.max(1, height - yPadding * 2);

  return normalizedValues
    .map((value, index) => {
      const x = (index / (normalizedValues.length - 1)) * width;
      const clamped = Math.min(maxValue, Math.max(minValue, value));
      const y = yPadding + (1 - (clamped - minValue) / range) * drawableHeight;
      return `${x},${y}`;
    })
    .join(' ');
}

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampValue(value: number, minValue: number, maxValue: number): number {
  const normalized = safeNumber(value, 0);
  return Math.min(maxValue, Math.max(minValue, normalized));
}

function OrientationPreview({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const safeRoll = clampValue(roll, -85, 85);
  const safePitch = clampValue(pitch, -85, 85);
  const safeYaw = clampValue(yaw, -180, 180);
  const floatOffsetY = clampValue((Math.abs(safeRoll) + Math.abs(safePitch)) * 0.12, 0, 12);

  return (
    <View style={styles.orientationContainer}>
      <View style={styles.orientationFrame}>
        <View style={styles.orientationCrossHorizontal} />
        <View style={styles.orientationCrossVertical} />
        <View style={styles.orientationGroundShadow} />
        <View
          style={[
            styles.orientationBody,
            {
              transform: [
                { translateY: -floatOffsetY },
                { perspective: 650 },
                { rotateX: `${-safePitch.toFixed(1)}deg` },
                { rotateY: `${safeRoll.toFixed(1)}deg` },
                { rotateZ: `${safeYaw.toFixed(1)}deg` },
              ],
            },
          ]}
        >
          <View style={styles.orientationTopFace} />
          <View style={styles.orientationFrontFace} />
          <View style={styles.orientationBackFace} />
          <View style={styles.orientationLeftFace} />
          <View style={styles.orientationRightFace} />
        </View>
      </View>
      <View style={styles.orientationReadoutRow}>
        <Text style={styles.orientationReadout}>Roll {safeRoll.toFixed(1)}°</Text>
        <Text style={styles.orientationReadout}>Pitch {safePitch.toFixed(1)}°</Text>
        <Text style={styles.orientationReadout}>Yaw {safeYaw.toFixed(1)}°</Text>
      </View>
    </View>
  );
}

function LinePlot({
  width,
  height,
  data,
  keys,
  colors,
  labels,
  yDomain,
  smoothingWindow = 1,
  yAxisLabel,
  xAxisLabel,
  showLiveExtrema = false,
}: {
  width: number;
  height: number;
  data: Record<string, number>[];
  keys: [string, string, string];
  colors: [string, string, string];
  labels: [string, string, string];
  yDomain?: [number, number];
  smoothingWindow?: number;
  yAxisLabel: string;
  xAxisLabel: string;
  showLiveExtrema?: boolean;
}) {
  const valuesA = useMemo(
    () => movingAverage(data.map((entry) => entry[keys[0]]), smoothingWindow),
    [data, keys, smoothingWindow],
  );
  const valuesB = useMemo(
    () => movingAverage(data.map((entry) => entry[keys[1]]), smoothingWindow),
    [data, keys, smoothingWindow],
  );
  const valuesC = useMemo(
    () => movingAverage(data.map((entry) => entry[keys[2]]), smoothingWindow),
    [data, keys, smoothingWindow],
  );

  const [displayMin, displayMax] = useMemo<[number, number]>(() => {
    if (yDomain) {
      return yDomain;
    }

    const merged = [...valuesA, ...valuesB, ...valuesC];
    if (merged.length === 0) {
      return [0, 0];
    }

    return [Math.min(...merged), Math.max(...merged)];
  }, [valuesA, valuesB, valuesC, yDomain]);

  const [observedMin, observedMax] = useMemo<[number, number]>(() => {
    const merged = [...valuesA, ...valuesB, ...valuesC];
    if (merged.length === 0) {
      return [0, 0];
    }

    return [Math.min(...merged), Math.max(...merged)];
  }, [valuesA, valuesB, valuesC]);

  const overflowInfo = useMemo(() => {
    if (!yDomain) {
      return null;
    }

    const [domainMin, domainMax] = yDomain;
    const hasOverflow = observedMin < domainMin || observedMax > domainMax;
    if (!hasOverflow) {
      return null;
    }

    const maxAbsObserved = Math.max(Math.abs(observedMin), Math.abs(observedMax));
    const suggestedAbs = roundUpToStep(maxAbsObserved * 1.1, 50);
    return {
      suggestedRangeText: `Suggested fixed range: ±${suggestedAbs.toFixed(0)} °/s`,
    };
  }, [observedMax, observedMin, yDomain]);

  const pointsA = useMemo(
    () =>
      toPolylinePoints(valuesA, width, height, [displayMin, displayMax]),
    [displayMax, displayMin, height, valuesA, width],
  );
  const pointsB = useMemo(
    () =>
      toPolylinePoints(valuesB, width, height, [displayMin, displayMax]),
    [displayMax, displayMin, height, valuesB, width],
  );
  const pointsC = useMemo(
    () =>
      toPolylinePoints(valuesC, width, height, [displayMin, displayMax]),
    [displayMax, displayMin, height, valuesC, width],
  );

  return (
    <View>
      <View style={styles.axisTopRow}>
        <Text style={styles.axisLabel}>{yAxisLabel}</Text>
        <Text style={styles.axisValue}>max {safeNumber(displayMax, 0).toFixed(2)}</Text>
      </View>
      <Svg width={width} height={height}>
        <Polyline points={pointsA} stroke={colors[0]} strokeWidth={2} fill="none" />
        <Polyline points={pointsB} stroke={colors[1]} strokeWidth={2} fill="none" />
        <Polyline points={pointsC} stroke={colors[2]} strokeWidth={2} fill="none" />
      </Svg>
      <View style={styles.axisBottomRow}>
        <Text style={styles.axisValue}>min {safeNumber(displayMin, 0).toFixed(2)}</Text>
        <Text style={styles.axisLabel}>{xAxisLabel}</Text>
      </View>
      {showLiveExtrema ? (
        <View style={styles.extremaRow}>
          <Text style={styles.extremaText}>
            observed min {safeNumber(observedMin, 0).toFixed(2)} • observed max {safeNumber(observedMax, 0).toFixed(2)}
          </Text>
          {overflowInfo ? <Text style={styles.extremaWarning}>{overflowInfo.suggestedRangeText}</Text> : null}
        </View>
      ) : null}
      <View style={styles.legendRow}>
        <Text style={[styles.legendItem, { color: colors[0] }]}>{labels[0]}</Text>
        <Text style={[styles.legendItem, { color: colors[1] }]}>{labels[1]}</Text>
        <Text style={[styles.legendItem, { color: colors[2] }]}>{labels[2]}</Text>
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
    marginBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  modeGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  modeButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    backgroundColor: '#1e293b',
  },
  modeButtonActive: {
    backgroundColor: '#2563eb',
  },
  modeText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#f8fafc',
  },
  rangeRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  rangeButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
  },
  rangeButtonActive: {
    backgroundColor: '#2563eb',
  },
  rangeText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
  rangeTextActive: {
    color: '#f8fafc',
  },
  pauseButton: {
    borderRadius: 8,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pauseText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  placeholder: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  plotCard: {
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    paddingTop: 12,
  },
  plotTitle: {
    color: '#cbd5e1',
    fontWeight: '700',
    marginHorizontal: 12,
    marginBottom: 4,
    fontSize: 13,
  },
  axisTopRow: {
    marginHorizontal: 12,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  axisBottomRow: {
    marginHorizontal: 12,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  axisLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  axisValue: {
    color: '#64748b',
    fontSize: 11,
  },
  extremaRow: {
    marginHorizontal: 12,
    marginTop: 4,
    gap: 2,
  },
  extremaText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  extremaWarning: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  legendRow: {
    marginTop: 4,
    marginBottom: 10,
    marginHorizontal: 12,
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    fontSize: 11,
    fontWeight: '700',
  },
  orientationContainer: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 10,
    alignItems: 'center',
    gap: 8,
  },
  orientationFrame: {
    width: 180,
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orientationCrossHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1e293b',
  },
  orientationCrossVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1e293b',
  },
  orientationGroundShadow: {
    position: 'absolute',
    bottom: 38,
    width: 90,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  orientationBody: {
    width: ORIENTATION_PLATE_SIZE,
    height: ORIENTATION_PLATE_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'visible',
  },
  orientationTopFace: {
    position: 'absolute',
    width: ORIENTATION_PLATE_SIZE,
    height: ORIENTATION_PLATE_SIZE,
    borderWidth: 2,
    borderColor: '#ea580c',
    backgroundColor: '#f97316',
    backfaceVisibility: 'visible',
  },
  orientationFrontFace: {
    position: 'absolute',
    top: ORIENTATION_PLATE_SIZE - 1,
    width: ORIENTATION_PLATE_SIZE,
    height: ORIENTATION_PLATE_DEPTH,
    backgroundColor: '#ea580c',
    transform: [{ translateY: ORIENTATION_PLATE_DEPTH / 2 }, { rotateX: '90deg' }],
    backfaceVisibility: 'visible',
  },
  orientationBackFace: {
    position: 'absolute',
    top: -ORIENTATION_PLATE_DEPTH + 1,
    width: ORIENTATION_PLATE_SIZE,
    height: ORIENTATION_PLATE_DEPTH,
    backgroundColor: '#c2410c',
    transform: [{ translateY: -ORIENTATION_PLATE_DEPTH / 2 }, { rotateX: '90deg' }],
    backfaceVisibility: 'visible',
  },
  orientationLeftFace: {
    position: 'absolute',
    left: -ORIENTATION_PLATE_DEPTH + 1,
    width: ORIENTATION_PLATE_DEPTH,
    height: ORIENTATION_PLATE_SIZE,
    backgroundColor: '#c2410c',
    transform: [{ translateX: -ORIENTATION_PLATE_DEPTH / 2 }, { rotateY: '-90deg' }],
    backfaceVisibility: 'visible',
  },
  orientationRightFace: {
    position: 'absolute',
    left: ORIENTATION_PLATE_SIZE - 1,
    width: ORIENTATION_PLATE_DEPTH,
    height: ORIENTATION_PLATE_SIZE,
    backgroundColor: '#ea580c',
    transform: [{ translateX: ORIENTATION_PLATE_DEPTH / 2 }, { rotateY: '-90deg' }],
    backfaceVisibility: 'visible',
  },
  orientationReadoutRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orientationReadout: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
});
