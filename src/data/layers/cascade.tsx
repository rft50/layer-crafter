import { BaseLayer, createLayer } from "game/layers";
import { createResource } from "../../features/resources/resource";
import Decimal, { DecimalSource, format } from "../../util/bignum";
import { createReset } from "../../features/reset";
import { createLayerTreeNode } from "../common";
import { addTooltip } from "../../features/tooltips/tooltip";
import { createResourceTooltip } from "../../features/trees/tree";
import { jsx } from "../../features/feature";
import MainDisplay from "../../features/resources/MainDisplay.vue";
import { createRepeatable, GenericRepeatable, RepeatableOptions } from "../../features/repeatable";
import { createCostRequirement, displayRequirements } from "../../game/requirements";
import { computed, effect, ref, Ref, unref } from "vue";
import { render } from "../../util/vue";
import { noPersist, persistent } from "../../game/persistence";
import {
    bonusAmountDecorator,
    BonusAmountFeatureOptions,
    GenericBonusAmountFeature
} from "../../features/decorators/bonusDecorator";
import {
    createModifierSection,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "../../game/modifiers";
import { WithRequired } from "../../util/common";
import {
    effectDecorator,
    EffectFeatureOptions,
    GenericEffectFeature
} from "../../features/decorators/common";
import { createUpgrade, GenericUpgrade, UpgradeOptions } from "../../features/upgrades/upgrade";

type LayerBuildData = {
    position: number;
    size: number;
    upgrade: number;
    repeatable: number;
};

type CascadeStructureData = {
    requiredSize: number;
    baseCost: DecimalSource;
    scaling: DecimalSource;
};

type CascadeStructure = GenericRepeatable &
    GenericBonusAmountFeature & {
        bonusAmountRaw: Ref<DecimalSource>;
    };

type CascadeStructureOptions = RepeatableOptions &
    BonusAmountFeatureOptions & {
        bonusAmountRaw: Ref<DecimalSource>;
    };

type CascadeUpgrade = GenericUpgrade & GenericEffectFeature<DecimalSource>;

type CascadeUpgradeOptions = UpgradeOptions & EffectFeatureOptions<DecimalSource>;

type CascadeRepeatable = GenericRepeatable & GenericEffectFeature<DecimalSource>;

type CascadeRepeatableOptions = RepeatableOptions & EffectFeatureOptions<DecimalSource>;

const structureData: CascadeStructureData[] = [
    {
        requiredSize: -2,
        baseCost: 1,
        scaling: 1.4
    },
    {
        requiredSize: -1,
        baseCost: 1e5,
        scaling: 1.5
    },
    {
        requiredSize: 0,
        baseCost: 1e12,
        scaling: 1.6
    }
];

const createCascade = function (data: LayerBuildData) {
    const id = "C";
    const name = "Cascade-" + data.position;
    const color = "#4BDC13";
    const layer = createLayer(id + "-" + data.position, function (this: BaseLayer) {
        const points = createResource<DecimalSource>(1, "stuff");

        const reset = createReset(() => ({
            thingsToReset: (): Record<string, unknown>[] => [layer]
        }));

        const treeNode = createLayerTreeNode(() => ({
            layerID: this.id,
            display: id,
            color,
            reset
        }));
        const tooltip = addTooltip(treeNode, {
            display: createResourceTooltip(points),
            pinnable: true
        });

        const structures: CascadeStructure[] = [];
        const modifiers: Modifier[][] = [];
        for (let i = 0; i < structureData.length; i++) {
            const data = structureData[i];
            structures[i] = createRepeatable<CascadeStructureOptions>(
                obj => ({
                    requirements: createCostRequirement(() => ({
                        cost: computed(() => {
                            return Decimal.mul(
                                data.baseCost,
                                Decimal.pow(data.scaling, unref(obj.amount))
                            );
                        }),
                        resource: noPersist(points)
                    })),
                    display: jsx(() => (
                        <>
                            {id + "-" + i}
                            <br />
                            {"Amount: " +
                                format(unref((obj as unknown as CascadeStructure).totalAmount)) +
                                " (" +
                                format(unref(obj.amount)) +
                                ")"}
                            <br />
                            {displayRequirements((obj as unknown as CascadeStructure).requirements)}
                        </>
                    )),
                    bonusAmountRaw: persistent(0),
                    bonusAmount: computed(() => (obj as unknown as CascadeStructure).bonusAmountRaw.value),
                }),
                bonusAmountDecorator
            ) as unknown as CascadeStructure;
            modifiers[i] = [
                createMultiplicativeModifier(() => ({
                    multiplier: structures[i].totalAmount,
                    description: () => "Structure Count"
                }))
            ];
        }

        const upgrades: Record<string, CascadeUpgrade> = {
            res0: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 200,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(1.1, unref(structures[0].amount));
                    },
                    display: {
                        title: "Resonance 0",
                        description: "Purchased C-0 boost themselves by 1.1x",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    }
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade
        };

        const repeatables: CascadeRepeatable[] = [
            createRepeatable<CascadeRepeatableOptions>(
                rep => ({
                    requirements: createCostRequirement(() => ({
                        cost: computed(() => {
                            return Decimal.mul(100, Decimal.pow(100, unref(rep.amount)));
                        }),
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(3, unref(rep.amount));
                    },
                    display: {
                        title: "CR-0",
                        description: "3x C-0 production per level",
                        effectDisplay: jsx(() => (
                            <>{format(unref((rep as unknown as CascadeUpgrade).effect)) + "x"}</>
                        ))
                    },
                    limit: 5
                }),
                effectDecorator
            ) as unknown as CascadeRepeatable
        ];

        const allBoostModifiers: Modifier[] = [
            createMultiplicativeModifier(() => ({
                multiplier: 2,
                enabled: () => Decimal.gt(unref(repeatables[0].amount), 0),
                description: "Spectrum 1"
            }))
        ];
        const allBoostModifier = createSequentialModifier(() => allBoostModifiers);

        const sequentialModifiers: WithRequired<Modifier, "description">[] = [];
        for (let i = 0; i < modifiers.length; i++) {
            modifiers[i].push(allBoostModifier);
            sequentialModifiers[i] = createSequentialModifier(() => modifiers[i]);
        }

        modifiers[0].push(
            createMultiplicativeModifier(() => ({
                multiplier: upgrades.res0?.effect,
                enabled: upgrades.res0?.bought,
                description: "Resonance 0"
            }))
        );
        modifiers[0].push(
            createMultiplicativeModifier(() => ({
                multiplier: repeatables[0].effect,
                enabled: () => Decimal.gt(unref(repeatables[0].amount), 0),
                description: "CR-0"
            }))
        );

        this.on("update", diff => {
            points.value = Decimal.add(points.value, sequentialModifiers[0].apply(diff));
            for (let i = 0; i < structures.length - 1; i++) {
                structures[i].bonusAmountRaw.value = Decimal.add(
                    structures[i].bonusAmountRaw.value,
                    sequentialModifiers[i + 1].apply(diff)
                );
            }
        });

        return {
            name,
            color,
            points,
            tooltip,
            display: jsx(() => (
                <>
                    <MainDisplay resource={points} color={color} />
                    {render(upgrades.res0)}
                    <br />
                    {render(repeatables[0])}
                    <br />
                    {render(structures[0])}
                    <br />
                    {render(structures[1])}
                    <br />
                    {render(structures[2])}
                    <br />
                    {createModifierSection({
                        title: "All Boost",
                        modifier: allBoostModifier
                    })}
                    <br />
                    {createModifierSection({
                        title: "C-0 Production",
                        modifier: sequentialModifiers[0]
                    })}
                    <br />
                    {createModifierSection({
                        title: "C-1 Production",
                        modifier: sequentialModifiers[1]
                    })}
                </>
            )),
            treeNode,
            structures,
            upgrades,
            repeatables
        };
    });
    return layer;
};

// function createCascadeStructure(data: CascadeStructureOptions): CascadeStructure {
// }

export default createCascade;
