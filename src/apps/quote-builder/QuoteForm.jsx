import React from "react";
import { Alert, Button, Checkbox, Field, Icon, IconButton, Input, Select, Switch, Textarea } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { focusAction } from "../_shared/focus.js";
import { TAP, TAP_INPUT } from "../_shared/controls.js";
import { formatCents, normaliseMoneyInput } from "./calc.js";
import { LIMITS, VALID_DAYS, addDays, emptyItem } from "./model.js";

// The design system's Input spreads its props after its own focus handlers,
// so an onBlur passed to it would replace the one that clears its focus
// border. Blur handling sits on the Field wrapper instead (React's onBlur
// bubbles from the input).
//
// The hint or error is rendered here rather than by Field, because Field's
// note has no id, and the input needs one to point aria-describedby at:
// without it a screen reader hears "invalid" but not why.
function TextField({ id, label, hint, error, value, onChange, onBlur, multiline, rows = 3, ...rest }) {
  const Control = multiline ? Textarea : Input;
  const note = error || hint;
  const noteId = note ? `${id}-note` : undefined;
  return (
    <Field label={label} htmlFor={id} onBlur={onBlur}>
      <Control
        id={id}
        value={value}
        rows={multiline ? rows : undefined}
        onChange={(event) => onChange(event.target.value)}
        invalid={Boolean(error)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={noteId}
        style={multiline ? undefined : TAP_INPUT}
        {...rest}
      />
      {note && (
        <span id={noteId} className={error ? "qb-note qb-note--error" : "qb-note"}>
          {note}
        </span>
      )}
    </Field>
  );
}

/** A number typed as text: no spinners, a decimal keypad on phones. */
function NumberField({ money = false, ...props }) {
  return (
    <TextField
      inputMode="decimal"
      autoComplete="off"
      maxLength={LIMITS.amount}
      onBlur={money ? (event) => props.onChange(normaliseMoneyInput(event.target.value)) : undefined}
      {...props}
    />
  );
}

function errorText(code, copy) {
  if (!code) return undefined;
  return code === "percent" ? copy.errors.percent : copy.errors.invalidNumber;
}

function Fieldset({ legend, children }) {
  return (
    <fieldset className="qb-fieldset">
      <legend className="qb-legend">{legend}</legend>
      <div className="qb-fields">{children}</div>
    </fieldset>
  );
}

function ItemEditor({ item, index, count, figures, copy, update, move, remove }) {
  const n = index + 1;
  const id = (key) => `qb-item-${item.id}-${key}`;
  const I = copy.items;
  const set = (key) => (value) => update({ [key]: value });

  return (
    <li className="qb-item" data-item={item.id}>
      <div className="qb-item-head">
        <h4 className="qb-item-title" id={id("title")}>
          {I.heading(n)}
        </h4>
        <div className="qb-item-tools">
          <IconButton
            type="button"
            size="lg"
            variant="ghost"
            label={I.moveUp(n)}
            data-action="up"
            disabled={index === 0}
            onClick={() => move(-1)}
            icon={<Icon name="arrow-up" size={20} />}
          />
          <IconButton
            type="button"
            size="lg"
            variant="ghost"
            label={I.moveDown(n)}
            data-action="down"
            disabled={index === count - 1}
            onClick={() => move(1)}
            icon={<Icon name="arrow-down" size={20} />}
          />
          <IconButton
            type="button"
            size="lg"
            variant="ghost"
            label={I.remove(n)}
            onClick={remove}
            icon={<Icon name="trash-2" size={20} />}
          />
        </div>
      </div>

      <TextField
        id={id("description")}
        label={I.description}
        value={item.description}
        onChange={set("description")}
        multiline
        rows={2}
        maxLength={LIMITS.description}
      />

      <div className="qb-row qb-row--3">
        <NumberField
          id={id("quantity")}
          label={I.quantity}
          value={item.quantity}
          onChange={set("quantity")}
          error={errorText(figures.errors.quantity, copy)}
        />
        <TextField
          id={id("unit")}
          label={I.unit}
          placeholder={I.unitPlaceholder}
          value={item.unit}
          onChange={set("unit")}
          maxLength={LIMITS.unit}
        />
        <NumberField
          money
          id={id("price")}
          label={I.unitPrice}
          value={item.unitPrice}
          onChange={set("unitPrice")}
          error={errorText(figures.errors.unitPrice, copy)}
        />
      </div>

      <div className="qb-row qb-row--2">
        <Field label={I.discountType} htmlFor={id("discount-type")}>
          <Select
            id={id("discount-type")}
            placeholder=""
            value={item.discountType}
            onChange={(event) => update({ discountType: event.target.value })}
            options={[
              { value: "none", label: I.discountNone },
              { value: "percent", label: I.discountPercent },
              { value: "amount", label: I.discountAmount },
            ]}
            style={TAP}
          />
        </Field>
        {item.discountType !== "none" && (
          <NumberField
            money={item.discountType === "amount"}
            id={id("discount")}
            label={item.discountType === "percent" ? I.discountPercentValue : I.discountAmountValue}
            value={item.discountValue}
            onChange={set("discountValue")}
            error={errorText(figures.errors.discountValue, copy)}
          />
        )}
      </div>

      <p className="qb-line-total">
        <span>{I.lineTotal}</span>
        <strong>{formatCents(figures.total)}</strong>
      </p>
    </li>
  );
}

export function QuoteForm({
  quote,
  setQuote,
  totals,
  copy,
  remember,
  onRemember,
  rememberBlocked,
  onLogo,
  logoError,
}) {
  const B = copy.business;
  const C = copy.customer;
  const D = copy.details;
  const T = copy.totals;

  const patch = (section) => (key) => (value) =>
    setQuote((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const business = patch("business");
  const customer = patch("customer");
  const gst = patch("gst");

  // Moving the quote date moves "valid until" with it, unless the visitor has
  // already set their own validity date.
  const setDetail = (key) => (value) =>
    setQuote((current) => {
      const details = { ...current.details, [key]: value };
      const followsDate =
        key === "date" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        current.details.validUntil === addDays(current.details.date, VALID_DAYS);
      if (followsDate) details.validUntil = addDays(value, VALID_DAYS);
      return { ...current, details };
    });

  const updateItem = (index) => (changes) =>
    setQuote((current) => ({
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
  }, [quote.items]);

  const moveItem = (index) => (step) => {
    const moving = quote.items[index];
    if (moving) focusAfterMove.current = { id: moving.id, action: step < 0 ? "up" : "down" };
    setQuote((current) => {
      const items = [...current.items];
      const target = index + step;
      if (target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
  };

  const itemsFull = quote.items.length >= LIMITS.items;
  const addRef = React.useRef(null);
  const removeItem = (index) => () => {
    setQuote((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
    // Removing the focused row would drop focus to the page; keep it nearby.
    requestAnimationFrame(() => addRef.current?.querySelector("button")?.focus());
  };

  const lastCount = React.useRef(quote.items.length);
  React.useEffect(() => {
    if (quote.items.length > lastCount.current) {
      const last = quote.items[quote.items.length - 1];
      document.getElementById(`qb-item-${last.id}-description`)?.focus();
    }
    lastCount.current = quote.items.length;
  }, [quote.items]);

  return (
    <div className="qb-form stack-6">
      <Fieldset legend={copy.sections.business}>
        <TextField id="qb-business-name" label={B.name} value={quote.business.name} onChange={business("name")} autoComplete="organization" maxLength={LIMITS.short} />
        <TextField id="qb-business-address" label={B.address} value={quote.business.address} onChange={business("address")} multiline maxLength={LIMITS.address} />
        <div className="qb-row qb-row--2">
          <TextField id="qb-business-uen" label={B.uen} hint={B.uenHint} value={quote.business.uen} onChange={business("uen")} maxLength={LIMITS.short} />
          <TextField id="qb-business-phone" label={B.phone} type="tel" value={quote.business.phone} onChange={business("phone")} autoComplete="tel" maxLength={LIMITS.short} />
        </div>
        <TextField id="qb-business-email" label={B.email} type="email" value={quote.business.email} onChange={business("email")} autoComplete="email" maxLength={LIMITS.email} />

        <div className="qb-logo">
          <span className="qb-label" id="qb-logo-label">
            {B.logo}
          </span>
          {quote.business.logo ? (
            <div className="qb-logo-current">
              <img src={quote.business.logo.dataUrl} alt={B.logoAlt} className="qb-logo-img" />
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
              id="qb-logo"
              label={B.logoDrop}
              hint={B.logoHint}
              accept="image/png,image/jpeg,image/svg+xml,.svg"
              onFiles={(files) => onLogo(files[0])}
            />
          )}
          {/* In the page before any error, so the error is announced. */}
          <div id="qb-logo-status" className="tb-live" aria-live="polite">
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
            aria-describedby={rememberBlocked ? "qb-remember-blocked" : undefined}
          />
          {rememberBlocked && (
            <p className="qb-hint" id="qb-remember-blocked">
              {copy.rememberBlocked}
            </p>
          )}
        </div>
      </Fieldset>

      <Fieldset legend={copy.sections.customer}>
        <TextField id="qb-customer-company" label={C.company} value={quote.customer.company} onChange={customer("company")} maxLength={LIMITS.short} />
        <TextField id="qb-customer-contact" label={C.contact} value={quote.customer.contact} onChange={customer("contact")} maxLength={LIMITS.short} />
        <TextField id="qb-customer-address" label={C.address} value={quote.customer.address} onChange={customer("address")} multiline maxLength={LIMITS.address} />
        <TextField id="qb-customer-email" label={C.email} type="email" value={quote.customer.email} onChange={customer("email")} maxLength={LIMITS.email} />
      </Fieldset>

      <Fieldset legend={copy.sections.details}>
        <TextField id="qb-number" label={D.number} value={quote.details.number} onChange={setDetail("number")} maxLength={LIMITS.number} />
        <div className="qb-row qb-row--2">
          <TextField id="qb-date" label={D.date} type="date" value={quote.details.date} onChange={setDetail("date")} />
          <TextField id="qb-valid" label={D.validUntil} type="date" value={quote.details.validUntil} onChange={setDetail("validUntil")} />
        </div>
      </Fieldset>

      <Fieldset legend={copy.sections.items}>
        {quote.items.length === 0 && <p className="qb-hint">{copy.emptyItems}</p>}
        <ol className="qb-items" ref={itemsRef}>
          {quote.items.map((item, index) => (
            <ItemEditor
              key={item.id}
              item={item}
              index={index}
              count={quote.items.length}
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
            aria-describedby={itemsFull ? "qb-items-full" : undefined}
            onClick={() => setQuote((current) => ({ ...current, items: [...current.items, emptyItem()] }))}
            iconLeft={<Icon name="plus" size={20} />}
          >
            {copy.buttons.addItem}
          </Button>
        </span>
        {itemsFull && (
          <p className="qb-hint" id="qb-items-full">
            {copy.itemsFull(LIMITS.items)}
          </p>
        )}
      </Fieldset>

      <Fieldset legend={copy.sections.totals}>
        <div className="qb-row qb-row--2">
          <Field label={T.overallType} htmlFor="qb-overall-type">
            <Select
              id="qb-overall-type"
              placeholder=""
              value={quote.overallDiscount.type}
              onChange={(event) =>
                setQuote((current) => ({ ...current, overallDiscount: { ...current.overallDiscount, type: event.target.value } }))
              }
              options={[
                { value: "none", label: copy.items.discountNone },
                { value: "percent", label: copy.items.discountPercent },
                { value: "amount", label: copy.items.discountAmount },
              ]}
              style={TAP}
            />
          </Field>
          {quote.overallDiscount.type !== "none" && (
            <NumberField
              money={quote.overallDiscount.type === "amount"}
              id="qb-overall-value"
              label={quote.overallDiscount.type === "percent" ? T.overallPercentValue : T.overallAmountValue}
              value={quote.overallDiscount.value}
              onChange={(value) =>
                setQuote((current) => ({ ...current, overallDiscount: { ...current.overallDiscount, value } }))
              }
              error={errorText(totals.errors.overallDiscount, copy)}
            />
          )}
        </div>

        <div>
          <Switch
            label={T.gstSwitch}
            checked={quote.gst.on}
            onChange={(event) => gst("on")(event.target.checked)}
            aria-describedby="qb-gst-help"
          />
          <p className="qb-hint" id="qb-gst-help">
            {copy.gstHelper}
          </p>
        </div>
        {quote.gst.on && (
          <div className="qb-row qb-row--2">
            <NumberField
              id="qb-gst-rate"
              label={T.gstRate}
              value={quote.gst.rate}
              onChange={gst("rate")}
              error={errorText(totals.errors.gstRate, copy)}
            />
            <TextField id="qb-gst-reg" label={T.gstRegNo} value={quote.gst.regNo} onChange={gst("regNo")} maxLength={LIMITS.short} />
          </div>
        )}
      </Fieldset>

      <Fieldset legend={copy.sections.notes}>
        <TextField
          id="qb-notes"
          label={copy.notesLabel}
          value={quote.notes}
          onChange={(value) => setQuote((current) => ({ ...current, notes: value }))}
          multiline
          rows={5}
          maxLength={LIMITS.notes}
        />
        <Switch
          label={copy.madeWith}
          checked={quote.madeWith}
          onChange={(event) => setQuote((current) => ({ ...current, madeWith: event.target.checked }))}
        />
      </Fieldset>
    </div>
  );
}
