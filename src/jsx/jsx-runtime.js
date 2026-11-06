import { jsx as rjsx, jsxs as rjsxs, Fragment } from "react/jsx-runtime";
import { iconizeProps } from "./iconize";

export { Fragment };
export const jsx = (type, props, key) => rjsx(type, iconizeProps(type, props), key);
export const jsxs = (type, props, key) => rjsxs(type, iconizeProps(type, props), key);
