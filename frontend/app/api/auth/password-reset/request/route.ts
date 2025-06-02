import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward the request to our backend
    // For server-side API routes in Docker, use internal container name
    const backendUrl = process.env.DOCKER_ENV 
      ? "http://backend:8000" 
      : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    const response = await fetch(`${backendUrl}/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Return the same status and data from backend
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Password reset request API error:", error)
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    )
  }
}