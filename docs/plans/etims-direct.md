# Plan: Zuri connects straight to KRA's eTIMS (option 1)

**Status: plan only. Nothing has been built.** Written 20 Nov 2026. This is the "connect Zuri straight to KRA" option from `vat-quickbooks.md`, worked out in more detail. Jerry's answers that led here: BillNasi cannot issue eTIMS invoices, and Zuri is VAT-registered. Items marked **JERRY** are his to decide. Items marked **ACCOUNTANT** need Zuri's accountant or KRA. Anything I could not confirm is marked **unconfirmed**.

## What this means in plain words

Zuri would create each customer invoice itself and send it to KRA at the moment it is made. KRA sends back a number and a signature, and Zuri stores them and puts them on the invoice the customer receives. The VAT worksheet then reads real invoices instead of guessing from cash.

## What KRA requires (from its own pages, linked at the end)

- A system that connects this way is called "system to system" integration. KRA says anyone who builds one for themselves, or for other businesses, **must be certified first**.
- The steps are: read KRA's technical specification, build and test against KRA's **sandbox** (a practice copy of the system), apply for certification with the eTIMS Bio Data Form and the supporting documents, pass KRA's technical and administrative review, and receive an **interim approval certificate**. A final certification follows when the interim one expires.
- **Two kinds of connection:**
  - **OSCU** is hosted by KRA and is meant for systems that are online. Each invoice is sent to KRA as it is made.
  - **VSCU** runs from a package file that KRA gives you, for businesses with very many invoices or that are not always online.
- **Sandbox address:** `etims-api-sbx.kra.go.ke`. **Real address:** `etims-api.kra.go.ke`. Registration for the sandbox is on a separate KRA portal.
- **Start of a connection:** the first call activates a "device" with the company's KRA PIN, the branch ID and a communication key. That key is a secret.
- **Unconfirmed:** how long KRA's testing and review take, what the final certificate costs (if anything), the exact calls for sending a sale and a credit note, and how a connection behaves when the internet drops. Those are in KRA's OSCU and VSCU specification documents, which I could not read in full.

## Which kind: OSCU, run from a server

Zuri's customer invoices are made in batches (once a month, or when a payment arrives), not at a counter with a customer waiting. That fits **OSCU from a server that is always online**. It also keeps the secret key off the phones. Zuri's phones in Maai Mahiu have weak signal, so nothing here should depend on a phone reaching KRA.

**Unconfirmed:** KRA's specification mentions a Java library. Zuri's server side today is Supabase (database and functions). I do not know yet whether a Supabase function can make these calls or whether a small separate server is needed. That needs a day of reading the specification and a sandbox test.

## What would be built, in order

1. **Register on KRA's sandbox** with Zuri's KRA PIN. This needs a person who can log in as Zuri on KRA's portal (Jerry or Kelvin). *Size: a day, plus waiting.*
2. **A small server component** that holds the KRA key as a secret and makes the calls. It activates the device, downloads KRA's code lists (tax types, units, payment types), and sends invoices. *Size: medium.*
3. **Items:** each package becomes an item registered with KRA, with its tax type (16%, zero or exempt). **ACCOUNTANT** confirms the tax type of every package. *Size: small.*
4. **Invoices in Zuri:** a new invoice record per customer sale, with the amount before VAT, the VAT, the customer's PIN if they have one, and KRA's returned number, signature and QR code. *Size: medium to large.*
5. **When an invoice is made** (**JERRY** and **ACCOUNTANT** decide):
   - on each M-Pesa payment received, or
   - once a month per active customer at billing time.

   Zuri already holds each payment (`payments`) and each customer's monthly rate and package. BillNasi does the billing today, so someone must decide whose invoice the customer sees. Two invoice systems at once will confuse customers.
6. **Delivery:** the customer gets the invoice by SMS or WhatsApp link, or at least a receipt number. *Size: small to medium.*
7. **Credit notes** for refunds and corrections, which KRA also needs. *Size: medium.*
8. **A retry queue:** if KRA does not answer, the invoice waits and is sent again. An invoice must never be lost or sent twice. *Size: medium.*
9. **Purchases:** pull the supplier invoices KRA already holds for Zuri, and match them to Zuri's expenses. That gives the input VAT proof. *Size: medium.*
10. **The VAT worksheet** (from the main plan) reads all of the above.
11. **Test in the sandbox, then apply for certification**, with the Bio Data Form and documents. **Zuri's own certification is then the gate to going live.**

## Rough size

- **Building:** about **4 to 8 weeks** of focused work for one builder, once the specification is read. This is my estimate, not a quote.
- **Waiting on KRA:** unknown. I could find no published timing for the review or the interim certificate.
- **Cost:** none that I found for the connection itself. **Unconfirmed**: a fee for certification, and the cost of a server if one is needed.

## Risks

- **Two invoice systems** (BillNasi's and this one). Decide which one customers see.
- **Customers with no PIN.** Most home-internet customers will not have one. **Unconfirmed** how KRA wants these invoiced (ACCOUNTANT or KRA).
- **A thousand invoices a month** is a lot to send. Whether KRA allows one summary invoice for consumer sales is **unconfirmed**. If it does, this plan shrinks a great deal.
- **The secret key.** It must be put into the server's secret store by Jerry himself, never typed into a chat or put in the repository.
- **Zuri is the one KRA holds responsible.** A mistake in an invoice is a mistake in Zuri's tax record.

## Compared with a KRA-approved third-party provider

A provider is already certified and takes the work of steps 2, 7, 8 and 11. Zuri would only send it each sale and store what it returns. That is **medium** size instead of large, with a monthly fee. KRA publishes a list of approved integrators (link below). It is dated June 2024, so check that it is current. Whether any of them suit a thousand small invoices a month is **unconfirmed**.

## Decisions

- **JERRY and ACCOUNTANT:** direct connection or approved provider? I still recommend the provider, because direct means Zuri carries KRA certification and upkeep.
- **ACCOUNTANT or KRA:** is a summary invoice allowed for consumer sales? This could change everything above.
- **JERRY:** if direct, who registers on KRA's sandbox, and who keeps the secret key?
- **JERRY and ACCOUNTANT:** invoice on each payment, or once a month?

## Sources

- KRA, [eTIMS system-to-system integration](https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration)
- KRA, [Types of eTIMS solutions](https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/types-of-etims-solutions)
- KRA, [OSCU and VSCU step-by-step sign-up guide](https://www.kra.go.ke/images/publications/OSCU_VSCU_Step-by-Step_Guide-on-how-to-sign-up.pdf)
- KRA, [OSCU Specification Document v2.0](https://www.kra.go.ke/images/publications/OSCU_Specification_Document_v2.0.pdf)
- KRA, [VSCU Specification Document v2.0](https://www.kra.go.ke/images/publications/VSCU_Specification_Document_v2.0.pdf)
- KRA, [eTIMS Bio Data Form for OSCU and VSCU](https://www.kra.go.ke/images/publications/eTIMS-Bio-Data-Form-for-OSCU-and-VSCU.pdf)
- KRA, [List of approved eTIMS third-party integrators, 12 June 2024](https://www.kra.go.ke/images/publications/List-of-Approved-eTIMS-3rd-party-integrators-as-at-12th-June-2024.pdf)
