import React from "react";
import { Alert, Button, Field, Icon, IconButton, Input, Tag, Textarea, Toast } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { TryLimitNotice } from "../_shared/TryLimitNotice.jsx";
import { TalkToUsCard } from "../_shared/TalkToUsCard.jsx";
import { useOwnTalkCard } from "../_shared/AppShell.jsx";
import { TAP_INPUT } from "../_shared/controls.js";
import { trackUsage } from "../_shared/usage.js";
import { useToast } from "../_shared/useToast.js";
import { SITE_KEY, createTurnstile } from "../_shared/turnstile.js";
import { fileMessage } from "../receipt-reader/files.js";
import { isOutOfTries, showsTalkCard } from "../receipt-reader/read-state.js";
import { FIELD_LIMITS, MAX_PHOTOS, fetchLimit, sendPosts } from "./api.js";
import { preparePhoto } from "./prepare.js";
import { blockerText, failureMessage, makeBlocker, resultFromApi } from "./post-state.js";
import { forgetResult, keepResult, keepWords, restoreResult } from "./session.js";
import { PostFrame } from "./PostFrame.jsx";
import "./product-photo-studio.css";

let photoCounter = 0;

/** How often the instruction box's example placeholder changes. */
const PLACEHOLDER_MS = 4000;

/**
 * The top of the upload area: the tries left, or why there are none. Out of
 * tries, the talk-to-us card sits right under the notice, and the page leaves
 * out the shell's closing card (useOwnTalkCard below), as the receipt reader
 * does.
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

/** Cycles the examples as the box's placeholder, unless the visitor prefers less motion. */
function useRotatingExample(examples, paused) {
  const [at, setAt] = React.useState(0);
  React.useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => setAt((n) => (n + 1) % examples.length), PLACEHOLDER_MS);
    return () => clearInterval(timer);
  }, [examples.length, paused]);
  return examples[at];
}

