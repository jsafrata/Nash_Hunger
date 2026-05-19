import Link from "next/link";
import { tutorialContent, type TutorialMedia } from "./content";

function MediaSlot({ media }: { media: TutorialMedia }) {
  if (media.src) {
    return (
      <div className="min-h-[260px] overflow-hidden rounded-xl border border-line bg-[#0f131b]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.src}
          alt={media.alt}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-[#0f131b] p-6">
      <div className="absolute left-3.5 top-3.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-accent">
        {media.label}
      </div>
      <div className="max-w-md text-center space-y-2">
        <div className="text-lg font-semibold text-text">{media.label}</div>
        <p className="text-sm leading-relaxed text-muted">{media.placeholder}</p>
      </div>
    </div>
  );
}

export default function TutorialPage() {
  const { hero, quickStart, rules, sections, tips } = tutorialContent;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="section-title">Tutorial</div>
            <Link href="/" className="btn-ghost text-xs">
              Back to home
            </Link>
          </div>

          <div className="max-w-3xl">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-accent sm:text-4xl">
              {hero.title}
            </h1>
            <p className="mb-3 text-lg leading-relaxed text-text">
              {hero.subtitle}
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              {hero.summary}
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card p-6" id="quick-start">
            <div className="section-title mb-3">{quickStart.title}</div>
            <ol className="space-y-3">
              {quickStart.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs font-bold text-accent">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-text">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-6">
            <div className="section-title mb-3">{rules.title}</div>
            <ul className="space-y-2">
              {rules.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <span className="mt-2 h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                  <p className="text-sm leading-relaxed text-text">{bullet}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="screen-tour" className="space-y-4">
          {sections.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="card grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="space-y-4">
                <div>
                  <div className="section-title mb-2">{section.eyebrow}</div>
                  <h2 className="mb-3 text-2xl font-bold tracking-tight">
                    {section.title}
                  </h2>
                </div>

                <div className="space-y-3">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-relaxed text-text"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets?.length ? (
                  <ul className="space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5">
                        <span className="mt-2 h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                        <p className="text-sm leading-relaxed text-text">
                          {bullet}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {section.callout ? (
                  <div className="rounded-[10px] border border-accent/20 bg-accent/10 px-3.5 py-3 text-[13px] leading-6 text-[#f2dfb0]">
                    {section.callout}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {section.media ? <MediaSlot media={section.media} /> : null}
              </div>
            </article>
          ))}
        </section>

        <section className="card p-6">
          <div className="section-title mb-3">{tips.title}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {tips.items.map((item) => (
              <div key={item} className="card-elevated p-4">
                <p className="text-sm leading-relaxed text-text">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
