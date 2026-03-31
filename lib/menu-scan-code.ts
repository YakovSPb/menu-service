import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/**
 * Код с упаковки: линейный штрихкод (8–32 цифры) или строка из QR (URL, КИ и т.д., без пробелов, до 512 символов).
 */
export const menuScanCodeSchema = z
  .string()
  .trim()
  .min(8)
  .max(512)
  .refine((s) => !/\s/.test(s), { message: 'Код не должен содержать пробелы' })
  .refine(
    (s) => {
      if (/^\d+$/.test(s)) return s.length >= 8 && s.length <= 32;
      return true;
    },
    { message: 'Цифровой код — от 8 до 32 цифр' }
  );

export function planScanCodeAttach(
  item: { barcode: string | null; barcodeAliases: string[] },
  code: string
): { barcode: string } | { barcodeAliases: string[] } | null {
  if (item.barcode === code) return null;
  if (item.barcodeAliases.includes(code)) return null;
  if (!item.barcode) return { barcode: code };
  return { barcodeAliases: [...item.barcodeAliases, code] };
}

export async function findMenuItemOwningScanCode(
  prisma: PrismaClient,
  userEmail: string,
  code: string,
  excludeItemId?: string
) {
  return prisma.menuItem.findFirst({
    where: {
      userEmail,
      ...(excludeItemId ? { NOT: { id: excludeItemId } } : {}),
      OR: [{ barcode: code }, { barcodeAliases: { has: code } }],
    },
  });
}
