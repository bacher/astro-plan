import { InteractiveMap } from "../InteractiveMap/InteractiveMap";
import { InteractiveMap_ellipse } from "../InteractiveMap/InteractiveMap_ellipse";
import styles from "./App.module.css";

export function App() {
  return (
    <div className={styles.app}>
      {/* <InteractiveMap /> */}
      <InteractiveMap_ellipse />
    </div>
  );
}
