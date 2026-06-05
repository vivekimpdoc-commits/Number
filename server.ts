/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Contact, PaginatedContactsResponse } from './src/types';
import { parseCSV, parseVCF, autoCategorizeLabel } from './server-utils';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable large raw payload parser for bulk imports and text copy-pastes
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Database directory & file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'contacts.json');

// Ensure database file exists with initial mock list
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
    notes: 'Commanding officer for cyber cell and digital forensic forensics.',
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

// Load contacts into memory for O(1) searches and pagination without filesystem locks/lags
let inMemoryContacts: Contact[] = [];

function loadContactsFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      inMemoryContacts = JSON.parse(content);
      console.log(`Loaded ${inMemoryContacts.length} contacts from disk.`);
    } else {
      inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
      saveContactsToDisk();
      console.log(`Pre-populated ${inMemoryContacts.length} default contacts.`);
    }
  } catch (err) {
    console.error('Error loading contacts, falling back to empty list:', err);
    inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
  }
}

function saveContactsToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryContacts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save contacts to disk:', err);
  }
}

// Initial load
loadContactsFromDisk();

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log('Gemini AI Client initialized successfully.');
} else {
  console.warn('GEMINI_API_KEY env variable is missing. AI contact parser will be disabled.');
}

// REST API CONTROLLERS

/**
 * GET /api/contacts
 * Returns paginated, searchable, categorizable contacts list and stats
 */
app.get('/api/contacts', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string || '').toLowerCase().trim();
  const label = req.query.label as string || '';
  const whitelistStatus = req.query.whitelistStatus as string || '';
  const starredOnly = req.query.starred === 'true';
  const sortBy = req.query.sortBy as string || 'name_asc'; // name_asc, name_desc, created_desc, starred

  let filtered = [...inMemoryContacts];

  // Apply filters
  if (search) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search) ||
      (c.designation && c.designation.toLowerCase().includes(search)) ||
      (c.department && c.department.toLowerCase().includes(search)) ||
      (c.notes && c.notes.toLowerCase().includes(search))
    );
  }

  if (label) {
    filtered = filtered.filter(c => c.label === label);
  }

  if (whitelistStatus) {
    filtered = filtered.filter(c => c.whitelistStatus === whitelistStatus);
  }

  if (starredOnly) {
    filtered = filtered.filter(c => c.starred);
  }

  // Handle high-performance sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
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

  const totalCount = inMemoryContacts.length;
  const filteredCount = filtered.length;
  const totalPages = Math.ceil(filteredCount / limit);
  const startIndex = (page - 1) * limit;
  const paginatedContacts = filtered.slice(startIndex, startIndex + limit);

  // Compile real-time totals & stats quickly
  const stats = {
    total: totalCount,
    family: inMemoryContacts.filter(c => c.label === 'Family').length,
    work: inMemoryContacts.filter(c => c.label === 'Work').length,
    emergency: inMemoryContacts.filter(c => c.label === 'Emergency').length,
    doctors: inMemoryContacts.filter(c => c.label === 'Doctors').length,
    school: inMemoryContacts.filter(c => c.label === 'School').length,
    delivery: inMemoryContacts.filter(c => c.label === 'Delivery').length,
    custom: inMemoryContacts.filter(c => c.label === 'Custom').length,
    alwaysAllow: inMemoryContacts.filter(c => c.whitelistStatus === 'always_allow').length,
    whitelistOnly: inMemoryContacts.filter(c => c.whitelistStatus === 'whitelist_only').length,
  };

  const response: PaginatedContactsResponse = {
    contacts: paginatedContacts,
    totalCount,
    filteredCount,
    page,
    limit,
    totalPages,
    stats
  };

  res.json(response);
});

/**
 * POST /api/contacts
 * Handles creation of a single contact with auto-category heuristics
 */
app.post('/api/contacts', (req, res) => {
  const { name, phone, email, designation, department, label, whitelistStatus, notes, starred } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const cleanedPhone = phone ? phone.replace(/[^\d+]/g, '') : '';

  const newContact: Contact = {
    id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    phone: cleanedPhone,
    email: email ? email.trim() : undefined,
    designation: designation ? designation.trim() : undefined,
    department: department ? department.trim() : undefined,
    label: label || autoCategorizeLabel(name, (designation || '') + ' ' + (department || '') + ' ' + (notes || '')),
    whitelistStatus: whitelistStatus || 'normal',
    notes: notes ? notes.trim() : undefined,
    starred: !!starred,
    createdAt: new Date().toISOString()
  };

  inMemoryContacts.push(newContact);
  saveContactsToDisk();

  res.status(201).json(newContact);
});

