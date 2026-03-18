import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticateServiceRequest } from '@/lib/service-auth';

const updateMenuSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  carbsPer100g: z.coerce.number().min(0).optional(),
  caloriesPer100g: z.coerce.number().min(0).optional(),
  proteinPer100g: z.coerce.number().min(0).optional(),
  fatPer100g: z.coerce.number().min(0).optional(),
  defaultPortionGrams: z.coerce.number().min(1).max(10000).optional(),
  recipeText: z.string().max(10000).optional(),
  hasSugar: z.boolean().optional(),
});

async function getUserRefIdByEmail(email: string): Promise<string | null> {
  const userRef = await prisma.userRef.findUnique({ where: { email } });
  return userRef?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = authenticateServiceRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const userRefId = await getUserRefIdByEmail(authResult.email);
    if (!userRefId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const item = await prisma.menuItem.findFirst({
      where: { id, userRefId },
    });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('menu-service GET /menu/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = authenticateServiceRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const userRefId = await getUserRefIdByEmail(authResult.email);
    if (!userRefId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.menuItem.findFirst({
      where: { id, userRefId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateMenuSchema.parse(body);

    const updated = await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        ...(validated.name !== undefined && { name: validated.name.trim() }),
        ...(validated.carbsPer100g !== undefined && { carbsPer100g: validated.carbsPer100g }),
        ...(validated.caloriesPer100g !== undefined && { caloriesPer100g: validated.caloriesPer100g }),
        ...(validated.proteinPer100g !== undefined && { proteinPer100g: validated.proteinPer100g }),
        ...(validated.fatPer100g !== undefined && { fatPer100g: validated.fatPer100g }),
        ...(validated.defaultPortionGrams !== undefined && {
          defaultPortionGrams: validated.defaultPortionGrams,
        }),
        ...(validated.recipeText !== undefined && { recipeText: validated.recipeText ?? null }),
        ...(validated.hasSugar !== undefined && { hasSugar: validated.hasSugar }),
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('menu-service PATCH /menu/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = authenticateServiceRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { id } = await params;
    const userRefId = await getUserRefIdByEmail(authResult.email);
    if (!userRefId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.menuItem.findFirst({
      where: { id, userRefId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('menu-service DELETE /menu/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
