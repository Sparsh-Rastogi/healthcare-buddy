import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Pill,
  Plus,
  Loader2,
  Bot,
  HeartPulse,
  MessageCircle,
  TrendingUp,
  ClipboardList,
  CalendarHeart,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Star,
  Activity,
  Brain,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { useLocalState, KEYS, uid, readLS, writeLS } from "@/lib/storage";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/brand";
import type { ActivityItem, LogEntry, LogMetric, Medication, Profile, Severity } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildActivityPrompt, chatCompletion, getApiKey } from "@/lib/groq";
import { vitalsApi, complianceApi, agentApi, BaymaxApiError } from "@/lib/baymax-api";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/")(  {
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Your Caring Health Companion` },
      { name: "description", content: APP_DESCRIPTION },
    ],
  }),
  component: RootIndexPage,
});

function RootIndexPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LandingPage />;
  return <HomePage />;
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-root min-h-screen bg-[oklch(0.97_0.012_220)] text-foreground overflow-x-hidden">
      {/* Ambient background blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/20 via-sky-300/15 to-transparent blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-sky-200/20 via-primary/10 to-transparent blur-3xl animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-tl from-primary/10 via-sky-100/15 to-transparent blur-3xl animate-[pulse_12s_ease-in-out_infinite_4s]" />
      </div>

      <div className="relative z-10">
        <LandingNav scrolled={scrolled} />
        <HeroSection />
        <LogoStripSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function LandingNav({ scrolled }: { scrolled: boolean }) {
  return (
    <nav
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-primary/10 shadow-sm"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/25 to-sky-300/30 text-primary shadow-sm">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-bold text-lg tracking-tight text-foreground">{APP_NAME}</span>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" className="rounded-xl text-sm font-medium" id="landing-signin-btn">
              Sign in
            </Button>
          </Link>
          <Link to="/login">
            <Button
              className="rounded-xl text-sm font-semibold px-5 shadow-sm bg-gradient-to-r from-primary to-sky-500 hover:from-primary/90 hover:to-sky-500/90 text-white border-0"
              id="landing-getstarted-btn"
            >
              Get started free
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative pt-20 pb-32 px-4 sm:px-6 text-center" id="hero">
      {/* Pill badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-[fadeInDown_0.6s_ease_both]">
        <Sparkles className="h-3 w-3" />
        AI-Powered Health Tracking
      </div>

      <h1 className="mx-auto max-w-3xl text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-foreground animate-[fadeInUp_0.7s_ease_both]">
        Your health,{" "}
        <span className="relative">
          <span className="bg-gradient-to-r from-primary via-sky-500 to-primary bg-clip-text text-transparent">
            brilliantly
          </span>{" "}
        </span>
        tracked
      </h1>

      <p className="mt-6 mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed animate-[fadeInUp_0.8s_ease_both]">
        {APP_DESCRIPTION} Get personalised insights, medication reminders, and a caring AI companion — all in one place.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-[fadeInUp_0.9s_ease_both]">
        <Link to="/login">
          <Button
            size="lg"
            className="rounded-2xl text-base px-8 py-6 font-semibold shadow-lg bg-gradient-to-r from-primary to-sky-500 hover:from-primary/90 hover:to-sky-500/90 text-white border-0 transition-transform hover:scale-[1.02]"
            id="hero-cta-primary"
          >
            Start for free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
        <Link to="/login">
          <Button
            size="lg"
            variant="outline"
            className="rounded-2xl text-base px-8 py-6 font-semibold border-primary/20 hover:bg-primary/5 transition-transform hover:scale-[1.02]"
            id="hero-cta-demo"
          >
            Try the demo
          </Button>
        </Link>
      </div>

      {/* Hero visual — Floating dashboard card mockup */}
      <div className="mt-20 mx-auto max-w-3xl animate-[fadeInUp_1s_ease_both]">
        <div className="relative rounded-3xl bg-white/60 backdrop-blur-sm border border-primary/10 shadow-2xl shadow-primary/10 p-6 sm:p-8">
          {/* Simulated header bar */}
          <div className="flex items-center gap-2 mb-6">
            <span className="w-3 h-3 rounded-full bg-destructive/60" />
            <span className="w-3 h-3 rounded-full bg-warning/60" />
            <span className="w-3 h-3 rounded-full bg-chart-1/60" />
            <div className="ml-4 flex-1 h-5 rounded-full bg-muted/60 max-w-xs" />
          </div>
          {/* Simulated welcome banner */}
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-sky-50/80 to-primary/5 border border-primary/10 p-4 mb-4 text-left">
            <p className="text-xs text-muted-foreground">Good morning, Alex 👋</p>
            <p className="text-sm font-semibold mt-0.5 text-foreground">Baymax is keeping an eye on your health today</p>
          </div>
          {/* Simulated metric cards row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Heart Rate", val: "72 bpm", icon: <HeartPulse className="h-4 w-4 text-rose-400" />, color: "bg-rose-50 border-rose-100" },
              { label: "Blood Glucose", val: "98 mg/dL", icon: <Activity className="h-4 w-4 text-primary" />, color: "bg-primary/5 border-primary/10" },
              { label: "Meds Today", val: "2 / 3", icon: <Pill className="h-4 w-4 text-sky-500" />, color: "bg-sky-50 border-sky-100" },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-xl border p-3 text-left", item.color)}>
                <div className="mb-1">{item.icon}</div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-bold text-foreground">{item.val}</p>
              </div>
            ))}
          </div>
          {/* Simulated chat bubble */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 text-left">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary/20 to-sky-200/40 text-primary flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">Baymax: </span>Your blood pressure trend looks stable this week — great work staying consistent with your evening walks! 💙
            </p>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="mt-12 flex justify-center animate-[bounce_2s_ease-in-out_infinite]">
        <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </section>
  );
}

// ── Trust strip ───────────────────────────────────────────────────────────────

function LogoStripSection() {
  const items = [
    { icon: <ShieldCheck className="h-4 w-4" />, label: "Privacy-first" },
    { icon: <Zap className="h-4 w-4" />, label: "Real-time insights" },
    { icon: <Brain className="h-4 w-4" />, label: "AI-powered" },
    { icon: <Star className="h-4 w-4" />, label: "Free to start" },
    { icon: <HeartPulse className="h-4 w-4" />, label: "Always caring" },
  ];

  return (
    <section className="py-8 border-y border-primary/10 bg-white/40 backdrop-blur-sm" id="trust-strip">
      <div className="mx-auto max-w-5xl px-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span className="text-primary">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: "Chat with Baymax",
    desc: "Ask anything about your health, meds, or vitals. Baymax gives warm, personalised answers — like a knowledgeable friend.",
    color: "from-primary/15 to-sky-200/20",
    iconColor: "text-primary",
  },
  {
    icon: <Pill className="h-6 w-6" />,
    title: "Medication Tracking",
    desc: "Never miss a dose. Track all your medications with dosage, timing, and one-tap \"mark as taken\" logging.",
    color: "from-sky-100/50 to-primary/10",
    iconColor: "text-sky-600",
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: "Vitals & Trends",
    desc: "Monitor blood pressure, glucose, heart rate, weight, and more. See beautiful trend charts over time.",
    color: "from-chart-1/15 to-chart-2/10",
    iconColor: "text-[oklch(0.62_0.07_160)]",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Visit Summaries",
    desc: "Prepare for doctor appointments with AI-generated visit summaries based on your recent health data.",
    color: "from-info/30 to-sky-50/40",
    iconColor: "text-[oklch(0.35_0.08_240)]",
  },
  {
    icon: <CalendarHeart className="h-6 w-6" />,
    title: "Period Tracker",
    desc: "Log cycles, symptoms, and moods. Baymax helps you understand your patterns with compassionate insights.",
    color: "from-rose/40 to-rose/10",
    iconColor: "text-[oklch(0.4_0.1_15)]",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Smart Activity Feed",
    desc: "Baymax proactively surfaces patterns it notices — from medication compliance to unusual vital readings.",
    color: "from-warning/25 to-warning/5",
    iconColor: "text-[oklch(0.4_0.1_60)]",
  },
];

function FeaturesSection() {
  return (
    <section className="py-24 px-4 sm:px-6" id="features">
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            Everything you need
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Health tracking,{" "}
            <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">reimagined</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Baymax brings together everything you need to stay on top of your health — beautifully designed and effortlessly simple.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative rounded-3xl border border-white/60 bg-white/50 backdrop-blur-sm p-6 transition-all duration-300 cursor-default group",
        hovered ? "shadow-xl shadow-primary/10 -translate-y-1 border-primary/20" : "shadow-md shadow-black/5",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110", feature.color, feature.iconColor)}>
        {feature.icon}
      </div>
      <h3 className="font-bold text-base text-foreground mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up in seconds — no credit card needed. Start with a demo or connect your email.",
    icon: <Bot className="h-7 w-7" />,
  },
  {
    step: "02",
    title: "Tell Baymax about yourself",
    desc: "Complete a quick onboarding to add your conditions, medications, and the vitals you want to track.",
    icon: <ClipboardList className="h-7 w-7" />,
  },
  {
    step: "03",
    title: "Your health, on autopilot",
    desc: "Log daily with one tap. Baymax analyses patterns, surfaces insights, and keeps you informed effortlessly.",
    icon: <Sparkles className="h-7 w-7" />,
  },
];

function HowItWorksSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-white/30" id="how-it-works">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            Simple by design
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Up and running in{" "}
            <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">minutes</span>
          </h2>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div aria-hidden className="hidden lg:block absolute top-16 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-4">
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-sky-200/30 border border-primary/15 flex items-center justify-center text-primary shadow-md shadow-primary/10">
                  {s.icon}
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "Baymax helped me realise my blood pressure spikes every Monday morning. Once I saw the pattern, I could actually do something about it.",
    author: "Sarah K.",
    role: "Managing hypertension since 2022",
  },
  {
    quote: "I forget to take my meds all the time. Having everything in one place with a caring AI checking in has genuinely changed my routine.",
    author: "Rohan M.",
    role: "Type 2 diabetes patient",
  },
  {
    quote: "The visit summary feature is incredible. I walked into my last appointment fully prepared — my doctor was impressed.",
    author: "Priya S.",
    role: "Cardiology follow-up patient",
  },
];

function TestimonialsSection() {
  return (
    <section className="py-24 px-4 sm:px-6" id="testimonials">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            Real stories
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            People love{" "}
            <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">Baymax</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="rounded-3xl bg-white/60 backdrop-blur-sm border border-white/80 p-6 shadow-md shadow-black/5 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-5">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-sky-200/40 flex items-center justify-center text-primary font-bold text-sm">
                  {t.author[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="py-24 px-4 sm:px-6" id="cta">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-sky-500 to-primary/80 p-12 sm:p-16 text-center shadow-2xl shadow-primary/30">
          {/* Decorative blobs inside card */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          </div>

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white/90 text-xs font-semibold mb-6">
              <HeartPulse className="h-3 w-3" />
              Your health deserves the best
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Start your health journey<br />with Baymax today
            </h2>
            <p className="mt-4 text-white/80 text-lg max-w-xl mx-auto">
              Free to use. No credit card required. Your data stays private.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login">
                <Button
                  size="lg"
                  className="rounded-2xl text-base px-8 py-6 font-semibold bg-white text-primary hover:bg-white/90 shadow-lg border-0 transition-transform hover:scale-[1.02]"
                  id="cta-getstarted-btn"
                >
                  Get started — it's free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-2xl text-base px-8 py-6 font-semibold bg-transparent text-white border-white/40 hover:bg-white/10 transition-transform hover:scale-[1.02]"
                  id="cta-demo-btn"
                >
                  Try demo first
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-primary/10 bg-white/40 backdrop-blur-sm py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-sky-300/30 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <span className="font-bold text-foreground">{APP_NAME}</span>
        </div>
        <p className="text-xs text-muted-foreground text-center sm:text-right">
          {APP_TAGLINE} · &copy; {new Date().getFullYear()} Baymax · Built with ❤️ for your health
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-primary transition-colors">Sign in</Link>
          <Link to="/login" className="hover:text-primary transition-colors">Get started</Link>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE (dashboard — existing, for authenticated users)
// ─────────────────────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate();
  const [onboarded] = useLocalState<boolean>(KEYS.onboarded, false);
  useEffect(() => {
    if (!onboarded) navigate({ to: "/onboarding" });
  }, [onboarded, navigate]);
  if (!onboarded) return null;

  return (
    <div className="space-y-6 pb-24">
      <WelcomeBanner />
      <section>
        <h2 className="text-lg font-semibold mb-3">Today's medications</h2>
        <MedicationsSection />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">Today's logs</h2>
        <LogsSection />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">What Baymax noticed today</h2>
        <ActivitySection />
      </section>
    </div>
  );
}

function WelcomeBanner() {
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  const name = profile?.name?.split(" ")[0];
  return (
    <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-sky-50/80 to-primary/5 border border-primary/10 p-4 soft-shadow">
      <p className="text-sm text-muted-foreground">Good to see you{name ? `, ${name}` : ""}</p>
      <h1 className="text-xl font-semibold mt-0.5">Baymax is keeping an eye on your health today</h1>
    </div>
  );
}

function MedicationsSection() {
  const [meds] = useLocalState<Medication[]>(KEYS.meds, []);
  const [entries, setEntries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const today = todayISO();
  const takenIds = useMemo(
    () => new Set(entries.filter((e) => e.date === today && e.metricId.startsWith("med:")).map((e) => e.metricId.slice(4))),
    [entries, today],
  );

  if (meds.length === 0)
    return <EmptyState title="No medications yet" description="Add medications in Settings to see them here." icon={<Pill className="h-5 w-5" />} />;

  const markTaken = (m: Medication) => {
    const id = uid();
    setEntries((prev) => [
      ...prev,
      { id, metricId: `med:${m.id}`, date: today, timestamp: Date.now(), value: "taken" },
    ]);
    toast.success(`Marked ${m.name} as taken`, {
      action: {
        label: "Undo",
        onClick: () => setEntries((prev) => prev.filter((e) => e.id !== id)),
      },
    });
    complianceApi.log({ measure: m.name, completed: true }).catch(() => {});
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {meds.map((m) => {
        const taken = takenIds.has(m.id);
        return (
          <Card key={m.id} className={cn("transition-opacity", taken && "opacity-60 bg-muted")}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Pill className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.dosage} · {m.time}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={taken ? "secondary" : "default"}
                disabled={taken}
                onClick={() => markTaken(m)}
              >
                {taken ? "✓ Taken" : "Mark taken"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LogsSection() {
  const [metrics, setMetrics] = useLocalState<LogMetric[]>(KEYS.metrics, []);
  const [entries, setEntries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const [active, setActive] = useState<LogMetric | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const today = todayISO();

  const todaysEntries = useMemo(() => {
    const map = new Map<string, LogEntry>();
    entries
      .filter((e) => e.date === today && !e.metricId.startsWith("med:"))
      .forEach((e) => map.set(e.metricId, e));
    return map;
  }, [entries, today]);

  if (metrics.length === 0)
    return (
      <EmptyState
        title="No logs scheduled"
        description="Add tracking metrics in Settings to see them here."
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Custom Log Metric</Button>}
      />
    );

  return (
    <div className="space-y-2">
      {metrics.map((m) => {
        const entry = todaysEntries.get(m.id);
        return (
          <button
            key={m.id}
            onClick={() => setActive(m)}
            className={cn(
              "w-full text-left bg-card rounded-xl border p-3.5 flex items-center justify-between soft-shadow transition",
              entry ? "border-primary/30" : "hover:bg-muted/50",
            )}
          >
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.frequency} · {m.time} · {m.unit}</div>
            </div>
            <div className="text-sm">
              {entry ? (
                <span className="font-medium text-primary">{entry.value} {m.unit !== "text" && m.unit}</span>
              ) : (
                <span className="text-muted-foreground">Tap to log</span>
              )}
            </div>
          </button>
        );
      })}
      <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4" /> Add Custom Log Metric
      </Button>

      <LogValueSheet
        metric={active}
        onClose={() => setActive(null)}
        onSave={(value, note) => {
          if (!active) return;
          const entry = { id: uid(), metricId: active.id, date: today, timestamp: Date.now(), value, note };
          setEntries((prev) => [
            ...prev.filter((e) => !(e.metricId === active.id && e.date === today)),
            entry,
          ]);
          setActive(null);
          toast.success(`Logged ${active.name}`);
          // ── Backend sync (fire-and-forget) ──────────────────────────────────
          const numVal = parseFloat(value);
          const metricName = active.name.toLowerCase();
          const vitalsPayload: Record<string, number | string | null> = {};
          if (!isNaN(numVal)) {
            if (metricName.includes("systolic")) vitalsPayload.systolic_bp = numVal;
            else if (metricName.includes("diastolic")) vitalsPayload.diastolic_bp = numVal;
            else if (metricName.includes("heart") || metricName.includes("pulse")) vitalsPayload.heart_rate = numVal;
            else if (metricName.includes("glucose") || metricName.includes("sugar")) vitalsPayload.blood_glucose = numVal;
            else if (metricName.includes("weight")) vitalsPayload.weight = numVal;
            else if (metricName.includes("temp")) vitalsPayload.temperature = numVal;
            else if (metricName.includes("spo2") || metricName.includes("oxygen")) vitalsPayload.spo2 = numVal;
            else vitalsPayload.notes = `${active.name}: ${value} ${active.unit}`;
          } else {
            vitalsPayload.notes = `${active.name}: ${value}`;
          }
          vitalsApi.log(vitalsPayload as any).catch((err: unknown) => {
            if (!(err instanceof TypeError)) console.warn("[BayMax] Vitals sync:", err);
          });
          // Also log compliance if it looks like a medication
          if (metricName.includes("med") || active.unit === "taken") {
            complianceApi.log({ measure: active.name, completed: true }).catch(() => {});
          }
        }}
      />

      <AddMetricSheet
        open={showAdd}
        onOpenChange={setShowAdd}
        onCreate={(metric) => {
          setMetrics((prev) => [...prev, metric]);
          setShowAdd(false);
          setActive(metric);
        }}
      />
    </div>
  );
}

function LogValueSheet({
  metric,
  onClose,
  onSave,
}: {
  metric: LogMetric | null;
  onClose: () => void;
  onSave: (value: string, note?: string) => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    setValue("");
    setNote("");
  }, [metric?.id]);
  return (
    <Sheet open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{metric?.name}</SheetTitle>
        </SheetHeader>
        {metric && (
          <div className="p-4 space-y-3">
            <div>
              <Label>Value ({metric.unit})</Label>
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`e.g. ${metric.unit === "text" ? "Feeling steady" : "120"}`}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <SheetFooter>
              <Button onClick={() => value.trim() && onSave(value.trim(), note.trim() || undefined)} disabled={!value.trim()}>
                Save log
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddMetricSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (m: LogMetric) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [freq, setFreq] = useState<LogMetric["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  useEffect(() => {
    if (open) {
      setName("");
      setUnit("");
      setFreq("daily");
      setTime("09:00");
    }
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>New tracking metric</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Water intake" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml, mg, 1-10..." />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as LogMetric["frequency"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SheetFooter>
            <Button
              disabled={!name.trim() || !unit.trim()}
              onClick={() => onCreate({ id: uid(), name: name.trim(), unit: unit.trim(), frequency: freq, time, source: "custom" })}
            >
              Create &amp; log now
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

function ActivitySection() {
  const [activity, setActivity] = useLocalState<ActivityItem[]>(KEYS.activity, []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lastRun = readLS<number>("activityRun", 0);
    if (Date.now() - lastRun < 1000 * 60 * 60) return;

    setLoading(true);

    // ── Attempt 1: Pull from backend agent logs ──────────────────────────────
    agentApi.logs(1)
      .then(({ logs }) => {
        if (logs.length > 0) {
          const items: ActivityItem[] = logs.slice(0, 5).map((log) => ({
            id: log.id,
            date: log.timestamp.slice(0, 10),
            title: log.action.replace(/_/g, " "),
            body: log.reasoning ?? "",
            severity: log.severity as Severity,
          }));
          setActivity(items);
          writeLS("activityRun", Date.now());
          return true;
        }
        return false;
      })
      .catch(() => false)
      .then((handled) => {
        if (handled) { setLoading(false); return; }
        // ── Attempt 2: Direct Groq fallback ───────────────────────────────────
        const meds = readLS<Medication[]>(KEYS.meds, []);
        const entries = readLS<LogEntry[]>(KEYS.entries, []);
        if (!getApiKey() || meds.length === 0) { setLoading(false); return; }
        const recent = entries.slice(-30);
        chatCompletion({
          messages: buildActivityPrompt({ meds, recentEntries: recent }),
          temperature: 0.2,
        })
          .then((text) => {
            try {
              const cleaned = text.replace(/```json|```/g, "").trim();
              const arr = JSON.parse(cleaned) as { title: string; body: string; severity: Severity }[];
              const items: ActivityItem[] = arr.slice(0, 5).map((a) => ({
                id: uid(),
                date: todayISO(),
                title: a.title,
                body: a.body,
                severity: a.severity,
              }));
              setActivity(items);
              writeLS("activityRun", Date.now());
            } catch { /* ignore parse errors */ }
          })
          .catch(() => undefined)
          .finally(() => setLoading(false));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && activity.length === 0)
    return (
      <div className="rounded-2xl bg-card border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your recent data…
      </div>
    );

  if (activity.length === 0)
    return <EmptyState title="All calm today" description="Baymax hasn't spotted anything that needs your attention." />;

  return (
    <ul className="space-y-2">
      {activity.map((a) => (
        <li key={a.id} className="rounded-xl bg-card border p-3.5 soft-shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{a.body}</div>
            </div>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SEV_STYLE[a.severity])}>
              {a.severity}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
