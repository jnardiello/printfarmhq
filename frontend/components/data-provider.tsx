"use client"

// TODO: Implement proper error tracking service (e.g., Sentry) to replace console.error statements

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "@/components/ui/use-toast"
import type { Filament, FilamentPurchase, Product, Printer, PrinterType, Subscription, PrintJob, Plate } from "@/lib/types"
import { api, apiUpload, API_BASE_URL } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"

interface FilamentFlexibleData {
  color: string
  brand: string
  material: string
  estimated_cost_per_kg: number
  create_purchase: boolean
  purchase_data?: {
    quantity_kg: number
    price_per_kg: number
    purchase_date?: string
    purchase_channel?: string
    notes?: string
  }
}

interface FilamentFlexibleResponse {
  filament: Filament
  purchase?: FilamentPurchase
  message: string
  warnings: string[]
}

interface DataContextType {
  filaments: Filament[]
  purchases: FilamentPurchase[]
  products: Product[]
  printers: Printer[]
  printerTypes: PrinterType[]
  subscriptions: Subscription[]
  printJobs: PrintJob[]
  loadingFilaments: boolean
  fetchFilaments: () => Promise<void>
  fetchPurchases: () => Promise<void>
  fetchProducts: () => Promise<void>
  fetchPrinters: () => Promise<void>
  fetchPrinterTypes: () => Promise<void>
  fetchSubscriptions: () => Promise<void>
  fetchPrintJobs: () => Promise<void>
  addFilament: (filament: Partial<Filament>) => Promise<Filament | void>
  updateFilament: (id: number, data: Partial<Filament>) => Promise<void>
  deleteFilament: (id: number) => Promise<void>
  clearFilamentInventory: (id: number) => Promise<void>
  addPurchase: (purchase: Partial<FilamentPurchase>) => Promise<void>
  deletePurchase: (id: number) => Promise<void>
  addProduct: (productData: FormData) => Promise<Product>
  updateProduct: (productId: number, productData: FormData) => Promise<Product | void>
  deleteProduct: (id: number) => Promise<void>
  // Plate management functions
  fetchPlates: (productId: number) => Promise<Plate[]>
  addPlate: (productId: number, plateData: FormData) => Promise<void>
  updatePlate: (plateId: number, plateData: FormData) => Promise<void>
  deletePlate: (plateId: number) => Promise<void>
  // Printer type management
  addPrinterType: (printerType: Partial<PrinterType>) => Promise<PrinterType | void>
  updatePrinterType: (id: number, data: Partial<PrinterType>) => Promise<void>
  deletePrinterType: (id: number) => Promise<void>
  // Printer instance management
  addPrinter: (printer: Partial<Printer>) => Promise<void>
  updatePrinter: (id: number, data: Partial<Printer>) => Promise<void>
  deletePrinter: (id: number) => Promise<void>
  addSubscription: (subscription: Partial<Subscription>) => Promise<void>
  updateSubscription: (id: number, data: Partial<Subscription>) => Promise<void>
  deleteSubscription: (id: number) => Promise<void>
  addPrintJob: (printJob: Partial<PrintJob>) => Promise<void>
  updatePrintJob: (id: string, data: Partial<PrintJob>) => Promise<void>
  deletePrintJob: (id: string) => Promise<void>
  exportPurchasesCSV: () => Promise<void>
  setCurrentTab: (tab: string) => void
  createFilamentFlexible: (data: FilamentFlexibleData) => Promise<FilamentFlexibleResponse>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [purchases, setPurchases] = useState<FilamentPurchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
  const [printerTypes, setPrinterTypes] = useState<PrinterType[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])
  const [loadingFilaments, setLoadingFilaments] = useState(true)
  const [currentTab, setCurrentTab] = useState<string>("")
  const [previousTab, setPreviousTab] = useState<string>("")

  useEffect(() => {
    // Only fetch data if user is authenticated and auth is not loading
    if (!isLoading && user) {
      const fetchAll = async () => {
        try {
          await Promise.all([
            fetchFilaments(), 
            fetchPurchases(), 
            fetchProducts(), 
            fetchPrinters(),
            fetchPrinterTypes(), 
            fetchSubscriptions(),
            fetchPrintJobs()
          ])
        } catch (error) {
          console.error("Error fetching data:", error)
          toast({
            title: "Error Loading Data",
            description: (error as Error).message || "Failed to load initial data. Please check connection.",
            variant: "destructive",
          })
        }
      }
      fetchAll()
    } else if (!isLoading && !user) {
      // Clear data when user is not authenticated
      setFilaments([])
      setPurchases([])
      setProducts([])
      setPrinters([])
      setSubscriptions([])
      setPrintJobs([])
      setLoadingFilaments(false)
    }
  }, [user, isLoading])

  // Track tab changes and refresh filaments data when user returns to the filaments tab
  useEffect(() => {
    if (user && currentTab && previousTab !== currentTab) {
      // Refresh filament data whenever we switch to the filaments tab, regardless of origin
      if (currentTab === "filaments") {
        fetchFilaments()
        fetchPurchases()
      }
      
      setPreviousTab(currentTab)
    }
  }, [currentTab, previousTab, user])

  // Refresh data when browser tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (user && document.visibilityState === 'visible' && currentTab === 'filaments') {
        fetchFilaments()
        fetchPurchases()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentTab, user])

  const fetchFilaments = async () => {
    setLoadingFilaments(true)
    try {
      const data = await api<Filament[]>("/filaments")
      setFilaments(data)
    } catch (error) {
      console.error("Error fetching filaments:", error)
      toast({
        title: "Error Fetching Filaments",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setLoadingFilaments(false)
    }
  }

  const fetchPurchases = async () => {
    try {
      const data = await api<FilamentPurchase[]>("/filament_purchases")
      const sortedData = data.sort((a: FilamentPurchase, b: FilamentPurchase) => {
        const da = a.purchase_date || ""
        const db = b.purchase_date || ""
        if (da === db) return b.id - a.id
        return db.localeCompare(da)
      })
      setPurchases(sortedData)
    } catch (error) {
      console.error("Error fetching purchases:", error)
      toast({
        title: "Error Fetching Purchases",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const fetchProducts = async () => {
    try {
      const data = await api<Product[]>("/products")
      setProducts(data)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        title: "Error Fetching Products",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const fetchPrinters = async () => {
    try {
      const data = await api<Printer[]>("/printers")
      setPrinters(data)
    } catch (error) {
      console.error("Error fetching printers:", error)
      toast({
        title: "Error Fetching Printers",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const fetchPrinterTypes = async () => {
    try {
      const data = await api<PrinterType[]>("/printer_types")
      setPrinterTypes(data)
    } catch (error) {
      console.error("Error fetching printer types:", error)
      toast({
        title: "Error Fetching Printer Types",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const data = await api<Subscription[]>("/subscriptions")
      setSubscriptions(data)
    } catch (error) {
      console.error("Error fetching subscriptions:", error)
      toast({
        title: "Error Fetching Subscriptions",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const fetchPrintJobs = async () => {
    try {
      const data = await api<PrintJob[]>("/print_jobs")
      setPrintJobs(data.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch (error) {
      console.error("Error fetching print jobs:", error)
      toast({
        title: "Error Fetching Print Jobs",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addFilament = async (filament: Partial<Filament>): Promise<Filament | void> => {
    try {
      const newFilament = await api<Filament>("/filaments", {
        method: "POST",
        body: JSON.stringify(filament),
      })
      await fetchFilaments()
      toast({
        title: "Success",
        description: "Filament added successfully",
      })
      return newFilament
    } catch (error) {
      console.error("Error adding filament:", error)
      toast({
        title: "Error Adding Filament",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const updateFilament = async (id: number, data: Partial<Filament>) => {
    try {
      await api(`/filaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
      await fetchFilaments()
      toast({
        title: "Success",
        description: "Filament updated successfully",
      })
    } catch (error) {
      console.error("Error updating filament:", error)
      toast({
        title: "Error Updating Filament",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deleteFilament = async (id: number) => {
    try {
      await api(`/filaments/${id}`, { method: "DELETE" })
      await fetchFilaments()
      toast({
        title: "Success",
        description: "Filament deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting filament:", error)
      toast({
        title: "Error Deleting Filament",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const clearFilamentInventory = async (id: number) => {
    try {
      // Get all purchases for this filament
      const filamentPurchases = purchases.filter(p => p.filament.id === id)
      
      // Delete all purchases for this filament
      for (const purchase of filamentPurchases) {
        await api(`/filament_purchases/${purchase.id}`, { method: "DELETE" })
      }
      
      // Refresh data
      await fetchFilaments()
      await fetchPurchases()
      
      toast({
        title: "Success",
        description: "Filament inventory cleared successfully",
      })
    } catch (error) {
      console.error("Error clearing filament inventory:", error)
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addPurchase = async (purchase: Partial<FilamentPurchase>) => {
    try {
      await api("/filament_purchases", {
        method: "POST",
        body: JSON.stringify(purchase),
      })
      await Promise.all([fetchFilaments(), fetchPurchases()])
      toast({
        title: "Success",
        description: "Purchase added successfully",
      })
    } catch (error) {
      console.error("Error adding purchase:", error)
      toast({
        title: "Error Adding Purchase",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deletePurchase = async (id: number) => {
    try {
      await api(`/filament_purchases/${id}`, { method: "DELETE" })
      await Promise.all([fetchFilaments(), fetchPurchases()])
      toast({
        title: "Success",
        description: "Purchase deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting purchase:", error)
      toast({
        title: "Error Deleting Purchase",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addProduct = async (productData: FormData): Promise<Product> => {
    try {
      const newProduct = await apiUpload<Product>("/products", productData)
      await fetchProducts()
      toast({
        title: "Success",
        description: "Product added successfully (including file if provided and backend supports it)",
      })
      return newProduct
    } catch (error) {
      console.error("Error adding product:", error)
      toast({
        title: "Error Adding Product",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error
    }
  }

  const updateProduct = async (productId: number, productData: FormData): Promise<Product | void> => {
    try {
      const updatedProduct = await apiUpload<Product>(`/products/${productId}`, productData, {
        method: "PUT",
      });
      
      if (updatedProduct) {
        setProducts((prevProducts: Product[]) =>
          prevProducts.map((p: Product) => (p.id === productId ? updatedProduct : p))
        );
        toast({
          title: "Success",
          description: `Product "${updatedProduct.name}" updated successfully.`,
        });
        return updatedProduct;
      } else {
        toast({
          title: "Product Updated",
          description: "Product data was sent, but no confirmation content was returned. Refreshing products.",
        });
        await fetchProducts();
      }
    } catch (error: any) {
      console.error("Error updating product:", error);
      toast({
        title: "Error Updating Product",
        description: error.response?.data?.detail || error.message || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      await api(`/products/${id}`, { method: "DELETE" })
      await fetchProducts()
      toast({
        title: "Success",
        description: "Product deleted successfully",
      })
    } catch (error: any) {
      console.error("Error deleting product:", error)
      
      let errorMessage = "Failed to delete product"
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Cannot Delete Product",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Plate management functions
  const fetchPlates = async (productId: number): Promise<Plate[]> => {
    try {
      const plates = await api<Plate[]>(`/products/${productId}/plates`)
      return plates
    } catch (error) {
      console.error("Error fetching plates:", error)
      toast({
        title: "Error Fetching Plates",
        description: (error as Error).message,
        variant: "destructive",
      })
      return []
    }
  }

  const addPlate = async (productId: number, plateData: FormData) => {
    try {
      const newPlate = await apiUpload<Plate>(`/products/${productId}/plates`, plateData)
      // Don't call fetchProducts here - let the caller decide what to do
      // Also don't show toast here - let the PlateManager handle it
      return newPlate
    } catch (error) {
      console.error("Error adding plate:", error)
      toast({
        title: "Error Adding Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error
    }
  }

  const updatePlate = async (plateId: number, plateData: FormData) => {
    try {
      const updatedPlate = await apiUpload<Plate>(`/plates/${plateId}`, plateData, {
        method: "PATCH",
      })
      // Don't call fetchProducts here - let the caller decide what to do
      // Also don't show toast here - let the PlateManager handle it
      return updatedPlate
    } catch (error) {
      console.error("Error updating plate:", error)
      toast({
        title: "Error Updating Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error
    }
  }

  const deletePlate = async (plateId: number) => {
    try {
      await api(`/plates/${plateId}`, {
        method: "DELETE",
      })
      // Don't call fetchProducts here - let the caller decide what to do
      // Also don't show toast here - let the PlateManager handle it
    } catch (error) {
      console.error("Error deleting plate:", error)
      toast({
        title: "Error Deleting Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error
    }
  }

  // Printer Type Management
  const addPrinterType = async (printerType: Partial<PrinterType>): Promise<PrinterType | void> => {
    try {
      const newPrinterType = await api<PrinterType>("/printer_types", {
        method: "POST",
        body: JSON.stringify(printerType),
      })
      await fetchPrinterTypes()
      toast({
        title: "Success",
        description: "Printer type added successfully",
      })
      return newPrinterType
    } catch (error) {
      console.error("Error adding printer type:", error)
      toast({
        title: "Error Adding Printer Type",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error
    }
  }

  const updatePrinterType = async (id: number, data: Partial<PrinterType>) => {
    try {
      await api(`/printer_types/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      await fetchPrinterTypes()
      toast({
        title: "Success",
        description: "Printer type updated successfully",
      })
    } catch (error) {
      console.error("Error updating printer type:", error)
      toast({
        title: "Error Updating Printer Type",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deletePrinterType = async (id: number) => {
    try {
      await api(`/printer_types/${id}`, {
        method: "DELETE",
      })
      await fetchPrinterTypes()
      toast({
        title: "Success",
        description: "Printer type deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting printer type:", error)
      toast({
        title: "Error Deleting Printer Type",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  // Printer Instance Management
  const addPrinter = async (printer: Partial<Printer>) => {
    try {
      await api("/printers", {
        method: "POST",
        body: JSON.stringify(printer),
      })
      await fetchPrinters()
      toast({
        title: "Success",
        description: "Printer added successfully",
      })
    } catch (error) {
      console.error("Error adding printer:", error)
      toast({
        title: "Error Adding Printer",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error  // Re-throw to let calling code handle it
    }
  }

  const updatePrinter = async (id: number, data: Partial<Printer>) => {
    try {
      await api(`/printers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      await fetchPrinters()
      toast({
        title: "Success",
        description: "Printer updated successfully",
      })
    } catch (error) {
      console.error("Error updating printer:", error)
      toast({
        title: "Error Updating Printer",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error  // Re-throw to let calling code handle it
    }
  }

  const deletePrinter = async (id: number) => {
    try {
      await api(`/printers/${id}`, { method: "DELETE" })
      await fetchPrinters()
      toast({
        title: "Success",
        description: "Printer profile deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting printer:", error)
      toast({
        title: "Error Deleting Printer",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addSubscription = async (subscription: Partial<Subscription>) => {
    try {
      await api("/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription),
      })
      await fetchSubscriptions()
      toast({
        title: "Success",
        description: "Subscription added successfully",
      })
    } catch (error) {
      console.error("Error adding subscription:", error)
      toast({
        title: "Error Adding Subscription",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const updateSubscription = async (id: number, data: Partial<Subscription>) => {
    try {
      await api(`/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
      await fetchSubscriptions()
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      })
    } catch (error) {
      console.error("Error updating subscription:", error)
      toast({
        title: "Error Updating Subscription",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deleteSubscription = async (id: number) => {
    try {
      await api(`/subscriptions/${id}`, { method: "DELETE" })
      await fetchSubscriptions()
      toast({
        title: "Success",
        description: "Subscription deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting subscription:", error)
      toast({
        title: "Error Deleting Subscription",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addPrintJob = async (printJob: Partial<PrintJob>) => {
    try {
      await api("/print_jobs", {
        method: "POST",
        body: JSON.stringify(printJob),
      })
      await fetchPrintJobs()
      toast({
        title: "Success",
        description: "Print job added successfully",
      })
    } catch (error) {
      console.error("Error adding print job:", error)
      toast({
        title: "Error Adding Print Job",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deletePrintJob = async (id: string) => {
    try {
      await api(`/print_jobs/${id}`, { method: "DELETE" })
      await fetchPrintJobs()
      toast({
        title: "Success",
        description: "Print job deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting print job:", error)
      toast({
        title: "Error Deleting Print Job",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const updatePrintJob = async (id: string, data: Partial<PrintJob>) => {
    try {
      console.log("updatePrintJob called with:");
      console.log("ID:", id);
      console.log("Data:", data);
      console.log("API URL:", `${API_BASE_URL}/print_jobs/${id}`);
      
      // First, let's test if we can GET the specific job (to test CORS in general)
      try {
        console.log("Testing GET request first...");
        const testGet = await api(`/print_jobs/${id}`, {
          method: "GET",
        });
        console.log("GET request succeeded:", testGet);
      } catch (getError) {
        console.error("Even GET request failed:", getError);
      }
      
      // Now try the PATCH
      const response = await api(`/print_jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })
      console.log("Update response:", response);
      
      await fetchPrintJobs()
      toast({
        title: "Success",
        description: "Print job updated successfully",
      })
    } catch (error) {
      console.error("Error updating print job:", error)
      console.error("Full error object:", error);
      
      // If PUT fails, let's try a workaround: delete and recreate
      // This is not ideal but might work if PATCH/PUT are blocked
      /*
      try {
        console.log("PATCH/PUT failed, trying delete and recreate workaround...");
        const jobToUpdate = printJobs.find(j => j.id === id);
        if (jobToUpdate) {
          await deletePrintJob(id);
          await addPrintJob({...jobToUpdate, ...data});
          return;
        }
      } catch (workaroundError) {
        console.error("Workaround also failed:", workaroundError);
      }
      */
      
      toast({
        title: "Error Updating Print Job",
        description: (error as Error).message,
        variant: "destructive",
      })
      throw error; // Re-throw to allow component to handle it
    }
  }

  const exportPurchasesCSV = async () => {
    try {
      // Get authentication token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      const res = await fetch(`${API_BASE_URL}/filament_purchases/export`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || "Export failed")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "filament_purchases.csv"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "CSV exported successfully",
      })
    } catch (error) {
      console.error("Error exporting CSV:", error)
      toast({
        title: "Error Exporting CSV",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const createFilamentFlexible = async (data: FilamentFlexibleData): Promise<FilamentFlexibleResponse> => {
    try {
      const response = await api<FilamentFlexibleResponse>("/filaments/create-flexible", {
        method: "POST",
        body: JSON.stringify(data),
      })
      
      // Update local state
      setFilaments(prev => [...prev, response.filament])
      
      // Only add purchase if one was created
      if (response.purchase) {
        setPurchases(prev => [...prev, response.purchase!])
      }
      
      // Sort filaments alphabetically
      setFilaments(prev => 
        [...prev].sort((a, b) => 
          `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
        )
      )
      
      return response
    } catch (error: any) {
      // Handle duplicate filament error specially
      if (error.response?.status === 409) {
        // Re-throw with the proper structure
        throw error
      }
      
      console.error("Error creating filament:", error)
      toast({
        title: "Error Creating Filament",
        description: error.message || "Failed to create filament",
        variant: "destructive",
      })
      throw error
    }
  }

  return (
    <DataContext.Provider
      value={{
        filaments,
        purchases,
        products,
        printers,
        printerTypes,
        subscriptions,
        printJobs,
        loadingFilaments,
        fetchFilaments,
        fetchPurchases,
        fetchProducts,
        fetchPrinters,
        fetchPrinterTypes,
        fetchSubscriptions,
        fetchPrintJobs,
        addFilament,
        updateFilament,
        deleteFilament,
        clearFilamentInventory,
        addPurchase,
        deletePurchase,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchPlates,
        addPlate,
        updatePlate,
        deletePlate,
        addPrinterType,
        updatePrinterType,
        deletePrinterType,
        addPrinter,
        updatePrinter,
        deletePrinter,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        addPrintJob,
        updatePrintJob,
        deletePrintJob,
        exportPurchasesCSV,
        setCurrentTab,
        createFilamentFlexible,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
