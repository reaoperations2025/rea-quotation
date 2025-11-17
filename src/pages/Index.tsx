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
import quotationsData from "@/data/quotations.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, FileSpreadsheet, FileText, ArrowUpDown } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";
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
    quotationNo: "",
    invoiceNo: "",
    dateFrom: "",
    dateTo: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("date-newest");
  const itemsPerPage = 50;

  // Check authentication and load quotations
  useEffect(() => {
    const loadQuotations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

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

      // Migrate from localStorage or JSON file if database is empty
      if (!data || data.length === 0) {
        let localQuotations: Quotation[] = [];
        
        // Try localStorage first
        const savedLocal = localStorage.getItem('quotations');
        if (savedLocal) {
          try {
            localQuotations = JSON.parse(savedLocal);
          } catch (e) {
            console.error('Failed to parse localStorage:', e);
          }
        }
        
        // If localStorage is empty, use JSON file
        if (localQuotations.length === 0) {
          localQuotations = quotationsData as Quotation[];
        }

        if (localQuotations.length > 0) {
          console.log('Migrating quotations to database...');
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const insertData = localQuotations.map(q => ({
              user_id: user.id,
              quotation_no: q["QUOTATION NO"],
              quotation_date: q["QUOTATION DATE"],
              client: q.CLIENT,
              new_old: q["NEW/OLD"],
              description_1: q["DESCRIPTION 1"],
              description_2: q["DESCRIPTION 2"],
              qty: q.QTY,
              unit_cost: q["UNIT COST"],
              total_amount: q["TOTAL AMOUNT"],
              sales_person: q["SALES  PERSON"],
              invoice_no: q["INVOICE NO"],
              status: q.STATUS,
            }));

            // Batch insert in chunks of 500 to avoid limits
            const batchSize = 500;
            let migratedCount = 0;
            
            for (let i = 0; i < insertData.length; i += batchSize) {
              const batch = insertData.slice(i, i + batchSize);
              const { error: insertError } = await supabase
                .from('quotations')
                .insert(batch);

              if (insertError) {
                console.error(`Error migrating batch ${i / batchSize + 1}:`, insertError);
                break;
              } else {
                migratedCount += batch.length;
                console.log(`Migrated ${migratedCount} of ${insertData.length} quotations...`);
              }
            }

            if (migratedCount === insertData.length) {
              setQuotations(localQuotations);
              toast({
                title: "Migration Complete",
                description: `Migrated all ${migratedCount} quotations to database`,
              });
              localStorage.removeItem('quotations');
            } else {
              toast({
                title: "Partial Migration",
                description: `Migrated ${migratedCount} of ${insertData.length} quotations`,
                variant: "destructive",
              });
            }
          }
        }
      } else {
        const formattedQuotations: Quotation[] = data.map(q => ({
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        loadQuotations();
      }
    });

    return () => subscription.unsubscribe();
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
      case "quotation-no":
        return sorted.sort((a, b) => a["QUOTATION NO"].localeCompare(b["QUOTATION NO"]));
      default:
        return sorted;
    }
  }, [filteredQuotations, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalAmount = filteredQuotations.reduce((sum, q) => {
      const amount = parseFloat(q["TOTAL AMOUNT"].replace(/,/g, ""));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const invoicedCount = filteredQuotations.filter((q) => q.STATUS === "INVOICED").length;
    const regretCount = filteredQuotations.filter((q) => q.STATUS === "REGRET").length;

    return {
      totalQuotations: filteredQuotations.length,
      totalAmount,
      invoicedCount,
      regretCount,
    };
  }, [filteredQuotations]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('quotations')
        .insert({
          user_id: user.id,
          quotation_no: newQuotation["QUOTATION NO"],
          quotation_date: newQuotation["QUOTATION DATE"],
          client: newQuotation.CLIENT,
          new_old: newQuotation["NEW/OLD"],
          description_1: newQuotation["DESCRIPTION 1"],
          description_2: newQuotation["DESCRIPTION 2"],
          qty: newQuotation.QTY,
          unit_cost: newQuotation["UNIT COST"],
          total_amount: newQuotation["TOTAL AMOUNT"],
          sales_person: newQuotation["SALES  PERSON"],
          invoice_no: newQuotation["INVOICE NO"],
          status: newQuotation.STATUS,
        });

      if (error) throw error;

      setQuotations(prev => [newQuotation, ...prev]);
      toast({
        title: "Success",
        description: "Quotation saved to database",
      });
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save quotation",
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
        .eq('user_id', user.id)
        .eq('quotation_no', originalQuotationNo);

      if (error) throw error;

      setQuotations(prev => 
        prev.map(q => 
          q["QUOTATION NO"] === originalQuotationNo ? updatedQuotation : q
        )
      );
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
          .eq('user_id', user.id)
          .eq('quotation_no', quotation["QUOTATION NO"]);

        if (error) throw error;

        setQuotations((prev) => prev.filter((q) => q["QUOTATION NO"] !== quotation["QUOTATION NO"]));
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
      
      <div className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Quotation Management</h2>
            <p className="text-muted-foreground">Track, manage, and export your quotations</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AddQuotationDialog onAdd={handleAddQuotation} />
            <Button 
              onClick={handleExportExcel}
              variant="outline"
              className="border-success text-success hover:bg-success hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              onClick={handleExportPDF}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Search across all fields..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 h-12 text-lg shadow-sm border-2 focus:border-brand-teal"
          />
        </div>

        <QuotationStats
          totalQuotations={stats.totalQuotations}
          totalAmount={stats.totalAmount}
          invoicedCount={stats.invoicedCount}
          regretCount={stats.regretCount}
        />

        <QuotationFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          uniqueClients={uniqueClients}
          uniqueStatuses={uniqueStatuses}
          uniqueSalesPeople={uniqueSalesPeople}
        />

        <div className="mt-6 mb-4 flex items-center gap-3">
          <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">Sort by:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-newest">Date (Newest First)</SelectItem>
              <SelectItem value="date-oldest">Date (Oldest First)</SelectItem>
              <SelectItem value="amount-highest">Amount (Highest First)</SelectItem>
              <SelectItem value="amount-lowest">Amount (Lowest First)</SelectItem>
              <SelectItem value="client-az">Client (A-Z)</SelectItem>
              <SelectItem value="client-za">Client (Z-A)</SelectItem>
              <SelectItem value="quotation-no">Quotation Number</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
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
