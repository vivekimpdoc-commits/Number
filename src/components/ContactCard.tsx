/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Star, ShieldAlert, CheckCircle, Ban, Edit2, Trash2, Mail, Phone, Tag, Download } from 'lucide-react';
import { Contact } from '../types';

interface ContactCardProps {
  key?: string;
  contact: Contact;
  isSelected: boolean;
  onSelect: (id: string, select: boolean) => void;
  onToggleStar: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Contact['whitelistStatus']) => void;
  onCardClick?: () => void;
  isHighlighted?: boolean;
}

export function ContactCard({
  contact,
  isSelected,
  onSelect,
  onToggleStar,
  onEdit,
  onDelete,
  onStatusChange,
  onCardClick,
  isHighlighted = false
}: ContactCardProps) {
  // Determine avatar color based on label category
  const getAvatarStyles = (label: Contact['label']) => {
    switch (label) {
      case 'Family':
        return 'bg-pink-50 text-pink-700 border-pink-200 font-mono';
      case 'Work':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-mono';
      case 'Emergency':
        return 'bg-red-50 text-red-700 border-red-200 animate-pulse font-mono';
      case 'Doctors':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-mono';
      case 'School':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-mono';
      case 'Delivery':
        return 'bg-teal-50 text-teal-700 border-teal-200 font-mono';
      case 'Custom':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-mono';
    }
  };

  // Get first letter of name
  const firstLetter = contact.name ? contact.name.trim().charAt(0).toUpperCase() : '?';

  // Get tag stylings for whitelistStatus
  const getWhitelistBadge = (status: Contact['whitelistStatus']) => {
    switch (status) {
      case 'always_allow':
        return {
          label: 'Always Allow',
          colors: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mr-1" />
        };
      case 'whitelist_only':
        return {
          label: 'Whitelist Only',
          colors: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-blue-600 mr-1" />
        };
      case 'blocked':
        return {
          label: 'Blocked',
          colors: 'bg-red-50 text-red-800 border-red-200',
          icon: <Ban className="w-3.5 h-3.5 text-red-650 mr-1" />
        };
      case 'normal':
      default:
        return null;
    }
  };

  const badge = getWhitelistBadge(contact.whitelistStatus);

  return (
    <div
      id={`contact-${contact.id}`}
      onClick={(e) => {
        if (onCardClick) onCardClick();
      }}
      className={`relative flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isHighlighted
          ? 'bg-blue-50/50 border-blue-400 border-l-4 border-l-blue-600 shadow-md shadow-blue-100/20'
          : isSelected
          ? 'bg-blue-50/20 border-blue-300 ring-2 ring-blue-500/10'
          : 'bg-white hover:bg-slate-50/70 border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Selection checkbox */}
      <div 
        className="absolute top-4 right-4 md:relative md:top-auto md:right-auto md:mr-3.5 flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          id={`check-${contact.id}`}
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(contact.id, e.target.checked)}
          className="w-4.5 h-4.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-2 cursor-pointer bg-white transition"
        />
      </div>

      {/* Main Details */}
      <div className="flex items-start flex-1 min-w-0 pr-8 md:pr-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shrink-0 tracking-wide font-display shadow-xs ${getAvatarStyles(contact.label)}`}>
          {firstLetter}
        </div>
        
        <div className="ml-3.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="font-bold text-slate-800 truncate text-[14.5px] font-display tracking-tight">
              {contact.name}
            </h4>
            
            {/* Quick Star */}
            <button
              id={`star-btn-${contact.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(contact.id);
              }}
              className="text-slate-300 hover:text-amber-500 hover:scale-110 active:scale-95 transition p-0.5 cursor-pointer"
              title="Bookmark Officer"
            >
              <Star className={`w-3.5 h-3.5 transition-colors ${contact.starred ? 'fill-amber-400 text-amber-500' : 'text-slate-300 hover:text-slate-400'}`} />
            </button>

            {/* Whitelist Tag */}
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border tracking-wider uppercase ${badge.colors}`}>
                {badge.icon}
                {badge.label}
              </span>
            )}

            {/* Label category indicator */}
            <span className="inline-flex items-center text-[9px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200/80 uppercase tracking-widest font-mono font-extrabold shadow-2xs">
              <Tag className="w-2.5 h-2.5 mr-1 text-slate-400" />
              {contact.label}
            </span>
          </div>

          {/* Phone & Sub-details */}
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center text-xs text-slate-500 gap-y-1 sm:gap-x-4">
            <span className="flex items-center text-slate-700 font-mono font-medium">
              <Phone className="w-3.5 h-3.5 text-blue-500/60 mr-1 shrink-0" />
              {contact.phone || <em className="text-slate-300 text-xs">No number</em>}
            </span>

            {contact.email && (
              <span className="flex items-center text-slate-400 truncate font-mono text-[11px]">
                <Mail className="w-3.5 h-3.5 text-slate-300 mr-1 shrink-0" />
                {contact.email}
              </span>
            )}

            {(contact.designation || contact.department) && (
              <span className="text-[10px] font-mono font-bold bg-slate-100/70 text-slate-600 py-0.5 px-2 rounded-md border border-slate-200/65 truncate">
                {[contact.designation, contact.department].filter(Boolean).join(' • ')}
              </span>
            )}
          </div>

          {/* Notes display */}
          {contact.notes && (
            <p className="mt-2 text-[11.5px] text-slate-500 line-clamp-1 italic max-w-xl bg-slate-50/50 px-2 py-1 rounded-md border border-slate-150 leading-relaxed">
              "{contact.notes}"
            </p>
          )}
        </div>
      </div>

      {/* Quick Action drop-downs / buttons */}
      <div 
        className="mt-3 md:mt-0 flex flex-wrap items-center gap-1.5 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0 select-none cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Whitelist Selector */}
        <select
          id={`status-select-${contact.id}`}
          value={contact.whitelistStatus}
          onChange={(e) => onStatusChange(contact.id, e.target.value as Contact['whitelistStatus'])}
          className="bg-slate-50 hover:bg-white hover:border-slate-350 transition-all border border-slate-200/80 text-[10.5px] font-bold text-slate-600 rounded-lg py-1 px-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 cursor-pointer font-sans"
        >
          <option value="normal">NORMAL LINE</option>
          <option value="always_allow">🟢 ALWAYS ALLOW</option>
          <option value="whitelist_only">🔵 WHITELIST ONLY</option>
          <option value="blocked">🔴 BLOCK ACCESS</option>
        </select>

        {/* Edit Button */}
        <button
          id={`edit-btn-${contact.id}`}
          onClick={() => onEdit(contact)}
          title="Edit Details"
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-all cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        {/* Delete Button */}
        <button
          id={`delete-btn-${contact.id}`}
          onClick={() => onDelete(contact.id)}
          title="Delete Contact"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
