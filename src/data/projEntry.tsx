import Spacer from "components/layout/Spacer.vue";
import { jsx } from "features/feature";
import type { BaseLayer, GenericLayer } from "game/layers";
import { addLayer, createLayer, getLayer, removeLayer } from "game/layers";
import type { LayerData, Player } from "game/player";
import player from "game/player";
import { format, formatTime } from "util/bignum";
import { render } from "util/vue";
import { computed, unref } from "vue";
import { BoardNode, BoardNodeLink, createBoard, Shape } from "../features/boards/board";
import { getNode } from "./util";
import createCascade from "./layers/cascade";

type BuilderState = {
    active: boolean;
    linked: number[];
};

type LayerState = {
    type: string;
    layerId: string | null;
};

/**
 * @hidden
 */
export const main = createLayer("main", function (this: BaseLayer) {
    const builder = computed(() => unref(board.types.builder.nodes)[0]);
    const board = createBoard(board => ({
        links: () => {
            const links: BoardNodeLink[] = [];
            unref(board.nodes);
            (builder.value.state as { linked: number[] }).linked.forEach(id => {
                links.push({
                    startNode: builder.value,
                    endNode: getNode(board, id),
                    stroke: "var(--foreground)",
                    strokeWidth: 4
                });
            });
            return links;
        },
        types: {
            builder: {
                actions: [
                    {
                        icon: "build",
                        id: "build",
                        onClick: builder => {
                            const state = builder.state as BuilderState;
                            const linked = state.linked
                            if (!state.active && linked.length > 0) {
                                // build the stuff
                                state.active = true;
                                for (let i = 0; i < linked.length; i++) {
                                    const node = getNode(board, linked[i]);
                                    const layer = createLayerFromNode(node);
                                    addLayer(layer, player);
                                    player.tabs.push(layer.id);

                                    node.position = {
                                        x: builder.position.x - 50 * linked.length + 100 * i + 50,
                                        y: builder.position.y + 300
                                    };
                                }
                            } else if (state.active) {
                                // break it apart
                                state.active = false;
                                for (let i = 0; i < linked.length; i++) {
                                    const node = getNode(board, linked[i]);
                                    const state = node.state as LayerState;
                                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                    const layerId = state.layerId!;
                                    removeLayer(getLayer(layerId));
                                    delete player.layers[layerId];
                                    const index = player.tabs.indexOf(layerId);
                                    player.tabs.splice(index, 1);
                                    state.layerId = null;
                                }
                            }
                        },
                        tooltip: {
                            text: "BUILD"
                        }
                    }
                ],
                canAccept: (t, other) => {
                    return !(t.state as BuilderState).active;
                },
                draggable: false,
                onDrop: (t, other) => {
                    const linked = (t.state as BuilderState).linked;
                    if (linked.includes(other.id)) {
                        // removal
                        linked.splice(linked.indexOf(other.id), 1);
                    } else {
                        // insertion
                        linked.push(other.id);
                    }
                },
                shape: Shape.Diamond,
                size: 100,
                title: "Builder"
            },
            layer: {
                draggable: t => {
                    return (t.state as LayerState).layerId === null;
                },
                onClick: t => {
                    const id = (t.state as LayerState).layerId;
                    if (id != null) {
                        if (player.tabs.includes(id)) {
                            const index = player.tabs.lastIndexOf(id);
                            player.tabs.splice(index, 1);
                        } else {
                            player.tabs.push(id);
                        }
                    }
                },
                shape: Shape.Circle,
                size: 50,
                title: node => {
                    return (node.state as LayerState).type;
                }
            }
        },
        startNodes: () => [
            {
                position: { x: 0, y: 0 },
                type: "builder",
                state: {
                    active: false,
                    linked: []
                }
            },
            {
                position: { x: 100, y: 100 },
                type: "layer",
                state: {
                    type: "cascade",
                    layerId: null
                }
            }
        ]
    }));

    return {
        name: "Board",
        display: jsx(() => (
            <>
                {player.devSpeed === 0 ? <div>Game Paused</div> : null}
                {player.devSpeed != null && player.devSpeed !== 0 && player.devSpeed !== 1 ? (
                    <div>Dev Speed: {format(player.devSpeed)}x</div>
                ) : null}
                {player.offlineTime != null && player.offlineTime !== 0 ? (
                    <div>Offline Time: {formatTime(player.offlineTime)}</div>
                ) : null}
                <Spacer />
                {render(board)}
            </>
        )),
        board
    };
});

function createLayerFromNode(node: BoardNode): GenericLayer {
    const state = node.state as LayerState;
    const layer = createCascade({
        position: 0,
        size: 0,
        upgrade: 0,
        repeatable: 0
    });
    state.layerId = layer.id;
    return layer;
}

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<Player>
): Array<GenericLayer> => {
    const layers: GenericLayer[] = [main];
    (player.layers?.main as LayerData<typeof main>)?.board?.state?.nodes
        ?.filter(node => node?.type == "layer")
        .forEach(node => {
            const state = node.state as LayerState;
            if (state.layerId != null) {
                const layer = createLayerFromNode(node);
                layers.push(layer);
            }
        });
    return layers;
};

/**
 * A computed ref whose value is true whenever the game is over.
 */
export const hasWon = computed(() => {
    return false;
});

/**
 * Given a player save data object being loaded with a different version, update the save data object to match the structure of the current version.
 * @param oldVersion The version of the save being loaded in
 * @param player The save data being loaded in
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<Player>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
