# Whole Way Kits — Store Site v1 (static, not yet published)

Built 2026-11-03. Pure static HTML/CSS with a tiny inline script for the
footer year. No build tools, no frameworks, no external requests — fonts
and images are all local.

## Local preview

Double-click `index.html`, or serve the folder:

```
cd ~/workspace/virtual-products/store-site
python3 -m http.server 8000   # then open http://localhost:8000
```

To publish later: push the whole folder (including `assets/` and
`styles.css`) to the GitHub Pages repo as-is.

## Files

| File | Contents |
|---|---|
| `index.html` | Store home: hero, both product cards, "why buy from this shop", FAQ summary, footer with both disclaimers |
| `skillfire-kit.html` | Product 1 detail: pain points, what's inside, who for / not for, full FAQ, two buy boxes → real Creem payment link |
| `wedding-planner.html` | Product 2 detail: same structure using the real listing images; buy button links to the live Creem checkout |
| `styles.css` | All styling. Light, clean theme; sage green accent (wedding planner's colour), amber tint for the SkillFire card |
| `assets/wedding-main.png` | Copied from product-02 `listing-images/listing-01-main.png` |
| `assets/wedding-contents.png` | Copied from product-02 `listing-images/listing-02-contents.png` |

## ✅ Product 2 payment link — live (updated 2026-11-03)

The Whole Way Wedding Planner was created on Creem on 2026-11-03:
product `prod_4u5uNApBaZhALPSx7bqheB`, $9.90 one-time, status active.
Both former "Available soon" placeholders (the `wedding-planner.html`
buy box and the `index.html` wedding card) now link to the real
checkout: `https://www.creem.io/payment/prod_4u5uNApBaZhALPSx7bqheB`.
Note: checkout still shows "Account Verification Required" until the
Creem KYC review passes — that is an account-level gate, not a site
problem.

## Store name — working name "Whole Way Kits" (pending user's final call)

The name is a placeholder brand for the shop. Every occurrence is the
literal text `Whole Way Kits`, so renaming = find & replace that string
in these files:

- `index.html` — comment at top, `<title>`, header brand, hero paragraph,
  footer (2×)
- `skillfire-kit.html` — `<title>`, header brand, footer (2×)
- `wedding-planner.html` — `<title>`, header brand, footer (2×)
- `styles.css` — top comment only
- This README — headings/mentions

## Copy rules followed (from the two sales-page.md files)

- $9.90 one-time for both products; taxes handled by Creem at checkout.
- Refund policy wording copied: platform policy for delivered digital
  goods, no unconditional refunds promised; broken/incomplete files →
  fix or refund.
- AI-assistance disclosure present on home, both product pages, footers.
- SkillFire: "Not affiliated with or endorsed by Anthropic."
- Wedding: marriage license / name-change rules vary — confirm with
  local authorities; not affiliated with any venue/vendor/platform.
- Support email shown in nav, FAQ and footers: djh973832@gmail.com.
- No sales figures, reviews, testimonials, countdowns or guarantees
  anywhere on the site.

## Links verified 2026-11-03

- SkillFire payment: https://www.creem.io/payment/prod_7UKimu8ExN6i7ZNg9oyGiu
- SkillFire product page: https://www.creem.io/product/prod_7UKimu8ExN6i7ZNg9oyGiu
