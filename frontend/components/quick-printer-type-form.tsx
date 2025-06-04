import { useState, useEffect } from "react"
import { useData } from "@/components/data-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Loader2, AlertTriangle } from "lucide-react"
import type { PrinterType } from "@/lib/types"

interface QuickPrinterTypeFormProps {
  onSuccess: (printerType: PrinterType) => void
  onCancel: () => void
  isModal?: boolean
  autoSelectAfterCreate?: boolean
}

interface PrinterTypeFormData {
  brand: string
  model: string
  expected_life_hours: string
}

export function QuickPrinterTypeForm({ 
  onSuccess, 
  onCancel, 
  isModal = false,
  autoSelectAfterCreate = true 
}: QuickPrinterTypeFormProps) {
  const { printerTypes, addPrinterType } = useData()
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<PrinterTypeFormData>({
    brand: "",
    model: "",
    expected_life_hours: "10000"
  })
  
  // Validation state
  const [errors, setErrors] = useState<Partial<PrinterTypeFormData>>({})
  
  // Extract unique brands for autocomplete
  const existingBrands = Array.from(
    new Set(printerTypes.map(pt => pt.brand))
  ).sort()
  
  const validateForm = (): boolean => {
    const newErrors: Partial<PrinterTypeFormData> = {}
    
    if (!formData.brand.trim()) {
      newErrors.brand = "Brand is required"
    }
    
    if (!formData.model.trim()) {
      newErrors.model = "Model is required"
    }
    
    const lifeHours = parseFloat(formData.expected_life_hours)
    if (isNaN(lifeHours) || lifeHours <= 0) {
      newErrors.expected_life_hours = "Expected life hours must be greater than 0"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const checkDuplicate = (): PrinterType | null => {
    return printerTypes.find(
      pt => pt.brand.trim().toLowerCase() === formData.brand.trim().toLowerCase() &&
            pt.model.trim().toLowerCase() === formData.model.trim().toLowerCase()
    ) || null
  }
  
  // Check for duplicate in real-time
  const [duplicateWarning, setDuplicateWarning] = useState<PrinterType | null>(null)
  
  useEffect(() => {
    if (formData.brand && formData.model) {
      const duplicate = checkDuplicate()
      setDuplicateWarning(duplicate)
    } else {
      setDuplicateWarning(null)
    }
  }, [formData.brand, formData.model, printerTypes])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!validateForm()) {
      return
    }
    
    // Check for duplicates
    const existingPrinterType = checkDuplicate()
    if (existingPrinterType) {
      toast({
        title: "Printer Type Already Exists",
        description: `${existingPrinterType.brand} ${existingPrinterType.model} is already defined.`,
        variant: "default"
      })
      
      if (autoSelectAfterCreate) {
        onSuccess(existingPrinterType)
      }
      return
    }
    
    setIsLoading(true)
    
    try {
      const requestData = {
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        expected_life_hours: parseFloat(formData.expected_life_hours)
      }
      
      const result = await addPrinterType(requestData)
      
      if (result) {
        toast({
          title: "Printer Type Created",
          description: `Successfully added ${result.brand} ${result.model} as a printer type.`
        })
        
        onSuccess(result)
      }
      
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Printer type was created by another process
        const existingPrinterType = error.response.data.existing_printer_type
        toast({
          title: "Printer Type Already Exists",
          description: "This printer type was just created. Selecting it for you.",
          variant: "default"
        })
        onSuccess(existingPrinterType)
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create printer type",
          variant: "destructive"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Brand Input */}
      <div className="space-y-2">
        <Label htmlFor="brand">Brand *</Label>
        <Input
          id="brand"
          value={formData.brand}
          onChange={(e) => setFormData({...formData, brand: e.target.value})}
          placeholder="e.g., Prusa, Bambu Lab, Creality"
          list="brand-suggestions"
          className={errors.brand ? "border-red-500" : ""}
        />
        <datalist id="brand-suggestions">
          {existingBrands.map(brand => (
            <option key={brand} value={brand} />
          ))}
        </datalist>
        {errors.brand && <p className="text-sm text-red-500">{errors.brand}</p>}
      </div>
      
      {/* Model Input */}
      <div className="space-y-2">
        <Label htmlFor="model">Model *</Label>
        <Input
          id="model"
          value={formData.model}
          onChange={(e) => setFormData({...formData, model: e.target.value})}
          placeholder="e.g., MK4, X1 Carbon, Ender 3 V3"
          className={errors.model ? "border-red-500" : ""}
        />
        {errors.model && <p className="text-sm text-red-500">{errors.model}</p>}
      </div>
      
      {/* Expected Life Hours */}
      <div className="space-y-2">
        <Label htmlFor="expected_life_hours">Expected Life Hours *</Label>
        <Input
          id="expected_life_hours"
          type="number"
          step="100"
          min="100"
          value={formData.expected_life_hours}
          onChange={(e) => setFormData({...formData, expected_life_hours: e.target.value})}
          placeholder="10000"
          className={errors.expected_life_hours ? "border-red-500" : ""}
        />
        <p className="text-xs text-muted-foreground">
          Estimated operational life before major maintenance
        </p>
        {errors.expected_life_hours && <p className="text-sm text-red-500">{errors.expected_life_hours}</p>}
      </div>
      
      {/* Duplicate Warning */}
      {duplicateWarning && (
        <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/30">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm">
            <strong>This printer type already exists!</strong><br />
            {duplicateWarning.brand} {duplicateWarning.model} - {duplicateWarning.expected_life_hours.toLocaleString()} hours
          </AlertDescription>
        </Alert>
      )}
      
      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isLoading || !!duplicateWarning}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleSubmit(e as any)
          }}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {duplicateWarning ? "Printer Type Already Exists" : "Create Printer Type"}
        </Button>
      </div>
    </form>
  )
}