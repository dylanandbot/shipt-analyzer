# Shipt Analyzer

> **For a detailed case study on this project, please see the [Shipt Analyzer Portfolio](shipt_analyzer_portfolio.md).**

---

This is a standalone web application built to optimize profitability for Shipt shoppers. The tool uses the Anthropic Claude API to analyze order screenshots, applies a custom scoring algorithm to rank opportunities based on their true hourly pay rate, and uses historical data to predict tips.

### Key Features
*   **AI-Powered Data Extraction:** Uses an LLM to read and structure data from raw images.
*   **Customizable Scoring Algorithm:** Moves beyond simple pay to calculate an effective hourly rate.
*   **"Tip Intelligence":** Learns from past order data to favor historically high-tipping jobs.
*   **Intelligent Batching:** Identifies cost-saving, custom batch opportunities using a grid map instead of a paid API.
*   **Persistent Data Backend:** Offloads data to Google Sheets for scalable, long-term analysis.

### Challenges Solved
*   **Tuned a Naive Weighting:** Scoring leaned hardest on base pay, but real order data showed tips drove nearly half my income, so Tip Intel was reweighted.
*   **Re-architected for Scale:** Migrated data storage from fragile browser local storage to a robust Google Sheets database.
