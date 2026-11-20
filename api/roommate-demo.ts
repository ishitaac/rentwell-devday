import { createDemoRoute } from "../server/roommateAI/demo";

// Presenter-gated demo endpoint (synthetic persona only). 404 unless ROOMMATE_DEMO_ENABLED=1 and an access code is set.
const route = createDemoRoute(process.env);

export const POST = route;
export const GET = route;