export default function ProductPhotoStudio({ app, copy }) {
  const R = copy.results;
  const [limit, setLimit] = React.useState(null);
  const [photos, setPhotos] = React.useState([]);
  const [instruction, setInstruction] = React.useState("");
  const [name, setName] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [toast, setToast] = useToast();
  const widgetRef = React.useRef(null);
  const turnstile = React.useRef(null);
  const resultsRef = React.useRef(null);
  const used = React.useRef(false);
  const placeholder = useRotatingExample(copy.examples, instruction !== "");

  React.useEffect(() => {
    let live = true;
    fetchLimit().then((value) => live && setLimit(value));
    const kept = restoreResult();
    if (kept) setResult(kept);
    return () => {
      live = false;
    };
  }, []);

  React.useEffect(() => {
    if (!SITE_KEY || !widgetRef.current) return undefined;
    let cancelled = false;
    createTurnstile(widgetRef.current, () => cancelled)
      .then((widget) => {
        if (cancelled) widget.remove();
        else turnstile.current = widget;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      turnstile.current?.remove();
      turnstile.current = null;
    };
  }, []);

  // Preview URLs are released when the photos go.
  const photosRef = React.useRef(photos);
  photosRef.current = photos;
  React.useEffect(() => () => photosRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), []);

  const clearPhotos = () => {
    photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
  };

  const addPhotos = async (incoming) => {
    setNotice("");
    setError("");
    const room = MAX_PHOTOS - photos.length;
    if (incoming.length > room) setNotice(copy.tooMany);
    const taken = incoming.slice(0, Math.max(0, room));
    const entries = taken.map((file) => ({ id: `p-${(photoCounter += 1)}`, name: file.name, status: "preparing" }));
    setPhotos((current) => [...current, ...entries]);
    await Promise.all(
      taken.map(async (file, i) => {
        const made = await preparePhoto(file);
        setPhotos((current) =>
          current.map((entry) =>
            entry.id === entries[i].id
              ? made.ok
                ? { ...entry, status: "ready", file: made.file, ref: made.ref, previewUrl: made.previewUrl }
                : { ...entry, status: "error", reason: made.reason }
              : entry
          )
        );
      })
    );
  };

  const removePhoto = (id) =>
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((p) => p.id !== id);
    });

  const ready = photos.filter((p) => p.status === "ready");
  const preparing = photos.some((p) => p.status === "preparing");
  const outOfTries = isOutOfTries(limit);
  useOwnTalkCard(showsTalkCard(limit, SITE_KEY));
  const blocker = makeBlocker({ limit, siteKey: SITE_KEY, photoCount: ready.length, preparing, sending });
  const whyNot = blockerText(blocker, copy);

  const markUsed = () => {
    if (used.current) return;
    used.current = true;
    trackUsage(app.slug, "complete");
  };

  const make = async () => {
    if (blocker !== null) return;
    const triesBefore = limit.triesLeft;
    setSending(true);
    setError("");
    let token;
    try {
      token = await turnstile.current.token();
    } catch {
      setSending(false);
      setError(copy.errors.botCheck);
      return;
    }
    const { status, body } = await sendPosts({ token, photos: ready, name, instruction });
    setSending(false);

    if (status === 200 && Array.isArray(body.posts)) {
      const next = { ...resultFromApi(body), name: name.trim() };
      keepResult(next);
      setResult(next);
      used.current = false;
      setLimit((current) => ({ ...current, triesLeft: body.triesLeft ?? 0 }));
      clearPhotos();
      requestAnimationFrame(() => resultsRef.current?.focus());
      return;
    }
    if (status === 429) {
      setLimit((current) => ({ ...current, triesLeft: 0, capReached: body.error === "cap" }));
      return;
    }
    if (typeof body.triesLeft === "number") setLimit((current) => ({ ...current, triesLeft: body.triesLeft }));
    setError(failureMessage({ status, body, triesBefore }, copy));
  };

  const changePost = (index, post) =>
    setResult((current) => {
      const next = { ...current, posts: current.posts.map((p, i) => (i === index ? post : p)) };
      keepWords(next);
      return next;
    });

  // Start again throws away a try's posts, so it asks first, in place.
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => {
    if (confirming) document.getElementById("pps-keep")?.focus();
  }, [confirming]);

  const startAgain = () => {
    setConfirming(false);
    forgetResult();
    setResult(null);
    clearPhotos();
    setInstruction("");
    setError("");
    setNotice("");
  };

  const pickExample = (example) => {
    setInstruction(example);
    document.getElementById("pps-instruction")?.focus();
  };

  return (
    <div className="pps stack-7">
      <div className="pps-upload stack-5">
        <LimitArea limit={limit} slug={app.slug} copy={copy} />

        {!outOfTries && (
          <>
            <FileDrop
              id="pps-files"
              label={copy.uploadLabel}
              hint={copy.uploadHint}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              multiple
              camera
              disabled={photos.length >= MAX_PHOTOS || sending}
              onFiles={addPhotos}
            />

            {notice && (
              <Alert tone="info" icon={<Icon name="info" size={18} />}>
                {notice}
              </Alert>
            )}

            {photos.length > 0 && (
              <ul className="pps-photos" aria-label={copy.uploadLabel}>
                {photos.map((photo, index) => (
                  <li key={photo.id} className="pps-photo">
                    {photo.previewUrl ? (
                      <img src={photo.previewUrl} alt="" width={48} height={48} className="pps-thumb" />
                    ) : (
                      <span className="pps-thumb pps-thumb--empty" aria-hidden="true">
                        <Icon name={photo.status === "error" ? "alert-circle" : "image"} size={20} />
                      </span>
                    )}
                    <span className="pps-photo-text">
                      <span className="pps-photo-name">{copy.files.label(index + 1)}</span>
                      <span className={`pps-photo-status${photo.status === "error" ? " pps-photo-status--error" : ""}`}>
                        {photo.status === "preparing"
                          ? copy.preparing
                          : photo.status === "error"
                            ? fileMessage(photo.reason, copy)
                            : photo.name}
                      </span>
                    </span>
                    <IconButton
                      type="button"
                      size="lg"
                      variant="ghost"
                      label={copy.files.remove(index + 1)}
                      disabled={sending}
                      onClick={() => removePhoto(photo.id)}
                      icon={<Icon name="x" size={20} />}
                    />
                  </li>
                ))}
              </ul>
            )}

            <Field label={copy.instruction} htmlFor="pps-instruction">
              <Textarea
                id="pps-instruction"
                name="instruction"
                rows={3}
                value={instruction}
                placeholder={placeholder}
                maxLength={FIELD_LIMITS.instruction}
                aria-describedby="pps-instruction-hint"
                disabled={sending}
                onChange={(event) => setInstruction(event.target.value)}
              />
              <span id="pps-instruction-hint" className="pps-hint">
                {copy.instructionHint}
              </span>
            </Field>
            <ul className="pps-examples" aria-label={copy.examplesLabel}>
              {copy.examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    className="pps-example"
                    aria-pressed={instruction === example ? "true" : "false"}
                    disabled={sending}
                    onClick={() => pickExample(example)}
                  >
                    <Tag selected={instruction === example}>{example}</Tag>
                  </button>
                </li>
              ))}
            </ul>

            <Field label={copy.name} htmlFor="pps-name">
              <Input
                id="pps-name"
                name="business-name"
                value={name}
                maxLength={FIELD_LIMITS.name}
                autoComplete="organization"
                aria-describedby="pps-name-hint"
                disabled={sending}
                style={TAP_INPUT}
                onChange={(event) => setName(event.target.value)}
              />
              <span id="pps-name-hint" className="pps-hint">
                {copy.nameHint}
              </span>
            </Field>

            <div className="pps-send stack-3">
              <div>
                <Button
                  type="button"
                  size="lg"
                  disabled={blocker !== null}
                  aria-describedby={whyNot ? "pps-make-why pps-one-try" : "pps-one-try"}
                  onClick={make}
                  iconLeft={<Icon name={sending ? "loader" : "image"} size={20} />}
                >
                  {sending ? copy.making : copy.make}
                </Button>
              </div>
              {whyNot && (
                <p className="pps-hint" id="pps-make-why">
                  {whyNot}
                </p>
              )}
              <p className="pps-hint" id="pps-one-try">
                {copy.oneTry}
              </p>
              <div ref={widgetRef} className="pps-turnstile" />
            </div>
          </>
        )}

        <div className="tb-live" aria-live="polite">
          {sending && (
            <Alert tone="info" icon={<Icon name="clock" size={18} />}>
              {copy.progress}
            </Alert>
          )}
          {error && (
            <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
              {error}
            </Alert>
          )}
        </div>
      </div>

      {result && (
        <section className="pps-results stack-5" aria-labelledby="pps-results-heading">
          <div className="pps-results-head">
            <h2 id="pps-results-heading" ref={resultsRef} tabIndex={-1} className="pps-results-heading">
              {R.heading}
            </h2>
            {!confirming && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setConfirming(true)}
                iconLeft={<Icon name="rotate-ccw" size={18} />}
              >
                {R.startAgain}
              </Button>
            )}
          </div>
          {confirming && (
            <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
              <span className="stack-3">
                <span>{R.confirmClear}</span>
                <span className="tb-actions">
                  <Button type="button" size="lg" onClick={startAgain}>
                    {R.clear}
                  </Button>
                  <Button type="button" id="pps-keep" variant="secondary" size="lg" onClick={() => setConfirming(false)}>
                    {R.keep}
                  </Button>
                </span>
              </span>
            </Alert>
          )}
          <p className="pps-hint pps-results-hint">{R.hint}</p>

          {result.posts.some((p) => p.lost) && (
            <Alert tone="info" icon={<Icon name="info" size={18} />}>
              {R.picturesLost}
            </Alert>
          )}

          {result.products.length > 0 && (
            <div className="pps-products stack-2">
              <h3 className="pps-products-heading">{R.products}</h3>
              <ul className="pps-products-list">
                {result.products.map((product, i) => (
                  <li key={`${product.name}-${i}`}>
                    <strong>{product.name}</strong>
                    {product.description ? `: ${product.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="pps-frames">
            {result.posts.map((post, index) => (
              <PostFrame
                key={index}
                post={post}
                index={index}
                name={result.name ?? ""}
                copy={copy}
                onChange={(next) => changePost(index, next)}
                onUsed={markUsed}
                onToast={setToast}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="pps-toast" aria-live="polite">
        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
