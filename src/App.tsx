import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  where,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { Category, Vendor, Payment, UserProfile, Worker } from './types';
import { INITIAL_CATEGORIES, VENDOR_MAP } from './constants';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
  Wallet,
  ShieldCheck,
  User as UserIcon,
  Menu,
  X,
  Camera,
  QrCode,
  Scan,
  UserCheck,
  IdCard,
  Trash2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

type View = 'dashboard' | 'vendors' | 'payments' | 'admin' | 'verify' | 'workers';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync Profile
        const profileRef = doc(db, 'users', u.uid);
        onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Check if there are any users. If not, this is the first user (Admin)
            const usersSnap = await getDocs(query(collection(db, 'users')));
            const role = usersSnap.empty ? 'admin' : 'staff';
            
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              role: role,
              name: u.displayName || 'User'
            };
            await setDoc(profileRef, newProfile);
          }
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Sync Effect
  useEffect(() => {
    if (!user || !profile) return;

    // Check for verification URL param
    const params = new URLSearchParams(window.location.search);
    const verifyCode = params.get('verify');
    if (verifyCode) {
      setActiveView('verify');
    }

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    const unsubVendors = onSnapshot(query(collection(db, 'vendors'), orderBy('name')), (snap) => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
    });

    const unsubPayments = onSnapshot(query(collection(db, 'payments'), orderBy('date', 'desc')), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });

    const unsubWorkers = onSnapshot(query(collection(db, 'workers'), orderBy('name')), (snap) => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Worker)));
    });

    return () => {
      unsubCategories();
      unsubVendors();
      unsubPayments();
      unsubWorkers();
    };
  }, [user, profile]);

  // Initial Data Seeding
  const seedDatabase = async () => {
    if (!profile || profile.role !== 'admin' || initializing) return;
    setInitializing(true);
    try {
      const catBatch: Record<string, string> = {};
      
      // 1. Categories
      for (const cat of INITIAL_CATEGORIES) {
        const docRef = doc(collection(db, 'categories'));
        await setDoc(docRef, cat);
        catBatch[cat.name] = docRef.id;
      }

      // 2. Vendors
      for (const [catName, vendorList] of Object.entries(VENDOR_MAP)) {
        const catId = catBatch[catName];
        if (!catId) continue;
        const defaultPrice = INITIAL_CATEGORIES.find(c => c.name === catName)?.defaultPrice || 0;

        for (const vName of vendorList) {
          const vDoc = doc(collection(db, 'vendors'));
          await setDoc(vDoc, {
            name: vName,
            categoryId: catId,
            categoryName: catName,
            totalDue: defaultPrice,
            totalPaid: 0,
            status: 'Not Paid'
          });
        }
      }
      alert('Database seeded successfully!');
    } catch (err) {
      console.error(err);
      alert('Error seeding database');
    } finally {
      setInitializing(false);
    }
  };

  // --- Derived State & Analytics ---

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'all' || v.categoryId === categoryFilter;
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [vendors, searchTerm, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalVendors = vendors.length;
    const paidVendors = vendors.filter(v => v.status === 'Paid').length;
    const totalExpected = vendors.reduce((acc, v) => acc + v.totalDue, 0);
    const totalCollected = vendors.reduce((acc, v) => acc + v.totalPaid, 0);
    const outstanding = totalExpected - totalCollected;

    const catData = categories.map(cat => ({
      name: cat.name,
      collected: vendors.filter(v => v.categoryId === cat.id).reduce((acc, v) => acc + v.totalPaid, 0),
      expected: vendors.filter(v => v.categoryId === cat.id).reduce((acc, v) => acc + v.totalDue, 0),
    })).filter(c => c.expected > 0);

    const statusData = [
      { name: 'Paid', value: paidVendors, color: '#10B981' },
      { name: 'Not Paid', value: vendors.filter(v => v.status === 'Not Paid').length, color: '#EF4444' },
      { name: 'Partial', value: vendors.filter(v => v.status === 'Partial').length, color: '#F59E0B' },
    ];

    return { totalVendors, paidVendors, totalExpected, totalCollected, outstanding, catData, statusData };
  }, [vendors, categories]);

  // --- Handlers ---

  const handlePayment = async (vendor: Vendor, amount: number, notes: string = '') => {
    if (!user || !profile) return;
    const receiptId = `R-${Date.now().toString().slice(-6)}`;
    
    try {
      await runTransaction(db, async (transaction) => {
        const vRef = doc(db, 'vendors', vendor.id);
        const vSnap = await transaction.get(vRef);
        if (!vSnap.exists()) throw "Vendor mismatch";
        
        const currentPaid = vSnap.data().totalPaid || 0;
        const newPaid = currentPaid + amount;
        const status = newPaid >= vendor.totalDue ? 'Paid' : newPaid > 0 ? 'Partial' : 'Not Paid';
        
        transaction.update(vRef, {
          totalPaid: newPaid,
          status: status,
          lastPaymentDate: new Date().toISOString()
        });

        const pRef = doc(collection(db, 'payments'));
        transaction.set(pRef, {
          vendorId: vendor.id,
          vendorName: vendor.name,
          amount: amount,
          date: new Date().toISOString(),
          receiptId: receiptId,
          collectedBy: user.uid,
          collectorName: profile.name,
          notes: notes
        });
      });
      alert('Payment recorded successfully!');
    } catch (err) {
      console.error(err);
      alert('Payment failed');
    }
  };

  const addVendor = async (name: string, categoryId: string, phone: string = '', photo: string = '') => {
    if (!profile || profile.role !== 'admin') return;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;

    try {
      await addDoc(collection(db, 'vendors'), {
        name,
        categoryId,
        categoryName: cat.name,
        totalDue: cat.defaultPrice,
        totalPaid: 0,
        status: 'Not Paid',
        phone,
        photo,
        qrCode: `V-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      });
      alert('Vendor added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add vendor');
    }
  };

  const addWorker = async (name: string, role: string, phone: string = '', photo: string = '', vendorId?: string, vendorName?: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      await addDoc(collection(db, 'workers'), {
        name,
        role,
        phone,
        photo,
        vendorId: vendorId || null,
        vendorName: vendorName || null,
        qrCode: `H-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        createdAt: new Date().toISOString()
      });
      alert('Helper registered successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to register helper');
    }
  };

  const deleteWorker = async (id: string) => {
    if (!profile || profile.role !== 'admin') return;
    if (!confirm('Are you sure you want to delete this helper?')) return;
    try {
      await updateDoc(doc(db, 'workers', id), { deleted: true }); // Soft delete
      // Or hard delete:
      // await deleteDoc(doc(db, 'workers', id));
    } catch (err) {
      console.error(err);
    }
  };

  const updateVendorPhoto = async (vendorId: string, photo: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'vendors', vendorId), { photo });
    } catch (err) {
      console.error(err);
      alert('Failed to update photo');
    }
  };

  const updateWorkerPhoto = async (workerId: string, photo: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'workers', workerId), { photo });
    } catch (err) {
      console.error(err);
      alert('Failed to update photo');
    }
  };

  const generateIDCard = async (item: Vendor | Worker, type: 'vendor' | 'worker') => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6]
    });

    const primaryColor = [112, 14, 82]; // NYSC Maroon
    const accentColor = [255, 215, 0]; // Gold accents
    const textColor = [20, 20, 20];

    // Helper for watermark
    const addWatermark = (p: jsPDF) => {
      p.setTextColor(245, 245, 245);
      p.setFontSize(5);
      p.setFont("helvetica", "bold");
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 15; j++) {
          p.text('NYSC', i * 10 - 5, j * 10, { angle: 45 });
        }
      }
    };

    // --- FRONT SIDE ---
    addWatermark(doc);
    
    // Header Decoration
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.triangle(0, 0, 20, 0, 0, 15, 'F');
    doc.triangle(54, 0, 34, 0, 54, 15, 'F');
    doc.rect(15, 0, 24, 5, 'F');

    // Refined Logo Area
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.circle(27, 10, 7, 'S'); // Outer circle
    doc.setFillColor(255, 255, 255);
    doc.circle(27, 10, 6.5, 'F'); // White fill
    
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(3.5);
    doc.setFont("helvetica", "bold");
    doc.text('NATIONAL', 27, 8.5, { align: 'center' });
    doc.text('YOUTH SERVICE', 27, 10.5, { align: 'center' });
    doc.text('CORPS', 27, 12.5, { align: 'center' });

    // Official Identity Text
    doc.setFontSize(7);
    doc.text('Identity', 8, 12);
    doc.setFontSize(10);
    doc.text('CARD', 8, 16);
    
    // Title with clipping protection
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const cardTitle = type === 'vendor' ? 'CAMP MARKET PARTICIPANT' : 'HELPER ID CARD';
    const splitTitle = doc.splitTextToSize(cardTitle, 45);
    doc.text(splitTitle, 27, 26, { align: 'center' });

    // Circular Photo Frame
    const photoX = 27;
    const photoY = 48;
    const photoR = 15; // Slightly smaller to breathe
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.circle(photoX, photoY, photoR, 'S');
    
    if (item.photo) {
      try {
        // Since we can't easily circle clip, we use a nice square frame inside a circle
        doc.addImage(item.photo, 'JPEG', photoX - 11, photoY - 11, 22, 22);
      } catch (e) {
        doc.setFontSize(5);
        doc.text('IMAGE ERROR', photoX, photoY, { align: 'center' });
      }
    }

    // Name Section
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('FULL NAME', 27, 68, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const nameText = item.name.toUpperCase();
    const splitName = doc.splitTextToSize(nameText, 40);
    doc.text(splitName, 27, 72, { align: 'center' });

    // Business/Trade Section
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text('TYPES OF BUSINESS / TRADE', 27, 80, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const businessType = type === 'vendor' ? (item as Vendor).categoryName : `${(item as Worker).vendorName}'s Helper`;
    doc.text(businessType.toUpperCase(), 27, 84, { align: 'center' });

    // Footer Security Code
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(150, 150, 150);
    doc.text(`REG. CODE: ${item.qrCode || 'N/A'}`, 27, 92, { align: 'center' });
    
    // Decorative Bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(5, 94, 44, 1.5, 'F');

    // --- BACK SIDE ---
    doc.addPage([54, 85.6], 'p');
    addWatermark(doc);
    
    // Top Bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 54, 3, 'F');

    // Verification Header
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text('OFFICIAL VERIFICATION', 27, 10, { align: 'center' });

    // Large Verification QR Code
    if (item.qrCode) {
      const verifyUrl = `${window.location.origin}?verify=${item.qrCode}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl);
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.5);
      doc.rect(12, 15, 30, 30, 'S'); // Border for QR
      doc.addImage(qrDataUrl, 'PNG', 13, 16, 28, 28);
      doc.setFontSize(5);
      doc.text('SCAN QR TO VALIDATE STATUS', 27, 46, { align: 'center' });
    }

    // Official Notice
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const notice = "This card remains the property of National Youth Service Corps. Unauthorized usage is strictly prohibited. If found, please return to the Nearest NYSC State Secretariat or Camp Office.";
    const splitNotice = doc.splitTextToSize(notice, 44);
    doc.text(splitNotice, 27, 54, { align: 'center' });

    // Authority Section
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 74, 39, 74);
    doc.setFontSize(5);
    doc.text('HEAD OF CAMP MARKET', 27, 77, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text('AUTHORIZED SIGNATORY', 27, 80, { align: 'center' });

    // Validity
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 82, 54, 3.6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text('VALID FOR 2026 BATCH A ORIENTATION', 27, 84.5, { align: 'center' });

    doc.save(`${type}-ID-${item.name.replace(/\s+/g, '_')}.pdf`);
  };

  const printVendorQR = async (vendor: Vendor) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [50, 50]
    });

    if (vendor.qrCode) {
      const qrDataUrl = await QRCode.toDataURL(vendor.qrCode);
      doc.addImage(qrDataUrl, 'PNG', 5, 5, 40, 40);
      doc.setFontSize(6);
      doc.text(vendor.name.toUpperCase(), 25, 47, { align: 'center' });
      doc.save(`QR-${vendor.name.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const handleExportData = () => {
    const doc = new jsPDF();
    const currentStats = stats;
    const date = format(new Date(), 'dd MMM yyyy, HH:mm');

    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // Navy
    doc.text('MY CAMP MART', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Revenue Summary Report', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${date}`, 105, 37, { align: 'center' });
    doc.text('Katsina Orientation Camp 2026', 105, 42, { align: 'center' });

    // Summary Section
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 50, 190, 50);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text('FINANCIAL SUMMARY', 20, 60);
    doc.setFont("helvetica", "normal");
    
    const summaryData = [
      ['Total Expected Revenue', `NGN ${currentStats.totalExpected.toLocaleString()}`],
      ['Total Collected Revenue', `NGN ${currentStats.totalCollected.toLocaleString()}`],
      ['Outstanding Balance', `NGN ${currentStats.outstanding.toLocaleString()}`],
      ['Collection Progress', `${((currentStats.totalCollected / currentStats.totalExpected) * 100 || 0).toFixed(1)}%`],
      ['Total Vendors Registered', currentStats.totalVendors.toString()]
    ];

    autoTable(doc, {
      startY: 65,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 20, right: 20 }
    });

    // Vendor Table
    doc.setFont("helvetica", "bold");
    const finalY1 = (doc as any).lastAutoTable.finalY;
    doc.text('VENDOR STATUS REGISTRY', 20, finalY1 + 15);
    
    const vendorData = vendors.map(v => [
      v.name,
      v.categoryName,
      `NGN ${v.totalDue.toLocaleString()}`,
      `NGN ${v.totalPaid.toLocaleString()}`,
      v.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: finalY1 + 20,
      head: [['Vendor', 'Category', 'Due', 'Paid', 'Status']],
      body: vendorData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
      margin: { left: 20, right: 20 }
    });

    doc.save(`Camp-Revenue-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const generatePDF = (payment: Payment) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6'
    });

    // Header & Brand
    doc.setFillColor(15, 23, 42); // Navy background for header
    doc.rect(0, 0, 105, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('OFFICIAL RECEIPT', 52.5, 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text('NYSC CAMP MARKET REVENUE SYSTEM', 52.5, 18, { align: 'center' });

    // Transaction Details Header
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.text(`RECEIPT ID: ${payment.receiptId}`, 10, 32);
    doc.text(`DATE: ${format(new Date(payment.date), 'dd MMM yyyy, HH:mm')}`, 10, 36);
    doc.line(10, 38, 95, 38);

    // Vendor Information (Prominent)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text('VENDOR ESTABLISHMENT', 10, 45);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(payment.vendorName.toUpperCase(), 10, 52);
    
    const v = vendors.find(v => v.id === payment.vendorId);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Category: ${v?.categoryName || 'N/A'}`, 10, 57);

    // Payment Information (Prominent)
    doc.line(10, 62, 95, 62);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text('AMOUNT PAID', 10, 68);
    
    doc.setFontSize(16);
    doc.setTextColor(16, 101, 52); // Dark Green
    doc.text(`NGN ${payment.amount.toLocaleString()}.00`, 10, 78);

    // Metadata (Notes & Collector)
    doc.line(10, 82, 95, 82);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    
    if (payment.notes) {
      doc.text(`NOTES: ${payment.notes}`, 10, 88);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`COLLECTED BY: ${payment.collectorName.toUpperCase()}`, 10, 95);

    // Footer Stamp
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(65, 120, 30, 10, 2, 2, 'F');
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(8);
    doc.text('VERIFIED', 80, 126, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6);
    doc.setFont("helvetica", "italic");
    doc.text('This is a computer generated receipt. No signature required.', 52.5, 138, { align: 'center' });

    doc.save(`Receipt-${payment.receiptId}.pdf`);
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-orange-100 p-4 rounded-3xl">
            <TrendingUp className="w-12 h-12 text-orange-600" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">My Camp Mart</h1>
          <p className="text-gray-500">NYSC Market Operations Management System</p>
        </div>
        <button 
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-black text-white hover:bg-gray-900 transition-all font-semibold py-4 rounded-2xl shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#0f172a] text-white border-r border-[#334155]">
        <div className="p-8 flex items-center gap-3">
          <div className="text-[#10b981] font-extrabold text-xl tracking-tighter">MY CAMP MART</div>
        </div>
        
        <nav className="flex-1 px-0 space-y-0">
          <NavItem active={activeView === 'dashboard'} icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" onClick={() => setActiveView('dashboard')} />
          <NavItem active={activeView === 'vendors'} icon={<Users className="w-4 h-4" />} label="Vendor Registry" onClick={() => setActiveView('vendors')} />
          <NavItem active={activeView === 'payments'} icon={<CreditCard className="w-4 h-4" />} label="Payment Logs" onClick={() => setActiveView('payments')} />
          <NavItem active={activeView === 'verify'} icon={<ShieldCheck className="w-4 h-4" />} label="Verification" onClick={() => setActiveView('verify')} />
          {profile?.role === 'admin' && (
            <>
              <NavItem active={activeView === 'workers'} icon={<UserCheck className="w-4 h-4" />} label="Helper IDs" onClick={() => setActiveView('workers')} />
              <NavItem active={activeView === 'admin'} icon={<Settings className="w-4 h-4" />} label="Admin Setup" onClick={() => setActiveView('admin')} />
            </>
          )}
        </nav>

        <div className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-[#1e293b] mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#94a3b8] mb-1">Logged in as {profile?.role}</p>
              <p className="text-sm font-semibold text-white truncate">{profile?.name}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-[#e2e8f0] flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-lg text-[#0f172a]">Revenue Syst.</span>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-[20px] font-bold text-[#0f172a]">My Camp Mart</h1>
            <p className="text-[12px] text-[#64748b]">Operations Dashboard • Katsina Orientation Camp 2026</p>
          </div>

          <div className="flex items-center gap-3">
             {profile?.role === 'admin' && categories.length === 0 && (
               <button 
                onClick={seedDatabase}
                disabled={initializing}
                className="bg-[#10b981] text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-[#059669] transition-all disabled:opacity-50"
               >
                 {initializing ? 'Initializing...' : 'Seed Initial Data'}
               </button>
             )}
             <button 
                onClick={handleExportData}
                className="bg-[#0f172a] text-white px-4 py-2 rounded-md font-semibold text-sm hover:opacity-90 transition-all"
             >
                Export Report
             </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dashboard' && <DashboardView stats={stats} />}
              {activeView === 'vendors' && (
                <VendorsView 
                  vendors={filteredVendors} 
                  categories={categories}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  onPayment={handlePayment}
                  profile={profile}
                  onAddVendor={addVendor}
                  onPrintID={generateIDCard}
                  onPrintQR={printVendorQR}
                  workers={workers}
                  onAddWorker={addWorker}
                  onDeleteWorker={deleteWorker}
                  onUpdatePhoto={updateVendorPhoto}
                />
              )}
              {activeView === 'payments' && <PaymentsView payments={payments} onPrint={generatePDF} />}
              {activeView === 'verify' && <VerifyView vendors={vendors} workers={workers} />}
              {activeView === 'workers' && (
                <WorkersView 
                  workers={workers} 
                  vendors={vendors}
                  onAddWorker={addWorker} 
                  onPrintID={generateIDCard} 
                  onDelete={deleteWorker} 
                  onUpdatePhoto={updateWorkerPhoto}
                />
              )}
              {activeView === 'admin' && <AdminView categories={categories} profile={profile} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <motion.nav 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            className="absolute top-0 bottom-0 left-0 w-64 bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
               <span className="font-bold text-xl">Menu</span>
               <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <button onClick={() => {setActiveView('dashboard'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><LayoutDashboard className="w-5 h-5"/> Overview</button>
              <button onClick={() => {setActiveView('vendors'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><Users className="w-5 h-5"/> Vendor Registry</button>
              <button onClick={() => {setActiveView('payments'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><CreditCard className="w-5 h-5"/> Payment Logs</button>
              <button onClick={() => {setActiveView('verify'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><ShieldCheck className="w-5 h-5"/> Identity Scanner</button>
              {profile?.role === 'admin' && (
                <>
                  <button onClick={() => {setActiveView('workers'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><UserCheck className="w-5 h-5"/> Helper IDs</button>
                  <button onClick={() => {setActiveView('admin'); setMobileMenuOpen(false)}} className="w-full text-left p-3 rounded-xl hover:bg-gray-100 flex items-center gap-3 font-semibold"><Settings className="w-5 h-5"/> Admin Setup</button>
                </>
              )}
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <button onClick={() => signOut(auth)} className="w-full p-3 rounded-xl bg-gray-50 flex items-center gap-3 text-red-500"><LogOut className="w-5 h-5"/> Sign Out</button>
            </div>
          </motion.nav>
        </div>
      )}
    </div>
  );
}

// --- Subviews ---

function VendorDetailsModal({ vendor, categories, workers, onClose, onPrintQR, onAddWorker, onPrintID, onDeleteWorker, onUpdatePhoto }: any) {
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  
  const category = categories.find((c: any) => c.id === vendor.categoryId);
  const maxHelpers = category?.maxHelpers || 1;
  const limitReached = workers.length >= maxHelpers;

  const handlePhotoUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUpdatePhoto(vendor.id, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl w-full max-w-2xl p-0 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[600px]"
      >
        {/* Sidebar: Vendor Profile */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-8 flex flex-col items-center">
          <div className="group relative w-32 h-32 rounded-3xl bg-white shadow-sm overflow-hidden mb-6 border-4 border-white">
            {vendor.photo ? (
              <img src={vendor.photo} className="w-full h-full object-cover transition-all group-hover:blur-[2px]" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200"><TrendingUp size={48} /></div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
              <Camera className="text-white w-8 h-8" />
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpdate} />
            </label>
          </div>
          <h3 className="text-lg font-black text-center text-gray-900 leading-tight mb-1">{vendor.name}</h3>
          <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider mb-6">{vendor.categoryName}</p>
          
          <div className="w-full space-y-4 pt-6 border-t border-gray-200 text-center">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Trade ID Code</p>
              <div className="bg-white p-3 rounded-2xl inline-block shadow-sm mb-3">
                <QRCodeSVG value={vendor.qrCode || vendor.id} size={100} />
              </div>
              <button 
                onClick={onPrintQR}
                className="flex items-center gap-2 mx-auto text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Printer className="w-3 h-3" /> PRINT QR TAG
              </button>
            </div>
            
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
               <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">ID Card Allotment</p>
               <p className="text-base font-black text-emerald-900">{workers.length} / {maxHelpers}</p>
            </div>
          </div>

          <button onClick={onClose} className="mt-auto text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest py-4">Close Profile</button>
        </div>

        {/* Main Content: Helper List */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 shadow-inner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Helper ID Cards
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Official Registry</span>
                </h4>
                <p className="text-xs text-gray-500 mt-1">Enrollment Quota: {workers.length} of {maxHelpers} IDs issued</p>
              </div>
              
              {!limitReached ? (
                <button 
                  onClick={() => setIsAddingStaff(true)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 uppercase tracking-tighter"
                >
                  <Plus className="w-4 h-4" /> Enroll Helper
                </button>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-tight border border-emerald-100/50 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" /> Maximum Quota Reached
                </div>
              )}
            </div>

            <div className="space-y-3">
              {workers.map((w: Worker) => (
                <div key={w.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 transition-all shadow-sm group">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                    {w.photo ? <img src={w.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200 text-xs font-bold">ID</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-tight truncate mb-0.5">{w.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{w.role}</p>
                      <span className="text-[9px] font-mono text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded font-black">{w.qrCode}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => onPrintID(w, 'worker')} className="p-2 text-gray-400 hover:text-emerald-500 bg-gray-50 rounded-lg border border-gray-100">
                      <IdCard className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteWorker(w.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg border border-gray-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {workers.length === 0 && (
                <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <UserCheck className="w-6 h-6 text-gray-200" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No helpers enrolled</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">Issue up to {maxHelpers} ID cards for this vendor</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {isAddingStaff && (
          <AddWorkerModal 
            title={`Register Helper for ${vendor.name}`}
            description="Captured photo and details will be printed on the official helper ID card."
            onClose={() => setIsAddingStaff(false)}
            onSubmit={(n: string, r: string, p: string, ph: string) => {
              onAddWorker(n, r, p, ph, vendor.id, vendor.name);
              setIsAddingStaff(false);
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

function VerifyView({ vendors, workers }: { vendors: Vendor[], workers: Worker[] }) {
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    // Check for query param verification
    const params = new URLSearchParams(window.location.search);
    const verifyCode = params.get('verify');
    if (verifyCode && vendors.length > 0) {
      setTimeout(() => onScanSuccess(verifyCode), 500);
    }

    const startScanner = async () => {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(onScanSuccess, onScanError);
    };

    const onScanSuccess = (decodedText: string) => {
      // Clean up the text (it might be a URL or raw ID)
      let code = decodedText.trim();
      if (code.includes('?verify=')) {
        code = code.split('?verify=')[1];
      }

      // Logic to find vendor or worker
      const vendor = vendors.find(v => v.qrCode === code);
      const worker = workers.find(w => w.qrCode === code);

      if (vendor) {
        setScanResult({ type: 'vendor', data: vendor });
        setError('');
      } else if (worker) {
        setScanResult({ type: 'worker', data: worker });
        setError('');
      } else {
        setError(`Unrecognized Registry Code: ${code}`);
        setScanResult(null);
      }
      
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {
          console.error("Scanner clear error", e);
        }
      }
    };

    const onScanError = (err: any) => {
      // console.warn(err);
    };

    setTimeout(startScanner, 100);

    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [vendors, workers]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-[#e2e8f0] shadow-sm text-center">
        <h2 className="text-xl font-bold mb-2">ID Verification Scanner</h2>
        <p className="text-sm text-gray-500 mb-8">Scan QR codes on ID cards to confirm identity and status</p>
        
        <div id="reader" className="w-full bg-gray-100 rounded-3xl overflow-hidden border-4 border-gray-50"></div>
        
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 flex items-center gap-2 mx-auto text-xs font-bold text-gray-400 uppercase tracking-widest"
        >
          <Scan className="w-4 h-4" /> Reset Scanner
        </button>
      </div>

      <AnimatePresence>
        {scanResult && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-8 rounded-3xl border shadow-xl flex items-center gap-6",
              scanResult.type === 'vendor' ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"
            )}
          >
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-white/50">
              {scanResult.data.photo ? <img src={scanResult.data.photo} className="w-full h-full object-cover" /> : <TrendingUp className="w-8 h-8 text-gray-300" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                  scanResult.type === 'vendor' ? "bg-emerald-200 text-emerald-800" : "bg-blue-200 text-blue-800"
                )}>
                  {scanResult.type === 'vendor' ? 'Vendor' : 'Helper'} verified
                </span>
                {scanResult.type === 'vendor' && (
                   <span className={cn(
                     "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                     scanResult.data.status === 'Paid' ? "bg-green-500 text-white" : "bg-red-500 text-white"
                   )}>
                     {scanResult.data.status}
                   </span>
                )}
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">{scanResult.data.name}</h3>
              <p className="text-sm font-medium text-gray-500">{scanResult.type === 'vendor' ? scanResult.data.categoryName : scanResult.data.role}</p>
              
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 pt-4 border-t border-gray-200/50">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Registry Code</p>
                  <p className="text-xs font-mono font-bold text-gray-700">{scanResult.data.qrCode}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Contact</p>
                  <p className="text-xs font-bold text-gray-700">{scanResult.data.phone || 'Not Provided'}</p>
                </div>
                {scanResult.type === 'worker' && scanResult.data.vendorName && (
                  <div className="col-span-2">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Primary Vendor</p>
                    <p className="text-xs font-bold text-blue-600">{scanResult.data.vendorName}</p>
                  </div>
                )}
                {scanResult.type === 'vendor' && (
                  <div className="col-span-2">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Finance Status</p>
                    <p className={cn(
                      "text-xs font-bold",
                      scanResult.data.status === 'Paid' ? "text-emerald-600" : "text-red-500"
                    )}>
                      {scanResult.data.status === 'Paid' ? 'Operational - Fully Paid' : 'Pending Payment'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Verified</span>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-red-50 border border-red-200 rounded-3xl flex items-center gap-4 text-red-700"
          >
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="font-bold text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}function WorkersView({ workers, vendors, onAddWorker, onPrintID, onDelete, onUpdatePhoto }: any) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-xl">Helper ID Registry</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all font-mono tracking-tighter uppercase"
        >
          <Plus className="w-4 h-4" /> Direct Enrollment
        </button>
      </div>

      <div className="list-container shadow-sm overflow-hidden bg-white rounded-2xl border border-gray-100">
        <div className="list-header grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="col-span-1">Photo</div>
          <div className="col-span-3">Helper Name</div>
          <div className="col-span-2">QR Code</div>
          <div className="col-span-2">Assignment</div>
          <div className="col-span-2">Contact</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {workers.filter((w: any) => !w.deleted).map((w: Worker) => (
            <div key={w.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="col-span-1 flex justify-center">
                <div className="group relative w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200 cursor-pointer">
                  {w.photo ? (
                    <img src={w.photo} className="w-full h-full object-cover group-hover:blur-[1px]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-xs"><Camera className="w-4 h-4" /></div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                    <Camera className="text-white w-3.5 h-3.5" />
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => onUpdatePhoto(w.id, reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                </div>
              </div>
              <div className="col-span-3 font-bold text-[#0f172a]">
                {w.name}
                {w.vendorName && <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight truncate">Vendor: {w.vendorName}</div>}
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-1 rounded">
                    <QRCodeSVG value={w.qrCode || w.id} size={20} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-400">{w.qrCode}</span>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">
                  {w.role}
                </span>
              </div>
              <div className="col-span-2 text-xs font-mono text-gray-500">{w.phone || 'N/A'}</div>
              <div className="col-span-2 text-right flex items-center justify-end gap-3">
                <button onClick={() => onPrintID(w, 'worker')} className="p-2 text-gray-400 hover:text-emerald-500 transition-colors" title="Print ID Card">
                  <IdCard className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(w.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {workers.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm italic">No helpers registered yet.</div>
          )}
        </div>
      </div>

      {isAdding && (
        <AddWorkerModal 
          onClose={() => setIsAdding(false)} 
          vendors={vendors}
          onSubmit={(n: string, r: string, p: string, ph: string, vId?: string, vName?: string) => {
            onAddWorker(n, r, p, ph, vId, vName);
            setIsAdding(false);
          }} 
        />
      )}
    </div>
  );
}

function AddWorkerModal({ onClose, onSubmit, vendors = [], title = "Register Personnel", description = "Create credentials for helpers in the system." }: any) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = () => {
    const vendor = vendors.find((v: Vendor) => v.id === selectedVendorId);
    onSubmit(name, role, phone, photo, selectedVendorId || undefined, vendor?.name || undefined);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl w-full max-w-md p-6 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="text-center">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
        
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 shadow-inner">
                 {photo ? <img src={photo} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg">
                <Scan className="w-4 h-4" />
              </div>
            </div>
            <label className="text-xs font-bold text-emerald-600 bg-emerald-50 px-6 py-2.5 rounded-xl cursor-pointer hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Snap Official Photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            </label>
            <p className="text-[10px] text-gray-400 font-medium">Unique Verification QR will be auto-generated upon saving.</p>
          </div>

          <div className="space-y-4">
            {vendors.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Assign to Vendor (Optional)</label>
                <select 
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 text-gray-600"
                  value={selectedVendorId}
                  onChange={e => setSelectedVendorId(e.target.value)}
                >
                  <option value="">No vendor assignment</option>
                  {vendors.map((v: Vendor) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Full Name</label>
              <input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Role / Assignment</label>
              <input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Security, Finance, Logistics" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Contact Number</label>
              <input type="tel" className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <button 
            disabled={!name || !role}
            onClick={handleFormSubmit}
            className="w-full py-4 bg-[#0f172a] text-white rounded-2xl font-bold shadow-lg hover:bg-black disabled:opacity-50 transition-all text-sm uppercase tracking-widest"
          >
            Issue Helper ID
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

function DashboardView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Collected" value={stats.totalCollected} trend="+12% from yesterday" type="collected" />
        <StatCard label="Total Expected" value={stats.totalExpected} trend={`${stats.totalVendors} Vendors Active`} type="expected" />
        <StatCard label="Outstanding Balance" value={stats.outstanding} trend="48 Overdue accounts" type="outstanding" />
        <StatCard label="Collection Rate" value={`${((stats.totalCollected / stats.totalExpected) * 100 || 0).toFixed(1)}%`} type="rate" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Category */}
        <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] shadow-sm">
          <h3 className="text-[13px] font-bold text-[#64748b] uppercase tracking-wider mb-6">Revenue by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.catData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(val) => `₦${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collection Status */}
        <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] shadow-sm">
          <h3 className="text-[13px] font-bold text-[#64748b] uppercase tracking-wider mb-6">Vendor Payment Status</h3>
          <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.statusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function VendorsView({ 
  vendors, 
  categories, 
  searchTerm, 
  setSearchTerm, 
  categoryFilter, 
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  onPayment,
  profile,
  onAddVendor,
  onPrintID,
  onPrintQR,
  workers,
  onAddWorker,
  onDeleteWorker,
  onUpdatePhoto
}: any) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isAddingVendor, setIsAddingVendor] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-xl">Vendor Management</h2>
        {profile?.role === 'admin' && (
          <button 
            onClick={() => setIsAddingVendor(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        )}
      </div>

      <div className="list-container shadow-sm">
        {/* Controls */}
        <div className="p-5 border-b border-[#e2e8f0] flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input 
              type="text" 
              placeholder="Search vendor / establishment..."
              className="w-full pl-10 pr-4 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-sm focus:ring-2 focus:ring-[#10b981]/20 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-[#f8fafc] text-sm px-4 py-2 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#10b981]/20 outline-none text-[#64748b] font-medium"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select 
            className="bg-[#f8fafc] text-sm px-4 py-2 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#10b981]/20 outline-none text-[#64748b] font-medium"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Paid">Fully Paid</option>
            <option value="Partial">Partial</option>
            <option value="Not Paid">Not Paid</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="list-header grid grid-cols-12 gap-4">
            <div className="col-span-4">Vendor / Establishment</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-2">Amount Due</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {vendors.map((v: Vendor) => (
              <div key={v.id} className="list-item grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                    {v.photo ? <img src={v.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-xs">ID</div>}
                  </div>
                  <div>
                    <div className="font-bold text-[#0f172a]">{v.name}</div>
                    {v.phone && <div className="text-[10px] text-[#64748b] font-mono">{v.phone}</div>}
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
                    {v.categoryName}
                  </span>
                </div>
                <div className="col-span-2 text-sm font-bold text-[#0f172a]">
                  ₦{v.totalDue.toLocaleString()}
                </div>
                <div className="col-span-1">
                  <span className={cn(
                    "status-badge",
                    v.status === 'Paid' ? 'status-paid' : 
                    v.status === 'Partial' ? 'status-partial' : 'status-not-paid'
                  )}>
                    {v.status === 'Not Paid' ? 'UNPAID' : v.status.toUpperCase()}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <button 
                    onClick={() => setDetailVendor(v)}
                    className="p-1 px-2 text-[#64748b] hover:text-[#10b981] transition-colors"
                    title="Vendor Details & Helpers"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onPrintID(v, 'vendor')}
                    className="p-1 px-2 text-[#64748b] hover:text-[#10b981] transition-colors"
                    title="Print ID Card"
                  >
                    <IdCard className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { setSelectedVendor(v); setAmount(''); setNotes(''); }}
                    disabled={v.status === 'Paid'}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                      v.status === 'Paid' ? 'bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed' : 'bg-[#10b981] text-white hover:bg-[#059669]'
                    )}
                  >
                    PAY NOW
                  </button>
                </div>
              </div>
            ))}
            {vendors.length === 0 && (
              <div className="p-12 text-center text-[#64748b] text-sm font-medium">
                No vendors Registry entries matching your search.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedVendor(null)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-3xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold">Record Payment</h3>
              <p className="text-gray-500 text-sm">{selectedVendor.name} - {selectedVendor.categoryName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Amount Paid (NGN)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">₦</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-10 py-4 bg-gray-50 rounded-2xl text-xl font-bold border-none focus:ring-2 focus:ring-orange-500/20 outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Optional Notes</label>
                <textarea 
                  placeholder="e.g. Received via cash..."
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-orange-500/20 outline-none resize-none"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex bg-gray-50 p-3 rounded-xl justify-between items-center text-xs">
                 <span className="text-gray-500">Total Due</span>
                 <span className="font-mono font-bold">₦{selectedVendor.totalDue.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-2">
              <button 
                onClick={() => {
                  if (amount) {
                    onPayment(selectedVendor, parseFloat(amount), notes);
                    setSelectedVendor(null);
                  }
                }}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all text-sm"
              >
                Confirm Payment
              </button>
              <button onClick={() => setSelectedVendor(null)} className="w-full py-2 text-xs text-gray-400 font-medium">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {isAddingVendor && (
        <AddVendorModal 
          categories={categories} 
          onClose={() => setIsAddingVendor(false)} 
          onSubmit={(name: string, catId: string, phone: string, photo: string) => {
            onAddVendor(name, catId, phone, photo);
            setIsAddingVendor(false);
          }} 
        />
      )}

      {detailVendor && (
        <VendorDetailsModal 
          vendor={detailVendor}
          categories={categories}
          workers={workers.filter((w: Worker) => w.vendorId === detailVendor.id && !w.deleted)}
          onClose={() => setDetailVendor(null)}
          onPrintQR={() => onPrintQR(detailVendor)}
          onAddWorker={onAddWorker}
          onPrintID={onPrintID}
          onDeleteWorker={onDeleteWorker}
          onUpdatePhoto={onUpdatePhoto}
        />
      )}
    </div>
  );
}

function AddVendorModal({ categories, onClose, onSubmit }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [catId, setCatId] = useState(categories[0]?.id || '');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset catId if categories load and it's currently empty
  useEffect(() => {
    if (!catId && categories.length > 0) {
      setCatId(categories[0].id);
    }
  }, [categories, catId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl w-full max-w-md p-6 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="text-center">
          <h3 className="text-lg font-bold">Add New Vendor</h3>
          <p className="text-gray-500 text-sm">Register a new vendor in the system</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 shadow-inner">
                 {photo ? <img src={photo} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-xl shadow-lg">
                <Scan className="w-4 h-4" />
              </div>
            </div>
            <label className="text-xs font-bold text-orange-600 bg-orange-50 px-6 py-2.5 rounded-xl cursor-pointer hover:bg-orange-100 transition-all border border-orange-100 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Snap Vendor Photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            </label>
            <p className="text-[10px] text-gray-400 font-medium">Automatic unique QR Identification will be generated.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Vendor Name</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-orange-500/20 outline-none"
              placeholder="Enter name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Phone Number (Optional)</label>
            <input 
              type="tel" 
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-orange-500/20 outline-none"
              placeholder="e.g. 08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Category</label>
            <select 
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-orange-500/20 outline-none"
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
            >
              {categories.length === 0 && <option value="">No categories available (Seed database)</option>}
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name} - ₦{c.defaultPrice.toLocaleString()}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            disabled={!name || !catId}
            onClick={() => onSubmit(name, catId, phone, photo)}
            className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-gray-800 disabled:opacity-50 transition-all text-sm"
          >
            Create Vendor
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentsView({ payments, onPrint }: { payments: Payment[], onPrint: (p: Payment) => void }) {
  return (
    <div className="list-container shadow-sm">
      <div className="p-6 border-b border-[#e2e8f0] flex items-center justify-between bg-white">
        <h2 className="font-bold text-[#0f172a] text-lg">Transaction History</h2>
        <div className="flex items-center gap-2 text-[#64748b] text-xs font-bold uppercase tracking-wider">
           <Download className="w-4 h-4" />
           <span>Export Data (Admin)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="list-header">
            <tr>
              <th className="px-6 py-4">Receipt ID</th>
              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {payments.map(p => (
              <tr key={p.id} className="list-item">
                <td className="px-6 py-4">
                  <span className="font-bold text-[13px] text-[#10b981]">{p.receiptId}</span>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-sm text-[#0f172a]">{p.vendorName}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-sm text-[#0f172a]">₦{p.amount.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[13px] text-[#64748b] font-medium">{format(new Date(p.date), 'dd MMM, HH:mm')}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onPrint(p)}
                    className="p-2 text-[#94a3b8] hover:text-[#10b981] transition-colors"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[#64748b] text-sm font-medium">
                  No payment records found in history.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminView({ categories, profile }: { categories: Category[], profile: UserProfile | null }) {
  if (profile?.role !== 'admin') return <div className="p-12 text-center text-red-500 font-bold">ACCESS DENIED</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] shadow-sm h-fit">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold flex items-center gap-2 text-[#0f172a]"><Settings className="w-4 h-4" /> Category Management</h3>
          <button className="text-[#10b981] font-bold text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>
        <div className="space-y-4">
           {categories.map(c => (
             <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
               <div>
                  <p className="text-sm font-bold text-[#0f172a]">{c.name}</p>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Base Rate: ₦{c.defaultPrice.toLocaleString()}</p>
               </div>
               <ChevronRight className="w-4 h-4 text-[#cbd5e1]" />
             </div>
           ))}
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-[#10b981] p-10 rounded-xl text-white relative overflow-hidden shadow-xl shadow-[#10b981]/10">
           <ShieldCheck className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10" />
           <div className="relative z-10">
             <h3 className="text-2xl font-bold mb-2">System Integrity</h3>
             <p className="text-white/80 text-sm mb-8">Database operational. Security protocols active across orientaion camp cluster.</p>
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/10 backdrop-blur-md p-5 rounded-lg border border-white/10">
                  <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest mb-1">Status</p>
                  <p className="font-bold text-lg">ONLINE</p>
               </div>
               <div className="bg-white/10 backdrop-blur-md p-5 rounded-lg border border-white/10">
                  <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest mb-1">Latency</p>
                  <p className="font-bold text-lg">14ms</p>
               </div>
             </div>
           </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-[#e2e8f0] shadow-sm">
           <h3 className="text-[13px] font-bold text-[#64748b] uppercase tracking-wider mb-6">Security Incident Log</h3>
           <div className="space-y-5">
              <LogEntry time="20:15" action="Admin Session Init" user="ADMIN-FINANCE" />
              <LogEntry time="19:50" action="Registry Baseline Sync" user="SYSTEM" />
              <LogEntry time="18:30" action="Personnel Credential Init" user="ADMIN" />
           </div>
        </div>
      </div>
    </div>
  );
}

// --- Atomic UI Helpers ---

function NavItem({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "nav-item w-full flex items-center gap-3 px-8 py-4 transition-all duration-200 border-l-4",
        active ? "bg-[#1e293b] text-[#10b981] border-[#10b981]" : "text-[#94a3b8] border-transparent hover:bg-[#1e293b]/50"
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function StatCard({ label, value, trend, type }: any) {
  const getColors = () => {
    switch(type) {
      case 'collected': return { color: '#059669', trendColor: '#059669' };
      case 'outstanding': return { color: '#ef4444', trendColor: '#ef4444' };
      case 'rate': return { color: '#10b981', trendColor: '#10b981' };
      default: return { color: '#0f172a', trendColor: '#64748b' };
    }
  };
  
  const { color, trendColor } = getColors();
  const displayValue = typeof value === 'number' ? `₦${value.toLocaleString()}` : value;

  return (
    <div className="stat-card">
      <span className="text-[13px] font-bold text-[#64748b] uppercase tracking-tight">{label}</span>
      <span style={{ color }} className="text-[24px] font-extrabold tracking-tight">
        {type !== 'rate' && <span className="text-[0.8em] mr-1 text-[#64748b] font-normal">₦</span>}
        {typeof value === 'number' ? value.toLocaleString() : value.replace('₦', '')}
      </span>
      {trend && <span style={{ color: trendColor }} className="text-[11px] font-medium">{trend}</span>}
      {type === 'rate' && (
        <div className="w-full h-[6px] bg-[#e2e8f0] rounded-full mt-1 overflow-hidden">
          <div style={{ width: value, backgroundColor: '#10b981' }} className="h-full rounded-full transition-all duration-500"></div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ time, action, user }: any) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="font-mono text-gray-400">{time}</div>
      <div className="w-1 h-1 rounded-full bg-gray-300" />
      <div className="flex-1 font-semibold text-gray-700">{action}</div>
      <div className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase text-[9px] tracking-wider">{user}</div>
    </div>
  );
}
