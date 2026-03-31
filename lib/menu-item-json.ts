import type { MenuItem } from '@prisma/client';

export function menuItemToJson(item: MenuItem) {
  return {
    id: item.id,
    name: item.name,
    carbsPer100g: item.carbsPer100g,
    caloriesPer100g: item.caloriesPer100g,
    defaultPortionGrams: item.defaultPortionGrams,
    proteinPer100g: item.proteinPer100g,
    fatPer100g: item.fatPer100g,
    recipeText: item.recipeText,
    barcode: item.barcode,
    barcodeAliases: item.barcodeAliases ?? [],
    createdAt: item.createdAt.toISOString(),
  };
}
