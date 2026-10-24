import React from "react";
import { Button, Icon } from "../../ds.js";
import { FILE_DROP } from "../../content.js";

/**
 * A drop zone with a real button inside it, so it works by drag, by click,
 * by keyboard and by touch. `camera` adds a second button that opens the
 * phone's camera directly (`capture="environment"`).
 *
 * Files are handed to `onFiles` as an array and never leave the browser here.
 * `dropNote={false}` leaves out the "or drop them here" line, for a label
 * that already says so.
 */
export function FileDrop({
  id,
  label,
  hint,
  accept,
  multiple = false,
  camera = false,
  disabled = false,
  dropNote = true,
  onFiles,
}) {
  const pickerRef = React.useRef(null);
  const cameraRef = React.useRef(null);
  const [over, setOver] = React.useState(false);
  const hintId = hint ? `${id}-hint` : undefined;

  const take = (list) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  };

  const onChange = (event) => {
    take(event.target.files);
    // Let the same file be chosen again after a reset.
    event.target.value = "";
  };

  return (
    <div
      className={`tb-drop${over ? " tb-drop--over" : ""}${disabled ? " tb-drop--disabled" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) take(event.dataTransfer.files);
      }}
    >
      <span className="tb-drop-icon" aria-hidden="true">
        <Icon name="upload" size={24} color="var(--green-600)" />
      </span>
      <p className="tb-drop-label" id={`${id}-label`}>
        {label}
      </p>
      {hint && (
        <p className="tb-drop-hint" id={hintId}>
          {hint}
        </p>
      )}

      <div className="tb-drop-buttons">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={disabled}
          aria-describedby={hintId}
          onClick={() => pickerRef.current?.click()}
          iconLeft={<Icon name="folder-open" size={20} />}
        >
          {multiple ? FILE_DROP.choose : FILE_DROP.chooseOne}
        </Button>
        {camera && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={disabled}
            className="tb-camera"
            onClick={() => cameraRef.current?.click()}
            iconLeft={<Icon name="camera" size={20} />}
          >
            {FILE_DROP.camera}
          </Button>
        )}
      </div>
      {dropNote && <span className="tb-drop-or">{multiple ? FILE_DROP.drop : FILE_DROP.dropOne}</span>}

      <input
        ref={pickerRef}
        id={id}
        className="tb-visually-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        tabIndex={-1}
        onChange={onChange}
      />
      {camera && (
        <input
          ref={cameraRef}
          className="tb-visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          aria-label={FILE_DROP.camera}
          tabIndex={-1}
          onChange={onChange}
        />
      )}
    </div>
  );
}
