import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AppState = 'intro' | 'main' | 'celebrating' | 'final';

interface Particle {
  x: number; y: number; size: number;
  speed: number; driftX: number;
  pvx: number; pvy: number;
  alpha: number; baseAlpha: number;
  rot: number; rotSpeed: number;
  phase: number; layer: 0 | 1 | 2;
  color: string; glow: number;
  isBurst: boolean; life: number; maxLife: number;
  bvx: number; bvy: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PINKS = ['#ff0080', '#ff1493', '#ff69b4', '#ff85c8', '#ffb6c1', '#ff4daa'];

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function spawn(w: number, h: number, preplace = false): Particle {
  const r = Math.random();
  const layer: 0 | 1 | 2 = r < 0.33 ? 0 : r < 0.66 ? 1 : 2;
  const size =
    layer === 0 ? 3 + Math.random() * 9
    : layer === 1 ? 9 + Math.random() * 18
    : 18 + Math.random() * 34;
  const baseAlpha =
    layer === 0 ? 0.05 + Math.random() * 0.1
    : layer === 1 ? 0.14 + Math.random() * 0.2
    : 0.28 + Math.random() * 0.48;
  const glow =
    layer === 0 ? 3 + Math.random() * 4
    : layer === 1 ? 6 + Math.random() * 10
    : 14 + Math.random() * 22;
  const ci = layer === 2 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * PINKS.length);
  return {
    x: Math.random() * w,
    y: preplace ? Math.random() * h : h + size * 3,
    size, speed: 0.2 + Math.random() * 0.55,
    driftX: (Math.random() - 0.5) * 0.38,
    pvx: 0, pvy: 0,
    alpha: baseAlpha, baseAlpha,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.013,
    phase: Math.random() * Math.PI * 2,
    layer, color: PINKS[ci], glow,
    isBurst: false, life: 0, maxLife: 0, bvx: 0, bvy: 0,
  };
}

function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.25);
  ctx.bezierCurveTo(s * 0.5, -s * 0.9, s * 1.2, -s * 0.05, 0, s * 0.75);
  ctx.bezierCurveTo(-s * 1.2, -s * 0.05, -s * 0.5, -s * 0.9, 0, -s * 0.25);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
// HEART CANVAS
// ─────────────────────────────────────────────────────────────────────────────

