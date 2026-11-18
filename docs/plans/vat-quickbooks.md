# Plan: an official VAT report, and a monthly export for QuickBooks

**Status: plan only. Nothing has been built.** Written 18 Nov 2026 from what Zuri stores today and from KRA and Intuit pages (links at the end). Where the pages disagree, or I could not confirm something, it says so. Items marked **JERRY** are decisions only he can make. Items marked **ACCOUNTANT** need Zuri's accountant to confirm before anything is built.

## What Zuri already has (more than expected)

- **A VAT estimate card** already sits in Money → Friday report (`money.js`, `vatSummary`, v2.35). It takes last month and this month and shows: money in × 16/116 as VAT on sales (an *estimate*, because it assumes every price includes 16% VAT), VAT claimable (expenses with VAT and a supplier KRA PIN), VAT with no PIN (not claimable), and the net to pay, with the 20th-of-next-month due date.
- **A month CSV** already exists (`exportMonth`): expenses, other income, customer payments and cash counts in one file. It is a mixed report file. QuickBooks cannot import it as it stands.
- **On the money-in side:** `payments` (amount, date, area, method, `mpesa_ref`, payer name and phone, account reference, source), `cash_in`, and imported bank and M-Pesa statement lines.
- **On the money-out side:** `expenses` (amount, date, category, payee, paid-from, ref, `vat_amount`, `supplier_pin`, receipt photo, approval). Receipts are read by the AI helper, which already fills VAT and supplier PIN.
- **Company:** a company KRA PIN is stored in Admin → Company.

## What is missing, in one list

1. **Sales side:** no invoice per sale, no invoice number, no VAT rate per sale, no eTIMS link. VAT on sales is a guess from cash received, so it can include things that are not VATable sales (deposits, refunds, transfers).
2. **Purchases side:** the supplier PIN is captured, but not the supplier's invoice number, the eTIMS control-unit number, or the amount before VAT. KRA only allows input VAT on invoices that went through eTIMS, so a PIN alone is not enough.
3. **VAT categories:** no way to mark standard-rated, zero-rated or exempt.
4. **No customer KRA PIN** (business customers need it on the invoice).
5. **No QuickBooks-shaped file, and no mapping from Zuri's categories to a chart of accounts.**

## 1. The official VAT report

**What KRA expects (from the sources below):**
- A monthly VAT return on iTax, due on or before the 20th of the following month, with a nil return in months with no activity.
- Output VAT on sales minus input VAT on purchases gives tax payable or a credit.
- Sales on the return are pre-filled from eTIMS data and can only be increased, not reduced. Purchases can only be claimed from invoices validated through eTIMS.
- **I could not confirm** whether KRA now files only through the iTax web screens or still accepts the downloadable VAT3 Excel template. One August 2026 news item says web only; older guides say Excel. **ACCOUNTANT** should check the current iTax screen.

**What I would build:** a **VAT worksheet** that the accountant or Jerry reads while filling in the return. It would not file anything. It would show, for a chosen month:
- Sales by rate (16%, zero-rated, exempt), with value before VAT and output VAT.
- Purchases from suppliers, with value before VAT, input VAT, and a list of each invoice with supplier PIN, invoice number and eTIMS number.
- Purchases that cannot be claimed, and why (no PIN, no eTIMS number, waiting for approval).
- Net VAT payable or credit, and the due date.
- A CSV of both lists for checking against what KRA pre-fills.

**What I would change:**
- Receipt form: add supplier invoice number, eTIMS number, amount before VAT and a VAT category. The AI reading step is extended to fill them. (Size: **medium**, about a week.)
- Sales: stop estimating from cash. Take sales from customer invoices (see decision A). (Size: **small** if invoices come from outside Zuri, **large** if Zuri issues them.)
- The worksheet page and its CSV, replacing the estimate card. (Size: **medium**.)
- A customer KRA PIN field. (Size: **small**.)

