import { NextRequest, NextResponse } from "next/server";
import type { GeneratorConfig } from "@/lib/types";
import { generateBoardsWithHiGHS } from "@/lib/solver/highs-solver";

// Force Node.js runtime for HiGHS WASM
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const config: GeneratorConfig = await request.json();

    console.log(
      `[API] Generating ${config.numBoards} boards with ${config.items.length} items`
    );

    const result = await generateBoardsWithHiGHS(config);

    console.log(
      `[API] Generation complete - success: ${result.success}, solver: ${result.stats?.solverUsed}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
