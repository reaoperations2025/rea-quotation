import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { QuotationFilters } from "@/components/QuotationFilters";
import { QuotationStats } from "@/components/QuotationStats";
import { QuotationTable } from "@/components/QuotationTable";
import { AddQuotationDialog } from "@/components/AddQuotationDialog";
import { EditQuotationDialog } from "@/components/EditQuotationDialog";
import { Quotation } from "@/types/quotation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet, FileText, ArrowUpDown, Users, Wifi } from "lucide-react";
import { exportToExcel, exportToPDF, exportClientsToExcel } from "@/utils/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    client: "all",
    status: "all",
    salesPerson: "all",
    newOld: "all",
    year: "all",
    quotationNo: "",
    invoiceNo: "",
    dateFrom: "",
    dateTo: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("date-newest");
  const itemsPerPage = 10000; // Show all quotations

  // Check authentication and load quotations
  useEffect(() => {
    const loadQuotations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // DISABLED: autoFixData() was deleting all manual changes
      // await autoFixData();

      console.log('Loading all quotations...');
      
      // Load all quotations in batches (Supabase has 1000 row limit per request)
      let allQuotations: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await supabase
          .from('quotations')
          .select('*', { count: 'exact' })
          .order('quotation_no', { ascending: true })
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Error loading quotations:', error);
          toast({
            title: "Error loading quotations",
            description: error.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (data) {
          allQuotations = [...allQuotations, ...data];
          console.log(`Loaded batch: ${data.length} records (total so far: ${allQuotations.length}/${count || 0})`);
          
          // Continue if this batch was full (indicating there might be more)
          if (data.length === batchSize && allQuotations.length < (count || 0)) {
            from += batchSize;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`✓ Loaded ALL ${allQuotations.length} quotations from database`);
      
      // Clear localStorage - we only use database now
      localStorage.removeItem('quotations');

      if (allQuotations.length > 0) {
        const formattedQuotations: Quotation[] = allQuotations.map(q => ({
          "QUOTATION NO": q.quotation_no,
          "QUOTATION DATE": q.quotation_date,
          "CLIENT": q.client,
          "NEW/OLD": q.new_old,
          "DESCRIPTION 1": q.description_1 || "",
          "DESCRIPTION 2": q.description_2 || "",
          "QTY": q.qty || "",
          "UNIT COST": q.unit_cost || "",
          "TOTAL AMOUNT": q.total_amount || "",
          "SALES  PERSON": q.sales_person || "",
          "INVOICE NO": q.invoice_no || "",
          "STATUS": q.status,
        }));
        setQuotations(formattedQuotations);
      }
      
      setLoading(false);
    };

    loadQuotations();

    // Set up realtime subscription for live updates
    const channel = supabase
      .channel('quotations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotations'
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          const quotationNo = newData?.quotation_no || oldData?.quotation_no || 'unknown';
          console.log('Realtime change detected:', payload.eventType, 'Quotation:', quotationNo);
          
          if (payload.eventType === 'INSERT') {
            const newQuotation: Quotation = {
              "QUOTATION NO": payload.new.quotation_no,
              "QUOTATION DATE": payload.new.quotation_date,
              "CLIENT": payload.new.client,
              "NEW/OLD": payload.new.new_old,
              "DESCRIPTION 1": payload.new.description_1 || "",
              "DESCRIPTION 2": payload.new.description_2 || "",
              "QTY": payload.new.qty || "",
              "UNIT COST": payload.new.unit_cost || "",
              "TOTAL AMOUNT": payload.new.total_amount || "",
              "SALES  PERSON": payload.new.sales_person || "",
              "INVOICE NO": payload.new.invoice_no || "",
              "STATUS": payload.new.status,
            };
            setQuotations(prev => [newQuotation, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedQuotation: Quotation = {
              "QUOTATION NO": payload.new.quotation_no,
              "QUOTATION DATE": payload.new.quotation_date,
              "CLIENT": payload.new.client,
              "NEW/OLD": payload.new.new_old,
              "DESCRIPTION 1": payload.new.description_1 || "",
              "DESCRIPTION 2": payload.new.description_2 || "",
              "QTY": payload.new.qty || "",
              "UNIT COST": payload.new.unit_cost || "",
              "TOTAL AMOUNT": payload.new.total_amount || "",
              "SALES  PERSON": payload.new.sales_person || "",
              "INVOICE NO": payload.new.invoice_no || "",
              "STATUS": payload.new.status,
            };
            setQuotations(prev =>
              prev.map(q => q["QUOTATION NO"] === payload.old.quotation_no ? updatedQuotation : q)
            );
          } else if (payload.eventType === 'DELETE') {
            setQuotations(prev =>
              prev.filter(q => q["QUOTATION NO"] !== payload.old.quotation_no)
            );
          }
        }
      )
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadQuotations();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  // Get unique values for filters (excluding empty strings)
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(quotations.map((q) => q.CLIENT).filter(c => c && c.trim() !== ""))).sort();
  }, [quotations]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(quotations.map((q) => q.STATUS).filter(s => s && s.trim() !== ""))).sort();
  }, [quotations]);

  const uniqueSalesPeople = useMemo(() => {
    return Array.from(new Set(quotations.map((q) => q["SALES  PERSON"]).filter(p => p && p.trim() !== ""))).sort();
  }, [quotations]);

  // Helper function to parse date strings
  const parseDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split("-");
    const monthMap: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    return new Date(2000 + parseInt(year), monthMap[month], parseInt(day));
  };

  // Filter quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((quotation) => {
      // Search query filter (searches across all fields)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableFields = [
          quotation["QUOTATION NO"],
          quotation.CLIENT,
          quotation["DESCRIPTION 1"],
          quotation["DESCRIPTION 2"],
          quotation["SALES  PERSON"],
          quotation.STATUS,
          quotation["INVOICE NO"],
        ];
        if (!searchableFields.some((field) => field.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Client filter
      if (filters.client !== "all" && quotation.CLIENT !== filters.client) {
        return false;
      }

      // Status filter
      if (filters.status !== "all" && quotation.STATUS !== filters.status) {
        return false;
      }

      // Sales person filter
      if (filters.salesPerson !== "all" && quotation["SALES  PERSON"] !== filters.salesPerson) {
        return false;
      }

      // New/Old filter
      if (filters.newOld !== "all" && quotation["NEW/OLD"] !== filters.newOld) {
        return false;
      }

      // Year filter
      if (filters.year !== "all") {
        const quotationYear = quotation["QUOTATION DATE"].split("-")[2];
        const fullYear = quotationYear === "24" ? "2024" : quotationYear === "25" ? "2025" : "";
        if (fullYear !== filters.year) {
          return false;
        }
      }

      // Quotation number filter
      if (filters.quotationNo && !quotation["QUOTATION NO"].toLowerCase().includes(filters.quotationNo.toLowerCase())) {
        return false;
      }

      // Invoice number filter
      if (filters.invoiceNo && !quotation["INVOICE NO"].toLowerCase().includes(filters.invoiceNo.toLowerCase())) {
        return false;
      }

      // Date filters
      if (filters.dateFrom || filters.dateTo) {
        const quotationDate = parseDate(quotation["QUOTATION DATE"]);
        if (filters.dateFrom && quotationDate < new Date(filters.dateFrom)) {
          return false;
        }
        if (filters.dateTo && quotationDate > new Date(filters.dateTo)) {
          return false;
        }
      }

      return true;
    });
  }, [quotations, filters, searchQuery]);

  // Sort quotations
  const sortedQuotations = useMemo(() => {
    const sorted = [...filteredQuotations];
    
    switch (sortBy) {
      case "date-newest":
        return sorted.sort((a, b) => parseDate(b["QUOTATION DATE"]).getTime() - parseDate(a["QUOTATION DATE"]).getTime());
      case "date-oldest":
        return sorted.sort((a, b) => parseDate(a["QUOTATION DATE"]).getTime() - parseDate(b["QUOTATION DATE"]).getTime());
      case "amount-highest":
        return sorted.sort((a, b) => {
          const amountA = parseFloat(a["TOTAL AMOUNT"].replace(/,/g, "")) || 0;
          const amountB = parseFloat(b["TOTAL AMOUNT"].replace(/,/g, "")) || 0;
          return amountB - amountA;
        });
      case "amount-lowest":
        return sorted.sort((a, b) => {
          const amountA = parseFloat(a["TOTAL AMOUNT"].replace(/,/g, "")) || 0;
          const amountB = parseFloat(b["TOTAL AMOUNT"].replace(/,/g, "")) || 0;
          return amountA - amountB;
        });
      case "client-az":
        return sorted.sort((a, b) => a.CLIENT.localeCompare(b.CLIENT));
      case "client-za":
        return sorted.sort((a, b) => b.CLIENT.localeCompare(a.CLIENT));
      case "status":
        return sorted.sort((a, b) => a.STATUS.localeCompare(b.STATUS));
      case "quotation-no-asc":
        return sorted.sort((a, b) => a["QUOTATION NO"].localeCompare(b["QUOTATION NO"]));
      case "quotation-no-desc":
        return sorted.sort((a, b) => b["QUOTATION NO"].localeCompare(a["QUOTATION NO"]));
      default:
        return sorted;
    }
  }, [filteredQuotations, sortBy]);

  // Calculate statistics - ALWAYS use sortedQuotations (which are already filtered)
  const stats = useMemo(() => {
    const dataToUse = sortedQuotations;

    console.log(`📊 Calculating stats from ${dataToUse.length} quotations out of ${quotations.length} total`);

    const totalAmount = dataToUse.reduce((sum, q) => {
      const amountStr = (q["TOTAL AMOUNT"] || "").toString().trim();
      // Skip null, empty, or "-" values
      if (!amountStr || amountStr === "" || amountStr === "-") return sum;
      // Remove commas and parse as float
      const cleanStr = amountStr.replace(/,/g, "");
      const amount = parseFloat(cleanStr);
      // Only add if valid number
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const invoicedCount = dataToUse.filter((q) => 
      q.STATUS && q.STATUS.toUpperCase() === "INVOICED"
    ).length;
    
    const regretCount = dataToUse.filter((q) => 
      q.STATUS && q.STATUS.toUpperCase() === "REGRET"
    ).length;

    const openCount = dataToUse.filter((q) => 
      q.STATUS && q.STATUS.toUpperCase() === "OPEN"
    ).length;

    const calculatedStats = {
      totalQuotations: dataToUse.length,
      totalAmount,
      invoicedCount,
      regretCount,
      openCount,
    };

    console.log('✅ Stats calculated:', calculatedStats);

    return calculatedStats;
  }, [sortedQuotations, quotations.length]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      client: "all",
      status: "all",
      salesPerson: "all",
      newOld: "all",
      year: "all",
      quotationNo: "",
      invoiceNo: "",
      dateFrom: "",
      dateTo: "",
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleAddQuotation = async (newQuotation: Quotation) => {
    try {
      console.log('Adding quotation to database:', newQuotation["QUOTATION NO"], newQuotation.CLIENT);
      
      const { data, error } = await supabase
        .from('quotations')
        .insert({
          quotation_no: newQuotation["QUOTATION NO"],
          quotation_date: newQuotation["QUOTATION DATE"],
          client: newQuotation.CLIENT,
          new_old: newQuotation["NEW/OLD"],
          description_1: newQuotation["DESCRIPTION 1"] || "",
          description_2: newQuotation["DESCRIPTION 2"] || "",
          qty: newQuotation.QTY || "",
          unit_cost: newQuotation["UNIT COST"] || "",
          total_amount: newQuotation["TOTAL AMOUNT"] || "",
          sales_person: newQuotation["SALES  PERSON"] || "",
          invoice_no: newQuotation["INVOICE NO"] || "",
          status: newQuotation.STATUS,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      if (!data) {
        throw new Error("No data returned from insert");
      }

      console.log('✓ Quotation saved successfully to database:', data.quotation_no);
      
      toast({
        title: "Success",
        description: `Quotation ${newQuotation["QUOTATION NO"]} for ${newQuotation.CLIENT} has been saved`,
      });
      
      // Realtime subscription will handle adding to local state
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save quotation to database",
        variant: "destructive",
      });
    }
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setEditingQuotation(quotation);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (updatedQuotation: Quotation, originalQuotationNo: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('quotations')
        .update({
          quotation_no: updatedQuotation["QUOTATION NO"],
          quotation_date: updatedQuotation["QUOTATION DATE"],
          client: updatedQuotation.CLIENT,
          new_old: updatedQuotation["NEW/OLD"],
          description_1: updatedQuotation["DESCRIPTION 1"],
          description_2: updatedQuotation["DESCRIPTION 2"],
          qty: updatedQuotation.QTY,
          unit_cost: updatedQuotation["UNIT COST"],
          total_amount: updatedQuotation["TOTAL AMOUNT"],
          sales_person: updatedQuotation["SALES  PERSON"],
          invoice_no: updatedQuotation["INVOICE NO"],
          status: updatedQuotation.STATUS,
        })
        .eq('quotation_no', originalQuotationNo);

      if (error) throw error;

      // Realtime will handle updating the state
      toast({
        title: "Success",
        description: "Quotation updated in database",
      });
    } catch (error: any) {
      console.error('Error updating quotation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update quotation",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuotation = async (quotation: Quotation) => {
    if (window.confirm(`Are you sure you want to delete quotation ${quotation["QUOTATION NO"]}?`)) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from('quotations')
          .delete()
          .eq('quotation_no', quotation["QUOTATION NO"]);

        if (error) throw error;

        // Realtime will handle updating the state
        toast({
          title: "Deleted",
          description: "Quotation deleted from database",
        });
      } catch (error: any) {
        console.error('Error deleting quotation:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete quotation",
          variant: "destructive",
        });
      }
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filteredQuotations, 'rea_quotations');
    toast({
      title: "Export Successful",
      description: `Exported ${filteredQuotations.length} quotations to Excel.`,
    });
  };

  const handleExportPDF = () => {
    exportToPDF(filteredQuotations, 'rea_quotations');
    toast({
      title: "Export Successful",
      description: `Exported ${filteredQuotations.length} quotations to PDF.`,
    });
  };

  const handleExportClients = () => {
    exportClientsToExcel(quotations, 'rea_clients');
    const uniqueClientsCount = new Set(quotations.map(q => q.CLIENT).filter(c => c && c.trim() !== '')).size;
    toast({
      title: "Export Successful",
      description: `Exported ${uniqueClientsCount} unique clients to Excel.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      <Header />
      
      <div className="container mx-auto py-6 px-4 flex-1">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Quotations</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wifi className="h-3 w-3 text-success animate-pulse" />
                <span>Real-time sync enabled</span>
                <span className="text-border">•</span>
                <span>{quotations.length} total records</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <AddQuotationDialog onAdd={handleAddQuotation} />
              
              <div className="flex gap-2 border-l pl-2 ml-1">
                <Button 
                  onClick={handleExportExcel}
                  variant="outline"
                  size="sm"
                  className="text-success border-success/30 hover:bg-success hover:text-white"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  Excel
                </Button>
                <Button 
                  onClick={handleExportPDF}
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  PDF
                </Button>
                <Button 
                  onClick={handleExportClients}
                  variant="outline"
                  size="sm"
                  className="text-purple-500 border-purple-500/30 hover:bg-purple-500 hover:text-white"
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  Clients
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <QuotationStats
          totalQuotations={stats.totalQuotations}
          totalAmount={stats.totalAmount}
          invoicedCount={stats.invoicedCount}
          regretCount={stats.regretCount}
          openCount={stats.openCount}
        />

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Search quotations by client, description, status..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-12 h-12 text-base shadow-sm border-2 focus:border-primary rounded-xl bg-card"
          />
        </div>

        {/* Filters */}
        <QuotationFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          uniqueClients={uniqueClients}
          uniqueStatuses={uniqueStatuses}
          uniqueSalesPeople={uniqueSalesPeople}
        />

        {/* Sort & Table */}
        <div className="mt-6 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Date (Newest)</SelectItem>
                <SelectItem value="date-oldest">Date (Oldest)</SelectItem>
                <SelectItem value="amount-highest">Amount (High → Low)</SelectItem>
                <SelectItem value="amount-lowest">Amount (Low → High)</SelectItem>
                <SelectItem value="client-az">Client (A → Z)</SelectItem>
                <SelectItem value="client-za">Client (Z → A)</SelectItem>
                <SelectItem value="quotation-no-asc">Quote # (Ascending)</SelectItem>
                <SelectItem value="quotation-no-desc">Quote # (Descending)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{sortedQuotations.length}</span> quotations
          </p>
        </div>

        <div className="mt-6">
            <QuotationTable
              quotations={sortedQuotations}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onEdit={handleEditQuotation}
              onDelete={handleDeleteQuotation}
            />
        </div>

        <EditQuotationDialog
          quotation={editingQuotation}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={handleSaveEdit}
        />
      </div>

      <Footer />
    </div>
  );
};

export default Index;
