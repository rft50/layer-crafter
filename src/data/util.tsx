import { BaseBoard } from "../features/boards/board";
import { GenericLayer } from "../game/layers";
import { DecimalSource } from "../util/bignum";
import { Ref } from "vue";
import { Computable } from "../util/computed";
import { Unsubscribe } from "nanoevents";
export enum PartType {
    Size = "size",
    Upgrade = "upgrade",
    Repeatable = "repeatable"
}
export type PartData = {
    type: PartType;
    stars: number;
};
export type LayerBuildData = {
    position: number;
    size: number;
    upgrade: number;
    repeatable: number;
    layers: CraftedLayer[];
};
export type CraftedLayer = GenericLayer & {
    points: Ref<DecimalSource>;
    cap: Ref<Computable<DecimalSource>>;
    autoHooks?: Unsubscribe[];
};

export function getNode(board: BaseBoard, id: number) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return board.nodes.value.find(node => node.id === id)!;
}
