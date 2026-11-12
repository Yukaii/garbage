// Vercel function entry. The handler is bundled by `npm run build` (esbuild → dist/handler.js)
// because ../src uses extensionless TypeScript imports that plain Node ESM can't resolve.
// This file must be committed: Vercel validates `functions` in vercel.json against the
// checked-out source before the build runs, so a build-generated entry isn't found.
export { GET, POST, OPTIONS } from '../dist/handler.js';
