import { menuItemToJson } from '@/lib/menu-item-json';
import {
  findMenuItemOwningScanCode,
  menuScanCodeSchema,
  planScanCodeAttach,
} from '@/lib/menu-scan-code';
import { prisma } from '@/lib/prisma';
import { requireServiceAuth } from '@/lib/service-auth';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateMenuSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  carbsPer100g: z.number().min(0).optional(),
  caloriesPer100g: z.number().min(0).optional(),
  proteinPer100g: z.number().min(0).optional(),
  fatPer100g: z.number().min(0).optional(),
  defaultPortionGrams: z.number().min(1).max(10000).optional(),
  barcode: menuScanCodeSchema.optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireServiceAuth(_request);
  if (auth instanceof NextResponse) return auth;
  const { email } = auth;

  try {
    const { id } = await params;

    const item = await prisma.menuItem.findFirst({
      where: { id, userEmail: email },
    });

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ item: menuItemToJson(item) });
  } catch (error) {
    console.error('GET /api/menu/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireServiceAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { email } = auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateMenuSchema.parse(body);

    const item = await prisma.menuItem.findFirst({
      where: { id, userEmail: email },
    });

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.MenuItemUpdateInput = {
      ...(validated.name !== undefined && { name: validated.name.trim() }),
      ...(validated.carbsPer100g !== undefined && { carbsPer100g: validated.carbsPer100g }),
      ...(validated.caloriesPer100g !== undefined && { caloriesPer100g: validated.caloriesPer100g }),
      ...(validated.proteinPer100g !== undefined && { proteinPer100g: validated.proteinPer100g }),
      ...(validated.fatPer100g !== undefined && { fatPer100g: validated.fatPer100g }),
      ...(validated.defaultPortionGrams !== undefined && {
        defaultPortionGrams: validated.defaultPortionGrams,
      }),
    };

    if (validated.barcode !== undefined) {
      const code = validated.barcode;
      const conflict = await findMenuItemOwningScanCode(prisma, email, code, id);
      if (conflict) {
        return NextResponse.json(
          { error: 'Этот код уже привязан к другому продукту в меню' },
          { status: 409 }
        );
      }
      const attach = planScanCodeAttach(
        { barcode: item.barcode, barcodeAliases: item.barcodeAliases ?? [] },
        code
      );
      if (attach) {
        Object.assign(data, attach);
      }
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ item: menuItemToJson(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Этот код уже привязан к другому продукту в меню' },
        { status: 409 }
      );
    }
    console.error('PATCH /api/menu/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireServiceAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { email } = auth;

  try {
    const { id } = await params;

    const existing = await prisma.menuItem.findFirst({
      where: { id, userEmail: email },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.menuItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/menu/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
