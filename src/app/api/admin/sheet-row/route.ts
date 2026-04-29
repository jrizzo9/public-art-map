export const runtime = "nodejs";
export async function POST(request: Request) {
  void request;
  return Response.json(
    { ok: false as const, error: "Admin map writes are disabled." },
    { status: 410 },
  );
}
