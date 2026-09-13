# Search discoverability

The homepage is the working Saves selector. Introductory copy and planned downloads sit below the collections. About PKSX starts expanded for an empty collection and collapses when imported saves or stored Pokémon exist. Users can expand it again. The content is prerendered, including when JavaScript is unavailable.

`/boxes` owns the box workspace. Default web, PWA and native launches use `/`. Existing `/saves` links redirect to `/`, with both a SvelteKit redirect and a Cloudflare HTTP redirect. Existing `/?source=pokemon-storage` bookmarks open `/boxes?source=pokemon-storage`. The existing `/save-file` alias still opens Trainer.

## Indexing

- `Seo.svelte` owns titles, descriptions, production canonical URLs and social cards. The card uses the existing app icon.
- The homepage is the public search entry. Local workspace screens and prototypes carry `noindex, follow`; they do not contain public save data for search engines to index.
- `static/sitemap.xml` lists the homepage. Add genuinely useful public pages here if the site expands.
- `static/robots.txt` allows crawling so crawlers can read indexing instructions.
- `static/_headers` excludes staging and Workers preview hosts through `X-Robots-Tag: noindex`, independently of the shared build. It also excludes prototype assets.
- Download labels remain “Planned” until a public release URL exists. Replace a platform's label with its real download link when that release ships. Do not link internal testing tracks as public downloads.

## Search Console and Bing setup after deployment

No visitor analytics are installed. Search reporting requires ownership verification in the webmaster accounts; adding metadata alone does not create or verify those properties.

1. In [Google Search Console](https://search.google.com/search-console), add the `pksx.app` domain property and verify the DNS TXT record Google supplies. Keep the verification record in DNS.
2. Submit `https://pksx.app/sitemap.xml`. Inspect `https://pksx.app/`, run the live test, confirm the rendered text and canonical, then request indexing.
3. In [Bing Webmaster Tools](https://www.bing.com/webmasters/), import the verified Search Console property or complete Bing's ownership verification. Submit the same sitemap.
4. Check the deployed staging and preview responses for `X-Robots-Tag: noindex`, and confirm production `/` has no indexing exclusion. Confirm `/saves` redirects and an unknown path returns 404.
5. Track homepage indexing, impressions, clicks and search queries. Compare equivalent periods after Google has recrawled the release. Ranking or indexing is not guaranteed by submission.

See [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) and [Cloudflare's static header rules](https://developers.cloudflare.com/workers/static-assets/headers/).
