import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { DataTable, Section, StatusBadge } from "@/components/blocks";
import type { SocialRecon as Recon, SocialSummary } from "@/lib/data/summary";
import { fmtDate, fmtNum, fmtPct, truncate } from "@/lib/format";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/sources";
import { cn } from "@/lib/utils";

const label = (f: string) => FORMAT_LABEL[f] ?? f;
const platforms = (p: string) =>
  p
    .split(",")
    .map((x) => PLATFORM_LABEL[x] ?? x)
    .join(", ");

type Post = Recon["notInLog"][number];
type Log = Recon["logNotOnIg"][number];

function PostLink({ p }: { p: Post }) {
  const text = truncate(p.caption, 70) || "(no caption)";
  return p.permalink ? (
    <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
      {text}
    </a>
  ) : (
    text
  );
}

function LogTitle({ l }: { l: Log }) {
  const t = (l.title ?? "").replace(/\s+/g, " ").trim();
  return l.url ? (
    <a href={l.url.replace(/\s+/g, "")} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
      {truncate(t, 70) || l.url}
    </a>
  ) : (
    <>{truncate(t, 70) || "(untitled)"}</>
  );
}

function Group({ tone, title, hint, children }: { tone: "warn" | "info"; title: ReactNode; hint: ReactNode; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <div className="flex items-start gap-2 text-sm">
        <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warn" ? "text-warning" : "text-muted-foreground")} />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <ul className="ml-6 flex flex-col gap-1 text-sm">{children}</ul>
    </div>
  );
}

const Row = ({ date, children }: { date: string | null; children: ReactNode }) => (
  <li className="flex gap-3">
    <span className="num w-24 shrink-0 whitespace-nowrap text-muted-foreground">{fmtDate(date)}</span>
    <span className="min-w-0">{children}</span>
  </li>
);

/** Cek konsistensi Publishing Log vs post Instagram dari Meta API. */
export function SocialRecon({ r, stories }: { r: Recon; stories: SocialSummary["stories"] }) {
  const issues = r.formatMismatch.length + r.notInLog.length + r.logNotOnIg.length + r.duplicates.length;
  return (
    <Section
      title="Publishing Log vs Instagram check"
      subtitle={`Log rows with platform Instagram (excluding Stories) compared with posts from the Meta API${r.missingUrl ? ` · ${fmtNum(r.missingUrl)} log rows without a URL matched by title + date` : ""}`}
      action={issues ? <StatusBadge tone="warn">{fmtNum(issues)} to review</StatusBadge> : <StatusBadge tone="good">Matched</StatusBadge>}
    >
      <div className="flex flex-col gap-3">
        <DataTable
          rows={r.byFormat}
          columns={[
            { header: "Format on IG", cell: (x) => label(x.format) },
            {
              header: "Log",
              align: "right",
              cell: (x) => (
                <span className="whitespace-nowrap">
                  {fmtNum(x.log)}
                  {x.detail.length > 1 && <span className="text-muted-foreground"> ({x.detail.map((d) => `${fmtNum(d.count)} ${label(d.format)}`).join(" + ")})</span>}
                </span>
              ),
            },
            { header: "API", align: "right", cell: (x) => fmtNum(x.api) },
            {
              header: "Diff",
              align: "right",
              cell: (x) =>
                x.diff === 0 ? (
                  <CircleCheck className="ml-auto size-4 text-success" aria-label="matched" />
                ) : (
                  <span className="font-medium text-warning">{x.diff > 0 ? `+${fmtNum(x.diff)}` : fmtNum(x.diff)}</span>
                ),
            },
          ]}
        />

        {stories && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p>
                <span className="font-medium">Story:</span> {fmtNum(stories.log)} recorded in the log · {fmtNum(stories.ig)} posted on Instagram
                {stories.share != null && <span className="text-muted-foreground"> ({fmtPct(stories.share)} recorded)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Info only, not a KPI — Instagram Stories include reposts & every frame. The Story quota still comes from the Publishing Log.
                {stories.since && ` Stories before ${fmtDate(stories.since)} aren't recorded (the API only keeps active Stories) — import the Business Suite Story CSV to fill the gap.`}
              </p>
            </div>
          </div>
        )}

        {r.formatMismatch.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.formatMismatch.length)} possible wrong formats in the log`} hint="Title & date are similar, but the format in the log differs from what was posted on Instagram. Fix the format column in the Publishing Log.">
            {r.formatMismatch.map((x) => (
              <Row key={x.log.id} date={x.post.date}>
                <PostLink p={x.post} /> — log: <b>{label(x.log.format)}</b>, IG: <b>{label(x.post.format)}</b>
              </Row>
            ))}
          </Group>
        )}
        {r.notInLog.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.notInLog.length)} Instagram posts missing from the log`} hint="Still counted toward performance, but not toward the quota. Add them to the Publishing Log.">
            {r.notInLog.map((p) => (
              <Row key={p.id} date={p.date}>
                <PostLink p={p} /> <span className="text-muted-foreground">· {label(p.format)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.logNotOnIg.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.logNotOnIg.length)} log rows (platform Instagram) not found on Instagram`} hint="Not posted (yet), deleted, date off by >3 days, or wrong platform in the log. Still counted toward the quota.">
            {r.logNotOnIg.map((l) => (
              <Row key={l.id} date={l.date}>
                <LogTitle l={l} /> <span className="text-muted-foreground">· {label(l.format)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.duplicates.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.duplicates.reduce((a, g) => a + g.length, 0))} duplicate log rows (${fmtNum(r.duplicates.length)} titles)`} hint="Identical date, format & title. If they really are different pieces of content, give them distinct titles; if they're duplicates, delete them — otherwise the quota is double-counted.">
            {r.duplicates.map((g) => (
              <Row key={g[0].id} date={g[0].date}>
                <b>{fmtNum(g.length)}×</b> <LogTitle l={g[0]} /> <span className="text-muted-foreground">· {label(g[0].format)} · {platforms(g[0].platform)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.videoAsReels.length > 0 && (
          <Group tone="info" title={`${fmtNum(r.videoAsReels.length)} log Videos posted as Reels on Instagram`} hint="Expected — Instagram shows every video as a Reel. The dashboard keeps the log format (Video), separate from Reels.">
            {r.videoAsReels.map((x) => (
              <Row key={x.log.id} date={x.log.date}>
                <LogTitle l={x.log} /> → <PostLink p={x.post} />
              </Row>
            ))}
          </Group>
        )}
        {r.offInstagram.length > 0 && (
          <Group tone="info" title={`${fmtNum(r.offInstagram.length)} log items not posted to Instagram`} hint="Can't be checked through the Instagram API. Still counted toward the quota.">
            {r.offInstagram.map((l) => (
              <Row key={l.id} date={l.date}>
                <LogTitle l={l} /> <span className="text-muted-foreground">· {label(l.format)} · {platforms(l.platform)}</span>
              </Row>
            ))}
          </Group>
        )}
      </div>
    </Section>
  );
}
