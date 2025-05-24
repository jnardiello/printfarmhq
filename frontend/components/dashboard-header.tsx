"use client"

import { motion } from "framer-motion"
import { UserMenu } from "@/components/auth/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"

export function DashboardHeader() {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-violet-600/20 to-blue-500/20 z-0"></div>

      {/* 3D Printing-inspired background pattern */}
      <div className="absolute inset-0 opacity-10 z-0">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Top navigation */}
        <div className="flex justify-end items-center mb-8 gap-4">
          <ThemeToggle />
          <UserMenu />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M18 3v14l-6-2-6 2V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1Z"></path>
                <path d="M9 7h6"></path>
                <path d="M9 11h6"></path>
                <path d="M19 21h-9a2 2 0 0 1-2-2v-2l-2 1v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3l-6-2-6 2v2a1 1 0 0 0 1 1h10Z"></path>
              </svg>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full animate-pulse"></div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold gradient-heading mb-2">HQ Inventory Dashboard</h1>

          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Manage your 3D printing inventory, track filaments, products, and more
          </p>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-r from-purple-600/10 via-violet-600/10 to-blue-500/10"></div>
    </header>
  )
}
