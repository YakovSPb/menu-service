import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { searchScore } from '@/lib/menu-search';
import { authenticateServiceRequest } from '@/lib/service-auth';

const createMenuSchema = z.object({
  name: z.string().min(1).max(500),
  carbsPer100g: z.coerce.number().min(0),
  caloriesPer100g: z.coerce.number().min(0),
  proteinPer100g: z.coerce.number().min(0).optional(),
  fatPer100g: z.coerce.number().min(0).optional(),
  defaultPortionGrams: z.coerce.number().min(1).max(10000).optional(),
  recipeText: z.string().max(10000).optional(),
  hasSugar: z.boolean().optional(),
});

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

async function resolveUserRefId(email: string): Promise<string> {
  const existing = await prisma.userRef.findUnique({ where: { email } });
  if (existing) return existing.id;

  const created = await prisma.userRef.create({
    data: { email },
  });
  return created.id;
}

export async function GET(request: NextRequest) {
  const authResult = authenticateServiceRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const userRefId = await resolveUserRefId(authResult.email);
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') ?? '').trim();
    const recipesOnly = searchParams.get('recipesOnly') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));

    const where = {
      userRefId,
      ...(recipesOnly ? { recipeText: { not: null as null } } : {}),
    };

    if (!search) {
      const [items, total] = await Promise.all([
        prisma.menuItem.findMany({
          where,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.menuItem.count({ where }),
      ]);

      return NextResponse.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    const allItems = await prisma.menuItem.findMany({ where });
    const ranked = allItems
      .map((item) => ({
        item,
        score: searchScore(search, item.name, item.recipeText),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

    const total = ranked.length;
    const items = ranked.slice((page - 1) * limit, page * limit).map((x) => x.item);

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('menu-service GET /menu error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = authenticateServiceRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const validated = createMenuSchema.parse(body);
    const userRefId = await resolveUserRefId(authResult.email);
    const trimmedName = validated.name.trim();

    const existing = await prisma.menuItem.findFirst({
      where: {
        userRefId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    const item = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            carbsPer100g: validated.carbsPer100g,
            caloriesPer100g: validated.caloriesPer100g,
            proteinPer100g: validated.proteinPer100g ?? 0,
            fatPer100g: validated.fatPer100g ?? 0,
            defaultPortionGrams: validated.defaultPortionGrams ?? existing.defaultPortionGrams,
            hasSugar: validated.hasSugar ?? existing.hasSugar,
            recipeText: validated.recipeText ?? existing.recipeText,
          },
        })
      : await prisma.menuItem.create({
          data: {
            userRefId,
            name: trimmedName,
            carbsPer100g: validated.carbsPer100g,
            caloriesPer100g: validated.caloriesPer100g,
            proteinPer100g: validated.proteinPer100g ?? 0,
            fatPer100g: validated.fatPer100g ?? 0,
            defaultPortionGrams: validated.defaultPortionGrams ?? 100,
            hasSugar: validated.hasSugar ?? false,
            recipeText: validated.recipeText ?? null,
          },
        });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('menu-service POST /menu error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
