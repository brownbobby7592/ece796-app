import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Pause, Play, TrendingUp } from "lucide-react";
import { useApp } from "../context/AppContext";

type TimeRange = 10 | 30 | 60;

export function PlotsScreen() {
  const { connectionStatus, imuHistory } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>(10);
  const [isPaused, setIsPaused] = useState(false);

  const isConnected = connectionStatus === "connected";

  // Filter data based on time range
  const getFilteredData = () => {
    if (isPaused || !isConnected) return imuHistory;
    
    const now = Date.now();
    const cutoff = now - timeRange * 1000;
    return imuHistory.filter((d) => d.timestamp >= cutoff);
  };

  const filteredData = getFilteredData();

  // Transform data for charts
  const chartData = filteredData.map((d, i) => ({
    time: i / 50, // Assuming 50Hz
    accelX: d.accel.x,
    accelY: d.accel.y,
    accelZ: d.accel.z,
    gyroX: d.gyro.x,
    gyroY: d.gyro.y,
    gyroZ: d.gyro.z,
    roll: d.euler.roll,
    pitch: d.euler.pitch,
    yaw: d.euler.yaw,
  }));

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl text-white font-semibold mb-3">Data Plots</h1>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex-1 flex gap-2">
              {([10, 30, 60] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    timeRange === range
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {range}s
                </button>
              ))}
            </div>

            {/* Pause/Resume */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              disabled={!isConnected}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-md mx-auto w-full">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Connect to a device to view plots</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Waiting for data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Acceleration Plot */}
            <PlotCard title="Acceleration (m/s²)" color="blue">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF" 
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9CA3AF' }}
                  />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="accelX" stroke="#3B82F6" name="X" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="accelY" stroke="#60A5FA" name="Y" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="accelZ" stroke="#93C5FD" name="Z" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </PlotCard>

            {/* Gyroscope Plot */}
            <PlotCard title="Gyroscope (°/s)" color="purple">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF" 
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9CA3AF' }}
                  />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="gyroX" stroke="#A855F7" name="X" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="gyroY" stroke="#C084FC" name="Y" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="gyroZ" stroke="#D8B4FE" name="Z" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </PlotCard>

            {/* Euler Angles Plot */}
            <PlotCard title="Euler Angles (°)" color="orange">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF" 
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9CA3AF' }}
                  />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="roll" stroke="#F97316" name="Roll" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="pitch" stroke="#FB923C" name="Pitch" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="yaw" stroke="#FDBA74" name="Yaw" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </PlotCard>
          </div>
        )}
      </div>
    </div>
  );
}

function PlotCard({
  title,
  color,
  children,
}: {
  title: string;
  color: "blue" | "purple" | "orange";
  children: React.ReactNode;
}) {
  const colorClasses = {
    blue: "from-blue-900/20 to-cyan-900/20 border-blue-800/40 text-blue-400",
    purple: "from-purple-900/20 to-pink-900/20 border-purple-800/40 text-purple-400",
    orange: "from-orange-900/20 to-red-900/20 border-orange-800/40 text-orange-400",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
      <h2 className={`text-sm font-semibold mb-3 uppercase tracking-wide ${colorClasses[color].split(' ')[3]}`}>
        {title}
      </h2>
      {children}
    </div>
  );
}
