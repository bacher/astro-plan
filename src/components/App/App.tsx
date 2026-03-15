import { useEffect, useState } from 'react';
import { InteractiveMap } from '../InteractiveMap/InteractiveMap';
import { InteractiveMap_ellipse } from '../InteractiveMap/InteractiveMap_ellipse';
import { InteractiveMap_orbit } from '../InteractiveMap/InteractiveMap_orbit';
import { InteractiveMap_flow } from '../InteractiveMap/InteractiveMap_flow';
import styles from './App.module.css';

const APPS = {
  classic: {
    name: 'Classic',
    component: InteractiveMap,
  },
  ellipse: { name: 'Ellipse', component: InteractiveMap_ellipse },
  orbit: { name: 'Orbit', component: InteractiveMap_orbit },
  flow: { name: 'Flow', component: InteractiveMap_flow },
} as const;

const appsList = [...Object.entries(APPS)].map(([id, { name, component }]) => ({
  id,
  name,
  component,
}));

type AppType = keyof typeof APPS;

function getAppTypeFromHash(): AppType {
  return (
    (new URLSearchParams(location.hash.substring(1)).get('app') as AppType | undefined) ?? 'flow'
  );
}

export function App() {
  const [appSelected, setAppSelected] = useState<AppType>(getAppTypeFromHash);

  useEffect(() => {
    window.addEventListener('hashchange', () => {
      setAppSelected(getAppTypeFromHash());
    });
  }, [appSelected]);

  const AppComponent = (APPS[appSelected] ?? APPS.orbit).component;

  return (
    <>
      <label className={styles.appSelector}>
        Select the app:{' '}
        <select
          value={appSelected}
          onChange={(event) => {
            const newAppType = event.target.value as AppType;
            location.replace(`#app=${newAppType}`);
          }}
        >
          {appsList.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.app}>
        <AppComponent />
      </div>
    </>
  );
}
