# BONAE TECH Digital Services Website

This is the static website for BONAE TECH Digital Services, built with Astro and Tailwind CSS. Deployed on Cloudflare Pages.

## Design Principles

- **Mobile-first**: The majority of Latin American traffic is mobile. Layouts and components are designed for small screens first, then enhanced for desktop.
- **Low-bandwidth friendly**: Optimized for 3G/4G connections. Minimal external assets, inline critical styles, and PWA support for offline use.
- **Accessibility (WCAG 2.1 AA)**: Semantic HTML, ARIA labels, focus states, and sufficient color contrast. Forms and interactive elements are keyboard-navigable.
- **Bilingual by default**: Spanish (primary) and English with clear language switching and proper `hreflang` for SEO.
- **Cercano y profesional**: Tone is approachable and empowering—digitalization is within reach. Avoid unnecessary jargon; explain technical terms when used.
- **Trust signals**: Clear value propositions, founder profiles, contact options, and visible CTAs (WhatsApp, contact form) to reduce friction.

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Static generator | Astro 4.x |
| Styling | Tailwind CSS |
| Hosting | Cloudflare Pages |
| Output | Static HTML (no client-side routing) |

### Page Structure

- **Spanish**: `/` (index)
- **English**: `/en/`
- Single-page layout per language: all sections (Hero, Value Prop, Services, About, Portfolio, Plans, Contact) are rendered on the homepage with anchor navigation.

### i18n

- Translation files: `src/i18n/es.ts` (source) and `src/i18n/en.ts`
- Shared `Translations` type ensures both languages stay in sync
- Each page imports the relevant translation object and passes it as `t` to Layout and components
- No runtime i18n library; content is compiled at build time

### Component Hierarchy

```
Layout.astro (HTML shell, meta, PWA, WhatsApp float, Cookie banner)
├── Header.astro (nav, language switch, CTA)
├── <main>
│   ├── Hero.astro
│   ├── ValueProp.astro
│   ├── ServicesSummary.astro
│   ├── KeyFigures.astro
│   ├── About.astro
│   ├── Services.astro
│   ├── Portfolio.astro
│   ├── Testimonials.astro
│   ├── Plans.astro
│   ├── BlogPreview.astro
│   └── Contact.astro
└── Footer.astro (4-column: brand, nav, services, contact)
```

### Data Flow

- No CMS or backend; all content lives in `src/i18n/*.ts`
- Components receive `t: Translations` as a prop and render text from `t.*`
- Placeholder values (phone, email, social links) can be updated in i18n or environment variables

### PWA & Performance

- `manifest.webmanifest` and `sw.js` for installability and offline support
- `compressHTML: true` and `inlineStylesheets: 'auto'` in Astro config
- Target: Lighthouse performance > 90, load time < 3s on 3G

---

## Development Setup

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bonae
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server:

```bash
npm run dev
```

This will start the Astro development server, typically available at `http://localhost:4321`.

### Building for Production

To build the website for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

This serves the built website from the `dist/` directory.

## Project Structure

- `src/pages/` - Astro pages
- `src/components/` - Reusable Astro components
- `src/layouts/` - Page layouts
- `src/styles/` - Global styles
- `public/` - Static assets
- `src/i18n/` - Internationalization files

## Technologies Used

- [Astro](https://astro.build/) - Static site generator
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- TypeScript - Type-safe JavaScript

## License

Apache-2.0

# Hosting Recommendations

## Best Hosting for Venezuela + International Availability

### 1 Cloudflare Pages (strongly recommended)

Cloudflare is the best choice specifically for Venezuela because their Anycast CDN has 300+ global Points of Presence, and Venezuelan users get routed through nearby nodes in Colombia, Brazil, and the Caribbean. No other free platform matches this Latin American coverage.

Free tier includes: unlimited bandwidth, unlimited sites, 500 builds/month, SSL, DDoS protection.

#### Ranked alternatives

| Service	| LatAm CDN Coverage	| Free Tier |
|-----------|-----------------------|-----------|
| Cloudflare Pages ⭐	| Best (Anycast, 300+ PoP)	| Unlimited BW |
| Vercel	| Good (São Paulo region)	| 100GB BW/mo |
| Netlify	| Good	| 100GB BW/mo |
| AWS S3 + CloudFront	| Good (São Paulo, Buenos Aires)	| 12mo free trial |


### Deploying to Cloudflare Pages (3 steps)

Your Astro site builds to dist/ and requires zero config changes:

1. Push to GitHub (if not already there)

2. Connect at cloudflare.com → Workers & Pages → Create → Pages → Connect to Git

3. Build settings:
- Build command: npm run build
- Output directory: dist
- Node version env var: NODE_VERSION=18

Every push to main auto-deploys. You get a free *.pages.dev URL immediately, and can add a custom domain later.

## Styles

### Fonts

```
# one
font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
# two
font-family: 'Poppins', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Pallete 

* terracota: #FF6B35
* brown: #9C8172
* mid-blue: #3996AE
* light-blue: #48A8C1
* dar-blue: #44808F
* gray: #40575D
* cream: #F4F4ED

🧩 Recommended Pairings
To keep things simple and modern:

**Option A** — Clean & Friendly
Headlines: Poppins SemiBold
Body: Inter Regular
UI Labels: Inter Medium

**Option B** — Sleek & Professional
- Headlines: Montserrat SemiBold
- Body: Inter Regular
- Buttons: Inter Medium

**Option C** — Ultra‑Lightweight (Lowest Bandwidth)
- Headlines: Segoe UI Bold
- Body: Segoe UI Regular
- No external font downloads needed