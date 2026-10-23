import type { Cohort } from './shared';

// The workflow and allocation story around Spot the invoice errors: v3 is live, v4 is in the workflow.
// Sample data: the workflow is not stored yet.

export const STAGES = ['Draft', 'Dev', 'Test', 'Review', 'Published'];

/** One card per stage after Draft; card i+1 is current when `stage === i + 1`. */
export const STAGE_CARDS: { name: string; who: string; checks: [string, string, string][]; cta: string; secondary: string }[] = [
  { name: 'Dev', who: 'Demo Creator', checks: [['#86BC25', '12 invoices, 7 planted errors', ''], ['#86BC25', 'Every error linked to a passage', 'Invoice mandatory mentions.md · 7 of 7'], ['#86BC25', 'Content Domain linked', 'Belgian VAT · indexed 12 Oct']], cta: 'Send to test', secondary: 'Play as creator' },
  { name: 'Test', who: '3 testers invited', checks: [['#86BC25', 'Automated · grounding coverage 100%', 'target 90%'], ['#86BC25', 'Automated · answer key matches the invoices', '7 errors, 5 clean invoices'], ['#a0a69d', 'Testers · 0 of 3 played', 'Omar Haddad, Marie Dubois, Jonas Wouters']], cta: 'Submit for review', secondary: 'Invite tester' },
  { name: 'Review', who: 'Proof of concept · no review', checks: [['#a0a69d', 'Content written from the source document', ''], ['#a0a69d', 'Difficulty for Analysts', '']], cta: 'Approve and publish', secondary: 'Request changes' },
  { name: 'Publish', who: 'Allocates on publish', checks: [['#a0a69d', 'Version v4 replaces v3 for new starts', ''], ['#a0a69d', 'Reaches the cohorts and players on the right', '']], cta: 'Publish v4', secondary: 'Schedule' },
];

export const INITIAL_COHORTS: Record<Cohort, boolean> = { 'Analysts': true, 'Consultants': true, 'Seniors': false, 'Indirect tax': true, 'Brussels': false, 'Antwerp': false, 'New joiners 2026': true };

/** Individually allocated players count on top of the cohorts. */
export const INDIVIDUAL_PLAYERS = ['Lena Peeters', 'Omar Haddad'];
