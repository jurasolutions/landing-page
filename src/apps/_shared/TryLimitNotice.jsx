import React from "react";
import { Alert, Badge, Icon } from "../../ds.js";

/**
 * How many free AI tries the visitor has left today, or why there are none.
 *
 * `limit` is what GET /api/apps/limit returned:
 *   { triesLeft, capReached }  or  null while it is loading or unknown.
 * `copy` is the tool's own wording (each AI tool's PRD sets it):
 *   { triesLeft(n), limitReached, capReached }
 */
export function TryLimitNotice({ limit, copy }) {
  if (!limit) return null;

  if (limit.capReached) {
    return (
      <Alert tone="warning" icon={<Icon name="clock" size={18} />}>
        {copy.capReached}
      </Alert>
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
    <p aria-live="polite" style={{ margin: 0 }}>
      <Badge tone="brand" dot>
        {copy.triesLeft(limit.triesLeft)}
      </Badge>
    </p>
  );
}
