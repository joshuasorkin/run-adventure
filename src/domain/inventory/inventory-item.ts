/**
 * InventoryItem — an item that can be collected during a quest.
 * Pure domain entity. No framework imports.
 */

export type ItemId = string & { readonly __brand: unique symbol };

export type ItemRarity = "common" | "uncommon" | "rare" | "legendary";

export interface InventoryItem {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly rarity: ItemRarity;
  readonly iconKey: string;
}
