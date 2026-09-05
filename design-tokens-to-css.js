/**
 * ============================================================================
 * Provly Design Tokens → CSS Custom Properties Converter
 * ============================================================================
 *
 * PURPOSE:
 *   Reads the Figma-exported design tokens JSON file
 *   (provly-design-tokens.tokens.json) and produces well-structured CSS files
 *   containing CSS custom properties (variables) that can be consumed
 *   directly by the Provly AI front-end.
 *
 * DESIGN SYSTEM COLOR ARCHITECTURE:
 *   The Provly design system follows a two-tier color model inspired by
 *   Material Design 3:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  TIER 1 — PRIMITIVE COLORS (Foundation Layer)                       │
 *   │  These are the raw color palettes generated from key colors.        │
 *   │  Each palette contains tonal steps (0, 10, 20 … 95, 98, 99, 100).  │
 *   │                                                                      │
 *   │  ⚠️  PRIMITIVES SHOULD NEVER BE USED DIRECTLY IN UI CODE.           │
 *   │  They exist solely as building blocks for the role layer below.     │
 *   │                                                                      │
 *   │  Examples:                                                           │
 *   │    --provly-primitive-primary-40: #3c9081;                           │
 *   │    --provly-primitive-neutral-90: #e6e6e6;                           │
 *   └──────────────────────────────────────────────────────────────────────┘
 *                              │  referenced by
 *                              ▼
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  TIER 2 — COLOR ROLES (Semantic / Application Layer)                │
 *   │  These assign *meaning* to colors: "primary", "on-primary",        │
 *   │  "surface", "error", etc. They reference primitive tokens via       │
 *   │  alias syntax: {provly - primitives.…palette.…token}                │
 *   │                                                                      │
 *   │  ✅  COLOR ROLES ARE THE ONLY COLORS THAT SHOULD APPEAR IN UI CSS.  │
 *   │                                                                      │
 *   │  Examples:                                                           │
 *   │    --provly-role-primary: #1f4b43;                                   │
 *   │    --provly-role-on-primary: #ffffff;                                │
 *   │    --provly-role-error-container: #fbd0d0;                           │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * OTHER TOKEN CATEGORIES:
 *   - Effects    → CSS box-shadow values
 *   - Spacing    → rem-based spacing scale
 *   - Border     → rem-based border-radius scale
 *   - Typography → CSS font shorthand utilities and individual properties
 *
 * OUTPUTS:
 *   1. provly-primitives.css   — Primitive color variables (reference only)
 *   2. provly-color-roles.css  — Semantic color role variables (use in UI)
 *   3. provly-effects.css      — Shadow effect variables
 *   4. provly-spacing.css      — Spacing scale variables
 *   5. provly-border-radius.css— Border radius variables
 *   6. provly-typography.css   — Typography system variables
 *   7. provly-design-system.css— Combined import file (imports all above)
 *
 * USAGE:
 *   node design-tokens-to-css.js
 *
 * REQUIREMENTS:
 *   - Node.js 14+ (uses fs/path, no external dependencies)
 *   - provly-design-tokens.tokens.json must be in the same directory
 *
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

/** @type {string} Path to the input design tokens JSON file */
const INPUT_FILE = path.join(__dirname, 'provly-design-tokens.tokens.json');

/** @type {string} Directory to output generated CSS files */
const OUTPUT_DIR = path.join(__dirname, 'css');

/**
 * Maps token category keys (from the JSON) to their output configuration.
 * This controls file naming, CSS selector scope, and banner documentation.
 */
