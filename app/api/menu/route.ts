import { menuItemToJson } from '@/lib/menu-item-json';
import {
  findMenuItemOwningScanCode,
  menuScanCodeSchema,
  planScanCodeAttach,
} from '@/lib/menu-scan-code';
import { prepareMenuListSearchQuery, rankMenuItemsBySearchQuery } from '@/lib/menu-search';
import { prisma } from '@/lib/prisma';
import { requireServiceAuth } from '@/lib/service-auth';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createMenuSchema = z.object({
  name: z.string().min(1).max(500),
  carbsPer100g: z.coerce.number().min(0),
  caloriesPer100g: z.coerce.number().min(0).optional(),
  proteinPer100g: z.coerce.number().min(0).optional(),
  fatPer100g: z.coerce.number().min(0).optional(),
  defaultPortionGrams: z.coerce.number().min(1).max(10000).optional(),
  recipeText: z.string().max(10000).optional(),
  barcode: menuScanCodeSchema.optional(),
  barcodeAliases: z.array(menuScanCodeSchema).max(20).optional(),
});

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_CANDIDATE_LIMIT = 400;

export async function GET(request: NextRequest) {
  const auth = requireServiceAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { email } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const search = (searchParams.get('search') ?? '').trim();
    const recipesOnly = searchParams.get('recipesOnly') === 'true';

    const baseWhere: Prisma.MenuItemWhereInput = {
      userEmail: email,
      ...(recipesOnly ? { recipeText: { not: null } } : {}),
    };

    if (search) {
      const preparedQuery = prepareMenuListSearchQuery(search, recipesOnly);
      const searchTerms = Array.from(new Set(preparedQuery.tokens)).slice(0, 5);

      const searchWhere: Prisma.MenuItemWhereInput =
        searchTerms.length > 0 ?
          {
            OR: searchTerms.flatMap((term) => [
              { name: { contains: term, mode: 'insensitive' as const } },
              ...(recipesOnly ?
                [{ recipeText: { contains: term, mode: 'insensitive' as const } }]
              : []),
            ]),
          }
        : {};

      const candidateItems = await prisma.menuItem.findMany({
        where: {
          ...baseWhere,
          ...searchWhere,
        },
        select: {
          id: true,
          name: true,
          recipeText: true,
        },
        take: SEARCH_CANDIDATE_LIMIT,
      });

      const ranked = rankMenuItemsBySearchQuery(candidateItems, preparedQuery, { recipesOnly });
      const total = ranked.length;
      const pagedIds = ranked.slice((page - 1) * limit, page * limit).map(({ item }) => item.id);
      const pagedItems =
        pagedIds.length > 0 ?
          await prisma.menuItem.findMany({
            where: { userEmail: email, id: { in: pagedIds } },
          })
        : [];
      const itemById = new Map(pagedItems.map((i) => [i.id, i]));
      const orderedItems = pagedIds.map((id) => itemById.get(id)).filter((i): i is typeof pagedItems[number] => Boolean(i));

      return NextResponse.json({
        items: orderedItems.map(menuItemToJson),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where: baseWhere,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.menuItem.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      items: items.map(menuItemToJson),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('GET /api/menu:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireServiceAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { email } = auth;

  try {
    const body = await request.json();
    const validated = createMenuSchema.parse(body);

    const trimmedName = validated.name.trim();

    const existing = await prisma.menuItem.findFirst({
      where: {
        userEmail: email,
        name: trimmedName,
      },
    });

    let nameToUse = trimmedName;
    if (!existing) {
      let n = 2;
      while (
        await prisma.menuItem.findFirst({
          where: { userEmail: email, name: nameToUse },
        })
      ) {
        nameToUse = `${trimmedName} (${n})`;
        n += 1;
      }
    }

    const scanFieldsTouched =
      validated.barcode !== undefined || validated.barcodeAliases !== undefined;

    const scanCodesOrdered = scanFieldsTouched
      ? Array.from(
          new Set([
            ...(validated.barcode !== undefined ? [validated.barcode] : []),
            ...(validated.barcodeAliases ?? []),
          ])
        )
      : [];

    for (const c of scanCodesOrdered) {
      const owner = await findMenuItemOwningScanCode(prisma, email, c, existing?.id);
      if (owner) {
        return NextResponse.json(
          { error: 'Этот код уже привязан к другому продукту в меню' },
          { status: 409 }
        );
      }
    }

    const primaryScan = scanCodesOrdered[0];
    const aliasScanRest = scanCodesOrdered.slice(1);

    const item = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: (() => {
            const data: Prisma.MenuItemUpdateInput = {
              carbsPer100g: validated.carbsPer100g,
              ...(validated.caloriesPer100g !== undefined && { caloriesPer100g: validated.caloriesPer100g }),
              ...(validated.defaultPortionGrams !== undefined && {
                defaultPortionGrams: validated.defaultPortionGrams,
              }),
              ...(validated.proteinPer100g !== undefined && { proteinPer100g: validated.proteinPer100g }),
              ...(validated.fatPer100g !== undefined && { fatPer100g: validated.fatPer100g }),
              ...(validated.recipeText !== undefined && { recipeText: validated.recipeText ?? null }),
            };
            if (scanCodesOrdered.length > 0) {
              let simBar = existing.barcode;
              let simAliases = [...(existing.barcodeAliases ?? [])];
              for (const code of scanCodesOrdered) {
                const attach = planScanCodeAttach(
                  { barcode: simBar, barcodeAliases: simAliases },
                  code
                );
                if (!attach) continue;
                if ('barcode' in attach) {
                  simBar = attach.barcode;
                } else {
                  simAliases = attach.barcodeAliases;
                }
              }
              data.barcode = simBar;
              data.barcodeAliases = simAliases;
            }
            return data;
          })(),
        })
      : await prisma.menuItem.create({
          data: {
            userEmail: email,
            name: nameToUse,
            carbsPer100g: validated.carbsPer100g,
            caloriesPer100g: validated.caloriesPer100g ?? null,
            defaultPortionGrams: validated.defaultPortionGrams ?? 100,
            proteinPer100g: validated.proteinPer100g ?? null,
            fatPer100g: validated.fatPer100g ?? null,
            recipeText: validated.recipeText ?? null,
            ...(primaryScan !== undefined ? { barcode: primaryScan } : {}),
            ...(aliasScanRest.length > 0 ? { barcodeAliases: aliasScanRest } : {}),
          },
        });

    return NextResponse.json({ item: menuItemToJson(item) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Этот штрихкод уже привязан к другому продукту в меню' },
        { status: 409 }
      );
    }
    console.error('POST /api/menu:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
