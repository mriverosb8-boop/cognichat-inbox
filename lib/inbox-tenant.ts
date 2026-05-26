import type { SupabaseClient, User } from "@supabase/supabase-js";

const HOTEL_USERS_TABLE = "hotel_users";
const HOTELS_TABLE = "hotels";

export type AvailableHotel = {
  id: string;
  name: string;
};

export async function resolveAllowedHotelIds(
  supabase: SupabaseClient,
  user: User
): Promise<string[]> {
  const { data: membershipRows, error: membershipError } = await supabase
    .from(HOTEL_USERS_TABLE)
    .select("hotel_id, role")
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const rows = membershipRows ?? [];
  const isSuperAdmin = rows.some((row) => String(row.role ?? "").trim() === "super_admin");

  if (isSuperAdmin) {
    const { data: hotelRows, error: hotelsError } = await supabase.from(HOTELS_TABLE).select("id");
    if (hotelsError) {
      throw new Error(hotelsError.message);
    }
    return (hotelRows ?? []).map((row) => String(row.id)).filter(Boolean);
  }

  const allowedHotelIds = new Set<string>();
  for (const row of rows) {
    if (row.hotel_id != null) {
      allowedHotelIds.add(String(row.hotel_id));
    }
  }
  return [...allowedHotelIds];
}

export async function resolveAvailableHotels(
  supabase: SupabaseClient,
  allowedHotelIds: string[]
): Promise<AvailableHotel[]> {
  if (allowedHotelIds.length === 0) return [];

  const { data: hotelRows, error } = await supabase
    .from(HOTELS_TABLE)
    .select("id, name")
    .eq("is_active", true)
    .in("id", allowedHotelIds)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (hotelRows ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? row.id),
    }))
    .filter((row) => row.id);
}

export function resolveActiveHotelId(
  requestedHotelId: string,
  allowedHotelIds: string[],
  availableHotels: AvailableHotel[]
): { activeHotelId: string | null; forbidden: boolean } {
  if (requestedHotelId) {
    if (!allowedHotelIds.includes(requestedHotelId)) {
      return { activeHotelId: null, forbidden: true };
    }
    return { activeHotelId: requestedHotelId, forbidden: false };
  }

  if (availableHotels.length === 0) {
    return { activeHotelId: null, forbidden: false };
  }

  return { activeHotelId: availableHotels[0]!.id, forbidden: false };
}
