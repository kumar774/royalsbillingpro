import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, orderBy, query, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase/config';
import { StaffMember, StaffTransaction, RolePermissions, ModulePermission } from '../types';
import { Search, Plus, User, Phone, Wallet, Calendar, UserCheck, UserX, DollarSign, Eye, Loader2, X, Trash2, Edit2, CheckCircle, TrendingUp, AlertCircle, Shield, Key } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DEFAULT_PERMISSIONS: Record<string, RolePermissions> = {
  manager: {
    dashboard: { view: true, add: true, edit: true, delete: true },
    pos: { view: true, add: true, edit: true, delete: true },
    orders: { view: true, add: true, edit: true, delete: true },
    menu: { view: true, add: true, edit: true, delete: true },
    expenses: { view: true, add: true, edit: true, delete: true },
    staff: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    customers: { view: true, add: true, edit: true, delete: true },
    settings: { view: true, add: true, edit: true, delete: true }
  },
  chef: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  waiter: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  'delivery boy': {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  cashier: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: true, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: true, add: true, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    customers: { view: true, add: true, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  cleaner: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: false, add: false, edit: false, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  other: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  }
};

const MODULES = [
  { id: 'dashboard', label: 'Dashboard Overview' },
  { id: 'pos', label: 'POS Billing' },
  { id: 'orders', label: 'Live Orders' },
  { id: 'menu', label: 'Menu Manager' },
  { id: 'expenses', label: 'Expenses Tracker' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'reports', label: 'Reports' },
  { id: 'customers', label: 'CRM & Customers' },
  { id: 'settings', label: 'Settings' }
] as const;

interface StaffManagerProps {
  permissions?: RolePermissions;
}

const StaffManager: React.FC<StaffManagerProps> = ({ permissions: activeUserPermissions }) => {
  const { restaurantId } = useParams<{ restaurantId: string }>();

  // Tabs: directory = Staff Directory & Ledger, permissions = Role Permissions Config
  const [activeTab, setActiveTab] = useState<'directory' | 'permissions'>('directory');

  // State Variables
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [transactions, setTransactions] = useState<StaffTransaction[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingTx, setLoadingTx] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Modals state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form states - Staff Profile
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<'Chef' | 'Waiter' | 'Manager' | 'Delivery Boy' | 'Cashier' | 'Cleaner' | 'Other'>('Waiter');
  const [staffBaseSalary, setStaffBaseSalary] = useState('');
  const [staffJoiningDate, setStaffJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffStatus, setStaffStatus] = useState<'Active' | 'Inactive'>('Active');

  // Login credentials states
  const [enableLogin, setEnableLogin] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Form states - Transaction
  const [txType, setTxType] = useState<'Salary Paid' | 'Advance Given' | 'Bonus' | 'Deduction'>('Salary Paid');
  const [txAmount, setTxAmount] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<'Cash' | 'Online'>('Cash');
  const [txNotes, setTxNotes] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txMonthYear, setTxMonthYear] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  });

  // Permissions Settings States
  const [selectedPermissionRole, setSelectedPermissionRole] = useState<string>('Manager');
  const [rolePermissionsData, setRolePermissionsData] = useState<Record<string, RolePermissions>>({});

  // Helper: Retrieve secondary app instance auth
  const getTempAuth = () => {
    let tempApp;
    if (getApps().find(app => app.name === 'TempApp')) {
      tempApp = getApp('TempApp');
    } else {
      tempApp = initializeApp(firebaseConfig, 'TempApp');
    }
    return getAuth(tempApp);
  };

  // 1. Listen to Staff Directory
  useEffect(() => {
    if (!restaurantId) return;
    setLoadingStaff(true);
    
    const staffQuery = query(collection(db, 'restaurants', restaurantId, 'staff'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(staffQuery, (snap) => {
      const list: StaffMember[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || '',
          phone: data.phone || '',
          role: data.role || 'Waiter',
          baseSalary: Number(data.baseSalary) || 0,
          joiningDate: data.joiningDate || '',
          status: data.status || 'Active',
          createdAt: data.createdAt || '',
          outstandingAdvance: Number(data.outstandingAdvance) || 0,
          totalPaidSalary: Number(data.totalPaidSalary) || 0,
          loginEmail: data.loginEmail || '',
          loginUid: data.loginUid || ''
        });
      });
      setStaffList(list);
      setLoadingStaff(false);
      
      // Keep selected staff synchronized
      if (selectedStaff) {
        const updated = list.find(s => s.id === selectedStaff.id);
        if (updated) setSelectedStaff(updated);
      }
    }, (error) => {
      console.error("Failed to load staff:", error);
      toast.error("Failed to load staff list");
      setLoadingStaff(false);
    });

    return () => unsubscribe();
  }, [restaurantId, selectedStaff?.id]);

  // 2. Fetch permissions configuration on mount
  useEffect(() => {
    if (!restaurantId) return;
    const fetchPermissions = async () => {
      try {
        const docRef = doc(db, 'restaurants', restaurantId, 'config', 'permissions');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setRolePermissionsData(snap.data() as Record<string, RolePermissions>);
        } else {
          // Initialize with defaults
          setRolePermissionsData(DEFAULT_PERMISSIONS);
        }
      } catch (err) {
        console.error("Failed to load permissions:", err);
      }
    };
    fetchPermissions();
  }, [restaurantId]);

  // 3. Fetch Selected Staff Transactions on-demand
  useEffect(() => {
    if (!restaurantId || !selectedStaff) {
      setTransactions([]);
      return;
    }
    setLoadingTx(true);
    
    const txQuery = query(
      collection(db, 'restaurants', restaurantId, 'staff', selectedStaff.id, 'transactions'),
      orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(txQuery, (snap) => {
      const list: StaffTransaction[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          type: data.type || 'Salary Paid',
          amount: Number(data.amount) || 0,
          date: data.date || '',
          monthYear: data.monthYear || '',
          paymentMethod: data.paymentMethod || 'Cash',
          notes: data.notes || '',
          expenseId: data.expenseId || ''
        });
      });
      setTransactions(list);
      setLoadingTx(false);
    }, (error) => {
      console.error("Failed to load transactions:", error);
      setLoadingTx(false);
    });

    return () => unsubscribe();
  }, [restaurantId, selectedStaff?.id]);

  // Open Add/Edit Staff Modal
  const openStaffModal = (staff: StaffMember | null = null) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffName(staff.name);
      setStaffPhone(staff.phone);
      setStaffRole(staff.role);
      setStaffBaseSalary(staff.baseSalary.toString());
      setStaffJoiningDate(staff.joiningDate);
      setStaffStatus(staff.status);
      
      setEnableLogin(!!staff.loginUid);
      setStaffEmail(staff.loginEmail || '');
      setStaffPassword('');
    } else {
      setEditingStaff(null);
      setStaffName('');
      setStaffPhone('');
      setStaffRole('Waiter');
      setStaffBaseSalary('');
      setStaffJoiningDate(new Date().toISOString().split('T')[0]);
      setStaffStatus('Active');
      
      setEnableLogin(false);
      setStaffEmail('');
      setStaffPassword('');
    }
    setShowStaffModal(true);
  };

  // Save/Update Staff Profile
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !staffName.trim() || !staffBaseSalary.trim()) {
      toast.error("Please fill in required fields.");
      return;
    }

    const baseSalaryNum = Number(staffBaseSalary);
    if (isNaN(baseSalaryNum) || baseSalaryNum < 0) {
      toast.error("Please enter a valid salary amount.");
      return;
    }

    if (enableLogin && !staffEmail.trim()) {
      toast.error("Login email is required when Login Account is enabled.");
      return;
    }

    if (enableLogin && !editingStaff && !staffPassword.trim()) {
      toast.error("Password is required for new login accounts.");
      return;
    }

    const toastId = toast.loading(editingStaff ? "Updating employee profile..." : "Adding new employee...");
    
    try {
      let loginUid = editingStaff?.loginUid || '';
      
      // Handle login account creation/updates using secondary Firebase App
      if (enableLogin) {
        if (!loginUid) {
          // 1. Create a brand new Login Auth Account
          const tempAuth = getTempAuth();
          const userCredential = await createUserWithEmailAndPassword(tempAuth, staffEmail.trim(), staffPassword);
          loginUid = userCredential.user.uid;
          await signOut(tempAuth);

          // 2. Write details to global users collection
          await setDoc(doc(db, 'users', loginUid), {
            uid: loginUid,
            email: staffEmail.trim(),
            role: staffRole,
            restaurantId: restaurantId,
            createdAt: new Date().toISOString()
          });
        } else {
          // Update credentials record in firestore
          await updateDoc(doc(db, 'users', loginUid), {
            email: staffEmail.trim(),
            role: staffRole
          });
        }
      }

      if (editingStaff) {
        const staffRef = doc(db, 'restaurants', restaurantId, 'staff', editingStaff.id);
        await updateDoc(staffRef, {
          name: staffName.trim(),
          phone: staffPhone.trim(),
          role: staffRole,
          baseSalary: baseSalaryNum,
          joiningDate: staffJoiningDate,
          status: staffStatus,
          loginEmail: enableLogin ? staffEmail.trim() : '',
          loginUid: enableLogin ? loginUid : ''
        });
        toast.success("Employee updated successfully", { id: toastId });
      } else {
        const newStaff = {
          name: staffName.trim(),
          phone: staffPhone.trim(),
          role: staffRole,
          baseSalary: baseSalaryNum,
          joiningDate: staffJoiningDate,
          status: staffStatus,
          outstandingAdvance: 0,
          totalPaidSalary: 0,
          createdAt: new Date().toISOString(),
          loginEmail: enableLogin ? staffEmail.trim() : '',
          loginUid: enableLogin ? loginUid : ''
        };
        await addDoc(collection(db, 'restaurants', restaurantId, 'staff'), newStaff);
        toast.success("New employee added successfully", { id: toastId });
      }
      setShowStaffModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save employee: " + (err.code || err.message), { id: toastId });
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (staffId: string) => {
    if (!restaurantId) return;
    if (!confirm("Are you sure you want to delete this employee? This will permanently delete their profile and history.")) return;
    
    const toastId = toast.loading("Deleting employee...");
    try {
      const staffDocRef = doc(db, 'restaurants', restaurantId, 'staff', staffId);
      const staffDoc = await getDoc(staffDocRef);
      
      const batch = writeBatch(db);

      if (staffDoc.exists()) {
        const data = staffDoc.data();
        if (data.loginUid) {
          // Delete global users login doc
          const userRef = doc(db, 'users', data.loginUid);
          batch.delete(userRef);
        }
      }

      // Delete linked transactions & expenses
      const txSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff', staffId, 'transactions'));
      txSnap.forEach(tDoc => {
        const tData = tDoc.data();
        if (tData.expenseId) {
          const expenseRef = doc(db, 'restaurants', restaurantId, 'expenses', tData.expenseId);
          batch.delete(expenseRef);
        }
      });
      
      // Delete staff document
      batch.delete(staffDocRef);
      await batch.commit();
      
      toast.success("Employee deleted successfully", { id: toastId });
      if (selectedStaff?.id === staffId) {
        setSelectedStaff(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete employee: " + err.message, { id: toastId });
    }
  };

  // Send Password Reset Link
  const handleSendResetEmail = async () => {
    if (!staffEmail.trim()) return;
    const toastId = toast.loading("Sending reset link...");
    try {
      const activeAuth = getAuth(); // Using default Auth app
      await sendPasswordResetEmail(activeAuth, staffEmail.trim());
      toast.success("Password reset email sent successfully to " + staffEmail.trim(), { id: toastId });
    } catch (err: any) {
      toast.error("Failed to send reset email: " + err.message, { id: toastId });
    }
  };

  // Open Transaction Modal
  const openTxModal = (type: typeof txType) => {
    if (!selectedStaff) return;
    setTxType(type);
    setTxAmount('');
    setTxPaymentMethod('Cash');
    setTxNotes('');
    setTxDate(new Date().toISOString().split('T')[0]);
    
    const d = new Date();
    setTxMonthYear(`${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`);
    setShowTxModal(true);
  };

  // Add Salary / Advance Transaction & Sync to Expenses
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !selectedStaff || !txAmount.trim()) {
      toast.error("Please enter a valid amount.");
      return;
    }

    const amountNum = Number(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    const toastId = toast.loading("Recording transaction...");
    try {
      let expenseId = '';

      if (txType === 'Salary Paid' || txType === 'Advance Given') {
        const category = txType === 'Salary Paid' ? 'Staff Salary' : 'Staff Advance';
        const title = txType === 'Salary Paid' 
          ? `Salary Payout: ${selectedStaff.name} (${txMonthYear})` 
          : `Advance Given: ${selectedStaff.name}`;
          
        const expenseRef = await addDoc(collection(db, 'restaurants', restaurantId, 'expenses'), {
          title,
          amount: amountNum,
          category,
          date: txDate,
          note: txNotes.trim() || `Recorded via Staff Management for ${selectedStaff.name}`,
          isItemized: false,
          items: []
        });
        expenseId = expenseRef.id;
      }

      const txData = {
        type: txType,
        amount: amountNum,
        date: txDate,
        monthYear: txType === 'Salary Paid' ? txMonthYear : '',
        paymentMethod: txPaymentMethod,
        notes: txNotes.trim(),
        expenseId: expenseId
      };
      
      await addDoc(collection(db, 'restaurants', restaurantId, 'staff', selectedStaff.id, 'transactions'), txData);
      
      const staffRef = doc(db, 'restaurants', restaurantId, 'staff', selectedStaff.id);
      let newOutstanding = Number(selectedStaff.outstandingAdvance) || 0;
      let newTotalPaid = Number(selectedStaff.totalPaidSalary) || 0;
      
      if (txType === 'Advance Given') {
        newOutstanding += amountNum;
      } else if (txType === 'Deduction') {
        newOutstanding = Math.max(0, newOutstanding - amountNum);
      } else if (txType === 'Salary Paid') {
        newTotalPaid += amountNum;
      }

      await updateDoc(staffRef, {
        outstandingAdvance: newOutstanding,
        totalPaidSalary: newTotalPaid
      });

      toast.success("Transaction recorded successfully", { id: toastId });
      setShowTxModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to record transaction: " + err.message, { id: toastId });
    }
  };

  // Delete Transaction & Sync to Expenses
  const handleDeleteTransaction = async (tx: StaffTransaction) => {
    if (!restaurantId || !selectedStaff) return;
    if (!confirm("Are you sure you want to delete this transaction ledger record? Linked expenses will also be removed.")) return;

    const toastId = toast.loading("Reverting transaction...");
    try {
      if (tx.expenseId) {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'expenses', tx.expenseId));
      }

      await deleteDoc(doc(db, 'restaurants', restaurantId, 'staff', selectedStaff.id, 'transactions', tx.id));

      const staffRef = doc(db, 'restaurants', restaurantId, 'staff', selectedStaff.id);
      let newOutstanding = Number(selectedStaff.outstandingAdvance) || 0;
      let newTotalPaid = Number(selectedStaff.totalPaidSalary) || 0;
      
      if (tx.type === 'Advance Given') {
        newOutstanding = Math.max(0, newOutstanding - tx.amount);
      } else if (tx.type === 'Deduction') {
        newOutstanding += tx.amount;
      } else if (tx.type === 'Salary Paid') {
        newTotalPaid = Math.max(0, newTotalPaid - tx.amount);
      }

      await updateDoc(staffRef, {
        outstandingAdvance: newOutstanding,
        totalPaidSalary: newTotalPaid
      });

      toast.success("Transaction deleted and ledger updated", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete transaction: " + err.message, { id: toastId });
    }
  };

  // Toggle dynamic permissions mapping
  const handleTogglePermission = (module: string, action: 'view' | 'add' | 'edit' | 'delete') => {
    const roleKey = selectedPermissionRole.toLowerCase();
    setRolePermissionsData(prev => {
      const currentRolePerms = prev[roleKey] || { ...DEFAULT_PERMISSIONS['other'] };
      const currentModulePerms = currentRolePerms[module as keyof RolePermissions] || { view: false, add: false, edit: false, delete: false };
      
      return {
        ...prev,
        [roleKey]: {
          ...currentRolePerms,
          [module]: {
            ...currentModulePerms,
            [action]: !currentModulePerms[action]
          }
        }
      };
    });
  };

  // Save Permissions to Database
  const handleSavePermissions = async () => {
    if (!restaurantId) return;
    setSavingPermissions(true);
    const toastId = toast.loading("Saving role permissions settings...");
    try {
      await setDoc(doc(db, 'restaurants', restaurantId, 'config', 'permissions'), rolePermissionsData);
      toast.success("Permissions updated successfully!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save permissions: " + err.message, { id: toastId });
    } finally {
      setSavingPermissions(false);
    }
  };

  // Search & Filter directory list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.phone.includes(searchTerm) || 
                          s.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || s.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate Metrics for Header
  const activeStaffCount = staffList.filter(s => s.status === 'Active').length;
  const inactiveStaffCount = staffList.filter(s => s.status === 'Inactive').length;
  const totalOutstandingAdvances = staffList.reduce((sum, s) => sum + (Number(s.outstandingAdvance) || 0), 0);
  const totalMonthlyPayrollBudget = staffList
    .filter(s => s.status === 'Active')
    .reduce((sum, s) => sum + s.baseSalary, 0);

  const currentMonthYear = (() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  })();

  // Permissions shortcuts
  const canAddStaff = !activeUserPermissions || activeUserPermissions.staff.add;
  const canEditStaff = !activeUserPermissions || activeUserPermissions.staff.edit;
  const canDeleteStaff = !activeUserPermissions || activeUserPermissions.staff.delete;

  return (
    <div className="space-y-6 animate-fade-in relative z-10 font-sans">
      {/* 1. Header & Quick Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage restaurant employees, login accounts, and role-based permissions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="bg-gray-150 p-1 rounded-xl flex items-center border border-gray-200">
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'directory' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <User className="h-4 w-4" /> Staff Directory
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'permissions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Shield className="h-4 w-4" /> Role Permissions
            </button>
          </div>

          {activeTab === 'directory' && canAddStaff && (
            <button
              onClick={() => openStaffModal(null)}
              className="bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold py-2.5 px-5 rounded-xl transition shadow-lg shadow-orange-100 flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Add New Employee
            </button>
          )}
        </div>
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Active Employees</span>
                <span className="text-3xl font-extrabold text-gray-900 mt-1 block">{activeStaffCount}</span>
                <span className="text-xs text-gray-500 mt-1.5 block">{inactiveStaffCount} Inactive staff</span>
              </div>
              <div className="p-3.5 bg-green-50 rounded-xl text-green-600">
                <UserCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Monthly Payroll Budget</span>
                <span className="text-3xl font-extrabold text-gray-900 mt-1 block">₹{totalMonthlyPayrollBudget.toLocaleString('en-IN')}</span>
                <span className="text-xs text-gray-500 mt-1.5 block">Estimated base salary payouts</span>
              </div>
              <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Outstanding Advances</span>
                <span className="text-3xl font-extrabold text-[#E64A19] mt-1 block">₹{totalOutstandingAdvances.toLocaleString('en-IN')}</span>
                <span className="text-xs text-red-500 font-medium mt-1.5 block">Pending Udhari/Loan payouts</span>
              </div>
              <div className="p-3.5 bg-orange-50 rounded-xl text-[#FF5722]">
                <Wallet className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Month: {currentMonthYear}</span>
                <span className="text-3xl font-extrabold text-gray-900 mt-1 block">
                  ₹{staffList.reduce((sum, s) => sum + (s.totalPaidSalary || 0), 0).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-gray-500 mt-1.5 block">Lifetime salaries paid out</span>
              </div>
              <div className="p-3.5 bg-purple-50 rounded-xl text-purple-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Directory & Ledger Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Directory */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#FF5722] bg-white cursor-pointer"
                  >
                    <option value="All">All Roles</option>
                    <option value="Chef">Chef</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Manager">Manager</option>
                    <option value="Delivery Boy">Delivery Boy</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Other">Other</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#FF5722] bg-white cursor-pointer"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {loadingStaff ? (
                  <div className="flex items-center justify-center p-8 text-gray-400">
                    <Loader2 className="animate-spin h-6 w-6 mr-2 text-orange-500" />
                    <span>Loading directory...</span>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No employees match filters.</div>
                ) : (
                  filteredStaff.map(staff => (
                    <div
                      key={staff.id}
                      onClick={() => setSelectedStaff(staff)}
                      className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedStaff?.id === staff.id ? 'bg-orange-50/70 border-l-4 border-orange-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl flex-shrink-0 ${staff.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{staff.name}</h4>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{staff.role}</span>
                            {staff.loginUid && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.2 rounded">Login</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">₹{staff.baseSalary.toLocaleString('en-IN')}</span>
                        {staff.outstandingAdvance > 0 && (
                          <span className="block text-[10px] text-red-500 font-bold mt-0.5">₹{staff.outstandingAdvance} Adv</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Ledger details */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[60vh] flex flex-col justify-between">
              {selectedStaff ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-md">
                        {selectedStaff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          {selectedStaff.name}
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${selectedStaff.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {selectedStaff.status}
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3 text-gray-400" /> {selectedStaff.phone || 'N/A'}
                          <span className="text-gray-300">|</span>
                          <Calendar className="h-3 w-3 text-gray-400" /> Joined: {new Date(selectedStaff.joiningDate).toLocaleDateString()}
                          {selectedStaff.loginEmail && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-green-600 font-bold text-[10px] uppercase">Login Email: {selectedStaff.loginEmail}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {canEditStaff && (
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openStaffModal(selectedStaff)} className="p-2 text-gray-400 hover:text-orange-600 transition rounded-full hover:bg-orange-50" title="Edit Profile">
                          <Edit2 className="h-4.5 w-4.5" />
                        </button>
                        {canDeleteStaff && (
                          <button onClick={() => handleDeleteStaff(selectedStaff.id)} className="p-2 text-gray-400 hover:text-red-500 transition rounded-full hover:bg-red-50" title="Delete Profile">
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 text-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Base Salary</span>
                      <span className="text-lg font-extrabold text-gray-900 block mt-1">₹{selectedStaff.baseSalary.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-orange-50/40 p-4 rounded-xl border border-orange-100/50 text-center">
                      <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">Pending Advance</span>
                      <span className="text-lg font-extrabold text-[#E64A19] block mt-1">₹{(selectedStaff.outstandingAdvance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-green-50/40 p-4 rounded-xl border border-green-100/50 text-center">
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block">Total Paid (All-Time)</span>
                      <span className="text-lg font-extrabold text-green-700 block mt-1">₹{(selectedStaff.totalPaidSalary || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {canEditStaff && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
                      <button
                        onClick={() => openTxModal('Salary Paid')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm"
                      >
                        💳 Record Salary Payment
                      </button>
                      <button
                        onClick={() => openTxModal('Advance Given')}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm"
                      >
                        💵 Pay Advance (Udhari)
                      </button>
                      <button
                        onClick={() => openTxModal('Bonus')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm"
                      >
                        ✨ Give Bonus
                      </button>
                      <button
                        onClick={() => openTxModal('Deduction')}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-sm"
                      >
                        🛑 Record Deduction
                      </button>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">Chronological Ledger Log</h4>
                    <div className="flex-1 overflow-x-auto border border-gray-100 rounded-xl">
                      {loadingTx ? (
                        <div className="flex items-center justify-center p-8 text-gray-400">
                          <Loader2 className="animate-spin h-5 w-5 mr-2 text-orange-500" />
                          <span>Loading ledger entries...</span>
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-xs italic">No transactions recorded for this employee yet.</div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
                          <thead className="bg-gray-50 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Description</th>
                              <th className="px-4 py-3 text-right">Amount</th>
                              <th className="px-4 py-3">Method</th>
                              {canEditStaff && <th className="px-4 py-3 text-center">Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                            {transactions.map(tx => (
                              <tr key={tx.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3.5 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase mr-1.5 ${
                                    tx.type === 'Salary Paid' ? 'bg-green-100 text-green-800' :
                                    tx.type === 'Advance Given' ? 'bg-orange-100 text-orange-800' :
                                    tx.type === 'Bonus' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {tx.type}
                                  </span>
                                  {tx.monthYear && <span className="text-[10px] text-gray-400 font-bold mr-1">({tx.monthYear})</span>}
                                  <span className="text-gray-500 text-[11px] truncate max-w-[150px] inline-block align-middle" title={tx.notes}>{tx.notes || '—'}</span>
                                </td>
                                <td className={`px-4 py-3.5 text-right font-bold text-sm whitespace-nowrap ${
                                  tx.type === 'Salary Paid' || tx.type === 'Bonus' ? 'text-green-600' : 
                                  tx.type === 'Advance Given' ? 'text-[#FF5722]' : 'text-red-500'
                                }`}>
                                  ₹{tx.amount.toFixed(2)}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold text-[10px]">{tx.paymentMethod}</span>
                                </td>
                                {canEditStaff && (
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <button onClick={() => handleDeleteTransaction(tx)} className="text-gray-400 hover:text-red-500 p-1.5 transition rounded-lg hover:bg-red-50">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 py-16 space-y-3">
                  <div className="bg-gray-50 p-6 rounded-full border border-gray-100">
                    <User className="h-10 w-10 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold">Select an employee from the directory to view details.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Role Permissions Settings Grid UI */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in space-y-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-500" /> Configure Role Permissions
              </h3>
              <p className="text-xs text-gray-500 mt-1">Define dynamic view/create/edit/delete actions allowed for each restaurant staff role.</p>
            </div>
            
            <button
              onClick={handleSavePermissions}
              disabled={savingPermissions}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {savingPermissions ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : null} Save Permissions Map
            </button>
          </div>

          <div className="flex gap-6 items-start">
            {/* Roles selector list on left */}
            <div className="w-1/4 flex flex-col border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm shrink-0">
              {['Manager', 'Chef', 'Waiter', 'Delivery Boy', 'Cashier', 'Cleaner', 'Other'].map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedPermissionRole(role)}
                  className={`px-4 py-3 text-xs font-bold text-left transition-colors ${
                    selectedPermissionRole === role ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {role} Permissions
                </button>
              ))}
            </div>

            {/* Permissions Grid Table on right */}
            <div className="flex-1 overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
                <thead className="bg-gray-55 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Module Name</th>
                    <th className="px-6 py-3 text-center">View (Read)</th>
                    <th className="px-6 py-3 text-center">Add (Create)</th>
                    <th className="px-6 py-3 text-center">Edit (Update)</th>
                    <th className="px-6 py-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {MODULES.map(module => {
                    const roleKey = selectedPermissionRole.toLowerCase();
                    const rolePermissions = rolePermissionsData[roleKey] || DEFAULT_PERMISSIONS['other'];
                    const modulePerms = rolePermissions[module.id as keyof RolePermissions] || { view: false, add: false, edit: false, delete: false };

                    return (
                      <tr key={module.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-bold text-gray-800">{module.label}</td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.view}
                            onChange={() => handleTogglePermission(module.id, 'view')}
                            className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.add}
                            onChange={() => handleTogglePermission(module.id, 'add')}
                            className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.edit}
                            onChange={() => handleTogglePermission(module.id, 'edit')}
                            className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={modulePerms.delete}
                            onChange={() => handleTogglePermission(module.id, 'delete')}
                            className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold text-lg">{editingStaff ? 'Edit Employee Details' : 'Add New Employee'}</h3>
              <button onClick={() => setShowStaffModal(false)} className="hover:bg-white/10 p-1 rounded-lg transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={staffPhone}
                  onChange={e => setStaffPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Role *</label>
                  <select
                    value={staffRole}
                    onChange={e => setStaffRole(e.target.value as any)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="Chef">Chef</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Manager">Manager</option>
                    <option value="Delivery Boy">Delivery Boy</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15000"
                    value={staffBaseSalary}
                    onChange={e => setStaffBaseSalary(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={staffJoiningDate}
                    onChange={e => setStaffJoiningDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {editingStaff && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                    <select
                      value={staffStatus}
                      onChange={e => setStaffStatus(e.target.value as any)}
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Login Account setup section */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 space-y-3">
                <label className="flex items-center gap-2 font-bold text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableLogin}
                    onChange={e => setEnableLogin(e.target.checked)}
                    className="h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                  />
                  <span>Enable Portal Login Account</span>
                </label>

                {enableLogin && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Login Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. staffname@resto.com"
                        value={staffEmail}
                        onChange={e => setStaffEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:ring-1 focus:ring-orange-500 mt-1"
                      />
                    </div>

                    {!editingStaff ? (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Set Password *</label>
                        <input
                          type="password"
                          required
                          placeholder="At least 6 characters"
                          minLength={6}
                          value={staffPassword}
                          onChange={e => setStaffPassword(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:ring-1 focus:ring-orange-500 mt-1"
                        />
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-semibold">Need to reset password?</span>
                        <button
                          type="button"
                          onClick={handleSendResetEmail}
                          className="text-orange-600 hover:text-orange-500 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Key className="h-3 w-3" /> Send Password Reset Link
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-bold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#FF5722] hover:bg-[#E64A19] text-white py-3 rounded-xl font-bold transition shadow-lg shadow-orange-100"
                >
                  {editingStaff ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in flex flex-col">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold text-base">Record {txType} for {selectedStaff.name}</h3>
              <button onClick={() => setShowTxModal(false)} className="hover:bg-white/10 p-1 rounded-lg transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {txType === 'Salary Paid' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Salary Month/Year *</label>
                  <input
                    type="text"
                    required
                    placeholder="MM-YYYY (e.g. 07-2026)"
                    value={txMonthYear}
                    onChange={e => setTxMonthYear(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Method</label>
                  <select
                    value={txPaymentMethod}
                    onChange={e => setTxPaymentMethod(e.target.value as any)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes / Remarks</label>
                <textarea
                  placeholder="e.g. Deducted ₹500 from advance balance"
                  value={txNotes}
                  onChange={e => setTxNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#FF5722] hover:bg-[#E64A19] text-white py-2.5 rounded-xl font-bold transition shadow-lg shadow-orange-100 text-xs"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManager;
