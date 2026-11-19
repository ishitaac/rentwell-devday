import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Home } from "./App";

describe("Home", () => {
  it("presents two rental entrances and a three-stage decision journey", () => {
    const html = renderToStaticMarkup(
      <Home go={() => undefined} />,
    );

    expect(html).toMatch(/btn-primary[^>]*>Browse rentals/);
    expect(html).toContain("Check a rental you found");
    expect(html).toContain("Find or bring a rental");
    expect(html).toContain("Understand the real cost");
    expect(html).toContain("Decide solo or shared");
    expect(html).not.toContain('<button class="path-card"');
    expect(html).toContain("Fictional roommate preview");
  });

  it("uses a committed synthetic listing instead of the disconnected sample", () => {
    const html = renderToStaticMarkup(
      <Home go={() => undefined} />,
    );

    expect(html).toContain("Central City Corner One-Bedroom");
    expect(html).toContain("$1,418 / mo true cost");
    expect(html).not.toContain("$2,100 / mo");
    expect(html).not.toContain("Fair-ish");
  });
});
