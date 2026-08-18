import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://localhost";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/dashboard", "/explanation", "/work", "/profile", "/admin"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
