
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
  MoreVertical
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
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import type { Entry, StaffMember, InventoryItem, Creditor, AppState, StaffPayment } from '@/lib/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


const LSK = "mob_data_v12";

const initialAppState: AppState = {
    entries: [],
    staff: [],
    openingBalance: 0,
    selectedDate: format(new Date(), "yyyy-MM-dd"),
    inventory: {
        billData: [],
    },
    creditors: [],
};


export default function BrandTrackerPro() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = React.useState(false);
  const [appState, setAppState] = React.useState<AppState>(initialAppState);
  const [activeTab, setActiveTab] = React.useState("sales");
  
  // Modal States
  const [confirmationModal, setConfirmationModal] = React.useState<{isOpen: boolean; message: string; onConfirm: () => void}>({isOpen: false, message: "", onConfirm: () => {}});
  
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
  
  const handleAddEntry = (type: Entry['type'], amount: number, details: string) => {
    updateState(prev => {
        const newEntry: Entry = {
            id: Date.now(),
            date: prev.selectedDate,
            time: format(new Date(), 'p'),
            type,
            amount,
            details
        };
        return { ...prev, entries: [...prev.entries, newEntry] };
    });
    toast({ title: "Entry Added", description: `${type} entry of ${Math.abs(amount)} has been added.` });
  };
  
  const handleDateChange = (date?: Date) => {
    if (date) {
        updateState(prev => ({...prev, selectedDate: format(date, 'yyyy-MM-dd')}));
    }
  };

  const handleOpeningBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    updateState(prev => ({...prev, openingBalance: value}));
  };

  if (!isMounted) {
    return null; // or a loading spinner
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "sales":
        return <SalesTab onAddEntry={handleAddEntry} />;
      case "expenses":
        return <ExpensesTab onAddEntry={handleAddEntry} />;
      case "udhari":
        return <UdhariTab onAddEntry={handleAddEntry} />;
      case "staff":
        return <StaffTab staff={appState.staff} onUpdate={updateState} selectedDate={appState.selectedDate} />;
      case "inventory":
        return <InventoryTab />;
      case "creditors":
        return <CreditorsTab creditors={appState.creditors} onUpdate={updateState} />;
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
      
      {activeTab !== 'inventory' && <ReportSection entries={appState.entries.filter(e => e.date === appState.selectedDate)} appState={appState} />}
    </div>
  );
}

