const customRangeTemplate = document.createElement("template");
customRangeTemplate.innerHTML = `
<style>
    :host{
        display: block;
        outline: 1px #0f09 solid;
        padding: 4px;
        cursor: ew-resize;
    }
    svg{
        display: block;
        border: 1px #f009 solid;
        overflow: visible;
    }
    svg:focus{
        outline: 1px blue solid;
        outline-offset: 2px;
    }
</style>
<svg width="100%" height="16" tabindex="0">
    <rect width="100%" height="2" y="7"></rect>
    <rect id="marker" x="0" y="4" width="2" height="8"></rect>
</svg>
`;

/**
 * @param {number} x
 * @param {number} [min]
 * @param {number} [max]
 */
function clamp(x, min = 0, max = 1) {
    return Math.min(Math.max(x, min), max);
}

/**
 * @param {number} x
 * @param {number} fromMin
 * @param {number} fromMax
 * @param {number} toMin
 * @param {number} toMax
 */
function mapRange(x, fromMin, fromMax, toMin, toMax) {
    const fromRange = fromMax - fromMin; // Length of the source range
    const toRange = toMax - toMin; // Length of the target range
    const scaleFactor = toRange / fromRange; // Scale factor between ranges

    // Map the value then scale and shift to the new range
    return (x - fromMin) * scaleFactor + toMin;
}

/**
 * Quantizes a floating-point number to the nearest lower multiple of a given step.
 * @param {number} x - The value to quantize.
 * @param {number} step - The quantization step size.
 * @returns {number} The quantized value.
 */
function quantize(x, step) {
    return Math.floor(x / step) * step;
}

export class CustomRangeElement extends HTMLElement {
    #value = 0;
    #normalValue = 0;

    #min = 0;
    #max = 100;
    #step = 1;
    #normalStep = this.#min / this.#max;

    constructor() {
        super();

        this.attachShadow({ mode: "open" });

        this.shadowRoot.append(customRangeTemplate.content.cloneNode(true));

        this.#getOptionsAttribute();

        this.#attachListeners();
    }

    #getOptionsAttribute() {
        let minAttr = this.getAttribute("min") ?? this.#min;
        let maxAttr = this.getAttribute("max") ?? this.#max;
        let stepAttr = this.getAttribute("step") ?? this.#step;

        this.setOptions({
            min: +minAttr,
            max: +maxAttr,
            step: +stepAttr,
        });
    }

    /**
     * @param {object} options
     * @param {number} options.min
     * @param {number} options.max
     * @param {number} options.step
     */
    setOptions({ min, max, step }) {
        this.#min = min;
        this.#max = max;
        this.#step = step;
        this.#normalStep = this.#step / (this.#max - this.#min);
    }

    get value() {
        return this.#value;
    }
    set value(value) {
        this.#value = quantize(value, this.#step);

        this.#normalValue = mapRange(this.#value, this.#min, this.#max, 0, 1);
        this.#updateSliderPosition();
    }
    get normalValue() {
        return this.#normalValue;
    }
    set normalValue(value) {
        this.#normalValue = quantize(value, this.#normalStep);

        this.#value = quantize(
            mapRange(value, 0, 1, this.#min, this.#max),
            this.#step
        );

        this.#updateSliderPosition();
    }

    #attachListeners() {
        this.addEventListener("pointerdown", this.#dragStart.bind(this));
        this.addEventListener("keydown", (e) => {
            let direction =
                e.key == "ArrowRight" ? 1 : e.key == "ArrowLeft" ? -1 : 0;

            // this.#emit(this.normalValue + direction * this.#normalStep);
            this.value = this.value + direction * this.#step;
            this.#emit(0);
        });
    }

    /**@param {HTMLPointerEvent} e */
    #dragStart(e) {
        const abortController = new AbortController();
        this.setPointerCapture(e.pointerId);

        let f = this.#positionToRelativeValue.call(this, e);
        f = quantize(clamp(f), this.#normalStep);

        if (f != this.normalValue) {
            this.normalValue = f;
            this.#emit();
        }

        this.addEventListener("pointermove", this.#dragMove.bind(this), {
            signal: abortController.signal,
        });

        this.addEventListener(
            "pointerup",
            this.#dragEnd.bind(this, abortController)
        );
    }

    /**@param {HTMLPointerEvent} e */
    #dragMove(e) {
        let f = this.#positionToRelativeValue.call(this, e);
        f = quantize(clamp(f), this.#normalStep);

        if (f != this.normalValue) {
            this.normalValue = f;
            this.#emit();
        }
    }

    /**
     * @param {AbortController} abortController
     * @param {HTMLPointerEvent} e
     */
    #dragEnd(abortController, e) {
        this.releasePointerCapture(e.pointerId);
        abortController.abort();
    }

    #emit() {
        this.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    #getSvg() {
        return this.shadowRoot.querySelector("svg");
    }

    #updateSliderPosition() {
        let svg = this.#getSvg();
        let box = svg.getBoundingClientRect();

        let x = box.width * this.normalValue;
        svg.querySelector("#marker").setAttribute("x", `${x}`);
    }
    /**
     * @param {HTMLPointerEvent} e
     * @this {CustomRangeElement}
     */
    #positionToRelativeValue(e) {
        let box = this.#getSvg().getBoundingClientRect();
        let x = e.clientX - box.x;
        return x / box.width;
    }

    connectedCallback() {
        this.#updateSliderPosition();
    }
    disconnectedCallback() {}
}
