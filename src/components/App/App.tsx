import { InteractiveMap } from '../InteractiveMap/InteractiveMap';
import { InteractiveMap_ellipse } from '../InteractiveMap/InteractiveMap_ellipse';
import { InteractiveMap_orbit } from '../InteractiveMap/InteractiveMap_orbit';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.app}>
      {/* <InteractiveMap /> */}
      {/* <InteractiveMap_ellipse /> */}
      <InteractiveMap_orbit />
    </div>
  );
}
