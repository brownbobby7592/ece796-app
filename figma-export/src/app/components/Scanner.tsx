import { useState } from "react";
import { useNavigate } from "react-router";
import { Bluetooth, Wifi } from "lucide-react";

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
}

const mockDevices: BLEDevice[] = [
  { id: "1", name: "Smart Thermometer", rssi: -45 },
  { id: "2", name: "Weather Station", rssi: -62 },
  { id: "3", name: "Climate Monitor", rssi: -55 },
  { id: "4", name: "BLE Sensor Hub", rssi: -78 },
  { id: "5", name: "TempHumidity-Pro", rssi: -51 },
];

export function Scanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const navigate = useNavigate();

  const startScan = () => {
    setIsScanning(true);
    setDevices([]);

    // Simulate discovering devices over time
    mockDevices.forEach((device, index) => {
      setTimeout(() => {
        setDevices((prev) => [...prev, device]);
        if (index === mockDevices.length - 1) {
          setIsScanning(false);
        }
      }, (index + 1) * 600);
    });
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return { label: "Excellent", bars: 4 };
    if (rssi > -60) return { label: "Good", bars: 3 };
    if (rssi > -70) return { label: "Fair", bars: 2 };
    return { label: "Weak", bars: 1 };
  };

  const connectToDevice = (deviceId: string) => {
    navigate(`/dashboard/${deviceId}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-6 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-center mb-2">
          <Bluetooth className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-3xl text-center text-white">BLE Scanner</h1>
        <p className="text-gray-400 text-center mt-2">
          Discover nearby Bluetooth devices
        </p>
      </div>

      {/* Scan Button */}
      <button
        onClick={startScan}
        disabled={isScanning}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white py-4 rounded-2xl mb-8 text-lg font-medium transition-colors shadow-lg shadow-blue-900/50"
      >
        {isScanning ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse">Scanning...</span>
          </span>
        ) : (
          "Scan for Devices"
        )}
      </button>

      {/* Devices List */}
      <div className="space-y-4">
        {devices.length > 0 && (
          <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-4">
            Discovered Devices ({devices.length})
          </h2>
        )}

        <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
          {devices.map((device) => {
            const signal = getSignalStrength(device.rssi);
            return (
              <div
                key={device.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg text-white mb-1">{device.name}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">
                        RSSI: {device.rssi} dBm
                      </span>
                      <span
                        className={`${
                          signal.bars >= 3
                            ? "text-green-500"
                            : signal.bars === 2
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {signal.label}
                      </span>
                    </div>
                  </div>

                  {/* Signal Strength Indicator */}
                  <div className="flex items-end gap-1 ml-2">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full ${
                          i < signal.bars
                            ? "bg-blue-500"
                            : "bg-gray-700"
                        }`}
                        style={{ height: `${(i + 1) * 4}px` }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => connectToDevice(device.id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Connect
                </button>
              </div>
            );
          })}
        </div>

        {devices.length === 0 && !isScanning && (
          <div className="text-center py-12 text-gray-500">
            <Wifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No devices found</p>
            <p className="text-sm mt-1">Tap the button above to start scanning</p>
          </div>
        )}
      </div>
    </div>
  );
}
