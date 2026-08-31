/**
 * An inline maple leaf.
 *
 * ── WHY NOT THE 🇨🇦 EMOJI ───────────────────────────────────────────────────
 * The hero used the flag emoji, which is a pair of regional indicator symbols
 * (U+1F1E8 U+1F1E6). Android's system font renders those as a flag; a lot of
 * devices and every Windows browser do not, and fall back to drawing the two
 * letters — so the callout shipped a grey "CA" tile next to the sentence about
 * being built in Canada. Reported from a real phone, not theorised.
 *
 * An inline SVG cannot fall back to anything. It also takes `currentColor`, so
 * it inherits the callout's ink instead of sitting in emoji colour, and it
 * scales with the type rather than with the emoji metrics.
 */
export default function MapleLeaf({
  size = 20,
  className = '',
}: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Canada"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M256 42l-30 66c-4 9-13 8-20 4l-38-22 12 74c3 11-4 15-13 10l-56-26 18 61c3 10-2 13-9 15l-38 12 78 63c8 7 5 14 3 21l-9 30 76-9c9-1 14 3 14 11l-4 84h44l-4-84c0-8 5-12 14-11l76 9-9-30c-2-7-5-14 3-21l78-63-38-12c-7-2-12-5-9-15l18-61-56 26c-9 5-16 1-13-10l12-74-38 22c-7 4-16 5-20-4z"
      />
    </svg>
  )
}
