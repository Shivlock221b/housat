import { NextResponse } from "next/server";
import { isNonRentalRequirementError, refineRentalRequirement } from "@/lib/agents/rentalRequirementAgent";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.current || typeof body.editPrompt !== "string" || !body.editPrompt.trim()) {
    return NextResponse.json({ error: "current and editPrompt are required" }, { status: 400 });
  }

  try {
    const result = await refineRentalRequirement({
      current: body.current,
      editPrompt: body.editPrompt
    });
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
        error: error instanceof Error ? error.message : "Requirement refinement failed.",
        details: "Requirement refinement requires Groq. Check GROQ_API_KEY and GROQ_MODEL in .env.local."
      },
      { status: 503 }
    );
  }
}
