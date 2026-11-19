const optionalString = (value) => (typeof value === "string" ? value : null);
const optionalNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function requireRentCastApiKey(environment = process.env) {
  const apiKey = environment.RENTCAST_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RENTCAST_API_KEY is missing. Copy .env.example to .env.local and add your RentCast API key.",
    );
  }

  return apiKey;
}

export function createRentCastHttpError(status) {
  return new Error(
    `RentCast request failed (${status}). Check the API key, account access, and request limits.`,
  );
}

export function sanitizeRentCastListings(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("RentCast response must be an array of rental listings.");
  }

  return records
    .filter(
      (record) =>
        record !== null &&
        typeof record === "object" &&
        typeof record.price === "number" &&
        Number.isFinite(record.price) &&
        record.price > 0,
    )
    .map((record) => ({
      city: optionalString(record.city),
      state: optionalString(record.state),
      zipCode: optionalString(record.zipCode),
      propertyType: optionalString(record.propertyType),
      bedrooms: optionalNumber(record.bedrooms),
      bathrooms: optionalNumber(record.bathrooms),
      squareFootage: optionalNumber(record.squareFootage),
      price: record.price,
      listedDate: optionalString(record.listedDate),
      lastSeenDate: optionalString(record.lastSeenDate),
    }));
}
