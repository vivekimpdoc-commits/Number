var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);

// server-utils.ts
function parseVCF(vcfContent) {
  const contacts = [];
  const cards = vcfContent.split(/\bBEGIN:VCARD\b/i);
  for (const card of cards) {
    if (!card.trim()) continue;
    const fnMatch = card.match(/^FN(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const nMatch = card.match(/^N(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    let name = "";
    if (fnMatch && fnMatch[1]) {
      name = fnMatch[1].trim();
    } else if (nMatch && nMatch[1]) {
      const parts = nMatch[1].split(";").map((p) => p.trim()).filter(Boolean);
      name = parts.reverse().join(" ");
    }
    const telMatches = [...card.matchAll(/^TEL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const emails = [...card.matchAll(/^EMAIL(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/gim)];
    const noteMatch = card.match(/^NOTE(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const orgMatch = card.match(/^ORG(?:;[^:]*)?:[ \t]*(.+?)(?:\r?\n|$)/mi);
    const notes = [
      orgMatch && orgMatch[1] ? `Org: ${orgMatch[1].trim()}` : "",
      noteMatch && noteMatch[1] ? noteMatch[1].trim() : ""
    ].filter(Boolean).join(". ");
    const email = emails[0] && emails[0][1] ? emails[0][1].trim() : void 0;
    const uniquePhones = Array.from(new Set(telMatches.map((m) => sanitizeFilePhone(m[1])))).filter(Boolean);
    if (uniquePhones.length > 0) {
      for (const phone of uniquePhones) {
        contacts.push({
          name: name || "Unnamed Contact",
          phone,
          email,
          notes: notes || void 0,
          label: autoCategorizeLabel(name, notes),
          whitelistStatus: "normal"
        });
      }
    } else if (name) {
      contacts.push({
        name,
        phone: "",
        email,
        notes: notes || void 0,
        label: "Custom",
        whitelistStatus: "normal"
      });
    }
  }
  return contacts;
}
function parseCSV(csvContent) {
  const contacts = [];
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
    if (c.includes("name") || c === "fn" || c === "title") {
      if (nameIdx === -1 || c === "name" || c === "full name") nameIdx = idx;
    } else if (c.includes("phone") || c.includes("tel") || c.includes("mob") || c.includes("contact") || c === "number") {
      phoneIdx = idx;
    } else if (c.includes("email") || c === "mail") {
      emailIdx = idx;
    } else if (c.includes("note") || c.includes("remark") || c.includes("desc")) {
      notesIdx = idx;
    } else if (c.includes("dept") || c.includes("department") || c.includes("branch")) {
      deptIdx = idx;
    } else if (c.includes("designation") || c.includes("rank") || c.includes("post") || c.includes("role")) {
      desigIdx = idx;
    } else if (c.includes("group") || c.includes("label") || c === "category") {
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
    const rawName = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx].trim() : "";
    const rawPhone = phoneIdx !== -1 && parts[phoneIdx] ? parts[phoneIdx].trim() : "";
    const rawEmail = emailIdx !== -1 && parts[emailIdx] ? parts[emailIdx].trim() : void 0;
    const rawNotes = notesIdx !== -1 && parts[notesIdx] ? parts[notesIdx].trim() : "";
    const rawDept = deptIdx !== -1 && parts[deptIdx] ? parts[deptIdx].trim() : void 0;
    const rawDesig = desigIdx !== -1 && parts[desigIdx] ? parts[desigIdx].trim() : void 0;
    const rawLabel = labelIdx !== -1 && parts[labelIdx] ? parts[labelIdx].trim() : "";
    const phone = sanitizeFilePhone(rawPhone);
    if (!rawName && !phone) continue;
    let parsedLabel = "Custom";
    const lLower = rawLabel.toLowerCase();
    if (lLower.includes("family")) parsedLabel = "Family";
    else if (lLower.includes("work") || lLower.includes("office") || lLower.includes("police")) parsedLabel = "Work";
    else if (lLower.includes("emergency") || lLower.includes("sos")) parsedLabel = "Emergency";
    else if (lLower.includes("doctor") || lLower.includes("medical") || lLower.includes("hospital")) parsedLabel = "Doctors";
    else if (lLower.includes("school") || lLower.includes("college")) parsedLabel = "School";
    else if (lLower.includes("delivery") || lLower.includes("courier")) parsedLabel = "Delivery";
    else {
      parsedLabel = autoCategorizeLabel(rawName, rawNotes || rawDept || rawDesig);
    }
    contacts.push({
      name: rawName || "Unnamed Contact",
      phone,
      email: rawEmail || void 0,
      notes: rawNotes || void 0,
      department: rawDept || void 0,
      designation: rawDesig || void 0,
      label: parsedLabel,
      whitelistStatus: "normal"
    });
  }
  return contacts;
}
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^"|"$/g, "").trim());
}
function sanitizeFilePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}
function autoCategorizeLabel(name, meta = "") {
  const combined = (name + " " + meta).toLowerCase();
  if (combined.includes("wife") || combined.includes("son") || combined.includes("daughter") || combined.includes("papa") || combined.includes("mom") || combined.includes("mother") || combined.includes("father") || combined.includes("bhai") || combined.includes("sister") || combined.includes("home")) {
    return "Family";
  }
  if (combined.includes("control") || combined.includes("sos") || combined.includes("emergency") || combined.includes("ambulance") || combined.includes("fire") || combined.includes("police line")) {
    return "Emergency";
  }
  if (combined.includes("dr.") || combined.includes("doctor") || combined.includes("hospital") || combined.includes("clinic") || combined.includes("physician")) {
    return "Doctors";
  }
  if (combined.includes("school") || combined.includes("teacher") || combined.includes("college") || combined.includes("school bus") || combined.includes("principal")) {
    return "School";
  }
  if (combined.includes("delivery") || combined.includes("amazon") || combined.includes("flipkart") || combined.includes("zomato") || combined.includes("swiggy") || combined.includes("courier")) {
    return "Delivery";
  }
  const copKeywords = ["sp", "dsp", "asp", "sho", "inspector", "psi", "asi", "constable", "hc", "thana", "officer", "police", "commissioner", "ig", "dig", "dy.sp", "chowki", "spy", "informant", "source"];
  for (const k of copKeywords) {
    if (combined.includes(k)) {
      return "Work";
    }
  }
  return "Custom";
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "20mb" }));
app.use(import_express.default.urlencoded({ limit: "20mb", extended: true }));
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DATA_FILE = import_path.default.join(DATA_DIR, "contacts.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
var DEFAULT_MOCK_CONTACTS = [
  {
    id: "mock-1",
    name: "Police Control Room (SOS)",
    phone: "112",
    designation: "Central Dispatch",
    department: "Emergency Response",
    label: "Emergency",
    whitelistStatus: "always_allow",
    notes: "National universal police and medical helpline. Priority routing.",
    starred: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-2",
    name: "Inspector Sanjay Sharma",
    phone: "+919876543210",
    designation: "SHO (Station House Officer)",
    department: "Tehsil Divisional Headquarter",
    label: "Work",
    whitelistStatus: "whitelist_only",
    notes: "Primary station head. Handles high-importance crime briefings.",
    starred: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-3",
    name: "ACP Kavita Rao (Cyber Cell)",
    phone: "+919012345678",
    designation: "Assistant Commissioner of Police",
    department: "Cyber Crime Investigation Division",
    label: "Work",
    whitelistStatus: "whitelist_only",
    notes: "Commanding officer for cyber cell and digital forensic forensics.",
    starred: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-4",
    name: "Brajpal News Tdl",
    phone: "+919756172785",
    designation: "Chief News Correspondent",
    department: "Tundla Media Network",
    label: "Custom",
    whitelistStatus: "normal",
    notes: "Press & Media contact. Covers local tehsil updates.",
    starred: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-5",
    name: "Brejesh Mishra Svn",
    phone: "+919690827555",
    designation: "Journalist Bureau Chief",
    department: "Sivan Press Bureau",
    label: "Custom",
    whitelistStatus: "normal",
    notes: "Media reporter. Local public relation updates.",
    starred: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-6",
    name: "Dr. Ramesh Kumar (Fortis)",
    phone: "+919811223344",
    designation: "Senior Medical Superintendent",
    department: "Trauma & Emergency Care",
    label: "Doctors",
    whitelistStatus: "whitelist_only",
    notes: "Emergency hospital emergency liaison officer.",
    starred: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-7",
    name: "Meera Sharma (Home)",
    phone: "+919123456789",
    designation: "Family Liaison",
    department: "Home",
    label: "Family",
    whitelistStatus: "always_allow",
    notes: "Personal emergency contact (Spouse). Priority ring.",
    starred: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-8",
    name: "Superintendent of Police Office",
    phone: "+919988776655",
    designation: "District Commander Liaison",
    department: "District Headquarters",
    label: "Work",
    whitelistStatus: "always_allow",
    notes: "SP command desk line for quick escalations and briefings.",
    starred: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var inMemoryContacts = [];
function loadContactsFromDisk() {
  try {
    if (import_fs.default.existsSync(DATA_FILE)) {
      const content = import_fs.default.readFileSync(DATA_FILE, "utf-8");
      inMemoryContacts = JSON.parse(content);
      console.log(`Loaded ${inMemoryContacts.length} contacts from disk.`);
    } else {
      inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
      saveContactsToDisk();
      console.log(`Pre-populated ${inMemoryContacts.length} default contacts.`);
    }
  } catch (err) {
    console.error("Error loading contacts, falling back to empty list:", err);
    inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
  }
}
function saveContactsToDisk() {
  try {
    import_fs.default.writeFileSync(DATA_FILE, JSON.stringify(inMemoryContacts, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save contacts to disk:", err);
  }
}
loadContactsFromDisk();
var ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new import_genai.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  console.log("Gemini AI Client initialized successfully.");
} else {
  console.warn("GEMINI_API_KEY env variable is missing. AI contact parser will be disabled.");
}
app.get("/api/contacts", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = (req.query.search || "").toLowerCase().trim();
  const label = req.query.label || "";
  const whitelistStatus = req.query.whitelistStatus || "";
  const starredOnly = req.query.starred === "true";
  const sortBy = req.query.sortBy || "name_asc";
  let filtered = [...inMemoryContacts];
  if (search) {
    filtered = filtered.filter(
      (c) => c.name.toLowerCase().includes(search) || c.phone.includes(search) || c.designation && c.designation.toLowerCase().includes(search) || c.department && c.department.toLowerCase().includes(search) || c.notes && c.notes.toLowerCase().includes(search)
    );
  }
  if (label) {
    filtered = filtered.filter((c) => c.label === label);
  }
  if (whitelistStatus) {
    filtered = filtered.filter((c) => c.whitelistStatus === whitelistStatus);
  }
  if (starredOnly) {
    filtered = filtered.filter((c) => c.starred);
  }
  filtered.sort((a, b) => {
    switch (sortBy) {
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "created_desc":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "starred":
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return a.name.localeCompare(b.name);
      case "name_asc":
      default:
        return a.name.localeCompare(b.name);
    }
  });
  const totalCount = inMemoryContacts.length;
  const filteredCount = filtered.length;
  const totalPages = Math.ceil(filteredCount / limit);
  const startIndex = (page - 1) * limit;
  const paginatedContacts = filtered.slice(startIndex, startIndex + limit);
  const stats = {
    total: totalCount,
    family: inMemoryContacts.filter((c) => c.label === "Family").length,
    work: inMemoryContacts.filter((c) => c.label === "Work").length,
    emergency: inMemoryContacts.filter((c) => c.label === "Emergency").length,
    doctors: inMemoryContacts.filter((c) => c.label === "Doctors").length,
    school: inMemoryContacts.filter((c) => c.label === "School").length,
    delivery: inMemoryContacts.filter((c) => c.label === "Delivery").length,
    custom: inMemoryContacts.filter((c) => c.label === "Custom").length,
    alwaysAllow: inMemoryContacts.filter((c) => c.whitelistStatus === "always_allow").length,
    whitelistOnly: inMemoryContacts.filter((c) => c.whitelistStatus === "whitelist_only").length
  };
  const response = {
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
app.post("/api/contacts", (req, res) => {
  const { name, phone, email, designation, department, label, whitelistStatus, notes, starred } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const cleanedPhone = phone ? phone.replace(/[^\d+]/g, "") : "";
  const newContact = {
    id: `c-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    name: name.trim(),
    phone: cleanedPhone,
    email: email ? email.trim() : void 0,
    designation: designation ? designation.trim() : void 0,
    department: department ? department.trim() : void 0,
    label: label || autoCategorizeLabel(name, (designation || "") + " " + (department || "") + " " + (notes || "")),
    whitelistStatus: whitelistStatus || "normal",
    notes: notes ? notes.trim() : void 0,
    starred: !!starred,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  inMemoryContacts.push(newContact);
  saveContactsToDisk();
  res.status(201).json(newContact);
});
app.put("/api/contacts/:id", (req, res) => {
  const id = req.params.id;
  const idx = inMemoryContacts.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const { name, phone, email, designation, department, label, whitelistStatus, notes, starred } = req.body;
  const original = inMemoryContacts[idx];
  const updatedContact = {
    ...original,
    name: name !== void 0 ? name.trim() : original.name,
    phone: phone !== void 0 ? phone.replace(/[^\d+]/g, "") : original.phone,
    email: email !== void 0 ? email ? email.trim() : void 0 : original.email,
    designation: designation !== void 0 ? designation ? designation.trim() : void 0 : original.designation,
    department: department !== void 0 ? department ? department.trim() : void 0 : original.department,
    label: label !== void 0 ? label : original.label,
    whitelistStatus: whitelistStatus !== void 0 ? whitelistStatus : original.whitelistStatus,
    notes: notes !== void 0 ? notes ? notes.trim() : void 0 : original.notes,
    starred: starred !== void 0 ? !!starred : original.starred
  };
  inMemoryContacts[idx] = updatedContact;
  saveContactsToDisk();
  res.json(updatedContact);
});
app.delete("/api/contacts/:id", (req, res) => {
  const id = req.params.id;
  const idx = inMemoryContacts.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  inMemoryContacts.splice(idx, 1);
  saveContactsToDisk();
  res.json({ success: true, message: "Contact deleted successfully" });
});
app.post("/api/contacts/bulk-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: "IDs array is required" });
    return;
  }
  const idSet = new Set(ids);
  inMemoryContacts = inMemoryContacts.filter((c) => !idSet.has(c.id));
  saveContactsToDisk();
  res.json({ success: true, count: ids.length });
});
app.post("/api/contacts/bulk-whitelist", (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    res.status(400).json({ error: "IDs array and target status are required" });
    return;
  }
  const idSet = new Set(ids);
  inMemoryContacts = inMemoryContacts.map((c) => {
    if (idSet.has(c.id)) {
      return { ...c, whitelistStatus: status };
    }
    return c;
  });
  saveContactsToDisk();
  res.json({ success: true, count: ids.length });
});
app.post("/api/contacts/clear-all", (req, res) => {
  const { resetToDefault } = req.body;
  if (resetToDefault) {
    inMemoryContacts = [...DEFAULT_MOCK_CONTACTS];
  } else {
    inMemoryContacts = [];
  }
  saveContactsToDisk();
  res.json({ success: true, count: inMemoryContacts.length });
});
app.post("/api/contacts/import-bulk", (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    res.status(400).json({ error: "Contacts array is required" });
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let count = 0;
  for (const raw of contacts) {
    if (!raw.name) continue;
    const cleanedPhone = raw.phone ? raw.phone.replace(/[^\d+]/g, "") : "";
    const newContact = {
      id: `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}-${count}`,
      name: String(raw.name).trim(),
      phone: cleanedPhone,
      email: raw.email ? String(raw.email).trim() : void 0,
      designation: raw.designation ? String(raw.designation).trim() : void 0,
      department: raw.department ? String(raw.department).trim() : void 0,
      label: raw.label || autoCategorizeLabel(raw.name, (raw.designation || "") + " " + (raw.department || "") + " " + (raw.notes || "")),
      whitelistStatus: raw.whitelistStatus || "normal",
      notes: raw.notes ? String(raw.notes).trim() : void 0,
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
app.post("/api/contacts/import-file", (req, res) => {
  const { filename, content } = req.body;
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  let parsed = [];
  const nameLower = (filename || "").toLowerCase();
  try {
    if (nameLower.endsWith(".vcf") || content.includes("BEGIN:VCARD")) {
      parsed = parseVCF(content);
    } else {
      parsed = parseCSV(content);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to parse file: " + err.message });
    return;
  }
  res.json({
    success: true,
    parsedCount: parsed.length,
    preview: parsed.slice(0, 5),
    fullList: parsed
  });
});
app.post("/api/contacts/ai-parse", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: "Text input is required" });
    return;
  }
  if (!ai) {
    res.status(503).json({ error: "AI Contact Parser is temporarily unavailable. GEMINI_API_KEY is not configured." });
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional administrative coordinator assisting Indian Police Officers. You accurately extract structured contact profiles from noisy rosters, shift lists, and logs.",
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["contacts", "summary"],
          properties: {
            summary: {
              type: import_genai.Type.STRING,
              description: "A short, elegant summary detailing what police department, roster, or division details were parsed, and how many contacts were located."
            },
            contacts: {
              type: import_genai.Type.ARRAY,
              description: "List of cleanly parsed contact structures extracted",
              items: {
                type: import_genai.Type.OBJECT,
                required: ["name", "phone", "label"],
                properties: {
                  name: { type: import_genai.Type.STRING, description: "Full name of the contact. Include rank/designation if appropriate, but clean up messy symbols." },
                  phone: { type: import_genai.Type.STRING, description: "Correctly extracted raw telephone / cellphone number (e.g., +919000012345 or similar)." },
                  email: { type: import_genai.Type.STRING, description: "Parsed email address, if any." },
                  designation: { type: import_genai.Type.STRING, description: "Police rank, title, post, or designation (e.g., PSI, Constable, Inspector, News Bureau Chief, Merchant)." },
                  department: { type: import_genai.Type.STRING, description: "Police station name, crime branch, corporate desk, agency branch, or hospital division." },
                  label: {
                    type: import_genai.Type.STRING,
                    description: "Set exactly to one of: 'Family', 'Work', 'Emergency', 'Doctors', 'School', 'Delivery', 'Custom'."
                  },
                  notes: { type: import_genai.Type.STRING, description: "Additional details parsed such as working shift timings, address remarks, or citizen notes." }
                }
              }
            }
          }
        }
      }
    });
    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empety response text from Gemini");
    }
    const parsedJson = JSON.parse(resultText.trim());
    res.json(parsedJson);
  } catch (err) {
    console.error("Gemini contact parsing failed:", err);
    res.status(500).json({ error: "Gemini AI was unable to parse this input: " + err.message });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CopContact Application server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
