import type { MetadataRoute } from "next";

const origin = "https://paradox-webmcp.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/docs`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/lab/expense-approval/ledger`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/lab/expense-approval`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
