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
 *  3. A DISSOLVED PERIMETER, not a bezel. There used to be a hairline border
 *     and a 1px inset highlight here. With eight lit photographic environments
 *     on the page, that edge was the whole problem: every screenshot ended in
 *     a crisp white-lipped rectangle, which is exactly the "pasted-in" read.
 *     The artwork now feathers out through a mask instead, so it sits IN the
 *     page rather than ON it.
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

/** The perimeter fade. Held to ~54% opaque before it starts falling off so the
 *  devices in the middle of every poster stay at full strength — the fade is
 *  meant to eat the frame, not the product. */
const MASK = [
  'radial-gradient(128% 96% at 50% 44%, #000 0%, #000 54%, rgba(0,0,0,0.72) 76%, rgba(0,0,0,0.28) 90%, transparent 100%)',
  'linear-gradient(180deg, transparent 0%, #000 11%, #000 78%, transparent 100%)',
].join(', ')

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

      {/* 1b. The grounding shadow, as its own blurred radial BEHIND the plate.
          It cannot be a `box-shadow` on the plate any more: a box-shadow is
          drawn from the BORDER BOX, not from the mask, so it would paint a
          hard rounded-rectangle of shadow around edges the mask has just made
          invisible — a shadow outlining nothing. Offset down and inset from
          the sides so it reads as contact with the page, not a halo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-0 top-12 -z-10 rounded-[3rem] blur-2xl"
        style={{
          background:
            'radial-gradient(62% 58% at 50% 68%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 46%, transparent 78%)',
        }}
      />

      {/* 2 + 3. The plate: tilted, its perimeter dissolved rather than drawn. */}
      <div
        className="relative transition-transform duration-700 ease-out group-hover:[transform:perspective(1600px)_rotateY(0deg)_rotateX(0deg)] motion-reduce:!transform-none"
        style={{ transform: TILT[tilt] }}
      >
        {/* The mask lives on this NON-transformed wrapper, one level inside the
            tilt. Masking the transformed element itself makes the browser treat
            it as a composited layer for the whole hover transition — the same
            promotion the `will-change` note below forbids. Keeping the tilt
            element a plain transform avoids introducing that hint at all.

            Two gradients, intersected: the radial feathers the CORNERS (which
            is where a rectangle announces itself first), the linear feathers
            the TOP and BOTTOM edges into the section background. `intersect`
            takes the darker of the two, so both fades apply. `-webkit-` pair
            is required for Safari, where `source-in` is the intersect spelling. */}
        {/* The radius and the clip are kept, but they no longer DRAW anything:
            the mask has already taken the corners to zero alpha long before
            the rounded rect, so this is only a safety clip on the poster. */}
        <div
          className="relative overflow-hidden rounded-[2.25rem]"
          style={{
            WebkitMaskImage: MASK,
            maskImage: MASK,
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
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
              one highlight rather than a band with a visible seam.
              It MUST stay inside the masked wrapper: as a sibling of it, the
              sheen paints over the feathered corners at full strength and
              reinstates exactly the hard edge the mask just removed. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(112deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 24%, transparent 46%)',
            }}
          />
        </div>
      </div>

      {/* 4. The accent bounce on the ground it rests on — the colour half of
          the contact; the dark half is (1b), behind the plate. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-full h-16 rounded-[50%] blur-xl"
        style={{ background: `radial-gradient(50% 60% at 50% 0%, ${accent}33 0%, transparent 70%)` }}
      />
    </div>
  )
}
