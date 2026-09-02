# Shipt Analyzer

> **For a detailed case study on this project, please see the [Shipt Analyzer Portfolio](shipt_analyzer_portfolio.md).**

---

This is a standalone web application built to optimize profitability for Shipt shoppers. The tool uses the Anthropic Claude API to analyze order screenshots, applies a custom scoring algorithm to rank opportunities based on their true hourly pay rate, and uses historical data to predict tips.

### Architecture

```
Analyzer (single HTML file)
    │  changed orders, day bonuses, deletions
    ▼
Google Sheets  ──  Apps Script webhook
    │  Orders sheet · Bonuses sheet · Summary
    ▼
Supabase  ──  Edge Functions
    │  add-order · delete-order · sync-bonuses · get-tip-history
    ▼
Analyzer  ──  scoring uses full history, not just this device
```

### Key Features
*   **AI-Powered Data Extraction:** Uses an LLM to read and structure data from raw images.
*   **Customizable Scoring Algorithm:** Moves beyond simple pay to calculate an effective hourly rate.
*   **"Tip Intelligence":** Learns from past order data to favor historically high-tipping jobs. A store or region must have at least five confirmed tips before it can move a score.
*   **Intelligent Batching:** Identifies cost-saving, custom batch opportunities using a grid map instead of a paid API.
*   **Batch Offers as One Job:** A two-stop batch stays one order, one timer, and one row, with each stop's tip recorded separately so both destinations train tip intelligence independently.
*   **Shop-Time Tracking:** Per-order start/stop timers with live counters, producing an *actual* hourly rate measured from real runs rather than an estimate. Overlapping runs are merged, so orders shopped together never bill the same hour twice.
*   **Day Bonuses:** Promo pay that isn't tied to a single order — shift bonuses, order-count challenges, peak pay — is tracked separately so it counts toward earnings without distorting per-store tip averages.
*   **Cloud-Synced Tip Intelligence:** Order history flows through Google Sheets into Supabase, so scoring draws on every order ever synced instead of only what a single browser happens to hold.
*   **Incremental Sync:** Only orders whose synced fields actually changed are uploaded, keeping a routine save to a single request rather than a full re-upload of every order ever claimed.

### Challenges Solved
*   **Tuned a Naive Weighting:** Scoring leaned hardest on base pay, but real order data showed tips drove nearly half my income, so Tip Intel was reweighted.
*   **Re-architected for Scale:** Migrated data storage from fragile browser local storage to a Google Sheets database, then to Supabase for durable, device-independent history.
*   **Diagnosed a Silent Pipeline:** Sheet syncing is fire-and-forget and reports success regardless of outcome. Isolated a failure by reasoning about *which* services received the write and which didn't.
*   **Fixed a Sync That Scaled Badly:** Every save re-uploaded the entire order history, one HTTP round-trip per order. Replaced it with a per-row fingerprint that sends only genuine changes.
*   **Chose a Confidence Threshold From Data:** Queried the real tip distribution rather than guessing, and found every threshold from four to ten behaved identically against current history.
*   **Secured a Public Repo:** The browser holds a database key, so tables run Row Level Security with no policies and all access goes through server-side Edge Functions.

### Security Notes

No credentials are committed. The Claude API key, Apps Script URL, and Supabase project URL and publishable key are entered in the app's Settings tab and stored in browser local storage.

The `orders` and `bonuses` tables have Row Level Security enabled with no policies, so the publishable key cannot read or write them directly. All Edge Functions use the service role key server-side. The service role key exists only as an Apps Script property and never reaches the browser.

### Setup

Run the SQL files in `supabase/` in order via the Supabase SQL Editor, deploy the four functions in `supabase/functions/`, then paste `google-apps-script/Code.gs` into an Apps Script project bound to your sheet and deploy it as a web app. Add the resulting URL and your keys in the analyzer's Settings tab.

Apps Script changes require three separate steps, and skipping any one fails silently: save the script, deploy a **new version** of the existing deployment rather than a new deployment, and re-copy the URL into Settings.
