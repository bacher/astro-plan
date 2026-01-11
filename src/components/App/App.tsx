import { InteractiveMap } from "../InteractiveMap/InteractiveMap";
import styles from "./App.module.css";

export function App() {
  return (
    <div className={styles.app}>
      <InteractiveMap />
    </div>
  );
}
