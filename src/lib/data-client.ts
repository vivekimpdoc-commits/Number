/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact, PaginatedContactsResponse } from '../types';

export type StorageMode = 'cloud' | 'local';

const DEFAULT_MOCK_CONTACTS: Contact[] = [
  {
    id: 'mock-1',
    name: 'Police Control Room (SOS)',
    phone: '112',
    designation: 'Central Dispatch',
    department: 'Emergency Response',
    label: 'Emergency',
    whitelistStatus: 'always_allow',
    notes: 'National universal police and medical helpline. Priority routing.',
    starred: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-2',
    name: 'Inspector Sanjay Sharma',
    phone: '+919876543210',
    designation: 'SHO (Station House Officer)',
    department: 'Tehsil Divisional Headquarter',
    label: 'Work',
    whitelistStatus: 'whitelist_only',
    notes: 'Primary station head. Handles high-importance crime briefings.',
    starred: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-3',
    name: 'ACP Kavita Rao (Cyber Cell)',
    phone: '+919012345678',
    designation: 'Assistant Commissioner of Police',
    department: 'Cyber Crime Investigation Division',
    label: 'Work',
    whitelistStatus: 'whitelist_only',
    notes: 'Commanding officer for cyber cell and digital forensics.',
    starred: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-4',
    name: 'Brajpal News Tdl',
    phone: '+919756172785',
    designation: 'Chief News Correspondent',
    department: 'Tundla Media Network',
    label: 'Custom',
    whitelistStatus: 'normal',
    notes: 'Press & Media contact. Covers local tehsil updates.',
    starred: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-5',
    name: 'Brejesh Mishra Svn',
    phone: '+919690827555',
    designation: 'Journalist Bureau Chief',
    department: 'Sivan Press Bureau',
    label: 'Custom',
    whitelistStatus: 'normal',
    notes: 'Media reporter. Local public relation updates.',
    starred: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-6',
    name: 'Dr. Ramesh Kumar (Fortis)',
    phone: '+919811223344',
    designation: 'Senior Medical Superintendent',
    department: 'Trauma & Emergency Care',
    label: 'Doctors',
    whitelistStatus: 'whitelist_only',
    notes: 'Emergency hospital emergency liaison officer.',
    starred: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-7',
    name: 'Meera Sharma (Home)',
    phone: '+919123456789',
    designation: 'Family Liaison',
    department: 'Home',
    label: 'Family',
    whitelistStatus: 'always_allow',
    notes: 'Personal emergency contact (Spouse). Priority ring.',
    starred: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-8',
    name: 'Superintendent of Police Office',
    phone: '+919988776655',
    designation: 'District Commander Liaison',
    department: 'District Headquarters',
    label: 'Work',
    whitelistStatus: 'always_allow',
    notes: 'SP command desk line for quick escalations and briefings.',
    starred: true,
    createdAt: new Date().toISOString()
  }
];

// Helper to get active storage mode
export function getStoredMode(): StorageMode {
  // Always default to local mode to support static hosting without backend
  const saved = localStorage.getItem('copbook_storage_mode');
  if (saved === 'cloud') return 'cloud';
  return 'local';
}

export function setStoredMode(mode: StorageMode) {
  localStorage.setItem('copbook_storage_mode', mode);
}

// Ensure local contacts exist in localStorage
function getLocalContacts(): Contact[] {
  const data = localStorage.getItem('copbook_local_contacts');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing local contacts', e);
    }
  }
  // Populate with Mock entries on first launch
  localStorage.setItem('copbook_local_contacts', JSON.stringify(DEFAULT_MOCK_CONTACTS));
  return [...DEFAULT_MOCK_CONTACTS];
}

function saveLocalContacts(contacts: Contact[]) {
  localStorage.setItem('copbook_local_contacts', JSON.stringify(contacts));
}

// Inline File Parsing logic (Replicated to support offline mode)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

