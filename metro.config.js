const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports resolution — Metro would otherwise pick up zustand's
// ESM build (esm/middleware.mjs) which contains `import.meta.env`, causing
// "Cannot use 'import.meta' outside a module" on web.
// With this disabled, Metro falls back to the `main` field (CJS) for all packages.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
