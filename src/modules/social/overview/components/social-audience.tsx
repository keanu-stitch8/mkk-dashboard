import { ChartCard } from "@/components/ChartCard";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { fmtDate, fmtNum, fmtPct } from "@/modules/shared/lib/format";
import { monthLabel } from "@/modules/shared/lib/month";
import type { FollowerPoint, SocialAudience } from "../types/social-audience";

const basisNote = (p: FollowerPoint) =>
  p.followers == null ? undefined : p.asOf ? `As of ${fmtDate(p.asOf)}` : p.basis === "estimate" ? "Estimate — counted back from follows − unfollows" : "Measured at month end";

/** Followers per akhir bulan + insight akun tambahan IG (profile visits, link bio, porsi non-follower). */
export function SocialAudienceSection({ month, audience }: { month: string; audience: SocialAudience }) {
  const { followers: f, prevFollowers: pf, discovery: d, prevDiscovery: pd, series } = audience;
  const prevComparable = pf?.followers != null && f.followers != null && !f.asOf;
  const estimates = series.filter((p) => p.basis === "estimate").map((p) => p.label);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Section
        title="Audience & discovery"
        subtitle={`Instagram account insights during ${monthLabel(month)} (per period) · includes Stories & older posts still seen this month`}
        className="lg:col-span-2"
      >
        <KpiGrid cols={4}>
          <KpiCard
            label={f.asOf ? "Followers" : "Followers · month end"}
            value={fmtNum(f.followers)}
            cur={prevComparable ? f.followers : null}
            prev={prevComparable ? pf!.followers : null}
            note={basisNote(f)}
            hint="Meta only gives the current follower total, so the dashboard saves it daily. Earlier month ends are counted back from account follows − unfollows (Meta's definition; the Instagram app's net figure can differ slightly)."
          />
          <KpiCard
            label="Net follows"
            value={fmtNum(f.net)}
            cur={f.net}
            prev={f.asOf ? null : pf?.net}
            partial={!!f.asOf}
            hint="New follows − unfollows to the account during this month."
          />
          <KpiCard
            label="Profile visits"
            value={fmtNum(d?.profileVisits)}
            cur={d?.profileVisits}
            prev={pd?.profileVisits}
            hint={'Visits to the Instagram profile ("Profile visits" in the app).'}
          />
          <KpiCard
            label="Bio link taps"
            value={fmtNum(d?.linkTaps)}
            cur={d?.linkTaps}
            prev={pd?.linkTaps}
            hint={'Taps on the link in bio ("Bio link taps" in the app) — the step before a website session from Instagram.'}
          />
          <KpiCard
            label="Views from non-followers"
            value={fmtPct(d?.views?.nonFollowerShare)}
            cur={d?.views?.nonFollowerShare}
            prev={pd?.views?.nonFollowerShare}
            kind="rate"
            note={d?.views ? `${fmtNum(d.views.nonFollower)} of ${fmtNum(d.views.follower + d.views.nonFollower + d.views.unknown)} views` : undefined}
            hint="Share of account views from accounts that don't follow MKK — how far content reaches beyond the existing audience."
          />
          <KpiCard
            label="Reach from non-followers"
            value={fmtPct(d?.reach?.nonFollowerShare)}
            cur={d?.reach?.nonFollowerShare}
            prev={pd?.reach?.nonFollowerShare}
            kind="rate"
            note={d?.reach ? `${fmtNum(d.reach.nonFollower)} accounts` : undefined}
            hint="Unique accounts reached that don't follow MKK. Meta caps unique reach at 30 days, so 31-day months only cover the first 30 days."
          />
          <KpiCard
            label="Follows per 1K views"
            value={fmtNum(d?.followsPer1kViews, 1)}
            cur={d?.followsPer1kViews}
            prev={pd?.followsPer1kViews}
            hint="New follows ÷ account views × 1,000 — how well views convert into followers."
          />
          <KpiCard label="Reposts" value={fmtNum(d?.reposts)} cur={d?.reposts} prev={pd?.reposts} hint="Times MKK content was reposted to other accounts' profiles." />
        </KpiGrid>
        {d && (
          <p className="mt-3 text-xs text-muted-foreground">
            Account interactions: likes {fmtNum(d.likes)} · comments {fmtNum(d.comments)} · shares {fmtNum(d.shares)} · saves {fmtNum(d.saves)} — during this month, including older
            posts & Stories (so they differ from the per-post totals).
          </p>
        )}
        {!d && <p className="mt-3 text-xs text-muted-foreground">Profile visits, link taps & the follower split are filled by the next Meta sync.</p>}
      </Section>
      <ChartCard
        title="Followers · month end"
        description={estimates.length ? `Estimates: ${estimates.join(", ")} — counted back from follows − unfollows` : undefined}
        data={series.map((p) => ({ label: p.label, followers: p.followers }))}
        series={[{ key: "followers", name: "Followers" }]}
      />
    </div>
  );
}
