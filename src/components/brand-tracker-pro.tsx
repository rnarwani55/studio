

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
  Import
} from "lucide-react";
import { format, parse, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
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
import type { Entry, StaffMember, Creditor, AppState, StaffPayment, CreditorTransaction } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


const LSK = "mob_data_v13";

const initialAppState: AppState = {
    entries: [],
    staff: [],
    openingBalance: 0,
    selectedDate: format(new Date(), "yyyy-MM-dd"),
    creditors: [],
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
    const expenses = todaysEntries.filter(e => e.type === 'Expense').reduce((sum_1, e) => sum_1 + e.amount, 0);
    const cashReturn = todaysEntries.filter(e => e.type === 'Cash Return').reduce((sum_2, e) => sum_2 + e.amount, 0);

    const totalCashIn = cashSales + udhariPaidCash;
    const totalOnlineIn = onlineSales + udhariPaidOnline;
    const totalUdhariPaid = udhariPaidCash + udhariPaidOnline;
    const totalExpenses = Math.abs(expenses);
    const todaysCash = opening + totalCashIn + expenses + cashReturn;

    return {
        opening,
        totalCashIn,
        totalOnlineIn,
        totalUdhariPaid,
        totalExpenses,
        todaysCash,
    }
  }, [appState.entries, appState.selectedDate, appState.openingBalance]);


  // Effects for loading and saving state
  React.useEffect(() => {
    try {
        const savedData = localStorage.getItem(LSK);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if(parsedData.selectedDate && isValid(new Date(parsedData.selectedDate))){
               setAppState(parsedData);
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
        const newState = { ...prev, entries: [...prev.entries, newEntry] };
        
        if (type === 'UDHAR DIYE' || type === 'Credit Return') {
            const match = details.match(/(.*) - Desc: (.*)/);
            const customerName = match ? match[1] : details;
            const description = match ? match[2] : (type === 'UDHAR DIYE' ? 'Udhari Sale' : 'Credit Return');

            let creditor = newState.creditors.find(c => c.name.toLowerCase() === customerName.toLowerCase());
            
            const transaction: CreditorTransaction = {
                id: newEntry.id, // Use same ID to avoid duplicates
                date: prev.selectedDate,
                type: type === 'UDHAR DIYE' ? 'len-den' : 'jama',
                amount: Math.abs(amount),
                description: description
            };

            if (creditor) {
                creditor.transactions.push(transaction);
            } else {
                const newCreditor: Creditor = {
                    id: Date.now() + 2,
                    name: customerName,
                    phone: '',
                    transactions: [transaction]
                };
                newState.creditors.push(newCreditor);
            }
        } else if (type === 'UDHARI PAID') {
            const match = details.match(/From: (.*) \((Cash|Online)\) - Desc: (.*)/);
            if (match) {
                const customerName = match[1];
                const paymentMethod = match[2];
                const description = match[3];

                let creditor = newState.creditors.find(c => c.name.toLowerCase() === customerName.toLowerCase());
                const transaction: CreditorTransaction = {
                    id: newEntry.id, // Use same ID to avoid duplicates
                    date: prev.selectedDate,
                    type: 'jama',
                    amount: Math.abs(amount),
                    description: description || `Payment Received (${paymentMethod})`,
                };
                 if (creditor) {
                    creditor.transactions.push(transaction);
                } else {
                     // This case should ideally be handled by ensuring customer exists.
                    // For now, create a new one.
                    const newCreditor: Creditor = {
                        id: Date.now() + 2,
                        name: customerName,
                        phone: extra?.phone || '',
                        transactions: [transaction]
                    };
                    newState.creditors.push(newCreditor);
                }
            }
        }

        return newState;
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
    updateState(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== entryId)
    }));
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

  const handleOpeningBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                  setAppState(restoredState);
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
        return <SalesTab onAddEntry={handleAddEntry} creditors={appState.creditors || []}/>;
      case "expenses":
        return <ExpensesTab onAddEntry={handleAddEntry} />;
      case "udhari":
        return <UdhariTab onAddEntry={handleAddEntry} creditors={appState.creditors || []} />;
      case "staff":
        return <StaffTab staff={appState.staff} onUpdate={updateState} selectedDate={appState.selectedDate} />;
      case "inventory":
        return <InventoryTab />;
      case "creditors":
        return <CreditorsTab creditors={appState.creditors || []} onUpdate={updateState} />;
      case "calc":
        return <CalculatorTab />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-background">
      <Header
        reportDate={parse(appState.selectedDate, 'yyyy-MM-dd', new Date())}
        onDateChange={handleDateChange}
        openingBalance={appState.openingBalance}
        onOpeningBalanceChange={handleOpeningBalanceChange}
        onBackup={handleBackup}
        onRestore={handleRestore}
        onClearData={() => setIsClearDataAlertOpen(true)}
      />
      <AnalyticsCards data={analytics} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="sales"><TrendingUp className="w-4 h-4 mr-2" />Sales</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="w-4 h-4 mr-2" />Expenses</TabsTrigger>
          <TabsTrigger value="udhari"><Receipt className="w-4 h-4 mr-2" />Udhari</TabsTrigger>
          <TabsTrigger value="staff"><Users className="w-4 h-4 mr-2" />Staff</TabsTrigger>
          <TabsTrigger value="inventory"><Archive className="w-4 h-4 mr-2" />Inventory</TabsTrigger>
          <TabsTrigger value="creditors"><FileText className="w-4 h-4 mr-2" />Creditors</TabsTrigger>
          <TabsTrigger value="calc"><Calculator className="w-4 h-4 mr-2" />Calculator</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          {renderTabContent()}
        </div>
      </Tabs>
      
      {activeTab !== 'inventory' && activeTab !== 'creditors' && <ReportSection 
        entries={appState.entries.filter(e => e.date === appState.selectedDate)} 
        appState={appState}
        onEdit={setEditingEntry}
        onDelete={setDeletingEntry}
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
        
        const finalAmount = ['Expense', 'Cash Return', 'Credit Return'].includes(entry.type) ? -Math.abs(numAmount) : numAmount;

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
        { title: "Cash Sales", value: data.totalCashIn, icon: <TrendingUp className="h-4 w-4 text-green-600" />, color: "text-green-600" },
        { title: "Online Sales", value: data.totalOnlineIn, icon: <CreditCard className="h-4 w-4 text-blue-600" />, color: "text-blue-600" },
        { title: "Udhari Rcvd", value: data.totalUdhariPaid, icon: <Receipt className="h-4 w-4 text-yellow-500" />, color: "text-yellow-500" },
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

const SalesTab = ({ onAddEntry, creditors }: { onAddEntry: (type: Entry['type'], amount: number, details: string) => void, creditors: Creditor[] }) => {
    const [saleType, setSaleType] = React.useState<Entry['type']>('Online');
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<Creditor[]>([]);
    const { toast } = useToast();
    const amountInputRef = React.useRef<HTMLInputElement>(null);

    const handleButtonClick = (type: Entry['type']) => {
        setSaleType(type);
        amountInputRef.current?.focus();
    };
    
    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomer(value);
        if (value) {
            const filtered = creditors.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (creditor: Creditor) => {
        setCustomer(creditor.name);
        setSuggestions([]);
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
        
        const finalAmount = ['Cash Return', 'Credit Return'].includes(saleType) ? -Math.abs(numAmount) : numAmount;
        let details = '';
        if (['UDHAR DIYE', 'Credit Return'].includes(saleType)) {
            details = `${customer.trim()} - Desc: ${description.trim() || (saleType === 'UDHAR DIYE' ? 'Udhari Sale' : 'Credit Return')}`;
        } else {
            details = saleType;
        }

        onAddEntry(saleType, finalAmount, details);
        setAmount('');
        setCustomer('');
        setDescription('');
        setSuggestions([]);
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

const UdhariTab = ({ onAddEntry, creditors }: { onAddEntry: (type: Entry['type'], amount: number, details: string, extra?: { phone?: string }) => void, creditors: Creditor[] }) => {
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [method, setMethod] = React.useState('Cash');
    const [suggestions, setSuggestions] = React.useState<Creditor[]>([]);
    const [selectedCreditor, setSelectedCreditor] = React.useState<Creditor | null>(null);
    const { toast } = useToast();

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomer(value);
        setSelectedCreditor(null); // Reset selected creditor on change
        if (value) {
            const filtered = creditors.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
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
        const descText = description.trim() || `Payment Received (${method})`;
        const details = `From: ${customer.trim()} (${method}) - Desc: ${descText}`;
        onAddEntry('UDHARI PAID', numAmount, details, { phone: phone.trim() });
        setAmount('');
        setCustomer('');
        setPhone('');
        setDescription('');
        setSelectedCreditor(null);
        setSuggestions([]);
    }

    return (
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Record Udhari Payment</h3>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Paid Amount" required />
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
                        onChange={e => setPhone(e.target.value)} 
                        placeholder="Mobile Number (Optional)" 
                        disabled={!!selectedCreditor} 
                        autoComplete="off" 
                    />
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
                    <div className="flex space-x-4">
                        <Label className="flex items-center"><input type="radio" name="payment-method" value="Cash" checked={method === 'Cash'} onChange={() => setMethod('Cash')} className="mr-2" />Cash</Label>
                        <Label className="flex items-center"><input type="radio" name="payment-method" value="Online" checked={method === 'Online'} onChange={() => setMethod('Online')} className="mr-2" />Online</Label>
                    </div>
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white transition-transform hover:scale-105">Add Udhari Paid</Button>
                </form>
            </CardContent>
        </Card>
    );
}

const StaffTab = ({ staff, onUpdate, selectedDate }: { staff: StaffMember[], onUpdate: (updater: (prev: AppState) => AppState) => void, selectedDate: string }) => {
    const { toast } = useToast();
    const [isStaffModalOpen, setStaffModalOpen] = React.useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = React.useState(false);
    const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null);
    const [payingStaff, setPayingStaff] = React.useState<StaffMember | null>(null);

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

    const toggleAbsence = (staffId: number, date: Date) => {
        const dateString = format(date, 'yyyy-MM-dd');
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
                {staff.map(s => <StaffCard key={s.id} staffMember={s} selectedDate={selectedDate} onToggleAbsence={toggleAbsence} onEdit={() => { setEditingStaff(s); setStaffModalOpen(true); }} onRemove={() => removeStaff(s.id)} onAddPayment={() => { setPayingStaff(s); setPaymentModalOpen(true); }} />)}
            </CardContent>
            <StaffModal isOpen={isStaffModalOpen} onOpenChange={setStaffModalOpen} onSave={handleSaveStaff} staffMember={editingStaff} />
            <PaymentModal isOpen={isPaymentModalOpen} onOpenChange={setPaymentModalOpen} onSave={handleSavePayment} staffMember={payingStaff} />
        </Card>
    );
};

const StaffCard = ({ staffMember, selectedDate, onToggleAbsence, onEdit, onRemove, onAddPayment }: { staffMember: StaffMember, selectedDate: string, onToggleAbsence: (id: number, date: Date) => void, onEdit: () => void, onRemove: () => void, onAddPayment: () => void }) => {
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
    
    const absentDates = React.useMemo(() => (staffMember.absences || []).map(d => parse(d, 'yyyy-MM-dd', new Date())), [staffMember.absences]);
    const absentModifier = { absent: absentDates };
    const absentModifierStyles = { absent: { color: 'white', backgroundColor: 'hsl(var(--destructive))' } };

    const handleDayClick = (day: Date) => {
        onToggleAbsence(staffMember.id, day);
    };

    return (
      <Card className="bg-muted/40">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{staffMember.name}</CardTitle>
              <CardDescription>Salary: {(monthlySalary || 0).toFixed(2)}/month</CardDescription>
            </div>
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
        </CardHeader>
        <CardContent className="p-4 pt-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                   <h4 className="font-semibold mb-2 text-center">Monthly Summary ({format(currentMonth, 'MMMM yyyy')})</h4>
                   <div className="grid grid-cols-2 gap-2 text-center text-sm">
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
               <div className="flex flex-col items-center">
                    <h4 className="font-semibold mb-2 text-center">Mark Absences</h4>
                    <Calendar
                        mode="multiple"
                        selected={absentDates}
                        onDayClick={handleDayClick}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        modifiers={absentModifier}
                        modifiersStyles={absentModifierStyles}
                        className="rounded-md border p-0"
                        classNames={{
                            head_cell: "w-8 h-8 font-normal text-xs",
                            cell: "w-8 h-8 text-xs p-0",
                            day: "w-8 h-8",
                        }}
                    />
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

const CreditorsTab = ({ creditors, onUpdate }: { creditors: Creditor[], onUpdate: (updater: (prev: AppState) => AppState) => void }) => {
    const [view, setView] = React.useState<'list' | 'detail'>('list');
    const [selectedCreditor, setSelectedCreditor] = React.useState<Creditor | null>(null);
    const { toast } = useToast();
    const vcfInputRef = React.useRef<HTMLInputElement>(null);

    const handleSelectCreditor = (creditorId: number) => {
        const creditor = creditors.find(c => c.id === creditorId);
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

    const handleRemoveCreditor = (creditorId: number) => {
        onUpdate(prev => ({
            ...prev,
            creditors: prev.creditors.filter(c => c.id !== creditorId)
        }));
        toast({ title: "Creditor Removed", variant: "destructive" });
    };

    const handleAddTransaction = (creditorId: number, transaction: Omit<CreditorTransaction, 'id'>) => {
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

    const handleDeleteTransaction = (creditorId: number, transactionId: number) => {
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
        toast({ title: "Transaction Deleted", variant: 'destructive' });
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
                        if(!currentContact.phone) { // Only take the first number
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
        return <CreditorDetailView 
                  creditor={selectedCreditor} 
                  onBack={() => setView('list')} 
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onUpdateCreditor={handleUpdateCreditorDetails}
               />;
    }

    return <CreditorListView 
              creditors={creditors} 
              onSelectCreditor={handleSelectCreditor} 
              onAddCreditor={handleAddOrUpdateCreditor}
              onRemoveCreditor={handleRemoveCreditor}
              onImportClick={() => vcfInputRef.current?.click()}
              vcfInputRef={vcfInputRef}
              onVcfFileChange={handleImportVCF}
            />;
};

const CreditorListView = ({ creditors, onSelectCreditor, onAddCreditor, onRemoveCreditor, onImportClick, vcfInputRef, onVcfFileChange }: { creditors: Creditor[], onSelectCreditor: (id: number) => void, onAddCreditor: (name: string, phone: string) => void, onRemoveCreditor: (id: number) => void, onImportClick: () => void, vcfInputRef: React.RefObject<HTMLInputElement>, onVcfFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
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
                            <div key={c.id} className="p-3 flex justify-between items-center rounded-md border cursor-pointer hover:bg-muted/50" onClick={() => onSelectCreditor(c.id)}>
                                <div>
                                    <p className="font-semibold">{c.name}</p>
                                    <p className="text-sm text-muted-foreground">{c.phone || 'No phone'}</p>
                                </div>
                                <div className="text-right">
                                    <p className={cn("font-bold text-lg", balance > 0 ? 'text-red-600' : 'text-green-600')}>
                                        {balance.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{balance > 0 ? 'Dena Hai' : 'Lena Hai'}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="ml-2 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemoveCreditor(c.id); }}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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
    const [actionToConfirm, setActionToConfirm] = React.useState<(() => void) | null>(null);

    const balance = calculateBalance(creditor.transactions);

    const requestPassword = (action: () => void) => {
        setActionToConfirm(() => action); // Use a function to ensure the latest action is stored
    };

    const handleConfirmAction = () => {
        if (actionToConfirm) {
            actionToConfirm();
            setActionToConfirm(null);
        }
    };
    
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
                    <CardHeader>
                        <CardDescription>Final Balance</CardDescription>
                        <CardTitle className={cn(balance > 0 ? 'text-red-600' : 'text-green-600')}>
                             {balance > 0 ? `${balance.toFixed(2)} Dena Hai` : `${Math.abs(balance).toFixed(2)} Lena Hai`}
                        </CardTitle>
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
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => requestPassword(() => onDeleteTransaction(creditor.id, tx.id))}>
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
                onUpdateTransaction={(tx) => requestPassword(() => onUpdateTransaction(creditor.id, tx))}
            />
            <EditCreditorModal 
                isOpen={isEditCreditorModalOpen}
                onOpenChange={setEditCreditorModalOpen}
                creditor={creditor}
                onSave={onUpdateCreditor}
            />
            <PasswordPrompt
                open={!!actionToConfirm}
                onOpenChange={(open) => !open && setActionToConfirm(null)}
                onConfirm={handleConfirmAction}
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
    }, [transaction]);

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

const ReportSection = ({ entries, appState, onEdit, onDelete }: { entries: Entry[], appState: AppState, onEdit: (entry: Entry) => void, onDelete: (entry: Entry) => void }) => {
    const { toast } = useToast();

    const exportFullReportPdf = () => {
        const doc = new jsPDF();
        const selectedDateFmt = format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP");
        doc.setFontSize(20);
        doc.text("MASTER OF BRANDS", 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Daily Report: ${selectedDateFmt}`, 105, 22, { align: 'center' });

        // Summary Data
        const analyticsData = {
            opening: appState.openingBalance,
            cashSales: entries.filter(e => e.type === 'Cash').reduce((s, e) => s + e.amount, 0),
            onlineSales: entries.filter(e => e.type === 'Online').reduce((s, e) => s + e.amount, 0),
            udhariPaid: entries.filter(e => e.type === 'UDHARI PAID').reduce((s, e) => s + e.amount, 0),
            totalExpenses: Math.abs(entries.filter(e => e.type === 'Expense').reduce((s_1, e) => s_1 + e.amount, 0)),
        };
        
        const cashReturn = entries.filter(e => e.type === 'Cash Return').reduce((s_2, e) => s_2 + e.amount, 0);
        const udhariPaidCash = entries.filter(e => e.type === 'UDHARI PAID' && !e.details.includes('(Online)')).reduce((s_3, e) => s_3 + e.amount, 0);

        const totalInHand = analyticsData.opening + analyticsData.cashSales + udhariPaidCash + cashReturn + entries.filter(e => e.type === 'Expense').reduce((s_4, e) => s_4 + e.amount, 0);

        autoTable(doc, {
            startY: 30,
            head: [['Description', 'Amount']],
            body: [
                ['Opening Balance', analyticsData.opening.toFixed(2)],
                ['Cash Sales', analyticsData.cashSales.toFixed(2)],
                ['Udhari Paid (Cash)', udhariPaidCash.toFixed(2)],
                ['Cash Return', cashReturn.toFixed(2)],
                ['Total Expenses', `-${analyticsData.totalExpenses.toFixed(2)}`],
                ['Closing Cash', totalInHand.toFixed(2)],
            ],
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            foot: [['Total Online Sales', (analyticsData.onlineSales).toFixed(2)]],
            footStyles: { fillColor: [22, 160, 133], textColor: 255 },
            styles: { fontSize: 10 },
        });

        const allEntries = entries.map(e => [e.time, e.type, e.details, e.amount < 0 ? `-${Math.abs(e.amount).toFixed(2)}` : e.amount.toFixed(2)]);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Time', 'Type', 'Details', 'Amount']],
            body: allEntries,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 9 },
        });
        
        doc.save(`Full-Report-${appState.selectedDate}.pdf`);
        toast({ title: "PDF Exported", description: "Full report has been downloaded." });
    }
    
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
                                    <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold">{total.toFixed(2)}</TableCell>
                                    <TableCell></TableCell>
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
    const outflowEntries = entries.filter(e => ['Expense', 'Cash Return', 'Credit Return', 'UDHAR DIYE'].includes(e.type));


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                        <CardTitle>Daily Report: {format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP")}</CardTitle>
                        <CardDescription>A categorized log of all transactions for the selected day.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       <Button onClick={exportFullReportPdf} variant="destructive">Full Report PDF</Button>
                       <Button onClick={() => toast({title: "Coming soon"})} className="bg-green-700 hover:bg-green-800">Cash Report PDF</Button>
                       <Button onClick={() => toast({title: "Coming soon"})} className="bg-blue-700 hover:bg-blue-800">Online Report PDF</Button>
                       <Button onClick={() => toast({title: "Coming soon"})} className="bg-green-700 hover:bg-green-800">Export Excel</Button>
                   </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <TransactionTable title="Cash In" data={cashInEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Online" data={onlineInEntries} onEdit={onEdit} onDelete={onDelete} />
                    <TransactionTable title="Outflows" data={outflowEntries} onEdit={onEdit} onDelete={onDelete} />
                </div>
            </CardContent>
        </Card>
    );
};

    

    
