"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Package2, 
  Calculator, 
  PrinterIcon, 
  Users, 
  BarChart3, 
  Shield,
  ArrowRight,
  CheckCircle,
  Star
} from "lucide-react"

export default function WelcomePage() {
  const features = [
    {
      icon: Package2,
      title: "Filament Inventory",
      description: "Track your filament stock levels, purchases, and usage across all projects",
      color: "text-blue-600"
    },
    {
      icon: Calculator,
      title: "Cost Calculation",
      description: "Automatic COGS calculation for accurate pricing and profitability analysis",
      color: "text-green-600"
    },
    {
      icon: PrinterIcon,
      title: "Print Job Management",
      description: "Organize and track all your print jobs with detailed time and material logging",
      color: "text-purple-600"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Multi-user support with role-based permissions for your team",
      color: "text-orange-600"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Detailed insights into your 3D printing operations and profitability",
      color: "text-indigo-600"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is isolated and secure with enterprise-grade protection",
      color: "text-red-600"
    }
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Product Designer",
      content: "PrintFarm HQ transformed how we manage our prototyping costs. Now I know exactly what each iteration costs us.",
      rating: 5
    },
    {
      name: "Mike Rodriguez",
      role: "Manufacturing Manager", 
      content: "The inventory tracking is a game-changer. No more running out of filament mid-print or ordering too much.",
      rating: 5
    },
    {
      name: "Alex Thompson",
      role: "Startup Founder",
      content: "Finally, accurate COGS for our 3D printed products. This helped us price our products correctly from day one.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Package2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">PrintFarm HQ</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <Badge variant="secondary" className="px-4 py-2">
            🚀 The Complete 3D Printing Management Solution
          </Badge>
          
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            Take Control of Your
            <span className="text-primary block">3D Printing Operations</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Track inventory, calculate costs, manage print jobs, and collaborate with your team. 
            Everything you need to run a profitable 3D printing operation.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-3">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-3">
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            ✓ Free to start ✓ No credit card required ✓ 2-minute setup
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed specifically for 3D printing professionals and enthusiasts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Trusted by Makers Worldwide</h2>
            <p className="text-xl text-muted-foreground">
              See what our users are saying about PrintFarm HQ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ready to Transform Your 3D Printing Workflow?
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Join thousands of makers who are already using PrintFarm HQ to optimize their operations and increase profitability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8 py-3">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm opacity-75">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Free to start
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              No contracts
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Package2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-white">PrintFarm HQ</span>
            </div>
            <div className="text-sm">
              © 2024 PrintFarm HQ. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}