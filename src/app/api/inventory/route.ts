import { NextResponse } from "next/server";
import { getState } from "@/infrastructure/persistence/in-memory-store";

export async function GET() {
  const state = getState();

  const items = Array.from(state.inventory.values()).map((record) => ({
    name: record.item.name,
    description: record.item.description,
    rarity: record.item.rarity,
    quantity: record.quantity,
    collectedAt: record.collectedAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
