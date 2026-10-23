import React from "react";
import { Button, Icon } from "../../ds.js";
import { EXPORTS } from "../../content.js";

/**
 * A row of download and copy actions. Each action is
 *   { key, label, icon, onClick, disabled, primary }.
 * On a phone the buttons stack full width so each is an easy tap.
 */
export function ExportButtons({ actions, label = EXPORTS.groupLabel }) {
  return (
    <div className="tb-actions" role="group" aria-label={label}>
      {actions.map((action) => (
        <Button
          key={action.key}
          type="button"
          variant={action.primary ? "primary" : "secondary"}
          size="lg"
          disabled={action.disabled}
          onClick={action.onClick}
          iconLeft={action.icon ? <Icon name={action.icon} size={20} /> : undefined}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