/**
 * PUT /api/contacts/:id
 * Updates contact properties
 */
app.put('/api/contacts/:id', (req, res) => {
  const id = req.params.id;
  const idx = inMemoryContacts.findIndex(c => c.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }

  const { name, phone, email, designation, department, label, whitelistStatus, notes, starred } = req.body;
  const original = inMemoryContacts[idx];

  const updatedContact: Contact = {
    ...original,
    name: name !== undefined ? name.trim() : original.name,
    phone: phone !== undefined ? phone.replace(/[^\d+]/g, '') : original.phone,
    email: email !== undefined ? (email ? email.trim() : undefined) : original.email,
    designation: designation !== undefined ? (designation ? designation.trim() : undefined) : original.designation,
    department: department !== undefined ? (department ? department.trim() : undefined) : original.department,
    label: label !== undefined ? label : original.label,
    whitelistStatus: whitelistStatus !== undefined ? whitelistStatus : original.whitelistStatus,
    notes: notes !== undefined ? (notes ? notes.trim() : undefined) : original.notes,
    starred: starred !== undefined ? !!starred : original.starred
  };

  inMemoryContacts[idx] = updatedContact;
  saveContactsToDisk();

  res.json(updatedContact);
});

/**
 * DELETE /api/contacts/:id
 * Removes a contact from memory and storage
 */
app.delete('/api/contacts/:id', (req, res) => {
  const id = req.params.id;
  const idx = inMemoryContacts.findIndex(c => c.id === id);

  if (idx === -1) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }

  inMemoryContacts.splice(idx, 1);
  saveContactsToDisk();

  res.json({ success: true, message: 'Contact deleted successfully' });
});

/**
 * POST /api/contacts/bulk-delete
 * Bulk delete items matching an array of IDs
 */
app.post('/api/contacts/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required' });
    return;
  }

  const idSet = new Set(ids);
  inMemoryContacts = inMemoryContacts.filter(c => !idSet.has(c.id));
  saveContactsToDisk();

  res.json({ success: true, count: ids.length });
});

/**
 * POST /api/contacts/bulk-whitelist
 * Bulk update whitelist status for an array of IDs
 */
app.post('/api/contacts/bulk-whitelist', (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    res.status(400).json({ error: 'IDs array and target status are required' });
    return;
  }

  const idSet = new Set(ids);
  inMemoryContacts = inMemoryContacts.map(c => {
    if (idSet.has(c.id)) {
      return { ...c, whitelistStatus: status };
    }
    return c;
  });

  saveContactsToDisk();
  res.json({ success: true, count: ids.length });
});

/**
 * POST /api/contacts/clear-all
 * Drops all contacts and optionally resets to default mock starters
 */
app.post('/api/contacts/clear-all', (req, res) => {
  const { resetToDefault } = req.body;
  
  if (resetToDefault) {
    inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
  } else {
    inMemoryContacts = [];
  }
  
  saveContactsToDisk();
  res.json({ success: true, count: inMemoryContacts.length });
});

/**
 * POST /api/contacts/import-bulk
 * Inserts directly parsed listings into database
 */
app.post('/api/contacts/import-bulk', (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    res.status(400).json({ error: 'Contacts array is required' });
    return;
  }

  const now = new Date().toISOString();
  let count = 0;

  for (const raw of contacts) {
    if (!raw.name) continue;

    const cleanedPhone = raw.phone ? raw.phone.replace(/[^\d+]/g, '') : '';
    const newContact: Contact = {
      id: `c-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${count}`,
      name: String(raw.name).trim(),
      phone: cleanedPhone,
      email: raw.email ? String(raw.email).trim() : undefined,
      designation: raw.designation ? String(raw.designation).trim() : undefined,
      department: raw.department ? String(raw.department).trim() : undefined,
      label: raw.label || autoCategorizeLabel(raw.name, (raw.designation || '') + ' ' + (raw.department || '') + ' ' + (raw.notes || '')),
      whitelistStatus: raw.whitelistStatus || 'normal',
      notes: raw.notes ? String(raw.notes).trim() : undefined,
      starred: !!raw.starred,
      createdAt: now
    };

    inMemoryContacts.push(newContact);
    count++;
  }

  if (count > 0) {
    saveContactsToDisk();
  }

  res.json({ success: true, importedCount: count, total: inMemoryContacts.length });
});

