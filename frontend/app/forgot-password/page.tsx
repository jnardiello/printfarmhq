"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Mail, CheckCircle, Clock } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Failed to submit password reset request")
      }

      setSuccess(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to submit request")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-lg border-green-200">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-800">Request Submitted</CardTitle>
              <CardDescription className="text-green-700">
                Your password reset request has been submitted successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Manual Review Process:</strong> A system administrator will review your request and contact you via email with further instructions. This process may take 24-48 hours.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <span>Your request has been logged and will be processed in order</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <span>You will receive an email with your new password once approved</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <span>Check your spam folder if you don't see our email</span>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={() => router.push("/auth")} 
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-muted-foreground">
            Enter your email address and we'll help you reset your password
          </p>
        </div>

        {/* Reset Form */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Password Reset Request</CardTitle>
            <CardDescription>
              Submit a request to reset your password. An administrator will review it manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>Manual Process:</strong> Password resets are manually reviewed by administrators for security. You'll receive an email once your request is processed.
                </AlertDescription>
              </Alert>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the email address associated with your PrintFarm HQ account
                </p>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? "Submitting Request..." : "Submit Reset Request"}
              </Button>

              {/* Back Link */}
              <div className="pt-2">
                <Link 
                  href="/auth" 
                  className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}