<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { splitTicket, type Problem } from '#lib/kb/split';

  // issues: problem → where its own ticket lives.
  // status: problem → what engineering decided (from the desk's update).
  let {
    ticket,
    issues,
    labels,
    status = {},
  }: {
    ticket: number;
    issues: Partial<Record<Problem, string>>;
    labels: Partial<Record<Problem, string>>;
    status?: Partial<Record<Problem, string>>;
  } = $props();

  const split = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  const mistagged = $derived(split.groups.reduce((n, g) => n + g.mistagged, 0));
  const count = (p: Problem) => split.groups.find((g) => g.problem === p)?.reports.length ?? 0;
  const untagged = $derived(split.groups.filter((g) => g.problem === 'one-day').reduce((n, g) => n + g.reports.length, 0));
</script>

<p class="sum">
  <strong>{split.merged.length}</strong> reports in #{ticket} ({split.rows} export rows, {split.rows - split.merged.length} of them repeats) ·
  <strong>{split.groups.length}</strong> problems
</p>

<table>
  <thead><tr><th>problem</th><th>reports</th><th>tenants</th><th>seen</th><th>status</th><th>ticket</th></tr></thead>
  <tbody>
    {#each split.groups as g (g.problem)}
      <tr>
        <td><code>{g.problem}</code><br /><span class="what">{labels[g.problem] ?? ''}</span></td>
        <td>{g.reports.length}</td>
        <td>{g.tenants}</td>
        <td>{g.firstSeen} → {g.lastSeen}</td>
        <td class:open={!status[g.problem] || status[g.problem] === 'open'}>{status[g.problem] ?? 'open'}</td>
        <td>{#if issues[g.problem]}<a href={issues[g.problem]}>{issues[g.problem]?.replace(/^.*\/issues\//, 'issue ')}</a>{:else}none yet{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

<p class="note">
  Intake's tag is wrong on <strong>{mistagged}</strong> of {split.merged.length} reports.
  Intake has no tag for <code>one-day</code>, so it tagged those {untagged} as something else.
  The desk's own table files those {untagged} under <code>parser</code> by tenant, so the parser ticket counts
  {count('parser') + count('one-day')}.
</p>

<style>
  .sum { font-size: 1.1rem; }
  .what { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .open { color: var(--warn); font-weight: 600; }
</style>
