import React from "react";
import { Alert, Icon } from "../../ds.js";
import { TryLimitNotice } from "./TryLimitNotice.jsx";
import { TalkToUsCard } from "./TalkToUsCard.jsx";
import { SITE_KEY } from "./turnstile.js";
import { showsTalkCard } from "./ai-limit.js";

/**
 * The top of an AI tool's upload area: the tries left, or why there are none.
 * Out of tries, the come-back-tomorrow message has the talk-to-us card right
 * under it (APP-002 §5.1 step 7). The tool then tells the shell, with
 * `useOwnTalkCard(showsTalkCard(limit, SITE_KEY))`, to leave out its closing
 * card, so the card shows once.
 *
 * `copy` is the tool's copy.js: { triesLeft(n), limitReached, capReached,
 * errors: { notReady }, talk: { heading, body, button } }.
 */
export function LimitArea({ limit, slug, copy }) {
  if (limit && (!limit.ready || !SITE_KEY)) {
    return (
      <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
        {copy.errors.notReady}
      </Alert>
    );
  }
  const limitCopy = { triesLeft: copy.triesLeft, limitReached: copy.limitReached, capReached: copy.capReached };
  return (
    <>
      <TryLimitNotice limit={limit} copy={limitCopy} />
      {showsTalkCard(limit, SITE_KEY) && <TalkToUsCard slug={slug} {...copy.talk} />}
    </>
  );
}
