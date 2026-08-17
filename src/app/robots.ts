import type { MetadataRoute } from "next";

/** Generates `/robots.txt` disallowing everything — trips are link-shareable, not meant to be
 * publicly indexed/crawled (consistent with `layout.tsx`'s `metadata.robots`). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
