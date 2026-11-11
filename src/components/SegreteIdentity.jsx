import { classInfo, clsStyle } from "../data/segrete";
import { subclassName } from "../utils/segreteIdentity";

export default function SegreteIdentity({ cls, hero }) {
  const sub = subclassName(cls, hero);
  return <span style={clsStyle(cls)}><span style={{ color: "var(--cls)" }}>{classInfo(cls)?.it || cls}</span>{sub && <> · <span className="sgr-subclass" style={{ color: "color-mix(in srgb, var(--cls) 65%, #fff 35%)" }}>{sub}</span></>}</span>;
}
