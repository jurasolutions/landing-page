/**
 * The invoice form: the sections and labels of PRD §5.2, built from the quote
 * builder's shared, labelled form parts (ticket 01, P3) and its `qb-` layout
 * classes. Inputs the required-field list links to carry `ib-` ids
 * (technical.md §5); item fields keep ItemEditor's `qb-item-<id>-<field>`.
 */
import React from "react";
import { Alert, Button, Checkbox, Field, Icon, Select } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { focusAction } from "../_shared/focus.js";
import { TAP } from "../_shared/controls.js";
import { emptyItem } from "../quote-builder/model.js";
import { Fieldset, ItemEditor, NumberField, TextField, errorText } from "../quote-builder/form-parts.jsx";
import { INVOICE_LIMITS as LIMITS, setInvoiceDate } from "./model.js";
import { GstFields } from "./GstFields.jsx";

export function InvoiceForm({
  invoice,
  setInvoice,
  totals,
  copy,
  remember,
  onRemember,
  rememberBlocked,
  onLogo,
  logoError,
  previousNumber = "",
}) {
  const B = copy.business;
  const C = copy.customer;
  const D = copy.details;

  const patch = (section) => (key) => (value) =>
    setInvoice((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const business = patch("business");
  const customer = patch("customer");
  const detail = patch("details");
  const setField = (key) => (value) => setInvoice((current) => ({ ...current, [key]: value }));

  // The suggested number follows the invoice date until the visitor edits it (D3).
  const setDate = (value) => setInvoice((current) => setInvoiceDate(current, value, previousNumber));

  const { date, dueDate } = invoice.details;
  // Both are YYYY-MM-DD, so they compare as text. The PDF still downloads (D12).
  const dueEarly = Boolean(date && dueDate && dueDate < date);

  const updateItem = (index) => (changes) =>
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }));

  // After a move, focus stays with the item: on the button pressed, or on its
  // other move button once it reaches the top or the bottom.
  const itemsRef = React.useRef(null);
  const focusAfterMove = React.useRef(null);
  React.useEffect(() => {
    const target = focusAfterMove.current;
    if (!target) return;
    focusAfterMove.current = null;
    focusAction(itemsRef.current?.querySelector(`[data-item="${target.id}"]`), target.action);
  }, [invoice.items]);

  const moveItem = (index) => (step) => {
    const moving = invoice.items[index];
    if (moving) focusAfterMove.current = { id: moving.id, action: step < 0 ? "up" : "down" };
    setInvoice((current) => {
      const items = [...current.items];
      const target = index + step;
      if (target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
  };

  const itemsFull = invoice.items.length >= LIMITS.items;
  const addRef = React.useRef(null);
  const removeItem = (index) => () => {
    setInvoice((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
    // Removing the focused row would drop focus to the page; keep it nearby.
    requestAnimationFrame(() => addRef.current?.querySelector("button")?.focus());
  };

  const lastCount = React.useRef(invoice.items.length);
  React.useEffect(() => {
    if (invoice.items.length > lastCount.current) {
      const last = invoice.items[invoice.items.length - 1];
      document.getElementById(`qb-item-${last.id}-description`)?.focus();
    }
    lastCount.current = invoice.items.length;
  }, [invoice.items]);

  const overall = invoice.overallDiscount;
  const setOverall = (changes) => setInvoice((current) => ({ ...current, overallDiscount: { ...current.overallDiscount, ...changes } }));
  const gstProps = { invoice, setInvoice, totals, copy };

  return (
    <div className="qb-form stack-6">
      <Fieldset legend={copy.sections.business}>
        <TextField id="ib-business-name" label={B.name} value={invoice.business.name} onChange={business("name")} autoComplete="organization" maxLength={LIMITS.short} />
        <TextField id="ib-business-address" label={B.address} value={invoice.business.address} onChange={business("address")} multiline maxLength={LIMITS.address} />
        <div className="qb-row qb-row--2">
          <TextField id="ib-business-uen" label={B.uen} value={invoice.business.uen} onChange={business("uen")} maxLength={LIMITS.short} spellCheck={false} />
          <TextField id="ib-business-phone" label={B.phone} type="tel" value={invoice.business.phone} onChange={business("phone")} autoComplete="tel" maxLength={LIMITS.short} />
        </div>
        <TextField id="ib-business-email" label={B.email} type="email" value={invoice.business.email} onChange={business("email")} autoComplete="email" maxLength={LIMITS.email} spellCheck={false} />
        <GstFields part="business" {...gstProps} />

        <div className="qb-logo">
          <span className="qb-label" id="ib-logo-label">
            {B.logo}
          </span>
          {invoice.business.logo ? (
            <div className="qb-logo-current">
              <img src={invoice.business.logo.dataUrl} alt={B.logoAlt} width={invoice.business.logo.width} height={invoice.business.logo.height} className="qb-logo-img" />
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => business("logo")(null)}
                iconLeft={<Icon name="trash-2" size={20} />}
              >
                {B.logoRemove}
              </Button>
            </div>
          ) : (
            <FileDrop
              id="ib-logo"
              label={B.logoDrop}
              hint={B.logoHint}
              accept="image/png,image/jpeg,image/svg+xml,.svg"
              onFiles={(files) => onLogo(files[0])}
            />
          )}
          {/* In the page before any error, so the error is announced. */}
          <div id="ib-logo-status" className="tb-live" aria-live="polite">
            {logoError && (
              <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
                {logoError}
              </Alert>
            )}
          </div>
        </div>

        <div>
          <Checkbox
            label={copy.remember}
            checked={remember}
            onChange={(event) => onRemember(event.target.checked)}
            aria-describedby={rememberBlocked ? "ib-remember-blocked" : undefined}
          />
          {rememberBlocked && (
            <p className="qb-hint" id="ib-remember-blocked">
              {copy.rememberBlocked}
            </p>
          )}
        </div>
      </Fieldset>

      <Fieldset legend={copy.sections.customer}>
        <TextField id="ib-customer-company" label={C.company} value={invoice.customer.company} onChange={customer("company")} maxLength={LIMITS.short} />
        <TextField id="ib-customer-contact" label={C.contact} value={invoice.customer.contact} onChange={customer("contact")} maxLength={LIMITS.short} />
        <TextField id="ib-customer-address" label={C.address} value={invoice.customer.address} onChange={customer("address")} multiline maxLength={LIMITS.address} />
        <TextField id="ib-customer-email" label={C.email} type="email" value={invoice.customer.email} onChange={customer("email")} maxLength={LIMITS.email} spellCheck={false} />
      </Fieldset>

      <Fieldset legend={copy.sections.details}>
        <TextField id="ib-number" label={D.number} value={invoice.details.number} onChange={detail("number")} maxLength={LIMITS.number} spellCheck={false} />
        <div className="qb-row qb-row--2">
          <TextField id="ib-date" label={D.date} type="date" value={date} onChange={setDate} />
          <TextField id="ib-due" label={D.dueDate} type="date" value={dueDate} onChange={detail("dueDate")} hint={dueEarly ? D.dueBeforeDate : undefined} />
        </div>
        <GstFields part="details" {...gstProps} />
      </Fieldset>

      <Fieldset legend={copy.sections.items}>
        {invoice.items.length === 0 && <p className="qb-hint">{copy.emptyItems}</p>}
        <ol className="qb-items" ref={itemsRef}>
          {invoice.items.map((item, index) => (
            <ItemEditor
              key={item.id}
              item={item}
              index={index}
              count={invoice.items.length}
              figures={totals.lines[index]}
              copy={copy}
              update={updateItem(index)}
              move={moveItem(index)}
              remove={removeItem(index)}
            />
          ))}
        </ol>
        {totals.ignored.length > 0 && (
          <Alert tone="info" icon={<Icon name="info" size={18} />}>
            {copy.zeroQuantity}
          </Alert>
        )}
        <span ref={addRef}>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={itemsFull}
            aria-describedby={itemsFull ? "ib-items-full" : undefined}
            onClick={() => setInvoice((current) => ({ ...current, items: [...current.items, emptyItem()] }))}
            iconLeft={<Icon name="plus" size={20} />}
          >
            {copy.buttons.addItem}
          </Button>
        </span>
        {itemsFull && (
          <p className="qb-hint" id="ib-items-full">
            {copy.itemsFull(LIMITS.items)}
          </p>
        )}

        <div className="qb-row qb-row--2">
          <Field label={copy.discount.type} htmlFor="ib-overall-type">
            <Select
              id="ib-overall-type"
              placeholder=""
              value={overall.type}
              onChange={(event) => setOverall({ type: event.target.value })}
              options={[
                { value: "none", label: copy.items.discountNone },
                { value: "percent", label: copy.items.discountPercent },
                { value: "amount", label: copy.items.discountAmount },
              ]}
              style={TAP}
            />
          </Field>
          {overall.type !== "none" && (
            <NumberField
              money={overall.type === "amount"}
              id="ib-overall-value"
              label={overall.type === "percent" ? copy.discount.percentValue : copy.discount.amountValue}
              value={overall.value}
              onChange={(value) => setOverall({ value })}
              error={errorText(totals.errors.overallDiscount, copy)}
            />
          )}
        </div>
      </Fieldset>

      <Fieldset legend={copy.sections.payment}>
        <TextField
          id="ib-payment"
          label={copy.payment.label}
          hint={copy.payment.helper}
          value={invoice.payment}
          onChange={setField("payment")}
          multiline
          rows={3}
          maxLength={LIMITS.payment}
        />
      </Fieldset>

      <Fieldset legend={copy.sections.notes}>
        <TextField id="ib-notes" label={copy.notesLabel} value={invoice.notes} onChange={setField("notes")} multiline rows={4} maxLength={LIMITS.notes} />
      </Fieldset>
    </div>
  );
}
