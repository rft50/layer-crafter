import { BaseBoard } from "../features/boards/board";

export function getNode(board: BaseBoard, id: number) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return board.nodes.value.find(node => node.id === id)!;
}