const OUTPUT_FILES = {
  primitives: 'provly-primitives.css',
  colorRoles: 'provly-color-roles.css',
  effects: 'provly-effects.css',
  spacing: 'provly-spacing.css',
  borderRadius: 'provly-border-radius.css',
  typography: 'provly-typography.css',
  combined: 'provly-design-system.css',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts a human-readable token name into a valid CSS custom property name.
 *
 * Transformation rules:
 *   1. Convert to lowercase
 *   2. Replace spaces, underscores, and consecutive hyphens with single hyphens
 *   3. Remove parentheses and other special characters
 *   4. Trim leading/trailing hyphens
 *
 * @param {string} name — The raw token name from Figma (e.g. "provly primary 40")
 * @returns {string} — A kebab-case string (e.g. "provly-primary-40")
 *
 * @example
 *   toKebabCase("provly accent(tertiary) key color")
 *   // => "provly-accent-tertiary-key-color"
 */
function toKebabCase(name) {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')            // Remove parentheses
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')             // Collapse multiple hyphens
    .replace(/^-|-$/g, '');          // Trim leading/trailing hyphens
}

/**
 * Converts a hex color with alpha (#rrggbbaa) to standard CSS format.
 *
 * Design tokens from Figma typically include an alpha channel even when
 * the color is fully opaque (#rrggbbff). This function strips the alpha
 * when it's "ff" (fully opaque) and converts partial alpha to rgba().
 *
 * @param {string} hex — 8-digit hex color string (e.g. "#1f4b43ff")
 * @returns {string} — CSS color string (e.g. "#1f4b43" or "rgba(31, 75, 67, 0.5)")
 *
 * @example
 *   hexToCSS("#1f4b43ff") // => "#1f4b43"
 *   hexToCSS("#00000040") // => "rgba(0, 0, 0, 0.25)"
 */
function hexToCSS(hex) {
  if (!hex || typeof hex !== 'string') return hex;

  // Normalize: ensure we have a '#' prefix
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;

  // If it's an 8-character hex (with alpha)
  if (normalized.length === 9) {
    const alphaHex = normalized.slice(7, 9);
    const alpha = parseInt(alphaHex, 16) / 255;

    // If fully opaque, strip the alpha channel for cleaner CSS
    if (alphaHex.toLowerCase() === 'ff') {
      return normalized.slice(0, 7);
    }

    // Otherwise, convert to rgba for browser compatibility
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(alpha.toFixed(3))})`;
  }

  return normalized;
}

/**
 * Converts a pixel value to rem units using a 16px base.
 *
 * @param {number} px — The pixel value to convert
 * @returns {string} — The rem value as a string (e.g. "1rem", "0.25rem")
 *
 * @example
 *   pxToRem(16) // => "1rem"
 *   pxToRem(4)  // => "0.25rem"
 *   pxToRem(0)  // => "0"
 */
function pxToRem(px) {
  if (px === 0) return '0';
  return `${parseFloat((px / 16).toFixed(4))}rem`;
}

/**
 * Generates a CSS file header/banner comment with metadata.
 *
 * @param {string} title       — Section title (e.g. "Primitive Colors")
 * @param {string} description — Multi-line description of the section's purpose
 * @returns {string} — Formatted CSS comment block
 */
function generateBanner(title, description) {
  const divider = '='.repeat(72);
  const timestamp = new Date().toISOString();

  return [
    `/* ${divider}`,
    ` * ${title}`,
    ` * ${divider}`,
    ` *`,
    ...description.split('\n').map((line) => ` * ${line}`),
    ` *`,
    ` * Auto-generated on: ${timestamp}`,
    ` * Source: provly-design-tokens.tokens.json`,
    ` * Generator: design-tokens-to-css.js`,
    ` *`,
    ` * DO NOT EDIT MANUALLY — regenerate from design tokens instead.`,
    ` * ${divider} */`,
    '',
  ].join('\n');
}

// ============================================================================
// TOKEN RESOLUTION — Alias / Reference Handling
// ============================================================================

/**
 * Builds a flat lookup map of all primitive color tokens.
 *
 * The design tokens JSON uses alias references like:
 *   "{provly - primitives.provly primary color palette.provly primary100}"
 *
 * This function traverses all primitive collections and creates a map
 * where the key is the alias path and the value is the resolved hex color.
 *
 * @param {object} tokens — The parsed design tokens JSON object
 * @returns {Map<string, string>} — Map from alias path to resolved CSS color
 *
 * @example
 *   const map = buildPrimitiveLookup(tokens);
 *   map.get("provly - primitives.provly primary color palette.provly primary100")
 *   // => "#ffffff"
 */
function buildPrimitiveLookup(tokens) {
  const lookup = new Map();

  /**
   * Recursively traverse a token group, building alias paths.
   *
   * @param {object} obj      — Current node in the token tree
   * @param {string} basePath — Dot-separated path prefix for alias resolution
   */
  function traverse(obj, basePath) {
    for (const [key, value] of Object.entries(obj)) {
      // Skip Figma metadata keys
      if (key === 'extensions' || key === 'description' || key === 'blendMode') {
        continue;
      }

      const currentPath = basePath ? `${basePath}.${key}` : key;

      // If this node has a "type" and "value", it's a token leaf
      if (value && typeof value === 'object' && value.type === 'color' && value.value) {
        lookup.set(currentPath, hexToCSS(value.value));
      } else if (value && typeof value === 'object' && !value.type) {
        // It's a group/folder — recurse deeper
        traverse(value, currentPath);
      }
    }
  }

  // Traverse all primitive collections
  // Collection 1: "primitives  colors collection" (generic primitives)
  if (tokens['primitives  colors collection']) {
    traverse(
      tokens['primitives  colors collection'],
      'primitives  colors collection'
    );
  }

  // Collection 2: "provly - primitives" (Provly-specific primitives)
  if (tokens['provly - primitives']) {
    traverse(tokens['provly - primitives'], 'provly - primitives');
  }

  return lookup;
}

/**
 * Resolves an alias reference string to its concrete color value.
 *
 * Alias strings from Figma look like:
 *   "{provly - primitives.provly primary color palette.provly primary100}"
 *
 * This function strips the curly braces and looks up the path in the
 * primitive color lookup map.
 *
 * @param {string} aliasString        — The raw alias reference string
 * @param {Map<string, string>} lookup — The primitive color lookup map
 * @returns {string|null} — The resolved CSS color value, or null if not found
 *
 * @example
 *   resolveAlias(
 *     "{provly - primitives.provly primary color palette.provly primary100}",
 *     primitiveLookup
 *   )
 *   // => "#ffffff"
 */
function resolveAlias(aliasString, lookup) {
  if (!aliasString || typeof aliasString !== 'string') return null;

  // Check if this is an alias reference (wrapped in curly braces)
  if (aliasString.startsWith('{') && aliasString.endsWith('}')) {
    const path = aliasString.slice(1, -1); // Remove { and }
    const resolved = lookup.get(path);

    if (resolved) {
      return resolved;
    }

    // If not found, log a warning (helpful during debugging)
    console.warn(`  ⚠️  Could not resolve alias: "${path}"`);
    return null;
  }

  // If it's not an alias, treat it as a direct color value
  return hexToCSS(aliasString);
}

// ============================================================================
// TOKEN PROCESSORS — One function per token category
// ============================================================================

/**
 * Processes EFFECT tokens (shadows) and returns CSS custom properties.
 *
 * Handles both single-shadow and multi-shadow effects (layered shadows).
 * Converts Figma shadow properties (offsetX, offsetY, radius, spread, color)
 * into CSS box-shadow syntax.
 *
 * @param {object} effectTokens — The "effect" section from design tokens
 * @returns {string} — CSS variable declarations for :root
 */
function processEffects(effectTokens) {
  const lines = [];

  for (const [name, token] of Object.entries(effectTokens)) {
    const varName = `--provly-shadow-${toKebabCase(name)}`;

    // Check if this is a multi-shadow effect (has numbered sub-keys like "0", "1")
    const numericKeys = Object.keys(token).filter((k) => !isNaN(k));

    if (numericKeys.length > 0) {
      // Multi-layer shadow: combine all layers into a comma-separated value
      const shadows = numericKeys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => {
          const shadow = token[key].value;
          return formatShadow(shadow);
        })
        .join(', ');

      lines.push(`  /** Multi-layer shadow: ${name} */`);
      lines.push(`  ${varName}: ${shadows};`);
    } else if (token.value) {
      // Single shadow
      lines.push(`  /** ${name} */`);
      lines.push(`  ${varName}: ${formatShadow(token.value)};`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats a single Figma shadow object into a CSS box-shadow value string.
 *
 * @param {object} shadow — Figma shadow object with offsetX, offsetY, radius, spread, color
 * @returns {string} — CSS box-shadow value (e.g. "4px 6px 8px 0px rgba(0, 0, 0, 0.25)")
 */
function formatShadow(shadow) {
  const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = '#000000' } = shadow;
  return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${hexToCSS(color)}`;
}

