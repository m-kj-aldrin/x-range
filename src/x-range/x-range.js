const customRangeTemplate = document.createElement("template");
customRangeTemplate.innerHTML = `
<style>
    :host{
        display: block;
        /*outline: 1px #0f09 solid;*/
        padding: 4px;
        cursor: ew-resize;
        font-family: monospace;
    }
    svg{
        display: block;
        /*border: 1px #f009 solid;*/
        overflow: visible;
    }
    svg:focus{
        outline-offset: 2px;
        outline: none;
    }
    #marker rect{
        outline-offset: 2px;
    }
    svg:focus #marker rect{
        outline: 1px currentColor solid;
    }
    foreignObject{
        overflow: visible;
    }
    #value{
        width: max-content;
        /*outline: 1px red solid;*/
        transform: translate(-50%,-50%);
        padding: 0 0.5ch;
        z-index: 100;
        position: absolute;
        cursor: text;
    }
    #value:focus{
        outline: 1px currentColor solid;
    }
</style>
<svg width="100%" height="16" tabindex="0">
    <rect width="100%" height="2" y="7"></rect>
    <g id="marker">
        <rect x="0" y="4" width="2" height="8"></rect>
        <foreignObject width="100%" height="100%" y="-4">
            <div id="value" contenteditable="true" onpointerdown="event.stopPropagation()"></div>
        </foreignObject>
    </g>
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

function getActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot) {
        active = active.shadowRoot.activeElement;
    }
    return active;
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
        value = clamp(value, this.#min, this.#max);
        this.#value = quantize(value, this.#step);

        this.#normalValue = mapRange(this.#value, this.#min, this.#max, 0, 1);
        this.#updateSliderPosition();
    }
    get normalValue() {
        return this.#normalValue;
    }
    set normalValue(value) {
        value = clamp(value, 0, 1);
        this.#normalValue = quantize(value, this.#normalStep);

        this.#value = quantize(
            mapRange(value, 0, 1, this.#min, this.#max),
            this.#step
        );

        this.#updateSliderPosition();
    }

    #attachListeners() {
        this.shadowRoot.querySelector("#value").addEventListener(
            "input",
            /**@param {HTMLInputEvent} e*/ (e) => {
                e.stopPropagation();
                let textValue = e.target.textContent;
                let test = /\d+\.$/.test(textValue);
                if (test) {
                    return;
                }

                let parsedValue = parseFloat(textValue);
                if (!isNaN(parsedValue)) {
                    this.value = parsedValue;
                    this.#emit();
                }
            }
        );

        this.addEventListener("pointerdown", this.#dragStart.bind(this));
        this.addEventListener("keydown", (e) => {
            let key = e.key;
            let activeElement = getActiveElement();

            let direction = 0;

            if (activeElement.id == "value") {
                if (key == "ArrowUp" || key == "ArrowDown") {
                    direction =
                        key == "ArrowUp" ? 1 : key == "ArrowDown" ? -1 : 0;
                    e.preventDefault();
                }
            } else {
                direction =
                    key == "ArrowRight" ? 1 : key == "ArrowLeft" ? -1 : 0;
            }

            if (!direction) return;

            this.value = this.value + direction * this.#step;
            this.#emit();
        });
    }

    /**@param {HTMLPointerEvent} e */
    #editValueHandler(e) {
        e.target.setAttribute("contenteditable", "true");
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

        let markerElement = svg.querySelector("#marker");
        markerElement.querySelector("rect").setAttribute("x", `${x}`);
        markerElement.querySelector("foreignObject").setAttribute("x", `${x}`);
        markerElement.querySelector("#value").textContent = `${this.value}`;
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
