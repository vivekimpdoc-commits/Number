/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, AlertCircle, Save } from 'lucide-react';
import { Contact } from '../types';
import { DataClient, getStoredMode } from '../lib/data-client';

interface FileImporterProps {
  onImportComplete: (importedCount: number) => void;
}

export function FileImporter({ onImportComplete }: FileImporterProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedContacts, setParsedContacts] = useState<Partial<Contact>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setIsFileLoading(true);
    setErrorStatus(null);
    setFileName(file.name);
    setParsedContacts([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setErrorStatus('Unable to read file content.');
        setIsFileLoading(false);
        return;
      }

      try {
        const mode = getStoredMode();
        let list: Partial<Contact>[] = [];

        if (mode === 'local') {
          list = await DataClient.parseImportFileOffline(file.name, text);
        } else {
          // Send to backend for quick parsing
          const res = await fetch('/api/contacts/import-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content: text })
          });

          if (!res.ok) {
            const json = await res.json();
            throw new Error(json.error || 'Failed to parse file on server');
          }

          const data = await res.json();
          list = data.fullList || [];
        }

        setParsedContacts(list);

        // Auto selection
        const selectMap: Record<number, boolean> = {};
        list.forEach((_: any, idx: number) => {
          selectMap[idx] = true;
        });
        setSelectedIndices(selectMap);

      } catch (err) {
        console.error(err);
        setErrorStatus((err as Error).message);
      } finally {
        setIsFileLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorStatus('Failed to read file.');
      setIsFileLoading(false);
    };

    reader.readAsText(file);
  };

  const handleToggleSelect = (idx: number) => {
    setSelectedIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const next: Record<number, boolean> = {};
    parsedContacts.forEach((_, idx) => {
      next[idx] = select;
    });
    setSelectedIndices(next);
  };

  const handleCommitFile = async () => {
    const activeList = parsedContacts.filter((_, idx) => selectedIndices[idx]);
    if (activeList.length === 0) return;

    setIsFileLoading(true);
    try {
      const mode = getStoredMode();
      let importedCount = activeList.length;

      if (mode === 'local') {
        importedCount = await DataClient.importBulk(activeList);
      } else {
        const res = await fetch('/api/contacts/import-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: activeList })
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Failed to save parsed values');
        }

        const reply = await res.json();
        importedCount = reply.importedCount || activeList.length;
      }

      onImportComplete(importedCount);
      
      // Clear State
      setParsedContacts([]);
      setFileName('');
      setSelectedIndices({});
    } catch (err) {
      console.error(err);
      setErrorStatus((err as Error).message);
    } finally {
      setIsFileLoading(false);
    }
  };

  const triggerInputClick = () => {
    fileInputRef.current?.click();
  };

  const selectedCount = parsedContacts.filter((_, idx) => selectedIndices[idx]).length;

  return (
    <div id="file-importer-block" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800 text-base mb-1">Standard File Backup Sync</h3>
      <p className="text-slate-500 text-xs mb-4">Upload standard vCard (.vcf) or Excel-compatible contact tables (.csv)</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Upload Drop Zone */}
        <div
          id="dropzone-area"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerInputClick}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded cursor-pointer transition-all duration-200 min-h-[180px] ${
            isDragActive
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <input
            id="file-upload-input"
            ref={fileInputRef}
            type="file"
            accept=".vcf,.csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? 'text-blue-600 animate-bounce' : 'text-slate-400'}`} />
          <p className="text-xs font-bold text-slate-700 text-center uppercase tracking-wider">
            Drag & Drop Contacts File
          </p>
          <p className="text-[11px] text-slate-500 text-center mt-1">
            or <span className="text-blue-600 underline font-semibold">Browse Files</span>
          </p>
          <p className="text-[10px] bg-white border border-slate-250 p-1.5 rounded text-slate-500 font-mono mt-4 text-center max-w-[280px]">
            Formats: CSV (Excel Sheet) or vCard (Android/iOS backup)
          </p>
        </div>

        {/* Sync Panel & Preview */}
        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded p-4 min-h-[180px] justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2.5 flex items-center font-mono">
              File Extraction Preview
              {fileName && (
                <span className="ml-2 text-slate-705 font-mono text-[10px] bg-white border border-slate-250 py-0.5 px-1.5 rounded truncate max-w-[124px]">
                  {fileName}
                </span>
              )}
            </h4>

            {isFileLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 text-blue-550 animate-spin mb-2" />
                <p className="text-slate-550 text-xs">Parsing file content securely on server...</p>
              </div>
            )}

            {errorStatus && (
              <div className="flex items-start bg-red-50 border border-red-200 rounded p-3 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 text-red-500 mr-2 shrink-0" />
                <div>
                  <span className="font-bold">Error:</span> {errorStatus}
                </div>
              </div>
            )}

            {!isFileLoading && parsedContacts.length === 0 && !errorStatus && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 font-medium font-mono">
                <FileSpreadsheet className="w-10 h-10 text-slate-350 mb-2" />
                <p className="text-xs">No backup file mounted. Drag a file to preview.</p>
              </div>
            )}

            {!isFileLoading && parsedContacts.length > 0 && (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1.5 border-b border-slate-200 font-mono">
                  <div className="flex items-center gap-2">
                    <button
                      id="file-select-all-btn"
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-blue-600 hover:underline cursor-pointer font-bold"
                    >
                      ALL
                    </button>
                    <span>/</span>
                    <button
                      id="file-deselect-all-btn"
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-405 hover:underline cursor-pointer font-bold"
                    >
                      NONE
                    </button>
                  </div>
                  <span className="font-bold">{selectedCount} OF {parsedContacts.length} SELECTED</span>
                </div>

                {parsedContacts.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleToggleSelect(idx)}
                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                      selectedIndices[idx] 
                        ? 'bg-blue-50/70 border-blue-200 text-slate-800 font-semibold' 
                        : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={!!selectedIndices[idx]}
                        onChange={() => {}}
                        className="rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold truncate">{c.name || 'Unnamed'}</span>
                    </div>
                    <span className="font-mono text-slate-500 text-[11.5px] shrink-0">{c.phone || '(No Phone)'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isFileLoading && parsedContacts.length > 0 && (
            <button
              id="commit-file-imports-btn"
              type="button"
              onClick={handleCommitFile}
              disabled={selectedCount === 0}
              className="mt-3 flex items-center justify-center w-full bg-blue-650 hover:bg-blue-600 text-white font-mono font-bold tracking-wider text-xs uppercase py-2.5 px-3 rounded border border-blue-500 cursor-pointer disabled:bg-slate-105 disabled:border-slate-250 disabled:text-slate-400 disabled:cursor-not-allowed transition"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Sync {selectedCount} Contacts into CopBooklet
            </button>
          )}
        </div>
        
      </div>
    </div>
  );
}
