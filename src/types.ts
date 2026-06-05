/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  designation?: string;
  department?: string;
  label: 'Family' | 'Work' | 'Emergency' | 'Doctors' | 'School' | 'Delivery' | 'Custom';
  whitelistStatus: 'always_allow' | 'whitelist_only' | 'normal' | 'blocked';
  notes?: string;
  starred?: boolean;
  createdAt: string;
}

export interface PaginatedContactsResponse {
  contacts: Contact[];
  totalCount: number;
  filteredCount: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    family: number;
    work: number;
    emergency: number;
    doctors: number;
    school: number;
    delivery: number;
    custom: number;
    alwaysAllow: number;
    whitelistOnly: number;
  };
}

export interface AIParseRequest {
  text: string;
}

export interface AIParseResponse {
  contacts: Omit<Contact, 'id' | 'createdAt'>[];
  summary: string;
}
