import { CustomRangeElement } from "./x-range/x-range";

declare global {
    interface HTMLElementTagNameMap {
        "x-range": CustomRangeElement;
    }
    interface HTMLPointerEvent extends PointerEvent {
        target: HTMLElement;
    }
}
