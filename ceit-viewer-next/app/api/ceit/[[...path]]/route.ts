import { NextRequest } from 'next/server';
import { proxyBackendRequest } from '@/lib/proxyBackendRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxyBackendRequest(req, path);
}