function HeartCanvas({ celebratingRef }: { celebratingRef: React.MutableRefObject<boolean> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parts = useRef<Particle[]>([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const raf = useRef(0);
  const t = useRef(0);

  const addBurst = useCallback((x: number, y: number, n = 12) => {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 2.5 + Math.random() * 4.5;

      parts.current.push({
        x,
        y,
        size: 7 + Math.random() * 16,
        speed: 0,
        driftX: 0,
        pvx: 0,
        pvy: 0,
        alpha: 0.95,
        baseAlpha: 0.95,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.12,
        phase: 0,
        layer: 2,
        color: PINKS[Math.floor(Math.random() * 3)],
        glow: 22,
        isBurst: true,
        life: 0,
        maxLife: 55 + Math.floor(Math.random() * 45),
        bvx: Math.cos(angle) * spd,
        bvy: Math.sin(angle) * spd - 1.8,
      });
    }
  }, []);

  useEffect(() => {
    (window as any).__heartBurst = addBurst;

    return () => {
      delete (window as any).__heartBurst;
    };
  }, [addBurst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastFrame = 0;

    const frameInterval = 1000 / 60;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        1.5
      );

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resize();

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    window.addEventListener(
      'resize',
      resize
    );

    window.addEventListener(
      'mousemove',
      onMove,
      { passive: true }
    );

    const initialCount =
      width < 768 ? 38 : 52;

    parts.current = Array.from(
      { length: initialCount },
      () => spawn(width, height, true)
    );

    const draw = (now: number) => {
      raf.current =
        requestAnimationFrame(draw);

      if (
        now - lastFrame <
        frameInterval
      ) {
        return;
      }

      const delta = Math.min(
        (now - lastFrame) / 16.67,
        1.5
      );

      lastFrame = now;

      const isCel =
        celebratingRef.current;

      const target = isCel
        ? width < 768
          ? 60
          : 80
        : width < 768
          ? 38
          : 52;

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      t.current +=
        0.012 * delta;

      const tm = t.current;

      const mx = mouse.current.x;
      const my = mouse.current.y;

      if (
        parts.current.some(
          p =>
            p.isBurst &&
            p.life >= p.maxLife
        )
      ) {
        parts.current =
          parts.current.filter(
            p =>
              !(
                p.isBurst &&
                p.life >= p.maxLife
              )
          );
      }

      let ambientCount = 0;

      for (const p of parts.current) {
        if (!p.isBurst) {
          ambientCount++;
        }
      }

      while (
        ambientCount <
        target
      ) {
        parts.current.push(
          spawn(width, height)
        );

        ambientCount++;
      }

      for (const p of parts.current) {
        if (p.isBurst) {
          p.life++;

          if (
            p.life >=
            p.maxLife
          ) {
            continue;
          }

          p.alpha =
            p.baseAlpha *
            (1 -
              p.life /
                p.maxLife);

          p.x +=
            p.bvx * delta;

          p.y +=
            p.bvy * delta;

          p.bvy +=
            0.07 * delta;

          p.bvx *=
            Math.pow(
              0.98,
              delta
            );

          p.rot +=
            p.rotSpeed *
            delta;
        } else {
          if (p.layer === 2) {
            const dx =
              p.x - mx;

            const dy =
              p.y - my;

            const distSq =
              dx * dx +
              dy * dy;

            if (
              distSq < 13225 &&
              distSq > 1
            ) {
              const dist =
                Math.sqrt(
                  distSq
                );

              const force =
                (115 - dist) /
                115;

              p.pvx +=
                (dx / dist) *
                force *
                1.9 *
                delta;

              p.pvy +=
                (dy / dist) *
                force *
                1.4 *
                delta;
            }
          }

          p.pvx *=
            Math.pow(
              0.92,
              delta
            );

          p.pvy *=
            Math.pow(
              0.92,
              delta
            );

          p.x +=
            (p.driftX +
              p.pvx) *
            delta;

          p.y -=
            p.speed *
            delta;

          p.y +=
            p.pvy *
            0.35 *
            delta;

          p.rot +=
            p.rotSpeed *
            delta;

          if (
            p.y <
            -p.size * 4
          ) {
            const fresh =
              spawn(
                width,
                height
              );

            Object.assign(
              p,
              fresh
            );
          }

          if (
            p.x <
            -p.size * 3
          ) {
            p.x =
              width +
              p.size;
          }

          if (
            p.x >
            width +
            p.size * 3
          ) {
            p.x =
              -p.size;
          }
        }

        const pulse =
          1 +
          Math.sin(
            tm * 1.6 +
              p.phase
          ) *
          0.07;

        const s =
          (p.size *
            pulse) /
          2;

        ctx.save();

        ctx.globalAlpha =
          p.alpha;

        ctx.fillStyle =
          p.color;

        ctx.shadowColor =
          p.color;

        ctx.shadowBlur =
  p.isBurst
    ? 10
    : p.layer === 2
      ? 8
      : p.layer === 1
        ? 3
        : 0;

        ctx.translate(
          p.x,
          p.y
        );

        ctx.rotate(
          p.rot
        );

        heartPath(
          ctx,
          s
        );

        ctx.fill();

        ctx.restore();
      }
    };

    raf.current =
      requestAnimationFrame(
        draw
      );

    return () => {
      cancelAnimationFrame(
        raf.current
      );

      window.removeEventListener(
        'resize',
        resize
      );

      window.removeEventListener(
        'mousemove',
        onMove
      );
    };
  }, [celebratingRef]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// SVG HEART (UI)
// ─────────────────────────────────────────────────────────────────────────────

function HeartSVG({
  size = 100, color = '#ff0080', glow = 20,
  pulse = false, className = '',
}: {
  size?: number; color?: string; glow?: number; pulse?: boolean; className?: string;
}) {
  return (
    <svg
      width={size} height={size * 0.9} viewBox="0 0 100 90"
      className={className}
      style={{ animation: pulse ? 'heartbeat-big 1.6s ease-in-out infinite' : undefined, overflow: 'visible' }}
    >
      <path
        d="M 50 82 C 18 62, -6 36, 10 18 C 20 5, 36 5, 50 24 C 64 5, 80 5, 90 18 C 106 36, 82 62, 50 82 Z"
        fill={color}
        style={{ filter: `drop-shadow(0 0 ${glow}px ${color}) drop-shadow(0 0 ${glow * 1.8}px ${color})` }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL REVEAL HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRO SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => setPhase(2), 1900),
      setTimeout(() => setPhase(3), 3100),
      setTimeout(() => setPhase(4), 4400),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const burst = (window as any).__heartBurst;
    if (burst) {
      burst(cx, cy, 18);
      setTimeout(() => burst(cx - 80, cy + 40, 10), 200);
      setTimeout(() => burst(cx + 80, cy + 40, 10), 350);
    }
    setTimeout(onEnter, 850);
  };

  const show = (p: number, delay = 0) => ({
    opacity: phase >= p ? 1 : 0,
    transform: phase >= p ? 'translateY(0)' : 'translateY(22px)',
    transition: `opacity 0.9s ease ${delay}s, transform 0.9s ease ${delay}s`,
  });

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center text-center px-6"
      style={{
        background: 'radial-gradient(ellipse 120% 120% at 50% 50%, rgba(20,0,16,0.97) 0%, rgba(8,0,15,0.99) 100%)',
        opacity: leaving ? 0 : 1,
        transition: leaving ? 'opacity 0.85s ease' : undefined,
      }}
    >
      {/* Ambient radial */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(255,0,128,0.07) 0%, transparent 70%)',
      }} />

      {/* Big heart */}
      <div style={{ ...show(1, 0), marginBottom: '2rem', transition: `opacity 1.2s ease, transform 1.4s cubic-bezier(0.16,1,0.3,1)` }}>
        <HeartSVG size={170} color="#ff0080" glow={35} pulse={phase >= 1} />
      </div>

      {/* Text cascade */}
      <div className="space-y-3">
        <div style={{ ...show(2, 0), fontFamily: "'Great Vibes', cursive", fontSize: 'clamp(1.8rem,6vw,2.6rem)', color: '#ff85c8', textShadow: '0 0 18px #ff0080, 0 0 35px #ff1493' }}>
          Hey, my love…
        </div>

        <div style={{ ...show(3, 0.1), fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3.2rem,11vw,6.5rem)', fontWeight: 900, color: '#ffffff', letterSpacing: '0.06em', lineHeight: 1, textShadow: '0 0 20px #ff0080, 0 0 45px #ff0080, 0 0 90px #ff1493' }}>
          MALAIKA
        </div>

        <div style={{ ...show(4, 0), fontFamily: "'Great Vibes', cursive", fontSize: 'clamp(1.6rem,5vw,2.2rem)', color: '#ff69b4', textShadow: '0 0 12px #ff1493' }}>
          My Mrs. Balochni 🩷
        </div>

        <div style={{ ...show(4, 0.5), fontFamily: "'Poppins', sans-serif", fontSize: '0.82rem', letterSpacing: '0.12em', color: 'rgba(255,182,193,0.55)', marginTop: '0.25rem' }}>
          TAHA BALOCH made this little universe for you.
        </div>

        <div style={{ ...show(4, 1), marginTop: '2rem' }}>
          <button
            onClick={enter}
            className="neon-button"
            style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.95rem', padding: '1rem 3rem', borderRadius: '100px', letterSpacing: '0.14em' }}
          >
            ENTER MY HEART 🩷
          </button>
        </div>
      </div>

      {phase >= 4 && (
        <p style={{ position: 'absolute', bottom: '1.8rem', fontFamily: "'Great Vibes',cursive", fontSize: '1.05rem', color: 'rgba(255,105,180,0.4)', animation: 'blink-glow 3s ease-in-out infinite' }}>
          don't rush… I made this for you
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

const Divider = () => (
  <div className="section-divider" />
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: MY GIRL
// ─────────────────────────────────────────────────────────────────────────────

function MyGirlSection() {
  const { ref, inView } = useInView(0.25);
  return (
    <section
      ref={ref}
      id="my-girl"
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-20"
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,0,128,0.05) 0%, transparent 70%)' }} />

      {/* Large ghosted background heart */}
      <div className="absolute pointer-events-none" style={{ opacity: inView ? 0.07 : 0, transition: 'opacity 2s ease' }}>
        <HeartSVG size={Math.min(window.innerWidth * 0.9, 650)} color="#ff0080" glow={0} pulse={inView} />
      </div>

      <div style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(38px)', transition: 'all 0.95s ease', position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: 'clamp(1.2rem,4vw,1.6rem)', color: 'rgba(255,133,200,0.75)', textShadow: '0 0 14px #ff0080', marginBottom: '0.5rem' }}>
          psst… pookie 👀
        </p>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: '0.75rem', letterSpacing: '0.35em', color: 'rgba(255,105,180,0.55)', textTransform: 'uppercase', marginBottom: '1.2rem' }}>
          Look who's here…
        </p>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(3.2rem,13vw,7.5rem)', fontWeight: 900, color: '#ffffff', textShadow: '0 0 25px #ff0080, 0 0 55px #ff0080, 0 0 100px #ff1493', lineHeight: 1.05, marginBottom: '1.8rem', animation: inView ? 'neon-pulse 3s ease-in-out infinite' : undefined }}>
          MY MALAIKA 🩷
        </h2>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(1rem,3vw,1.3rem)', color: 'rgba(255,182,193,0.82)', maxWidth: '480px', margin: '0 auto 3rem', lineHeight: 1.85, opacity: inView ? 1 : 0, transition: 'opacity 1s ease 0.5s' }}>
          Do you know how special you are to me?
        </p>
        <button
          onClick={() => document.getElementById('reasons')?.scrollIntoView({ behavior: 'smooth' })}
          className="neon-button"
          style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.9rem', padding: '0.9rem 2.6rem', borderRadius: '100px', letterSpacing: '0.12em' }}
        >
          LET ME SHOW YOU
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: REASONS
// ─────────────────────────────────────────────────────────────────────────────

const REASONS = [
  { n: '01', h: 'Because you\'re you.', b: 'No explanation needed. You just are, and that\'s more than enough.' },
  { n: '02', h: 'Because of that smile.', b: 'My heart forgets its rhythm every single time you smile.' },
  { n: '03', h: 'Because of how you love.', b: 'You love with your whole heart and it terrifies me in the best possible way.' },
  { n: '04', h: 'Because you\'re my person.', b: 'Out of everyone in this world, somehow you became mine. Lucky me.' },
  { n: '05', h: 'Because you make me better.', b: 'I didn\'t know what was missing until you arrived and filled everything.' },
  { n: '06', h: 'Because of every little thing.', b: 'The way you exist is somehow my absolute favorite thing about life.' },
];

function ReasonsSection() {
  const { ref, inView } = useInView(0.08);
  const [open, setOpen] = useState<number | null>(null);

  const toggle = (i: number, e: React.MouseEvent) => {
    setOpen(open === i ? null : i);
    const burst = (window as any).__heartBurst;
    if (burst) burst(e.clientX, e.clientY, 8);
  };

  return (
    <section ref={ref} id="reasons" className="relative py-24 px-5" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(28px)', transition: 'all 0.9s ease', marginBottom: '3.5rem' }}>
          <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: '1.3rem', color: 'rgba(255,133,200,0.7)', marginBottom: '0.6rem' }}>this one's for you</p>
          <h2 className="neon-text-white" style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(2.4rem,8vw,5rem)', fontWeight: 900 }}>
            Reasons I Love You
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1.4rem' }}>
          {REASONS.map((r, i) => (
            <div
              key={i}
              onClick={(e) => toggle(i, e)}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(42px)',
                transition: `opacity 0.7s ease ${i * 0.1}s, transform 0.7s ease ${i * 0.1}s, box-shadow 0.3s ease, background 0.3s ease`,
                cursor: 'pointer',
                background: open === i ? 'rgba(255,0,128,0.12)' : 'rgba(255,20,147,0.048)',
                backdropFilter: 'blur(20px)',
                border: `1px solid rgba(255,0,128,${open === i ? 0.58 : 0.24})`,
                borderRadius: '22px',
                padding: '1.8rem',
                boxShadow: open === i
                  ? '0 0 32px rgba(255,0,128,0.32), 0 0 64px rgba(255,0,128,0.14), inset 0 0 28px rgba(255,0,128,0.08)'
                  : '0 0 14px rgba(255,0,128,0.09), inset 0 0 14px rgba(255,0,128,0.03)',
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.28em', color: '#ff0080', textShadow: '0 0 10px #ff0080', marginBottom: '0.7rem', fontFamily: "'Poppins',sans-serif" }}>
                REASON #{r.n}
              </div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', fontStyle: 'italic', color: '#ffffff', textShadow: '0 0 8px rgba(255,0,128,0.4)', marginBottom: open === i ? '0.8rem' : 0, lineHeight: 1.4 }}>
                {r.h}
              </div>
              <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: '0.88rem', color: 'rgba(255,182,193,0.8)', lineHeight: 1.75, maxHeight: open === i ? '80px' : '0', overflow: 'hidden', transition: 'max-height 0.4s ease' }}>
                {r.b}
              </div>
              {open !== i && <span style={{ position: 'absolute', bottom: '1rem', right: '1.4rem', fontSize: '1.1rem', opacity: 0.45 }}>🩷</span>}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontFamily: "'Great Vibes',cursive", fontSize: '1.15rem', color: 'rgba(255,105,180,0.55)', marginTop: '2.8rem', opacity: inView ? 1 : 0, transition: 'opacity 1s ease 1.1s' }}>
          …and a million more reasons I haven't written yet.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: MEMORIES
// ─────────────────────────────────────────────────────────────────────────────

const MEMORY_LABELS = [
  'The day everything changed.',
  'My favorite memory of you.',
  'A moment I never want to forget.',
  'When I knew for sure.',
  'Just us, just this.',
  'Our little world.',
];

function MemoriesSection() {
  const [active, setActive] = useState<number | null>(null);

  const moments = [
    {
      title: 'THE WAY YOU SMILE',
      text: "You don't even realize what that smile does to me.",
      icon: '♡',
    },
    {
      title: 'THE WAY YOU EXIST',
      text: 'You make ordinary moments feel like something worth remembering.',
      icon: '✦',
    },
    {
      title: 'MY FAVORITE GIRL',
      text: 'Out of everyone in this world, somehow my heart found you.',
      icon: '♡',
    },
    {
      title: 'MY PEACE',
      text: 'You feel like home in a way I could never properly explain.',
      icon: '∞',
    },
  ];

  return (
    <section
      id="our-world"
      className="relative min-h-screen px-5 py-28 md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-6xl">
        {/* SECTION INTRO */}
        <div className="mb-16 text-center">
          <p className="mb-4 text-xs font-medium tracking-[0.45em] text-pink-300/70 uppercase">
            COME A LITTLE CLOSER
          </p>

          <h2 className="font-display text-4xl font-bold text-white md:text-6xl">
            IF YOU COULD SEE
            <span className="block neon-text">
              WHAT I SEE…
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-8 text-pink-100/65 md:text-base">
            If you could see yourself through my eyes,
            maybe you'd finally understand why my heart
            chose you.
          </p>
        </div>

        {/* MOMENT CARDS */}
        <div className="grid gap-5 md:grid-cols-2">
          {moments.map((moment, index) => {
            const isActive = active === index;

            return (
              <button
                key={moment.title}
                type="button"
                onClick={() =>
                  setActive(
                    isActive ? null : index
                  )
                }
                className="glass-card group relative overflow-hidden rounded-3xl p-7 text-left transition-all duration-500 hover:-translate-y-1 hover:border-pink-400/60 md:p-9"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-pink-500/10 blur-3xl transition-all duration-700 group-hover:bg-pink-500/25" />

                <div className="relative z-10">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-3xl text-pink-400 neon-text">
                      {moment.icon}
                    </span>

                    <span className="text-[10px] tracking-[0.3em] text-pink-200/40 uppercase">
                      0{index + 1}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-white md:text-3xl">
                    {moment.title}
                  </h3>

                  <div
                    className={`grid transition-all duration-500 ${
                      isActive
                        ? 'mt-5 grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm leading-7 text-pink-100/70 md:text-base">
                        {moment.text}
                      </p>
                    </div>
                  </div>

                  {!isActive && (
                    <p className="mt-4 text-xs tracking-[0.18em] text-pink-400/60 uppercase">
                      Tap to discover
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* SPECIAL KISS MOMENT */}
        <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-pink-500/50 bg-pink-950/20 p-8 text-center shadow-[0_0_35px_rgba(255,0,128,0.18),inset_0_0_30px_rgba(255,0,128,0.05)] backdrop-blur-xl md:p-14">
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/10 blur-[90px]" />

          <div className="relative z-10">
            <div className="mb-6 text-5xl animate-pulse md:text-6xl">
              💋
            </div>

            <p className="mb-3 text-xs font-medium tracking-[0.4em] text-pink-300/70 uppercase">
              A MOMENT I STILL FEEL
            </p>

            <h3 className="font-display text-3xl font-bold text-white md:text-5xl">
              THE KISS I
              <span className="block neon-text">
                REMEMBER
              </span>
            </h3>

            <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-pink-100/75 md:text-lg">
              And that little kiss…
              <br />
              maybe it lasted only a moment,
              <br />
              but somehow my heart still lives there.
            </p>

            <div className="mx-auto my-8 h-px w-24 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_12px_#ff0080]" />

            <p className="mx-auto max-w-xl font-display text-xl italic text-pink-200 md:text-2xl">
              “Your lips met mine,
              and for a second,
              the whole world went quiet.” 😚🩷
            </p>

            <p className="mt-6 text-xs tracking-[0.25em] text-pink-400/60 uppercase">
              — TAHA BALOCH
            </p>
          </div>
        </div>

        {/* FINAL MESSAGE */}
        <div className="mt-16 text-center">
          <p className="font-script text-3xl text-pink-300 neon-text md:text-5xl">
            Maybe you don't see what I see…
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-pink-100/60 md:text-base">
            But I hope you always remember that
            <span className="font-semibold text-pink-300">
              {' '}TAHA BALOCH{' '}
            </span>
            sees a whole universe in you.
          </p>

          <div className="mt-7 text-2xl animate-pulse">
            🩷
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: LOVE LETTER
// ─────────────────────────────────────────────────────────────────────────────

const LETTER = [
  { t: 'heading', text: 'To My Malaika…' },
  { t: 'gap', text: '' },
  { t: 'body', text: 'I don\'t know where to begin,' },
  { t: 'body', text: 'so I\'ll start with the truth —' },
  { t: 'body', text: 'you changed everything.' },
  { t: 'gap', text: '' },
  { t: 'body', text: 'Before you, life was just life.' },
  { t: 'body', text: 'After you, every ordinary moment' },
  { t: 'body', text: 'started to feel like a gift.' },
  { t: 'gap', text: '' },
  { t: 'body', text: 'I love you in ways I don\'t have' },
  { t: 'body', text: 'the right words for yet.' },
  { t: 'body', text: 'But I\'m going to spend my whole life' },
  { t: 'body', text: 'trying to find them.' },
  { t: 'gap', text: '' },
  { t: 'body', text: 'You are my favorite person.' },
  { t: 'body', text: 'My home. My peace.' },
  { t: 'body', text: 'My Mrs. Balochni.' },
  { t: 'gap', text: '' },
  { t: 'sig', text: 'Forever yours,' },
  { t: 'sig2', text: 'Taha Baloch 🩷' },
];

function LoveLetterSection() {
  const { ref, inView } = useInView(0.18);
  const [state, setState] = useState<'closed' | 'opening' | 'open'>('closed');
  const [visLines, setVisLines] = useState(0);

  const open = () => {
    if (state !== 'closed') return;
    setState('opening');
    const burst = (window as any).__heartBurst;
    if (burst) {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      setTimeout(() => burst(cx, cy, 15), 200);
      setTimeout(() => burst(cx - 90, cy + 60, 8), 500);
      setTimeout(() => burst(cx + 90, cy + 60, 8), 700);
    }
    setTimeout(() => {
      setState('open');
      LETTER.forEach((_, i) => { setTimeout(() => setVisLines(i + 1), i * 185); });
    }, 900);
  };

  return (
    <section ref={ref} id="letter" className="relative py-24 px-5 flex flex-col items-center justify-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '580px', width: '100%', textAlign: 'center', opacity: inView ? 1 : 0, transition: 'opacity 1s ease' }}>
        <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: '1.3rem', color: 'rgba(255,133,200,0.7)', marginBottom: state === 'open' ? '1.5rem' : '2rem' }}>
          okay, one more thing…
        </p>

        {state === 'closed' && (
          <>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: '1.05rem', color: 'rgba(255,182,193,0.8)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
              Pookie… I wrote you something.
            </p>

            {/* Envelope */}
            <div style={{ width: '180px', height: '130px', margin: '0 auto 2.5rem', cursor: 'pointer', position: 'relative' }} onClick={open}>
              <div style={{ width: '100%', height: '100%', background: 'rgba(255,20,147,0.08)', border: '1.5px solid rgba(255,0,128,0.5)', borderRadius: '10px', boxShadow: '0 0 28px rgba(255,0,128,0.28), inset 0 0 18px rgba(255,0,128,0.07)', position: 'relative', overflow: 'hidden', animation: 'glow-border-anim 2.5s ease-in-out infinite' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '65px', background: 'rgba(255,0,128,0.12)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', borderBottom: '1px solid rgba(255,0,128,0.25)' }} />
                <div style={{ position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)' }}>
                  <HeartSVG size={28} color="#ff0080" glow={14} pulse />
                </div>
              </div>
            </div>

            <button onClick={open} className="neon-button" style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.9rem', padding: '0.9rem 2.5rem', borderRadius: '100px', letterSpacing: '0.12em' }}>
              OPEN IT 🩷
            </button>
          </>
        )}

        {state === 'opening' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <HeartSVG size={90} color="#ff0080" glow={30} pulse />
          </div>
        )}

        {state === 'open' && (
          <div className="glass-card" style={{ borderRadius: '22px', padding: 'clamp(2rem,6vw,3rem) clamp(1.5rem,5vw,2.8rem)', textAlign: 'left', boxShadow: '0 0 40px rgba(255,0,128,0.18), inset 0 0 30px rgba(255,0,128,0.05)' }}>
            {LETTER.map((line, i) => (
              <div
                key={i}
                style={{
                  opacity: visLines > i ? 1 : 0,
                  transform: visLines > i ? 'none' : 'translateY(10px)',
                  transition: 'opacity 0.55s ease, transform 0.55s ease',
                  minHeight: line.t === 'gap' ? '0.9rem' : undefined,
                  fontFamily: line.t === 'heading' || line.t === 'sig' || line.t === 'sig2' ? "'Great Vibes',cursive" : "'Poppins',sans-serif",
                  fontSize: line.t === 'heading' ? '1.9rem' : line.t === 'sig2' ? '1.6rem' : line.t === 'sig' ? '1.25rem' : '0.95rem',
                  color: line.t === 'heading' ? '#ff0080' : line.t === 'sig' || line.t === 'sig2' ? '#ff69b4' : 'rgba(255,182,193,0.88)',
                  textShadow: line.t === 'heading' ? '0 0 14px #ff0080' : undefined,
                  lineHeight: 1.85,
                  marginBottom: line.t === 'heading' ? '0.3rem' : '0.15rem',
                }}
              >
                {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: LITTLE SURPRISES
// ─────────────────────────────────────────────────────────────────────────────

const MSGS = [
  "you're beautiful. 🩷", "you're so loved.", "you're my favorite.",
  "come here 🩷", "TAHA LOVES YOU.", "yes, YOU.",
  "my heart is yours.", "forever and always.", "you make everything better.",
  "my Mrs. Balochni 😭🩷", "I choose you. every time.", "you are everything.",
];

const POS: { top: string; left: string }[] = [
  { top: '12%', left: '8%' },  { top: '8%',  left: '38%' }, { top: '15%', left: '68%' },
  { top: '32%', left: '18%' }, { top: '28%', left: '52%' }, { top: '20%', left: '82%' },
  { top: '52%', left: '6%' },  { top: '48%', left: '32%' }, { top: '55%', left: '62%' },
  { top: '68%', left: '14%' }, { top: '72%', left: '46%' }, { top: '62%', left: '78%' },
];

function SurprisesSection() {
  const { ref, inView } = useInView(0.08);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const tap = (i: number, e: React.MouseEvent) => {
    if (revealed[i]) return;
    setRevealed(r => ({ ...r, [i]: true }));
    const burst = (window as any).__heartBurst;
    if (burst) burst(e.clientX, e.clientY, 9);
  };

  return (
    <section ref={ref} id="surprises" className="relative py-20 px-5" style={{ minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem', opacity: inView ? 1 : 0, transition: 'opacity 0.9s ease' }}>
        <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: '1.3rem', color: 'rgba(255,133,200,0.7)', marginBottom: '0.5rem' }}>you thought that was all? 🩷</p>
        <h2 className="neon-text-white" style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900 }}>
          Little Surprises
        </h2>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: '0.85rem', color: 'rgba(255,182,193,0.55)', marginTop: '0.6rem', letterSpacing: '0.1em' }}>
          tap the hearts — there's something hiding inside each one
        </p>
      </div>

      <div style={{ position: 'relative', height: 'clamp(460px,70vh,600px)', maxWidth: '700px', margin: '0 auto' }}>
        {POS.map((pos, i) => (
          <div
            key={i}
            onClick={(e) => tap(i, e)}
            style={{
              position: 'absolute',
              top: pos.top, left: pos.left,
              opacity: inView ? 1 : 0,
              transition: `opacity 0.5s ease ${i * 0.07}s`,
              cursor: revealed[i] ? 'default' : 'pointer',
              zIndex: revealed[i] ? 10 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!revealed[i] ? (
              <span style={{
                fontSize: 'clamp(1.6rem,4vw,2.2rem)',
                filter: 'drop-shadow(0 0 8px #ff0080)',
                animation: `heartbeat ${1.5 + i * 0.25}s ease-in-out infinite`,
                display: 'block',
                transition: 'transform 0.15s ease',
              }}>🩷</span>
            ) : (
              <div style={{
                background: 'rgba(255,20,147,0.1)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,0,128,0.45)',
                borderRadius: '12px',
                padding: '0.55rem 0.9rem',
                boxShadow: '0 0 20px rgba(255,0,128,0.28)',
                fontFamily: "'Poppins',sans-serif",
                fontSize: '0.78rem',
                color: '#ffb6c1',
                whiteSpace: 'nowrap',
                animation: 'scale-in 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}>
                {MSGS[i % MSGS.length]}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: THE BIG QUESTION
// ─────────────────────────────────────────────────────────────────────────────

function BigQuestionSection({ onYes }: { onYes: () => void }) {
  const { ref, inView } = useInView(0.22);
  const [ph, setPh] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const ts = [
      setTimeout(() => setPh(1), 500),
      setTimeout(() => setPh(2), 1600),
      setTimeout(() => setPh(3), 2700),
      setTimeout(() => setPh(4), 3500),
    ];
    return () => ts.forEach(clearTimeout);
  }, [inView]);

  const s = (p: number, d = 0) => ({
    opacity: ph >= p ? 1 : 0,
    transform: ph >= p ? 'none' : 'translateY(18px)',
    transition: `opacity 0.85s ease ${d}s, transform 0.85s ease ${d}s`,
  });

  return (
    <section
      ref={ref} id="question"
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-20"
      style={{ background: 'linear-gradient(180deg,transparent 0%,rgba(5,0,10,0.55) 100%)' }}
    >
      {/* Ghost heart bg */}
      <div className="absolute pointer-events-none" style={{ opacity: inView ? 0.1 : 0, transition: 'opacity 2.5s ease' }}>
        <HeartSVG size={Math.min(window.innerWidth * 0.85, 560)} color="#ff0080" glow={0} pulse={inView} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', width: '100%' }}>
        <div style={{ ...s(1), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(3rem,11vw,6.5rem)', fontWeight: 900, color: '#ffffff', textShadow: '0 0 20px #ff0080, 0 0 45px #ff0080', marginBottom: '1.2rem' }}>
          MALAIKA…
        </div>
        <div style={{ ...s(2), fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(1rem,3vw,1.25rem)', color: 'rgba(255,182,193,0.82)', marginBottom: '1.8rem', lineHeight: 1.75 }}>
          I have one question for my favorite girl.
        </div>
        <div style={{ ...s(3), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(1.5rem,5vw,2.6rem)', fontStyle: 'italic', color: '#ff85c8', textShadow: '0 0 14px #ff0080', lineHeight: 1.4, marginBottom: '0.4rem' }}>
          Will you keep choosing me…
        </div>
        <div style={{ ...s(3, 0.3), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(1.5rem,5vw,2.6rem)', fontStyle: 'italic', color: '#ff85c8', textShadow: '0 0 14px #ff0080', lineHeight: 1.4, marginBottom: '3.5rem' }}>
          …again and again?
        </div>

        <div style={{ ...s(4), display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onYes}
            className="neon-button"
            style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: '1.05rem', padding: '1.05rem 2.8rem', borderRadius: '100px', letterSpacing: '0.1em', minWidth: '190px' }}
          >
            YES, ALWAYS 🩷
          </button>
          <button
            onClick={onYes}
            className="neon-button neon-button-alt"
            style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.95rem', padding: '0.95rem 2.2rem', borderRadius: '100px', letterSpacing: '0.08em', minWidth: '190px' }}
          >
            OF COURSE, POOKIE 💗
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function MainSections({ onYes }: { onYes: () => void }) {
  return (
    <div className="relative z-10">
      <MyGirlSection />
      <Divider />
      <ReasonsSection />
      <Divider />
      <MemoriesSection />
      <Divider />
      <LoveLetterSection />
      <Divider />
      <SurprisesSection />
      <Divider />
      <BigQuestionSection onYes={onYes} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CELEBRATION SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function CelebrationScreen({ onDone }: { onDone: () => void }) {
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const burst = (window as any).__heartBurst;
    const fireworks = () => {
      if (!burst) return;
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      for (let i = 0; i < 18; i++) {
        setTimeout(() => {
          burst(cx + (Math.random() - 0.5) * 500, cy + (Math.random() - 0.5) * 380, 14);
        }, i * 130);
      }
    };
    fireworks();
    setTimeout(fireworks, 2200);
    setTimeout(fireworks, 4400);

    const ts = [
      setTimeout(() => setPh(1), 200),
      setTimeout(() => setPh(2), 1300),
      setTimeout(() => setPh(3), 2600),
      setTimeout(() => setPh(4), 3900),
      setTimeout(() => setPh(5), 5100),
      setTimeout(() => setPh(6), 6400),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (ph >= 6) { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }
  }, [ph, onDone]);

  const s = (p: number, d = 0) => ({
    opacity: ph >= p ? 1 : 0,
    transform: ph >= p ? 'none' : 'translateY(22px) scale(0.95)',
    transition: `opacity 0.85s ease ${d}s, transform 0.85s ease ${d}s`,
  });

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center text-center px-6"
      style={{ background: 'radial-gradient(ellipse at center, rgba(22,0,18,0.97) 0%, rgba(8,0,15,0.99) 100%)' }}>

      {/* Radial pink glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(255,0,128,0.13) 0%, transparent 70%)', animation: 'neon-pulse 1.8s ease-in-out infinite' }} />

      <div style={{ ...s(1), marginBottom: '2rem' }}>
        <HeartSVG size={165} color="#ff0080" glow={40} pulse />
      </div>

      <div style={{ maxWidth: '600px', zIndex: 1 }}>
        <div style={{ ...s(2), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(2rem,9vw,4.5rem)', fontWeight: 900, color: '#ffffff', textShadow: '0 0 30px #ff0080, 0 0 65px #ff0080, 0 0 110px #ff1493', lineHeight: 1.15, marginBottom: '1rem' }}>
          AAAAAND SHE SAID YES 🩷
        </div>
        <div style={{ ...s(3), fontFamily: "'Great Vibes',cursive", fontSize: 'clamp(1.8rem,6vw,3rem)', color: '#ff85c8', textShadow: '0 0 20px #ff0080', marginBottom: '1.6rem' }}>
          My pookie is still mine 😭🩷
        </div>
        <div style={{ ...s(4), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(1.8rem,6vw,3.5rem)', fontWeight: 700, color: '#ffffff', textShadow: '0 0 22px #ff0080', marginBottom: '1rem' }}>
          MALAIKA…
        </div>
        <div style={{ ...s(5), fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(1.05rem,3vw,1.45rem)', color: 'rgba(255,182,193,0.92)', lineHeight: 1.7, marginBottom: '1.8rem', letterSpacing: '0.05em' }}>
          YOU ARE SO, SO LOVED.
        </div>
        <div style={{ ...s(6), fontFamily: "'Great Vibes',cursive", fontSize: 'clamp(1.5rem,5vw,2.5rem)', color: '#ff69b4', textShadow: '0 0 16px #ff1493' }}>
          Forever yours — Taha Baloch 🩷
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function FinalScreen() {
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const ts = [
      setTimeout(() => setPh(1), 600),
      setTimeout(() => setPh(2), 2000),
      setTimeout(() => setPh(3), 3500),
      setTimeout(() => setPh(4), 5200),
      setTimeout(() => setPh(5), 6800),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  const s = (p: number, d = 0) => ({
    opacity: ph >= p ? 1 : 0,
    transform: ph >= p ? 'none' : 'translateY(22px)',
    transition: `opacity 1s ease ${d}s, transform 1s ease ${d}s`,
  });

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center text-center px-6"
      style={{ background: 'radial-gradient(ellipse at center, rgba(14,0,10,0.98) 0%, rgba(8,0,15,0.99) 100%)' }}>

      <div style={{ maxWidth: '540px' }}>
        <div style={{ ...s(1), marginBottom: '3rem' }}>
          <HeartSVG size={115} color="#ff0080" glow={28} pulse />
        </div>

        <p style={{ ...s(2), fontFamily: "'Great Vibes',cursive", fontSize: 'clamp(1.4rem,5vw,1.9rem)', color: 'rgba(255,133,200,0.72)', marginBottom: '0.7rem' }}>
          Before you leave…
        </p>

        <p style={{ ...s(3), fontFamily: "'Poppins',sans-serif", fontSize: '0.78rem', letterSpacing: '0.28em', color: 'rgba(255,182,193,0.55)', textTransform: 'uppercase', marginBottom: '2.8rem' }}>
          Remember this.
        </p>

        <p style={{ ...s(4), fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(0.95rem,3vw,1.15rem)', color: 'rgba(255,182,193,0.86)', lineHeight: 2, marginBottom: '2.5rem' }}>
          Somewhere in this world,<br />
          there is a TAHA BALOCH<br />
          who loves his MALAIKA<br />
          more than these words can explain.
        </p>

        <h2 style={{ ...s(5), fontFamily: "'Playfair Display',serif", fontSize: 'clamp(1.6rem,5vw,2.8rem)', fontWeight: 900, color: '#ffffff', textShadow: '0 0 20px #ff0080, 0 0 45px #ff1493', marginBottom: '2.2rem' }}>
          MY MRS. BALOCHNI 🩷
        </h2>

        {ph >= 5 && (
          <>
            <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: '1.15rem', color: 'rgba(255,105,180,0.48)', marginBottom: '0.4rem', animation: 'fade-in-up 1s ease' }}>
              Made only for you.
            </p>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: '0.78rem', letterSpacing: '0.18em', color: 'rgba(255,182,193,0.32)', animation: 'fade-in-up 1s ease 0.4s both' }}>
              — TAHA
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<AppState>('intro');
  const celRef = useRef(false);

  useEffect(() => { celRef.current = state === 'celebrating'; }, [state]);

  return (
    <div style={{ minHeight: '100vh', background: '#08000f', overflowX: 'hidden' }}>
      <HeartCanvas celebratingRef={celRef} />

      {state === 'intro' && <IntroScreen onEnter={() => setState('main')} />}
      {state === 'main' && <MainSections onYes={() => setState('celebrating')} />}
      {state === 'celebrating' && <CelebrationScreen onDone={() => setState('final')} />}
      {state === 'final' && <FinalScreen />}
    </div>
  );
}
