# Shipt Analyzer

> **For a detailed case study on this project, please see the [Shipt Analyzer Portfolio](shipt_analyzer_portfolio.md).**

---

This is a standalone web application built to optimize profitability for Shipt shoppers. The tool uses the Anthropic Claude API to analyze order screenshots, applies a custom scoring algorithm to rank opportunities based on their true hourly pay rate, and uses historical data to predict tips.

### Architecture

```
Analyzer (single HTML file)
    │  claimed orders + confirmed tips
    ▼
Google Sheets  ──  Apps Script webhook
    │  one row per order
    ▼
Supabase  ──  Edge Functions (add-order, get-tip-history)
    │  aggregated tip history by store and region
    ▼
Analyzer  ──  scoring uses full history, not just this device
```

### Key Features
*   **AI-Powered Data Extraction:** Uses an LLM to read and structure data from raw images.
*   **Customizable Scoring Algorithm:** Moves beyond simple pay to calculate an effective hourly rate.
*   **"Tip Intelligence":** Learns from past order data to favor historically high-tipping jobs.
*   **Intelligent Batching:** Identifies cost-saving, custom batch opportunities using a grid map instead of a paid API.
*   **Shop-Time Tracking:** Per-order start/stop timers with live counters, producing an *actual* hourly rate measured from real runs rather than an estimate.
*   **Cloud-Synced Tip Intelligence:** Order history flows through Google Sheets into Supabase, so scoring draws on every order ever synced instead of only what a single browser happens to hold.

### Challenges Solved
*   **Tuned a Naive Weighting:** Scoring leaned hardest on base pay, but real order data showed tips drove nearly half my income, so Tip Intel was reweighted.
*   **Re-architected for Scale:** Migrated data storage from fragile browser local storage to a Google Sheets database, then to Supabase for durable, device-independent history.
*   **Diagnosed a Silent Pipeline:** Sheet syncing is fire-and-forget and reports success regardless of outcome. Isolated a failure by reasoning about *which* services received the write and which didn't.
*   **Secured a Public Repo:** The browser now holds a database key, so the table runs Row Level Security with no policies and all access goes through server-side Edge Functions.

### Security Notes

No credentials are committed. The Claude API key, Apps Script URL, and Supabase project URL and publishable key are entered in the app's Settings tab and stored in browser local storage.

The `orders` table has Row Level Security enabled with no policies, so the publishable key cannot read or write it directly. Both Edge Functions use the service role key server-side. The service role key exists only as an Apps Script property and never reaches the browser.
