import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { QuickFilamentForm } from "@/components/quick-filament-form"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, Check, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Filament } from "@/lib/types"
import { getColorHex } from "@/lib/constants/filaments"

interface FilamentSelectProps {
  value?: string | number
  onValueChange: (value: string | number) => void
  filaments: Filament[]
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  error?: boolean
}

export function FilamentSelect({
  value,
  onValueChange,
  filaments,
  placeholder = "Select filament",
  className,
  disabled,
  required,
  error
}: FilamentSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Find selected filament
  const selectedFilament = filaments.find(f => f.id.toString() === value?.toString())
  
  // Group filaments by brand
  const groupedFilaments = useMemo(() => {
    const groups = new Map<string, Filament[]>()
    
    filaments.forEach(filament => {
      const brand = filament.brand
      if (!groups.has(brand)) {
        groups.set(brand, [])
      }
      groups.get(brand)!.push(filament)
    })
    
    // Sort brands alphabetically and filaments within each brand
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, filaments]) => ({
        brand,
        filaments: filaments.sort((a, b) => 
          `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
        )
      }))
    
    return sortedGroups
  }, [filaments])
  
  // Filter filaments based on search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedFilaments
    
    const searchLower = search.toLowerCase()
    
    return groupedFilaments
      .map(group => ({
        ...group,
        filaments: group.filaments.filter(filament => 
          filament.color.toLowerCase().includes(searchLower) ||
          filament.material.toLowerCase().includes(searchLower)
        )
      }))
      .filter(group => group.filaments.length > 0)
  }, [groupedFilaments, search])
  
  const handleSelect = (filamentId: string) => {
    if (filamentId === "add-new") {
      setOpen(false)
      setIsModalOpen(true)
    } else {
      onValueChange(filamentId)
      setOpen(false)
    }
  }
  
  const handleFilamentCreated = (filament: Filament) => {
    onValueChange(filament.id.toString())
    setIsModalOpen(false)
  }
  
  const handleModalCancel = () => {
    setIsModalOpen(false)
  }
  
  // Format display text for selected filament
  const displayText = selectedFilament 
    ? `${selectedFilament.color} ${selectedFilament.material} - €${selectedFilament.price_per_kg.toFixed(2)}/kg`
    : placeholder
  
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select filament"
            className={cn(
              "w-full justify-between font-normal",
              !selectedFilament && "text-muted-foreground",
              error && "border-red-500",
              className
            )}
            disabled={disabled}
          >
            <span className="truncate flex items-center gap-2">
              {selectedFilament && (
                <>
                  <div
                    className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: getColorHex(selectedFilament.color) }}
                  />
                  {selectedFilament.total_qty_kg === 0 && (
                    <AlertTriangle className="h-3 w-3 text-orange-600 flex-shrink-0" />
                  )}
                </>
              )}
              {displayText}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search by color or material..." 
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <CommandList>
              {filteredGroups.length === 0 && search && (
                <CommandEmpty>
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <p>No filaments found matching "{search}"</p>
                    <Button
                      variant="ghost"
                      className="mt-2 text-primary"
                      onClick={() => handleSelect("add-new")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add New Filament
                    </Button>
                  </div>
                </CommandEmpty>
              )}
              
              {filteredGroups.map((group) => (
                <CommandGroup key={group.brand} heading={group.brand}>
                  {group.filaments.map((filament) => (
                    <CommandItem
                      key={filament.id}
                      value={filament.id.toString()}
                      onSelect={() => handleSelect(filament.id.toString())}
                      className="flex items-center gap-2 py-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: getColorHex(filament.color) }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {filament.color} {filament.material}
                          {filament.total_qty_kg === 0 && (
                            <AlertTriangle className="h-3 w-3 text-orange-600" title="No inventory" />
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          €{filament.price_per_kg.toFixed(2)}/kg
                        </span>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedFilament?.id === filament.id
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
                  Add New Filament...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleModalCancel()} modal={true}>
        <DialogContent 
          className="max-w-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add New Filament</DialogTitle>
            <DialogDescription>
              Create a new filament type for your product. You can optionally add it to inventory tracking.
            </DialogDescription>
          </DialogHeader>
          <QuickFilamentForm
            onSuccess={handleFilamentCreated}
            onCancel={handleModalCancel}
            isModal={true}
            autoSelectAfterCreate={true}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// getColorHex function imported from lib/constants/filaments.ts