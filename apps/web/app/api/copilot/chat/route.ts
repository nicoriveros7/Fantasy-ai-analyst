import { NextRequest, NextResponse } from 'next/server';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export async function POST(request: NextRequest) {
  const payload = await request.json();

  const response = await fetch(`${apiBaseUrl}/copilot/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
