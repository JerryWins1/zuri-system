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

**Settled 18 Nov by Jerry: QuickBooks Desktop** (not Online). That changes the file type. The earlier version of this plan assumed Online and CSV files; Desktop does not work that way.

**What QuickBooks Desktop accepts (Intuit pages below):**
- **IIF files:** tab-separated text, with header rows that start with `!`. A transaction is a `TRNS` row for the main amount, one `SPL` row for each split, and an `ENDTRNS` row. Intuit publishes an IIF import kit with sample files, and the exact columns differ a little between Desktop versions, so the file must be matched to the version Zuri uses.
- **Bank transactions:** sources conflict on CSV. Intuit's own answers say Desktop cannot import a bank CSV directly. Bank lines come in as a QBO (Web Connect) file or as IIF.
- **Lists:** customers, vendors and the chart of accounts can be imported as IIF as well.
- **Back up the company file before every import.** An IIF import cannot be undone in bulk, and an account name that does not exist yet is created as a new bank account.

**What I would build:** an **Export for QuickBooks** button beside the existing CSV, making one **IIF file for the month**, plus a plain CSV copy of the same lines for checking:
1. **Money in:** one transaction per day per area, from customer payments (M-Pesa, bank, cash). The memo carries the M-Pesa codes and the number of payments. Customer-level detail stays in Zuri and BillNasi.
2. **Money out:** one transaction per expense: date, payee, the QuickBooks account for its category, amount, the VAT part, and the receipt or M-Pesa reference in the memo.
3. **M-Pesa and bank fees:** their own expense lines, in the "M-Pesa and bank charges" category.

**How M-Pesa receipts map in:** `mpesa_ref` goes in the memo and the document-number column, so a line can be found again from the M-Pesa statement. `payer_name` and `account_ref` stay in Zuri.

**What needs doing first (ACCOUNTANT):**
- The QuickBooks chart of accounts, and a mapping from Zuri's expense categories to it (one table).
- The QuickBooks Desktop year/version, so the IIF headers match, and one test import on a **copy** of the company file.
- The VAT / sales tax items for 16%, zero-rated and exempt.
- Whether areas become QuickBooks classes.

**Size:** the IIF export and the mapping screen are **medium** (about a week), plus the accountant's test import. Nothing here touches the QuickBooks file until a person imports it.

## Suggested order

1. Answer decisions A and B (Jerry, accountant, Billnasi). No code needed.
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
- Intuit, [IIF overview: import kit, sample files, and headers](https://quickbooks.intuit.com/learn-support/en-us/help-articles/iif-overview-import-kit-sample-files-and-headers/00/262115)
- Intuit community, [Importing transactions via IIF file](https://quickbooks.intuit.com/learn-support/en-us/banking/importing-transactions-via-iif-file-for-past-years/00/193809)
