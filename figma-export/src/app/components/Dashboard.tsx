import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Thermometer, Droplets, Battery } from "lucide-react";

interface SensorData {
  temperature: number;
  humidity: number;
  battery: number;
}

const deviceNames: Record<string, string> = {
  "1": "Smart Thermometer",
  "2": "Weather Station",
  "3": "Climate Monitor",
  "4": "BLE Sensor Hub",
  "5": "TempHumidity-Pro",
};

export function Dashboard() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 22.5,
    humidity: 55,
    battery: 87,
  });

  const deviceName = deviceId ? deviceNames[deviceId] || "Unknown Device" : "Unknown Device";

  useEffect(() => {
    // Simulate connection
    setTimeout(() => setIsConnected(true), 800);

    // Simulate live data updates
    const interval = setInterval(() => {
      setSensorData((prev) => ({
        temperature: +(prev.temperature + (Math.random() - 0.5) * 0.5).toFixed(1),
        humidity: Math.max(0, Math.min(100, +(prev.humidity + (Math.random() - 0.5) * 2).toFixed(0))),
        battery: Math.max(0, Math.min(100, prev.battery - 0.01)),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const disconnect = () => {
    setIsConnected(false);
    setTimeout(() => navigate("/"), 300);
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return "text-green-500";
    if (level > 20) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-3xl text-white mb-2">Device Dashboard</h1>
        <p className="text-gray-400">{deviceName}</p>
      </div>

      {/* Connection Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Status</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-gray-600"
              }`}
            />
            <span className={isConnected ? "text-green-500" : "text-gray-500"}>
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Live Data Cards */}
      <div className="space-y-4 mb-8">
        {/* Temperature Card */}
        <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-800/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-3 rounded-xl">
                <Thermometer className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-lg text-gray-300">Temperature</h2>
            </div>
            <div className="bg-orange-500/10 px-3 py-1 rounded-lg">
              <span className="text-xs text-orange-400">LIVE</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl text-white">
              {sensorData.temperature.toFixed(1)}
            </span>
            <span className="text-2xl text-gray-400">°C</span>
          </div>
        </div>

        {/* Humidity Card */}
        <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-800/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-lg text-gray-300">Humidity</h2>
            </div>
            <div className="bg-blue-500/10 px-3 py-1 rounded-lg">
              <span className="text-xs text-blue-400">LIVE</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl text-white">
              {sensorData.humidity}
            </span>
            <span className="text-2xl text-gray-400">%</span>
          </div>
          <div className="mt-4 bg-gray-900/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${sensorData.humidity}%` }}
            />
          </div>
        </div>

        {/* Battery Card */}
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-800/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <Battery className={`w-6 h-6 ${getBatteryColor(sensorData.battery)}`} />
              </div>
              <h2 className="text-lg text-gray-300">Battery Level</h2>
            </div>
            <div className="bg-green-500/10 px-3 py-1 rounded-lg">
              <span className="text-xs text-green-400">LIVE</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl text-white">
              {Math.round(sensorData.battery)}
            </span>
            <span className="text-2xl text-gray-400">%</span>
          </div>
          <div className="mt-4 bg-gray-900/50 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                sensorData.battery > 50
                  ? "bg-green-500"
                  : sensorData.battery > 20
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${sensorData.battery}%` }}
            />
          </div>
        </div>
      </div>

      {/* Disconnect Button */}
      <button
        onClick={disconnect}
        disabled={!isConnected}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:opacity-50 text-white py-4 rounded-2xl text-lg font-medium transition-colors shadow-lg shadow-red-900/30"
      >
        Disconnect
      </button>
    </div>
  );
}
