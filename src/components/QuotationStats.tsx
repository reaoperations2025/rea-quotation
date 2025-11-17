import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Coins } from "lucide-react";

interface QuotationStatsProps {
  totalQuotations: number;
  totalAmount: number;
  invoicedCount: number;
  regretCount: number;
}

export const QuotationStats = ({
  totalQuotations,
  totalAmount,
  invoicedCount,
  regretCount,
}: QuotationStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <Card className="border-l-4 border-l-brand-blue shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Amount (AED)</CardTitle>
          <Coins className="h-5 w-5 text-brand-blue" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-brand-blue">
            {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">United Arab Emirates Dirham</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-success shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
          <CheckCircle className="h-5 w-5 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-success">{invoicedCount}</div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-destructive shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Regret</CardTitle>
          <XCircle className="h-5 w-5 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-destructive">{regretCount}</div>
        </CardContent>
      </Card>
    </div>
  );
};
