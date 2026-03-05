import { useState } from "react";
import { Bluetooth, Wifi, CheckCircle2, Loader2 } from "lucide-react";
import { useApp, BLEDevice } from "../context/AppContext";

const mockDevices: BLEDevice[] = [
  { id: "1", name: "IMU-Sensor-01", rssi: -45, mac: "A4:C1:38:4F:2E:91" },
  { id: "2", name: "MPU9250-Logger", rssi: -62, mac: "B8:27:EB:A2:1C:44" },
  { id: "3", name: "BNO055-Module", rssi: -55, mac: "DC:A6:32:1F:8B:29" },
  { id: "4", name: "IMU-Device-04", rssi: -78, mac: "E4:5F:01:9D:3A:17" },
  { id: "5", name: "AccelGyro-Pro", rssi: -51, mac: "F0:08:D1:C5:7E:8C" },
];

export function ScanScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const { connectionStatus, connectedDevice, connectToDevice } = useApp();

  const startScan = () => {
    setIsScanning(true);
    setDevices([]);

    mockDevices.forEach((device, index) => {
      setTimeout(() => {
        setDevices((prev) => [...prev, device]);
        if (index === mockDevices.length - 1) {
          setIsScanning(false);
        }
      }, (index + 1) * 500);
    });
  };

  const getSignalBars = (rssi: number) => {
    if (rssi > -50) return 4;
    if (rssi > -60) return 3;
    if (rssi > -70) return 2;
    return 1;
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500/10 border-green-500/30 text-green-500";
      case "connecting":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-500";
      default:
        return "bg-gray-800/50 border-gray-700 text-gray-400";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return `Connected to ${connectedDevice?.name}`;
      case "connecting":
        return `Connecting to ${connectedDevice?.name}...`;
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Connection Status Banner */}
      <div className={`border-b p-4 ${getStatusColor()}`}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connectionStatus === "connecting" && <Loader2 className="w-4 h-4 animate-spin" />}
            {connectionStatus === "connected" && <CheckCircle2 className="w-4 h-4" />}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          {connectionStatus === "connected" && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl mb-3">
            <Bluetooth className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl text-white mb-1">Scan for Devices</h1>
          <p className="text-gray-400 text-sm">Discover nearby IMU sensors</p>
        </div>

        {/* Scan Button */}
        <button
          onClick={startScan}
          disabled={isScanning}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white py-4 rounded-xl mb-6 text-lg font-semibold transition-all shadow-lg shadow-blue-900/30"
        >
          {isScanning ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Scanning...
            </span>
          ) : (
            "Start Scan"
          )}
        </button>

        {/* Device List */}
        {devices.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">
              Found {devices.length} device{devices.length !== 1 ? "s" : ""}
            </h2>
            {devices.map((device) => {
              const signalBars = getSignalBars(device.rssi);
              const isConnectedDevice = connectedDevice?.id === device.id;

              return (
                <div
                  key={device.id}
                  className={`bg-gray-900 border rounded-xl p-4 transition-all ${
                    isConnectedDevice
                      ? "border-blue-500 shadow-lg shadow-blue-900/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{device.name}</h3>
                        {isConnectedDevice && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{device.mac}</p>
                      <p className="text-xs text-gray-400 mt-1">RSSI: {device.rssi} dBm</p>
                    </div>

                    {/* Signal Strength */}
                    <div className="flex items-end gap-0.5 h-6">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-colors ${
                            i < signalBars ? "bg-blue-500" : "bg-gray-700"
                          }`}
                          style={{ height: `${(i + 1) * 25}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => connectToDevice(device)}
                    disabled={connectionStatus === "connecting" || isConnectedDevice}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      isConnectedDevice
                        ? "bg-green-500/20 text-green-500 cursor-default"
                        : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    }`}
                  >
                    {isConnectedDevice ? "Connected" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {devices.length === 0 && !isScanning && (
          <div className="text-center py-16 text-gray-500">
            <Wifi className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No devices found</p>
            <p className="text-xs mt-1">Tap "Start Scan" to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
