import React from "react";
import { Badge, Button, Icon, Radio, Textarea } from "../../ds.js";
import { saveBlob } from "../_shared/download.js";
import { useBlobUrl } from "../_shared/useBlobUrl.js";
import { base64ToBlob, composeJpeg, pictureName, saveMode } from "./compose.js";
import { avatarInitial, chooseCaption, editCaption, shownCaption } from "./post-state.js";

/** "share" where this browser can hand a JPG to the share sheet, else "download". */
function useSaveMode() {
  const [mode, setMode] = React.useState("download");
  React.useEffect(() => {
    try {
      const probe = new File([new Uint8Array(1)], "probe.jpg", { type: "image/jpeg" });
      setMode(saveMode(navigator, probe));
    } catch {
      // Older browsers without File: keep the download.
    }
  }, []);
  return mode;
}

/**
 * One of the three posts, drawn to look like a social media post (no
 * platform's name or marks), with its controls under it.
 *
 *   post      { look, alt, image?, lost?, captions, choice, picked }
 *   name      the business name typed, or ""
 *   onChange  (post) => void, for the caption choice, edits and "Choose this one"
 *   onUsed    () => void, on a save or a copy (the usage count's "complete")
 *   onToast   (message) => void
 */
export function PostFrame({ post, index, name, copy, onChange, onUsed, onToast }) {
  const R = copy.results;
  const [shape, setShape] = React.useState("portrait");
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const picture = React.useMemo(() => (post.image ? base64ToBlob(post.image) : null), [post.image]);
  const url = useBlobUrl(picture);
  const mode = useSaveMode();
  const caption = shownCaption(post);
  const shown = name.trim() || R.yourBusiness;
  const initial = avatarInitial(name);
  const id = `pps-post-${index}`;
  const [firstLine, ...rest] = caption.split("\n");

  const save = async () => {
    setSaving(true);
    try {
      const blob = await composeJpeg(picture, shape);
      const filename = pictureName(post.look, shape);
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (saveMode(navigator, file) === "share") {
        try {
          await navigator.share({ files: [file] });
        } catch (error) {
          // The visitor closed the share sheet: nothing was saved, so nothing is counted.
          if (error?.name === "AbortError") return;
          saveBlob(blob, filename);
        }
      } else {
        saveBlob(blob, filename);
      }
      onUsed();
    } catch {
      onToast(R.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      onToast(R.copied);
      onUsed();
    } catch {
      onToast(R.copyFailed);
    }
  };

  return (
    <li className={`pps-frame${post.picked ? " pps-frame--picked" : ""}`}>
      <article className="pps-frame-inner" aria-labelledby={`${id}-title`}>
        <h3 id={`${id}-title`} className="tb-visually-hidden">
          {`${R.post(index + 1)}: ${post.look}`}
        </h3>

        <div className="pps-post">
          <div className="pps-post-head">
            {initial ? (
              <span className="pps-avatar" aria-hidden="true">{initial}</span>
            ) : (
              <span className="pps-avatar pps-avatar--icon" aria-hidden="true">
                <Icon name="store" size={18} />
              </span>
            )}
            <span className="pps-post-name">{shown}</span>
          </div>

          <div className={`pps-picture pps-picture--${shape}`}>
            {post.image ? (
              url ? <img src={url} alt={post.alt} width={1024} height={1280} /> : null
            ) : (
              <p className="pps-picture-note">{post.lost ? R.pictureLost : R.noPicture}</p>
            )}
          </div>

          <div className="pps-post-actions" aria-hidden="true">
            <Icon name="heart" size={22} />
            <Icon name="message-circle" size={22} />
            <Icon name="send" size={22} />
            <span className="pps-post-actions-gap" />
            <Icon name="bookmark" size={22} />
          </div>

          <p className="pps-post-caption">
            <strong>{shown}</strong> {firstLine}
            {rest.length > 0 && `\n${rest.join("\n")}`}
          </p>
        </div>

        <div className="pps-controls stack-4">
          <div className="pps-controls-head">
            <Badge tone="neutral">{post.look}</Badge>
            <Button
              type="button"
              variant={post.picked ? "primary" : "secondary"}
              size="lg"
              aria-pressed={post.picked ? "true" : "false"}
              onClick={() => onChange({ ...post, picked: !post.picked })}
              iconLeft={<Icon name={post.picked ? "check" : "plus"} size={18} />}
            >
              {R.choose}
            </Button>
          </div>

          {post.image && (
            <fieldset className="pps-choice">
              <legend>{R.shape}</legend>
              <div className="pps-choice-row">
                {["portrait", "square"].map((value) => (
                  <Radio
                    key={value}
                    name={`pps-shape-${index}`}
                    value={value}
                    label={R[value]}
                    checked={shape === value}
                    onChange={() => setShape(value)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="pps-choice">
            <legend>{R.captions}</legend>
            <div className="pps-choice-row">
              {post.captions.map((_, n) => (
                <Radio
                  key={n}
                  name={`pps-caption-${index}`}
                  value={String(n)}
                  label={R.captionOption(n + 1)}
                  checked={post.choice === n}
                  onChange={() => onChange(chooseCaption(post, n))}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              aria-expanded={editing ? "true" : "false"}
              aria-controls={editing ? `${id}-edit` : undefined}
              onClick={() => setEditing((open) => !open)}
              iconLeft={<Icon name={editing ? "check" : "pencil"} size={18} />}
            >
              {editing ? R.done : R.edit}
            </Button>
          </div>
          {editing && (
            <div id={`${id}-edit`} className="stack-2">
              <label htmlFor={`${id}-text`} className="pps-label">
                {R.editLabel(index + 1)}
              </label>
              <Textarea
                id={`${id}-text`}
                rows={7}
                value={caption}
                onChange={(event) => onChange(editCaption(post, event.target.value))}
              />
            </div>
          )}

          {post.image && <p className="pps-ai-note">{R.aiNote}</p>}

          <div className="pps-actions">
            {post.image && (
              <Button
                type="button"
                size="lg"
                disabled={saving}
                onClick={save}
                iconLeft={<Icon name={mode === "share" ? "share-2" : "download"} size={20} />}
              >
                {saving ? R.saving : mode === "share" ? R.share : R.download}
              </Button>
            )}
            <Button type="button" variant="secondary" size="lg" onClick={copyCaption} iconLeft={<Icon name="copy" size={20} />}>
              {R.copy}
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}
