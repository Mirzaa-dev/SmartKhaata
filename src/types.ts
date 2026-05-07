/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  phone: string;
  userType: 'shopkeeper' | 'customer';
  shopDetails?: {
    name: string;
    address: string;
    description: string;
  };
  language: 'en' | 'ur' | 'ru' | 'sd';
  createdAt: number;
}

export interface Customer {
  id: string;
  shopkeeperId: string;
  name: string;
  phone: string;
  address?: string;
  photoUrl?: string;
  notes?: string;
  totalUdhaar: number; // Balance
  totalJama: number;
  trustScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  lastTransactionAt: number;
  createdAt: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  shopkeeperId: string;
  type: 'credit' | 'debit'; // credit = shopkeeper gave (udhaar), debit = shopkeeper got (payment)
  amount: number;
  description?: string;
  dueDate?: number;
  items?: string[];
  createdAt: number;
}

export interface TrustReport {
  customerId: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  insights: string;
  likelyToPay: number; // 0-1
  suggestedLimit: number;
}
