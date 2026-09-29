/**
 * Product description parser.
 *
 * Admins paste free-form text (often copied from eBay listings) that mixes
 * "Label: value" spec lines with section headers like KEY FEATURES, CONDITION,
 * INCLUDED, etc. Rendering that blob as one <p> is what made product pages look
 * like a wall of text — this parser restructures it into:
 *
 *   - itemSpecs:   "Label: value" pairs (Item Specifics table)
 *   - features:    list items under KEY FEATURES / HIGHLIGHTS...
 *   - sections:    titled blocks (CONDITION, INCLUDED, SHIPPING, etc.)
 *   - paragraphs:  anything left over
 *
 * Nothing is thrown away: unrecognized lines always survive into `paragraphs`.
 */

/** Section headers we recognize and render as titled blocks. */
const SECTION_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: 'features', re: /^key\s*features?\b/i },
  { key: 'features', re: /^features?\s*(and|&)?\s*(highlights?|benefits?)?\b/i },
  { key: 'features', re: /^highlights?\b/i },
  { key: 'condition', re: /^condition(\s*notes?)?\b/i },
  { key: 'included', re: /^included(\s*items?)?\b/i },
  { key: 'excluded', re: /^(excluded|not\s*included)\b/i },
  { key: 'compatibility', re: /^compatib(le|ility)\b/i },
  { key: 'warranty', re: /^warranty\b/i },
  { key: 'shipping', re: /^shipping(\s*info(rmation)?)?\b/i },
  { key: 'packaging', re: /^packaging\b/i },
  { key: 'notes', re: /^(important\s*)?notes?\b/i },
]

/** True when a line is a "Label: value" spec pair (value may be empty). */
function isSpecLine(line: string): boolean {
  return /^[^:]{1,40}:/.test(line)
}

/** "KEY FEATURES:" / "Condition Notes —" → { key: 'features', title: null } */
function matchSectionHeader(line: string): { key: string; trailing: string } | null {
  for (const p of SECTION_PATTERNS) {
    const m = line.match(p.re)
    if (!m) continue
    // Trailing text after the header word (e.g. "CONDITION: New")
    const trailing = line.slice(m[0].length).replace(/^[\s:—–-]+/, '').trim()
    return { key: p.key, trailing }
  }
  return null
}

/**
 * Convert an internal section key to a human title. Custom headers like
 * "Warranty" keep their original casing from the source text.
 */
export function sectionTitle(key: string): string {
  const titles: Record<string, string> = {
    features: 'Key Features',
    condition: 'Condition',
    included: "What's Included",
    excluded: 'Not Included',
    compatibility: 'Compatibility',
    warranty: 'Warranty',
    shipping: 'Shipping',
    packaging: 'Packaging',
    notes: 'Notes',
  }
  return titles[key] ?? key
}

export interface ParsedDescription {
  /** "Label: value" pairs for the Item Specifics table */
  itemSpecs: Array<{ label: string; value: string }>
  /** Bullet list extracted from KEY FEATURES etc. */
  features: string[]
  /** Titled content blocks (Condition, Included, ...) */
  sections: Array<{ key: string; title: string; paragraphs: string[]; bullets: string[] }>
  /** Lines that matched no pattern — rendered as plain paragraphs */
  paragraphs: string[]
}

/**
 * Parse a raw description string into structured content.
 * Tolerates \r\n line endings; blank lines separate logical groups.
 */
export function parseDescription(raw: string | null | undefined): ParsedDescription {
  const itemSpecs: ParsedDescription['itemSpecs'] = []
  const features: string[] = []
  const sections: ParsedDescription['sections'] = []
  const paragraphs: string[] = []

  if (!raw) return { itemSpecs, features, sections, paragraphs }

  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  let current: ParsedDescription['sections'][number] | null = null
  let sawFeaturesHeader = false

  const endSection = () => {
    current = null
  }

  for (const line of lines) {
    const header = matchSectionHeader(line)
    const isSpec = isSpecLine(line)
    // Value part of a "Label: value" pair (empty for bare headers like "KEY FEATURES:")
    const specValue = isSpec ? line.slice(line.indexOf(':') + 1).trim() : null

    // A known section header opens a block — but "Condition: New" (a real
    // spec pair with a value) must NOT be mistaken for a CONDITION section:
    // only bare headers, or headers ending in a colon with no value, qualify.
    if (header && (!isSpec || specValue === '')) {
      if (header.key === 'features') {
        sawFeaturesHeader = true
        // Inline value after "KEY FEATURES:" is unusual; treat as a bullet
        if (header.trailing) features.push(header.trailing)
      } else {
        endSection()
        current = { key: header.key, title: sectionTitle(header.key), paragraphs: [], bullets: [] }
        sections.push(current)
        // Inline value after a header with trailing text ("CONDITION — used, good")
        if (header.trailing) current.paragraphs.push(header.trailing)
      }
      continue
    }

    // Standalone "Label: value" lines outside any section → Item Specifics
    if (isSpec && !current) {
      itemSpecs.push({ label: line.slice(0, line.indexOf(':')).trim(), value: specValue || '' })
      continue
    }

    // Inside a section: content accumulates there
    if (current) {
      if (isSpec) {
        // Some admins keep "Label: value" pairs inside sections (e.g. under
        // PACKAGING). Keep them as bullets so the section stays intact.
        current.bullets.push(line)
      } else {
        current.paragraphs.push(line)
      }
      continue
    }

    // Non-spec line outside a section, before any KEY FEATURES header: a
    // marketing sentence → paragraph. After it: treat as a feature bullet
    // (admins often list features without the header).
    if (sawFeaturesHeader) {
      features.push(line)
    } else {
      paragraphs.push(line)
    }
    continue
  }

  // Drop spec pairs with an empty value — they render as junk rows like
  // "SCUPPER PLUG —" with nothing after it.
  const cleanedSpecs = itemSpecs.filter((s) => s.value.length > 0)

  return { itemSpecs: cleanedSpecs, features, sections, paragraphs }
}

/** Merge parsed content with fallbacks when the admin left fields empty. */
export function buildSpecTable(
  parsed: ParsedDescription,
  product: { brand: string; category: string; condition: string },
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []

  // Parsed specs come FIRST so they win the de-dupe below — the admin-entered
  // "Condition: New" is more specific than our internal enum value "new".
  for (const s of parsed.itemSpecs) rows.push({ label: s.label, value: s.value })
  if (product.brand) rows.push({ label: 'Brand', value: product.brand })
  if (product.category) rows.push({ label: 'Category', value: product.category.replace(/-/g, ' ') })
  if (product.condition) rows.push({ label: 'Condition', value: product.condition })

  // De-dupe by label (case-insensitive), keeping the FIRST occurrence
  const seen = new Set<string>()
  return rows.filter((r) => {
    const k = r.label.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
