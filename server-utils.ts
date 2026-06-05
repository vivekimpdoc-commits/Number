/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact } from './src/types';

/**
 * Parses VCF (vCard) context string into a list of partial Contacts.
 * Supports FN (Full Name), TEL (Telephone), EMAIL, ORG, NOTE, etc.
 */
export function parseVCF(vcfContent: string): Partial<Contact>[] {
  const contacts: Partial<Contact>[] = [];
  const cards = vcfContent.split(/\bBEGIN:VCARD\b/i);

  for (const card of cards) {
    if (!card.trim()) continue;

    // Extract fields using Regex
    const fnMatch = card.match(/^FN(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const nMatch = card.match(/^N(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    
    // Fallback names
    let name = '';
    if (fnMatch && fnMatch[1]) {
      name = fnMatch[1].trim();
    } else if (nMatch && nMatch[1]) {
      // N:LastName;FirstName;MiddleName;;
      const parts = nMatch[1].split(';').map(p => p.trim()).filter(Boolean);
      // Construct a friendly name from N parts
      name = parts.reverse().join(' ');
    }

    // Extract all telephones
    const telMatches = [...card.matchAll(/^TEL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const emails = [...card.matchAll(/^EMAIL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const noteMatch = card.match(/^NOTE(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const orgMatch = card.match(/^ORG(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);

    const notes = [
      orgMatch && orgMatch[1] ? `Org: ${orgMatch[1].trim()}` : '',
      noteMatch && noteMatch[1] ? noteMatch[1].trim() : ''
    ].filter(Boolean).join('. ');

    const email = emails[0] && emails[0][1] ? emails[0][1].trim() : undefined;

    // A single Card can have multiple phone numbers; create entries for distinct numbers if found
    const uniquePhones = Array.from(new Set(telMatches.map(m => sanitizeFilePhone(m[1]))))
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
      // Contact has a name but no phone parsed directly - keeper
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

/**
 * Parses a standard contact CSV file.
 * Handles Name, Phone, Email, Note, Department columns flexibly.
 */
export function parseCSV(csvContent: string): Partial<Contact>[] {
  const contacts: Partial<Contact>[] = [];
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 1) return [];

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]);
  if (!header) return [];

  let nameIdx = -1;
  let phoneIdx = -1;
  let emailIdx = -1;
  let notesIdx = -1;
  let deptIdx = -1;
  let desigIdx = -1;
  let labelIdx = -1;

  // Flexible column mapping
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

  // Fallbacks if no columns mapped
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

    const phone = sanitizeFilePhone(rawPhone);
    if (!rawName && !phone) continue;

    // Map labels
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

/**
 * Handles CSV split respecting double quotes.
 */
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

/**
 * Strip invalid characters from imported phone numbers
 */
function sanitizeFilePhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces, hyphens, parentheses, but keep + and digits
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Basic heuristics to auto-categorize contact names/notes into useful Police segments.
 */
export function autoCategorizeLabel(name: string, meta = ''): Contact['label'] {
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
  // Cops/ranks go to Work label by default
  const copKeywords = ['sp', 'dsp', 'asp', 'sho', 'inspector', 'psi', 'asi', 'constable', 'hc', 'thana', 'officer', 'police', 'commissioner', 'ig', 'dig', 'dy.sp', 'chowki', 'spy', 'informant', 'source'];
  for (const k of copKeywords) {
    if (combined.includes(k)) {
      return 'Work';
    }
  }

  return 'Custom';
}