/**
 * Processes PRIMITIVE COLOR tokens and returns CSS custom properties.
 *
 * Primitives are organized into two collections:
 *   1. "primitives  colors collection" — Generic design system primitives
 *   2. "provly - primitives" — Provly-branded primitives
 *
 * Each collection contains:
 *   - Key Colors Group: The source/seed colors from which palettes are derived
 *   - Color Palettes: Tonal scales (0–100) generated from each key color
 *
 * @param {object} tokens — The full parsed design tokens JSON
 * @returns {string} — CSS variable declarations grouped by palette
 */
function processPrimitives(tokens) {
  const lines = [];

  /**
   * Helper: Process a single color collection into CSS variables.
   *
   * @param {object} collection   — The collection object from tokens
   * @param {string} prefix       — CSS variable prefix (e.g. "primitive" or "provly-primitive")
   * @param {string} sectionTitle — Human-readable section header
   */
  function processCollection(collection, prefix, sectionTitle) {
    lines.push(`  /* ── ${sectionTitle} ${'─'.repeat(Math.max(0, 50 - sectionTitle.length))} */`);
    lines.push('');

    for (const [groupName, groupTokens] of Object.entries(collection)) {
      // Skip non-object entries (metadata, etc.)
      if (typeof groupTokens !== 'object' || groupTokens === null) continue;
      // Skip if this is a direct token (has "type" at this level — for flat primitives)
      if (groupTokens.type === 'color') {
        const varName = `--${prefix}-${toKebabCase(groupName)}`;
        lines.push(`  ${varName}: ${hexToCSS(groupTokens.value)};`);
        continue;
      }

      lines.push(`  /* ${groupName} */`);

      for (const [tokenName, tokenValue] of Object.entries(groupTokens)) {
        if (
          typeof tokenValue !== 'object' ||
          tokenValue === null ||
          tokenValue.type !== 'color'
        ) {
          continue;
        }

        const varName = `--${prefix}-${toKebabCase(tokenName)}`;
        lines.push(`  ${varName}: ${hexToCSS(tokenValue.value)};`);
      }

      lines.push('');
    }
  }

  // Process generic primitives collection
  if (tokens['primitives  colors collection']) {
    processCollection(
      tokens['primitives  colors collection'],
      'primitive',
      'Generic Primitives Colors'
    );
  }

  // Process Provly-specific primitives collection
  if (tokens['provly - primitives']) {
    processCollection(
      tokens['provly - primitives'],
      'provly-primitive',
      'Provly-Branded Primitives'
    );
  }

  return lines.join('\n');
}

