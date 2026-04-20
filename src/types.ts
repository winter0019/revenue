export interface Category {
  id: string;
  name: string;
  defaultPrice: number;
  color: string;
}

export interface Vendor {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  totalDue: number;
  totalPaid: number;
  status: 'Paid' | 'Not Paid' | 'Partial';
  lastPaymentDate?: string;
  phone?: string;
}

export interface Payment {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  date: string;
  receiptId: string;
  collectedBy: string;
  collectorName: string;
  notes?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'staff';
  name: string;
}
