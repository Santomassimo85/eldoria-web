import { jsxDEV as rjsxDEV, Fragment } from "react/jsx-dev-runtime";
import { iconizeProps } from "./iconize";

export { Fragment };
export const jsxDEV = (type, props, key, isStatic, source, self) => rjsxDEV(type, iconizeProps(type, props), key, isStatic, source, self);
