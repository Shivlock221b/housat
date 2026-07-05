import { NextResponse } from "next/server";
import { isNonRentalRequirementError, parseRentalRequirement } from "@/lib/agents/rentalRequirementAgent";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  try {
    const result = await parseRentalRequirement(body.prompt);
    return NextResponse.json(result);
  } catch (error) {
    if (isNonRentalRequirementError(error)) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "I can only help with rental home search requirements."
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Requirement agent failed.",
        details: "Requirement parsing now requires Groq. Check GROQ_API_KEY and GROQ_MODEL in .env.local."
      },
      { status: 503 }
    );
  }
}
