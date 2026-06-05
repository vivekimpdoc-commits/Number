/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, BrainCircuit, CheckSquare, RefreshCw, AlertCircle, Save, HelpCircle } from 'lucide-react';
import { Contact } from '../types';
import { DataClient, getStoredMode } from '../lib/data-client';

interface AIImporterProps {
  onImportComplete: (importedCount: number) => void;
  isLoadingExisting: boolean;
}

export function AIImporter({ onImportComplete, isLoadingExisting }: AIImporterProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<Omit<Contact, 'id' | 'createdAt'>[]>([]);
  const [summary, setSummary] = useState('');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  // Selection map for confirming which targets to import
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});

  const handleAIAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setErrorStatus(null);
    setParsedContacts([]);
    setSummary('');

    try {
      const mode = getStoredMode();
      // Use absolute hosted URL mapping if in local mode, ensuring the client can hit the server even inside a standalone mobile container
      const secureEndpoint = mode === 'local'
        ? 'https://ais-pre-jxwvbv27bylkjit3ulesss-89432018003.asia-east1.run.app/api/contacts/ai-parse'
        : '/api/contacts/ai-parse';

      const res = await fetch(secureEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to analyze text roster');
      }

      const data = await res.json();
      const extracted = data.contacts || [];

      setParsedContacts(extracted);
      setSummary(data.summary || `Extracted ${extracted.length} contacts.`);
      
      // Auto-select all by default
      const defaultSelections: Record<number, boolean> = {};
      extracted.forEach((_: any, idx: number) => {
        defaultSelections[idx] = true;
      });
      setSelectedIndices(defaultSelections);

    } catch (err) {
      console.error(err);
      setErrorStatus((err as Error).message + ' (Note: AI roster extraction needs active internet connection)');
    } finally {
      setIsProcessing(false);
    }
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

  const handleImportSelected = async () => {
    const listToImport = parsedContacts.filter((_, idx) => selectedIndices[idx]);
    if (listToImport.length === 0) return;

    setIsProcessing(true);
    try {
      const mode = getStoredMode();
      let importedCount = listToImport.length;

      if (mode === 'local') {
        importedCount = await DataClient.importBulk(listToImport);
      } else {
        const res = await fetch('/api/contacts/import-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: listToImport })
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || 'Failed to commit parsed roster contacts');
        }

        const reply = await res.json();
        importedCount = reply.importedCount || listToImport.length;
      }

      onImportComplete(importedCount);
      
      // Clear states
      setParsedContacts([]);
      setSummary('');
      setInputText('');
    } catch (err) {
      console.error(err);
      setErrorStatus((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample templates to let officers try quickly
  const loadExampleTemplate = () => {
    setInputText(
      `Tehsil Divisional Briefing Roster - June 2026\n` +
      `-------------------------------------------\n` +
      `Station Head Officer: Rajendra Prasad (Superintendent) - +919412110220\n` +
      `Sanjay Dutt (PSI Crime Branch Group) - +919056156908 \n` +
      `Emergency Fire Brigade Control - 101 \n` +
      `Confidential Source (Guru Ji) - +919922119933 (Notes: informer in western division)\n` +
      `Deepak Mittal (Hospital Ambulance Cell) - +919712123450\n` +
      `Sonu Delivery Boy Delhi Metro Corridor - +919213456781`
    );
  };

  const selectedCount = parsedContacts.filter((_, idx) => selectedIndices[idx]).length;

  return (
    <div id="ai-importer-container" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
        <div className="flex items-center">
          <div className="p-1.5 bg-blue-50 rounded border border-blue-105 mr-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Sentinel AI CopRoster Parser</h3>
            <p className="text-slate-500 text-xs mt-0.5">Paste raw duty rosters or message logs to extract contacts instantly</p>
          </div>
        </div>
        <button
          id="load-example-btn"
          type="button"
          onClick={loadExampleTemplate}
          className="text-xs text-blue-600 hover:text-blue-700 font-semibold bg-blue-50 rounded py-1.5 px-2.5 border border-blue-100 hover:bg-blue-100 transition cursor-pointer"
        >
          ✏️ Try Cop Sample
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input Textbox Card */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center">
            Paste Raw Text
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 ml-1" title="Paste roster lists with names, designations, and phone numbers in any format. Our Gemini AI automatically sorts and extracts them." />
          </label>
          <textarea
            id="ai-paster-text"
            rows={10}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste any roster details here... E.g.
• Inspector Amit Patel +919876543222 (Cyber unit)
• Hospital Hotline 0562-2251122
• Police Station Tehsil Kotwali SHO Room - +919412100110"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-3 rounded text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none leading-relaxed resize-y min-h-[220px]"
          />

          <button
            id="analyze-roster-btn"
            type="button"
            disabled={isProcessing || !inputText.trim()}
            onClick={handleAIAnalyze}
            className={`mt-3 flex items-center justify-center py-2 px-4 rounded font-mono font-medium text-xs tracking-wider uppercase transition ${
              isProcessing || !inputText.trim()
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-550 text-white shadow-sm cursor-pointer border border-blue-500'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin text-slate-400" />
                Analyzing with Gemini...
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4 mr-2 text-white" />
                Extract Contacts with AI
              </>
            )}
          </button>
        </div>

        {/* Output Preview Area */}
        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded p-4 min-h-[300px] justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center">
              Extraction Preview Panel
              {parsedContacts.length > 0 && (
                <span className="ml-2 bg-blue-105 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {parsedContacts.length} Located
                </span>
              )}
            </h4>

            {errorStatus && (
              <div className="flex items-start bg-red-50 border border-red-200 rounded p-3 text-red-800 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-red-500" />
                <div>
                  <span className="font-bold">Parsing Error: </span>
                  {errorStatus}
                </div>
              </div>
            )}

            {parsedContacts.length === 0 && !errorStatus && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-medium">
                <BrainCircuit className="w-12 h-12 text-slate-350 mb-2" />
                <p className="text-xs text-center px-6 max-w-sm">No draft contacts extracted yet. Paste text and click "Extract Contacts with AI" to query Gemini.</p>
              </div>
            )}

            {parsedContacts.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {summary && (
                  <p className="text-xs text-slate-655 bg-white p-2.5 rounded border border-slate-150 italic mb-2.5">
                    💡 <span className="font-bold text-slate-700">Briefing Analysis:</span> {summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1.5 border-b border-slate-200 font-mono">
                  <div className="flex items-center gap-2">
                    <button
                      id="select-all-draft-btn"
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-blue-600 hover:underline cursor-pointer font-bold"
                    >
                      SELECT ALL
                    </button>
                    <span>•</span>
                    <button
                      id="deselect-all-draft-btn"
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-400 hover:underline cursor-pointer font-bold"
                    >
                      NONE
                    </button>
                  </div>
                  <span className="font-bold">{selectedCount} SELECTED</span>
                </div>

                {parsedContacts.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleToggleSelect(idx)}
                    className={`flex items-start p-2 rounded border text-xs gap-x-2 cursor-pointer transition-colors ${
                      selectedIndices[idx]
                        ? 'bg-blue-50/70 border-blue-200 text-slate-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedIndices[idx]}
                      onChange={() => {}} // Swallowed, parent onClick handles selection
                      className="mt-0.5 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-800 truncate">{c.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0 font-mono font-bold">
                          {c.label}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-700 mt-0.5">{c.phone || '(No Number)'}</div>
                      
                      {(c.designation || c.department) && (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {[c.designation, c.department].filter(Boolean).join(' • ')}
                        </div>
                      )}
                      {c.notes && (
                        <div className="text-[10px] text-slate-400 mt-0.5 italic max-w-full truncate">
                          "{c.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {parsedContacts.length > 0 && (
            <button
              id="import-drafts-btn"
              type="button"
              onClick={handleImportSelected}
              disabled={selectedCount === 0 || isProcessing}
              className="mt-4 flex items-center justify-center w-full bg-emerald-600 hover:bg-emerald-550 text-white font-mono font-bold tracking-wider text-xs uppercase py-2.5 px-4 rounded border border-emerald-500 cursor-pointer shadow-sm disabled:bg-slate-105 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
            >
              <Save className="w-4 h-4 mr-2" />
              Saves {selectedCount} Selected Contacts to Booklet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
