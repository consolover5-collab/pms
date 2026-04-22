import { t, type Dictionary } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/locales/en";

const HK_STATUS_KEYS: Record<string, DictionaryKey> = {
  clean: "rooms.hk.clean",
  dirty: "rooms.hk.dirty",
  pickup: "rooms.hk.pickup",
  inspected: "rooms.hk.inspected",
  out_of_order: "rooms.hk.outOfOrder",
  out_of_service: "rooms.hk.outOfService",
};

export function getHkStatusLabel(dict: Dictionary, status: string): string {
  const key = HK_STATUS_KEYS[status];
  return key ? t(dict, key) : status;
}

const OCCUPANCY_KEYS: Record<string, DictionaryKey> = {
  occupied: "rooms.occupancy.occupied",
  vacant: "rooms.occupancy.vacant",
};

export function getOccupancyLabel(dict: Dictionary, status: string): string {
  const key = OCCUPANCY_KEYS[status];
  return key ? t(dict, key) : status;
}
