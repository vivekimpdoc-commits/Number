/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Search,
  Plus,
  RefreshCw,
  FolderDown,
  Trash2,
  SlidersHorizontal,
  Bookmark,
  Smartphone,
  PhoneCall,
  UserCheck,
  Zap,
  Star,
  Download,
  AlertCircle,
  FolderSync,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Database,
  Phone,
  Mail
} from 'lucide-react';

import { Contact, PaginatedContactsResponse } from './types';
import { ContactCard } from './components/ContactCard';
import { AIImporter } from './components/AIImporter';
import { FileImporter } from './components/FileImporter';
import { AddContactModal } from './components/AddContactModal';
import { DataClient, StorageMode, getStoredMode, setStoredMode } from './lib/data-client';

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'booklet' | 'ai_parse' | 'file_sync' | 'hotline'>('booklet');

  // Contact list state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<PaginatedContactsResponse['stats']>({
    total: 0,
    family: 0,
    work: 0,
    emergency: 0,
    doctors: 0,
    school: 0,
    delivery: 0,
    custom: 0,
    alwaysAllow: 0,
    whitelistOnly: 0,
  });

  // Query state filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');

  // Loading indicator & System statuses
  const [isLoading, setIsLoading] = useState(false);
  const [sysMsg, setSysMsg] = useState<{ type: 'success' | 'refreshed' | 'error'; text: string } | null>(null);

  // Selection map for batch bulk operations
  const [selectedContactIds, setSelectedContactIds] = useState<Record<string, boolean>>({});

  // Add/Edit Control states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Interactive A-Z navigation rail and Sentinel inspection sidebar states
  const [selectedLetter, setSelectedLetter] = useState<string>('');
  const [selectedDetailContact, setSelectedDetailContact] = useState<Contact | null>(null);

  // Mobile / Desktop view mode (Defaults to true for simple mobile version)
  const [isMobileMode, setIsMobileMode] = useState(true);
  const [selectedMobileDetailId, setSelectedMobileDetailId] = useState<string | null>(null);

  // Storage and offline synchronization support (vital for standalone APK installations)
  const [storageMode, setStorageMode] = useState<StorageMode>(getStoredMode());

  const handleToggleStorageMode = (mode: StorageMode) => {
    setStoredMode(mode);
    setStorageMode(mode);
    setSysMsg({
      type: 'success',
      text: mode === 'local'
        ? '📱 Activated offline local phone storage! Perfect for standalone APK.'
        : '☁️ Switched database to cloud backup server sync.'
    });
    setPage(1);
  };

  // Debouncing Search Input
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch paginated lists from backend or local database
  const fetchContacts = async (targetPage = page) => {
    setIsLoading(true);
    setSysMsg(null);
    try {
      const data = await DataClient.queryContacts({
        page: targetPage,
        limit,
        search: debouncedSearch,
        label: selectedLabel,
        whitelistStatus: selectedStatus,
        starred: starredOnly,
        sortBy
      });

      setContacts(data.contacts);
      setTotalCount(data.totalCount);
      setFilteredCount(data.filteredCount);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setStats(data.stats);

    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch contacts when filter params or storage mode change
  useEffect(() => {
    setPage(1); // Reset page on filter alteration
    fetchContacts(1);
    setSelectedContactIds({}); // Reset draft check items
  }, [debouncedSearch, selectedLabel, selectedStatus, starredOnly, sortBy, storageMode]);

  // Handle pagination navigation
  useEffect(() => {
    fetchContacts(page);
    setSelectedContactIds({});
  }, [page, storageMode]);

  // Add or Edit contact submit helper
  const handleSaveContact = async (contactData: Partial<Contact>) => {
    try {
      await DataClient.saveContact(contactData, editingContact?.id);

      setSysMsg({
        type: 'success',
        text: editingContact ? 'Contact details updated successfully!' : 'New VIP/Officer contact added!'
      });
      fetchContacts(page);
    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    }
  };

  // Star / Bookmark toggle
  const handleToggleStar = async (id: string) => {
    try {
      const success = await DataClient.toggleStar(id);
      if (success) {
        setContacts(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete contact item
  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Delete this contact permanent from database? This cannot be undone.')) return;

    try {
      await DataClient.deleteContact(id);
      setSysMsg({ type: 'success', text: 'Contact deleted from cop booklet.' });
      fetchContacts(page);
    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    }
  };

  // Set Whitelist Access Level Inline
  const handleStatusChange = async (id: string, status: Contact['whitelistStatus']) => {
    try {
      await DataClient.changeStatus(id, status);
      setContacts(prev => prev.map(c => c.id === id ? { ...c, whitelistStatus: status } : c));
      
      // Refresh stats in background
      const data = await DataClient.queryContacts({
        page: 1,
        limit: 1,
        search: debouncedSearch,
        label: selectedLabel,
        whitelistStatus: selectedStatus,
        starred: starredOnly,
        sortBy
      });
      setStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  };

  // Single card select trigger
  const handleSelectContactCard = (id: string, isChecked: boolean) => {
    setSelectedContactIds(prev => ({
      ...prev,
      [id]: isChecked
    }));
  };

  // Select all matching contacts on current page
  const handleSelectAllOnPage = (isChecked: boolean) => {
    const nextSelections: Record<string, boolean> = {};
    if (isChecked) {
      contacts.forEach(c => {
        nextSelections[c.id] = true;
      });
    }
    setSelectedContactIds(nextSelections);
  };

  // Convert selections array to dynamic direct VCF file card download
  const handleExportSelectedVCF = () => {
    const selectedList = contacts.filter(c => selectedContactIds[c.id]);
    if (selectedList.length === 0) return;

    let vcfBlocks = '';
    selectedList.forEach(c => {
      vcfBlocks += `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${c.name}\r\nTEL;TYPE=CELL:${c.phone}\r\n`;
      if (c.email) vcfBlocks += `EMAIL:${c.email}\r\n`;
      if (c.designation || c.department || c.notes) {
        const desc = [c.designation, c.department, c.notes].filter(Boolean).join(' - ');
        vcfBlocks += `NOTE:${desc}\r\n`;
      }
      vcfBlocks += `END:VCARD\r\n`;
    });

    const vcfBlob = new Blob([vcfBlocks], { type: 'text/vcard;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(vcfBlob);
    
    const virtualLink = document.createElement('a');
    virtualLink.href = downloadUrl;
    virtualLink.download = `cop_whitelist_contacts_${selectedList.length}.vcf`;
    document.body.appendChild(virtualLink);
    virtualLink.click();
    document.body.removeChild(virtualLink);

    setSysMsg({ type: 'success', text: `Successfully generated vCard for ${selectedList.length} contacts.` });
  };

  // Dynamic Batch Deletes
  const handleBatchDelete = async () => {
    const ids = Object.keys(selectedContactIds).filter(id => selectedContactIds[id]);
    if (ids.length === 0) return;

    if (!window.confirm(`Delete ${ids.length} selected contacts permanently from database?`)) return;

    try {
      await DataClient.batchDelete(ids);
      setSysMsg({ type: 'success', text: `Deleted ${ids.length} contacts.` });
      setSelectedContactIds({});
      fetchContacts(page);
    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    }
  };

  // Dynamic Batch access level Whitelisting
  const handleBatchWhitelist = async (targetStatus: Contact['whitelistStatus']) => {
    const ids = Object.keys(selectedContactIds).filter(id => selectedContactIds[id]);
    if (ids.length === 0) return;

    try {
      await DataClient.batchWhitelist(ids, targetStatus);
      setSysMsg({ type: 'success', text: `Updated ${ids.length} contacts to access level whitelist.` });
      setSelectedContactIds({});
      fetchContacts(page);
    } catch (err) {
      console.error(err);
    }
  };

  // Factory reset contacts list to defaults or empty
  const handleResetCatalog = async (resetToDefault = true) => {
    const warnMsg = resetToDefault 
      ? 'Reset entire database to high-priority police default starter entries? All other contacts will be removed.'
      : 'Erase all contacts folder? This drops all entered and whitelisted contacts.';
    
    if (!window.confirm(warnMsg)) return;

    try {
      await DataClient.resetCatalog(resetToDefault);
      setSysMsg({ type: 'success', text: resetToDefault ? 'Database reset to default cop entries.' : 'All contacts wiped out.' });
      setSelectedContactIds({});
      setPage(1);
      fetchContacts(1);
    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    }
  };

  // Generate 1500 stress test contacts instantly
  const handleStressTestGen = async () => {
    if (!window.confirm('Erase existing entries and fill database with 1,500 demo contacts? Excellent for validating high-speed local search, sorting, filtering and mobile APK performance.')) return;
    
    setIsLoading(true);
    setSysMsg(null);
    try {
      const mode = getStoredMode();
      // Wipe first to ensure pristine 1500 count
      await DataClient.resetCatalog(false);
      const generatedCount = await DataClient.generateStressTestContacts(1500);
      setSysMsg({ 
        type: 'success', 
        text: `⚡ Wiped storage and populated exactly ${generatedCount} high-speed test contacts into ${mode === 'local' ? 'Offline Phone Memory' : 'Cloud Server Sync'}!`
      });
      setSelectedContactIds({});
      setPage(1);
      fetchContacts(1);
    } catch (err) {
      console.error(err);
      setSysMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = Object.keys(selectedContactIds).filter(id => selectedContactIds[id]).length;
  const isAllOnPageSelected = contacts.length > 0 && contacts.every(c => selectedContactIds[c.id]);

  const displayedContacts = selectedLetter
    ? contacts.filter(c => c.name && c.name.trim().charAt(0).toUpperCase() === selectedLetter)
    : contacts;

  const activeDetail = selectedDetailContact || displayedContacts[0] || null;

  return (
    <div className="min-h-screen md:h-screen w-full md:w-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-500/20 overflow-y-auto md:overflow-hidden md:border-8 border-slate-200 shadow-2xl">
      
      {/* Tactical Top Workstation Banner */}
      <header id="ops-header" className="relative border-b border-slate-200/80 bg-white px-5 md:px-7 py-3 md:py-4 shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/15 ring-4 ring-blue-50 shrink-0">
              <Shield className="w-5.5 h-5.5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-display flex items-center gap-2">
                  Sentinel <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Booklet</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Manage your contacts securely
                </p>
              </div>
            </div>
          </div>

          <div className="flex overflow-x-auto pb-2 md:pb-0 items-center gap-3 select-none font-sans w-full md:w-auto scrollbar-none whitespace-nowrap">
            <button
              id="tab-booklet-btn"
              onClick={() => setActiveTab('booklet')}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center ${
                activeTab === 'booklet'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Contacts {totalCount > 0 && <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">{totalCount}</span>}
            </button>
            
            <button
              id="tab-ai-btn"
              onClick={() => setActiveTab('ai_parse')}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center ${
                activeTab === 'ai_parse'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
              AI Import
            </button>

            <button
              id="tab-sync-btn"
              onClick={() => setActiveTab('file_sync')}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center ${
                activeTab === 'file_sync'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FolderSync className="w-4 h-4 mr-2 text-blue-500" />
              Files & Sync
            </button>

            <button
              id="tab-hotline-btn"
              onClick={() => setActiveTab('hotline')}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center ${
                activeTab === 'hotline'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-transparent text-slate-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <PhoneCall className="w-4 h-4 mr-2 text-rose-500" />
              Hotlines
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 w-full max-w-full p-4 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Status System Message Alerts */}
        {sysMsg && (
          <div
            id="sys-msg-alert"
            className={`flex items-start p-3 border text-xs animate-fade-in rounded-lg shrink-0 ${
              sysMsg.type === 'error'
                ? 'border-red-200 text-red-800 bg-red-50'
                : 'border-emerald-200 text-emerald-800 bg-emerald-50'
            }`}
          >
            <AlertCircle className={`w-4 h-4 mr-2 shrink-0 ${sysMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`} />
            <div className="flex-1 font-mono">
              <span className="font-bold">{sysMsg.type === 'error' ? 'SYSTEM_ALERT_INTEGRATION:' : 'SYS_OP_SUCCESS:'} </span>
              {sysMsg.text}
            </div>
            <button onClick={() => setSysMsg(null)} className="ml-4 font-bold text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
          </div>
        )}

        {/* Global Stats Overview */}
        <section id="bento-stats" className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0 pb-2 md:pb-0 select-none">
          <div className="col-span-2 md:col-span-1 bg-gradient-to-tr from-slate-900 to-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-md text-white transition hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Total Contacts</span>
              <Database className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex items-baseline mt-4 space-x-2">
              <span className="text-4xl font-extrabold text-white">{stats.total}</span>
            </div>
          </div>

          <div
            onClick={() => { setSelectedLabel('Work'); setActiveTab('booklet'); }}
            className={`cursor-pointer bg-white hover:bg-slate-50 rounded-xl border p-5 flex flex-col justify-between transition min-w-[150px] shadow-sm hover:shadow-md ${selectedLabel === 'Work' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-700">Work</span>
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
            </div>
            <div className="flex items-baseline mt-4 space-x-2">
              <span className="text-4xl font-extrabold text-slate-900">{stats.work}</span>
            </div>
          </div>

          <div
            onClick={() => { setSelectedLabel('Emergency'); setActiveTab('booklet'); }}
            className={`cursor-pointer bg-white hover:bg-slate-50 rounded-xl border p-5 flex flex-col justify-between transition min-w-[150px] shadow-sm hover:shadow-md ${selectedLabel === 'Emergency' ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-rose-700">SOS Hotline</span>
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            </div>
            <div className="flex items-baseline mt-4 space-x-2">
              <span className="text-4xl font-extrabold text-slate-900">{stats.emergency}</span>
            </div>
          </div>

          <div
            onClick={() => { setSelectedStatus('always_allow'); setActiveTab('booklet'); }}
            className={`cursor-pointer bg-white hover:bg-slate-50 rounded-xl border p-5 flex flex-col justify-between transition min-w-[150px] shadow-sm hover:shadow-md ${selectedStatus === 'always_allow' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-700">Always Allow</span>
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex items-baseline mt-4 space-x-2">
              <span className="text-4xl font-extrabold text-slate-900">{stats.alwaysAllow}</span>
            </div>
          </div>

          <div
            onClick={() => { setSelectedStatus('whitelist_only'); setActiveTab('booklet'); }}
            className={`cursor-pointer bg-white hover:bg-slate-50 rounded-xl border p-5 flex flex-col justify-between transition min-w-[150px] shadow-sm hover:shadow-md ${selectedStatus === 'whitelist_only' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-700">Strict Filter</span>
              <Shield className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex items-baseline mt-4 space-x-2">
              <span className="text-4xl font-extrabold text-slate-900">{stats.whitelistOnly}</span>
            </div>
          </div>
        </section>

        {/* Dynamic Views matching Tab Bar */}
        
        {/* Tab 1: BOOKLET DIRECTORY LISTING */}
        {activeTab === 'booklet' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 lg:overflow-hidden">
            
            {/* Left Column: Filter Suite & Active list block */}
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-xs">
              
              {/* Filter Suite & Search Header */}
              <div className="flex flex-col gap-4 pb-4 border-b border-slate-100 select-none shrink-0">
                
                {/* Row 1: Search & Simple Actions */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="search-contacts-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Sorting criteria */}
                    <select
                      id="sort-sortby-criteria"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white cursor-pointer transition"
                    >
                      <option value="name_asc">🔤 Sort A-Z</option>
                      <option value="name_desc">🔤 Sort Z-A</option>
                      <option value="created_desc">📆 Newest First</option>
                      <option value="starred">⭐️ Bookmarks First</option>
                    </select>

                    <button
                      id="add-contact-trigger-btn"
                      onClick={() => { setEditingContact(null); setIsAddModalOpen(true); }}
                      className="w-full sm:w-auto justify-center flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-md cursor-pointer shrink-0 transition"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Contact
                    </button>
                  </div>
                </div>

                {/* Row 2: Category Labels Selection Grid as shown in mockup */}
                <div id="labels-row" className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 max-w-full select-none font-sans scrollbar-none">
                    <button
                      id="label-pill-all"
                      onClick={() => setSelectedLabel('')}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition ${
                        !selectedLabel
                          ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      All Groups
                    </button>
                    {['Work', 'Family', 'Emergency', 'Doctors', 'School', 'Delivery', 'Custom'].map((lbl) => (
                      <button
                        id={`label-pill-${lbl.toLowerCase()}`}
                        key={lbl}
                        onClick={() => setSelectedLabel(lbl)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition ${
                          selectedLabel === lbl
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {lbl === 'Work' && '💼 '}
                        {lbl === 'Family' && '🏡 '}
                        {lbl === 'Emergency' && '🚨 '}
                        {lbl === 'Doctors' && '🩺 '}
                        {lbl === 'School' && '🏫 '}
                        {lbl === 'Delivery' && '📦 '}
                        {lbl === 'Custom' && '👤 '}
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 3: Whitelist filter buttons matching mockup Always Allow & Whitelist Only */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 font-sans">
                  
                  <button
                    id="whitelist-status-all"
                    onClick={() => setSelectedStatus('')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer border ${
                      !selectedStatus
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    All Access
                  </button>

                  <button
                    id="whitelist-status-allow"
                    onClick={() => setSelectedStatus(selectedStatus === 'always_allow' ? '' : 'always_allow')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer border ${
                      selectedStatus === 'always_allow'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-emerald-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    🟢 Always Allow
                  </button>

                  <button
                    id="whitelist-status-only"
                    onClick={() => setSelectedStatus(selectedStatus === 'whitelist_only' ? '' : 'whitelist_only')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer border ${
                      selectedStatus === 'whitelist_only'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    🔵 Whitelist Only
                  </button>

                  {/* Filter letter indicator */}
                  {selectedLetter && (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 py-1.5 px-3 rounded-full text-xs font-bold">
                      Letter: {selectedLetter}
                    </span>
                  )}

                  <button
                    id="starred-toggle-btn"
                    onClick={() => setStarredOnly(!starredOnly)}
                    className={`ml-auto flex items-center px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer border ${
                      starredOnly
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-slate-50 text-amber-600 border-slate-200 hover:text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <Star className={`w-4 h-4 mr-1.5 ${starredOnly ? 'fill-amber-500 text-amber-600' : 'text-slate-400'}`} />
                    Bookmarks
                  </button>
                </div>

              </div>

              {/* List Selection Header Bar */}
              {displayedContacts.length > 0 && (
                <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 border border-slate-200/80 mt-3 text-[11px] text-slate-600 shrink-0 font-sans rounded-xl shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <input
                      id="select-all-on-page-check"
                      type="checkbox"
                      checked={isAllOnPageSelected}
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      className="w-4.5 h-4.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-2 cursor-pointer bg-white transition"
                    />
                    <span className="font-extrabold text-slate-700 uppercase tracking-wide">
                      {selectedCount > 0 ? `${selectedCount} Selected` : 'Select Current Page'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                    <span>Index Matched: <span className="font-extrabold text-slate-900 font-mono">{filteredCount}</span></span>
                    {totalCount !== filteredCount && (
                      <span className="opacity-60 font-bold bg-slate-200 text-slate-700 rounded-full px-1.5 py-0.25 text-[9px]">[of {totalCount} total]</span>
                    )}
                  </div>
                </div>
              )}

              {/* Contacts Listing with Side A-Z strip */}
              <div className="flex-1 flex gap-3.5 min-h-0 mt-3">
                
                {/* Vertical A-Z Letter strip */}
                <div className="hidden sm:flex flex-col items-center justify-between py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 w-8 shrink-0 select-none">
                  <button
                    onClick={() => setSelectedLetter('')}
                    className={`w-full text-center py-1 hover:text-blue-600 transition-colors cursor-pointer text-[9px] ${
                      !selectedLetter ? 'text-blue-600 border-l-2 border-r-2 border-blue-500 font-black' : ''
                    }`}
                  >
                    ALL
                  </button>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((char) => (
                    <button
                      key={char}
                      onClick={() => {
                        setSelectedLetter(selectedLetter === char ? '' : char);
                      }}
                      className={`w-full text-center py-0.5 hover:text-blue-600 transition-colors cursor-pointer ${
                        selectedLetter === char
                          ? 'text-blue-600 bg-blue-50 font-black border-l border-r border-blue-500'
                          : ''
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>

                {/* Main scrollable area */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0 scrollbar-thin">
                  
                  {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <RefreshCw className="w-9 h-9 text-blue-600 animate-spin mb-3.5 stroke-[2]" />
                      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase font-sans">Connecting Secure Station...</p>
                      <p className="text-slate-400 text-[10px] mt-1.5 font-mono">Retrieving live whitelists instantly</p>
                    </div>
                  )}

                  {!isLoading && displayedContacts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-500 bg-slate-50/75 border border-slate-250 border-dashed rounded-2xl font-sans px-6 text-center">
                      <Database className="w-12 h-12 text-slate-450 mb-4 stroke-[1.5]" />
                      <p className="text-sm font-black text-slate-800 uppercase tracking-wide">No Whitelists Located</p>
                      {selectedLetter ? (
                        <p className="text-[11px] text-slate-500 px-4 mt-1.5 max-w-sm">
                          No indices begin with the letter <strong className="text-blue-500 font-bold font-mono">"{selectedLetter}"</strong>. Clear filter to search.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 px-6 mt-2 max-w-sm leading-relaxed">
                          The Index is completely empty. Parse a WhatsApp roster, upload file-snapshots, or click "Add Officer" to quickly start.
                        </p>
                      )}
                      <div className="flex gap-2.5 mt-6 font-sans">
                        <button
                          id="reset-starter-btn"
                          onClick={() => handleResetCatalog(true)}
                          className="text-[10px] font-extrabold uppercase bg-slate-150 text-slate-700 hover:text-slate-900 hover:bg-slate-200 py-2 px-4 border border-transparent rounded-lg cursor-pointer transition-all"
                        >
                          Restore Demo Data
                        </button>
                        <button
                          onClick={() => { setSearchQuery(''); setSelectedLabel(''); setSelectedStatus(''); setStarredOnly(false); setSelectedLetter(''); }}
                          className="text-[10px] font-extrabold uppercase bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white py-2 px-4 rounded-lg cursor-pointer transition-all border border-transparent"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  )}

                  {!isLoading && displayedContacts.map(c => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      isSelected={!!selectedContactIds[c.id]}
                      isHighlighted={activeDetail?.id === c.id}
                      onSelect={handleSelectContactCard}
                      onToggleStar={handleToggleStar}
                      onEdit={(selected) => { setEditingContact(selected); setIsAddModalOpen(true); }}
                      onDelete={handleDeleteContact}
                      onStatusChange={handleStatusChange}
                      onCardClick={() => {
                        setSelectedDetailContact(c);
                        setSelectedMobileDetailId(c.id);
                      }}
                    />
                  ))}

                </div>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between py-3 border-t border-slate-100 mt-4 text-xs shrink-0 select-none font-sans">
                  <div className="text-slate-500 font-medium">
                    Rows {Math.min(filteredCount, (page - 1) * limit + 1)}-{Math.min(filteredCount, page * limit)} of <span className="font-bold text-slate-800">{filteredCount}</span> Matches
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      id="prev-page-btn"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition text-[10px] font-bold uppercase"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </button>
                    
                    <span className="text-slate-600 font-extrabold px-2 font-mono text-[11px]">
                      {page} / {totalPages}
                    </span>

                    <button
                      id="next-page-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition text-[10px] font-bold uppercase"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* System operations tools footer */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100 mt-4">
                <span className="font-medium text-slate-500">Local Storage Active</span>
                <div className="flex flex-wrap items-center gap-4 font-semibold">
                  <button
                    id="stress-test-generate-btn"
                    onClick={handleStressTestGen}
                    className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition cursor-pointer flex items-center gap-1.5"
                    title="Populate exactly 1,500 active contacts"
                  >
                    ⚡ Demo 1500 Records
                  </button>
                  <button
                    id="reset-catalogs-btn"
                    onClick={() => handleResetCatalog(true)}
                    className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition cursor-pointer"
                  >
                    🔄 Restore Defaults
                  </button>
                  <button
                    id="clear-all-data-btn"
                    onClick={() => handleResetCatalog(false)}
                    className="text-rose-600 hover:text-rose-700 hover:underline transition cursor-pointer ml-2"
                  >
                    ⚠️ Wipe All Data
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Contact Inspector Sidebar */}
            <aside className="hidden lg:flex w-full lg:w-80 shrink-0 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between overflow-y-auto shadow-sm">
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center">
                    Contact Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">View and edit information</p>
                </div>

                {activeDetail ? (
                  <div className="space-y-6">
                    {/* Centered Avatar and Identification Block */}
                    <div className="text-center pt-2">
                      <div className="w-24 h-24 bg-gradient-to-tr from-blue-50 to-indigo-100 rounded-full mx-auto mb-4 border-2 border-indigo-200 flex items-center justify-center font-bold text-4xl text-indigo-700 shadow-sm">
                        {activeDetail.name ? activeDetail.name.trim().charAt(0).toUpperCase() : '?'}
                      </div>
                      <h4 className="font-bold text-xl text-slate-900 truncate px-2" title={activeDetail.name}>
                        {activeDetail.name}
                      </h4>
                      <p className="text-blue-600 text-sm font-medium mt-1 truncate">
                        {activeDetail.designation || 'Standard Contact'}
                      </p>
                      
                      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-full font-semibold">
                          {activeDetail.label || 'No Label'}
                        </span>
                        
                        {activeDetail.starred && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                            ⭐ Starred
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Details Grid */}
                    <div className="space-y-2.5">
                      <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                        <p className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest mb-1">PHONE LINK EXT</p>
                        <p className="text-xs font-mono font-bold text-slate-800 truncate flex items-center">
                          <Phone className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                          {activeDetail.phone || <em className="text-slate-350">No phone input</em>}
                        </p>
                      </div>

                      {activeDetail.email && (
                        <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                          <p className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest mb-1">EMAIL ADDRESS</p>
                          <p className="text-xs font-mono text-slate-800 truncate flex items-center">
                            <Mail className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                            {activeDetail.email}
                          </p>
                        </div>
                      )}

                      {activeDetail.department && (
                        <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                          <p className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest mb-1">DEPARTMENT SEGMENT</p>
                          <p className="text-xs font-mono font-bold text-slate-700 truncate">
                            {activeDetail.department}
                          </p>
                        </div>
                      )}

                      {activeDetail.notes && (
                        <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                          <p className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest mb-1">SUMMARY / CONSOLE NOTES</p>
                          <p className="text-[11.5px] text-slate-600 leading-relaxed italic line-clamp-4">
                            "{activeDetail.notes}"
                          </p>
                        </div>
                      )}

                      {/* Configured Access Level Display */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-sans">
                        <span className="text-[8px] uppercase font-black text-slate-400 tracking-widest font-mono">ACCESS STATUS</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                          activeDetail.whitelistStatus === 'always_allow'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : activeDetail.whitelistStatus === 'whitelist_only'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : activeDetail.whitelistStatus === 'blocked'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {activeDetail.whitelistStatus}
                        </span>
                      </div>
                    </div>

                    {/* Operational Trigger Dispatch Call dialer client */}
                    {activeDetail.phone && (
                      <a
                        href={`tel:${activeDetail.phone}`}
                        className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-605 to-blue-600 hover:opacity-95 text-white font-sans font-bold tracking-wider text-xs uppercase py-3 rounded-xl shadow-md shadow-blue-500/10 text-center cursor-pointer shrink-0 transition-all active:scale-98"
                      >
                        ☎️ DIRECT DISPATCH CALL
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-24 text-slate-500">
                    <Database className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-sm font-semibold">No contact selected</p>
                    <p className="text-xs text-slate-400 mt-2 px-4">Select any contact from the list to view their full details here.</p>
                  </div>
                )}
              </div>
            </aside>

          </div>
        )}

        {/* Tab 2: AI MESSENGER ROSTER EXTRACTOR */}
        {activeTab === 'ai_parse' && (
          <AIImporter
            isLoadingExisting={isLoading}
            onImportComplete={(count) => {
              setSysMsg({ type: 'success', text: `Extracted & added ${count} contacts directly to phone book.` });
              fetchContacts(1);
              setActiveTab('booklet');
            }}
          />
        )}

        {/* Tab 3: FILE backup & drag uploads */}
        {activeTab === 'file_sync' && (
          <div className="space-y-4">
            <FileImporter
              onImportComplete={(count) => {
                setSysMsg({ type: 'success', text: `Cleaned & synchronized ${count} file backup contacts.` });
                fetchContacts(1);
                setActiveTab('booklet');
              }}
            />
            
            {/* Quick backup guidance info sheet */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded text-xs space-y-2 leading-relaxed">
              <h4 className="font-bold text-slate-800 uppercase tracking-widest font-mono flex items-center">
                📁 Offline backup & global phone book migration guide
              </h4>
              <p className="text-slate-400 font-mono uppercase text-[10px]">
                To migrate your phone contacts directly containing thousands of entries without lag or crash:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-650 font-mono text-[11px]">
                <li>Open your Android/iOS Phonebook app, click Settings, then click <strong>"Export contacts as .VCF file"</strong> (vCard structure).</li>
                <li>Drop that .vcf file right here or click browse to import it. Over 10,000+ entries are parsed instantly.</li>
                <li>Review the extracted index list here and commit them to the CopBooklet with zero performance penalty.</li>
                <li>Your contacts are stored safely in the database. You can always select items and click "Export selected .vcf" to get a clean backup compatible with any smartphone.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 4: HOTLINE ROOM VIEWER */}
        {activeTab === 'hotline' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-800 flex items-center font-mono">
                🚨 EMERGENCY DISPATCH SPEED-DIAL CORE BOARD
              </h3>
              <p className="text-slate-500 text-xs mt-0.5 animate-pulse">
                Displaying Priority Hotlines ("Always Allow" and "Emergency SOS" tags) optimized for immediate briefings on tablet/smartphone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <h4 className="text-xs font-black uppercase text-emerald-700 tracking-widest border-b border-slate-200 pb-2 mb-3 flex items-center font-mono">
                  🟢 ALWAYS ALLOW ACCESS CHANNELS
                </h4>
                {contacts.filter(c => c.whitelistStatus === 'always_allow').length === 0 ? (
                  <p className="text-slate-400 text-xs italic py-10 text-center font-mono uppercase">No "Always Allow" whitelists active. Select directory contacts and flag them as Always Allow in whitelist book tab.</p>
                ) : (
                  <div className="space-y-2.5">
                    {contacts.filter(c => c.whitelistStatus === 'always_allow').map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded bg-white border border-slate-200 shadow-sm">
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{c.name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{c.phone}</div>
                        </div>
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-555 text-xs font-bold font-mono uppercase tracking-wider text-white px-3 py-1.5 rounded border border-emerald-500 cursor-pointer">
                          ☎️ Dial
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <h4 className="text-xs font-black uppercase text-red-700 tracking-widest border-b border-slate-200 pb-2 mb-3 flex items-center font-mono">
                  🚨 EMERGENCY HELP DESKS & CLINICS
                </h4>
                {contacts.filter(c => c.label === 'Emergency' || c.label === 'Doctors').length === 0 ? (
                  <p className="text-slate-400 text-xs italic py-10 text-center font-mono uppercase">No Emergency listings indexed.</p>
                ) : (
                  <div className="space-y-2.5">
                    {contacts.filter(c => c.label === 'Emergency' || c.label === 'Doctors').slice(0, 15).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded bg-white border border-slate-200 shadow-sm">
                        <div>
                          <div className="font-semibold text-slate-800 text-sm flex items-center">
                            {c.name}
                            <span className="ml-1.5 text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold font-mono border border-red-200 tracking-wider">
                              {c.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{c.phone}</div>
                        </div>
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 bg-red-600 hover:bg-red-550 text-xs font-bold font-mono uppercase tracking-wider text-white px-3 py-1.5 rounded border border-red-500 cursor-pointer">
                          📞 Call SOS
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* STICKY BULK ACTION CONTROLLER (TRIGGERS WHEN MULTIPLE ITEMS CHECKED) */}
      {selectedCount > 0 && (
        <div id="bulk-footer-bar" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white/98 border border-blue-200 px-4 py-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xl animate-fade-in w-11/12 max-w-4xl outline outline-4 outline-blue-50 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-xs md:text-sm font-semibold text-slate-800">
              With <span className="font-bold text-blue-600 font-mono">{selectedCount}</span> Selected Contacts:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Whitelist Tag triggers */}
            <button
              id="bulk-whitelist-allow-btn"
              onClick={() => handleBatchWhitelist('always_allow')}
              className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition"
            >
              🟢 Set Always Allow
            </button>

            <button
              id="bulk-whitelist-only-btn"
              onClick={() => handleBatchWhitelist('whitelist_only')}
              className="text-[11px] bg-blue-50 hover:bg-blue-105 text-blue-700 border border-blue-250 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition"
            >
              🔵 Set Whitelist Only
            </button>

            <button
              id="bulk-whitelist-normal-btn"
              onClick={() => handleBatchWhitelist('normal')}
              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition"
            >
              ⚪ Set Normal
            </button>

            {/* Downloader item backup */}
            <button
              id="bulk-export-btn"
              onClick={handleExportSelectedVCF}
              title="Export as Phone Syncable vCard File"
              className="flex items-center text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-zinc-500" />
              Download vCard
            </button>

            {/* Batch destroy */}
            <button
              id="bulk-delete-btn"
              onClick={handleBatchDelete}
              className="flex items-center text-[11px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Selected
            </button>

            {/* Drafteese cleaner */}
            <button
              id="bulk-clear-selection-btn"
              onClick={() => setSelectedContactIds({})}
              className="text-xs text-zinc-500 hover:text-zinc-300 ml-1.5 cursor-pointer underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET FOR CONTACT DETAILS */}
      {selectedMobileDetailId && (() => {
        const mobileContact = contacts.find((item) => item.id === selectedMobileDetailId);
        if (!mobileContact) return null;
        return (
          <div id="mobile-bottom-sheet" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col justify-end lg:hidden animate-fade-in">
            {/* Backdrop Clicker */}
            <div className="absolute inset-0 z-0" onClick={() => setSelectedMobileDetailId(null)}></div>
            
            {/* Sheet content */}
            <div className="relative z-10 bg-white rounded-t-3xl p-5 shadow-2xl animate-slide-up space-y-5 max-h-[85vh] overflow-y-auto">
              
              {/* Swipe/Pull pill hanger */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto -mt-2 mb-2 cursor-pointer" onClick={() => setSelectedMobileDetailId(null)}></div>
              
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 bg-gradient-to-tr from-blue-50 to-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-2xl rounded-full flex items-center justify-center">
                    {mobileContact.name ? mobileContact.name.trim().charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 tracking-tight">{mobileContact.name}</h4>
                    <p className="text-blue-600 text-xs font-semibold mt-0.5">{mobileContact.designation || 'Standard Contact'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMobileDetailId(null)} 
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-xs uppercase font-bold text-slate-500 mb-1">Phone Number</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{mobileContact.phone || 'No phone'}</span>
                    {mobileContact.phone && (
                      <a href={`tel:${mobileContact.phone}`} className="text-blue-600 hover:underline text-xs font-bold">
                        DIAL
                      </a>
                    )}
                  </div>
                </div>

                {mobileContact.email && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Email Address</p>
                    <p className="text-slate-900 font-medium truncate">{mobileContact.email}</p>
                  </div>
                )}

                {mobileContact.department && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Department</p>
                    <p className="text-slate-900 font-medium">{mobileContact.department}</p>
                  </div>
                )}

                {mobileContact.notes && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Notes</p>
                    <p className="text-slate-700 italic">{mobileContact.notes}</p>
                  </div>
                )}

                {/* Whitelist Access code */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-slate-500">Access Level</span>
                  <select
                    value={mobileContact.whitelistStatus}
                    onChange={(e) => {
                      handleStatusChange(mobileContact.id, e.target.value as Contact['whitelistStatus']);
                    }}
                    className="bg-transparent text-slate-900 font-bold outline-none uppercase text-right cursor-pointer"
                  >
                    <option value="normal">NORMAL</option>
                    <option className="text-emerald-600" value="always_allow">🟢 ALWAYS ALLOW</option>
                    <option className="text-blue-600" value="whitelist_only">🔵 WHITELIST ONLY</option>
                    <option className="text-red-600" value="blocked">🔴 BLOCKED</option>
                  </select>
                </div>
              </div>

              {/* Quick action card buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditingContact(mobileContact);
                    setIsAddModalOpen(true);
                    setSelectedMobileDetailId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold text-center hover:bg-slate-200 cursor-pointer"
                >
                  📝 Edit
                </button>
                <button
                  onClick={() => {
                    handleDeleteContact(mobileContact.id);
                    setSelectedMobileDetailId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold text-center hover:bg-red-100 cursor-pointer"
                >
                  🗑️ Delete
                </button>
              </div>

              {mobileContact.phone && (
                <a
                  href={`tel:${mobileContact.phone}`}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase py-3.5 rounded-xl text-center cursor-pointer shadow-md transition"
                >
                  ☎️ Call Contact
                </a>
              )}

            </div>
          </div>
        );
      })()}

      {/* Add / Edit Form Modal Dialog */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingContact(null); }}
        onSave={handleSaveContact}
        editingContact={editingContact}
      />

    </div>
  );
}
