"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BentoFeature {
  /** Stable unique id — also used as the shared layout id for the morph transition. */
  id: string;
  /** Short eyebrow label, e.g. "Fabric". Rendered in label-mono style. */
  tag: string;
  title: string;
  /** Short copy shown on the grid tile. */
  description: string;
  /** Longer copy shown in the fullscreen viewer. Falls back to `description`. */
  detail?: string;
  /** Optional photo — renders as the tile's background. */
  image?: string;
  /** Optional CSS `background` value for tiles without a photo (e.g. a gradient). */
  accent?: string;
}

interface BentoFeatureGridProps {
  features: BentoFeature[];
  className?: string;
}

/** Column/row span classes cycled per tile to produce an asymmetric bento layout. */
const SPAN_PATTERN = [
  "col-span-2 row-span-2 md:col-span-4 md:row-span-2",
  "col-span-1 md:col-span-2",
  "col-span-1 md:col-span-2",
  "col-span-1 md:col-span-3",
  "col-span-1 md:col-span-3",
  "col-span-2 md:col-span-6",
];

const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 400;

export function BentoFeatureGrid({ features, className }: BentoFeatureGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(0);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const prefersReducedMotion = useReducedMotion();

  const open = useCallback((index: number) => {
    setOpenIndex(index);
    setActiveIndex(index);
    setDirection(0);
  }, []);

  const close = useCallback(() => {
    triggerRefs.current[openIndex ?? -1]?.focus();
    setOpenIndex(null);
    setActiveIndex(null);
  }, [openIndex]);

  const goTo = useCallback(
    (nextIndex: number, dir: number) => {
      setDirection(dir);
      setActiveIndex(((nextIndex % features.length) + features.length) % features.length);
    },
    [features.length]
  );

  const showPrev = useCallback(() => {
    if (activeIndex === null) return;
    goTo(activeIndex - 1, -1);
  }, [activeIndex, goTo]);

  const showNext = useCallback(() => {
    if (activeIndex === null) return;
    goTo(activeIndex + 1, 1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (openIndex === null) return;
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, close, showPrev, showNext]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_DISTANCE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      showNext();
    } else if (info.offset.x > SWIPE_DISTANCE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      showPrev();
    }
  }

  const openFeature = openIndex !== null ? features[openIndex] : null;
  const activeFeature = activeIndex !== null ? features[activeIndex] : null;
  const transitionDuration = prefersReducedMotion ? 0 : undefined;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:auto-rows-[190px]">
        {features.map((feature, i) => (
          <BentoTile
            key={feature.id}
            ref={(el) => {
              triggerRefs.current[i] = el;
            }}
            feature={feature}
            index={i}
            isOpen={openIndex === i}
            onOpen={() => open(i)}
          />
        ))}
      </div>

      <AnimatePresence>
        {openFeature && activeFeature && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-femfit-charcoal/85 p-3 backdrop-blur-sm md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: transitionDuration }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <motion.div
              layoutId={`bento-tile-${openFeature.id}`}
              onClick={(e) => e.stopPropagation()}
              className="module relative flex h-full w-full max-w-4xl flex-col overflow-hidden md:h-auto md:max-h-[85vh] md:flex-row"
            >
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              {features.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrev}
                    aria-label="Previous feature"
                    className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background md:flex"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    aria-label="Next feature"
                    className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background md:flex"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}

              <div className="relative h-56 shrink-0 overflow-hidden md:h-auto md:w-1/2">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={activeFeature.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: transitionDuration ?? 0.35, ease: "easeInOut" }}
                    drag={features.length > 1 ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={handleDragEnd}
                    className="absolute inset-0"
                  >
                    <FeatureVisual feature={activeFeature} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-4 p-6 md:w-1/2 md:p-10">
                <p className="label-mono">{activeFeature.tag}</p>
                <h2 id={dialogTitleId} className="font-serif text-3xl tracking-tight md:text-4xl">
                  {activeFeature.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {activeFeature.detail ?? activeFeature.description}
                </p>

                {features.length > 1 && (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="label-mono">
                      {String(activeIndex! + 1).padStart(2, "0")} /{" "}
                      {String(features.length).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {features.map((f, i) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => goTo(i, i > activeIndex! ? 1 : -1)}
                          aria-label={`Go to ${f.title}`}
                          aria-current={i === activeIndex}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full transition-all",
                            i === activeIndex ? "w-4 bg-foreground" : "bg-border hover:bg-muted-foreground"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

interface BentoTileProps {
  feature: BentoFeature;
  index: number;
  isOpen: boolean;
  onOpen: () => void;
}

function BentoTile({
  feature,
  index,
  isOpen,
  onOpen,
  ref,
}: BentoTileProps & { ref: (el: HTMLButtonElement | null) => void }) {
  const hasVisual = Boolean(feature.image || feature.accent);

  return (
    <motion.button
      ref={ref}
      type="button"
      layoutId={`bento-tile-${feature.id}`}
      onClick={onOpen}
      style={{ visibility: isOpen ? "hidden" : "visible" }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "module group relative flex min-h-[150px] flex-col justify-end overflow-hidden p-5 text-left",
        SPAN_PATTERN[index % SPAN_PATTERN.length],
        !hasVisual && "module-muted border-transparent",
        index % SPAN_PATTERN.length === 0 && "min-h-[280px]"
      )}
    >
      {hasVisual && (
        <div className="absolute inset-0">
          <FeatureVisual feature={feature} zoomOnHover />
        </div>
      )}
      <div className="relative">
        <p className={cn("label-mono", hasVisual && "text-white/70")}>{feature.tag}</p>
        <p
          className={cn(
            "mt-2 font-serif text-xl tracking-tight",
            hasVisual ? "text-white" : "text-foreground"
          )}
        >
          {feature.title}
        </p>
      </div>
    </motion.button>
  );
}

function FeatureVisual({
  feature,
  zoomOnHover = false,
}: {
  feature: BentoFeature;
  zoomOnHover?: boolean;
}) {
  if (feature.image) {
    return (
      <>
        <Image
          src={feature.image}
          alt=""
          fill
          className={cn(
            "object-cover",
            zoomOnHover && "transition-transform duration-500 group-hover:scale-105"
          )}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </>
    );
  }

  return (
    <div
      className="absolute inset-0"
      style={{ background: feature.accent }}
      aria-hidden="true"
    />
  );
}
