

"use client";

import * as React from "react";
import {
  Archive,
  Banknote,
  Calculator,
  Calendar as CalendarIcon,
  CreditCard,
  FileText,
  PlusCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Trash2,
  UserPlus,
  Edit,
  MoreVertical,
  Upload,
  Download,
  History,
  ArrowLeft,
  AlertCircle,
  Import,
  BookOpen,
  ShieldAlert,
  Mail,
  MessageSquare,
} from "lucide-react";
import { format, parse, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
  TableCaption
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Entry, StaffMember, Creditor, AppState, StaffPayment, CreditorTransaction, DeletionRecord } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { sendSmsReport, SmsReportData } from '@/ai/flows/sms-flow';


const LSK = "mob_data_v13";

const initialAppState: AppState = {
    entries: [],
    staff: [],
    openingBalance: 0,
    selectedDate: format(new Date(), "yyyy-MM-dd"),
    creditors: [],
    deletionLog: [],
};


export default function BrandTrackerPro() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = React.useState(false);
  const [appState, setAppState] = React.useState<AppState>(initialAppState);
  const [activeTab, setActiveTab] = React.useState("sales");
  
  // Modal States
  const [editingEntry, setEditingEntry] = React.useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<Entry | null>(null);
  const [isClearDataAlertOpen, setIsClearDataAlertOpen] = React.useState(false);
  const [pdfModalState, setPdfModalState] = React.useState<{ isOpen: boolean; filterType: 'all' | 'cash' | 'online' }>({ isOpen: false, filterType: 'all' });
  
  // Memoized Calculations
  const analytics = React.useMemo(() => {
    const todaysEntries = appState.entries.filter(
      (e) => e.date === appState.selectedDate
    );
    const opening = appState.openingBalance;
    const cashSales = todaysEntries.filter(e => e.type === 'Cash').reduce((sum, e) => sum + e.amount, 0);
    const onlineSales = todaysEntries.filter(e => e.type === 'Online').reduce((sum, e) => sum + e.amount, 0);
    const udhariPaidCash = todaysEntries.filter(e => e.type === 'UDHARI PAID' && !e.details.includes('(Online)')).reduce((sum, e) => sum + e.amount, 0);
    const udhariPaidOnline = todaysEntries.filter(e => e.type === 'UDHARI PAID' && e.details.includes('(Online)')).reduce((sum, e) => sum + e.amount, 0);
    const expenses = todaysEntries.filter(e => e.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);
    const cashReturn = todaysEntries.filter(e => e.type === 'Cash Return').reduce((sum, e) => sum + e.amount, 0);
    const udhariGiven = todaysEntries.filter(e => e.type === 'UDHAR DIYE').reduce((sum, e) => sum + e.amount, 0);
    
    const totalSales = cashSales + onlineSales;
    const totalUdhariPaid = udhariPaidCash + udhariPaidOnline;
    const totalExpenses = Math.abs(expenses);

    const todaysCash = opening + cashSales + udhariPaidCash + expenses + cashReturn;

    return {
        opening,
        totalUdhariPaid,
        totalExpenses,
        todaysCash,
        udhariGiven,
        totalSales,
    }
  }, [appState.entries, appState.selectedDate, appState.openingBalance]);


  // Effects for loading and saving state
  React.useEffect(() => {
    try {
        const savedData = localStorage.getItem(LSK);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if(parsedData.selectedDate && isValid(new Date(parsedData.selectedDate))){
               setAppState({...initialAppState, ...parsedData});
            } else {
               setAppState(initialAppState);
            }
        }
    } catch (error) {
        console.error("Failed to load state from localStorage", error);
        setAppState(initialAppState);
    }
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMounted) {
      try {
        const dataToSave = JSON.stringify(appState);
        localStorage.setItem(LSK, dataToSave);
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    }
  }, [appState, isMounted]);

  const updateState = (updater: (prevState: AppState) => AppState) => {
    setAppState(updater);
  };
  
  const addDeletionLog = (description: string) => {
      const newLog: DeletionRecord = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          description
      };
      updateState(prev => ({
          ...prev,
          deletionLog: [...(prev.deletionLog || []), newLog]
      }));
  };

  const handleAddEntry = (type: Entry['type'], amount: number, details: string, extra?: { phone?: string }) => {
    updateState(prev => {
        const newEntry: Entry = {
            id: Date.now(),
            date: prev.selectedDate,
            time: format(new Date(), 'p'),
            type,
            amount,
            details
        };

        let newEntries = [...prev.entries, newEntry];
        let newCreditors = [...prev.creditors];

        const handleCreditorUpdate = (
            creditorName: string, 
            transactionType: 'len-den' | 'jama', 
            transactionAmount: number, 
            description: string, 
            phone?: string
        ) => {
            const transaction: CreditorTransaction = {
                id: newEntry.id, 
                date: prev.selectedDate,
                type: transactionType,
                amount: Math.abs(transactionAmount),
                description: description
            };

            const existingCreditorIndex = newCreditors.findIndex(c => c.name.toLowerCase() === creditorName.toLowerCase());

            if (existingCreditorIndex > -1) {
                const existingCreditor = newCreditors[existingCreditorIndex];
                const updatedCreditor = {
                    ...existingCreditor,
                    transactions: [...existingCreditor.transactions, transaction]
                };
                if (phone && !existingCreditor.phone) {
                    updatedCreditor.phone = phone;
                }
                newCreditors[existingCreditorIndex] = updatedCreditor;
            } else {
                const newCreditor: Creditor = {
                    id: Date.now() + 2,
                    name: creditorName,
                    phone: phone || '',
                    transactions: [transaction]
                };
                newCreditors.push(newCreditor);
            }
        };

        if (type === 'UDHAR DIYE') {
            const match = details.match(/(.*) - Desc: (.*)/);
            const customerName = match ? match[1] : details;
            const description = match ? match[2] : 'Udhari Sale';
            handleCreditorUpdate(customerName, 'len-den', amount, description, extra?.phone);
        } else if (type === 'UDHARI PAID') {
            const match = details.match(/From: (.*) \((Cash|Online)\) - Desc: (.*)/);
            if (match) {
                const customerName = match[1];
                const description = match[3] || `Payment Received (${match[2]})`;
                handleCreditorUpdate(customerName, 'jama', amount, description, extra?.phone);
            }
        } else if (type === 'Credit Return') {
           const match = details.match(/(.*) - Desc: (.*)/);
           if (match) {
             const customerName = match[1];
             const description = match[2] || 'Credit Return';
             handleCreditorUpdate(customerName, 'jama', amount, description);
           }
        }
        
        return { ...prev, entries: newEntries, creditors: newCreditors };
    });
    toast({ title: "Entry Added", description: `${type} entry of ${Math.abs(amount)} has been added.` });
};
  
  const handleUpdateEntry = (updatedEntry: Entry) => {
    updateState(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === updatedEntry.id ? updatedEntry : e)
    }));
    toast({ title: "Entry Updated" });
    setEditingEntry(null);
  }

  const handleDeleteEntry = (entryId: number) => {
    updateState(prev => {
        const entryToDelete = prev.entries.find(e => e.id === entryId);
        if (!entryToDelete) return prev;

        // Filter out the entry from the main log
        const newEntries = prev.entries.filter(e => e.id !== entryId);
        
        let newCreditors = [...prev.creditors];

        // If the deleted entry was udhari-related, remove it from the creditor's ledger too
        if (['UDHAR DIYE', 'UDHARI PAID', 'Credit Return'].includes(entryToDelete.type)) {
            newCreditors = prev.creditors.map(creditor => {
                const newTransactions = creditor.transactions.filter(tx => tx.id !== entryToDelete.id);
                return { ...creditor, transactions: newTransactions };
            });
        }
        
        return { ...prev, entries: newEntries, creditors: newCreditors };
    });
    toast({ title: "Entry Deleted", variant: "destructive" });
    setDeletingEntry(null);
}


  const handleClearTodaysData = () => {
      updateState(prev => ({
          ...prev,
          entries: prev.entries.filter(e => e.date !== prev.selectedDate)
      }));
      toast({ title: "Today's Data Cleared", description: `All entries for ${format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP")} have been deleted.`, variant: "destructive" });
      setIsClearDataAlertOpen(false);
  }


  const handleDateChange = (date?: Date) => {
    if (date) {
        updateState(prev => ({...prev, selectedDate: format(date, 'yyyy-MM-dd')}));
    }
  };

  const onOpeningBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    updateState(prev => ({...prev, openingBalance: value}));
  };
  
  const handleBackup = () => {
    try {
        const dataStr = JSON.stringify(appState, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mob-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "Backup Successful", description: "Data has been saved to your downloads." });
    } catch (error) {
        toast({ title: "Backup Failed", description: "Could not create backup file.", variant: "destructive" });
        console.error(error);
    }
  };
  
  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              const restoredState = JSON.parse(text);
              // Basic validation of the restored state
              if (restoredState && restoredState.entries && restoredState.selectedDate) {
                  updateState(prev => ({...prev, ...restoredState}));
                  toast({ title: "Restore Successful", description: "Application data has been restored." });
              } else {
                  throw new Error("Invalid backup file format.");
              }
          } catch (error) {
              toast({ title: "Restore Failed", description: "The selected file is not a valid backup.", variant: "destructive" });
              console.error(error);
          }
      };
      reader.readAsText(file);
      // Reset file input
      if(event.target) event.target.value = '';
  };


  if (!isMounted) {
    return null; // or a loading spinner
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "sales":
        return <SalesTab onAddEntry={handleAddEntry} appState={appState} />;
      case "expenses":
        return <ExpensesTab onAddEntry={handleAddEntry} />;
      case "udhari":
        return <UdhariTab onAddEntry={handleAddEntry} appState={appState} />;
      case "staff":
        return <StaffTab staff={appState.staff} onUpdate={updateState} selectedDate={appState.selectedDate} />;
      case "inventory":
        return <InventoryTab />;
      case "creditors":
        return <CreditorsTab appState={appState} onUpdate={updateState} addDeletionLog={addDeletionLog} />;
      case "log":
        return <DeletionLogTab log={appState.deletionLog || []} />;
      case "calc":
        return <CalculatorTab />;
      default:
        return null;
    }
  };
  
  const showHeaderAndAnalytics = !["staff", "inventory", "creditors", "calc", "log"].includes(activeTab);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-background">
      {showHeaderAndAnalytics && (
        <>
          <Header
            reportDate={parse(appState.selectedDate, 'yyyy-MM-dd', new Date())}
            onDateChange={handleDateChange}
            openingBalance={appState.openingBalance}
            onOpeningBalanceChange={onOpeningBalanceChange}
            onBackup={handleBackup}
            onRestore={handleRestore}
            onClearData={() => setIsClearDataAlertOpen(true)}
          />
          <AnalyticsCards data={analytics} />
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
          <TabsTrigger value="sales"><TrendingUp className="w-4 h-4 mr-2" />Sales</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="w-4 h-4 mr-2" />Expenses</TabsTrigger>
          <TabsTrigger value="udhari"><Receipt className="w-4 h-4 mr-2" />Udhari</TabsTrigger>
          <TabsTrigger value="staff"><Users className="w-4 h-4 mr-2" />Staff</TabsTrigger>
          <TabsTrigger value="inventory"><Archive className="w-4 h-4 mr-2" />Inventory</TabsTrigger>
          <TabsTrigger value="creditors"><FileText className="w-4 h-4 mr-2" />Creditors</TabsTrigger>
          <TabsTrigger value="log"><ShieldAlert className="w-4 h-4 mr-2" />Log</TabsTrigger>
          <TabsTrigger value="calc"><Calculator className="w-4 h-4 mr-2" />Calculator</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          {renderTabContent()}
        </div>
      </Tabs>
      
      {activeTab !== 'inventory' && activeTab !== 'creditors' && activeTab !== 'staff' && activeTab !== 'log' && activeTab !== 'calc' && <ReportSection 
        entries={appState.entries.filter(e => e.date === appState.selectedDate)} 
        appState={appState}
        onEdit={setEditingEntry}
        onDelete={setDeletingEntry}
        onPdfRequest={(type) => setPdfModalState({ isOpen: true, filterType: type })}
      />}

      {editingEntry && <EditEntryModal entry={editingEntry} onSave={handleUpdateEntry} onCancel={() => setEditingEntry(null)} />}
      
      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the entry.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletingEntry(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deletingEntry && handleDeleteEntry(deletingEntry.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearDataAlertOpen} onOpenChange={setIsClearDataAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Data for Today?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete all sales, expense, and udhari entries for {format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP")}. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearTodaysData} className="bg-destructive hover:bg-destructive/90">Yes, Clear Data</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
      <PdfSummaryModal 
        appState={appState}
        isOpen={pdfModalState.isOpen}
        filterType={pdfModalState.filterType}
        onClose={() => setPdfModalState({ ...pdfModalState, isOpen: false })}
      />

    </div>
  );
}

const EditEntryModal = ({ entry, onSave, onCancel }: { entry: Entry, onSave: (entry: Entry) => void, onCancel: () => void }) => {
    const [amount, setAmount] = React.useState(Math.abs(entry.amount).toString());
    const [details, setDetails] = React.useState(entry.details);
    const { toast } = useToast();

    const handleSubmit = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid Amount", variant: "destructive" });
            return;
        }
        if (!details.trim()) {
            toast({ title: "Details Required", variant: "destructive" });
            return;
        }
        
        const finalAmount = ['Expense', 'Cash Return', 'Credit Return', 'UDHAR DIYE'].includes(entry.type) 
           ? (entry.type === 'UDHAR DIYE' ? numAmount : -Math.abs(numAmount))
           : numAmount;


        onSave({ ...entry, amount: finalAmount, details: details.trim() });
    }

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p>Type: <span className="font-semibold">{entry.type}</span></p>
                    <Input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        placeholder="Amount"
                    />
                    <Input 
                        value={details} 
                        onChange={e => setDetails(e.target.value)} 
                        placeholder="Details"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const Header = ({ reportDate, onDateChange, openingBalance, onOpeningBalanceChange, onBackup, onRestore, onClearData }: { reportDate: Date; onDateChange: (date?: Date) => void; openingBalance: number; onOpeningBalanceChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onBackup: () => void; onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void; onClearData: () => void; }) => {
  const restoreInputRef = React.useRef<HTMLInputElement>(null);
  
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-6 bg-gradient-to-r from-primary to-purple-600 text-white border-0">
        <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">
                        MASTER OF BRANDS
                    </h1>
                    <p className="text-blue-100 text-lg mt-1">
                        Daily Sale & Expense Tracker
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 lg:items-center">
                    <div className="flex flex-col">
                        <Label className="text-sm font-medium text-blue-100 mb-1">Report Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
                                        !reportDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {reportDate ? format(reportDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={reportDate}
                                    onSelect={onDateChange}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-col">
                        <Label className="text-sm font-medium text-blue-100 mb-1">Opening Balance</Label>
                        <Input type="number" step="0.01" placeholder="0.00" value={openingBalance} onChange={onOpeningBalanceChange} className="bg-white/10 border-white/20 text-white placeholder:text-blue-200 focus-visible:ring-white" />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-5">
                       <input type="file" ref={restoreInputRef} onChange={onRestore} accept=".json" className="hidden" />
                       <Button variant="outline" size="sm" onClick={() => restoreInputRef.current?.click()} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                         <History className="mr-2 h-4 w-4" /> Restore
                       </Button>
                       <Button variant="outline" size="sm" onClick={onBackup} className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                         <Download className="mr-2 h-4 w-4" /> Backup
                       </Button>
                       <Button variant="destructive" size="sm" onClick={onClearData}>
                         <AlertCircle className="mr-2 h-4 w-4" /> Clear Today's Data
                       </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}

const AnalyticsCards = ({ data }: { data: any }) => {
    const cards = [
        { title: "Opening", value: data.opening, icon: <Wallet className="h-4 w-4 text-slate-600" />, color: "text-slate-800" },
        { title: "Total Sales", value: data.totalSales, icon: <TrendingUp className="h-4 w-4 text-green-600" />, color: "text-green-600" },
        { title: "Udhari Rcvd", value: data.totalUdhariPaid, icon: <Receipt className="h-4 w-4 text-yellow-500" />, color: "text-yellow-500" },
        { title: "Udhari Given", value: data.udhariGiven, icon: <TrendingUp className="h-4 w-4 text-orange-500" />, color: "text-orange-500" },
        { title: "Expenses", value: data.totalExpenses, icon: <TrendingDown className="h-4 w-4 text-red-600" />, color: "text-red-600" },
        { title: "Today's Cash", value: data.todaysCash, icon: <Banknote className="h-4 w-4 text-sky-600" />, color: "text-sky-600" },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {cards.map(card => (
                <Card key={card.title} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            {card.icon}
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.title}</p>
                        </div>
                        <CardTitle className={cn("text-xl font-bold", card.color)}>
                            {card.value.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            ))}
        </div>
    );
};

const SalesTab = ({ onAddEntry, appState }: { onAddEntry: (type: Entry['type'], amount: number, details: string, extra?: { phone?: string }) => void, appState: AppState }) => {
    const [saleType, setSaleType] = React.useState<Entry['type']>('Online');
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<Creditor[]>([]);
    const { toast } = useToast();
    const amountInputRef = React.useRef<HTMLInputElement>(null);
    const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = React.useState(false);
    const [pendingTransaction, setPendingTransaction] = React.useState<(() => void) | null>(null);
    const [selectedCreditor, setSelectedCreditor] = React.useState<Creditor | null>(null);

    const handleButtonClick = (type: Entry['type']) => {
        setSaleType(type);
        amountInputRef.current?.focus();
    };
    
    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomer(value);
        setSelectedCreditor(null);
        setPhone('');
        if (value) {
            const filtered = (appState.creditors || []).filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (creditor: Creditor) => {
        setCustomer(creditor.name);
        setPhone(creditor.phone || '');
        setSelectedCreditor(creditor);
        setSuggestions([]);
    };


    const proceedWithTransaction = () => {
        const numAmount = parseFloat(amount);
        const finalAmount = ['Cash Return', 'Credit Return'].includes(saleType) ? -Math.abs(numAmount) : numAmount;
        let details = '';
        if (['UDHAR DIYE', 'Credit Return'].includes(saleType)) {
            details = `${customer.trim()} - Desc: ${description.trim() || (saleType === 'UDHAR DIYE' ? 'Udhari Sale' : 'Credit Return')}`;
        } else {
            details = saleType;
        }

        onAddEntry(saleType, finalAmount, details, { phone: phone.trim() });
        setAmount('');
        setCustomer('');
        setDescription('');
        setPhone('');
        setSelectedCreditor(null);
        setSuggestions([]);
        if (pendingTransaction) {
          setIsDuplicateAlertOpen(false);
          setPendingTransaction(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a positive number.", variant: "destructive" });
            return;
        }

        if (['UDHAR DIYE', 'Credit Return'].includes(saleType) && !customer.trim()) {
            toast({ title: "Customer Name Required", description: "Please enter a customer name for Udhari transactions.", variant: "destructive" });
            return;
        }
        
        if (saleType === 'UDHAR DIYE') {
            const existingCreditor = appState.creditors.find(c => c.name.toLowerCase() === customer.trim().toLowerCase());
            if (!existingCreditor && !phone.trim()) {
                 toast({ title: "Mobile number required for new customers", variant: "destructive" });
                 return;
            }
        
            const isDuplicate = appState.entries.some(entry => 
                entry.date === appState.selectedDate &&
                entry.type === 'UDHAR DIYE' &&
                Math.abs(entry.amount) === numAmount &&
                entry.details.startsWith(customer.trim())
            );

            if (isDuplicate) {
                setPendingTransaction(() => proceedWithTransaction);
                setIsDuplicateAlertOpen(true);
                return;
            }
        }
        
        proceedWithTransaction();
    }

    const saleTypes: { label: string, type: Entry['type'], className?: string }[] = [
        { label: "Cash", type: "Cash" },
        { label: "Online", type: "Online" },
        { label: "Udhari", type: "UDHAR DIYE" },
    ];
    const returnTypes: { label: string, type: Entry['type'], className?: string }[] = [
      { label: "Cash Return", type: "Cash Return", className: "bg-orange-200 text-orange-700 hover:bg-orange-300" },
      { label: "Udhari Return", type: "Credit Return", className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
    ];


    return (
      <>
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Add Sale or Return</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {saleTypes.map(st => (
                            <Button 
                                key={st.type} 
                                type="button" 
                                variant={saleType === st.type ? "default" : "outline"}
                                className={cn(st.className, saleType === st.type && "ring-2 ring-primary")}
                                onClick={() => handleButtonClick(st.type)}
                            >
                                {st.label}
                            </Button>
                        ))}
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        {returnTypes.map(st => (
                            <Button 
                                key={st.type} 
                                type="button" 
                                variant={saleType === st.type ? "default" : "outline"}
                                className={cn(st.className, saleType === st.type && "ring-2 ring-primary")}
                                onClick={() => handleButtonClick(st.type)}
                            >
                                {st.label}
                            </Button>
                        ))}
                    </div>
                    <Input ref={amountInputRef} type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Amount" required />
                    
                    {['UDHAR DIYE', 'Credit Return'].includes(saleType) && (
                        <div className="space-y-3">
                            <div className="relative">
                                <Input 
                                    value={customer} 
                                    onChange={handleCustomerChange} 
                                    placeholder="Customer Name (required for Udhari)" 
                                    required 
                                    autoComplete="off"
                                />
                                {suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full bg-background border border-border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                        {suggestions.map(creditor => (
                                            <div key={creditor.id} onClick={() => handleSuggestionClick(creditor)} className="p-2 cursor-pointer hover:bg-muted flex justify-between items-center">
                                                <span>{creditor.name}</span>
                                                <span className="text-xs text-muted-foreground">Bal: {calculateBalance(creditor.transactions).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {saleType === 'UDHAR DIYE' && (
                                <Input 
                                    value={phone} 
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Mobile Number (Required for new)" 
                                    disabled={!!selectedCreditor} 
                                    autoComplete="off" 
                                />
                            )}
                            <Input 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Description (optional)"
                            />
                        </div>
                    )}
                    <Button type="submit" className="w-full transition-transform hover:scale-105">Add Entry</Button>
                </form>
            </CardContent>
        </Card>
         <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Duplicate Udhari Sale?</AlertDialogTitle>
                    <AlertDialogDescription>
                        An udhari sale for this customer with the same amount already exists today. Are you sure you want to add another one?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingTransaction(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={pendingTransaction || (() => {})}>Yes, Add Anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
}

const ExpensesTab = ({ onAddEntry }: { onAddEntry: (type: Entry['type'], amount: number, details: string) => void }) => {
    const [amount, setAmount] = React.useState('');
    const [desc, setDesc] = React.useState('');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a positive number.", variant: "destructive" });
            return;
        }
        if (!desc.trim()) {
            toast({ title: "Description Required", variant: "destructive" });
            return;
        }
        onAddEntry('Expense', -Math.abs(numAmount), desc.trim());
        setAmount('');
        setDesc('');
    }

    return (
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Add Expense</h3>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Expense Amount" required />
                    <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" required />
                    <Button type="submit" variant="destructive" className="w-full transition-transform hover:scale-105">Add Expense</Button>
                </form>
            </CardContent>
        </Card>
    );
}

const UdhariTab = ({ onAddEntry, appState }: { onAddEntry: (type: Entry['type'], amount: number, details: string, extra?: { phone?: string }) => void, appState: AppState }) => {
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [method, setMethod] = React.useState('Cash');
    const [suggestions, setSuggestions] = React.useState<Creditor[]>([]);
    const [selectedCreditor, setSelectedCreditor] = React.useState<Creditor | null>(null);
    const [isNoCreditAlertOpen, setIsNoCreditAlertOpen] = React.useState(false);
    const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = React.useState(false);
    const [pendingTransaction, setPendingTransaction] = React.useState<(() => void) | null>(null);
    const { toast } = useToast();

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomer(value);
        setSelectedCreditor(null);
        setPhone(''); 
        if (value) {
            const filtered = (appState.creditors || []).filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (creditor: Creditor) => {
        setCustomer(creditor.name);
        setPhone(creditor.phone || '');
        setSelectedCreditor(creditor);
        setSuggestions([]);
    };
    
    const proceedWithTransaction = () => {
        const numAmount = parseFloat(amount);
        const descText = description.trim() || `Payment Received (${method})`;
        const details = `From: ${customer.trim()} (${method}) - Desc: ${descText}`;
        onAddEntry('UDHARI PAID', numAmount, details, { phone: phone.trim() });
        
        setAmount('');
        setCustomer('');
        setPhone('');
        setDescription('');
        setSelectedCreditor(null);
        setSuggestions([]);
        
        if(pendingTransaction) {
            setPendingTransaction(null);
            setIsNoCreditAlertOpen(false);
            setIsDuplicateAlertOpen(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid Amount", variant: "destructive" });
            return;
        }
        if (!customer.trim()) {
            toast({ title: "Customer Name Required", variant: "destructive" });
            return;
        }
        
        const existingCreditor = appState.creditors.find(c => c.name.toLowerCase() === customer.trim().toLowerCase());
        if (!existingCreditor && !phone.trim()) {
            toast({ title: "Mobile number required for new customers", variant: "destructive" });
            return;
        }

        const isDuplicate = appState.entries.some(entry => 
            entry.date === appState.selectedDate &&
            entry.type === 'UDHARI PAID' &&
            Math.abs(entry.amount) === numAmount &&
            entry.details.includes(`From: ${customer.trim()}`)
        );

        if (isDuplicate) {
            setPendingTransaction(() => proceedWithTransaction);
            setIsDuplicateAlertOpen(true);
            return;
        }
        
        const balance = existingCreditor ? calculateBalance(existingCreditor.transactions) : 0;

        if (!existingCreditor || balance <= 0) {
            setPendingTransaction(() => proceedWithTransaction);
            setIsNoCreditAlertOpen(true);
        } else {
            proceedWithTransaction();
        }
    }

    return (
      <>
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Record Udhari Payment</h3>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Paid Amount" required />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative">
                            <Input value={customer} onChange={handleCustomerChange} placeholder="Customer Name" required autoComplete="off" />
                            {suggestions.length > 0 && (
                                <div className="absolute z-10 w-full bg-background border border-border rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                    {suggestions.map(creditor => (
                                        <div key={creditor.id} onClick={() => handleSuggestionClick(creditor)} className="p-2 cursor-pointer hover:bg-muted flex justify-between items-center">
                                            <span>{creditor.name}</span>
                                            <span className="text-xs text-muted-foreground">Bal: {calculateBalance(creditor.transactions).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Input 
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Mobile Number (Required for new)" 
                            disabled={!!selectedCreditor} 
                            autoComplete="off" 
                        />
                    </div>

                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
                    <div className="flex space-x-4">
                        <Label className="flex items-center"><input type="radio" name="payment-method" value="Cash" checked={method === 'Cash'} onChange={() => setMethod('Cash')} className="mr-2" />Cash</Label>
                        <Label className="flex items-center"><input type="radio" name="payment-method" value="Online" checked={method === 'Online'} onChange={() => setMethod('Online')} className="mr-2" />Online</Label>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white transition-transform hover:scale-105">Add Udhari Paid</Button>
                </form>
            </CardContent>
        </Card>
        <AlertDialog open={isNoCreditAlertOpen} onOpenChange={setIsNoCreditAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>No Credit Detected</AlertDialogTitle>
                    <AlertDialogDescription>
                        This customer has no outstanding credit. Are you sure you want to record this payment?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingTransaction(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={pendingTransaction || (() => {})}>Yes, Add Payment</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Duplicate Payment?</AlertDialogTitle>
                    <AlertDialogDescription>
                        A payment for this customer with the same amount already exists today. Are you sure you want to add another one?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingTransaction(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={pendingTransaction || (() => {})}>Yes, Add Anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
}

const StaffTab = ({ staff, onUpdate, selectedDate }: { staff: StaffMember[], onUpdate: (updater: (prev: AppState) => AppState) => void, selectedDate: string }) => {
    const { toast } = useToast();
    const [isStaffModalOpen, setStaffModalOpen] = React.useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = React.useState(false);
    const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null);
    const [payingStaff, setPayingStaff] = React.useState<StaffMember | null>(null);
    const [isMarkingAttendance, setIsMarkingAttendance] = React.useState<StaffMember | null>(null);

    const handleSaveStaff = (name: string, monthlySalary: number) => {
        if (!name.trim() || isNaN(monthlySalary) || monthlySalary <= 0) {
            toast({ title: "Invalid Input", description: "Please enter a valid name and salary.", variant: "destructive" });
            return;
        }

        onUpdate(prev => {
            if (editingStaff) { // Editing existing staff
                return {
                    ...prev,
                    staff: prev.staff.map(s => s.id === editingStaff.id ? { ...s, name, monthlySalary } : s)
                };
            } else { // Adding new staff
                const newStaff: StaffMember = { id: Date.now(), name, monthlySalary, absences: [], payments: [] };
                return { ...prev, staff: [...prev.staff, newStaff] };
            }
        });

        toast({ title: editingStaff ? "Staff Updated" : "Staff Added" });
        setEditingStaff(null);
        setStaffModalOpen(false);
    };

    const handleSavePayment = (amount: number, description: string) => {
        if (!payingStaff || isNaN(amount) || amount <= 0 || !description.trim()) {
            toast({ title: "Invalid Input", description: "Please enter a valid amount and description.", variant: "destructive" });
            return;
        }

        onUpdate(prev => ({
            ...prev,
            staff: prev.staff.map(s => {
                if (s.id === payingStaff.id) {
                    const newPayment: StaffPayment = {
                        id: Date.now(),
                        date: format(new Date(), 'yyyy-MM-dd'),
                        amount,
                        description
                    };
                    return { ...s, payments: [...(s.payments || []), newPayment] };
                }
                return s;
            })
        }));

        toast({ title: "Payment Recorded" });
        setPayingStaff(null);
        setPaymentModalOpen(false);
    };
    
    const toggleAbsence = (staffId: number, dateString: string) => {
        onUpdate(prev => ({
            ...prev,
            staff: prev.staff.map(s => {
                if (s.id === staffId) {
                    const isAbsent = (s.absences || []).includes(dateString);
                    const newAbsences = isAbsent
                        ? (s.absences || []).filter(d => d !== dateString)
                        : [...(s.absences || []), dateString];
                    return { ...s, absences: newAbsences };
                }
                return s;
            })
        }));
        toast({ title: `Attendance updated for ${format(parse(dateString, 'yyyy-MM-dd', new Date()), 'PPP')}` });
        setIsMarkingAttendance(null);
    };
    
    const removeStaff = (staffId: number) => {
      onUpdate(prev => ({
        ...prev,
        staff: prev.staff.filter(s => s.id !== staffId)
      }));
      toast({ title: "Staff member removed", variant: "destructive" });
    };

    const StaffModal = ({ isOpen, onOpenChange, onSave, staffMember }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (name: string, salary: number) => void, staffMember: StaffMember | null }) => {
        const [name, setName] = React.useState("");
        const [salary, setSalary] = React.useState("");

        React.useEffect(() => {
            if (staffMember) {
                setName(staffMember.name);
                setSalary((staffMember.monthlySalary || 0).toString());
            } else {
                setName("");
                setSalary("");
            }
        }, [staffMember]);

        const handleSubmit = () => {
            onSave(name, parseFloat(salary));
        };

        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{staffMember ? "Edit Staff" : "Add New Staff"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input placeholder="Staff Name" value={name} onChange={e => setName(e.target.value)} />
                        <Input type="number" placeholder="Monthly Salary" value={salary} onChange={e => setSalary(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };
    
    const PaymentModal = ({ isOpen, onOpenChange, onSave, staffMember }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (amount: number, description: string) => void, staffMember: StaffMember | null }) => {
        const [amount, setAmount] = React.useState("");
        const [description, setDescription] = React.useState("");

        const handleSubmit = () => {
            onSave(parseFloat(amount), description);
            setAmount("");
            setDescription("");
        };

        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Payment for {staffMember?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input type="number" placeholder="Payment Amount" value={amount} onChange={e => setAmount(e.target.value)} />
                        <Input placeholder="Description (e.g., Advance, Salary)" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSubmit}>Record Payment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Staff Management</CardTitle>
                  <Button onClick={() => { setEditingStaff(null); setStaffModalOpen(true); }}>
                      <UserPlus className="mr-2 h-4 w-4" /> Add Staff
                  </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {staff.map(s => <StaffCard key={s.id} staffMember={s} selectedDate={selectedDate} onToggleAbsence={() => toggleAbsence(s.id, selectedDate)} isAbsentToday={(s.absences || []).includes(selectedDate)} onEdit={() => { setEditingStaff(s); setStaffModalOpen(true); }} onRemove={() => removeStaff(s.id)} onAddPayment={() => { setPayingStaff(s); setPaymentModalOpen(true); }} />)}
            </CardContent>
            <StaffModal isOpen={isStaffModalOpen} onOpenChange={setStaffModalOpen} onSave={handleSaveStaff} staffMember={editingStaff} />
            <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setPaymentModalOpen} onSave={handleSavePayment} staffMember={payingStaff} />
        </Card>
    );
};

const StaffCard = ({ staffMember, selectedDate, onToggleAbsence, isAbsentToday, onEdit, onRemove, onAddPayment }: { staffMember: StaffMember, selectedDate: string, onToggleAbsence: (id: number, dateString: string) => void, isAbsentToday: boolean, onEdit: () => void, onRemove: () => void, onAddPayment: () => void }) => {
    const currentDate = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(currentDate));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const monthlySalary = staffMember.monthlySalary || 0;

    const absencesThisMonth = (staffMember.absences || []).filter(d => isSameMonth(parse(d, 'yyyy-MM-dd', new Date()), currentMonth)).length;
    const paymentsThisMonth = (staffMember.payments || []).filter(p => isSameMonth(parse(p.date, 'yyyy-MM-dd', new Date()), currentMonth)).reduce((sum, p) => sum + p.amount, 0);

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    const salaryPerDay = monthlySalary > 0 && daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
    const deduction = absencesThisMonth * salaryPerDay;
    const netSalary = monthlySalary - deduction - paymentsThisMonth;

    return (
      <Card className="bg-muted/40">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{staffMember.name}</CardTitle>
              <CardDescription>Salary: {(monthlySalary || 0).toFixed(2)}/month</CardDescription>
            </div>
             <div className="flex items-center gap-2">
                <Button onClick={() => onToggleAbsence(staffMember.id, selectedDate)} variant={isAbsentToday ? "destructive" : "outline"} size="sm">
                   {isAbsentToday ? "Mark Present" : "Mark Absent"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onAddPayment}>Add Payment</DropdownMenuItem>
                    <DropdownMenuItem onClick={onEdit}>Edit Staff</DropdownMenuItem>
                    <DropdownMenuItem onClick={onRemove} className="text-red-600">Remove Staff</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
           <div className="grid grid-cols-1">
               <div>
                   <h4 className="font-semibold mb-2 text-center">Monthly Summary ({format(currentMonth, 'MMMM yyyy')})</h4>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center text-sm">
                      <div className="bg-background p-2 rounded-md">
                          <p className="font-semibold">{absencesThisMonth}</p>
                          <p className="text-muted-foreground">Absences</p>
                      </div>
                      <div className="bg-background p-2 rounded-md">
                          <p className="font-semibold text-red-600">{(deduction || 0).toFixed(2)}</p>
                          <p className="text-muted-foreground">Deduction</p>
                      </div>
                       <div className="bg-background p-2 rounded-md">
                          <p className="font-semibold text-blue-600">{(paymentsThisMonth || 0).toFixed(2)}</p>
                          <p className="text-muted-foreground">Payments</p>
                      </div>
                      <div className="bg-background p-2 rounded-md">
                          <p className="font-bold text-green-600">{(netSalary || 0).toFixed(2)}</p>
                          <p className="text-muted-foreground">Net Payable</p>
                      </div>
                   </div>
               </div>
           </div>
        </CardContent>
      </Card>
    )
}

const InventoryTab = () => {
    return (
        <Card>
            <CardContent className="p-0">
                <iframe src="/inventory.html" style={{ border: 'none', width: '100%', height: 'calc(100vh - 200px)' }} title="Inventory Management"></iframe>
            </CardContent>
        </Card>
    );
};

const calculateBalance = (transactions: CreditorTransaction[]) => {
    return transactions.reduce((bal, tx) => {
        if (tx.type === 'len-den') return bal + tx.amount; // Credit Given (customer owes us)
        if (tx.type === 'jama') return bal - tx.amount; // Payment Received (customer balance decreases)
        return bal;
    }, 0);
};

const CreditorsTab = ({ appState, onUpdate, addDeletionLog }: { appState: AppState, onUpdate: (updater: (prev: AppState) => AppState) => void, addDeletionLog: (desc: string) => void }) => {
    const [view, setView] = React.useState<'list' | 'detail'>('list');
    const [selectedCreditor, setSelectedCreditor] = React.useState<Creditor | null>(null);
    const { toast } = useToast();
    const vcfInputRef = React.useRef<HTMLInputElement>(null);
    const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = React.useState(false);
    const [duplicateTransaction, setDuplicateTransaction] = React.useState<{ creditorId: number; transaction: Omit<CreditorTransaction, 'id'>; } | null>(null);
    const [actionToConfirm, setActionToConfirm] = React.useState<(() => void) | null>(null);
    
    const handleSelectCreditor = (creditorId: number) => {
        const creditor = appState.creditors.find(c => c.id === creditorId);
        if (creditor) {
            setSelectedCreditor(creditor);
            setView('detail');
        }
    };

    const handleAddOrUpdateCreditor = (name: string, phone: string) => {
        if (!name.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }

        onUpdate(prev => {
            const existing = prev.creditors.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
            if (existing) {
                toast({ title: "Creditor already exists." });
                return prev;
            }
            const newCreditor: Creditor = {
                id: Date.now(),
                name: name.trim(),
                phone: phone.trim(),
                transactions: []
            };
            return { ...prev, creditors: [newCreditor, ...prev.creditors] };
        });
        toast({ title: "Creditor Added" });
    };

    const handleUpdateCreditorDetails = (creditorId: number, name: string, phone: string) => {
        onUpdate(prev => ({
            ...prev,
            creditors: prev.creditors.map(c => c.id === creditorId ? { ...c, name, phone } : c)
        }));
        toast({ title: "Creditor Updated" });
    };

    const handleRemoveCreditor = (creditorToRemove: Creditor) => {
        onUpdate(prev => ({
            ...prev,
            creditors: prev.creditors.filter(c => c.id !== creditorToRemove.id)
        }));
        addDeletionLog(`Removed creditor: ${creditorToRemove.name} (ID: ${creditorToRemove.id})`);
        toast({ title: "Creditor Removed", variant: "destructive" });
    };

    const requestPassword = (action: () => void) => {
        setActionToConfirm(() => action);
    };

    const handleConfirmAction = () => {
        if (actionToConfirm) {
            actionToConfirm();
            setActionToConfirm(null);
        }
    };
    
    const proceedWithAddTransaction = (creditorId: number, transaction: Omit<CreditorTransaction, 'id'>) => {
        onUpdate(prev => {
            const updatedCreditors = prev.creditors.map(c => {
                if (c.id === creditorId) {
                    const newTransactions = [...c.transactions, { ...transaction, id: Date.now() }];
                    newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    return { ...c, transactions: newTransactions };
                }
                return c;
            });
            const updatedSelectedCreditor = updatedCreditors.find(c => c.id === creditorId);
            if (updatedSelectedCreditor) {
                setSelectedCreditor(updatedSelectedCreditor);
            }
            return { ...prev, creditors: updatedCreditors };
        });
        toast({ title: "Transaction Added" });
        setIsDuplicateAlertOpen(false);
        setDuplicateTransaction(null);
    };

    const handleAddTransaction = (creditorId: number, transaction: Omit<CreditorTransaction, 'id'>) => {
        const creditor = appState.creditors.find(c => c.id === creditorId);
        const isDuplicate = creditor?.transactions.some(tx => 
            tx.date === transaction.date &&
            tx.amount === transaction.amount &&
            tx.description === transaction.description &&
            tx.type === transaction.type
        );
        
        if (isDuplicate) {
            setDuplicateTransaction({ creditorId, transaction });
            setIsDuplicateAlertOpen(true);
        } else {
            proceedWithAddTransaction(creditorId, transaction);
        }
    };


    const handleUpdateTransaction = (creditorId: number, updatedTx: CreditorTransaction) => {
         onUpdate(prev => {
            const updatedCreditors = prev.creditors.map(c => {
                if (c.id === creditorId) {
                    const newTransactions = c.transactions.map(tx => tx.id === updatedTx.id ? updatedTx : tx);
                    newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    return { ...c, transactions: newTransactions };
                }
                return c;
            });
            const updatedSelectedCreditor = updatedCreditors.find(c => c.id === creditorId);
            if (updatedSelectedCreditor) {
                setSelectedCreditor(updatedSelectedCreditor);
            }
            return { ...prev, creditors: updatedCreditors };
        });
        toast({ title: "Transaction Updated" });
    };

    const handleDeleteTransactionFromLedger = (creditorId: number, transactionId: number) => {
        let deletedTxDesc = `Unknown transaction from creditor ID ${creditorId}`;
        const creditor = appState.creditors.find(c => c.id === creditorId);
        if (creditor) {
            const tx = creditor.transactions.find(t => t.id === transactionId);
            if (tx) {
                 deletedTxDesc = `Tx ID ${tx.id} (${tx.type} ${tx.amount} on ${tx.date}) for ${creditor.name}`;
            }
        }
        
        onUpdate(prev => {
            const updatedCreditors = prev.creditors.map(c => {
                if (c.id === creditorId) {
                    const newTransactions = c.transactions.filter(tx => tx.id !== transactionId);
                    return { ...c, transactions: newTransactions };
                }
                return c;
            });
            const updatedSelectedCreditor = updatedCreditors.find(c => c.id === creditorId);
            if (updatedSelectedCreditor) {
                setSelectedCreditor(updatedSelectedCreditor);
            }
            return { ...prev, creditors: updatedCreditors };
        });
        addDeletionLog(`Deleted ledger transaction: ${deletedTxDesc}`);
        toast({ title: "Ledger Transaction Deleted", variant: 'destructive', description: "The entry in the daily report remains." });
    };
    
    const handleImportVCF = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n');
                const contacts: { name: string; phone: string }[] = [];
                let currentContact: { name: string; phone: string } = { name: '', phone: '' };

                lines.forEach(line => {
                    if (line.toUpperCase().startsWith('BEGIN:VCARD')) {
                        currentContact = { name: '', phone: '' };
                    } else if (line.toUpperCase().startsWith('END:VCARD')) {
                        if (currentContact.name) {
                            contacts.push(currentContact);
                        }
                    } else if (line.toUpperCase().startsWith('FN:')) {
                        currentContact.name = line.substring(3).trim();
                    } else if (line.toUpperCase().startsWith('TEL')) {
                        if(!currentContact.phone) { 
                           currentContact.phone = line.substring(line.indexOf(':') + 1).trim();
                        }
                    }
                });
                
                onUpdate(prev => {
                    const existingNames = new Set(prev.creditors.map(c => c.name.toLowerCase()));
                    const newCreditors = contacts
                        .filter(contact => !existingNames.has(contact.name.toLowerCase()))
                        .map(contact => ({
                            id: Date.now() + Math.random(),
                            name: contact.name,
                            phone: contact.phone,
                            transactions: []
                        }));
                    
                    if (newCreditors.length === 0) {
                        toast({ title: "No New Contacts", description: "All contacts from the file already exist." });
                        return prev;
                    }

                    toast({ title: "Import Successful", description: `${newCreditors.length} new contacts were imported.` });
                    return { ...prev, creditors: [...newCreditors, ...prev.creditors] };
                });

            } catch (error) {
                toast({ title: "Import Failed", description: "The selected file is not a valid VCF file.", variant: "destructive" });
                console.error(error);
            }
        };
        reader.readAsText(file);
        if (event.target) event.target.value = '';
    };


    if (view === 'detail' && selectedCreditor) {
        return (
            <>
                <CreditorDetailView 
                  creditor={selectedCreditor} 
                  onBack={() => setView('list')} 
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={(creditorId, txId) => requestPassword(() => handleDeleteTransactionFromLedger(creditorId, txId))}
                  onUpdateCreditor={handleUpdateCreditorDetails}
               />
                <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Duplicate Transaction?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This exact transaction already exists for this date. Are you sure you want to add it again?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setIsDuplicateAlertOpen(false); setDuplicateTransaction(null); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => duplicateTransaction && proceedWithAddTransaction(duplicateTransaction.creditorId, duplicateTransaction.transaction)}>
                                Yes, Add Anyway
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 <PasswordPrompt
                    open={!!actionToConfirm}
                    onOpenChange={(open) => !open && setActionToConfirm(null)}
                    onConfirm={handleConfirmAction}
                />
            </>
        );
    }

    return <>
        <CreditorListView 
            creditors={appState.creditors} 
            onSelectCreditor={handleSelectCreditor} 
            onAddCreditor={handleAddOrUpdateCreditor}
            onRemoveCreditor={(creditor) => requestPassword(() => handleRemoveCreditor(creditor))}
            onImportClick={() => vcfInputRef.current?.click()}
            vcfInputRef={vcfInputRef}
            onVcfFileChange={handleImportVCF}
        />
        <PasswordPrompt
            open={!!actionToConfirm}
            onOpenChange={(open) => !open && setActionToConfirm(null)}
            onConfirm={handleConfirmAction}
        />
    </>;
};

const CreditorListView = ({ creditors, onSelectCreditor, onAddCreditor, onRemoveCreditor, onImportClick, vcfInputRef, onVcfFileChange }: { creditors: Creditor[], onSelectCreditor: (id: number) => void, onAddCreditor: (name: string, phone: string) => void, onRemoveCreditor: (creditor: Creditor) => void, onImportClick: () => void, vcfInputRef: React.RefObject<HTMLInputElement>, onVcfFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
    const [name, setName] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const nameInputRef = React.useRef<HTMLInputElement>(null);
    const phoneInputRef = React.useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        onAddCreditor(name, phone);
        setName("");
        setPhone("");
        nameInputRef.current?.focus();
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (e.currentTarget === nameInputRef.current) {
                phoneInputRef.current?.focus();
            } else if (e.currentTarget === phoneInputRef.current) {
                handleSubmit();
            }
        }
    }


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Creditors</CardTitle>
                        <CardDescription>Manage your list of creditors.</CardDescription>
                    </div>
                    <input type="file" ref={vcfInputRef} onChange={onVcfFileChange} accept=".vcf" className="hidden" />
                    <Button onClick={onImportClick}><Import className="mr-2 h-4 w-4" /> Import Contacts</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <Input ref={nameInputRef} onKeyDown={handleKeyDown} value={name} onChange={e => setName(e.target.value)} placeholder="New Creditor Name" className="sm:col-span-2" />
                    <Input ref={phoneInputRef} onKeyDown={handleKeyDown} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile (Optional)" />
                </div>
                <Button onClick={handleSubmit} className="w-full mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Add New Creditor</Button>

                <div className="max-h-96 overflow-y-auto space-y-2">
                    {creditors.length > 0 ? creditors.map(c => {
                        const balance = calculateBalance(c.transactions);
                        return (
                            <div key={c.id} className="p-3 flex justify-between items-center rounded-md border">
                                <div className="flex-1">
                                    <p className="font-semibold">{c.name}</p>
                                    <p className="text-sm text-muted-foreground">{c.phone || 'No phone'}</p>
                                </div>
                                <div className="text-right mx-4">
                                    <p className={cn("font-bold text-lg", balance > 0 ? 'text-red-600' : 'text-green-600')}>
                                        {balance.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{balance > 0 ? 'Dena Hai' : 'Lena Hai'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => onSelectCreditor(c.id)}>
                                    <BookOpen className="mr-2 h-4 w-4" /> Ledger
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemoveCreditor(c); }}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                            </div>
                        )
                    }) : (
                        <div className="text-center text-muted-foreground py-8">No creditors found.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const PasswordPrompt = ({ open, onOpenChange, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void }) => {
    const [password, setPassword] = React.useState("");
    const { toast } = useToast();

    const handleConfirm = () => {
        if (password === "admin") {
            onConfirm();
            setPassword("");
            onOpenChange(false);
        } else {
            toast({ title: "Incorrect Password", variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Admin Password Required</DialogTitle>
                    <DialogDescription>
                        Please enter the admin password to proceed with this action.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm}>Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const CreditorDetailView = ({ creditor, onBack, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onUpdateCreditor }: { creditor: Creditor, onBack: () => void, onAddTransaction: (creditorId: number, tx: Omit<CreditorTransaction, 'id'>) => void, onUpdateTransaction: (creditorId: number, tx: CreditorTransaction) => void, onDeleteTransaction: (creditorId: number, txId: number) => void, onUpdateCreditor: (creditorId: number, name: string, phone: string) => void }) => {
    const [isTxModalOpen, setTxModalOpen] = React.useState(false);
    const [isEditCreditorModalOpen, setEditCreditorModalOpen] = React.useState(false);
    const [editingTx, setEditingTx] = React.useState<CreditorTransaction | null>(null);

    const balance = calculateBalance(creditor.transactions);

    const lastPaymentDate = React.useMemo(() => {
        const paymentTransactions = creditor.transactions
            .filter(tx => tx.type === 'jama')
            .map(tx => parse(tx.date, 'yyyy-MM-dd', new Date()))
            .sort((a, b) => b.getTime() - a.getTime());
        return paymentTransactions.length > 0 ? paymentTransactions[0] : null;
    }, [creditor.transactions]);

    const daysSinceLastPayment = lastPaymentDate ? differenceInDays(new Date(), lastPaymentDate) : null;

    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                        <div>
                            <CardTitle>{creditor.name}</CardTitle>
                            <CardDescription>{creditor.phone || 'No phone number'}</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditCreditorModalOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Details
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Card className="mb-4 bg-muted/30">
                    <CardHeader className="flex-row justify-between items-center p-4">
                        <div>
                           <CardDescription>Final Balance</CardDescription>
                           <CardTitle className={cn(balance > 0 ? 'text-red-600' : 'text-green-600')}>
                                {balance > 0 ? `${balance.toFixed(2)} Dena Hai` : `${Math.abs(balance).toFixed(2)} Lena Hai`}
                           </CardTitle>
                        </div>
                        <div className="text-right">
                           <CardDescription>Last Payment</CardDescription>
                            <CardTitle className="text-base font-medium">
                                {daysSinceLastPayment !== null ? `${daysSinceLastPayment} days ago` : "N/A"}
                            </CardTitle>
                        </div>
                    </CardHeader>
                </Card>

                <Button onClick={() => { setEditingTx(null); setTxModalOpen(true); }} className="w-full mb-4"><PlusCircle className="mr-2 h-4 w-4" /> Add New Transaction</Button>
                
                <h3 className="text-lg font-semibold mb-2">Transaction History</h3>
                <div className="max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Credit (Len-den)</TableHead>
                                <TableHead className="text-right">Payment (Jama)</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {creditor.transactions.length > 0 ? creditor.transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(parse(tx.date, 'yyyy-MM-dd', new Date()), 'PP')}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell className="text-right text-red-600">{tx.type === 'len-den' ? tx.amount.toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-right text-green-600">{tx.type === 'jama' ? tx.amount.toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTx(tx); setTxModalOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteTransaction(creditor.id, tx.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center">No transactions yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <TransactionModal 
                isOpen={isTxModalOpen} 
                onOpenChange={setTxModalOpen} 
                creditor={creditor}
                transaction={editingTx}
                onAddTransaction={onAddTransaction}
                onUpdateTransaction={(tx) => onUpdateTransaction(creditor.id, tx)}
            />
            <EditCreditorModal 
                isOpen={isEditCreditorModalOpen}
                onOpenChange={setEditCreditorModalOpen}
                creditor={creditor}
                onSave={onUpdateCreditor}
            />
        </Card>
    );
};

const EditCreditorModal = ({ isOpen, onOpenChange, creditor, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, creditor: Creditor, onSave: (id: number, name: string, phone: string) => void }) => {
    const [name, setName] = React.useState(creditor.name);
    const [phone, setPhone] = React.useState(creditor.phone);
    const { toast } = useToast();

    React.useEffect(() => {
        setName(creditor.name);
        setPhone(creditor.phone);
    }, [creditor]);

    const handleSubmit = () => {
        if (!name.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        onSave(creditor.id, name, phone);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Edit Creditor Details</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Creditor Name" />
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const TransactionModal = ({ isOpen, onOpenChange, creditor, transaction, onAddTransaction, onUpdateTransaction }: { isOpen: boolean, onOpenChange: (open: boolean) => void, creditor: Creditor, transaction: CreditorTransaction | null, onAddTransaction: (creditorId: number, tx: Omit<CreditorTransaction, 'id'>) => void, onUpdateTransaction: (tx: CreditorTransaction) => void }) => {
    const { toast } = useToast();
    const [amount, setAmount] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    const [type, setType] = React.useState<'jama' | 'len-den'>('jama');

    React.useEffect(() => {
        if (transaction) {
            setAmount(transaction.amount.toString());
            setDescription(transaction.description);
setDate(parse(transaction.date, 'yyyy-MM-dd', new Date()));
            setType(transaction.type);
        } else {
            setAmount("");
            setDescription("");
            setDate(new Date());
            setType('jama');
        }
    }, [transaction, isOpen]);

    const handleSubmit = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid Amount", variant: "destructive" });
            return;
        }
        if (!description.trim()) {
            toast({ title: "Description required", variant: "destructive" });
            return;
        }
        if (!date) {
            toast({ title: "Date required", variant: "destructive" });
            return;
        }

        const txData = {
            date: format(date, 'yyyy-MM-dd'),
            type,
            amount: numAmount,
            description: description.trim()
        };

        if (transaction) {
            onUpdateTransaction({ ...txData, id: transaction.id });
        } else {
            onAddTransaction(creditor.id, txData);
        }
        
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{transaction ? 'Edit' : 'New'} Transaction for {creditor.name}</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                       <Button onClick={() => setType('jama')} variant={type === 'jama' ? 'default' : 'outline'} className="bg-green-600 text-white hover:bg-green-700">Jama (Payment Rcvd)</Button>
                       <Button onClick={() => setType('len-den')} variant={type === 'len-den' ? 'default' : 'outline'} className="bg-red-600 text-white hover:bg-red-700">Len-den (Credit Given)</Button>
                    </div>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{transaction ? 'Save Changes' : 'Add Transaction'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const CalculatorTab = () => {
    const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    const [counts, setCounts] = React.useState<Record<number, number>>({});

    const total = React.useMemo(() => {
        return denominations.reduce((sum, denom) => sum + (counts[denom] || 0) * denom, 0);
    }, [counts, denominations]);

    const handleCountChange = (denom: number, value: string) => {
        setCounts(prev => ({ ...prev, [denom]: parseInt(value) || 0 }));
    };

    return (
        <Card>
            <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-3">Currency Denomination Calculator</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {denominations.map(denom => (
                        <div key={denom}>
                            <Label>{denom} x</Label>
                            <Input type="number" min="0" value={counts[denom] || ''} onChange={e => handleCountChange(denom, e.target.value)} />
                        </div>
                    ))}
                </div>
                <div className="mt-3 font-bold text-right text-2xl">
                    Total: {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
            </CardContent>
        </Card>
    );
};

const DeletionLogTab = ({ log }: { log: DeletionRecord[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Deletion Log</CardTitle>
                <CardDescription>
                    This is a secure log of all deleted items. This log cannot be altered.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {log.length > 0 ? [...log].reverse().map(record => (
                                <TableRow key={record.id}>
                                    <TableCell>{format(new Date(record.timestamp), "PPP p")}</TableCell>
                                    <TableCell>{record.description}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                        No deletions have been recorded.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

const ReportSection = ({ entries, appState, onEdit, onDelete, onPdfRequest }: { entries: Entry[], appState: AppState, onEdit: (entry: Entry) => void, onDelete: (entry: Entry) => void, onPdfRequest: (type: 'all' | 'cash' | 'online') => void }) => {
    const { toast } = useToast();

    const handleEmailReport = async () => {
        toast({ title: "Coming Soon!", description: "Email functionality will be implemented in a future update." });
    }

    const handleSmsReport = async () => {
        toast({ title: "Sending SMS...", description: "Please wait while we generate and send the report." });
        try {
            const cashSales = entries.filter(e => e.type === 'Cash').reduce((s, e) => s + e.amount, 0);
            const onlineSales = entries.filter(e => e.type === 'Online').reduce((s, e) => s + e.amount, 0);
            const udhariPaid = entries.filter(e => e.type === 'UDHARI PAID').reduce((s, e) => s + e.amount, 0);
            const udhariGiven = entries.filter(e => e.type === 'UDHAR DIYE').reduce((s, e) => s + e.amount, 0);
            const cashReturn = entries.filter(e => e.type === 'Cash Return').reduce((s, e) => s + e.amount, 0);
            const expenses = entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0);

            const udhariGivenDetails = entries.filter(e => e.type === 'UDHAR DIYE').map(entry => {
                const match = entry.details.match(/(.*) - Desc:/);
                const customerName = match ? match[1].trim() : entry.details.trim();
                const creditor = appState.creditors.find(c => c.name === customerName);
                const balance = creditor ? calculateBalance(creditor.transactions) : 0;
                return {
                    customerName,
                    amount: entry.amount,
                    balance,
                };
            });
            
            const udhariPaidDetails = entries.filter(e => e.type === 'UDHARI PAID').map(entry => {
                const match = entry.details.match(/From: (.*?) \(/);
                const customerName = match ? match[1].trim() : entry.details.trim();
                const creditor = appState.creditors.find(c => c.name === customerName);
                const balance = creditor ? calculateBalance(creditor.transactions) : 0;
                return {
                    customerName,
                    amount: entry.amount,
                    balance,
                };
            });

            const staffDetails = appState.staff.map(s => ({
                name: s.name,
                status: (s.absences || []).includes(appState.selectedDate) ? 'Absent' : 'Present'
            }));

            const reportData: SmsReportData = {
                date: appState.selectedDate,
                summaries: {
                    cashSales,
                    onlineSales,
                    udhariPaid,
                    udhariGiven,
                    cashReturn,
                    expenses
                },
                udhariGivenDetails,
                udhariPaidDetails,
                staffDetails,
            };

            const result = await sendSmsReport(reportData);

            if (result.success) {
                toast({ title: "SMS Sent Successfully", description: "The daily report has been sent." });
            } else {
                throw new Error(result.error || "Unknown error sending SMS");
            }

        } catch (error: any) {
            console.error("SMS sending failed:", error);
            toast({ title: "Error Sending SMS", description: error.message || "Failed to send SMS report.", variant: "destructive" });
        }
    };


    const TransactionTable = ({ title, data, onEdit, onDelete }: { title: string, data: Entry[], onEdit: (entry: Entry) => void, onDelete: (entry: Entry) => void }) => {
        const total = data.reduce((sum, entry) => sum + entry.amount, 0);

        return (
            <div className="flex flex-col">
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <div className="overflow-y-auto max-h-[300px] border rounded-lg flex-grow">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted">
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length > 0 ? data.map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell className="text-xs text-muted-foreground">{entry.time}</TableCell>
                                    <TableCell>{entry.details}</TableCell>
                                    <TableCell className={cn("text-right font-medium", entry.amount < 0 && "text-destructive")}>
                                        {entry.amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(entry)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(entry)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">No transactions.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {data.length > 0 && (
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold">{total.toFixed(2)}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
            </div>
        );
    };

    const cashInEntries = entries.filter(e => e.type === 'Cash' || (e.type === 'UDHARI PAID' && !e.details.includes('(Online)')));
    const onlineInEntries = entries.filter(e => e.type === 'Online' || (e.type === 'UDHARI PAID' && e.details.includes('(Online)')));
    const udhariGivenEntries = entries.filter(e => e.type === 'UDHAR DIYE');
    const expenseAndReturnEntries = entries.filter(e => ['Expense', 'Cash Return'].includes(e.type));
    const creditReturnEntries = entries.filter(e => e.type === 'Credit Return');


    // Detailed summary calculation
    const cashSales = entries.filter(e => e.type === 'Cash').reduce((s, e) => s + e.amount, 0);
    const onlineSales = entries.filter(e => e.type === 'Online').reduce((s, e) => s + e.amount, 0);
    const totalSales = cashSales + onlineSales;
    
    const udhariPaidCash = entries.filter(e => e.type === 'UDHARI PAID' && !e.details.includes('(Online)')).reduce((s, e) => s + e.amount, 0);
    const udhariPaidOnline = entries.filter(e => e.type === 'UDHARI PAID' && e.details.includes('(Online)')).reduce((s, e) => s + e.amount, 0);
    const totalOnlineRevenue = onlineSales + udhariPaidOnline;
    
    const totalExpensesAndReturns = entries.filter(e => ['Expense', 'Cash Return', 'Credit Return'].includes(e.type)).reduce((s, e) => s + e.amount, 0); // is negative
    
    const todaysUdhariGiven = entries.filter(e => e.type === 'UDHAR DIYE').reduce((s, e) => s + e.amount, 0);
    
    const todaysCashFlow = cashSales + totalExpensesAndReturns + udhariPaidCash;
    const closingBalance = appState.openingBalance + todaysCashFlow;


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                        <CardTitle>Daily Report: {format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP")}</CardTitle>
                        <CardDescription>A categorized log of all transactions for the selected day.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       <Button onClick={() => onPdfRequest('all')} variant="destructive">Full Report PDF</Button>
                       <Button onClick={() => onPdfRequest('cash')} variant="outline">Cash Report</Button>
                       <Button onClick={() => onPdfRequest('online')} variant="outline">Online Report</Button>
                       <Button onClick={handleEmailReport} className="bg-blue-700 hover:bg-blue-800"><Mail className="mr-2 h-4 w-4" />Email Report</Button>
                       <Button onClick={handleSmsReport} className="bg-green-600 hover:bg-green-700"><MessageSquare className="mr-2 h-4 w-4" />SMS Report</Button>
                   </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TransactionTable title="Cash In" data={cashInEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Online In" data={onlineInEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Udhari Given" data={udhariGivenEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Expenses & Cash Returns" data={expenseAndReturnEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Udhari Returns" data={creditReturnEntries} onEdit={onEdit} onDelete={onDelete} />

                </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch p-4 mt-4 border-t bg-muted/40">
                <div className="space-y-2 text-base">
                     {totalSales > 0 && <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Today's Sales Total</span>
                        <span className="font-semibold text-purple-600">{totalSales.toFixed(2)}</span>
                    </div>}
                     {totalOnlineRevenue > 0 && <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Online Revenue</span>
                        <span className="font-semibold text-sky-600">{totalOnlineRevenue.toFixed(2)}</span>
                    </div>}
                     {totalExpensesAndReturns < 0 && <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Expenses & Returns</span>
                        <span className="font-semibold text-red-600">{totalExpensesAndReturns.toFixed(2)}</span>
                    </div>}
                    {todaysUdhariGiven > 0 && <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Today's Udhari Given</span>
                        <span className="font-semibold text-orange-500">{todaysUdhariGiven.toFixed(2)}</span>
                    </div>}
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Today's Cash Flow</span>
                        <span className={cn("font-semibold", todaysCashFlow >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {todaysCashFlow.toFixed(2)}
                        </span>
                    </div>
                     {appState.openingBalance > 0 && <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Opening Balance</span>
                        <span className="font-semibold">{appState.openingBalance.toFixed(2)}</span>
                    </div>}
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="font-bold text-lg">Closing Balance (Cash in Hand)</span>
                        <span className={cn("font-bold text-lg", closingBalance >= 0 ? 'text-green-700' : 'text-red-700')}>
                          {closingBalance.toFixed(2)}
                        </span>
                    </div>
                    {appState.openingBalance > 0 &&
                        <div className="text-xs text-muted-foreground text-center pt-1">
                           (Calculation: {todaysCashFlow.toFixed(2)} Today's Flow + {appState.openingBalance.toFixed(2)} Opening Balance)
                        </div>
                    }
                </div>
            </CardFooter>
        </Card>
    );
};

const getReportData = (appState: AppState, filterType: 'all' | 'cash' | 'online') => {
    let todaysEntries = appState.entries.filter(e => e.date === appState.selectedDate);
    
    if (filterType === 'cash') {
        todaysEntries = todaysEntries.filter(e => ['Cash', 'UDHARI PAID', 'Expense', 'Cash Return'].includes(e.type) && !e.details.includes('(Online)'));
    } else if (filterType === 'online') {
        todaysEntries = todaysEntries.filter(e => e.type === 'Online' || (e.type === 'UDHARI PAID' && e.details.includes('(Online)')));
    }

    const cashSales = todaysEntries.filter(e => e.type === 'Cash').reduce((sum, e) => sum + e.amount, 0);
    const expenses = todaysEntries.filter(e => e.type === 'Expense' || e.type === 'Cash Return').reduce((sum, e) => sum + e.amount, 0);
    const udhariPaidCash = todaysEntries.filter(e => e.type === 'UDHARI PAID' && !e.details.includes('(Online)')).reduce((sum, e) => sum + e.amount, 0);
    
    const closingBalance = appState.openingBalance + cashSales + expenses + udhariPaidCash;

    return {
        todaysEntries,
        openingBalance: appState.openingBalance,
        closingBalance,
        staff: appState.staff,
        creditors: appState.creditors,
        selectedDate: appState.selectedDate,
    };
};

const drawDateWidgetPdf = (doc: jsPDF, dateStr: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const widgetWidth = 35;
    const margin = 14;
    const x = pageWidth - widgetWidth - margin;
    const y = 12;
    const selectedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
    const day = format(selectedDate, 'EEEE');
    const date = format(selectedDate, 'd');
    const month = format(selectedDate, 'MMMM');

    doc.setFillColor(239, 68, 68); 
    doc.roundedRect(x, y, widgetWidth, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(day, x + widgetWidth / 2, y + 5.5, { align: 'center' });

    doc.setDrawColor(209, 213, 219); 
    doc.roundedRect(x, y, widgetWidth, 25, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(date, x + widgetWidth / 2, y + 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(month, x + widgetWidth / 2, y + 22, { align: 'center' });
};

const drawSummaryWidgetsPdf = (doc: jsPDF, summaryData: Record<string, number>) => {
    const widgets = [
        { label: "Opening Bal", key: "openingBalance", color: [100, 116, 139] },
        { label: "Cash Sale", key: "cashSales", color: [22, 163, 74] },
        { label: "Online Sale", key: "onlineSales", color: [37, 99, 235] },
        { label: "Udhari Given", key: "udhariGiven", color: [234, 88, 12] },
        { label: "Udhari Rcvd", key: "udhariPaid", color: [202, 138, 4] },
        { label: "Expenses", key: "expenses", color: [220, 38, 38] },
        { label: "Closing Bal", key: "closingBalance", color: [22, 163, 74] },
    ];
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const totalWidth = pageWidth - (margin * 2);
    let widgetsToDraw = widgets.filter(widget => {
        const value = summaryData[widget.key];
        return typeof value === 'number' && (value !== 0 || ['openingBalance', 'closingBalance'].includes(widget.key));
    });

    if (widgetsToDraw.length === 0) return 40;

    const gap = 4;
    const widgetWidth = (totalWidth - (widgetsToDraw.length - 1) * gap) / widgetsToDraw.length;
    let x = margin;
    const y = 40;

    widgetsToDraw.forEach((widget, index) => {
        const value = summaryData[widget.key];
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, widgetWidth, 18, 2, 2, 'S');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(widget.label, x + widgetWidth / 2, y + 5, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(widget.color[0], widget.color[1], widget.color[2]);
        doc.text(Math.abs(value).toFixed(2), x + widgetWidth / 2, y + 13, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        
        if (index < widgetsToDraw.length - 1) {
            doc.setDrawColor(241, 245, 249); // Very light grey
            doc.setLineWidth(0.5);
            doc.line(x + widgetWidth + gap / 2, y, x + widgetWidth + gap / 2, y + 18);
        }

        x += widgetWidth + gap;
    });

    return y + 18 + 10;
};


const generatePdf = (appState: AppState, filterType: 'all' | 'cash' | 'online' = 'all') => {
    const doc = new jsPDF();
    const data = getReportData(appState, filterType);
    const selectedDate = parse(appState.selectedDate, 'yyyy-MM-dd', new Date());
    const selectedDateForTitle = format(selectedDate, 'dd/MM/yyyy');
    
    let reportTitle = `Financial Report for ${selectedDateForTitle}`;
    if (filterType === 'cash') reportTitle = `Cash Only Report for ${selectedDateForTitle}`;
    if (filterType === 'online') reportTitle = `Online Only Report for ${selectedDateForTitle}`;

    // Calculate summary data for widgets
    const cashSales = data.todaysEntries.filter(e => e.type === 'Cash').reduce((sum, e) => sum + e.amount, 0);
    const onlineSales = data.todaysEntries.filter(e => e.type === 'Online').reduce((sum, e) => sum + e.amount, 0);
    const udhariPaid = data.todaysEntries.filter(e => e.type === 'UDHARI PAID').reduce((sum, e) => sum + e.amount, 0);
    const udhariGiven = data.todaysEntries.filter(e => e.type === 'UDHAR DIYE').reduce((sum, e) => sum + e.amount, 0);
    const expenses = data.todaysEntries.filter(e => e.type === 'Expense' || e.type === 'Cash Return' || e.type === 'Credit Return').reduce((sum, e) => sum + e.amount, 0);
    
    const widgetSummary = {
        openingBalance: data.openingBalance,
        cashSales,
        onlineSales,
        udhariGiven,
        udhariPaid,
        expenses,
        closingBalance: data.closingBalance
    };

    const Y_START_POSITION = drawSummaryWidgetsPdf(doc, widgetSummary) + 10;

    const drawFullHeader = (docInstance: jsPDF) => {
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(20);
        docInstance.text("MASTER OF BRANDS", 105, 22, { align: 'center' });
        docInstance.setFont('helvetica', 'normal');
        docInstance.setFontSize(12);
        docInstance.text(reportTitle, 105, 29, { align: 'center' });
        drawDateWidgetPdf(docInstance, appState.selectedDate);
        drawSummaryWidgetsPdf(docInstance, widgetSummary);
    };

    const addPunchMark = (docInstance: jsPDF) => {
        const pageHeight = docInstance.internal.pageSize.getHeight();
        docInstance.setFontSize(18);
        docInstance.setTextColor(200, 200, 200);
        docInstance.text('>', 8, pageHeight / 2, { baseline: 'middle' });
    };

    const pageDrawHook = (hookData: any) => {
        drawFullHeader(doc);
        addPunchMark(doc);
    };
    
    const mainHeadStyles = { fillColor: [41, 45, 50], textColor: [255, 255, 255], fontStyle: 'bold' };
    const headStyles = { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' };
    const footStyles = { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' };
    const tableOptions = {
      theme: 'grid',
      headStyles: headStyles,
      footStyles: footStyles,
      styles: {
          lineColor: [241, 245, 249], // very light grey for grid lines
          lineWidth: 0.1,
      },
      columnStyles: { 0: { cellWidth: 20 }, 2: { halign: 'right' } },
      didParseCell: (data: any) => {
          if (data.column.index === 2 && data.cell.raw) {
              const value = parseFloat(String(data.cell.raw));
              if (value < 0) data.cell.styles.textColor = [220, 38, 38];
          }
      },
      didDrawPage: pageDrawHook,
      margin: { top: Y_START_POSITION }
    };


    const transactionCategories = [
        { title: 'Cash Sales', types: ['Cash'], positive: true },
        { title: 'Online Sales', types: ['Online'], positive: true },
        { title: 'Udhari Paid', types: ['UDHARI PAID'], positive: true },
        { title: 'Udhari Given', types: ['UDHAR DIYE'], positive: true },
        { title: 'Expenses & Returns', types: ['Expense', 'Cash Return', 'Credit Return'], positive: false },
    ];

    const allSummaries: Record<string, number> = {};
    let lastFinalY: number | undefined = undefined;

    const drawTable = (title: string, body: any[][], total: number) => {
        const tableHasContent = body.length > 0;
        if (!tableHasContent) return;
        
        autoTable(doc, {
            ...tableOptions,
            startY: lastFinalY ? lastFinalY + 5 : Y_START_POSITION, // Add margin between tables
            head: [[{ content: title, colSpan: 3, styles: { ...mainHeadStyles, halign: 'center' } }]],
            body: tableHasContent ? [[ 'Time', 'Details', 'Amount' ]] : [],
        });
        lastFinalY = (doc as any).lastAutoTable.finalY;

        if (tableHasContent) {
          autoTable(doc, {
              ...tableOptions,
              startY: lastFinalY,
              body: body,
              foot: [[{ content: 'Total', colSpan: 2, styles: { halign: 'right' } }, { content: total.toFixed(2), styles: { halign: 'right' } }]],
              showHead: false,
          });
          lastFinalY = (doc as any).lastAutoTable.finalY;
        }
    };

    pageDrawHook({} as any);

    transactionCategories.forEach(cat => {
        const entries = data.todaysEntries.filter(e => cat.types!.includes(e.type));
        if (entries.length === 0) return;

        const total = entries.reduce((sum, e) => sum + e.amount, 0);
        allSummaries[cat.title] = total;

        const body = entries.map(e => {
            let details = e.details;
            if (e.type === 'UDHAR DIYE') {
                const match = e.details.match(/(.*) - Desc:/);
                const customerName = match ? match[1].trim() : e.details.trim();
                const creditor = data.creditors.find(c => c.name === customerName);
                if (creditor) {
                    const currentBalance = calculateBalance(creditor.transactions);
                    const oldBalance = currentBalance - e.amount;
                    details = `${customerName} (Old: ${oldBalance.toFixed(2)} + New: ${e.amount.toFixed(2)} = ${currentBalance.toFixed(2)})`;
                }
            } else if (e.type === 'UDHARI PAID') {
                const match = e.details.match(/From: (.*?) \(/);
                const customerName = match ? match[1].trim() : e.details.trim();
                 const creditor = data.creditors.find(c => c.name === customerName);
                if(creditor) {
                    const currentBalance = calculateBalance(creditor.transactions);
                    const oldBalance = currentBalance + e.amount;
                    details = `${customerName} (Paid: ${e.amount.toFixed(2)} -> Old: ${oldBalance.toFixed(2)}, New: ${currentBalance.toFixed(2)})`;
                }
            }
            return [e.time, details, e.amount.toFixed(2)];
        });
        
        drawTable(cat.title, body, total);
    });
    
    // Staff Report
    if (data.staff.length > 0 && filterType === 'all') {
        const staffBody = data.staff.map(s => {
            const status = (s.absences || []).includes(data.selectedDate) ? 'Absent' : 'Present';
            const payment = (s.payments || []).find(p => p.date === data.selectedDate);
            const paymentInfo = payment ? `${payment.description}: ${payment.amount.toFixed(2)}` : 'No Payment';
            return [s.name, status, paymentInfo];
        });
        autoTable(doc, {
            ...tableOptions,
            startY: lastFinalY ? lastFinalY + 5 : Y_START_POSITION,
            head: [[{ content: 'Daily Staff Report', colSpan: 3, styles: { ...mainHeadStyles, halign: 'center' } }]],
            body: [['Staff Name', 'Attendance', 'Payments Today']],
        });
        lastFinalY = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
            ...tableOptions,
            startY: lastFinalY,
            body: staffBody,
            showHead: false,
        });
        lastFinalY = (doc as any).lastAutoTable.finalY;
    }


    // Final Summary
    const summaryRows = [
      ['Opening Balance', widgetSummary.openingBalance, [0, 0, 0]],
      ['Cash Sales', widgetSummary.cashSales, [22, 163, 74]],
      ['Online Sales', widgetSummary.onlineSales, [37, 99, 235]],
      ['Udhari Paid', widgetSummary.udhariPaid, [202, 138, 4]],
      ['Udhari Given', widgetSummary.udhariGiven, [234, 88, 12]],
      ['Expenses & Returns', widgetSummary.expenses, [220, 38, 38]],
      ['Closing Balance', widgetSummary.closingBalance, [22, 163, 74]],
    ];

    const finalSummaryBody = summaryRows
      .filter(([label, amount]) => typeof amount === 'number' && amount !== 0 || label === 'Opening Balance' || label === 'Closing Balance')
      .map(([label, amount]) => [label, (amount as number).toFixed(2)]);

    autoTable(doc, {
        ...tableOptions,
        startY: lastFinalY ? lastFinalY + 5 : Y_START_POSITION,
        head: [[{ content: 'Final Summary', colSpan: 2, styles: { ...mainHeadStyles, halign: 'center' } }]],
        body: finalSummaryBody,
        headStyles: { ...headStyles, halign: 'center' },
        didParseCell: (hookData) => {
            if (hookData.section !== 'body') return;
            const rowLabel = hookData.row.raw[0] as string;
            const rowStyle = summaryRows.find(r => r[0] === rowLabel);
            if (rowStyle) {
                hookData.cell.styles.textColor = rowStyle[2] as [number, number, number];
                if (rowLabel === 'Closing Balance' || rowLabel === 'Opening Balance') {
                    hookData.row.cells[0].styles.fontStyle = 'bold';
                    hookData.row.cells[1].styles.fontStyle = 'bold';
                }
            }
        },
    });
    
    doc.save(`Report-MOB-${filterType}-${appState.selectedDate}.pdf`);
};

const PdfSummaryModal = ({ isOpen, onClose, appState, filterType }: { isOpen: boolean, onClose: () => void, appState: AppState, filterType: 'all' | 'cash' | 'online' }) => {
    if (!isOpen) return null;

    const data = getReportData(appState, filterType);

    const cashTotal = data.todaysEntries.filter(e => e.type === 'Cash' || (e.type === 'UDHARI PAID' && !e.details.includes('(Online)'))).reduce((sum, e) => sum + e.amount, 0);
    const onlineTotal = data.todaysEntries.filter(e => e.type === 'Online' || (e.type === 'UDHARI PAID' && e.details.includes('(Online)'))).reduce((sum, e) => sum + e.amount, 0);
    const expenseTotal = data.todaysEntries.filter(e => e.type === 'Expense' || e.type === 'Cash Return' || e.type === 'Credit Return').reduce((sum, e) => sum + e.amount, 0);

    let summaryTitle = 'Full Report Summary';
    if (filterType === 'cash') summaryTitle = 'Cash Report Summary';
    if (filterType === 'online') summaryTitle = 'Online Report Summary';

    const handleDownload = () => {
        generatePdf(appState, filterType);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h2 className="text-xl font-bold mb-4">{summaryTitle}</h2>
                <div className="space-y-2">
                    {(filterType === 'all' || filterType === 'cash') && data.openingBalance > 0 &&
                        <div className="flex justify-between border-b pb-1">
                            <span>Opening Balance:</span> 
                            <strong>{data.openingBalance.toFixed(2)}</strong>
                        </div>
                    }
                    {(filterType === 'all' || filterType === 'cash') && cashTotal !== 0 &&
                        <div className="flex justify-between border-b pb-1">
                            <span>Cash Sales & Udhari:</span> 
                            <strong className="text-green-600">+ {cashTotal.toFixed(2)}</strong>
                        </div>
                    }
                     {(filterType === 'all' || filterType === 'online') && onlineTotal !== 0 &&
                        <div className="flex justify-between border-b pb-1">
                            <span>Online Sales & Udhari:</span> 
                            <strong className="text-blue-600">+ {onlineTotal.toFixed(2)}</strong>
                        </div>
                    }
                    {expenseTotal !== 0 && (filterType === 'all' || filterType === 'cash') &&
                        <div className="flex justify-between border-b pb-1">
                            <span>Total Expenses & Returns:</span> 
                            <strong className="text-red-600">{expenseTotal.toFixed(2)}</strong>
                        </div>
                    }
                    {filterType === 'all' && <hr className="my-2" />}
                    {filterType === 'all' && 
                        <div className="flex justify-between text-lg font-bold pt-1">
                            <span>Closing Balance (Cash in Hand):</span> 
                            <strong>{data.closingBalance.toFixed(2)}</strong>
                        </div>
                    }
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDownload}>Download PDF</Button>
                </div>
            </div>
        </div>
    );
};
    






    


    

    