/**
 * POST /api/contacts/import-file
 * Handles file parsing (vCard or CSV) with scalable chunking to prevent crash/lag
 */
app.post('/api/contacts/import-file', (req, res) => {
  const { filename, content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  let parsed: Partial<Contact>[] = [];
  const nameLower = (filename || '').toLowerCase();

  try {
    if (nameLower.endsWith('.vcf') || content.includes('BEGIN:VCARD')) {
      parsed = parseVCF(content);
    } else {
      // Default to CSV
      parsed = parseCSV(content);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file: ' + (err as Error).message });
    return;
  }

  res.json({
    success: true,
    parsedCount: parsed.length,
    preview: parsed.slice(0, 5),
    fullList: parsed
  });
});

/**
 * POST /api/contacts/ai-parse
 * Uses server-side Gemini 3.5-flash to intelligently extract a structured roster list from raw text
 */
app.post('/api/contacts/ai-parse', async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Text input is required' });
    return;
  }

  if (!ai) {
    res.status(503).json({ error: 'AI Contact Parser is temporarily unavailable. GEMINI_API_KEY is not configured.' });
    return;
  }

  try {
    const prompt = `Analyze the following raw text list (which may contain a duty roster, WhatsApp message, contact details, notes, or incident numbers) of a team/area. Extract all recognizable individuals with their telephone or mobile phone numbers.
    Categorize each into one of the designated categories based on high-probability details: 'Family', 'Work', 'Emergency', 'Doctors', 'School', 'Delivery', or 'Custom' (e.g. Work is highly appropriate for rank-bearing police personnel, Custom for journalists or ordinary citizens, Emergency for hotlines). 
    If a contact has a rank or title, resolve it into "designation" (e.g. PSI, ASI, SHO, SP, Inspector, Constable, Doctor, Chief Correspondent, Citizen). Resolve organization or station name into "department".
    Provide a robust analysis. Keep all telephone digits intact (retaining leading '+' or '0' codes where appropriate).

    Raw input content:
    """
    ${text}
    """`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional administrative coordinator assisting Indian Police Officers. You accurately extract structured contact profiles from noisy rosters, shift lists, and logs.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['contacts', 'summary'],
          properties: {
            summary: {
              type: Type.STRING,
              description: "A short, elegant summary detailing what police department, roster, or division details were parsed, and how many contacts were located."
            },
            contacts: {
              type: Type.ARRAY,
              description: "List of cleanly parsed contact structures extracted",
              items: {
                type: Type.OBJECT,
                required: ['name', 'phone', 'label'],
                properties: {
                  name: { type: Type.STRING, description: "Full name of the contact. Include rank/designation if appropriate, but clean up messy symbols." },
                  phone: { type: Type.STRING, description: "Correctly extracted raw telephone / cellphone number (e.g., +919000012345 or similar)." },
                  email: { type: Type.STRING, description: "Parsed email address, if any." },
                  designation: { type: Type.STRING, description: "Police rank, title, post, or designation (e.g., PSI, Constable, Inspector, News Bureau Chief, Merchant)." },
                  department: { type: Type.STRING, description: "Police station name, crime branch, corporate desk, agency branch, or hospital division." },
                  label: { 
                    type: Type.STRING, 
                    description: "Set exactly to one of: 'Family', 'Work', 'Emergency', 'Doctors', 'School', 'Delivery', 'Custom'."
                  },
                  notes: { type: Type.STRING, description: "Additional details parsed such as working shift timings, address remarks, or citizen notes." }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Empety response text from Gemini');
    }

    const parsedJson = JSON.parse(resultText.trim());
    res.json(parsedJson);

  } catch (err) {
    console.error('Gemini contact parsing failed:', err);
    res.status(500).json({ error: 'Gemini AI was unable to parse this input: ' + (err as Error).message });
  }
});


// Serve static frontend compiled files in production, integrate Vite middleware during dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CopContact Application server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
