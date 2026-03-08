# BONAE TECH Digital Services Website

This is the static website for BONAE TECH Digital Services, built with Astro and Tailwind CSS.

## Development Setup

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd noabem
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