import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Settings as SettingsIcon,
  Bell,
  Languages,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './context/AuthContext';
import { VoiceAssistant } from './components/VoiceAssistant';
import { formatCurrency, getRiskColor, cn } from './lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  getDocs
} from 'firebase/firestore';
import { db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firebaseUtils';
import { Customer, Transaction } from './types';

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, login, loading: authLoading } = useAuth();
  const [view, setView] = useState<'dashboard' | 'customers' | 'history' | 'settings'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    async function fetchInsight() {
      if (!selectedCustomer) {
        setAiInsight(null);
        return;
      }
      setLoadingInsight(true);
      try {
        const { getRiskInsights } = await import('./services/aiService');
        // In a real app we'd fetch actual transactions for this customer
        const insight = await getRiskInsights(selectedCustomer, []); 
        setAiInsight(insight);
      } catch (e) {
        console.error("Insight error:", e);
      } finally {
        setLoadingInsight(false);
      }
    }
    fetchInsight();
  }, [selectedCustomer]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');

  const handleAddCustomer = async () => {
    if (!newCustomerName || !user) return;
    const path = 'customers';
    try {
      await addDoc(collection(db, path), {
        shopkeeperId: user.id,
        name: newCustomerName,
        phone: newCustomerPhone,
        totalUdhaar: 0,
        totalJama: 0,
        trustScore: 80, // Default for new
        riskLevel: 'low',
        lastTransactionAt: Date.now(),
        createdAt: Date.now(),
      });
      setShowAddCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedCustomer || !txAmount || !user) return;
    const amount = parseFloat(txAmount);
    const txPath = 'transactions';
    const custPath = `customers/${selectedCustomer.id}`;
    try {
      await addDoc(collection(db, txPath), {
        customerId: selectedCustomer.id,
        shopkeeperId: user.id,
        type: txType,
        amount,
        createdAt: Date.now(),
      });

      // Update customer balance
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        [txType === 'credit' ? 'totalUdhaar' : 'totalJama']: increment(amount),
        lastTransactionAt: serverTimestamp(),
      });

      setShowAddTransaction(false);
      setTxAmount('');
      setSelectedCustomer(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, txPath); // Simpler path for error reporting
    }
  };

  // Stats
  const totalUdhaar = customers.reduce((sum, c) => sum + c.totalUdhaar, 0);
  const totalJama = customers.reduce((sum, c) => sum + c.totalJama, 0);
  const netBalance = totalUdhaar - totalJama;

  useEffect(() => {
    if (!user) return;

    const path = 'customers';
    const q = query(
      collection(db, path),
      where('shopkeeperId', '==', user.id),
      orderBy('lastTransactionAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const custs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const path = 'transactions';
    const q = query(
      collection(db, path),
      where('shopkeeperId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setRecentTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [user]);

  const handleVoiceCommand = (result: any) => {
    console.log("Voice Result:", result);
    if (result.type === 'ADD_CUSTOMER') {
      setShowAddCustomer(true);
    } else if (result.type === 'CREDIT' || result.type === 'DEBIT') {
      // Find customer if possible
      const found = customers.find(c => c.name.toLowerCase().includes(result.customerName?.toLowerCase()));
      if (found) {
        setSelectedCustomer(found);
        setShowAddTransaction(true);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">SmartKhata...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-white overflow-hidden relative">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full -ml-32 -mb-32 blur-3xl" />
         
         <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="z-10 text-center max-w-md"
         >
           <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
             <CreditCard size={40} className="text-white" />
           </div>
           <h1 className="text-4xl font-bold text-slate-900 mb-2 urdu-text">اسمارٹ کھاتہ</h1>
           <p className="text-lg text-slate-500 mb-8 px-4">
             Digital bookkeeping made simple for Pakistani shopkeepers.
           </p>
           
           <button 
             onClick={login}
             className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:bg-slate-800 transition-all mb-4"
           >
             Continue with Phone
           </button>
           <p className="text-sm text-slate-400">
             Secure, Fast & Offline-First
           </p>
         </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28" dir={i18n.language === 'ur' || i18n.language === 'sd' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
            <CreditCard size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{t('app_name')}</h1>
        </div>
        <div className="flex items-center gap-2">
           <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
             <Bell size={20} />
           </button>
           <button 
             onClick={() => setView('settings')}
             className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
            >
             <SettingsIcon size={20} />
           </button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {view === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('give')}</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalUdhaar)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('got')}</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalJama)}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-2xl" />
               <p className="text-slate-400 text-sm mb-1">{t('total_balance')}</p>
               <h2 className="text-3xl font-bold mb-4">{formatCurrency(Math.abs(netBalance))}</h2>
               <div className="flex gap-2">
                 <span className={cn(
                   "px-2 py-1 rounded-lg text-xs font-bold uppercase",
                   netBalance > 0 ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                 )}>
                   {netBalance > 0 ? 'Pending Collection' : 'Settled'}
                 </span>
               </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              <button 
                onClick={() => setShowAddCustomer(true)}
                className="flex-shrink-0 bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <Plus size={20} /> {t('add_customer')}
              </button>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">{t('recent_activity')}</h3>
                <button className="text-primary text-sm font-bold flex items-center gap-1">
                  View All <ChevronRight size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {recentTransactions.map(tx => {
                  const customer = customers.find(c => c.id === tx.customerId);
                  return (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          tx.type === 'credit' ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500"
                        )}>
                          {tx.type === 'credit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{customer?.name || 'Customer'}</p>
                          <p className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-bold", tx.type === 'credit' ? "text-red-600" : "text-emerald-600")}>
                          {tx.type === 'credit' ? '-' : '+'}{formatCurrency(tx.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'customers' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
             <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               <input 
                 type="text" 
                 placeholder={t('search_customer')}
                 className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
               />
             </div>

             <div className="space-y-3">
               {customers.map(customer => (
                 <motion.button 
                   whileTap={{ scale: 0.98 }}
                   key={customer.id} 
                   onClick={() => setSelectedCustomer(customer)}
                   className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm text-left rtl:text-right"
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                       {customer.name[0]}
                     </div>
                     <div>
                       <p className="font-bold text-slate-800">{customer.name}</p>
                       <p className="text-xs text-slate-400">{customer.phone}</p>
                     </div>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     <p className={cn(
                       "font-bold",
                       customer.totalUdhaar > customer.totalJama ? "text-red-600" : "text-emerald-600"
                     )}>
                       {formatCurrency(customer.totalUdhaar - customer.totalJama)}
                     </p>
                     <span className={cn("text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md", getRiskColor(customer.riskLevel))}>
                       {customer.riskLevel} Risk
                     </span>
                   </div>
                 </motion.button>
               ))}
             </div>
          </motion.div>
        )}

        {view === 'history' && (
           <div className="p-12 text-center text-slate-400">
             Detailed reports coming soon
           </div>
        )}

        {view === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('settings')}</h2>
            
            <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                    <Languages size={20} />
                  </div>
                  <div>
                    <p className="font-bold">{t('language')}</p>
                    <p className="text-xs text-slate-400">Choose app language</p>
                  </div>
                </div>
                <select 
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="bg-slate-50 border-none rounded-lg text-sm font-bold p-2 outline-none"
                >
                  <option value="en">English</option>
                  <option value="ur">اردو (Urdu)</option>
                  <option value="ru">Roman Urdu</option>
                  <option value="sd">سنڌي (Sindhi)</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-8 py-3 flex items-center justify-between pb-8 z-40">
        <button onClick={() => setView('dashboard')} className={cn("flex flex-col items-center gap-1", view === 'dashboard' ? "text-primary" : "text-slate-400")}>
          <TrendingUp size={24} />
          <span className="text-[10px] font-bold uppercase">{t('dashboard')}</span>
        </button>
        <button onClick={() => setView('customers')} className={cn("flex flex-col items-center gap-1", view === 'customers' ? "text-primary" : "text-slate-400")}>
          <Users size={24} />
          <span className="text-[10px] font-bold uppercase">{t('customers')}</span>
        </button>
        <div className="relative -top-8">
           <button 
             onClick={() => setShowAddCustomer(true)}
             className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-xl shadow-primary/40 border-4 border-slate-50"
            >
             <Plus size={32} strokeWidth={3} />
           </button>
        </div>
        <button onClick={() => setView('history')} className={cn("flex flex-col items-center gap-1", view === 'history' ? "text-primary" : "text-slate-400")}>
          <CreditCard size={24} />
          <span className="text-[10px] font-bold uppercase">{t('transactions')}</span>
        </button>
        <button onClick={() => setView('settings')} className={cn("flex flex-col items-center gap-1", view === 'settings' ? "text-primary" : "text-slate-400")}>
          <SettingsIcon size={24} />
          <span className="text-[10px] font-bold uppercase">{t('settings')}</span>
        </button>
      </nav>

      <VoiceAssistant onCommand={handleVoiceCommand} />

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddCustomer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               className="w-full max-w-xl bg-white rounded-t-3xl p-8 pb-12 shadow-2xl relative"
             >
                <button onClick={() => setShowAddCustomer(false)} className="absolute top-4 right-6 text-slate-300"><X /></button>
                <h2 className="text-2xl font-bold mb-6">{t('add_customer')}</h2>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Customer Name" 
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    onClick={handleAddCustomer}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-xl shadow-lg shadow-primary/20"
                  >
                    {t('save')}
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Transaction / Customer Detail Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               className="w-full max-w-xl bg-white rounded-t-3xl p-8 pb-12 shadow-2xl relative max-h-[90vh] overflow-y-auto"
             >
                <button onClick={() => setSelectedCustomer(null)} className="absolute top-4 right-6 text-slate-300"><X /></button>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-bold">
                    {selectedCustomer.name[0]}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                    <p className="text-slate-500 font-medium">{selectedCustomer.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-[10px] uppercase font-black px-2 py-1 rounded-md", getRiskColor(selectedCustomer.riskLevel))}>
                      {selectedCustomer.riskLevel} Risk
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between mb-8">
                   <div>
                     <p className="text-xs text-slate-400 font-bold uppercase">{selectedCustomer.totalUdhaar > selectedCustomer.totalJama ? 'Customer Owes' : 'Shopkeeper Owes'}</p>
                     <p className={cn("text-2xl font-black", selectedCustomer.totalUdhaar > selectedCustomer.totalJama ? "text-red-600" : "text-emerald-600")}>
                       {formatCurrency(Math.abs(selectedCustomer.totalUdhaar - selectedCustomer.totalJama))}
                     </p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase">{t('trust_score')}</p>
                      <p className="text-2xl font-black text-primary">{aiInsight?.score || selectedCustomer.trustScore}/100</p>
                   </div>
                </div>

                {loadingInsight ? (
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-8 animate-pulse">
                    <p className="text-xs text-primary font-bold uppercase mb-1">AI Analyzing...</p>
                    <div className="h-4 bg-primary/10 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-primary/10 rounded w-1/2"></div>
                  </div>
                ) : aiInsight && (
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                       <TrendingUp size={16} className="text-primary" />
                       <p className="text-xs text-primary font-bold uppercase tracking-wider">{t('ai_insights')}</p>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed italic mb-3">"{aiInsight.insights}"</p>
                    <div className="flex gap-4">
                       <div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">{t('likely_to_pay')}</p>
                         <p className="font-black text-slate-800">{(aiInsight.likelyToPay * 100).toFixed(0)}%</p>
                       </div>
                       <div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">{t('suggested_limit')}</p>
                         <p className="font-black text-slate-800">{formatCurrency(aiInsight.suggestedLimit)}</p>
                       </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button 
                    onClick={() => { setTxType('credit'); setShowAddTransaction(true); }}
                    className={cn(
                      "p-6 rounded-3xl flex flex-col items-center gap-2 border-2 transition-all",
                      txType === 'credit' && showAddTransaction ? "bg-red-50 border-red-500 text-red-600" : "bg-slate-50 border-transparent text-slate-400"
                    )}
                  >
                     <span className="text-sm font-bold uppercase">You Gave</span>
                     <span className="text-xl font-black">Udhaar</span>
                  </button>
                  <button 
                    onClick={() => { setTxType('debit'); setShowAddTransaction(true); }}
                    className={cn(
                      "p-6 rounded-3xl flex flex-col items-center gap-2 border-2 transition-all",
                      txType === 'debit' && showAddTransaction ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-transparent text-slate-400"
                    )}
                  >
                     <span className="text-sm font-bold uppercase">You Got</span>
                     <span className="text-xl font-black">Jama</span>
                  </button>
                </div>

                {showAddTransaction ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Amount (PKR)</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={txAmount}
                        onChange={(e) => setTxAmount(e.target.value)}
                        className="w-full bg-slate-50 text-4xl font-black p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setShowAddTransaction(false)}
                         className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold"
                       >
                         Back
                       </button>
                       <button 
                          onClick={handleAddTransaction}
                          className="flex-[2] bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20"
                        >
                          {t('save')}
                       </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-800 text-sm uppercase mb-2">History</h3>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                       {/* Placeholder history list would go here */}
                       <p className="text-center text-slate-300 text-sm py-4">No recent history for this session</p>
                    </div>
                  </div>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