**Decisions (JERRY):**
- **A. How do customer invoices reach eTIMS?** Zuri's billing runs through Billnasi. If Billnasi can issue eTIMS invoices, Zuri reads them and the sales work is small. If not, Zuri either has to issue them through a KRA-approved eTIMS integration, which is a large job, or Jerry uses a separate invoicing tool. **I do not know what Billnasi can do. Someone needs to ask them.**
- **B. Is Zuri VAT-registered, and are all packages standard-rated at 16%?** The existing card assumes yes to both. **ACCOUNTANT** to confirm, including whether any item is exempt or zero-rated.

## 2. The monthly export for QuickBooks

**Assumption: QuickBooks Online.** QuickBooks Desktop uses a different file type (IIF). **JERRY** to confirm which one Zuri uses.

**What QuickBooks Online accepts (Intuit pages below):**
- **Bank transactions:** a CSV with Date, Description and Amount (payments negative), or Date, Description, Credit and Debit. A header row, blank cells instead of zeros, and one file per account.
- **Other imports:** customers, vendors, chart of accounts, products and services, invoices, bills, expenses and sales receipts, from CSV or Excel. Intuit advises about 100 transactions per import, and imports cannot be undone in bulk.

**What I would build:** an **Export for QuickBooks** button beside the existing CSV, making a small set of files for the month:
1. **One bank-format file per money account** (M-Pesa Paybill, bank, cash). Columns: Date, Description, Amount. The description carries the M-Pesa code, then the payer name and the account reference. Customer payments are the money-in lines, expenses the money-out lines.
2. **An expenses file** for the accountant to import or keyboard from: Date, Payee, Category (mapped, see below), Amount, VAT, Supplier PIN, Reference, Paid from, Area.
3. **A sales summary file** with one line per day per area: Date, Area, Total received, VAT portion. A month of customer payments is likely to be hundreds of lines, which is over the size Intuit recommends per import. **Customer-level detail stays in Zuri and Billnasi.**

**How M-Pesa receipts map in:** `mpesa_ref` goes into the description (and the Ref column of the expenses file), so QuickBooks can match a bank-feed line to a payment. `payer_name` and `account_ref` go next to it. Paybill and Till fees are a separate expense line with category "M-Pesa and bank charges".

**What needs doing first (ACCOUNTANT):**
- The chart of accounts in QuickBooks, and a mapping from Zuri's expense categories to it (Zuri has a category list; the mapping is one table).
- The QuickBooks tax codes for 16% VAT, zero-rated, exempt and out of scope.
- Whether areas become QuickBooks classes or locations.

**Size:** the three files and the mapping screen are **medium** (about a week). A direct link to QuickBooks, with no files, would be **large** and I would not start there.

## Suggested order

1. Answer decisions A and B and confirm QuickBooks Online (Jerry, accountant, Billnasi). No code needed.
2. Receipt form changes, so purchases are captured properly from now on. This is the part that loses money if it waits, because VAT can only be claimed on invoices with the right details.
3. The VAT worksheet.
4. The QuickBooks export.

## Not verified

I did not log in to iTax, to Billnasi or to QuickBooks. KRA and Intuit pages were read through search results, and several are third-party guides.

## Sources

- KRA, [What is the auto populated VAT return?](https://www.kra.go.ke/helping-tax-payers/faqs/the-vat-auto-populated-return)
- KRA, [FAQs for the VAT autopopulated return](https://www.kra.go.ke/images/publications/FAQS-FOR-THE-VAT-AUTOPOPULATED-RETURN-090724.pdf)
- VAT Update, [KRA moves VAT filing to the direct iTax web system](https://www.vatupdate.com/2026/08/20/kra-moves-vat-filing-to-direct-itax-web-system/)
- Commenda, [Kenya VAT returns](https://www.commenda.io/kenya/vat-returns/)
- Intuit, [Format CSV files in Excel to get bank transactions into QuickBooks](https://quickbooks.intuit.com/learn-support/en-za/help-article/import-transactions/manually-upload-transactions-quickbooks-online/L4BjLWckq_ZA_en_ZA)
- Intuit, [Common questions about importing data to QuickBooks Online](https://quickbooks.intuit.com/learn-support/global/importing-and-exporting-data/common-questions-about-importing-data-to-quickbooks-online/00/385658)
