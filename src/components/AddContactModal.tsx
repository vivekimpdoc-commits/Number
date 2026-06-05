/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone, Mail, Building, Briefcase, Bookmark, Star, MessageSquare } from 'lucide-react';
import { Contact } from '../types';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contactData: Partial<Contact>) => void;
  editingContact: Contact | null;
}

export function AddContactModal({ isOpen, onClose, onSave, editingContact }: AddContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [label, setLabel] = useState<Contact['label']>('Custom');
  const [whitelistStatus, setWhitelistStatus] = useState<Contact['whitelistStatus']>('normal');
  const [notes, setNotes] = useState('');
  const [starred, setStarred] = useState(false);

  // Sync state if editing
  useEffect(() => {
    if (editingContact) {
      setName(editingContact.name || '');
      setPhone(editingContact.phone || '');
      setEmail(editingContact.email || '');
      setDesignation(editingContact.designation || '');
      setDepartment(editingContact.department || '');
      setLabel(editingContact.label || 'Custom');
      setWhitelistStatus(editingContact.whitelistStatus || 'normal');
      setNotes(editingContact.notes || '');
      setStarred(!!editingContact.starred);
    } else {
      // Reset values
      setName('');
      setPhone('');
      setEmail('');
      setDesignation('');
      setDepartment('');
      setLabel('Custom');
      setWhitelistStatus('normal');
      setNotes('');
      setStarred(false);
    }
  }, [editingContact, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      designation: designation.trim() || undefined,
      department: department.trim() || undefined,
      label,
      whitelistStatus,
      notes: notes.trim() || undefined,
      starred
    });
    onClose();
  };

  return (
    <div id="add-contact-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/80">
          <h3 className="text-sm font-black text-slate-800 flex items-center font-sans uppercase tracking-wider">
            {editingContact ? '✏️ Edit Officer Record' : '➕ Add Officer / Contact'}
          </h3>
          <button
            id="close-modal-x"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
              <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Full Name <span className="text-rose-500 ml-0.5">*</span>
            </label>
            <input
              id="modal-input-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inspector Rajpal Singh"
              className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition"
            />
          </div>

          {/* Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Phone Number
              </label>
              <input
                id="modal-input-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 97561 72785"
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none font-mono transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Email Address
              </label>
              <input
                id="modal-input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. officer@police.gov.in"
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none font-sans transition"
              />
            </div>
          </div>

          {/* Designation & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                <Briefcase className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Designation / Rank
              </label>
              <input
                id="modal-input-desig"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. PSI, SP, Inspector"
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none font-sans transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                <Building className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Department / Branch
              </label>
              <input
                id="modal-input-dept"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Kotwali Thana, Cyber Cell"
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none font-sans transition"
              />
            </div>
          </div>

          {/* Label Category & Whitelist Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                <Bookmark className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Group Segment Label
              </label>
              <select
                id="modal-input-label"
                value={label}
                onChange={(e) => setLabel(e.target.value as Contact['label'])}
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer font-sans transition"
              >
                <option value="Work">💼 Work / Police Personnel</option>
                <option value="Family">🏡 Family & Closest</option>
                <option value="Emergency">🚨 Emergency Hotline (SOS)</option>
                <option value="Doctors">🩺 Doctors & Medical Helpline</option>
                <option value="School">🏫 School / Academy</option>
                <option value="Delivery">📦 Delivery & Logistics</option>
                <option value="Custom">👤 Custom Citizen Group</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
                🛡️ Access Level Status
              </label>
              <select
                id="modal-input-whitelist"
                value={whitelistStatus}
                onChange={(e) => setWhitelistStatus(e.target.value as Contact['whitelistStatus'])}
                className="w-full bg-slate-50/70 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none cursor-pointer font-sans transition"
              >
                <option value="normal">Normal Line Access</option>
                <option value="always_allow">Always Allow (Priority OK)</option>
                <option value="whitelist_only">Whitelisted Only Access</option>
                <option value="blocked">Blocked / Ignored Access</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 font-sans uppercase tracking-widest mb-1.5 flex items-center">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Notes & Description
            </label>
            <textarea
              id="modal-input-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Operational leader during VIP movement."
              className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none resize-none transition"
            />
          </div>

          {/* Starred Flag */}
          <div className="flex items-center pt-1.5 select-none">
            <input
              id="modal-input-starred"
              type="checkbox"
              checked={starred}
              onChange={(e) => setStarred(e.target.checked)}
              className="w-4.5 h-4.5 rounded-md border-slate-300 bg-white text-blue-650 focus:ring-blue-500/25 focus:ring-2 cursor-pointer transition"
            />
            <label htmlFor="modal-input-starred" className="ml-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer flex items-center font-sans">
              <Star className="w-3.5 h-3.5 mr-1 text-amber-500 fill-amber-400" />
              Star & Bookmark Candidate
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-5 md:-mx-6 -mb-5 md:-mb-6 p-4 md:p-5 mt-5">
            <button
              id="cancel-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-sans text-slate-655 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-modal-btn"
              type="submit"
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider font-sans text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 rounded-xl shadow-md shadow-blue-500/10 transition cursor-pointer flex items-center"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
