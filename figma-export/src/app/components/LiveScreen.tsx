import { Activity, Circle, StopCircle } from "lucide-react";
import { useApp } from "../context/AppContext";

export function LiveScreen() {
  const {
    connectionStatus,
    connectedDevice,
    currentIMUData,
    isRecording,
    sampleRate,
    startRecording,
    stopRecording,
  } = useApp();

  const isConnected = connectionStatus === "connected";

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl text-white font-semibold">Live Data Stream</h1>
            {isConnected && (
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {sampleRate} Hz
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            {isConnected ? connectedDevice?.name : "No device connected"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-md mx-auto w-full">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Activity className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Connect to a device to view live data</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Acceleration */}
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-800/40 rounded-xl p-4">
              <h2 className="text-blue-400 text-sm font-semibold mb-3 uppercase tracking-wide">
                Acceleration (m/s²)
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <DataCard label="X" value={currentIMUData.accel.x} color="blue" />
                <DataCard label="Y" value={currentIMUData.accel.y} color="blue" />
                <DataCard label="Z" value={currentIMUData.accel.z} color="blue" />
              </div>
            </div>

            {/* Gyroscope */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-800/40 rounded-xl p-4">
              <h2 className="text-purple-400 text-sm font-semibold mb-3 uppercase tracking-wide">
                Gyroscope (°/s)
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <DataCard label="X" value={currentIMUData.gyro.x} color="purple" />
                <DataCard label="Y" value={currentIMUData.gyro.y} color="purple" />
                <DataCard label="Z" value={currentIMUData.gyro.z} color="purple" />
              </div>
            </div>

            {/* Euler Angles */}
            <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-800/40 rounded-xl p-4">
              <h2 className="text-orange-400 text-sm font-semibold mb-3 uppercase tracking-wide">
                Euler Angles (°)
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <DataCard label="Roll" value={currentIMUData.euler.roll} color="orange" />
                <DataCard label="Pitch" value={currentIMUData.euler.pitch} color="orange" />
                <DataCard label="Yaw" value={currentIMUData.euler.yaw} color="orange" />
              </div>
            </div>

            {/* Recording Control */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-gray-300 text-sm font-semibold">Recording</h2>
                {isRecording && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <Circle className="w-2 h-2 fill-current animate-pulse" />
                    REC
                  </div>
                )}
              </div>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isRecording ? (
                  <>
                    <StopCircle className="w-5 h-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Circle className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "purple" | "orange";
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    orange: "bg-orange-500/10 text-orange-400",
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-3`}>
      <div className="text-xs opacity-75 mb-1">{label}</div>
      <div className="text-lg font-bold font-mono">{value.toFixed(2)}</div>
    </div>
  );
}
