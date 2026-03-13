import { useEffect, useState } from 'react';
import { InteractiveMap } from '../InteractiveMap/InteractiveMap';
import { InteractiveMap_ellipse } from '../InteractiveMap/InteractiveMap_ellipse';
import { InteractiveMap_orbit } from '../InteractiveMap/InteractiveMap_orbit';
import styles from './App.module.css';

const APPS = {
  classic: InteractiveMap,
  ellipse: InteractiveMap_ellipse,
  orbit: InteractiveMap_orbit,
} as const;

type AppType = keyof typeof APPS;

function getAppTypeFromHash(): AppType {
  return (
    (new URLSearchParams(location.hash.substring(1)).get('app') as AppType | undefined) ?? 'orbit'
  );
}

export function App() {
  const [appSelected, setAppSelected] = useState<AppType>(getAppTypeFromHash);

  useEffect(() => {
    window.addEventListener('hashchange', () => {
      setAppSelected(getAppTypeFromHash());
    });
  }, [appSelected]);

  const AppComponent = APPS[appSelected] ?? APPS.orbit;

  return (
    <div className={styles.app}>
      <label>
        Select the app:{' '}
        <select
          value={appSelected}
          onChange={(event) => {
            const newAppType = event.target.value as AppType;
            location.replace(`#app=${newAppType}`);
          }}
        >
          <option value="classic">Classic</option>
          <option value="ellipse">Ellipse</option>
          <option value="orbit">Orbit</option>
        </select>
      </label>
      <AppComponent />
    </div>
  );
}
