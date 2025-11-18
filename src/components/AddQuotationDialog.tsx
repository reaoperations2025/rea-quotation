import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Camera, Upload, Loader2, Trash2 } from "lucide-react";
import { Quotation } from "@/types/quotation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unitCost: string;
  lineTotal: string;
}

interface AddQuotationDialogProps {
  onAdd: (quotation: Quotation) => void;
}

export const AddQuotationDialog = ({ onAdd }: AddQuotationDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", qty: "", unitCost: "", lineTotal: "" }
  ]);
  const [formData, setFormData] = useState<Omit<Quotation, "DESCRIPTION 1" | "DESCRIPTION 2" | "QTY" | "UNIT COST" | "TOTAL AMOUNT">>({
    "QUOTATION NO": "",
    "QUOTATION DATE": "",
    "CLIENT": "",
    "NEW/OLD": "NEW",
    "SALES  PERSON": "",
    "INVOICE NO": "",
    "STATUS": "PENDING",
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Date.now().toString(), 
      description: "", 
      qty: "", 
      unitCost: "", 
      lineTotal: "" 
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
    setLineItems(prevItems => {
      return prevItems.map(item => {
        if (item.id !== id) return item;
        
        const updated = { ...item, [field]: value };
        
        // Auto-calculate line total
        if (field === "qty" || field === "unitCost") {
          const qty = parseFloat((field === "qty" ? value : updated.qty).replace(/,/g, "")) || 0;
          const unitCost = parseFloat((field === "unitCost" ? value : updated.unitCost).replace(/,/g, "")) || 0;
          const total = qty * unitCost;
          updated.lineTotal = total > 0 ? total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
        }
        
        return updated;
      });
    });
  };

  const calculateTotalAmount = () => {
    return lineItems.reduce((sum, item) => {
      const lineTotal = parseFloat(item.lineTotal.replace(/,/g, "")) || 0;
      return sum + lineTotal;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData["QUOTATION NO"] || !formData.CLIENT || !formData["QUOTATION DATE"]) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in Quotation No, Client, and Date",
        variant: "destructive",
      });
      return;
    }

    // Format line items into description fields
    const descriptions = lineItems
      .filter(item => item.description.trim())
      .map(item => `${item.description} (Qty: ${item.qty}, Unit: ${item.unitCost})`)
      .join(" | ");
    
    const totalQty = lineItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0).toString();
    const totalAmount = calculateTotalAmount();

    const quotation: Quotation = {
      ...formData,
      "DESCRIPTION 1": descriptions.substring(0, 200) || "",
      "DESCRIPTION 2": descriptions.substring(200, 400) || "",
      "QTY": totalQty,
      "UNIT COST": lineItems.length > 0 ? lineItems[0].unitCost : "",
      "TOTAL AMOUNT": totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };

    onAdd(quotation);
    toast({
      title: "Quotation Added",
      description: `Quotation ${formData["QUOTATION NO"]} with ${lineItems.length} item(s) has been added successfully.`,
    });
    
    // Reset form
    setFormData({
      "QUOTATION NO": "",
      "QUOTATION DATE": "",
      "CLIENT": "",
      "NEW/OLD": "NEW",
      "SALES  PERSON": "",
      "INVOICE NO": "",
      "STATUS": "PENDING",
    });
    setLineItems([{ id: "1", description: "", qty: "", unitCost: "", lineTotal: "" }]);
    setOpen(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractQuotationData = async (file: File) => {
    // Validate file type - support images, PDFs, and Excel
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image (JPG, PNG, WEBP), PDF, or Excel file.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      console.log('Converting file to base64...', file.name, file.type);
      const base64Data = await convertFileToBase64(file);
      
      console.log('Calling extract-quotation function...');
      const { data, error } = await supabase.functions.invoke('extract-quotation', {
        body: { imageData: base64Data }
      });

      console.log('Response:', data, error);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success && data.data) {
        setFormData(data.data);
        
        // Count filled vs empty fields
        const extractedFields = Object.entries(data.data).filter(([key, value]) => value && value.toString().trim() !== "").length;
        const totalFields = Object.keys(data.data).length;
        
        toast({
          title: "✓ Data Extracted Successfully",
          description: `Extracted ${extractedFields} out of ${totalFields} fields. Please review and verify the accuracy before saving.`,
        });
      } else {
        throw new Error(data.error || "Failed to extract data");
      }
    } catch (error) {
      console.error('Error extracting quotation:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to extract quotation data";
      toast({
        title: "Extraction Failed",
        description: errorMessage + " Please fill the form manually.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractQuotationData(file);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await extractQuotationData(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await extractQuotationData(file);
    }
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          await extractQuotationData(file);
          toast({
            title: "Image Pasted",
            description: "Processing the pasted image...",
          });
        }
        break;
      }
    }
  };

  useEffect(() => {
    if (open) {
      window.addEventListener('paste', handlePaste);
      return () => {
        window.removeEventListener('paste', handlePaste);
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-teal hover:bg-brand-teal/90">
          <Plus className="w-4 h-4 mr-2" />
          Add New Quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Quotation</DialogTitle>
          <DialogDescription>
            Fill in the quotation details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 border-2 border-dashed rounded-lg transition-colors ${
            isDragging 
              ? 'border-brand-teal bg-brand-teal/10' 
              : 'border-muted bg-muted'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                or drag & drop files here, or paste images (Ctrl/Cmd + V)
              </p>
              <p className="text-xs text-muted-foreground">
                📄 Supported: Images (JPG, PNG, WEBP), PDF, Excel (XLS, XLSX) - max 10MB
              </p>
            </div>
          </div>
        </div>

        {isScanning && (
          <div className="flex flex-col items-center justify-center gap-3 p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Analyzing document with AI...</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Extracting quotation details, client information, and pricing data
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quotationNo">Quotation No *</Label>
              <Input
                id="quotationNo"
                value={formData["QUOTATION NO"]}
                onChange={(e) => handleChange("QUOTATION NO", e.target.value)}
                placeholder="e.g., 25-0001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Quotation Date *</Label>
              <Input
                id="date"
                value={formData["QUOTATION DATE"]}
                onChange={(e) => handleChange("QUOTATION DATE", e.target.value)}
                placeholder="e.g., 01-Jan-25"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="client">Client *</Label>
              <Input
                id="client"
                value={formData.CLIENT}
                onChange={(e) => handleChange("CLIENT", e.target.value)}
                placeholder="Client name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newOld">Client Type</Label>
              <Select value={formData["NEW/OLD"]} onValueChange={(value) => handleChange("NEW/OLD", value)}>
                <SelectTrigger id="newOld">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="OLD">OLD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesPerson">Sales Person</Label>
              <Input
                id="salesPerson"
                value={formData["SALES  PERSON"]}
                onChange={(e) => handleChange("SALES  PERSON", e.target.value)}
                placeholder="Sales person name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.STATUS} onValueChange={(value) => handleChange("STATUS", value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="INVOICED">INVOICED</SelectItem>
                  <SelectItem value="REGRET">REGRET</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="invoiceNo">Invoice No</Label>
              <Input
                id="invoiceNo"
                value={formData["INVOICE NO"]}
                onChange={(e) => handleChange("INVOICE NO", e.target.value)}
                placeholder="Leave empty if not invoiced"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor={`desc-${item.id}`}>Description</Label>
                      <Textarea
                        id={`desc-${item.id}`}
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Item description"
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                      <Input
                        id={`qty-${item.id}`}
                        type="text"
                        value={item.qty}
                        onChange={(e) => updateLineItem(item.id, "qty", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`cost-${item.id}`}>Unit Cost</Label>
                      <Input
                        id={`cost-${item.id}`}
                        type="text"
                        value={item.unitCost}
                        onChange={(e) => updateLineItem(item.id, "unitCost", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {item.lineTotal && (
                    <div className="text-right">
                      <span className="text-sm font-medium">Line Total: </span>
                      <span className="text-lg font-bold text-brand-teal">{item.lineTotal}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end p-4 bg-muted rounded-lg">
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Grand Total: </span>
                <span className="text-2xl font-bold text-brand-teal">
                  {calculateTotalAmount().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-brand-teal hover:bg-brand-teal/90">
              Add Quotation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
