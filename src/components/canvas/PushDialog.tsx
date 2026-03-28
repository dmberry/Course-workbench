"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpFromLine, X, Loader2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

export function PushDialog() {
  const { activeFile, contentRoot, runPush, isCanvasBusy } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [root, setRoot] = useState(contentRoot);

  // Pre-fill path from active file when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && activeFile) {
      setFilePath(activeFile.path);
    }
    if (isOpen) {
      setRoot(contentRoot);
    }
  };

  const handlePush = async () => {
    if (!filePath.trim() && !moduleName.trim()) return;
    await runPush({
      filePath: filePath.trim() || undefined,
      moduleName: moduleName.trim() || undefined,
      dryRun,
      contentRoot: root.trim() || undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="btn-editorial-secondary !px-3 !py-1.5 text-caption gap-1.5">
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Push
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-[480px] max-h-[85vh] overflow-y-auto bg-card rounded-sm shadow-editorial-lg border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-display text-display-md font-bold text-foreground">
              Push to Canvas
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Push local content back to Canvas LMS
          </Dialog.Description>

          <div className="space-y-4">
            {/* File path */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                File Path
              </label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Path to file to push"
                className="input-editorial !py-2 !text-body-sm"
              />
              <p className="text-caption text-muted-foreground mt-1">
                Leave blank to push a module by name instead.
              </p>
            </div>

            {/* Module name */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                Module Name (alternative)
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="Push all files in a module"
                className="input-editorial !py-2 !text-body-sm"
              />
            </div>

            {/* Content root */}
            <div>
              <label className="text-caption font-sans font-medium text-foreground block mb-1">
                Content Root
              </label>
              <input
                type="text"
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="input-editorial !py-2 !text-body-sm"
              />
            </div>

            {/* Dry run */}
            <label className="flex items-center gap-2 text-body-sm font-sans text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="accent-burgundy"
              />
              Dry run (preview changes without pushing)
            </label>

            {/* Push button */}
            <button
              onClick={handlePush}
              disabled={
                (!filePath.trim() && !moduleName.trim()) || isCanvasBusy
              }
              className={`w-full !py-2.5 gap-2 ${
                dryRun ? "btn-editorial-secondary" : "btn-editorial-primary"
              }`}
            >
              {isCanvasBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="w-4 h-4" />
                  {dryRun ? "Dry Run" : "Push to Canvas"}
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
