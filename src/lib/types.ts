
export interface Entry {
  id: number;
  date: string; // YYYY-MM-DD
  time: string;
  type: 'Cash' | 'Online' | 'UDHAR DIYE' | 'Cash Return' | 'Credit Return' | 'Expense' | 'UDHARI PAID';
  details: string;
  amount: number;
}

export interface StaffPayment {
    date: string; // YYYY-MM-DD
    amount: number;
    description: string;
}

export interface StaffMember {
  id: number;
  name: string;
  absences: string[]; // Array of YYYY-MM-DD dates
  payments: StaffPayment[];
}

export interface InventoryItem {
    supplier: string;
    billno: string;
    billdate: string; // YYYY-MM-DD
    item: string;
    sizeColourDisplay: string;
    qty: number;
    rate: number;
    mrp: number;
    hsn: string;
    cgst: number;
    sgst: number;
}

export interface Creditor {
    name: string;
    amount: number;
}

export interface AppState {
    entries: Entry[];
    staff: StaffMember[];
    openingBalance: number;
    selectedDate: string; // YYYY-MM-DD
    inventory: {
        billData: InventoryItem[];
    };
    creditors: Creditor[];
}