/**
 * Processes COLOR ROLE tokens and returns CSS custom properties.
 *
 * Color roles are the *semantic* tokens that should be used in UI code.
 * They reference primitive tokens via alias syntax and are resolved to
 * their concrete hex values by this function.
 *
 * Handles two role collections:
 *   1. "color roles" — Generic design system roles
 *   2. "provly color roles" — Provly-branded semantic roles
 *
 * @param {object} tokens              — The full parsed design tokens JSON
 * @param {Map<string, string>} lookup — Primitive color lookup map for alias resolution
 * @returns {string} — CSS variable declarations for :root
 */
function processColorRoles(tokens, lookup) {
  const lines = [];

  /**
   * Helper: Process a single color roles collection.
   *
   * @param {object} roles        — The roles object (flat key→token pairs)
   * @param {string} prefix       — CSS variable prefix (e.g. "role" or "provly-role")
   * @param {string} sectionTitle — Human-readable section header
   */
  function processRolesCollection(roles, prefix, sectionTitle) {
    lines.push(`  /* ── ${sectionTitle} ${'─'.repeat(Math.max(0, 50 - sectionTitle.length))} */`);
    lines.push('');

    for (const [roleName, roleToken] of Object.entries(roles)) {
      if (typeof roleToken !== 'object' || roleToken === null || roleToken.type !== 'color') {
        continue;
      }

      const varName = `--${prefix}-${toKebabCase(roleName)}`;
      const resolvedColor = resolveAlias(roleToken.value, lookup);

      if (resolvedColor) {
        lines.push(`  ${varName}: ${resolvedColor};`);
      } else {
        // Fallback: include the unresolved value as a comment for debugging
        lines.push(`  /* ${varName}: UNRESOLVED → ${roleToken.value} */`);
      }
    }

    lines.push('');
  }

  // Process generic color roles
  if (tokens['color roles']) {
    processRolesCollection(tokens['color roles'], 'role', 'Generic Color Roles');
  }

  // Process Provly-specific color roles
  if (tokens['provly color roles']) {
    processRolesCollection(tokens['provly color roles'], 'provly-role', 'Provly Color Roles');
  }

  return lines.join('\n');
}

/**
 * Processes SPACING tokens and returns CSS custom properties.
 *
 * Spacing values from Figma are in pixels and get converted to rem units
 * for responsive scaling. Handles two spacing collections:
 *   1. "spacing collection" — Generic spacing scale
 *   2. "provly spacing collection" — Provly-branded spacing scale
 *
 * @param {object} tokens — The full parsed design tokens JSON
 * @returns {string} — CSS variable declarations for :root
 */
