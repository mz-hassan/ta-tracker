"use client";

import { useEffect, useState } from "react";

interface Config {
  sheetId: string;
  sheetUrl: string;
  credentialsPath: string;
  configured: boolean;
  warning?: string;
  success?: boolean;
  error?: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [credentialsPath, setCredentialsPath] = useState("");
  const [bedrockToken, setBedrockToken] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [linkedinCookie, setLinkedinCookie] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        if (data.sheetUrl) setSheetUrl(data.sheetUrl);
        if (data.credentialsPath) setCredentialsPath(data.credentialsPath);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, credentialsPath, bedrockToken, awsRegion, linkedinCookie }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else if (data.warning) {
        setConfig(data);
        if (data.credentialsPath) setCredentialsPath(data.credentialsPath);
        setMessage({ type: "warning", text: data.warning });
      } else {
        setConfig(data);
        if (data.credentialsPath) setCredentialsPath(data.credentialsPath);
        setMessage({
          type: "success",
          text: "Connected successfully! Google Sheet is ready with all tabs.",
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Connection failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const isConnected = config?.configured && !message?.type?.match(/error|warning/);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">
          Connect your Google Sheet to use as the data backend
        </p>
      </div>

      {/* Connection Status */}
      <div
        className={`rounded-xl border p-5 ${
          isConnected
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-amber-500"
            }`}
          />
          <span
            className={`font-medium ${
              isConnected ? "text-green-800" : "text-amber-800"
            }`}
          >
            {isConnected
              ? "Connected to Google Sheets"
              : "Not connected - configure below"}
          </span>
        </div>
        {config?.sheetId && (
          <p className="text-sm mt-2 ml-6 text-slate-600">
            Sheet ID:{" "}
            <code className="bg-white/60 px-1.5 py-0.5 rounded text-xs font-mono">
              {config.sheetId}
            </code>
          </p>
        )}
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-800">
          Google Sheet Connection
        </h2>

        {/* Sheet URL */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Google Sheet URL
          </label>
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500">
            Paste the full URL of your Google Sheet. It can be empty — we will
            populate it with the required structure.
          </p>
        </div>

        {/* Credentials Path */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Service Account Credentials (JSON file path)
          </label>
          <input
            type="text"
            value={credentialsPath}
            onChange={(e) => setCredentialsPath(e.target.value)}
            placeholder="~/Downloads/service-account-key.json"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
          />
          <p className="text-xs text-slate-500">
            Path to the Google Cloud service account JSON key file.
            Supports <code className="bg-slate-100 px-1 rounded">~</code> for
            home directory and relative paths.
          </p>
        </div>

        {/* AWS Bedrock (Marlyn AI) */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Marlyn (AI via AWS Bedrock)</h2>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Bedrock Bearer Token
            </label>
            <input
              type="password"
              value={bedrockToken}
              onChange={(e) => setBedrockToken(e.target.value)}
              placeholder="ABSK..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              AWS Region
            </label>
            <input
              type="text"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              placeholder="us-east-1"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
          </div>
          <p className="text-xs text-slate-500">
            Required for Marlyn AI assistant. Uses Claude Sonnet via Amazon Bedrock.
          </p>
        </div>

        {/* LinkedIn Cookie */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">LinkedIn (Search Scraper)</h2>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              li_at Cookie
            </label>
            <input
              type="password"
              value={linkedinCookie}
              onChange={(e) => setLinkedinCookie(e.target.value)}
              placeholder="AQEDAx..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
          </div>
          <p className="text-xs text-slate-500">
            Required for "Run Search" on LinkedIn Searches page. Get it from Chrome DevTools → Application → Cookies → linkedin.com → li_at.
          </p>
        </div>

        {/* Google Calendar */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Google Calendar (Interview Scheduling)</h2>
          <CalendarConnect />
        </div>

        {/* Message */}
        {message && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              message.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : message.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSave}
          disabled={saving || !sheetUrl}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? "Connecting..."
            : isConnected
            ? "Reconnect"
            : "Connect & Initialize"}
        </button>
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          Setup Instructions
        </h2>
        <ol className="text-sm text-slate-600 space-y-3 list-decimal list-inside">
          <li>
            Go to{" "}
            <span className="font-medium text-slate-800">
              Google Cloud Console
            </span>{" "}
            &rarr; create a project (or use existing)
          </li>
          <li>
            Enable the{" "}
            <span className="font-medium text-slate-800">
              Google Sheets API
            </span>
          </li>
          <li>
            Create a{" "}
            <span className="font-medium text-slate-800">Service Account</span>{" "}
            &rarr; download the JSON key file
          </li>
          <li>Create a new Google Sheet (or use an existing one)</li>
          <li>
            <span className="font-medium text-slate-800">
              Share the Google Sheet
            </span>{" "}
            with the service account email (the{" "}
            <code className="bg-slate-100 px-1 rounded text-xs">
              client_email
            </code>{" "}
            in the JSON key file) &mdash; give it{" "}
            <span className="font-medium">Editor</span> access
          </li>
          <li>Paste the sheet URL and credentials path above, then Connect</li>
        </ol>
      </div>

      {/* What happens */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          What happens when you connect
        </h2>
        <ul className="text-sm text-slate-600 space-y-2">
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">1.</span>
            If the sheet is empty, we create all 13 required tabs with headers
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">2.</span>
            If tabs already exist, we use them as-is
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">3.</span>
            Missing tabs are added without affecting existing data
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">4.</span>
            The sheet stays fully editable in Google Sheets at any time
          </li>
        </ul>
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
          <strong>Tabs:</strong> 0.0 Dashboard, 1.0 - Position Creation, 1.01 -
          Evaluation Matrix, 1.1 - Process, 1.15 - LinkedIn Searches, 1.2 -
          Profiles, 1.21 - Inbound, 1.3 - Shortlist, 1.4 - Interview, 1.5 -
          Logging, 1.6 - Interview Template, 1.7 - Evaluation, Messages
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
        <p className="text-sm text-slate-500 mb-4">
          Clear all data from the database and Google Sheets. This removes all candidates, personas, chat history, evaluation matrix, and resets everything to a blank slate. Headers are preserved.
        </p>
        <ResetButton />
      </div>
    </div>
  );
}

function CalendarConnect() {
  const [status, setStatus] = useState<{ connected: boolean; authUrl?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/google").then((r) => r.json()).then(setStatus);
  }, []);

  if (!status) return <p className="text-xs text-slate-400">Checking...</p>;

  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm text-green-800">Google Calendar connected</span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        Connect your Google account to schedule interviews with Calendar invites and Google Meet links.
      </p>
      <a href={status.authUrl} className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        Connect Google Calendar
      </a>
    </div>
  );
}

function ResetButton() {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) setDone(true);
      else alert(`Reset failed: ${data.error}`);
    } catch {
      alert("Reset failed");
    }
    setResetting(false);
    setConfirming(false);
  };

  if (done) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        All data cleared. Refresh the page to start fresh.
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
        <p className="text-sm font-medium text-red-800">
          Are you sure? This will permanently delete all data across the database and all Google Sheet tabs.
        </p>
        <div className="flex gap-2">
          <button onClick={handleReset} disabled={resetting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {resetting ? "Resetting..." : "Yes, delete everything"}
          </button>
          <button onClick={() => setConfirming(false)}
            className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-300">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
      Reset All Data
    </button>
  );
}
