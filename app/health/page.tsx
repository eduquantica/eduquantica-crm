'use client';

import { useEffect, useState } from 'react';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: 'ok' | 'error'; message?: string };
    admin: { status: 'ok' | 'error'; message?: string };
    environment: { status: 'ok' | 'degraded'; missing?: string[] };
  };
  version: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (loading && !health) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded-lg" />
            <div className="h-64 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen bg-red-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-900 mb-4">
              Health Check Failed
            </h1>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchHealth}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Health Check</h1>
            <span
              className={`px-4 py-2 rounded-full text-lg font-semibold ${getStatusBadgeColor(
                health.status
              )}`}
            >
              {health.status.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-600">
            Last updated: {lastUpdated?.toLocaleTimeString() || 'N/A'}
          </p>
        </div>

        {/* Overall Status */}
        <div
          className={`border rounded-lg p-6 mb-6 ${getStatusColor(
            health.status
          )}`}
        >
          <h2 className="text-xl font-semibold mb-4">Overall Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm opacity-75">Timestamp</p>
              <p className="font-mono text-sm">
                {new Date(health.timestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm opacity-75">Server Uptime</p>
              <p className="font-mono text-sm">{formatUptime(health.uptime)}</p>
            </div>
            <div>
              <p className="text-sm opacity-75">Version</p>
              <p className="font-mono text-sm">{health.version}</p>
            </div>
          </div>
        </div>

        {/* Check Details */}
        <div className="space-y-4">
          {/* Database */}
          <div className={`border rounded-lg p-6 ${getStatusColor(health.checks.database.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Database</h3>
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(
                  health.checks.database.status
                )}`}
              >
                {health.checks.database.status}
              </span>
            </div>
            {health.checks.database.message && (
              <p className="text-sm opacity-75">{health.checks.database.message}</p>
            )}
          </div>

          {/* Admin Account */}
          <div className={`border rounded-lg p-6 ${getStatusColor(health.checks.admin.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Admin Account</h3>
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(
                  health.checks.admin.status
                )}`}
              >
                {health.checks.admin.status}
              </span>
            </div>
            {health.checks.admin.message && (
              <p className="text-sm opacity-75">{health.checks.admin.message}</p>
            )}
          </div>

          {/* Environment */}
          <div
            className={`border rounded-lg p-6 ${getStatusColor(
              health.checks.environment.status
            )}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Environment Variables</h3>
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(
                  health.checks.environment.status
                )}`}
              >
                {health.checks.environment.status}
              </span>
            </div>
            {health.checks.environment.missing &&
              health.checks.environment.missing.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Missing variables:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {health.checks.environment.missing.map((v) => (
                      <li key={v} className="text-sm font-mono">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {!health.checks.environment.missing ||
              (health.checks.environment.missing.length === 0 && (
                <p className="text-sm opacity-75">All required variables set</p>
              ))}
          </div>
        </div>

        {/* JSON View */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Raw JSON Response
          </h3>
          <pre className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto text-xs text-gray-700">
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>

        {/* Refresh Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={fetchHealth}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
