import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Quotation } from "@/types/quotation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Edit, Trash2 } from "lucide-react";

interface QuotationTableProps {
  quotations: Quotation[];
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onEdit: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
}

export const QuotationTable = ({
  quotations,
  currentPage,
  itemsPerPage,
  onPageChange,
  onEdit,
  onDelete,
}: QuotationTableProps) => {
  const totalPages = Math.ceil(quotations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentQuotations = quotations.slice(startIndex, endIndex);

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "invoiced") {
      return <Badge className="bg-success text-white hover:bg-success/90">{status}</Badge>;
    } else if (statusLower === "regret") {
      return <Badge variant="destructive">{status}</Badge>;
    } else if (statusLower === "pending") {
      return <Badge className="bg-warning text-white hover:bg-warning/90">{status}</Badge>;
    } else if (statusLower === "open") {
      return <Badge className="bg-brand-blue text-white hover:bg-brand-blue/90">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatAmount = (amount: string) => {
    const numAmount = parseFloat(amount.replace(/,/g, ""));
    return isNaN(numAmount) ? amount : numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">Actions</TableHead>
              <TableHead className="w-[110px]">Quotation No</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="min-w-[180px]">Client</TableHead>
              <TableHead className="w-[70px]">Type</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-[130px] text-right">Amount (AED)</TableHead>
              <TableHead className="w-[110px]">Sales Person</TableHead>
              <TableHead className="w-[100px]">Invoice No</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentQuotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No quotations found
                </TableCell>
              </TableRow>
            ) : (
              currentQuotations.map((quotation, index) => (
                <TableRow key={`${quotation["QUOTATION NO"]}-${index}`} className="hover:bg-secondary/50">
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(quotation)}
                        className="h-8 w-8 p-0 hover:bg-primary hover:text-primary-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(quotation)}
                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-primary">{quotation["QUOTATION NO"]}</TableCell>
                  <TableCell className="text-muted-foreground">{quotation["QUOTATION DATE"]}</TableCell>
                  <TableCell className="font-medium" title={quotation["CLIENT"]}>
                    {quotation["CLIENT"]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={quotation["NEW/OLD"] === "NEW" ? "default" : "secondary"} className="text-xs">
                      {quotation["NEW/OLD"]}
                    </Badge>
                  </TableCell>
                  <TableCell title={`${quotation["DESCRIPTION 1"]}${quotation["DESCRIPTION 2"] ? ` - ${quotation["DESCRIPTION 2"]}` : ''}`}>
                    <div className="max-w-[250px]">
                      <span className="block truncate">{quotation["DESCRIPTION 1"]}</span>
                      {quotation["DESCRIPTION 2"] && (
                        <span className="block text-xs text-muted-foreground truncate">{quotation["DESCRIPTION 2"]}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {formatAmount(quotation["TOTAL AMOUNT"])}
                  </TableCell>
                  <TableCell>{quotation["SALES  PERSON"]}</TableCell>
                  <TableCell className="text-muted-foreground">{quotation["INVOICE NO"] || "-"}</TableCell>
                  <TableCell>{getStatusBadge(quotation["STATUS"])}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, quotations.length)} of {quotations.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm font-medium px-4 py-2 bg-secondary rounded-md">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
