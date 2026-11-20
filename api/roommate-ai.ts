import { createRoommateAiRoute } from "../server/roommateAI/route";

// Deny-by-default: returns 404 unless ROOMMATE_AI_ENABLED=1, and 401 for everyone until authentication exists.
const route = createRoommateAiRoute(process.env);

export const POST = route;
export const GET = route;
