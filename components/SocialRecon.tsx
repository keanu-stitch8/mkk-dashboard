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
  const text = truncate(p.caption, 70) || "(tanpa caption)";
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
    <>{truncate(t, 70) || "(tanpa judul)"}</>
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
      title="Cek Publishing Log vs Instagram"
      subtitle={`Baris log berplatform Instagram (tanpa Stories) dibanding post dari Meta API${r.missingUrl ? ` · ${fmtNum(r.missingUrl)} baris log tanpa URL dicocokkan lewat judul + tanggal` : ""}`}
      action={issues ? <StatusBadge tone="warn">{fmtNum(issues)} perlu dicek</StatusBadge> : <StatusBadge tone="good">Cocok</StatusBadge>}
    >
      <div className="flex flex-col gap-3">
        <DataTable
          rows={r.byFormat}
          columns={[
            { header: "Format di IG", cell: (x) => label(x.format) },
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
              header: "Selisih",
              align: "right",
              cell: (x) =>
                x.diff === 0 ? (
                  <CircleCheck className="ml-auto size-4 text-success" aria-label="cocok" />
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
                <span className="font-medium">Story:</span> {fmtNum(stories.log)} tercatat di log · {fmtNum(stories.ig)} tayang di Instagram
                {stories.share != null && <span className="text-muted-foreground"> ({fmtPct(stories.share)} tercatat)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Hanya info, bukan KPI — Story di Instagram termasuk repost & tiap frame. Kuota Story tetap dari Publishing Log.
                {stories.since && ` Story sebelum ${fmtDate(stories.since)} belum tercatat (API hanya menyimpan Story yang masih aktif) — import CSV Story Business Suite untuk melengkapi.`}
              </p>
            </div>
          </div>
        )}

        {r.formatMismatch.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.formatMismatch.length)} kemungkinan format salah di log`} hint="Judul & tanggal mirip, tapi format di log berbeda dengan yang tayang di Instagram. Perbaiki kolom format di Publishing Log.">
            {r.formatMismatch.map((x) => (
              <Row key={x.log.id} date={x.post.date}>
                <PostLink p={x.post} /> — log: <b>{label(x.log.format)}</b>, IG: <b>{label(x.post.format)}</b>
              </Row>
            ))}
          </Group>
        )}
        {r.notInLog.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.notInLog.length)} post Instagram tidak tercatat di log`} hint="Tetap dihitung ke performa, tapi tidak ke kuota. Tambahkan ke Publishing Log.">
            {r.notInLog.map((p) => (
              <Row key={p.id} date={p.date}>
                <PostLink p={p} /> <span className="text-muted-foreground">· {label(p.format)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.logNotOnIg.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.logNotOnIg.length)} baris log (platform Instagram) tidak ditemukan di Instagram`} hint="Belum/tidak jadi diposting, sudah dihapus, tanggal meleset >3 hari, atau platform di log salah. Tetap dihitung ke kuota.">
            {r.logNotOnIg.map((l) => (
              <Row key={l.id} date={l.date}>
                <LogTitle l={l} /> <span className="text-muted-foreground">· {label(l.format)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.duplicates.length > 0 && (
          <Group tone="warn" title={`${fmtNum(r.duplicates.reduce((a, g) => a + g.length, 0))} baris log kembar (${fmtNum(r.duplicates.length)} judul)`} hint="Tanggal, format & judul sama persis. Jika memang konten berbeda, bedakan judulnya; jika duplikat, hapus — kuota ikut terhitung dobel.">
            {r.duplicates.map((g) => (
              <Row key={g[0].id} date={g[0].date}>
                <b>{fmtNum(g.length)}×</b> <LogTitle l={g[0]} /> <span className="text-muted-foreground">· {label(g[0].format)} · {platforms(g[0].platform)}</span>
              </Row>
            ))}
          </Group>
        )}
        {r.videoAsReels.length > 0 && (
          <Group tone="info" title={`${fmtNum(r.videoAsReels.length)} Video di log tayang sebagai Reels di Instagram`} hint="Wajar — Instagram menampilkan semua video sebagai Reels. Dashboard tetap memakai format dari log (Video), terpisah dari Reels.">
            {r.videoAsReels.map((x) => (
              <Row key={x.log.id} date={x.log.date}>
                <LogTitle l={x.log} /> → <PostLink p={x.post} />
              </Row>
            ))}
          </Group>
        )}
        {r.offInstagram.length > 0 && (
          <Group tone="info" title={`${fmtNum(r.offInstagram.length)} konten di log tidak diposting ke Instagram`} hint="Tidak bisa dicek lewat API Instagram. Tetap dihitung ke kuota.">
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
