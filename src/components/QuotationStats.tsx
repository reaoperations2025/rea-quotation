import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Coins, Clock } from "lucide-react";

interface QuotationStatsProps {
  totalQuotations: number;
  totalAmount: number;
  invoicedCount: number;
  regretCount: number;
  openCount?: number;
}

export const QuotationStats = ({
  totalQuotations,
  totalAmount,
  invoicedCount,
  regretCount,
  openCount = 0,
}: QuotationStatsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Total Quoted Amount */}
      <Card className="col-span-2 md:col-span-1 border-l-4 border-l-brand-blue bg-gradient-to-br from-brand-blue/5 to-transparent shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Quoted</span>
            <Coins className="h-4 w-4 text-brand-blue" />
          </div>
          <div className="text-2xl font-bold text-brand-blue">
            {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">AED • {totalQuotations} quotations</p>
        </CardContent>
      </Card>

      {/* Invoiced */}
      <Card className="border-l-4 border-l-success bg-gradient-to-br from-success/5 to-transparent shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoiced</span>
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-success">{invoicedCount}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalQuotations > 0 ? ((invoicedCount / totalQuotations) * 100).toFixed(1) : 0}% of total
          </p>
        </CardContent>
      </Card>

      {/* Open */}
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-500">{openCount}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalQuotations > 0 ? ((openCount / totalQuotations) * 100).toFixed(1) : 0}% of total
          </p>
        </CardContent>
      </Card>

      {/* Regret */}
      <Card className="border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-transparent shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Regret</span>
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-destructive">{regretCount}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalQuotations > 0 ? ((regretCount / totalQuotations) * 100).toFixed(1) : 0}% of total
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
