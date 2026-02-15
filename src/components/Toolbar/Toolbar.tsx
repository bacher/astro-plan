import { last } from "lodash-es";
import styles from "./Toolbar.module.css";
import { useRef } from "react";

type ToolbarProps = {
  scale: number;
  dateTime: string;
  timeSpeed: number;
  onTimeSpeedChange: (time: number) => void;
};

const TIME_SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: "paused", value: 0 },
  { label: "1 second", value: 1 },
  { label: "1 minute", value: 60 },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
  { label: "2 day", value: 172800 },
  { label: "5 day", value: 432000 },
  { label: "10 day", value: 864000 },
  { label: "1 month", value: 2592000 },
  { label: "2 month", value: 5184000 },
  { label: "6 month", value: 12960000 },
  { label: "1 year", value: 31536000 },
];

const MAX_TIME_SPEED = last(TIME_SPEED_OPTIONS)!.value;

export function Toolbar({
  scale,
  dateTime,
  timeSpeed,
  onTimeSpeedChange,
}: ToolbarProps) {
  const previousTimeSpeedValueRef = useRef(0);

  const preselectedTimeSpeedOption = TIME_SPEED_OPTIONS.find(
    (option) => option.value === timeSpeed,
  );
  const timeSpeedSelectValue = preselectedTimeSpeedOption
    ? preselectedTimeSpeedOption.value
    : -1;

  return (
    <div className={styles.root}>
      <label>
        Scale:{" "}
        <input
          type="number"
          className={styles.smallInput}
          readOnly
          value={scale.toFixed(2)}
        />
      </label>
      Time Control:
      <button
        onClick={() => {
          const index = TIME_SPEED_OPTIONS.findIndex(
            (option) => option.value === timeSpeed,
          );
          if (index > 0) {
            const down = TIME_SPEED_OPTIONS[index - 1];
            onTimeSpeedChange(down.value);
          } else {
            onTimeSpeedChange(timeSpeed / 2);
          }
        }}
      >
        slow down
      </button>
      <button
        disabled={timeSpeed >= MAX_TIME_SPEED}
        onClick={() => {
          const index = TIME_SPEED_OPTIONS.findIndex(
            (option) => option.value === timeSpeed,
          );
          if (index !== -1 && TIME_SPEED_OPTIONS[index + 1]) {
            const up = TIME_SPEED_OPTIONS[index + 1];
            onTimeSpeedChange(up.value);
          } else {
            onTimeSpeedChange(timeSpeed * 2);
          }
        }}
      >
        speed up
      </button>
      <button
        onClick={() => {
          if (timeSpeed === 0) {
            onTimeSpeedChange(previousTimeSpeedValueRef.current);
          } else {
            previousTimeSpeedValueRef.current = timeSpeed;
            onTimeSpeedChange(0);
          }
        }}
      >
        {timeSpeed === 0 ? "resume" : "pause"}
      </button>
      <label className={styles.labelBlock}>
        <span className={styles.labelText}>1 sec =</span>
        <select
          value={timeSpeedSelectValue}
          onChange={(event) => {
            const value = Number(event.target.value);

            if (value !== -1) {
              onTimeSpeedChange(value);
            }
          }}
        >
          {timeSpeedSelectValue === -1 && (
            <option value="custom">Custom</option>
          )}
          {TIME_SPEED_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <input readOnly value={`x${timeSpeed}`} />
      <label className={styles.labelBlock}>
        Timestamp: <input readOnly value={dateTime} />
      </label>
    </div>
  );
}
