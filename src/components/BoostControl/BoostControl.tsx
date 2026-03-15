import styles from './BoostControl.module.css';

import type { Boost } from '../InteractiveMap/InteractiveMap_flow';
import { useRef, useState } from 'react';

type BoostControlProps = {
  boost: Boost;
  setBoost: (boost: Boost) => void;
};

export const BoostControl = ({ boost, setBoost }: BoostControlProps) => {
  const [boostAmountString, setBoostAmountString] = useState(() =>
    boost.type === 'predefined' ? boost.amount.toString() : '',
  );

  let boostValue;
  if (boost.type === 'predefined') {
    boostValue = boost.amount;
  } else {
    boostValue = 0;
  }

  const lastBoostValueRef = useRef(boostValue);

  if (
    boostValue !== lastBoostValueRef.current &&
    Number.parseFloat(boostAmountString) !== boostValue
  ) {
    setBoostAmountString(boostValue.toString());
  }

  lastBoostValueRef.current = boostValue;

  return (
    <div className={styles.boostSelector}>
      <div className={styles.boostSelectorButtons}>
        <label>
          <input
            type="radio"
            name="boost"
            value="manual"
            checked={boost.type === 'manual'}
            onChange={() => {
              setBoost({
                type: 'manual',
              });
            }}
          />
          Manual
        </label>
        <label>
          <input
            type="radio"
            name="boost"
            value="predefined"
            checked={boost.type === 'predefined'}
            onChange={() => {
              setBoost({
                type: 'predefined',
                amount: 100,
              });
            }}
          />
          Predefined
        </label>
      </div>
      {boost.type === 'predefined' && (
        <>
          <input
            className={styles.boostRange}
            type="range"
            min="10"
            max="10000"
            value={boost.amount}
            onChange={(event) => {
              setBoost({
                type: 'predefined',
                amount: event.currentTarget.valueAsNumber,
              });
            }}
          />
          <input
            className={styles.boostAmount}
            type="number"
            value={boostAmountString}
            onChange={(event) => {
              setBoostAmountString(event.currentTarget.value);

              if (!Number.isNaN(event.currentTarget.valueAsNumber)) {
                setBoost({
                  type: 'predefined',
                  amount: event.currentTarget.valueAsNumber,
                });
              }
            }}
          />
          m/s
        </>
      )}
    </div>
  );
};