function autoCategorizeLabel(name: string, meta = ''): Contact['label'] {
  const combined = (name + ' ' + meta).toLowerCase();

  if (combined.includes('wife') || combined.includes('son') || combined.includes('daughter') || combined.includes('papa') || combined.includes('mom') || combined.includes('mother') || combined.includes('father') || combined.includes('bhai') || combined.includes('sister') || combined.includes('home')) {
    return 'Family';
  }
  if (combined.includes('control') || combined.includes('sos') || combined.includes('emergency') || combined.includes('ambulance') || combined.includes('fire') || combined.includes('police line')) {
    return 'Emergency';
  }
  if (combined.includes('dr.') || combined.includes('doctor') || combined.includes('hospital') || combined.includes('clinic') || combined.includes('physician')) {
    return 'Doctors';
  }
  if (combined.includes('school') || combined.includes('teacher') || combined.includes('college') || combined.includes('school bus') || combined.includes('principal')) {
    return 'School';
  }
  if (combined.includes('delivery') || combined.includes('amazon') || combined.includes('flipkart') || combined.includes('zomato') || combined.includes('swiggy') || combined.includes('courier')) {
    return 'Delivery';
  }

  const copKeywords = ['sp', 'dsp', 'asp', 'sho', 'inspector', 'psi', 'asi', 'constable', 'hc', 'thana', 'officer', 'police', 'commissioner', 'ig', 'dig', 'dy.sp', 'chowki', 'spy', 'informant', 'source'];
  for (const k of copKeywords) {
    if (combined.includes(k)) {
      return 'Work';
    }
  }

  return 'Custom';
}

