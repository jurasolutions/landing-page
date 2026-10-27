import React from "react";
import { formatCents, formatPercent, formatQuantity, parseCents, parsePercent, parseQuantity } from "./calc.js";
import { displayDate } from "./model.js";
import { totalsRows } from "./totals-rows.js";

/**
 * A live, readable picture of the PDF. It follows the PDF's structure and
 * wording but not its exact layout: on a phone the items become stacked rows
 * so nothing needs a sideways scroll.
 */
export function QuotePreview({ quote, totals, copy }) {
  const P = copy.pdf;
  const totalLines = totalsRows(quote, totals, copy);
  const b = quote.business;
  const c = quote.customer;
  const rows = quote.items
    .map((item, index) => ({ item, line: totals.lines[index] }))
    .filter(({ line }) => line.included);
  const showUnit = rows.some(({ item }) => item.unit.trim());
  const showDiscount = rows.some(({ line }) => line.discount > 0n);

  const discountCell = (item, line) => {
    if (line.discount <= 0n) return "";
    if (item.discountType === "percent") return `${formatPercent(parsePercent(item.discountValue).value ?? 0n)}%`;
    return formatCents(line.discount);
  };

  const businessLines = [
    b.address,
    b.uen && `${P.uen} ${b.uen}`,
    quote.gst.on && quote.gst.regNo && `${P.gstRegNo} ${quote.gst.regNo}`,
    b.phone && `${P.phone} ${b.phone}`,
    b.email && `${P.email} ${b.email}`,
  ].filter(Boolean);

  return (
    <article className="qb-paper" aria-label={copy.preview.label}>
      <header className="qb-paper-head">
        <div className="qb-paper-from">
          {b.logo && (
            <img
              src={b.logo.dataUrl}
              alt={copy.business.logoAlt}
              className="qb-paper-logo"
              style={{ aspectRatio: `${b.logo.width} / ${b.logo.height}` }}
            />
          )}
          {b.name && <p className="qb-paper-name">{b.name}</p>}
          {businessLines.map((line) => (
            <p key={line} className="qb-paper-muted qb-pre">
              {line}
            </p>
          ))}
        </div>
        <div className="qb-paper-meta">
          <p className="qb-paper-title">{P.title}</p>
          <dl className="qb-paper-dl">
            {quote.details.number && (
              <>
                <dt>{P.number}</dt>
                <dd>{quote.details.number}</dd>
              </>
            )}
            {quote.details.date && (
              <>
                <dt>{P.date}</dt>
                <dd>{displayDate(quote.details.date, P.months)}</dd>
              </>
            )}
            {quote.details.validUntil && (
              <>
                <dt>{P.validUntil}</dt>
                <dd>{displayDate(quote.details.validUntil, P.months)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      {(c.company || c.contact || c.address || c.email) && (
        <section className="qb-paper-to">
          <p className="qb-paper-label">{P.preparedFor}</p>
          {c.company && <p className="qb-paper-name">{c.company}</p>}
          {[c.contact, c.address, c.email].filter(Boolean).map((line) => (
            <p key={line} className="qb-pre">
              {line}
            </p>
          ))}
        </section>
      )}

      {rows.length === 0 ? (
        <p className="qb-paper-empty">{copy.emptyItems}</p>
      ) : (
        <>
          <p className="qb-paper-note">{P.currencyNote}</p>
          <table className="qb-paper-table">
            <thead>
              <tr>
                <th scope="col" className="qb-num-col">{P.columns.index}</th>
                <th scope="col">{P.columns.description}</th>
                <th scope="col" className="qb-right">{P.columns.quantity}</th>
                {showUnit && <th scope="col">{P.columns.unit}</th>}
                <th scope="col" className="qb-right">{P.columns.unitPrice}</th>
                {showDiscount && <th scope="col" className="qb-right">{P.columns.discount}</th>}
                <th scope="col" className="qb-right">{P.columns.amount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, line }, index) => (
                <tr key={item.id}>
                  <td className="qb-num-col" data-label={P.columns.index}>{index + 1}</td>
                  <td className="qb-pre qb-desc" data-label={P.columns.description}>{item.description}</td>
                  <td className="qb-right" data-label={P.columns.quantity}>
                    {formatQuantity(parseQuantity(item.quantity).value ?? 0n)}
                  </td>
                  {showUnit && <td data-label={P.columns.unit}>{item.unit}</td>}
                  <td className="qb-right" data-label={P.columns.unitPrice}>
                    {formatCents(parseCents(item.unitPrice).value ?? 0n)}
                  </td>
                  {showDiscount && (
                    <td className="qb-right" data-label={P.columns.discount}>
                      {discountCell(item, line)}
                    </td>
                  )}
                  <td className="qb-right qb-strong" data-label={P.columns.amount}>
                    {formatCents(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <dl className="qb-paper-totals">
        {totalLines.rows.map(({ label, value }) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
        <dt className="qb-paper-total">{P.total}</dt>
        <dd className="qb-paper-total">{formatCents(totals.total)}</dd>
      </dl>

      {quote.notes.trim() && (
        <section className="qb-paper-notes">
          <p className="qb-paper-label">{P.notes}</p>
          <p className="qb-pre">{quote.notes}</p>
        </section>
      )}

      {quote.madeWith && <p className="qb-paper-foot">{P.madeWith}</p>}
    </article>
  );
}
