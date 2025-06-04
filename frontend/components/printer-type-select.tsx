import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { QuickPrinterTypeForm } from "@/components/quick-printer-type-form"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, Check, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PrinterType } from "@/lib/types"

interface PrinterTypeSelectProps {
  value?: string | number
  onValueChange: (value: string | number) => void
  printerTypes: PrinterType[]
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  error?: boolean
}

export function PrinterTypeSelect({
  value,
  onValueChange,
  printerTypes,
  placeholder = "Select printer type",
  className,
  disabled,
  required,
  error
}: PrinterTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Find selected printer type
  const selectedPrinterType = printerTypes.find(pt => pt.id.toString() === value?.toString())
  
  // Group printer types by brand
  const groupedPrinterTypes = useMemo(() => {
    const groups = new Map<string, PrinterType[]>()
    
    printerTypes.forEach(printerType => {
      const brand = printerType.brand
      if (!groups.has(brand)) {
        groups.set(brand, [])
      }
      groups.get(brand)!.push(printerType)
    })
    
    // Sort brands alphabetically and models within each brand
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, printerTypes]) => ({
        brand,
        printerTypes: printerTypes.sort((a, b) => a.model.localeCompare(b.model))
      }))
    
    return sortedGroups
  }, [printerTypes])
  
  // Filter printer types based on search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedPrinterTypes
    
    const searchLower = search.toLowerCase()
    
    return groupedPrinterTypes
      .map(group => ({
        ...group,
        printerTypes: group.printerTypes.filter(printerType => 
          printerType.brand.toLowerCase().includes(searchLower) ||
          printerType.model.toLowerCase().includes(searchLower)
        )
      }))
      .filter(group => group.printerTypes.length > 0)
  }, [groupedPrinterTypes, search])
  
  const handleSelect = (printerTypeId: string) => {
    if (printerTypeId === "add-new") {
      setOpen(false)
      setIsModalOpen(true)
    } else {
      onValueChange(printerTypeId)
      setOpen(false)
    }
  }
  
  const handlePrinterTypeCreated = (printerType: PrinterType) => {
    onValueChange(printerType.id.toString())
    setIsModalOpen(false)
  }
  
  const handleModalCancel = () => {
    setIsModalOpen(false)
  }
  
  // Format display text for selected printer type
  const displayText = selectedPrinterType 
    ? `${selectedPrinterType.brand} ${selectedPrinterType.model} - ${selectedPrinterType.expected_life_hours.toLocaleString()} hrs`
    : placeholder
  
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select printer type"
            className={cn(
              "w-full justify-between font-normal",
              !selectedPrinterType && "text-muted-foreground",
              error && "border-red-500",
              className
            )}
            disabled={disabled}
          >
            <span className="truncate flex items-center gap-2">
              {selectedPrinterType && (
                <Printer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              {displayText}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search by brand or model..." 
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <CommandList>
              {filteredGroups.length === 0 && search && (
                <CommandEmpty>
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <p>No printer types found matching "{search}"</p>
                    <Button
                      variant="ghost"
                      className="mt-2 text-primary"
                      onClick={() => handleSelect("add-new")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add New Printer Type
                    </Button>
                  </div>
                </CommandEmpty>
              )}
              
              {filteredGroups.map((group) => (
                <CommandGroup key={group.brand} heading={group.brand}>
                  {group.printerTypes.map((printerType) => (
                    <CommandItem
                      key={printerType.id}
                      value={printerType.id.toString()}
                      onSelect={() => handleSelect(printerType.id.toString())}
                      className="flex items-center gap-2 py-2"
                    >
                      <Printer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 flex items-center justify-between">
                        <span>{printerType.model}</span>
                        <span className="text-xs text-muted-foreground">
                          {printerType.expected_life_hours.toLocaleString()} hrs
                        </span>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedPrinterType?.id === printerType.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              
              {filteredGroups.length > 0 && <CommandSeparator />}
              
              <CommandGroup>
                <CommandItem
                  value="add-new"
                  onSelect={() => handleSelect("add-new")}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Printer Type...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleModalCancel()} modal={true}>
        <DialogContent 
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add New Printer Type</DialogTitle>
            <DialogDescription>
              Define a new printer type with its specifications.
            </DialogDescription>
          </DialogHeader>
          <QuickPrinterTypeForm
            onSuccess={handlePrinterTypeCreated}
            onCancel={handleModalCancel}
            isModal={true}
            autoSelectAfterCreate={true}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}