const Header = ({ reportDate, onDateChange, openingBalance, onOpeningBalanceChange }: { reportDate: Date; onDateChange: (date?: Date) => void; openingBalance: number; onOpeningBalanceChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
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

const SalesTab = ({ onAddEntry }: { onAddEntry: (type: Entry['type'], amount: number, details: string) => void }) => {
    const [saleType, setSaleType] = React.useState<Entry['type']>('Online');
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const { toast } = useToast();

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
        const details = ['UDHAR DIYE', 'Credit Return'].includes(saleType) ? customer.trim() : saleType;
        
        onAddEntry(saleType, finalAmount, details);
        setAmount('');
        setCustomer('');
    }

    const saleTypes: { label: string, type: Entry['type'], className?: string }[] = [
        { label: "Cash", type: "Cash" },
        { label: "Online", type: "Online" },
        { label: "Udhari", type: "UDHAR DIYE" },
        { label: "Cash Return", type: "Cash Return", className: "bg-orange-200 text-orange-700 hover:bg-orange-300" },
        { label: "Udhari Return", type: "Credit Return", className: "col-span-2 bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
    ];

    return (
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Add Sale or Return</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {saleTypes.map(st => (
                            <Button 
                                key={st.type} 
                                type="button" 
                                variant={saleType === st.type ? "default" : "outline"}
                                className={cn(st.className, saleType === st.type && "ring-2 ring-primary")}
                                onClick={() => setSaleType(st.type)}
                            >
                                {st.label}
                            </Button>
                        ))}
                    </div>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Amount" required />
                    {['UDHAR DIYE', 'Credit Return'].includes(saleType) && (
                        <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer Name (required for Udhari)" required />
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

const UdhariTab = ({ onAddEntry }: { onAddEntry: (type: Entry['type'], amount: number, details: string) => void }) => {
    const [amount, setAmount] = React.useState('');
    const [customer, setCustomer] = React.useState('');
    const [method, setMethod] = React.useState('Cash');
    const { toast } = useToast();

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
        const details = `From: ${customer.trim()} (${method})`;
        onAddEntry('UDHARI PAID', numAmount, details);
        setAmount('');
        setCustomer('');
    }

    return (
        <Card>
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-1">Record Udhari Payment</h3>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="Paid Amount" required />
                    <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer Name" required />
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
                    return { ...s, payments: [...s.payments, newPayment] };
                }
                return s;
            })
        }));

        toast({ title: "Payment Recorded" });
        setPayingStaff(null);
        setPaymentModalOpen(false);
    };

    const toggleAbsence = (staffId: number) => {
        onUpdate(prev => ({
            ...prev,
            staff: prev.staff.map(s => {
                if (s.id === staffId) {
                    const isAbsent = s.absences.includes(selectedDate);
                    const newAbsences = isAbsent
                        ? s.absences.filter(d => d !== selectedDate)
                        : [...s.absences, selectedDate];
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

const StaffCard = ({ staffMember, selectedDate, onToggleAbsence, onEdit, onRemove, onAddPayment }: { staffMember: StaffMember, selectedDate: string, onToggleAbsence: (id: number) => void, onEdit: () => void, onRemove: () => void, onAddPayment: () => void }) => {
    const currentDate = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const monthlySalary = staffMember.monthlySalary || 0;

    const absencesThisMonth = (staffMember.absences || []).filter(d => isSameMonth(parse(d, 'yyyy-MM-dd', new Date()), currentDate)).length;
    const paymentsThisMonth = (staffMember.payments || []).filter(p => isSameMonth(parse(p.date, 'yyyy-MM-dd', new Date()), currentDate)).reduce((sum, p) => sum + p.amount, 0);

    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    const salaryPerDay = monthlySalary > 0 && daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
    const deduction = absencesThisMonth * salaryPerDay;
    const netSalary = monthlySalary - deduction - paymentsThisMonth;
    
    const absentDates = React.useMemo(() => (staffMember.absences || []).map(d => parse(d, 'yyyy-MM-dd', new Date())), [staffMember.absences]);
    const absentModifier = { absent: absentDates };
    const absentModifierStyles = { absent: { color: 'white', backgroundColor: 'hsl(var(--destructive))' } };

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
           <Button onClick={() => onToggleAbsence(staffMember.id)} variant={(staffMember.absences || []).includes(selectedDate) ? "destructive" : "outline"} className="w-full mb-4">
              {(staffMember.absences || []).includes(selectedDate) ? `Present (Remove Absence for ${format(currentDate, "do MMM")})` : `Absent (Mark Absent for ${format(currentDate, "do MMM")})`}
           </Button>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
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
               <div className="flex justify-center items-center">
                    <Calendar
                        mode="multiple"
                        month={currentDate}
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


const CreditorsTab = ({ creditors, onUpdate }: { creditors: Creditor[], onUpdate: (updater: (prev: AppState) => AppState) => void }) => {
    const [name, setName] = React.useState("");
    const [amount, setAmount] = React.useState("");
    const { toast } = useToast();

    const addCreditor = () => {
        const numAmount = parseFloat(amount);
        if (!name.trim() || isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Invalid input", description: "Please enter a valid name and positive amount.", variant: "destructive" });
            return;
        }
        onUpdate(prev => ({
            ...prev,
            creditors: [...(prev.creditors || []), { name: name.trim(), amount: numAmount }]
        }));
        setName("");
        setAmount("");
        toast({ title: "Creditor added" });
    };

    const removeCreditor = (creditorName: string) => {
        onUpdate(prev => ({
            ...prev,
            creditors: (prev.creditors || []).filter(c => c.name !== creditorName)
        }));
        toast({ title: "Creditor removed", variant: "destructive" });
    };

    const totalCredit = React.useMemo(() => (creditors || []).reduce((sum, c) => sum + c.amount, 0), [creditors]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Creditors Report</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="flex gap-2 mb-4">
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Creditor Name" />
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
                    <Button onClick={addCreditor}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Creditor Name</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(creditors || []).length > 0 ? (creditors || []).map((c, i) => (
                                <TableRow key={i}>
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell className="text-right">{c.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => removeCreditor(c.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">No creditors found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableHead>Total</TableHead>
                                <TableHead className="text-right">{totalCredit.toFixed(2)}</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
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

const ReportSection = ({ entries, appState }: { entries: Entry[], appState: AppState }) => {
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
            totalExpenses: Math.abs(entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0)),
        };

        const totalInHand = analyticsData.opening + analyticsData.cashSales + analyticsData.udhariPaid - analyticsData.totalExpenses;

        autoTable(doc, {
            startY: 30,
            head: [['Description', 'Amount']],
            body: [
                ['Opening Balance', analyticsData.opening.toFixed(2)],
                ['Cash Sales', analyticsData.cashSales.toFixed(2)],
                ['Online Sales', analyticsData.onlineSales.toFixed(2)],
                ['Udhari Paid', analyticsData.udhariPaid.toFixed(2)],
                ['Total Expenses', `-${analyticsData.totalExpenses.toFixed(2)}`],
                ['Closing Cash', totalInHand.toFixed(2)],
            ],
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            foot: [['Total Online', (analyticsData.onlineSales).toFixed(2)]],
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
    
    const chartData = React.useMemo(() => {
        const sales = entries.filter(e => e.type === 'Cash' || e.type === 'Online').reduce((sum, e) => sum + e.amount, 0);
        const expenses = Math.abs(entries.filter(e => e.type === 'Expense').reduce((sum, e) => sum + e.amount, 0));
        return [
            { name: "Sales", value: sales, fill: "hsl(var(--primary))" },
            { name: "Expenses", value: expenses, fill: "hsl(var(--destructive))" },
        ];
    }, [entries]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Report for {format(parse(appState.selectedDate, 'yyyy-MM-dd', new Date()), "PPP")}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="my-4 p-2 bg-muted rounded-lg h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6">
                    <TransactionList title="Cash Transactions" entries={entries.filter(e => e.type === 'Cash' || (e.type === 'UDHARI PAID' && !e.details.includes('(Online)')))} color="text-green-700" />
                    <TransactionList title="Online Transactions" entries={entries.filter(e => e.type === 'Online' || (e.type === 'UDHARI PAID' && e.details.includes('(Online)')))} color="text-blue-700" />
                    <TransactionList title="Expenses & Outflows" entries={entries.filter(e => ['Expense', 'Cash Return', 'Credit Return', 'UDHAR DIYE'].includes(e.type))} color="text-red-700" />
                </div>
                
                 <div className="flex flex-wrap gap-2 mt-3">
                    <Button onClick={exportFullReportPdf} variant="destructive">Full Report PDF</Button>
                    <Button onClick={() => toast({title: "Coming soon"})} className="bg-green-700 hover:bg-green-800">Cash Report PDF</Button>
                    <Button onClick={() => toast({title: "Coming soon"})} className="bg-blue-700 hover:bg-blue-800">Online Report PDF</Button>
                    <Button onClick={() => toast({title: "Coming soon"})} className="bg-green-700 hover:bg-green-800">Export Excel</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const TransactionList = ({ title, entries, color }: { title: string, entries: Entry[], color: string }) => (
    <div className="bg-muted p-4 rounded-lg">
        <h3 className={cn("font-semibold text-lg mb-2", color)}>{title}</h3>
        <div className="overflow-y-auto h-96">
            <Table>
                <TableBody>
                    {entries.length > 0 ? entries.map(entry => (
                        <TableRow key={entry.id}>
                            <TableCell>
                                <div>{entry.details}</div>
                                <div className="text-xs text-muted-foreground">{entry.time}</div>
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", entry.amount < 0 && "text-destructive")}>
                                {entry.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6"><span className="text-xs">✏️</span></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><span className="text-xs">🗑️</span></Button>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No transactions.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
);

    

    