function processSpacing(tokens) {
  const lines = [];

  /**
   * Helper: Process a single spacing collection.
   *
   * @param {object} collection   — The spacing collection object
   * @param {string} prefix       — CSS variable prefix
   * @param {string} sectionTitle — Human-readable section header
   */
  function processSpacingCollection(collection, prefix, sectionTitle) {
    lines.push(`  /* ── ${sectionTitle} ${'─'.repeat(Math.max(0, 50 - sectionTitle.length))} */`);
    lines.push('');

    for (const [name, token] of Object.entries(collection)) {
      if (typeof token !== 'object' || token === null || token.type !== 'dimension') {
        continue;
      }

      const varName = `--${prefix}-${toKebabCase(name)}`;
      lines.push(`  ${varName}: ${pxToRem(token.value)}; /* ${token.value}px */`);
    }

    lines.push('');
  }

  // Process generic spacing
  if (tokens['spacing collection']) {
    processSpacingCollection(tokens['spacing collection'], 'spacing', 'Generic Spacing Scale');
  }

  // Process Provly-specific spacing
  if (tokens['provly spacing collection']) {
    processSpacingCollection(
      tokens['provly spacing collection'],
      'provly-spacing',
      'Provly Spacing Scale'
    );
  }

  return lines.join('\n');
}

/**
 * Processes BORDER RADIUS tokens and returns CSS custom properties.
 *
 * @param {object} tokens — The full parsed design tokens JSON
 * @returns {string} — CSS variable declarations for :root
 */
function processBorderRadius(tokens) {
  const lines = [];
  const collection = tokens['provly border radius'];

  if (!collection) return '';

  lines.push(`  /* ── Provly Border Radius Scale ${'─'.repeat(26)} */`);
  lines.push('');

  for (const [name, token] of Object.entries(collection)) {
    if (typeof token !== 'object' || token === null || token.type !== 'dimension') {
      continue;
    }

    const varName = `--provly-radius-${toKebabCase(name)}`;

    // Special case: "full pill" uses a very large value (999px) for pill shapes
    if (token.value >= 999) {
      lines.push(`  ${varName}: 9999px; /* Full pill/circle shape */`);
    } else {
      lines.push(`  ${varName}: ${pxToRem(token.value)}; /* ${token.value}px */`);
    }
  }

  return lines.join('\n');
}

/**
 * Processes TYPOGRAPHY tokens and returns CSS custom properties.
 *
 * Typography tokens contain compound values (fontSize, fontFamily, fontWeight,
 * lineHeight, letterSpacing, etc.). Each style gets multiple CSS variables
 * for flexible usage, plus a pre-composed font shorthand.
 *
 * @param {object} tokens — The full parsed design tokens JSON
 * @returns {string} — CSS variable declarations for :root
 */
