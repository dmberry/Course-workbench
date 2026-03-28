"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X, Check, Loader2, Eye, EyeOff } from "lucide-react";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [contentRoot, setContentRoot] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState("");

  // Load current settings when dialog opens
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError("");
    setApiToken("");

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCanvasUrl(data.settings.canvas_url || "");
          setContentRoot(data.settings.content_root || "");
          setHasExistingToken(data.settings.has_token);
          setMaskedToken(data.settings.api_token_masked || "");
        }
      })
      .catch(() => {
        // Ignore
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (canvasUrl) body.canvas_url = canvasUrl;
      if (apiToken) body.api_token = apiToken;
      if (contentRoot) body.content_root = contentRoot;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setHasExistingToken(Boolean(apiToken) || hasExistingToken);
        setApiToken("");
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="btn-editorial-ghost !px-2 !py-1.5"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-[480px] max-h-[85vh] overflow-y-auto bg-card rounded-sm shadow-editorial-lg border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-display text-display-md font-bold text-foreground">
              Settings
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Configure Canvas API connection and workspace settings
          </Dialog.Description>

          <div className="space-y-5">
            {/* Canvas Base URL */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                Canvas URL
              </label>
              <input
                type="text"
                value={canvasUrl}
                onChange={(e) => setCanvasUrl(e.target.value)}
                placeholder="https://canvas.sussex.ac.uk"
                className="input-editorial !py-2 !text-body-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Your institution&apos;s Canvas base URL (no trailing slash)
              </p>
            </div>

            {/* API Token */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                API Token
                {hasExistingToken && (
                  <span className="ml-2 text-success-500 font-normal">
                    (set: {maskedToken})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={
                    hasExistingToken
                      ? "Leave blank to keep current token"
                      : "Paste your Canvas API token"
                  }
                  className="input-editorial !py-2 !text-body-sm !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Generate at Canvas &rarr; Account &rarr; Settings &rarr; New
                Access Token
              </p>
            </div>

            {/* Content Root */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                Default Workspace Folder
              </label>
              <input
                type="text"
                value={contentRoot}
                onChange={(e) => setContentRoot(e.target.value)}
                placeholder="~/Documents/canvas-work"
                className="input-editorial !py-2 !text-body-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Where pulled course content is stored on your machine
              </p>
            </div>

            {error && <p className="text-caption text-error-500">{error}</p>}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-editorial-primary w-full !py-2.5 gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                "Save Settings"
              )}
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Settings are saved to <code>.canvas-config.yaml</code> in the
              project root. This file is git-ignored.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
