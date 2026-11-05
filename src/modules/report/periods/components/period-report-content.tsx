"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Loader2, Presentation } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/blocks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum, fmtPct } from "@/modules/shared/lib/format";
import { periodDate } from "../lib/period";
import type { PeriodPost, PeriodReportJob, PeriodReportPage } from "../types/period-report";

const num = (n: number | null) => n == null ? "n/a" : fmtNum(n);
const captured = (p: PeriodPost | null) => p?.capturedOn ? `Metrics captured ${periodDate(p.capturedOn)}` : "No snapshot captured within this period";

export function PeriodReportContent({ page }: { page: PeriodReportPage }) {
  const { data: d, periods, jobs, googleConnected, templateUrl } = page;
  const router = useRouter();
  const [caseId, setCaseId] = useState(d.caseStudy?.postId ?? "");
  const [organic, setOrganic] = useState(false);
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ run: PeriodReportJob; chartDataUrl: string | null } | null>(null);
  const candidates = d.caseCandidates;
  const selected = candidates.find((p) => p.postId === caseId) ?? d.caseStudy;
  const ready = googleConnected && !d.blockedReasons.length;
  const generate = async () => {
    if (busy) return;
    if (!!target !== !!deadline) { setError("Enter both a follower target and a target date, or leave both empty."); return; }
    setError(null); setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/reports/periods/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ period: d.period.number, casePostId: selected?.postId, organic, ...(target ? { followerTarget: Number(target), targetDate: deadline } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.run?.error || "The report could not be generated. Please try again.");
      setResult(body);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); router.refresh(); }
  };
  const latest = result?.run ?? jobs.find((r) => r.status === "success");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Period Reports" description="Instagram reports for four full calendar months" actions={
        <Select value={String(d.period.number)} onValueChange={(v) => router.push(`/report/periods?p=${v}`)} disabled={busy}>
          <SelectTrigger className="w-full sm:w-96" aria-label="Select report period"><SelectValue /></SelectTrigger>
          <SelectContent>{periods.map((p) => <SelectItem key={p.number} value={String(p.number)}>{p.label}{!p.complete ? " · in progress" : ""}</SelectItem>)}</SelectContent>
        </Select>
      } />
      <nav className="flex gap-2" aria-label="Report type">
        <Button variant="ghost" size="sm" asChild><Link href="/report">Monthly Reports</Link></Button>
        <Button variant="secondary" size="sm" asChild><Link href={`/report/periods?p=${d.period.number}`}>Period Reports</Link></Button>
      </nav>
      <Section title={d.period.label} subtitle={`Reporting window ${periodDate(d.period.startDate)} to ${periodDate(d.period.endDate)}`} action={<Badge variant={ready ? "outline" : "secondary"}>{!googleConnected ? "Connect Google first" : d.blockedReasons.length ? "In progress or missing data" : "Ready to generate"}</Badge>}>
        <p className="text-sm text-muted-foreground">Account totals cover the four months below. Post metrics use the snapshot dated {periodDate(d.postSnapshotDate)}. Missing snapshot metrics stay n/a. Stories count towards the publishing quota.</p>
      </Section>
      {d.postSnapshotDate !== d.period.endDate && <Alert><AlertDescription>Post metrics use the {periodDate(d.postSnapshotDate)} snapshot, not {periodDate(d.period.endDate)}. They may include views and other activity after the reporting period. Account totals and follower balances still cover {d.period.rangeLabel}.</AlertDescription></Alert>}
      {d.blockedReasons.length > 0 && <Alert><AlertDescription><ul className="list-disc space-y-1 pl-4">{d.blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></AlertDescription></Alert>}
      {!googleConnected && <Alert><AlertDescription>Connect Google Sheets in <Link className="underline" href="/settings/connectors">Settings</Link> and grant permission to create report files.</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Followers at period end", num(d.closingFollowers), d.followersEstimated ? "Estimate from recorded follow activity" : "Recorded balance"],
          ["Net follows", num(d.netFollows), `${d.period.days} days in this period`],
          ["Account views", num(d.views), "Includes Stories and older posts"],
          ["Published posts", num(d.published), `Period quota ${num(d.quota)}`],
        ].map(([title, value, note]) => <Card key={title}><CardHeader><CardDescription>{title}</CardDescription><CardTitle className="num text-3xl">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{note}</CardContent></Card>)}
      </div>
      <Section title="Monthly data" subtitle="The same account totals and publishing counts used by the dashboard">
        <Table><TableHeader><TableRow>{["Month", "Views", "Followers", "Published", "Stories", "Quota", "Data"].map((x, i) => <TableHead key={x} className={i && i < 6 ? "text-right" : ""}>{x}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{d.months.map((m) => <TableRow key={m.month}>
            <TableCell>{m.label}</TableCell><TableCell className="num text-right">{num(m.views)}</TableCell><TableCell className="num text-right">{num(m.followers.followers)}{m.followers.basis === "estimate" ? "*" : ""}</TableCell>
            <TableCell className="num text-right">{num(m.published)}</TableCell><TableCell className="num text-right">{num(m.stories)}</TableCell><TableCell className="num text-right">{num(m.quota)}</TableCell>
            <TableCell><Badge variant="outline">{!m.hasAccountData ? "Missing" : m.locked ? "Locked" : "Not locked"}</Badge></TableCell>
          </TableRow>)}</TableBody></Table>
        <p className="mt-3 text-xs text-muted-foreground">* Estimated follower balance. Monthly reach is not added together because the same account can appear in several months.</p>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Case study" subtitle="Choose from this period's top 10 posts by views">
          <Label htmlFor="period-case">Instagram post</Label>
          <Select value={selected?.postId ?? ""} onValueChange={setCaseId} disabled={busy || !candidates.length}>
            <SelectTrigger id="period-case" className="mt-2 w-full"><SelectValue placeholder="No eligible post" /></SelectTrigger>
            <SelectContent>{candidates.map((p) => <SelectItem key={p.postId} value={p.postId}>{p.title} · {periodDate(p.date)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="mt-4 space-y-3">
            {selected ? <>
              <p className="text-sm text-muted-foreground">Published <time dateTime={selected.date}>{periodDate(selected.date)}</time></p>
              <p className="text-xs text-muted-foreground">{captured(selected)}</p>
            </> : <p className="text-sm text-muted-foreground">No post views captured on {periodDate(d.postSnapshotDate)}. Top posts and the case study will show n/a.{!d.blockedReasons.length && " You can still generate the report with the available account totals."}</p>}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Views", selected?.views ?? null], ["Reach", selected?.reach ?? null], ["Profile visits", selected?.profileVisits ?? null], ["Follows", selected?.follows ?? null]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="num font-medium">{num(value as number | null)}</dd></div>)}</dl>
            {selected && <>
              <p className="text-xs text-muted-foreground">Likes {num(selected.likes)} · Comments {num(selected.comments)} · Shares {num(selected.shares)} · Saves {num(selected.saves)}</p>
              <p className="text-xs text-muted-foreground">{selected.followsCsv ? `Follows use lifetime CSV counts ${selected.followsCsv.observedOn ? `exported ${periodDate(selected.followsCsv.observedOn)}` : `uploaded ${periodDate(selected.followsCsv.importedOn)} (export date unknown)`}. Other metrics retain the snapshot above.` : "Missing metrics stay n/a in the report."}</p>
            </>}
          </div>
        </Section>
        <Section title="Next follower goal" subtitle="Optional recommendation for the next period">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="period-target">Follower target</Label><Input id="period-target" type="number" min="1" max="1000000000" step="1" value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-2"><Label htmlFor="period-deadline">Target date</Label><Input id="period-deadline" type="date" value={deadline} min={new Date(Date.parse(d.period.endDate) + 864e5).toISOString().slice(0, 10)} disabled={busy} onChange={(e) => setDeadline(e.target.value)} /></div>
          </div>
          <label className="mt-5 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={organic} disabled={busy} onChange={(e) => setOrganic(e.target.checked)} /><span>This period had no paid ads or boosted posts.<span className="mt-1 block text-xs text-muted-foreground">Confirm this to label the report as 100% organic.</span></span></label>
        </Section>
      </div>
      {d.warnings.length > 0 && <Section title="Data notes"><ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">{d.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></Section>}
      <Section title="Generate report" subtitle="Creates a new editable Google Slides deck, its own chart data, and a PDF">
        {error && <Alert variant="destructive" className="mb-4"><AlertDescription role="alert">{error}</AlertDescription></Alert>}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!ready || busy} onClick={generate}>{busy ? <Loader2 className="animate-spin" /> : <Presentation />}{busy ? "Generating report…" : "Generate Google Slides + PDF"}</Button>
          <Button variant="ghost" asChild><a href={templateUrl} target="_blank" rel="noreferrer"><ExternalLink /> View master</a></Button>
          {latest?.url && <Button variant="outline" asChild><a href={latest.url} target="_blank" rel="noreferrer"><Presentation /> Open deck</a></Button>}
          {latest?.pdfUrl && <Button variant="outline" asChild><a href={latest.pdfUrl} target="_blank" rel="noreferrer"><FileText /> PDF</a></Button>}
          {result?.chartDataUrl && <Button variant="ghost" asChild><a href={result.chartDataUrl} target="_blank" rel="noreferrer"><ExternalLink /> Chart data</a></Button>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Generated files are snapshots. Generating again creates a new report and keeps the earlier files.</p>
      </Section>
      <Section title="Report history">
        {jobs.length ? <Table><TableHeader><TableRow><TableHead>Generated</TableHead><TableHead>Status</TableHead><TableHead>Files</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>
          {jobs.map((job, i) => <TableRow key={`${job.createdAt}-${i}`}><TableCell>{new Date(job.createdAt).toLocaleString("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}</TableCell><TableCell><Badge variant={job.status === "success" ? "outline" : "destructive"}>{job.status === "success" ? "Ready" : "Failed"}</Badge></TableCell><TableCell><div className="flex gap-3">{job.status === "success" && job.url && <a className="underline" href={job.url} target="_blank" rel="noreferrer">Slides</a>}{job.status === "success" && job.pdfUrl && <a className="underline" href={job.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}</div></TableCell><TableCell className="max-w-lg whitespace-pre-line text-xs text-muted-foreground">{job.error || job.warnings || "No data warnings"}</TableCell></TableRow>)}
        </TableBody></Table> : <p className="text-sm text-muted-foreground">No reports have been generated from the dashboard for this period yet.</p>}
      </Section>
      <p className="text-xs text-muted-foreground">Profile visits {num(d.profileVisits)} · Bio link taps {num(d.linkTaps)} · Tap rate {d.linkTapRate == null ? "n/a" : fmtPct(d.linkTapRate)}</p>
    </div>
  );
}
