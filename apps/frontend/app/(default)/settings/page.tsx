"use client";

import { useEffect, useState } from "react";
import { getLlmConfig, saveApiKey, testLlmConnection } from "@/lib/api/client";
import { LLMConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Key } from "lucide-react";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"] },
  {
    id: "anthropic",
    label: "Anthropic",
    models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
  },
  { id: "gemini", label: "Google Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  {
    id: "openrouter",
    label: "OpenRouter",
    models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"],
  },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "ollama", label: "Ollama (local)", models: ["llama3", "mistral", "qwen2.5"] },
] as const;

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    healthy: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getLlmConfig()
      .then((cfg) => {
        setConfig(cfg);
        setProvider(cfg.provider || "openai");
        setModel(cfg.model || "");
        setApiBase(cfg.api_base || "");
      })
      .catch(() => {});
  }, []);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveApiKey(provider, apiKey, model);
      setSaved(true);
      setApiKey("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLlmConnection();
      setTestResult({
        healthy: result.healthy,
        message: result.healthy
          ? `Connected to ${result.provider}/${result.model}`
          : result.error_code || "Connection failed",
      });
    } catch (e: unknown) {
      setTestResult({
        healthy: false,
        message: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
      <p className="text-sm text-gray-400 mb-8">
        Configure your AI provider to power resume tailoring and ATS optimization.
      </p>

      {/* Current config */}
      {config && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Current Configuration</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Provider: </span>
              <span className="text-white capitalize">{config.provider}</span>
            </div>
            <div>
              <span className="text-gray-500">Model: </span>
              <span className="text-white">{config.model || "Not set"}</span>
            </div>
            <div>
              <span className="text-gray-500">API Key: </span>
              <span className={config.api_key_set ? "text-green-400" : "text-red-400"}>
                {config.api_key_set ? "Configured" : "Not configured"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Config form */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400" />
          LLM Configuration
        </h2>

        {/* Provider */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setModel(p.models[0]);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  provider === p.id
                    ? "border-indigo-500 bg-indigo-500/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">Model</label>
          <div className="flex gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {selectedProvider?.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="or enter custom model"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="text-xs text-gray-500 block mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              config?.api_key_set ? "Leave blank to keep current key" : "Enter your API key"
            }
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* API Base (for Ollama / custom) */}
        {(provider === "ollama" || provider === "openrouter") && (
          <div>
            <label className="text-xs text-gray-500 block mb-2">
              API Base URL {provider === "ollama" ? "(e.g. http://localhost:11434)" : "(optional)"}
            </label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={provider === "ollama" ? "http://localhost:11434" : ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
        )}

        {saved && (
          <p className="text-sm text-green-400 bg-green-500/10 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Configuration saved successfully
          </p>
        )}

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 ${
              testResult.healthy
                ? "text-green-400 bg-green-500/10"
                : "text-red-400 bg-red-500/10"
            }`}
          >
            {testResult.healthy ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={saving}>
            Save Configuration
          </Button>
          <Button variant="secondary" onClick={handleTest} loading={testing}>
            Test Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
