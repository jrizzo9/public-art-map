export async function GET() {
  return Response.json({
    ok: true,
    service: "public-art-map",
    timestamp: new Date().toISOString(),
  });
}