function processTypography(tokens) {
  const lines = [];
  const typography = tokens['typography'];

  if (!typography) return '';

  lines.push(`  /* ── Provly Typography System ${'─'.repeat(29)} */`);
  lines.push('');

  /**
   * Helper: Process a single typography style into CSS variables.
   *
   * @param {string} styleName — The typography style name (e.g. "provly display large")
   * @param {object} style     — The style object with fontSize, fontFamily, etc.
   * @param {string} prefix    — CSS variable prefix
   */
  function processTypographyStyle(styleName, style, prefix) {
    const varPrefix = `--${prefix}-${toKebabCase(styleName)}`;

    // Extract individual typographic properties
    const fontSize = style.fontSize?.value;
    const fontFamily = style.fontFamily?.value;
    const fontWeight = style.fontWeight?.value;
    const lineHeight = style.lineHeight?.value;
    const letterSpacing = style.letterSpacing?.value;
    const textDecoration = style.textDecoration?.value;
    const textCase = style.textCase?.value;

    lines.push(`  /* ${styleName} */`);

    if (fontSize !== undefined) {
      lines.push(`  ${varPrefix}-font-size: ${pxToRem(fontSize)}; /* ${fontSize}px */`);
    }
    if (fontFamily) {
      lines.push(`  ${varPrefix}-font-family: '${fontFamily}', sans-serif;`);
    }
    if (fontWeight !== undefined) {
      lines.push(`  ${varPrefix}-font-weight: ${fontWeight};`);
    }
    if (lineHeight !== undefined) {
      lines.push(`  ${varPrefix}-line-height: ${pxToRem(lineHeight)}; /* ${lineHeight}px */`);
    }
    if (letterSpacing !== undefined) {
      lines.push(
        `  ${varPrefix}-letter-spacing: ${letterSpacing === 0 ? '0' : `${letterSpacing / 16}rem`}; /* ${letterSpacing}px */`
      );
    }
    if (textDecoration && textDecoration !== 'none') {
      lines.push(`  ${varPrefix}-text-decoration: ${textDecoration};`);
    }
    if (textCase && textCase !== 'none') {
      lines.push(`  ${varPrefix}-text-transform: ${textCase};`);
    }

    lines.push('');
  }

  // Process each typography style
  for (const [styleName, styleValue] of Object.entries(typography)) {
    // Skip nested "fn" groups at the top level — process them separately
    if (styleName === 'fn') {
      lines.push(`  /* ── "fn" Typography Variants ${'─'.repeat(28)} */`);
      lines.push('');
      for (const [fnName, fnStyle] of Object.entries(styleValue)) {
        if (typeof fnStyle === 'object' && fnStyle.fontSize) {
          processTypographyStyle(`fn-${fnName}`, fnStyle, 'provly-type');
        }
      }
      continue;
    }

    // Check if this is a typography style (has fontSize sub-key)
    if (typeof styleValue === 'object' && styleValue.fontSize) {
      processTypographyStyle(styleName, styleValue, 'provly-type');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// FILE GENERATION
// ============================================================================

/**
 * Writes a CSS file with a descriptive banner, :root scope, and variable declarations.
 *
 * @param {string} filename    — Output filename (e.g. "provly-primitives.css")
 * @param {string} title       — Banner title
 * @param {string} description — Banner description
 * @param {string} cssContent  — The CSS variable declarations (inside :root)
 */
function writeCSSFile(filename, title, description, cssContent) {
  const filePath = path.join(OUTPUT_DIR, filename);
  const banner = generateBanner(title, description);
  const fullCSS = `${banner}\n:root {\n${cssContent}\n}\n`;

  fs.writeFileSync(filePath, fullCSS, 'utf-8');
  console.log(`  ✅ Generated: ${filePath}`);
}

/**
 * Generates the combined import file that references all individual CSS files.
 * This is the single entry point for consuming the full design system.
 */
function writeCombinedFile() {
  const banner = generateBanner(
    'Provly Design System — Combined Entry Point',
    [
      'Import this single file to load the entire Provly design token system.',
      '',
      'FILES INCLUDED:',
      '  1. provly-primitives.css    — Foundation color palettes (DO NOT use directly in UI)',
      '  2. provly-color-roles.css   — Semantic color tokens (USE THESE in UI)',
      '  3. provly-effects.css       — Shadow and elevation effects',
      '  4. provly-spacing.css       — Spacing scale',
      '  5. provly-border-radius.css — Border radius scale',
      '  6. provly-typography.css    — Typography system',
      '',
      'USAGE IN HTML:',
      '  <link rel="stylesheet" href="css/provly-design-system.css">',
      '',
      'USAGE IN CSS:',
      '  @import url("./provly-design-system.css");',
      '',
      'EXAMPLE — Applying Color Roles (the correct approach):',
      '  .button-primary {',
      '    background-color: var(--provly-role-provly-primary);',
      '    color: var(--provly-role-provly-on-primary);',
      '  }',
      '',
      '  .card {',
      '    background-color: var(--provly-role-provly-primary-container);',
      '    color: var(--provly-role-provly-on-primary-container);',
      '    border-radius: var(--provly-radius-provly-medium);',
      '    padding: var(--provly-spacing-provly-base-spacing);',
      '    box-shadow: var(--provly-shadow-provly-soft-shadow);',
      '  }',
      '',
      '  .error-message {',
      '    background-color: var(--provly-role-provly-error-container);',
      '    color: var(--provly-role-provly-on-error-container);',
      '  }',
      '',
      '⚠️  DO NOT reference --primitive-* or --provly-primitive-* variables',
      '    directly in your component CSS. Always use --role-* or --provly-role-*',
      '    tokens instead. The primitive layer exists solely as the foundation',
      '    that color roles reference internally.',
    ].join('\n')
  );

  const imports = [
    `@import url('./provly-primitives.css');`,
    `@import url('./provly-color-roles.css');`,
    `@import url('./provly-effects.css');`,
    `@import url('./provly-spacing.css');`,
    `@import url('./provly-border-radius.css');`,
    `@import url('./provly-typography.css');`,
  ].join('\n');

  const filePath = path.join(OUTPUT_DIR, OUTPUT_FILES.combined);
  fs.writeFileSync(filePath, `${banner}\n${imports}\n`, 'utf-8');
  console.log(`  ✅ Generated: ${filePath}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main entry point. Reads the design tokens JSON, processes each category,
 * and writes the output CSS files.
 */
function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Provly Design Tokens → CSS Custom Properties Converter   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 1: Read and parse the input file ──────────────────────────────
  console.log('📖 Reading design tokens...');
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error('   Make sure provly-design-tokens.tokens.json is in the same directory.');
    process.exit(1);
  }

  const rawJSON = fs.readFileSync(INPUT_FILE, 'utf-8');
  const tokens = JSON.parse(rawJSON);
  console.log('   ✅ Parsed successfully.\n');

  // ── Step 2: Create output directory ────────────────────────────────────
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
  }

  // ── Step 3: Build the primitive color lookup map ───────────────────────
  console.log('🔗 Building primitive color lookup for alias resolution...');
  const primitiveLookup = buildPrimitiveLookup(tokens);
  console.log(`   ✅ Indexed ${primitiveLookup.size} primitive colors.\n`);

  // ── Step 4: Process each token category ────────────────────────────────
  console.log('🎨 Generating CSS files...\n');

  // 4a. Primitive Colors
  writeCSSFile(
    OUTPUT_FILES.primitives,
    'Provly Design System — Primitive Colors',
    [
      'FOUNDATION LAYER — These are the raw color palettes.',
      '',
      '⚠️  WARNING: DO NOT USE THESE VARIABLES DIRECTLY IN UI COMPONENTS.',
      '',
      'Primitive colors are the low-level tonal palettes from which',
      'semantic "color roles" are derived. They are included here for:',
      '  - Reference and documentation purposes',
      '  - Potential use in advanced theming/dark mode calculations',
      '  - Debugging and design system inspection',
      '',
      'For UI development, always use the color role tokens from',
      'provly-color-roles.css instead.',
      '',
      'NAMING CONVENTION:',
      '  --primitive-{palette}-{tonal-step}       (Generic primitives)',
      '  --provly-primitive-{palette}-{tonal-step} (Provly primitives)',
      '',
      'TONAL STEPS: 0 (darkest) → 100 (lightest/white)',
      '  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 92, 95, 98, 99, 100',
    ].join('\n'),
    processPrimitives(tokens)
  );

  // 4b. Color Roles
  writeCSSFile(
    OUTPUT_FILES.colorRoles,
    'Provly Design System — Color Roles (Semantic Colors)',
    [
      'APPLICATION LAYER — These are the colors to use in your UI.',
      '',
      '✅ USE THESE VARIABLES IN YOUR COMPONENT CSS.',
      '',
      'Color roles assign semantic meaning to colors from the primitive',
      'palette. They define the *purpose* of a color rather than its',
      'raw value, enabling consistent theming and potential dark mode.',
      '',
      'NAMING CONVENTION:',
      '  --role-{role-name}        (Generic roles)',
      '  --provly-role-{role-name} (Provly-branded roles)',
      '',
      'ROLE CATEGORIES:',
      '  • Primary     — Main brand/action color and its variants',
      '  • Secondary   — Supporting accent color',
      '  • Tertiary    — Third accent color for variety',
      '  • Success     — Positive/confirmation states',
      '  • Warning     — Caution states',
      '  • Error       — Destructive/error states',
      '  • Info        — Informational states',
      '  • Neutral     — Backgrounds, text, borders',
      '  • Surface     — Container/card backgrounds',
      '',
      'ROLE MODIFIERS:',
      '  • {role}               — The base color (e.g. button background)',
      '  • on-{role}            — Text/icon color ON the base color',
      '  • {role}-container     — Lighter variant for container backgrounds',
      '  • on-{role}-container  — Text/icon color ON the container',
    ].join('\n'),
    processColorRoles(tokens, primitiveLookup)
  );

  // 4c. Effects (Shadows)
  writeCSSFile(
    OUTPUT_FILES.effects,
    'Provly Design System — Effects (Shadows)',
    [
      'Shadow and elevation effects for the Provly design system.',
      '',
      'ELEVATION SCALE:',
      '  • soft    — Subtle, low-elevation shadow (cards, hover states)',
      '  • medium  — Mid-elevation shadow (dropdowns, tooltips)',
      '  • hard    — High-elevation shadow (modals, dialogs)',
      '',
      'USAGE:',
      '  .card { box-shadow: var(--provly-shadow-provly-soft-shadow); }',
    ].join('\n'),
    processEffects(tokens['effect'] || {})
  );

  // 4d. Spacing
  writeCSSFile(
    OUTPUT_FILES.spacing,
    'Provly Design System — Spacing Scale',
    [
      'Spacing tokens converted from pixels to rem units (base: 16px).',
      '',
      'SCALE (Provly):',
      '  no-spacing       →  0',
      '  extra-small      →  4px   (0.25rem)',
      '  small            →  8px   (0.5rem)',
      '  medium           → 12px   (0.75rem)',
      '  base             → 16px   (1rem)',
      '  large            → 24px   (1.5rem)',
      '  extra-large      → 32px   (2rem)',
      '  2x-large         → 40px   (2.5rem)',
      '  3x-large         → 48px   (3rem)',
      '  4x-large         → 64px   (4rem)',
      '',
      'USAGE:',
      '  .section { padding: var(--provly-spacing-provly-base-spacing); }',
      '  .stack > * + * { margin-top: var(--provly-spacing-provly-small-spacing); }',
    ].join('\n'),
    processSpacing(tokens)
  );

  // 4e. Border Radius
  writeCSSFile(
    OUTPUT_FILES.borderRadius,
    'Provly Design System — Border Radius',
    [
      'Border radius tokens for consistent rounded corners.',
      '',
      'SCALE:',
      '  small       →  4px  (0.25rem)  — Subtle rounding',
      '  medium      →  8px  (0.5rem)   — Standard component rounding',
      '  large       → 12px  (0.75rem)  — Prominent rounding',
      '  extra-large → 16px  (1rem)     — Large card rounding',
      '  full-pill   → 9999px           — Pill/capsule shape',
      '',
      'USAGE:',
      '  .button { border-radius: var(--provly-radius-provly-medium); }',
      '  .tag    { border-radius: var(--provly-radius-provly-full-pill); }',
    ].join('\n'),
    processBorderRadius(tokens)
  );

  // 4f. Typography
  writeCSSFile(
    OUTPUT_FILES.typography,
    'Provly Design System — Typography',
    [
      'Typography tokens providing a consistent type scale.',
      '',
      'FONT FAMILIES:',
      '  • Space Grotesk — Display and title styles (brand typeface)',
      '  • Inter         — Body, headline, and label styles (UI typeface)',
      '',
      'TYPE SCALE:',
      '  Display  (lg/md/sm)  — Hero sections, major headings',
      '  Headline (lg/md/sm)  — Section headings',
      '  Title    (lg/md/sm)  — Component titles, card headers',
      '  Body     (lg/md/sm)  — Paragraph text, descriptions',
      '  Label    (lg/md/sm)  — Buttons, form labels, captions',
      '',
      'EACH STYLE PROVIDES THESE VARIABLES:',
      '  --provly-type-{style}-font-size',
      '  --provly-type-{style}-font-family',
      '  --provly-type-{style}-font-weight',
      '  --provly-type-{style}-line-height',
      '  --provly-type-{style}-letter-spacing',
      '',
      'USAGE:',
      '  h1 {',
      '    font-size: var(--provly-type-provly-display-large-font-size);',
      '    font-family: var(--provly-type-provly-display-large-font-family);',
      '    font-weight: var(--provly-type-provly-display-large-font-weight);',
      '    line-height: var(--provly-type-provly-display-large-line-height);',
      '    letter-spacing: var(--provly-type-provly-display-large-letter-spacing);',
      '  }',
    ].join('\n'),
    processTypography(tokens)
  );

  // ── Step 5: Generate the combined import file ─────────────────────────
  console.log('');
  writeCombinedFile();

  // ── Done ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(62));
  console.log('🎉 All CSS files generated successfully!');
  console.log('');
  console.log('📂 Output directory: ' + OUTPUT_DIR);
  console.log('');
  console.log('📋 Quick Start:');
  console.log('   1. Link the combined file in your HTML:');
  console.log('      <link rel="stylesheet" href="css/provly-design-system.css">');
  console.log('');
  console.log('   2. Use color ROLE variables (not primitives) in your CSS:');
  console.log('      background: var(--provly-role-provly-primary);');
  console.log('      color:      var(--provly-role-provly-on-primary);');
  console.log('');
  console.log('   ⚠️  Remember: --provly-primitive-* vars are for reference only.');
  console.log('      Always use --provly-role-* vars in your UI components.');
  console.log('─'.repeat(62));
  console.log('');
}

// Run the converter
main();
