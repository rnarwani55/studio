

export interface Entry {
  id: number;
  date: string; // YYYY-MM-DD
  time: string;
  type: 'Cash' | 'Online' | 'UDHAR DIYE' | 'Cash Return' | 'Credit Return' | 'Expense' | 'UDHARI PAID';
  details: string;
  amount: number;
}

export interface StaffPayment {
    id: number;
    date: string; // YYYY-MM-DD
    amount: number;
    description: string;
}

export interface StaffMember {
  id: number;
  name: string;
  monthlySalary: number;
  absences: string[]; // Array of YYYY-MM-DD dates
  payments: StaffPayment[];
}

export interface CreditorTransaction {
    id: number;
    date: string; // YYYY-MM-DD
    type: 'jama' | 'len-den'; // jama = payment received (debit), len-den = credit given (credit)
    amount: number;
    description: string;
}

export interface Creditor {
    id: number;
    name: string;
    phone: string;
    transactions: CreditorTransaction[];
}

export interface DeletionRecord {
    id: number;
    timestamp: string; // ISO 8601 format
    description: string;
}

export interface AppState {
    entries: Entry[];
    staff: StaffMember[];
    openingBalance: number;
    selectedDate: string; // YYYY-MM-DD
    creditors: Creditor[];
    deletionLog: DeletionRecord[];
}
