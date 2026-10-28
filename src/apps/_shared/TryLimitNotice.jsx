import React from "react";
import { Alert, Badge, Icon } from "../../ds.js";

/**
 * How many free AI tries the visitor has left today, or why there are none.
 *
 * `limit` is what GET /api/apps/limit returned:
 *   { triesLeft, capReached, unlimited? }  or  null while it is loading or unknown.
 * `copy` is the tool's own wording (each AI tool's PRD sets it):
 *   { triesLeft(n), limitReached, capReached }
 *
 * One live region holds whichever message applies and stays in the page
 * while the limit loads, so the count and the move to "used up" after a
 * read are both announced.
 */
export function TryLimitNotice({ limit, copy }) {
  return (
    <div className="tb-live" aria-live="polite">
      <Message limit={limit} copy={copy} />
    </div>
  );
}

function Message({ limit, copy }) {
  if (!limit) return null;

  if (limit.capReached) {
    return (
      <Alert tone="warning" icon={<Icon name="clock" size={18} />}>
        {copy.capReached}
      </Alert>
    );
  }

  // An access code holder (server/promo.js) has no count to show.
  if (limit.unlimited) {
    return (
      <p style={{ margin: 0 }}>
        <Badge tone="brand" dot>
          {copy.unlimited ?? "Unlimited tries"}
        </Badge>
      </p>
    );
  }

  if (limit.triesLeft <= 0) {
    return (
      <Alert tone="info" icon={<Icon name="clock" size={18} />}>
        {copy.limitReached}
      </Alert>
    );
  }

  return (
    <p style={{ margin: 0 }}>
      <Badge tone="brand" dot>
        {copy.triesLeft(limit.triesLeft)}
      </Badge>
    </p>
  );
}
