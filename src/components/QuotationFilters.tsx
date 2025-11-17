import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface QuotationFiltersProps {
  filters: {
    client: string;
    status: string;
    salesPerson: string;
    newOld: string;
    year: string;
    quotationNo: string;
    invoiceNo: string;
    dateFrom: string;
    dateTo: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  uniqueClients: string[];
  uniqueStatuses: string[];
  uniqueSalesPeople: string[];
}

export const QuotationFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  uniqueClients,
  uniqueStatuses,
  uniqueSalesPeople,
}: QuotationFiltersProps) => {
  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quotationNo">Quotation No</Label>
          <Input
            id="quotationNo"
            placeholder="Search quotation..."
            value={filters.quotationNo}
            onChange={(e) => onFilterChange("quotationNo", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client">Client</Label>
          <Select value={filters.client} onValueChange={(value) => onFilterChange("client", value)}>
            <SelectTrigger id="client">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {uniqueClients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={filters.status} onValueChange={(value) => onFilterChange("status", value)}>
            <SelectTrigger id="status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="salesPerson">Sales Person</Label>
          <Select value={filters.salesPerson} onValueChange={(value) => onFilterChange("salesPerson", value)}>
            <SelectTrigger id="salesPerson">
              <SelectValue placeholder="All sales people" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sales people</SelectItem>
              {uniqueSalesPeople.map((person) => (
                <SelectItem key={person} value={person}>
                  {person}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newOld">Client Type</Label>
          <Select value={filters.newOld} onValueChange={(value) => onFilterChange("newOld", value)}>
            <SelectTrigger id="newOld">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="NEW">NEW</SelectItem>
              <SelectItem value="OLD">OLD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Select value={filters.year} onValueChange={(value) => onFilterChange("year", value)}>
            <SelectTrigger id="year">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoiceNo">Invoice No</Label>
          <Input
            id="invoiceNo"
            placeholder="Search invoice..."
            value={filters.invoiceNo}
            onChange={(e) => onFilterChange("invoiceNo", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateFrom">Date From</Label>
          <Input
            id="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange("dateFrom", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateTo">Date To</Label>
          <Input
            id="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange("dateTo", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
