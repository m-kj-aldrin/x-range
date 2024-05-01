import "../src/x-range/index.js";
import { CustomRangeElement } from "../src/x-range/x-range.js";

document.body.addEventListener("input", (e) => {
    if (e.target instanceof CustomRangeElement) {
        console.log(`v: ${e.target.value}, nv: ${e.target.normalValue}`);
    }
});

const range0 = document.createElement("x-range");
range0.setOptions({
    min: 0,
    max: 2,
    step: 0.01,
});

document.body.append(range0);
