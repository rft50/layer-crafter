import { ProcessedComputable } from "../util/computed";
import Decimal, { DecimalSource, format } from "../util/bignum";
import { computed, Ref, unref } from "vue";
import { WithRequired } from "../util/common";
import { Modifier } from "../game/modifiers";

export type CapModifierData = {
    cap: Ref<ProcessedComputable<DecimalSource>>;
};
export function createCapModifier(data: CapModifierData): WithRequired<Modifier, "description"> {
    return {
        apply: (g: DecimalSource): DecimalSource => {
            if (Decimal.lt(unref(data.cap.value), g)) {
                return unref(data.cap.value);
            }
            return g;
        },
        description: computed(() => "Cap at " + format(unref(data.cap.value)))
    };
}