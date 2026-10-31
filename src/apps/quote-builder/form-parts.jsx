/**
 * The quote form's field parts: labelled text and number fields, a fieldset,
 * one item's editor and the error text for a figure the totals can't read.
 * Shared so another tool (the invoice builder first) gets the same accessible
 * fields instead of a copy. ItemEditor reads copy.items.* and copy.errors.*.
 */
import React from "react";
import { Field, Icon, IconButton, Input, Select, Textarea } from "../../ds.js";
import { TAP, TAP_INPUT } from "../_shared/controls.js";
import { formatCents, normaliseMoneyInput } from "./calc.js";
import { LIMITS } from "./model.js";

// The design system's Input spreads its props after its own focus handlers,
// so an onBlur passed to it would replace the one that clears its focus
// border. Blur handling sits on the Field wrapper instead (React's onBlur
// bubbles from the input).
//
// The hint or error is rendered here rather than by Field, because Field's
// note has no id, and the input needs one to point aria-describedby at:
// without it a screen reader hears "invalid" but not why.
export function TextField({ id, label, hint, error, value, onChange, onBlur, multiline, rows = 3, ...rest }) {
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
export function NumberField({ money = false, ...props }) {
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

export function errorText(code, copy) {
  if (!code) return undefined;
  return code === "percent" ? copy.errors.percent : copy.errors.invalidNumber;
}

export function Fieldset({ legend, children }) {
  return (
    <fieldset className="qb-fieldset">
      <legend className="qb-legend">{legend}</legend>
      <div className="qb-fields">{children}</div>
    </fieldset>
  );
}

export function ItemEditor({ item, index, count, figures, copy, update, move, remove }) {
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
