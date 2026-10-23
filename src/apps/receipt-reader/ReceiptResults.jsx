import React from "react";
import { Alert, Badge, Button, Card, Field, Icon, IconButton, Input } from "../../ds.js";
import { emptyLine, itemsMismatch } from "./model.js";

// 44px tap targets, and the left padding the design system's Input drops
// when it has no icon.
const TAP_INPUT = { minHeight: "var(--tap-min)", paddingLeft: "var(--space-3)" };

function TextField({ id, label, value, onChange, list, placeholder, inputMode }) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        value={value}
        list={list}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        style={TAP_INPUT}
      />
    </Field>
  );
}

function ReceiptCard({ receipt, index, copy, update, remove }) {
  const F = copy.fields;
  const R = copy.results;
  const [open, setOpen] = React.useState(false);
  const id = (key) => `rr-${receipt.id}-${key}`;
  const set = (key) => (value) => update({ [key]: value });
  const mismatch = itemsMismatch(receipt);

  const updateItem = (itemIndex, changes) =>
    update({ items: receipt.items.map((item, i) => (i === itemIndex ? { ...item, ...changes } : item)) });

  return (
    <li>
      <Card padding="var(--space-5)" className="rr-card">
        <div className="rr-card-head">
          <h3 className="rr-card-title">{receipt.merchant || R.receipt(index + 1)}</h3>
          <div className="rr-card-tools">
            {receipt.total && receipt.isReceipt && (
              <Badge tone="neutral">
                {receipt.currency || ""} {receipt.total}
              </Badge>
            )}
            <IconButton
              type="button"
              size="lg"
              variant="ghost"
              label={R.remove(index + 1)}
              onClick={remove}
              icon={<Icon name="trash-2" size={20} />}
            />
          </div>
        </div>

        {!receipt.isReceipt ? (
          <Alert tone="info" icon={<Icon name="info" size={18} />}>
            {copy.notReceipt}
          </Alert>
        ) : (
          <>
            {mismatch && (
              <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
                {copy.mismatch}
              </Alert>
            )}
            <div className="rr-fields">
              <TextField id={id("merchant")} label={F.merchant} value={receipt.merchant} onChange={set("merchant")} />
              <TextField id={id("merchant-id")} label={F.merchantId} value={receipt.merchantId} onChange={set("merchantId")} />
              <TextField id={id("date")} label={F.date} value={receipt.date} onChange={set("date")} placeholder={F.datePlaceholder} />
              <TextField id={id("currency")} label={F.currency} value={receipt.currency} onChange={set("currency")} />
              <TextField id={id("subtotal")} label={F.subtotal} value={receipt.subtotal} onChange={set("subtotal")} inputMode="decimal" />
              <TextField id={id("gst")} label={F.gst} value={receipt.gst} onChange={set("gst")} inputMode="decimal" />
              <TextField id={id("total")} label={F.total} value={receipt.total} onChange={set("total")} inputMode="decimal" />
              <TextField id={id("payment")} label={F.payment} value={receipt.payment} onChange={set("payment")} />
              <TextField id={id("category")} label={F.category} value={receipt.category} onChange={set("category")} list="rr-categories" />
              <TextField id={id("notes")} label={F.notes} value={receipt.notes} onChange={set("notes")} />
            </div>

            <div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                aria-expanded={open}
                aria-controls={id("items")}
                onClick={() => setOpen((value) => !value)}
                iconLeft={<Icon name={open ? "chevron-up" : "chevron-down"} size={20} />}
              >
                {open ? R.hideItems : R.showItems(receipt.items.length)}
              </Button>
            </div>

            {open && (
              <div id={id("items")} className="rr-items">
                {receipt.items.length === 0 && <p className="rr-hint">{R.noItems}</p>}
                {receipt.items.map((item, i) => (
                  <div className="rr-item" key={item.id} role="group" aria-label={`${F.itemDescription} ${i + 1}`}>
                    <TextField id={id(`item-${i}-d`)} label={F.itemDescription} value={item.description} onChange={(v) => updateItem(i, { description: v })} />
                    <TextField id={id(`item-${i}-q`)} label={F.itemQuantity} value={item.quantity} onChange={(v) => updateItem(i, { quantity: v })} inputMode="decimal" />
                    <TextField id={id(`item-${i}-a`)} label={F.itemAmount} value={item.amount} onChange={(v) => updateItem(i, { amount: v })} inputMode="decimal" />
                    <IconButton
                      type="button"
                      size="lg"
                      variant="ghost"
                      label={R.removeItem(i + 1)}
                      onClick={() => update({ items: receipt.items.filter((_, j) => j !== i) })}
                      icon={<Icon name="x" size={20} />}
                    />
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => update({ items: [...receipt.items, emptyLine()] })}
                    iconLeft={<Icon name="plus" size={20} />}
                  >
                    {R.addItem}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </li>
  );
}

export function ReceiptResults({ receipts, setReceipts, copy }) {
  const update = (index) => (changes) =>
    setReceipts((current) => current.map((receipt, i) => (i === index ? { ...receipt, ...changes } : receipt)));
  const remove = (index) => () => setReceipts((current) => current.filter((_, i) => i !== index));

  return (
    <>
      <datalist id="rr-categories">
        {copy.categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <ul className="rr-list">
        {receipts.map((receipt, index) => (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            index={index}
            copy={copy}
            update={update(index)}
            remove={remove(index)}
          />
        ))}
      </ul>
    </>
  );
}
