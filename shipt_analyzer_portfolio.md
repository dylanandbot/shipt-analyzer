# Shipt Analyzer: A Portfolio Case Study

---

### **Executive Summary**

This document details a web application I built to optimize my profitability as a Shipt shopper. The tool uses the Anthropic Claude API to analyze order screenshots, applies a custom scoring algorithm to rank opportunities based on their true hourly pay rate, and uses historical data to predict tips. The project demonstrates a full workflow from raw data input to intelligent, data-driven decision-making.

**Key Features:**
*   **AI-Powered Data Extraction:** Uses an LLM to read and structure data from raw images.
*   **Customizable Scoring Algorithm:** Moves beyond simple pay to calculate an effective hourly rate.
*   **"Tip Intelligence":** Learns from past order data to favor historically high-tipping jobs.
*   **Intelligent Batching:** Identifies cost-saving, custom batch opportunities by estimating on a grid map instead of a paid map API.
*   **Persistent Data Backend:** Offloads data to Google Sheets for scalable, long-term analysis.
*   **Shop-Time Tracking:** Per-order timers measure how long jobs actually take, replacing an estimated hourly rate with a real one.
*   **Cloud-Synced Tip Intelligence:** Order history flows into Supabase, so scoring uses every order ever synced rather than only what one browser holds.

**Challenges I Solved:**
*   **Tuned a Naive Weighting:** Scoring leaned hardest on base pay, but real order data showed tips drove nearly half my income, so I reweighted it.
*   **Re-architected for Scale:** Migrated data storage from fragile browser local storage to a robust Google Sheets database, then to Supabase for durable, device-independent history.
*   **Debugged a Silently Failing Pipeline:** Traced a sync bug across three services where the app reported success no matter what actually happened.
*   **Secured a Public Repository:** Designed key handling and database access rules so a public repo and a browser-held key expose nothing.

---

## 1. The Problem: Maximizing Profitability in the Gig Economy

As a Shipt shopper, the goal is to maximize profits. However, profitability isn't as simple as just accepting the highest-paying orders. True efficiency comes from calculating the pay rate relative to the time commitment, or dollars per hour. Manually calculating this for every potential order—while factoring in variables like distance, number of items, and potential tips—is time-consuming and prone to error, especially when good orders are claimed in seconds.

After tracking my first 25 orders with the analyzer, I discovered a notable statistic: tips accounted for nearly 50% of my total income. This meant that simply chasing high base pay was not the best strategy. I had built tip learning into the tool on a hunch. The data showed I needed to trust it far more than my own intuition.

## 2. What I Built: A Smart Order Analysis & Decision Support Tool
To solve this, I built a standalone web application that serves as a personal dashboard for Shipt shopping. The workflow is simple: I take screenshots of available orders from the Shipt app and upload them to the analyzer. The tool then processes the images, scores the orders, and presents a clear, data-driven recommendation for each one (e.g. "Take": 65+, "Skip":<40).

Once an order is analyzed, the workflow continues within the app. I can mark an order as "Claimed," which automatically moves it to the "Pending Tips" tab. This section serves as a queue for completed orders where the final tip, which can arrive days or weeks later, has not yet been logged. The system also allows for manual data correction at any stage. This is crucial for fixing occasional text recognition errors from the image analysis, such as distinguishing between two locations of the same store (e.g., ensuring "Target" is correctly logged as "Target South"). This ensures the data feeding the Tip Intelligence feature is as accurate as possible.

The application is a single HTML file with vanilla JavaScript, making it fast, portable, and easy to maintain. It uses the browser's local storage for settings and live state, syncs completed order data to Google Sheets, and pushes from there into a Supabase database that feeds tip predictions back into scoring.

**Key Features:**

*   **AI-Powered Data Extraction:** The tool uses the Anthropic Claude API to read text from the screenshots, instantly converting unstructured image data into structured information (pay, items, time, distance).

*   **Custom Scoring Algorithm:** Each order is graded on a 100-point scale based on a custom formula that prioritizes the effective hourly rate. The result is a simple, color-coded verdict: **Take** (65+), **Maybe** (40-64), or **Skip** (<40).

*   **Intelligent Batching:** To avoid paying for a maps API, I had the API estimate when addresses or streets were close together given that my shopping area (Lincoln, NE) was built on an almost perfect grid map. The analyzer uses this to identify when two separate orders are close enough to be batched together, suggesting custom, high-efficiency batches that the official app might miss (e.g. 48th Street is only 2 blocks away from 46th Street).

*   **Tip Intelligence:** The app learns from past performance. After completing an order, I can log the final tip amount. The analyzer uses this historical data to add bonus points to future orders from historically high-tipping stores or neighborhoods, further optimizing my decision-making.

*   **Persistent Data & Dashboarding:** All claimed order data, including tips and bonuses, is saved in browser storage and feeds the "Stats" tab. Because browser storage is limited and disposable, that data also syncs outward to a Google Sheet, which serves as a personal database for insights about my shopping region over time.

