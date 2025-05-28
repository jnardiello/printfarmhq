"use client"

// TODO: Implement proper error tracking service (e.g., Sentry) to replace console.error statements

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "@/components/ui/use-toast"
import type { Filament, FilamentPurchase, Product, Printer, Subscription, PrintJob, Plate } from "@/lib/types"
import { api, apiUpload, API_BASE_URL } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"

interface DataContextType {
  filaments: Filament[]
  purchases: FilamentPurchase[]
  products: Product[]
  printers: Printer[]
  subscriptions: Subscription[]
  printJobs: PrintJob[]
  loadingFilaments: boolean
  fetchFilaments: () => Promise<void>
  fetchPurchases: () => Promise<void>
  fetchProducts: () => Promise<void>
  fetchPrinters: () => Promise<void>
  fetchSubscriptions: () => Promise<void>
  fetchPrintJobs: () => Promise<void>
  addFilament: (filament: Partial<Filament>) => Promise<Filament | void>
  updateFilament: (id: number, data: Partial<Filament>) => Promise<void>
  deleteFilament: (id: number) => Promise<void>
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
  addPrinter: (printer: Partial<Printer>) => Promise<void>
  deletePrinter: (id: number) => Promise<void>
  addSubscription: (subscription: Partial<Subscription>) => Promise<void>
  addPrintJob: (printJob: Partial<PrintJob>) => Promise<void>
  deletePrintJob: (id: string) => Promise<void>
  exportPurchasesCSV: () => Promise<void>
  setCurrentTab: (tab: string) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [purchases, setPurchases] = useState<FilamentPurchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
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
      const data = await api<Printer[]>("/printer_profiles")
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
        method: "PATCH",
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
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error Deleting Product",
        description: (error as Error).message,
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
      await apiUpload<Plate>(`/products/${productId}/plates`, plateData)
      await fetchProducts() // Refresh products to get updated plates
      toast({
        title: "Success",
        description: "Plate added successfully",
      })
    } catch (error) {
      console.error("Error adding plate:", error)
      toast({
        title: "Error Adding Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const updatePlate = async (plateId: number, plateData: FormData) => {
    try {
      await apiUpload<Plate>(`/plates/${plateId}`, plateData, {
        method: "PATCH",
      })
      await fetchProducts() // Refresh products to get updated plates
      toast({
        title: "Success",
        description: "Plate updated successfully",
      })
    } catch (error) {
      console.error("Error updating plate:", error)
      toast({
        title: "Error Updating Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deletePlate = async (plateId: number) => {
    try {
      await api(`/plates/${plateId}`, {
        method: "DELETE",
      })
      await fetchProducts() // Refresh products to get updated plates
      toast({
        title: "Success",
        description: "Plate deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting plate:", error)
      toast({
        title: "Error Deleting Plate",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const addPrinter = async (printer: Partial<Printer>) => {
    try {
      await api("/printer_profiles", {
        method: "POST",
        body: JSON.stringify(printer),
      })
      await fetchPrinters()
      toast({
        title: "Success",
        description: "Printer profile added successfully",
      })
    } catch (error) {
      console.error("Error adding printer:", error)
      toast({
        title: "Error Adding Printer",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  const deletePrinter = async (id: number) => {
    try {
      await api(`/printer_profiles/${id}`, { method: "DELETE" })
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

  return (
    <DataContext.Provider
      value={{
        filaments,
        purchases,
        products,
        printers,
        subscriptions,
        printJobs,
        loadingFilaments,
        fetchFilaments,
        fetchPurchases,
        fetchProducts,
        fetchPrinters,
        fetchSubscriptions,
        fetchPrintJobs,
        addFilament,
        updateFilament,
        deleteFilament,
        addPurchase,
        deletePurchase,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchPlates,
        addPlate,
        updatePlate,
        deletePlate,
        addPrinter,
        deletePrinter,
        addSubscription,
        addPrintJob,
        deletePrintJob,
        exportPurchasesCSV,
        setCurrentTab,
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