export function localParseVCF(vcfContent: string): Partial<Contact>[] {
  const contacts: Partial<Contact>[] = [];
  const cards = vcfContent.split(/\bBEGIN:VCARD\b/i);

  for (const card of cards) {
    if (!card.trim()) continue;

    const fnMatch = card.match(/^FN(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const nMatch = card.match(/^N(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    
    let name = '';
    if (fnMatch && fnMatch[1]) {
      name = fnMatch[1].trim();
    } else if (nMatch && nMatch[1]) {
      const parts = nMatch[1].split(';').map(p => p.trim()).filter(Boolean);
      name = parts.reverse().join(' ');
    }

    const telMatches = [...card.matchAll(/^TEL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const emails = [...card.matchAll(/^EMAIL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const noteMatch = card.match(/^NOTE(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const orgMatch = card.match(/^ORG(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);

    const notes = [
      orgMatch && orgMatch[1] ? `Org: ${orgMatch[1].trim()}` : '',
      noteMatch && noteMatch[1] ? noteMatch[1].trim() : ''
    ].filter(Boolean).join('. ');

    const email = emails[0] && emails[0][1] ? emails[0][1].trim() : undefined;

    const uniquePhones = Array.from(new Set(telMatches.map(m => m[1].replace(/[^\d+]/g, ''))))
      .filter(Boolean);

    if (uniquePhones.length > 0) {
      for (const phone of uniquePhones) {
        contacts.push({
          name: name || 'Unnamed Contact',
          phone,
          email,
          notes: notes || undefined,
          label: autoCategorizeLabel(name, notes),
          whitelistStatus: 'normal'
        });
      }
    } else if (name) {
      contacts.push({
        name,
        phone: '',
        email,
        notes: notes || undefined,
        label: 'Custom',
        whitelistStatus: 'normal'
      });
    }
  }

  return contacts;
}

export function localParseCSV(csvContent: string): Partial<Contact>[] {
  const contacts: Partial<Contact>[] = [];
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 1) return [];

  const header = parseCSVLine(lines[0]);
  if (!header) return [];

  let nameIdx = -1;
  let phoneIdx = -1;
  let emailIdx = -1;
  let notesIdx = -1;
  let deptIdx = -1;
  let desigIdx = -1;
  let labelIdx = -1;

  header.forEach((col, idx) => {
    const c = col.toLowerCase().trim();
    if (c.includes('name') || c === 'fn' || c === 'title') {
      if (nameIdx === -1 || c === 'name' || c === 'full name') nameIdx = idx;
    } else if (c.includes('phone') || c.includes('tel') || c.includes('mob') || c.includes('contact') || c === 'number') {
      phoneIdx = idx;
    } else if (c.includes('email') || c === 'mail') {
      emailIdx = idx;
    } else if (c.includes('note') || c.includes('remark') || c.includes('desc')) {
      notesIdx = idx;
    } else if (c.includes('dept') || c.includes('department') || c.includes('branch')) {
      deptIdx = idx;
    } else if (c.includes('designation') || c.includes('rank') || c.includes('post') || c.includes('role')) {
      desigIdx = idx;
    } else if (c.includes('group') || c.includes('label') || c === 'category') {
      labelIdx = idx;
    }
  });

  if (nameIdx === -1 && header.length > 0) nameIdx = 0;
  if (phoneIdx === -1 && header.length > 1) phoneIdx = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCSVLine(line);
    if (!parts || parts.length === 0) continue;

    const rawName = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx].trim() : '';
    const rawPhone = phoneIdx !== -1 && parts[phoneIdx] ? parts[phoneIdx].trim() : '';
    const rawEmail = emailIdx !== -1 && parts[emailIdx] ? parts[emailIdx].trim() : undefined;
    const rawNotes = notesIdx !== -1 && parts[notesIdx] ? parts[notesIdx].trim() : '';
    const rawDept = deptIdx !== -1 && parts[deptIdx] ? parts[deptIdx].trim() : undefined;
    const rawDesig = desigIdx !== -1 && parts[desigIdx] ? parts[desigIdx].trim() : undefined;
    const rawLabel = labelIdx !== -1 && parts[labelIdx] ? parts[labelIdx].trim() : '';

    const phone = rawPhone.replace(/[^\d+]/g, '');
    if (!rawName && !phone) continue;

    let parsedLabel: Contact['label'] = 'Custom';
    const lLower = rawLabel.toLowerCase();
    if (lLower.includes('family')) parsedLabel = 'Family';
    else if (lLower.includes('work') || lLower.includes('office') || lLower.includes('police')) parsedLabel = 'Work';
    else if (lLower.includes('emergency') || lLower.includes('sos')) parsedLabel = 'Emergency';
    else if (lLower.includes('doctor') || lLower.includes('medical') || lLower.includes('hospital')) parsedLabel = 'Doctors';
    else if (lLower.includes('school') || lLower.includes('college')) parsedLabel = 'School';
    else if (lLower.includes('delivery') || lLower.includes('courier')) parsedLabel = 'Delivery';
    else {
      parsedLabel = autoCategorizeLabel(rawName, rawNotes || rawDept || rawDesig);
    }

    contacts.push({
      name: rawName || 'Unnamed Contact',
      phone,
      email: rawEmail || undefined,
      notes: rawNotes || undefined,
      department: rawDept || undefined,
      designation: rawDesig || undefined,
      label: parsedLabel,
      whitelistStatus: 'normal'
    });
  }

  return contacts;
}

// URN-like client data router
export const DataClient = {
  // Query multiple entries (paginated, sorted, filtered)
  async queryContacts(params: {
    page: number;
    limit: number;
    search: string;
    label: string;
    whitelistStatus: string;
    starred: boolean;
    sortBy: string;
  }): Promise<PaginatedContactsResponse> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const qParams = new URLSearchParams({
          page: String(params.page),
          limit: String(params.limit),
          search: params.search,
          label: params.label,
          whitelistStatus: params.whitelistStatus,
          starred: params.starred ? 'true' : 'false',
          sortBy: params.sortBy
        });

        const res = await fetch(`/api/contacts?${qParams.toString()}`);
        if (!res.ok) throw new Error('Error returned from hosted booklet database');
        return await res.json();
      } catch (err) {
        console.warn('Cloud database unreachable, auto-falling back to Phone Storage:', err);
        // Fallback to local on connection fail
      }
    }

    // LOCAL STORAGE SOURCE (Device standalone mode)
    const all = getLocalContacts();
    let filtered = [...all];

    const searchLower = params.search.toLowerCase().trim();
    if (searchLower) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.phone.includes(searchLower) ||
        (c.designation && c.designation.toLowerCase().includes(searchLower)) ||
        (c.department && c.department.toLowerCase().includes(searchLower)) ||
        (c.notes && c.notes.toLowerCase().includes(searchLower))
      );
    }

    if (params.label) {
      filtered = filtered.filter(c => c.label === params.label);
    }

    if (params.whitelistStatus) {
      filtered = filtered.filter(c => c.whitelistStatus === params.whitelistStatus);
    }

    if (params.starred) {
      filtered = filtered.filter(c => c.starred);
    }

    // Sort matching Server algorithms
    filtered.sort((a, b) => {
      switch (params.sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'created_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'starred':
          if (a.starred && !b.starred) return -1;
          if (!a.starred && b.starred) return 1;
          return a.name.localeCompare(b.name);
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    const totalCount = all.length;
    const filteredCount = filtered.length;
    const totalPages = Math.ceil(filteredCount / params.limit);
    const startIndex = (params.page - 1) * params.limit;
    const paginated = filtered.slice(startIndex, startIndex + params.limit);

    const stats = {
      total: totalCount,
      family: all.filter(c => c.label === 'Family').length,
      work: all.filter(c => c.label === 'Work').length,
      emergency: all.filter(c => c.label === 'Emergency').length,
      doctors: all.filter(c => c.label === 'Doctors').length,
      school: all.filter(c => c.label === 'School').length,
      delivery: all.filter(c => c.label === 'Delivery').length,
      custom: all.filter(c => c.label === 'Custom').length,
      alwaysAllow: all.filter(c => c.whitelistStatus === 'always_allow').length,
      whitelistOnly: all.filter(c => c.whitelistStatus === 'whitelist_only').length,
    };

    return {
      contacts: paginated,
      totalCount,
      filteredCount,
      page: params.page,
      limit: params.limit,
      totalPages,
      stats
    };
  },

  // Save unique contact (Add/Edit)
  async saveContact(contactData: Partial<Contact>, id?: string): Promise<Contact> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const url = id ? `/api/contacts/${id}` : '/api/contacts';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactData)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Can not sync with host database. Saving local copy:', err);
      }
    }

    // Save locally
    const all = getLocalContacts();
    let finalContact: Contact;

    if (id) {
      const idx = all.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Local contact not found');
      
      finalContact = {
        ...all[idx],
        name: contactData.name !== undefined ? contactData.name.trim() : all[idx].name,
        phone: contactData.phone !== undefined ? contactData.phone.replace(/[^\d+]/g, '') : all[idx].phone,
        email: contactData.email !== undefined ? contactData.email : all[idx].email,
        designation: contactData.designation !== undefined ? contactData.designation : all[idx].designation,
        department: contactData.department !== undefined ? contactData.department : all[idx].department,
        label: contactData.label !== undefined ? contactData.label : all[idx].label,
        whitelistStatus: contactData.whitelistStatus !== undefined ? contactData.whitelistStatus : all[idx].whitelistStatus,
        notes: contactData.notes !== undefined ? contactData.notes : all[idx].notes,
        starred: contactData.starred !== undefined ? !!contactData.starred : all[idx].starred
      };
      all[idx] = finalContact;
    } else {
      if (!contactData.name) throw new Error('Name is required');
      finalContact = {
        id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: contactData.name.trim(),
        phone: contactData.phone ? contactData.phone.replace(/[^\d+]/g, '') : '',
        email: contactData.email || undefined,
        designation: contactData.designation || undefined,
        department: contactData.department || undefined,
        label: contactData.label || autoCategorizeLabel(contactData.name, (contactData.designation || '') + ' ' + (contactData.notes || '')),
        whitelistStatus: contactData.whitelistStatus || 'normal',
        notes: contactData.notes || undefined,
        starred: !!contactData.starred,
        createdAt: new Date().toISOString()
      };
      all.push(finalContact);
    }

    saveLocalContacts(all);
    return finalContact;
  },

  // Delete a specific contact
  async deleteContact(id: string): Promise<boolean> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Network link dropped, performing direct delete:', err);
      }
    }

    const all = getLocalContacts();
    const filtered = all.filter(c => c.id !== id);
    saveLocalContacts(filtered);
    return true;
  },

  // Change whitelist status of unique item quickly
  async changeStatus(id: string, status: Contact['whitelistStatus']): Promise<boolean> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch(`/api/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whitelistStatus: status })
        });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Network inactive. Updating status locally:', err);
      }
    }

    const all = getLocalContacts();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx].whitelistStatus = status;
      saveLocalContacts(all);
      return true;
    }
    return false;
  },

  // Change star bookmark status
  async toggleStar(id: string): Promise<boolean> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const all = getLocalContacts(); // To query current state quickly
        const contactObj = all.find(c => c.id === id);
        const nextStarred = contactObj ? !contactObj.starred : true;

        const res = await fetch(`/api/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ starred: nextStarred })
        });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Network inactive. Toggling star locally:', err);
      }
    }

    const all = getLocalContacts();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx].starred = !all[idx].starred;
      saveLocalContacts(all);
      return true;
    }
    return false;
  },

  // Batch delete selected cards
  async batchDelete(ids: string[]): Promise<number> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/contacts/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        if (res.ok) return ids.length;
      } catch (err) {
        console.warn('Failed cloud sync, executing local batch delete:', err);
      }
    }

    const all = getLocalContacts();
    const idSet = new Set(ids);
    const result = all.filter(c => !idSet.has(c.id));
    saveLocalContacts(result);
    return ids.length;
  },

  // Batch whitelist change
  async batchWhitelist(ids: string[], status: Contact['whitelistStatus']): Promise<number> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/contacts/bulk-whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, status })
        });
        if (res.ok) return ids.length;
      } catch (err) {
        console.warn('Network error, updating whitelist level on phone:', err);
      }
    }

    const all = getLocalContacts();
    const idSet = new Set(ids);
    const updated = all.map(c => idSet.has(c.id) ? { ...c, whitelistStatus: status } : c);
    saveLocalContacts(updated);
    return ids.length;
  },

  // Wipe or Reset to Factory Default
  async resetCatalog(resetToDefault = true): Promise<number> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/contacts/clear-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetToDefault })
        });
        if (res.ok) {
          const reply = await res.json();
          // Keep local storage synchronized too
          saveLocalContacts(resetToDefault ? [...DEFAULT_MOCK_CONTACTS] : []);
          return reply.count || 0;
        }
      } catch (err) {
        console.warn('No cloud response. Resetting phone local DB:', err);
      }
    }

    const next = resetToDefault ? [...DEFAULT_MOCK_CONTACTS] : [];
    saveLocalContacts(next);
    return next.length;
  },

  // Direct CSV and VCF File parsing on the client
  async parseImportFileOffline(filename: string, text: string): Promise<Partial<Contact>[]> {
    const nameLower = filename.toLowerCase();
    if (nameLower.endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
      return localParseVCF(text);
    }
    return localParseCSV(text);
  },

  // Direct Bulk import insertion
  async importBulk(contacts: Partial<Contact>[]): Promise<number> {
    const mode = getStoredMode();

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/contacts/import-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts })
        });
        if (res.ok) {
          const reply = await res.json();
          // Match with local
          const localList = getLocalContacts();
          const now = new Date().toISOString();
          contacts.forEach((raw, idx) => {
            localList.push({
              id: `sync-${now}-${idx}`,
              name: String(raw.name),
              phone: String(raw.phone || '').replace(/[^\d+]/g, ''),
              email: raw.email,
              designation: raw.designation,
              department: raw.department,
              label: raw.label || 'Custom',
              whitelistStatus: raw.whitelistStatus || 'normal',
              notes: raw.notes,
              starred: !!raw.starred,
              createdAt: now
            });
          });
          saveLocalContacts(localList);
          return reply.importedCount || contacts.length;
        }
      } catch (err) {
        console.warn('Offline mode bulk-import executing:', err);
      }
    }

    const all = getLocalContacts();
    const now = new Date().toISOString();
    let count = 0;

    contacts.forEach((raw, idx) => {
      if (!raw.name) return;
      all.push({
        id: `local-import-${Date.now()}-${idx}`,
        name: String(raw.name),
        phone: String(raw.phone || '').replace(/[^\d+]/g, ''),
        email: raw.email,
        designation: raw.designation,
        department: raw.department,
        label: raw.label || 'Custom',
        whitelistStatus: raw.whitelistStatus || 'normal',
        notes: raw.notes,
        starred: !!raw.starred,
        createdAt: now
      });
      count++;
    });

    saveLocalContacts(all);
    return count;
  },

  // Generate 2500 stress test contacts instantly
  async generateStressTestContacts(count: number = 2500): Promise<number> {
    const mode = getStoredMode();
    const firstNames = ['Amit', 'Rajesh', 'Sanjay', 'Vikram', 'Ramesh', 'Vijay', 'Rahul', 'Sunil', 'Anil', 'Alok', 'Deepak', 'Manoj', 'Karan', 'Pooja', 'Neha', 'Kavita', 'Meera', 'Ritu', 'Aparna', 'Sneha'];
    const lastNames = ['Sharma', 'Verma', 'Singh', 'Kumar', 'Yadav', 'Gupta', 'Pathak', 'Rao', 'Mishra', 'Dubey', 'Trivedi', 'Joshi', 'Patel', 'Reddy', 'Choudhary', 'Meena', 'Sen', 'Garg', 'Bansal', 'Saxena'];
    const designations = ['Inspector', 'Sub-Inspector', 'Constable', 'DSP', 'ACP', 'Head Constable', 'SPO', 'Journalist', 'Staff Doctor', 'Citizen Member'];
    const departments = ['Tehsil Kotwali', 'Cyber Security Desk', 'Traffic Control Wing', 'Medical Task Force', 'Local Press Office', 'Civil Guard Cell'];
    const labels: Contact['label'][] = ['Work', 'Family', 'Emergency', 'Doctors', 'School', 'Delivery', 'Custom'];
    const whitelistStatuses: Contact['whitelistStatus'][] = ['normal', 'always_allow', 'whitelist_only', 'blocked'];

    const newContacts: Contact[] = [];
    const now = new Date().toISOString();

    for (let i = 1; i <= count; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const desig = designations[Math.floor(Math.random() * designations.length)];
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const label = labels[Math.floor(Math.random() * labels.length)];
      const status = whitelistStatuses[Math.floor(Math.random() * whitelistStatuses.length)];
      const starred = Math.random() < 0.15; // 15% starred

      // Ensure neat clean phone numbers
      const phoneDigits = String(1000000000 + i);
      const phone = `+9198${phoneDigits.slice(2)}`;

      newContacts.push({
        id: `stress-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        name: `${fName} ${lName} (#${i})`,
        phone,
        email: `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@sentinel.in`,
        designation: desig,
        department: dept,
        label,
        whitelistStatus: status,
        notes: `System generated active service record for bulk validation and search scalability assessment. Rank Index: ${i}.`,
        starred,
        createdAt: now
      });
    }

    if (mode === 'cloud') {
      try {
        // Send in batches of 500 to keep JSON payloads lightweight on Cloud Run instances
        const batchSize = 550;
        for (let offset = 0; offset < count; offset += batchSize) {
          const batch = newContacts.slice(offset, offset + batchSize);
          const res = await fetch('/api/contacts/import-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: batch })
          });
          if (!res.ok) throw new Error('Cloud batch commit returned error status');
        }
        // Save locally to keep in duplicate sync
        const localList = getLocalContacts();
        saveLocalContacts([...localList, ...newContacts]);
        return count;
      } catch (err) {
        console.warn('Could not batch upload to cloud database, falling back to instant high-performance offline store:', err);
      }
    }

    // Direct local list preservation
    const all = getLocalContacts();
    saveLocalContacts([...all, ...newContacts]);
    return count;
  }
};
