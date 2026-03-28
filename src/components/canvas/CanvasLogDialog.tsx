"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Terminal } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

export function CanvasLogDialog() {
  const { canvasLog, showCanvasLog, setShowCanvasLog, isCanvasBusy } =
    useWorkspace();

  return (
    <Dialog.Root open={showCanvasLog} onOpenChange={setShowCanvasLog}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-[600px] max-h-[70vh] bg-card rounded-sm shadow-editorial-lg border border-border flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <Dialog.Title className="font-sans text-body-sm font-medium text-foreground flex-1">
              Canvas Operation Log
              {isCanvasBusy && (
                <span className="ml-2 text-caption text-warning-500">
                  (running...)
                </span>
              )}
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Output from Canvas pull and push operations
          </Dialog.Description>

          <div className="flex-1 overflow-y-auto p-4">
            {canvasLog ? (
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {canvasLog}
              </pre>
            ) : (
              <p className="text-caption text-muted-foreground">
                No output yet.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
