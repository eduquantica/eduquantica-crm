"use client";

import { useEffect, useMemo, useState } from "react";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";
import { getBlobUrl } from "@/lib/getBlobUrl";

type Props = {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
};

function extensionFromName(fileName: string, fileUrl: string) {
  const source = (fileName || fileUrl || "").trim();
  if (!source) return "";
  const clean = source.split("?")[0].split("#")[0];
  const segment = clean.split("/").pop() || clean;
  const ext = segment.split(".").pop()?.toLowerCase() || "";
  return ext;
}

export default function DocumentPreviewModal({ fileUrl, fileName, onClose }: Props) {
  const [imageBroken, setImageBroken] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(() => toApiFilesPath(fileUrl));
  const [downloadUrl, setDownloadUrl] = useState(() => toApiFilesDownloadPath(fileUrl));
  const ext = useMemo(() => extensionFromName(fileName, resolvedUrl), [fileName, resolvedUrl]);

  const isPdf = ext === "pdf";
  const isWord = ext === "doc" || ext === "docx";
  const isImage = ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext);

  useEffect(() => {
    let mounted = true;

    const previewPath = toApiFilesPath(fileUrl);
    const downloadPath = toApiFilesDownloadPath(fileUrl);
    setResolvedUrl(previewPath);
    setDownloadUrl(downloadPath);
    setImageBroken(false);

    if (previewPath.startsWith("/api/blob/signed-url?") || downloadPath.startsWith("/api/blob/signed-url?")) {
      void getBlobUrl(fileUrl).then((signedUrl) => {
        if (!mounted || !signedUrl) return;
        setResolvedUrl(signedUrl);
        setDownloadUrl(signedUrl);
      });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fileUrl, onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-0 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={fileName || "Document preview"}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-[900px] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="truncate pr-3 text-sm font-semibold text-slate-900 sm:text-base">{fileName || "Document"}</h2>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              aria-label="Close preview"
            >
              Close
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-58px)] overflow-auto bg-slate-50 p-3 sm:p-4">
          {isPdf && (
            <iframe
              src={resolvedUrl}
              title={fileName || "PDF document preview"}
              className="h-full min-h-96 w-full rounded-lg border border-slate-200 bg-white"
            />
          )}

          {isImage && !imageBroken && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={fileName || "Document preview"}
              className="max-h-full max-w-full object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                setImageBroken(true);
              }}
            />
          )}

          {isWord && (
            <div className="flex h-full min-h-[40vh] items-center justify-center">
              <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="mt-1 text-sm text-slate-700">Word documents cannot be previewed. Please download to view.</p>
                <a
                  href={downloadUrl}
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Download {ext === "docx" ? "DOCX" : "DOC"}
                </a>
              </div>
            </div>
          )}

          {isImage && imageBroken && (
            <div className="flex h-full min-h-[40vh] items-center justify-center">
              <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-700">Image preview is unavailable. Please download to view.</p>
                <a
                  href={downloadUrl}
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Download File
                </a>
              </div>
            </div>
          )}

          {!isPdf && !isImage && !isWord && (
            <div className="flex h-full min-h-[40vh] items-center justify-center">
              <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-700">This file type is not previewable in browser.</p>
                <a
                  href={downloadUrl}
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Download File
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
