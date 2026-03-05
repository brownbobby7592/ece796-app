import { Download, Trash2, HardDrive, FileText } from "lucide-react";
import { useApp } from "../context/AppContext";

export function FilesScreen() {
  const { sessions, deleteSession } = useApp();

  const totalSize = sessions.reduce((sum, s) => sum + s.fileSize, 0);
  const totalSamples = sessions.reduce((sum, s) => sum + s.samples, 0);

  const exportCSV = (sessionId: string) => {
    // Mock CSV export
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const csv = `timestamp,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,roll,pitch,yaw\n`;
    // In a real app, this would contain actual data
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imu_session_${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl text-white font-semibold mb-3">Recorded Sessions</h1>
          
          {/* Storage Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <HardDrive className="w-4 h-4" />
                Storage
              </div>
              <span className="text-white text-sm font-semibold">
                {totalSize.toFixed(1)} MB / 100 MB
              </span>
            </div>
            <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${(totalSize / 100) * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} • {totalSamples.toLocaleString()} samples
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-md mx-auto w-full">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">No recorded sessions</p>
            <p className="text-xs mt-1">Start recording from the Live tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <h3 className="text-white text-sm font-semibold font-mono">
                        Session {session.id}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500">{session.timestamp}</p>
                  </div>
                  <span className="text-xs text-gray-400">{session.fileSize.toFixed(1)} MB</span>
                </div>

                {/* Session Details */}
                <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-gray-800">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Duration</div>
                    <div className="text-sm text-white font-mono">{formatDuration(session.duration)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Rate</div>
                    <div className="text-sm text-white font-mono">{session.sampleRate} Hz</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Samples</div>
                    <div className="text-sm text-white font-mono">{session.samples.toLocaleString()}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => exportCSV(session.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