*   **Actual vs. Estimated Hourly Rate:** Every claimed order gets its own start/stop timer with a live counter, and orders run independently so a batch of three can be timed separately. The original hourly figure was an estimate derived from item count and distance. This measures what the job actually took. The gap between the two is the most useful number the tool produces, because it reveals which stores are slow in ways an offer screen never shows.

*   **Cloud-Synced Tip Intelligence:** Tip history lives in Supabase rather than only in the browser. Claimed orders flow to Google Sheets via Apps Script, an Edge Function writes them to Postgres, and a second Edge Function returns aggregated tip averages by store and region that the analyzer pulls in before scoring. Tip intelligence now reflects my entire history instead of whatever a single device happens to be holding.

## 3. Proof: The Workflow in Action

The process is designed to be fast and efficient, turning raw screenshots into actionable recommendations in seconds.

### Step 1: Raw Input

First, I capture screenshots of the available orders directly from the Shipt app.

<p align="center">
      <img src="shipt_analyzer_assets/01_input_order.png" alt="A screenshot of a Shipt order offer, showing pay, location, and item details." width="600">
      <br>
      <em>(Note: Customer's address and specific location have been redacted for privacy.)</em>
    </p>
    
### Step 2: Upload

Next, I drop the raw screenshots into the analyzer's upload area.

<p align="center">
  <img src="shipt_analyzer_assets/02_analyzer_before.png" alt="The Shipt Analyzer interface before analysis, showing a drag-and-drop zone for images." width="600">
</p>

### Step 3: Analysis & Recommendation

The tool calls the Claude API to parse the images and then runs the data through the scoring algorithm. The results are displayed as neatly organized cards with clear "Take," "Maybe," or "Skip" verdicts.

<p align="center">
  <img src="shipt_analyzer_assets/03_analyzer_after.png" alt="The Shipt Analyzer interface after analysis, displaying ranked order cards with scores and recommendations." width="600">
</p>

### Step 4: Claim & Track

Once an order is claimed in the app, it moves to the "Pending Tips" tab. This screen tracks completed jobs for which a tip has not yet been received, allowing for easy updates once the final pay is known.

<p align="center">
  <img src="shipt_analyzer_assets/04_pending_tips.png" alt="A screenshot of the Pending Tips tab, showing a list of claimed orders awaiting final tip information." width="600">
</p>

### Step 5: Time the Run

Claimed orders appear in the "Active" tab, where each one has its own Start Run and Stop Run control and a live timer. Orders are timed independently, so shopping three at once produces three separate durations rather than one blended figure. A counter in the header shows how many orders are active at a glance.

<p align="center">
  <img src="shipt_analyzer_assets/09_active_orders.jpg" alt="The Active tab, showing claimed orders with individual live run timers and start/stop controls." width="600">
</p>

### Step 6: Data Tracking

Finally, all completed and updated orders are synced to Google Sheets and on into Supabase, and the analyzer's "Stats" tab provides a dashboard view of key performance indicators, including actual hourly rate calculated from measured shop time.
<p align="center">
  <img src="shipt_analyzer_assets/05_stats_page.png" alt="The Stats page of the Shipt Analyzer, showing various metrics like Total Earned, Hourly Rate, and Tip Rate." width="600">
</p>

## 4. Challenges & How I Solved Them

Building the analyzer involved several iterations and learning opportunities. Five challenges stood out, and the later ones had less to do with writing code than with diagnosing systems that gave me almost no feedback about what they were doing.

### Challenge 1: Refining the Scoring System

**The Problem:** The initial scoring algorithm was too simplistic and tended to rate most orders as "high value." This was not effective for distinguishing between a good order and a *great* one, as most offers on the platform need to have some base level of appeal to be taken at all.

**The Solution:** The scoring system is user-configurable, with settings that let me define my personal profitability targets (e.g., minimum pay, max distance, target $/hour). After my first weeks of data, I tuned these: I raised my minimum pay and lowered my max distance so fewer mediocre orders get rated as "high value". The biggest change was the "Tip Intelligence" weight. Based on my finding that tips were 50% of my income, I increased this weight to a 4 out of 5, causing the algorithm to favor orders from stores, neighborhoods, and customers with a proven history of high tips. This tuning transformed the analyzer from a simple calculator into a strategic tool.

One thing I realized later: raising the "Tip Intelligence" weight lowered the bar for stores to hit the tip bonus cap rather than letting great stores outscore decent ones. With the cap at 15 points, a decent tipper and an excellent one both maxed out and scored identically, which defeated the purpose of weighting tips heavily in the first place. I raised the cap to 30 so the bonus has room to discriminate again, and I am running with that before tuning it further.

*Below are the settings I configured to fine-tune the algorithm and connect the tool's services based on my real-world experience.*
<p align="center">
  <img src="shipt_analyzer_assets/06_settings_main_api.png" alt="A screenshot of the main Settings page, showing fields for the Claude API Key and Google Apps Script URL." width="600">
  <br>
  <em>Image: The main settings page for connecting to the Claude API and Google Sheets.</em>
</p>
<p align="center">
  <img src="shipt_analyzer_assets/07_settings_scoring.png" alt="A screenshot of the Scoring Settings tab with updated values, including a higher minimum pay and hourly target." width="600">
  <br>
  <em>Image: Updated scoring parameters to reflect a more selective strategy.</em>
</p>
<p align="center">
  <img src="shipt_analyzer_assets/08_settings_intel_batch.png" alt="A screenshot of the combined Tip Intelligence and Batching settings." width="600">
  <br>
  <em>Image: Settings for the Tip Intelligence and custom Batching features.</em>
</p>

### Challenge 2: Scalable Data Storage

**The Problem:** The first version of the analyzer stored all order history in the browser's local storage. I quickly realized this was not a scalable solution. It limited the amount of data that could be saved, made it difficult to access the data for external analysis, and risked data loss if the browser cache was cleared.

**The Solution:** I re-architected the data backend to use Google Sheets. I wrote a simple Google Apps Script that acts as a webhook. Now, when I claim an order in the analyzer, the data is sent to the script and instantly appended as a new row in a designated Google Sheet. This provides a robust, persistent, and easily accessible database for all my order history, allowing for deeper insights and long-term trend analysis directly within the spreadsheet.

Google Sheets solved durability, but not availability. The spreadsheet was somewhere my data *rested*; the analyzer still scored orders using only the history in the browser it happened to be running in. So I extended the pipeline into Supabase. Apps Script now writes each order to a Postgres table through an Edge Function, and a second Edge Function returns tip averages aggregated by store and region.

Two details mattered more than I expected. Tip lookups match on store and region rather than exact address, because addresses are read by AI from screenshots and vary character by character, so exact matching almost never hits. And local and remote histories merge by taking whichever has seen more orders rather than summing them, since Supabase already contains the locally stored orders and summing would double count every one.

<p align="center">
  <img src="shipt_analyzer_assets/10_settings_supabase.jpg" alt="The Supabase settings card in the analyzer, showing fields for the project URL and publishable key plus a connection test." width="600">
  <br>
  <em>Image: Supabase connection settings, with credentials entered at runtime rather than committed to the repository.</em>
</p>

### Challenge 3: A Bug That Looked Like Broken Code

**The Problem:** I rebuilt the Active tab to give each order its own timer, and the new code did nothing at all. The tab rendered the old layout as though my changes had never been saved.

**The Solution:** The cause was JavaScript function hoisting. An older version of `renderActiveOrders` still existed further down the file, and because function declarations are hoisted, the *later* definition silently replaced the new one at load time. No error, no warning, just the old behavior.

The lesson was diagnostic rather than syntactic. The symptom pointed at "my new code isn't running" when the reality was "there are two definitions and the wrong one wins." Now, before editing this file, I search for every identifier I am about to change and confirm it is defined exactly once.

### Challenge 4: Debugging a Pipeline That Fails Silently

**The Problem:** After deploying the Supabase integration, an order reached the database but never appeared in the Google Sheet. Both writes happen in the same sync, so partial success made no obvious sense.

**The Solution:** The sheet sync posts with `no-cors`, which means the browser cannot read the response. The app reports success whether the write landed or not, so there was no error to read anywhere in the UI.

What made it solvable was the *order* of operations. The script sends each row to Supabase first, then writes it to the sheet. So "Supabase yes, sheet no" localized the fault precisely: the sheet write threw an exception after the Supabase call had already succeeded. That narrowed it to a version mismatch, since the analyzer had begun sending eighteen columns to a script still deployed with fourteen.

The root cause was an Apps Script deployment subtlety. Creating a "New deployment" mints a new URL, while the previous one stays live serving the old code. I had been faithfully deploying new versions to a URL nothing was calling.

I now treat any pipeline that cannot report its own failures as requiring an external source of truth. The count of stores in synced history, visible in Settings, is what I check to confirm a sync actually worked. Not the success message.

### Challenge 5: Securing a Public Repository

**The Problem:** Moving to Supabase meant the browser needed a database key, and this repository is public. A key committed to source, or a table left open, would expose my entire order history to anyone who found it.

**The Solution:** No credentials appear in the repository. The Claude API key, Apps Script URL, and Supabase URL and publishable key are entered in the Settings tab at runtime and held in browser local storage.

That alone is not enough, because the publishable key still reaches the browser and could be read from it. So the `orders` table has Row Level Security enabled with no policies at all, which means that key can neither read nor write it. Every legitimate operation goes through an Edge Function using the service role key, which lives only as an Apps Script property on Google's servers and never touches the client.

I verified this rather than assuming it: requesting the table directly with the publishable key returns an empty array, against a table holding seventy-eight rows.

## 5. View the Code

The complete code for this single-page application is available on GitHub.

[**dylanandbot/shipt-analyzer**](https://github.com/dylanandbot/shipt-analyzer)
