import { parsePeriodRequest } from "@/modules/report/periods/lib/options";
import { generatePeriodReport, PeriodGenerationBusy, PeriodGenerationInvalid } from "@/modules/report/periods/pipeline/generate-period-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let input;
  try { input = parsePeriodRequest(await req.json()); }
  catch (error) { return Response.json({ error: (error as Error).message || "Choose a valid report period." }, { status: 400 }); }
  try {
    const result = await generatePeriodReport(input.number, input.options);
    return Response.json(result, { status: result.run.status === "success" ? 200 : 500 });
  } catch (error) {
    const status = error instanceof PeriodGenerationBusy ? 409 : error instanceof PeriodGenerationInvalid ? 400 : 500;
    return Response.json({ error: (error as Error).message || "The report could not be generated." }, { status });
  }
}
