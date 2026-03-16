import { Composition, registerRoot } from "remotion";
import { MainVideo } from "./MainVideo";
import { FPS, W, H } from "./constants";

const Root: React.FC = () => (
  <>
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={3415}
      fps={FPS}
      width={W}
      height={H}
    />
  </>
);

registerRoot(Root);
