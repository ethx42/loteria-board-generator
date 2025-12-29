import { NextRequest, NextResponse } from "next/server";
import type { GeneratorConfig } from "@/lib/types";
import { generateBoardsWithHiGHS } from "@/lib/solver/highs-solver";
import { createDevLogger } from "@/lib/utils/dev-logger";

// Scoped logger for API (only outputs in development)
const log = createDevLogger("API:Generate");

// Force Node.js runtime for HiGHS WASM
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const config: GeneratorConfig = await request.json();

    log.info(
      `Generating ${config.numBoards} boards with ${config.items.length} items`
    );

    const result = await generateBoardsWithHiGHS(config);

    log.info(
      `Generation complete - success: ${result.success}, solver: ${result.stats?.solverUsed}`
    );

    return NextResponse.json(result);
  } catch (error) {
    log.error("Generation failed", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
