import Image from 'next/image'

/**
 * Showcase — the presentation layer that turns a flat marketing PNG into
 * something that reads as a rendered object on the page.
 *
 * Four things do the work, and they are deliberately layered in this order:
 *
 *  1. A COLOURED BLOOM behind the plate, in the section's own accent. This is
 *     a separate blurred element rather than a `box-shadow`, because a shadow
 *     is clipped to the box's silhouette and cannot spill the way stage light
 *     does. It is what makes the image feel lit rather than pasted.
 *  2. A 3D TILT. `perspective` lives on the outer wrapper and the rotation on
 *     the inner plate, which is the only arrangement that produces real
 *     foreshortening — `transform: rotateY()` without a perspective ancestor
 *     is an affine skew and looks like a sticker.
 *  3. A BEZEL: 1px inner highlight over a hairline border, so the plate has a
 *     lit top edge like every other surface in this design language.
 *  4. A GROUND SHADOW + reflection under the plate, so it sits on something.
 *
 * The tilt straightens on hover — a small, cheap signal that the object is
 * three-dimensional. It is transform-only, so it costs no layout.
 * `motion-reduce` removes it entirely.
 *
 * NO `will-change: transform`. The hint permanently promotes a large plate to
 * its own compositing layer for a transition that only runs on hover, and a
 * promoted layer is skipped by some full-page screenshot paths — which is how
 * this was caught. The browser promotes it for the duration of the transition
 * on its own.
 */

export type ShowcaseTilt = 'left' | 'right' | 'flat'

const TILT: Record<ShowcaseTilt, string> = {
  // Negative rotateY turns the RIGHT edge away, which is what you want when
  // the plate sits to the right of its copy — it leans back into the page.
  right: 'perspective(1600px) rotateY(-9deg) rotateX(3deg) rotate(-1deg)',
  left: 'perspective(1600px) rotateY(9deg) rotateX(3deg) rotate(1deg)',
  flat: 'perspective(1600px) rotateX(4deg)',
}

export default function Showcase({
  src, alt, accent, tilt = 'right', priority = false, className = '',
  width = 1080, height = 1920, sizes, aspect, objectPosition,
}: {
  src: string
  /** Real alt text: these images carry the product's story and some carry copy. */
  alt: string
  /** Section accent, as a hex — drives the bloom and the edge light. */
  accent: string
  tilt?: ShowcaseTilt
  priority?: boolean
  className?: string
  width?: number
  height?: number
  sizes?: string
  /** CSS aspect-ratio (e.g. '4 / 5'). Crops the poster instead of letting a
   *  9:16 plate run 800px tall in a three-up. */
  aspect?: string
  /** Which part of the poster the crop keeps. Defaults to the top. Use this to
   *  frame the devices and cut a headline the page already states in HTML. */
  objectPosition?: string
}) {
  return (
    <div className={`group relative ${className}`} style={{ perspective: 1600 }}>
      {/* 1. Stage bloom — sits behind, spills past the plate on every side. */}
      <div
        aria-hidden
        // inset-0, NOT a negative inset. A blur paints well outside the
        // element's box but the LAYOUT box is what a viewport-overflow check
        // measures — so the glow still spills visually while the element
        // itself can never push past the page edge.
        className="pointer-events-none absolute inset-0 -z-10 rounded-[3rem] opacity-80 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background: `radial-gradient(65% 55% at 50% 32%, ${accent}6B 0%, ${accent}2B 45%, transparent 74%)`,
        }}
      />

      {/* 2 + 3. The plate: tilted, bezelled, clipping the image. */}
      <div
        className="relative overflow-hidden rounded-[2.25rem] transition-transform duration-700 ease-out group-hover:[transform:perspective(1600px)_rotateY(0deg)_rotateX(0deg)] motion-reduce:!transform-none"
        style={{
          transform: TILT[tilt],
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.22)',
            '0 2px 4px rgba(0,0,0,0.4)',
            '0 40px 80px -32px rgba(0,0,0,0.95)',
            `0 0 90px -40px ${accent}`,
          ].join(', '),
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes ?? '(max-width: 1023px) 88vw, 40vw'}
          className={aspect ? 'block w-full object-cover' : 'block h-auto w-full'}
          style={aspect ? { aspectRatio: aspect, height: 'auto', objectPosition: objectPosition ?? '50% 0%' } : undefined}
        />
        {/* A glass sheen raking across the plate. Stops at 46% so it reads as
            one highlight rather than a band with a visible seam. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(112deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 24%, transparent 46%)',
          }}
        />
      </div>

      {/* 4. The ground it rests on. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-full h-16 rounded-[50%] blur-xl"
        style={{ background: `radial-gradient(50% 60% at 50% 0%, ${accent}33 0%, transparent 70%)` }}
      />
    </div>
  )
}
